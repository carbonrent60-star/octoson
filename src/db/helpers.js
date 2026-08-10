export function clone(value) {
  return value == null ? value : structuredClone(value);
}

export function nowMs() {
  return Date.now();
}

export function transactionKey(transaction, fallbackSeed = '') {
  if (!transaction || typeof transaction !== 'object') {
    return `tx_${fallbackSeed}_${Math.random().toString(36).slice(2, 10)}`;
  }

  return `${transaction.id ?? transaction.key ?? transaction.transactionKey ?? `tx_${fallbackSeed}_${Math.random().toString(36).slice(2, 10)}`}`;
}

export function toNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function isAutomatedTestRun() {
  return process.env.NODE_ENV === 'test'
    || Boolean(process.env.NODE_TEST_CONTEXT)
    || process.argv.includes('--test')
    || process.env.npm_lifecycle_event === 'test';
}

export function toEpochMs(value, fallback = nowMs()) {
  if (value instanceof Date) {
    const parsed = value.getTime();
    return Number.isFinite(parsed) ? Math.trunc(parsed) : fallback;
  }

  if (typeof value === 'number') {
    return Number.isFinite(value) ? Math.trunc(value) : fallback;
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();

    if (!trimmed) {
      return fallback;
    }

    const numericValue = Number(trimmed);
    if (Number.isFinite(numericValue)) {
      return Math.trunc(numericValue);
    }

    const parsed = Date.parse(trimmed);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return fallback;
}

export function isMemoryStorageEnabled() {
  return process.env.OCTOSON_USE_MEMORY_STORAGE === 'true'
    || isAutomatedTestRun();
}
