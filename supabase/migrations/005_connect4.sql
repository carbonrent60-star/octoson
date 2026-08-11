begin;

create or replace function public.play_connect4_move(
  p_match_id uuid,
  p_user_id text,
  p_column integer
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_match public.game_matches%rowtype;
  v_state jsonb;
  v_board jsonb;
  v_players jsonb;
  v_player_one text;
  v_player_two text;
  v_turn text;
  v_row integer := -1;
  v_r integer;
  v_c integer;
  v_count integer;
  v_winner text := null;
  v_finished boolean := false;
  v_draw boolean := false;
  v_cell text;
  v_dr integer;
  v_dc integer;
  v_step integer;
begin
  if p_column < 0 or p_column > 6 then
    raise exception 'invalid_column';
  end if;

  select gm.*
  into v_match
  from public.game_matches gm
  where gm.id = p_match_id
  for update;

  if not found then
    raise exception 'match_not_found';
  end if;

  if v_match.game <> 'connect4' then
    raise exception 'not_connect4';
  end if;

  if v_match.status <> 'playing' then
    raise exception 'match_not_playing';
  end if;

  v_state := coalesce(v_match.state, '{}'::jsonb);
  v_board := v_state -> 'board';
  v_players := v_state -> 'players';

  if
    v_board is null
    or jsonb_typeof(v_board) <> 'array'
    or jsonb_array_length(v_board) <> 6
  then
    raise exception 'invalid_board';
  end if;

  if
    v_players is null
    or jsonb_typeof(v_players) <> 'array'
    or jsonb_array_length(v_players) <> 2
  then
    raise exception 'invalid_players';
  end if;

  v_player_one := v_players ->> 0;
  v_player_two := v_players ->> 1;

  if p_user_id <> v_player_one and p_user_id <> v_player_two then
    raise exception 'not_player';
  end if;

  v_turn := v_state ->> 'turn';

  if v_turn is null then
    raise exception 'missing_turn';
  end if;

  if v_turn <> p_user_id then
    raise exception 'not_your_turn';
  end if;

  for v_r in reverse 5..0 loop
    v_cell := v_board -> v_r ->> p_column;

    if v_cell is null then
      v_row := v_r;
      exit;
    end if;
  end loop;

  if v_row < 0 then
    raise exception 'column_full';
  end if;

  v_board :=
    jsonb_set(
      v_board,
      array[v_row::text, p_column::text],
      to_jsonb(p_user_id),
      false
    );

  for v_dr, v_dc in
    select *
    from (
      values
        (0, 1),
        (1, 0),
        (1, 1),
        (1, -1)
    ) as directions(dr, dc)
  loop
    v_count := 1;

    for v_step in 1..3 loop
      exit when
        v_row + (v_dr * v_step) < 0
        or v_row + (v_dr * v_step) > 5
        or p_column + (v_dc * v_step) < 0
        or p_column + (v_dc * v_step) > 6;

      v_cell :=
        v_board
          -> (v_row + (v_dr * v_step))
          ->> (p_column + (v_dc * v_step));

      exit when v_cell is distinct from p_user_id;

      v_count := v_count + 1;
    end loop;

    for v_step in 1..3 loop
      exit when
        v_row - (v_dr * v_step) < 0
        or v_row - (v_dr * v_step) > 5
        or p_column - (v_dc * v_step) < 0
        or p_column - (v_dc * v_step) > 6;

      v_cell :=
        v_board
          -> (v_row - (v_dr * v_step))
          ->> (p_column - (v_dc * v_step));

      exit when v_cell is distinct from p_user_id;

      v_count := v_count + 1;
    end loop;

    if v_count >= 4 then
      v_winner := p_user_id;
      v_finished := true;
      exit;
    end if;
  end loop;

  if not v_finished then
    v_draw := true;

    for v_r in 0..5 loop
      for v_c in 0..6 loop
        if v_board -> v_r ->> v_c is null then
          v_draw := false;
          exit;
        end if;
      end loop;

      exit when not v_draw;
    end loop;

    if v_draw then
      v_finished := true;
    end if;
  end if;

  v_state :=
    jsonb_set(
      v_state,
      '{board}',
      v_board,
      true
    );

  v_state :=
    jsonb_set(
      v_state,
      '{last_move}',
      jsonb_build_object(
        'user_id', p_user_id,
        'row', v_row,
        'column', p_column
      ),
      true
    );

  v_state :=
    jsonb_set(
      v_state,
      '{moves}',
      to_jsonb(
        coalesce((v_state ->> 'moves')::integer, 0) + 1
      ),
      true
    );

  if v_finished then
    v_state :=
      jsonb_set(
        v_state,
        '{phase}',
        to_jsonb('finished'::text),
        true
      );

    v_state :=
      jsonb_set(
        v_state,
        '{turn}',
        'null'::jsonb,
        true
      );

    v_state :=
      jsonb_set(
        v_state,
        '{draw}',
        to_jsonb(v_draw),
        true
      );

    update public.game_matches gm
    set
      state = v_state,
      status = 'finished',
      winner_id = v_winner,
      ended_at = now()
    where gm.id = p_match_id;
  else
    v_state :=
      jsonb_set(
        v_state,
        '{turn}',
        to_jsonb(
          case
            when p_user_id = v_player_one
              then v_player_two
            else v_player_one
          end
        ),
        true
      );

    update public.game_matches gm
    set state = v_state
    where gm.id = p_match_id;
  end if;

  return jsonb_build_object(
    'row', v_row,
    'column', p_column,
    'winner_id', v_winner,
    'finished', v_finished,
    'draw', v_draw,
    'state', v_state
  );
end;
$$;

commit;
