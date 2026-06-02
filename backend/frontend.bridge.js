'use strict';

function mapRowToWish(row) {
  const events = [];
  if (row.attend_pemberkatan) events.push('pemberkatan');
  if (row.attend_resepsi)     events.push('resepsi');
  return {
    name:       row.nama_tamu,
    city:       row.city,
    message:    row.pesan,
    attendance: row.tidak_hadir ? 'tidak' : 'hadir',
    events,
    time:       row.created_at,
  };
}

const PAGE_SIZE    = 6;
let allWishes      = [];
let displayedCount = 0;
let realtimeSocket = null;

/* ── addWish ── */
window.addWish = async function (wish) {
  const payload = {
    nama_tamu:          wish.name,
    city:               wish.city,
    pesan:              wish.message,
    tidak_hadir:        wish.attendance === 'tidak',
    attend_pemberkatan: wish.events?.includes('pemberkatan') ?? false,
    attend_resepsi:     wish.events?.includes('resepsi')     ?? false,
  };
  try {
    await SupabaseService.submitRSVP(payload);
    await refreshWishesWall();
  } catch (err) {
    console.error('[Bridge] Gagal simpan RSVP:', err.message);
    showBridgeError('Gagal kirim. Cek koneksi internet.');
  }
};

/* ── initWishes ── */
window.initWishes = async function () {
  await refreshWishesWall();
  startRealtimeSubscription();
};

/* ── Fetch semua dari Supabase, reset wall ── */
async function refreshWishesWall() {
  const wall = document.getElementById('wishes-wall');
  if (!wall) return;
  try {
    const { wishes } = await SupabaseService.fetchWishes({ limit: 500 });
    allWishes      = wishes;
    displayedCount = 0;
    wall.innerHTML = '';
    document.getElementById('wishes-load-more')?.remove();
    appendNextPage();
  } catch (err) {
    console.error('[Bridge] Gagal fetch wishes:', err.message);
    renderErrorState(wall);
  }
}

/* ── Render 6 kartu berikutnya ── */
function appendNextPage() {
  const wall = document.getElementById('wishes-wall');
  if (!wall) return;

  document.getElementById('wishes-load-more')?.remove();

  if (allWishes.length === 0) { renderEmptyState(wall); return; }

  const batch = allWishes.slice(displayedCount, displayedCount + PAGE_SIZE);
  batch.forEach(row => renderWishCard(mapRowToWish(row), false));
  displayedCount += batch.length;

  const remaining = allWishes.length - displayedCount;
  if (remaining > 0) {
    const btn = document.createElement('button');
    btn.id          = 'wishes-load-more';
    btn.textContent = `Muat ${Math.min(PAGE_SIZE, remaining)} ucapan lagi`;
    btn.style.cssText = `
      display:block;width:100%;margin-top:14px;
      padding:11px 0;
      font-family:'Raleway',sans-serif;font-size:0.62rem;
      font-weight:500;letter-spacing:0.22em;text-transform:uppercase;
      color:rgba(244,249,233,0.55);background:transparent;
      border:1px solid rgba(221,161,177,0.2);cursor:pointer;
      transition:color 0.2s,border-color 0.2s;
    `;
    btn.onmouseover = () => { btn.style.color='#f4f9e9'; btn.style.borderColor='rgba(221,161,177,0.5)'; };
    btn.onmouseout  = () => { btn.style.color='rgba(244,249,233,0.55)'; btn.style.borderColor='rgba(221,161,177,0.2)'; };
    btn.onclick     = appendNextPage;
    wall.parentElement.appendChild(btn);
  }
}

/* ── Render satu kartu ── */
function renderWishCard(wish, prepend = true) {
  const wall = document.getElementById('wishes-wall');
  if (!wall) return;
  if (typeof window.createWishCard === 'function') {
    const card = window.createWishCard(wish);
    prepend ? wall.insertBefore(card, wall.firstChild) : wall.appendChild(card);
    return;
  }
  const card = document.createElement('div');
  card.className = 'wish-card';
  card.innerHTML = `
    <div class="wish-card-name">${esc(wish.name)}</div>
    <p class="wish-card-msg">${esc(wish.message)}</p>
    <div class="wish-card-foot">
      <span class="wish-time">${fmt(wish.time)}</span>
    </div>`;
  prepend ? wall.insertBefore(card, wall.firstChild) : wall.appendChild(card);
}

/* ── Realtime ── */
function startRealtimeSubscription() {
  if (realtimeSocket && realtimeSocket.readyState !== WebSocket.CLOSED) {
    realtimeSocket.close();
  }
  realtimeSocket = SupabaseService.subscribe((newRow) => {
    allWishes.unshift(newRow);
    displayedCount++;
    const wall = document.getElementById('wishes-wall');
    if (wall) renderWishCard(mapRowToWish(newRow), true);
    const counter = document.getElementById('wishes-count');
    if (counter) counter.textContent = parseInt(counter.textContent||'0',10) + 1;
  });
}

/* ── States ── */
function renderEmptyState(wall) {
  wall.innerHTML = `<p style="font-family:'Parisienne',cursive;color:rgba(244,249,233,.32);
    font-size:1rem;text-align:center;padding:2rem;column-span:all">
    Belum ada ucapan. Jadilah yang pertama!</p>`;
}
function renderErrorState(wall) {
  if (!wall) return;
  wall.innerHTML = `<p style="font-family:'Raleway',sans-serif;font-size:0.72rem;
    color:rgba(226,111,151,0.6);text-align:center;padding:2rem;column-span:all">
    Gagal memuat ucapan. Periksa koneksi internet.</p>`;
}
function showBridgeError(msg) {
  const t = document.getElementById('toast');
  const m = document.getElementById('toast-msg');
  if (!t||!m) return;
  m.textContent = msg;
  t.classList.remove('hidden');
  setTimeout(() => t.classList.add('hidden'), 4000);
}
function esc(s) {
  const d = document.createElement('div');
  d.appendChild(document.createTextNode(String(s||'')));
  return d.innerHTML;
}
function fmt(iso) {
  if (!iso) return '';
  const d = Date.now() - new Date(iso).getTime();
  const m = Math.floor(d/60000), h = Math.floor(d/3600000), dy = Math.floor(d/86400000);
  if (m<1) return 'Baru saja';
  if (m<60) return m+' menit lalu';
  if (h<24) return h+' jam lalu';
  return dy+' hari lalu';
}