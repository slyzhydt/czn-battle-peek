// Independent hand ports of CardRSparkSelectHandler.on_execute0x5c00
// (+closures0x7d00/8f00/9900) and CardSelectSparkHandler.on_execute0x4900.
// The red on_server_execute0x5400 is an empty packaged implementation.
// Account savedata-point response metadata is outside offline battle output.
import {MissingBattleRule} from './resource-store.mjs';
import {PlayerSparkUseRuntime} from './player-spark-use-runtime.mjs';
export const PLAYER_SPARK_COMMAND_BINDINGS={battleCardRSparkSelect:'red',battleCardSelectSpark:'yellow'};
export class PlayerSparkCommandRuntime {
 constructor(e){this.e=e;this.b=e.b;this.w=e.wt;this.db=e.db;this.L=e.enums.LogicState;this.spark=new PlayerSparkUseRuntime(e);}
 call(n,...a){return this.e.call(n,...a);}
 get stageWT(){const s=this.w.battle_stage_worktable??this.e.state?.worktables?.BattleStageWorktable;if(!s)throw new MissingBattleRule('input.BattleStageWorktable.sparkCommand');return s;}
 ignored(){return this.b.game_result!=='BATTLE_RESULT_TYPE_NONE'||this.b.current_state===this.L.TIMING_NONE;}
 guard(){if(this.b.current_state!==this.L.CardInterrupt)throw this.call('contentError','err:invalid_card_option_select:not_interrupt:'+this.b.current_state);}
 lastCardUse(){let at=this.b.user_actions.length-1,a=this.b.user_actions[at];while(a!=null&&a.type!=='card_use')a=this.b.user_actions[--at];return a;}
 restoreHand(c){delete c.available;c.card_place=2;const id=this.b.deck_info.using.shift();if(id)this.b.deck_info.hand.push(id);}
 cardLog(id,target,owner){this.call('pushBattleLog',{type:'card_use',params:[id,target,owner?.res_id],logs:[]});}
 finish(prev){return this.call('finishBattleActionOffline',{prev_game_end:prev});}
 red(selection){if(this.ignored())return {res:'err',type:'ignore'};this.guard();const previousEnd=this.b.game_end,last=this.lastCardUse(),id=last.card_id;let target=last.target,c=this.b.cardMap[id];
  const chosen=c.r_spark_candis?.find(x=>x.res_id==selection?.res_id&&x.category==selection?.category&&x.god_r_spark_res_id==selection?.god_r_spark_res_id);
  if(chosen==null)throw this.call('contentError','err:invalid_r_spark_select-card_id:'+id+',res_id:'+selection?.res_id);
  this.b.select_target=target;c.r_spark=structuredClone(chosen);const owner=this.stageWT.battle_stage.chars.find(x=>x.id==c.char_id);if(owner)++owner.total_spark_count;
  if(!c.r_spark?.by_custom){const selectedIndex=c.r_spark_candis?.findIndex(x=>x.res_id==c.r_spark?.res_id);if(selectedIndex!=null)this.e.record?.({kind:'client-noop',method:'CardRSparkSelectHandler.on_server_execute',selectedIndex});}
  c.r_spark_candis=undefined;this.spark.pushLogs(this.stageWT,{spark_log_type:'R_SPARKED',char_id:c.char_id,params:{card_id:id,r_spark:c.r_spark}});
  this.e.actions.start();this.cardLog(id,target,owner);const log={type:'r_spark',logs:[],params:[c.id,c.r_spark]};this.call('pushSubBattleLog',log);this.call('setSubFinished');const battleChar=this.call('getCharByCharId',c.char_id);battleChar.levelUpLogs??=[];battleChar.levelUpLogs.push(log);
  const byTurn=c.by_turn_draw;this.call('setRSpark',c.id,false);c=this.b.cardMap[id];c.by_turn_draw=byTurn;
  const row=this.db.get('card',c.res_id);if(this.call('getTargetTypeByTargetForUI',row.target_for_ui)==='TARGET_MONSTER'&&target==-1){const ids=this.call('getTargetableMonsterPassiveFilteredIDs',c.id);target=ids.length==1?ids[0]:this.e.random.randomArrayMember(0,ids);this.b.select_target=target;}
  this.spark.applyRSpark(this.stageWT,c.id,structuredClone(chosen));const stageCard=this.spark.getCard(this.stageWT,c.id);if(stageCard){stageCard.r_spark=structuredClone(chosen);stageCard.r_spark_candis=undefined;}
  this.restoreHand(c);this.call('pushLog','--------card_use-start--------');const result=this.call('procUseCard',id,target,{after_r_spark:true});this.b.user_actions.push({type:'card_r_spark_select',card_id:id,target:last.target,r_spark:structuredClone(chosen)});const battle=this.finish(previousEnd);
  return {res:'ok',spark_id:result.spark_res_id,battle_info:battle,cards:this.stageWT.battle_stage.all,savedata_point_info_datas:undefined,offline_omitted:['SavedataProcGamecore.checkSavedataPoint: account savedata response metadata']};
 }
 // makeCardInfo0x16000 has an explicit StageWT parameter in the packaged
 // helper. Use that exact stage for break-r-spark lookup, including overrides.
 makeInfo(stage,id,res,charId){const out={id,res_id:res,char_id:charId??-1},spark=stage.battle_stage.break_r_spark_cards?.[res];if(spark)out.r_spark={category:'CATEGORY_UNIQUE',res_id:spark,by_outgame:true};return out;}
 yellow(selectedResId){if(this.ignored())return {res:'err',type:'ignore'};const previousEnd=this.b.game_end;this.guard();const last=this.lastCardUse(),id=last.card_id,target=last.target,c=this.b.cardMap[id];this.b.select_target=target;
  // The source validates interrupt state, but does not check candidate
  // membership here. Keep that distinction rather than add a new game rule.
  c.y_spark={next_card:this.makeInfo(this.stageWT,this.stageWT.battle_stage.gen_id++,selectedResId,c.char_id),next_cards_resid:undefined};this.spark.pushLogs(this.stageWT,{spark_log_type:'Y_SPARKED',char_id:c.char_id,params:{card_id:selectedResId}});
  this.e.actions.start();this.cardLog(id,target,this.call('getCharByCharId',c.char_id));this.restoreHand(c);this.call('pushLog','--------card_use-start--------');this.b.user_actions.push({type:'card_select_spark',card_id:id,target,card_res_ids:[selectedResId]});const result=this.call('procUseCard',id,target,{after_y_spark_select:true}),battle=this.finish(previousEnd);
  return {res:'ok',spark_id:result.spark_res_id,battle_info:battle,cards:this.stageWT.battle_stage.all,source_id:id};
 }
}
