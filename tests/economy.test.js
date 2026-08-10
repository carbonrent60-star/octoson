import test from 'node:test';
import assert from 'node:assert/strict';
import { adminSetBalance, adminSetLevel, adminTakeAura, buyShopItem, buyWorldBusiness, calculateCasinoBetLimit, depositAura, getProfile, prepareCasinoEntry, resetEconomyWallets, settleCasinoGame, spendBalance, transferAura } from '../src/economy.js';
import { routines } from '../src/content.js';
import { loadEconomyTransactions, saveEconomyProfile } from '../src/db/economy-store.js';
import { memoryState, resetMemoryState } from '../src/db/memory-state.js';

async function seedProfile(userId, balance, bank = 0, level = 1) {
  await adminSetBalance(userId, balance + bank, 'seed');

  if (level !== 1) {
    await adminSetLevel(userId, level, 'seed');
  }

  if (bank > 0) {
    const bankResult = await depositAura(userId, bank);
    assert.equal(bankResult.ok, true);
  }

  return getProfile(userId);
}

function assertBalance(profile, expectedBalance) {
  assert.equal(profile.balance, expectedBalance);
  assert.equal(profile.transactions.length > 0, true);
  const transaction = profile.transactions[0];
  assert.equal(transaction.balanceAfter, expectedBalance);
}

function assertTransaction(profile, expected) {
  assert.equal(profile.transactions.length > 0, true);
  const transaction = profile.transactions[0];

  if (expected.amount !== undefined) {
    assert.equal(transaction.amount, expected.amount);
  }

  if (expected.before !== undefined) {
    assert.equal(transaction.balanceBefore, expected.before);
  }

  if (expected.after !== undefined) {
    assert.equal(transaction.balanceAfter, expected.after);
  }

  if (expected.type !== undefined) {
    assert.equal(transaction.type, expected.type);
  }
}

test('small players get a low casino cap', () => {
  const user = { balance: 5000, bank: 0, level: 3, prestige: 0 };
  assert.equal(calculateCasinoBetLimit(user), 296);
});

test('mid-tier players get a larger cap', () => {
  const user = { balance: 10000, bank: 0, level: 12, prestige: 0 };
  assert.equal(calculateCasinoBetLimit(user), 464);
});

test('wealthy players can scale up without exceeding the hard cap', () => {
  const user = { balance: 300000, bank: 100000, level: 25, prestige: 2 };
  const limit = calculateCasinoBetLimit(user);
  assert.ok(limit > 4000);
  assert.ok(limit <= 20000);
});

test('routine catalog exposes the command keys', () => {
  for (const type of ['skin', 'hair', 'posture', 'photo']) {
    assert.ok(routines[type], `missing routine: ${type}`);
    assert.ok(Array.isArray(routines[type].steps));
    assert.ok(routines[type].steps.length > 0);
  }
});

test('a losing casino round deducts the bet from the wallet', async () => {
  const userId = 'wallet-deduction-test';
  await adminSetBalance(userId, 1000, 'test');

  const entry = await prepareCasinoEntry(userId, 100, 'slots');
  assert.equal(entry.ok, true);

  const settlement = await settleCasinoGame(userId, {
    game: 'slots',
    bet: 100,
    cost: entry.cost,
    payout: 0,
    won: false,
    multiplier: 0
  });

  const profile = await getProfile(userId);
  assert.equal(settlement.ok, true);
  assert.equal(profile.balance, 900);
  assert.equal(settlement.net, -100);
});

test('resetEconomyWallets clears wallet and bank while preserving the level', async () => {
  const userId = 'wallet-reset-test';
  await adminSetBalance(userId, 2500, 'test');

  const reset = await resetEconomyWallets();
  const profile = await getProfile(userId);

  assert.ok(reset.resetCount >= 1);
  assert.equal(profile.balance, 0);
  assert.equal(profile.bank, 0);
  assert.equal(profile.level, 1);
  assert.equal(profile.transactions.length, 0);
});

test('saveEconomyProfile normalizes transaction timestamps before storing', async () => {
  const originalNow = Date.now;
  const fixedNow = Date.parse('2026-08-08T21:03:20.000Z');
  const isoTimestamp = '2026-08-08T21:02:17.776Z';

  resetMemoryState();
  Date.now = () => fixedNow;

  try {
    await saveEconomyProfile('timestamp-test', {
      balance: 500,
      bank: 0,
      transactions: [
        { id: 'tx-iso', amount: 5, type: 'admin_give', note: 'iso', at: isoTimestamp },
        { id: 'tx-string', amount: 6, type: 'admin_give', note: 'string', createdAt: '1723150937776' },
        { id: 'tx-number', amount: 7, type: 'admin_give', note: 'number', createdAt: 1723151937776 },
        { id: 'tx-missing', amount: 8, type: 'admin_give', note: 'missing' }
      ]
    }, 0);

    const storedRows = memoryState.economy.transactions.filter(row => row.user_id === 'timestamp-test');
    assert.equal(storedRows.length, 4);

    const byKey = new Map(storedRows.map(row => [row.transaction_key, row]));
    assert.equal(byKey.get('tx-iso').created_at, Date.parse(isoTimestamp));
    assert.equal(byKey.get('tx-string').created_at, 1723150937776);
    assert.equal(byKey.get('tx-number').created_at, 1723151937776);
    assert.equal(byKey.get('tx-missing').created_at, fixedNow);

    const loadedRows = await loadEconomyTransactions('timestamp-test', 4);
    assert.equal(loadedRows.find(row => row.note === 'iso').at, isoTimestamp);
    assert.equal(loadedRows.find(row => row.note === 'string').at, new Date(1723150937776).toISOString());
    assert.equal(loadedRows.find(row => row.note === 'number').at, new Date(1723151937776).toISOString());
    assert.equal(loadedRows.find(row => row.note === 'missing').at, new Date(fixedNow).toISOString());
  } finally {
    Date.now = originalNow;
    resetMemoryState();
  }
});

test('casino loss deducts the wager once and persists after reload', async () => {
  const userId = 'casino-loss-test';
  await seedProfile(userId, 10000, 5000, 25);

  const entry = await prepareCasinoEntry(userId, 1000, 'crash', { reserve: true });
  assert.equal(entry.ok, true);

  const afterReserve = await getProfile(userId);
  assert.equal(afterReserve.balance, 9000);
  assert.equal(afterReserve.bank, 5000);

  const settlement = await settleCasinoGame(userId, {
    game: 'crash',
    bet: 1000,
    cost: entry.cost,
    payout: 0,
    won: false,
    multiplier: 0,
    reserved: true
  });

  assert.equal(settlement.ok, true);
  assert.equal(settlement.balanceAfter, 9000);

  const profile = await getProfile(userId);
  assertBalance(profile, 9000);
  assertTransaction(profile, { amount: -1000, before: 10000, after: 9000, type: 'crash' });
});

test('casino win returns the correct gross payout and persists after reload', async () => {
  const userId = 'casino-win-test';
  await seedProfile(userId, 10000, 5000, 25);

  const entry = await prepareCasinoEntry(userId, 1000, 'crash', { reserve: true });
  assert.equal(entry.ok, true);

  const settlement = await settleCasinoGame(userId, {
    game: 'crash',
    bet: 1000,
    cost: entry.cost,
    payout: 2000,
    won: true,
    multiplier: 2,
    reserved: true
  });

  assert.equal(settlement.ok, true);
  assert.equal(settlement.balanceAfter, 11000);

  const profile = await getProfile(userId);
  assertBalance(profile, 11000);
  assertTransaction(profile, { amount: 1000, before: 10000, after: 11000, type: 'crash' });
});

test('casino entry rejects insufficient funds without changing balance', async () => {
  const userId = 'casino-insufficient-test';
  await seedProfile(userId, 500, 50000, 25);

  const entry = await prepareCasinoEntry(userId, 1000, 'crash', { reserve: true });
  assert.equal(entry.ok, false);
  assert.equal(entry.cost, 1000);

  const profile = await getProfile(userId);
  assert.equal(profile.balance, 500);
  assert.equal(profile.bank, 50000);
});

test('transfer deducts the sender and credits the receiver once', async () => {
  const fromUserId = 'transfer-from-test';
  const toUserId = 'transfer-to-test';
  await seedProfile(fromUserId, 10000, 5000, 25);
  await seedProfile(toUserId, 500);

  const result = await transferAura(fromUserId, toUserId, 1000, 'test');
  assert.equal(result.ok, true);

  const fromProfile = await getProfile(fromUserId);
  const toProfile = await getProfile(toUserId);

  assertBalance(fromProfile, 9000);
  assertBalance(toProfile, 1500);
  assertTransaction(fromProfile, { amount: -1000, before: 10000, after: 9000, type: 'test' });
  assertTransaction(toProfile, { amount: 1000, before: 500, after: 1500, type: 'test' });
});

test('generic spending persists the deducted balance after reload', async () => {
  const userId = 'spend-balance-test';
  await seedProfile(userId, 10000);

  const result = await spendBalance(userId, 2500);
  assert.equal(result, true);

  const profile = await getProfile(userId);
  assertBalance(profile, 7500);
  assertTransaction(profile, { amount: -2500, before: 10000, after: 7500, type: 'spend' });
});

test('shop purchase persists the deducted balance after reload', async () => {
  const userId = 'shop-purchase-test';
  await seedProfile(userId, 5000);

  const result = await buyShopItem(userId, 'gold_chest');
  assert.equal(result.ok, true);

  const profile = await getProfile(userId);
  assertBalance(profile, 2800);
  assertTransaction(profile, { amount: -2200, before: 5000, after: 2800, type: 'shop_buy' });
});

test('world business purchase persists the deducted balance after reload', async () => {
  const userId = 'world-business-test';
  await seedProfile(userId, 10000);

  const result = await buyWorldBusiness(userId, 'barber');
  assert.equal(result.ok, true);

  const profile = await getProfile(userId);
  assertBalance(profile, 3500);
  assertTransaction(profile, { amount: -6500, before: 10000, after: 3500, type: 'world_business' });
});

test('admin removal persists the deducted balance after reload', async () => {
  const userId = 'admin-remove-test';
  await seedProfile(userId, 10000);

  const profileAfterRemove = await adminTakeAura(userId, 1000, 'tester');
  assert.equal(profileAfterRemove.profile.balance, 9000);

  const profile = await getProfile(userId);
  assertBalance(profile, 9000);
  assertTransaction(profile, { amount: -1000, before: 10000, after: 9000, type: 'admin_take' });
});
