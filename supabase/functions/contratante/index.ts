// Área do contratante: valida o código de acesso e devolve links temporários
// para os arquivos do kit (bucket privado magioni-kit).
import { createClient } from 'npm:@supabase/supabase-js@2';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });

const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
  auth: { persistSession: false },
});

const LINK_HOURS = 12;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ error: 'Método não permitido' }, 405);

  let body: { code?: string } = {};
  try { body = await req.json(); } catch { /* corpo vazio */ }

  const code = String(body.code ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (code.length < 6 || code.length > 16) {
    await sleep(600);
    return json({ error: 'Código inválido' }, 401);
  }

  const { data: row } = await sb
    .from('magioni_access_codes')
    .select('id, label, expires_at, revoked, uses')
    .eq('code', code)
    .maybeSingle();

  if (!row || row.revoked) {
    await sleep(600);
    return json({ error: 'Código inválido' }, 401);
  }
  if (row.expires_at && new Date(row.expires_at) < new Date()) {
    return json({ error: 'Este código expirou. Peça um novo pelo WhatsApp.' }, 401);
  }

  await sb.from('magioni_access_codes')
    .update({ uses: (row.uses ?? 0) + 1, last_used_at: new Date().toISOString() })
    .eq('id', row.id);

  const { data: items, error } = await sb
    .from('magioni_kit_items')
    .select('id, kind, title, description, path, position')
    .order('position').order('created_at');
  if (error) return json({ error: 'Erro ao carregar o material' }, 500);
  if (!items.length) return json({ label: row.label, expiresInHours: LINK_HOURS, items: [] });

  const paths = items.map((i) => i.path);
  const expires = LINK_HOURS * 3600;
  const [view, dl] = await Promise.all([
    sb.storage.from('magioni-kit').createSignedUrls(paths, expires),
    sb.storage.from('magioni-kit').createSignedUrls(paths, expires, { download: true }),
  ]);
  const viewMap = new Map((view.data ?? []).map((s) => [s.path, s.signedUrl]));
  const dlMap = new Map((dl.data ?? []).map((s) => [s.path, s.signedUrl]));

  return json({
    label: row.label,
    expiresInHours: LINK_HOURS,
    items: items
      .filter((i) => viewMap.get(i.path))
      .map((i) => ({
        id: i.id, kind: i.kind, title: i.title, description: i.description,
        name: i.path.split('/').pop(),
        url: viewMap.get(i.path), download: dlMap.get(i.path),
      })),
  });
});
