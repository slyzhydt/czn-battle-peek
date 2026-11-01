// Exact outer order from repaired settleReactions 0x7c700 and
// procSkillTriggered 0x6f900. Effect, death, phase and interrupt implementations
// are mandatory ports, not assumed no-ops when their bodies are still unported.
import {MissingBattleRule} from './resource-store.mjs';
export const SETTLE_ROUND_LIMIT=1000; // static initializer 0x215900 offset 157
export class ReactionLoop {
  constructor({worktable,ports,record,enums}){this.wt=worktable;this.b=worktable.battle;this.ports=ports;this.record=record;this.enums=enums;this.depth=0;}
  call(name,...args){const fn=this.ports[name];if(typeof fn!=='function')throw new MissingBattleRule(name,{args});return fn(...args);}
  pendingMotion(){
    if(this.b.motionTrig?.length>0||this.b.coopTrig?.length>0){this.call('procMotionSkillTriggered');return true;}
    return false;
  }
  settle(options){
    const interrupts=options?.interrupts??true;
    for(let round=0;round<SETTLE_ROUND_LIMIT;round++){
      this.record?.({kind:'settle-round',round,interrupts});
      this.procSkills(true,true);
      if(interrupts&&this.call('procInterrupt'))return true;
      if(this.pendingMotion())continue;
      const pending=(this.b.skillTrig?.length??0)>0||(this.b.duringTrig?.length??0)>0;
      if(!pending&&!(interrupts&&!this.b.block_interrupt&&this.b.interrupts&&this.b.interrupts.length>0))return false;
    }
    // Game reports and returns false; an offline prediction must instead reject
    // the exhausted branch so unfinished reactions cannot look like a solution.
    throw new MissingBattleRule('settle_round_limit',{limit:SETTLE_ROUND_LIMIT});
  }
  procSkills(checkDeads,checkPhases){
    if(++this.depth>512){--this.depth;throw new MissingBattleRule('offline_reaction_recursion_budget');}
    try{return this.procSkillsBody(checkDeads,checkPhases);}finally{--this.depth;}
  }
  procSkillsBody(checkDeads,checkPhases){
    this.call('checkUniqueChizuru');const group={};
    while(this.b.duringTrig?.length>0||this.b.skillTrig?.length>0){
      const during=this.b.duringTrig&&this.b.duringTrig.length>0;
      const entry=during?this.b.duringTrig?.shift():this.b.skillTrig?.shift();
      if(during){
        // This callback runs BEFORE the native empty-queue assignment.
        this.call('setSubFinished',false);
        if(this.b.duringTrig?.length==0)this.b.duringTrig=undefined;
      }else if(this.b.skillTrig?.length==0)this.b.skillTrig=undefined;
      this.record?.({kind:'dequeue',queue:during?'duringTrig':'skillTrig',skill_id:entry?.skill_id});
      if(entry!=null&&entry.skill_id in this.b.skillMap){
        if(this.call('isSkippedAfterBattleEnd',entry))this.call('skipTriggeredSkillData',entry);
        else{this.call('openPyeonrinSub',group,entry);this.call('procTriggeredSkillData',entry);}
      }else if(entry!=null)this.call('flushDeferredLogs',entry);
      if(during)this.call('setSubFinished');
    }
    this.call('finishPyeonrinSub',group);
    if(this.call('releaseLightDarkCombineWaiting'))return this.procSkills(checkDeads,checkPhases);
    let acted=false;
    while(this.wt.passiveTriggered.length>0){
      const entry=this.wt.passiveTriggered.shift();if(entry==null)continue;
      const stack=this.b.stackMap[entry[0]];if(!stack)continue;
      const unit=this.call('getUnitByID',stack.caster_id,'monster_passive');
      if(unit.status.info.S_CURRENT_HP>0||this.call('getPassiveByType',{source_id:stack.caster_id,type:'SKILL_EFF_HALF_DEAD_ABLE',is_card:false}).length>0){
        this.call('monsterProcCard',unit,undefined,true,entry[1]);acted=true;
      }
    }
    if(acted){
      this.call('clearUnlockAction');this.b.phase_changed=true;
      this.call('pushAction',{id:this.b.last_action_id++,type:'action_monster_unlock',source_id:-1});
    }
    if(checkDeads&&this.call('checkDeads'))this.procSkills(true,checkPhases);
    if(checkPhases&&this.b.current_state!==this.enums.LogicState.TIMING_MON_USE_CARD_AFTER){
      const pending=[];
      while(this.wt.phaseTriggered.length>0){
        const id=this.wt.phaseTriggered.shift();if(id==null)continue;
        const unit=this.call('getUnitByID',id,'phase_check');
        if(this.b.enemy_turn&&!unit.actioned&&unit.status.info.S_CURRENT_HP>0)pending.push(id);
        else this.call('procChangePhase',id);
      }
      this.wt.phaseTriggered=pending;
      while(this.b.startCardsReserved.length>0){
        const entry=this.b.startCardsReserved.shift();
        if(entry)this.call('monsterProcCard',this.call('getUnitByID',entry[0],'start_card'),entry[1],true);
      }
    }
  }
}
