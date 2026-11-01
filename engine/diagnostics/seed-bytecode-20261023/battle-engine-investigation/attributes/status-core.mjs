/** Independent reconstruction of getStatus / computeBattleAtk and team averaging.
 * Original bytecode and full dependency boundaries: REPORT.md.
 * Does not load/execute game code. Dynamic effect queries remain explicit adapters.
 */
import {roundGame} from '../effects/effect-arithmetic.mjs';

export class MissingStatusDependency extends Error {}
const need = (value, label) => {
  if (value == null) throw new MissingStatusDependency(label);
  return value;
};
const callback = (value, label) => {
  if (typeof value !== 'function') throw new MissingStatusDependency(label);
  return value;
};

// gamecore/contents/battle_stage_worktable.js, 0xf0000000af00.
// The optional-field zero values below are observed nullish defaults in bytecode.
// BASE_S_ATK has no such default: absent base yields NaN, not zero.
export function computeBattleAtk(info, extraRate, extraAdd) {
  const base = info.BASE_S_ATK + (info.S_PARTNER_BASE_ATK ?? 0);
  const outsideRate = (info.S_ATK_INC_RATE_OUT ?? 0) + (info.S_ATK_DEF_INC_RATE_OUT ?? 0);
  const outsideAdd = info.S_ATK_INC_ADD_OUT ?? 0;
  const calculateRate = info.S_ATK_CAL ?? 0;
  const insideRate = (info.S_ATK_INC_RATE_IN ?? 0) + extraRate;
  const insideAdd = (info.S_ATK_INC_ADD_IN ?? 0) + extraAdd;
  const outside = roundGame((base * (1 + outsideRate / 100) + roundGame(outsideAdd)) *
    (1 + calculateRate / 100));
  return roundGame(outside * (1 + insideRate / 100) + insideAdd);
}

export function teamAverageStatus(stage, statType, fallback, readStatus) {
  if (stage == null) return fallback;
  const chars = need(stage.chars, 'battle_stage.chars');
  const read = callback(readStatus, 'readStatus');
  let sum = 0, count = 0;
  for (const char of chars) {
    if (stage.leaved_chars?.includes(char.res_id)) continue;
    count++;
    const value = read(char.id, statType);
    // A non-finite value contributes zero but still counts in the denominator.
    sum += Number.isFinite(value) ? value : 0;
  }
  return count > 0 ? sum / count : fallback;
}

export function resolvedGenericStat(base, effects) {
  let plus = 0, multi = 1;
  for (const {sign, value} of effects) {
    if (sign === 'MATHSIGN_ADD') plus += value;
    else if (sign === 'MATHSIGN_MULTIPLY') multi *= value;
    else if (sign === 'MATHSIGN_MULTIPLY_PCT') multi *= value / 100;
    else if (sign === 'MATHSIGN_ADD_HUND_MULTIPLY_PCT') multi *= (value + 100) / 100;
    // getStatus's local reducer intentionally ignores other MathSign values.
  }
  return roundGame((base + plus) * multi);
}

/** Build the accessor with real state and callbacks; no unknown passives assumed empty.
 * queryPassive mirrors getPassiveByType and can consume RNG / mutate state.
 * evalSkill mirrors calcValue and can likewise consume/cache randomness.
 * getUnit must implement the complete game's ID resolver for non-party units.
 */
export function createStatusReader({battle, stage, queryPassive, evalSkill, readSkill, getUnit, isMonster, getConstant}) {
  need(battle, 'battle');
  function passives(id, type) {
    const rows = callback(queryPassive, 'getPassiveByType')({
      source_id: id, type, is_card: false, char_id: id,
    });
    if (!Array.isArray(rows)) throw new MissingStatusDependency('getPassiveByType result');
    return rows;
  }
  function resolveEffects(rows) {
    const result = [];
    for (const row of rows) {
      const sign = need(callback(readSkill, 'skill_eff lookup')(row.res_id), 'skill_eff row').eff_value_math_sign;
      // Unsupported local signs must NOT evaluate calcValue: it has side effects.
      if (['MATHSIGN_ADD', 'MATHSIGN_MULTIPLY', 'MATHSIGN_MULTIPLY_PCT',
        'MATHSIGN_ADD_HUND_MULTIPLY_PCT'].includes(sign))
        result.push({sign, value: callback(evalSkill, 'calcValue')(row.skill_id)});
    }
    return result;
  }
  function read(id, type, fallback) {
    const chars = need(battle.chars, 'battle.chars');
    const fourth = battle.assault_fourth_char;
    if (['S_HP', 'S_CURRENT_HP', 'S_CURRENT_SHIELD'].includes(type) &&
        (chars.some(char => char.id == id) || fourth?.id == id)) id = need(battle.char, 'battle.char').id;
    let unit = chars.find(char => char.id == id);
    if (unit == null && fourth?.id == id) unit = fourth;
    if (unit == null) unit = callback(getUnit, 'getUnitByID')(id);
    const info = need(need(unit, 'unit:' + id).status?.info, 'status.info:' + id);
    if (!(type in info)) return fallback !== undefined && fallback !== null ? fallback : NaN;
    const base = info[type];
    const specials = {
      S_ATK: 'SKILL_EFF_STAT_ATK_VALUE_ADD', S_DEF: 'SKILL_EFF_STAT_DEF_VALUE_ADD',
      S_DEF_SHIELD: 'SKILL_EFF_STAT_DEF_VALUE_ADD',
      S_DOT_ATK_DMG_RATE: 'SKILL_EFF_STAT_DOT_ATK_VALUE_ADD',
      S_ADDI_ATK_DMG_RATE: 'SKILL_EFF_STAT_ADDI_ATK_VALUE_ADD',
    };
    if (!Object.hasOwn(specials, type)) return base;
    let monster;
    if (['S_ATK', 'S_DEF', 'S_DEF_SHIELD'].includes(type)) {
      monster = callback(isMonster, 'isMonsterByID')(id);
      if (!monster && info[type === 'S_ATK' ? 'BASE_S_ATK' : 'BASE_S_DEF'] == null)
        return teamAverageStatus(stage, type, base, read);
    }
    const rows = passives(id, specials[type]);
    if (rows.length === 0) return base;
    if (type === 'S_ATK' && !monster) {
      let rate = 0, add = 0;
      // Original ATK callback evaluates value BEFORE fetching its resource sign.
      for (const row of rows) {
        const value = callback(evalSkill, 'calcValue')(row.skill_id);
        const sign = need(callback(readSkill, 'skill_eff lookup')(row.res_id), 'skill_eff row').eff_value_math_sign;
        if (sign == 'MATHSIGN_ADD') add += value;
        else rate += value;
      }
      return computeBattleAtk(info, rate, add);
    }
    if (type === 'S_DEF_SHIELD') {
      const baseDef = read(id, 'BASE_S_DEF');
      const effectiveDef = read(id, 'S_DEF');
      const constant = callback(getConstant, 'ConstantMetagame.get');
      const baseRate = constant('shield_cal_rate_for_base_def', {def_value: 1});
      const addRate = constant('shield_cal_rate_for_add_def', {def_value: 1});
      return baseDef * baseRate + (effectiveDef - baseDef) * addRate;
    }
    return resolvedGenericStat(base, resolveEffects(rows));
  }
  return read;
}
