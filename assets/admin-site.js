// Painel → Site: contato, redes, fotos fixas, vídeos e galeria do site oficial (tabela magioni_site).
import { sb, $, $$, esc, toast } from './lib.js';

const BUCKET = 'magioni-media';
const MAX_VIDEO = 50 * 1024 * 1024;

const FIXED = [
  { key: 'hero', title: 'Foto de abertura', hint: 'A primeira coisa que aparece no site. Prefira horizontal.', max: 2400 },
  { key: 'portrait', title: 'Retrato (seção Sobre)', hint: 'Fica ao lado do texto de apresentação.', max: 1400 },
  { key: 'cover', title: 'Capa do EP / álbum', hint: 'Quadrada, na seção Música.', max: 1000 },
  { key: 'stage', title: 'Foto de palco (seção Palcos)', hint: 'Horizontal, ao lado da ficha técnica.', max: 2000, mobile: 900 },
];
const KINDS = ['Videoclipe', 'Ao vivo', 'Ensaio', 'Cover', 'Entrevista', 'Bastidores'];

let C = null;          // rascunho do conteúdo
let dirty = false;
let started = false;

export function initSite() {
  if (started) return;
  started = true;
  load();
  bind();
}

async function load() {
  const { data, error } = await sb.from('magioni_site').select('content').eq('id', 1).maybeSingle();
  if (error) { toast('Erro ao carregar o conteúdo do site.', 'err'); return; }
  C = normalize(data?.content || {});
  renderAll();
  setDirty(false);
}

function normalize(c) {
  c.links ||= {};
  c.contact ||= {};
  c.contact.whatsapp ||= [];
  c.images ||= {};
  c.youtube ||= [];
  c.clips ||= [];
  c.gallery ||= [];
  return c;
}

/* ───── Estado de "alterações não salvas" ───── */
function setDirty(v) {
  dirty = v;
  $('#site-save').disabled = !v;
  $('#site-dirty').textContent = v ? 'Não salvo' : 'Tudo salvo';
  $('#site-save-bar').classList.toggle('dirty', v);
}
window.addEventListener('beforeunload', (e) => { if (dirty) { e.preventDefault(); e.returnValue = ''; } });

async function save() {
  const btn = $('#site-save');
  // limpa linhas vazias antes de salvar
  C.contact.whatsapp = C.contact.whatsapp
    .filter((w) => onlyDigits(w.number))
    .map((w) => ({ number: onlyDigits(w.number), label: fmtPhone(w.number) }));
  C.youtube = C.youtube.filter((v) => v.id);
  btn.disabled = true;
  btn.textContent = 'Salvando…';
  const { error } = await sb.from('magioni_site')
    .update({ content: C, updated_at: new Date().toISOString() }).eq('id', 1);
  btn.textContent = 'Salvar alterações';
  if (error) { btn.disabled = false; return toast('Erro ao salvar. Tente de novo.', 'err'); }
  setDirty(false);
  renderAll();
  toast('Site atualizado.');
}

/* ───── Utilitários ───── */
const onlyDigits = (s) => String(s || '').replace(/\D/g, '');
const getPath = (obj, path) => path.split('.').reduce((o, k) => (o ? o[k] : undefined), obj);
const setPath = (obj, path, v) => {
  const ks = path.split('.');
  const last = ks.pop();
  ks.reduce((o, k) => (o[k] ||= {}), obj)[last] = v;
};
const move = (arr, i, d) => {
  const j = i + d;
  if (j < 0 || j >= arr.length) return;
  [arr[i], arr[j]] = [arr[j], arr[i]];
};
const fmtPhone = (n) => {
  const d = onlyDigits(n).replace(/^55(?=\d{10,11}$)/, '');
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return n;
};
// Número no formato do wa.me: com DDI. Se a pessoa digitou só DDD + número, coloca o 55.
const waNumber = (n) => {
  const d = onlyDigits(n);
  return d.length === 10 || d.length === 11 ? `55${d}` : d;
};
const ytId = (s) => {
  const v = String(s || '').trim();
  if (/^[\w-]{11}$/.test(v)) return v;
  const m = v.match(/(?:youtu\.be\/|[?&]v=|\/(?:embed|shorts|live|v)\/)([\w-]{11})/);
  return m ? m[1] : '';
};
const rand = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
const publicUrl = (path) => sb.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;

async function upload(path, blob, contentType) {
  const { error } = await sb.storage.from(BUCKET).upload(path, blob, { contentType, cacheControl: '31536000', upsert: false });
  if (error) throw error;
  return publicUrl(path);
}

/* Reduz a foto no navegador antes de enviar (gira conforme o EXIF) */
async function resize(file, max, quality = 0.85) {
  const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' });
  const scale = Math.min(1, max / Math.max(bmp.width, bmp.height));
  const w = Math.round(bmp.width * scale), h = Math.round(bmp.height * scale);
  const cv = document.createElement('canvas');
  cv.width = w; cv.height = h;
  cv.getContext('2d').drawImage(bmp, 0, 0, w, h);
  bmp.close?.();
  const blob = await new Promise((res) => cv.toBlob(res, 'image/jpeg', quality));
  if (!blob) throw new Error('Não foi possível ler a imagem');
  return { blob, w, h };
}

/* Tira um quadro do vídeo para usar de capa e descobre se ele é vertical */
function videoPoster(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const v = document.createElement('video');
    v.muted = true; v.playsInline = true; v.preload = 'auto'; v.src = url;
    const fail = () => { URL.revokeObjectURL(url); reject(new Error('Formato de vídeo não suportado')); };
    v.onerror = fail;
    v.onloadedmetadata = () => { v.currentTime = Math.min(1, (v.duration || 2) / 3); };
    v.onseeked = () => {
      const max = 900, scale = Math.min(1, max / Math.max(v.videoWidth, v.videoHeight));
      const cv = document.createElement('canvas');
      cv.width = Math.round(v.videoWidth * scale); cv.height = Math.round(v.videoHeight * scale);
      cv.getContext('2d').drawImage(v, 0, 0, cv.width, cv.height);
      cv.toBlob((blob) => {
        URL.revokeObjectURL(url);
        blob ? resolve({ blob, tall: v.videoHeight > v.videoWidth }) : reject(new Error('Sem capa'));
      }, 'image/jpeg', 0.82);
    };
  });
}

function busy(el, on, label) {
  if (!el) return;
  el.classList.toggle('busy', on);
  if (label != null) el.dataset.label = label;
}

/* ───── Render ───── */
function renderAll() {
  $$('#view-site [data-k]').forEach((el) => { el.value = getPath(C, el.dataset.k) || ''; });
  renderWa();
  renderImages();
  renderYt();
  renderClips();
  renderGallery();
}

const arrows = (i, n) => `
  <button class="btn ghost small" type="button" data-move="-1" data-i="${i}" ${i === 0 ? 'disabled' : ''} aria-label="Subir">↑</button>
  <button class="btn ghost small" type="button" data-move="1" data-i="${i}" ${i === n - 1 ? 'disabled' : ''} aria-label="Descer">↓</button>`;

function renderWa() {
  const list = C.contact.whatsapp;
  $('#site-wa').innerHTML = list.length ? list.map((w, i) => `
    <div class="site-row site-wa" data-i="${i}">
      <input class="input" inputmode="tel" data-f="number" value="${esc(fmtPhone(w.number))}" placeholder="(27) 99999-9999" aria-label="Número" />
      <button class="btn danger small" type="button" data-del="${i}" aria-label="Remover número">Remover</button>
    </div>`).join('') : '<p class="item-meta" style="margin:0 0 8px">Nenhum número. O botão de WhatsApp some do site.</p>';
}

function renderImages() {
  $('#site-images').innerHTML = FIXED.map((f) => {
    const v = C.images[f.key] || {};
    return `
    <div class="card site-img" data-key="${f.key}">
      <div class="site-img-prev">${v.url ? `<img src="${esc(v.url)}" alt="" loading="lazy" />` : '<span class="item-meta">Sem foto</span>'}</div>
      <div class="site-img-body">
        <p class="item-title" style="margin:0">${esc(f.title)}</p>
        <p class="item-meta" style="margin:2px 0 10px">${esc(f.hint)}</p>
        <label class="field"><span>Descrição da foto</span><input class="input" data-alt="${f.key}" value="${esc(v.alt || '')}" maxlength="200" /></label>
        <label class="btn ghost small site-file">Trocar foto<input type="file" accept="image/*" data-fixed="${f.key}" hidden /></label>
      </div>
    </div>`;
  }).join('');
}

function renderYt() {
  const list = C.youtube;
  $('#site-yt').innerHTML = list.length ? list.map((v, i) => `
    <div class="site-row site-media" data-i="${i}">
      <a class="site-thumb" href="https://www.youtube.com/watch?v=${esc(v.id)}" target="_blank" rel="noopener" title="Abrir no YouTube">
        <img src="https://i.ytimg.com/vi/${esc(v.id)}/mqdefault.jpg" alt="" loading="lazy" />
        ${i === 0 ? '<span class="site-flag">Destaque</span>' : ''}
      </a>
      <div class="site-media-fields">
        <input class="input" data-f="title" value="${esc(v.title || '')}" placeholder="Título" maxlength="140" aria-label="Título" />
        <input class="input" data-f="kind" value="${esc(v.kind || '')}" placeholder="Tipo (ex.: Ao vivo)" maxlength="40" list="site-kinds" aria-label="Tipo" />
      </div>
      <div class="site-actions">${arrows(i, list.length)}<button class="btn danger small" type="button" data-del="${i}">Remover</button></div>
    </div>`).join('') + `<datalist id="site-kinds">${KINDS.map((k) => `<option value="${k}">`).join('')}</datalist>`
    : '<p class="item-meta" style="margin:0 0 8px">Nenhum vídeo do YouTube.</p>';
}

function renderClips() {
  const list = C.clips;
  $('#site-clips').innerHTML = list.length ? list.map((c, i) => `
    <div class="site-row site-media" data-i="${i}">
      <a class="site-thumb ${c.tall ? 'tall' : ''}" href="${esc(c.video)}" target="_blank" rel="noopener" title="Abrir o vídeo">
        ${c.poster ? `<img src="${esc(c.poster)}" alt="" loading="lazy" />` : '<span class="item-meta">Sem capa</span>'}
      </a>
      <div class="site-media-fields">
        <input class="input" data-f="title" value="${esc(c.title || '')}" placeholder="Legenda" maxlength="140" aria-label="Legenda" />
        <div class="row" style="flex-wrap:wrap;gap:6px">
          <select class="input" data-f="tall" aria-label="Formato" style="width:auto">
            <option value="1" ${c.tall ? 'selected' : ''}>Vertical</option>
            <option value="0" ${c.tall ? '' : 'selected'}>Horizontal</option>
          </select>
          <label class="btn ghost small site-file">Trocar capa<input type="file" accept="image/*" data-poster="${i}" hidden /></label>
        </div>
      </div>
      <div class="site-actions">${arrows(i, list.length)}<button class="btn danger small" type="button" data-del="${i}">Remover</button></div>
    </div>`).join('') : '<p class="item-meta" style="margin:0 0 8px">Nenhum vídeo próprio.</p>';
}

function renderGallery() {
  const list = C.gallery;
  $('#site-gallery').innerHTML = list.length ? list.map((g, i) => `
    <figure class="site-shot" data-i="${i}">
      <img src="${esc(g.thumb || g.full)}" alt="" loading="lazy" />
      <input class="input" data-f="alt" value="${esc(g.alt || '')}" placeholder="Descrição" maxlength="200" aria-label="Descrição da foto ${i + 1}" />
      <div class="site-actions">
        <button class="btn ghost small" type="button" data-move="-1" data-i="${i}" ${i === 0 ? 'disabled' : ''} aria-label="Mover para antes">←</button>
        <button class="btn ghost small" type="button" data-move="1" data-i="${i}" ${i === list.length - 1 ? 'disabled' : ''} aria-label="Mover para depois">→</button>
        <button class="btn danger small" type="button" data-del="${i}" aria-label="Remover foto">✕</button>
      </div>
    </figure>`).join('') : '<p class="item-meta" style="margin:0 0 8px">Nenhuma foto. A seção Fotos some do site.</p>';
}

/* ───── Eventos ───── */
function bind() {
  const view = $('#view-site');

  // campos simples (contato e links)
  view.addEventListener('input', (e) => {
    const el = e.target;
    if (!C) return;
    if (el.dataset.k) { setPath(C, el.dataset.k, el.value.trim()); setDirty(true); return; }
    if (el.dataset.alt) { (C.images[el.dataset.alt] ||= {}).alt = el.value.trim(); setDirty(true); return; }
    const row = el.closest('[data-i]');
    const f = el.dataset.f;
    if (!row || !f) return;
    const i = +row.dataset.i;
    const box = el.closest('#site-wa, #site-yt, #site-clips, #site-gallery');
    if (!box) return;
    const list = { 'site-wa': C.contact.whatsapp, 'site-yt': C.youtube, 'site-clips': C.clips, 'site-gallery': C.gallery }[box.id];
    if (box.id === 'site-wa' && f === 'number') list[i].number = waNumber(el.value);
    else if (f === 'tall') list[i].tall = el.value === '1';
    else list[i][f] = el.value.trim();
    setDirty(true);
  });
  // mostra o número formatado ao sair do campo
  view.addEventListener('focusout', (e) => {
    if (e.target.dataset.f === 'number' && e.target.closest('#site-wa')) {
      const w = C.contact.whatsapp[+e.target.closest('[data-i]').dataset.i];
      if (w) e.target.value = fmtPhone(w.number);
    }
  });

  // mover / remover nas listas
  const listFor = (el) => {
    const box = el.closest('#site-wa, #site-yt, #site-clips, #site-gallery');
    if (!box) return [null];
    const map = {
      'site-wa': [C.contact.whatsapp, renderWa], 'site-yt': [C.youtube, renderYt],
      'site-clips': [C.clips, renderClips], 'site-gallery': [C.gallery, renderGallery],
    };
    return map[box.id];
  };
  view.addEventListener('click', (e) => {
    const b = e.target.closest('[data-move], [data-del]');
    if (!b || !C) return;
    const [list, rerender] = listFor(b);
    if (!list) return;
    if (b.dataset.move) move(list, +b.dataset.i, +b.dataset.move);
    else {
      const what = b.closest('#site-gallery') ? 'esta foto' : b.closest('#site-wa') ? 'este número' : 'este vídeo';
      if (!confirm(`Remover ${what} do site?`)) return;
      list.splice(+b.dataset.del, 1);
    }
    rerender();
    setDirty(true);
  });

  $('#site-wa-add').addEventListener('click', () => {
    C.contact.whatsapp.push({ number: '', label: '' });
    renderWa();
    setDirty(true);
    $$('#site-wa [data-f="number"]').pop()?.focus();
  });

  // YouTube: adicionar por link
  $('#site-yt-add').addEventListener('submit', (e) => {
    e.preventDefault();
    const id = ytId(e.target.url.value);
    if (!id) return toast('Não reconheci esse link do YouTube.', 'err');
    if (C.youtube.some((v) => v.id === id)) return toast('Esse vídeo já está na lista.', 'err');
    C.youtube.push({ id, title: '', kind: '' });
    e.target.reset();
    renderYt();
    setDirty(true);
    $$('#site-yt [data-f="title"]').pop()?.focus();
  });

  // Fotos fixas
  view.addEventListener('change', async (e) => {
    const key = e.target.dataset.fixed;
    if (!key || !e.target.files[0]) return;
    const f = FIXED.find((x) => x.key === key);
    const card = e.target.closest('.site-img');
    busy(card, true);
    try {
      const file = e.target.files[0];
      const id = rand();
      const big = await resize(file, f.max);
      const url = await upload(`site/${key}-${id}.jpg`, big.blob, 'image/jpeg');
      const next = { ...(C.images[key] || {}), url };
      if (f.mobile) {
        const sm = await resize(file, f.mobile);
        next.mobile = await upload(`site/${key}-${id}-m.jpg`, sm.blob, 'image/jpeg');
      }
      C.images[key] = next;
      renderImages();
      setDirty(true);
      toast('Foto enviada. Salve para aplicar no site.');
    } catch (err) {
      console.error(err);
      toast('Não deu para enviar a foto.', 'err');
    } finally { busy(card, false); e.target.value = ''; }
  });

  // Capa de um vídeo próprio
  view.addEventListener('change', async (e) => {
    const i = e.target.dataset.poster;
    if (i == null || !e.target.files[0]) return;
    const row = e.target.closest('.site-row');
    busy(row, true);
    try {
      const { blob } = await resize(e.target.files[0], 900, 0.82);
      C.clips[+i].poster = await upload(`site/capa-${rand()}.jpg`, blob, 'image/jpeg');
      renderClips();
      setDirty(true);
    } catch (err) {
      console.error(err);
      toast('Não deu para enviar a capa.', 'err');
    } finally { busy(row, false); }
  });

  // Vídeo próprio novo
  $('#site-clip-file').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    e.target.value = '';
    if (!file) return;
    if (file.size > MAX_VIDEO) return toast('O vídeo passa de 50 MB. Comprima e tente de novo.', 'err');
    const label = e.target.closest('label');
    busy(label, true, 'Enviando vídeo…');
    try {
      const id = rand();
      let poster = '', tall = true;
      try {
        const p = await videoPoster(file);
        tall = p.tall;
        poster = await upload(`site/video-${id}.jpg`, p.blob, 'image/jpeg');
      } catch { /* sem capa: dá para enviar uma depois */ }
      const ext = (file.name.split('.').pop() || 'mp4').toLowerCase().replace(/[^a-z0-9]/g, '') || 'mp4';
      const video = await upload(`site/video-${id}.${ext}`, file, file.type || 'video/mp4');
      C.clips.push({ video, poster, title: file.name.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' '), tall });
      renderClips();
      setDirty(true);
      toast('Vídeo enviado. Confira a legenda e salve.');
    } catch (err) {
      console.error(err);
      toast('Não deu para enviar o vídeo.', 'err');
    } finally { busy(label, false); }
  });

  // Galeria: várias fotos de uma vez
  $('#site-gal-file').addEventListener('change', async (e) => {
    const files = [...e.target.files];
    e.target.value = '';
    if (!files.length) return;
    const label = e.target.closest('label');
    let ok = 0;
    for (const [n, file] of files.entries()) {
      busy(label, true, `Enviando ${n + 1} de ${files.length}…`);
      try {
        const id = rand();
        const web = await resize(file, 2000);
        const th = await resize(file, 900, 0.8);
        const [full, thumb] = await Promise.all([
          upload(`site/foto-${id}.jpg`, web.blob, 'image/jpeg'),
          upload(`site/foto-${id}-p.jpg`, th.blob, 'image/jpeg'),
        ]);
        C.gallery.push({ thumb, full, w: web.w, h: web.h, alt: '' });
        ok++;
        renderGallery();
      } catch (err) {
        console.error(err);
        toast(`Não deu para enviar ${file.name}.`, 'err');
      }
    }
    busy(label, false);
    if (ok) { setDirty(true); toast(`${ok} foto${ok > 1 ? 's' : ''} enviada${ok > 1 ? 's' : ''}. Salve para aplicar.`); }
  });

  $('#site-save').addEventListener('click', save);
}
