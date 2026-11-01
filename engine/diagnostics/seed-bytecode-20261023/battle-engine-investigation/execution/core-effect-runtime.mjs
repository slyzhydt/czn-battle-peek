// Source-derived non-card effect jump families. See evidence/active-effects/.
// EffectRuntime owns the common prelude/finalizer; explicit early returns
// preserve native control flow instead of fabricating an empty effect.
import {MissingBattleRule} from './resource-store.mjs';
import {roundGame,floorGame} from '../effects/effect-arithmetic.mjs';
export const CORE_EFFECT_NAMES=new Set(['NONE','ENERGY_CHANGE','ENERGY_FORCE_CHANGE','TACTIC_GAUGE_ADD','VALUE_CHANGE','COUNT_VALUE_CHANGE','MAX_HP','MAX_HP_DECREASE','STAGE_PARAM_CHANGE','CURRENCY_ADD','SCORE_ADD','NAME_CHANGE','BG_SAVE','PRESET_PLAY','TUTORIAL','TUTORIAL_ACCOUNT_SKILL','STORY_PLAY','VIDEO_PLAY','SUPPORTER_VIEW_RETURN','BATTLE_TOAST','BALLOON_JUDAS','BALLOON','BALLOON_AFTER','TUTORIAL_30039_NPC'].map(x=>'SKILL_EFF_'+x));
export class CoreEffectRuntime {
 constructor(e){this.e=e;this.b=e.b;this.w=e.wt;this.db=e.db;}
 call(n,...a){return this.e.call(n,...a);}
 log(type,params,param_types){this.call('addDetailLog',{type,params,param_types});}
 action(type,fields){this.e.pushAction({id:this.b.last_action_id++,type,...fields});}
 value(id,target){return this.call('calcValue',id,target);}
 get stage(){const stage=(this.w.battle_stage_worktable??this.e.state.worktables.BattleStageWorktable)?.battle_stage;if(!stage)throw new MissingBattleRule('BattleStageWorktable.battle_stage');return stage;}
 dispatch(id,c){const s=this.b.skillMap[id],r=this.db.get('skill_eff',s.res_id),targets=c.targets;
  switch(r.eff){
   case 'SKILL_EFF_NONE':return {returnEarly:true,value:undefined}; // @20894
   case 'SKILL_EFF_ENERGY_CHANGE':case 'SKILL_EFF_ENERGY_FORCE_CHANGE':this.energy(id,targets);break;
   case 'SKILL_EFF_TACTIC_GAUGE_ADD':this.ep(id);break;
   case 'SKILL_EFF_VALUE_CHANGE':case 'SKILL_EFF_COUNT_VALUE_CHANGE':this.changeValues(id,targets,r.eff==='SKILL_EFF_COUNT_VALUE_CHANGE');break;
   case 'SKILL_EFF_MAX_HP':case 'SKILL_EFF_MAX_HP_DECREASE':for(const target of targets)this.maxHP(id,target,c.options?.byCard,r.eff==='SKILL_EFF_MAX_HP_DECREASE');break;
   case 'SKILL_EFF_STAGE_PARAM_CHANGE':this.stageParameter(id);break;
   case 'SKILL_EFF_CURRENCY_ADD':this.currency(id);break;
   case 'SKILL_EFF_SCORE_ADD':{const value=this.call('procMathSign',r.eff_value_math_sign,0,this.value(id));if(value>0)for(const method of ['addDisasterScoreBonus','addRemnantsScoreBonus']){const score=this.call(method,value);if(score!=null)this.action('action_score_bonus',{source_id:score});}break;}
   case 'SKILL_EFF_NAME_CHANGE':{const name=this.db.array(r.eff_opt)[0];if(name==null||name===''||name==='none')throw new MissingBattleRule('coreEffect.name_empty',{id});for(const target of targets)this.call('setUnitNameOverride',target,name);break;}
   case 'SKILL_EFF_BG_SAVE':if(!s.eff_opts?.length)throw new MissingBattleRule('coreEffect.bg_empty',{id});this.b.stage_actions.push({id:-1,type:'bg_save',bg:s.eff_opts[0]});break;
   case 'SKILL_EFF_PRESET_PLAY':if(this.b.current_card_use_action)this.b.current_card_use_action.preset=s.eff_opts?.[0];break;
   case 'SKILL_EFF_TUTORIAL':case 'SKILL_EFF_TUTORIAL_ACCOUNT_SKILL':if(this.b.tutorial_block)this.call('pushLog',`SkillEff ${id}:duplicated tutorial ignored - ${s.eff_opts?.[0]}`);else{
    const msg=s.eff_opt_multiple_link?.[0];if(r.eff==='SKILL_EFF_TUTORIAL'&&msg==='tsp_0_0005')this.b.tutorial_block=true;
    this.action(r.eff==='SKILL_EFF_TUTORIAL'?'action_tutorial':'action_tutorial_account_skill',{source_id:-1,msg});++this.b.action_tutorial;
   }break;
   case 'SKILL_EFF_STORY_PLAY':this.action('action_story',{source_id:-1,msg:s.eff_opt_multiple_link?.[0]});++this.b.action_tutorial;break;
   case 'SKILL_EFF_VIDEO_PLAY':this.action('action_video',{source_id:-1,msg:s.eff_opts?.[0]});++this.b.action_tutorial;break;
   case 'SKILL_EFF_SUPPORTER_VIEW_RETURN':this.action('action_view_return',{source_id:-1});break;
   case 'SKILL_EFF_BATTLE_TOAST':this.action('action_toast',{source_id:-1,msg:s.eff_opt_multiple_link?.[0]});break;
   case 'SKILL_EFF_BALLOON_JUDAS':this.action('action_balloon_judas',{source_id:id,target_id:targets});break;
   case 'SKILL_EFF_BALLOON':case 'SKILL_EFF_BALLOON_AFTER':this.balloon(id,targets,r.eff==='SKILL_EFF_BALLOON_AFTER');break;
   case 'SKILL_EFF_TUTORIAL_30039_NPC':{const link=s.eff_opt_multiple_link??[];if(!link.length)throw new MissingBattleRule('coreEffect.npc_link_empty',{id});this.action('action_npc_enter',{source_id:-1,value:30039,card_res_id:link[0]});const card=this.call('getCards',{addStage:false,card_res_ids:[link[0]],N:1,source_id:-1,to:this.call('cardPlace','CARD_PLACE_USING'),eff_opt:s.eff_opts??[]})[0];if(card)this.call('pushCardUse',{card_id:card.id,target:-1,procUse:false,procCost:false,skip_exhibit:true},id);break;}
   default:throw new MissingBattleRule('coreEffect.dispatch',{id,eff:r.eff});
  }return {targets};
 }
 // @77978..79802. AFTER executes linked skills immediately (BATTLE_START
 // parent), after the balloon and persisted stage action have been emitted.
 balloon(id,targets,after){const s=this.b.skillMap[id],card=after&&s.parent.type==='CARD'?this.b.cardMap[s.parent.id]:undefined;
  this.action('action_balloon',{source_id:id,target_id:targets,balloon_opts:s.eff_opts,balloon_duration:s.eff_value,...(after?{balloon_run_pre:true,balloon_motion:card?this.db.table('card')[card.res_id]?.motion_type:undefined}:{})});
  if(targets?.length){const monster=this.e.getMonster(targets[0]);if(monster)this.b.stage_actions.push({id:this.b.last_action_id,type:'balloon',res_id:s.res_id,target:monster.content_id});}
  if(after)for(const res of s.eff_opt_multiple_link??[]){if(!res||res==='none')continue;const child=this.call('createSkill',res,s.caster_id,{type:'BATTLE_START',id:-1},0,0,0,s.action_char_id);this.call('procSkillEff',child.skill_id);}
 }
 // @65379..66262 only emits the native stage parameter events. The source
 // does not directly assign parameter.value in this effect branch.
 stageParameter(id){const s=this.b.skillMap[id],r=this.db.get('skill_eff',s.res_id),value=this.value(id),key=s.eff_opt_multiple_link?.[0],parameter=this.stage.stage_parameters[key];if(!parameter)return;
  const next=Math.min(Math.max(this.call('procMathSign',r.eff_value_math_sign,parameter.value??0,value),parameter.min),parameter.max);
  if(r.value_save_renewal_flag==='YES')this.call('saveValue',s.parent.type.toLowerCase(),s.parent.id,Math.abs(next-(parameter.value??0)));
  this.call('procUnitEvent','CONDITION_STAGE_PARAM',[key,next]);this.call('procUnitEvent','CONDITION_STAGE_PARAM_SET',[key,next]);
 }
 // @66266..67937, including the CREDIT-only nonbattle modifiers. The credit
 // ID is the exact retained defines export, pinned by value-enums.json.
 currency(id){const s=this.b.skillMap[id],r=this.db.get('skill_eff',s.res_id),value=this.value(id),links=s.eff_opt_multiple_link??[];if(!links.length)throw new MissingBattleRule('coreEffect.currency_link_empty',{id});
  const key=links[0],entry=this.stage.ingame_currency[key];if(!entry||this.b.battle_step_mode)return;
  let next=Math.max(this.call('procMathSign',r.eff_value_math_sign,entry.amount??0,value),0);
  const credit=key==='ingame_currency';if(credit&&next>(entry.amount??0)){
   if(this.call('getPassiveByTypeGamecore','EFF_CREDIT_BATTLE_REWARD_REMOVE').length)return;
   const rate=this.call('getPassiveByTypeGamecore','EFF_EARN_BATTLE_INGAME_CURRENCY_VALUE_CHANGE_PCT').reduce((n,p)=>n*p.eff_value/100,1),before=entry.amount??0;
   next=before+roundGame((next-before)*rate);
  }
  if(r.value_save_renewal_flag==='YES')this.call('saveValue',s.parent.type.toLowerCase(),s.parent.id,Math.abs(next-(entry.amount??0)));
  const before=entry.amount;entry.amount=next;if(credit)this.log('log_skill_eff_stage_param_change_credit',[next-before],['delta']);
  this.action('action_ingame_currency',{source_id:next,msg:key,currency_delta:next-before});if(credit)this.call('procUnitEvent','CONDITION_CREDIT_CHANGE',[-1,next-before]);
 }
 // procSkillEff @33848..35142: a ban is queried every repetition and blocks
 // both signs. FORCE bypasses it. The original count excludes count additional.
 energy(id,targets){if(!targets.length)return;const s=this.b.skillMap[id],r=this.db.get('skill_eff',s.res_id),value=this.value(id),count=this.call('calcCountValue',id);
  for(let i=0;i<count;i++){
   if(r.eff!=='SKILL_EFF_ENERGY_FORCE_CHANGE'){
    const bans=this.call('getPassiveByType',{source_id:this.b.char.id,type:'SKILL_EFF_ENERGY_ADD_BAN',is_card:false});
    if(bans.length){const p=bans[0],row=this.db.get('skill_eff',p.res_id);
     if(row.target_unit_type!=='TARGET_UNIT_EXCEPT_CHAR'||p.action_char_id!==s.action_char_id){this.call('checkTermValuePassive',p.skill_id,this.b.char.id);continue;}
    }
   }
   const before=this.b.energy,after=this.call('procMathSign',r.eff_value_math_sign,before,value);if(after==before)continue;
   this.log('log_skill_eff_energy_change',[after-before],['delta']);const parent=this.call('getRootParent',id);
   this.call('addEnergy',after-before,false,0,{char_id:s.caster_id,source_card_id:parent?.type==='CARD'?parent.id:-1});
  }
 }
 // @35146..36609: EP uses hundredths and one ban list for the whole loop.
 ep(id){const s=this.b.skillMap[id],r=this.db.get('skill_eff',s.res_id),value=this.value(id)*100,count=this.call('calcCountValue',id);
  const bans=this.call('getPassiveByType',{source_id:this.b.char.id,type:'SKILL_EFF_TACTIC_GAUGE_EARN_UNABLE',is_card:false}),max=this.call('constantMetagame',this.b.battle_step_mode?'tp_simulation_max_value':'tp_max_value');
  for(let i=0;i<count;i++){
   const before=this.b.ep,after=Math.max(0,Math.min(max,this.call('procMathSign',r.eff_value_math_sign,before,value)));
   if(bans.length&&after>before){this.log('log_skill_eff_tactic_gauge_earn_unable',[],[]);this.call('checkTermValuePassive',bans[0].skill_id,this.b.char.id);}
   else if(after-before>0)this.call('addEP',after-before,s.caster_id,true);
   else if(after-before<0)this.call('useEP',before-after,s.caster_id);
   const delta=this.b.ep-before;if(delta!==0)this.log('log_skill_eff_tactic_gauge_add',[delta/100],['delta']);
  }
 }
 // callbacks365/366 and367/368. COUNT's existing value is retained by native
 // nullish assignment; it is not incremented again on a repeated application.
 changeValues(id,targets,count){const s=this.b.skillMap[id],links=s.eff_opt_multiple_link??[],value=count?this.value(id):undefined;
  for(const target of targets){const card=this.b.cardMap[target];if(!card)continue;
   for(const childId of card.skill_eff_ids){const child=this.b.skillMap[childId];if(!child||!links.includes(child.res_id))continue;
    card.stage_save=true;if(count)child.changed_count_value??=0+value;
    else (child.changed_value??=[]).push(this.value(id,undefined));this.e.pushChangeData('skill',childId);
   }
  }
 }
 // callbacks340/341, bytecodes0x146200/0x148a00. The explicit events and
 // action payload preserve raw requested values even where setStatus clamps.
 maxHP(id,target,byCard,decrease){const s=this.b.skillMap[id],value=this.value(id,target),oldMax=this.call('getStatus',target,'S_HP');
  if(decrease){const requested=floorGame(oldMax-value),delta=oldMax-requested,oldHP=this.call('getStatus',target,'S_CURRENT_HP');
   this.call('setStatus',target,'S_HP',requested);const newHP=this.call('getStatus',target,'S_CURRENT_HP');
   this.hpAction('action_maxhp_decrease',s,target,{damage:delta,old_hp:oldHP,new_hp:newHP,max_hp:requested,type:[]},byCard);
   this.log('log_skill_eff_max_hp_decrease',[target,delta],['unit_id','value']);return;
  }
  const requested=oldMax+roundGame(value),newMax=this.call('setStatus',target,'S_HP',requested,{trigger:false}),delta=newMax-oldMax,oldHP=this.call('getStatus',target,'S_CURRENT_HP'),newHP=oldHP+delta;
  if(delta==0)return;this.call('setStatus',target,'S_CURRENT_HP',newHP,{trigger:false});
  this.call('procUnitEvent','CONDITION_CHAR_PARAMETER',[target,'max_hp',oldMax,newMax]);
  this.call('procUnitEvent','CONDITION_CHAR_PARAMETER',[target,'cur_hp',oldHP,newHP]);
  this.call('procUnitEvent','CONDITION_CHAR_CUR_HP_CHANGE',[target,'cur_hp',delta]);
  const beforePct=oldHP*100/oldMax,afterPct=newHP*100/newMax;
  this.call('procUnitEvent','CONDITION_CHAR_PARAMETER',[target,'cur_hp_pct',beforePct,afterPct]);
  this.call('procUnitEvent','CONDITION_CHAR_CUR_HP_CHANGE',[target,'cur_hp_pct',afterPct-beforePct]);
  this.hpAction('action_heal',s,target,{heal:delta,old_hp:oldHP,new_hp:newHP,max_hp:newMax,old_max_hp:oldMax},byCard);
  this.log('log_skill_eff_max_hp',[target,delta],['unit_id','value']);
 }
 hpAction(type,s,target,data,byCard){this.action(type,{source_id:s.action_char_id,action_list:[{action_units:[[target,data]]}],card_id:s.parent.type==='CARD'?s.parent.id:-1,byCard});}
}
