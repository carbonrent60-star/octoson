begin;

create extension if not exists pgcrypto;

create or replace function public.coerce_epoch_ms(p_value text, p_fallback bigint default null)
returns bigint
language plpgsql
stable
as $$
declare
  v_text text;
begin
  v_text := nullif(btrim(p_value), '');

  if v_text is null then
    return p_fallback;
  end if;

  if v_text ~ '^[+-]?\d+$' then
    return v_text::bigint;
  end if;

  begin
    return (extract(epoch from v_text::timestamptz) * 1000)::bigint;
  exception
    when others then
      return p_fallback;
  end;
end;
$$;

create table if not exists public.economy_settings (
  id smallint primary key default 1,
  chests_enabled boolean not null default true,
  chests_updated_at bigint,
  chests_updated_by text,
  safe_mode_enabled boolean not null default false,
  safe_mode_updated_at bigint,
  safe_mode_updated_by text,
  created_at bigint not null default ((extract(epoch from clock_timestamp()) * 1000)::bigint),
  updated_at bigint not null default ((extract(epoch from clock_timestamp()) * 1000)::bigint)
);

insert into public.economy_settings (id)
values (1)
on conflict (id) do nothing;

create table if not exists public.economy_users (
  user_id text primary key,
  version bigint not null default 0,
  profile jsonb not null default '{}'::jsonb,
  balance bigint not null default 500,
  bank bigint not null default 0,
  xp integer not null default 0,
  level integer not null default 1,
  prestige integer not null default 0,
  daily_streak integer not null default 0,
  reputation integer not null default 0,
  rank text not null default '🌱 Yeni başlayan',
  title text not null default 'Yeni üzv',
  created_at bigint not null default ((extract(epoch from clock_timestamp()) * 1000)::bigint),
  updated_at bigint not null default ((extract(epoch from clock_timestamp()) * 1000)::bigint),
  check (bank >= 0),
  check (balance >= -50000),
  check (level between 1 and 50)
);

create index if not exists economy_users_balance_idx on public.economy_users (balance desc, level desc, prestige desc);
create index if not exists economy_users_level_idx on public.economy_users (level desc);

create or replace function public.sync_economy_user_mirrors()
returns trigger
language plpgsql
as $$
declare
  user_profile jsonb;
begin
  user_profile := coalesce(new.profile, '{}'::jsonb);
  new.profile := user_profile;
  new.balance := coalesce((user_profile ->> 'balance')::bigint, new.balance, 500);
  new.bank := coalesce((user_profile ->> 'bank')::bigint, new.bank, 0);
  new.xp := coalesce((user_profile ->> 'xp')::integer, new.xp, 0);
  new.level := coalesce((user_profile ->> 'level')::integer, new.level, 1);
  new.prestige := coalesce((user_profile ->> 'prestige')::integer, new.prestige, 0);
  new.daily_streak := coalesce((user_profile ->> 'dailyStreak')::integer, new.daily_streak, 0);
  new.reputation := coalesce((user_profile ->> 'reputation')::integer, new.reputation, 0);
  new.rank := coalesce(user_profile ->> 'rank', new.rank, '🌱 Yeni başlayan');
  new.title := coalesce(user_profile ->> 'title', new.title, 'Yeni üzv');
  new.updated_at := (extract(epoch from clock_timestamp()) * 1000)::bigint;
  if tg_op = 'INSERT' then
    new.created_at := coalesce(new.created_at, new.updated_at);
  end if;
  return new;
end;
$$;

drop trigger if exists sync_economy_user_mirrors_trigger on public.economy_users;
create trigger sync_economy_user_mirrors_trigger
before insert or update on public.economy_users
for each row execute function public.sync_economy_user_mirrors();

create table if not exists public.economy_transactions (
  id bigserial primary key,
  transaction_key text not null unique,
  user_id text not null references public.economy_users(user_id) on delete cascade,
  amount bigint not null,
  type text not null,
  note text not null default '',
  metadata jsonb not null default '{}'::jsonb,
  balance_before bigint,
  balance_after bigint,
  created_at bigint not null default ((extract(epoch from clock_timestamp()) * 1000)::bigint),
  check (amount <> 0)
);

create index if not exists economy_transactions_user_idx on public.economy_transactions (user_id, created_at desc);
create index if not exists economy_transactions_type_idx on public.economy_transactions (type, created_at desc);

create table if not exists public.user_restrictions (
  id text primary key,
  user_id text not null references public.economy_users(user_id) on delete cascade,
  type text not null,
  moderator_id text not null,
  reason text not null default '',
  meta jsonb not null default '{}'::jsonb,
  created_at bigint not null default ((extract(epoch from clock_timestamp()) * 1000)::bigint),
  expires_at bigint
);

create index if not exists user_restrictions_user_type_idx on public.user_restrictions (user_id, type);
create index if not exists user_restrictions_expires_idx on public.user_restrictions (expires_at);

create table if not exists public.moderation_settings (
  id smallint primary key default 1,
  staff_channel_id text,
  created_at bigint not null default ((extract(epoch from clock_timestamp()) * 1000)::bigint),
  updated_at bigint not null default ((extract(epoch from clock_timestamp()) * 1000)::bigint)
);

insert into public.moderation_settings (id)
values (1)
on conflict (id) do nothing;

create table if not exists public.moderation_cases (
  id bigint generated by default as identity primary key,
  type text not null default 'action',
  moderator_id text not null,
  target_id text not null,
  reason text not null default '',
  evidence jsonb not null default '[]'::jsonb,
  meta jsonb not null default '{}'::jsonb,
  status text not null default 'open',
  created_at bigint not null default ((extract(epoch from clock_timestamp()) * 1000)::bigint),
  resolved_at bigint,
  resolved_by text
);

create index if not exists moderation_cases_target_idx on public.moderation_cases (target_id, status);
create index if not exists moderation_cases_status_idx on public.moderation_cases (status, created_at desc);

create table if not exists public.moderation_reports (
  id text primary key,
  reporter_id text not null,
  target_id text not null,
  message_link text,
  reason text not null default '',
  evidence jsonb not null default '[]'::jsonb,
  status text not null default 'open',
  created_at bigint not null default ((extract(epoch from clock_timestamp()) * 1000)::bigint)
);

create index if not exists moderation_reports_status_idx on public.moderation_reports (status, created_at desc);

create table if not exists public.parties (
  id text primary key,
  host_id text not null,
  host_username text not null,
  channel_id text,
  created_at bigint not null,
  members jsonb not null default '[]'::jsonb,
  status text not null default 'waiting',
  xp integer not null default 0,
  level integer not null default 1,
  pot_bonus_percent integer not null default 10,
  max_players integer not null default 8,
  game_queue jsonb not null default '[]'::jsonb,
  updated_at bigint not null default ((extract(epoch from clock_timestamp()) * 1000)::bigint)
);

create index if not exists parties_host_idx on public.parties (host_id);

create table if not exists public.aura_drops (
  id text primary key,
  amount bigint not null,
  claims integer not null,
  creator_id text not null,
  claimed_by jsonb not null default '[]'::jsonb,
  claim_records jsonb not null default '[]'::jsonb,
  created_at bigint not null,
  expires_at bigint,
  cancel_available_until bigint,
  paid_at bigint,
  cancelled_at bigint,
  cancelled_by text,
  channel_id text,
  message_id text,
  mode text not null default 'same',
  remaining_amount bigint,
  version bigint not null default 0,
  updated_at bigint not null default ((extract(epoch from clock_timestamp()) * 1000)::bigint),
  check (claims > 0),
  check (amount >= 0)
);

create index if not exists aura_drops_expires_idx on public.aura_drops (expires_at);
create index if not exists aura_drops_paid_idx on public.aura_drops (paid_at);

create table if not exists public.ui_emotes (
  key text primary key,
  value text,
  emoji_id text,
  emoji_name text,
  animated boolean not null default false,
  updated_at bigint not null default ((extract(epoch from clock_timestamp()) * 1000)::bigint)
);

create table if not exists public.live_leaderboard_state (
  id smallint primary key default 1,
  channel_id text,
  message_id text,
  updated_at bigint not null default ((extract(epoch from clock_timestamp()) * 1000)::bigint)
);

insert into public.live_leaderboard_state (id)
values (1)
on conflict (id) do nothing;

create table if not exists public.mogger_sessions (
  session_id text primary key,
  owner_id text not null,
  target_user_id text,
  subject_label text,
  original_image text,
  reference_images jsonb not null default '[]'::jsonb,
  history jsonb not null default '[]'::jsonb,
  stack jsonb not null default '[]'::jsonb,
  analysis jsonb not null default '{}'::jsonb,
  generation_count integer not null default 0,
  aura_spent bigint not null default 0,
  is_public boolean not null default false,
  share_channel_id text,
  share_message_id text,
  latest_generation_id text,
  last_mode text not null default 'analysis',
  status text not null default 'active',
  created_at bigint not null default ((extract(epoch from clock_timestamp()) * 1000)::bigint),
  updated_at bigint not null default ((extract(epoch from clock_timestamp()) * 1000)::bigint),
  expires_at bigint,
  check (generation_count >= 0),
  check (aura_spent >= 0)
);

create index if not exists mogger_sessions_owner_idx on public.mogger_sessions (owner_id, updated_at desc);
create index if not exists mogger_sessions_status_idx on public.mogger_sessions (status, updated_at desc);
create index if not exists mogger_sessions_public_idx on public.mogger_sessions (is_public, updated_at desc);
create index if not exists mogger_sessions_expires_idx on public.mogger_sessions (expires_at);

create table if not exists public.mogger_generations (
  id text primary key,
  session_id text not null references public.mogger_sessions(session_id) on delete cascade,
  kind text not null default 'analysis',
  mode text not null default 'analysis',
  label text not null default '',
  prompt text not null default '',
  summary text not null default '',
  analysis jsonb not null default '{}'::jsonb,
  stack_snapshot jsonb not null default '[]'::jsonb,
  details jsonb not null default '{}'::jsonb,
  aura_spent bigint not null default 0,
  created_at bigint not null default ((extract(epoch from clock_timestamp()) * 1000)::bigint)
);

create index if not exists mogger_generations_session_idx on public.mogger_generations (session_id, created_at asc);

create table if not exists public.mogger_votes (
  id text primary key,
  session_id text not null references public.mogger_sessions(session_id) on delete cascade,
  voter_id text not null,
  vote integer not null default 1,
  created_at bigint not null default ((extract(epoch from clock_timestamp()) * 1000)::bigint),
  updated_at bigint not null default ((extract(epoch from clock_timestamp()) * 1000)::bigint),
  unique (session_id, voter_id)
);

create index if not exists mogger_votes_session_idx on public.mogger_votes (session_id, updated_at desc);
create index if not exists mogger_votes_voter_idx on public.mogger_votes (voter_id, updated_at desc);

create or replace function public.save_economy_profile(
  p_user_id text,
  p_expected_version bigint,
  p_profile jsonb,
  p_transactions jsonb default '[]'::jsonb,
  p_idempotency_key text default null
)
returns table (
  version bigint,
  balance bigint,
  bank bigint,
  xp integer,
  level integer,
  prestige integer,
  daily_streak integer,
  rank text
)
language plpgsql
as $$
#variable_conflict use_column
declare
  v_current_version bigint;
  v_new_version bigint;
  v_profile jsonb;
  v_tx jsonb;
  v_existing_key text;
begin
  v_profile := coalesce(p_profile, '{}'::jsonb);

  if p_idempotency_key is not null then
    select transaction_key into v_existing_key
    from public.economy_transactions
    where transaction_key = p_idempotency_key
    limit 1;

    if v_existing_key is not null then
      return query
      select eu.version as version, eu.balance, eu.bank, eu.xp, eu.level, eu.prestige, eu.daily_streak, eu.rank
      from public.economy_users eu
      where eu.user_id = p_user_id;
      return;
    end if;
  end if;

  select eu.version into v_current_version
  from public.economy_users eu
  where eu.user_id = p_user_id
  for update;

  if not found then
    if coalesce(p_expected_version, 0) <> 0 then
      raise exception 'version_conflict';
    end if;

    insert into public.economy_users as eu (user_id, version, profile)
    values (p_user_id, 0, v_profile)
    returning eu.version into v_new_version;
  else
    if v_current_version <> coalesce(p_expected_version, 0) then
      raise exception 'version_conflict';
    end if;

    update public.economy_users as eu
    set profile = v_profile,
        version = eu.version + 1
    where eu.user_id = p_user_id
    returning eu.version into v_new_version;
  end if;

  for v_tx in select * from jsonb_array_elements(coalesce(p_transactions, '[]'::jsonb)) loop
    v_tx := coalesce(v_tx, '{}'::jsonb);
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
    ) values (
      coalesce(v_tx ->> 'id', v_tx ->> 'key', v_tx ->> 'transactionKey', md5(p_user_id || '|' || coalesce(v_tx ->> 'createdAt', v_tx ->> 'created_at', v_tx ->> 'at', '') || '|' || coalesce(v_tx ->> 'amount', '') || '|' || coalesce(v_tx ->> 'type', '') || '|' || coalesce(v_tx ->> 'note', ''))),
      p_user_id,
      coalesce((v_tx ->> 'amount')::bigint, 0),
      coalesce(v_tx ->> 'type', 'transaction'),
      coalesce(v_tx ->> 'note', ''),
      coalesce(v_tx -> 'metadata', '{}'::jsonb),
      nullif(v_tx ->> 'balanceBefore', '')::bigint,
      nullif(v_tx ->> 'balanceAfter', '')::bigint,
      coalesce(
        public.coerce_epoch_ms(v_tx ->> 'createdAt', null),
        public.coerce_epoch_ms(v_tx ->> 'created_at', null),
        public.coerce_epoch_ms(v_tx ->> 'at', null),
        (extract(epoch from clock_timestamp()) * 1000)::bigint
      )
    ) on conflict (transaction_key) do nothing;
  end loop;

  return query
  select eu.version as version, eu.balance, eu.bank, eu.xp, eu.level, eu.prestige, eu.daily_streak, eu.rank
  from public.economy_users eu
  where eu.user_id = p_user_id;
end;
$$;

create or replace function public.transfer_economy_profiles(
  p_from_user_id text,
  p_from_expected_version bigint,
  p_from_profile jsonb,
  p_from_transactions jsonb,
  p_to_user_id text,
  p_to_expected_version bigint,
  p_to_profile jsonb,
  p_to_transactions jsonb,
  p_idempotency_key text default null
)

returns table (
  from_version bigint,
  to_version bigint,
  from_balance bigint,
  to_balance bigint
)
language plpgsql
as $$
#variable_conflict use_column
declare
  v_from_version bigint;
  v_to_version bigint;
  v_existing_key text;
  v_tx jsonb;
begin
  if p_from_user_id = p_to_user_id then
    raise exception 'same_user_transfer_not_allowed';
  end if;

  if p_idempotency_key is not null then
    select transaction_key into v_existing_key
    from public.economy_transactions
    where transaction_key in (p_idempotency_key || ':from', p_idempotency_key || ':to')
    limit 1;

    if v_existing_key is not null then
      return query
      select ef.version as from_version, et.version as to_version, ef.balance, et.balance
      from public.economy_users ef
      join public.economy_users et on et.user_id = p_to_user_id
      where ef.user_id = p_from_user_id;
      return;
    end if;
  end if;

  perform 1
  from public.economy_users eu
  where eu.user_id in (p_from_user_id, p_to_user_id)
  order by eu.user_id
  for update;

  select eu.version into v_from_version
  from public.economy_users eu
  where eu.user_id = p_from_user_id;

  select eu.version into v_to_version
  from public.economy_users eu
  where eu.user_id = p_to_user_id;

  if coalesce(v_from_version, 0) <> coalesce(p_from_expected_version, 0)
     or coalesce(v_to_version, 0) <> coalesce(p_to_expected_version, 0) then
    raise exception 'version_conflict';
  end if;

  update public.economy_users as eu
  set profile = coalesce(p_from_profile, '{}'::jsonb),
      version = eu.version + 1
  where eu.user_id = p_from_user_id
  returning eu.version into v_from_version;

  update public.economy_users as eu
  set profile = coalesce(p_to_profile, '{}'::jsonb),
      version = eu.version + 1
  where eu.user_id = p_to_user_id
  returning eu.version into v_to_version;

  for v_tx in select * from jsonb_array_elements(coalesce(p_from_transactions, '[]'::jsonb)) loop
    v_tx := coalesce(v_tx, '{}'::jsonb);
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
    ) values (
      coalesce(v_tx ->> 'id', v_tx ->> 'key', v_tx ->> 'transactionKey', md5(p_from_user_id || '|' || coalesce(v_tx ->> 'createdAt', v_tx ->> 'created_at', v_tx ->> 'at', '') || '|' || coalesce(v_tx ->> 'amount', '') || '|' || coalesce(v_tx ->> 'type', '') || '|' || coalesce(v_tx ->> 'note', ''))),
      p_from_user_id,
      coalesce((v_tx ->> 'amount')::bigint, 0),
      coalesce(v_tx ->> 'type', 'transaction'),
      coalesce(v_tx ->> 'note', ''),
      coalesce(v_tx -> 'metadata', '{}'::jsonb),
      nullif(v_tx ->> 'balanceBefore', '')::bigint,
      nullif(v_tx ->> 'balanceAfter', '')::bigint,
      coalesce(
        public.coerce_epoch_ms(v_tx ->> 'createdAt', null),
        public.coerce_epoch_ms(v_tx ->> 'created_at', null),
        public.coerce_epoch_ms(v_tx ->> 'at', null),
        (extract(epoch from clock_timestamp()) * 1000)::bigint
      )
    ) on conflict (transaction_key) do nothing;
  end loop;

  for v_tx in select * from jsonb_array_elements(coalesce(p_to_transactions, '[]'::jsonb)) loop
    v_tx := coalesce(v_tx, '{}'::jsonb);
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
    ) values (
      coalesce(v_tx ->> 'id', v_tx ->> 'key', v_tx ->> 'transactionKey', md5(p_to_user_id || '|' || coalesce(v_tx ->> 'createdAt', v_tx ->> 'created_at', v_tx ->> 'at', '') || '|' || coalesce(v_tx ->> 'amount', '') || '|' || coalesce(v_tx ->> 'type', '') || '|' || coalesce(v_tx ->> 'note', ''))),
      p_to_user_id,
      coalesce((v_tx ->> 'amount')::bigint, 0),
      coalesce(v_tx ->> 'type', 'transaction'),
      coalesce(v_tx ->> 'note', ''),
      coalesce(v_tx -> 'metadata', '{}'::jsonb),
      nullif(v_tx ->> 'balanceBefore', '')::bigint,
      nullif(v_tx ->> 'balanceAfter', '')::bigint,
      coalesce(
        public.coerce_epoch_ms(v_tx ->> 'createdAt', null),
        public.coerce_epoch_ms(v_tx ->> 'created_at', null),
        public.coerce_epoch_ms(v_tx ->> 'at', null),
        (extract(epoch from clock_timestamp()) * 1000)::bigint
      )
    ) on conflict (transaction_key) do nothing;
  end loop;

  return query
  select ef.version as from_version, et.version as to_version, ef.balance, et.balance
  from public.economy_users ef
  join public.economy_users et on et.user_id = p_to_user_id
  where ef.user_id = p_from_user_id;
end;
$$;

commit;