# Magioni · À la carte

Site do cantor Magioni com cardápio musical.

- **Site oficial** (`/`): apresentação, música, vídeos, fotos, shows e contato. Quando os pedidos estão abertos, mostra a faixa "AO VIVO" que leva ao cardápio.
- **Cardápio musical** (`/cardapio`): repertório por estilo, busca, pedido de música (com nome e dedicatória opcionais), recados para o artista, Pix, Instagram e Spotify.
- **Painel** (`/admin`): fila de pedidos (marcar tocada / recusar / apagar, abrir ou fechar pedidos, ranking das mais pedidas), cadastro do repertório (categorias e músicas, esconder sem apagar), recados e configurações (nome, frase, Instagram, Pix, Spotify, EP).

## Como funciona

Site estático (HTML + CSS + JS, sem build) hospedado na Vercel. Os dados ficam no Supabase, com segurança por RLS:

| Tabela | Visitante | Admin |
| --- | --- | --- |
| `magioni_settings`, `magioni_categories`, `magioni_songs` | lê (só músicas ativas) | lê e edita |
| `magioni_requests` | só envia (com pedidos abertos e música ativa) | lê, muda status, apaga |
| `magioni_comments` | só envia | lê, marca como lido, apaga |
| `magioni_site` (contato, redes, fotos e vídeos do site oficial) | lê | edita (aba **Site** do painel) |

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

Depois do primeiro deploy, adicione a URL do site em Supabase → Authentication → URL Configuration → **Redirect URLs** (ex.: `https://magionioficial.com.br/admin` e `https://www.magionioficial.com.br/admin`) para o login por link de e-mail voltar pro painel.

## Arquivos

```
index.html          site oficial
cardapio.html       cardápio musical (pedidos)
admin.html          painel
assets/config.js    URL e chave pública do Supabase
assets/lib.js       cliente Supabase e utilitários
assets/public.js    lógica da página pública
assets/admin.js     lógica do painel
assets/admin-site.js painel → aba Site (contato, redes, fotos, vídeos, galeria)
assets/artista.js   site oficial (lê o conteúdo da tabela magioni_site)
assets/style.css    estilos
supabase/schema.sql tabelas e políticas
supabase/seed.sql   repertório inicial (cardápio impresso)
supabase/site.sql   tabela magioni_site com o conteúdo inicial do site
vercel.json         rotas limpas (/admin) e cabeçalhos
```
