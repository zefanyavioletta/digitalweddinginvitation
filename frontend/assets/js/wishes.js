'use strict';

const WISHES_KEY = 'wedding_sandya_kukuh_v1';

function loadWishes() {
  try { const r = localStorage.getItem(WISHES_KEY); return r ? JSON.parse(r) : []; }
  catch { return []; }
}
function saveWishes(w) {
  try { localStorage.setItem(WISHES_KEY, JSON.stringify(w)); } catch {}
}
function timeAgo(iso) {
  const d = Date.now() - new Date(iso).getTime();
  const m = Math.floor(d/60000), h = Math.floor(d/3600000), dy = Math.floor(d/86400000);
  if (m < 1)  return 'Baru saja';
  if (m < 60) return m + ' menit lalu';
  if (h < 24) return h + ' jam lalu';
  return dy + ' hari lalu';
}
function esc(s) {
  const d = document.createElement('div');
  d.appendChild(document.createTextNode(String(s || '')));
  return d.innerHTML;
}
function makeBadges(att, ev) {
  if (att === 'tidak') return '<span class="badge badge-tidak">Tidak Hadir</span>';
  const b = [];
  if (ev?.includes('pemberkatan')) b.push('<span class="badge badge-acara">Pemberkatan</span>');
  if (ev?.includes('resepsi'))     b.push('<span class="badge badge-acara">Resepsi</span>');
  return b.join('');
}

window.createWishCard = function(w) {
  const c = document.createElement('div');
  c.className = 'masonry-item wish-card';
const nameHtml = w.city 
    ? `${esc(w.name)} | <span style="font-style: italic;">di ${esc(w.city)}</span>` 
    : esc(w.name);c.innerHTML = `
    <div class="wish-card-name">${nameHtml}</div>
    <p class="wish-card-msg">${esc(w.message)}</p>
    <div class="wish-card-foot">
      <span class="wish-time">${timeAgo(w.time)}</span>
      <div style="display:flex;flex-wrap:wrap;gap:3px">${makeBadges(w.attendance, w.events)}</div>
    </div>`;
  return c;
};

function renderWishes() {
  const wall = document.getElementById('wishes-wall');
  if (!wall) return;
  const wishes = loadWishes();
  wall.innerHTML = '';
  if (!wishes.length) {
    wall.innerHTML = '<p style="font-family:\'Parisienne\',cursive;color:rgba(244,249,233,.32);font-size:1rem;text-align:center;padding:2rem;column-span:all">Jadilah yang pertama mengirim ucapan.</p>';
    return;
  }
  [...wishes].reverse().forEach(w => wall.appendChild(window.createWishCard(w)));
}

window.addWish = function(wish) {
  const wishes = loadWishes();
  wishes.push({ ...wish, time: new Date().toISOString() });
  saveWishes(wishes);
  renderWishes();
};

window.initWishes = function() {
  renderWishes();
  setInterval(renderWishes, 30000);
};

