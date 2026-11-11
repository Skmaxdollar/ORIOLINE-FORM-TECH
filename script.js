// Mobile menu toggle
const menuIcon = document.getElementById('mobileMenuIcon');
const navLinks = document.getElementById('navLinks');

function toggleMenu() {
  navLinks.classList.toggle('show');
}

if (menuIcon) {
  menuIcon.addEventListener('click', toggleMenu);
}

// Close menu when a link is clicked
document.querySelectorAll('.nav-links a').forEach(link => {
  link.addEventListener('click', () => {
    navLinks.classList.remove('show');
  });
});

// Modal logic
const modal = document.getElementById('messageModal');
const closeModalBtn = document.getElementById('closeModalBtn');

function openModal() {
  if (modal) modal.style.display = 'flex';
}

function closeModal() {
  if (modal) modal.style.display = 'none';
}

if (closeModalBtn) {
  closeModalBtn.addEventListener('click', closeModal);
}

// Close modal when clicking outside
window.addEventListener('click', (e) => {
  if (e.target === modal) closeModal();
});

// Helper: handle send message
function handleSendMessage() {
  const nameInput = document.getElementById('messageName');
  const emailInput = document.getElementById('messageEmail');
  const textInput = document.getElementById('messageText');

  // Simple validation
  if (nameInput && nameInput.value.trim() === "") {
    alert("Please enter your name before sending.");
    return false;
  }
  
  if (emailInput && emailInput.value.trim() !== "" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailInput.value.trim())) {
    alert("Please enter a valid email address (or leave blank).");
    return false;
  }

  if (textInput && textInput.value.trim() === "") {
    alert("Please write a short message before sending.");
    return false;
  }

  const name = nameInput ? nameInput.value.trim() : '';
  const email = emailInput ? emailInput.value.trim() : '';
  const messageText = textInput ? textInput.value.trim() : '';
  const subject = 'Website project enquiry';
  const body = [
    `Name: ${name}`,
    `Email: ${email || 'Not provided'}`,
    '',
    'Message:',
    messageText
  ].join('\n');
  const mailto = `mailto:hello@oriolineform.com?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  document.getElementById('emailDraftLink').href = mailto;
  openModal();
  return true;
}

// Send message button from footer contact area
const sendFooterBtn = document.getElementById('sendMessageFooterBtn');
if (sendFooterBtn) {
  sendFooterBtn.addEventListener('click', (e) => {
    e.preventDefault();
    handleSendMessage();
  });
}

// Send message from the featured project (Luxury Residence)
const sendProjectBtn = document.getElementById('sendMessageFromProject');
if (sendProjectBtn) {
  sendProjectBtn.addEventListener('click', (e) => {
    e.preventDefault();
    const nameField = document.getElementById('messageName');
    if (nameField && nameField.value.trim() === "") {
      // Scroll to contact section
      document.getElementById('contact').scrollIntoView({ behavior: 'smooth' });
      alert("Please fill your name & message in the contact section below.");
    } else {
      handleSendMessage();
    }
  });
}

// Smooth scroll for "Get in Touch" button
const getInTouchBtn = document.querySelector('.hero-buttons .btn:first-child');
if (getInTouchBtn) {
  getInTouchBtn.addEventListener('click', (e) => {
    e.preventDefault();
    document.getElementById('contact').scrollIntoView({ behavior: 'smooth' });
  });
}

// Smooth scroll for "View Portfolio" button in hero
const viewPortfolioHero = document.querySelector('.hero-buttons .btn-outline-light');
if (viewPortfolioHero) {
  viewPortfolioHero.addEventListener('click', (e) => {
    e.preventDefault();
    document.getElementById('portfolio').scrollIntoView({ behavior: 'smooth' });
  });
}

// "Learn More" about us button smooth scroll
const learnMoreBtn = document.querySelector('.about-card .btn-dark');
if (learnMoreBtn) {
  learnMoreBtn.addEventListener('click', (e) => {
    e.preventDefault();
    document.getElementById('services').scrollIntoView({ behavior: 'smooth' });
  });
}