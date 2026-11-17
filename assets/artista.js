/* Página do artista. Links, contato, fotos e vídeos vêm do painel (tabela magioni_site). */
const SB_URL = 'https://phjfzcfmjnwufjmmjnke.supabase.co';
const SB_KEY = 'sb_publishable_Diqn3xciul137uTioeaLMQ_WuM9jJxE';
const rest = (q) => fetch(`${SB_URL}/rest/v1/${q}`, { headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}` } })
  .then((r) => (r.ok ? r.json() : Promise.reject(r.status)));

const NAMES = {
  instagram: 'Instagram', spotify: 'Spotify', apple: 'Apple Music', youtube: 'YouTube',
  youtubeMusic: 'YouTube Music', tiktok: 'TikTok', facebook: 'Facebook',
};

/* Ícones das plataformas (Simple Icons, licença CC0) */
const ICONS = {
  youtubeMusic: 'M12 0C5.376 0 0 5.376 0 12s5.376 12 12 12 12-5.376 12-12S18.624 0 12 0zm0 19.104c-3.924 0-7.104-3.18-7.104-7.104S8.076 4.896 12 4.896s7.104 3.18 7.104 7.104-3.18 7.104-7.104 7.104zm0-13.332c-3.432 0-6.228 2.796-6.228 6.228S8.568 18.228 12 18.228s6.228-2.796 6.228-6.228S15.432 5.772 12 5.772zM9.684 15.54V8.46L15.816 12l-6.132 3.54z',
  instagram: 'M7.0301.084c-1.2768.0602-2.1487.264-2.911.5634-.7888.3075-1.4575.72-2.1228 1.3877-.6652.6677-1.075 1.3368-1.3802 2.127-.2954.7638-.4956 1.6365-.552 2.914-.0564 1.2775-.0689 1.6882-.0626 4.947.0062 3.2586.0206 3.6671.0825 4.9473.061 1.2765.264 2.1482.5635 2.9107.308.7889.72 1.4573 1.388 2.1228.6679.6655 1.3365 1.0743 2.1285 1.38.7632.295 1.6361.4961 2.9134.552 1.2773.056 1.6884.069 4.9462.0627 3.2578-.0062 3.668-.0207 4.9478-.0814 1.28-.0607 2.147-.2652 2.9098-.5633.7889-.3086 1.4578-.72 2.1228-1.3881.665-.6682 1.0745-1.3378 1.3795-2.1284.2957-.7632.4966-1.636.552-2.9124.056-1.2809.0692-1.6898.063-4.948-.0063-3.2583-.021-3.6668-.0817-4.9465-.0607-1.2797-.264-2.1487-.5633-2.9117-.3084-.7889-.72-1.4568-1.3876-2.1228C21.2982 1.33 20.628.9208 19.8378.6165 19.074.321 18.2017.1197 16.9244.0645 15.6471.0093 15.236-.005 11.977.0014 8.718.0076 8.31.0215 7.0301.0839m.1402 21.6932c-1.17-.0509-1.8053-.2453-2.2287-.408-.5606-.216-.96-.4771-1.3819-.895-.422-.4178-.6811-.8186-.9-1.378-.1644-.4234-.3624-1.058-.4171-2.228-.0595-1.2645-.072-1.6442-.079-4.848-.007-3.2037.0053-3.583.0607-4.848.05-1.169.2456-1.805.408-2.2282.216-.5613.4762-.96.895-1.3816.4188-.4217.8184-.6814 1.3783-.9003.423-.1651 1.0575-.3614 2.227-.4171 1.2655-.06 1.6447-.072 4.848-.079 3.2033-.007 3.5835.005 4.8495.0608 1.169.0508 1.8053.2445 2.228.408.5608.216.96.4754 1.3816.895.4217.4194.6816.8176.9005 1.3787.1653.4217.3617 1.056.4169 2.2263.0602 1.2655.0739 1.645.0796 4.848.0058 3.203-.0055 3.5834-.061 4.848-.051 1.17-.245 1.8055-.408 2.2294-.216.5604-.4763.96-.8954 1.3814-.419.4215-.8181.6811-1.3783.9-.4224.1649-1.0577.3617-2.2262.4174-1.2656.0595-1.6448.072-4.8493.079-3.2045.007-3.5825-.006-4.848-.0608M16.953 5.5864A1.44 1.44 0 1 0 18.39 4.144a1.44 1.44 0 0 0-1.437 1.4424M5.8385 12.012c.0067 3.4032 2.7706 6.1557 6.173 6.1493 3.4026-.0065 6.157-2.7701 6.1506-6.1733-.0065-3.4032-2.771-6.1565-6.174-6.1498-3.403.0067-6.156 2.771-6.1496 6.1738M8 12.0077a4 4 0 1 1 4.008 3.9921A3.9996 3.9996 0 0 1 8 12.0077',
  spotify: 'M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z',
  apple: 'M23.994 6.124a9.23 9.23 0 00-.24-2.19c-.317-1.31-1.062-2.31-2.18-3.043a5.022 5.022 0 00-1.877-.726 10.496 10.496 0 00-1.564-.15c-.04-.003-.083-.01-.124-.013H5.986c-.152.01-.303.017-.455.026-.747.043-1.49.123-2.193.4-1.336.53-2.3 1.452-2.865 2.78-.192.448-.292.925-.363 1.408-.056.392-.088.785-.1 1.18 0 .032-.007.062-.01.093v12.223c.01.14.017.283.027.424.05.815.154 1.624.497 2.373.65 1.42 1.738 2.353 3.234 2.801.42.127.856.187 1.293.228.555.053 1.11.06 1.667.06h11.03a12.5 12.5 0 001.57-.1c.822-.106 1.596-.35 2.295-.81a5.046 5.046 0 001.88-2.207c.186-.42.293-.87.37-1.324.113-.675.138-1.358.137-2.04-.002-3.8 0-7.595-.003-11.393zm-6.423 3.99v5.712c0 .417-.058.827-.244 1.206-.29.59-.76.962-1.388 1.14-.35.1-.706.157-1.07.173-.95.045-1.773-.6-1.943-1.536a1.88 1.88 0 011.038-2.022c.323-.16.67-.25 1.018-.324.378-.082.758-.153 1.134-.24.274-.063.457-.23.51-.516a.904.904 0 00.02-.193c0-1.815 0-3.63-.002-5.443a.725.725 0 00-.026-.185c-.04-.15-.15-.243-.304-.234-.16.01-.318.035-.475.066-.76.15-1.52.303-2.28.456l-2.325.47-1.374.278c-.016.003-.032.01-.048.013-.277.077-.377.203-.39.49-.002.042 0 .086 0 .13-.002 2.602 0 5.204-.003 7.805 0 .42-.047.836-.215 1.227-.278.64-.77 1.04-1.434 1.233-.35.1-.71.16-1.075.172-.96.036-1.755-.6-1.92-1.544-.14-.812.23-1.685 1.154-2.075.357-.15.73-.232 1.108-.31.287-.06.575-.116.86-.177.383-.083.583-.323.6-.714v-.15c0-2.96 0-5.922.002-8.882 0-.123.013-.25.042-.37.07-.285.273-.448.546-.518.255-.066.515-.112.774-.165.733-.15 1.466-.296 2.2-.444l2.27-.46c.67-.134 1.34-.27 2.01-.403.22-.043.442-.088.663-.106.31-.025.523.17.554.482.008.073.012.148.012.223.002 1.91.002 3.822 0 5.732z',
  youtube: 'M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z',
  tiktok: 'M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z',
  facebook: 'M9.101 23.691v-7.98H6.627v-3.667h2.474v-1.58c0-4.085 1.848-5.978 5.858-5.978.401 0 .955.042 1.468.103a8.68 8.68 0 0 1 1.141.195v3.325a8.623 8.623 0 0 0-.653-.036 26.805 26.805 0 0 0-.733-.009c-.707 0-1.259.096-1.675.309a1.686 1.686 0 0 0-.679.622c-.258.42-.374.995-.374 1.752v1.297h3.919l-.386 2.103-.287 1.564h-3.246v8.245C19.396 23.238 24 18.179 24 12.044c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.628 3.874 10.35 9.101 11.647Z',
};

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const ext = (href, label, cls = '') =>
  `<a class="${cls}" href="${esc(href)}" target="_blank" rel="noopener">${esc(label)}</a>`;
const digits = (s) => String(s || '').replace(/\D/g, '');
const phone = (n) => {
  const d = digits(n).replace(/^55(?=\d{10,11}$)/, '');
  return d.length === 11 ? `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}` : d.length === 10 ? `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}` : n;
};

/* Cada parte roda isolada: se uma falhar, o resto da página continua funcionando. */
const safe = (fn) => { try { fn(); } catch (err) { console.error(err); } };

/* Esconde uma seção inteira (e o item do menu) quando ela fica vazia */
const toggleSection = (id, on) => {
  const sec = document.getElementById(id);
  if (sec) sec.hidden = !on;
  $$(`.nav a[href="#${id}"]`).forEach((a) => { a.hidden = !on; });
};

function render(C) {
  const links = C.links || {};
  const contact = C.contact || {};
  const images = C.images || {};

  /* Fotos fixas (abertura, retrato, capa, palco) */
  safe(() => {
    $$('[data-img]').forEach((img) => {
      const v = images[img.dataset.img];
      if (!v || !v.url) return;
      if (img.getAttribute('src') !== v.url) img.src = v.url;
      if (v.alt) img.alt = v.alt;
      const pic = img.closest('picture');
      const src = pic && pic.querySelector('source');
      if (src) { if (v.mobile) src.srcset = v.mobile; else src.remove(); }
    });
  });

  /* Redes */
  safe(() => {
    $$('[data-socials]').forEach((box) => {
      box.innerHTML = box.dataset.socials.split(',')
        .filter((k) => links[k])
        .map((k) => ICONS[k]
          ? `<a class="social-ico" href="${esc(links[k])}" target="_blank" rel="noopener" aria-label="${esc(NAMES[k])}" title="${esc(NAMES[k])}"><svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="${ICONS[k]}"/></svg></a>`
          : ext(links[k], NAMES[k], 'chip'))
        .join('');
    });
    $$('[data-more="youtube"]').forEach((p) => {
      p.innerHTML = links.youtube ? ext(links.youtube, 'Ver todos os vídeos no YouTube', 'btn btn-ghost') : '';
    });
  });

  /* Contato */
  safe(() => {
    const text = contact.whatsappText ? `?text=${encodeURIComponent(contact.whatsappText)}` : '';
    const subject = contact.emailSubject ? `?subject=${encodeURIComponent(contact.emailSubject)}` : '';
    const was = (contact.whatsapp || []).filter((w) => digits(w.number));
    const emails = String(contact.email || '').split(/[\s,;]+/).filter(Boolean);
    $('#contact-grid').innerHTML =
      was.map((w) => `
        <a class="contact-card wa" href="https://wa.me/${digits(w.number)}${text}" target="_blank" rel="noopener">
          <span class="cc-kind">WhatsApp</span><span class="cc-val">${esc(w.label || phone(w.number))}</span>
        </a>`).join('') +
      emails.map((e) => `
        <a class="contact-card" href="mailto:${esc(e)}${subject}">
          <span class="cc-kind">E-mail</span><span class="cc-val small">${esc(e)}</span>
        </a>`).join('');
    const wa1 = was[0];
    $$('[data-wa]').forEach((a) => { if (wa1) a.href = `https://wa.me/${digits(wa1.number)}${text}`; });
  });

  /* Spotify: só carrega o player quando a seção chega perto da tela */
  safe(() => {
    const box = $('#spotify-player');
    if (!box) return;
    const embed = spotifyEmbed(links.spotifyEmbed);
    if (!embed || !('IntersectionObserver' in window)) { box.hidden = true; return; }
    const io = new IntersectionObserver((es) => {
      if (!es.some((e) => e.isIntersecting)) return;
      io.disconnect();
      box.innerHTML = `<iframe title="Player do Spotify" src="${esc(embed)}?utm_source=generator&theme=0" loading="lazy" allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"></iframe>`;
    }, { rootMargin: '600px' });
    io.observe(box.closest('section'));
  });

  /* Vídeos: YouTube + clipes próprios */
  safe(() => {
    const yt = (C.youtube || []).filter((v) => v.id);
    const clips = (C.clips || []).filter((c) => c.video);
    const [first, ...others] = yt;
    $('#yt-feature').innerHTML = first ? ytCard(first) : '';
    $('#yt-grid').innerHTML = others.map(ytCard).join('');
    $('#clips').innerHTML = clips.map((c) => `
      <figure class="clip ${c.tall ? 'tall' : 'wide'}">
        <video controls playsinline preload="none"${c.poster ? ` poster="${esc(c.poster)}"` : ''}>
          <source src="${esc(c.video)}" type="video/mp4" />
        </video>
        ${c.title ? `<figcaption>${esc(c.title)}</figcaption>` : ''}
      </figure>`).join('');
    const ct = $('#clips-title');
    if (ct) ct.hidden = !clips.length;
    toggleSection('videos', yt.length + clips.length > 0);
  });

  /* Galeria */
  safe(() => {
    gallery = (C.gallery || []).filter((g) => g.thumb || g.full);
    $('#gallery').innerHTML = gallery.map((g, i) => {
      const w = g.w || 3, h = g.h || 2;
      return `
      <button type="button" class="shot" data-i="${i}" aria-label="Ampliar foto${g.alt ? `: ${esc(g.alt)}` : ''}">
        <img src="${esc(g.thumb || g.full)}" alt="${esc(g.alt || '')}" loading="lazy" width="${Math.round(w * 100)}" height="${Math.round(h * 100)}" style="aspect-ratio:${w}/${h}" />
      </button>`;
    }).join('');
    toggleSection('fotos', gallery.length > 0);
  });
}

/* Aceita o link normal do Spotify (álbum, artista, faixa ou playlist) e devolve o do player */
function spotifyEmbed(url) {
  const m = String(url || '').match(/open\.spotify\.com\/(?:intl-[a-z-]+\/)?(?:embed\/)?(album|artist|track|playlist|episode|show)\/([A-Za-z0-9]+)/);
  return m ? `https://open.spotify.com/embed/${m[1]}/${m[2]}` : '';
}

/* YouTube: miniatura primeiro, o player só entra quando a pessoa toca */
function ytCard(v) {
  return `
    <figure class="yt">
      <button type="button" class="yt-btn" data-yt="${esc(v.id)}" aria-label="Assistir: ${esc(v.title || 'vídeo')}">
        <img src="https://i.ytimg.com/vi/${esc(v.id)}/hqdefault.jpg" alt="" loading="lazy" width="480" height="360" />
        <span class="play" aria-hidden="true"></span>
      </button>
      ${v.title || v.kind ? `<figcaption>${v.kind ? `<span class="kind">${esc(v.kind)}</span>` : ''}${esc(v.title || '')}</figcaption>` : ''}
    </figure>`;
}
document.addEventListener('click', (e) => {
  const b = e.target.closest('[data-yt]');
  if (!b) return;
  const f = document.createElement('iframe');
  f.src = `https://www.youtube-nocookie.com/embed/${encodeURIComponent(b.dataset.yt)}?autoplay=1&rel=0`;
  f.title = b.getAttribute('aria-label');
  f.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share';
  f.allowFullscreen = true;
  f.className = 'yt-frame';
  b.replaceWith(f);
});
// um vídeo de cada vez
document.addEventListener('play', (e) => {
  $$('video').forEach((v) => { if (v !== e.target) v.pause(); });
}, true);

/* Ampliação das fotos da galeria */
let gallery = [];
safe(() => {
  const lb = $('#lightbox'), img = $('#lb-img'), cap = $('#lb-cap');
  if (!lb) return;
  let cur = 0;
  const show = (i) => {
    const g = gallery;
    cur = (i + g.length) % g.length;
    const it = g[cur];
    img.src = it.thumb || it.full;                 // aparece na hora
    if (it.full && it.full !== it.thumb) {
      const big = new Image();
      big.onload = () => { if (gallery[cur] === it) img.src = big.src; };
      big.src = it.full;
    }
    img.alt = it.alt || '';
    cap.textContent = `${it.alt ? `${it.alt} · ` : ''}${cur + 1} de ${g.length}`;
  };
  $('#gallery').addEventListener('click', (e) => {
    const b = e.target.closest('.shot');
    if (!b) return;
    const it = gallery[+b.dataset.i];
    if (typeof lb.showModal !== 'function') { window.open(it.full || it.thumb, '_blank'); return; }
    show(+b.dataset.i);
    lb.showModal();
  });
  lb.addEventListener('click', (e) => {
    const act = e.target.dataset.lb;
    if (act === 'prev') show(cur - 1);
    else if (act === 'next') show(cur + 1);
    else if (act === 'close' || e.target === lb) lb.close();
  });
  lb.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft') show(cur - 1);
    if (e.key === 'ArrowRight') show(cur + 1);
  });
  let x0 = null;
  lb.addEventListener('touchstart', (e) => { x0 = e.touches[0].clientX; }, { passive: true });
  lb.addEventListener('touchend', (e) => {
    if (x0 === null) return;
    const dx = e.changedTouches[0].clientX - x0;
    if (Math.abs(dx) > 50) show(cur + (dx < 0 ? 1 : -1));
    x0 = null;
  });
});

/* Conteúdo do painel */
rest('magioni_site?id=eq.1&select=content')
  .then(([row]) => render((row && row.content) || {}))
  .catch((err) => console.error('Conteúdo do site indisponível', err));

/* Menu no celular e barra do topo */
safe(() => {
  const btn = $('#menu-btn'), nav = $('#nav'), top = $('#top');
  const set = (open) => {
    nav.classList.toggle('open', open);
    top.classList.toggle('menu-open', open);
    document.documentElement.classList.toggle('menu-open', open);
    btn.setAttribute('aria-expanded', String(open));
    btn.textContent = open ? 'Fechar' : 'Menu';
  };
  btn.addEventListener('click', () => set(!nav.classList.contains('open')));
  nav.addEventListener('click', (e) => { if (e.target.closest('a')) set(false); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') set(false); });
  const onScroll = () => top.classList.toggle('solid', window.scrollY > 40);
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();
});

/* Cardápio musical: os botões só aparecem quando o artista está recebendo pedidos */
safe(async () => {
  try {
    const [row] = await rest('magioni_settings?id=eq.1&select=requests_open,geo_label');
    const open = !!(row && row.requests_open);
    $$('[data-cardapio]').forEach((el) => { el.hidden = !open; });
    const bar = $('#live-bar');
    if (open && bar) {
      const venue = $('#live-venue'), label = (row.geo_label || '').trim();
      // 1ª linha: o lugar do show; 2ª linha: o convite para pedir música
      if (venue) venue.textContent = label || 'Show acontecendo agora';
      const wide = $('#live-wide');
      if (wide) wide.hidden = !label;
      // A faixa fica fixa acima do cabeçalho: guarda a altura dela para empurrar o cabeçalho para baixo
      const root = document.documentElement;
      const fit = () => root.style.setProperty('--bar-h', `${bar.offsetHeight}px`);
      root.classList.add('has-live-bar');
      fit();
      if ('ResizeObserver' in window) new ResizeObserver(fit).observe(bar);
      else window.addEventListener('resize', fit);
    }
  } catch { /* sem conexão: mantém escondido */ }
});

/* Botão fixo "voltar ao início": aparece depois da abertura */
safe(() => {
  const btn = $('#to-top');
  if (!btn) return;
  const update = () => btn.classList.toggle('show', window.scrollY > window.innerHeight * 0.8);
  window.addEventListener('scroll', update, { passive: true });
  update();
  btn.addEventListener('click', (e) => {
    e.preventDefault();
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    window.scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' });
    history.replaceState(null, '', location.pathname + location.search);
  });
});
