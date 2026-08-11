alter table public.economy_settings
  add column if not exists casino_enabled boolean not null default true,
  add column if not exists global_casino_max_bet bigint not null default 100000,
  add column if not exists casino_updated_at bigint,
  add column if not exists casino_updated_by text;

update public.economy_settings
set
  casino_enabled = coalesce(casino_enabled, true),
  global_casino_max_bet = coalesce(global_casino_max_bet, 100000)
where id = 1;
