// Küçük DOM yardımcıları: seçici, HTML kaçışı, bildirim ve pencere.
export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
export const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const sleep = ms => new Promise(r => setTimeout(r, ms));

export function el(tag, attrs = {}, html = '') {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') e.className = v;
    else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
    else e.setAttribute(k, v);
  }
  if (html) e.innerHTML = html;
  return e;
}

let toastTimer;
export function toast(msg, kind = 'info', ms = 3200) {
  const t = $('#toast');
  t.textContent = msg;
  t.className = `toast show ${kind}`;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (t.className = 'toast'), ms);
}

// Basit pencere: içerik HTML'i ve düğmeler. Esc ile kapanır.
let modalClose = null;
export function modal({ title = '', body = '', wide = false, actions = [], onClose } = {}) {
  closeModal();
  const root = $('#modal');
  root.innerHTML = `<div class="modal-card ${wide ? 'wide' : ''}" role="dialog" aria-modal="true" aria-label="${esc(title)}">
    <div class="modal-head"><h2>${esc(title)}</h2><button class="icon-btn modal-x" aria-label="Kapat">✕</button></div>
    <div class="modal-body">${body}</div>
    ${actions.length ? `<div class="modal-actions">${actions.map((a, i) => `<button class="btn ${a.primary ? 'btn-primary' : ''} ${a.danger ? 'btn-danger' : ''}" data-i="${i}">${esc(a.label)}</button>`).join('')}</div>` : ''}
  </div>`;
  root.hidden = false;
  requestAnimationFrame(() => root.classList.add('open'));
  const close = () => { root.classList.remove('open'); root.hidden = true; root.innerHTML = ''; modalClose = null; onClose?.(); };
  modalClose = close;
  $('.modal-x', root).onclick = close;
  root.onclick = e => { if (e.target === root) close(); };
  $$('.modal-actions button', root).forEach(b => (b.onclick = () => { const a = actions[+b.dataset.i]; const keep = a.onClick?.(); if (keep !== true) close(); }));
  const first = $('.modal-actions .btn-primary', root) ?? $('.modal-x', root);
  first?.focus();
  return { root: $('.modal-card', root), close };
}
export const closeModal = () => modalClose?.();
export const modalOpen = () => !!modalClose;

export function confirmBox(title, text, okLabel = 'Evet', danger = false) {
  return new Promise(res => {
    modal({ title, body: `<p>${text}</p>`, onClose: () => res(false), actions: [
      { label: 'Vazgeç', onClick: () => {} },
      { label: okLabel, primary: !danger, danger, onClick: () => { res(true); } },
    ] });
  });
}
