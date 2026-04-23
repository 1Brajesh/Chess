create table if not exists public.brajesh_admin_config (
  key text primary key,
  value text not null,
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.brajesh_admin_sessions (
  token_hash text primary key,
  expires_at timestamptz not null,
  created_at timestamptz not null default timezone('utc', now())
);

create or replace function public.brajesh_set_admin_config_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

drop trigger if exists brajesh_admin_config_set_updated_at on public.brajesh_admin_config;
create trigger brajesh_admin_config_set_updated_at
before update on public.brajesh_admin_config
for each row execute function public.brajesh_set_admin_config_updated_at();

create or replace function public.brajesh_token_hash(admin_token text)
returns text
language sql
immutable
security definer
set search_path = public, extensions
as $$
  select encode(digest(coalesce(admin_token, ''), 'sha256'), 'hex');
$$;

create or replace function public.is_brajesh_password_admin(admin_token text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.brajesh_admin_sessions sessions
    where sessions.token_hash = public.brajesh_token_hash(admin_token)
      and sessions.expires_at > timezone('utc', now())
  );
$$;

create or replace function public.brajesh_require_password_admin(admin_token text)
returns void
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_brajesh_password_admin(admin_token) then
    raise exception 'Admin session is invalid or expired'
      using errcode = '28000';
  end if;
end;
$$;

create or replace function public.brajesh_admin_login(admin_password text)
returns table (token text, expires_at timestamptz)
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  stored_hash text;
  generated_token text;
  session_expires_at timestamptz;
begin
  select config.value
    into stored_hash
  from public.brajesh_admin_config config
  where config.key = 'password_hash';

  if stored_hash is null then
    raise exception 'Admin password is not configured'
      using errcode = '28000';
  end if;

  if crypt(admin_password, stored_hash) <> stored_hash then
    raise exception 'Invalid admin password'
      using errcode = '28000';
  end if;

  delete from public.brajesh_admin_sessions
  where brajesh_admin_sessions.expires_at <= timezone('utc', now());

  generated_token := gen_random_uuid()::text || '.' || gen_random_uuid()::text;
  session_expires_at := timezone('utc', now()) + interval '30 days';

  insert into public.brajesh_admin_sessions (token_hash, expires_at)
  values (public.brajesh_token_hash(generated_token), session_expires_at);

  return query select generated_token, session_expires_at;
end;
$$;

create or replace function public.brajesh_admin_logout(admin_token text)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  deleted_count integer;
begin
  delete from public.brajesh_admin_sessions sessions
  where sessions.token_hash = public.brajesh_token_hash(admin_token);

  get diagnostics deleted_count = row_count;
  return deleted_count;
end;
$$;

create or replace function public.brajesh_admin_poems(admin_token text)
returns table (
  id uuid,
  slug text,
  title text,
  body text,
  display_order integer,
  published boolean,
  created_at timestamptz,
  updated_at timestamptz,
  likes_count integer,
  comments_count integer
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  perform public.brajesh_require_password_admin(admin_token);

  return query
  select
    poems.id,
    poems.slug,
    poems.title,
    poems.body,
    poems.display_order,
    poems.published,
    poems.created_at,
    poems.updated_at,
    coalesce(stats.likes_count, 0)::integer as likes_count,
    coalesce(stats.comments_count, 0)::integer as comments_count
  from public.brajesh_poems poems
  left join public.brajesh_poem_stats stats
    on stats.poem_id = poems.id
  order by poems.display_order, poems.created_at;
end;
$$;

create or replace function public.brajesh_admin_comments(admin_token text)
returns table (
  id uuid,
  poem_id uuid,
  author_name text,
  body text,
  approved boolean,
  created_at timestamptz,
  updated_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  perform public.brajesh_require_password_admin(admin_token);

  return query
  select
    comments.id,
    comments.poem_id,
    comments.author_name,
    comments.body,
    comments.approved,
    comments.created_at,
    comments.updated_at
  from public.brajesh_comments comments
  order by comments.created_at;
end;
$$;

create or replace function public.brajesh_slugify(value text)
returns text
language sql
volatile
security definer
set search_path = public
as $$
  select coalesce(
    nullif(
      regexp_replace(
        regexp_replace(lower(trim(value)), '[^a-z0-9]+', '-', 'g'),
        '(^-|-$)',
        '',
        'g'
      ),
      ''
    ),
    'poem-' || floor(extract(epoch from clock_timestamp()))::text
  );
$$;

create or replace function public.brajesh_admin_create_poem(
  admin_token text,
  poem_title text,
  poem_slug text,
  poem_body text,
  poem_published boolean default true
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  new_id uuid;
  next_order integer;
begin
  perform public.brajesh_require_password_admin(admin_token);

  select coalesce(max(display_order), 0) + 10
    into next_order
  from public.brajesh_poems;

  insert into public.brajesh_poems (slug, title, body, display_order, published)
  values (
    public.brajesh_slugify(coalesce(nullif(poem_slug, ''), poem_title)),
    trim(poem_title),
    trim(poem_body),
    next_order,
    coalesce(poem_published, true)
  )
  returning id into new_id;

  return new_id;
end;
$$;

create or replace function public.brajesh_admin_update_poem(
  admin_token text,
  target_poem_id uuid,
  poem_title text,
  poem_slug text,
  poem_body text,
  poem_published boolean
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  updated_count integer;
begin
  perform public.brajesh_require_password_admin(admin_token);

  update public.brajesh_poems poems
  set
    slug = public.brajesh_slugify(coalesce(nullif(poem_slug, ''), poem_title)),
    title = trim(poem_title),
    body = trim(poem_body),
    published = coalesce(poem_published, false)
  where poems.id = target_poem_id;

  get diagnostics updated_count = row_count;
  return updated_count;
end;
$$;

create or replace function public.brajesh_admin_delete_poem(
  admin_token text,
  target_poem_id uuid
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  deleted_count integer;
begin
  perform public.brajesh_require_password_admin(admin_token);

  delete from public.brajesh_poems poems
  where poems.id = target_poem_id;

  get diagnostics deleted_count = row_count;
  return deleted_count;
end;
$$;

create or replace function public.brajesh_admin_delete_comment(
  admin_token text,
  target_comment_id uuid
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  deleted_count integer;
begin
  perform public.brajesh_require_password_admin(admin_token);

  delete from public.brajesh_comments comments
  where comments.id = target_comment_id;

  get diagnostics deleted_count = row_count;
  return deleted_count;
end;
$$;

alter table public.brajesh_admin_config enable row level security;
alter table public.brajesh_admin_sessions enable row level security;

revoke all on public.brajesh_admin_config from anon, authenticated;
revoke all on public.brajesh_admin_sessions from anon, authenticated;
revoke all on function public.brajesh_token_hash(text) from public;
revoke all on function public.is_brajesh_password_admin(text) from public;
revoke all on function public.brajesh_require_password_admin(text) from public;
revoke all on function public.brajesh_admin_login(text) from public;
revoke all on function public.brajesh_admin_logout(text) from public;
revoke all on function public.brajesh_admin_poems(text) from public;
revoke all on function public.brajesh_admin_comments(text) from public;
revoke all on function public.brajesh_slugify(text) from public;
revoke all on function public.brajesh_admin_create_poem(text, text, text, text, boolean) from public;
revoke all on function public.brajesh_admin_update_poem(text, uuid, text, text, text, boolean) from public;
revoke all on function public.brajesh_admin_delete_poem(text, uuid) from public;
revoke all on function public.brajesh_admin_delete_comment(text, uuid) from public;

grant execute on function public.brajesh_admin_login(text) to anon, authenticated;
grant execute on function public.brajesh_admin_logout(text) to anon, authenticated;
grant execute on function public.brajesh_admin_poems(text) to anon, authenticated;
grant execute on function public.brajesh_admin_comments(text) to anon, authenticated;
grant execute on function public.brajesh_admin_create_poem(text, text, text, text, boolean) to anon, authenticated;
grant execute on function public.brajesh_admin_update_poem(text, uuid, text, text, text, boolean) to anon, authenticated;
grant execute on function public.brajesh_admin_delete_poem(text, uuid) to anon, authenticated;
grant execute on function public.brajesh_admin_delete_comment(text, uuid) to anon, authenticated;
