import { clone, isMemoryStorageEnabled, nowMs, toEpochMs, transactionKey, toNumber } from './helpers.js';
import { getSupabaseClient } from './supabase.js';
import { memoryState } from './memory-state.js';

function ensureUserProfileShape(profile = {}) {
  const next = clone(profile) ?? {};
  next.transactions = Array.isArray(next.transactions) ? next.transactions : [];
  next.cooldowns = next.cooldowns && typeof next.cooldowns === 'object' ? next.cooldowns : {};
  next.moderation = next.moderation && typeof next.moderation === 'object' ? next.moderation : {};
  next.settings = next.settings && typeof next.settings === 'object' ? next.settings : {};
  next.limits = next.limits && typeof next.limits === 'object' ? next.limits : {};
  next.loan = next.loan && typeof next.loan === 'object' ? next.loan : {};
  next.prime = next.prime && typeof next.prime === 'object' ? next.prime : {};
  next.world = next.world && typeof next.world === 'object' ? next.world : {};
  next.season = next.season && typeof next.season === 'object' ? next.season : {};
  next.objectiveProgress = next.objectiveProgress && typeof next.objectiveProgress === 'object' ? next.objectiveProgress : {};
  next.onboarding = next.onboarding && typeof next.onboarding === 'object' ? next.onboarding : {};
  next.inventory = next.inventory && typeof next.inventory === 'object' ? next.inventory : {};
  next.stats = next.stats && typeof next.stats === 'object' ? next.stats : {};
  next.badges = Array.isArray(next.badges) ? next.badges : [];
  next.achievements = Array.isArray(next.achievements) ? next.achievements : [];
  next.collection = Array.isArray(next.collection) ? next.collection : [];
  return next;
}

function stripRestrictionShadow(profile) {
  const next = clone(profile) ?? {};
  if (next.moderation && typeof next.moderation === 'object') {
    delete next.moderation.restrictions;
  }
  return next;
}

function attachRestrictions(profile, restrictions = []) {
  const next = ensureUserProfileShape(profile);
  next.moderation.restrictions = restrictions.map(item => clone(item));
  return next;
}

function defaultEconomySettings() {
  return {
    chestsEnabled: true,
    chestsUpdatedAt: null,
    chestsUpdatedBy: null,
    safeModeEnabled: false,
    safeModeUpdatedAt: null,
    safeModeUpdatedBy: null
  };
}

function normalizeStoreUsers(rows = []) {
  const users = {};
  const versions = {};

  for (const row of rows) {
    if (!row?.user_id) continue;
    users[row.user_id] = ensureUserProfileShape(row.profile ?? {});
    versions[row.user_id] = toNumber(row.version, 0);
  }

  return { users, versions };
}

function memoryEconomyRows(userIds = null) {
  const rows = [];
  const entries = userIds == null
    ? [...memoryState.economy.users.entries()]
    : userIds.map(userId => [userId, memoryState.economy.users.get(userId)]).filter(([, row]) => row);

  for (const [userId, row] of entries) {
    rows.push({ user_id: userId, profile: clone(row.profile), version: row.version ?? 0 });
  }

  return rows;
}

function memoryRestrictionRows(userId) {
  return clone(memoryState.economy.restrictions.get(userId) ?? []);
}

function memorySaveRestrictions(userId, restrictions) {
  memoryState.economy.restrictions.set(userId, clone(restrictions ?? []));
}

export async function loadEconomyStore(userIds = null) {
  if (isMemoryStorageEnabled()) {
    const rows = memoryEconomyRows(userIds == null ? null : Array.isArray(userIds) ? userIds : [userIds]);
    const store = normalizeStoreUsers(rows);
    store.settings = clone(memoryState.economy.settings ?? defaultEconomySettings());
    store.versions = { ...store.versions };

    const ids = userIds == null ? Object.keys(store.users) : Array.isArray(userIds) ? userIds : [userIds];
    for (const userId of ids) {
      if (!store.users[userId]) continue;
      store.users[userId] = attachRestrictions(store.users[userId], memoryRestrictionRows(userId));
    }

    return store;
  }

  const client = getSupabaseClient();
  const normalizedIds = userIds == null ? null : Array.isArray(userIds) ? userIds : [userIds];

  const [settingsResult, usersResult, restrictionsResult] = await Promise.all([
    client.from('economy_settings').select('*').eq('id', 1).maybeSingle(),
    normalizedIds == null
      ? client.from('economy_users').select('user_id, profile, version')
      : client.from('economy_users').select('user_id, profile, version').in('user_id', normalizedIds),
    normalizedIds == null
      ? Promise.resolve({ data: [] })
      : client.from('user_restrictions').select('*').in('user_id', normalizedIds)
  ]);

  if (usersResult.error) throw usersResult.error;
  if (settingsResult.error) throw settingsResult.error;
  if (restrictionsResult.error) throw restrictionsResult.error;

  const store = normalizeStoreUsers(usersResult.data ?? []);
  store.versions = store.versions ?? {};
  store.settings = settingsResult.data ? {
    chestsEnabled: settingsResult.data.chests_enabled ?? true,
    chestsUpdatedAt: settingsResult.data.chests_updated_at ?? null,
    chestsUpdatedBy: settingsResult.data.chests_updated_by ?? null,
    safeModeEnabled: settingsResult.data.safe_mode_enabled ?? false,
    safeModeUpdatedAt: settingsResult.data.safe_mode_updated_at ?? null,
    safeModeUpdatedBy: settingsResult.data.safe_mode_updated_by ?? null
  } : defaultEconomySettings();

  const restrictionsQueryIds = normalizedIds ?? Object.keys(store.users);
  const grouped = new Map();

  if (restrictionsQueryIds.length > 0) {
    const restrictionResult = normalizedIds == null
      ? await client.from('user_restrictions').select('*').in('user_id', restrictionsQueryIds)
      : restrictionsResult;

    if (restrictionResult.error) throw restrictionResult.error;

    for (const restriction of restrictionResult.data ?? []) {
      const userId = restriction.user_id;
      if (!grouped.has(userId)) grouped.set(userId, []);
      grouped.get(userId).push({
        id: restriction.id,
        type: restriction.type,
        moderatorId: restriction.moderator_id,
        reason: restriction.reason ?? '',
        meta: restriction.meta ?? {},
        createdAt: toEpochMs(restriction.created_at, nowMs()),
        expiresAt: restriction.expires_at == null ? null : toEpochMs(restriction.expires_at, null)
      });
    }
  }

  for (const userId of restrictionsQueryIds) {
    if (!store.users[userId]) continue;
    store.users[userId] = attachRestrictions(store.users[userId], grouped.get(userId) ?? []);
  }

  return store;
}

export async function saveEconomyStore(store) {
  const users = store?.users ?? {};
  const versions = store?.versions ?? {};

  if (isMemoryStorageEnabled()) {
    memoryState.economy.settings = clone(store?.settings ?? defaultEconomySettings());

    for (const [userId, profile] of Object.entries(users)) {
      const nextProfile = ensureUserProfileShape(stripRestrictionShadow(profile));
      const current = memoryState.economy.users.get(userId);
      const expectedVersion = toNumber(versions[userId], 0);
      const nextVersion = current ? current.version + 1 : 0;

      if (current && toNumber(current.version, 0) !== expectedVersion) {
        throw new Error(`version_conflict:${userId}`);
      }

      memoryState.economy.users.set(userId, {
        profile: nextProfile,
        version: nextVersion
      });
      store.versions[userId] = nextVersion;
      memorySaveRestrictions(userId, nextProfile.moderation?.restrictions ?? []);

      const txs = Array.isArray(nextProfile.transactions) ? nextProfile.transactions : [];
      for (const [index, tx] of txs.entries()) {
        const key = transactionKey(tx, `${userId}:${index}`);
        const createdAt = toEpochMs(tx.createdAt ?? tx.created_at ?? tx.at, nowMs());
        const existingIndex = memoryState.economy.transactions.findIndex(item => item.transaction_key === key);
        const row = {
          transaction_key: key,
          user_id: userId,
          amount: toNumber(tx.amount, 0),
          type: `${tx.type ?? 'transaction'}`,
          note: `${tx.note ?? ''}`,
          metadata: clone(tx.metadata ?? {}),
          balance_before: tx.balanceBefore ?? tx.balance_before ?? null,
          balance_after: tx.balanceAfter ?? tx.balance_after ?? null,
          created_at: createdAt
        };

        if (existingIndex === -1) {
          memoryState.economy.transactions.push(row);
        } else {
          memoryState.economy.transactions[existingIndex] = row;
        }
      }
    }

    return store;
  }

  const client = getSupabaseClient();

  if (store?.settings) {
    const settingsPayload = {
      id: 1,
      chests_enabled: Boolean(store.settings.chestsEnabled),
      chests_updated_at: store.settings.chestsUpdatedAt == null ? null : toEpochMs(store.settings.chestsUpdatedAt, null),
      chests_updated_by: store.settings.chestsUpdatedBy ?? null,
      safe_mode_enabled: Boolean(store.settings.safeModeEnabled),
      safe_mode_updated_at: store.settings.safeModeUpdatedAt == null ? null : toEpochMs(store.settings.safeModeUpdatedAt, null),
      safe_mode_updated_by: store.settings.safeModeUpdatedBy ?? null
    };

    const settingsResult = await client.from('economy_settings').upsert(settingsPayload, { onConflict: 'id' });
    if (settingsResult.error) throw settingsResult.error;
  }

  for (const [userId, profile] of Object.entries(users)) {
    const nextProfile = ensureUserProfileShape(stripRestrictionShadow(profile));
    const expectedVersion = toNumber(versions[userId], 0);
    const txs = Array.isArray(nextProfile.transactions) ? nextProfile.transactions : [];

    const { data, error } = await client.rpc('save_economy_profile', {
      p_user_id: userId,
      p_expected_version: expectedVersion,
      p_profile: nextProfile,
      p_transactions: txs,
      p_idempotency_key: null
    });

    if (error) throw error;
    store.versions[userId] = data?.[0]?.version ?? expectedVersion;

    const restrictions = nextProfile.moderation?.restrictions ?? [];
    const deleteResult = await client.from('user_restrictions').delete().eq('user_id', userId);
    if (deleteResult.error) throw deleteResult.error;

    if (restrictions.length > 0) {
      const rows = restrictions.map(item => ({
        id: item.id,
        user_id: userId,
        type: item.type,
        moderator_id: item.moderatorId,
        reason: item.reason ?? '',
        meta: item.meta ?? {},
        created_at: toNumber(item.createdAt, nowMs()),
        expires_at: item.expiresAt == null ? null : toNumber(item.expiresAt, null)
      }));

      const restrictionResult = await client.from('user_restrictions').insert(rows);
      if (restrictionResult.error) throw restrictionResult.error;
    }
  }

  return store;
}

export async function saveEconomyProfile(userId, profile, expectedVersion = 0, options = {}) {
  const nextProfile = ensureUserProfileShape(stripRestrictionShadow(profile));
  const transactions = Array.isArray(nextProfile.transactions) ? nextProfile.transactions : [];
  const normalizedTransactions = transactions.map((transaction, index) => {
    const createdAt = toEpochMs(transaction.createdAt ?? transaction.created_at ?? transaction.at, nowMs());

    return {
      ...clone(transaction),
      amount: toNumber(transaction.amount, 0),
      balanceBefore: transaction.balanceBefore ?? transaction.balance_before ?? null,
      balanceAfter: transaction.balanceAfter ?? transaction.balance_after ?? null,
      createdAt,
      at: transaction.at ?? new Date(createdAt).toISOString()
    };
  });

  if (isMemoryStorageEnabled()) {
    const current = memoryState.economy.users.get(userId);

    if (current && toNumber(current.version, 0) !== toNumber(expectedVersion, 0)) {
      throw new Error(`version_conflict:${userId}`);
    }

    memoryState.economy.users.set(userId, {
      profile: nextProfile,
      version: current ? current.version + 1 : 0
    });
    memorySaveRestrictions(userId, nextProfile.moderation?.restrictions ?? []);

    for (const [index, tx] of normalizedTransactions.entries()) {
      const key = transactionKey(tx, `${userId}:${index}`);
      const row = {
        transaction_key: key,
        user_id: userId,
        amount: toNumber(tx.amount, 0),
        type: `${tx.type ?? 'transaction'}`,
        note: `${tx.note ?? ''}`,
        metadata: clone(tx.metadata ?? {}),
        balance_before: tx.balanceBefore ?? tx.balance_before ?? null,
        balance_after: tx.balanceAfter ?? tx.balance_after ?? null,
        created_at: toEpochMs(tx.createdAt ?? tx.created_at ?? tx.at, nowMs())
      };
      const existingIndex = memoryState.economy.transactions.findIndex(item => item.transaction_key === key);
      if (existingIndex === -1) {
        memoryState.economy.transactions.push(row);
      } else {
        memoryState.economy.transactions[existingIndex] = row;
      }
    }

    return {
      version: memoryState.economy.users.get(userId)?.version ?? 0,
      profile: nextProfile
    };
  }

  const client = getSupabaseClient();
  const { data, error } = await client.rpc('save_economy_profile', {
    p_user_id: userId,
    p_expected_version: toNumber(expectedVersion, 0),
    p_profile: nextProfile,
    p_transactions: normalizedTransactions,
    p_idempotency_key: options.idempotencyKey ?? null
  });

  if (error) throw error;

  const restrictions = nextProfile.moderation?.restrictions ?? [];
  const deleteResult = await client.from('user_restrictions').delete().eq('user_id', userId);
  if (deleteResult.error) throw deleteResult.error;

  if (restrictions.length > 0) {
    const rows = restrictions.map(item => ({
      id: item.id,
      user_id: userId,
      type: item.type,
      moderator_id: item.moderatorId,
      reason: item.reason ?? '',
      meta: item.meta ?? {},
        created_at: toEpochMs(item.createdAt, nowMs()),
        expires_at: item.expiresAt == null ? null : toEpochMs(item.expiresAt, null)
    }));

    const restrictionResult = await client.from('user_restrictions').insert(rows);
    if (restrictionResult.error) throw restrictionResult.error;
  }

  return data?.[0] ?? { version: toNumber(expectedVersion, 0) + 1, profile: nextProfile };
}

export async function transferEconomyProfiles({
  fromUserId,
  fromExpectedVersion,
  fromProfile,
  fromTransactions = [],
  toUserId,
  toExpectedVersion,
  toProfile,
  toTransactions = [],
  idempotencyKey = null
}) {
  const safeFromProfile = ensureUserProfileShape(stripRestrictionShadow(fromProfile));
  const safeToProfile = ensureUserProfileShape(stripRestrictionShadow(toProfile));

  if (isMemoryStorageEnabled()) {
    const fromCurrent = memoryState.economy.users.get(fromUserId);
    const toCurrent = memoryState.economy.users.get(toUserId);

    if (fromCurrent && toCurrent) {
      const fromVersion = toNumber(fromCurrent.version, 0);
      const toVersion = toNumber(toCurrent.version, 0);
      if (fromVersion !== toNumber(fromExpectedVersion, 0) || toVersion !== toNumber(toExpectedVersion, 0)) {
        throw new Error('version_conflict');
      }
    }

    memoryState.economy.users.set(fromUserId, {
      profile: safeFromProfile,
      version: fromCurrent ? fromCurrent.version + 1 : 0
    });
    memoryState.economy.users.set(toUserId, {
      profile: safeToProfile,
      version: toCurrent ? toCurrent.version + 1 : 0
    });
    memorySaveRestrictions(fromUserId, safeFromProfile.moderation?.restrictions ?? []);
    memorySaveRestrictions(toUserId, safeToProfile.moderation?.restrictions ?? []);

    const normalizedFromTransactions = fromTransactions.map((transaction, index) => {
      const createdAt = toEpochMs(transaction.createdAt ?? transaction.created_at ?? transaction.at, nowMs());

      return {
        ...clone(transaction),
        amount: toNumber(transaction.amount, 0),
        balanceBefore: transaction.balanceBefore ?? transaction.balance_before ?? null,
        balanceAfter: transaction.balanceAfter ?? transaction.balance_after ?? null,
        createdAt,
        at: transaction.at ?? new Date(createdAt).toISOString()
      };
    });

    const normalizedToTransactions = toTransactions.map((transaction, index) => {
      const createdAt = toEpochMs(transaction.createdAt ?? transaction.created_at ?? transaction.at, nowMs());

      return {
        ...clone(transaction),
        amount: toNumber(transaction.amount, 0),
        balanceBefore: transaction.balanceBefore ?? transaction.balance_before ?? null,
        balanceAfter: transaction.balanceAfter ?? transaction.balance_after ?? null,
        createdAt,
        at: transaction.at ?? new Date(createdAt).toISOString()
      };
    });

    for (const [index, tx] of normalizedFromTransactions.entries()) {
      const key = transactionKey(tx, `${fromUserId}:${index}`);
      const row = {
        transaction_key: key,
        user_id: fromUserId,
        amount: toNumber(tx.amount, 0),
        type: `${tx.type ?? 'transaction'}`,
        note: `${tx.note ?? ''}`,
        metadata: clone(tx.metadata ?? {}),
        balance_before: tx.balanceBefore ?? tx.balance_before ?? null,
        balance_after: tx.balanceAfter ?? tx.balance_after ?? null,
        created_at: toEpochMs(tx.createdAt ?? tx.created_at ?? tx.at, nowMs())
      };
      const existingIndex = memoryState.economy.transactions.findIndex(item => item.transaction_key === key);
      if (existingIndex === -1) memoryState.economy.transactions.push(row);
      else memoryState.economy.transactions[existingIndex] = row;
    }

    for (const [index, tx] of normalizedToTransactions.entries()) {
      const key = transactionKey(tx, `${toUserId}:${index}`);
      const row = {
        transaction_key: key,
        user_id: toUserId,
        amount: toNumber(tx.amount, 0),
        type: `${tx.type ?? 'transaction'}`,
        note: `${tx.note ?? ''}`,
        metadata: clone(tx.metadata ?? {}),
        balance_before: tx.balanceBefore ?? tx.balance_before ?? null,
        balance_after: tx.balanceAfter ?? tx.balance_after ?? null,
        created_at: toEpochMs(tx.createdAt ?? tx.created_at ?? tx.at, nowMs())
      };
      const existingIndex = memoryState.economy.transactions.findIndex(item => item.transaction_key === key);
      if (existingIndex === -1) memoryState.economy.transactions.push(row);
      else memoryState.economy.transactions[existingIndex] = row;
    }

    return {
      fromVersion: memoryState.economy.users.get(fromUserId)?.version ?? 0,
      toVersion: memoryState.economy.users.get(toUserId)?.version ?? 0,
      fromProfile: safeFromProfile,
      toProfile: safeToProfile
    };
  }

  const client = getSupabaseClient();
  const { data, error } = await client.rpc('transfer_economy_profiles', {
    p_from_user_id: fromUserId,
    p_from_expected_version: toNumber(fromExpectedVersion, 0),
    p_from_profile: safeFromProfile,
    p_from_transactions: normalizedFromTransactions,
    p_to_user_id: toUserId,
    p_to_expected_version: toNumber(toExpectedVersion, 0),
    p_to_profile: safeToProfile,
    p_to_transactions: normalizedToTransactions,
    p_idempotency_key: idempotencyKey
  });

  if (error) throw error;

  return data?.[0] ?? {
    fromVersion: toNumber(fromExpectedVersion, 0) + 1,
    toVersion: toNumber(toExpectedVersion, 0) + 1,
    fromProfile: safeFromProfile,
    toProfile: safeToProfile
  };
}

export async function loadEconomyTransactions(userId, limit = 10) {
  if (isMemoryStorageEnabled()) {
    return clone(
      memoryState.economy.transactions
        .filter(transaction => transaction.user_id === userId)
        .sort((left, right) => right.created_at - left.created_at)
        .slice(0, limit)
        .map(transaction => ({
          id: transaction.transaction_key,
          at: new Date(transaction.created_at).toISOString(),
          amount: transaction.amount,
          type: transaction.type,
          note: transaction.note,
          metadata: clone(transaction.metadata ?? {}),
          balanceBefore: transaction.balance_before ?? null,
          balanceAfter: transaction.balance_after ?? null
        }))
    );
  }

  const client = getSupabaseClient();
  const { data, error } = await client.from('economy_transactions').select('*').eq('user_id', userId).order('created_at', { ascending: false }).limit(limit);
  if (error) throw error;

  return (data ?? []).map(row => ({
    id: row.transaction_key,
    at: new Date(toEpochMs(row.created_at, nowMs())).toISOString(),
    amount: toNumber(row.amount, 0),
    type: row.type,
    note: row.note,
    metadata: clone(row.metadata ?? {}),
    balanceBefore: row.balance_before ?? null,
    balanceAfter: row.balance_after ?? null
  }));
}

export async function loadEconomyLeaderboard(limit = 10) {
  if (isMemoryStorageEnabled()) {
    return [...memoryState.economy.users.entries()]
      .map(([userId, row]) => ({
        userId,
        balance: toNumber(row.profile.balance, 0),
        level: toNumber(row.profile.level, 1),
        prestige: toNumber(row.profile.prestige, 0),
        rank: row.profile.rank ?? '🌱 Yeni başlayan'
      }))
      .sort((left, right) => right.balance - left.balance || right.level - left.level || right.prestige - left.prestige)
      .slice(0, limit);
  }

  const client = getSupabaseClient();
  const { data, error } = await client.from('economy_users').select('user_id, balance, level, prestige, rank').order('balance', { ascending: false }).order('level', { ascending: false }).order('prestige', { ascending: false }).limit(limit);
  if (error) throw error;

  return (data ?? []).map(row => ({
    userId: row.user_id,
    balance: toNumber(row.balance, 0),
    level: toNumber(row.level, 1),
    prestige: toNumber(row.prestige, 0),
    rank: row.rank ?? '🌱 Yeni başlayan'
  }));
}

export async function loadEconomySettings() {
  if (isMemoryStorageEnabled()) {
    return clone(memoryState.economy.settings ?? defaultEconomySettings());
  }

  const client = getSupabaseClient();
  const { data, error } = await client.from('economy_settings').select('*').eq('id', 1).maybeSingle();
  if (error) throw error;

  return data ? {
    chestsEnabled: data.chests_enabled ?? true,
    chestsUpdatedAt: data.chests_updated_at == null ? null : toEpochMs(data.chests_updated_at, null),
    chestsUpdatedBy: data.chests_updated_by ?? null,
    safeModeEnabled: data.safe_mode_enabled ?? false,
    safeModeUpdatedAt: data.safe_mode_updated_at == null ? null : toEpochMs(data.safe_mode_updated_at, null),
    safeModeUpdatedBy: data.safe_mode_updated_by ?? null
  } : defaultEconomySettings();
}

export async function saveEconomySettings(settings) {
  const next = {
    chestsEnabled: Boolean(settings?.chestsEnabled),
    chestsUpdatedAt: settings?.chestsUpdatedAt == null ? null : toEpochMs(settings.chestsUpdatedAt, null),
    chestsUpdatedBy: settings?.chestsUpdatedBy ?? null,
    safeModeEnabled: Boolean(settings?.safeModeEnabled),
    safeModeUpdatedAt: settings?.safeModeUpdatedAt == null ? null : toEpochMs(settings.safeModeUpdatedAt, null),
    safeModeUpdatedBy: settings?.safeModeUpdatedBy ?? null
  };

  if (isMemoryStorageEnabled()) {
    memoryState.economy.settings = next;
    return next;
  }

  const client = getSupabaseClient();
  const { error } = await client.from('economy_settings').upsert({
    id: 1,
    chests_enabled: next.chestsEnabled,
    chests_updated_at: next.chestsUpdatedAt,
    chests_updated_by: next.chestsUpdatedBy,
    safe_mode_enabled: next.safeModeEnabled,
    safe_mode_updated_at: next.safeModeUpdatedAt,
    safe_mode_updated_by: next.safeModeUpdatedBy
  }, { onConflict: 'id' });
  if (error) throw error;
  return next;
}

export async function loadEconomyRestrictions(userId) {
  if (isMemoryStorageEnabled()) {
    return clone(memoryState.economy.restrictions.get(userId) ?? []);
  }

  const client = getSupabaseClient();
  const { data, error } = await client.from('user_restrictions').select('*').eq('user_id', userId).order('created_at', { ascending: true });
  if (error) throw error;

  return (data ?? []).map(row => ({
    id: row.id,
    type: row.type,
    moderatorId: row.moderator_id,
    reason: row.reason ?? '',
    meta: row.meta ?? {},
    createdAt: toEpochMs(row.created_at, nowMs()),
    expiresAt: row.expires_at == null ? null : toEpochMs(row.expires_at, null)
  }));
}

export async function saveEconomyRestrictions(userId, restrictions) {
  const rows = (restrictions ?? []).map(item => ({
    id: item.id,
    user_id: userId,
    type: item.type,
    moderator_id: item.moderatorId,
    reason: item.reason ?? '',
    meta: item.meta ?? {},
    created_at: toEpochMs(item.createdAt, nowMs()),
    expires_at: item.expiresAt == null ? null : toEpochMs(item.expiresAt, null)
  }));

  if (isMemoryStorageEnabled()) {
    memorySaveRestrictions(userId, restrictions ?? []);
    return restrictions ?? [];
  }

  const client = getSupabaseClient();
  const deleteResult = await client.from('user_restrictions').delete().eq('user_id', userId);
  if (deleteResult.error) throw deleteResult.error;

  if (rows.length > 0) {
    const insertResult = await client.from('user_restrictions').insert(rows);
    if (insertResult.error) throw insertResult.error;
  }

  return restrictions ?? [];
}

export async function deleteEconomyTransactions(userId) {
  if (isMemoryStorageEnabled()) {
    memoryState.economy.transactions = memoryState.economy.transactions.filter(transaction => transaction.user_id !== userId);
    return;
  }

  const client = getSupabaseClient();
  const { error } = await client.from('economy_transactions').delete().eq('user_id', userId);
  if (error) throw error;
}

export async function loadEconomyUserIds() {
  if (isMemoryStorageEnabled()) {
    return [...memoryState.economy.users.keys()];
  }

  const client = getSupabaseClient();
  const { data, error } = await client.from('economy_users').select('user_id');
  if (error) throw error;
  return (data ?? []).map(row => row.user_id);
}

export async function saveEconomyUserTransaction(userId, transaction) {
  const row = {
    transaction_key: transactionKey(transaction, userId),
    user_id: userId,
    amount: toNumber(transaction.amount, 0),
    type: `${transaction.type ?? 'transaction'}`,
    note: `${transaction.note ?? ''}`,
    metadata: clone(transaction.metadata ?? {}),
    balance_before: transaction.balanceBefore ?? transaction.balance_before ?? null,
    balance_after: transaction.balanceAfter ?? transaction.balance_after ?? null,
    created_at: toEpochMs(transaction.createdAt ?? transaction.created_at ?? transaction.at, nowMs())
  };

  if (isMemoryStorageEnabled()) {
    const existingIndex = memoryState.economy.transactions.findIndex(item => item.transaction_key === row.transaction_key);
    if (existingIndex === -1) {
      memoryState.economy.transactions.push(row);
    } else {
      memoryState.economy.transactions[existingIndex] = row;
    }
    return row;
  }

  const client = getSupabaseClient();
  const { error } = await client.from('economy_transactions').upsert(row, { onConflict: 'transaction_key' });
  if (error) throw error;
  return row;
}
