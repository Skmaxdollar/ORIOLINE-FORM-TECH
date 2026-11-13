(() => {
  const backend = window.siteBackend;
  const client = backend && backend.client;
  const data = { projects: [], messages: [], settings: {} };
  const $ = (id) => document.getElementById(id);
  let projectImageUrl = '';
  let originalImageUrl = '';
  let removeCurrentImage = false;
  let knownMessageIds = new Set();
  let initialLoadComplete = false;

  function showAlert(message, isError) {
    const alert = $('adminAlert');
    alert.textContent = message;
    alert.classList.toggle('error', Boolean(isError));
    alert.hidden = false;
  }

  function escapeHtml(value) {
    return String(value || '').replace(/[&<>"']/g, (character) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[character]));
  }

  function emailLink(email) {
    const safeEmail = String(email || '');
    return `<a href="mailto:${encodeURIComponent(safeEmail)}">${escapeHtml(safeEmail)}</a>`;
  }

  function formatDate(date) {
    return date ? new Date(date).toLocaleString() : '—';
  }

  function imageStoragePath(imageUrl) {
    const marker = '/storage/v1/object/public/project-images/';
    const index = String(imageUrl || '').indexOf(marker);
    return index < 0 ? '' : decodeURIComponent(imageUrl.slice(index + marker.length));
  }

  function render() {
    $('projectCount').textContent = String(data.projects.length);
    $('messageCount').textContent = String(data.messages.length);
    $('unreadCount').textContent = String(data.messages.filter((message) => !message.read_at).length);
    $('featuredCount').textContent = String(data.projects.filter((project) => project.featured).length);
    const unread = data.messages.filter((message) => !message.read_at).length;
    $('unreadBadge').textContent = unread > 99 ? '99+' : String(unread);
    $('unreadBadge').hidden = unread === 0;

    $('projectsList').innerHTML = data.projects.length ? data.projects.map((project) => `
      <tr>
        <td>${escapeHtml(project.title)}</td>
        <td>${escapeHtml(project.category || 'General')}</td>
        <td>${escapeHtml(project.location || '—')}</td>
        <td>${project.featured ? 'Featured' : '—'}</td>
        <td>
          <button class="row-button" type="button" data-edit="${project.id}">Edit</button>
          <button class="row-button danger" type="button" data-delete-project="${project.id}">Delete</button>
        </td>
      </tr>`).join('') : '<tr><td class="empty-row" colspan="5">No projects yet.</td></tr>';

    const messageRows = data.messages.map((message) => `
      <tr>
        <td>${escapeHtml(message.name)}</td>
        <td>${emailLink(message.email)}</td>
        <td>${escapeHtml(message.message)}</td>
        <td>${escapeHtml(formatDate(message.created_at))}${message.read_at ? '' : ' <strong>(New)</strong>'}</td>
        <td><button class="row-button danger" type="button" data-delete-message="${message.id}">Delete</button></td>
      </tr>`).join('');
    $('messagesList').innerHTML = messageRows || '<tr><td class="empty-row" colspan="5">No messages received yet.</td></tr>';
    $('recentMessages').innerHTML = data.messages.slice(0, 5).map((message) => `
      <tr><td>${escapeHtml(message.name)}</td><td>${emailLink(message.email)}</td>
      <td>${escapeHtml(message.message.slice(0, 90))}${message.message.length > 90 ? '…' : ''}</td>
      <td>${escapeHtml(formatDate(message.created_at))}</td></tr>`).join('') ||
      '<tr><td class="empty-row" colspan="4">No messages received yet.</td></tr>';

    if ($('settingsTab').hidden) {
      $('settingEmail').value = data.settings.site_email || '';
      $('settingHeroTitle').value = data.settings.hero_title || '';
      $('settingHeroSubtitle').value = data.settings.hero_subtitle || '';
    }
  }

  async function loadData(notify) {
    const [projectsResult, messagesResult, settingsResult] = await Promise.all([
      client.from('projects').select('*').order('sort_order').order('created_at'),
      client.from('messages').select('*').order('created_at', { ascending: false }),
      client.from('site_settings').select('key,value')
    ]);
    const failure = projectsResult.error || messagesResult.error || settingsResult.error;
    if (failure) throw failure;

    const messages = messagesResult.data || [];
    if (notify && initialLoadComplete) {
      const newMessages = messages.filter((message) => !knownMessageIds.has(message.id));
      if (newMessages.length) {
        showAlert(`${newMessages.length} new website message${newMessages.length === 1 ? '' : 's'} received.`);
      }
    }
    knownMessageIds = new Set(messages.map((message) => message.id));
    data.projects = projectsResult.data || [];
    data.messages = messages;
    data.settings = Object.fromEntries((settingsResult.data || []).map((setting) => [setting.key, setting.value]));
    initialLoadComplete = true;
    render();
  }

  function switchTab(tab) {
    document.querySelectorAll('.tab-panel').forEach((panel) => { panel.hidden = panel.id !== `${tab}Tab`; });
    document.querySelectorAll('.nav-item').forEach((button) => button.classList.toggle('active', button.dataset.tab === tab));
    $('pageTitle').textContent = tab === 'settings' ? 'Site settings' : `${tab[0].toUpperCase()}${tab.slice(1)}`;
    if (tab === 'messages') markMessagesRead();
  }

  async function markMessagesRead() {
    const { error } = await client.from('messages').update({ read_at: new Date().toISOString() }).is('read_at', null);
    if (error) {
      showAlert(`Could not mark messages as read: ${error.message}`, true);
      return;
    }
    try {
      await loadData(false);
    } catch (loadError) {
      showAlert(`Messages were marked read, but the dashboard could not refresh: ${loadError.message}`, true);
    }
  }

  function openProject(project) {
    $('projectForm').reset();
    $('projectId').value = project ? project.id : '';
    $('projectDialogTitle').textContent = project ? 'Edit project' : 'Add project';
    $('projectTitle').value = project ? project.title : '';
    $('projectCategory').value = project ? project.category : '';
    $('projectLocation').value = project ? project.location : '';
    $('projectDescription').value = project ? project.description : '';
    $('projectFeatured').checked = project ? project.featured : false;
    projectImageUrl = project ? project.image_url || '' : '';
    originalImageUrl = projectImageUrl;
    removeCurrentImage = false;
    $('imagePreview').src = projectImageUrl;
    $('imagePreview').hidden = !projectImageUrl;
    $('removeImageBtn').hidden = !projectImageUrl;
    $('projectDialog').showModal();
  }

  async function uploadImage(file) {
    if (!file) return projectImageUrl;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      throw new Error('Choose a JPEG, PNG, or WebP image.');
    }
    if (file.size > 10 * 1024 * 1024) throw new Error('The image must be 10 MB or smaller.');
    const path = `${crypto.randomUUID()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
    const { error } = await client.storage.from('project-images').upload(path, file, {
      contentType: file.type,
      upsert: false
    });
    if (error) throw error;
    return client.storage.from('project-images').getPublicUrl(path).data.publicUrl;
  }

  async function saveProject() {
    const saveButton = $('saveProjectBtn');
    saveButton.disabled = true;
    let uploadedImageUrl = '';
    let projectSaved = false;
    let cleanupWarning = '';
    try {
      const id = $('projectId').value;
      const title = $('projectTitle').value.trim();
      if (!title) throw new Error('A project title is required.');
      const featured = $('projectFeatured').checked;
      const featuredCount = data.projects.filter((project) => project.featured && project.id !== id).length;
      if (featured && featuredCount >= 4) throw new Error('You can feature a maximum of four projects.');

      const file = $('projectImage').files[0];
      uploadedImageUrl = await uploadImage(file);
      const project = {
        title,
        category: $('projectCategory').value.trim(),
        location: $('projectLocation').value.trim(),
        description: $('projectDescription').value.trim(),
        featured,
        image_url: uploadedImageUrl || (removeCurrentImage ? '' : projectImageUrl),
        sort_order: id ? data.projects.find((item) => item.id === id).sort_order : data.projects.length
      };
      const result = id
        ? await client.from('projects').update(project).eq('id', id).select('id').single()
        : await client.from('projects').insert(project).select('id').single();
      if (result.error) throw result.error;
      projectSaved = true;
      if (id && (file || removeCurrentImage)) {
        const oldPath = imageStoragePath(originalImageUrl);
        if (oldPath) {
          const { error } = await client.storage.from('project-images').remove([oldPath]);
          if (error) cleanupWarning = `Project saved, but the previous image could not be removed: ${error.message}`;
        }
      }
      $('projectDialog').close();
      await loadData(false);
      showAlert(cleanupWarning || 'Project saved. The public website now uses the updated portfolio.', Boolean(cleanupWarning));
    } catch (error) {
      if (!projectSaved && uploadedImageUrl && uploadedImageUrl !== projectImageUrl) {
        const uploadedPath = imageStoragePath(uploadedImageUrl);
        if (uploadedPath) {
          const { error: cleanupError } = await client.storage.from('project-images').remove([uploadedPath]);
          if (cleanupError) cleanupWarning = `The uploaded image could not be cleaned up: ${cleanupError.message}`;
        }
      }
      showAlert(`${error.message || (projectSaved ? 'Project saved.' : 'Could not save project.')}${cleanupWarning ? ` ${cleanupWarning}` : ''}`, true);
    } finally {
      saveButton.disabled = false;
    }
  }

  async function deleteProject(id) {
    const project = data.projects.find((item) => item.id === id);
    if (!project || !window.confirm(`Delete "${project.title}"?`)) return;
    const { error } = await client.from('projects').delete().eq('id', id);
    if (error) throw error;
    const path = imageStoragePath(project.image_url);
    if (path) {
      const { error: imageError } = await client.storage.from('project-images').remove([path]);
      if (imageError) showAlert(`Project deleted, but its image could not be removed: ${imageError.message}`, true);
    }
    await loadData(false);
  }

  async function deleteMessage(id) {
    if (!window.confirm('Delete this message permanently?')) return;
    const { error } = await client.from('messages').delete().eq('id', id);
    if (error) throw error;
    await loadData(false);
  }

  async function requireAdmin() {
    if (!backend || !backend.ready) throw new Error(backend ? backend.error : 'Backend is unavailable.');
    const { data: sessionData, error } = await client.auth.getSession();
    if (error) throw error;
    if (!sessionData.session) {
      window.location.replace('./login.html');
      return false;
    }
    const { data: allowlist, error: allowlistError } = await client.from('admin_users')
      .select('user_id').eq('user_id', sessionData.session.user.id).maybeSingle();
    if (allowlistError) throw allowlistError;
    if (!allowlist) {
      await client.auth.signOut();
      window.location.replace('./login.html');
      return false;
    }
    return true;
  }

  document.querySelectorAll('.nav-item').forEach((button) => {
    button.addEventListener('click', () => switchTab(button.dataset.tab));
  });
  $('addProjectBtn').addEventListener('click', () => openProject(null));
  $('saveProjectBtn').addEventListener('click', saveProject);
  $('projectForm').addEventListener('submit', (event) => event.preventDefault());
  $('closeProjectBtn').addEventListener('click', () => $('projectDialog').close());
  $('cancelProjectBtn').addEventListener('click', () => $('projectDialog').close());
  $('projectImage').addEventListener('change', () => {
    const file = $('projectImage').files[0];
    if (!file) return;
    $('imagePreview').src = URL.createObjectURL(file);
    $('imagePreview').hidden = false;
    $('removeImageBtn').hidden = false;
    removeCurrentImage = false;
  });
  $('removeImageBtn').addEventListener('click', () => {
    $('projectImage').value = '';
    $('imagePreview').removeAttribute('src');
    $('imagePreview').hidden = true;
    $('removeImageBtn').hidden = true;
    projectImageUrl = '';
    removeCurrentImage = true;
  });
  $('projectsList').addEventListener('click', async (event) => {
    const editId = event.target.closest('[data-edit]')?.dataset.edit;
    const deleteId = event.target.closest('[data-delete-project]')?.dataset.deleteProject;
    if (editId) openProject(data.projects.find((project) => project.id === editId));
    if (deleteId) {
      try { await deleteProject(deleteId); } catch (error) { showAlert(error.message, true); }
    }
  });
  $('messagesList').addEventListener('click', async (event) => {
    const id = event.target.closest('[data-delete-message]')?.dataset.deleteMessage;
    if (id) {
      try { await deleteMessage(id); } catch (error) { showAlert(error.message, true); }
    }
  });
  $('clearMessagesBtn').addEventListener('click', async () => {
    if (!data.messages.length || !window.confirm('Delete all contact messages permanently?')) return;
    const { error } = await client.from('messages').delete().not('id', 'is', null);
    if (error) return showAlert(error.message, true);
    try {
      await loadData(false);
      showAlert('All contact messages were deleted.');
    } catch (loadError) {
      showAlert(`Messages were deleted, but the dashboard could not refresh: ${loadError.message}`, true);
    }
  });
  $('saveSettingsBtn').addEventListener('click', async () => {
    const settings = [
      { key: 'site_email', value: $('settingEmail').value.trim() },
      { key: 'hero_title', value: $('settingHeroTitle').value.trim() },
      { key: 'hero_subtitle', value: $('settingHeroSubtitle').value.trim() }
    ];
    try {
      const { error } = await client.from('site_settings').upsert(settings, { onConflict: 'key' });
      if (error) throw error;
      await loadData(false);
      showAlert('Settings saved. They are now shared with the public website.');
    } catch (error) {
      showAlert(error.message || 'Settings could not be saved.', true);
    }
  });
  $('logoutBtn').addEventListener('click', async () => {
    const { error } = await client.auth.signOut();
    if (error) return showAlert(error.message, true);
    window.location.replace('./login.html');
  });

  requireAdmin().then((authorized) => {
    if (!authorized) return;
    $('connectionStatus').textContent = 'Connected to shared Supabase backend';
    return loadData(false).then(() => {
      window.setInterval(() => loadData(true).catch((error) => showAlert(error.message, true)), 20000);
    });
  }).catch((error) => {
    $('connectionStatus').textContent = 'Backend connection failed';
    showAlert(error.message || 'Could not connect to the backend.', true);
    document.querySelectorAll('button').forEach((button) => { button.disabled = true; });
  });
})();
