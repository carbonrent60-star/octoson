begin;

-- =========================================================
-- OCTOSON GAMES V2
-- Atomic multiplayer Aura wagering
-- =========================================================

create table if not exists public.game_wagers (
  id uuid primary key default gen_random_uuid(),

  match_id uuid not null
    references public.game_matches(id)
    on delete cascade,

  room_id uuid not null
    references public.game_rooms(id)
    on delete cascade,

  user_id text not null
    references public.economy_users(user_id)
    on delete cascade,

  amount bigint not null,

  -- locked | paid | refunded
  status text not null default 'locked',

  created_at timestamptz not null default now(),
  settled_at timestamptz,

  unique (match_id, user_id),

  constraint game_wagers_amount
    check (amount > 0),

  constraint game_wagers_status
    check (
      status in ('locked', 'paid', 'refunded')
    )
);

create index if not exists game_wagers_match_idx
  on public.game_wagers (match_id);

create index if not exists game_wagers_room_idx
  on public.game_wagers (room_id);

create index if not exists game_wagers_user_idx
  on public.game_wagers (user_id);


-- =========================================================
-- LOCK ONE PLAYER'S WAGER
--
-- Atomic:
-- 1. lock economy row
-- 2. verify wallet
-- 3. deduct Aura
-- 4. sync profile.balance
-- 5. increment version
-- 6. create transaction
-- 7. create wager row
--
-- Idempotent through unique(match_id,user_id)
-- =========================================================

create or replace function public.lock_game_wager(
  p_match_id uuid,
  p_user_id text,
  p_amount bigint
)
returns table (
  ok boolean,
  balance bigint
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_room_id uuid;
  v_balance bigint;
  v_profile jsonb;
  v_existing public.game_wagers%rowtype;
  v_now bigint;
begin
  if p_amount <= 0 then
    raise exception 'invalid_wager';
  end if;

  select gm.room_id
  into v_room_id
  from public.game_matches gm
  where gm.id = p_match_id;

  if v_room_id is null then
    raise exception 'match_not_found';
  end if;

  select gw.*
  into v_existing
  from public.game_wagers gw
  where gw.match_id = p_match_id
    and gw.user_id = p_user_id;

  if found then
    select eu.balance
    into v_balance
    from public.economy_users eu
    where eu.user_id = p_user_id;

    return query
    select true, coalesce(v_balance, 0);
    return;
  end if;

  select
    eu.balance,
    coalesce(eu.profile, '{}'::jsonb)
  into
    v_balance,
    v_profile
  from public.economy_users eu
  where eu.user_id = p_user_id
  for update;

  if not found then
    raise exception 'economy_user_not_found';
  end if;

  if v_balance < p_amount then
    raise exception 'insufficient_aura';
  end if;

  v_now :=
    (extract(epoch from clock_timestamp()) * 1000)::bigint;

  v_balance := v_balance - p_amount;

  v_profile :=
    jsonb_set(
      v_profile,
      '{balance}',
      to_jsonb(v_balance),
      true
    );

  update public.economy_users eu
  set
    profile = v_profile,
    version = eu.version + 1
  where eu.user_id = p_user_id;

  insert into public.game_wagers (
    match_id,
    room_id,
    user_id,
    amount,
    status
  )
  values (
    p_match_id,
    v_room_id,
    p_user_id,
    p_amount,
    'locked'
  );

  insert into public.economy_transactions (
    transaction_key,
    user_id,
    amount,
    type,
    note,
    metadata,
    balance_before,
    balance_after,
    created_at
  )
  values (
    'game:wager:' ||
      p_match_id::text ||
      ':' ||
      p_user_id,
    p_user_id,
    -p_amount,
    'game_wager',
    'Multiplayer oyun mərci',
    jsonb_build_object(
      'matchId', p_match_id,
      'roomId', v_room_id
    ),
    v_balance + p_amount,
    v_balance,
    v_now
  )
  on conflict (transaction_key) do nothing;

  return query
  select true, v_balance;
end;
$$;


-- =========================================================
-- REFUND ALL LOCKED WAGERS
--
-- Used if starting a game fails or match is cancelled.
-- Idempotent: only status=locked rows are refunded.
-- =========================================================

create or replace function public.refund_game_wagers(
  p_match_id uuid
)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  v_wager record;
  v_balance bigint;
  v_profile jsonb;
  v_refunded bigint := 0;
  v_now bigint;
begin
  v_now :=
    (extract(epoch from clock_timestamp()) * 1000)::bigint;

  for v_wager in
    select gw.*
    from public.game_wagers gw
    where gw.match_id = p_match_id
      and gw.status = 'locked'
    order by gw.user_id
    for update
  loop
    select
      eu.balance,
      coalesce(eu.profile, '{}'::jsonb)
    into
      v_balance,
      v_profile
    from public.economy_users eu
    where eu.user_id = v_wager.user_id
    for update;

    if found then
      v_profile :=
        jsonb_set(
          v_profile,
          '{balance}',
          to_jsonb(v_balance + v_wager.amount),
          true
        );

      update public.economy_users eu
      set
        profile = v_profile,
        version = eu.version + 1
      where eu.user_id = v_wager.user_id;

      insert into public.economy_transactions (
        transaction_key,
        user_id,
        amount,
        type,
        note,
        metadata,
        balance_before,
        balance_after,
        created_at
      )
      values (
        'game:refund:' ||
          p_match_id::text ||
          ':' ||
          v_wager.user_id,
        v_wager.user_id,
        v_wager.amount,
        'game_refund',
        'Multiplayer oyun mərci geri qaytarıldı',
        jsonb_build_object(
          'matchId', p_match_id,
          'roomId', v_wager.room_id
        ),
        v_balance,
        v_balance + v_wager.amount,
        v_now
      )
      on conflict (transaction_key) do nothing;

      update public.game_wagers gw
      set
        status = 'refunded',
        settled_at = now()
      where gw.id = v_wager.id
        and gw.status = 'locked';

      v_refunded := v_refunded + v_wager.amount;
    end if;
  end loop;

  return v_refunded;
end;
$$;


-- =========================================================
-- PAY ENTIRE POT TO WINNER
--
-- Every locked wager becomes paid.
-- Winner receives total pot.
-- Exactly-once behavior:
-- if there are no locked wagers, function returns 0.
-- =========================================================

create or replace function public.settle_game_wagers(
  p_match_id uuid,
  p_winner_id text
)
returns table (
  pot bigint,
  winner_balance bigint
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_pot bigint;
  v_balance bigint;
  v_profile jsonb;
  v_now bigint;
begin
  -- Lock all wager rows first.
  perform 1
  from public.game_wagers gw
  where gw.match_id = p_match_id
  order by gw.user_id
  for update;

  select coalesce(sum(gw.amount), 0)
  into v_pot
  from public.game_wagers gw
  where gw.match_id = p_match_id
    and gw.status = 'locked';

  if v_pot <= 0 then
    select eu.balance
    into v_balance
    from public.economy_users eu
    where eu.user_id = p_winner_id;

    return query
    select 0::bigint, coalesce(v_balance, 0);
    return;
  end if;

  if not exists (
    select 1
    from public.game_wagers gw
    where gw.match_id = p_match_id
      and gw.user_id = p_winner_id
      and gw.status = 'locked'
  ) then
    raise exception 'winner_not_in_match';
  end if;

  select
    eu.balance,
    coalesce(eu.profile, '{}'::jsonb)
  into
    v_balance,
    v_profile
  from public.economy_users eu
  where eu.user_id = p_winner_id
  for update;

  if not found then
    raise exception 'winner_economy_user_not_found';
  end if;

  v_now :=
    (extract(epoch from clock_timestamp()) * 1000)::bigint;

  v_profile :=
    jsonb_set(
      v_profile,
      '{balance}',
      to_jsonb(v_balance + v_pot),
      true
    );

  update public.economy_users eu
  set
    profile = v_profile,
    version = eu.version + 1
  where eu.user_id = p_winner_id;

  update public.game_wagers gw
  set
    status = 'paid',
    settled_at = now()
  where gw.match_id = p_match_id
    and gw.status = 'locked';

  insert into public.economy_transactions (
    transaction_key,
    user_id,
    amount,
    type,
    note,
    metadata,
    balance_before,
    balance_after,
    created_at
  )
  values (
    'game:payout:' ||
      p_match_id::text ||
      ':' ||
      p_winner_id,
    p_winner_id,
    v_pot,
    'game_payout',
    'Multiplayer oyun qazancı',
    jsonb_build_object(
      'matchId', p_match_id,
      'pot', v_pot
    ),
    v_balance,
    v_balance + v_pot,
    v_now
  )
  on conflict (transaction_key) do nothing;

  return query
  select
    v_pot,
    v_balance + v_pot;
end;
$$;


-- =========================================================
-- REALTIME WAGER CHANGES
-- =========================================================

do $$
begin
  alter publication supabase_realtime
    add table public.game_wagers;
exception
  when duplicate_object then null;
end;
$$;

commit;
