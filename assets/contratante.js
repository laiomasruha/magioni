/* Área do contratante: entra com o código e mostra o material liberado. */
(() => {
  const FN = 'https://phjfzcfmjnwufjmmjnke.supabase.co/functions/v1/contratante';
  let WHATSAPP = '5527999773842'; // trocado pelo número do painel (Site → Contato) assim que carrega
  const KEY = 'mg_contratante_code';

  const $ = (s) => document.querySelector(s);
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const wa = (text) => `https://wa.me/${WHATSAPP}?text=${encodeURIComponent(text)}`;
  const store = {
    get: () => { try { return sessionStorage.getItem(KEY); } catch { return null; } },
    set: (v) => { try { v ? sessionStorage.setItem(KEY, v) : sessionStorage.removeItem(KEY); } catch { /* ignore */ } },
  };

  const setWa = () => {
    $('#ask').href = wa('Olá! Sou contratante e gostaria do código de acesso ao material do Mag!on!.');
    $('#wa').href = wa('Olá! Vi o material do Mag!on! e quero conversar sobre uma data de show.');
  };
  setWa();
  const KEY_ = 'sb_publishable_Diqn3xciul137uTioeaLMQ_WuM9jJxE';
  fetch(FN.replace('/functions/v1/contratante', '/rest/v1/magioni_site?id=eq.1&select=content'), { headers: { apikey: KEY_, Authorization: `Bearer ${KEY_}` } })
    .then((r) => r.json())
    .then(([row]) => {
      const n = String(row?.content?.contact?.whatsapp?.[0]?.number || '').replace(/\D/g, '');
      if (n) { WHATSAPP = n; setWa(); }
    })
    .catch(() => { /* mantém o número padrão */ });

  const kindLabel = (name) => {
    const ext = (name.split('.').pop() || '').toUpperCase();
    return ext === 'JPEG' ? 'JPG' : ext;
  };

  function render(data) {
    const items = data.items || [];
    const by = (k) => items.filter((i) => i.kind === k);
    $('#kit-for').textContent = data.label ? `Preparado para ${data.label}.` : 'Tudo o que a produção e a imprensa precisam, em um lugar só.';
    $('#hours').textContent = data.expiresInHours || 12;

    const fileCards = (list) => list.map((i) => `
      <a class="kit-item" href="${esc(i.download)}">
        <span class="kit-name">${esc(i.title)}</span>
        <span class="kit-meta">${esc(i.description || kindLabel(i.name))} · ${kindLabel(i.name)}</span>
      </a>`).join('');

    const presskit = by('presskit');
    $('#list-presskit').innerHTML = fileCards(presskit);
    $('#sec-presskit').classList.toggle('hidden', !presskit.length);

    const rider = by('rider');
    $('#sec-rider').classList.toggle('hidden', !rider.length);
    if (rider.length) {
      const r = rider[0];
      $('#rider-actions').innerHTML = rider.map((x) =>
        `<a class="btn btn-ink" href="${esc(x.download)}">Baixar ${esc(x.title.toLowerCase())} (${kindLabel(x.name)})</a>`).join('');
      const isImg = /\.(jpe?g|png|webp)$/i.test(r.name);
      $('#rider-img').classList.toggle('hidden', !isImg);
      if (isImg) { $('#rider-img').href = r.url; $('#rider-img').innerHTML = `<img src="${esc(r.url)}" alt="Rider técnico do Mag!on!: mapa de palco e equipamentos" loading="lazy" />`; }
    }

    const fotos = by('foto');
    $('#sec-foto').classList.toggle('hidden', !fotos.length);
    $('#list-foto').innerHTML = fotos.map((i) => `
      <figure class="ct-photo">
        <a class="thumb" href="${esc(i.url)}" target="_blank" rel="noopener"><img src="${esc(i.url)}" alt="${esc(i.title)}" loading="lazy" /></a>
        <figcaption class="row"><span>${esc(i.title)}</span><a class="ct-dl" href="${esc(i.download)}">Baixar</a></figcaption>
      </figure>`).join('');

    const logos = by('logo');
    $('#sec-logo').classList.toggle('hidden', !logos.length);
    $('#list-logo').innerHTML = logos.map((i) => `
      <figure class="ct-logo">
        <div class="swatch"><img src="${esc(i.url)}" alt="${esc(i.title)}" loading="lazy" /></div>
        <figcaption class="row"><span>${esc(i.title)}${i.description ? `<small>${esc(i.description)}</small>` : ''}</span><a class="ct-dl" href="${esc(i.download)}">Baixar</a></figcaption>
      </figure>`).join('');

    const outros = by('outro');
    $('#list-outro').innerHTML = fileCards(outros);
    $('#sec-outro').classList.toggle('hidden', !outros.length);

    $('#gate').classList.add('hidden');
    $('#kit').classList.remove('hidden');
    $('#exit').classList.remove('hidden');
    window.scrollTo(0, 0);
  }

  async function enter(code, quiet) {
    const btn = $('#code-btn');
    btn.disabled = true; btn.textContent = 'Verificando…';
    $('#msg').textContent = '';
    try {
      const r = await fetch(FN, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ code }) });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) {
        store.set(null);
        if (!quiet) $('#msg').textContent = data.error || 'Não foi possível verificar o código.';
        return;
      }
      store.set(code);
      render(data);
    } catch {
      if (!quiet) $('#msg').textContent = 'Sem conexão. Tente de novo.';
    } finally {
      btn.disabled = false; btn.textContent = 'Entrar';
    }
  }

  $('#code-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const code = $('#code').value.trim();
    if (code) enter(code, false);
  });

  $('#exit').addEventListener('click', () => {
    store.set(null);
    $('#kit').classList.add('hidden');
    $('#exit').classList.add('hidden');
    $('#gate').classList.remove('hidden');
    $('#code').value = '';
    history.replaceState(null, '', location.pathname);
  });

  // Link com o código (?codigo=XXXX) ou código salvo nesta aba
  const fromUrl = new URLSearchParams(location.search).get('codigo');
  const start = fromUrl || store.get();
  if (start) { $('#code').value = start.toUpperCase(); enter(start, !fromUrl); }
  if (fromUrl) history.replaceState(null, '', location.pathname);
})();
