// script.js
// Orchestrates:
// - Full-page scroll behavior (one section visible at a time)
// - Adds/removes "active" to sections so CSS can animate them
// - Triggers element-level reveal animations when a section becomes active
// - Smooth navigation, keyboard support, and theme toggle
// - Accessible: updates aria-current on nav links and aria-hidden for non-active sections

/* Helper selectors */
const $ = (sel, ctx = document) => ctx.querySelector(sel);
const $$ = (sel, ctx = document) => Array.from((ctx || document).querySelectorAll(sel));

/* ----- Configuration ----- */
const SECTION_SELECTOR = '.section';
const SCROLL_THRESHOLD = 0.5; // fraction of section visible to consider it active
const OBSERVER_ROOT_MARGIN = '0px 0px -20% 0px'; // start revealing just before fully on-screen

/* ----- Theme (optional) ----- */
const Theme = {
  KEY: 'jz-theme',
  toggle() {
    const cur = document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark';
    const next = cur === 'light' ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', next);
    try { localStorage.setItem(Theme.KEY, next); } catch(e){}
    updateThemeButton(next);
  },
  init() {
    const saved = localStorage.getItem(Theme.KEY);
    if (saved) document.documentElement.setAttribute('data-theme', saved);
    updateThemeButton(document.documentElement.getAttribute('data-theme'));
  }
};
function updateThemeButton(theme){
  const btn = document.getElementById('theme-toggle');
  if (!btn) return;
  btn.setAttribute('aria-pressed', String(theme === 'dark'));
  btn.querySelector('.toggle-text').textContent = theme === 'dark' ? 'Dark' : 'Light';
  btn.querySelector('.toggle-icon').textContent = theme === 'dark' ? '🌙' : '☀️';
}

/* ----- Navigation handling ----- */
function initNavigation(){
  const navLinks = $$('.nav-link');
  navLinks.forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const targetId = link.getAttribute('href').slice(1);
      navigateToSection(targetId);
    });
  });

  // keyboard shortcuts: arrow down/up to move between sections
  document.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown' || e.key === 'PageDown') {
      e.preventDefault();
      goToNextSection();
    } else if (e.key === 'ArrowUp' || e.key === 'PageUp') {
      e.preventDefault();
      goToPrevSection();
    }
  });
}

/* Smooth programmatic navigation to a section by id */
function navigateToSection(id){
  const section = document.getElementById(id);
  if (!section) return;
  // Use scrollIntoView so the user lands at the top of the section; IntersectionObserver will mark it active
  section.scrollIntoView({ behavior: 'smooth', block: 'start' });
  // focus for accessibility
  section.focus({ preventScroll: true });
}

/* Move to the next/previous section based on current active */
function getSections(){
  return Array.from(document.querySelectorAll(SECTION_SELECTOR));
}
function getActiveIndex(){
  const sections = getSections();
  return sections.findIndex(s => s.classList.contains('active'));
}
function goToNextSection(){
  const idx = getActiveIndex();
  const sections = getSections();
  if (idx < sections.length - 1) navigateToSection(sections[idx + 1].id);
}
function goToPrevSection(){
  const idx = getActiveIndex();
  const sections = getSections();
  if (idx > 0) navigateToSection(sections[idx - 1].id);
}

/* ----- Reveal and section activation logic ----- */
function initSectionObserver(){
  const sections = getSections();
  if (sections.length === 0) return;

  // Simple intersection observer to highlight current section
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      const section = entry.target;
      
      // When section is 50% or more visible
      if (entry.intersectionRatio > 0.5) {
        // Add active class to current section
        section.classList.add('active');
        
        // Trigger animations
        section.querySelectorAll('.animate-slide-in, .animate-fade-in, .reveal').forEach(el => {
          el.classList.add('is-visible');
        });
        
        // Update navigation
        updateNavCurrent(section.id);
      } else {
        section.classList.remove('active');
      }
    });
  }, {
    threshold: 0.5,
    rootMargin: '-10% 0px -10% 0px'
  });

  sections.forEach(s => observer.observe(s));
}

/* Set one section as active (only it will be visible / interactive) */
function setActiveSection(id) {
  const sections = getSections();
  sections.forEach(s => {
    const isActive = s.id === id;
    s.classList.toggle('active', isActive);

    // Toggle aria-hidden for screen readers
    s.setAttribute('aria-hidden', String(!isActive));

    // Trigger section-level reveal animations for elements inside the active section
    const targets = s.querySelectorAll('.animate-slide-in, .animate-fade-in, .reveal, .glow-in');
    targets.forEach((el, i) => {
      // Set small stagger via inline style (CSS provides default classes too)
      el.style.transitionDelay = `${i * 70}ms`;
      el.classList.add('is-visible');
    });

    // For previous/next sections, remove is-visible from section-contained animations to produce a smooth disappearing
    if (!isActive) {
      const prevTargets = s.querySelectorAll('.animate-slide-in.is-visible, .animate-fade-in.is-visible, .reveal.is-visible, .glow-in.is-visible');
      prevTargets.forEach(el => {
        el.classList.remove('is-visible');
        el.style.transitionDelay = '';
      });
    }
  });

  updateNavCurrent();
}

/* Update navigation aria/current states */
function updateNavCurrent(){
  const sections = getSections();
  const activeIndex = sections.findIndex(s => s.classList.contains('active'));
  const navLinks = $$('.nav-link');
  navLinks.forEach(link => {
    const target = link.getAttribute('href').slice(1);
    if (sections[activeIndex] && target === sections[activeIndex].id) {
      link.setAttribute('aria-current', 'page');
    } else {
      link.removeAttribute('aria-current');
    }
  });
}

/* ----- Tiny form validation and contact behaviour (client-side only) ----- */
function initForm(){
  const form = document.getElementById('contact-form');
  if (!form) return;
  const name = form.querySelector('#name');
  const email = form.querySelector('#email');
  const message = form.querySelector('#message');
  const status = form.querySelector('#form-status');

  function setError(input, msg){
    const id = input.id;
    const el = document.getElementById(`${id}-error`);
    if (el) el.textContent = msg || '';
    input.setAttribute('aria-invalid', msg ? 'true' : 'false');
  }

  function isEmailValid(value){
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
  }

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    let valid = true;
    if (!name.value.trim()) { setError(name, 'Please enter your name.'); valid = false; } else setError(name, '');
    if (!email.value.trim()) { setError(email, 'Please enter your email.'); valid = false; } else if (!isEmailValid(email.value.trim())) { setError(email, 'Please enter a valid email address.'); valid = false; } else setError(email, '');
    if (!message.value.trim()) { setError(message, 'Please enter a message.'); valid = false; } else setError(message, '');
    if (!valid) {
      if (status) status.textContent = 'Please fix the errors above.';
      return;
    }
    // Simulate submit
    if (status) status.textContent = 'Thanks — your message was sent (simulation).';
    form.reset();
  });

  // Clear errors on input
  [name,email,message].forEach(i => i.addEventListener('input', () => {
    setError(i,''); if (status) status.textContent = '';
  }));
}

/* ----- Small utility: update year in footer ----- */
function setYear(){
  const el = document.getElementById('year');
  if (el) el.textContent = new Date().getFullYear();
}

/* ----- Project Carousel ----- */
function initProjectCarousel() {
  const carousel = document.querySelector('.project-carousel');
  const cards = carousel.querySelectorAll('.project-card');
  const prevBtn = document.querySelector('.carousel-btn.prev');
  const nextBtn = document.querySelector('.carousel-btn.next');
  const indicators = document.querySelectorAll('.indicator');
  
  let currentIndex = 0;

  function updateCarousel(index) {
    const card = cards[index];
    if (!card) return;
    
    // Scroll to the card
    card.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    
    // Update indicators
    indicators.forEach((ind, i) => ind.classList.toggle('active', i === index));
    
    currentIndex = index;
  }

  // Button click handlers
  prevBtn?.addEventListener('click', () => {
    updateCarousel(Math.max(0, currentIndex - 1));
  });

  nextBtn?.addEventListener('click', () => {
    updateCarousel(Math.min(cards.length - 1, currentIndex + 1));
  });

  // Indicator click handlers
  indicators.forEach((indicator, index) => {
    indicator.addEventListener('click', () => updateCarousel(index));
  });

  // Mouse wheel horizontal scrolling
  carousel?.addEventListener('wheel', (e) => {
    if (Math.abs(e.deltaX) < Math.abs(e.deltaY)) {
      e.preventDefault();
      carousel.scrollLeft += e.deltaY;
    }
  });

  // Update indicators based on scroll position
  carousel?.addEventListener('scroll', () => {
    const cardWidth = cards[0].offsetWidth + 24; // width + gap
    const index = Math.round(carousel.scrollLeft / cardWidth);
    indicators.forEach((ind, i) => ind.classList.toggle('active', i === index));
  });
}

/* ----- Init everything on DOM ready ----- */
document.addEventListener('DOMContentLoaded', () => {
  Theme.init();
  initNavigation();
  initSectionObserver();
  initForm();
  setYear();
  initProjectCarousel(); // Initialize the project carousel

  // Theme toggle hookup
  const themeBtn = document.getElementById('theme-toggle');
  if (themeBtn) themeBtn.addEventListener('click', () => Theme.toggle());

  // Ensure the first section is active on load
  const first = getSections()[0];
  if (first) setActiveSection(first.id);

  // Remove wheel and touch event handlers to allow natural scrolling
});