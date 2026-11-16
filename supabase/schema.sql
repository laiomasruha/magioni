-- Esquema do site Magioni (já aplicado no projeto Supabase "Magioni").
-- Para recriar em outro projeto: rode este arquivo, depois seed.sql, depois
--   insert into public.magioni_admins(email) values ('seu-email@exemplo.com');

create table public.magioni_admins (
  email text primary key check (email = lower(email)),
  created_at timestamptz not null default now()
);

create or replace function public.magioni_is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.magioni_admins a where a.email = lower(coalesce(auth.jwt() ->> 'email', '')));
$$;

create table public.magioni_settings (
  id int primary key default 1 check (id = 1),
  artist_name text not null default 'Magioni',
  tagline text not null default 'Cardápio musical · Escolha o seu clima',
  instagram text default 'magionioficial',
  pix_key text,
  spotify_url text,
  ep_name text,
  requests_open boolean not null default true,
  updated_at timestamptz not null default now()
);

create table public.magioni_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 80),
  position int not null default 0,
  created_at timestamptz not null default now()
);

create table public.magioni_songs (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references public.magioni_categories(id) on delete cascade,
  artist text not null check (char_length(artist) between 1 and 120),
  title text not null check (char_length(title) between 1 and 160),
  position int not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create index on public.magioni_songs (category_id);

create table public.magioni_requests (
  id uuid primary key default gen_random_uuid(),
  song_id uuid references public.magioni_songs(id) on delete set null,
  song_label text not null check (char_length(song_label) between 1 and 300),
  requester_name text check (requester_name is null or char_length(requester_name) <= 80),
  note text check (note is null or char_length(note) <= 500),
  status text not null default 'pendente' check (status in ('pendente','tocada','recusada')),
  created_at timestamptz not null default now()
);
create index on public.magioni_requests (created_at desc);
create index on public.magioni_requests (song_id);

create table public.magioni_comments (
  id uuid primary key default gen_random_uuid(),
  name text check (name is null or char_length(name) <= 80),
  message text not null check (char_length(message) between 1 and 1000),
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);
create index on public.magioni_comments (created_at desc);

alter table public.magioni_admins enable row level security;
alter table public.magioni_settings enable row level security;
alter table public.magioni_categories enable row level security;
alter table public.magioni_songs enable row level security;
alter table public.magioni_requests enable row level security;
alter table public.magioni_comments enable row level security;

create policy "magioni admins read self" on public.magioni_admins for select to authenticated
  using (email = lower(coalesce((select auth.jwt() ->> 'email'), '')));

create policy "magioni settings public read" on public.magioni_settings for select to anon, authenticated using (true);
create policy "magioni settings admin update" on public.magioni_settings for update to authenticated
  using ((select public.magioni_is_admin())) with check ((select public.magioni_is_admin()));

create policy "magioni categories public read" on public.magioni_categories for select to anon, authenticated using (true);
create policy "magioni categories admin write" on public.magioni_categories for all to authenticated
  using ((select public.magioni_is_admin())) with check ((select public.magioni_is_admin()));

create policy "magioni songs public read" on public.magioni_songs for select to anon, authenticated
  using (active or (select public.magioni_is_admin()));
create policy "magioni songs admin insert" on public.magioni_songs for insert to authenticated with check ((select public.magioni_is_admin()));
create policy "magioni songs admin update" on public.magioni_songs for update to authenticated
  using ((select public.magioni_is_admin())) with check ((select public.magioni_is_admin()));
create policy "magioni songs admin delete" on public.magioni_songs for delete to authenticated using ((select public.magioni_is_admin()));

-- Pedidos: qualquer visitante envia (só pendente, só com pedidos abertos, só música ativa); admin lê e gerencia
create policy "magioni requests public insert" on public.magioni_requests for insert to anon, authenticated
  with check (
    status = 'pendente'
    and (select requests_open from public.magioni_settings where id = 1)
    and song_id is not null
    and exists (select 1 from public.magioni_songs s where s.id = song_id and s.active)
  );
create policy "magioni requests admin read" on public.magioni_requests for select to authenticated using ((select public.magioni_is_admin()));
create policy "magioni requests admin update" on public.magioni_requests for update to authenticated
  using ((select public.magioni_is_admin())) with check ((select public.magioni_is_admin()));
create policy "magioni requests admin delete" on public.magioni_requests for delete to authenticated using ((select public.magioni_is_admin()));

-- Recados
create policy "magioni comments public insert" on public.magioni_comments for insert to anon, authenticated
  with check (is_read = false);
create policy "magioni comments admin read" on public.magioni_comments for select to authenticated using ((select public.magioni_is_admin()));
create policy "magioni comments admin update" on public.magioni_comments for update to authenticated
  using ((select public.magioni_is_admin())) with check ((select public.magioni_is_admin()));
create policy "magioni comments admin delete" on public.magioni_comments for delete to authenticated using ((select public.magioni_is_admin()));

grant select on public.magioni_settings, public.magioni_categories, public.magioni_songs to anon, authenticated;
grant insert on public.magioni_requests, public.magioni_comments to anon, authenticated;
grant select, update, delete on public.magioni_requests, public.magioni_comments to authenticated;
grant insert, update, delete on public.magioni_categories, public.magioni_songs to authenticated;
grant update on public.magioni_settings to authenticated;
grant select on public.magioni_admins to authenticated;
grant execute on function public.magioni_is_admin() to anon, authenticated;

-- Só e-mails da lista magioni_admins podem ter conta no projeto
create or replace function public.magioni_block_unlisted_users()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.email is null or not exists (select 1 from public.magioni_admins a where a.email = lower(new.email)) then
    raise exception 'Cadastro não permitido para este e-mail';
  end if;
  return new;
end;
$$;
revoke execute on function public.magioni_block_unlisted_users() from public, anon, authenticated;

create trigger magioni_only_listed_users
  before insert or update of email on auth.users
  for each row execute function public.magioni_block_unlisted_users();

-- Limite por distância (ver migração magioni_geofence no projeto):
-- magioni_settings.geo_enabled/geo_lat/geo_lng/geo_radius_m/geo_label,
-- magioni_requests/comments.req_lat/req_lng, funções magioni_distance_m e
-- magioni_menu_allows(lat, lng), usadas nas políticas de inserção.
