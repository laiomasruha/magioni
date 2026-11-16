// Painel: códigos de acesso e arquivos da área do contratante.
import { sb, $, esc, toast, timeAgo } from './lib.js';

// Enquanto a área do contratante está em teste, a aba aparece só para estes e-mails.
const PREVIEW_EMAILS = ['laiomasruha@gmail.com'];

const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; // sem 0/O, 1/I/L
const KINDS = { presskit: 'Press kit / release', rider: 'Rider técnico', foto: 'Fotos em alta', logo: 'Logos', outro: 'Outros' };
const WA_TEXT = (link, code) =>
  `Olá! Segue o acesso ao material do Mag!on! (press kit, rider técnico, fotos em alta e logos):\n${link}\nCódigo: ${code}`;

function newCode(len = 8) {
  const bytes = crypto.getRandomValues(new Uint8Array(len));
  return [...bytes].map((b) => ALPHABET[b % ALPHABET.length]).join('');
}
const linkFor = (code) => `${location.origin}/press-kit?codigo=${code}`;
const fmtDate = (iso) => new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
const slug = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40);

let started = false;
export function initContratantes(email) {
  if (!PREVIEW_EMAILS.includes(String(email || '').toLowerCase())) return;
  $('#tab-contratantes').classList.remove('hidden');
  if (started) return;
  started = true;
  loadCodes();
  loadKit();
}

/* ───────── Códigos ───────── */
async function loadCodes() {
  const { data, error } = await sb.from('magioni_access_codes').select('*').order('created_at', { ascending: false });
  if (error) { $('#code-list').innerHTML = '<p class="empty">Erro ao carregar os códigos.</p>'; return; }
  const now = new Date();
  $('#code-list').innerHTML = data.length ? data.map((c) => {
    const expired = c.expires_at && new Date(c.expires_at) < now;
    const status = c.revoked ? ['recusada', 'revogado'] : expired ? ['recusada', 'expirado'] : ['tocada', 'ativo'];
    return `
    <div class="item" data-id="${c.id}" data-code="${esc(c.code)}">
      <div class="item-head">
        <span class="item-title code-text">${esc(c.code)}</span>
        <span class="status ${status[0]}">${status[1]}</span>
      </div>
      <div class="item-meta">${c.label ? esc(c.label) + ' · ' : ''}criado ${timeAgo(c.created_at)} · ${c.expires_at ? (expired ? 'expirou em ' : 'vale até ') + fmtDate(c.expires_at) : 'sem validade'}</div>
      <div class="item-meta">${c.uses ? `${c.uses} acesso(s), o último ${timeAgo(c.last_used_at)}` : 'Ainda não foi usado'}</div>
      <div class="item-actions">
        <button class="btn small" data-act="copy">Copiar link</button>
        <button class="btn ok small" data-act="wa">Enviar no WhatsApp</button>
        <button class="btn ghost small" data-act="${c.revoked ? 'unrevoke' : 'revoke'}">${c.revoked ? 'Reativar' : 'Revogar'}</button>
        <button class="btn danger small" data-act="delete">Apagar</button>
      </div>
    </div>`;
  }).join('') : '<p class="empty">Nenhum código ainda.</p>';
}

$('#code-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const f = e.target.elements;
  const days = Number(f.days.value);
  const row = {
    code: newCode(),
    label: f.label.value.trim() || null,
    expires_at: days ? new Date(Date.now() + days * 86400000).toISOString() : null,
  };
  const btn = e.target.querySelector('button');
  btn.disabled = true;
  const { error } = await sb.from('magioni_access_codes').insert(row);
  btn.disabled = false;
  if (error) return toast('Erro ao gerar o código.', 'err');
  e.target.reset();
  toast(`Código ${row.code} criado.`);
  loadCodes();
});

$('#code-list').addEventListener('click', async (e) => {
  const btn = e.target.closest('[data-act]');
  if (!btn) return;
  const item = btn.closest('.item');
  const { id, code } = item.dataset;
  const act = btn.dataset.act;
  if (act === 'copy') {
    try { await navigator.clipboard.writeText(linkFor(code)); toast('Link copiado.'); }
    catch { prompt('Copie o link:', linkFor(code)); }
    return;
  }
  if (act === 'wa') {
    window.open(`https://wa.me/?text=${encodeURIComponent(WA_TEXT(linkFor(code), code))}`, '_blank', 'noopener');
    return;
  }
  let error;
  if (act === 'delete') {
    if (!confirm(`Apagar o código ${code}? Quem tiver esse código perde o acesso.`)) return;
    ({ error } = await sb.from('magioni_access_codes').delete().eq('id', id));
  } else {
    ({ error } = await sb.from('magioni_access_codes').update({ revoked: act === 'revoke' }).eq('id', id));
  }
  if (error) toast('Erro ao atualizar.', 'err');
  loadCodes();
});

/* ───────── Arquivos do kit ───────── */
async function loadKit() {
  const { data, error } = await sb.from('magioni_kit_items').select('*').order('position').order('created_at');
  if (error) { $('#kit-list').innerHTML = '<p class="empty">Erro ao carregar os arquivos.</p>'; return; }
  const groups = Object.keys(KINDS).map((k) => [k, data.filter((i) => i.kind === k)]).filter(([, l]) => l.length);
  $('#kit-list').innerHTML = groups.length ? groups.map(([k, list]) => `
    <div class="card rep-cat">
      <p class="item-meta" style="margin:0 0 6px;font-weight:700">${KINDS[k]} · ${list.length}</p>
      ${list.map((i) => `
        <div class="kit-row" data-id="${i.id}" data-path="${esc(i.path)}">
          <input class="input" data-field="title" value="${esc(i.title)}" maxlength="120" aria-label="Título" />
          <input class="input" data-field="description" value="${esc(i.description || '')}" maxlength="300" placeholder="Descrição" aria-label="Descrição" />
          <button class="btn ghost small" data-act="open" title="Abrir">Abrir</button>
          <button class="btn danger small" data-act="del" title="Apagar">✕</button>
        </div>`).join('')}
    </div>`).join('') : '<p class="empty">Nenhum arquivo ainda.</p>';
}

$('#kit-list').addEventListener('change', async (e) => {
  const input = e.target.closest('[data-field]');
  if (!input) return;
  const row = input.closest('.kit-row');
  const value = input.value.trim();
  if (input.dataset.field === 'title' && !value) { toast('O título não pode ficar vazio.', 'err'); return loadKit(); }
  const { error } = await sb.from('magioni_kit_items').update({ [input.dataset.field]: value || null }).eq('id', row.dataset.id);
  toast(error ? 'Erro ao salvar.' : 'Salvo.', error ? 'err' : 'ok');
});

$('#kit-list').addEventListener('click', async (e) => {
  const btn = e.target.closest('[data-act]');
  if (!btn) return;
  const row = btn.closest('.kit-row');
  const { id, path } = row.dataset;
  if (btn.dataset.act === 'open') {
    const { data, error } = await sb.storage.from('magioni-kit').createSignedUrl(path, 600);
    if (error) return toast('Não foi possível abrir o arquivo.', 'err');
    window.open(data.signedUrl, '_blank', 'noopener');
    return;
  }
  if (!confirm('Apagar este arquivo da área do contratante?')) return;
  const rm = await sb.storage.from('magioni-kit').remove([path]);
  if (rm.error) return toast('Erro ao apagar o arquivo.', 'err');
  const { error } = await sb.from('magioni_kit_items').delete().eq('id', id);
  if (error) toast('Erro ao apagar.', 'err'); else toast('Arquivo apagado.');
  loadKit();
});

$('#kit-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const f = e.target.elements;
  const file = f.file.files[0];
  if (!file) return;
  if (file.size > 50 * 1024 * 1024) return toast('Arquivo maior que 50 MB.', 'err');
  const title = f.title.value.trim();
  const ext = (file.name.split('.').pop() || 'bin').toLowerCase().replace(/[^a-z0-9]/g, '');
  const folder = { foto: 'fotos/', logo: 'logos/', presskit: '', rider: '', outro: 'outros/' }[f.kind.value];
  const path = `${folder}magioni-${slug(title) || 'arquivo'}-${Date.now().toString(36)}.${ext}`;
  const btn = $('#kit-btn');
  btn.disabled = true; btn.textContent = 'Enviando…';
  const up = await sb.storage.from('magioni-kit').upload(path, file, { contentType: file.type || undefined });
  if (up.error) { btn.disabled = false; btn.textContent = 'Enviar arquivo'; return toast('Erro ao enviar o arquivo.', 'err'); }
  const { data: last } = await sb.from('magioni_kit_items').select('position').order('position', { ascending: false }).limit(1);
  const { error } = await sb.from('magioni_kit_items').insert({
    kind: f.kind.value, title, description: f.description.value.trim() || null, path,
    position: (last?.[0]?.position ?? 0) + 1,
  });
  btn.disabled = false; btn.textContent = 'Enviar arquivo';
  if (error) { await sb.storage.from('magioni-kit').remove([path]); return toast('Erro ao salvar o arquivo.', 'err'); }
  e.target.reset();
  toast('Arquivo enviado.');
  loadKit();
});
