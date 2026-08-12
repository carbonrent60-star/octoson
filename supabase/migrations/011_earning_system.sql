begin;

-- ============================================================
-- OCTOSON WEBSITE EARNING SYSTEM
-- Uses the SAME economy_users account as the Discord bot.
-- ============================================================

-- ---------- Reward claims / idempotency ----------

create table if not exists public.earning_claims (
  claim_key text primary key,
  user_id text not null references public.economy_users(user_id) on delete cascade,
  source_type text not null,
  source_id text not null,
  aura_reward bigint not null default 0 check (aura_reward >= 0),
  xp_reward integer not null default 0 check (xp_reward >= 0),
  season_xp_reward integer not null default 0 check (season_xp_reward >= 0),
  metadata jsonb not null default '{}'::jsonb,
  claimed_at bigint not null default ((extract(epoch from clock_timestamp()) * 1000)::bigint)
);

create index if not exists earning_claims_user_idx
  on public.earning_claims (user_id, claimed_at desc);

create index if not exists earning_claims_source_idx
  on public.earning_claims (source_type, source_id);


-- ---------- Daily / weekly missions ----------

create table if not exists public.earning_missions (
  id text primary key,
  user_id text not null references public.economy_users(user_id) on delete cascade,
  period_type text not null check (period_type in ('daily', 'weekly')),
  period_key text not null,
  mission_key text not null,
  title text not null,
  description text not null default '',
  metric text not null,
  target integer not null check (target > 0),
  progress integer not null default 0 check (progress >= 0),
  aura_reward bigint not null default 0 check (aura_reward >= 0),
  xp_reward integer not null default 0 check (xp_reward >= 0),
  season_xp_reward integer not null default 0 check (season_xp_reward >= 0),
  completed_at bigint,
  claimed_at bigint,
  created_at bigint not null default ((extract(epoch from clock_timestamp()) * 1000)::bigint),
  unique (user_id, period_type, period_key, mission_key)
);

create index if not exists earning_missions_user_period_idx
  on public.earning_missions (user_id, period_type, period_key);


-- ---------- Skill challenge attempts ----------

create table if not exists public.skill_challenge_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id text not null references public.economy_users(user_id) on delete cascade,
  challenge_key text not null,
  reward_day date not null default (current_timestamp at time zone 'utc')::date,
  attempt_number integer not null check (attempt_number > 0),
  status text not null default 'started'
    check (status in ('started', 'completed', 'rejected', 'practice')),
  started_at bigint not null default ((extract(epoch from clock_timestamp()) * 1000)::bigint),
  completed_at bigint,
  score integer check (score is null or score between 0 and 1000),
  result_data jsonb not null default '{}'::jsonb,
  aura_reward bigint not null default 0 check (aura_reward >= 0),
  xp_reward integer not null default 0 check (xp_reward >= 0),
  season_xp_reward integer not null default 0 check (season_xp_reward >= 0),
  rewarded boolean not null default false,
  rejection_reason text,
  unique (user_id, challenge_key, reward_day, attempt_number)
);

create index if not exists skill_attempts_user_day_idx
  on public.skill_challenge_attempts (user_id, reward_day, challenge_key);

create table if not exists public.skill_challenge_records (
  user_id text not null references public.economy_users(user_id) on delete cascade,
  challenge_key text not null,
  best_score integer not null default 0 check (best_score between 0 and 1000),
  best_result jsonb not null default '{}'::jsonb,
  attempts bigint not null default 0 check (attempts >= 0),
  updated_at bigint not null default ((extract(epoch from clock_timestamp()) * 1000)::bigint),
  primary key (user_id, challenge_key)
);


-- ---------- Careers ----------

create table if not exists public.user_careers (
  user_id text not null references public.economy_users(user_id) on delete cascade,
  career_key text not null,
  career_level integer not null default 1 check (career_level >= 1),
  career_xp bigint not null default 0 check (career_xp >= 0),
  sessions_completed bigint not null default 0 check (sessions_completed >= 0),
  total_score bigint not null default 0 check (total_score >= 0),
  lifetime_aura bigint not null default 0 check (lifetime_aura >= 0),
  updated_at bigint not null default ((extract(epoch from clock_timestamp()) * 1000)::bigint),
  primary key (user_id, career_key)
);

create table if not exists public.job_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id text not null references public.economy_users(user_id) on delete cascade,
  career_key text not null,
  job_key text not null,
  status text not null default 'started'
    check (status in ('started', 'completed', 'rejected')),
  started_at bigint not null default ((extract(epoch from clock_timestamp()) * 1000)::bigint),
  completed_at bigint,
  score integer check (score is null or score between 0 and 1000),
  result_data jsonb not null default '{}'::jsonb,
  aura_reward bigint not null default 0 check (aura_reward >= 0),
  xp_reward integer not null default 0 check (xp_reward >= 0),
  career_xp_reward integer not null default 0 check (career_xp_reward >= 0),
  season_xp_reward integer not null default 0 check (season_xp_reward >= 0),
  rewarded boolean not null default false
);

create index if not exists job_sessions_user_idx
  on public.job_sessions (user_id, started_at desc);


-- ---------- Contracts ----------

create table if not exists public.user_contracts (
  id uuid primary key default gen_random_uuid(),
  user_id text not null references public.economy_users(user_id) on delete cascade,
  contract_key text not null,
  title text not null,
  metric text not null,
  target integer not null check (target > 0),
  progress integer not null default 0 check (progress >= 0),
  aura_reward bigint not null default 0 check (aura_reward >= 0),
  xp_reward integer not null default 0 check (xp_reward >= 0),
  season_xp_reward integer not null default 0 check (season_xp_reward >= 0),
  status text not null default 'active'
    check (status in ('active', 'completed', 'claimed', 'expired', 'cancelled')),
  accepted_at bigint not null default ((extract(epoch from clock_timestamp()) * 1000)::bigint),
  expires_at bigint,
  completed_at bigint,
  claimed_at bigint
);

create index if not exists user_contracts_active_idx
  on public.user_contracts (user_id, status);


-- One active contract per user.
create unique index if not exists user_contracts_one_active_idx
  on public.user_contracts (user_id)
  where status = 'active';


-- ---------- Bounties ----------

create table if not exists public.earning_bounties (
  id text primary key,
  bounty_key text not null,
  title text not null,
  description text not null default '',
  metric text not null,
  target integer not null check (target > 0),
  aura_reward bigint not null default 0 check (aura_reward >= 0),
  xp_reward integer not null default 0 check (xp_reward >= 0),
  season_xp_reward integer not null default 0 check (season_xp_reward >= 0),
  starts_at bigint not null,
  ends_at bigint not null,
  active boolean not null default true,
  check (ends_at > starts_at)
);

create table if not exists public.user_bounty_progress (
  user_id text not null references public.economy_users(user_id) on delete cascade,
  bounty_id text not null references public.earning_bounties(id) on delete cascade,
  progress integer not null default 0 check (progress >= 0),
  completed_at bigint,
  claimed_at bigint,
  primary key (user_id, bounty_id)
);


-- ---------- Achievement claims ----------

create table if not exists public.achievement_claims (
  user_id text not null references public.economy_users(user_id) on delete cascade,
  achievement_key text not null,
  aura_reward bigint not null default 0 check (aura_reward >= 0),
  xp_reward integer not null default 0 check (xp_reward >= 0),
  season_xp_reward integer not null default 0 check (season_xp_reward >= 0),
  claimed_at bigint not null default ((extract(epoch from clock_timestamp()) * 1000)::bigint),
  primary key (user_id, achievement_key)
);


-- ---------- Streak reward claims ----------

create table if not exists public.streak_reward_claims (
  user_id text not null references public.economy_users(user_id) on delete cascade,
  streak_cycle text not null,
  milestone integer not null check (milestone > 0),
  aura_reward bigint not null default 0 check (aura_reward >= 0),
  claimed_at bigint not null default ((extract(epoch from clock_timestamp()) * 1000)::bigint),
  primary key (user_id, streak_cycle, milestone)
);


-- ---------- Season state / reward claims ----------

create table if not exists public.user_seasons (
  user_id text not null references public.economy_users(user_id) on delete cascade,
  season_key text not null,
  season_level integer not null default 1 check (season_level >= 1),
  season_xp bigint not null default 0 check (season_xp >= 0),
  total_season_xp bigint not null default 0 check (total_season_xp >= 0),
  updated_at bigint not null default ((extract(epoch from clock_timestamp()) * 1000)::bigint),
  primary key (user_id, season_key)
);

create table if not exists public.season_reward_claims (
  user_id text not null references public.economy_users(user_id) on delete cascade,
  season_key text not null,
  reward_level integer not null check (reward_level > 0),
  aura_reward bigint not null default 0 check (aura_reward >= 0),
  claimed_at bigint not null default ((extract(epoch from clock_timestamp()) * 1000)::bigint),
  primary key (user_id, season_key, reward_level)
);


-- ---------- Community quests ----------

create table if not exists public.community_quests (
  id text primary key,
  title text not null,
  description text not null default '',
  metric text not null,
  target bigint not null check (target > 0),
  minimum_contribution bigint not null default 1 check (minimum_contribution >= 0),
  aura_reward bigint not null default 0 check (aura_reward >= 0),
  season_xp_reward integer not null default 0 check (season_xp_reward >= 0),
  starts_at bigint not null,
  ends_at bigint not null,
  active boolean not null default true,
  check (ends_at > starts_at)
);

create table if not exists public.community_quest_contributions (
  quest_id text not null references public.community_quests(id) on delete cascade,
  user_id text not null references public.economy_users(user_id) on delete cascade,
  contribution bigint not null default 0 check (contribution >= 0),
  reward_claimed_at bigint,
  updated_at bigint not null default ((extract(epoch from clock_timestamp()) * 1000)::bigint),
  primary key (quest_id, user_id)
);


-- ---------- Item drops ----------

create table if not exists public.earning_item_drops (
  id uuid primary key default gen_random_uuid(),
  user_id text not null references public.economy_users(user_id) on delete cascade,
  source_type text not null,
  source_id text not null,
  item_key text not null,
  item_name text not null,
  rarity text not null
    check (rarity in ('common','uncommon','rare','epic','legendary','limited')),
  metadata jsonb not null default '{}'::jsonb,
  created_at bigint not null default ((extract(epoch from clock_timestamp()) * 1000)::bigint),
  claimed_at bigint
);

create index if not exists earning_item_drops_user_idx
  on public.earning_item_drops (user_id, created_at desc);


-- ============================================================
-- SERVER-AUTHORITATIVE REWARD FUNCTION
-- ============================================================

create or replace function public.claim_earning_reward(
  p_user_id text,
  p_claim_key text,
  p_source_type text,
  p_source_id text,
  p_aura_reward bigint default 0,
  p_xp_reward integer default 0,
  p_season_xp_reward integer default 0,
  p_metadata jsonb default '{}'::jsonb,
  p_season_key text default 'season-01'
)
returns table (
  claimed boolean,
  balance bigint,
  xp integer,
  season_xp bigint,
  version bigint
)
language plpgsql
security definer
set search_path = public
as $$
#variable_conflict use_column
declare
  v_profile jsonb;
  v_balance bigint;
  v_xp integer;
  v_version bigint;
  v_season_xp bigint;
  v_now bigint;
begin
  v_now := (extract(epoch from clock_timestamp()) * 1000)::bigint;

  if p_claim_key is null or btrim(p_claim_key) = '' then
    raise exception 'invalid_claim_key';
  end if;

  if p_aura_reward < 0 or p_xp_reward < 0 or p_season_xp_reward < 0 then
    raise exception 'negative_reward_not_allowed';
  end if;

  -- Lock the real shared Octoson account.
  select eu.profile, eu.balance, eu.xp, eu.version
  into v_profile, v_balance, v_xp, v_version
  from public.economy_users eu
  where eu.user_id = p_user_id
  for update;

  if not found then
    raise exception 'economy_user_not_found';
  end if;

  -- Idempotency protection.
  if exists (
    select 1
    from public.earning_claims ec
    where ec.claim_key = p_claim_key
  ) then
    select us.season_xp
    into v_season_xp
    from public.user_seasons us
    where us.user_id = p_user_id
      and us.season_key = p_season_key;

    return query
    select
      false,
      eu.balance,
      eu.xp,
      coalesce(v_season_xp, 0),
      eu.version
    from public.economy_users eu
    where eu.user_id = p_user_id;

    return;
  end if;

  v_profile := coalesce(v_profile, '{}'::jsonb);
  v_balance := coalesce(v_balance, 0) + p_aura_reward;
  v_xp := coalesce(v_xp, 0) + p_xp_reward;

  -- IMPORTANT:
  -- Keep profile JSON authoritative so the existing mirror trigger
  -- continues to work for both Discord and website code.
  v_profile :=
    jsonb_set(
      jsonb_set(
        v_profile,
        '{balance}',
        to_jsonb(v_balance),
        true
      ),
      '{xp}',
      to_jsonb(v_xp),
      true
    );

  update public.economy_users eu
  set
    profile = v_profile,
    version = eu.version + 1
  where eu.user_id = p_user_id
  returning eu.version into v_version;

  insert into public.earning_claims (
    claim_key,
    user_id,
    source_type,
    source_id,
    aura_reward,
    xp_reward,
    season_xp_reward,
    metadata,
    claimed_at
  )
  values (
    p_claim_key,
    p_user_id,
    p_source_type,
    p_source_id,
    p_aura_reward,
    p_xp_reward,
    p_season_xp_reward,
    coalesce(p_metadata, '{}'::jsonb),
    v_now
  );

  if p_aura_reward > 0 then
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
      'earn:' || p_claim_key,
      p_user_id,
      p_aura_reward,
      p_source_type,
      'Website earning reward',
      coalesce(p_metadata, '{}'::jsonb) ||
        jsonb_build_object('sourceId', p_source_id),
      v_balance - p_aura_reward,
      v_balance,
      v_now
    );
  end if;

  insert into public.user_seasons (
    user_id,
    season_key,
    season_level,
    season_xp,
    total_season_xp,
    updated_at
  )
  values (
    p_user_id,
    p_season_key,
    1,
    p_season_xp_reward,
    p_season_xp_reward,
    v_now
  )
  on conflict (user_id, season_key)
  do update set
    season_xp =
      public.user_seasons.season_xp +
      excluded.season_xp,
    total_season_xp =
      public.user_seasons.total_season_xp +
      excluded.total_season_xp,
    updated_at = v_now;

  select us.season_xp
  into v_season_xp
  from public.user_seasons us
  where us.user_id = p_user_id
    and us.season_key = p_season_key;

  return query
  select
    true,
    eu.balance,
    eu.xp,
    coalesce(v_season_xp, 0),
    eu.version
  from public.economy_users eu
  where eu.user_id = p_user_id;
end;
$$;


-- Do not expose this reward function to anonymous/browser clients.
revoke all on function public.claim_earning_reward(
  text,text,text,text,bigint,integer,integer,jsonb,text
) from public;

revoke all on function public.claim_earning_reward(
  text,text,text,text,bigint,integer,integer,jsonb,text
) from anon;

revoke all on function public.claim_earning_reward(
  text,text,text,text,bigint,integer,integer,jsonb,text
) from authenticated;

grant execute on function public.claim_earning_reward(
  text,text,text,text,bigint,integer,integer,jsonb,text
) to service_role;

commit;
