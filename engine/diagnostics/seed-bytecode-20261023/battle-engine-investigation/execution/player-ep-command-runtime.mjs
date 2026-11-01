// BattleProc EGO entry family, evidence/player-ep-command. Account and network
// work remain outside the offline command contract; all battle state work runs.
import {MissingBattleRule} from './resource-store.mjs';
export const PLAYER_EP_COMMAND_BINDINGS=Object.fromEntries(['battleEpSkillUseCommand','battleEpSkillUse','epSkillUse','getEpSkillCost','getEpSkillBanReason','spendEpForSkill'].map(n=>[n,n]));
export class PlayerEpCommandRuntime {
 constructor(e){this.e=e;this.w=e.wt;this.b=e.b;this.db=e.db;this.L=e.enums.LogicState;}
 call(n,...a){return this.e.call(n,...a);}
 error(message){throw this.call('ContentError',message);}
 get stageWT(){const w=this.w.battle_stage_worktable??this.e.state.worktables.BattleStageWorktable;if(!w?.battle_stage)throw new MissingBattleRule('input.BattleStageWorktable.ep');return w;}
 stageChar(id){const stage=this.stageWT.battle_stage;if(id==7){if(stage.assault_fourth_char==null)this.error('err:assault_fourth_char_not_found:char_id='+id);return stage.assault_fourth_char;}return stage.chars[id-1];}
 getEpSkillCost(skill,use=false){
  let cost=skill.origin_cost*100;const owner=this.stageChar(skill.char_id);if(owner?.collapse_recovered_cost_decreased)cost-=400;
  const ps=this.call('getPassiveByType',{source_id:this.b.char.id,type:'SKILL_EFF_EGOSKILL_COST_CHANGE',is_card:false,char_id:skill.char_id});
  ps.forEach(p=>{if(p.eff_opts?.includes('combatant')&&skill.isPartner)return;const s=this.b.skillMap[p.skill_id];if(s){const r=this.db.get('skill_eff',p.res_id),value=this.call('calcValue',s.skill_id);cost=this.call('procMathSign',r.eff_value_math_sign,cost,value*100);if(use)this.call('checkTermValuePassive',p.skill_id,skill.char_id);}});
  return Math.max(0,cost);
 }
 getEpSkillBanReason(skill){const partner=skill.isPartner,char=partner?skill.char_id-3:skill.char_id,q=type=>this.call('getPassiveByType',{source_id:this.b.char.id,type,is_card:false,char_id:char});if(q('SKILL_ALL_TACTIC_SKILL_USE_BAN').length)return 'all_ban';if(q(partner?'SKILL_PARTNER_TACTIC_SKILL_USE_BAN':'SKILL_EFF_CHAR_TACTIC_SKILL_USE_BAN').length)return partner?'partner_ban':'char_ban';return null;}
 // BattleProc.useEP clamps before calling the separate WT.useEP/addEP methods.
 spendEpForSkill(amount,source){const before=this.b.ep,max=this.call('constantMetagame',this.b.battle_step_mode?'tp_simulation_max_value':'tp_max_value'),after=Math.max(0,Math.min(max,before-amount));if(after-before>0)this.call('addEP',after-before,source);else if(after-before<0)this.call('useEP',before-after,source);}
 epSkillUse(charId,target=-1){
  if(target==null)target=-1;
  let skill,index=-1;if(this.b.temp_ep_skill_slot)skill=this.b.temp_ep_skill_slot;else{index=this.b.ep_skill_deck.findIndex(s=>s!=null&&s.char_id==charId);if((index<0||index>=3)&&this.w.isPreview==0)this.error('err:invalid_ep_skill_use:'+charId);skill=this.b.ep_skill_deck[index];}
  if(this.call('isCollapseOnCharacterByID',skill?.char_id??0)&&this.w.isPreview==0)this.error('err:invalid_ep_skill_use:collapse:'+(skill?.char_id??0));
  if(skill&&this.w.isPreview==0){const ban=this.getEpSkillBanReason(skill);if(ban)this.error('err:invalid_ep_skill_use:'+ban+':'+skill.char_id);}
  ++this.b.use_card_count;this.call('setStateMain',{state:this.L.TIMING_USE_CARD_BEFORE,proc:true,event:true});this.call('setCurrentCard',skill.card_id);
  const owner=this.call('getCharByCharId',charId);this.call('pushBattleLog',{type:'card_use',params:[skill.card_id,target,owner?.res_id],logs:[]});
  const cost=this.getEpSkillCost(skill,true);if(!this.b.cost_cheat&&!this.w.isPreview){if(cost>this.b.ep)this.error('err:invalid_ep_skill_use:cost:'+cost+':'+this.b.ep);this.spendEpForSkill(cost,charId);}
  this.call('setCardCostUsed',skill.card_id,cost/200);this.call('setStateMain',{state:this.L.TIMING_USE_CARD_AFTER,proc:true,event:true});
  const id=skill.card_id,action={id:this.b.last_action_id++,type:'action_player_card_use',source_id:charId,card_id:id};this.b.current_card_use_action=action;this.e.pushAction(action);const skills=this.call('getSkills',id);
  if(target>=0&&!this.call('isMonsterByID',target))this.error('err:invalid_selected_target:not_monster:'+target);this.b.select_target=target;
  this.call('procCardEvent','CONDITION_CHAR_USE_EGO_SKILL',0,id);this.call('procUnitEvent','CONDITION_CHAR_USE_EGO_SKILL',[charId]);if(![4,5,6].includes(charId))this.call('procUnitEvent','CONDITION_COMBATANT_EGO_SKILL_USED',[charId]);
  action.card_use_targets=this.call('procSkillEffs',skills,{byCard:true,motion_index:this.db.get('card',skill.card_res_id).motion_start_timing});
  this.call('setStateMain',{state:this.L.TIMING_SKILL_EFF_AFTER,proc:false,event:true});this.b.select_target=-1;
  if(this.call('checkMissionApply'))this.call('missionDispatch','USE_TP_SKILL',{char_id:skill.char_id,card_res_id:skill.card_res_id,battle_stage_worktable:this.stageWT});
  if(!this.b.temp_ep_skill_slot){
   this.b.used_ep_skill_deck??=[];this.b.used_ep_skill_deck.push(skill);this.b.ep_skill_deck[index]=undefined;if(this.b.ep_skill_deck.length>3)this.b.ep_skill_deck[index]=this.b.ep_skill_deck.pop();
   const reuse=this.call('getPassiveByType',{source_id:this.b.char.id,type:'SKILL_EFF_EGOSKILL_REUSEABLE',is_card:false});if(reuse.length){const empty=this.b.ep_skill_deck.findIndex(s=>s==null);if(empty>=0&&empty<3&&this.b.used_ep_skill_deck.length>0){const restored=this.b.used_ep_skill_deck.shift();restored.cost=this.getEpSkillCost(restored);this.b.ep_skill_deck[empty]=restored;}this.call('checkTermValuePassive',reuse[0].skill_id,this.b.char.id);}
  }else this.call('clearTempEpSkill',true);
  if(this.b.usedCardMap[skill.card_res_id]!=null)this.b.usedCardMap[skill.card_res_id]=true;
  this.call('procSkillTriggered',true,true);if(this.b.stress_recover){this.call('createBattleStressRecoverAction',charId);this.b.stress_recover=undefined;}
  this.call('setCurrentCard',-1);if(this.call('procInterrupt'))this.b.next_state=this.L.MainPhase;else this.call('setStateMain',{state:this.L.MainPhase,proc:true,event:true});
  this.stageWT.battle_stage.chars.forEach(c=>{if(c.id==skill.char_id)c.collapse_recovered_cost_decreased=undefined;});this.b.ep_skill_deck.forEach(s=>{if(s)s.cost=this.getEpSkillCost(s);});this.b.current_card_use_action=undefined;this.b.ep_skill_tipera_pending_select=undefined;return id;
 }
 battleEpSkillUse(charId,target,isTemp,prevEnd,option){if(this.b.current_state!=this.L.MainPhaseAutoAvailable)this.error('err:invalid_ep_skill_use:not_main_phase:'+this.b.current_state);if(option!=null)this.b.ep_skill_tipera_pending_select=option;this.e.actions.start(isTemp);const card=this.epSkillUse(charId,target),action={type:'ep_skill',char_id:charId,target,card_id:card,...(option!=null?{option_select:option}:{})};this.b.user_actions.push(action);return {res:'ok',battle_info:this.call('finishBattleActionOffline',{prev_game_end:prevEnd})};}
 battleEpSkillUseCommand(p){this.b.action_tutorial=0;if(this.b.game_result!='BATTLE_RESULT_TYPE_NONE'||this.b.current_state==this.L.TIMING_NONE)return {res:'err',type:'ignore'};return this.battleEpSkillUse(p.char_id,p.target_id,p.is_temp_ep_skill,this.b.game_end,p.option_select);}
}
