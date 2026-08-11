import {
  deleteEconomyTransactions,
  loadEconomyLeaderboard,
  loadEconomyRestrictions,
  loadEconomySettings,
  loadEconomyStore,
  loadEconomyTransactions,
  saveEconomyProfile,
  saveEconomyRestrictions,
  saveEconomySettings,
  saveEconomyStore,
  transferEconomyProfiles
} from './db/economy-store.js';
import { randomUUID } from 'node:crypto';
import { nowMs } from './db/helpers.js';

const startingBalance = 500;
const maxLevel = 50;
const prestigeAuraBonus = 0.1;
const maxTransactions = 1000;
const casinoCooldownMs = 4 * 1000;
const transferDailyLimit = 100000;
const transferSingleLimit = 25000;
const transferDailyLimitCap = 1500000;
const transferSingleLimitCap = 350000;
const shopChestDailyLimit = 10;
const robTargetShieldMs = 60 * 1000;
const robPairDailyLimit = 2;
const robTargetDailyLimit = 5;
const maxNegativeBalance = -50000;
const dayMs = 24 * 60 * 60 * 1000;
const primePrice = 10000;
const primeRefundLimit = 6;
const primeDurationMs = 30 * dayMs;
const primeLossRetentionMs = 30 * dayMs;
const rewardTicketCover = 500;
const safeModePayoutMultiplier = 0.35;
const safeModeRobMultiplier = 0.25;
const objectiveCasinoTypes = ['slots', 'risk', 'coinflip', 'dice', 'roulette', 'blackjack', 'crash', 'mines', 'tower', 'higherlower', 'wheel', 'lottery', 'jackpot', 'rps', 'baccarat', 'poker', 'horse', 'penalty'];
const objectivePvpTypes = ['duel', 'dicebattle', 'quickdraw', 'heist'];

let cache;
let storeSnapshots = new WeakMap();
let storeMutationQueue = Promise.resolve();

async function withStoreMutationLock(operation) {
  const run = storeMutationQueue.catch(() => {}).then(operation);
  storeMutationQueue = run.then(() => undefined, () => undefined);
  return run;
}

export const levelUnlocks = [
  { level: 5, name: 'Sikkə atışı' },
  { level: 10, name: '21 oyunu' },
  { level: 15, name: 'Çarpan qaçışı' },
  { level: 20, name: 'Mina oyunu' },
  { level: 25, name: 'Rulet' },
  { level: 30, name: 'Poker' },
  { level: 40, name: 'Prestij' },
  { level: 50, name: 'Əfsanə rankı' }
];

export const ranks = [
  { minAura: 0, minLevel: 1, emoji: '🌱', name: 'Yeni başlayan' },
  { minAura: 750, minLevel: 5, emoji: '🪵', name: 'Bürünc Döyüşçü' },
  { minAura: 2000, minLevel: 10, emoji: '🥈', name: 'Gümüş Savaşçı' },
  { minAura: 5000, minLevel: 18, emoji: '🥇', name: 'Qızıl Veteran' },
  { minAura: 10000, minLevel: 25, emoji: '💎', name: 'Platin Arxon' },
  { minAura: 18000, minLevel: 32, emoji: '👑', name: 'Almaz Hökmdar' },
  { minAura: 30000, minLevel: 40, emoji: '🔥', name: 'Ustad' },
  { minAura: 50000, minLevel: 50, emoji: '🌌', name: 'Əfsanə' }
];

const achievements = {
  firstDaily: { emoji: '🎁', name: 'İlk Gündəlik' },
  firstGame: { emoji: '🎰', name: 'İlk Oyun' },
  firstVictory: { emoji: '🏆', name: 'İlk Qələbə' },
  streak7: { emoji: '🔥', name: '7 Gün ardıcıllıq' },
  aura10000: { emoji: '💎', name: '10000 Aura' },
  level20: { emoji: '⚡', name: 'Səviyyə 20' },
  prestige1: { emoji: '👑', name: 'Prestij sahibi' },
  games100: { emoji: '🎲', name: '100 Oyun' }
};

export async function getBalance(userId) {
  const { store, user } = await getStoreUser(userId);
  await writeStore(store);
  return user.balance;
}

export async function getProfile(userId) {
  const { store, user } = await getStoreUser(userId);
  applyLoanState(user);
  prunePrime(user);
  updateDerivedStats(user);
  await writeStore(store);
  return structuredClone(user);
}

export async function setGameRequests(userId, enabled) {
  const { store, user } = await getStoreUser(userId);
  user.settings.gameRequests = Boolean(enabled);
  await writeStore(store);
  return structuredClone(user);
}

export async function getGameRequestSettings(userId) {
  const { user } = await getStoreUser(userId);
  return { enabled: user.settings.gameRequests !== false };
}

export async function markWelcomeSeen(userId) {
  const { store, user } = await getStoreUser(userId);
  const firstTime = !user.onboarding.welcomeSeen;
  user.onboarding.welcomeSeen = true;
  await writeStore(store);
  return { firstTime, profile: structuredClone(user) };
}

export async function claimBeginnerBonus(userId) {
  const { store, user } = await getStoreUser(userId);

  if (user.onboarding.beginnerBonusClaimed) {
    return { claimed: false, profile: structuredClone(user) };
  }

  const reward = safeModeAmount(store, 150 + Math.floor(Math.random() * 51));
  user.onboarding.beginnerBonusClaimed = true;
  user.balance += reward;
  user.stats.auraEarned += reward;
  user.inventory.tickets += 1;
  awardXp(user, 20);
  unlockAchievements(user);
  await writeStore(store);

  return {
    claimed: true,
    reward,
    profile: structuredClone(user)
  };
}

export async function addBalance(userId, amount, { safeMode = true } = {}) {
  const { store, user } = await getStoreUser(userId);
  const adjustedAmount = safeMode ? safeModeAmount(store, amount) : amount;
  const bonusAmount = adjustedAmount > 0 ? Math.floor(adjustedAmount * (1 + user.prestige * prestigeAuraBonus)) : adjustedAmount;
  user.balance = Math.max(0, user.balance + bonusAmount);
  if (bonusAmount > 0) {
    user.stats.auraEarned += bonusAmount;
  } else {
    user.stats.auraLost += Math.abs(bonusAmount);
  }
  updateDerivedStats(user);
  await writeStore(store);
  return user.balance;
}

export async function adminGiveAura(userId, amount, adminId) {
  const { store, user } = await getStoreUser(userId);
  user.balance += amount;
  user.stats.auraEarned += amount;
  addTransaction(user, amount, 'admin_give', `by:${adminId}`);
  updateDerivedStats(user);
  unlockAchievements(user);
  await writeStore(store);
  return structuredClone(user);
}

export async function resetEconomyWallets({ clearTransactions = true } = {}) {
  const store = await readStore();
  let resetCount = 0;

  for (const userId of Object.keys(store.users || {})) {
    const user = store.users[userId];
    if (!user || typeof user !== 'object') continue;

    const migrated = migrateUser(user);
    store.users[userId] = migrated;

    migrated.balance = 0;
    migrated.bank = 0;
    migrated.lastInterest = null;
    migrated.lastTax = null;
    migrated.stats.auraEarned = 0;
    migrated.stats.auraLost = 0;
    migrated.stats.biggestWin = 0;
    migrated.stats.biggestLoss = 0;
    migrated.stats.averageBet = 0;
    migrated.stats.highestMultiplier = 0;
    migrated.stats.favoriteGames = {};

    if (clearTransactions) {
      migrated.transactions = [];
    }

    migrated.loan.active = null;
    migrated.loan.frozen = false;
    migrated.loan.insured = false;
    migrated.loan.insuranceMonth = null;
    migrated.loan.stats.onTimePayments = 0;
    migrated.loan.stats.latePayments = 0;
    migrated.loan.stats.totalBorrowed = 0;
    migrated.loan.stats.totalRepaid = 0;

    migrated.prime.activeUntil = null;
    migrated.prime.purchasedAt = null;
    migrated.prime.refundsRemaining = 0;
    migrated.prime.monthKey = null;
    migrated.prime.losses = [];

    updateDerivedStats(migrated);
    updateWorldDerived(migrated);
    ensureSeason(migrated);
    ensureObjectiveProgress(migrated);
    applyLoanState(migrated);
    unlockAchievements(migrated);
    resetCount += 1;
  }

  await writeStore(store);
  return { ok: true, resetCount, clearedTransactions: clearTransactions };
}

export async function adminGiveAuraForDrop(userId, amount, adminId, dropId) {
  const { store, user } = await getStoreUser(userId);
  const note = `by:${adminId}:drop:${dropId}`;

  if (user.transactions.some(transaction => transaction.type === 'admin_drop' && transaction.note === note)) {
    return { ok: false, duplicate: true, profile: structuredClone(user) };
  }

  user.balance += amount;
  user.stats.auraEarned += amount;
  addTransaction(user, amount, 'admin_drop', note);
  updateDerivedStats(user);
  unlockAchievements(user);
  await writeStore(store);
  return { ok: true, profile: structuredClone(user) };
}

export async function adminRevertGiveAura(userId, amount, adminId) {
  const { store, user } = await getStoreUser(userId);
  const removed = Math.min(user.balance, amount);
  user.balance -= removed;
  user.stats.auraLost += removed;
  addTransaction(user, -removed, 'admin_take', `revert_by:${adminId}:amount:${amount}`);
  updateDerivedStats(user);
  await writeStore(store);
  return { deducted: removed, profile: structuredClone(user) };
}

export async function adminTakeAura(userId, amount, adminId) {
  const { store, user } = await getStoreUser(userId);
  const requested = Math.max(0, Number(amount) || 0);
  const balanceBefore = user.balance;

  // Admin deductions may push the wallet into debt, but never below the
  // economy-wide floor (currently -50,000 Aura).
  const maxRemovable = Math.max(0, user.balance - maxNegativeBalance);
  const removed = Math.min(requested, maxRemovable);

  user.balance -= removed;
  user.stats.auraLost += removed;
  addTransaction(
    user,
    -removed,
    'admin_take',
    `by:${adminId}:requested:${requested}:before:${balanceBefore}:after:${user.balance}`
  );
  updateDerivedStats(user);
  await writeStore(store);

  return {
    requested,
    removed,
    capped: removed < requested,
    balanceBefore,
    balanceAfter: user.balance,
    profile: structuredClone(user)
  };
}

export async function adminSetBalance(userId, amount, adminId) {
  const { store, user } = await getStoreUser(userId);
  const delta = amount - user.balance;
  user.balance = amount;
  if (delta > 0) user.stats.auraEarned += delta;
  if (delta < 0) user.stats.auraLost += Math.abs(delta);
  addTransaction(user, delta, 'admin_setbalance', `by:${adminId}`);
  updateDerivedStats(user);
  unlockAchievements(user);
  await writeStore(store);
  return structuredClone(user);
}

export async function adminSetLevel(userId, level, adminId) {
  const { store, user } = await getStoreUser(userId);
  user.level = clamp(level, 1, maxLevel);
  user.xp = 0;
  addTransaction(user, 0, 'admin_setlevel', `by:${adminId}:level:${user.level}`);
  updateDerivedStats(user);
  unlockAchievements(user);
  await writeStore(store);
  return structuredClone(user);
}

export async function adminSetCasinoRestriction(userId, maxBet, reason, adminId) {
  const { store, user } = await getStoreUser(userId);
  const cleanReason = `${reason ?? 'admin review'}`.trim().slice(0, 80) || 'admin review';
  const normalizedMaxBet = clamp(maxBet, 0, 1000000);

  user.moderation.casinoMaxBet = normalizedMaxBet;
  user.moderation.casinoReason = cleanReason;
  user.moderation.casinoRestrictedAt = new Date().toISOString();
  user.moderation.casinoRestrictedBy = adminId;
  addTransaction(user, 0, 'admin_casino_restrict', `by:${adminId}:max:${normalizedMaxBet}:reason:${cleanReason}`);
  await writeStore(store);

  return structuredClone(user);
}

export async function adminSetChestAccess(enabled, adminId) {
  const store = await readStore();
  ensureStoreSettings(store);
  store.settings.chestsEnabled = Boolean(enabled);
  store.settings.chestsUpdatedAt = new Date().toISOString();
  store.settings.chestsUpdatedBy = adminId;
  await writeStore(store);

  return structuredClone(store.settings);
}

export async function adminSetSafeMode(enabled, adminId) {
  const store = await readStore();
  ensureStoreSettings(store);
  store.settings.safeModeEnabled = Boolean(enabled);
  store.settings.safeModeUpdatedAt = new Date().toISOString();
  store.settings.safeModeUpdatedBy = adminId;
  await writeStore(store);

  return structuredClone(store.settings);
}

export async function adminGrantBadge(userId, badge, adminId) {
  const { store, user } = await getStoreUser(userId);
  const cleanBadge = badge.trim().slice(0, 40);
  addUnique(user.badges, cleanBadge);
  addUnique(user.inventory.badges, cleanBadge);
  addTransaction(user, 0, 'admin_badge', `by:${adminId}:${cleanBadge}`);
  await writeStore(store);
  return structuredClone(user);
}

export async function adminGrantItem(userId, itemKey, amount, adminId) {
  const { store, user } = await getStoreUser(userId);
  const item = adminItems[itemKey];

  if (!item) {
    return { ok: false, reason: 'missing', profile: structuredClone(user) };
  }

  for (let index = 0; index < amount; index += 1) {
    addInventoryItem(user, item);
  }

  addTransaction(user, 0, 'admin_item', `by:${adminId}:${amount}x ${item.name}`);
  await writeStore(store);
  return { ok: true, item, amount, profile: structuredClone(user) };
}

export async function transferAura(fromUserId, toUserId, amount, reason = 'transfer') {
  return withStoreMutationLock(async () => {
    const store = await readStore();
    ensureUser(store, fromUserId);
    ensureUser(store, toUserId);

    let fromUser = store.users[fromUserId];
    let toUser = store.users[toUserId];
    const today = new Date().toISOString().slice(0, 10);
    applyLoanState(fromUser);
    const tradeBlock = await checkRestriction(fromUserId, 'trade');
    if (tradeBlock) {
      await writeStore(store);
      return { ok: false, reason: 'trade_restricted', restriction: tradeBlock, from: structuredClone(fromUser), to: structuredClone(toUser) };
    }
    fromUser = store.users[fromUserId];
    toUser = store.users[toUserId];
    const transferLimits = dynamicTransferLimits(fromUser);

    if (fromUser.loan.frozen) {
      await writeStore(store);
      return { ok: false, reason: 'loan_frozen', from: structuredClone(fromUser), to: structuredClone(toUser) };
    }

    if (amount > transferLimits.single) {
      return { ok: false, reason: 'single_limit', limit: transferLimits.single, limits: transferLimits, from: structuredClone(fromUser), to: structuredClone(toUser) };
    }

    if (fromUser.limits.transferDate !== today) {
      fromUser.limits.transferDate = today;
      fromUser.limits.transferSent = 0;
    }

    if (fromUser.limits.transferSent + amount > transferLimits.daily) {
      return { ok: false, reason: 'daily_limit', limit: transferLimits.daily, remaining: Math.max(0, transferLimits.daily - fromUser.limits.transferSent), limits: transferLimits, from: structuredClone(fromUser), to: structuredClone(toUser) };
    }

    if (fromUser.balance < amount) {
      return { ok: false, reason: 'insufficient', from: structuredClone(fromUser), to: structuredClone(toUser) };
    }

    fromUser.balance -= amount;
    fromUser.stats.auraLost += amount;
    toUser.balance += amount;
    toUser.stats.auraEarned += amount;
    fromUser.limits.transferSent += amount;
    addTransaction(fromUser, -amount, reason, `to:${toUserId}`);
    addTransaction(toUser, amount, reason, `from:${fromUserId}`);
    addObjectiveProgress(fromUser, 'transfer');
    updateDerivedStats(fromUser);
    updateDerivedStats(toUser);
    unlockAchievements(fromUser);
    unlockAchievements(toUser);
    await writeStore(store);

    return { ok: true, from: structuredClone(fromUser), to: structuredClone(toUser) };
  });
}


function calculateRobCooldown(robber, targetId) {
  const today = currentDayKey();

  resetRobLimits(robber, today);

  // How many times this robber has targeted THIS user today.
  const sameTargetAttempts =
    robber.limits?.robTargets?.[targetId] ?? 0;

  // Total robbery attempts today.
  const totalAttempts =
    Object.values(robber.limits?.robTargets ?? {})
      .reduce((sum, count) => sum + Number(count || 0), 0);

  // --------------------------------------------------
  // BASE COOLDOWN
  // Random 3-7 minutes.
  // --------------------------------------------------

  let minMinutes = 3;
  let maxMinutes = 7;

  // --------------------------------------------------
  // ACTIVITY / ANTI-ABUSE SCALING
  // --------------------------------------------------

  if (totalAttempts >= 3) {
    minMinutes += 3;
    maxMinutes += 5;
  }

  if (totalAttempts >= 5) {
    minMinutes += 5;
    maxMinutes += 8;
  }

  if (totalAttempts >= 8) {
    minMinutes += 8;
    maxMinutes += 12;
  }

  // Repeatedly attacking the same person is punished
  // harder than trying different people.
  if (sameTargetAttempts >= 1) {
    minMinutes += 4;
    maxMinutes += 7;
  }

  if (sameTargetAttempts >= 2) {
    minMinutes += 8;
    maxMinutes += 12;
  }

  // Hard safety bounds.
  minMinutes = Math.min(minMinutes, 35);
  maxMinutes = Math.min(maxMinutes, 45);

  const minutes = randomBetween(
    minMinutes,
    Math.max(minMinutes, maxMinutes)
  );

  return minutes * 60 * 1000;
}

export async function performRob(robberId, targetId) {
  return withStoreMutationLock(async () => {
    const store = await readStore();

    ensureUser(store, robberId);
    ensureUser(store, targetId);

    let robber = store.users[robberId];
    let target = store.users[targetId];

    const baseConfig =
      activityConfigs.rob;

    const config =
      safeModeRobConfig(
        store,
        dynamicRobConfig(
          robber,
          target,
          baseConfig
        )
      );

    const now = Date.now();

    // ================================================
    // MODERATION / RESTRICTIONS
    // ================================================

    const robberBlock =
      await checkRestriction(
        robberId,
        'rob'
      );

    if (robberBlock) {
      return {
        ok: false,
        reason: 'rob_restricted',
        restriction: robberBlock
      };
    }

    const targetBlock =
      await checkRestriction(
        targetId,
        'rob'
      );

    if (targetBlock) {
      return {
        ok: false,
        reason: 'rob_target_protected',
        restriction: targetBlock
      };
    }

    // checkRestriction may migrate/update profiles,
    // so refresh references.
    robber = store.users[robberId];
    target = store.users[targetId];

    const today = currentDayKey();

    resetRobLimits(
      robber,
      today
    );

    resetRobLimits(
      target,
      today
    );

    // ================================================
    // BASIC SAFETY
    // ================================================

    if (robber.balance < 0) {
      return {
        ok: false,
        reason: 'debt_locked',
        robber: structuredClone(robber),
        target: structuredClone(target),
        config
      };
    }

    // ================================================
    // DYNAMIC COOLDOWN
    // ================================================

    const last =
      robber.cooldowns.rob ?? 0;

    const activeRobCooldown =
      robber.cooldowns.robDuration ??
      config.cooldown;

    if (
      now - last <
      activeRobCooldown
    ) {
      return {
        ok: false,
        reason: 'cooldown',

        remainingMs:
          activeRobCooldown -
          (now - last),

        robber:
          structuredClone(robber),

        target:
          structuredClone(target),

        config
      };
    }

    // ================================================
    // DAILY ANTI-ABUSE LIMITS
    // ================================================

    if (
      (
        robber.limits
          .robTargets[targetId] ?? 0
      ) >= robPairDailyLimit
    ) {
      return {
        ok: false,
        reason: 'pair_daily_limit',
        limit: robPairDailyLimit,

        robber:
          structuredClone(robber),

        target:
          structuredClone(target),

        config
      };
    }

    if (
      (
        target.limits
          .robbedCount ?? 0
      ) >= robTargetDailyLimit
    ) {
      return {
        ok: false,
        reason: 'target_daily_limit',
        limit: robTargetDailyLimit,

        robber:
          structuredClone(robber),

        target:
          structuredClone(target),

        config
      };
    }

    // ================================================
    // VICTIM SHIELD
    // ================================================

    if (
      (
        target.cooldowns
          .robbedUntil ?? 0
      ) > now
    ) {
      return {
        ok: false,
        reason: 'shielded',

        remainingMs:
          target.cooldowns.robbedUntil -
          now,

        robber:
          structuredClone(robber),

        target:
          structuredClone(target),

        config
      };
    }

    // ================================================
    // MINIMUM TARGET WALLET
    // ================================================

    if (
      target.balance <
      config.minTargetBalance
    ) {
      return {
        ok: false,
        reason: 'poor_target',

        robber:
          structuredClone(robber),

        target:
          structuredClone(target),

        config
      };
    }

    // ================================================
    // RECORD THIS ATTEMPT
    // ================================================

    robber.cooldowns.rob = now;

    // Count THIS attempt before calculating
    // the next cooldown.
    robber.limits.robTargets[targetId] =
      (
        robber.limits
          .robTargets[targetId] ?? 0
      ) + 1;

    target.limits.robbedCount =
      (
        target.limits
          .robbedCount ?? 0
      ) + 1;

    // Dynamic next cooldown uses updated history.
    robber.cooldowns.robDuration =
      calculateRobCooldown(
        robber,
        targetId
      );

    // Victim gets temporary protection.
    target.cooldowns.robbedUntil =
      now + robTargetShieldMs;

    // ================================================
    // RESULT
    // ================================================

    const success =
      Math.random() <= config.chance;

    let amount;

    if (success) {
      // ==============================================
      // BALANCED SUCCESSFUL ROB
      // ==============================================

      // ONLY wallet balance is considered.
      // target.bank is never touched.
      const wallet =
        Math.max(
          0,
          target.balance
        );

      // Keep a small safety balance.
      const protectedAura = 250;

      // Random 5%-12% steal.
      const stealPercent =
        randomBetween(5, 12) / 100;

      // Nobody can lose more than this
      // from one robbery.
      const maxRobAmount = 1500;

      const percentageAmount =
        Math.floor(
          wallet *
          stealPercent
        );

      const availableToSteal =
        Math.max(
          0,
          wallet -
          protectedAura
        );

      amount = Math.min(
        percentageAmount,
        maxRobAmount,
        availableToSteal
      );

      // If target somehow reached a wallet state
      // where nothing is safely stealable,
      // don't create Aura out of nowhere.
      if (amount <= 0) {
        amount = 0;
      }

      if (amount > 0) {
        target.balance -= amount;

        target.stats.auraLost +=
          amount;

        robber.balance += amount;

        robber.stats.auraEarned +=
          amount;

        addTransaction(
          robber,
          amount,
          'rob',
          `from:${targetId}:percent:${Math.round(
            stealPercent * 100
          )}`
        );

        addTransaction(
          target,
          -amount,
          'robbed',
          `by:${robberId}:percent:${Math.round(
            stealPercent * 100
          )}`
        );
      }
    } else {
      // ==============================================
      // FAILED ROBBERY FINE
      // ==============================================

      const robberWallet =
        Math.max(
          0,
          robber.balance
        );

      // 3%-7% penalty.
      const failPercent =
        randomBetween(3, 7) / 100;

      const calculatedFine =
        Math.floor(
          robberWallet *
          failPercent
        );

      // At least 50,
      // maximum 750.
      const fine =
        Math.min(
          750,
          Math.max(
            50,
            calculatedFine
          )
        );

      const actualFine =
        debtLimitedLoss(
          robber,
          fine
        );

      amount = -actualFine;

      robber.balance -=
        actualFine;

      robber.stats.auraLost +=
        actualFine;

      addTransaction(
        robber,
        -actualFine,
        'rob_failed',
        `target:${targetId}:fine:${actualFine}`
      );
    }

    // ================================================
    // XP / STATS / SAVE
    // ================================================

    awardXp(
      robber,
      config.xp
    );

    updateDerivedStats(
      robber
    );

    updateDerivedStats(
      target
    );

    unlockAchievements(
      robber
    );

    unlockAchievements(
      target
    );

    await writeStore(store);

    return {
      ok: true,
      success,
      amount,

      robber:
        structuredClone(robber),

      target:
        structuredClone(target),

      config
    };
  });
}

export async function depositAura(userId, amount) {
  return withStoreMutationLock(async () => {
    const { store, user } = await getStoreUser(userId);
    const requested = Math.max(0, Number(amount) || 0);
    const walletBefore = user.balance;
    const bankBefore = user.bank;

    const bankBlock = await checkRestriction(userId, 'bank');
    if (bankBlock) {
      return { ok: false, reason: 'bank_restricted', restriction: bankBlock, requested, profile: structuredClone(user) };
    }

    const currentUser = store.users[userId];

    if (requested <= 0) {
      return { ok: false, reason: 'invalid_amount', requested, profile: structuredClone(currentUser) };
    }

    if (currentUser.balance < requested) {
      return { ok: false, reason: 'insufficient', requested, profile: structuredClone(currentUser) };
    }

    currentUser.balance -= requested;
    currentUser.bank += requested;
    addTransaction(currentUser, -requested, 'bank_deposit', `wallet->bank:before_wallet:${walletBefore}:before_bank:${bankBefore}:after_wallet:${currentUser.balance}:after_bank:${currentUser.bank}`);
    addObjectiveProgress(currentUser, 'bankDepositAura', requested);
    updateDerivedStats(currentUser);
    await writeStore(store);

    return {
      ok: true,
      requested,
      moved: requested,
      walletBefore,
      walletAfter: currentUser.balance,
      bankBefore,
      bankAfter: currentUser.bank,
      profile: structuredClone(currentUser)
    };
  });
}

export async function withdrawAura(userId, amount) {
  return withStoreMutationLock(async () => {
    const { store, user } = await getStoreUser(userId);
    const requested = Math.max(0, Number(amount) || 0);
    const walletBefore = user.balance;
    const bankBefore = user.bank;
    applyLoanState(user);

    const bankBlock = await checkRestriction(userId, 'bank');
    if (bankBlock) {
      await writeStore(store);
      return { ok: false, reason: 'bank_restricted', restriction: bankBlock, requested, profile: structuredClone(user) };
    }

    const currentUser = store.users[userId];

    if (currentUser.loan.frozen) {
      await writeStore(store);
      return { ok: false, reason: 'loan_frozen', requested, profile: structuredClone(currentUser) };
    }

    if (requested <= 0) {
      return { ok: false, reason: 'invalid_amount', requested, profile: structuredClone(currentUser) };
    }

    if (currentUser.bank < requested) {
      return { ok: false, reason: 'insufficient', requested, profile: structuredClone(currentUser) };
    }

    currentUser.bank -= requested;
    currentUser.balance += requested;
    addTransaction(currentUser, requested, 'bank_withdraw', `bank->wallet:before_wallet:${walletBefore}:before_bank:${bankBefore}:after_wallet:${currentUser.balance}:after_bank:${currentUser.bank}`);
    updateDerivedStats(currentUser);
    await writeStore(store);

    return {
      ok: true,
      requested,
      moved: requested,
      walletBefore,
      walletAfter: currentUser.balance,
      bankBefore,
      bankAfter: currentUser.bank,
      profile: structuredClone(currentUser)
    };
  });
}

export async function applyBankInterest(userId) {
  const { store, user } = await getStoreUser(userId);
  const today = new Date().toISOString().slice(0, 10);

  const bankBlock = await checkRestriction(userId, 'bank');
  if (bankBlock) return { claimed: false, reward: 0, profile: structuredClone(user), reason: 'bank_restricted', restriction: bankBlock };

  const currentUser = store.users[userId];

  if (currentUser.lastInterest === today) {
    return { claimed: false, reward: 0, profile: structuredClone(currentUser) };
  }

  const reward = safeModeAmount(store, Math.min(750, Math.max(10, Math.floor(currentUser.bank * 0.015))));
  currentUser.bank += reward;
  currentUser.lastInterest = today;
  currentUser.stats.auraEarned += reward;
  addTransaction(currentUser, reward, 'bank_interest', 'daily interest');
  awardXp(currentUser, 8);
  unlockAchievements(currentUser);
  await writeStore(store);
  return { claimed: true, reward, profile: structuredClone(currentUser) };
}

export async function applyTaxes(userId) {
  const { store, user } = await getStoreUser(userId);
  const today = new Date().toISOString().slice(0, 10);

  if (user.lastTax === today) {
    return { charged: false, amount: 0, profile: structuredClone(user) };
  }

  const taxable = Math.max(0, user.balance + user.bank - 10000);
  const amount = Math.min(1000, Math.floor(taxable * 0.01));
  user.bank = Math.max(0, user.bank - amount);
  user.lastTax = today;
  user.stats.auraLost += amount;
  addTransaction(user, -amount, 'taxes', 'daily wealth tax');
  updateDerivedStats(user);
  await writeStore(store);
  return { charged: true, amount, profile: structuredClone(user) };
}

export async function canSpend(userId, amount) {
  const balance = await getBalance(userId);
  return balance >= amount;
}

export async function spendBalance(userId, amount) {
  return withStoreMutationLock(async () => {
    const { store, user } = await getStoreUser(userId);

    if (user.balance < amount) {
      return false;
    }

    user.balance -= amount;
    user.stats.auraLost += amount;
    addTransaction(user, -amount, 'spend', 'game/shop');
    updateDerivedStats(user);
    await writeStore(store);
    return true;
  });
}

export async function applyFine(userId, amount, type = 'fine', note = 'penalty') {
  const { store, user } = await getStoreUser(userId);
  const fine = debtLimitedLoss(user, Math.max(0, amount));
  user.balance -= fine;
  user.stats.auraLost += fine;
  addTransaction(user, -fine, type, note);
  updateDerivedStats(user);
  await writeStore(store);
  return structuredClone(user);
}

export async function reserveCasinoBet(userId, amount) {
  return withStoreMutationLock(async () => {
    const { store, user } = await getStoreUser(userId);

    if (user.balance < amount) {
      return { ok: false, profile: structuredClone(user) };
    }

    user.balance -= amount;
    updateDerivedStats(user);
    await writeStore(store);
    return { ok: true, profile: structuredClone(user) };
  });
}

export function _now() { return Date.now(); }

function pruneExpiredRestrictions(user) {
  if (!user.moderation) return;
  user.moderation.restrictions = (user.moderation.restrictions || []).filter(r => !r.expiresAt || r.expiresAt > Date.now());
}

export async function addRestriction(userId, type, moderatorId, reason = '', { durationMs = null, meta = {} } = {}) {
  const { store, user } = await getStoreUser(userId);
  const id = `r_${Date.now().toString(36)}_${Math.random().toString(36).slice(2,6)}`;
  const createdAt = Date.now();
  const expiresAt = durationMs ? createdAt + durationMs : null;
  user.moderation.restrictions = user.moderation.restrictions || [];
  // remove existing same-type active restrictions (predictable replacement)
  const now = Date.now();
  const replaced = user.moderation.restrictions.filter(r => r.type === type && (!r.expiresAt || r.expiresAt > now));
  if (replaced.length) {
    user.moderation.restrictions = user.moderation.restrictions.filter(r => !(r.type === type && (!r.expiresAt || r.expiresAt > now)));
  }
  const r = { id, type, moderatorId, reason: `${reason}`.slice(0,500), meta: meta || {}, createdAt, expiresAt };
  if (replaced.length) {
    r.meta = r.meta || {};
    r.meta.replaced = replaced.map(x => ({ id: x.id, createdAt: x.createdAt, expiresAt: x.expiresAt }));
  }
  user.moderation.restrictions.push(r);
  await writeStore(store);
  return r;
}

export async function removeRestriction(userId, restrictionIdOrType) {
  const { store, user } = await getStoreUser(userId);
  user.moderation.restrictions = user.moderation.restrictions || [];
  let removed = [];
  if (typeof restrictionIdOrType === 'string' && restrictionIdOrType.startsWith('r_')) {
    removed = user.moderation.restrictions.filter(r => r.id === restrictionIdOrType);
    user.moderation.restrictions = user.moderation.restrictions.filter(r => r.id !== restrictionIdOrType);
  } else if (typeof restrictionIdOrType === 'string') {
    // treat as type: remove all active restrictions matching this type
    const now = Date.now();
    removed = user.moderation.restrictions.filter(r => r.type === restrictionIdOrType && (!r.expiresAt || r.expiresAt > now));
    user.moderation.restrictions = user.moderation.restrictions.filter(r => !(r.type === restrictionIdOrType && (!r.expiresAt || r.expiresAt > now)));
  }
  await writeStore(store);
  return removed;
}

export async function listRestrictions(userId) {
  const { store, user } = await getStoreUser(userId);
  pruneExpiredRestrictions(user);
  await writeStore(store);
  return (user.moderation.restrictions || []).map(r => ({ ...r }));
}

export async function checkRestriction(userId, action) {
  const { store, user } = await getStoreUser(userId);
  pruneExpiredRestrictions(user);
  await writeStore(store);
  const now = Date.now();
  const active = (user.moderation.restrictions || []).find(r => {
    if (r.expiresAt && r.expiresAt <= now) return false;
    if (r.type === action) return true;
    // allow type wildcard 'all_economy'
    if (r.type === 'all_economy') return true;
    return false;
  });
  return active || null;
}

export async function prepareCasinoEntry(userId, bet, game, { reserve = false } = {}) {
  return withStoreMutationLock(async () => {
    const { store, user } = await getStoreUser(userId);

    /*
     * Casino hot path:
     * We already have the current user/store here, so do NOT call
     * checkRestriction() again. That function performs another store
     * read/write and makes web casino actions unnecessarily slow.
     */
    pruneExpiredRestrictions(user);

    const now = Date.now();
    const restrictions = user.moderation?.restrictions || [];

    const findRestriction = action =>
      restrictions.find(r => {
        if (r.expiresAt && r.expiresAt <= now) return false;

        return (
          r.type === action ||
          r.type === 'all_economy'
        );
      }) || null;

    const casinoBlock = findRestriction('casino');

    if (casinoBlock) {
      return {
        ok: false,
        reason: 'casino_restricted',
        restriction: casinoBlock,
        cost: 0,
        ticketCover: 0,
        usedTicket: false,
        profile: structuredClone(user)
      };
    }

    const casinoMaxR = findRestriction('casino_max_bet');

    if (
      casinoMaxR &&
      casinoMaxR.meta &&
      Number.isFinite(Number(casinoMaxR.meta.maxBet))
    ) {
      const adminMaxBet = Number(casinoMaxR.meta.maxBet);

      if (bet > adminMaxBet) {
        return {
          ok: false,
          reason: 'casino_max_bet',
          restriction: {
            maxBet: adminMaxBet,
            ...casinoMaxR
          },
          cost: 0,
          ticketCover: 0,
          usedTicket: false,
          profile: structuredClone(user)
        };
      }
    }

    const currentUser = store.users[userId];

    const ticketCover =
      currentUser.inventory.tickets > 0
        ? Math.min(bet, rewardTicketCover)
        : 0;

    const cost = Math.max(0, bet - ticketCover);

    const casinoRestriction =
      casinoRestrictionForBet(currentUser, bet);

    if (casinoRestriction) {
      return {
        ok: false,
        reason: 'casino_restricted',
        restriction: casinoRestriction,
        cost,
        ticketCover: 0,
        usedTicket: false,
        profile: structuredClone(currentUser)
      };
    }

    if (currentUser.balance < cost) {
      return {
        ok: false,
        reason: 'insufficient',
        cost,
        ticketCover: 0,
        usedTicket: false,
        profile: structuredClone(currentUser)
      };
    }

    if (ticketCover > 0) {
      currentUser.inventory.tickets -= 1;

      addTransaction(
        currentUser,
        0,
        'ticket_used',
        `${game}:cover:${ticketCover}`
      );
    }

    if (reserve && cost > 0) {
      currentUser.balance -= cost;
      updateDerivedStats(currentUser);
    }

    /*
     * Mark cooldown in this SAME mutation/write instead of requiring
     * markCasinoPlayed() to perform another complete read/write cycle.
     */
    currentUser.cooldowns.casino = now;

    await writeStore(store);

    return {
      ok: true,
      cost,
      ticketCover,
      usedTicket: ticketCover > 0,
      profile: structuredClone(currentUser)
    };
  });
}

export async function refundReservedCasinoBet(userId, amount, game = 'casino', usedTicket = false) {
  const { store, user } = await getStoreUser(userId);
  user.balance += amount;
  if (usedTicket) {
    user.inventory.tickets += 1;
  }
  addTransaction(user, amount, 'casino_timeout_refund', `${game}:reserved`);
  updateDerivedStats(user);
  await writeStore(store);
  return structuredClone(user);
}

export async function getCreditProfile(userId) {
  const { store, user } = await getStoreUser(userId);
  applyLoanState(user);
  await writeStore(store);
  return loanProfile(user);
}

export async function takeLoan(userId, lender, amount) {
  const { store, user } = await getStoreUser(userId);
  applyLoanState(user);

  const bankBlock = await checkRestriction(userId, 'bank');
  if (bankBlock) return { ok: false, reason: 'bank_restricted', profile: loanProfile(user), restriction: bankBlock };

  const currentUser = store.users[userId];

  if (currentUser.loan.active) {
    return { ok: false, reason: 'active_loan', profile: loanProfile(currentUser) };
  }

  if (currentUser.loan.frozen) {
    return { ok: false, reason: 'frozen', profile: loanProfile(currentUser) };
  }

  const offer = loanOffer(currentUser, lender);
  if (!offer || amount > offer.max || amount < offer.min) {
    return { ok: false, reason: 'not_allowed', offer, profile: loanProfile(currentUser) };
  }

  if (currentUser.level < offer.requiredLevel || currentUser.prestige < offer.requiredPrestige || currentUser.loan.creditScore < offer.requiredScore) {
    return { ok: false, reason: 'requirements', offer, profile: loanProfile(currentUser) };
  }

  const totalDue = Math.ceil(amount * (1 + offer.interest));
  const payments = offer.payments;
  const now = Date.now();
  currentUser.loan.active = {
    lender,
    principal: amount,
    totalDue,
    remaining: totalDue,
    interestRate: offer.interest,
    payments,
    installment: Math.ceil(totalDue / payments),
    startedAt: now,
    nextPaymentAt: now + offer.paymentEveryMs,
    dueAt: now + offer.durationMs,
    paymentEveryMs: offer.paymentEveryMs,
    missedPayments: 0,
    paidInstallments: 0,
    lastPenaltyAt: null
  };
  currentUser.balance += amount;
  currentUser.loan.stats.totalBorrowed += amount;
  currentUser.stats.auraEarned += amount;
  addTransaction(currentUser, amount, `loan_${lender}`, `${payments} payments at ${Math.round(offer.interest * 100)}%`);
  updateDerivedStats(currentUser);
  await writeStore(store);
  return { ok: true, loan: structuredClone(currentUser.loan.active), offer, profile: loanProfile(currentUser) };
}

export async function payLoan(userId, amount, payerId = userId) {
  const store = await readStore();
  ensureUser(store, userId);
  ensureUser(store, payerId);
  let user = store.users[userId];
  let payer = store.users[payerId];
  applyLoanState(user);

  // block cross-user payments when payer has trade restriction
  if (payerId !== userId) {
    const tradeBlock = await checkRestriction(payerId, 'trade');
    if (tradeBlock) {
      return { ok: false, reason: 'trade_restricted', profile: loanProfile(user), payer: structuredClone(payer), restriction: tradeBlock };
    }
    user = store.users[userId];
    payer = store.users[payerId];
  }

  if (!user.loan.active) {
    return { ok: false, reason: 'no_loan', profile: loanProfile(user), payer: structuredClone(payer) };
  }

  const payment = Math.min(amount, user.loan.active.remaining);
  if (payer.balance < payment) {
    return { ok: false, reason: 'insufficient', profile: loanProfile(user), payer: structuredClone(payer) };
  }

  payer.balance -= payment;
  payer.stats.auraLost += payment;
  user.loan.active.remaining -= payment;
  user.loan.active.paidInstallments += 1;
  user.loan.stats.totalRepaid += payment;
  addTransaction(payer, -payment, payerId === userId ? 'loan_payment' : 'loan_help', `for:${userId}`);

  if (user.loan.active.remaining <= 0) {
    const early = Date.now() < user.loan.active.dueAt;
    user.loan.active = null;
    user.loan.frozen = false;
    user.loan.stats.onTimePayments += 1;
    user.loan.creditScore = clamp(user.loan.creditScore + (early ? 55 : 30), 250, 950);
    if (early) {
      const chest = '🥈 Gümüş sandığı';
      user.inventory.chests[chest] = (user.inventory.chests[chest] ?? 0) + 1;
      awardXp(user, 250);
      addTransaction(user, 0, 'loan_reward', 'early payment chest + XP');
    }
  } else {
    user.loan.active.nextPaymentAt = Date.now() + user.loan.active.paymentEveryMs;
    user.loan.creditScore = clamp(user.loan.creditScore + 6, 250, 950);
  }

  updateDerivedStats(user);
  updateDerivedStats(payer);
  await writeStore(store);
  return { ok: true, payment, profile: loanProfile(user), payer: structuredClone(payer) };
}

export async function buyLoanInsurance(userId) {
  const { store, user } = await getStoreUser(userId);
  applyLoanState(user);
  const period = new Date().toISOString().slice(0, 7);

  if (user.loan.insuranceMonth === period) {
    return { ok: false, reason: 'already_bought', profile: loanProfile(user) };
  }

  const price = 1200;
  if (user.balance < price) {
    return { ok: false, reason: 'insufficient', profile: loanProfile(user), price };
  }

  user.balance -= price;
  user.loan.insuranceMonth = period;
  user.loan.insured = true;
  addTransaction(user, -price, 'loan_insurance', '50% one-use monthly coverage');
  await writeStore(store);
  return { ok: true, price, profile: loanProfile(user) };
}

export async function getPrimeProfile(userId) {
  const { store, user } = await getStoreUser(userId);
  prunePrime(user);
  await writeStore(store);
  return primeProfile(user);
}

export async function buyPrime(userId) {
  const { store, user } = await getStoreUser(userId);
  prunePrime(user);

  if (user.prime.activeUntil && user.prime.activeUntil > Date.now()) {
    return { ok: false, reason: 'active', profile: primeProfile(user), user: structuredClone(user) };
  }

  if (user.balance < primePrice) {
    return { ok: false, reason: 'insufficient', price: primePrice, profile: primeProfile(user), user: structuredClone(user) };
  }

  user.balance -= primePrice;
  user.stats.auraLost += primePrice;
  user.prime.activeUntil = Date.now() + primeDurationMs;
  user.prime.refundsRemaining = primeRefundLimit;
  user.prime.purchasedAt = Date.now();
  user.prime.monthKey = currentMonthKey();
  user.prime.losses = [];
  addTransaction(user, -primePrice, 'prime_buy', '30d casino refund access');
  updateDerivedStats(user);
  await writeStore(store);

  return { ok: true, price: primePrice, profile: primeProfile(user), user: structuredClone(user) };
}

export async function refundPrimeLoss(userId, lossId) {
  const { store, user } = await getStoreUser(userId);
  prunePrime(user);

  if (!isPrimeActive(user)) {
    return { ok: false, reason: 'inactive', profile: primeProfile(user), user: structuredClone(user) };
  }

  if (user.prime.refundsRemaining <= 0) {
    return { ok: false, reason: 'limit', profile: primeProfile(user), user: structuredClone(user) };
  }

  const loss = user.prime.losses.find(item => item.id === lossId);
  if (!loss) {
    return { ok: false, reason: 'missing', profile: primeProfile(user), user: structuredClone(user) };
  }

  if (loss.refunded) {
    return { ok: false, reason: 'refunded', loss: structuredClone(loss), profile: primeProfile(user), user: structuredClone(user) };
  }

  if (loss.expiresAt <= Date.now()) {
    return { ok: false, reason: 'expired', loss: structuredClone(loss), profile: primeProfile(user), user: structuredClone(user) };
  }

  user.balance += loss.lossAmount;
  user.stats.auraEarned += loss.lossAmount;
  user.prime.refundsRemaining -= 1;
  loss.refunded = true;
  loss.refundedAt = Date.now();
  addTransaction(user, loss.lossAmount, 'prime_refund', `loss:${loss.id}:game:${loss.game}`);
  updateDerivedStats(user);
  await writeStore(store);

  return { ok: true, refunded: loss.lossAmount, loss: structuredClone(loss), profile: primeProfile(user), user: structuredClone(user) };
}

export async function isEconomyFrozen(userId) {
  const { store, user } = await getStoreUser(userId);
  applyLoanState(user);
  await writeStore(store);
  return user.loan.frozen;
}

export async function consumeTicket(userId, reason = 'lottery') {
  const { store, user } = await getStoreUser(userId);

  if (user.inventory.tickets <= 0) {
    return { ok: false, profile: structuredClone(user) };
  }

  user.inventory.tickets -= 1;
  addTransaction(user, 0, 'ticket_used', reason);
  await writeStore(store);
  return { ok: true, profile: structuredClone(user) };
}

export async function getCasinoCooldown(userId) {
  const { user } = await getStoreUser(userId);
  const lastPlayed = user.cooldowns.casino ?? 0;
  const remainingMs = casinoCooldownMs - (Date.now() - lastPlayed);
  return Math.max(0, remainingMs);
}

export async function markCasinoPlayed(userId) {
  const { store, user } = await getStoreUser(userId);
  user.cooldowns.casino = Date.now();
  await writeStore(store);
}

export async function claimDaily(userId) {
  const { store, user } = await getStoreUser(userId);

  const today = new Date().toISOString().slice(0, 10);
  const yesterday = dateOffset(-1);

  if (user.lastDaily === today) {
    return {
      claimed: false,
      balance: user.balance,
      profile: structuredClone(user),
      nextClaim: 'sabah'
    };
  }

  user.dailyStreak = user.lastDaily === yesterday ? user.dailyStreak + 1 : 1;
  const milestone = user.dailyStreak % 30 === 0 ? 1000 : user.dailyStreak % 7 === 0 ? 300 : 50;
  const reward = safeModeAmount(store, milestone + Math.floor(Math.random() * 51));
  const appliedReward = Math.floor(reward * (1 + user.prestige * prestigeAuraBonus));
  const chest = rollChest(user);
  user.lastDaily = today;
  user.balance += appliedReward;
  user.stats.auraEarned += appliedReward;
  user.stats.currentStreak = user.dailyStreak;
  user.stats.longestStreak = Math.max(user.stats.longestStreak, user.dailyStreak);
  user.inventory.chests[chest] = (user.inventory.chests[chest] ?? 0) + 1;
  addTransaction(user, appliedReward, 'daily', chest);
  addSeasonXp(user, 60);
  awardXp(user, 25);
  unlockAchievements(user);

  await writeStore(store);

  return {
    claimed: true,
    reward,
    chest,
    balance: user.balance,
    profile: structuredClone(user)
  };
}

export async function claimTimedReward(userId, kind) {
  const { store, user } = await getStoreUser(userId);
  const field = kind === 'monthly' ? 'lastMonthly' : 'lastWeekly';
  const period = rewardPeriod(kind);
  const reward = safeModeAmount(store, kind === 'monthly' ? 2500 : 700);
  const xp = kind === 'monthly' ? 80 : 35;

  if (user[field] === period) {
    return { claimed: false, reward: 0, profile: structuredClone(user) };
  }

  user[field] = period;
  const appliedReward = Math.floor(reward * (1 + user.prestige * prestigeAuraBonus));
  user.balance += appliedReward;
  user.stats.auraEarned += appliedReward;
  user.inventory.keys += kind === 'monthly' ? 3 : 1;
  addTransaction(user, appliedReward, kind, `${kind} reward`);
  addSeasonXp(user, kind === 'monthly' ? 350 : 140);
  awardXp(user, xp);
  unlockAchievements(user);
  await writeStore(store);
  return { claimed: true, reward, profile: structuredClone(user) };
}

export async function performActivity(userId, activity) {
  const { store, user } = await getStoreUser(userId);
  const config = activityConfigs[activity] ?? activityConfigs.work;
  const now = Date.now();
  const last = user.cooldowns[activity] ?? 0;

  if (now - last < config.cooldown) {
    return { ok: false, remainingMs: config.cooldown - (now - last), profile: structuredClone(user), config };
  }

  user.cooldowns[activity] = now;
  const roll = Math.random();
  const success = roll <= config.chance;
  let amount = success
    ? safeModeAmount(store, randomBetween(config.min, config.max))
    : -randomBetween(config.failMin, config.failMax);

  if (amount >= 0) {
    amount = Math.floor(amount * (1 + user.prestige * prestigeAuraBonus));
    user.balance += amount;
    user.stats.auraEarned += amount;
  } else {
    const loss = debtLimitedLoss(user, Math.abs(amount));
    amount = -loss;
    user.balance -= loss;
    user.stats.auraLost += loss;
  }

  addTransaction(user, amount, activity, success ? 'success' : 'failed');
  addSeasonXp(user, config.xp);
  awardXp(user, config.xp);
  unlockAchievements(user);
  await writeStore(store);
  return { ok: true, success, amount, profile: structuredClone(user), config };
}

export async function awardActionXp(userId, amount) {
  const { store, user } = await getStoreUser(userId);
  const leveledUp = awardXp(user, amount);
  unlockAchievements(user);
  await writeStore(store);
  return { profile: structuredClone(user), leveledUp };
}

export async function recordGame(userId, { game, bet = 0, won = false, net = 0, multiplier = 0, ledger = true }) {
  const { store, user } = await getStoreUser(userId);
  applyGameStats(user, { game, bet, won, net, multiplier, ledger });
  await writeStore(store);
  return structuredClone(user);
}

export async function settleCasinoGame(userId, { game, bet = 0, cost = bet, payout = 0, won = false, multiplier = 0, reserved = false }) {
  return withStoreMutationLock(async () => {
    const { store, user } = await getStoreUser(userId);
    const balanceBefore = user.balance;

    if (!reserved && user.balance < cost) {
      return { ok: false, reason: 'insufficient', profile: structuredClone(user), payout: 0, net: 0 };
    }

    const profit = Math.max(0, payout - cost);
    const returnedStake = payout > 0 ? Math.min(cost, payout) : 0;
    const safeProfit = safeModeAmount(store, profit);
    const bonusProfit = safeProfit > 0 ? Math.floor(safeProfit * (1 + user.prestige * prestigeAuraBonus)) : 0;
    let actualPayout = returnedStake + bonusProfit;
    const boosterEffect = consumeLuckyBooster(user, { cost, profit, won: won || actualPayout > cost });

    if (boosterEffect?.amount > 0) {
      boosterEffect.amount = safeModeAmount(store, boosterEffect.amount);
      actualPayout += boosterEffect.amount;
    }

    const net = actualPayout - cost;

    if (cost > 0 && !reserved) {
      user.balance -= cost;
    }

    if (cost > 0) {
      user.stats.auraLost += cost;
    }

    if (actualPayout > 0) {
      user.balance += actualPayout;
      user.stats.auraEarned += actualPayout;
    }

    applyGameStats(user, { game, bet, won: won || net > 0, net, multiplier, ledger: true });
    recordPrimeLoss(user, { game, bet, net });
    updateDerivedStats(user);
    await writeStore(store);

    return {
      ok: true,
      profile: structuredClone(user),
      payout: actualPayout,
      net,
      boosterEffect,
      balanceBefore,
      balanceAfter: user.balance
    };
  });
}

function applyGameStats(user, { game, bet = 0, won = false, net = 0, multiplier = 0, ledger = true }) {
  user.stats.gamesPlayed += 1;
  if (objectiveCasinoTypes.includes(game)) {
    addObjectiveProgress(user, 'casino');
    addObjectiveProgress(user, 'games', 1, 'weekly');
  } else if (objectivePvpTypes.includes(game)) {
    addObjectiveProgress(user, 'games', 1, 'weekly');
  }
  user.stats.favoriteGames[game] = (user.stats.favoriteGames[game] ?? 0) + 1;
  user.stats.biggestWin = Math.max(user.stats.biggestWin, net);
  user.stats.biggestLoss = Math.max(user.stats.biggestLoss, Math.abs(Math.min(net, 0)));
  user.stats.highestMultiplier = Math.max(user.stats.highestMultiplier, multiplier);
  user.stats.averageBet = Math.round(((user.stats.averageBet * (user.stats.gamesPlayed - 1)) + bet) / user.stats.gamesPlayed);

  if (won) {
    user.stats.gamesWon += 1;
    awardXp(user, 15);
  } else {
    user.stats.gamesLost += 1;
    awardXp(user, 5);
  }

  user.reputation = Math.min(100, user.reputation + (won ? 2 : 1));
  user.luck = clamp(user.luck + (won ? -1 : 1) + Math.floor(Math.random() * 3) - 1, 1, 100);
  addSeasonXp(user, won ? 24 : 10);
  if (ledger) {
    addTransaction(user, net, game, `bet:${bet}`);
  }
  unlockAchievements(user);
}

function consumeLuckyBooster(user, { cost = 0, profit = 0, won = false }) {
  if (cost <= 0 || (user.inventory?.boosterCharges ?? 0) <= 0) {
    return null;
  }

  user.inventory.boosterCharges -= 1;

  if (won && profit > 0) {
    const multiplier = pick([1.25, 1.5, 1.5, 2, 2, 3, 5]);
    const amount = Math.max(1, Math.min(5000, Math.floor(profit * (multiplier - 1))));
    return {
      type: 'surge',
      label: `Lucky Booster ${multiplier.toFixed(2)}x bonus verdi`,
      multiplier,
      amount
    };
  }

  const shieldPercent = pick([0.2, 0.25, 0.35, 0.5, 0.6]);
  const amount = Math.max(1, Math.floor(cost * shieldPercent));
  return {
    type: 'shield',
    label: `Lucky Booster ${Math.round(shieldPercent * 100)}% loss shield verdi`,
    multiplier: shieldPercent,
    amount
  };
}

export async function prestige(userId) {
  const { store, user } = await getStoreUser(userId);

  if (user.level < maxLevel) {
    return { ok: false, profile: structuredClone(user) };
  }

  user.prestige += 1;
  user.level = 1;
  user.xp = 0;
  user.dailyStreak = 0;
  user.lastDaily = null;
  addUnique(user.badges, '⭐ Prestij');
  addUnique(user.inventory.badges, '⭐ Prestij');
  addUnique(user.inventory.titles, `Prestij ${user.prestige}`);
  addUnique(user.inventory.borders, 'Ulduz sərhədi');
  user.title = `Prestij ${user.prestige}`;
  unlockAchievements(user);
  await writeStore(store);
  return { ok: true, profile: structuredClone(user) };
}

export async function leaderboard(limit = 10) {
  const store = await readStore();

  return Object.entries(store.users)
    .map(([userId, data]) => {
      const user = migrateUser(data);
      updateDerivedStats(user);
      return {
        userId,
        balance: user.balance,
        level: user.level,
        prestige: user.prestige,
      rank: user.rank,
      primeActive: isPrimeActive(user),
      wins: user.stats.gamesWon
    };
    })
    .sort((a, b) => b.balance - a.balance || b.level - a.level || b.prestige - a.prestige)
    .slice(0, limit);
}

export async function getTransactions(userId, limit = 10) {
  const { user } = await getStoreUser(userId);
  return structuredClone(user.transactions.slice(0, limit));
}

export async function buyShopItem(userId, itemKey) {
  const { store, user } = await getStoreUser(userId);
  const item = shopItems[itemKey];
  const today = currentDayKey();

  if (!item) {
    return { ok: false, reason: 'missing', profile: structuredClone(user) };
  }

  if (isShopChest(itemKey)) {
    if (!store.settings.chestsEnabled) {
      return { ok: false, reason: 'chests_disabled', item, profile: structuredClone(user) };
    }

    resetShopChestLimit(user, today);
    if (user.limits.shopChestsBought + (item.amount ?? 1) > shopChestDailyLimit) {
      return {
        ok: false,
        reason: 'daily_chest_limit',
        item,
        limit: shopChestDailyLimit,
        remaining: Math.max(0, shopChestDailyLimit - user.limits.shopChestsBought),
        profile: structuredClone(user)
      };
    }
  }

  if (user.balance < item.price) {
    return { ok: false, reason: 'insufficient', item, profile: structuredClone(user) };
  }

  user.balance -= item.price;
  addInventoryItem(user, item);
  addTransaction(user, -item.price, 'shop_buy', item.name);
  if (isShopChest(itemKey)) {
    user.limits.shopChestsBought += item.amount ?? 1;
  }
  addObjectiveProgress(user, 'market', 1, 'weekly');
  awardXp(user, 10);
  unlockAchievements(user);
  await writeStore(store);
  return { ok: true, item, profile: structuredClone(user) };
}

export async function revertExceededDailyChestPurchases() {
  const store = await readStore();
  const today = currentDayKey();
  const affected = [];
  let changed = false;

  for (const [userId, rawUser] of Object.entries(store.users)) {
    const user = migrateUser(rawUser);
    store.users[userId] = user;

    if (user.limits.shopChestRevertedDate === today) {
      continue;
    }

    const chestPurchases = user.transactions
      .map((transaction, index) => ({ ...transaction, index }))
      .filter(transaction => isToday(transaction.at, today) && transaction.type === 'shop_buy' && shopChestNameToKey(transaction.note))
      .sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime() || b.index - a.index);

    if (chestPurchases.length <= shopChestDailyLimit) {
      resetShopChestLimit(user, today, chestPurchases.length);
      changed = true;
      continue;
    }

    const excessPurchases = chestPurchases.slice(shopChestDailyLimit);
    let refunded = 0;
    let openedAuraReverted = 0;
    let unopenedReverted = 0;
    let openedReverted = 0;
    const revertedItems = {};
    const usedOpenIndexes = new Set();

    for (const purchase of excessPurchases) {
      const itemKey = shopChestNameToKey(purchase.note);
      const item = shopItems[itemKey];
      const amount = item?.amount ?? 1;
      const openName = openedChestName(item);
      let remainingToRevert = amount;

      while (remainingToRevert > 0) {
        const openTransaction = findRevertableChestOpen(user.transactions, openName, usedOpenIndexes, today);
        if (!openTransaction) break;

        usedOpenIndexes.add(openTransaction.index);
        const collectible = collectibleFromOpenNote(openTransaction.note);
        const collectibleIndex = collectible
          ? user.inventory.collectibles.findIndex(value => value.toLowerCase() === collectible.toLowerCase())
          : -1;
        if (collectibleIndex !== -1) {
          user.inventory.collectibles.splice(collectibleIndex, 1);
        }

        const purchaseRefund = Math.round(item.price / amount);
        const auraReward = Math.max(0, openTransaction.amount);
        user.balance += purchaseRefund - auraReward;
        user.stats.auraEarned = Math.max(0, user.stats.auraEarned - auraReward);
        refunded += purchaseRefund;
        openedAuraReverted += auraReward;
        openedReverted += 1;
        revertedItems[item.name] = (revertedItems[item.name] ?? 0) + 1;
        remainingToRevert -= 1;
      }

      if (item.type === 'keys') {
        const removed = Math.min(user.inventory.keys ?? 0, remainingToRevert);

        if (removed > 0) {
          const refund = Math.round((item.price / amount) * removed);
          user.inventory.keys -= removed;
          user.balance += refund;
          refunded += refund;
          unopenedReverted += removed;
          revertedItems[item.name] = (revertedItems[item.name] ?? 0) + removed;
        }

        continue;
      }

      const owned = user.inventory.chests[item.name] ?? 0;
      const removed = Math.min(owned, remainingToRevert);

      if (removed > 0) {
        const refund = Math.round((item.price / amount) * removed);
        user.inventory.chests[item.name] -= removed;
        if (user.inventory.chests[item.name] <= 0) {
          delete user.inventory.chests[item.name];
        }
        user.balance += refund;
        refunded += refund;
        unopenedReverted += removed;
        revertedItems[item.name] = (revertedItems[item.name] ?? 0) + removed;
      }
    }

    user.limits.shopChestDate = today;
    user.limits.shopChestsBought = Math.min(shopChestDailyLimit, chestPurchases.length - unopenedReverted - openedReverted);
    user.limits.shopChestRevertedDate = today;
    changed = true;

    if (unopenedReverted + openedReverted > 0) {
      addTransaction(user, refunded - openedAuraReverted, 'shop_chest_limit_revert', `daily limit ${today}: ${unopenedReverted} unopened, ${openedReverted} opened`);
      updateDerivedStats(user);
      affected.push({
        userId,
        refunded,
        openedAuraReverted,
        reverted: unopenedReverted + openedReverted,
        unopenedReverted,
        openedReverted,
        limit: shopChestDailyLimit,
        items: revertedItems,
        profile: structuredClone(user)
      });
    }
  }

  if (changed) {
    await writeStore(store);
  }

  return affected;
}

export async function sellInventoryItem(userId, itemName) {
  const { store, user } = await getStoreUser(userId);
  const collectibleIndex = user.inventory.collectibles.findIndex(item => item.toLowerCase() === itemName.toLowerCase());

  if (collectibleIndex === -1) {
    return { ok: false, profile: structuredClone(user) };
  }

  const [sold] = user.inventory.collectibles.splice(collectibleIndex, 1);
  const reward = safeModeAmount(store, 120);
  user.balance += reward;
  user.stats.auraEarned += reward;
  addTransaction(user, reward, 'sell', sold);
  addObjectiveProgress(user, 'market', 1, 'weekly');
  updateDerivedStats(user);
  await writeStore(store);
  return { ok: true, sold, reward, profile: structuredClone(user) };
}

export async function openBestChest(userId) {
  const { store, user } = await getStoreUser(userId);

  if (user.balance < 0) {
    return { ok: false, reason: 'debt_locked', profile: structuredClone(user) };
  }

  if (!store.settings.chestsEnabled) {
    return { ok: false, reason: 'chests_disabled', profile: structuredClone(user) };
  }

  let chestName = Object.keys(user.inventory.chests).find(name => user.inventory.chests[name] > 0);

  if (!chestName && user.inventory.keys > 0) {
    user.inventory.keys -= 1;
    chestName = 'Bronze Key cache';
  }

  if (!chestName) {
    return { ok: false, profile: structuredClone(user) };
  }

  if (user.inventory.chests[chestName] > 0) {
    user.inventory.chests[chestName] -= 1;
    if (user.inventory.chests[chestName] <= 0) {
      delete user.inventory.chests[chestName];
    }
  }

  const isKeyCache = chestName === 'Bronze Key cache';
  const rewardRange = chestRewardRange(chestName);
  const baseReward = randomBetween(rewardRange[0], rewardRange[1]);
  const cacheMultiplier = isKeyCache ? pick([1, 1, 1, 1.5, 2, 3, 5]) : 1;
  const reward = safeModeAmount(store, Math.floor(baseReward * cacheMultiplier));
  const collectible = pick(['Güzgü parçası', 'Neon lent', 'Aura tokeni', 'Prestij sapı', 'Oktyabr nişanı']);
  user.balance += reward;
  user.stats.auraEarned += reward;
  addUnique(user.inventory.collectibles, collectible);
  addTransaction(user, reward, 'open_chest', `${chestName}: ${collectible}${isKeyCache ? `:${cacheMultiplier}x` : ''}`);
  addObjectiveProgress(user, 'market', 1, 'weekly');
  awardXp(user, 15);
  unlockAchievements(user);
  await writeStore(store);
  return { ok: true, chestName, reward, baseReward, cacheMultiplier, collectible, profile: structuredClone(user) };
}

export async function craftCollectible(userId) {
  const { store, user } = await getStoreUser(userId);

  if (user.inventory.collectibles.length < 3) {
    return { ok: false, profile: structuredClone(user) };
  }

  user.inventory.collectibles.splice(0, 3);
  const title = `Crafted ${randomBetween(100, 999)}`;
  addUnique(user.inventory.titles, title);
  addTransaction(user, 0, 'craft', title);
  addObjectiveProgress(user, 'market', 1, 'weekly');
  awardXp(user, 25);
  await writeStore(store);
  return { ok: true, title, profile: structuredClone(user) };
}

export async function recycleCollectible(userId) {
  const { store, user } = await getStoreUser(userId);
  const item = user.inventory.collectibles.shift();

  if (!item) {
    return { ok: false, profile: structuredClone(user) };
  }

  const reward = safeModeAmount(store, 60);
  user.balance += reward;
  user.stats.auraEarned += reward;
  addTransaction(user, reward, 'recycle', item);
  addObjectiveProgress(user, 'market', 1, 'weekly');
  updateDerivedStats(user);
  await writeStore(store);
  return { ok: true, item, reward, profile: structuredClone(user) };
}

export async function salvageCollectible(userId) {
  const { store, user } = await getStoreUser(userId);
  const item = user.inventory.collectibles.pop();

  if (!item) {
    return { ok: false, profile: structuredClone(user) };
  }

  user.inventory.keys += 1;
  addTransaction(user, 0, 'salvage', item);
  addObjectiveProgress(user, 'market', 1, 'weekly');
  await writeStore(store);
  return { ok: true, item, profile: structuredClone(user) };
}

export const shopItems = {
  bronze_key: { name: 'Bürünc Açar', price: 250, type: 'keys', amount: 1 },
  ticket: { name: 'Reward Ticket', price: 450, type: 'tickets', amount: 1 },
  lucky_booster: { name: 'Lucky Booster', price: 900, type: 'boosters', amount: 1 },
  starter_chest: { name: '🪵 Bürünc sandığı', price: 700, type: 'chests', amount: 1 },
  gold_chest: { name: '🥇 Qızıl sandığı', price: 2200, type: 'chests', amount: 1 }
};

function chestRewardRange(chestName) {
  if (`${chestName}`.includes('Qızıl')) return [350, 1200];
  if (`${chestName}`.includes('Gündəlik')) return [180, 850];
  if (`${chestName}`.includes('Həftəlik')) return [500, 1600];
  return [90, 600];
}

export const adminItems = {
  bronze_key: { name: 'Bürünc Açar', type: 'keys', amount: 1 },
  ticket: { name: 'Reward Ticket', type: 'tickets', amount: 1 },
  lucky_booster: { name: 'Lucky Booster', type: 'boosters', amount: 1 },
  neon_title: { name: 'Neon Regular', type: 'titles' },
  clean_badge: { name: 'Clean Fit Badge', type: 'badges' },
  starter_chest: { name: '🪵 Bürünc sandığı', type: 'chests', amount: 1 },
  gold_chest: { name: '🥇 Qızıl sandığı', type: 'chests', amount: 1 }
};

export const worldJobs = {
  police: { emoji: '🛡️', name: 'Polis', salary: 240, risk: 0.1, xp: 26 },
  hacker: { emoji: '💻', name: 'Haker', salary: 330, risk: 0.22, xp: 34 },
  designer: { emoji: '🎨', name: 'Dizayner', salary: 280, risk: 0.12, xp: 30 },
  chef: { emoji: '🍳', name: 'Aşpaz', salary: 230, risk: 0.08, xp: 24 },
  producer: { emoji: '🎧', name: 'Prodüser', salary: 310, risk: 0.16, xp: 32 },
  racer: { emoji: '🏎️', name: 'Küçə Yarışçısı', salary: 360, risk: 0.28, xp: 38 },
  detective: { emoji: '🕵️', name: 'Detektiv', salary: 300, risk: 0.15, xp: 31 },
  owner: { emoji: '💼', name: 'Biznes Sahibi', salary: 260, risk: 0.11, xp: 28 }
};

export const worldBusinesses = {
  restaurant: { emoji: '🍽️', name: 'Restoran', price: 8500, income: 360, influence: 5 },
  barber: { emoji: '💈', name: 'Barber Shop', price: 6500, income: 275, influence: 4 },
  gaming_cafe: { emoji: '🎮', name: 'Oyun Kafesi', price: 12000, income: 520, influence: 7 },
  car_dealer: { emoji: '🚘', name: 'Maşın Salonu', price: 26000, income: 1150, influence: 12 },
  coffee_shop: { emoji: '☕', name: 'Kofe Dükanı', price: 5000, income: 210, influence: 3 }
};

export const worldProperties = {
  apartment: { emoji: '🏢', name: 'Mənzil', price: 7000, income: 120, influence: 3 },
  house: { emoji: '🏠', name: 'Ev', price: 15000, income: 285, influence: 7 },
  mansion: { emoji: '🏛️', name: 'Villa', price: 45000, income: 900, influence: 18 },
  office: { emoji: '🏦', name: 'Ofis', price: 30000, income: 680, influence: 13 },
  island: { emoji: '🏝️', name: 'Ada', price: 120000, income: 2500, influence: 35 }
};

export const worldVehicles = {
  bicycle: { emoji: '🚲', name: 'Velosiped', price: 1200, bonus: 0.02, influence: 1 },
  bmw: { emoji: '🚙', name: 'BMW', price: 18000, bonus: 0.06, influence: 6 },
  ferrari: { emoji: '🏎️', name: 'Ferrari', price: 70000, bonus: 0.12, influence: 18 },
  helicopter: { emoji: '🚁', name: 'Helikopter', price: 160000, bonus: 0.18, influence: 35 }
};

export const worldMaps = {
  forest: { emoji: '🌲', name: 'Meşə', min: 120, max: 520, danger: 0.12, loot: ['Mistik yarpaq', 'Yaşıl kristal', 'Meşə tokeni'] },
  desert: { emoji: '🏜️', name: 'Səhra', min: 180, max: 760, danger: 0.2, loot: ['Qızıl qum', 'Qədim bilərzik', 'Səhra xəritəsi'] },
  city: { emoji: '🌃', name: 'Şəhər', min: 140, max: 600, danger: 0.14, loot: ['Neon kupon', 'VIP flyer', 'Metro tokeni'] },
  mountain: { emoji: '⛰️', name: 'Dağ', min: 220, max: 900, danger: 0.24, loot: ['Buz kristalı', 'Zirvə nişanı', 'Dağ xəzinəsi'] },
  dungeon: { emoji: '🕳️', name: 'Dungeon', min: 350, max: 1450, danger: 0.34, loot: ['Qaranlıq açar', 'Rare relic', 'Dungeon crest'] },
  space: { emoji: '🪐', name: 'Kosmos', min: 500, max: 2200, danger: 0.42, loot: ['Ulduz parçası', 'Kosmik sandıq', 'Nova token'] }
};

export const activeSeason = {
  key: 's1_dark_city',
  name: 'Season 1: Qaranlıq Şəhər',
  startsAt: Date.UTC(2026, 7, 1),
  endsAt: Date.UTC(2026, 8, 15),
  maxLevel: 50,
  finalReward: 'Kölgə Patronu titulu + qaranlıq profil effekti'
};

export const collectionSets = {
  octoson_relics: {
    emoji: '🐙',
    name: 'Octoson relikləri',
    bonus: 'Tam set: profil kosmetik hədəfi + craft üçün premium material',
    items: ['Güzgü parçası', 'Neon lent', 'Aura tokeni', 'Prestij sapı', 'Oktyabr nişanı']
  },
  ancient_city: {
    emoji: '🏛️',
    name: 'Qədim Şəhər',
    bonus: '+3% world gəliri',
    items: ['Qızıl qum', 'Qədim bilərzik', 'Səhra xəritəsi', 'Metro tokeni', 'VIP flyer', 'Neon kupon', 'Dungeon crest', 'Rare relic']
  },
  nature: {
    emoji: '🌲',
    name: 'Təbiət izi',
    bonus: '+1 luck',
    items: ['Mistik yarpaq', 'Yaşıl kristal', 'Meşə tokeni', 'Buz kristalı', 'Zirvə nişanı', 'Dağ xəzinəsi']
  },
  cosmic: {
    emoji: '🪐',
    name: 'Kosmik arxiv',
    bonus: 'xüsusi titul',
    items: ['Ulduz parçası', 'Kosmik sandıq', 'Nova token', 'Qaranlıq açar']
  }
};

export async function getProgressDashboard(userId) {
  const { store, user } = await getStoreUser(userId);
  ensureSeason(user);
  ensureObjectiveProgress(user);
  updateWorldDerived(user);
  const objectiveRewards = claimCompletedObjectiveRewards(store, user);
  await writeStore(store);
  return {
    profile: structuredClone(user),
    season: seasonSummary(user),
    goals: goalSummary(user),
    collections: collectionSummary(user),
    objectiveRewards
  };
}

export async function upgradeWorldBusiness(userId, key) {
  const { store, user } = await getStoreUser(userId);
  updateWorldDerived(user);
  const item = worldBusinesses[key];
  const owned = user.world.businesses[key] ?? 0;
  if (!item) return { ok: false, reason: 'missing', profile: structuredClone(user), world: structuredClone(user.world) };
  if (owned <= 0) return { ok: false, reason: 'not_owned', item, profile: structuredClone(user), world: structuredClone(user.world) };

  user.world.businessLevels ??= {};
  const level = user.world.businessLevels[key] ?? 1;
  if (level >= 10) return { ok: false, reason: 'max_level', item, level, profile: structuredClone(user), world: structuredClone(user.world) };

  const price = Math.floor(item.price * (0.35 + level * 0.18));
  if (user.balance < price) return { ok: false, reason: 'insufficient', item, level, price, profile: structuredClone(user), world: structuredClone(user.world) };

  user.balance -= price;
  user.stats.auraLost += price;
  user.world.businessLevels[key] = level + 1;
  user.world.influence += 3 + level;
  addSeasonXp(user, 35 + level * 5);
  addTransaction(user, -price, 'world_business_upgrade', `${item.name}: Lv.${level + 1}`);
  updateWorldDerived(user);
  updateDerivedStats(user);
  await writeStore(store);
  return { ok: true, item, level: level + 1, price, profile: structuredClone(user), world: structuredClone(user.world) };
}

export async function adminAuditUser(userId, category = 'all', limit = 20) {
  const { store, user } = await getStoreUser(userId);
  ensureSeason(user);
  updateWorldDerived(user);
  await writeStore(store);
  const transactions = filterAuditTransactions(user.transactions, category).slice(0, limit);
  const transactionTotal = transactions.reduce((sum, item) => sum + (item.amount ?? 0), 0);
  return {
    profile: structuredClone(user),
    transactions: structuredClone(transactions),
    category,
    transactionTotal,
    flags: auditFlags(user, transactions)
  };
}

export async function getWorldProfile(userId) {
  const { store, user } = await getStoreUser(userId);
  updateWorldDerived(user);
  await writeStore(store);
  return { profile: structuredClone(user), world: structuredClone(user.world) };
}

export async function chooseWorldJob(userId, jobKey) {
  const { store, user } = await getStoreUser(userId);
  const job = worldJobs[jobKey];
  if (!job) return { ok: false, reason: 'missing', profile: structuredClone(user) };

  user.world.job = jobKey;
  user.world.jobXp = user.world.jobXp ?? 0;
  user.world.jobLevel = Math.max(1, user.world.jobLevel ?? 1);
  user.world.influence += 2;
  addTransaction(user, 0, 'world_job', job.name);
  updateWorldDerived(user);
  await writeStore(store);
  return { ok: true, job, profile: structuredClone(user), world: structuredClone(user.world) };
}

export async function runWorldMission(userId, choice = 'smart') {
  const { store, user } = await getStoreUser(userId);

  updateWorldDerived(user);

  if (!user.world.job || !worldJobs[user.world.job]) {
    return {
      ok: false,
      reason: 'no_job',
      profile: structuredClone(user),
      world: structuredClone(user.world)
    };
  }

  const now = Date.now();
  const cooldown = 30 * 60 * 1000;
  const last = user.world.lastMissionAt ?? 0;

  if (now - last < cooldown) {
    return {
      ok: false,
      reason: 'cooldown',
      remainingMs: cooldown - (now - last),
      profile: structuredClone(user),
      world: structuredClone(user.world)
    };
  }

  const styles = {
    safe: {
      label: 'Sakit plan',
      chance: 0.92,
      reward: 0.9,
      xp: 18,
      influence: 1
    },

    smart: {
      label: 'Ağıllı plan',
      chance: 0.76,
      reward: 1.18,
      xp: 26,
      influence: 2
    },

    bold: {
      label: 'Cəsarətli plan',
      chance: 0.56,
      reward: 1.75,
      xp: 38,
      influence: 4
    }
  };

  const style = styles[choice] ?? styles.smart;
  const job = worldJobs[user.world.job];

  const vehicleBonus = ownedVehicleBonus(user);

  const propertyBonus =
    Object.keys(user.world.properties).length * 0.015;

  const base =
    job.salary +
    user.world.jobLevel * 80;

  const successChance = clamp(
    style.chance -
      job.risk +
      user.luck / 1000,
    0.15,
    0.97
  );

  const success =
    Math.random() <= successChance;

  user.world.lastMissionAt = now;

  let amount;

  if (success) {
    amount = safeModeAmount(
      store,
      Math.floor(
        base *
          style.reward *
          (1 + vehicleBonus + propertyBonus)
      )
    );

    user.balance += amount;
    user.stats.auraEarned += amount;

    user.world.influence +=
      style.influence;

    user.world.seasonPoints +=
      Math.ceil(style.influence * 2);
  } else {
    amount = -debtLimitedLoss(
      user,
      Math.max(
        25,
        Math.floor(base * 0.28)
      )
    );

    user.balance += amount;

    user.stats.auraLost +=
      Math.abs(amount);

    user.world.influence =
      Math.max(
        0,
        user.world.influence - 1
      );
  }

  const jobLevelBefore =
    user.world.jobLevel;

  user.world.jobXp +=
    style.xp + job.xp;

  while (
    user.world.jobXp >=
    worldJobXpNeeded(
      user.world.jobLevel
    )
  ) {
    user.world.jobXp -=
      worldJobXpNeeded(
        user.world.jobLevel
      );

    user.world.jobLevel += 1;
  }

  awardXp(
    user,
    success ? 18 : 8
  );

  addTransaction(
    user,
    amount,
    'world_mission',
    `${job.name}:${style.label}`
  );

  addObjectiveProgress(
    user,
    'worldAction'
  );

  addSeasonXp(
    user,
    success ? 45 : 16
  );

  updateDerivedStats(user);

  await writeStore(store);

  return {
    ok: true,
    success,
    amount,
    job,
    style,

    leveledJob:
      user.world.jobLevel >
      jobLevelBefore,

    profile: structuredClone(user),
    world: structuredClone(user.world)
  };
}


export async function buyWorldBusiness(userId, key) {
  return buyWorldAsset(userId, 'business', key, worldBusinesses);
}

export async function buyWorldProperty(userId, key) {
  return buyWorldAsset(userId, 'property', key, worldProperties);
}

export async function buyWorldVehicle(userId, key) {
  return buyWorldAsset(userId, 'vehicle', key, worldVehicles);
}

export async function collectWorldIncome(userId) {
  const { store, user } = await getStoreUser(userId);
  const bankBlock = await checkRestriction(userId, 'bank');
  if (bankBlock) return { ok: false, reason: 'bank_restricted', restriction: bankBlock, profile: structuredClone(user) };
  const currentUser = store.users[userId];
  updateWorldDerived(currentUser);
  const now = Date.now();
  const cooldown = 60 * 60 * 1000;
  const last = currentUser.world.lastIncomeAt ?? 0;
  if (now - last < cooldown) {
    return { ok: false, reason: 'cooldown', remainingMs: cooldown - (now - last), profile: structuredClone(currentUser), world: structuredClone(currentUser.world) };
  }

  const businessIncome = Object.entries(currentUser.world.businesses)
    .reduce((sum, [key, count]) => sum + upgradedBusinessIncome(currentUser, key) * count, 0);
  const propertyIncome = Object.entries(currentUser.world.properties)
    .reduce((sum, [key, count]) => sum + (worldProperties[key]?.income ?? 0) * count, 0);
  const base = businessIncome + propertyIncome;
  if (base <= 0) {
    return { ok: false, reason: 'no_assets', profile: structuredClone(currentUser), world: structuredClone(currentUser.world) };
  }

  const marketPulse = randomBetween(82, 126) / 100;
  const vehicleBonus = ownedVehicleBonus(user);
  const amount = safeModeAmount(store, Math.floor(base * marketPulse * (1 + vehicleBonus)));
  currentUser.world.lastIncomeAt = now;
  currentUser.balance += amount;
  currentUser.stats.auraEarned += amount;
  currentUser.world.influence += Math.max(1, Math.floor(amount / 1000));
  currentUser.world.seasonPoints += Math.max(1, Math.floor(amount / 700));
  addTransaction(currentUser, amount, 'world_income', `pulse:${Math.round(marketPulse * 100)}%`);
  addSeasonXp(currentUser, 30);
  awardXp(currentUser, 12);
  updateDerivedStats(currentUser);
  await writeStore(store);
  return { ok: true, amount, base, marketPulse, profile: structuredClone(currentUser), world: structuredClone(currentUser.world) };
}

export async function runDailyAdventure(userId, choice = 'help') {
  const { store, user } = await getStoreUser(userId);
  updateWorldDerived(user);
  const today = new Date().toISOString().slice(0, 10);
  if (user.world.lastAdventure === today) {
    return { ok: false, reason: 'claimed', profile: structuredClone(user), world: structuredClone(user.world) };
  }

  const configs = {
    help: { label: 'Kömək etdin', chance: 0.9, reward: [250, 650], loss: [0, 40], influence: 4, xp: 22 },
    ignore: { label: 'Yoluna davam etdin', chance: 1, reward: [80, 220], loss: [0, 0], influence: 1, xp: 10 },
    risk: { label: 'Risk etdin', chance: 0.52, reward: [900, 2400], loss: [250, 900], influence: 8, xp: 36 }
  };
  const config = configs[choice] ?? configs.help;
  const success = Math.random() <= config.chance;
  const amount = success
    ? safeModeAmount(store, randomBetween(config.reward[0], config.reward[1]))
    : -debtLimitedLoss(user, randomBetween(config.loss[0], config.loss[1]));
  user.world.lastAdventure = today;
  if (amount >= 0) {
    user.balance += amount;
    user.stats.auraEarned += amount;
    user.world.influence += config.influence;
  } else {
    user.balance += amount;
    user.stats.auraLost += Math.abs(amount);
    user.world.influence = Math.max(0, user.world.influence - 2);
  }
  user.world.seasonPoints += success ? config.influence : 1;
  addTransaction(user, amount, 'world_adventure', config.label);
  addObjectiveProgress(user, 'worldAction');
  addSeasonXp(user, success ? 50 : 18);
  awardXp(user, config.xp);
  updateDerivedStats(user);
  await writeStore(store);
  return { ok: true, success, amount, config, profile: structuredClone(user), world: structuredClone(user.world) };
}

export async function exploreWorld(userId, mapKey) {
  const { store, user } = await getStoreUser(userId);
  updateWorldDerived(user);
  const map = worldMaps[mapKey];
  if (!map) return { ok: false, reason: 'missing', profile: structuredClone(user), world: structuredClone(user.world) };

  const now = Date.now();
  const cooldown = 45 * 60 * 1000;
  const state = user.world.exploration[mapKey] ?? { visits: 0, lastAt: null };
  if (state.lastAt && now - state.lastAt < cooldown) {
    return { ok: false, reason: 'cooldown', remainingMs: cooldown - (now - state.lastAt), map, profile: structuredClone(user), world: structuredClone(user.world) };
  }

  const success = Math.random() > map.danger;
  const loot = pick(map.loot);
  const amount = success
    ? safeModeAmount(store, randomBetween(map.min, map.max))
    : -debtLimitedLoss(user, randomBetween(Math.floor(map.min * 0.35), Math.floor(map.max * 0.45)));
  state.visits = (state.visits ?? 0) + 1;
  state.lastAt = now;
  user.world.exploration[mapKey] = state;

  if (amount >= 0) {
    user.balance += amount;
    user.stats.auraEarned += amount;
    addUnique(user.inventory.collectibles, loot);
    user.world.influence += mapKey === 'space' || mapKey === 'dungeon' ? 5 : 2;
  } else {
    user.balance += amount;
    user.stats.auraLost += Math.abs(amount);
  }
  user.world.seasonPoints += success ? 3 : 1;
  addTransaction(user, amount, 'world_explore', `${map.name}:${loot}`);
  addObjectiveProgress(user, 'explore', 1, 'weekly');
  addSeasonXp(user, success ? 42 : 15);
  awardXp(user, success ? 24 : 10);
  updateDerivedStats(user);
  await writeStore(store);
  return { ok: true, success, amount, loot, map, visits: state.visits, profile: structuredClone(user), world: structuredClone(user.world) };
}

export async function getWorldEvent(userId) {
  const { store, user } = await getStoreUser(userId);
  updateWorldDerived(user);
  await writeStore(store);
  const events = [
    { emoji: '🌧️', name: 'Aura Yağışı', bonus: '+15% gəlir əhvalı', description: 'Biznes gəliri bu saat daha parlaq görünür. `/world collect` yoxla.' },
    { emoji: '🕶️', name: 'Qara Bazar gecəsi', bonus: 'Riskli seçimlər daha dəyərli', description: 'Riskli missiyalar daha çox həyəcan verir, amma cərimə də ağrılıdır.' },
    { emoji: '🎪', name: 'Kredit Festivalı', bonus: 'Bank təklifləri ön planda', description: 'Şəhərdə banklar aktivdir. Kredit götürməzdən əvvəl reytinqinə bax.' },
    { emoji: '🏆', name: 'Arena Səs-küyü', bonus: 'Nüfuz diqqəti artır', description: 'Duel, heist və sosial oyunlar bu gün chatda daha çox diqqət çəkir.' }
  ];
  const seed = Math.floor(Date.now() / (6 * 60 * 60 * 1000));
  const event = events[seed % events.length];
  return { event, profile: structuredClone(user), world: structuredClone(user.world) };
}

const activityConfigs = {
  work: { label: 'İş', min: 80, max: 220, failMin: 0, failMax: 20, chance: 0.92, xp: 12, cooldown: 60 * 60 * 1000 },
  crime: { label: 'Riskli iş', min: 250, max: 700, failMin: 120, failMax: 360, chance: 0.48, xp: 18, cooldown: 90 * 60 * 1000 },
  hunt: { label: 'Ov', min: 70, max: 260, failMin: 0, failMax: 40, chance: 0.75, xp: 12, cooldown: 45 * 60 * 1000 },
  fish: { label: 'Balıqçılıq', min: 60, max: 240, failMin: 0, failMax: 25, chance: 0.82, xp: 10, cooldown: 40 * 60 * 1000 },
  mine: { label: 'Mədən', min: 100, max: 320, failMin: 0, failMax: 60, chance: 0.70, xp: 14, cooldown: 50 * 60 * 1000 },
  beg: { label: 'Kiçik istək', min: 15, max: 90, failMin: 0, failMax: 0, chance: 0.88, xp: 5, cooldown: 20 * 60 * 1000 },
 rob: {
  label: 'Soyğun',
  min: 25,
  max: 300,
  failMin: 25,
  failMax: 160,
  chance: 0.42,
  xp: 20,

  // Dynamic cooldown uses this only as fallback.
  cooldown: 5 * 60 * 1000,

  minTargetBalance: 100,
  maxTargetPercent: 0.15
},
  collect: { label: 'Toplama', min: 40, max: 180, failMin: 0, failMax: 10, chance: 0.90, xp: 8, cooldown: 30 * 60 * 1000 }
};

function dynamicTransferLimits(user) {
  const totalAura = Math.max(0, (user.balance ?? 0) + (user.bank ?? 0));
  const level = Math.max(1, user.level ?? 1);
  const prestige = Math.max(0, user.prestige ?? 0);

  let single = 2500;
  let daily = 10000;

  if (totalAura >= 15000) {
    single = 10000;
    daily = 40000;
  }

  if (totalAura >= 50000) {
    single = 25000;
    daily = 100000;
  }

  if (totalAura >= 150000) {
    single = 50000;
    daily = 250000;
  }

  if (totalAura >= 400000) {
    single = 100000;
    daily = 500000;
  }

  single = Math.floor(single + level * 500 + prestige * 5000);
  daily = Math.floor(daily + level * 2000 + prestige * 20000);

  return {
    single: clamp(single, 2500, transferSingleLimitCap),
    daily: clamp(daily, 10000, transferDailyLimitCap)
  };
}

export function calculateCasinoBetLimit(user) {
  const wallet = Math.max(0, user.balance ?? 0);
  const bank = Math.max(0, user.bank ?? 0);
  const totalAura = wallet + bank;

  const level = Math.max(1, user.level ?? 1);
  const prestige = Math.max(0, user.prestige ?? 0);

  let limit;

  // New / low balance
  if (totalAura < 1000) {
    limit = 300;
  }

  // 1k - 5k
  else if (totalAura < 5000) {
    limit = Math.floor(
      500 +
      totalAura * 0.15 +
      level * 20
    );
  }

  // 5k - 15k
  else if (totalAura < 15000) {
    limit = Math.floor(
      1500 +
      totalAura * 0.18 +
      level * 35
    );
  }

  // 15k - 50k
  else if (totalAura < 50000) {
    limit = Math.floor(
      4000 +
      totalAura * 0.20 +
      level * 50 +
      prestige * 500
    );
  }

  // 50k - 150k
  else if (totalAura < 150000) {
    limit = Math.floor(
      10000 +
      totalAura * 0.18 +
      level * 75 +
      prestige * 1000
    );
  }

  // 150k+
  else {
    limit = Math.floor(
      25000 +
      totalAura * 0.15 +
      level * 100 +
      prestige * 2000
    );
  }

  // Absolute economy protection
  limit = Math.min(limit, 100000);

  // You can NEVER bet more than what's actually
  // available in the wallet.
  return Math.max(1, Math.min(limit, wallet));
}

function casinoBetLimit(user) {
  return calculateCasinoBetLimit(user);
}

function currentDayKey() {
  return new Date().toISOString().slice(0, 10);
}

function isToday(dateValue, today = currentDayKey()) {
  return typeof dateValue === 'string' && dateValue.slice(0, 10) === today;
}

function resetShopChestLimit(user, today = currentDayKey(), count = 0) {
  if (user.limits.shopChestDate !== today) {
    user.limits.shopChestDate = today;
    user.limits.shopChestsBought = count;
  }
}

function casinoRestrictionForBet(user, bet) {
  const adminMaxBet = user.moderation?.casinoMaxBet;
  if (Number.isInteger(adminMaxBet)) {
    if (bet <= adminMaxBet) {
      return null;
    }

    return {
      maxBet: adminMaxBet,
      reason: user.moderation?.casinoReason ?? 'admin review',
      restrictedAt: user.moderation?.casinoRestrictedAt ?? null,
      restrictedBy: user.moderation?.casinoRestrictedBy ?? null
    };
  }

  const maxBet = casinoBetLimit(user);
  if (bet <= maxBet) {
    return null;
  }

  return {
    maxBet,
    reason: 'balance and bank based limit',
    restrictedAt: null,
    restrictedBy: null
  };
}

function safeModeAmount(store, amount) {
  if (!store.settings?.safeModeEnabled || amount <= 0) {
    return amount;
  }

  return Math.max(1, Math.floor(amount * safeModePayoutMultiplier));
}

function safeModeRobAmount(store, amount) {
  if (!store.settings?.safeModeEnabled || amount <= 0) {
    return amount;
  }

  return Math.max(1, Math.floor(amount * safeModeRobMultiplier));
}

function safeModeRobConfig(store, config) {
  if (!store.settings?.safeModeEnabled) {
    return config;
  }

  return {
    ...config,
    min: Math.max(1, Math.floor(config.min * safeModeRobMultiplier)),
    max: Math.max(1, Math.floor(config.max * safeModeRobMultiplier)),
    failMin: config.failMin,
    failMax: config.failMax,
    safeMode: true
  };
}

function resetRobLimits(user, today = currentDayKey()) {
  if (user.limits.robDate !== today) {
    user.limits.robDate = today;
    user.limits.robTargets = {};
    user.limits.robbedCount = 0;
  }
  user.limits.robTargets ??= {};
  user.limits.robbedCount ??= 0;
}

function debtLimitedLoss(user, amount) {
  return Math.max(0, Math.min(amount, user.balance - maxNegativeBalance));
}

function isShopChest(itemKey) {
  return itemKey === 'bronze_key' || itemKey === 'starter_chest' || itemKey === 'gold_chest';
}

function shopChestNameToKey(name) {
  if (name === shopItems.bronze_key.name) return 'bronze_key';
  if (name === shopItems.starter_chest.name) return 'starter_chest';
  if (name === shopItems.gold_chest.name) return 'gold_chest';
  return null;
}

function openedChestName(item) {
  return item.type === 'keys' ? 'Bronze Key cache' : item.name;
}

function findRevertableChestOpen(transactions, chestName, usedIndexes, today) {
  return transactions
    .map((transaction, index) => ({ ...transaction, index }))
    .find(transaction => (
      !usedIndexes.has(transaction.index)
      && isToday(transaction.at, today)
      && transaction.type === 'open_chest'
      && `${transaction.note}`.startsWith(`${chestName}:`)
      && transaction.amount > 0
    ));
}

function collectibleFromOpenNote(note) {
  const [, collectible = ''] = `${note}`.split(': ');
  return collectible.split(':')[0].trim();
}

function dynamicRobConfig(robber, target, baseConfig) {
  const targetBalance = Math.max(0, target.balance ?? 0);
  const robberBalance = Math.max(0, robber.balance ?? 0);
  const scaledMax = clamp(Math.floor(targetBalance * 0.08), baseConfig.max, 10000);
  const scaledMin = clamp(Math.floor(targetBalance * 0.01), baseConfig.min, Math.max(baseConfig.min, Math.floor(scaledMax * 0.4)));
  const failMax = clamp(Math.floor(Math.max(robberBalance, 1) * 0.08), baseConfig.failMax, 2500);

  return {
    ...baseConfig,
    min: Math.min(scaledMin, scaledMax),
    max: scaledMax,
    failMax,
    dynamic: true
  };
}


async function readStore() {
  if (cache) {
    ensureStoreSettings(cache);
    return cache;
  }

  cache = await loadEconomyStore();
  ensureStoreSettings(cache);

  for (const userId of Object.keys(cache.users)) {
    cache.users[userId] = migrateUser(cache.users[userId]);
  }

  storeSnapshots.set(cache, captureStoreSnapshot(cache));

  return cache;
}

async function writeStore(store) {
  ensureStoreSettings(store);

  for (const userId of Object.keys(store.users || {})) {
    store.users[userId] = migrateUser(store.users[userId]);
  }

  const snapshots = storeSnapshots.get(store) ?? captureStoreSnapshot(store);
  const nextSettingsSnapshot = JSON.stringify(store.settings);

  if (snapshots.settings !== nextSettingsSnapshot) {
    await saveEconomySettings(store.settings);
    snapshots.settings = nextSettingsSnapshot;
  }

  for (const [userId, user] of Object.entries(store.users)) {
    const nextUserSnapshot = JSON.stringify(user);
    if (snapshots.users.get(userId) === nextUserSnapshot) {
      continue;
    }

    const result = await saveEconomyProfile(userId, user, store.versions?.[userId] ?? 0);
    store.versions[userId] = result.version ?? store.versions?.[userId] ?? 0;
    snapshots.users.set(userId, nextUserSnapshot);
  }

  storeSnapshots.set(store, snapshots);
  cache = store;
}

function ensureUser(store, userId) {
  store.users[userId] = migrateUser(store.users[userId]);
}

async function getStoreUser(userId) {
  const store = await readStore();

  // IMPORTANT:
  // Discord and the website run in separate Node processes.
  // Their module-level caches are therefore independent.
  //
  // Refresh this user's latest persisted profile/version before using it,
  // so a web mutation cannot be overwritten by stale Discord state
  // (and vice versa).
  const freshStore = await loadEconomyStore([userId]);
  const freshUser = freshStore.users?.[userId];

  if (freshUser) {
    store.users[userId] = migrateUser(freshUser);
    store.versions[userId] = freshStore.versions?.[userId] ?? 0;

    // This is now the persisted baseline. Without updating the snapshot,
    // writeStore() could mistake the refresh itself for a local mutation.
    const snapshots =
      storeSnapshots.get(store) ?? captureStoreSnapshot(store);

    snapshots.users.set(
      userId,
      JSON.stringify(store.users[userId])
    );

    storeSnapshots.set(store, snapshots);
  }

  ensureUser(store, userId);

  return {
    store,
    user: store.users[userId]
  };
}

function ensureStoreSettings(store) {
  store.users = store.users ?? {};
  store.settings = {
    chestsEnabled: store.settings?.chestsEnabled ?? true,
    chestsUpdatedAt: store.settings?.chestsUpdatedAt ?? null,
    chestsUpdatedBy: store.settings?.chestsUpdatedBy ?? null,
    safeModeEnabled: store.settings?.safeModeEnabled ?? false,
    safeModeUpdatedAt: store.settings?.safeModeUpdatedAt ?? null,
    safeModeUpdatedBy: store.settings?.safeModeUpdatedBy ?? null
  };
  store.versions = store.versions ?? {};
}

function captureStoreSnapshot(store) {
  const users = new Map();

  for (const [userId, user] of Object.entries(store.users ?? {})) {
    users.set(userId, JSON.stringify(user));
  }

  return {
    settings: JSON.stringify(store.settings ?? {}),
    users
  };
}

function migrateUser(user = {}) {
  const migrated = {
    balance: user.balance ?? startingBalance,
    bank: user.bank ?? 0,
    xp: user.xp ?? 0,
    level: user.level ?? 1,
    prestige: user.prestige ?? 0,
    dailyStreak: user.dailyStreak ?? 0,
    lastDaily: user.lastDaily ?? null,
    lastWeekly: user.lastWeekly ?? null,
    lastMonthly: user.lastMonthly ?? null,
    lastInterest: user.lastInterest ?? null,
    lastTax: user.lastTax ?? null,
    luck: user.luck ?? 50,
    reputation: user.reputation ?? 0,
    rank: user.rank ?? '🌱 Yeni başlayan',
    title: user.title ?? 'Yeni üzv',
    badges: user.badges ?? [],
    achievements: user.achievements ?? [],
    collection: user.collection ?? [],
    transactions: user.transactions ?? [],
    cooldowns: user.cooldowns ?? {},
    moderation: {
      casinoMaxBet: user.moderation?.casinoMaxBet ?? null,
      casinoReason: user.moderation?.casinoReason ?? null,
      casinoRestrictedAt: user.moderation?.casinoRestrictedAt ?? null,
      casinoRestrictedBy: user.moderation?.casinoRestrictedBy ?? null,
      // structured restrictions applied by moderation: array of { id, type, moderatorId, reason, meta, createdAt, expiresAt }
      restrictions: Array.isArray(user.moderation?.restrictions) ? user.moderation.restrictions : []
    },
    settings: {
      publicProfile: user.settings?.publicProfile ?? true,
      dmRewards: user.settings?.dmRewards ?? false,
      compactMode: user.settings?.compactMode ?? false,
      gameRequests: user.settings?.gameRequests ?? true
    },
    limits: {
      transferDate: user.limits?.transferDate ?? null,
      transferSent: user.limits?.transferSent ?? 0,
      shopChestDate: user.limits?.shopChestDate ?? null,
      shopChestsBought: user.limits?.shopChestsBought ?? 0,
      shopChestRevertedDate: user.limits?.shopChestRevertedDate ?? null,
      robDate: user.limits?.robDate ?? null,
      robTargets: user.limits?.robTargets ?? {},
      robbedCount: user.limits?.robbedCount ?? 0
    },
    loan: {
      creditScore: user.loan?.creditScore ?? 720,
      active: user.loan?.active ?? null,
      frozen: user.loan?.frozen ?? false,
      insured: user.loan?.insured ?? false,
      insuranceMonth: user.loan?.insuranceMonth ?? null,
      stats: {
        onTimePayments: user.loan?.stats?.onTimePayments ?? 0,
        latePayments: user.loan?.stats?.latePayments ?? 0,
        totalBorrowed: user.loan?.stats?.totalBorrowed ?? 0,
        totalRepaid: user.loan?.stats?.totalRepaid ?? 0
      }
    },
    prime: {
      activeUntil: user.prime?.activeUntil ?? null,
      purchasedAt: user.prime?.purchasedAt ?? null,
      refundsRemaining: user.prime?.refundsRemaining ?? 0,
      monthKey: user.prime?.monthKey ?? null,
      losses: Array.isArray(user.prime?.losses) ? user.prime.losses : []
    },
    world: {
      job: user.world?.job ?? null,
      jobXp: user.world?.jobXp ?? 0,
      jobLevel: user.world?.jobLevel ?? 1,
      lastMissionAt: user.world?.lastMissionAt ?? null,
      businesses: user.world?.businesses ?? {},
      businessLevels: user.world?.businessLevels ?? {},
      properties: user.world?.properties ?? {},
      vehicles: Array.isArray(user.world?.vehicles) ? user.world.vehicles : [],
      lastIncomeAt: user.world?.lastIncomeAt ?? null,
      lastAdventure: user.world?.lastAdventure ?? null,
      exploration: user.world?.exploration ?? {},
      influence: user.world?.influence ?? 0,
      guild: user.world?.guild ?? null,
      pets: Array.isArray(user.world?.pets) ? user.world.pets : [],
      seasonPoints: user.world?.seasonPoints ?? 0,
      netWorth: user.world?.netWorth ?? 0
    },
    season: {
      key: user.season?.key ?? activeSeason.key,
      xp: user.season?.xp ?? 0,
      level: user.season?.level ?? 1,
      claimedFree: Array.isArray(user.season?.claimedFree) ? user.season.claimedFree : [],
      claimedPrime: Array.isArray(user.season?.claimedPrime) ? user.season.claimedPrime : [],
      totalXp: user.season?.totalXp ?? user.season?.xp ?? 0
    },
    objectiveProgress: {
      dailyKey: user.objectiveProgress?.dailyKey ?? null,
      weeklyKey: user.objectiveProgress?.weeklyKey ?? null,
      dailyRewardKey: user.objectiveProgress?.dailyRewardKey ?? null,
      weeklyRewardKey: user.objectiveProgress?.weeklyRewardKey ?? null,
      daily: user.objectiveProgress?.daily ?? {},
      weekly: user.objectiveProgress?.weekly ?? {}
    },
    onboarding: {
      welcomeSeen: user.onboarding?.welcomeSeen ?? false,
      beginnerBonusClaimed: user.onboarding?.beginnerBonusClaimed ?? false,
      tutorialCompleted: user.onboarding?.tutorialCompleted ?? false
    },
    inventory: {
      boosters: user.inventory?.boosters ?? [],
      boosterCharges: user.inventory?.boosterCharges ?? Math.max(0, Array.isArray(user.inventory?.boosters) && user.inventory.boosters.includes('Lucky Booster') ? 1 : 0),
      tickets: user.inventory?.tickets ?? 0,
      keys: user.inventory?.keys ?? 0,
      chests: user.inventory?.chests ?? {},
      collectibles: user.inventory?.collectibles ?? [],
      badges: user.inventory?.badges ?? [],
      titles: user.inventory?.titles ?? [],
      borders: user.inventory?.borders ?? [],
      effects: user.inventory?.effects ?? []
    },
    stats: {
      gamesPlayed: user.stats?.gamesPlayed ?? 0,
      gamesWon: user.stats?.gamesWon ?? 0,
      gamesLost: user.stats?.gamesLost ?? 0,
      auraEarned: user.stats?.auraEarned ?? 0,
      auraLost: user.stats?.auraLost ?? 0,
      biggestWin: user.stats?.biggestWin ?? 0,
      biggestLoss: user.stats?.biggestLoss ?? 0,
      currentStreak: user.stats?.currentStreak ?? user.dailyStreak ?? 0,
      longestStreak: user.stats?.longestStreak ?? user.dailyStreak ?? 0,
      favoriteGames: user.stats?.favoriteGames ?? {},
      averageBet: user.stats?.averageBet ?? 0,
      highestMultiplier: user.stats?.highestMultiplier ?? 0,
      jackpotsWon: user.stats?.jackpotsWon ?? 0
    }
  };

  updateDerivedStats(migrated);
  updateWorldDerived(migrated);
  ensureSeason(migrated);
  ensureObjectiveProgress(migrated);
  applyLoanState(migrated);
  unlockAchievements(migrated);
  return migrated;
}

function loanOffer(user, lender = 'octobank') {
  const grade = creditGrade(user.loan.creditScore);
  const scoreRates = { AAA: 0.03, AA: 0.05, A: 0.08, B: 0.12, C: 0.18, D: 0.25 };

  if (lender === 'blackmarket') {
    return {
      lender,
      label: 'Kölgə Krediti',
      min: 500,
      max: Math.min(50000, 5000 + user.level * 1300 + user.prestige * 12000),
      interest: Math.min(0.42, scoreRates[grade.grade] + 0.16),
      payments: 3,
      durationMs: 2 * dayMs,
      paymentEveryMs: 12 * 60 * 60 * 1000,
      requiredLevel: 1,
      requiredPrestige: 0,
      requiredScore: 250
    };
  }

  if (lender === 'business') {
    return {
      lender,
      label: 'Biznes Krediti',
      min: 5000,
      max: 25000,
      interest: 0.05,
      payments: 10,
      durationMs: 10 * dayMs,
      paymentEveryMs: dayMs,
      requiredLevel: 20,
      requiredPrestige: 0,
      requiredScore: 680
    };
  }

  if (lender === 'vip') {
    return {
      lender,
      label: 'VIP Kredit',
      min: 10000,
      max: 100000,
      interest: 0.02,
      payments: 14,
      durationMs: 14 * dayMs,
      paymentEveryMs: dayMs,
      requiredLevel: 1,
      requiredPrestige: 1,
      requiredScore: 760
    };
  }

  if (lender === 'casino') {
    return {
      lender,
      label: 'Casino Express',
      min: 100,
      max: 500,
      interest: 0.20,
      payments: 1,
      durationMs: 30 * 60 * 1000,
      paymentEveryMs: 30 * 60 * 1000,
      requiredLevel: 1,
      requiredPrestige: 0,
      requiredScore: 250
    };
  }

  return {
    lender: 'octobank',
    label: 'OctoBank',
    min: 1000,
    max: Math.min(12500, 2500 + user.level * 500 + user.prestige * 2500),
    interest: scoreRates[grade.grade],
    payments: 5,
    durationMs: 7 * dayMs,
    paymentEveryMs: dayMs,
    requiredLevel: 1,
    requiredPrestige: 0,
    requiredScore: 450
  };
}

function loanProfile(user) {
  const grade = creditGrade(user.loan.creditScore);
  return {
    balance: user.balance,
    bank: user.bank,
    grade,
    score: user.loan.creditScore,
    active: structuredClone(user.loan.active),
    frozen: user.loan.frozen,
    insured: user.loan.insured,
    offers: {
      octobank: loanOffer(user, 'octobank'),
      blackmarket: loanOffer(user, 'blackmarket'),
      business: loanOffer(user, 'business'),
      vip: loanOffer(user, 'vip'),
      casino: loanOffer(user, 'casino')
    },
    stats: structuredClone(user.loan.stats)
  };
}

function primeProfile(user) {
  prunePrime(user);
  const active = isPrimeActive(user);
  return {
    active,
    price: primePrice,
    activeUntil: user.prime.activeUntil,
    purchasedAt: user.prime.purchasedAt,
    refundsRemaining: active ? user.prime.refundsRemaining : 0,
    refundLimit: primeRefundLimit,
    losses: structuredClone(eligiblePrimeLosses(user)),
    allLosses: structuredClone(user.prime.losses)
  };
}

function isPrimeActive(user) {
  return Boolean(user.prime?.activeUntil && user.prime.activeUntil > Date.now());
}

function prunePrime(user) {
  user.prime ??= {};
  user.prime.losses = Array.isArray(user.prime.losses) ? user.prime.losses : [];
  user.prime.losses = user.prime.losses.filter(loss => !loss.expiresAt || loss.expiresAt > Date.now() || loss.refunded);

  if (user.prime.activeUntil && user.prime.activeUntil <= Date.now()) {
    user.prime.activeUntil = null;
    user.prime.refundsRemaining = 0;
  }
}

function recordPrimeLoss(user, { game, bet, net }) {
  prunePrime(user);
  if (!isPrimeActive(user) || net >= 0 || user.prime.refundsRemaining <= 0) return;

  const lossAmount = Math.abs(net);
  user.prime.losses.unshift({
    id: createPrimeLossId(game),
    game,
    bet,
    lossAmount,
    net,
    createdAt: Date.now(),
    expiresAt: Date.now() + primeLossRetentionMs,
    refunded: false,
    refundedAt: null
  });
  user.prime.losses = user.prime.losses.slice(0, 25);
}

function eligiblePrimeLosses(user) {
  return user.prime.losses
    .filter(loss => !loss.refunded && loss.expiresAt > Date.now())
    .slice(0, 25);
}

function createPrimeLossId(game) {
  return `pr_${game}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
}

function currentMonthKey() {
  return new Date().toISOString().slice(0, 7);
}

function applyLoanState(user) {
  if (!user.loan?.active) return;

  const loan = user.loan.active;
  const now = Date.now();
  const penaltyWindow = new Date(now).toISOString().slice(0, 10);

  if (now > loan.nextPaymentAt && loan.lastPenaltyAt !== penaltyWindow) {
    const penalty = loan.lender === 'blackmarket'
      ? Math.ceil(loan.remaining * 0.10) + 250
      : Math.ceil(loan.remaining * 0.04) + 75;
    const covered = user.loan.insured && user.loan.insuranceMonth === new Date().toISOString().slice(0, 7);
    const appliedPenalty = covered ? Math.ceil(penalty * 0.5) : penalty;
    loan.remaining += appliedPenalty;
    loan.missedPayments += 1;
    loan.lastPenaltyAt = penaltyWindow;
    loan.nextPaymentAt = now + loan.paymentEveryMs;
    user.loan.stats.latePayments += 1;
    user.loan.creditScore = clamp(user.loan.creditScore - (loan.lender === 'blackmarket' ? 70 : 35), 250, 950);
    if (covered) user.loan.insured = false;
    addTransaction(user, -appliedPenalty, 'loan_penalty', covered ? 'insurance covered 50%' : 'missed payment');
  }

  if (now > loan.dueAt && loan.remaining > 0) {
    user.loan.frozen = true;
  }
}

function creditGrade(score) {
  if (score >= 900) return { grade: 'AAA', stars: '⭐⭐⭐⭐⭐', label: 'Əla' };
  if (score >= 800) return { grade: 'AA', stars: '⭐⭐⭐⭐', label: 'Çox yaxşı' };
  if (score >= 680) return { grade: 'A', stars: '⭐⭐⭐', label: 'Yaxşı' };
  if (score >= 560) return { grade: 'B', stars: '⭐⭐', label: 'Orta' };
  if (score >= 430) return { grade: 'C', stars: '⭐', label: 'Riskli' };
  return { grade: 'D', stars: '❌', label: 'Qara siyahı' };
}

function awardXp(user, amount) {
  const before = user.level;
  if (user.level >= maxLevel) {
    user.level = maxLevel;
    user.xp = 0;
    updateDerivedStats(user);
    return false;
  }

  user.xp += amount;

  while (user.level < maxLevel && user.xp >= xpNeeded(user.level)) {
    user.xp -= xpNeeded(user.level);
    user.level += 1;
  }

  if (user.level >= maxLevel) {
    user.level = maxLevel;
    user.xp = 0;
  }

  updateDerivedStats(user);
  return user.level > before;
}

export function xpNeeded(level) {
  return 100 + (level - 1) * 35;
}

function updateDerivedStats(user) {
  if (user.level >= maxLevel) {
    user.level = maxLevel;
    user.xp = 0;
  }

  const rank = ranks
    .filter(item => user.balance >= item.minAura && user.level >= item.minLevel)
    .at(-1) ?? ranks[0];
  user.rank = `${rank.emoji} ${rank.name}`;
}

async function buyWorldAsset(userId, kind, key, catalog) {
  const { store, user } = await getStoreUser(userId);
  updateWorldDerived(user);
  const item = catalog[key];
  if (!item) return { ok: false, reason: 'missing', profile: structuredClone(user), world: structuredClone(user.world) };

  if (kind === 'vehicle' && user.world.vehicles.includes(key)) {
    return { ok: false, reason: 'owned', item, profile: structuredClone(user), world: structuredClone(user.world) };
  }

  if (user.balance < item.price) {
    return { ok: false, reason: 'insufficient', item, profile: structuredClone(user), world: structuredClone(user.world) };
  }

  user.balance -= item.price;
  user.stats.auraLost += item.price;

  if (kind === 'business') {
    user.world.businesses[key] = (user.world.businesses[key] ?? 0) + 1;
  } else if (kind === 'property') {
    user.world.properties[key] = (user.world.properties[key] ?? 0) + 1;
  } else {
    user.world.vehicles.push(key);
  }

  user.world.influence += item.influence ?? 0;
  addTransaction(user, -item.price, `world_${kind}`, item.name);
  awardXp(user, 14);
  updateWorldDerived(user);
  updateDerivedStats(user);
  await writeStore(store);
  return { ok: true, item, profile: structuredClone(user), world: structuredClone(user.world) };
}

function updateWorldDerived(user) {
  if (!user.world) return;
  user.world.jobLevel = Math.max(1, user.world.jobLevel ?? 1);
  user.world.jobXp = Math.max(0, user.world.jobXp ?? 0);
  user.world.influence = Math.max(0, user.world.influence ?? 0);
  user.world.seasonPoints = Math.max(0, user.world.seasonPoints ?? 0);
  user.world.businesses = user.world.businesses ?? {};
  user.world.businessLevels = user.world.businessLevels ?? {};
  user.world.properties = user.world.properties ?? {};
  user.world.vehicles = Array.isArray(user.world.vehicles) ? user.world.vehicles : [];
  user.world.exploration = user.world.exploration ?? {};

  const businessValue = Object.entries(user.world.businesses)
    .reduce((sum, [key, count]) => sum + (worldBusinesses[key]?.price ?? 0) * count, 0);
  const propertyValue = Object.entries(user.world.properties)
    .reduce((sum, [key, count]) => sum + (worldProperties[key]?.price ?? 0) * count, 0);
  const vehicleValue = user.world.vehicles
    .reduce((sum, key) => sum + (worldVehicles[key]?.price ?? 0), 0);
  user.world.netWorth = user.balance + user.bank + businessValue + propertyValue + vehicleValue;
}

function ensureSeason(user) {
  user.season ??= {};
  if (user.season.key !== activeSeason.key) {
    user.season = {
      key: activeSeason.key,
      xp: 0,
      level: 1,
      claimedFree: [],
      claimedPrime: [],
      totalXp: 0
    };
  }
  user.season.level = clamp(user.season.level ?? 1, 1, activeSeason.maxLevel);
  user.season.xp = Math.max(0, user.season.xp ?? 0);
  user.season.totalXp = Math.max(user.season.totalXp ?? 0, user.season.xp);
  user.season.claimedFree = Array.isArray(user.season.claimedFree) ? user.season.claimedFree : [];
  user.season.claimedPrime = Array.isArray(user.season.claimedPrime) ? user.season.claimedPrime : [];
}

function addSeasonXp(user, amount) {
  ensureSeason(user);
  user.season.xp += amount;
  user.season.totalXp += amount;
  while (user.season.level < activeSeason.maxLevel && user.season.xp >= seasonXpNeeded(user.season.level)) {
    user.season.xp -= seasonXpNeeded(user.season.level);
    user.season.level += 1;
  }
}

function seasonXpNeeded(level) {
  return 180 + (level - 1) * 45;
}

function seasonSummary(user) {
  ensureSeason(user);
  const rewardLevels = [5, 10, 20, 30, 40, 50];
  return {
    ...activeSeason,
    level: user.season.level,
    xp: user.season.xp,
    nextXp: seasonXpNeeded(user.season.level),
    totalXp: user.season.totalXp,
    daysLeft: Math.max(0, Math.ceil((activeSeason.endsAt - Date.now()) / dayMs)),
    rewards: rewardLevels.map(level => ({
      level,
      free: seasonFreeReward(level),
      prime: seasonPrimeReward(level),
      unlocked: user.season.level >= level,
      claimedFree: user.season.claimedFree.includes(level),
      claimedPrime: user.season.claimedPrime.includes(level)
    }))
  };
}

function goalSummary(user) {
  ensureObjectiveProgress(user);
  const nextRank = ranks.find(item => user.balance < item.minAura || user.level < item.minLevel);
  const chests = Object.values(user.inventory.chests ?? {}).reduce((sum, count) => sum + count, 0);
  const todayStart = startOfUtcDay(Date.now());
  const weekStart = startOfUtcWeek(Date.now());
  const worldActionCount = Number(user.world?.lastMissionAt ?? 0) >= todayStart || user.world?.lastAdventure === new Date().toISOString().slice(0, 10) ? 1 : 0;
  const exploreCount = Object.values(user.world?.exploration ?? {})
    .filter(item => Number(item?.lastAt ?? 0) >= weekStart)
    .length;
  const daily = [
    goal('3 casino oyunu oyna', Math.max(objectiveCount(user, 'casino'), transactionCountSince(user, objectiveCasinoTypes, todayStart)), 3),
    goal('500 Aura bank hesabına yatır', objectiveCount(user, 'bankDepositAura'), 500),
    goal('1 world mission və ya adventure et', Math.max(objectiveCount(user, 'worldAction'), transactionCountSince(user, ['world_mission', 'world_adventure'], todayStart), worldActionCount), 1),
    goal('Dostuna Aura gift/transfer göndər', Math.max(objectiveCount(user, 'transfer'), transactionCountSince(user, ['gift', 'transfer', 'social_gift', 'social_transfer'], todayStart)), 1)
  ];
  const weeklyCore = [
    goal('10 PvP/casino oyunu tamamla', Math.max(objectiveCount(user, 'games', 'weekly'), transactionCountSince(user, [...objectiveCasinoTypes, ...objectivePvpTypes], weekStart)), 10),
    goal('5 məkan kəşf et', Math.max(objectiveCount(user, 'explore', 'weekly'), transactionCountSince(user, ['world_explore'], weekStart), exploreCount), 5),
    goal('1 sandıq aç və ya market istifadə et', Math.max(objectiveCount(user, 'market', 'weekly'), transactionCountSince(user, ['open_chest', 'shop_buy', 'sell', 'recycle', 'salvage', 'craft'], weekStart)), 1)
  ];
  const completedGoals = daily.filter(item => item.done).length + weeklyCore.filter(item => item.done).length;
  const weekly = [
    ...weeklyCore,
    goal('Bonus chest üçün 5 tapşırıq tamamla', completedGoals, 5)
  ];
  const milestones = [
    nextRank ? `Növbəti rank üçün ${formatGoalNeed(nextRank.minAura - user.balance)} Aura və Sv.${nextRank.minLevel} lazımdır.` : 'Ən yüksək rank yolundasan.',
    user.level < maxLevel ? `Sv.${user.level + 1} üçün ${formatGoalNeed(xpNeeded(user.level) - user.xp)} XP qalıb.` : 'Level cap tamamdır. Prestij düşün.',
    chests > 0 ? `${chests} sandığın var. /market open ilə aç.` : 'Sandıq qazanmaq üçün daily və quest et.',
    user.prime?.activeUntil > Date.now() ? `Prime refund haqqı: ${user.prime.refundsRemaining}/${primeRefundLimit}.` : 'Prime aktiv deyil: 10,000 Aura ilə refund haqqı aça bilərsən.'
  ];
  return { daily, weekly, milestones };
}

function claimCompletedObjectiveRewards(store, user) {
  ensureObjectiveProgress(user);
  const rewards = [];
  const summary = goalSummary(user);

  if (summary.daily.every(item => item.done) && user.objectiveProgress.dailyRewardKey !== user.objectiveProgress.dailyKey) {
    const aura = safeModeAmount(store, 450);
    const chest = 'Gündəlik məqsəd sandığı';
    user.objectiveProgress.dailyRewardKey = user.objectiveProgress.dailyKey;
    user.balance += aura;
    user.stats.auraEarned += aura;
    user.inventory.chests[chest] = (user.inventory.chests[chest] ?? 0) + 1;
    addTransaction(user, aura, 'objective_daily_reward', chest);
    addSeasonXp(user, 80);
    awardXp(user, 35);
    unlockAchievements(user);
    rewards.push({ scope: 'daily', aura, chest });
  }

  const weeklyBonus = summary.weekly.at(-1);
  if (weeklyBonus?.done && user.objectiveProgress.weeklyRewardKey !== user.objectiveProgress.weeklyKey) {
    const aura = safeModeAmount(store, 1200);
    const chest = 'Həftəlik bonus sandığı';
    user.objectiveProgress.weeklyRewardKey = user.objectiveProgress.weeklyKey;
    user.balance += aura;
    user.stats.auraEarned += aura;
    user.inventory.chests[chest] = (user.inventory.chests[chest] ?? 0) + 1;
    user.inventory.keys += 1;
    addTransaction(user, aura, 'objective_weekly_reward', `${chest} + key`);
    addSeasonXp(user, 180);
    awardXp(user, 70);
    unlockAchievements(user);
    rewards.push({ scope: 'weekly', aura, chest, keys: 1 });
  }

  return rewards;
}

function collectionSummary(user) {
  const owned = new Set((user.inventory.collectibles ?? []).map(normalizeCollectibleName));
  return Object.entries(collectionSets).map(([key, set]) => {
    const found = set.items.filter(item => owned.has(normalizeCollectibleName(item)));
    return {
      key,
      name: set.name,
      emoji: set.emoji,
      bonus: set.bonus,
      found,
      total: set.items.length,
      missing: set.items.filter(item => !owned.has(normalizeCollectibleName(item))),
      complete: found.length === set.items.length
    };
  });
}

function normalizeCollectibleName(item) {
  const aliases = {
    'Mirror Shard': 'Güzgü parçası',
    'Neon Lace': 'Neon lent',
    'Aura Token': 'Aura tokeni',
    'Prestige Thread': 'Prestij sapı',
    'October Crest': 'Oktyabr nişanı'
  };
  return aliases[item] ?? item;
}

function goal(label, current, target) {
  const value = clamp(current, 0, target);
  return { label, current: value, target, done: value >= target };
}

function transactionCountSince(user, types, since) {
  return user.transactions.filter(item => types.includes(item.type) && Date.parse(item.at) >= since).length;
}

function ensureObjectiveProgress(user) {
  const today = new Date().toISOString().slice(0, 10);
  const week = rewardPeriod('weekly');
  user.objectiveProgress ??= {};

  if (user.objectiveProgress.dailyKey !== today) {
    user.objectiveProgress.dailyKey = today;
    user.objectiveProgress.daily = {};
  }

  if (user.objectiveProgress.weeklyKey !== week) {
    user.objectiveProgress.weeklyKey = week;
    user.objectiveProgress.weekly = {};
  }

  user.objectiveProgress.daily ??= {};
  user.objectiveProgress.weekly ??= {};
}

function addObjectiveProgress(user, key, amount = 1, scope = 'daily') {
  ensureObjectiveProgress(user);
  user.objectiveProgress[scope][key] = (user.objectiveProgress[scope][key] ?? 0) + amount;
}

function objectiveCount(user, key, scope = 'daily') {
  ensureObjectiveProgress(user);
  return user.objectiveProgress[scope][key] ?? 0;
}

function startOfUtcDay(timestamp) {
  const date = new Date(timestamp);
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
}

function startOfUtcWeek(timestamp) {
  const date = new Date(startOfUtcDay(timestamp));
  const day = date.getUTCDay() || 7;
  return date.getTime() - (day - 1) * dayMs;
}

function seasonFreeReward(level) {
  if (level === 50) return 'Kölgə izi badge';
  if (level >= 30) return 'Qızıl sandıq';
  if (level >= 10) return 'Açar + Aura';
  return 'XP və kiçik Aura';
}

function seasonPrimeReward(level) {
  if (level === 50) return activeSeason.finalReward;
  if (level >= 30) return 'Prime border/effect';
  if (level >= 10) return 'Əlavə chest + cosmetic';
  return 'Prime bonus Aura';
}

function formatGoalNeed(value) {
  return Math.max(0, Math.ceil(value)).toLocaleString('en-US');
}

function upgradedBusinessIncome(user, key) {
  const base = worldBusinesses[key]?.income ?? 0;
  const level = user.world?.businessLevels?.[key] ?? 1;
  return Math.floor(base * (1 + (level - 1) * 0.18));
}

function ownedVehicleBonus(user) {
  return user.world.vehicles.reduce((sum, key) => sum + (worldVehicles[key]?.bonus ?? 0), 0);
}

function worldJobXpNeeded(level) {
  return 120 + (level - 1) * 55;
}

function auditFlags(user, transactions) {
  const flags = [];
  if (user.balance < 0) flags.push('Balans mənfidir.');
  if (transactions.filter(item => item.type === 'prime_buy').length > 1) flags.push('Birdən çox Prime alış transaction-u var.');
  if (transactions.some((item, index) => item.type === 'spend' && transactions[index + 1]?.amount === item.amount)) {
    flags.push('Yaxın transaction-larda oxşar məbləğli xərc görünür.');
  }
  if (user.loan?.frozen) flags.push('Kredit freeze aktivdir.');
  return flags;
}

function filterAuditTransactions(transactions, category) {
  const groups = {
    all: null,
    money: ['daily', 'weekly', 'monthly', 'beginner_bonus', 'bank_interest', 'taxes', 'transfer', 'social_gift', 'admin_give', 'admin_take', 'admin_setbalance', 'admin_drop', 'loan_octobank', 'loan_blackmarket', 'loan_business', 'loan_vip', 'loan_casino', 'payloan', 'loan_penalty'],
    casino: ['slots', 'risk', 'coinflip', 'dice', 'roulette', 'blackjack', 'crash', 'mines', 'tower', 'higherlower', 'wheel', 'lottery', 'jackpot', 'rps', 'baccarat', 'poker', 'horse', 'penalty', 'prime_refund', 'ticket_used', 'casino_timeout_refund'],
    market: ['shop_buy', 'shop_chest_limit_revert', 'open_chest', 'sell', 'craft', 'recycle', 'salvage', 'admin_item'],
    social: ['rob', 'robbed', 'rob_failed', 'duel', 'dicebattle', 'quickdraw', 'heist', 'social_gift', 'transfer'],
    world: ['world_job', 'world_mission', 'world_income', 'world_adventure', 'world_explore', 'world_business_buy', 'world_property_buy', 'world_vehicle_buy', 'world_business_upgrade'],
    admin: ['admin_give', 'admin_take', 'admin_setbalance', 'admin_setlevel', 'admin_badge', 'admin_item', 'admin_drop', 'admin_casino_restrict']
  };
  const types = groups[category] ?? null;
  return types ? transactions.filter(item => types.includes(item.type)) : transactions;
}

function unlockAchievements(user) {
  if (user.lastDaily) addAchievement(user, 'firstDaily');
  if (user.stats.gamesPlayed >= 1) addAchievement(user, 'firstGame');
  if (user.stats.gamesWon >= 1) addAchievement(user, 'firstVictory');
  if (user.dailyStreak >= 7) addAchievement(user, 'streak7');
  if (user.balance >= 10000) addAchievement(user, 'aura10000');
  if (user.level >= 20) addAchievement(user, 'level20');
  if (user.prestige >= 1) addAchievement(user, 'prestige1');
  if (user.stats.gamesPlayed >= 100) addAchievement(user, 'games100');
}

function addAchievement(user, key) {
  const achievement = achievements[key];
  const label = `${achievement.emoji} ${achievement.name}`;
  addUnique(user.achievements, label);
  addUnique(user.badges, achievement.emoji);
}

function addUnique(items, item) {
  if (!items.includes(item)) {
    items.push(item);
  }
}

function addTransaction(user, amount, type, note, details = {}) {
  const numericAmount = Number(amount);

  // economy_transactions DB does not accept zero-value transactions.
  // These are metadata/actions, not actual Aura movements.
  if (!Number.isFinite(numericAmount) || numericAmount === 0) {
    return null;
  }

  const createdAt = nowMs();
  const balanceAfter = details.balanceAfter ?? user.balance;
  const balanceBefore =
    details.balanceBefore ?? balanceAfter - numericAmount;

  user.transactions.unshift({
    id: randomUUID(),
    at: new Date(createdAt).toISOString(),
    createdAt,
    amount: numericAmount,
    type,
    note,
    balanceBefore,
    balanceAfter
  });

  user.transactions = user.transactions.slice(0, maxTransactions);

  return user.transactions[0];
}

function addInventoryItem(user, item) {
  if (item.type === 'keys') {
    user.inventory.keys += item.amount ?? 1;
    return;
  }

  if (item.type === 'tickets') {
    user.inventory.tickets += item.amount ?? 1;
    return;
  }

  if (item.type === 'chests') {
    user.inventory.chests[item.name] = (user.inventory.chests[item.name] ?? 0) + (item.amount ?? 1);
    return;
  }

  if (item.type === 'boosters') {
    addUnique(user.inventory.boosters, item.name);
    user.inventory.boosterCharges = (user.inventory.boosterCharges ?? 0) + (item.amount ?? 1);
    user.luck = clamp(user.luck + 10, 1, 100);
    return;
  }

  if (item.type === 'titles') {
    addUnique(user.inventory.titles, item.name);
    return;
  }

  if (item.type === 'badges') {
    addUnique(user.inventory.badges, item.name);
  }
}

function rollChest(user) {
  const roll = Math.random() * 100 + user.luck * 0.08;
  if (roll >= 99) return '🌌 Əfsanə sandığı';
  if (roll >= 94) return '💎 Almaz sandığı';
  if (roll >= 82) return '🥇 Qızıl sandığı';
  if (roll >= 62) return '🥈 Gümüş sandığı';
  return '🪵 Bürünc sandığı';
}

function dateOffset(days) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

function rewardPeriod(kind) {
  const now = new Date();

  if (kind === 'monthly') {
    return now.toISOString().slice(0, 7);
  }

  const firstDay = new Date(Date.UTC(now.getUTCFullYear(), 0, 1));
  const dayOfYear = Math.floor((Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()) - firstDay.getTime()) / 86400000) + 1;
  const week = Math.ceil(dayOfYear / 7);
  return `${now.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function randomBetween(min, max) {
  return min + Math.floor(Math.random() * (max - min + 1));
}

function pick(items) {
  return items[Math.floor(Math.random() * items.length)];
}