/* Página do artista (proposta). Tudo o que muda com frequência fica neste objeto. */
const SITE = {
  media: 'https://phjfzcfmjnwufjmmjnke.supabase.co/storage/v1/object/public/magioni-media/import/',

  links: {
    instagram: 'https://www.instagram.com/magionioficial',
    spotify: 'https://open.spotify.com/artist/4qW3FRAjHG6a1R5Bwau73k',
    spotifyEmbed: 'https://open.spotify.com/embed/artist/4qW3FRAjHG6a1R5Bwau73k',
    apple: 'https://music.apple.com/br/artist/magioni/1794790422',
    youtube: 'https://www.youtube.com/@magionioficial',
    youtubeMusic: 'https://www.youtube.com/channel/UChlfzCx1QFEykkUqtrwInwQ',
    tiktok: 'https://www.tiktok.com/@magionioficial',
    facebook: 'https://www.facebook.com/share/152CtP9spcY/',
    google: 'https://share.google/WpS2Hxrd9bsBmscdF',
  },

  contact: {
    whatsapp: [
      { label: '(27) 99977-3842', number: '5527999773842' },
      { label: '(27) 99225-3878', number: '5527992253878' },
    ],
    whatsappText: 'Olá! Vi o site do Mag!on! e quero um orçamento de show.',
    email: 'magyone027@gmail.com',
  },

  // IDs conferidos no canal youtube.com/@magionioficial
  youtube: [
    { id: '0P9En1rUbSc', title: 'Fantoche', kind: 'Videoclipe' },
    { id: 'MWW-WlKFw1M', title: 'Sacanagem', kind: 'Videoclipe' },
    { id: 'A8bYfU8i2Gw', title: 'Pé de Limão, com JVsaxx', kind: 'Videoclipe' },
    { id: 'IN-UhQ72rEM', title: 'Fantoche, com a Orquestra Camerata', kind: 'Ao vivo' },
    { id: 'KyaatnMKWC0', title: 'Pé de Limão, com JVsaxx', kind: 'Ao vivo' },
    { id: 'WG0QG41Kd6M', title: 'Fantoche, ensaio no 4Studio', kind: 'Ensaio' },
    { id: 'blnPCGnmdkw', title: 'Smells Like Teen Spirit', kind: 'Cover' },
    { id: 'bsII3sMrSr4', title: 'Entrevista com Mag!on!', kind: 'Entrevista' },
    { id: 'Jcj-JsIKT8Y', title: 'Mag!on! e Amaro Lima', kind: 'Entrevista' },
  ],

  // Vídeos curtos hospedados no próprio site
  clips: [
    { file: 'show-centro-vitoria', title: 'Show no Centro de Vitória', tall: true },
    { file: 'show-rita-lee', title: 'Rita Lee no Centro de Vitória', tall: true },
    { file: 'apresentacao-prefeitura', title: 'Apresentação ao ar livre', tall: true },
    { file: 'pedra-azul-drone', title: 'Pedra Azul Beer Festival, visto do drone', tall: false },
  ],

  gallery: [
    ['palco-03', 2, 3, 'Mag!on! ao violão sob luz azul-esverdeada'],
    ['palco-01', 3, 2, 'Mag!on! com o braço erguido diante da plateia'],
    ['retrato', 1, 1, 'Retrato em close do Mag!on!'],
    ['estudio-01', 2, 3, 'Mag!on! sentado com o violão, em estúdio'],
    ['palco-08', 3, 2, 'Mag!on! de braços abertos no palco'],
    ['palco-05', 2, 3, 'Mag!on! cantando ao microfone com o violão'],
    ['roxo-01', 4, 5, 'Mag!on! em cenário roxo, durante entrevista'],
    ['palco-pb-b', 1408, 1872, 'Mag!on! no palco, em preto e branco'],
    ['palco-festival', 1489, 993, 'Banda completa em palco de festival'],
    ['palco-06', 2, 3, 'Mag!on! tocando violão sob luzes quentes'],
    ['estudio-03', 2, 3, 'Mag!on! tocando violão em estúdio'],
    ['roxo-03', 2, 3, 'Mag!on! de camiseta branca em fundo roxo'],
    ['publico-01', 3, 2, 'Plateia dançando durante o show'],
    ['palco-09', 2, 3, 'Mag!on! em palco com iluminação azul'],
    ['palco-04', 2, 3, 'Mag!on! sorrindo ao violão no palco'],
    ['telao-01b', 2, 3, 'Ilustração do Mag!on! em estilo de cartaz'],
  ],

  press: [
    ['magioni-palco-02', 'thumb/palco-02.jpg', 'Palco, horizontal'],
    ['magioni-palco-01', 'thumb/palco-01.jpg', 'Palco e plateia'],
    ['magioni-palco-03', 'thumb/palco-08.jpg', 'Palco, braços abertos'],
    ['magioni-palco-04', 'thumb/palco-04.jpg', 'Palco, vertical'],
    ['magioni-retrato', 'thumb/retrato.jpg', 'Retrato'],
    ['magioni-estudio-01', 'thumb/estudio-01.jpg', 'Estúdio, sentado'],
    ['magioni-estudio-02', 'thumb/estudio-02.jpg', 'Estúdio, em pé'],
    ['magioni-roxo-01', 'thumb/roxo-01.jpg', 'Entrevista'],
  ],
};

const NAMES = {
  instagram: 'Instagram', spotify: 'Spotify', apple: 'Apple Music', youtube: 'YouTube',
  youtubeMusic: 'YouTube Music', tiktok: 'TikTok', facebook: 'Facebook',
};

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const m = (p) => SITE.media + p;
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const ext = (href, label, cls = '') =>
  `<a class="${cls}" href="${esc(href)}" target="_blank" rel="noopener">${esc(label)}</a>`;

/* Cada parte roda isolada: se uma falhar, o resto da página continua funcionando. */
const safe = (fn) => { try { fn(); } catch (err) { console.error(err); } };

/* Imagens fixas do HTML */
$$('img[data-src]').forEach((el) => { const u = m(el.dataset.src); if (el.getAttribute('src') !== u) el.src = u; });
$$('[data-srcset]').forEach((el) => { const u = m(el.dataset.srcset); if (el.getAttribute('srcset') !== u) el.srcset = u; });

/* Downloads (o parâmetro ?download força o navegador a salvar o arquivo) */
$$('[data-file]').forEach((a) => {
  a.href = m(a.dataset.file) + '?download=' + encodeURIComponent(a.dataset.name || '');
});

/* Redes */
$$('[data-socials]').forEach((box) => {
  box.innerHTML = box.dataset.socials.split(',')
    .filter((k) => SITE.links[k])
    .map((k) => ext(SITE.links[k], NAMES[k], 'chip'))
    .join('');
});
$$('[data-listen]').forEach((box) => {
  const L = SITE.links;
  box.innerHTML = [
    L.spotify && ext(L.spotify, 'Ouvir no Spotify', 'btn btn-amber'),
    L.apple && ext(L.apple, 'Apple Music', 'btn btn-ghost'),
    L.youtubeMusic && ext(L.youtubeMusic, 'YouTube Music', 'btn btn-ghost'),
  ].filter(Boolean).join('');
});
$$('[data-more="youtube"]').forEach((p) => {
  if (SITE.links.youtube) p.innerHTML = ext(SITE.links.youtube, 'Ver todos os vídeos no YouTube', 'btn btn-ghost');
});

/* Contato */
safe(() => {
  const c = SITE.contact;
  const text = encodeURIComponent(c.whatsappText);
  $('#contact-grid').innerHTML =
    c.whatsapp.map((w) => `
      <a class="contact-card wa" href="https://wa.me/${w.number}?text=${text}" target="_blank" rel="noopener">
        <span class="cc-kind">WhatsApp</span><span class="cc-val">${esc(w.label)}</span>
      </a>`).join('') + `
      <a class="contact-card" href="mailto:${esc(c.email)}?subject=${encodeURIComponent('Contratação de show')}">
        <span class="cc-kind">E-mail</span><span class="cc-val small">${esc(c.email)}</span>
      </a>
      <a class="contact-card" href="${esc(SITE.links.instagram)}" target="_blank" rel="noopener">
        <span class="cc-kind">Instagram</span><span class="cc-val small">@magionioficial</span>
      </a>`;
});

/* Spotify: só carrega o player quando a seção chega perto da tela */
safe(() => {
  const box = $('#spotify-player');
  if (SITE.links.spotifyEmbed && 'IntersectionObserver' in window) {
    const io = new IntersectionObserver((es) => {
      if (!es.some((e) => e.isIntersecting)) return;
      io.disconnect();
      box.innerHTML = `<iframe title="Mag!on! no Spotify" src="${esc(SITE.links.spotifyEmbed)}?utm_source=generator&theme=0" loading="lazy" allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"></iframe>`;
    }, { rootMargin: '600px' });
    io.observe(box.closest('section'));
  } else box.remove();
});

/* YouTube: miniatura primeiro, o player só entra quando a pessoa toca */
function ytCard(v) {
  return `
    <figure class="yt">
      <button type="button" class="yt-btn" data-yt="${esc(v.id)}" aria-label="Assistir: ${esc(v.title)}">
        <img src="https://i.ytimg.com/vi/${esc(v.id)}/hqdefault.jpg" alt="" loading="lazy" width="480" height="360" />
        <span class="play" aria-hidden="true"></span>
      </button>
      <figcaption><span class="kind">${esc(v.kind)}</span>${esc(v.title)}</figcaption>
    </figure>`;
}
safe(() => {
  const [first, ...rest] = SITE.youtube;
  $('#yt-feature').innerHTML = first ? ytCard(first) : '';
  $('#yt-grid').innerHTML = rest.map(ytCard).join('');
  document.addEventListener('click', (e) => {
    const b = e.target.closest('[data-yt]');
    if (!b) return;
    const f = document.createElement('iframe');
    f.src = `https://www.youtube-nocookie.com/embed/${b.dataset.yt}?autoplay=1&rel=0`;
    f.title = b.getAttribute('aria-label');
    f.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share';
    f.allowFullscreen = true;
    f.className = 'yt-frame';
    b.replaceWith(f);
  });
});

/* Clipes próprios */
safe(() => { $('#clips').innerHTML = SITE.clips.map((c) => `
  <figure class="clip ${c.tall ? 'tall' : 'wide'}">
    <video controls playsinline preload="none" poster="${m('thumb/v-' + c.file + '.jpg')}">
      <source src="${m('video/' + c.file + '.mp4')}" type="video/mp4" />
    </video>
    <figcaption>${esc(c.title)}</figcaption>
  </figure>`).join(''); });
// um vídeo de cada vez
document.addEventListener('play', (e) => {
  $$('video').forEach((v) => { if (v !== e.target) v.pause(); });
}, true);

/* Galeria + ampliação */
safe(() => {
  const g = SITE.gallery;
  $('#gallery').innerHTML = g.map(([n, w, h, alt], i) => `
    <button type="button" class="shot" data-i="${i}" aria-label="Ampliar foto: ${esc(alt)}">
      <img src="${m('thumb/' + n + '.jpg')}" alt="${esc(alt)}" loading="lazy" width="${w * 100}" height="${h * 100}" style="aspect-ratio:${w}/${h}" />
    </button>`).join('');

  const lb = $('#lightbox'), img = $('#lb-img'), cap = $('#lb-cap');
  let cur = 0;
  const show = (i) => {
    cur = (i + g.length) % g.length;
    const [n, , , alt] = g[cur];
    img.src = m('thumb/' + n + '.jpg');           // aparece na hora
    const big = new Image();
    big.onload = () => { if (g[cur][0] === n) img.src = big.src; };
    big.src = m('web/' + n + '.jpg');
    img.alt = alt;
    cap.textContent = `${alt} · ${cur + 1} de ${g.length}`;
  };
  $('#gallery').addEventListener('click', (e) => {
    const b = e.target.closest('.shot');
    if (!b) return;
    if (typeof lb.showModal !== 'function') { window.open(m('web/' + g[+b.dataset.i][0] + '.jpg'), '_blank'); return; }
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

/* Fotos de imprensa */
safe(() => { $('#press').innerHTML = SITE.press.map(([file, thumb, label]) => `
  <a class="press-item" href="${m('press/' + file + '.jpg')}?download=${encodeURIComponent('Magioni-' + file.replace('magioni-', '') + '.jpg')}">
    <img src="${m(thumb)}" alt="" loading="lazy" />
    <span>${esc(label)}</span>
  </a>`).join(''); });

/* Menu no celular e barra do topo */
safe(() => {
  const btn = $('#menu-btn'), nav = $('#nav'), top = $('#top');
  const set = (open) => {
    nav.classList.toggle('open', open);
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
