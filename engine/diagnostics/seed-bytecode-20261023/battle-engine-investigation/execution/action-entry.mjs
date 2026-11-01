// BattleProc startBattleAction, battleEndOfTurn, procEndOfTurn.
// Evidence: action-entry/, action-start/, turn-entry/, mission-source/.
// Entry/guards are reconstructed; downstream state settling remains mandatory.
import {MissingBattleRule} from './resource-store.mjs';
export class ActionEntry {
  constructor(engine){this.e=engine;this.wt=engine.wt;this.b=engine.b;}
  // BattlePlanner.preparePlan calls this before dispatching an online command,
  // separately from startBattleAction. Worktable 0x3ba00, offsets 0..187.
  resetTempData(){const w=this.wt;
    for(const key of ['byCard','check_types','connect_move_info','deferredActions','deferredSubLogs','egoBreak','egoBreaked','last_dead_mon','last_dead_summons','lead_action','target_effect_off','tempActions','turn_over_first_turn','turn_over_reserved','turn_start_action'])w[key]=undefined;
    w.changeMap={};w.deaths=[];this.e.call('clearInterruptOrderPending');w.monsterNotiCache.clear();
    w.passiveTriggered=[];w.phaseTriggered=[];w.previewChangeCS={};w.previewInactivePassives=[];w.previewPassiveMap=new Map();w.removeMap={};w.skillTriggeredCount=0;w.sparking=false;w.termPassiveImmediatlyList=[];
    w.triggeredList={relic:[],ego:[],cs:[],dmg_valueadd:[],shield_valueadd:[],maxHpMap:{},hpMap:{},shieldMap:{},egoMap:{},monTurnMap:{},energy:0};
    w.useAction=-1;w.userActions=[];
  }
  start(keepTemporaryEgo,keepLogs=false){
    const b=this.b,e=this.e;
    b.left_actions=[];b.action_tutorial=0;b.tutorial_block=undefined;
    b.action_blocks=[];if(!keepLogs&&!this.wt.keepBattleLogs)b.battle_logs=[];
    b.phase_changed=false;
    for(const key in b.cardMap)if(b.cardMap[key].dim==true){b.cardMap[key].dim=false;e.pushChangeData('card',key);}
    // clearData just emptied action_blocks, so its nested some() is false here.
    if(b.temp_ep_skill_slot!=null&&!keepTemporaryEgo){
      e.call('clearTempEpSkill');
      e.pushAction({id:b.last_action_id++,type:'action_temp_ep_skill_remove',source_id:-1});
    }
  }
  removeLeads(except){
    const b=this.b,e=this.e;
    if(!b.lead_cards)return;
    b.lead_cards.forEach(id=>{
      if(except&&except==id)return;
      const card=b.cardMap[id];card.leaded=false;
      const cost=e.call('updateCostResult',id).new_cost;
      e.pushChangeData('card',id);
      e.pushAction({id:b.last_action_id++,type:'action_card_cost',source_id:-1,
        action_card_property:{card:id,cost},skip_action:card.card_place!=2});
    });
    b.lead_cards=[];b.lead_char=undefined;
  }
  tutorialAllowsCard(id){
    const e=this.e,card=this.b.cardMap[id];if(!card||!e.call('isCardAvailable',card))return false;
    const category=e.db.get('card',card.res_id).card_category;
    if(['CARD_ABNORM','CARD_CURSE'].includes(category))return true;
    if(card.talents?.includes(6)||card.talents?.includes(7))return false;
    if(card.cost<0&&this.b.energy==0)return false;
    return true;
  }
  blockTutorial(skill){
    this.e.pushAction({id:this.b.last_action_id++,type:'action_tutorial',source_id:-1,
      msg:skill.eff_opt_multiple_link?.[0],command:'repeat'});
    ++this.b.action_tutorial;
    this.e.call('checkTermValuePassive',skill.skill_id,this.b.source_id);
    return false;
  }
  procEndOfTurn(){
    const e=this.e,b=this.b;
    this.removeLeads();b.turn_card_creation_count=0;
    const query=type=>e.passives.query({source_id:b.char.id,type,is_card:false});
    const enough=query('SKILL_EFF_TUTORIAL_ENOUGH_ENERGY_TURN_OVER');
    if(enough.length&&b.deck_info.hand.some(id=>this.tutorialAllowsCard(id)))return this.blockTutorial(enough[0]);
    const ban=query('SKILL_EFF_TUTORIAL_TURN_OVER_BAN');
    if(ban.length)return this.blockTutorial(ban[0]);
    if(!this.wt.makeLogs&&!this.wt.test&&!this.wt.isPreview){
      // Verified shipped MissionConditionProc.dispatch at 0xf00000002200 is
      // LdaUndefined; Return. No invented empty mission worktable is needed.
      e.record({kind:'client-noop',method:'MissionConditionProc.dispatch',event:'BATTLE_TURN_END'});
    }
    b.turn_count_card_id=undefined;b.player_turn=false;b.enemy_turn=true;
    e.timing.procTimingEvent('TIMING_PLAYER_TURN');
    e.ports.pushLog('Turn End');
    e.call('setStateMain',{state:e.enums.LogicState.TIMING_TURN_OVER_DISCARD_BEFORE,proc:true,event:true});
    e.call('procMain');
    if(b.battle_step_mode)b.battle_step_mode.next_wave=undefined;
    return true;
  }
  endTurn(){
    if(this.b.current_state!==this.e.enums.LogicState.MainPhaseAutoAvailable)
      throw new MissingBattleRule('invalid_end_of_turn:not_main_phase',{state:this.b.current_state});
    this.start();this.b.user_actions.push({type:'turn_over'});
    const accepted=this.procEndOfTurn();
    // The online finish path contains transport/persistence; its offline
    // state-finalization port must be reconstructed before reporting success.
    this.e.call('finishBattleActionOffline',{accepted});return {accepted};
  }
}
