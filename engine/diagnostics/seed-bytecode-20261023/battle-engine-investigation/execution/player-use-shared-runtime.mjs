// Hand port of the complete shared player-use families. See evidence/player-use-shared/.
// Native argument order is retained after removing the explicit worktable argument.
import {MissingBattleRule} from './resource-store.mjs';
import {TALENTS as T} from './card-talent-support.mjs';
export const PLAYER_USE_SHARED_BINDINGS=Object.fromEntries([
 'resolveCardDestination','getCardDestination','peekCardDestination','procCardFinish',
 'suspendCurrentCardForInterrupt','getSkills','setRemoveCount','setCardCostUsed',
 'increaseCollapseCount','checkTermination','checkCelestial','checkCardConnect',
 'setSubHardFinished','getCollapsePenaltySkill','removeLeads'
].map(n=>[n,n]));
export class PlayerUseSharedRuntime {
 constructor(e){this.e=e;this.w=e.wt;this.b=e.b;this.db=e.db;}
 call(n,...a){return this.e.call(n,...a);}
 get stage(){const s=this.w.battle_stage_worktable??this.e.state.worktables.BattleStageWorktable;if(!s?.battle_stage)throw new MissingBattleRule('playerUse.stageInput');return s.battle_stage;}
 action(type,fields){this.e.pushAction({id:this.b.last_action_id++,type,...fields});}
 error(message){throw this.call('ContentError',message);}
 // BattleProc.resolveCardDestination 0x7fb00 @13 is TestEqual, so values
 // loosely equal to false disable writes; undefined and null enable them.
 resolveCardDestination(id,removeFlag,useInfo,mutateArg){
  const mutate=!(mutateArg==false),c=this.b.cardMap[id];
  if(c==null){const dirty=this.w.uctx?.dirty??this.e.state.uctx?.dirty??this.e.state.runtimeInputs?.battleSaveDirty;if(!dirty)throw new MissingBattleRule('playerUse.battleSaveDirty');dirty.battle_save=true;this.error('err:card_not_exist:'+id);}
  const has=t=>c.talents?.includes(t),row=()=>this.db.get('card',c.res_id),term=(p,ignore)=>this.call('checkTermValuePassive',p.skill_id,this.b.char.id,...(ignore===undefined?[]:[ignore]));
  if(useInfo?.by_testament){
   if(has(T.TALENT_EXHAUST)){if(c.exhaust_count>0){if(mutate)--c.exhaust_count;}else{if(mutate)c.exhausted=true;return [4,4];}}
   return row().card_category=='CARD_POWER'?[0,0]:[11,11];
  }
  let to=11;
  const ban=this.call('getPassiveByType',{source_id:c.id,type:'SKILL_EFF_BAN_EFFECT',is_card:true});
  if(has(T.TALENT_MOVE_TO_DISCARD)||ban.length>0)to=3;
  const baseline=to;
  if(useInfo?.exhaust)to=4;
  if((useInfo==null||(useInfo.procUse&&!useInfo.exhaust))&&row().sort!='SORT_COLLAPSE_SKILL'&&row().sort!='SORT_SUPPORT'){
   const ps=this.call('getPassiveByType',{source_id:this.b.char.id,type:'SKILL_EFF_CARD_RETURN',is_card:false});
   for(const p of ps){const r=this.db.get('skill_eff',p.res_id),types=this.db.array(r.target_card_set_card_type);if(!types.length||this.call('checkCategory',c.id,types)){to=this.call('cardPlace',r.eff_card_place);if(mutate)term(p);break;}}
  }
  const exhaust=this.call('getPassiveByType',{source_id:c.id,type:'SKILL_EFF_CARD_TALENT',is_card:true,talent:T.TALENT_EXHAUST});
  if(!ban.length){
   if(row().card_category=='CARD_POWER')to=0;
   else if(exhaust.length){if(mutate)term(exhaust[0]);to=4;if(mutate)c.exhausted=true;}
   else if(removeFlag)to=0;
   else if(has(T.TALENT_EXHAUST)){if(c.exhaust_count>0){if(mutate)--c.exhaust_count;}else{to=4;if(mutate)c.exhausted=true;}}
  }
  if(has(T.TALENT_UNPLAYABLE)){
   const ps=this.call('getPassiveByType',{source_id:this.b.char.id,type:'SKILL_EFF_IGNORE_TALENT_UNPLAYABLE',is_card:false});
   for(const p of ps){const r=this.db.get('skill_eff',p.res_id),types=this.db.array(r.target_card_set_card_type);if(!types.length||this.call('checkCategory',c.id,types)){to=this.call('cardPlace',r.eff_card_place);if(mutate)term(p);break;}}
  }
  if(to==4){
   const ps=this.call('getPassiveByType',{source_id:c.id,type:'SKILL_EFF_CARD_IGNORE_EXHAUST',is_card:true}).concat(this.call('getPassiveByType',{source_id:this.b.char.id,type:'SKILL_EFF_CARD_IGNORE_EXHAUST',is_card:false,char_id:c.char_id}));
   if(ps.length&&!useInfo?.exhaust){if(mutate)term(ps[0],true);to=baseline;if(mutate){for(const block of this.b.action_blocks)for(const a of block.actions)if(a.id==this.w.useAction)a.action_card.place_to=to;c.exhausted=false;}}
  }
  if(useInfo?.return_hand&&to==11)to=2;
  return [to,baseline];
 }
 getCardDestination(id,removeFlag,useInfo){return this.resolveCardDestination(id,removeFlag,useInfo,true);}
 peekCardDestination(id,removeFlag,useInfo){return this.resolveCardDestination(id,removeFlag,useInfo,false);}
 // BattleProc.procCardFinish 0xa8c00; fourth argument is unused by the carrier.
 procCardFinish(id,to,procUse,unusedExhaust,ignoreCond,eventTiming,skipUseEvent){
  const c=this.b.cardMap[id];if(!c)return;
  if(!skipUseEvent&&!ignoreCond&&(eventTiming??-1)==-1)this.call('procCardUseEvent',id);
  const resetBind=!c.eff_banned&&(c.bind_count??0)>0;
  if(resetBind){c.bind_count=0;this.action('action_card_bind',{source_id:-1,action_card_property:{card:id,bind_count:0}});}
  if(procUse){const actual=this.call('getUsingCardIDAfterChange',id),changed=this.b.cardMap[actual]??c;if(changed.card_place!=4){
   if(to==0){const at=this.b.deck_info.using.indexOf(actual);if(at>=0)this.b.deck_info.using.splice(at,1);this.call('procCardEvent','CONDITION_CARD_AMOUNT',changed.place_before_using,-1);this.call('procCardEvent','CONDITION_CARD_AMOUNT_SET',changed.place_before_using,-1);changed.card_place=0;}
   else if(to==4){this.call('moveCard',actual,7,4);this.call('procCardEvent','CONDITION_CARD_EXHAUST',2,actual);}
   else this.call('moveCard',actual,7,to);
  }}
  if(c.nihilum_meta_motion=='nihilum_meta_execution_attack')this.call('checkNihilumMetaStack',c);
  if(resetBind){this.call('procCardEvent','CONDITION_CARD_TALENT_BIND_STACK_AMOUNT',0,id);this.call('procCardEvent','CONDITION_CARD_TALENT_BIND_STACK_AMOUNT_SET',0,id);}
  this.call('resetIgniteCount',id);this.call('resetTiperaCount',id);
  if(this.b.cardUseScoreAccum)delete this.b.cardUseScoreAccum[id];
  if(!c.option_select_temp)this.b.before_activated_card=id;
 }
 suspendCurrentCardForInterrupt(id,to,additional){this.b.current_card_id=id;this.b.current_card_additional_skill_proced=additional;this.b.current_card_to=to;if(this.b.cardMap[id]?.card_place==4)this.b.current_card_to=undefined;}
 // BattleCardProc.getSkills 0x36900 + closure 0x37c00. The optional second
 // argument is initialized but never read again in this version: always ACTIVE.
 getSkills(id,unused=false){
  const c=this.b.cardMap[id],r=this.db.get('card',c.res_id),order=this.db.array(r.eff_pick_pool_order).map(Number),ratios=this.db.array(r.eff_pick_pool_ratio).map(Number),count=Math.max(1,r.eff_pick_pool_count)+(c.eff_pick_pool_count_add??0),skills=c.skill_eff_ids.slice();
  if(order.length){if(order.length!==ratios.length)this.error(`err:invalid_data_eff_pick_pool_order/ratio:order = ${JSON.stringify(order)}, ratio = ${JSON.stringify(ratios)}:at_${r.id}`);
   for(let i=0;i<count;i++){const selected=this.call('cardRelativeProbabilityIndex',ratios);if(isNaN(selected))this.error('err:invalid_group_ratio_skilleff:'+r.id);order.splice(selected,1);ratios.splice(selected,1);}
   for(let i=order.length-1;i>=0;i--)skills.splice(order[i],1);
  }
  return skills.filter(s=>this.db.get('skill_eff',this.b.skillMap[s].res_id).operation=='OPERATION_ACTIVE');
 }
 setRemoveCount(id,value){const c=this.b.cardMap[id];c.remove_count=value;const stage=this.stage.all.find(c=>c.id==id);if(stage)stage.remove_count=value;this.action('action_card_talent_count',{source_id:c.caster_id,action_card_property:{card:id,remove_count:value}});}
 setCardCostUsed(id,cost){
  const c=this.b.cardMap[id];if(c.cost<0){const ps=this.call('getPassiveByType',{source_id:this.b.char.id,type:'SKILL_EFF_X_COST_RUN_ADD',is_card:false,char_id:c.char_id}).concat(this.call('getPassiveByType',{source_id:id,type:'SKILL_EFF_X_COST_RUN_ADD',is_card:true}));
   cost+=ps.reduce((sum,p)=>{const v=this.call('calcValue',p.skill_id);this.call('checkTermValuePassive',p.skill_id,this.b.char.id);return sum+v;},0);
  }
  const set=s=>{if(cost==0)delete s.cost_used;else s.cost_used=cost;};
  this.call('getAllCardSkillEffIds',c).forEach(id=>{const s=this.b.skillMap[id];set(s);s.duringEffs?.forEach(child=>set(this.b.skillMap[child]));});
 }
 // StressProc.increaseCollapseCount 0x55c00: a finishing used card advances
 // only itself, otherwise all eligible same-character cards advance together.
 increaseCollapseCount(id){
  const c=this.b.cardMap[id];if(c.collapse_count==null||c.collapse_need_count==null)return;
  if(c.collapse_count!=null&&c.collapse_count+1>=(c.collapse_need_count??0)){c.collapse_count=Math.min(c.collapse_count+1,c.collapse_need_count);this.e.pushChangeData('card',c.id);return true;}
  const ids=this.b.deck_info.all.filter(id=>{const x=this.b.cardMap[id];return x.char_id==c.char_id&&x.collapse_count!=null&&x.collapse_need_count!=null&&x.collapse_count<x.collapse_need_count;});
  ids.forEach(id=>{const x=this.b.cardMap[id];++x.collapse_count;this.e.pushChangeData('card',x.id);const stage=this.stage.all.find(y=>y.id==x.id);if(stage){stage.collapse_count=x.collapse_count;this.action('action_stage_card_refresh',{source_id:-1,action_stage_cards:this.call('createClientCards',this.stage.all)});}});
 }
 checkTermination(){this.b.forced_turn_over=true;}
 checkCelestial(targets){this.call('sortHandCards');this.b.deck_info.hand.forEach(id=>{if(!targets.includes(id)||this.call('isCardUninteractible',id))return;if(this.b.cardMap[id].talents?.includes(T.TALENT_CELESTIAL))this.call('pushCardCoop',{card_id:id,target:this.b.select_target,procUse:true,procCost:false,by_celestial:true});});}
 checkCardConnect(c){
  if(!this.call('isCardConnected',c.id))return;const discarded=[];
  this.b.deck_info.hand.slice().forEach(id=>{if(!this.call('isCardConnected',id))return;if(this.b.cardUses?.some(u=>u.card_id==id||u.card_ids?.includes(id)))return;if(this.b.cardCoops?.some(u=>u.card_id==id))return;if(this.b.cardRepeats?.some(u=>u.card_id==id))return;discarded.push(id);});
  if(!discarded.length)return;this.w.connect_move_info={source_card_id:c.id,discard_card_ids:discarded};this.call('moveCards',{card_ids:discarded,from:2,to:3,by_connect:true});this.w.connect_move_info=undefined;
 }
 setSubHardFinished(){const sub=this.call('getLastMeaningfulSub');if(sub)sub.is_hard_fin=true;}
 getCollapsePenaltySkill(){const inputs=this.e.state.runtimeInputs;if(!inputs||!Object.hasOwn(inputs,'collapsePenaltySkill'))throw new MissingBattleRule('playerUse.collapsePenaltySkillInput');return inputs.collapsePenaltySkill;}
 removeLeads(except){return this.e.actions.removeLeads(except);}
}
