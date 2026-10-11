// Zar görselleri ve yuvarlanma animasyonu.
import { sleep } from './dom.js';

const PIPS = { 1: [4], 2: [0, 8], 3: [0, 4, 8], 4: [0, 2, 6, 8], 5: [0, 2, 4, 6, 8], 6: [0, 2, 3, 5, 6, 8] };
export const die = (v, cls = '') => `<span class="die ${cls}" data-v="${v}">${Array.from({ length: 9 }, (_, i) => `<i class="${PIPS[v].includes(i) ? 'on' : ''}"></i>`).join('')}</span>`;

function setFace(el, v) {
  el.dataset.v = v;
  el.querySelectorAll('i').forEach((p, i) => p.classList.toggle('on', PIPS[v].includes(i)));
}

// Zarları yuvarlar, sonra gerçek değerleri ve karşılaştırma sonucunu gösterir.
export async function rollDice(box, roll, { att, def, duration = 650 } = {}) {
  const n = Math.min(roll.att.length, roll.def.length);
  box.innerHTML = `<div class="dice-row att" style="--die:${att}">${roll.att.map((v, i) => die(1, `rolling ${i < n ? '' : 'unused'}`)).join('')}</div>
    <div class="dice-vs">⚔</div>
    <div class="dice-row def" style="--die:${def}">${roll.def.map((v, i) => die(1, `rolling ${i < n ? '' : 'unused'}`)).join('')}</div>`;
  const dice = [...box.querySelectorAll('.die')];
  const t0 = performance.now();
  if (duration > 0) {
    while (performance.now() - t0 < duration) {
      dice.forEach(d => setFace(d, 1 + Math.floor(Math.random() * 6)));
      await sleep(60);
    }
  }
  const [a, d] = [box.querySelectorAll('.att .die'), box.querySelectorAll('.def .die')];
  roll.att.forEach((v, i) => { setFace(a[i], v); a[i].classList.remove('rolling'); });
  roll.def.forEach((v, i) => { setFace(d[i], v); d[i].classList.remove('rolling'); });
  for (let i = 0; i < n; i++) {
    const win = roll.att[i] > roll.def[i];
    a[i].classList.add(win ? 'win' : 'lose');
    d[i].classList.add(win ? 'lose' : 'win');
  }
}
