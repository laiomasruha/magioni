import { sb, $, $$, esc, toast, timeAgo } from './lib.js';
import { initContratantes } from './admin-contratantes.js';
import { initDashboard, loadDashboard } from './admin-dashboard.js';
import { initSite } from './admin-site.js';

const views = ['login', 'denied', 'app'];

// Entrou pelo link do e-mail? (o token chega no endereço e o Supabase apaga logo depois)
const AUTH_LINK = String(window.__authLink || '');
const FROM_LINK = /type=(magiclink|signup|recovery|invite)/.test(AUTH_LINK);
if (/error_code=/.test(AUTH_LINK)) {
  setTimeout(() => toast(/expired/.test(AUTH_LINK)
    ? 'Esse link expirou ou já foi usado. Peça um novo abaixo.'
    : 'Não deu para entrar com esse link. Peça um novo abaixo.', 'err'), 300);
  history.replaceState(null, '', location.pathname);
}
// Leva direto para criar a senha
function askPassword(text) {
  $('.admin-nav .tab[data-view="settings"]').click();
  if (text) $('#pw-hint').textContent = text;
  $('#pw-hint').classList.remove('hidden');
  const f = $('#password-form');
  f.scrollIntoView({ block: 'center' });
  setTimeout(() => f.elements.password.focus(), 200);
}
function show(name) {
  views.forEach((v) => $(`#${v}-view`).classList.toggle('hidden', v !== name));
}

const state = { reqStatus: 'pendente', cats: [], songs: [], settings: null, pollTimer: null };

/* ---------------- Auth ---------------- */
async function boot() {
  const { data } = await sb.auth.getSession();
  await onSession(data.session);
  // Evita chamar o Supabase dentro do callback (pode travar o cliente)
  sb.auth.onAuthStateChange((_evt, session) => setTimeout(() => onSession(session), 0));
}

let booted = false;
async function onSession(session) {
  if (!session) {
    booted = false;
    stopPolling();
    show('login');
    return;
  }
  if (booted) return;
  booted = true;
  const { data: isAdmin, error } = await sb.rpc('magioni_is_admin');
  if (error || !isAdmin) {
    booted = false;
    $('#denied-email').textContent = session.user.email || '';
    show('denied');
    return;
  }
  show('app');
  $('#me-email').textContent = session.user.email || '';
  const tempPw = !!session.user.user_metadata?.temp_password;
  if (FROM_LINK || tempPw) askPassword(tempPw
    ? 'Você entrou com uma senha provisória. Crie a sua senha aqui; a provisória deixa de valer na hora.'
    : null);
  initContratantes(session.user.email);
  initDashboard();
  initSite();
  await Promise.all([loadSettings(), loadRequests(), loadComments(), loadRepertoire()]);
  startPolling();
}

$('#login-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const fd = new FormData(e.target);
  const email = String(fd.get('email')).trim();
  const password = String(fd.get('password') || '');
  if (!password) {
    toast('Digite a senha ou use o link por e-mail.', 'err');
    return;
  }
  const btn = e.target.querySelector('button');
  btn.disabled = true;
  const { error } = await sb.auth.signInWithPassword({ email, password });
  btn.disabled = false;
  if (error) toast('E-mail ou senha incorretos.', 'err');
});

$('#magic-btn').addEventListener('click', async () => {
  const email = $('#login-form').elements.email.value.trim();
  if (!email) {
    toast('Preencha o e-mail primeiro.', 'err');
    return;
  }
  const { error } = await sb.auth.signInWithOtp({
    email,
    options: { shouldCreateUser: true, emailRedirectTo: `${location.origin}/admin` },
  });
  if (error) {
    console.error(error);
    const limit = error.status === 429 || /rate limit/i.test(error.message || '');
    toast(limit
      ? 'Muitos links pedidos em pouco tempo. Use o último que chegou no e-mail ou tente de novo em 1 hora.'
      : 'Este e-mail não tem acesso ao painel.', 'err');
  } else toast('Link enviado! Confira sua caixa de entrada (e o spam).');
});

const logout = async () => {
  await sb.auth.signOut();
  show('login');
};
$('#logout').addEventListener('click', logout);
$('#denied-logout').addEventListener('click', logout);

/* ---------------- Nav ---------------- */
$$('.admin-nav .tab').forEach((b) =>
  b.addEventListener('click', () => {
    $$('.admin-nav .tab').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
    $$('.view').forEach((v) => v.classList.toggle('hidden', v.id !== `view-${b.dataset.view}`));
  }),
);

function startPolling() {
  stopPolling();
  state.pollTimer = setInterval(() => {
    if (document.hidden) return;
    loadRequests();
    loadComments();
    if (!$('#view-dashboard').classList.contains('hidden')) loadDashboard();
  }, 15000);
}
function stopPolling() {
  if (state.pollTimer) clearInterval(state.pollTimer);
  state.pollTimer = null;
}
document.addEventListener('visibilitychange', () => {
  if (!document.hidden && booted) {
    loadRequests();
    loadComments();
  }
});

/* ---------------- Pedidos ---------------- */
$$('#view-requests [data-status]').forEach((b) =>
  b.addEventListener('click', () => {
    state.reqStatus = b.dataset.status;
    $$('#view-requests [data-status]').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
    loadRequests();
  }),
);

async function loadRequests() {
  let q = sb.from('magioni_requests').select('*').order('created_at', { ascending: false }).limit(500);
  if (state.reqStatus !== 'all') q = q.eq('status', state.reqStatus);
  const [{ data, error }, pend, top] = await Promise.all([
    q,
    sb.from('magioni_requests').select('id', { count: 'exact', head: true }).eq('status', 'pendente'),
    sb.from('magioni_requests').select('song_label').order('created_at', { ascending: false }).limit(1000),
  ]);
  if (error) {
    $('#req-list').innerHTML = '<p class="empty">Erro ao carregar pedidos.</p>';
    return;
  }
  const n = pend.count || 0;
  const badge = $('#badge-req');
  badge.textContent = n;
  badge.classList.toggle('hidden', !n);

  // Mais pedidas
  const counts = new Map();
  (top.data || []).forEach((r) => counts.set(r.song_label, (counts.get(r.song_label) || 0) + 1));
  const ranking = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
  $('#top-songs').innerHTML = ranking.length
    ? `<p class="item-meta" style="margin:0 0 6px">Mais pedidas</p><div class="top-list">${ranking
        .map(([label, c]) => `<span class="chip">${esc(label)} · ${c}</span>`)
        .join('')}</div>`
    : '';

  // Agrupa os pedidos da mesma música (e mesmo status): o grupo com o pedido mais recente fica no topo
  const groups = new Map();
  for (const r of data) {
    const key = `${r.song_id || r.song_label}|${r.status}`;
    if (!groups.has(key)) groups.set(key, { key, label: r.song_label, status: r.status, items: [], last: r.created_at });
    const g = groups.get(key);
    g.items.push(r);
    if (r.created_at > g.last) g.last = r.created_at;
  }
  const list = [...groups.values()].sort((a, b) => (a.last < b.last ? 1 : -1));
  list.forEach((g) => g.items.sort((a, b) => (a.created_at < b.created_at ? 1 : -1)));

  $('#req-list').innerHTML = list.length
    ? list
        .map((g) => {
          const n = g.items.length;
          const people = g.items.map((r) => `
            <li>
              <span class="who">${r.requester_name ? esc(r.requester_name) : 'Alguém'}</span>
              <span class="item-meta">${timeAgo(r.created_at)}</span>
              ${r.note ? `<p class="item-note">${esc(r.note)}</p>` : ''}
            </li>`).join('');
          return `
      <div class="item req-group ${n > 1 ? 'multi' : ''}" data-ids="${g.items.map((r) => r.id).join(',')}">
        <div class="item-head">
          <span class="item-title">${esc(g.label)}</span>
          <span class="status ${g.status}">${g.status}</span>
        </div>
        <p class="req-count">${n > 1 ? `<b>${n}</b> pessoas pediram` : '1 pedido'} · último ${timeAgo(g.last)}</p>
        <ul class="req-people">${people}</ul>
        <div class="item-actions">
          ${g.status !== 'tocada' ? '<button class="btn ok small" data-act="tocada">✓ Tocada</button>' : ''}
          ${g.status !== 'recusada' ? '<button class="btn ghost small" data-act="recusada">Recusar</button>' : ''}
          ${g.status !== 'pendente' ? '<button class="btn ghost small" data-act="pendente">Voltar p/ fila</button>' : ''}
          <button class="btn danger small" data-act="delete">Apagar</button>
        </div>
      </div>`;
        })
        .join('')
    : '<p class="empty">Nenhum pedido aqui.</p>';
}

$('#req-list').addEventListener('click', async (e) => {
  const btn = e.target.closest('[data-act]');
  if (!btn) return;
  const ids = btn.closest('.item').dataset.ids.split(',');
  const act = btn.dataset.act;
  btn.disabled = true;
  let error;
  if (act === 'delete') {
    if (!confirm(ids.length > 1 ? `Apagar os ${ids.length} pedidos desta música?` : 'Apagar este pedido?')) { btn.disabled = false; return; }
    ({ error } = await sb.from('magioni_requests').delete().in('id', ids));
  } else {
    ({ error } = await sb.from('magioni_requests').update({ status: act }).in('id', ids));
  }
  if (error) toast('Erro ao atualizar.', 'err');
  loadRequests();
});

$('#clear-done').addEventListener('click', async () => {
  if (!confirm('Apagar todos os pedidos tocados e recusados?')) return;
  const { error } = await sb.from('magioni_requests').delete().in('status', ['tocada', 'recusada']);
  if (error) toast('Erro ao apagar.', 'err');
  else toast('Pedidos antigos apagados.');
  loadRequests();
});

$('#req-open').addEventListener('change', async (e) => {
  const { error } = await sb.from('magioni_settings').update({ requests_open: e.target.checked, updated_at: new Date().toISOString() }).eq('id', 1);
  if (error) {
    toast('Erro ao salvar.', 'err');
    e.target.checked = !e.target.checked;
  } else toast(e.target.checked ? 'Pedidos abertos.' : 'Pedidos fechados.');
});

/* ---------------- Recados ---------------- */
async function loadComments() {
  const { data, error } = await sb.from('magioni_comments').select('*').order('created_at', { ascending: false }).limit(300);
  if (error) {
    $('#com-list').innerHTML = '<p class="empty">Erro ao carregar recados.</p>';
    return;
  }
  const unread = data.filter((c) => !c.is_read).length;
  const badge = $('#badge-com');
  badge.textContent = unread;
  badge.classList.toggle('hidden', !unread);
  $('#com-list').innerHTML = data.length
    ? data
        .map(
          (c) => `
      <div class="item ${c.is_read ? '' : 'unread'}" data-id="${c.id}">
        <div class="item-head">
          <span class="item-title">${esc(c.name || 'Anônimo')}</span>
          <span class="item-meta">${timeAgo(c.created_at)}</span>
        </div>
        <p class="item-note">${esc(c.message)}</p>
        <div class="item-actions">
          <button class="btn ghost small" data-act="toggle">${c.is_read ? 'Marcar como não lido' : 'Marcar como lido'}</button>
          <button class="btn danger small" data-act="delete">Apagar</button>
        </div>
      </div>`,
        )
        .join('')
    : '<p class="empty">Nenhum recado ainda.</p>';
}

$('#com-list').addEventListener('click', async (e) => {
  const btn = e.target.closest('[data-act]');
  if (!btn) return;
  const item = btn.closest('.item');
  const id = item.dataset.id;
  let error;
  if (btn.dataset.act === 'delete') {
    if (!confirm('Apagar este recado?')) return;
    ({ error } = await sb.from('magioni_comments').delete().eq('id', id));
  } else {
    ({ error } = await sb.from('magioni_comments').update({ is_read: item.classList.contains('unread') }).eq('id', id));
  }
  if (error) toast('Erro ao atualizar.', 'err');
  loadComments();
});

$('#mark-all-read').addEventListener('click', async () => {
  const { error } = await sb.from('magioni_comments').update({ is_read: true }).eq('is_read', false);
  if (error) toast('Erro ao atualizar.', 'err');
  loadComments();
});

/* ---------------- Repertório ---------------- */
async function loadRepertoire() {
  const [c, s] = await Promise.all([
    sb.from('magioni_categories').select('*').order('position').order('name'),
    sb.from('magioni_songs').select('*').order('position'),
  ]);
  if (c.error || s.error) {
    $('#rep-list').innerHTML = '<p class="empty">Erro ao carregar repertório.</p>';
    return;
  }
  state.cats = c.data;
  state.songs = s.data;
  renderRepertoire();
}

function renderRepertoire() {
  $('#rep-list').innerHTML = state.cats
    .map((cat, i) => {
      const songs = state.songs.filter((s) => s.category_id === cat.id);
      return `
      <div class="card rep-cat" data-cat="${cat.id}">
        <div class="rep-cat-head">
          <input class="input cat-name" value="${esc(cat.name)}" maxlength="80" aria-label="Nome da categoria" />
          <button class="btn ghost small" data-act="cat-up" ${i === 0 ? 'disabled' : ''} title="Subir">↑</button>
          <button class="btn ghost small" data-act="cat-down" ${i === state.cats.length - 1 ? 'disabled' : ''} title="Descer">↓</button>
          <button class="btn danger small" data-act="cat-del" title="Apagar categoria">✕</button>
        </div>
        <p class="item-meta" style="margin:0 0 6px">${songs.length} música(s)</p>
        ${songs
          .map(
            (s) => `
          <div class="rep-row ${s.active ? '' : 'off'}" data-song="${s.id}">
            <input type="checkbox" class="switch" ${s.active ? 'checked' : ''} title="Visível no site" aria-label="Visível no site" />
            <input class="input artist-in" value="${esc(s.artist)}" maxlength="120" aria-label="Artista" />
            <input class="input title-in" value="${esc(s.title)}" maxlength="160" aria-label="Música" />
            <button class="btn danger small del" data-act="song-del" title="Apagar música">✕</button>
          </div>`,
          )
          .join('')}
        <form class="rep-add">
          <input class="input" name="artist" placeholder="Artista" maxlength="120" required />
          <input class="input" name="title" placeholder="Música" maxlength="160" required />
          <button class="btn small" type="submit">+ Adicionar</button>
        </form>
      </div>`;
    })
    .join('');
}

const repList = $('#rep-list');

repList.addEventListener('change', async (e) => {
  const t = e.target;
  const row = t.closest('[data-song]');
  if (row) {
    const id = row.dataset.song;
    let patch;
    if (t.classList.contains('switch')) patch = { active: t.checked };
    else if (t.classList.contains('artist-in')) patch = { artist: t.value.trim() };
    else if (t.classList.contains('title-in')) patch = { title: t.value.trim() };
    if (!patch) return;
    if ((patch.artist === '') || (patch.title === '')) {
      toast('O campo não pode ficar vazio.', 'err');
      return loadRepertoire();
    }
    const { error } = await sb.from('magioni_songs').update(patch).eq('id', id);
    if (error) return toast('Erro ao salvar.', 'err');
    const song = state.songs.find((s) => s.id === id);
    Object.assign(song, patch);
    if ('active' in patch) row.classList.toggle('off', !patch.active);
    toast('Salvo.');
    return;
  }
  if (t.classList.contains('cat-name')) {
    const id = t.closest('[data-cat]').dataset.cat;
    const name = t.value.trim();
    if (!name) return loadRepertoire();
    const { error } = await sb.from('magioni_categories').update({ name }).eq('id', id);
    toast(error ? 'Erro ao salvar.' : 'Categoria renomeada.', error ? 'err' : 'ok');
  }
});

repList.addEventListener('click', async (e) => {
  const btn = e.target.closest('[data-act]');
  if (!btn) return;
  const catEl = btn.closest('[data-cat]');
  const act = btn.dataset.act;
  if (act === 'song-del') {
    const id = btn.closest('[data-song]').dataset.song;
    const s = state.songs.find((x) => x.id === id);
    if (!confirm(`Apagar "${s.title}"? (Para só esconder, desmarque a caixinha.)`)) return;
    const { error } = await sb.from('magioni_songs').delete().eq('id', id);
    if (error) toast('Erro ao apagar.', 'err');
    return loadRepertoire();
  }
  if (act === 'cat-del') {
    const cat = state.cats.find((c) => c.id === catEl.dataset.cat);
    const n = state.songs.filter((s) => s.category_id === cat.id).length;
    if (!confirm(`Apagar a categoria "${cat.name}" e suas ${n} músicas?`)) return;
    const { error } = await sb.from('magioni_categories').delete().eq('id', cat.id);
    if (error) toast('Erro ao apagar.', 'err');
    return loadRepertoire();
  }
  if (act === 'cat-up' || act === 'cat-down') {
    const i = state.cats.findIndex((c) => c.id === catEl.dataset.cat);
    const j = act === 'cat-up' ? i - 1 : i + 1;
    if (j < 0 || j >= state.cats.length) return;
    const arr = [...state.cats];
    [arr[i], arr[j]] = [arr[j], arr[i]];
    const results = await Promise.all(
      arr.map((c, idx) => sb.from('magioni_categories').update({ position: idx }).eq('id', c.id)),
    );
    if (results.some((r) => r.error)) toast('Erro ao reordenar.', 'err');
    return loadRepertoire();
  }
});

repList.addEventListener('submit', async (e) => {
  if (!e.target.classList.contains('rep-add')) return;
  e.preventDefault();
  const form = e.target;
  const catId = form.closest('[data-cat]').dataset.cat;
  const artist = form.elements.artist.value.trim();
  const title = form.elements.title.value.trim();
  if (!artist || !title) return;
  const maxPos = state.songs.reduce((m, s) => Math.max(m, s.position || 0), 0);
  const { error } = await sb.from('magioni_songs').insert({ category_id: catId, artist, title, position: maxPos + 1 });
  if (error) return toast('Erro ao adicionar.', 'err');
  toast(`"${title}" adicionada.`);
  await loadRepertoire();
  const newForm = $(`[data-cat="${catId}"] .rep-add`);
  newForm.elements.artist.value = artist; // facilita adicionar várias do mesmo artista
  newForm.elements.title.focus();
});

$('#add-cat').addEventListener('submit', async (e) => {
  e.preventDefault();
  const name = e.target.elements.name.value.trim();
  if (!name) return;
  const pos = state.cats.length ? Math.max(...state.cats.map((c) => c.position)) + 1 : 0;
  const { error } = await sb.from('magioni_categories').insert({ name, position: pos });
  if (error) return toast('Erro ao criar categoria.', 'err');
  e.target.reset();
  toast('Categoria criada.');
  loadRepertoire();
});

/* ---------------- Configurações ---------------- */
async function loadSettings() {
  const { data, error } = await sb.from('magioni_settings').select('*').eq('id', 1).maybeSingle();
  if (error || !data) return;
  state.settings = data;
  const f = $('#settings-form');
  ['artist_name', 'tagline', 'instagram', 'pix_key', 'spotify_url', 'ep_name'].forEach((k) => (f.elements[k].value = data[k] || ''));
  $('#req-open').checked = !!data.requests_open;
  fillGeo(data);
}

/* ---------------- Limite por distância ---------------- */
const geoDraft = { lat: null, lng: null };
function fillGeo(d) {
  const f = $('#geo-form').elements;
  f.geo_enabled.checked = !!d.geo_enabled;
  f.geo_label.value = d.geo_label || '';
  f.geo_radius_m.value = String(d.geo_radius_m || 300);
  if (![...f.geo_radius_m.options].some((o) => o.selected)) f.geo_radius_m.value = '300';
  geoDraft.lat = d.geo_lat; geoDraft.lng = d.geo_lng;
  showWhere();
  const on = d.geo_enabled && d.geo_lat != null;
  const st = $('#geo-status');
  st.textContent = on ? 'ativo' : 'desligado';
  st.className = `status ${on ? 'tocada' : 'recusada'}`;
}
function showWhere(acc) {
  const el = $('#geo-where');
  if (geoDraft.lat == null) { el.textContent = 'Nenhum local definido'; return; }
  const url = `https://www.google.com/maps?q=${geoDraft.lat},${geoDraft.lng}`;
  el.innerHTML = `<a href="${url}" target="_blank" rel="noopener">Ver no mapa</a>${acc ? ` · precisão de ~${Math.round(acc)} m` : ''}`;
}
$('#geo-here').addEventListener('click', () => {
  if (!('geolocation' in navigator)) return toast('Este navegador não informa a localização.', 'err');
  const btn = $('#geo-here');
  btn.disabled = true; btn.textContent = 'Localizando…';
  navigator.geolocation.getCurrentPosition(
    (p) => {
      geoDraft.lat = p.coords.latitude; geoDraft.lng = p.coords.longitude;
      showWhere(p.coords.accuracy);
      btn.disabled = false; btn.textContent = 'Usar minha localização atual';
      toast('Local capturado. Toque em Salvar.');
    },
    (err) => {
      btn.disabled = false; btn.textContent = 'Usar minha localização atual';
      toast(err.code === 1 ? 'Permita o acesso à localização no navegador.' : 'Não foi possível obter a localização.', 'err');
    },
    { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 },
  );
});
// Busca por endereço (OpenStreetMap / Nominatim) ou coordenadas coladas
async function geoFind() {
  const q = $('#geo-q').value.trim();
  const box = $('#geo-results');
  if (!q) return;
  const m = q.match(/^\s*(-?\d{1,2}(?:[.,]\d+)?)\s*[,; ]\s*(-?\d{1,3}(?:[.,]\d+)?)\s*$/);
  if (m) {
    const lat = Number(m[1].replace(',', '.')), lng = Number(m[2].replace(',', '.'));
    if (Math.abs(lat) <= 90 && Math.abs(lng) <= 180) {
      geoDraft.lat = lat; geoDraft.lng = lng; box.innerHTML = ''; showWhere();
      return toast('Coordenadas definidas. Toque em Salvar.');
    }
  }
  const btn = $('#geo-find');
  btn.disabled = true; btn.textContent = 'Buscando…';
  try {
    const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=5&countrycodes=br&accept-language=pt-BR&q=${encodeURIComponent(q)}`;
    const r = await fetch(url, { headers: { Accept: 'application/json' } });
    const list = r.ok ? await r.json() : [];
    box.innerHTML = list.length
      ? list.map((x, i) => `<button type="button" class="geo-opt" data-i="${i}">${esc(x.display_name)}</button>`).join('')
      : '<p class="item-meta">Nenhum lugar encontrado. Tente com cidade e bairro, ou use a localização atual.</p>';
    box.querySelectorAll('.geo-opt').forEach((b) => b.addEventListener('click', () => {
      const x = list[+b.dataset.i];
      geoDraft.lat = Number(x.lat); geoDraft.lng = Number(x.lon);
      const f = $('#geo-form').elements;
      if (!f.geo_label.value.trim()) f.geo_label.value = (x.name || x.display_name.split(',')[0]).slice(0, 120);
      box.innerHTML = `<p class="item-meta">Selecionado: ${esc(x.display_name)}</p>`;
      showWhere();
      toast('Local definido. Toque em Salvar.');
    }));
  } catch {
    box.innerHTML = '<p class="item-meta">Não foi possível buscar agora. Tente de novo em instantes.</p>';
  } finally {
    btn.disabled = false; btn.textContent = 'Buscar';
  }
}
$('#geo-find').addEventListener('click', geoFind);
$('#geo-q').addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); geoFind(); } });

$('#geo-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const f = e.target.elements;
  if (f.geo_enabled.checked && geoDraft.lat == null) return toast('Defina o local do show antes de ativar.', 'err');
  const patch = {
    geo_enabled: f.geo_enabled.checked,
    geo_label: f.geo_label.value.trim() || null,
    geo_radius_m: Number(f.geo_radius_m.value),
    geo_lat: geoDraft.lat, geo_lng: geoDraft.lng,
    updated_at: new Date().toISOString(),
  };
  const { error } = await sb.from('magioni_settings').update(patch).eq('id', 1);
  if (error) return toast('Erro ao salvar.', 'err');
  toast(patch.geo_enabled ? 'Salvo. Limite por distância ativado.' : 'Salvo. Limite por distância desligado.');
  loadSettings();
});

$('#settings-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const f = e.target;
  const patch = { updated_at: new Date().toISOString() };
  ['artist_name', 'tagline', 'instagram', 'pix_key', 'spotify_url', 'ep_name'].forEach((k) => {
    const v = f.elements[k].value.trim();
    patch[k] = v || null;
  });
  patch.artist_name = patch.artist_name || 'Mag!on!';
  patch.tagline = patch.tagline || '';
  if (patch.instagram) patch.instagram = patch.instagram.replace(/^@/, '');
  const { error } = await sb.from('magioni_settings').update(patch).eq('id', 1);
  toast(error ? 'Erro ao salvar.' : 'Configurações salvas.', error ? 'err' : 'ok');
});

$('#password-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const password = e.target.elements.password.value;
  if (password.length < 8) return toast('A senha precisa ter pelo menos 8 caracteres.', 'err');
  const btn = e.target.querySelector('button');
  btn.disabled = true;
  const { error } = await sb.auth.updateUser({ password, data: { temp_password: false } });
  btn.disabled = false;
  if (error) {
    console.error(error);
    const msg = {
      weak_password: 'Senha fraca. Use letras e números, com pelo menos 8 caracteres.',
      same_password: 'Essa já é a sua senha atual.',
      reauthentication_needed: 'Por segurança, entre de novo pelo link do e-mail e tente outra vez.',
      session_not_found: 'Sua sessão expirou. Entre de novo pelo link do e-mail.',
    }[error.code] || `Não foi possível definir a senha (${error.message}).`;
    return toast(msg, 'err');
  }
  e.target.reset();
  $('#pw-hint').classList.add('hidden');
  toast('Senha criada! Da próxima vez, entre com e-mail e senha.');
});

boot();

document.addEventListener('magioni:repertoire-changed', () => loadRepertoire());
