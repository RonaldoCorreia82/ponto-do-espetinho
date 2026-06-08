export function initAnimations() {
  // Animação de cascata dos cards com IntersectionObserver
  const cards = document.querySelectorAll('.card');

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
          observer.unobserve(entry.target);
        }
      });
    },
    {
      threshold: 0.12,
      rootMargin: '0px 0px -40px 0px',
    }
  );

  cards.forEach((card) => observer.observe(card));

  // Animação genérica para seções (bebidas, localização)
  const fadeEls = document.querySelectorAll('.bebida-card, .localizacao__map, .localizacao__contato');

  const fadeObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.style.animation = 'fadeSlideUp 0.6s ease forwards';
          fadeObserver.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.1 }
  );

  fadeEls.forEach((el) => {
    el.style.opacity = '0';
    el.style.transform = 'translateY(30px)';
    fadeObserver.observe(el);
  });
}
