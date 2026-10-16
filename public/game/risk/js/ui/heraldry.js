// Ülke armaları: altın çerçeveli kalkan + sembol (SVG). 100×120 koordinat sistemi.
import { KINGDOMS } from '../rules/constants.js';

const SHIELD = 'M8,6 H92 V52 C92,84 72,104 50,116 C28,104 8,84 8,52 Z';
const INNER = 'M14,12 H86 V52 C86,80 68,97 50,108 C32,97 14,80 14,52 Z';

const sunRays = () => {
  let d = '';
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2, b = a + Math.PI / 16, c = a - Math.PI / 16;
    const R = i % 2 ? 27 : 33, r = 17;
    const p = (ang, rad) => `${(50 + Math.cos(ang) * rad).toFixed(1)},${(58 + Math.sin(ang) * rad).toFixed(1)}`;
    d += `M${p(c, r)} L${p(a, R)} L${p(b, r)} Z `;
  }
  return d;
};

const CANOPY = '<circle cx="50" cy="38" r="15"/><circle cx="35" cy="48" r="12"/><circle cx="65" cy="48" r="12"/><circle cx="41" cy="61" r="11"/><circle cx="59" cy="61" r="11"/><circle cx="50" cy="52" r="12"/>';
const sword ='M50,16 L53.5,25 L53.5,76 L46.5,76 L46.5,25 Z M38,76 H62 V81 H38 Z M47.5,81 H52.5 V93 H47.5 Z M50,99 a4,4 0 1,0 0.01,0 Z';

const CHARGES = {
  lion: `<path d="M44,26 C50,22 56,26 56,32 C60,36 58,42 56,44 L60,52 C64,60 66,68 64,76 C70,74 73,66 73,58 C73,50 77,44 81,42 C86,40 87,33 82,33 C80,37 78,37 78,42 C76,48 76,56 76,62 C76,72 71,80 66,82 L70,92 L75,96 L66,98 L60,90 L56,85 L53,92 L57,96 L46,98 L44,88 L46,78 C44,70 44,62 46,56 L38,60 L30,58 L25,63 L23,58 L28,53 L36,52 L42,48 L36,46 L30,42 L25,45 L23,40 L28,35 L36,39 L40,40 C35,40 31,36 33,32 L29,31 L33,26 C36,23 40,23 44,26 Z"/>
         <path d="M46,27 C52,26 54,31 53,36 M49,31 C52,33 52,38 50,41" fill="none" stroke-width="1.2"/>
         <circle cx="37.5" cy="30" r="1.4" class="eye"/>`,
  eagle: `<g id="wing"><path d="M45,50 C37,40 27,33 13,29 L18,37 L11,39 L18,45 L11,49 L19,53 L14,58 L23,59 L20,65 L31,63 L45,62 Z"/></g>
          <use href="#wing" transform="translate(100,0) scale(-1,1)"/>
          <ellipse cx="50" cy="60" rx="7.5" ry="17"/>
          <circle cx="50" cy="38" r="7"/>
          <path d="M44,37 L37,39 L43,42 Z"/>
          <path d="M42,76 L58,76 L62,92 L55,89 L50,97 L45,89 L38,92 Z"/>
          <path d="M43,72 L38,80 L42,80 L44,76 Z M57,72 L62,80 L58,80 L56,76 Z"/>
          <circle cx="47.5" cy="36.5" r="1.3" class="eye"/>`,
  crown: `<path d="M27,72 L23,42 L36,56 L42,34 L50,51 L58,34 L64,56 L77,42 L73,72 Z"/>
          <rect x="25" y="72" width="50" height="10" rx="2"/>
          <circle cx="23" cy="40" r="4"/><circle cx="42" cy="32" r="4"/><circle cx="58" cy="32" r="4"/><circle cx="77" cy="40" r="4"/>
          <path d="M50,20 L50,34 M45,25 L55,25" stroke-width="3.2" fill="none"/>
          <circle cx="37" cy="77" r="2.6" class="eye"/><circle cx="50" cy="77" r="2.6" class="eye"/><circle cx="63" cy="77" r="2.6" class="eye"/>`,
  oak: `<path d="M46,98 L46,77 C45,71 39,69 34,67 L36,64 C42,66 47,68 50,72 C53,68 58,66 64,64 L66,67 C61,69 55,71 54,77 L54,98 L60,101 L40,101 Z"/>
        <g stroke-width="3.4">${CANOPY}</g><g stroke="none">${CANOPY}</g>
        <circle cx="42" cy="44" r="2.2" class="eye"/><circle cx="58" cy="50" r="2.2" class="eye"/><circle cx="50" cy="36" r="2.2" class="eye"/>`,
  sun: `<path d="${sunRays()}"/><circle cx="50" cy="58" r="15"/>
        <circle cx="45" cy="55" r="1.8" class="eye"/><circle cx="55" cy="55" r="1.8" class="eye"/><path d="M44,63 Q50,68 56,63" fill="none" class="eye-line"/>`,
  swords: `<g transform="rotate(-38 50 60)"><path d="${sword}"/></g><g transform="rotate(38 50 60)"><path d="${sword}"/></g>`,
};

let uid = 0;
export function shield(k, { size = 40, cls = '' } = {}) {
  const K = KINGDOMS[k] ?? { color: '#555', dark: '#222', charge: 'crown' };
  const id = `h${++uid}`;
  const charge = CHARGES[K.charge].replace('id="wing"', `id="${id}w"`).replace('href="#wing"', `href="#${id}w"`);
  return `<svg class="shield ${cls}" viewBox="0 0 100 120" width="${size}" height="${size * 1.2}" aria-hidden="true">
  <defs>
    <linearGradient id="${id}g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff2b8"/><stop offset=".35" stop-color="#e2b34a"/><stop offset=".7" stop-color="#9c6d1c"/><stop offset="1" stop-color="#f0cd6a"/></linearGradient>
    <radialGradient id="${id}f" cx=".35" cy=".25" r=".9"><stop offset="0" stop-color="${K.light ?? K.color}" stop-opacity=".9"/><stop offset=".45" stop-color="${K.color}"/><stop offset="1" stop-color="${K.dark}"/></radialGradient>
    <linearGradient id="${id}c" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff0b0"/><stop offset=".5" stop-color="#e9bd4c"/><stop offset="1" stop-color="#a87a22"/></linearGradient>
  </defs>
  <path d="${SHIELD}" fill="url(#${id}g)" stroke="#2a1a06" stroke-width="2"/>
  <path d="${INNER}" fill="url(#${id}f)" stroke="#3a250a" stroke-width="1.5"/>
  <g class="charge" fill="url(#${id}c)" stroke="#2b1a05" stroke-width="1.6" stroke-linejoin="round">${charge}</g>
  <path d="M14,12 H86 V30 C60,26 36,34 14,44 Z" fill="#fff" opacity=".10"/>
</svg>`;
}
