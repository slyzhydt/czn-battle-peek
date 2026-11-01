// Hand-port: event_system bytecodes 4eb00,50200,51400,52300,82800,85f00,87b00.
import {compareCondition} from '../conditions/condition-core.mjs';
import {MissingBattleRule} from './resource-store.mjs';
export class TimingDispatch {
  constructor({worktable,resources,stacks,enums,ports}){this.wt=worktable;this.b=worktable.battle;this.db=resources;this.stacks=stacks;this.enums=enums;this.ports=ports;}
  procTimingEvent(timing){
    const kind=Object.hasOwn(this.enums.LogicState,timing)?this.enums.LogicState[timing]:timing;
    const each=(key,predicate)=>this.b.eventMaps.timingEventMap[key]?.forEach(id=>{
      const event=this.b.condMap[id];if(!event)throw new MissingBattleRule('dangling_timing_event',{id});
      if(event.inactive)return;
      if(predicate(event))this.stacks.onEvent(event,false);else this.stacks.offEvent(event);
    });
    const compare=(event,value)=>compareCondition(this.db.get('cond_timing',event.res_id).condition_timing_value_ineq,value,event.value);
    if(kind==='TIMING_PLAYER_TURN')each(kind,e=>this.b.player_turn&&compare(e,this.b.turn));
    else if(kind==='TIMING_TURN'){
      each(kind,e=>compare(e,this.b.turn));
      each('TIMING_TURN_ODD',()=>this.b.turn%2==1);
      each('TIMING_TURN_EVEN',()=>this.b.turn%2==0);
    }else if(kind==='TIMING_TURN_WAVE_RESET')each(kind,e=>compare(e,this.b.turn-(this.b.turn_wave_reset??0)));
    else each(kind,e=>compare(e,this.b.timingCount[kind]));
  }
  procTiming(timing){
    if(this.b.check_timing_all){
      this.b.check_timing_all.forEach(id=>this.ports.addSkillTriggered(id));
      this.b.check_timing_all_temp=this.b.check_timing_all?.slice();this.b.check_timing_all=undefined;
    }
    this.procTimingEvent(timing);
    if(timing in this.b.timingMap)this.b.timingMap[timing].slice().forEach(id=>this.stacks.onTimingCheck(id,timing));
  }
  registerTiming(eventMaps,stackId,trigger,row,override){
    const field=k=>override?.column===k?override.value:this.db.number(row,k);
    const event={id:this.b.cond_id++,stack_id:stackId,condition_type:this.enums.EVENT_CONDITION_TYPE.TIMING,res_id:row.id,trigger,
      value:field('condition_timing_value'),stack_input:field('condition_timing_stack_input')};
    this.b.condMap[event.id]=event;
    const key=row.condition_timing;(eventMaps.timingEventMap[key]??=[]).push(event.id);
    let triggered=false;
    const compare=n=>compareCondition(row.condition_timing_value_ineq,n,event.value);
    if(key==='TIMING_PLAYER_TURN'){if(this.b.player_turn)triggered=compare(this.b.turn);}
    else if(key==='TIMING_TURN')triggered=compare(this.b.turn);
    else if(key==='TIMING_TURN_WAVE_RESET')triggered=compare(this.b.turn-(this.b.turn_wave_reset??0));
    return {key,triggered,event};
  }
  unregister(map,key,stackId){
    if(!map[key])return;
    map[key]=map[key].filter(id=>{
      const event=this.b.condMap[id];if(!event)throw new MissingBattleRule('dangling_condition',{id});
      if(event.stack_id!=stackId)return true;
      event.inactive=true;this.ports.markCondForRemoval(id);return false;
    });
  }
  removeTiming(stackId,timing){
    if(!(timing in this.b.timingMap))return;
    const ids=this.b.timingMap[timing];let index;
    while((index=ids.indexOf(stackId))>=0)ids.splice(index,1);
  }
  unregisterStack(stack){
    stack.unitKeys?.forEach(k=>this.unregister(this.b.eventMaps.unitEventMap,k,stack.stack_id));
    stack.cardKeys?.forEach(k=>{const map=this.b.eventMaps.cardEventMap[k.key1];if(map)this.unregister(map,k.key2,stack.stack_id);});
    stack.timingKeys?.forEach(k=>this.unregister(this.b.eventMaps.timingEventMap,k,stack.stack_id));
    if(stack.timingMap)for(const key in stack.timingMap)stack.timingMap[key].forEach(timing=>this.removeTiming(stack.stack_id,timing));
  }
}
