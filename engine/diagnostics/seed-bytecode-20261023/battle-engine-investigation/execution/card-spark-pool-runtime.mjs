// BattleCardProc0x38500/39900/3a400/3ae00/47000; Stage0x22d00.
// Pool cache reconstruction is the already source-verified buildCaches helper.
import {buildCaches} from '../../card-pool-investigation/build-pools.mjs';
import {weightedKey} from '../../reward-investigation/weighted-core.mjs';
import {TALENTS as T} from './card-talent-support.mjs';
import {MissingBattleRule} from './resource-store.mjs';
export class CardSparkPoolRuntime {
 constructor(e){this.e=e;this.b=e.b;this.db=e.db;}
 call(n,...a){return this.e.call(n,...a);}
 getCostByInfo(info){const row=this.db.get('card',info.res_id),base=this.db.number(row,'cost');if(base<0)return base;if(info.cost_changed)return 0;let cost=base;
  const apply=id=>{const r=this.db.get('r_spark',id);cost=this.call('procMathSign',r.add_cost_mathsign,cost,this.db.number(r,'add_cost_value'));};
  if(info.r_spark?.category==='CATEGORY_UNIQUE'){const change=this.db.get('card_r_spark',info.r_spark.res_id),copy=structuredClone(info);copy.res_id=change.change_link_card_id;copy.r_spark=copy.support_r_spark=undefined;cost=this.getCostByInfo(copy);}
  else if(info.r_spark?.category==='CATEGORY_PUBLIC')apply(info.r_spark.res_id);
  if(info.r_spark?.god_r_spark_res_id)apply(info.r_spark.god_r_spark_res_id);if(info.support_r_spark)apply(info.support_r_spark.res_id);
  if(info.eidolon_reward_ids){for(const id of info.eidolon_reward_ids){const r=this.db.table('eidolon_card_reward')[id];if(!r||this.db.number(r,'slot_add_cost')===0||r.slot_add_cost_mathsign==='MATHSIGN_NONE')continue;if(r.slot_add_cost_mathsign==='MATHSIGN_ADD')cost+=this.db.number(r,'slot_add_cost');else if(r.slot_add_cost_mathsign==='MATHSIGN_SUBTRACT')cost-=this.db.number(r,'slot_add_cost');}if(cost<0)cost=0;}
  if(info.cost_set!==undefined&&info.cost_set>=0)cost=info.cost_set;else if(info.cost_subtract!==undefined&&info.cost_subtract>=0)cost=Math.max(0,cost-info.cost_subtract);return cost;
 }
 getRSparkReplaceCosts(info){const row=this.db.table('card')[info.res_id],raw=row?.r_spark_replace_cost;if(raw==null||raw==='none')return [];const result=[];for(const text of this.db.array(raw)){const s=text.trim();if(!s.length)continue;const n=Number(s);if(Number.isInteger(n)&&n>=0)result.push(n);}return result;}
 getRSparkMatchCosts(info,replace){const costs=replace?this.getRSparkReplaceCosts(info):[];return costs.length?costs:[this.getCostByInfo(info)];}
 hasCostInRange(costs,r){return costs.some(n=>n>=r.target_card_cost_min&&n<=r.target_card_cost_max);}
 getRSparkCandidates(info,charRes,god,inBattle,extraTags){const card=this.db.get('card',info.res_id),char=charRes?this.db.get('char_combatant',charRes):undefined,costs=this.getRSparkMatchCosts(info,god==null);
  const cache=buildCaches({r_spark:Object.values(this.db.table('r_spark'))}),ids=cache['R_SPARK_RARITY:'+(god?'R_SPARK_RARITY_UNIQUE':'R_SPARK_RARITY_COMMON')];
  // Native JSON.parse(undefined) rejects a missing cache; the retained tables
  // contain both keys. Do not replace an absent candidate universe with [].
  if(ids==null)throw new MissingBattleRule('sparkPool.cache_missing',{rarity:god?'R_SPARK_RARITY_UNIQUE':'R_SPARK_RARITY_COMMON'});
  return ids.filter(id=>{const r=this.db.table('r_spark')[id];if(!r||r.r_spark_ratio==0)return false;const arr=k=>this.db.array(r[k]);
   if(god!=null){if(god==='all'?r.god_type==='none':r.god_type!==god)return false;const extra=arr('link_extra_tag_id'),hasExtra=!!(extraTags&&extraTags.length>0);if(extra.length?!hasExtra||!extra.some(t=>extraTags.includes(t)):hasExtra)return false;}
   else if(r.god_type!=='none')return false;
   if(!this.hasCostInRange(costs,r))return false;const categories=arr('target_card_category');if(categories.length&&!categories.includes(card.card_category))return false;
   const talents=this.call('getTalentByInfo',info,{skip_exhaust_n:true}),include=arr('target_card_include_talent').map(t=>T[t]),exclude=arr('target_card_exclude_talent').map(t=>T[t]);
   if(include.length&&!include.some(t=>talents.includes(t)))return false;
   if(inBattle&&card.card_category!=='CARD_POWER'){if(exclude.length===0||!exclude.some(t=>t===T.TALENT_EXHAUST)||exclude.some(t=>t!==T.TALENT_EXHAUST&&talents.includes(t)))return false;}
   else if(exclude.length&&exclude.some(t=>talents.includes(t)))return false;
   const tags=this.db.array(card.r_spark_tag_default);if(arr('r_spark_tag').some(t=>!tags.includes(t))||arr('r_spark_exclude_tag').some(t=>tags.includes(t)))return false;
   const target=arr('target_card_exclude_target_info');if(target.length&&target.includes(card.target_for_ui))return false;
   const classes=arr('target_link_base_class_define_id');if(char&&classes.length&&!classes.includes(char.link_base_class_define_id))return false;return true;
  });
 }
 getRSparkCandis(info,excluded,godFlag,inBattle){const stage=this.e.state.worktables.BattleStageWorktable.battle_stage,char=this.call('tryGetStageCharByCharId',info.char_id),candidates=this.getRSparkCandidates(info,char?.res_id,godFlag?'all':undefined,inBattle,stage.content_extra_tags).filter(id=>!excluded.some(s=>s.category==='CATEGORY_PUBLIC'&&s.res_id==id));if(!candidates.length)return;
  const weights={};candidates.forEach(id=>weights[id]=this.db.number(this.db.get('r_spark',id),'r_spark_ratio'));return weightedKey(weights,(min,max)=>this.e.random.randRange(0,min,max),false,'public_r_spark');
 }
}
