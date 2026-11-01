// Hand port of setStateMain 0x85100. Source: evidence/worktable-bridge/.
// Main-phase monster counting/fatal handling (1450..2529) is a required
// continuation port, never silently skipped. Other missing effects also throw.
import {MissingBattleRule} from './resource-store.mjs';
import {SETTLE_ROUND_LIMIT} from './reaction-loop.mjs';
export class StateDriver {
  constructor(e){this.e=e;this.wt=e.wt;this.b=e.b;this.L=e.enums.LogicState;}
  checkLastActionBlock(){
    const a=this.b.action_blocks,last=a.at(-1),L=this.L;
    if(last&&![L.TIMING_PLAYER_SEQUENCE_START,L.TIMING_MON_SEQUENCE_START,L.MainPhaseAutoAvailable,L.MainPhase,L.TIMING_USE_CARD_FINISH].some(s=>s==last.state)&&last.actions.length==0)a.splice(a.length-1,1);
  }
  setCurrentCard(id){
    const b=this.b,w=this.wt;
    if(!w.makeLogs&&!w.test&&!w.isPreview){
      const card=b.cardMap[b.current_card]??b.cardMap[b.before_used_card];
      if(card)for(const [field,events] of [
        ['shield_accumulated',['GET_SHIELD_CARD_USE_IN_TURN','GET_SHIELD_USE_CARD_ONCE']],
        ['damage_accumulated',['ATTACK_USE_CARD_ONCE']],['heal_accumulated',['GET_HEAL_IN_BATTLE']]]){
        if(card[field]){for(const event of events)this.e.record({kind:'client-noop',method:'MissionConditionProc.dispatch',event});card[field]=undefined;}
      }
    }
    b.current_card=id;if(id!=-1)b.prev_used_card=id;
  }
  procReservedTurnOver(){
    if(!this.wt.turn_over_reserved)return false;
    this.wt.turn_over_reserved=undefined;this.b.using_card=false;
    this.e.call('checkLightDark');return this.e.actions.procEndOfTurn();
  }
  checkGameEndAndReservedTurnOver(state){
    this.e.call('checkGameEnd');return state==this.L.MainPhase?this.procReservedTurnOver():false;
  }
  appendBlock(state,prev){this.b.action_blocks.push({state,actions:[],id:this.b.state_id++,prev,turn:this.b.turn});}
  commit(state,event,prev){
    this.checkLastActionBlock();this.e.ports.pushLog('timing_changed:'+this.L[state]);
    this.b.current_state=state;if(state==this.L.MainPhase)this.b.timing_pre_turn=false;
    this.appendBlock(state,prev);
    if(event)this.e.timing.procTiming(state);
    this.e.call('procSingularityTriggeredImmediate');return false;
  }
  setStateMain({state,event,interrupt,proc,check,prev}){
    const b=this.b,e=this.e,L=this.L;
    interrupt??=true;check??=true;
    if(check&&!this.wt.turn_over_reserved)e.call('checkGameEnd');
    if(b.game_end){this.setCurrentCard(-1);return true;}
    if(state==b.current_state){if(state==L.TIMING_MON_USE_CARD_AFTER)this.appendBlock(state,prev);return false;}
    if(state==L.TIMING_USE_CARD_FINISH){
      const card=b.cardMap[b.current_card];
      if(card){
        if(b.stress_recover)e.call('createBattleStressRecoverAction',card.char_id);
        b.this_turn_used_cards??=[];if(!b.this_turn_used_cards.includes(b.current_card))b.this_turn_used_cards.push(b.current_card);
      }
      this.setCurrentCard(-1);b.stress_recover=undefined;
    }
    if(state===L.TIMING_PLAYER_SEQUENCE_START){
      b.enemy_turn=false;b.monster_turn_end=undefined;b.before_used_card=-1;b.before_activated_card=-1;
      b.before_used_ego=undefined;b.turn_count_card_id=undefined;
      e.call('procCardEvent','CONDITION_CARD_BEFORE_EGO_TYPE',0,-1);
      e.call('procCardEvent','CONDITION_CARD_USE_BEFORE_CHAR',0,-1);
    }else if(state===L.TIMING_USE_CARD_BEFORE)b.using_card=true;
    else if(state===L.MainPhase){
      if(b.recent_draw){
        const list=e.passives.query({source_id:b.char.id,type:'SKILL_EFF_CS_SET_ADD_RECENT_DRAW',is_card:false});
        list.forEach(passive=>e.call('recentDrawPassive',passive));
      }
      b.using_card=false;if(this.procReservedTurnOver())return true;proc=true;
    }
    if(!proc)return this.commit(state,event,prev);
    const name=L[state];if(name in b.timingCount)++b.timingCount[name];else b.timingCount[name]=1;
    e.call('settleReactions',{interrupts:false});
    if(check&&this.checkGameEndAndReservedTurnOver(state))return true;
    if(b.game_end)return true;
    const suspend=()=>{b.next_state=state;return true;};
    if(state==L.MainPhase){
      if(this.procReservedTurnOver())return true;
      if(interrupt){
        let round=0;
        while(true){
          if(round>=SETTLE_ROUND_LIMIT)throw new MissingBattleRule('main_phase_pre_monster_round_limit');
          if(e.call('settleReactions'))return suspend();
          if(b.using_card||b.enemy_turn)break;
          const q=e.call('drainQueuedCardUses');if(q.interrupted)return suspend();
          if(!q.used)break;b.using_card=false;e.call('checkLightDark');++round;
        }
        if(check)e.call('checkGameEnd');if(b.game_end)return true;
        if(this.procReservedTurnOver())return true;
      }
      // Includes card-based turn decrement, fatal attacks, monster actions,
      // ALL/ANY turn-count events and checkSpark in the original order.
      if(e.call('mainPhaseMonsterActions',{prev}))return true;
    }
    // This block follows BOTH MainPhase and other phases (not an else branch).
    if(interrupt){
      if(e.call('settleReactions'))return suspend();
      if(check&&this.checkGameEndAndReservedTurnOver(state))return true;
      e.call('applyChangeCS');
      if(!b.using_card){
        if(e.call('settleReactions'))return suspend();
        if(check&&this.checkGameEndAndReservedTurnOver(state))return true;
      }
      if(!b.using_card&&!b.enemy_turn){
        const q=e.call('drainQueuedCardUses');if(q.interrupted)return suspend();
        if(check&&q.used&&this.checkGameEndAndReservedTurnOver(state))return true;
      }
    }
    // InterruptType.NONE is string 'NONE', battle_enums Bytecode 0x1d300.
    if(b.current_interrupt.type!='NONE')return true;
    return this.commit(state,event,prev);
  }
}
