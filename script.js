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
  // focus for accessibility (best-effort)
  try { section.focus({ preventScroll: true }); } catch (e) {}
  // Immediately set active state so the UI (and screen readers) reflect the target section
  // even if IntersectionObserver hasn't fired yet during the smooth scroll.
  try { setActiveSection(id); } catch (e) {}
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
    // Use multiple thresholds and a slightly larger rootMargin so the observer
    // fires earlier and more consistently across browsers (Edge/Chromium variations)
    threshold: [0.25, 0.5],
    rootMargin: '-20% 0px -20% 0px'
  });

  sections.forEach(s => observer.observe(s));
}

/* ----- Scroll watcher to ensure a section is active when scrolling stops ----- */
function chooseClosestSection() {
  const sections = getSections();
  if (sections.length === 0) return null;
  const viewportCenter = window.innerHeight / 2;
  let closest = sections[0];
  let minDist = Infinity;
  sections.forEach(s => {
    const rect = s.getBoundingClientRect();
    const center = rect.top + rect.height / 2;
    const dist = Math.abs(center - viewportCenter);
    if (dist < minDist) { minDist = dist; closest = s; }
  });
  return closest;
}

function initScrollWatcher() {
  let scrollStopTimeout = null;
  window.addEventListener('scroll', () => {
    if (scrollStopTimeout) clearTimeout(scrollStopTimeout);
    // After user stops scrolling for 120ms, pick the closest section and activate it
    scrollStopTimeout = setTimeout(() => {
      const sec = chooseClosestSection();
      if (sec) setActiveSection(sec.id);
    }, 120);
  }, { passive: true });
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
      // Use element bounding rects for a more robust center-based calculation
      const carouselRect = carousel.getBoundingClientRect();
      const center = carouselRect.left + carouselRect.width / 2;
      let closest = 0;
      let minDist = Infinity;
      cards.forEach((card, i) => {
        const rect = card.getBoundingClientRect();
        const cardCenter = rect.left + rect.width / 2;
        const dist = Math.abs(cardCenter - center);
        if (dist < minDist) { minDist = dist; closest = i; }
      });
      return closest;
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
      // Ensure the card is focusable and move keyboard focus there for accessibility
      try {
        card.tabIndex = -1;
        card.focus({ preventScroll: true });
      } catch (e) { /* focus best-effort */ }
function setYear(){
  const el = document.getElementById('year');
  if (el) el.textContent = new Date().getFullYear();
}

/* ----- Project Carousel ----- */
function initProjectCarousel() {
  const carousel = document.querySelector('.project-carousel');
  if (!carousel) return;
  const cards = Array.from(carousel.querySelectorAll('.project-card'));
  const prevBtn = document.querySelector('.carousel-btn.prev');
  const nextBtn = document.querySelector('.carousel-btn.next');
  const indicators = Array.from(document.querySelectorAll('.indicator'));
  
  let currentIndex = 0;

  function updateIndicators(index) {
    indicators.forEach((ind, i) => ind.classList.toggle('active', i === index));
  }

  function scrollToIndex(index) {
    index = Math.max(0, Math.min(cards.length - 1, index));
    const card = cards[index];
    if (!card) return;
    // Use start so the card aligns to the left edge of the carousel viewport (full-width card)
    card.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'start' });
    currentIndex = index;
    updateIndicators(currentIndex);
    // Toggle active-slide class so CSS transitions (fade/scale) run
    cards.forEach((c, i) => c.classList.toggle('active-slide', i === currentIndex));
  }

  // Button click handlers
  prevBtn?.addEventListener('click', () => scrollToIndex(currentIndex - 1));
  nextBtn?.addEventListener('click', () => scrollToIndex(currentIndex + 1));

  // Indicator click handlers
  indicators.forEach((indicator, index) => {
    indicator.addEventListener('click', () => scrollToIndex(index));
  });

  // Improve wheel behavior: vertical wheel scrolls horizontally inside carousel
  carousel.addEventListener('wheel', (e) => {
    // Only intercept mostly-vertical wheels to allow normal horizontal wheels too
    if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
      e.preventDefault();
      carousel.scrollLeft += e.deltaY;
    }
  }, { passive: false });

  // Determine which card is currently most visible (by center point) and update indicators
  function indexFromScroll() {
    const center = carousel.scrollLeft + carousel.clientWidth / 2;
    let closest = 0;
    let minDist = Infinity;
    cards.forEach((card, i) => {
      const cardCenter = card.offsetLeft + card.offsetWidth / 2;
      const dist = Math.abs(cardCenter - center);
      if (dist < minDist) { minDist = dist; closest = i; }
    });
    return closest;
  }

  let scrollTimeout = null;
  carousel.addEventListener('scroll', () => {
    // Throttle: update indicator after user stops scrolling for 80ms to avoid flicker
    if (scrollTimeout) clearTimeout(scrollTimeout);
    scrollTimeout = setTimeout(() => {
      const idx = indexFromScroll();
      if (idx !== currentIndex) {
        currentIndex = idx;
        updateIndicators(currentIndex);
        // Apply visual state to the computed active card
        cards.forEach((c, i) => c.classList.toggle('active-slide', i === currentIndex));
      }
    }, 80);
  });

  // Ensure initial state
  updateIndicators(currentIndex);
  // Mark the initial active slide so it starts in the 'active' visual state
  cards.forEach((c, i) => c.classList.toggle('active-slide', i === currentIndex));
}

/* ----- Init everything on DOM ready ----- */
/* ----- Mobile menu handling ----- */
function initMobileMenu() {
  const menuBtn = document.querySelector('.menu-toggle');
  const nav = document.querySelector('.primary-nav');
  if (!menuBtn || !nav) return;

  function closeMenu() {
    document.body.classList.remove('menu-open');
    menuBtn.setAttribute('aria-expanded', 'false');
    nav.style.visibility = 'hidden';
  }

  function openMenu() {
    document.body.classList.add('menu-open');
    menuBtn.setAttribute('aria-expanded', 'true');
    nav.style.visibility = 'visible';
  }

  menuBtn.addEventListener('click', () => {
    const isOpen = document.body.classList.contains('menu-open');
    if (isOpen) {
      closeMenu();
    } else {
      openMenu();
    }
  });

  // Close menu when clicking a link
  nav.querySelectorAll('.nav-link').forEach(link => {
    link.addEventListener('click', closeMenu);
  });

  // Close menu when clicking outside
  document.addEventListener('click', (e) => {
    if (document.body.classList.contains('menu-open') &&
        !nav.contains(e.target) &&
        !menuBtn.contains(e.target)) {
      closeMenu();
    }
  });

  // Close menu on escape key
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && document.body.classList.contains('menu-open')) {
      closeMenu();
    }
  });

  // Set initial state
  menuBtn.setAttribute('aria-expanded', 'false');
}

document.addEventListener('DOMContentLoaded', () => {
  Theme.init();
  initNavigation();
  initSectionObserver();
  initForm();
  setYear();
  initProjectCarousel(); // Initialize the project carousel
  initMobileMenu(); // Initialize mobile menu

  // Start the scroll watcher (ensures a nearest section is activated after scrolling stops)
  if (typeof initScrollWatcher === 'function') initScrollWatcher();

  // Theme toggle hookup
  const themeBtn = document.getElementById('theme-toggle');
  if (themeBtn) themeBtn.addEventListener('click', () => Theme.toggle());

  // Ensure the first section is active on load
  const first = getSections()[0];
  if (first) setActiveSection(first.id);

  // Remove wheel and touch event handlers to allow natural scrolling
});