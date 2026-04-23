create extension if not exists "pgcrypto";

create table if not exists public.brajesh_admins (
  email text primary key,
  created_at timestamptz not null default timezone('utc', now()),
  constraint brajesh_admins_email_lowercase_check
    check (email = lower(email) and position('@' in email) > 1)
);

insert into public.brajesh_admins (email)
values ('engineerbk@gmail.com')
on conflict (email) do nothing;

create or replace function public.is_brajesh_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.brajesh_admins admins
    where admins.email = lower(coalesce(auth.jwt() ->> 'email', ''))
  );
$$;

revoke all on function public.is_brajesh_admin() from public;
grant execute on function public.is_brajesh_admin() to anon, authenticated;

create table if not exists public.brajesh_poems (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  body text not null,
  display_order integer not null default 0,
  published boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint brajesh_poems_slug_check
    check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  constraint brajesh_poems_title_check
    check (char_length(trim(title)) between 1 and 120),
  constraint brajesh_poems_body_check
    check (char_length(trim(body)) between 1 and 5000)
);

create table if not exists public.brajesh_poem_likes (
  id uuid primary key default gen_random_uuid(),
  poem_id uuid not null references public.brajesh_poems(id) on delete cascade,
  liker_key text not null,
  created_at timestamptz not null default timezone('utc', now()),
  constraint brajesh_poem_likes_key_check
    check (char_length(liker_key) between 16 and 120),
  unique (poem_id, liker_key)
);

create table if not exists public.brajesh_comments (
  id uuid primary key default gen_random_uuid(),
  poem_id uuid not null references public.brajesh_poems(id) on delete cascade,
  author_name text not null default 'Anonymous',
  body text not null,
  approved boolean not null default true,
  client_key text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint brajesh_comments_author_check
    check (char_length(trim(author_name)) between 1 and 80),
  constraint brajesh_comments_body_check
    check (char_length(trim(body)) between 1 and 2000),
  constraint brajesh_comments_client_key_check
    check (client_key is null or char_length(client_key) between 16 and 120)
);

create index if not exists brajesh_poems_display_order_idx
  on public.brajesh_poems (display_order, created_at);

create index if not exists brajesh_poems_published_idx
  on public.brajesh_poems (published);

create index if not exists brajesh_poem_likes_poem_id_idx
  on public.brajesh_poem_likes (poem_id);

create index if not exists brajesh_comments_poem_id_created_at_idx
  on public.brajesh_comments (poem_id, created_at);

create index if not exists brajesh_comments_approved_idx
  on public.brajesh_comments (approved);

create or replace function public.brajesh_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

drop trigger if exists brajesh_poems_set_updated_at on public.brajesh_poems;
create trigger brajesh_poems_set_updated_at
before update on public.brajesh_poems
for each row execute function public.brajesh_set_updated_at();

drop trigger if exists brajesh_comments_set_updated_at on public.brajesh_comments;
create trigger brajesh_comments_set_updated_at
before update on public.brajesh_comments
for each row execute function public.brajesh_set_updated_at();

insert into public.brajesh_poems (slug, title, body, display_order, published)
values
  ('truth', 'Truth', $poem$You become a poet
When you've seen the truth
And no one is ready
To put on your shoes$poem$, 10, true),
  ('groceries', 'Groceries', $poem$Everyone is nice to you
When you're dead
Or when you're carrying
Groceries and bread$poem$, 20, true),
  ('poems', 'Poems', $poem$Bring back poems
That rhyme
They go easily
Into the mind$poem$, 30, true),
  ('anger', 'Anger', $poem$Trying to get rid of anger
Is like trying to get rid of
*happiness*
Let me know how it goes$poem$, 40, true),
  ('cleanse', 'Cleanse', $poem$How can you purge emotions
That you deny exist
How can you cleanse
Without pooping a lot of shit$poem$, 50, true),
  ('rules', 'Rules', $poem$Who made the rules
Are we born fools?
Shall we run free like bulls?
Or cover our heads with wool?$poem$, 60, true),
  ('beach', 'Beach', $poem$The beach was glowing
Her hair was flowing
I kissed her on the lips
The moonlight was pouring.$poem$, 70, true),
  ('fear', 'Fear', $poem$Fear of what?
I fought with naught.
I passed the time,
Till I was rot.$poem$, 80, true),
  ('emotions', 'Emotions', $poem$Feel my emotions?
They serve me not.
I'd rather live life
As tight as a knot.$poem$, 90, true),
  ('heaven', 'Heaven', $poem$What would you do in heaven?
Complain about the color of the sky
The variety of foods and pecan pie
And how you look forward to die?$poem$, 100, true),
  ('robot', 'Robot', $poem$I made a robot
He could run and fly
He had no feelings
He shook when he cried$poem$, 110, true)
on conflict (slug) do update set
  title = excluded.title,
  body = excluded.body,
  display_order = excluded.display_order,
  published = excluded.published;

drop view if exists public.brajesh_poem_stats;
create view public.brajesh_poem_stats
with (security_invoker = true)
as
select
  poems.id as poem_id,
  count(distinct likes.id)::integer as likes_count,
  count(distinct comments.id) filter (where comments.approved)::integer as comments_count
from public.brajesh_poems poems
left join public.brajesh_poem_likes likes
  on likes.poem_id = poems.id
left join public.brajesh_comments comments
  on comments.poem_id = poems.id
group by poems.id;

alter table public.brajesh_admins enable row level security;
alter table public.brajesh_poems enable row level security;
alter table public.brajesh_poem_likes enable row level security;
alter table public.brajesh_comments enable row level security;

drop policy if exists "brajesh_admins_select_admin" on public.brajesh_admins;
create policy "brajesh_admins_select_admin"
on public.brajesh_admins
for select
to authenticated
using (public.is_brajesh_admin());

drop policy if exists "brajesh_poems_select_public" on public.brajesh_poems;
create policy "brajesh_poems_select_public"
on public.brajesh_poems
for select
to anon, authenticated
using (published or public.is_brajesh_admin());

drop policy if exists "brajesh_poems_insert_admin" on public.brajesh_poems;
create policy "brajesh_poems_insert_admin"
on public.brajesh_poems
for insert
to authenticated
with check (public.is_brajesh_admin());

drop policy if exists "brajesh_poems_update_admin" on public.brajesh_poems;
create policy "brajesh_poems_update_admin"
on public.brajesh_poems
for update
to authenticated
using (public.is_brajesh_admin())
with check (public.is_brajesh_admin());

drop policy if exists "brajesh_poems_delete_admin" on public.brajesh_poems;
create policy "brajesh_poems_delete_admin"
on public.brajesh_poems
for delete
to authenticated
using (public.is_brajesh_admin());

drop policy if exists "brajesh_likes_select_public" on public.brajesh_poem_likes;
create policy "brajesh_likes_select_public"
on public.brajesh_poem_likes
for select
to anon, authenticated
using (
  exists (
    select 1 from public.brajesh_poems poems
    where poems.id = poem_id
      and (poems.published or public.is_brajesh_admin())
  )
);

drop policy if exists "brajesh_likes_insert_public" on public.brajesh_poem_likes;
create policy "brajesh_likes_insert_public"
on public.brajesh_poem_likes
for insert
to anon, authenticated
with check (
  exists (
    select 1 from public.brajesh_poems poems
    where poems.id = poem_id
      and poems.published
  )
);

drop policy if exists "brajesh_likes_delete_admin" on public.brajesh_poem_likes;
create policy "brajesh_likes_delete_admin"
on public.brajesh_poem_likes
for delete
to authenticated
using (public.is_brajesh_admin());

drop policy if exists "brajesh_comments_select_public" on public.brajesh_comments;
create policy "brajesh_comments_select_public"
on public.brajesh_comments
for select
to anon, authenticated
using (
  (
    approved
    and exists (
      select 1 from public.brajesh_poems poems
      where poems.id = poem_id
        and poems.published
    )
  )
  or public.is_brajesh_admin()
);

drop policy if exists "brajesh_comments_insert_public" on public.brajesh_comments;
create policy "brajesh_comments_insert_public"
on public.brajesh_comments
for insert
to anon, authenticated
with check (
  approved
  and exists (
    select 1 from public.brajesh_poems poems
    where poems.id = poem_id
      and poems.published
  )
);

drop policy if exists "brajesh_comments_update_admin" on public.brajesh_comments;
create policy "brajesh_comments_update_admin"
on public.brajesh_comments
for update
to authenticated
using (public.is_brajesh_admin())
with check (public.is_brajesh_admin());

drop policy if exists "brajesh_comments_delete_admin" on public.brajesh_comments;
create policy "brajesh_comments_delete_admin"
on public.brajesh_comments
for delete
to authenticated
using (public.is_brajesh_admin());

grant usage on schema public to anon, authenticated;
grant select on public.brajesh_poems to anon, authenticated;
grant select on public.brajesh_poem_likes to anon, authenticated;
grant select on public.brajesh_comments to anon, authenticated;
grant select on public.brajesh_poem_stats to anon, authenticated;
grant select on public.brajesh_admins to authenticated;
grant insert on public.brajesh_poem_likes to anon, authenticated;
grant insert on public.brajesh_comments to anon, authenticated;
grant insert, update, delete on public.brajesh_poems to authenticated;
grant update, delete on public.brajesh_comments to authenticated;
grant delete on public.brajesh_poem_likes to authenticated;
