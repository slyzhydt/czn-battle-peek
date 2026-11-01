// BattleAutoProc.getAutoTarget0xbe00 (25 bodies/1,289 instructions),
// getCardPriorityBattleTest0x9600 and card_auto_priority's remaining exports.
// Independent hand ports; retained source is never executed.
import {TALENTS as T} from './card-talent-support.mjs';
import {compareCondition} from '../conditions/condition-core.mjs';
const variant=/_(rsp\d+|lbk|pot|mut\d*)$/,col2=/_col2$/;
const useBans=new Set(['card_ta_00007','card_etc_00012','card_etc_00013','card_etc_00014','c_1024_uni3','c_1041_cre1','c_1041_bhc1']);
const setupExtra=new Set(['c_1040_uni4']);
function normalizedSet(res,set){let current=res;for(;;){if(set.has(current))return true;const next=current.replace(variant,'');if(next===current)break;current=next;}const col=res.replace(col2,'_col');return col!==res&&set.has(col);}
export const isCardAutoUseBan=res=>normalizedSet(res,useBans);
export const isSetupEnhanceCard=(res,category)=>category==='CARD_POWER'||normalizedSet(res,setupExtra);
const invincibleCS=new Set(['cs02_0011','cs02_0392','cs02_0411','cs02_0470']);
const fixedTestPriority={char_1050_start_4:11,char_1050_unique_before_2:5,char_1050_unique_before_3:12,char_1050_unique_before_4:3,char_1040_start_4:8,char_1040_unique_before_1:6,char_1040_unique_before_2:1,char_1040_unique_before_3:9,char_1040_unique_before_4:1,char_1056_unique_before_1:2,char_1056_unique_before_2:1,char_1056_unique_before_3:2,char_1056_unique_before_4:4,char_1040_start_1:13,char_1050_start_1:13,char_1056_start_1:13,char_1040_start_3:14,char_1050_start_3:14,char_1056_start_3:14};
export class PlayerAutoTargetRuntime {
 constructor(e){this.e=e;this.db=e.db;}
 get b(){return this.e.b;}
 call(n,...a){return this.e.call(n,...a);}
 numbers(value){const parts=value.replace(/[\[\]]/gi,'').split(',');return parts.length===1&&parts[0]===''?[]:parts.map(Number);}
 checkSort(id,sorts){return sorts.some(sort=>this.call('getSort',id).includes(sort));}
 getCardPriorityBattleTest(id){const c=this.b.cardMap[id];if(c.res_id==='char_1050_unique_before_1')return this.b.monsters.filter(m=>this.call('isFieldMonster',m)).length>1?6:7;if(c.res_id==='char_1056_start_4')return c.leaded?0:10;return fixedTestPriority[c.res_id]??Infinity;}
 targetCheckFailed(card,index){
  const id=card.skill_eff_ids[index],targets=this.call('getSkillEffTarget',id);if(targets.length===0)return true;
  const skill=this.b.skillMap[id],row=this.db.get('skill_eff',skill.res_id);
  if(row.eff==='SKILL_EFF_KILL'){
   const checks=skill.eff_opts?.filter(x=>x.startsWith('atk_'));
   if(checks&&checks.length>0){const inequality='INEQUALITY_'+checks[0].slice(4).toUpperCase();
    return !targets.some(target=>{const hp=this.call('getStatus',target,'S_CURRENT_HP'),value=this.call('calcValue',id,target),limit=this.call('procRevise',1,this.call('procStatType',1,value,this.call('getStatus',skill.stat_source,'S_ATK')));return compareCondition(inequality,hp,limit);});
   }
  }return false;
 }
 lowestHp(ids){return ids.reduce((result,id)=>{const hp=this.call('getStatus',id,'S_CURRENT_HP');if(hp<result[1])return[[id],hp];if(hp==result[1]){result[0].push(id);return[result[0],result[1]];}return result;},[[],Infinity])[0];}
 getAutoTarget(id){
  const card=this.b.cardMap[id],row=this.db.get('card',card.res_id),type=this.call('getTargetTypeByTargetForUI',row.target_for_ui),checks=this.numbers(row.target_check_index);let targets=[];
  if(type==='TARGET_NOTHING')return checks.some(index=>this.targetCheckFailed(card,index))?undefined:-1;
  if(type==='TARGET_MONSTER'){
   targets=this.call('getTargetableMonsterPassiveFilteredIDs',card.id).filter(id=>{
    const unit=this.call('getUnitByID',id,'auto_card_use');if(this.call('isAlwaysDamageFatal',unit))return false;this.b.select_target=id;return !checks.some(index=>this.targetCheckFailed(card,index));
   });if(targets.length===0)return;
   const priority=this.db.array(this.db.table('constant_meta').autobat_target_priority_cs?.value),without=targets.filter(id=>{
    const unit=this.call('getUnitByID',id,'auto_card_use');return !this.call('getContinueSkills',unit).some(id=>{const cs=this.b.csMap[id];return cs!=null&&!cs.removed&&priority.includes(cs.res_id);});
   });if(without.length>0)targets=without;
   const notExcluded=targets.filter(id=>this.call('getUnitByID',id,'auto_card_use').res_id!=='1002017_01');if(notExcluded.length>0)targets=notExcluded;
   const notInvincible=targets.filter(id=>!this.call('getUnitByID',id,'auto_card_use').continueSkill.some(id=>invincibleCS.has(this.b.csMap[id].res_id)));if(notInvincible.length>0)targets=notInvincible;
   const first=[],last=[];for(const id of targets){const unit=this.call('getUnitByID',id,'auto_card_use'),entry=this.db.table('auto_mon_target_priority_define')[unit.res_id];if(entry?.target_type==='TARGET_FIRST')first.push(id);else if(entry?.target_type==='TARGET_LAST')last.push(id);}
   if(first.length>0)targets=first;else if(last.length>0&&targets.length>last.length)targets=targets.filter(id=>!last.includes(id));
   const talents=this.call('getTalentByInfo',card),preferred=talents.includes(T.TALENT_BIND)?new Set():new Set(['cs01_0731']);
   const matches=preferred.size===0?[]:targets.filter(id=>this.call('getContinueSkills',this.call('getUnitByID',id,'auto_card_use')).some(id=>{const cs=this.b.csMap[id];return cs!=null&&!cs.removed&&preferred.has(cs.res_id);}));
   if(matches.length>0&&matches.length<targets.length){const previews=this.b.previewMap?.[card.id],killable=id=>previews!=null&&previews[String(id)]?.hpMap?.[id]===0,kills=matches.filter(killable);if(kills.length>0)targets=kills;else if(!targets.some(killable))targets=matches;}
   // Native monster branch gets its own probability draw. If it fails, the
   // common fallback below draws the same probability a second time.
   const pct=this.call('constantMetagame','autobat_low_hp_target_pct',{def_value:100});
   if(this.e.random.randomTFbyProbability(3,pct)){
    const original=targets.filter(id=>!this.call('getUnitByID',id,'auto_card_use').summoner);if(original.length>0)targets=original;
    return this.e.random.randomArrayMember(3,this.lowestHp(targets));
   }
  }
  const pct=this.call('constantMetagame','autobat_low_hp_target_pct',{def_value:100});
  if(this.e.random.randomTFbyProbability(3,pct)){
   const original=targets.filter(id=>!this.call('getUnitByID',id,'auto_card_use').summoner);if(original.length>0)targets=original;
   const low=this.lowestHp(targets);if(low.length>0)return this.e.random.randomArrayMember(3,low);
  }
  return this.e.random.randomArrayMember(3,targets);
 }
}
