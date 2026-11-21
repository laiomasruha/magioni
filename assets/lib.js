import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';
import { SUPABASE_URL, SUPABASE_KEY } from './config.js';

export const sb = createClient(SUPABASE_URL, SUPABASE_KEY);

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

export function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

export function norm(s) {
  return String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

let toastTimer;
export function toast(msg, kind = 'ok') {
  let el = $('#toast');
  if (!el) {
    el = document.createElement('div');
    el.id = 'toast';
    el.setAttribute('role', 'status');
    document.body.appendChild(el);
  }
  el.textContent = msg;
  el.className = `toast show ${kind}`;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (el.className = 'toast'), 3200);
}

export function timeAgo(iso) {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return 'agora';
  const m = Math.floor(s / 60);
  if (m < 60) return `há ${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return m % 60 ? `há ${h} h ${m % 60} min` : `há ${h} h`;
  return new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}

/* Página aberta por horas (painel, cardápio no show): quando sai uma versão nova do site,
   recarrega sozinha para não ficar rodando o código antigo. Compara o ETag dos arquivos. */
export function autoUpdate(files, { every = 60_000 } = {}) {
  const tags = new Map();
  const etag = async (f) => {
    try {
      const r = await fetch(f, { method: 'HEAD', cache: 'no-store' });
      return r.ok ? r.headers.get('etag') || r.headers.get('last-modified') : null;
    } catch { return null; }
  };
  const busy = () => {
    const el = document.activeElement;
    return (el && /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName)) || document.querySelector('dialog[open]');
  };
  const check = async () => {
    if (document.hidden) return;
    for (const f of files) {
      const t = await etag(f);
      if (!t) continue;
      if (!tags.has(f)) { tags.set(f, t); continue; }
      if (tags.get(f) !== t) {
        if (busy() || window.__noAutoReload) return; // tenta de novo depois, sem atrapalhar quem está digitando
        location.reload();
        return;
      }
    }
  };
  check();
  setInterval(check, every);
  document.addEventListener('visibilitychange', check);
}
