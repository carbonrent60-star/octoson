begin;

create table if not exists public.web_presence (
  user_id text primary key,
  path text not null default '/dashboard',
  last_seen bigint not null default (
    (extract(epoch from clock_timestamp()) * 1000)::bigint
  ),
  created_at bigint not null default (
    (extract(epoch from clock_timestamp()) * 1000)::bigint
  )
);

create index if not exists web_presence_last_seen_idx
on public.web_presence (last_seen desc);

commit;
