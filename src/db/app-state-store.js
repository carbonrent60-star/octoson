import { clone, isMemoryStorageEnabled, nowMs, toNumber } from './helpers.js';
import { getSupabaseClient } from './supabase.js';
import { memoryState } from './memory-state.js';

function normalizeUiEmoteRow(row) {
  if (!row) return null;
  return {
    id: row.value ? null : row.emoji_id ?? null,
    name: row.value ? null : row.emoji_name ?? null,
    animated: Boolean(row.animated),
    value: row.value ?? null
  };
}

function normalizeAuraDrop(row) {
  if (!row) return null;
  return {
    id: row.id,
    amount: toNumber(row.amount, 0),
    claims: toNumber(row.claims, 0),
    creatorId: row.creator_id,
    claimedBy: Array.isArray(row.claimed_by) ? clone(row.claimed_by) : clone(row.claimed_by ?? []),
    claimRecords: Array.isArray(row.claim_records) ? clone(row.claim_records) : clone(row.claim_records ?? []),
    createdAt: toNumber(row.created_at, nowMs()),
    expiresAt: row.expires_at == null ? null : toNumber(row.expires_at, null),
    cancelAvailableUntil: row.cancel_available_until == null ? null : toNumber(row.cancel_available_until, null),
    paidAt: row.paid_at == null ? null : toNumber(row.paid_at, null),
    cancelledAt: row.cancelled_at == null ? null : toNumber(row.cancelled_at, null),
    cancelledBy: row.cancelled_by ?? null,
    channelId: row.channel_id ?? null,
    messageId: row.message_id ?? null,
    mode: row.mode === 'random' ? 'random' : 'same',
    remainingAmount: row.remaining_amount == null ? null : toNumber(row.remaining_amount, null),
    version: toNumber(row.version, 0)
  };
}

function normalizeLiveLeaderboardState(row) {
  return {
    channelId: row?.channel_id ?? null,
    messageId: row?.message_id ?? null
  };
}

function uiEmoteRowsToObject(rows) {
  const emotes = {};
  for (const row of rows ?? []) {
    emotes[row.key] = normalizeUiEmoteRow(row);
  }
  return emotes;
}

export async function loadUiEmotes() {
  if (isMemoryStorageEnabled()) {
    return Object.fromEntries([...memoryState.app.uiEmotes.entries()].map(([key, value]) => [key, clone(value)]));
  }

  const client = getSupabaseClient();
  const { data, error } = await client.from('ui_emotes').select('*');
  if (error) throw error;
  return uiEmoteRowsToObject(data);
}

export async function saveUiEmotes(store) {
  const next = clone(store ?? {});

  if (isMemoryStorageEnabled()) {
    memoryState.app.uiEmotes = new Map(Object.entries(next));
    return next;
  }

  const client = getSupabaseClient();
  const rows = Object.entries(next).map(([key, emote]) => ({
    key,
    value: emote?.value ?? null,
    emoji_id: emote?.id ?? null,
    emoji_name: emote?.name ?? null,
    animated: Boolean(emote?.animated),
    updated_at: nowMs()
  }));

  if (rows.length === 0) {
    return next;
  }

  const { error } = await client.from('ui_emotes').upsert(rows, { onConflict: 'key' });
  if (error) throw error;
  return next;
}

export async function loadLiveLeaderboardState() {
  if (isMemoryStorageEnabled()) {
    return clone(memoryState.app.liveLeaderboard ?? { channelId: null, messageId: null });
  }

  const client = getSupabaseClient();
  const { data, error } = await client.from('live_leaderboard_state').select('*').eq('id', 1).maybeSingle();
  if (error) throw error;
  return normalizeLiveLeaderboardState(data);
}

export async function saveLiveLeaderboardState(state) {
  const next = normalizeLiveLeaderboardState(state);

  if (isMemoryStorageEnabled()) {
    memoryState.app.liveLeaderboard = clone(next);
    return next;
  }

  const client = getSupabaseClient();
  const { error } = await client.from('live_leaderboard_state').upsert({
    id: 1,
    channel_id: next.channelId,
    message_id: next.messageId,
    updated_at: nowMs()
  }, { onConflict: 'id' });
  if (error) throw error;
  return next;
}

export async function loadAuraDrops() {
  if (isMemoryStorageEnabled()) {
    return Object.fromEntries([...memoryState.app.auraDrops.entries()].map(([id, drop]) => [id, clone(drop)]));
  }

  const client = getSupabaseClient();
  const { data, error } = await client.from('aura_drops').select('*');
  if (error) throw error;

  const drops = {};
  for (const row of data ?? []) {
    const drop = normalizeAuraDrop(row);
    drops[drop.id] = drop;
  }
  return drops;
}

export async function loadAuraDrop(dropId) {
  if (isMemoryStorageEnabled()) {
    return clone(memoryState.app.auraDrops.get(dropId) ?? null);
  }

  const client = getSupabaseClient();
  const { data, error } = await client.from('aura_drops').select('*').eq('id', dropId).maybeSingle();
  if (error) throw error;
  return normalizeAuraDrop(data);
}

export async function saveAuraDrop(drop) {
  // Accept BOTH the in-app camelCase object and
  // Supabase snake_case rows.
  const next = {
    id: drop.id,
    amount: toNumber(drop.amount, 0),
    claims: toNumber(drop.claims, 0),

    creatorId:
      drop.creatorId ??
      drop.creator_id ??
      null,

    claimedBy: clone(
      drop.claimedBy ??
      drop.claimed_by ??
      []
    ),

    claimRecords: clone(
      drop.claimRecords ??
      drop.claim_records ??
      []
    ),

    createdAt: toNumber(
      drop.createdAt ??
      drop.created_at,
      nowMs()
    ),

    expiresAt:
      (drop.expiresAt ?? drop.expires_at) == null
        ? null
        : toNumber(
            drop.expiresAt ?? drop.expires_at,
            null
          ),

    cancelAvailableUntil:
      (
        drop.cancelAvailableUntil ??
        drop.cancel_available_until
      ) == null
        ? null
        : toNumber(
            drop.cancelAvailableUntil ??
            drop.cancel_available_until,
            null
          ),

    paidAt:
      (drop.paidAt ?? drop.paid_at) == null
        ? null
        : toNumber(
            drop.paidAt ?? drop.paid_at,
            null
          ),

    cancelledAt:
      (drop.cancelledAt ?? drop.cancelled_at) == null
        ? null
        : toNumber(
            drop.cancelledAt ??
            drop.cancelled_at,
            null
          ),

    cancelledBy:
      drop.cancelledBy ??
      drop.cancelled_by ??
      null,

    channelId:
      drop.channelId ??
      drop.channel_id ??
      null,

    messageId:
      drop.messageId ??
      drop.message_id ??
      null,

    mode:
      drop.mode === 'random'
        ? 'random'
        : 'same',

    remainingAmount:
      (
        drop.remainingAmount ??
        drop.remaining_amount
      ) == null
        ? null
        : toNumber(
            drop.remainingAmount ??
            drop.remaining_amount,
            null
          ),

    version: toNumber(
      drop.version,
      0
    )
  };

  // creator_id is NOT NULL in Supabase.
  // Fail here with a useful error instead of a vague DB error.
  if (!next.creatorId) {
    throw new Error(
      `saveAuraDrop: creatorId yoxdur. drop.id=${next.id}`
    );
  }

  if (isMemoryStorageEnabled()) {
    memoryState.app.auraDrops.set(
      next.id,
      clone(next)
    );

    return next;
  }

  const client = getSupabaseClient();

  const { error } = await client
    .from('aura_drops')
    .upsert(
      {
        id: next.id,
        amount: next.amount,
        claims: next.claims,

        creator_id: next.creatorId,

        claimed_by: clone(next.claimedBy),
        claim_records: clone(next.claimRecords),

        created_at: next.createdAt,
        expires_at: next.expiresAt,

        cancel_available_until:
          next.cancelAvailableUntil,

        paid_at: next.paidAt,

        cancelled_at: next.cancelledAt,
        cancelled_by: next.cancelledBy,

        channel_id: next.channelId,
        message_id: next.messageId,

        mode: next.mode,

        remaining_amount:
          next.remainingAmount,

        version: next.version,

        updated_at: nowMs()
      },
      {
        onConflict: 'id'
      }
    );

  if (error) throw error;

  return next;
}

export async function deleteAuraDrop(dropId) {
  if (isMemoryStorageEnabled()) {
    memoryState.app.auraDrops.delete(dropId);
    return;
  }

  const client = getSupabaseClient();
  const { error } = await client.from('aura_drops').delete().eq('id', dropId);
  if (error) throw error;
}
