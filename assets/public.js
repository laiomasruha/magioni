import { sb, $, $$, esc, norm, toast } from './lib.js';

const ICONS = {
  ig: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r="1" fill="currentColor"/></svg>',
  pix: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2l10 10-10 10L2 12z"/></svg>',
  sp: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M7 9.5c3.5-1 7-.6 10 1M7.5 12.8c3-.8 5.8-.4 8.3.9M8 16c2.3-.6 4.4-.3 6.3.7"/></svg>',
};

const state = { settings: null, cats: [], songs: [], filter: 'all', q: '', selected: null };
const COOLDOWN_MS = 20_000;

async function load() {
  const [s, c, so] = await Promise.all([
    sb.from('magioni_settings').select('*').eq('id', 1).maybeSingle(),
    sb.from('magioni_categories').select('id,name,position').order('position').order('name'),
    sb.from('magioni_songs').select('id,category_id,artist,title,position').eq('active', true).order('position'),
  ]);
  if (s.error || c.error || so.error) {
    $('#repertoire').innerHTML = '<p class="empty">Não foi possível carregar o repertório. Tente recarregar a página.</p>';
    return;
  }
  state.settings = s.data || {};
  state.cats = c.data;
  state.songs = so.data;
  renderHeader();
  renderTabs();
  renderList();
}

function renderHeader() {
  const st = state.settings;
  if (st.artist_name) {
    $('#artist-name').innerHTML = `${esc(st.artist_name)}<span>.</span>`;
    document.title = `${st.artist_name} · À la carte`;
  }
  if (st.tagline) $('#tagline').textContent = st.tagline;
  $('#closed').classList.toggle('hidden', !!st.requests_open);

  const links = [];
  if (st.instagram) {
    const handle = st.instagram.replace(/^@/, '');
    links.push(`<a class="chip" href="https://instagram.com/${encodeURIComponent(handle)}" target="_blank" rel="noopener">${ICONS.ig}@${esc(handle)}</a>`);
  }
  if (st.pix_key) links.push(`<button class="chip amber" type="button" id="pix-btn">${ICONS.pix}Pix pro músico · copiar chave</button>`);
  if (st.spotify_url && /^https?:\/\//i.test(st.spotify_url)) links.push(`<a class="chip" href="${esc(st.spotify_url)}" target="_blank" rel="noopener">${ICONS.sp}Ouça ${st.ep_name ? 'o EP ' + esc(st.ep_name) : 'no Spotify'}</a>`);
  $('#links').innerHTML = links.join('');
  $('#pix-btn')?.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(st.pix_key);
      toast('Chave Pix copiada. Valeu pela força! 🍺');
    } catch {
      toast(`Chave Pix: ${st.pix_key}`);
    }
  });
}

function renderTabs() {
  const used = new Set(state.songs.map((s) => s.category_id));
  const cats = state.cats.filter((c) => used.has(c.id));
  $('#tabs').innerHTML = [`<button class="tab" data-cat="all" aria-pressed="true">Todas</button>`]
    .concat(cats.map((c) => `<button class="tab" data-cat="${c.id}" aria-pressed="false">${esc(c.name)}</button>`))
    .join('');
  $$('#tabs .tab').forEach((b) =>
    b.addEventListener('click', () => {
      state.filter = b.dataset.cat;
      $$('#tabs .tab').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
      renderList();
    }),
  );
}

function renderList() {
  const q = norm(state.q.trim());
  const open = !!state.settings?.requests_open;
  const html = [];
  for (const cat of state.cats) {
    if (state.filter !== 'all' && state.filter !== cat.id) continue;
    const songs = state.songs.filter(
      (s) => s.category_id === cat.id && (!q || norm(s.title).includes(q) || norm(s.artist).includes(q)),
    );
    if (!songs.length) continue;
    const byArtist = new Map();
    for (const s of songs) {
      if (!byArtist.has(s.artist)) byArtist.set(s.artist, []);
      byArtist.get(s.artist).push(s);
    }
    html.push(`<div class="cat"><span class="cat-title">${esc(cat.name)}</span>`);
    for (const [artist, list] of byArtist) {
      html.push(`<div class="artist"><div class="artist-name">${esc(artist)}</div><div class="songs">`);
      for (const s of list) {
        html.push(`<button class="song" type="button" data-id="${s.id}" ${open ? '' : 'disabled'}>${esc(s.title)}</button>`);
      }
      html.push('</div></div>');
    }
    html.push('</div>');
  }
  $('#repertoire').innerHTML = html.length
    ? html.join('')
    : `<p class="empty">Nada encontrado para “${esc(state.q)}”. Que tal pedir pelo recado?</p>`;
}

$('#repertoire').addEventListener('click', (e) => {
  const btn = e.target.closest('.song');
  if (!btn || btn.disabled) return;
  const song = state.songs.find((s) => s.id === btn.dataset.id);
  if (!song) return;
  state.selected = song;
  $('#dlg-song').textContent = song.title;
  $('#dlg-artist').textContent = song.artist;
  $('#req-dialog').showModal();
});

$('#search').addEventListener('input', (e) => {
  state.q = e.target.value;
  renderList();
});

$('#dlg-cancel').addEventListener('click', () => $('#req-dialog').close());

function onCooldown(key) {
  try {
    const last = Number(localStorage.getItem(key) || 0);
    return Date.now() - last < COOLDOWN_MS;
  } catch {
    return false;
  }
}
function markSent(key) {
  try { localStorage.setItem(key, String(Date.now())); } catch { /* ignore */ }
}

$('#req-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const song = state.selected;
  if (!song) return;
  if (onCooldown('mg_last_req')) {
    toast('Calma! Espere uns segundinhos antes do próximo pedido.', 'err');
    return;
  }
  const fd = new FormData(e.target);
  const btn = $('#dlg-send');
  btn.disabled = true;
  const name = String(fd.get('name') || '').trim();
  const note = String(fd.get('note') || '').trim();
  const { error } = await sb.from('magioni_requests').insert({
    song_id: song.id,
    song_label: `${song.title} — ${song.artist}`,
    requester_name: name || null,
    note: note || null,
  });
  btn.disabled = false;
  if (error) {
    toast('Não deu pra enviar o pedido agora. Tente de novo.', 'err');
    return;
  }
  markSent('mg_last_req');
  try { if (name) localStorage.setItem('mg_name', name); } catch { /* ignore */ }
  e.target.elements.note.value = '';
  $('#req-dialog').close();
  toast(`Pedido enviado: ${song.title} 🎶`);
});

$('#comment-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  if (onCooldown('mg_last_msg')) {
    toast('Espere uns segundinhos antes de mandar outro recado.', 'err');
    return;
  }
  const fd = new FormData(e.target);
  const message = String(fd.get('message') || '').trim();
  if (!message) return;
  const name = String(fd.get('name') || '').trim();
  const btn = e.target.querySelector('button');
  btn.disabled = true;
  const { error } = await sb.from('magioni_comments').insert({ name: name || null, message });
  btn.disabled = false;
  if (error) {
    toast('Não deu pra enviar o recado agora. Tente de novo.', 'err');
    return;
  }
  markSent('mg_last_msg');
  e.target.elements.message.value = '';
  toast('Recado enviado. Obrigado! 💛');
});

// Preenche o nome salvo
try {
  const saved = localStorage.getItem('mg_name');
  if (saved) $$('input[name="name"]').forEach((i) => (i.value = saved));
} catch { /* ignore */ }

load();
