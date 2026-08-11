begin;

-- ============================================================
-- PUBLIC / PRIVATE LOBBIES
-- Public is the default.
-- ============================================================

alter table public.game_rooms
add column if not exists is_public boolean not null default true;


create index if not exists game_rooms_public_waiting_idx
on public.game_rooms (
  is_public,
  status,
  created_at desc
);


-- ============================================================
-- PER-ROOM BANS
-- A kicked player can never rejoin the same lobby.
-- ============================================================

create table if not exists public.game_room_bans (
  room_id uuid not null
    references public.game_rooms(id)
    on delete cascade,

  user_id text not null,

  banned_by text not null,

  reason text,

  created_at timestamptz not null default now(),

  primary key (room_id, user_id)
);


create index if not exists game_room_bans_user_idx
on public.game_room_bans(user_id);


-- ============================================================
-- REALTIME
-- ============================================================

do $$
begin
  alter publication supabase_realtime
    add table public.game_room_bans;
exception
  when duplicate_object then null;
end;
$$;

commit;
