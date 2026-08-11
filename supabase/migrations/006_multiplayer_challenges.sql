begin;

-- ============================================================
-- MATCH / WAGER PROPOSALS
-- One proposal belongs to a room.
-- Host proposes the per-player stake.
-- Every player must accept before the match can begin.
-- ============================================================

create table if not exists public.game_wager_proposals (
  id uuid primary key default gen_random_uuid(),

  room_id uuid not null
    references public.game_rooms(id)
    on delete cascade,

  proposed_by text not null
    references public.economy_users(user_id)
    on delete cascade,

  game text not null,

  amount bigint not null default 0,

  status text not null default 'pending',

  version bigint not null default 1,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint game_wager_proposals_amount
    check (amount >= 0),

  constraint game_wager_proposals_status
    check (
      status in (
        'pending',
        'accepted',
        'declined',
        'started',
        'cancelled'
      )
    )
);

create index if not exists game_wager_proposals_room_idx
  on public.game_wager_proposals(room_id);

create index if not exists game_wager_proposals_status_idx
  on public.game_wager_proposals(status);


-- ============================================================
-- PLAYER RESPONSES
-- ============================================================

create table if not exists public.game_wager_acceptances (
  proposal_id uuid not null
    references public.game_wager_proposals(id)
    on delete cascade,

  room_id uuid not null
    references public.game_rooms(id)
    on delete cascade,

  user_id text not null
    references public.economy_users(user_id)
    on delete cascade,

  accepted boolean,
  can_afford boolean not null default false,

  updated_at timestamptz not null default now(),

  primary key (proposal_id, user_id)
);

create index if not exists game_wager_acceptances_room_idx
  on public.game_wager_acceptances(room_id);


-- ============================================================
-- PROPOSE / CHANGE STAKE
--
-- Changing the amount invalidates every previous acceptance.
-- ============================================================

create or replace function public.propose_game_wager(
  p_room_id uuid,
  p_user_id text,
  p_amount bigint
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_room public.game_rooms%rowtype;
  v_proposal_id uuid;
begin
  if p_amount < 0 or p_amount > 1000000 then
    raise exception 'invalid_wager';
  end if;

  select *
  into v_room
  from public.game_rooms
  where id = p_room_id
  for update;

  if not found then
    raise exception 'room_not_found';
  end if;

  if v_room.host_id <> p_user_id then
    raise exception 'host_only';
  end if;

  if v_room.status <> 'waiting' then
    raise exception 'room_not_waiting';
  end if;

  update public.game_wager_proposals
  set
    status = 'cancelled',
    updated_at = now()
  where room_id = p_room_id
    and status = 'pending';

  insert into public.game_wager_proposals (
    room_id,
    proposed_by,
    game,
    amount,
    status
  )
  values (
    p_room_id,
    p_user_id,
    v_room.game,
    p_amount,
    'pending'
  )
  returning id into v_proposal_id;

  insert into public.game_wager_acceptances (
    proposal_id,
    room_id,
    user_id,
    accepted,
    can_afford
  )
  select
    v_proposal_id,
    p_room_id,
    grp.user_id,
    case
      when grp.user_id = p_user_id
      then true
      else null
    end,
    coalesce(eu.balance, 0) >= p_amount
  from public.game_room_players grp
  left join public.economy_users eu
    on eu.user_id = grp.user_id
  where grp.room_id = p_room_id;

  return v_proposal_id;
end;
$$;


-- ============================================================
-- ACCEPT / DECLINE
-- Re-check affordability every time.
-- ============================================================

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
  v_balance bigint;
  v_can_afford boolean;
begin
  select
    gp.room_id,
    gp.amount
  into
    v_room_id,
    v_amount
  from public.game_wager_proposals gp
  where gp.id = p_proposal_id
    and gp.status = 'pending'
  for update;

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

  select coalesce(eu.balance, 0)
  into v_balance
  from public.economy_users eu
  where eu.user_id = p_user_id;

  v_can_afford :=
    v_amount = 0 or v_balance >= v_amount;

  if p_accept and not v_can_afford then
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
    p_accept,
    v_can_afford,
    now()
  )
  on conflict (proposal_id, user_id)
  do update set
    accepted = excluded.accepted,
    can_afford = excluded.can_afford,
    updated_at = now();

  if not p_accept then
    update public.game_wager_proposals
    set
      status = 'declined',
      updated_at = now()
    where id = p_proposal_id
      and status = 'pending';
  end if;

  return query
  select p_accept, v_can_afford;
end;
$$;


-- ============================================================
-- ATOMICALLY LOCK ACCEPTED ROOM WAGERS
--
-- Every current room player must:
--   1. have an acceptance row
--   2. have accepted
--   3. still have enough Aura
--
-- If any player fails, the entire function rolls back.
-- ============================================================

create or replace function public.lock_accepted_game_wagers(
  p_proposal_id uuid,
  p_match_id uuid
)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  v_proposal public.game_wager_proposals%rowtype;
  v_player record;
  v_player_count bigint;
  v_accepted_count bigint;
  v_pot bigint := 0;
begin
  select *
  into v_proposal
  from public.game_wager_proposals
  where id = p_proposal_id
  for update;

  if not found then
    raise exception 'proposal_not_found';
  end if;

  if v_proposal.status <> 'pending' then
    raise exception 'proposal_not_active';
  end if;

  select count(*)
  into v_player_count
  from public.game_room_players
  where room_id = v_proposal.room_id;

  select count(*)
  into v_accepted_count
  from public.game_wager_acceptances gwa
  where gwa.proposal_id = p_proposal_id
    and gwa.accepted = true;

  if v_player_count < 2 then
    raise exception 'not_enough_players';
  end if;

  if v_accepted_count <> v_player_count then
    raise exception 'not_everyone_accepted';
  end if;

  for v_player in
    select
      grp.user_id,
      eu.balance
    from public.game_room_players grp
    join public.economy_users eu
      on eu.user_id = grp.user_id
    where grp.room_id = v_proposal.room_id
    order by grp.user_id
    for update of eu
  loop
    if v_player.balance < v_proposal.amount then
      raise exception 'insufficient_aura:%', v_player.user_id;
    end if;
  end loop;

  if v_proposal.amount > 0 then
    for v_player in
      select grp.user_id
      from public.game_room_players grp
      where grp.room_id = v_proposal.room_id
      order by grp.user_id
    loop
      perform *
      from public.lock_game_wager(
        p_match_id,
        v_player.user_id,
        v_proposal.amount
      );

      v_pot :=
        v_pot + v_proposal.amount;
    end loop;
  end if;

  update public.game_wager_proposals
  set
    status = 'started',
    updated_at = now()
  where id = p_proposal_id;

  return v_pot;
end;
$$;


-- ============================================================
-- REALTIME
-- ============================================================

do $$
begin
  alter publication supabase_realtime
    add table public.game_wager_proposals;
exception
  when duplicate_object then null;
end;
$$;

do $$
begin
  alter publication supabase_realtime
    add table public.game_wager_acceptances;
exception
  when duplicate_object then null;
end;
$$;

commit;
