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

Só existem contas para os e-mails da tabela `magioni_admins` (hoje: laiomasruha@gmail.com e cantormagioni@gmail.com). Um gatilho no banco recusa a criação de conta para qualquer outro e-mail, e o painel não tem tela de cadastro.

- **Primeiro acesso / esqueceu a senha:** em `/admin`, digite o e-mail e toque em "Enviar link por e-mail".
- **Definir senha:** depois de entrar, em Configurações → "Definir senha".

Para liberar outro e-mail:

```sql
insert into public.magioni_admins (email) values ('email@exemplo.com');
```

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
