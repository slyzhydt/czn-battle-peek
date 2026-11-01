// Independent, offline reconstruction of MonsterPattern.getCard's selection layer.
// Evidence: monster_proc.js, bytecode 0xf0000000b700, V8 12.4.254.21.
// NOT a complete monster simulator. Caller supplies ordered, numerically typed
// DB rows and actual event-stack predicate results; no hidden state is invented.
export function relativeProbabilityIndex(weights, nextRange) {
  let total = 0;
  for (let i = 0; i < weights.length; i++) if (!(weights[i] <= 0)) total += weights[i];
  const draw = nextRange(0, total); // Includes empty / zero-total arrays.
  let cumulative = 0;
  for (let i = 0; i < weights.length; i++) {
    if (weights[i] <= 0) continue;
    cumulative += weights[i];
    if (draw < cumulative) return i;
  }
  return NaN;
}

export function selectMonsterPatternCard({rows, pattern, patternType = pattern.type, unit, nextRange, checkStack, excludeCardId,
  onDiagnostic = () => {}}) {
  if (!Array.isArray(rows)) throw new TypeError('ordered rows are required');
  if (typeof nextRange !== 'function' || typeof checkStack !== 'function')
    throw new TypeError('nextRange and actual checkStack callbacks are required');
  if (!Array.isArray(pattern.stacks)) throw new TypeError('pattern.stacks is required');
  const eligibleRows = [], eligibleWeights = [], allRows = [], allWeights = [];
  let eligiblePriority = -1, forcedPriority = -1, forcedRow;
  const predicate = index => pattern.stacks[index] < 0 || checkStack(pattern.stacks[index], index);
  // Array form is an integration boundary. Preserve original loadGameDBbyKey
  // enumeration order when producing it; do not re-sort rows or deduplicate IDs.
  for (let index = 0; index < rows.length; index++) {
    const row = rows[index], id = row.card_link_monster_card_id;
    if (id == 'none' || id == excludeCardId) continue;
    const limit = row.card_use_limit, continuous = row.card_cont_use_limit;
    const phaseLimit = row.card_use_phase_limit, mustTurn = row.card_must_use_phase_turn;
    const cycle = row.card_must_use_phase_cycle, priority = row.card_priority;
    const weight = row.card_select_ratio;
    for (const [key, value] of Object.entries({limit, continuous, phaseLimit, mustTurn, cycle, priority, weight}))
      if (typeof value !== 'number') throw new TypeError('numeric DB conversion missing: ' + key);
    allRows.push(row); allWeights.push(weight);
    let condition;
    if (patternType == 'PATTERN_TYPE_CONDITION') {
      condition = predicate(index);
      if (!condition) continue;
    }
    if (!(limit < 0)) {
      if (!unit.usedCardBattle) continue;
      if (id in unit.usedCardBattle && !(unit.usedCardBattle[id] < limit)) continue;
    }
    if (!(continuous < 0)) {
      if (!unit.currentCard) continue;
      if (unit.currentCard[0] == id && !(unit.currentCard[1] < continuous)) continue;
    }
    if (!(phaseLimit < 0)) {
      if (!unit.usedCardPhase) continue;
      if (id in unit.usedCardPhase && !(unit.usedCardPhase[id] < phaseLimit)) continue;
    }
    const forceDue = mustTurn == pattern.phaseCounter ||
      (cycle > 0 && pattern.phaseCounter > mustTurn && (pattern.phaseCounter - mustTurn) % cycle == 0);
    if (forceDue && priority > forcedPriority) { forcedRow = row; forcedPriority = priority; }
    if (condition == null) condition = predicate(index);
    if (!condition || !(priority >= eligiblePriority)) continue;
    if (priority > eligiblePriority) {
      eligiblePriority = priority; eligibleRows.length = 0; eligibleWeights.length = 0;
    }
    eligibleRows.push(row); eligibleWeights.push(weight);
  }
  // In non-CONDITION modes, the forced candidate was recorded before the
  // condition gate; a forced action can therefore bypass that gate here.
  if (forcedRow != null && (pattern.type != 'PATTERN_TYPE_PRIORITY' ||
      (forcedPriority >= 0 && forcedPriority > eligiblePriority) || eligiblePriority < 0))
    return {row: forcedRow, branch: 'forced', eligibleRows, allRows};
  if (eligibleRows.length > 0) {
    let index = relativeProbabilityIndex(eligibleWeights, nextRange);
    if (isNaN(index)) { onDiagnostic('monster_pattern_all_probability_0'); index = 0; }
    return {row: eligibleRows[index], branch: 'eligible-weighted', eligibleRows, allRows};
  }
  onDiagnostic('monster_pattern_card_pool_0');
  if (excludeCardId != null && allRows.length == 0)
    return selectMonsterPatternCard({rows, pattern, patternType, unit, nextRange, checkStack, onDiagnostic});
  let index = relativeProbabilityIndex(allWeights, nextRange);
  if (isNaN(index)) { onDiagnostic('monster_pattern_all_probability_0'); index = 0; }
  if (allRows.length == 0) throw new RangeError('monster_pattern_total_card_pool_0');
  return {row: allRows[index], branch: 'fallback-weighted', eligibleRows, allRows};
}

// Only the base monster_turn_count decoding, before any turn-count passives.
export function baseMonsterTurnCount(values, nextRange) {
  if (values.length === 1) return values[0];
  if (values.length === 2) return nextRange(values[0], values[1] + 1);
  return -1;
}

// GameResDB.loadGameDBbyKey, 0xf0000001b200: discover padding from first ID,
// then stop at first missing ID; skip no_use YES unless includeNoUse is true.
export function loadRowsByKey(table, key, includeNoUse = false) {
  if (key === 'none') return [];
  let width = 0;
  const id = n => String(key) + '_' + String(n).padStart(width, '0');
  while (!table[id(1)]) { if (++width > 10) return []; }
  const out = [];
  for (let n = 1; table[id(n)]; n++) {
    const row = table[id(n)];
    if (includeNoUse || row.no_use !== 'YES') out.push(row);
  }
  return out;
}
