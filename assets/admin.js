import { sb, $, $$, esc, toast, timeAgo } from './lib.js';
import { initContratantes } from './admin-contratantes.js';

const views = ['login', 'denied', 'app'];
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
  initContratantes(session.user.email);
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
  if (error) toast('Este e-mail não tem acesso ao painel.', 'err');
  else toast('Link enviado! Confira sua caixa de entrada.');
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
  let q = sb.from('magioni_requests').select('*').order('created_at', { ascending: state.reqStatus === 'pendente' }).limit(300);
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

  $('#req-list').innerHTML = data.length
    ? data
        .map(
          (r) => `
      <div class="item" data-id="${r.id}">
        <div class="item-head">
          <span class="item-title">${esc(r.song_label)}</span>
          <span class="status ${r.status}">${r.status}</span>
        </div>
        <div class="item-meta">${r.requester_name ? esc(r.requester_name) + ' · ' : ''}${timeAgo(r.created_at)}</div>
        ${r.note ? `<p class="item-note">${esc(r.note)}</p>` : ''}
        <div class="item-actions">
          ${r.status !== 'tocada' ? '<button class="btn ok small" data-act="tocada">✓ Tocada</button>' : ''}
          ${r.status !== 'recusada' ? '<button class="btn ghost small" data-act="recusada">Recusar</button>' : ''}
          ${r.status !== 'pendente' ? '<button class="btn ghost small" data-act="pendente">Voltar p/ fila</button>' : ''}
          <button class="btn danger small" data-act="delete">Apagar</button>
        </div>
      </div>`,
        )
        .join('')
    : '<p class="empty">Nenhum pedido aqui.</p>';
}

$('#req-list').addEventListener('click', async (e) => {
  const btn = e.target.closest('[data-act]');
  if (!btn) return;
  const id = btn.closest('.item').dataset.id;
  const act = btn.dataset.act;
  btn.disabled = true;
  let error;
  if (act === 'delete') {
    if (!confirm('Apagar este pedido?')) { btn.disabled = false; return; }
    ({ error } = await sb.from('magioni_requests').delete().eq('id', id));
  } else {
    ({ error } = await sb.from('magioni_requests').update({ status: act }).eq('id', id));
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
}

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
  const { error } = await sb.auth.updateUser({ password });
  if (error) return toast('Não foi possível definir a senha.', 'err');
  e.target.reset();
  toast('Senha definida. Da próxima vez, entre com e-mail e senha.');
});

boot();
