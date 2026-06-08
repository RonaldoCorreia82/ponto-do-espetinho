import { initLenis } from './js/lenis.js';
import { initNavbar } from './js/navbar.js';
import { initAnimations } from './js/animations.js';

const lenis = initLenis();
initNavbar(lenis);
initAnimations();
