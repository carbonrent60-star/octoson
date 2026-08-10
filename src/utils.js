export function pick(items) {
  return items[Math.floor(Math.random() * items.length)];
}

export function hashScore(seed = '', max = 101) {
  let hash = 0;

  for (let index = 0; index < seed.length; index += 1) {
    hash = (hash << 5) - hash + seed.charCodeAt(index);
    hash |= 0;
  }

  return Math.abs(hash % max);
}

export function ratingFor(score, ratings) {
  return ratings.find(rating => score >= rating.min && score <= rating.max) ?? ratings[0];
}

export function progressBar(value) {
  const filled = Math.round(value / 10);
  return '█'.repeat(filled) + '░'.repeat(10 - filled);
}
