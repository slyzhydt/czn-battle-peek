/** Independent procValueType pain callbacks, including observed discarded result.
 * Evidence: pain-functions/*.linear.js and original instruction JSON.
 */
import {procStatType} from '../effects/effect-arithmetic.mjs';
import {MissingStatusDependency} from './status-core.mjs';
const call = (fn, name) => {
  if (typeof fn !== 'function') throw new MissingStatusDependency(name);
  return fn;
};
const getCS = (context, id) => {
  const cs = context.csMap?.[id];
  if (!cs) throw new MissingStatusDependency('csMap:' + id);
  if (cs.res_id == null) throw new MissingStatusDependency('csMap.res_id:' + id);
  return cs;
};
const matches = (context, cs) => {
  const painId = call(context.getPainId, 'constant:cs_pain')();
  if (painId == null) throw new MissingStatusDependency('constant:cs_pain value');
  return cs.res_id == painId;
};
const field = (obj, key, path) => {
  if (obj[key] === undefined) throw new MissingStatusDependency(path + '.' + key);
  return obj[key];
};
const firstSkill = cs => {
  if (!Array.isArray(cs.skillEffs) || cs.skillEffs.length === 0)
    throw new MissingStatusDependency('cs.skillEffs[0]');
  return cs.skillEffs[0];
};

export function lastPainTerm(ids, initial, context) {
  let result = initial;
  for (const id of ids) {
    const cs = getCS(context, id);
    if (matches(context, cs)) result = field(cs, 'term_value', 'cs');
  }
  return result;
}

export function lastPainValue(ids, initial, context) {
  let result = initial;
  for (const id of ids) {
    const cs = getCS(context, id);
    if (matches(context, cs)) result = call(context.calcValue, 'calcValue')(firstSkill(cs));
  }
  return result;
}

export function sumPainTerms(ids, initial, context) {
  let result = initial;
  for (const id of ids) {
    const cs = getCS(context, id);
    if (matches(context, cs)) result += field(cs, 'term_value', 'cs');
  }
  return result;
}

export function discardedPainDamage(ids, initial, context) {
  // 0xf000001e0100 / 0xf000001e0d00: Add a0 @187, Ldar a0 @190, Return @192.
  // The computed amount is discarded, but status lookup must still take place.
  return ids.reduce((accumulator, id) => {
    const cs = getCS(context, id);
    if (matches(context, cs)) {
      const skillId = firstSkill(cs);
      const skill = context.skillMap?.[skillId];
      if (!skill) throw new MissingStatusDependency('skillMap:' + skillId);
      const value = field(skill, 'eff_value', 'skill') * field(cs, 'term_value', 'cs');
      const source = call(context.resolveStatSource, 'resolveStatSource')(skillId, field(skill, 'stat_source', 'skill'));
      const stat = call(context.getStatus, 'getStatus')(source, 'S_ATK');
      // Preserve the actual calculation without "repairing" the client algorithm.
      const ignored = accumulator + procStatType(1, value, stat);
      void ignored;
    }
    return accumulator;
  }, initial);
}
