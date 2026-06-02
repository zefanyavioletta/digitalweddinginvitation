'use strict';

// ─── Validasi config tersedia ────────────────────────────
if (
  typeof SUPABASE_CONFIG === 'undefined' ||
  SUPABASE_CONFIG.url === 'https://cgbloofinjrabbzejtkj.supabase.co'
) {
  console.error(
    '[SupabaseService] SUPABASE_CONFIG belum diisi!\n' +
    'Buka wedding-backend/config.js dan isi url & anonKey.'
  );
}

// ─── Konstanta ───────────────────────────────────────────
const SB_URL   = SUPABASE_CONFIG.url;
const SB_KEY   = SUPABASE_CONFIG.anonKey;
const SB_TABLE = SUPABASE_CONFIG.table;

// ─── Helper: headers standar ─────────────────────────────
function baseHeaders() {
  return {
    'Content-Type':  'application/json',
    'apikey':        SB_KEY,
    'Authorization': `Bearer ${SB_KEY}`,
  };
}

// ─── Helper: handle response ─────────────────────────────
async function handleResponse(res) {
  const text = await res.text();
  let data;
  try { data = JSON.parse(text); } catch { data = text; }

  if (!res.ok) {
    const errMsg = data?.message || data?.error || `HTTP ${res.status}`;
    throw new Error(`[Supabase] ${errMsg}`);
  }
  return data;
}

// ═══════════════════════════════════════════════════════════
// 1. SUBMIT RSVP
//    Mengirim satu baris baru ke tabel rsvp.
//
//    @param {Object} payload
//      - nama_tamu         {string}  — wajib
//      - pesan             {string}  — wajib
//      - tidak_hadir       {boolean} — true jika tidak hadir
//      - attend_pemberkatan{boolean} — true jika hadir pemberkatan
//      - attend_resepsi    {boolean} — true jika hadir resepsi
//
//    @returns {Object} baris yang baru dibuat
// ═══════════════════════════════════════════════════════════
async function submitRSVPToSupabase(payload) {
  // Validasi field wajib
  if (!payload.nama_tamu || payload.nama_tamu.trim() === '') {
    throw new Error('nama_tamu tidak boleh kosong');
  }
  if (!payload.pesan || payload.pesan.trim() === '') {
    throw new Error('pesan tidak boleh kosong');
  }

  // Sanitasi & pemotongan string yang aman untuk Emoji menggunakan Array.from()
  const cleanNama = Array.from(payload.nama_tamu.trim()).slice(0, 100).join('');
  const cleanPesan = Array.from(payload.pesan.trim()).slice(0, 500).join('');
  const cleanKota = Array.from((payload.kota_asal || '').trim()).slice(0, 100).join('');

  const row = {
    nama_tamu:          cleanNama,
    kota_asal:          cleanKota,
    pesan:              cleanPesan,
    tidak_hadir:        Boolean(payload.tidak_hadir),
    attend_pemberkatan: Boolean(payload.attend_pemberkatan),
    attend_resepsi:     Boolean(payload.attend_resepsi),
  };

  // Konsistensi: jika tidak_hadir=true, paksa attend ke false
  if (row.tidak_hadir) {
    row.attend_pemberkatan = false;
    row.attend_resepsi     = false;
  }

  const res = await fetch(
    `${SB_URL}/rest/v1/${SB_TABLE}`,
    {
      method:  'POST',
      headers: {
        ...baseHeaders(),
        'Prefer': 'return=representation', 
      },
      body: JSON.stringify(row),
    }
  );

  const result = await handleResponse(res);
  return Array.isArray(result) ? result[0] : result;
}

// ═══════════════════════════════════════════════════════════
// 2. FETCH WISHES
//    Ambil semua ucapan, urut dari terbaru ke terlama.
//
//    @param {Object} options
//      - limit  {number} default 100
//      - offset {number} default 0  (untuk pagination)
//
//    @returns {Array} array of rows
// ═══════════════════════════════════════════════════════════
async function fetchWishes({ limit = 100, offset = 0 } = {}) {
  const params = new URLSearchParams({
    select: 'id,nama_tamu,kota_asal,pesan,created_at,tidak_hadir,attend_pemberkatan,attend_resepsi',
    order:  'created_at.desc',
    limit:  String(limit),
    offset: String(offset),
  });

  const res = await fetch(
    `${SB_URL}/rest/v1/${SB_TABLE}?${params}`,
    {
      method:  'GET',
      headers: {
        ...baseHeaders(),
        'Prefer': 'count=exact', // sertakan total count di header
      },
    }
  );

  const data = await handleResponse(res);
  const totalCount = parseInt(res.headers.get('content-range')?.split('/')[1] ?? '0', 10);

  return {
    wishes:     Array.isArray(data) ? data : [],
    totalCount,
  };
}

// ═══════════════════════════════════════════════════════════
// 3. REALTIME SUBSCRIPTION
//    Mendengarkan INSERT baru pada tabel rsvp secara realtime.
//    Menggunakan Supabase Realtime via WebSocket.
//
//    @param {Function} onNewWish  — dipanggil dengan row baru
//    @returns {WebSocket}         — koneksi, bisa ditutup
// ═══════════════════════════════════════════════════════════
function subscribeToNewWishes(onNewWish) {
  // Supabase Realtime endpoint
  const wsUrl = SB_URL
    .replace('https://', 'wss://')
    .replace('http://',  'ws://')
    + '/realtime/v1/websocket?apikey=' + SB_KEY + '&vsn=1.0.0';

  const ws = new WebSocket(wsUrl);

ws.onopen = () => {
    // Menggunakan variabel dinamik SB_TABLE agar sesuai config
    ws.send(JSON.stringify({
      topic:   `realtime:public:${SB_TABLE}`,
      event:   'phx_join',
      payload: {
        config: {
          broadcast:  { self: false },
          presence:   { key: '' },
          postgres_changes: [
            {
              event:  'INSERT',
              schema: 'public',
              table:  SB_TABLE,
            }
          ],
        },
      },
      ref: '1',
    }));
    console.log('[Realtime] Terhubung ke Supabase Realtime');
  };

  ws.onmessage = (event) => {
    try {
      const msg = JSON.parse(event.data);

      // Heartbeat reply
      if (msg.event === 'phx_reply' && msg.payload?.status === 'ok') return;

      // INSERT event
      if (
        msg.event === 'postgres_changes' &&
        msg.payload?.data?.type === 'INSERT'
      ) {
        const newRow = msg.payload.data.record;
        if (newRow && typeof onNewWish === 'function') {
          onNewWish(newRow);
        }
      }
    } catch (e) {
      console.warn('[Realtime] Parse error:', e);
    }
  };

  ws.onerror = (err) => {
    console.error('[Realtime] WebSocket error:', err);
  };

  ws.onclose = () => {
    console.log('[Realtime] Koneksi ditutup');
  };

  return ws;
}

// ═══════════════════════════════════════════════════════════
// 4. GET STATS
//    Hitung agregat: total, hadir, tidak hadir,
//    pemberkatan, resepsi.
//
//    @returns {Object} { total, hadir, tidakHadir, pemberkatan, resepsi }
// ═══════════════════════════════════════════════════════════
async function getWishesStats() {
  // Ambil semua (tanpa limit besar karena hanya hitung)
  const res = await fetch(
    `${SB_URL}/rest/v1/${SB_TABLE}?select=tidak_hadir,attend_pemberkatan,attend_resepsi`,
    {
      method:  'GET',
      headers: {
        ...baseHeaders(),
        'Prefer': 'count=exact',
      },
    }
  );

  const rows = await handleResponse(res);
  if (!Array.isArray(rows)) return null;

  return rows.reduce(
    (acc, r) => {
      acc.total++;
      if (r.tidak_hadir)        acc.tidakHadir++;
      else                      acc.hadir++;
      if (r.attend_pemberkatan) acc.pemberkatan++;
      if (r.attend_resepsi)     acc.resepsi++;
      return acc;
    },
    { total: 0, hadir: 0, tidakHadir: 0, pemberkatan: 0, resepsi: 0 }
  );
}

// ═══════════════════════════════════════════════════════════
// EXPORT (vanilla JS — variabel global)
// Jika pakai bundler, ganti dengan: export { ... }
// ═══════════════════════════════════════════════════════════
const SupabaseService = {
  submitRSVP:    submitRSVPToSupabase,
  fetchWishes,
  subscribe:     subscribeToNewWishes,
  getStats:      getWishesStats,
};