CREATE OR REPLACE FUNCTION public.settle_blackjack_wagers(
  p_match_id uuid,
  p_results jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_wager record;
  v_result text;
  v_credit bigint;
  v_balance bigint;
  v_profile jsonb;
  v_now bigint;
  v_total_credit bigint := 0;
  v_processed integer := 0;
BEGIN
  IF p_results IS NULL
     OR jsonb_typeof(p_results) <> 'object' THEN
    RAISE EXCEPTION 'invalid_blackjack_results';
  END IF;

  v_now :=
    (extract(epoch from clock_timestamp()) * 1000)::bigint;

  /*
   * Lock the wager rows for this match.
   * Only rows still marked "locked" are settled.
   */
  PERFORM 1
  FROM public.game_wagers gw
  WHERE gw.match_id = p_match_id
  ORDER BY gw.user_id
  FOR UPDATE;

  FOR v_wager IN
    SELECT gw.*
    FROM public.game_wagers gw
    WHERE gw.match_id = p_match_id
      AND gw.status = 'locked'
    ORDER BY gw.user_id
    FOR UPDATE
  LOOP
    v_result := p_results ->> v_wager.user_id;

    IF v_result IS NULL THEN
      RAISE EXCEPTION
        'missing_blackjack_result:%',
        v_wager.user_id;
    END IF;

    IF v_result NOT IN ('win', 'lose', 'push') THEN
      RAISE EXCEPTION
        'invalid_blackjack_result:%:%',
        v_wager.user_id,
        v_result;
    END IF;

    /*
     * Bet was already deducted by lock_game_wager().
     *
     * WIN:
     *   return stake + winnings = 2x bet
     *
     * PUSH:
     *   return original stake = 1x bet
     *
     * LOSE:
     *   return nothing
     */
    v_credit :=
      CASE v_result
        WHEN 'win' THEN v_wager.amount * 2
        WHEN 'push' THEN v_wager.amount
        ELSE 0
      END;

    IF v_credit > 0 THEN
      SELECT
        eu.balance,
        coalesce(eu.profile, '{}'::jsonb)
      INTO
        v_balance,
        v_profile
      FROM public.economy_users eu
      WHERE eu.user_id = v_wager.user_id
      FOR UPDATE;

      IF NOT FOUND THEN
        RAISE EXCEPTION
          'economy_user_not_found:%',
          v_wager.user_id;
      END IF;

      v_profile :=
        jsonb_set(
          v_profile,
          '{balance}',
          to_jsonb(v_balance + v_credit),
          true
        );

      UPDATE public.economy_users eu
      SET
        balance = v_balance + v_credit,
        profile = v_profile,
        version = eu.version + 1
      WHERE eu.user_id = v_wager.user_id;

      INSERT INTO public.economy_transactions (
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
      VALUES (
        'game:blackjack:' ||
          p_match_id::text ||
          ':' ||
          v_wager.user_id,

        v_wager.user_id,
        v_credit,

        CASE
          WHEN v_result = 'win'
            THEN 'game_payout'
          ELSE 'game_refund'
        END,

        CASE
          WHEN v_result = 'win'
            THEN 'Party Blackjack qazancı'
          ELSE 'Party Blackjack mərci geri qaytarıldı'
        END,

        jsonb_build_object(
          'matchId', p_match_id,
          'result', v_result,
          'bet', v_wager.amount,
          'credit', v_credit
        ),

        v_balance,
        v_balance + v_credit,
        v_now
      )
      ON CONFLICT (transaction_key)
      DO NOTHING;
    END IF;

    UPDATE public.game_wagers gw
    SET
      status =
        CASE
          WHEN v_result = 'push'
            THEN 'refunded'
          ELSE 'paid'
        END,
      settled_at = now()
    WHERE gw.id = v_wager.id
      AND gw.status = 'locked';

    v_total_credit :=
      v_total_credit + v_credit;

    v_processed :=
      v_processed + 1;
  END LOOP;

  RETURN jsonb_build_object(
    'processed', v_processed,
    'credited', v_total_credit
  );
END;
$function$;

REVOKE ALL
ON FUNCTION public.settle_blackjack_wagers(uuid, jsonb)
FROM PUBLIC;

GRANT EXECUTE
ON FUNCTION public.settle_blackjack_wagers(uuid, jsonb)
TO service_role;
