create or replace function public.brajesh_admin_move_poem(
  admin_token text,
  target_poem_id uuid,
  move_direction text
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  target_position integer;
  neighbor_position integer;
  max_position integer;
  updated_count integer;
begin
  perform public.brajesh_require_password_admin(admin_token);

  if move_direction not in ('up', 'down') then
    raise exception 'Move direction must be up or down'
      using errcode = '22023';
  end if;

  with ordered as (
    select
      poems.id,
      (row_number() over (order by poems.display_order, poems.created_at, poems.id))::integer as position,
      (count(*) over ())::integer as total_count
    from public.brajesh_poems poems
  )
  select ordered.position, ordered.total_count
    into target_position, max_position
  from ordered
  where ordered.id = target_poem_id;

  if target_position is null then
    raise exception 'Poem not found'
      using errcode = 'P0002';
  end if;

  neighbor_position := case
    when move_direction = 'up' then target_position - 1
    else target_position + 1
  end;

  if neighbor_position < 1 or neighbor_position > max_position then
    return 0;
  end if;

  with ordered as (
    select
      poems.id,
      (row_number() over (order by poems.display_order, poems.created_at, poems.id))::integer as position
    from public.brajesh_poems poems
  ),
  swapped as (
    select
      ordered.id,
      case
        when ordered.position = target_position then neighbor_position
        when ordered.position = neighbor_position then target_position
        else ordered.position
      end as new_position
    from ordered
  )
  update public.brajesh_poems poems
  set display_order = swapped.new_position * 10
  from swapped
  where poems.id = swapped.id
    and poems.display_order is distinct from swapped.new_position * 10;

  get diagnostics updated_count = row_count;
  return updated_count;
end;
$$;

revoke all on function public.brajesh_admin_move_poem(text, uuid, text) from public;
grant execute on function public.brajesh_admin_move_poem(text, uuid, text) to anon, authenticated;
