// Command wrappers reconstructed from battleCardUse 0x6fc00 and the complete
// shipped gamecore/battle/handler inventory. Transport/persistence are explicit
// omissions of finishBattleActionOffline, never supplied as fake server data.
import {compareCondition} from '../conditions/condition-core.mjs';
import {MissingBattleRule} from './resource-store.mjs';
export const PLAYER_COMMAND_TYPES=Object.freeze(['card_use','turn_over','card_select','card_res_select','card_option_select','event_select','card_select_spark','card_r_spark_select','ep_skill','card_auto_use']);
export const PLAYER_COMMAND_BINDINGS={battleCardUse:'battleCardUse',executePlayerCommand:'execute'};
const SELECTIONS={card_select:{state:'CardInterrupt',method:'procSelectCard',field:'card_ids'},card_res_select:{state:'CardInterrupt',method:'procSelectCardRes',field:'card_res_ids'},card_option_select:{state:'CardInterrupt',method:'procSelectCardOption',field:'card_res_ids'},event_select:{state:'EventInterrupt',method:'procSelectEvent',field:'card_res_ids'}};
export class PlayerCommandRuntime {
 constructor(e){this.e=e;this.b=e.b;this.w=e.wt;this.db=e.db;this.L=e.enums.LogicState;}
 call(n,...a){return this.e.call(n,...a);}
 error(message){throw this.call('ContentError',message);}
 ignore(){return {res:'err',type:'ignore'};}
 battleCardUse(params){
  const prev=this.b.game_end;if(this.b.game_result!='BATTLE_RESULT_TYPE_NONE')return this.ignore();
  if(this.b.current_state!=this.L.MainPhaseAutoAvailable)this.error('err:invalid_card_use:not_main_phase:'+this.b.current_state);
  const card=this.b.cardMap[params.source_id];if(!card)throw new MissingBattleRule('command.cardInput',{id:params.source_id});
  const row=this.db.get('card',card.res_id),indices=this.db.array(row.target_check_index).map(Number),rng=this.e.state.randoms.get(0);if(!rng)throw new MissingBattleRule('command.INGAME');
  const seed=rng.state;this.b.select_target=params.target_id;
  const cancel=indices.some(index=>{const id=card.skill_eff_ids[index],targets=this.call('getSkillEffTarget',id);if(!targets.length)return true;const s=this.b.skillMap[id],r=this.db.get('skill_eff',s.res_id);
   if(r.eff=='SKILL_EFF_KILL'){const attack=s.eff_opts?.filter(opt=>opt.startsWith('atk_'));if(attack?.length){const inequality='INEQUALITY_'+attack[0].slice(4).toUpperCase();return !targets.some(target=>{const hp=this.call('getStatus',target,'S_CURRENT_HP'),value=this.call('calcValue',id,target),threshold=this.call('procRevise',1,this.call('procStatType',1,value,this.call('getStatus',s.stat_source,'S_ATK')));return compareCondition(inequality,hp,threshold);});}}
   return false;
  });
  // Source restores only INGAME and does not use finally on exceptional paths.
  rng.state=seed;this.e.record({kind:'rng_restore',type:0,state:seed,reason:'battleCardUse.target_check'});
  if(cancel)return {res:'ok',type:'cancel'};
  this.e.actions.start();this.call('pushLog','--------card_use-start--------');
  const action={type:'card_use',card_id:params.source_id,target:params.target_id};this.b.temp_card_use_action=action;
  const used=this.call('procUseCard',params.source_id,params.target_id);this.b.user_actions.push(action);
  const stage=this.e.playerUseShared.stage;if(stage.all.find(c=>c.id==card.id)&&card.char_id>=1&&card.char_id<=3&&this.b.chars.some(c=>c.id===card.char_id)&&stage.mvp_info)++stage.mvp_info[card.char_id-1];
  const info=this.call('finishBattleActionOffline',{prev_game_end:prev});return {res:'ok',spark_id:used.spark_res_id,collapse_recovery:used.collapse_recovery,battle_info:info};
 }
 select(type,p){
  const def=SELECTIONS[type];if(this.b.game_result!='BATTLE_RESULT_TYPE_NONE'||this.b.current_state==this.L.TIMING_NONE)return this.ignore();
  if(this.b.current_state!=this.L[def.state])this.error('err:invalid_'+type+':not_interrupt:'+this.b.current_state);
  const prev=this.b.game_end;this.e.actions.start();
  const selected=type==='card_select'||type==='card_res_select'?p.source_ids:[p.source_id],action={type,[def.field]:selected};if(type==='card_res_select')action.card_pool_indices=p.source_indices;this.b.user_actions.push(action);
  const result=type==='card_res_select'?this.call(def.method,p.source_ids,undefined,p.source_indices):this.call(def.method,type==='card_select'?p.source_ids:p.source_id);
  if(!result)return {res:'err',message:'fail_to_select_'+(type==='card_select'?'card':type==='card_res_select'?'card_res':type==='card_option_select'?'card_option':'event')};
  const out={res:'ok',battle_info:this.call('finishBattleActionOffline',{prev_game_end:prev})};
  if(type==='card_option_select')out.omitted=['BattleWorktable.getBattleHash: transport integrity hash not generated'];
  if(this.b.after_use_info){out.spark_id=this.b.after_use_info.spark_res_id;out.source_id=this.b.after_use_info.card_id;this.b.after_use_info=undefined;}
  return out;
 }
 execute(operation){
  const type=operation.type,p=operation.params??operation;if(!PLAYER_COMMAND_TYPES.includes(type))throw new MissingBattleRule('unknown_player_command',{type});
  this.e.actions.resetTempData();let response;
  if(type==='card_use')response=this.b.current_state==this.L.TIMING_NONE?this.ignore():this.battleCardUse(p);
  else if(SELECTIONS[type])response=this.select(type,p);
  else if(type==='turn_over'){
   this.b.action_tutorial=0;
   if(this.b.game_result!='BATTLE_RESULT_TYPE_NONE'||this.b.current_state==this.L.TIMING_NONE)response=this.ignore();
   else if(this.b.turn!=p.turn){response=this.ignore();this.call('ContentError',`err:turn_over_failed:${this.b.turn}:requested=${p.turn}}`,{channel:'#server_report_dev2'});}
   else {const accepted=this.e.actions.endTurn();response={res:'ok',...accepted,battle_info:this.e.lastOfflineActionResult};}
  }
  else if(type==='card_select_spark')response=this.call('battleCardSelectSpark',p.source_id);
  else if(type==='card_r_spark_select')response=this.call('battleCardRSparkSelect',p.source_id);
  else if(type==='ep_skill')response=this.call('battleEpSkillUseCommand',p);
  else if(type==='card_auto_use')response=this.call('battleCardAutoUseCommand',p);
  // ExecutionExchange.execute 0xcb00 stamps the final seed after dispatch.
  const last=this.b.user_actions.at(-1);if(last&&!this.e.pendingCardFinalization)last.seed=this.e.state.randoms.get(0).state;
  return response;
 }
}
