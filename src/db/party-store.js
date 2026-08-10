import { clone, isMemoryStorageEnabled, nowMs, toNumber } from './helpers.js';
import { getSupabaseClient } from './supabase.js';
import { memoryState } from './memory-state.js';

function normalizeParty(row) {
  return {
    id: row.id,
    hostId: row.host_id,
    hostUsername: row.host_username,
    channelId: row.channel_id ?? null,
    createdAt: toNumber(row.created_at, nowMs()),
    members: Array.isArray(row.members) ? clone(row.members) : clone(row.members ?? []),
    status: row.status ?? 'waiting',
    xp: toNumber(row.xp, 0),
    level: toNumber(row.level, 1),
    potBonusPercent: toNumber(row.pot_bonus_percent, 10),
    maxPlayers: toNumber(row.max_players, 8),
    gameQueue: Array.isArray(row.game_queue) ? clone(row.game_queue) : clone(row.game_queue ?? [])
  };
}

export async function loadPartyStore() {
  if (isMemoryStorageEnabled()) {
    return { parties: new Map([...memoryState.party.parties.entries()].map(([id, party]) => [id, clone(party)])) };
  }

  const client = getSupabaseClient();
  const { data, error } = await client.from('parties').select('*');
  if (error) throw error;

  const parties = new Map();
  for (const row of data ?? []) {
    parties.set(row.id, normalizeParty(row));
  }

  return { parties };
}

export async function savePartyStore(store) {
  const parties = store?.parties instanceof Map ? store.parties : new Map(Object.entries(store?.parties ?? {}));

  if (isMemoryStorageEnabled()) {
    memoryState.party.parties = new Map([...parties.entries()].map(([id, party]) => [id, clone(party)]));
    return store;
  }

  const client = getSupabaseClient();
  const partyIds = [...parties.keys()];

  if (partyIds.length === 0) {
    return store;
  }

  const rows = [...parties.values()].map(party => ({
    id: party.id,
    host_id: party.hostId,
    host_username: party.hostUsername,
    channel_id: party.channelId ?? null,
    created_at: toNumber(party.createdAt, nowMs()),
    members: clone(party.members ?? []),
    status: party.status ?? 'waiting',
    xp: toNumber(party.xp, 0),
    level: toNumber(party.level, 1),
    pot_bonus_percent: toNumber(party.potBonusPercent, 10),
    max_players: toNumber(party.maxPlayers, 8),
    game_queue: clone(party.gameQueue ?? []),
    updated_at: nowMs()
  }));

  const upsertResult = await client.from('parties').upsert(rows, { onConflict: 'id' });
  if (upsertResult.error) throw upsertResult.error;

  const removeResult = await client.from('parties').delete().not('id', 'in', `(${partyIds.map(id => `'${id.replaceAll("'", "''")}'`).join(',')})`);
  if (removeResult.error) {
    // If the delete filter is unsupported by the driver, keep the current rows as-is.
    if (!`${removeResult.error.message ?? ''}`.includes('invalid input syntax')) {
      throw removeResult.error;
    }
  }

  return store;
}
