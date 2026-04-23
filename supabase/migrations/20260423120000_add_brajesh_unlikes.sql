drop view if exists public.brajesh_poem_stats;

create view public.brajesh_poem_stats
with (security_invoker = false)
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

create or replace function public.brajesh_liked_poems(target_liker_key text)
returns table (poem_id uuid)
language sql
stable
security definer
set search_path = public
as $$
  select likes.poem_id
  from public.brajesh_poem_likes likes
  join public.brajesh_poems poems
    on poems.id = likes.poem_id
  where likes.liker_key = target_liker_key
    and char_length(target_liker_key) between 16 and 120
    and (poems.published or public.is_brajesh_admin());
$$;

create or replace function public.brajesh_unlike_poem(
  target_poem_id uuid,
  target_liker_key text
)
returns integer
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  deleted_count integer;
begin
  if char_length(target_liker_key) not between 16 and 120 then
    return 0;
  end if;

  delete from public.brajesh_poem_likes likes
  where likes.poem_id = target_poem_id
    and likes.liker_key = target_liker_key;

  get diagnostics deleted_count = row_count;
  return deleted_count;
end;
$$;

revoke select on public.brajesh_poem_likes from anon, authenticated;
revoke all on function public.brajesh_liked_poems(text) from public;
revoke all on function public.brajesh_unlike_poem(uuid, text) from public;

grant select on public.brajesh_poem_stats to anon, authenticated;
grant execute on function public.brajesh_liked_poems(text) to anon, authenticated;
grant execute on function public.brajesh_unlike_poem(uuid, text) to anon, authenticated;
