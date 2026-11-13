(function () {
  const config = window.SUPABASE_CONFIG;
  const validConfig = config && /^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(config.url) &&
    typeof config.publishableKey === 'string' && config.publishableKey.length > 10;

  if (!validConfig || !window.supabase) {
    window.siteBackend = {
      ready: false,
      error: !window.supabase ? 'Supabase client library did not load.' : 'Supabase URL and publishable key are not configured.'
    };
    return;
  }

  const client = window.supabase.createClient(config.url, config.publishableKey);
  window.siteBackend = {
    ready: true,
    client,
    async getProjects() {
      const { data, error } = await client.from('projects')
        .select('id,title,category,location,description,image_url,featured,sort_order')
        .order('sort_order', { ascending: true })
        .order('created_at', { ascending: true });
      if (error) throw error;
      return data || [];
    },
    async getSettings() {
      const { data, error } = await client.from('site_settings').select('key,value');
      if (error) throw error;
      return Object.fromEntries((data || []).map((setting) => [setting.key, setting.value]));
    },
    async submitMessage(message) {
      const { error } = await client.from('messages').insert({
        name: message.name,
        email: message.email,
        message: message.message
      });
      if (error) throw error;
    }
  };
})();
