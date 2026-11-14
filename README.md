# Magioni · À la carte

Site do cantor Magioni com cardápio musical.

- **Página pública** (`/`): repertório por estilo, busca, pedido de música (com nome e dedicatória opcionais), recados para o artista, Pix, Instagram e Spotify.
- **Painel** (`/admin`): fila de pedidos (marcar tocada / recusar / apagar, abrir ou fechar pedidos, ranking das mais pedidas), cadastro do repertório (categorias e músicas, esconder sem apagar), recados e configurações (nome, frase, Instagram, Pix, Spotify, EP).

## Como funciona

Site estático (HTML + CSS + JS, sem build) hospedado na Vercel. Os dados ficam no Supabase, com segurança por RLS:

| Tabela | Visitante | Admin |
| --- | --- | --- |
| `magioni_settings`, `magioni_categories`, `magioni_songs` | lê (só músicas ativas) | lê e edita |
| `magioni_requests` | só envia (com pedidos abertos e música ativa) | lê, muda status, apaga |
| `magioni_comments` | só envia | lê, marca como lido, apaga |

Quem pode entrar no painel é definido pela tabela `magioni_admins` (por e-mail). Para adicionar alguém:

```sql
insert into public.magioni_admins (email) values ('email@exemplo.com');
```

A pessoa precisa ter uma conta no Supabase Auth desse projeto (e-mail + senha, ou entrar pelo link enviado por e-mail).

## Deploy na Vercel

1. Em vercel.com → **Add New… → Project** → importe `laiomasruha/magioni`.
2. Framework Preset: **Other**. Sem comando de build, diretório de saída padrão (raiz).
3. Deploy. Cada push na `main` publica de novo automaticamente.

Depois do primeiro deploy, adicione a URL do site em Supabase → Authentication → URL Configuration → **Redirect URLs** (ex.: `https://magioni.vercel.app/admin`) para o login por link de e-mail voltar pro painel.

## Arquivos

```
index.html          página pública
admin.html          painel
assets/config.js    URL e chave pública do Supabase
assets/lib.js       cliente Supabase e utilitários
assets/public.js    lógica da página pública
assets/admin.js     lógica do painel
assets/style.css    estilos
supabase/schema.sql tabelas e políticas
supabase/seed.sql   repertório inicial (cardápio impresso)
vercel.json         rotas limpas (/admin) e cabeçalhos
```
