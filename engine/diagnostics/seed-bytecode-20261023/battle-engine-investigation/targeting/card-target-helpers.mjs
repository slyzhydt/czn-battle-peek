import {UnresolvedTargetRule} from './selection-core.mjs';
const read=(o,key)=>{if(o==null||!Object.hasOwn(o,key)||o[key]===undefined)throw new UnresolvedTargetRule('missing card-target field '+key);return o[key];};
// BattleCardProc.getAllCardSkillEffIds @0x9a300: exact concat order.
export function allCardSkillEffIds(card){
  const base=read(card,'skill_eff_ids');if(!Array.isArray(base))throw new UnresolvedTargetRule('missing skill_eff_ids array');
  const ids=base.slice();if(card.r_spark_skill_eff_ids)ids.push(...card.r_spark_skill_eff_ids);if(card.eidolon_skill_eff_ids)ids.push(...card.eidolon_skill_eff_ids);return ids;
}
// BattleCardProc.isTriggerInspiration @0x92b00 and closures 0x93200..0x93f00.
export function cardTriggersInspiration(battle,id){
  const card=read(battle,'cardMap')[id];if(!card)return undefined;
  const matches=sid=>(read(battle.skillMap[sid],'eff_opts')??[]).includes('trigger_inspiration');
  if(allCardSkillEffIds(card).some(matches))return true;
  return (card.continueSkill??[]).some(cid=>{const cs=read(battle,'csMap')[cid];return cs?read(cs,'skillEffs').some(matches):false;});
}
