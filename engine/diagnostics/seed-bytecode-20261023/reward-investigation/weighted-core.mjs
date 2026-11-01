// Independent reconstruction, including the verified Object.keys fallback.
// Not game code. No game/network interfaces. Preserve JS for-in enumeration.
export function weightedKey(weights, nextRange, throwOnFailure = false, label = '') {
  let total = 0;
  for (const key in weights) if (!(weights[key] <= 0)) total += weights[key];
  // Even an empty or zero-total map reaches this call in the bytecode.
  const draw = nextRange(0, total);
  let cumulative = 0;
  for (const key in weights) {
    if (weights[key] <= 0) continue;
    cumulative += weights[key];
    if (draw < cumulative) return key;
  }
  if (throwOnFailure) throw new RangeError('err:invalid_number_at_getKeyRelativeProbability:' + label);
  return Object.keys(weights)[0];
}

export function publicCandidate(card, excluded, getCandidates, getWeight, nextRange) {
  const candidates = getCandidates(card).filter(id =>
    !excluded.some(item => item.category === 'CATEGORY_PUBLIC' && item.res_id == id));
  if (candidates.length === 0) return undefined;
  const map = {};
  for (const id of candidates) map[id] = getWeight(id);
  return weightedKey(map, nextRange);
}
