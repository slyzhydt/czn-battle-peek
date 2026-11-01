/** Independent arithmetic reconstruction. No game code is loaded or executed.
 * This is NOT a complete damage, passive, or battle simulator.
 * Provenance and limits: REPORT.md / function-evidence.json.
 */
export const floorGame = value => Math.floor(value + 1e-8);
export const ceilGame = value => Math.ceil(value - 1e-8);
export const roundGame = value => Math.round(value + 1e-8);

function normalizedSign(sign) {
  return sign.startsWith('MATHSIGN_') ? sign.slice(9) : sign;
}

// processDamageValueMathSign: invalid-sign reporting is left to the caller.
export function damageMathSign(sign, value) {
  sign = normalizedSign(sign);
  if (sign === 'ADD') return { plus: value, multiValue: undefined, is_final: false };
  if (sign === 'SUBTRACT') return { plus: -value, multiValue: undefined, is_final: false };
  const final = sign.startsWith('FINAL_');
  const op = final ? sign.slice(6) : sign;
  let multiplier;
  if (op === 'MULTIPLY') multiplier = value;
  else if (op === 'MULTIPLY_PCT') multiplier = value / 100;
  else if (op === 'ADD_HUND_MULTIPLY_PCT') multiplier = (value + 100) / 100;
  else if (op === 'SUBTRACT_HUND_MULTIPLY_PCT') multiplier = (100 - value) / 100;
  else return { plus: 0, multiValue: undefined, is_final: false };
  return { plus: 0, multiValue: multiplier, is_final: final };
}

// Factors < 1 go to a multiplicative reduction bucket EVEN IF marked final.
export function accumulateDamageMulti(factor, isFinal, forceFinal, buckets) {
  if (factor < 1) return { ...buckets, multi_dec: buckets.multi_dec * factor };
  if (isFinal || forceFinal) return { ...buckets, multi_final: buckets.multi_final + factor - 1 };
  return { ...buckets, multi: buckets.multi + factor - 1 };
}

export function valueChangeMathSign(sign, value) {
  sign = normalizedSign(sign);
  if (sign === 'MULTIPLY') return { plus: 0, multi: value - 1 };
  if (sign === 'MULTIPLY_PCT') return { plus: 0, multi: value / 100 - 1 };
  if (sign === 'ADD_HUND_MULTIPLY_PCT') return { plus: 0, multi: (value + 100) / 100 - 1 };
  if (sign === 'SUBTRACT_HUND_MULTIPLY_PCT') return { plus: 0, multi: (100 - value) / 100 - 1 };
  return { plus: value, multi: 0 };
}

export function procStatType(type, value, stat) {
  if (isNaN(stat) || type == 0) return value;
  return type == 1 || type == 2 ? value * stat * 0.01 : value;
}

export function procRevise(type, value, rates) {
  if (type == 1) return floorGame(value * rates.damage);
  if (type == 2) return floorGame(value * rates.shield);
  return floorGame(value);
}

// dmgDecrease, nested in procDamageCalculate; use resolved target status.
// zeroValue=-160 and curveValue=300 are the extracted-pack defaults only.
export function decreaseDamage(value, { statType, isMonsterTarget, monsterRate, partyDef, zeroValue, curveValue }) {
  let result = value;
  if (statType != 0) {
    result = isMonsterTarget
      ? ceilGame(value * monsterRate)
      : ceilGame(value * (zeroValue + curveValue) / (curveValue + partyDef));
    if (value < result) result = value;
  }
  return ceilGame(result);
}

export function isShieldDestroyed(oldShield, newShield) {
  return oldShield > 0 && newShield === 0;
}

/** Queue fragments only: upstream eligibility, targets, duration consumption,
 * wave-transition deferral, and motion execution are outside this helper.
 */
export function triggeredQueueName({ immediate, motionTypeIsNone, parentIsCS, during }) {
  if (!immediate && (!motionTypeIsNone || parentIsCS)) return 'motionTrig';
  return during ? 'duringTrig' : 'skillTrig';
}

export function insertTriggeredByPriority(queue, entry) {
  const index = queue.findIndex(existing => existing.priority < entry.priority);
  if (index < 0) queue.push(entry);
  else queue.splice(index, 0, entry);
}

// Mirrors the dequeue decision inside procSkillTriggered; motion is separate.
export function takeNonMotionTriggered(battle) {
  const name = battle.duringTrig?.length ? 'duringTrig' : 'skillTrig';
  const entry = battle[name]?.shift();
  if (battle[name]?.length === 0) battle[name] = undefined;
  return { queue: name, entry };
}

// procTriggeredSkillData probability fragment AFTER all run_pct modifiers.
// nextRange must be the reconstructed INGAME stream; this function never seeds it.
export function triggeredProbabilityGate(runPct, isPreview, nextRange) {
  if (runPct < 100) {
    if (isPreview) return { execute: false, reason: 'preview_omits_probability', draws: 0 };
    if (typeof nextRange !== 'function') throw new TypeError('INGAME nextRange is required');
    const roll = nextRange(0, 100);
    return { execute: !(runPct <= roll), reason: runPct <= roll ? 'probability_failed' : 'probability_passed', draws: 1, roll };
  }
  return { execute: true, reason: 'no_probability_draw', draws: 0 };
}

/** Arithmetic fragment of procShieldApply AFTER caller resolves all passives.
 * No events are dispatched and no passive duration is consumed here.
 * gainBan must reflect applicable passives, including card/other restrictions.
 */
export function shieldAmountAfterResolvedPassives(input) {
  const required = ['requested', 'oldShield', 'currentHp', 'maxHp', 'isMonster', 'riskActive', 'turn', 'riskReduce', 'gainBan'];
  for (const key of required) if (!Object.hasOwn(input, key)) throw new TypeError(`Missing resolved shield input: ${key}`);
  let amount = input.requested;
  if (input.riskActive && !input.isMonster && input.turn - 1 > 0 && input.riskReduce > 0) {
    amount = floorGame(amount * Math.pow((100 - input.riskReduce) / 100, input.turn - 1));
  }
  if (input.gainBan) amount = 0;
  amount = floorGame(amount);
  if (!input.isMonster && input.currentHp == 0) amount = 0;
  const newShield = Math.min(input.oldShield + amount, input.isMonster ? 999999 : input.maxHp * 2);
  return {
    oldShield: input.oldShield,
    newShield,
    actualDelta: newShield - input.oldShield,
    // The source accumulates and passes this amount to events, before the cap.
    accumulatedAmount: amount,
  };
}
