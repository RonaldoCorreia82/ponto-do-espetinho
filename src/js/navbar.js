export function initNavbar(lenis) {
  const navbar = document.getElementById('navbar');
  const hamburger = document.getElementById('hamburger');
  const navMenu = document.getElementById('navMenu');
  const navLinks = document.querySelectorAll('.navbar__link, .footer__link');

  // Scroll → adiciona classe .scrolled
  window.addEventListener('scroll', () => {
    navbar.classList.toggle('scrolled', window.scrollY > 80);
  }, { passive: true });

  // Hamburguer toggle
  hamburger.addEventListener('click', () => {
    const isOpen = hamburger.classList.toggle('open');
    navMenu.classList.toggle('open', isOpen);
    hamburger.setAttribute('aria-expanded', String(isOpen));
    document.body.style.overflow = isOpen ? 'hidden' : '';
  });

  // Links âncora com Lenis
  navLinks.forEach(link => {
    link.addEventListener('click', (e) => {
      const href = link.getAttribute('href');
      if (!href || !href.startsWith('#')) return;

      e.preventDefault();
      const target = document.querySelector(href);
      if (!target) return;

      // Fecha menu mobile se aberto
      hamburger.classList.remove('open');
      navMenu.classList.remove('open');
      hamburger.setAttribute('aria-expanded', 'false');
      document.body.style.overflow = '';

      lenis.scrollTo(target, { offset: -72, duration: 1.4 });
    });
  });
}
