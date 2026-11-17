import { sb, $, $$, esc, norm, toast } from './lib.js';

const ICONS = {
  ig: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r="1" fill="currentColor"/></svg>',
  pix: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2l10 10-10 10L2 12z"/></svg>',
  sp: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M7 9.5c3.5-1 7-.6 10 1M7.5 12.8c3-.8 5.8-.4 8.3.9M8 16c2.3-.6 4.4-.3 6.3.7"/></svg>',
};

const state = { settings: null, cats: [], songs: [], filter: 'all', q: '', selected: null, pos: null, geo: 'idle', played: new Set() };
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
  await loadPlayed();
  renderHeader();
  renderTabs();
  renderList();
  applyAccess();
  if (state.settings.requests_open && geoOn(state.settings)) autoLocate();
}

/* ───── Acesso: pedidos abertos e (se ativo) distância do show ───── */
function distanceM(lat1, lng1, lat2, lng2) {
  const r = (d) => (d * Math.PI) / 180;
  const a = Math.sin(r(lat2 - lat1) / 2) ** 2 + Math.cos(r(lat1)) * Math.cos(r(lat2)) * Math.sin(r(lng2 - lng1) / 2) ** 2;
  return 2 * 6371000 * Math.asin(Math.sqrt(a));
}
const fmtDist = (m) => (m < 1000 ? `${Math.round(m / 10) * 10} m` : `${(m / 1000).toFixed(m < 10000 ? 1 : 0).replace('.', ',')} km`);
const geoOn = (st) => st.geo_enabled && st.geo_lat != null && st.geo_lng != null;

function showMenu(on) {
  $('#menu').classList.toggle('hidden', !on);
  $('#gate').classList.toggle('hidden', on);
  if (!on && $('#req-dialog').open) $('#req-dialog').close();
}

function gate(icon, title, text, btnLabel, onClick) {
  showMenu(false);
  $('#gate-icon').textContent = icon;
  $('#gate-title').textContent = title;
  $('#gate-text').textContent = text;
  const b = $('#gate-btn');
  b.classList.toggle('hidden', !btnLabel);
  b.textContent = btnLabel || '';
  b.onclick = onClick || null;
}

// Mostra onde é o show (nome cadastrado no painel) enquanto os pedidos estão abertos
function renderVenue() {
  const st = state.settings || {};
  const label = (st.geo_label || '').trim();
  const on = !!(st.requests_open && label);
  $('#venue').classList.toggle('hidden', !on);
  $('#venue-name').textContent = on ? label : '';
}

function applyAccess() {
  const st = state.settings || {};
  const name = st.artist_name || 'Mag!on!';
  renderVenue();
  if (!st.requests_open) {
    return gate('🌙', `${name} não está tocando agora`,
      'O cardápio musical abre durante os shows. Quando ele estiver no palco, é só voltar aqui e escolher a sua música.');
  }
  if (!geoOn(st)) return showMenu(true);

  const place = st.geo_label ? ` (${st.geo_label.trim()})` : '';
  if (state.pos) {
    const d = distanceM(st.geo_lat, st.geo_lng, state.pos.lat, state.pos.lng);
    if (d <= st.geo_radius_m) return showMenu(true);
    return gate('📍', 'Você está longe do show',
      `O cardápio só funciona no local do show${place}. Pela sua localização, você está a uns ${fmtDist(d)} de lá.`,
      'Tentar de novo', locate);
  }
  if (state.geo === 'locating') return gate('📡', 'Conferindo sua localização…', 'Isso leva só alguns segundos.');
  if (state.geo === 'denied') {
    return gate('📍', 'Precisamos da sua localização',
      'O cardápio só abre para quem está no show. Permita o acesso à localização nas configurações do navegador e tente de novo.',
      'Tentar de novo', locate);
  }
  if (state.geo === 'error') {
    return gate('📍', 'Não deu para achar sua localização',
      'Confira se a localização do celular está ligada e tente de novo.', 'Tentar de novo', locate);
  }
  return gate('🎸', 'Você está no show?',
    `Para pedir músicas, confirme que você está ${st.geo_label ? 'lá' : 'no local'}. A localização é usada só para isso e não fica guardada.`,
    'Estou no show, abrir o cardápio', locate);
}

function locate() {
  if (!('geolocation' in navigator)) { state.geo = 'error'; return applyAccess(); }
  state.geo = 'locating';
  applyAccess();
  navigator.geolocation.getCurrentPosition(
    (p) => { state.pos = { lat: p.coords.latitude, lng: p.coords.longitude }; state.geo = 'ok'; applyAccess(); },
    (err) => { state.geo = err.code === 1 ? 'denied' : 'error'; applyAccess(); },
    { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 },
  );
}

// Se a pessoa já autorizou antes, confere a localização sem precisar tocar no botão
async function autoLocate() {
  try {
    const p = await navigator.permissions?.query({ name: 'geolocation' });
    if (p && p.state === 'granted') locate();
  } catch { /* navegador sem suporte */ }
}

// Confere a cada minuto se o artista abriu/fechou os pedidos ou mudou a área
async function refreshSettings() {
  const { data } = await sb.from('magioni_settings').select('*').eq('id', 1).maybeSingle();
  if (!data) return;
  const was = state.settings || {};
  state.settings = data;
  if (geoOn(data) && !state.pos && state.geo === 'idle' && data.requests_open) autoLocate();
  if (was.requests_open !== data.requests_open || was.geo_enabled !== data.geo_enabled
      || was.geo_lat !== data.geo_lat || was.geo_lng !== data.geo_lng || was.geo_radius_m !== data.geo_radius_m
      || was.geo_label !== data.geo_label) {
    renderList();
    applyAccess();
  }
}
setInterval(() => { if (!document.hidden) refreshSettings(); }, 60_000);

// Músicas que já tocaram neste show: ficam apagadas e não podem ser pedidas de novo
async function loadPlayed() {
  const { data, error } = await sb.rpc('magioni_played_song_ids');
  if (error) return false;
  const next = new Set((data || []).map((r) => (typeof r === 'string' ? r : r.magioni_played_song_ids || r.song_id)));
  const changed = next.size !== state.played.size || [...next].some((id) => !state.played.has(id));
  state.played = next;
  return changed;
}
setInterval(async () => {
  if (document.hidden || !state.settings?.requests_open) return;
  if (await loadPlayed()) renderList();
}, 20_000);
document.addEventListener('visibilitychange', () => { if (!document.hidden) refreshSettings(); });

function renderHeader() {
  const st = state.settings;
  if (st.artist_name) {
    const name = esc(st.artist_name);
    $('#artist-name').innerHTML = /[.!?]$/.test(st.artist_name)
      ? name.replace(/!/g, '<span>!</span>')
      : `${name}<span>.</span>`;
    document.title = `${st.artist_name} · À la carte`;
  }
  if (st.tagline) $('#tagline').textContent = st.tagline;

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
        if (state.played.has(s.id)) {
          html.push(`<button class="song played" type="button" data-id="${s.id}" disabled aria-label="${esc(s.title)}, já tocou">${esc(s.title)}<span class="song-tag">✓ já tocou</span></button>`);
        } else {
          html.push(`<button class="song" type="button" data-id="${s.id}" ${open ? '' : 'disabled'}>${esc(s.title)}</button>`);
        }
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
    req_lat: state.pos?.lat ?? null,
    req_lng: state.pos?.lng ?? null,
  });
  btn.disabled = false;
  if (error) {
    await loadPlayed();
    if (state.played.has(song.id)) {
      $('#req-dialog').close();
      renderList();
      toast(`${song.title} já tocou neste show. Escolha outra! 🎸`, 'err');
    } else {
      toast('Não deu pra enviar o pedido agora. Tente de novo.', 'err');
    }
    refreshSettings();
    return;
  }
  markSent('mg_last_req');
  try { if (name) localStorage.setItem('mg_name', name); } catch { /* ignore */ }
  e.target.elements.note.value = '';
  $('#req-dialog').close();
  showThanks(song);
});

/* ───── Agradecimento depois do pedido ───── */
function showThanks(song) {
  const st = state.settings || {};
  const artist = st.artist_name || 'Mag!on!';
  $('#thanks-text').textContent = `“${song.title}” já está na lista do ${artist}${/[.!?]$/.test(artist) ? '' : '.'} Obrigado pelo pedido!`;
  const handle = (st.instagram || '').replace(/^@/, '').trim();
  const ig = $('#thanks-ig');
  ig.classList.toggle('hidden', !handle);
  if (handle) {
    ig.href = `https://instagram.com/${encodeURIComponent(handle)}`;
    ig.innerHTML = `${ICONS.ig}Seguir @${esc(handle)} no Instagram`;
  }
  const pix = $('#thanks-pix');
  pix.classList.toggle('hidden', !st.pix_key);
  pix.innerHTML = `${ICONS.pix}Contribuir com um Pix`;
  $('#thanks-pixkey').classList.add('hidden');
  const dlg = $('#thanks');
  if (typeof dlg.showModal === 'function') dlg.showModal();
  else toast(`Pedido enviado: ${song.title} 🎶`);
}
$('#thanks-close').addEventListener('click', () => $('#thanks').close());
$('#thanks').addEventListener('click', (e) => { if (e.target === e.currentTarget) e.currentTarget.close(); });
$('#thanks-pix').addEventListener('click', async () => {
  const key = state.settings?.pix_key;
  if (!key) return;
  const box = $('#thanks-pixkey');
  let copied = false;
  try { await navigator.clipboard.writeText(key); copied = true; } catch { /* sem permissão */ }
  box.innerHTML = `${copied ? 'Chave copiada! Cole no app do banco.' : 'Copie a chave no app do banco:'}<strong>${esc(key)}</strong>`;
  box.classList.remove('hidden');
});

/* ───── Abas do cardápio ───── */
function openTab(id) {
  $$('.mtab').forEach((b) => b.setAttribute('aria-selected', String(b.getAttribute('aria-controls') === id)));
  $$('.mpanel').forEach((p) => p.classList.toggle('hidden', p.id !== id));
}
$$('.mtab').forEach((b) => b.addEventListener('click', () => openTab(b.getAttribute('aria-controls'))));

/* ───── Sugestão de música ───── */
$('#suggest-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  if (onCooldown('mg_last_sug')) {
    toast('Espere uns segundinhos antes de mandar outra sugestão.', 'err');
    return;
  }
  const f = e.target.elements;
  const artist = f.artist.value.trim();
  const title = f.title.value.trim();
  if (!artist || !title) return;
  const name = f.name.value.trim();
  const btn = e.target.querySelector('button');
  btn.disabled = true;
  const { error } = await sb.from('magioni_suggestions').insert({
    artist, title, requester_name: name || null,
    req_lat: state.pos?.lat ?? null, req_lng: state.pos?.lng ?? null,
  });
  btn.disabled = false;
  if (error) {
    toast('Não deu pra enviar a sugestão agora. Tente de novo.', 'err');
    refreshSettings();
    return;
  }
  markSent('mg_last_sug');
  try { if (name) localStorage.setItem('mg_name', name); } catch { /* ignore */ }
  f.artist.value = ''; f.title.value = '';
  toast(`Sugestão enviada: ${title} 💡`);
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
  const { error } = await sb.from('magioni_comments').insert({
    name: name || null, message, req_lat: state.pos?.lat ?? null, req_lng: state.pos?.lng ?? null,
  });
  btn.disabled = false;
  if (error) {
    toast('Não deu pra enviar o recado agora. Tente de novo.', 'err');
    refreshSettings();
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
