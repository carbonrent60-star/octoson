import { getSupabaseClient } from './db/supabase.js';
import { ensureEarningMissions } from './earning-system.js';

const DAY_MS = 86_400_000;

function utcDayKey(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

function utcWeekKey(date = new Date()) {
  const copy = new Date(
    Date.UTC(
      date.getUTCFullYear(),
      date.getUTCMonth(),
      date.getUTCDate()
    )
  );

  const day = copy.getUTCDay() || 7;
  copy.setUTCDate(copy.getUTCDate() + 4 - day);

  const yearStart = new Date(
    Date.UTC(copy.getUTCFullYear(), 0, 1)
  );

  const week = Math.ceil(
    (((copy - yearStart) / DAY_MS) + 1) / 7
  );

  return `${copy.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}

export async function recordEarningProgress(
  userId,
  metric,
  amount = 1
) {
  const safeAmount = Math.max(
    0,
    Math.floor(Number(amount) || 0)
  );

  if (!userId || !metric || !safeAmount) return;

  const supabase = getSupabaseClient();

  // Supabase may intentionally be disabled in some environments.
  if (!supabase) return;

  /*
   * Gameplay can happen before the player ever opens /dashboard/earn.
   * Provision the current daily/weekly mission rows first so the action
   * that triggered this call can never be lost.
   */
  try {
    await ensureEarningMissions(supabase, String(userId));
  } catch (error) {
    console.error(
      '[OCTOSON EARN] Mission provisioning failed:',
      error
    );
    return;
  }

  const now = Date.now();
  const today = utcDayKey();
  const week = utcWeekKey();

  const { data: missions, error } = await supabase
    .from('earning_missions')
    .select('id,target,progress,completed_at')
    .eq('user_id', String(userId))
    .eq('metric', metric)
    .or(
      `and(period_type.eq.daily,period_key.eq.${today}),and(period_type.eq.weekly,period_key.eq.${week})`
    );

  if (error) {
    console.error(
      '[OCTOSON EARN] Mission progress load failed:',
      error
    );
    return;
  }

  for (const mission of missions ?? []) {
    const oldProgress = Math.max(
      0,
      Number(mission.progress ?? 0)
    );

    const target = Math.max(
      1,
      Number(mission.target ?? 1)
    );

    if (oldProgress >= target) continue;

    /*
     * Increment inside PostgreSQL instead of doing
     * read -> calculate -> conditional update in Node.
     *
     * This makes mission progression atomic and prevents
     * simultaneous game events from overwriting each other.
     */
    const { error: updateError } = await supabase.rpc(
      'increment_earning_mission_progress',
      {
        p_mission_id: mission.id,
        p_amount: safeAmount,
      }
    );

    if (updateError) {
      console.error(
        '[OCTOSON EARN] Mission progress update failed:',
        updateError
      );
    }
  }

  // Active contract progress.
  const { data: contract, error: contractError } =
    await supabase
      .from('user_contracts')
      .select('id,target,progress,status')
      .eq('user_id', String(userId))
      .eq('status', 'active')
      .eq('metric', metric)
      .maybeSingle();

  if (contractError) {
    console.error(
      '[OCTOSON EARN] Contract progress load failed:',
      contractError
    );
  } else if (contract) {
    const oldProgress = Math.max(
      0,
      Number(contract.progress ?? 0)
    );

    const target = Math.max(
      1,
      Number(contract.target ?? 1)
    );

    if (oldProgress < target) {
      const newProgress = Math.min(
        target,
        oldProgress + safeAmount
      );

      const update = {
        progress: newProgress,
      };

      if (newProgress >= target) {
        update.status = 'completed';
        update.completed_at = now;
      }

      const { error: updateError } = await supabase
        .from('user_contracts')
        .update(update)
        .eq('id', contract.id)
        .eq('progress', oldProgress);

      if (updateError) {
        console.error(
          '[OCTOSON EARN] Contract progress update failed:',
          updateError
        );
      }
    }
  }

  // Active bounty progress.
  const { data: bounties, error: bountyError } =
    await supabase
      .from('earning_bounties')
      .select('id,target')
      .eq('active', true)
      .eq('metric', metric)
      .lte('starts_at', now)
      .gt('ends_at', now);

  if (bountyError) {
    console.error(
      '[OCTOSON EARN] Bounty load failed:',
      bountyError
    );
    return;
  }

  for (const bounty of bounties ?? []) {
    const { data: current, error: progressError } =
      await supabase
        .from('user_bounty_progress')
        .select('progress,completed_at')
        .eq('user_id', String(userId))
        .eq('bounty_id', bounty.id)
        .maybeSingle();

    if (progressError) {
      console.error(
        '[OCTOSON EARN] Bounty progress load failed:',
        progressError
      );
      continue;
    }

    const oldProgress = Math.max(
      0,
      Number(current?.progress ?? 0)
    );

    const target = Math.max(
      1,
      Number(bounty.target ?? 1)
    );

    if (oldProgress >= target) continue;

    const newProgress = Math.min(
      target,
      oldProgress + safeAmount
    );

    const { error: upsertError } = await supabase
      .from('user_bounty_progress')
      .upsert(
        {
          user_id: String(userId),
          bounty_id: bounty.id,
          progress: newProgress,
          completed_at:
            newProgress >= target
              ? current?.completed_at ?? now
              : current?.completed_at ?? null,
        },
        {
          onConflict: 'user_id,bounty_id',
        }
      );

    if (upsertError) {
      console.error(
        '[OCTOSON EARN] Bounty progress update failed:',
        upsertError
      );
    }
  }
}
