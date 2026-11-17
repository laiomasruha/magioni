// Painel: dashboard com indicadores, rankings e sugestões do público.
import { sb, $, $$, esc, toast, timeAgo } from './lib.js';

const state = { days: 30, data: null };
const DAY = 86400000;
const norm = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const fmt = (n) => n.toLocaleString('pt-BR');
const pct = (a, b) => (b ? Math.round((a / b) * 100) : 0);

let inited = false;
export function initDashboard() {
  if (inited) return loadDashboard();
  inited = true;
  $$('#dash-period [data-days]').forEach((b) => b.addEventListener('click', () => {
    state.days = Number(b.dataset.days);
    $$('#dash-period [data-days]').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
    render();
  }));
  $$('.admin-nav .tab[data-view="dashboard"]').forEach((b) => b.addEventListener('click', () => loadDashboard()));
  loadDashboard();
}

export async function loadDashboard() {
  const [req, songs, cats, com, sug] = await Promise.all([
    sb.from('magioni_requests').select('created_at, song_id, song_label, status').order('created_at', { ascending: false }).limit(10000),
    sb.from('magioni_songs').select('id, artist, title, category_id, active'),
    sb.from('magioni_categories').select('id, name, position').order('position'),
    sb.from('magioni_comments').select('created_at').order('created_at', { ascending: false }).limit(10000),
    sb.from('magioni_suggestions').select('*').eq('status', 'nova').order('created_at', { ascending: false }).limit(2000),
  ]);
  if (req.error || songs.error || cats.error) {
    $('#dash-kpis').innerHTML = '<p class="empty">Erro ao carregar o dashboard.</p>';
    return;
  }
  state.data = { req: req.data, songs: songs.data, cats: cats.data, com: com.data || [], sug: sug.data || [] };
  render();
}

function inPeriod(iso) {
  return !state.days || Date.now() - new Date(iso).getTime() <= state.days * DAY;
}

function render() {
  const d = state.data;
  if (!d) return;
  const req = d.req.filter((r) => inPeriod(r.created_at));
  const songById = new Map(d.songs.map((s) => [s.id, s]));
  const catById = new Map(d.cats.map((c) => [c.id, c]));

  // ── Indicadores
  const played = req.filter((r) => r.status === 'tocada').length;
  const distinct = new Set(req.map((r) => r.song_id || r.song_label)).size;
  const hours = new Array(24).fill(0);
  req.forEach((r) => { hours[new Date(r.created_at).getHours()]++; });
  const peak = hours.indexOf(Math.max(...hours));
  const comments = d.com.filter((c) => inPeriod(c.created_at)).length;
  const sugGroups = groupSuggestions(d.sug);
  const kpi = (label, value, note) => `
    <div class="kpi"><span class="kpi-label">${label}</span><span class="kpi-value">${value}</span>${note ? `<span class="kpi-note">${note}</span>` : ''}</div>`;
  $('#dash-kpis').innerHTML = [
    kpi('Pedidos', fmt(req.length), state.days ? `últimos ${state.days} dias` : 'desde o início'),
    kpi('Tocadas', `${pct(played, req.length)}%`, `${fmt(played)} de ${fmt(req.length)}`),
    kpi('Músicas diferentes', fmt(distinct), `de ${fmt(d.songs.filter((s) => s.active).length)} no repertório`),
    kpi('Horário de pico', req.length ? `${String(peak).padStart(2, '0')}h` : '—', req.length ? `${fmt(hours[peak])} pedidos nessa hora` : 'sem pedidos'),
    kpi('Recados', fmt(comments), 'no período'),
    kpi('Sugestões novas', fmt(sugGroups.length), 'esperando decisão'),
  ].join('');

  // ── Pedidos por dia
  const nDays = state.days || Math.min(60, Math.max(7, Math.ceil((Date.now() - new Date(d.req.at(-1)?.created_at || Date.now()).getTime()) / DAY) + 1));
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const buckets = [];
  for (let i = nDays - 1; i >= 0; i--) buckets.push({ t: today.getTime() - i * DAY, n: 0 });
  d.req.forEach((r) => {
    const t = new Date(r.created_at); t.setHours(0, 0, 0, 0);
    const b = buckets.find((x) => x.t === t.getTime());
    if (b) b.n++;
  });
  const max = Math.max(1, ...buckets.map((b) => b.n));
  const dayLabel = (t) => new Date(t).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
  const weekday = (t) => new Date(t).toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', '');
  $('#dash-days').innerHTML = buckets.some((b) => b.n) ? `
    <div class="cols" role="img" aria-label="Pedidos por dia nos últimos ${nDays} dias">
      ${buckets.map((b) => `
        <div class="col" tabindex="0" data-tip="${weekday(b.t)} ${dayLabel(b.t)}: ${b.n} pedido${b.n === 1 ? '' : 's'}">
          <div class="col-bar" style="height:${b.n ? Math.max(4, (b.n / max) * 100) : 0}%"></div>
        </div>`).join('')}
    </div>
    <div class="cols-axis"><span>${dayLabel(buckets[0].t)}</span><span>Maior dia: ${fmt(max)}</span><span>${dayLabel(buckets.at(-1).t)}</span></div>
    <table class="sr-only"><caption>Pedidos por dia</caption>${buckets.map((b) => `<tr><td>${dayLabel(b.t)}</td><td>${b.n}</td></tr>`).join('')}</table>`
    : '<p class="empty">Nenhum pedido no período.</p>';

  // ── Mais pedidas
  const counts = new Map();
  req.forEach((r) => {
    const k = r.song_id || r.song_label;
    const s = r.song_id && songById.get(r.song_id);
    const label = s ? `${s.title} — ${s.artist}` : r.song_label;
    const c = counts.get(k) || { label, n: 0, played: 0 };
    c.n++; if (r.status === 'tocada') c.played++;
    counts.set(k, c);
  });
  const top = [...counts.values()].sort((a, b) => b.n - a.n).slice(0, 10);
  $('#dash-top').innerHTML = bars(top.map((t, i) => ({
    label: `<span class="rank">${i + 1}</span>${esc(t.label)}`, n: t.n, tip: `${t.n} pedido(s), ${t.played} tocada(s)`,
  })), 'Nenhum pedido no período.');

  // ── Estilos
  const catCount = new Map();
  req.forEach((r) => {
    const s = r.song_id && songById.get(r.song_id);
    const name = s ? (catById.get(s.category_id)?.name || 'Sem estilo') : 'Fora do repertório';
    catCount.set(name, (catCount.get(name) || 0) + 1);
  });
  const catsSorted = [...catCount.entries()].sort((a, b) => b[1] - a[1]);
  $('#dash-cats').innerHTML = bars(catsSorted.map(([name, n]) => ({
    label: esc(name), n, tip: `${n} pedido(s) · ${pct(n, req.length)}% do total`,
  })), 'Nenhum pedido no período.');

  // ── Sugestões
  renderSuggestions(sugGroups, d.cats);

  // ── Nunca pedidas
  const asked = new Set(req.map((r) => r.song_id).filter(Boolean));
  const never = d.songs.filter((s) => s.active && !asked.has(s.id))
    .sort((a, b) => a.artist.localeCompare(b.artist) || a.title.localeCompare(b.title));
  $('#dash-never-n').textContent = `· ${fmt(never.length)}`;
  $('#dash-never').innerHTML = never.length
    ? `<ul class="never">${never.map((s) => `<li>${esc(s.title)} <span>${esc(s.artist)}</span></li>`).join('')}</ul>`
    : '<p class="empty">Todas as músicas foram pedidas pelo menos uma vez.</p>';

  const badge = (el) => { el.textContent = sugGroups.length; el.classList.toggle('hidden', !sugGroups.length); };
  badge($('#badge-sug')); badge($('#badge-sug2'));
}

function bars(rows, empty) {
  if (!rows.length) return `<p class="empty">${empty}</p>`;
  const max = Math.max(...rows.map((r) => r.n));
  return `<ol class="hbars">${rows.map((r) => `
    <li tabindex="0" data-tip="${esc(r.tip)}">
      <div class="hb-top"><span class="hb-label">${r.label}</span><span class="hb-n">${fmt(r.n)}</span></div>
      <div class="hb-track"><div class="hb-bar" style="width:${Math.max(2, (r.n / max) * 100)}%"></div></div>
    </li>`).join('')}</ol>`;
}

/* ───────── Sugestões ───────── */
function groupSuggestions(list) {
  const groups = new Map();
  list.forEach((s) => {
    const k = `${norm(s.artist)}|${norm(s.title)}`;
    const g = groups.get(k) || { key: k, artist: s.artist, title: s.title, ids: [], names: [], last: s.created_at };
    g.ids.push(s.id);
    if (s.requester_name) g.names.push(s.requester_name);
    if (s.created_at > g.last) g.last = s.created_at;
    groups.set(k, g);
  });
  return [...groups.values()].sort((a, b) => b.ids.length - a.ids.length || b.last.localeCompare(a.last));
}

function renderSuggestions(groups, cats) {
  const opts = cats.map((c) => `<option value="${c.id}">${esc(c.name)}</option>`).join('');
  $('#dash-sug').innerHTML = groups.length ? groups.map((g, i) => `
    <div class="item sug-item" data-i="${i}">
      <div class="item-head">
        <span class="item-title">${esc(g.title)} <span class="item-meta">— ${esc(g.artist)}</span></span>
        <span class="status pendente">${g.ids.length} ${g.ids.length === 1 ? 'pedido' : 'pedidos'}</span>
      </div>
      <div class="item-meta">${g.names.length ? esc([...new Set(g.names)].slice(0, 4).join(', ')) + ' · ' : ''}${timeAgo(g.last)}</div>
      <div class="sug-edit">
        <input class="input" data-f="title" value="${esc(g.title)}" maxlength="160" aria-label="Música" />
        <input class="input" data-f="artist" value="${esc(g.artist)}" maxlength="120" aria-label="Artista" />
        <select class="input" data-f="cat" aria-label="Estilo">${opts}</select>
      </div>
      <div class="item-actions">
        <button class="btn ok small" data-act="add">+ Cadastrar no repertório</button>
        <button class="btn ghost small" data-act="discard">Descartar</button>
      </div>
    </div>`).join('') : '<p class="empty">Nenhuma sugestão nova.</p>';
  $('#dash-sug').onclick = async (e) => {
    const btn = e.target.closest('[data-act]');
    if (!btn) return;
    const item = btn.closest('.sug-item');
    const g = groups[+item.dataset.i];
    btn.disabled = true;
    if (btn.dataset.act === 'discard') {
      const { error } = await sb.from('magioni_suggestions').update({ status: 'descartada' }).in('id', g.ids);
      if (error) { btn.disabled = false; return toast('Erro ao descartar.', 'err'); }
      toast('Sugestão descartada.');
      return loadDashboard();
    }
    const title = item.querySelector('[data-f="title"]').value.trim();
    const artist = item.querySelector('[data-f="artist"]').value.trim();
    const category_id = item.querySelector('[data-f="cat"]').value;
    if (!title || !artist || !category_id) { btn.disabled = false; return toast('Preencha música, artista e estilo.', 'err'); }
    const { data: last } = await sb.from('magioni_songs').select('position').order('position', { ascending: false }).limit(1);
    const { data: song, error } = await sb.from('magioni_songs')
      .insert({ title, artist, category_id, position: (last?.[0]?.position ?? 0) + 1 })
      .select('id').single();
    if (error) { btn.disabled = false; return toast('Erro ao cadastrar a música.', 'err'); }
    await sb.from('magioni_suggestions').update({ status: 'adicionada', song_id: song.id }).in('id', g.ids);
    toast(`“${title}” entrou no repertório.`);
    loadDashboard();
    document.dispatchEvent(new CustomEvent('magioni:repertoire-changed'));
  };
}

/* Tooltip simples para barras (passar o mouse ou focar com o teclado) */
let tipEl;
function tip(e) {
  const t = e.target.closest?.('[data-tip]');
  if (!t || !t.closest('#view-dashboard')) { if (tipEl) tipEl.hidden = true; return; }
  if (!tipEl) { tipEl = document.createElement('div'); tipEl.className = 'dash-tip'; document.body.appendChild(tipEl); }
  tipEl.textContent = t.dataset.tip;
  tipEl.hidden = false;
  const r = t.getBoundingClientRect();
  const w = tipEl.offsetWidth;
  tipEl.style.left = `${Math.min(window.innerWidth - w - 8, Math.max(8, r.left + r.width / 2 - w / 2))}px`;
  tipEl.style.top = `${r.top + window.scrollY - tipEl.offsetHeight - 8}px`;
}
document.addEventListener('mouseover', tip);
document.addEventListener('focusin', tip);
document.addEventListener('scroll', () => { if (tipEl) tipEl.hidden = true; }, { passive: true });
