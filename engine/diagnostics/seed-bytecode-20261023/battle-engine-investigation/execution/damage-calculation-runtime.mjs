// Handwritten unified procDamageCalculate 0x4a500 and target callback 0x5d300.
// Evidence: evidence/damage-preview and evidence/damage-expansion.
import {MissingBattleRule} from './resource-store.mjs';
import {numericConstant,damageReductionConstants} from './numeric-constant.mjs';
import fs from 'node:fs';
import {ActiveCriticalRuntime} from './active-critical-runtime.mjs';
import {damageMathSign,accumulateDamageMulti,procStatType,procRevise,decreaseDamage,floorGame,ceilGame,roundGame} from '../effects/effect-arithmetic.mjs';
const COLORS={EGO_NONE:'NONE',EGO_LOVE:'RED',EGO_NORMS:'GREEN',EGO_NARCISSISM:'BLUE',EGO_INSTINCT:'ORANGE',EGO_CREED:'PURPLE',EGO_BASIC:'BASIC',EGO_OWNER:'OWNER',EGO_ALL:'ALL'};
const NON_SINGLE=new Set(['TARGET_UNIT_ALL_ENEMY','TARGET_UNIT_DAMAGE_ENEMY_ALL','TARGET_UNIT_ALL_ENEMY_EXCEPT_CASTER','TARGET_UNIT_EXCEPT_OWNER','TARGET_UNIT_SELECTED_BOTH_SIDE','TARGET_UNIT_NOT_SELECTED']);
const DAMAGE_SIGNS=/^MATHSIGN_(?:ADD|SUBTRACT|(?:FINAL_)?(?:MULTIPLY|MULTIPLY_PCT|ADD_HUND_MULTIPLY_PCT|SUBTRACT_HUND_MULTIPLY_PCT))$/;
const DAMAGE_ATTR=new Set([...fs.readFileSync(new URL('../attributes/gamecore/battle/skill_effect_enums.js.recovered.js',import.meta.url),'utf8').matchAll(/arg0\.(DMG_ATTR_[A-Za-z_0-9]+) = /g)].map(m=>m[1]));
export class DamageCalculationRuntime {
  constructor(e){this.e=e;this.b=e.b;this.w=e.wt;this.db=e.db;this.critical=new ActiveCriticalRuntime(e);}
  call(n,...a){return this.e.call(n,...a);}
  query(type,id,isCard=false,extra={}){return this.e.passives.query({source_id:id,type:'SKILL_EFF_'+type,is_card:isCard,...extra});}
  constant(id){return numericConstant(this,id);}
  revise(type,value){return procRevise(type,value,{damage:type===1?this.constant('dmg_revise_rate'):undefined});}
  color(ego){const value=COLORS[ego]??(Object.values(COLORS).includes(ego)?ego:undefined);if(value==null)throw new MissingBattleRule('damageCalculation.ego_color',{ego});return value;}
  includeEgo(values,ego){return !!values&&(values.includes('EGO_ALL')||values.includes(ego??'NONE'));}
  checkDmgAdditionalTakeAttr(opts,attrs){return opts.filter(x=>DAMAGE_ATTR.has(x)).every(x=>attrs.includes(x));}
  check(p,c,extra={}){return this.call('checkValueAddOpts',{passive_id:p.skill_id,skill_id:c.s.skill_id,card_id:c.passiveCard,target:c.target,egoAttack:c.egoAttack,dmg_attr:c.attrs,crit:c.crit,destroy:c.destroy,ego_type:c.color,...extra});}
  simpleCheck(p,c){return this.call('checkValueAddOpts',{passive_id:p.skill_id,skill_id:c.s.skill_id,card_id:c.cardId,target:c.targets.length===1?this.e.getUnit(c.targets[0]):undefined,ego_type:c.color});}
  rootParent(s){let root=s,seen=new Set();while(root.parent.type==='SKILL'){if(seen.has(root.skill_id))throw new MissingBattleRule('damageCalculation.parent_cycle');seen.add(root.skill_id);const next=this.b.skillMap[root.parent.id];if(!next)break;root=next;}return root.parent;}
  parentAllows(p,c){const o=p.eff_opts??[];return (!o.includes('tactic')||c.support)&&(!o.includes('cs')||c.csRoot)&&(!o.includes('card')||c.cardRoot||c.parentCardOpt)&&(!o.includes('coop')||c.a.coop_char!=null);}
  targetAllows(p,c,ordinary=false){const o=p.eff_opts??[];return !(o.includes('single_target')&&NON_SINGLE.has(c.r.target_unit_type)||o.includes('except_penetrate')&&c.attrs.includes('DMG_ATTR_PENETRATE')||o.includes('all_attack_single_target')&&(c.r.target_unit_type!=='TARGET_UNIT_ALL_ENEMY'||c.targets.length!==1)||o.includes('all_attack')&&c.r.target_unit_type!=='TARGET_UNIT_ALL_ENEMY'||ordinary&&(o.includes('multi')&&c.count<=1||o.includes('single_hit')&&c.count!==1||o.includes('multi_target')&&c.targets.length<2));}
  markRelic(p,attrs,args){if(args.leech_hp_relic==null&&p.from_relic&&attrs.some(x=>x==='DMG_ATTR_LEECH_HP'||x==='DMG_ATTR_LEECH_HP_PCT')&&this.db.get('skill_eff',p.res_id).trigger_noti_type==='YES')args.leech_hp_relic=p.from_relic;}
  prepareAttrs(c){
    const {s,r,a}=c,args={},ignoreBefore=()=>args.ignore_cs_list;let attrs=this.call('getAttrInfo',1,r.eff_attr,args);const ignore=ignoreBefore();attrs.push(...s.dmgAttrAdd??[]);
    const add=p=>{if(!p.eff_opts)throw new MissingBattleRule('damageCalculation.undefined_attr_options',{res:p.res_id});const next=this.call('getAttrInfo',1,p.eff_opts,args);this.markRelic(p,next,args);attrs=attrs.concat(next);};
    if(s.parent.type==='CS'){const cs=this.b.csMap[s.parent.id];if(cs){
      for(const p of this.query('DMG_ATTR_ADD_PASSIVE',cs.owner_id,cs.isCard,{is_pre:c.isPre,char_id:cs.char_id,caster_id:cs.caster_id}))if(p.link_cs_ids?.includes(cs.res_id)){add(p);this.call('checkTermValuePassive',p.skill_id,s.caster_id,true,c.isPre);}
      for(const p of this.query('TARGET_CS_DMG_ATTR_BAN',this.b.char.id,false,{is_pre:c.isPre,char_id:s.action_char_id,caster_id:s.caster_id})){
        if(!p.link_cs_ids?.includes(cs.res_id))continue;const opts=p.eff_opts??[],ally=opts.includes('ally'),enemy=opts.includes('enemy');if(!(ally&&enemy)&&(ally&&this.e.getMonster(cs.owner_id)||enemy&&!this.e.getMonster(cs.owner_id)))continue;attrs=attrs.filter(x=>!opts.includes(x));}
    }}
    if(c.cardId!==-1){const card=this.b.cardMap[c.cardId],cardRow=this.db.get('card',card.res_id);if(a.nihilum_meta)card.nihilum_meta_motion='nihilum_meta_default_attack';
      const list=this.query('DMG_ATTR_ADD_PASSIVE',card.caster_id,false,{is_pre:c.isPre,char_id:card.char_id}).concat(this.query('DMG_ATTR_ADD_PASSIVE',c.cardId,true,{is_pre:c.isPre}));
      for(const p of list){const row=this.db.get('skill_eff',p.res_id);if(p.link_cs_ids?.length)continue;
        const cost=this.call('parseCardCostFilter',row.target_card_set_opt_cost);if(cost&&!this.call('applyCardCostFilter',cost,card.id))continue;
        const categories=this.db.array(row.target_card_set_card_type);if(categories.length&&(cardRow.sort==='SORT_COLLAPSE_SKILL'||!this.call('checkCategory',card.id,categories)))continue;
        add(p);this.call('checkTermValuePassive',p.skill_id,card.caster_id,true,c.isPre);
      }
    }
    if(attrs.includes('DMG_ATTR_CLASS')&&this.isDmgAttrClassBaseOnDef(c.cardId))attrs.push('DMG_ATTR_BASE_ON_DEF');
    return {attrs,attrArgs:args,ignore};
  }
  isDmgAttrClassBaseOnDef(id){if(id===-1)return false;const card=this.b.cardMap[id];if(!card||card.char_id<=0)return false;const id2=card.char_id>=4&&card.char_id<=6?card.char_id-3:card.char_id,c=this.call('tryGetCharByCharId',id2);if(!c||c.res_id<0)return false;const row=this.db.table('char_combatant')[c.res_id];if(!row)return false;return ['vanguard','controller'].includes(row.link_base_class_define_id);}
  getCountAdditional(c,target){
    const id=c.passiveCard,card=this.b.cardMap[id];if(id===-1||!card)return 0;const row=this.db.get('card',card.res_id);if(['SORT_COLLAPSE_SKILL','SORT_COLLAPSE','SORT_SUPPORT','SORT_BREAK_IN'].includes(row.sort))return 0;
    const list=this.query('DMG_COUNT_VALUE_ADD',c.source.id,false,c.extra).filter(p=>!p.eff_opts?.includes('take')&&this.parentAllows(p,c)).concat(this.query('DMG_COUNT_VALUE_ADD',id,true,{is_pre:c.isPre}).filter(p=>this.parentAllows(p,c)));let add=0;
    for(const p of list){if(p.eff_opts?.includes('multi')&&this.call('calcCountValue',c.s.skill_id,target.id,c.a.preview_args)+(c.a.count_value_additional??0)+add<=1)continue;
      if(!this.call('checkValueAddOpts',{passive_id:p.skill_id,skill_id:c.s.skill_id,card_id:id,target,dmg_attr:c.attrs,ego_type:c.color}))continue;
      add+=this.call('calcValue',p.skill_id,target.id);this.call('checkTermValuePassive',p.skill_id,c.s.caster_id,true,c.isPre);}
    return add;
  }
  rate(c,list,base,{kind,consume=false,targetFilters=false}={}){let plus=0,multi=1,delta=1;
    for(const p of list){if(!this.check(p,c)||targetFilters&&!this.targetAllows(p,c))continue;if(consume)this.call('checkTermValuePassive',p.skill_id,c.target.id,true,c.isPre);
      const row=this.db.get('skill_eff',p.res_id),v=this.call('calcValue',p.skill_id,c.target.id);switch(row.eff_value_math_sign){case'MATHSIGN_ADD':plus+=v;break;case'MATHSIGN_MULTIPLY':multi*=v;break;case'MATHSIGN_MULTIPLY_PCT':multi*=v/100;break;case'MATHSIGN_ADD_HUND_MULTIPLY_PCT':multi*=(100+v)/100;break;case'MATHSIGN_SUBTRACT_HUND_MULTIPLY_PCT':multi*=(100-v)/100;break;case'MATHSIGN_MULTIPLY_DELTA_ONLY':delta+=v-1;break;default:throw new MissingBattleRule('damageCalculation.rate_sign',{id:p.skill_id,sign:row.eff_value_math_sign});}}
    if(kind==='critical')return (1+(((base+plus)*multi)-1)*delta)/100;if(kind==='weak')return 1+((base*multi+plus)-1)*delta;if(kind==='final')return 1+((((base+plus)/100)*multi)-1)*delta;throw new MissingBattleRule('damageCalculation.rate_kind',{kind});
  }
  egoPassive(c,value,type,dry=false,omitTarget=false){
    const list=this.query(type,c.source.id,false,c.extraIgnore).concat(omitTarget?[]:this.query(type,c.target.id,false,{is_pre:c.isPre,caster_id:c.charId,ignore_cs_list:c.ignore}),this.query(type,c.passiveCard,true,{is_pre:c.isPre,ignore_cs_list:c.ignore}));let plus=0,multi=1,set;const terms=[];
    for(const p of list){if(!this.call('checkValueAddOpts',{passive_id:p.skill_id,skill_id:c.s.skill_id,card_id:c.passiveCard,target:c.target,egoAttack:c.egoAttack,crit:c.crit,ego_type:c.color}))continue;
      const sign=this.db.get('skill_eff',p.res_id).eff_value_math_sign;if(set!=null){if(sign==='MATHSIGN_SET'&&!dry)throw new MissingBattleRule('damageCalculation.duplicate_ego_set');continue;}
      terms.push(p.skill_id);const v=this.call('calcValue',p.skill_id,c.target.id);if(sign==='MATHSIGN_SET'){set=v;terms.splice(0,terms.length,p.skill_id);}else if(sign==='MATHSIGN_ADD')plus+=v;else if(sign==='MATHSIGN_MULTIPLY')multi*=v;else if(sign==='MATHSIGN_MULTIPLY_PCT')multi*=v/100;else if(sign==='MATHSIGN_ADD_HUND_MULTIPLY_PCT')multi*=(100+v)/100;else if(sign==='MATHSIGN_SUBTRACT_HUND_MULTIPLY_PCT')multi*=(100-v)/100;else throw new MissingBattleRule('damageCalculation.ego_sign',{sign});}
    if(!dry)for(const id of terms)this.call('checkTermValuePassive',id,c.target.id,true,c.isPre);return {value:set??Math.max(0,(value+plus)*multi),is_set:set!=null};
  }
  egoRevise(c){const card=this.b.cardMap[c.cardId];if(!card)return 1;return ['TARGET_SELECTED_MONSTER','TARGET_SELECTED_MONSTER_AUTO_RANDOM','TARGET_MOST_MAX_HP_MONSTER'].includes(this.db.get('card',card.res_id).target_for_ui)?1:.5;}
  egoBase(c){return Math.max(.5,Math.min(this.constant('ego_field_damage_cap'),c.s.cost_used??0));}
  expectedEgo(c,fieldAttack){const value=this.egoPassive(c,this.egoBase(c),'EGO_FIELD_DAMAGE_VALUE_ADD',true);let n=value.is_set?value.value:(fieldAttack?value.value:value.value/3)*this.egoRevise(c);n=this.egoPassive(c,n,'EGO_FIELD_DAMAGE_FIX_VALUE_ADD',true).value;return this.egoPassive(c,n,'HIT_EGO_FIELD_DAMAGE_FIX_VALUE_ADD',true).value;}
  ego(c,uniqueRandom){
    const {s,target,cardId,passiveCard}=c,isZero=c.attrs.includes('DMG_ATTR_EGO_FIELD_0');let ego=passiveCard!==-1?this.call('getEgo',passiveCard):undefined;if(ego==='EGO_ALL')ego=target.ego_field_egos?.[0]??'NONE';
    const finalField=isZero||cardId!==-1&&c.r.operation==='OPERATION_ACTIVE'&&!c.isPre&&!!this.e.getMonster(target.id)&&c.a.coop_char==null&&(c.logType===2?uniqueRandom:c.index===c.count-1),actualField=finalField&&!isZero&&!c.byEffect;
    const matching=passiveCard!==-1&&(!finalField||!this.w.test)&&this.includeEgo(target.ego_field_egos,ego),forced=s.ego_attack!=null,weakpoint=this.b.cardMap[cardId]?.talents?.includes(33)??false;
    const bans=this.query('NOT_EGO_ATTACK',s.caster_id,false,c.extraIgnore).concat(cardId!==-1?this.query('NOT_EGO_ATTACK',cardId,true):[]);let attack=false,fieldAttack=false,expectedAttack=false;
    if(bans.length){if(finalField)for(const p of bans)this.call('checkTermValuePassive',p.skill_id,s.caster_id,true,c.isPre);}
    else{const incoming=this.query('EGO_ATTACK_TAKE_ALWAYS',target.id,false,{caster_id:s.caster_id}).filter(p=>!p.eff_opt_multiple_link?.length||p.eff_opt_multiple_link.map(x=>this.call('convertEgoCommon',x)).includes(ego??'NONE'));
      attack=(finalField||passiveCard!==-1&&!c.isPre&&!!this.e.getMonster(target.id))&&(matching||forced||weakpoint||incoming.length>0);expectedAttack=attack;fieldAttack=isZero?this.includeEgo(target.ego_field_egos,this.call('convertEgoCommon',c.egoColor)):attack;
      if(finalField)for(const p of incoming)this.call('checkTermValuePassive',p.skill_id,s.caster_id,true,c.isPre);
      const always=this.query('WEAK_EGO_DAMAGE_ALWAYS',s.caster_id,false,{char_id:c.charId}).concat(cardId!==-1?this.query('WEAK_EGO_DAMAGE_ALWAYS',cardId,true):[]).filter(p=>this.call('checkValueAddOpts',{passive_id:p.skill_id,skill_id:s.skill_id,card_id:passiveCard,target,crit:c.crit,ego_type:c.color}));if(always.length)attack=true;
    }
    c.egoAttack=attack;let value=actualField?this.egoBase(c):0;
    if(finalField){
      if(attack){const card=this.b.cardMap[cardId];if(!card)throw new MissingBattleRule('damageCalculation.ego_attack_card');this.call('procCardEvent','CONDITION_EGO_ATTACK_CARD_USE',card.place_before_using,cardId,{target:target.id});}
      if(!matching&&forced){this.call('checkTermValuePassive',s.ego_attack,this.b.char.id,true,c.isPre);const action=this.b.egoActionMap?.[s.ego_attack];if(action){this.e.pushAction({id:this.b.last_action_id++,type:'action_ego_active',source_id:action.char_id,ego_skill_res_id:action.ego_skill_res_id});if(this.w.isPreview)this.w.triggeredList.ego.push([action.ego_skill_res_id,action.char_id]);}}
      if(actualField&&!c.attrs.includes('DMG_ATTR_NOT_EGO_FIELD')){const first=this.egoPassive(c,value,'EGO_FIELD_DAMAGE_VALUE_ADD',true,true);let predicted=first.is_set?first.value:(fieldAttack?first.value:first.value/3)*this.egoRevise(c);predicted=this.egoPassive(c,predicted,'EGO_FIELD_DAMAGE_FIX_VALUE_ADD',true,true).value;predicted=this.egoPassive(c,predicted,'HIT_EGO_FIELD_DAMAGE_FIX_VALUE_ADD',true,true).value;if(predicted>(fieldAttack?value:value/3)*this.egoRevise(c)&&this.b.cardMap[passiveCard])this.b.cardMap[passiveCard].ego_field_dmg_increased=true;}
      if(actualField&&!target.ego_breaked){const first=this.egoPassive(c,value,'EGO_FIELD_DAMAGE_VALUE_ADD');value=first.is_set?first.value:(fieldAttack?first.value:first.value/3)*this.egoRevise(c);value=this.egoPassive(c,value,'EGO_FIELD_DAMAGE_FIX_VALUE_ADD').value;value=this.egoPassive(c,value,'HIT_EGO_FIELD_DAMAGE_FIX_VALUE_ADD').value;}
    }else if(!c.byEffect&&!target.ego_breaked)value=this.egoPassive(c,value,'HIT_EGO_FIELD_DAMAGE_FIX_VALUE_ADD').value;
    if(c.attrs.includes('DMG_ATTR_NOT_EGO_FIELD'))value=0;
    let expected=value;if(!finalField&&!isZero&&!target.ego_breaked&&target.ego_field_value!=null&&cardId!==-1&&c.r.operation==='OPERATION_ACTIVE'&&c.a.card_activation==true&&!c.isPre&&this.e.getMonster(target.id)&&c.a.coop_char==null&&c.logType!==2&&!c.attrs.includes('DMG_ATTR_NOT_EGO_FIELD'))expected=Math.max(value,this.expectedEgo(c,expectedAttack));
    return {value,expected};
  }
  ordinary(c,value,shieldRate,removedCount,fixPassive){
    const outgoing=this.query('DAMAGE_VALUE_ADD',c.source.id,false,c.extraIgnore).filter(p=>!p.eff_opts?.includes('take')&&this.parentAllows(p,c)),incoming=this.query('DAMAGE_VALUE_ADD',c.target.id,false,{is_pre:c.isPre,caster_id:c.charId,ignore_cs_list:c.ignore}).filter(p=>p.eff_opts?.includes('take')&&this.parentAllows(p,c)),card=this.query('DAMAGE_VALUE_ADD',c.passiveCard,true,{is_pre:c.isPre,ignore_cs_list:c.ignore}).filter(p=>!p.eff_opts?.includes('take')&&this.parentAllows(p,c));
    let plus=0,buckets={multi:1,multi_dec:1,multi_final:1},takePlusMonster=0,takePlusUser=0,takeAmpMonster=0,takeAmpUser=0;const used=[];
    if(c.s.r_spark_multiply_pct_value)buckets.multi+=c.s.r_spark_multiply_pct_value/100;if(c.attrs.includes('DMG_ATTR_STRENGTH_REF_0'))plus+=(this.b.stackMap[c.s.stack_value0??-1]?.stack??0)*20;if(c.attrs.includes('DMG_ATTR_STRENGTH_REF_1'))plus+=(this.b.stackMap[c.s.stack_value1??-1]?.stack??0)*20;
    for(const p of outgoing.concat(incoming,card)){if(!this.check(p,c,{first_hit:c.index===0})||!this.targetAllows(p,c,true))continue;if(p.parent.type==='CS')used.push(p.skill_id);
      const skipped=p.parent.type==='CS'&&c.skip.some(q=>q.link_cs_ids?.includes(this.b.csMap[p.parent.id]?.res_id));if(!c.a.preDeath&&!c.unreducing&&!skipped)this.call('checkTermValuePassive',p.skill_id,c.source.id,true,c.isPre);
      const row=this.db.get('skill_eff',p.res_id),v=this.call('calcValue',p.skill_id,c.target.id,false,undefined,{card_id:c.passiveCard});if(!DAMAGE_SIGNS.test(row.eff_value_math_sign))throw new MissingBattleRule('damageCalculation.damage_sign',{id:p.skill_id,sign:row.eff_value_math_sign});
      const change=damageMathSign(row.eff_value_math_sign,v),take=p.eff_opts?.includes('take'),byMonster=!!this.e.getMonster(p.caster_id)||p.parent.type==='CS'&&this.b.csMap[p.parent.id]?.by_monster===true;plus+=change.plus;
      if(change.plus!==0){if(take&&change.plus>0){if(byMonster)takePlusMonster+=change.plus;else takePlusUser+=change.plus;}}else if(change.multiValue!=null){buckets=accumulateDamageMulti(change.multiValue,change.is_final,take,buckets);if(take&&change.multiValue>=1){if(byMonster)takeAmpMonster+=change.multiValue-1;else takeAmpUser+=change.multiValue-1;}}
    }
    buckets.multi+=shieldRate-1;
    if(removedCount>0&&fixPassive){const row=this.db.get('skill_eff',fixPassive.res_id),v=this.call('calcValue',fixPassive.skill_id,c.target.id),factor=this.call('procMathSign',row.eff_value_math_sign,removedCount,v);buckets.multi+=factor-1;this.call('checkTermValuePassive',fixPassive.skill_id,c.source.id,true,c.isPre);}
    if(this.call('isAssaultFourthCombatant',c.charId)){const stage=(this.w.battle_stage_worktable??this.e.state.worktables.BattleStageWorktable).battle_stage,row=this.db.table('chaos_assault_list')[stage.chaos_assault_list_id??''];buckets.multi+=Number(row?.combatant_4_dmg_pct??0)/100;}
    if(!c.monsterSource){buckets.multi+=(this.b.char.status.info.S_ZERO_TACTICS_DMG_UP_RATE__VALUE??0)/100;buckets.multi+=this.call('getNonBattleEffPctAdd','EFF_DMG_UP_RATE_PCT_MULTIPLY',c.charId);}
    plus=this.revise(1-c.reviseType,procStatType(1-c.statType,plus,c.stat));const final=buckets.multi_final*buckets.multi_dec,beforeFinal=value*buckets.multi+plus;value=beforeFinal*final;value=value>0?(final>1?ceilGame:final<1?floorGame:roundGame)(value):value<0?(final>1?floorGame:final<1?ceilGame:roundGame)(value):roundGame(value);
    let monsterRatio;if(!this.e.getMonster(c.target.id)){const originalByMonster=c.monsterSource||this.b.cardMap[c.cardId]?.by_monster===true,ampAll=beforeFinal*(takeAmpMonster+takeAmpUser)*buckets.multi_dec,ampMonster=beforeFinal*takeAmpMonster*buckets.multi_dec,plusAll=(takePlusMonster+takePlusUser)*final,plusMonster=takePlusMonster*final;monsterRatio=value>0?Math.max(0,Math.min(1,((originalByMonster?value-ampAll-plusAll:0)+ampMonster+plusMonster)/value)):originalByMonster?1:0;}
    return {value,used,monsterRatio};
  }
  fixedCount(c,total,target){
    let passive,removed=0;if(c.cardId!==-1){const list=this.query('FIX_COUNT_DAMAGE_VALUE_ADD',c.source.id,false,c.extraIgnore).concat(this.query('FIX_COUNT_DAMAGE_VALUE_ADD',c.cardId,true,{is_pre:c.isPre})).filter(p=>this.call('checkValueAddOpts',{passive_id:p.skill_id,skill_id:c.s.skill_id,card_id:c.passiveCard,target,ego_type:c.color}));
      if(list.length){passive=list[0];const raw=passive.eff_opts?.[0],cap=raw!=null&&!isNaN(Number(raw))?Number(raw):1;if(total>cap){c.s.before_fix_count_value=total;removed=total-cap;total=cap;}}}
    const card=this.b.cardMap[c.cardId];if(card)card.applied_atk_count=total;return {total,removed,passive};
  }
  hit(c,originalId,targetIndex){
    let target=this.e.getUnit(originalId);c.usedByTarget[targetIndex]=[];
    if(!this.call('isFieldMonster',target)&&!(c.a.from_hud_preview&&target.state==='death'))return false;
    const card=this.b.cardMap[c.cardId],shielded=target.status.info.S_CURRENT_SHIELD>0&&!c.attrs.includes('DMG_ATTR_PENETRATE'),shieldRate=card?.talents?.includes(34)&&shielded?this.constant('shield_destruct_dmg_pct')/100:1;
    const extra=this.getCountAdditional(c,target),additional=c.a.count_value_additional+extra;
    let count=c.counts[target.id]??(this.call('calcCountValue',c.s.skill_id,target.id,c.a.preview_args)+additional);if(card?.talents?.includes(58))count=Math.min(count,1);c.counts[target.id]=count;c.s.last_count_value=Math.max(c.s.last_count_value??0,count-c.a.count_value_additional);
    let total=count+c.destroyCount;if(card?.talents?.includes(58))total=Math.min(total,1);const fixed=this.fixedCount(c,total,target);total=fixed.total;
    if(!Number.isFinite(total)||total<0||total>1000)throw new MissingBattleRule('damageCalculation.hit_count',{total});if(c.index>=total)return false;
    let id=originalId,unique=true;if(c.logType===2&&c.index>0){let ids=this.call('getTargetableMonstersID',{skill_id:c.s.skill_id});if(ids.length===0)ids=this.call('getTargetableMonstersID',{skill_id:c.s.skill_id,checkHP:false});if(ids.length){id=this.e.random.randomArrayMember(0,ids);if(c.ranTargets.includes(id))unique=false;c.ranTargets.push(id);}target=this.e.getUnit(id);}else c.ranTargets.push(id);
    const h={...c,target,count,egoAttack:false,destroy:false};let value=this.call('calcValue',c.s.skill_id,id,false,c.a.preview_args);
    if(c.monsterSource&&!c.attrs.includes('DMG_ATTR_IGNORE_RAGE')){const rage=this.call('getRageDiff',true,c.isPre);if(rage!=null&&rage>=0)value*=this.constant('rage_base')*Math.pow(this.constant('rage_scale'),rage);}
    h.unreducing=this.query('UNREDUCING_HP',id).length>0;const ego=this.ego(h,unique);h.destroy=target.ego_field_value!=null&&target.ego_field_value-ego.expected<=0;
    if(c.attrs.includes('DMG_ATTR_COUNT')&&this.e.getMonster(id)){const factor=this.constant('dtr_cnt_add_hund_multiply_pct'),cap=this.constant('dmg_attr_count_max_turn_count');value*=(100+Math.max(0,Math.min(target.mon_turn??Infinity,cap))*factor)/100;}
    let used=[],monsterRatio;if(c.fix){value*=shieldRate*(c.s.r_spark_multiply_pct_value?1+c.s.r_spark_multiply_pct_value/100:1);if(c.s.r_spark_multiply_pct_value)value=ceilGame(value);}else{const out=this.ordinary(h,value,shieldRate,fixed.removed,fixed.passive);value=out.value;used=out.used;monsterRatio=out.monsterRatio;}
    c.totals.coeff+=value;if(c.cardId!==-1)this.call('setCardUseDisplaySkillValue',c.cardId,c.s.skill_id,id,{value});value=this.revise(c.reviseType,procStatType(c.statType,value,c.stat));
    if(c.color!=='BASIC')value*=(100+this.call('getStatus',c.charId,'S_'+c.color+'_DMG_RATE',0))/100;if(c.attrs.includes('DMG_ATTR_ADDITIONAL_ATTACK'))value*=(100+this.call('getStatus',c.charId,'S_ADDI_ATK_DMG_RATE',0))/100;if(c.attrs.includes('DMG_ATTR_DOT_ATTACK'))value*=(100+this.call('getStatus',c.charId,'S_DOT_ATK_DMG_RATE',0))/100;if(value<0)value=0;
    if(value>0&&c.crit){const list=this.query('CRITICAL_DAMAGE_VALUE_ADD',c.source.id,false,c.extraIgnore).concat(this.query('CRITICAL_DAMAGE_VALUE_ADD',c.passiveCard,true,{is_pre:c.isPre,ignore_cs_list:c.ignore}));value=ceilGame(value*this.rate(h,list,this.call('getStatus',c.charId,'S_CRI_DMG_RATE'),{kind:'critical',targetFilters:true}));}
    if(c.a.coop_char==null&&h.egoAttack){let weak=this.call('getStatus',c.charId,'S_WEAK_EGO_DMG_RATE')/100;if(isNaN(weak))weak=1;const list=this.query('WEAK_EGO_DAMAGE_REVISE_VALUE_ADD',c.source.id,false,{char_id:c.charId});value=ceilGame(value*this.rate(h,list,weak,{kind:'weak',consume:true}));}
    const monsterTarget=!!this.e.getMonster(id),partyDef=c.statType!==0&&!monsterTarget?this.call('getStatus',this.b.char.id,'S_DEF'):undefined;
    value=decreaseDamage(value,{statType:c.statType,isMonsterTarget:monsterTarget,monsterRate:target.status.info.S_DMG_DECREASE_RATE,partyDef,...(partyDef!==undefined?damageReductionConstants(this,partyDef):{})});
    if(c.s.parent.type==='CARD'&&c.r.target_unit_type==='TARGET_UNIT_SELECTED'&&value>0){for(const p of this.query('CARD_MULTI_DAMAGE_VALUE_DECREASE',id)){const row=this.db.get('skill_eff',p.res_id),offset=(c.index+1)-row.eff_value;if(offset>=0)value*=Number(p.eff_opts?.[offset]??0)/100;}value=floorGame(value);if(value<=0)value=1;}
    if(value>0){const list=this.query('FINAL_DAMAGE_VALUE_ADD',c.source.id,false,c.extraIgnore).filter(p=>!p.eff_opts?.includes('take')).concat(this.query('FINAL_DAMAGE_VALUE_ADD',id,false,{caster_id:c.charId,is_pre:c.isPre,ignore_cs_list:c.ignore}).filter(p=>p.eff_opts?.includes('take')),this.query('FINAL_DAMAGE_VALUE_ADD',c.passiveCard,true,{is_pre:c.isPre,ignore_cs_list:c.ignore}).filter(p=>!p.eff_opts?.includes('take')));const rate=this.rate(h,list,100,{kind:'final'});if(rate!==1)value=ceilGame(value*rate);}
    if(c.cardId!==-1)this.call('setCardUseDisplaySkillValue',c.cardId,c.s.skill_id,id,{result_value:value});
    const additions=[];for(const p of this.query('DMG_VALUE_ADD_ADDITIONAL',c.source.id,false,{...c.extra,caster_id:c.s.caster_id}).filter(p=>!p.eff_opts?.includes('take'))){if(this.check(p,h)){const n=ceilGame(value*this.call('calcValue',p.skill_id,id)/100);if(n>0)additions.push(n);}}
    for(const p of this.query('DMG_VALUE_ADD_ADDITIONAL',id,false,{is_pre:c.isPre,ignore_cs_own_type:true}).filter(p=>p.eff_opts?.includes('take'))){if(this.checkDmgAdditionalTakeAttr(p.eff_opts??[],c.attrs)&&this.check(p,h)){const n=ceilGame(value*this.call('calcValue',p.skill_id,id)/100);if(n>0)additions.push(n);}}
    const result=this.call('procDamageApply',{worktable:this.w,caster_id:c.charId,target,eff_value:value,card_id:c.cardId,parent_card_id:c.parentCard,skill_id:c.s.skill_id,isPre:c.isPre,ignoreCond:c.a.ignoreCond,dmgAttr:c.attrs,attrArgs:c.attrArgs,index:c.index,ref:undefined,opt:c.s.eff_opts??[],fix:c.fix,weakEgoAttack:c.a.coop_char==null&&h.egoAttack,egoFieldDmg:ego.value,system_eff:c.index===0?c.r.link_battle_system_effect_id:undefined,isCrit:c.crit,dva_css:c.fix?undefined:used,dmgAdditionals:additions,char_id:c.charId,target_char_id:c.targetChar,is_last_attack:c.index===count-1,monster_dmg_ratio:monsterRatio});
    c.totals.damage+=result.damage_amount;if(c.a.nihilum_meta)this.call('procNihilumMetaDamage',{card_id:c.cardId,target,deadEvent:result.deadEvent});
    if(!c.isPre&&result.deadEvent)this.b.deads.push({source_id:target.id,by:c.cardId>0?'card':'',killer:c.source.id,prevHP:result.prevHP,deadEvent:result.deadEvent,card_id:c.cardId>0?c.cardId:undefined,trigger_cause_card_id:this.call('getTriggerCauseCardId',this.b.skillMap[c.s.skill_id]),all_attack:c.r.target_unit_type==='TARGET_UNIT_ALL_ENEMY'});
    c.action.action_units.push(...result.ret_actions);c.usedByTarget[targetIndex]=used;return true;
  }
  skipTerms(p,c){if(p.eff_opt_multiple_link?.length)return p.eff_opt_multiple_link.includes(c.s.res_id);const links=this.db.array(this.db.get('skill_eff',p.res_id).target_card_set_opt_multiple_link??'');return links.length===0||c.cardId!==-1&&links.includes(this.b.cardMap[c.cardId]?.res_id);}
  procDamageCalculate(a){
    if(a.worktable!=null&&a.worktable!==this.w)throw new MissingBattleRule('procDamageCalculate.foreign_worktable');const s=this.b.skillMap[a.skill_id];if(!s||!Array.isArray(a.targets)||!Number.isFinite(a.count_value_additional))throw new MissingBattleRule('damageCalculation.input',{skill_id:a.skill_id,count_value_additional:a.count_value_additional});
    const before=this.b.cur_card_dmg_targets,isPre=a.is_pre;let batch=false;if(!isPre)this.call('beginImmediatePassiveCSLogScope');
    try{this.b.cur_card_dmg_targets=a.targets;const charId=a.coop_char??s.action_char_id,r=this.db.get('skill_eff',s.res_id),source=this.e.getUnit(s.caster_id),monsterSource=!!this.e.getMonster(charId),cardId=a.coop_char==null?this.call('getSkillCardId',s):-1;
      if(a.motion_triggered&&(monsterSource?a.targets.includes(charId):a.targets.some(id=>!this.e.getMonster(id))))throw new MissingBattleRule('damageCalculation.invalid_motion_triggered_self_damage',{skill_id:s.skill_id,res_id:s.res_id});
      const c={a,s,r,source,charId,cardId,isPre,monsterSource,targets:a.targets,counts:{},destroyCount:0,ranTargets:[],totals:{damage:0,coeff:0},byEffect:!isPre&&cardId!==-1&&r.operation==='OPERATION_ACTIVE'&&a.coop_char==null&&a.card_activation!==true};
      if(!isPre&&cardId!==-1&&r.operation==='OPERATION_ACTIVE'&&a.coop_char==null){const forced=this.query('EGO_ATTACK_ALWAYS',cardId,true).concat(this.query('EGO_ATTACK_ALWAYS',this.b.char.id,false,{char_id:s.action_char_id})).filter(p=>p.eff_opts==null||p.eff_opts.length===0||p.eff_opts.includes(this.call('getEgo',cardId)));s.ego_attack=forced[0]?.skill_id;}
      c.targetChar=r.target_unit_type==='TARGET_UNIT_HIT_ENEMY'?source.previousAttackedby:undefined;Object.assign(c,this.prepareAttrs(c));c.extra={is_pre:isPre,char_id:charId};c.extraIgnore={...c.extra,ignore_cs_list:c.ignore};c.fix=c.attrs.includes('DMG_ATTR_FIX');c.statType=c.attrs.includes('DMG_ATTR_IGNORE_STAT')?0:1;c.reviseType=c.attrs.includes('DMG_ATTR_IGNORE_REVISE')?0:1;
      c.logType=r.target_unit_type==='TARGET_UNIT_ALL_ENEMY'?1:r.target_unit_type==='TARGET_UNIT_ALL_RAN_ENEMY'?2:r.target_unit_type==='TARGET_UNIT_NOT_SELECTED'?3:0;if(!isPre&&c.logType===1){this.call('beginMonsterHitBatch');batch=true;}
      const statId=this.call('resolveStatSource',s.skill_id,s.stat_source),statFor=basis=>{let stat=this.call('getStatus',basis,'S_ATK');if(c.attrs.includes('DMG_ATTR_BASE_ON_DEF'))stat=this.call('getStatus',basis,'S_DEF')*2.1+stat*.3;else if(c.attrs.includes('DMG_ATTR_DEF_80_PCT'))stat=this.call('getStatus',basis,'S_DEF')*.8+stat*.2;else if(c.attrs.includes('DMG_ATTR_DEF_100_PCT'))stat=this.call('getStatus',basis,'S_DEF');return stat;};c.stat=statFor(statId);if(a.coop_char!=null)c.stat=statFor(a.coop_char);
      const root=this.rootParent(s);c.csRoot=root.type==='CS';c.cardRoot=root.type==='CARD';c.support=false;if(c.cardRoot){const row=this.db.table('card')[this.b.cardMap[cardId]?.res_id];if(row){c.support=row.sort==='SORT_SUPPORT';c.cardRoot=!c.support;}}
      let egoColor='BASIC';if(cardId!==-1){egoColor=this.call('getEgo',cardId);if(egoColor==='EGO_ALL')egoColor=this.call('getOwnerEgo',cardId);}else if([1,2,3,7].includes(s.caster_id)){const char=this.call('tryGetCharByCharId',s.caster_id);if(char)egoColor=this.db.get('char_combatant',char.res_id).link_ego_type_id;}c.color=this.color(egoColor);c.egoColor=c.color;
      const destroyPassives=this.query('COUNT_ADD_DESTROY',source.id,false,c.extra).concat(this.query('COUNT_ADD_DESTROY',cardId,true,{is_pre:isPre})).filter(p=>this.simpleCheck(p,c));c.parentCardOpt=s.eff_opts?.includes('parent_card');const parents=c.parentCardOpt?this.b.csMap[s.parent.id]?.parent_cards:undefined,step=parents?.length&&s.cs_value_category===3&&s.cs_operation_rule===1?Math.max(1,this.db.number(r,'eff_count_value')+(s.r_spark_count_value??0)):1;
      const used=[],actions=[];let finalCount=0;
      for(let index=0;index<=1000;index++){c.index=index;c.parentCard=parents?.length?parents[Math.min(floorGame(index/step),parents.length-1)]:undefined;c.passiveCard=c.parentCard??cardId;
        if(c.destroyCount===0&&destroyPassives.length&&a.targets.some(id=>{const t=this.e.getUnit(id);return this.call('isFieldMonster',t)&&t.ego_breaked;}))c.destroyCount=destroyPassives.reduce((n,p)=>n+this.call('calcValue',p.skill_id),0);
        this.w.termPassiveImmediatlyList=[];c.action={action_units:[]};c.crit=false;const noCrit=c.attrs.includes('DMG_ATTR_NO_STAT_CRI')||source.id===this.b.char.id&&a.targets.length===1&&a.targets[0]===this.b.char.id;
        if(!noCrit){if(isPre||this.w.isPreview){const forced=this.query('CRITICAL_ALWAYS',source.id,false,c.extra).concat(this.query('CRITICAL_ALWAYS',c.passiveCard,true,{is_pre:isPre})).filter(p=>this.simpleCheck(p,{...c,cardId:c.passiveCard}));if(forced.length){c.crit=true;this.call('checkTermValuePassive',forced[0].skill_id,s.caster_id,true,isPre);}}
          else c.crit=this.critical.rollActiveCritical({skill_id:s.skill_id,card_id:cardId,parent_card_id:c.parentCard,is_pre:false,targets:a.targets,dmg_attr:c.attrs,color_type:c.color,coop_char:a.coop_char,ignore_cs_list:c.ignore});}
        c.skip=this.query('SKIP_TERM_CHECK',source.id,false,c.extra).filter(p=>this.skipTerms(p,c));
        if(this.w.isPreview&&a.targets.length===0&&index===0){let total=this.call('calcCountValue',s.skill_id,undefined,a.preview_args)+a.count_value_additional+c.destroyCount;if(this.b.cardMap[cardId]?.talents?.includes(58))total=Math.min(total,1);total=this.fixedCount(c,total,undefined).total;s.final_count_value=total;break;}
        c.usedByTarget=[];let hit=false;for(let i=0;i<a.targets.length;i++)if(this.hit(c,a.targets[i],i))hit=true;
        if(a.targets.length>1){let common=c.usedByTarget[0]??[];for(const next of c.usedByTarget.slice(1))common=common.filter(id=>!used.includes(id)&&next.some(other=>{const x=this.b.skillMap[id],y=this.b.skillMap[other];return x.skill_id==y.skill_id||x.res_id==y.res_id&&(x.termValue??0)==(y.termValue??0);}));used.push(...common);}else if(a.targets.length===1)used.push(...c.usedByTarget[0].filter(id=>!used.includes(id)));
        if(!hit){finalCount=index;s.final_count_value=index;const card=this.b.cardMap[cardId];if(card)card.applied_atk_count=index;if(this.b.current_card_use_action)this.b.current_card_use_action.max_hit=Math.max(this.b.current_card_use_action.max_hit??0,index);if(!isPre&&!a.ignoreCond)this.call('procUnitEvent','CONDITION_CHAR_ATK_COUNT',[charId,cardId,0,a.targets[0]??-1,index,c.attrs]);break;}
        actions.push(c.action);if(!isPre&&!a.ignoreCond&&c.logType===1)this.call('procUnitEvent','CONDITION_CHAR_ALL_ATK',[charId,cardId]);if(index===1000)throw new MissingBattleRule('damageCalculation.loop_budget');
      }
      if(!Array.isArray(this.w.triggeredList?.dmg_valueadd))throw new MissingBattleRule('damageCalculation.triggeredList');this.w.triggeredList.dmg_valueadd.push(...used);
      if(r.value_save_renewal_flag==='YES'){this.call('saveValue',s.parent.type.toLowerCase(),s.parent.id,c.totals.damage);this.call('saveCoeffValue',s.parent.type.toLowerCase(),s.parent.id,c.totals.coeff);}s.leech_shield=undefined;s.leech_hp=undefined;
      if(isPre)return actions.flatMap(x=>x.action_units);
      const auto=c.attrs.includes('DMG_ATTR_AUTO')||a.autoClient;if(actions.length)this.e.pushAction(auto?{id:this.b.last_action_id++,type:'action_damage_auto',source_id:charId,action_list:actions,card_id:cardId}:{id:this.b.last_action_id++,type:'action_damage',source_id:charId,action_list:actions,card_id:cardId,byCard:cardId>0});
      for(const id of a.targets)if(this.e.getUnit(id).refresh_noti)this.call('refreshMonsterNoti');for(const action of actions)for(const [id,info]of action.action_units)if(info.damage&&info.type)this.e.getUnit(id).lastDamageEvent=info;for(const id of c.ranTargets)if(!a.targets.includes(id))a.targets.push(id);
      const logged=actions.map(action=>({action_units:action.action_units.filter(x=>!x[1]?.no_log)})).filter(x=>x.action_units.length);if(logged.length)this.call('addDetailLog',{type:'log_skill_eff_dmg',params:[logged,a.targets,finalCount,0,c.logType,a.coop_char],param_types:[]});if(!auto&&actions.length&&monsterSource)this.call('procDamageStressAction',actions,charId);
    }finally{this.b.cur_card_dmg_targets=before;if(batch)this.call('endMonsterHitBatch');if(!isPre)this.call('endImmediatePassiveCSLogScope');}
  }
}
