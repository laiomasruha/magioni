-- Pedidos: música tocada fica bloqueada durante o show; pedidos repetidos são agrupados no painel.

-- Quando a música foi marcada como tocada
alter table public.magioni_requests add column if not exists played_at timestamptz;
update public.magioni_requests set played_at = coalesce(played_at, created_at) where status = 'tocada';

-- Quando o artista abriu os pedidos pela última vez (início do show)
alter table public.magioni_settings add column if not exists requests_opened_at timestamptz;

create or replace function public.magioni_requests_played_at()
returns trigger language plpgsql set search_path = public as $$
begin
  if new.status = 'tocada' then
    if tg_op = 'INSERT' or old.status is distinct from 'tocada' then new.played_at := now(); end if;
  else
    new.played_at := null;
  end if;
  return new;
end $$;
drop trigger if exists magioni_requests_played_at on public.magioni_requests;
create trigger magioni_requests_played_at before insert or update of status on public.magioni_requests
  for each row execute function public.magioni_requests_played_at();

create or replace function public.magioni_settings_opened_at()
returns trigger language plpgsql set search_path = public as $$
begin
  if new.requests_open and (tg_op = 'INSERT' or not coalesce(old.requests_open, false)) then
    new.requests_opened_at := now();
  end if;
  return new;
end $$;
drop trigger if exists magioni_settings_opened_at on public.magioni_settings;
create trigger magioni_settings_opened_at before insert or update of requests_open on public.magioni_settings
  for each row execute function public.magioni_settings_opened_at();

-- Músicas já tocadas no show atual (desde que os pedidos foram abertos, no máximo 12 horas)
create or replace function public.magioni_played_song_ids()
returns setof uuid language sql stable security definer set search_path = public as $$
  select distinct r.song_id
  from public.magioni_requests r, public.magioni_settings s
  where s.id = 1 and r.song_id is not null and r.status = 'tocada'
    and r.played_at >= greatest(coalesce(s.requests_opened_at, now() - interval '12 hours'), now() - interval '12 hours');
$$;
revoke all on function public.magioni_played_song_ids() from public;
grant execute on function public.magioni_played_song_ids() to anon, authenticated;

-- Não aceita pedido de música que já tocou no show
drop policy if exists "magioni requests public insert" on public.magioni_requests;
create policy "magioni requests public insert" on public.magioni_requests for insert to anon, authenticated
  with check (
    status = 'pendente'
    and public.magioni_menu_allows(req_lat, req_lng)
    and song_id is not null
    and exists (select 1 from public.magioni_songs s where s.id = magioni_requests.song_id and s.active)
    and not exists (select 1 from public.magioni_played_song_ids() p where p = magioni_requests.song_id)
  );
