begin;

create or replace function public.respond_game_wager(
  p_proposal_id uuid,
  p_user_id text,
  p_accept boolean
)
returns table (
  accepted boolean,
  can_afford boolean
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_room_id uuid;
  v_amount bigint;
  v_balance bigint := 0;
  v_can_afford boolean;
  v_host_id text;
  v_next_host text;
begin
  select
    gp.room_id,
    gp.amount,
    gr.host_id
  into
    v_room_id,
    v_amount,
    v_host_id
  from public.game_wager_proposals gp
  join public.game_rooms gr
    on gr.id = gp.room_id
  where gp.id = p_proposal_id
    and gp.status = 'pending'
  for update of gp;

  if not found then
    raise exception 'proposal_not_active';
  end if;

  if not exists (
    select 1
    from public.game_room_players grp
    where grp.room_id = v_room_id
      and grp.user_id = p_user_id
  ) then
    raise exception 'not_in_room';
  end if;

  if not p_accept then
    delete from public.game_room_players
    where room_id = v_room_id
      and user_id = p_user_id;

    delete from public.game_wager_acceptances
    where proposal_id = p_proposal_id
      and user_id = p_user_id;

    if v_host_id = p_user_id then
      select grp.user_id
      into v_next_host
      from public.game_room_players grp
      where grp.room_id = v_room_id
      order by grp.joined_at asc
      limit 1;

      if v_next_host is not null then
        update public.game_rooms
        set host_id = v_next_host
        where id = v_room_id;
      else
        update public.game_rooms
        set status = 'closed'
        where id = v_room_id;

        update public.game_wager_proposals
        set
          status = 'cancelled',
          updated_at = now()
        where id = p_proposal_id;
      end if;
    end if;

    return query
    select false, false;

    return;
  end if;

  select coalesce(
    (
      select eu.balance
      from public.economy_users eu
      where eu.user_id = p_user_id
    ),
    0
  )
  into v_balance;

  v_can_afford :=
    v_amount = 0
    or v_balance >= v_amount;

  if not v_can_afford then
    raise exception 'insufficient_aura';
  end if;

  insert into public.game_wager_acceptances (
    proposal_id,
    room_id,
    user_id,
    accepted,
    can_afford,
    updated_at
  )
  values (
    p_proposal_id,
    v_room_id,
    p_user_id,
    true,
    v_can_afford,
    now()
  )
  on conflict (
    proposal_id,
    user_id
  )
  do update set
    accepted = excluded.accepted,
    can_afford = excluded.can_afford,
    updated_at = now();

  return query
  select true, v_can_afford;
end;
$$;

commit;
