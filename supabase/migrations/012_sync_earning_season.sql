begin;

create or replace function public.claim_earning_reward(
  p_user_id text,
  p_claim_key text,
  p_source_type text,
  p_source_id text,
  p_aura_reward bigint default 0,
  p_xp_reward integer default 0,
  p_season_xp_reward integer default 0,
  p_metadata jsonb default '{}'::jsonb,
  p_season_key text default 's1_dark_city'
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
  v_now bigint;

  v_season jsonb;
  v_season_key text;
  v_season_level integer;
  v_season_xp bigint;
  v_total_season_xp bigint;
  v_needed bigint;
begin
  v_now := (extract(epoch from clock_timestamp()) * 1000)::bigint;

  if p_claim_key is null or btrim(p_claim_key) = '' then
    raise exception 'invalid_claim_key';
  end if;

  if p_aura_reward < 0
     or p_xp_reward < 0
     or p_season_xp_reward < 0 then
    raise exception 'negative_reward_not_allowed';
  end if;

  select
    eu.profile,
    eu.balance,
    eu.xp,
    eu.version
  into
    v_profile,
    v_balance,
    v_xp,
    v_version
  from public.economy_users eu
  where eu.user_id = p_user_id
  for update;

  if not found then
    raise exception 'economy_user_not_found';
  end if;

  v_profile := coalesce(v_profile, '{}'::jsonb);

  /*
   * Octoson currently has one live season:
   * s1_dark_city
   *
   * Do not allow callers to create a second season namespace
   * accidentally by using the old migration default.
   */
  v_season_key :=
    case
      when coalesce(nullif(btrim(p_season_key), ''), 's1_dark_city')
        in ('s1_dark_city', 'season-01')
      then 's1_dark_city'
      else p_season_key
    end;

  /*
   * Idempotency check.
   */
  if exists (
    select 1
    from public.earning_claims ec
    where ec.claim_key = p_claim_key
  ) then
    select coalesce(
      (eu.profile #>> '{season,xp}')::bigint,
      0
    )
    into v_season_xp
    from public.economy_users eu
    where eu.user_id = p_user_id;

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

  /*
   * Aura + normal XP.
   */
  v_balance := coalesce(v_balance, 0) + p_aura_reward;
  v_xp := coalesce(v_xp, 0) + p_xp_reward;

  /*
   * Existing Discord/profile season is authoritative.
   * Reset malformed/wrong-season state the same way
   * ensureSeason() does in src/economy.js.
   */
  v_season := coalesce(v_profile -> 'season', '{}'::jsonb);

  if coalesce(v_season ->> 'key', '') <> v_season_key then
    v_season := jsonb_build_object(
      'key', v_season_key,
      'xp', 0,
      'level', 1,
      'claimedFree', '[]'::jsonb,
      'claimedPrime', '[]'::jsonb,
      'totalXp', 0
    );
  end if;

  begin
    v_season_level :=
      greatest(
        1,
        least(
          50,
          coalesce((v_season ->> 'level')::integer, 1)
        )
      );
  exception
    when others then
      v_season_level := 1;
  end;

  begin
    v_season_xp :=
      greatest(
        0,
        coalesce((v_season ->> 'xp')::bigint, 0)
      );
  exception
    when others then
      v_season_xp := 0;
  end;

  begin
    v_total_season_xp :=
      greatest(
        v_season_xp,
        coalesce((v_season ->> 'totalXp')::bigint, 0)
      );
  exception
    when others then
      v_total_season_xp := v_season_xp;
  end;

  v_season_xp :=
    v_season_xp + p_season_xp_reward;

  v_total_season_xp :=
    v_total_season_xp + p_season_xp_reward;

  /*
   * Exact same progression formula as:
   *
   * seasonXpNeeded(level) =
   *   180 + (level - 1) * 45
   */
  while v_season_level < 50 loop
    v_needed :=
      180 + ((v_season_level - 1) * 45);

    exit when v_season_xp < v_needed;

    v_season_xp :=
      v_season_xp - v_needed;

    v_season_level :=
      v_season_level + 1;
  end loop;

  /*
   * Preserve claimed reward arrays and any future season fields,
   * but overwrite authoritative progression fields.
   */
  v_season :=
    jsonb_set(
      jsonb_set(
        jsonb_set(
          jsonb_set(
            v_season,
            '{key}',
            to_jsonb(v_season_key),
            true
          ),
          '{xp}',
          to_jsonb(v_season_xp),
          true
        ),
        '{level}',
        to_jsonb(v_season_level),
        true
      ),
      '{totalXp}',
      to_jsonb(v_total_season_xp),
      true
    );

  if jsonb_typeof(v_season -> 'claimedFree') <> 'array' then
    v_season :=
      jsonb_set(
        v_season,
        '{claimedFree}',
        '[]'::jsonb,
        true
      );
  end if;

  if jsonb_typeof(v_season -> 'claimedPrime') <> 'array' then
    v_season :=
      jsonb_set(
        v_season,
        '{claimedPrime}',
        '[]'::jsonb,
        true
      );
  end if;

  /*
   * Update the same profile used by Discord and the website.
   * Existing mirror trigger keeps balance/xp columns synced.
   */
  v_profile :=
    jsonb_set(
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
      ),
      '{season}',
      v_season,
      true
    );

  update public.economy_users eu
  set
    profile = v_profile,
    version = eu.version + 1
  where eu.user_id = p_user_id
  returning eu.version
  into v_version;

  /*
   * Audit/idempotency record.
   */
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

  /*
   * Shared economy transaction log.
   */
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
        jsonb_build_object(
          'sourceId', p_source_id,
          'seasonKey', v_season_key,
          'seasonXpReward', p_season_xp_reward
        ),
      v_balance - p_aura_reward,
      v_balance,
      v_now
    );
  end if;

  /*
   * Normalized earning table mirrors profile.season.
   * profile.season remains the compatibility source used by
   * Discord and the current website.
   */
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
    v_season_key,
    v_season_level,
    v_season_xp,
    v_total_season_xp,
    v_now
  )
  on conflict (user_id, season_key)
  do update set
    season_level = excluded.season_level,
    season_xp = excluded.season_xp,
    total_season_xp = excluded.total_season_xp,
    updated_at = excluded.updated_at;

  return query
  select
    true,
    eu.balance,
    eu.xp,
    v_season_xp,
    eu.version
  from public.economy_users eu
  where eu.user_id = p_user_id;
end;
$$;

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
