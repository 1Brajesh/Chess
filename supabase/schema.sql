create extension if not exists pgcrypto;

create table if not exists public.games (
  id uuid primary key default gen_random_uuid(),
  room_code text not null unique,
  host_user_id uuid not null,
  white_player_id uuid not null,
  black_player_id uuid,
  start_fen text not null,
  current_fen text not null,
  moves jsonb not null default '[]'::jsonb,
  status text not null default 'waiting',
  last_move_san text,
  version integer not null default 0,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint games_status_check
    check (status in ('waiting', 'active', 'finished')),
  constraint games_room_code_check
    check (room_code = upper(room_code) and length(room_code) between 4 and 12)
);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

create or replace function public.protect_game_identity()
returns trigger
language plpgsql
as $$
begin
  if old.room_code is distinct from new.room_code
     or old.host_user_id is distinct from new.host_user_id
     or old.white_player_id is distinct from new.white_player_id then
    raise exception 'game identity fields are immutable';
  end if;

  if old.black_player_id is not null
     and old.black_player_id is distinct from new.black_player_id then
    raise exception 'black seat cannot be reassigned';
  end if;

  return new;
end;
$$;

drop trigger if exists games_set_updated_at on public.games;
drop trigger if exists games_protect_identity on public.games;

create trigger games_set_updated_at
before update on public.games
for each row
execute function public.set_updated_at();

create trigger games_protect_identity
before update on public.games
for each row
execute function public.protect_game_identity();

alter table public.games enable row level security;

drop policy if exists "games_select_authenticated" on public.games;
create policy "games_select_authenticated"
on public.games
for select
to authenticated
using (true);

drop policy if exists "games_insert_host" on public.games;
create policy "games_insert_host"
on public.games
for insert
to authenticated
with check (
  auth.uid() is not null
  and host_user_id = auth.uid()
  and white_player_id = auth.uid()
  and black_player_id is null
);

drop policy if exists "games_update_participants_or_joiners" on public.games;
create policy "games_update_participants_or_joiners"
on public.games
for update
to authenticated
using (
  auth.uid() is not null
  and (
    auth.uid() = white_player_id
    or auth.uid() = black_player_id
    or black_player_id is null
  )
)
with check (
  auth.uid() is not null
  and (
    auth.uid() = white_player_id
    or auth.uid() = black_player_id
  )
);

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'games'
  ) then
    alter publication supabase_realtime add table public.games;
  end if;
end;
$$;
