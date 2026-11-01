// Independent hand port of BattleProc.procUseCardRepeat 0xa9600 and all 26
// nested bytecode bodies (5,193 instructions). Recovered JavaScript is evidence
// only and is never evaluated. See evidence/player-repeat-use/REPORT.md.
import {MissingBattleRule} from './resource-store.mjs';
import {TALENTS as T} from './card-talent-support.mjs';

export const PLAYER_REPEAT_USE_BINDINGS={procUseCardRepeat:'procUseCardRepeat'};
const P={NONE:0,HAND:2,DISCARD:3,EXHAUST:4,USING:7,USED:11};
const deadTargets=new Set(['death','run','target_unable','changed','half_death','keep_half_death']);
const damageKinds=new Set(['SKILL_EFF_DMG','SKILL_EFF_DMG_COOP','SKILL_EFF_DMG_IGNORE_COND','SKILL_EFF_DMG_EXCEPT_NOTI']);
const additionalExcluded=new Set(['SORT_SUPPORT','SORT_COLLAPSE_SKILL','SORT_COLLAPSE','SORT_BREAK_IN']);

export class PlayerRepeatUseRuntime {
 constructor(e){this.e=e;this.b=e.b;this.w=e.wt;this.db=e.db;this.L=e.enums.LogicState;}
 call(n,...args){return this.e.call(n,...args);}
 get stage(){const stage=(this.w.battle_stage_worktable??this.e.state.worktables?.BattleStageWorktable)?.battle_stage;if(!stage)throw new MissingBattleRule('input.BattleStageWorktable.playerRepeat');return stage;}
 action(type,fields){const action={id:this.b.last_action_id++,type,...fields};return this.e.pushAction(action);}
 log(type,params,param_types){return this.call('addDetailLog',{type,params,param_types});}
 // GameResDB.toArrayNumber0x17800 has no trim, falsy default, or NaN gate.
 numbers(value){const parts=value.replace(/[\[\]]/gi,'').split(',');return parts.length===1&&parts[0]===''?[]:parts.map(Number);}
 timing(state,event){return this.call('setStateMain',{state:this.L[state],proc:false,event,interrupt:false});}

 // 0xaed00 plus 0xafa00/0xb0300: an empty priority intersection falls back
 // to the original candidates; resource ordering is intentionally retained.
 getPrioritySelectedTargetSkillID(skillIds){
  for(const id of skillIds){const skill=this.b.skillMap[id];if(!skill)continue;
   const row=this.db.table('skill_eff')[skill.res_id];if(!row||row.target_unit_type!=='TARGET_UNIT_SELECTED')continue;
   const opts=skill.target_unit_type_opt??this.db.array(row.target_unit_type_opt);
   if(opts.includes('priority'))return id;
  }
 }
 getPriorityAdjustedMonsterIDs(baseTargetIds,skillIds){
  const id=this.getPrioritySelectedTargetSkillID(skillIds);if(id==null)return baseTargetIds;
  const adjusted=this.call('getTargetableMonstersID',{skill_id:id}).filter(id=>baseTargetIds.includes(id));
  return adjusted.length>0?adjusted:baseTargetIds;
 }
 // 0xb0b00: preview deliberately does not select even a single candidate.
 getAutoRandomTargetID(cardId,skillIds){
  if(this.w.isPreview)return;
  const ids=this.getPriorityAdjustedMonsterIDs(this.call('getTargetableMonsterPassiveFilteredIDs',cardId),skillIds);
  if(ids.length===0)return;return this.e.random.randomArrayMember(0,ids);
 }
 // 0xb1300/0xb1c00. Context belongs to one invocation, including instant
 // subcards. The primary card's persisted pair prevents double consumption
 // of REMOVE/EXHAUST counters after before_throw selection resumes.
 getDestinationForUse(cardId,context){
  const {card,useInfo,destinationCache,removeFlagCache}=context,cached=destinationCache.get(cardId);if(cached)return cached;
  const c=this.b.cardMap[cardId];if(!c)return [P.NONE,P.NONE];
  let removing=c.talents?.includes(T.TALENT_REMOVE)??false;
  const primary=c.id==card.id;let destination=primary?c.place_after_using:undefined;
  if(destination==null){
   if(removing&&c.remove_count>0){this.call('setRemoveCount',c.id,c.remove_count-1);removing=false;}
   destination=this.call('getCardDestination',c.id,removing,useInfo);
  }else if(removing&&destination[0]!==P.NONE)removing=false;
  destinationCache.set(c.id,destination);removeFlagCache.set(c.id,removing);
  if(primary)c.place_after_using=destination;return destination;
 }
 getDestinationForAction(cardId,context){
  if(context.useInfo.procUse)return this.getDestinationForUse(cardId,context);
  const cached=context.destinationCache.get(cardId);if(cached)return cached;
  const result=[P.NONE,P.NONE];context.destinationCache.set(cardId,result);context.removeFlagCache.set(cardId,false);return result;
 }
 pushRemoveStageLog(card){
  const cardInfo={available:card.available!==false,char_id:card.char_id,id:card.id,res_id:card.res_id,r_spark:card.r_spark};
  this.b.removed_cards.push(card.id);this.b.stage_actions.push({type:'remove',id:card.id,cardInfo});
 }
 pushRemoveAction(card){this.action('action_card_remove',{card_id:card.id,source_id:this.b.char.id});}
 checkLiveAvailable(id){this.call('checkBan',id);return this.call('isCardAvailable',id,{by_skill_eff:true});}

 // 0xaa400. This is the repeat/automatic-use charging algorithm, separate
 // from procUseCard's closure. In particular, free X writes cost-used zero.
 procRepeatCost(card,useInfo,cost,cardRes){
  const b=this.b;card.tuned=card.is_tuning_card?card.cost_result==b.energy:undefined;b.energy_before_card_use=b.energy;
  if(useInfo.procCost){
   b.cost_deficit=cost>=0&&cost>b.energy?cost-b.energy:undefined;
   let costUsed=cost,energyUsed=0;
   if(cost>0&&!b.cost_cheat){
    const actual=this.call('procRitaUniqueCostDeduction',card.id,cost,{deduct:true});card.rita_value=actual;
    this.call('addEnergy',-actual,false,0);energyUsed=actual;
    this.call('addEPwithCheckPassive',this.call('constantMetagame',b.battle_step_mode?'tp_simulation_gen_ap_use':'tp_gen_ap_use')*actual);
   }else if(cost==-1){
    costUsed=b.energy;energyUsed=b.energy;card.rita_value=energyUsed;this.call('addEnergy',0,true,0);
    this.call('addEPwithCheckPassive',this.call('constantMetagame',b.battle_step_mode?'tp_simulation_gen_ap_use':'tp_gen_ap_use')*energyUsed);
   }else card.rita_value=0;
   this.call('setCardCostUsed',useInfo.card_id,costUsed);
   this.call('procUnitEvent','CONDITION_CHAR_USE_ENERGY',[card.char_id,energyUsed,cardRes.card_category]);
   this.call('procCardEvent','CONDITION_USE_ENERGY_AMOUNT_SET',P.NONE,-1,{energy:energyUsed});
  }else{
   card.rita_value=cost==-1?0:card.cost_before_using??0;if(cost==-1)this.call('setCardCostUsed',useInfo.card_id,0);
  }
 }
 costContext(card,useInfo){
  const previous=card.cost_result;let cost=this.call('getCost',card.id,true);if(cost==-2)cost=0;
  const displayCost=useInfo.procCost?cost:previous??cost;
  card.cost_before_using=displayCost==-1?this.b.energy:displayCost<0?0:displayCost;
  card.ego_field_dmg_increased=undefined;return cost;
 }
 // 0xb6300 and 0xb6800..0xb8b00. Preserve the original checkEgo polarity
 // and the non-short-circuit filter queries, whose passive checks may draw.
 additionalCount(card,cardRes,passives){
  let repeat=0;
  for(const passive of passives){
   if(additionalExcluded.has(cardRes.sort))continue;
   const row=this.db.get('skill_eff',passive.res_id),csIds=this.db.array(row.target_unit_type_opt_link_cs_id)
    .map(id=>this.stage.break_cs_changes?.[id]??id);
   if(csIds.length&&!this.call('checkCSopts',csIds,this.call('getUnitByID',this.b.select_target,'procUseCard:targetUnitTypeOpt')))continue;
   let matches=true;const categories=this.db.array(row.target_card_set_card_type);
   if(categories.length&&!this.call('checkCategory',card.id,categories))matches=false;
   const egos=this.db.array(row.target_card_set_ego_type).map(ego=>this.call('convertEgoCommon',ego));
   if(egos.length&&this.call('checkEgo',card.id,egos))matches=false;
   const talents=this.db.array(row.target_card_set_talent);
   if(talents.length){const invert=talents.includes('not'),values=talents.filter(x=>x!=='not').map(x=>T[x]);
    if(invert?values.some(t=>this.call('hasTalent',card.id,t)):values.some(t=>!this.call('hasTalent',card.id,t)))matches=false;
   }
   const filter=this.call('parseCardCostFilter',row.target_card_set_opt_cost,'target_card_set_opt_cost_at:'+row.id);
   if(filter&&!this.call('applyCardCostFilter',filter,card.id))matches=false;
   if(matches){repeat+=this.call('calcValue',passive.skill_id);this.call('checkTermValuePassive',passive.skill_id,this.b.char.id);}
  }
  return repeat;
 }
 queueAdditional(card,cardRes){
  const passives=this.call('getPassiveByType',{source_id:this.b.char.id,type:'SKILL_EFF_CARD_USE_ADDITIONAL',is_card:false,char_id:card.char_id})
   .concat(this.call('getPassiveByType',{source_id:card.id,type:'SKILL_EFF_CARD_USE_ADDITIONAL',is_card:true}));
  if(!passives.length)return;let repeat=this.additionalCount(card,cardRes,passives),n=0;
  while(repeat>0){if(++n>20000)throw new MissingBattleRule('playerRepeat.additional_budget');--repeat;
   this.call('pushCardRepeat',{card_id:card.id,target:this.b.select_target,procUse:false,procCost:false,preserve_target:true});
  }
 }
 retarget(card,cardRes,skills,useInfo,instant=false){
  if(cardRes.target_for_ui==='TARGET_SELECTED_MONSTER_AUTO_RANDOM'&&!useInfo.preserve_target){this.b.select_target=this.getAutoRandomTargetID(card.id,skills)??-1;return;}
  let pick=false;
  if(useInfo.target>0)pick=deadTargets.has(this.call('getUnitByID',useInfo.target,(instant?'procUseCardRepeat:instant:':'procUseCardRepeat:')+card.res_id).state);
  else pick=this.call('getTargetTypeByTargetForUI',cardRes.target_for_ui)==='TARGET_MONSTER';
  if(!pick)return;
  const base=instant?this.call('getTargetableMonstersID'):this.call('getTargetableMonsterPassiveFilteredIDs',card.id),ids=this.getPriorityAdjustedMonsterIDs(base,skills);
  // Native tests length==0 after the enclosing length>0. Do not substitute
  // length==1 to make preview choose a deterministic singleton.
  if(ids.length>0&&(!this.w.isPreview||ids.length==0))this.b.select_target=this.e.random.randomArrayMember(0,ids);
 }
 skills(card,ids,useInfo,event,motion){return this.call('procSkillEffs',ids,{byCard:true,event,card_id:card.id,motion_index:motion,procUse:!useInfo.ignoreCond,procTriggered:false,skip_not_break_additional:useInfo.by_not_break_additional});}
 immediateEvent(card,useInfo){if(!useInfo.ignoreCond)this.call('procCardEvent','CONDITION_CARD_USE_IMMEDIATE',card.place_before_using,card.id,{value:card.cost_before_using});}
 changedMotion(skills,action){const id=skills.find(id=>this.b.skillMap[id]?.target_changed_motion);if(id)action.command=this.b.skillMap[id]?.target_changed_motion;}
 additionalSkills(card){
  if(card.r_spark_skill_eff_ids!=null)this.call('procSkillEffs',this.call('getActiveSparkSkills',card.id),{byCard:true,card_id:card.id,skip_not_break_additional:true});
  if(card.eidolon_skill_eff_ids!=null)this.call('procSkillEffs',this.call('getActiveEidolonSkills',card.id),{byCard:true,card_id:card.id,skip_not_break_additional:true});
 }
 moveUsedLast(card,to,useInfo){if(useInfo.procUse&&to===P.USED){const index=this.b.used_cards.indexOf(card.id);if(index>=0)this.b.used_cards.splice(index,1);this.b.used_cards.push(card.id);}}
 finish(card,to,useInfo,event,skipUseEvent=false){return this.call('procCardFinish',card.id,to,useInfo.procUse??false,useInfo.exhaust,useInfo.ignoreCond,event,skipUseEvent);}
 rememberTargets(skills,targets){
  let previousDamage=false,previousLength=0;
  skills.forEach((id,index)=>{if(targets[index].length===0)return;const monsters=targets[index].filter(id=>this.call('isMonsterByID',id)),damage=damageKinds.has(this.db.get('skill_eff',this.b.skillMap[id].res_id).eff);
   if(damage&&!previousDamage||(damage&&previousDamage||!damage&&!previousDamage)&&monsters.length>=previousLength){
    previousDamage=damage;previousLength=monsters.length;this.b.before_used_card_targets=monsters;
   }
  });
 }
 procUseCardRepeat(useInfo,resumed=false){
  const b=this.b,w=this.w;this.call('checkGameEnd');
  const fatal=this.stage.assault_hardcore&&this.stage.fatal_end;
  if(useInfo.by_testament&&(b.game_end||fatal||b.battle_step_mode?.next_wave)){
   const c=b.cardMap[useInfo.card_id];if(c?.testament_pending)c.testament_pending=undefined;
  }
  if(b.game_end||fatal||b.battle_step_mode?.next_wave)return;
  if(useInfo.copyInfo){const copy=useInfo.copyInfo;this.call('copyCards',copy.card_ids,copy.to,copy.count,-1);return;}
  let card=b.cardMap[useInfo.card_id];if(!card)throw this.call('contentError','err:card_not_exist_at_procUseCardRepeat:'+useInfo.card_id);
  if(!w.isPreview){b.cardUseKilled??={};b.cardUseKilled[useInfo.card_id]=0;}
  if(card.testament_pending)card.testament_pending=undefined;
  card.by_testament=useInfo.by_testament?true:undefined;card.by_card_use_reuse=useInfo.by_card_use_reuse?true:undefined;
  if(useInfo.by_testament)this.call('setSubHardFinished');
  const originalPlace=resumed?card.place_before_using??card.card_place:card.card_place;
  if(useInfo.procUse&&card.card_place===P.NONE)return;
  if(!resumed&&useInfo.targetCardPlace!=null&&card.card_place!=useInfo.targetCardPlace)return;
  if(!resumed){
   const ids=useInfo.card_ids?.length>0?useInfo.card_ids:[useInfo.card_id];
   if(ids.some(id=>this.call('isCardUninteractible',id))){this.action('action_toast',{source_id:-1,msg:'ui_notice_use_unplayable_card'});return;}
   const unavailable=useInfo.usable!=false&&useInfo.force_usable===false&&!ids.every(id=>this.checkLiveAvailable(id));
   if(card.talents?.includes(T.TALENT_VALLISTA)){if(useInfo.procUse)useInfo.exhaust=true;}
   else if(useInfo.usable==false||unavailable){
    this.action('action_toast',{source_id:-1,msg:'ui_notice_use_unplayable_card'});
    if(card.card_place===P.USED)return;
    this.call('moveCards',{card_ids:[useInfo.card_id],from:card.card_place,to:P.DISCARD});return;
   }
  }
  if((useInfo.log==null||useInfo.log==true)&&!resumed){
   if(useInfo.repeat)this.log('log_skill_eff_card_use_additional',[card.id],['card_id']);
   else if(card.card_place!==P.USING)this.log('log_skill_eff_card_use',[card.card_place,card.id],['card_from_wo_hand','card_id']);
  }
  const cardRes=this.db.get('card',card.res_id),skills=this.call('getSkills',card.id),initialPlace=card.card_place,
   context={card,useInfo,destinationCache:new Map(),removeFlagCache:new Map()};
  let destination=P.NONE,removing=false;
  if(useInfo.procUse){destination=this.getDestinationForUse(card.id,context)[0];removing=context.removeFlagCache.get(card.id)??false;}
  const cost=this.costContext(card,useInfo),beforeThrow=this.numbers(cardRes.before_throw_index,'before_throw_index_at:'+card.res_id);
  if(beforeThrow.length>0){
   if(!resumed&&w.isPreview==0){
    let useAction=-1,exhibitAction=-1;const place=card.card_place;
    if(useInfo.procUse){
     this.call('moveCard',card.id,card.card_place,P.USING);
     if(!useInfo.reserveInfo)exhibitAction=this.action('action_card_exhibit',{source_id:card.id,card_from:place,card_to:destination,value:0.5,play:true});
     useAction=this.action('action_card_use',{source_id:card.char_id,action_card:{cards:[card.id],place_from:card.card_place,place_to:destination,enemy_turn:b.enemy_turn},card_id:card.id,by_testament:useInfo.by_testament?true:undefined});
    }
    beforeThrow.forEach(index=>this.call('procSkillEff',skills[index],{byCard:true}));this.procRepeatCost(card,useInfo,cost,cardRes);
    if(this.call('procInterrupt')){b.current_use_info=useInfo;return [];}
    if(useAction!==-1)this.call('removeActionByID',useAction);if(exhibitAction!==-1)this.call('removeActionByID',exhibitAction);
   }
   for(let index=beforeThrow.length-1;index>=0;index--)skills.splice(beforeThrow[index],1);
  }else this.procRepeatCost(card,useInfo,cost,cardRes);
  card.place_after_using=undefined;this.call('setCurrentCard',card.id);this.timing('TIMING_USE_CARD_BEFORE',false);
  if(removing)this.pushRemoveAction(card);b.select_target=useInfo.target;this.retarget(card,cardRes,skills,useInfo);
  const instant=useInfo.instant&&useInfo.card_ids&&useInfo.card_ids.length>0;
  if(useInfo.procUse){
   if(instant){
    for(const id of useInfo.card_ids)if(!context.destinationCache.has(id))this.getDestinationForUse(id,context);
    for(const id of useInfo.card_ids){const c=b.cardMap[id];if(!c||c.card_place===P.NONE)continue;
     b.stage_actions.push({type:'mission_card_use',id:c.id,cardInfo:c});const place=c.card_place,to=context.destinationCache.get(id)[0];
     if(id!=card.id&&(context.removeFlagCache.get(id)??false))this.pushRemoveAction(c);
     this.call('moveCard',id,place,P.USING,to,undefined,(c.collapse_count??0)+1>=(c.collapse_need_count??0));
    }
   }else{
    b.stage_actions.push({type:'mission_card_use',id:card.id,cardInfo:card});
    if(!resumed)this.call('moveCard',useInfo.card_id,initialPlace,P.USING,destination,undefined,(card.collapse_count??0)+1>=(card.collapse_need_count??0));
   }
  }
  this.timing('TIMING_USE_CARD_AFTER',true);
  const action={id:b.last_action_id++,type:'action_player_card_use',source_id:card.char_id,card_id:card.id,
   play:useInfo.reserveInfo?false:useInfo.procUse&&!resumed,skip_action:useInfo.skip_exhibit,card_to:destination,
   card_from:useInfo.instant?card.place_before_using??originalPlace:originalPlace,command:cardRes.motion_type,
   by_testament:useInfo.by_testament?true:undefined,by_opening:useInfo.by_opening?true:undefined,by_vallista:useInfo.by_vallista?true:undefined};
  const bans=this.call('getPassiveByType',{source_id:card.id,type:'SKILL_EFF_BAN_EFFECT',is_card:true});if(bans.length>0)action.use_only=true;
  if(action.play&&!action.skip_action&&!action.by_testament&&!action.by_vallista&&w.isPreview==0)action.card_use_display={[card.id]:{card_id:card.id,cost:card.cost_before_using}};
  const previousAction=b.current_card_use_action;b.current_card_use_action=action;
  if(b.usedCardMap[card.res_id]!=null)b.usedCardMap[card.res_id]=true;
  if(instant){
   action.instant_card_ids=useInfo.card_ids;action.instant_card_tos=[];action.instant_card_froms=[];
   for(const id of useInfo.card_ids){const c=b.cardMap[id];if(c){action.instant_card_tos.push(this.getDestinationForAction(id,context)[0]);action.instant_card_froms.push(c.place_before_using??originalPlace);}
    else{action.instant_card_tos.push(P.USED);action.instant_card_froms.push(P.NONE);}}
  }
  this.e.pushAction(action);if(useInfo.procUse)this.queueAdditional(card,cardRes);
  const event=this.db.number(cardRes,'card_use_event_timing'),motion=this.db.number(cardRes,'motion_start_timing');
  this.immediateEvent(card,useInfo);const targets=this.skills(card,skills,useInfo,event,motion);this.changedMotion(skills,action);
  if(card.nihilum_meta_motion==='nihilum_meta_execution_attack')this.call('pushSubBattleLog',{type:'log_nihilum_meta',logs:[],params:[card.nihilum_stack_inc],major_first:true,is_fin:true},true);
  if(instant){this.moveUsedLast(card,destination,useInfo);this.additionalSkills(card);this.finish(card,destination,useInfo,event);}
  if(instant&&useInfo.card_ids.length>1){
   for(let index=1;index<useInfo.card_ids.length;index++){
    const id=useInfo.card_ids[index],c=b.cardMap[id];if(!c||c.card_place===P.NONE)continue;
    const row=this.db.get('card',c.res_id),ids=this.call('getSkills',id);this.costContext(c,useInfo);
    const from=c.place_before_using??c.card_place,to=this.getDestinationForAction(id,context);
    if(from!==P.USING)this.log('log_skill_eff_card_use',[from,c.id],['card_from_wo_hand','card_id']);
    this.retarget(c,row,ids,useInfo,true);this.moveUsedLast(c,to[0],useInfo);
    const nextAction={id:b.last_action_id++,type:'action_player_card_use',source_id:c.char_id,card_id:id,play:false,command:row.motion_type,card_to:to[0],card_from:from};
    if(this.call('getPassiveByType',{source_id:c.id,type:'SKILL_EFF_BAN_EFFECT',is_card:true}).length>0)nextAction.use_only=true;
    this.e.pushAction(nextAction);if(action.card_use_display)action.card_use_display[c.id]={card_id:c.id,cost:c.cost_before_using};
    const nextEvent=this.db.number(row,'card_use_event_timing'),nextMotion=this.db.number(row,'motion_start_timing');
    this.immediateEvent(c,useInfo);const nextTargets=this.skills(c,ids,useInfo,nextEvent,nextMotion);this.changedMotion(ids,nextAction);nextAction.card_use_targets=nextTargets;
    this.additionalSkills(c);this.finish(c,to[0],useInfo,nextEvent);
    if(context.removeFlagCache.get(id)??false)this.pushRemoveStageLog(c);
   }
  }
  if(useInfo.procUse&&!useInfo.fromCoop)this.rememberTargets(skills,targets);
  this.call('procSkillTriggered',true,true);if(card.nihilum_meta_motion)action.command=card.nihilum_meta_motion;action.card_use_targets=targets;b.current_card_use_action=previousAction;
  const block=b.action_blocks[b.action_blocks.length-1];
  if(block.prev==null&&block.actions.filter(x=>x.type!=='action_player_card_use'&&x.type!=='action_motion_start').length===0)action.use_only=true;
  this.call('checkDeads',{proc_skill:true,proc_event:true,proc_interrupt:false});this.timing('TIMING_SKILL_EFF_AFTER',false);this.call('procSkillTriggered',true,true);
  if(useInfo.procUse){
   if(!b.deck_info.using.includes(card.id)){const changed=b.cardMap[b.deck_info.using[0]];if(changed)card=changed;}
   if(!useInfo.instant)this.moveUsedLast(card,destination,useInfo);
   if(bans.length===0&&card.talents?.includes(T.TALENT_TERMINATION))this.call('checkTermination');
  }
  if(removing)this.pushRemoveStageLog(card);
  if(useInfo.reserveInfo)useInfo.reserveInfo.reserveAction.card_tos[useInfo.reserveInfo.index]=destination;
  if(this.call('procInterrupt')){this.call('suspendCurrentCardForInterrupt',card.id,useInfo.procUse?destination:undefined,false);return true;}
  if(!useInfo.instant)this.additionalSkills(card);
  if(!useInfo.instant&&this.call('procInterrupt')){this.call('suspendCurrentCardForInterrupt',card.id,useInfo.procUse?destination:undefined,true);return true;}
  this.call('checkTermValue',card.id,'TERM_CARD_USE_WHOLE',b.char.id,true,{isWhole:true});
  this.call('checkTermValue',b.char.id,'TERM_ANY_CARD_USE',b.char.id,false);
  b.monsters.forEach(monster=>{if(this.call('isFieldMonster',monster))this.call('checkTermValue',monster.id,'TERM_ANY_CARD_USE',monster.id,false);});
  if(card.char_id!==-1)this.call('checkTermValue',card.char_id,'TERM_ANY_OWN_CARD_USE',b.char.id,false);
  if(!useInfo.instant&&!useInfo.ignoreCond&&event===-1)this.call('procCardUseEvent',card.id);
  this.timing('TIMING_USE_CARD_FINISH',false);this.call('removeSavedAll','card',card.id);this.call('getCost',card.id,false,useInfo.procCost);this.call('applyChangeCS');
  if(!useInfo.instant)this.finish(card,destination,useInfo,event,true);
  if(card.by_testament){card.by_testament=undefined;card.testament_bullet_snapshot=undefined;}return false;
 }
}
