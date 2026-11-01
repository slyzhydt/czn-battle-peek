// Complete native BattleAutoProc command family. Source is retained as static
// evidence/player-auto-command; no recovered JavaScript is evaluated.
import {MissingBattleRule} from './resource-store.mjs';
import {PlayerAutoTargetRuntime,isCardAutoUseBan,isSetupEnhanceCard} from './player-auto-target-runtime.mjs';
import {PlayerAutoOrderRuntime} from './player-auto-order-runtime.mjs';
export const PLAYER_AUTO_COMMAND_BINDINGS=Object.fromEntries(['battleCardAutoUseCommand','cardAutoUse','getAutoTarget','getCardPriorityBattleTest','checkSort','isCardAutoUseBan','isSetupEnhanceCard'].map(n=>[n,n]));
export class PlayerAutoCommandRuntime {
 constructor(e){this.e=e;this.w=e.wt;this.db=e.db;this.L=e.enums.LogicState;this.targets=new PlayerAutoTargetRuntime(e);}
 get b(){return this.e.b;}
 call(n,...a){return this.e.call(n,...a);}
 get stageWT(){const w=this.w.battle_stage_worktable??this.e.state.worktables.BattleStageWorktable;if(!w?.battle_stage)throw new MissingBattleRule('input.BattleStageWorktable.auto');return w;}
 getAutoTarget(id){return this.targets.getAutoTarget(id);}
 getCardPriorityBattleTest(id){return this.targets.getCardPriorityBattleTest(id);}
 checkSort(id,sorts){return this.targets.checkSort(id,sorts);}
 isCardAutoUseBan(res){return isCardAutoUseBan(res);}
 isSetupEnhanceCard(res,category){return isSetupEnhanceCard(res,category);}
 preview(){if(!this.w.test&&this.w.preview_scope!=='auto')this.call('getCardPreview',{scope:'auto'});}
 resultEmpty(){return {res:'ok',card_use_infos:[],turn_over:true,previewMap:this.b.previewMap};}
 battleCardAutoUseCommand(params){if(this.b.game_result!=='BATTLE_RESULT_TYPE_NONE'||this.b.current_state===this.L.TIMING_NONE)return{res:'err',type:'ignore'};if(this.b.current_state!==this.L.MainPhaseAutoAvailable)throw this.call('ContentError','err:invalid_card_use:not_main_phase:'+this.b.current_state);return this.cardAutoUse(undefined,params.auto_card_use_action);}
 cardAutoUse(useEpSkill,requestedAction,options){
  const skip=options?.skip_client_data==true;this.preview();
  const defeat=['death','run','changed','prop','half_death'],alive=this.b.monsters.filter(m=>!defeat.includes(m.state)&&!this.call('isAlwaysDamageFatal',m));if(alive.length===0)return this.resultEmpty();
  const threshold=this.call('constantMetagame','auto_egoskill_must_use_ep',{def_value:7}),affordable=this.b.ep_skill_deck.slice(0,3).filter(s=>s!=null&&s.cost<=this.b.ep),targetMap={},invocation=new PlayerAutoOrderRuntime(this.e,alive);
  const requestedEp=requestedAction?.type==='ep_skill'?requestedAction:undefined;let requestedCard=requestedAction?.type==='card_use'?requestedAction:undefined;const requestedTurn=requestedAction?.type==='turn_over'?requestedAction:undefined,requestedId=requestedCard?.card_id,requestedInfo=requestedId!=null&&this.b.deck_info.hand.includes(requestedId)?this.b.cardMap[requestedId]:undefined;if(requestedCard&&!requestedInfo)requestedCard=undefined;if(requestedTurn){this.preview();return this.resultEmpty();}
  let slot,keepTemporary=false;
  if(requestedEp||useEpSkill){slot=affordable.find(s=>requestedEp?.card_id!=null?s?.card_id==requestedEp.card_id:requestedEp?.char_id!=null?s?.char_id==requestedEp.char_id:s?.char_id==useEpSkill);const temp=this.b.temp_ep_skill_slot;if((requestedEp?.card_id!=null&&temp?.card_id==requestedEp.card_id)||(requestedEp?.card_id==null&&requestedEp?.char_id!=null&&temp?.char_id==requestedEp.char_id)||(requestedEp==null&&temp?.char_id==useEpSkill)){slot=temp;keepTemporary=true;}if(slot){if(this.call('getEpSkillBanReason',slot)||this.call('isCollapseOnCharacterByID',slot.char_id))return{res:'cancel',msg:'battle_toast_ep_skill_banned'};const target=requestedEp?.target??this.getAutoTarget(slot.card_id);if(target==null)return{res:'cancel',msg:'battle_toast_no_enemy_targetable'};targetMap[slot.card_id]=target;}}
  else if(!requestedCard&&this.b.ep>=threshold*100&&affordable.length>0){const allowed=affordable.filter(s=>{if(!invocation.canAutoUseEpSkill(s)||this.call('getEpSkillBanReason',s)||this.call('isCollapseOnCharacterByID',s.char_id))return false;const target=this.getAutoTarget(s.card_id);if(target==null)return false;targetMap[s.card_id]=target;return true;});if(allowed.length>0){this.call('shuffleInPlace',3,allowed);slot=allowed[0];}}
  if(slot){this.e.actions.start(keepTemporary);let target=-1;const row=this.db.get('card',slot.card_res_id);if(requestedEp?.target!=null)target=requestedEp.target;else if(row.target_for_ui==='TARGET_MOST_MAX_HP_MONSTER')target=targetMap[slot.card_id]??-1;this.call('epSkillUse',slot.char_id,target);this.b.user_actions.push({type:'ep_skill',char_id:slot.char_id,target,card_id:slot.card_id});const info=this.call('finishBattleActionOffline',{prev_game_end:false,skip_client_data:skip,preview_scope:'auto'});return{res:'ok',battle_info:skip?undefined:info,tactic_index:slot.char_id,previewMap:this.b.previewMap};}
  invocation.initializeFilters();const step=this.b.battle_step_mode,oneWave=step?.type==='BATTLE_STEP_WAVE_MODE'&&(step?.battle_ids?.length??1)<=1;
  const available=invocation.initialAvailable(requestedInfo?requestedId:undefined,oneWave),infos=[];let turnOver=false;
  if(available.length===0)turnOver=true;
  else{
   const ordered=invocation.orderCards(oneWave);
   // Native retries invalid candidates; after one successful card it always
   // exits (main 6862 -> 6874). It never executes the whole affordable pool.
   for(;;){if(this.b.game_end)break;this.e.actions.resetTempData();let id,action;if(requestedCard){action=requestedCard;requestedCard=undefined;id=action.card_id;}
    else if(this.b.auto_actions&&this.b.auto_actions.length>0){action=this.b.auto_actions.shift();if(action?.type==='card_res_select')action=this.b.auto_actions.shift();if(action?.type==='card_use')id=action.card_id;else if(action?.type==='turn_over')break;else this.call('ContentError','invalid_auto_action:'+JSON.stringify(action),{channel:'#auto_logs'});}
    if(!id){id=ordered.shift();if(id==null)break;}const card=this.b.cardMap[id];if(!this.call('isCardAvailable',card))continue;
    const rng=this.e.state.randoms.get(0);if(!rng)throw new MissingBattleRule('input.INGAME_seed.auto');const seed=rng.state,collapseReady=(card.collapse_count??0)+1>=(card.collapse_need_count??0);let target=action?.target;if(target==null){const cached=invocation.autoTargetCache.get(id);if(cached!=null&&this.call('getTargetableMonsterPassiveFilteredIDs',id).includes(cached))target=cached;else target=this.getAutoTarget(id);}if(target==null)continue;rng.state=seed;
    this.e.actions.start();this.call('pushLog','--------card_use-start--------');const userAction={type:'card_use',card_id:id,target};this.b.temp_card_use_action=userAction;const oldStep=this.b.battle_step_mode?.cur;this.b.select_target=target;const result=this.call('procUseCard',id,target);this.b.user_actions.push(userAction);
    const stage=this.stageWT.battle_stage,stageCard=stage.all.find(c=>c.id==card.id);if(stageCard&&card.char_id>=1&&card.char_id<=3&&this.b.chars.some(c=>c.id===card.char_id)&&stage.mvp_info)++stage.mvp_info[card.char_id-1];const forced=this.b.forced_turn_over&&this.call('isMainPhase');
    const info=this.call('finishBattleActionOffline',{prev_game_end:false,check_auto_available:false,skip_client_data:skip,preview_scope:'auto'});infos.push({card_id:card.id,target_id:target,spark_id:result.spark_res_id,collapse_recovery:result.collapse_recovery,battle_info:skip?undefined:info});
    if(oldStep!=null&&oldStep!=this.b.battle_step_mode?.cur)break;if(forced)break;if(this.b.current_state==this.L.CardInterrupt)break;if(collapseReady)break;break;
   }
   if(infos.length===0)turnOver=true;
  }
  if(infos.length===0)this.preview();const last=infos[infos.length-1];if(last&&(last.battle_info?.current_state==this.L.MainPhase||(skip&&this.b.current_state==this.L.MainPhase))){if(last.battle_info){last.battle_info.current_state=this.L.MainPhaseAutoAvailable;const blocks=last.battle_info.action_blocks;blocks.splice(-1,1,{state:this.L.MainPhaseAutoAvailable,actions:[],id:blocks[blocks.length-1].id});}this.b.current_state=this.L.MainPhaseAutoAvailable;}
  if(turnOver&&this.b.auto_actions&&this.b.auto_actions.length>0&&this.b.auto_actions[0]?.type==='turn_over')this.b.auto_actions.shift();return{res:'ok',card_use_infos:infos,turn_over:turnOver,previewMap:this.b.previewMap};
 }
}
