// Independent reconstruction of event_stack_helper. See evidence/stack/*.linear.js.
// Mutates ONLY an offline worktable. Effect/UI/removal ports are mandatory: a
// missing implementation stops execution, never silently becomes a no-op.
import {need,MissingConditionInput,checkCondMap,clampStackValue,compareCondition,TRIGGER,ANDOR,TIMING} from '../conditions/condition-core.mjs';
import {dispatchUnitCondition} from '../conditions/unit-predicate-suite.mjs';

export class StackLifecycle {
  constructor({worktable,conditions,ports,enums,completeSnapshot=false}) {
    this.wt=worktable;this.b=need(worktable,'battle');this.rows=conditions;this.ports=ports;this.enums=enums;this.completeSnapshot=completeSnapshot;
    for(const key of ['stackMap','stackParentMap','condMap','relicStackMap'])need(this.b,key);
  }
  call(name,...args){const fn=this.ports[name];if(typeof fn!=='function')throw new MissingConditionInput('execution.port.'+name);return fn(...args);}
  stack(id){return this.b.stackMap[id];}
  check(s,trigger){
    // Sparse own fields in a validated complete snapshot are known absence.
    // Use a read-only projection; do not add null fields to the simulated state.
    return checkCondMap(s&&this.completeSnapshot?{...s,and_or:s.and_or??null,check_map:s.check_map??null}:s,trigger);
  }
  row(s){return need(this.rows,need(s,'res_id'),'condition:'+s.res_id);}
  parents(s,visit){this.b.stackParentMap[s.stack_id]?.forEach(visit);}
  record(type,s){if(this.row(s).stack_type!=='STACK_NONE'&&s.stack_id in this.b.relicStackMap)this.call('stackAction',type,s);}
  setStack(id,value){
    const s=this.stack(id),v=clampStackValue(s,this.row(s),value);
    if(s.stack==v)return;
    s.stack=v;
    this.call('singularityStackAction',s);
    this.call('procUnitEvent','CONDITION_STACK_VALUE_COMPARE',[]);
    this.parents(s,p=>{if(p.from===need(this.enums.STACK_FROM,'SKILL')&&p.useType===need(this.enums.STACK_PROC_TYPE,'VALUECOUNT'))this.call('skillStackChange',p,id);});
  }
  resetCheckMap(id){
    const maps=this.stack(id)?.check_map;if(!maps)return;
    for(const trigger in maps)for(const group of ['condunit','condcard','condtiming'])for(const key in maps[trigger][group])maps[trigger][group][key][0]=0;
  }
  resetConditionRecords(s){
    s.resetConds?.forEach(id=>{need(this.b.condMap,id).prev=undefined;});
    s.resetDupConds?.forEach(id=>{need(this.b.condMap,id).duplicate_checks=[];});
  }
  use(id,value){
    const s=this.stack(id);if(s.inactive)return;
    // Native forEach semantics: captures initial length, reads entries at visit
    // time. A snapshot or for..of changes registration mutation behaviour.
    this.parents(s,p=>this.call('useParent',p,id,value));
    this.record('action_stack_use',s);
  }
  toggle(id,on){const s=this.stack(id);if(s.inactive)return;this.parents(s,p=>this.call('toggleParent',p,id,on));}
  remove(id,notify=true){
    const s=this.stack(id);if(s==null)return true;if(s.permanent)return false;
    this.call('unregisterStackEvents',s);
    delete s.timingMap;
    this.call('removeStack',id,notify);
    return true;
  }
  compare(s,r){return compareCondition(need(r,'stack_value_ineq'),need(s,'stack'),need(s,'stack_value'));}
  procStack(id,input,set=false,value,onRegist=false){
    const s=this.stack(id);if(s.inactive||s.stack_restriction==0)return;
    this.call('pushChangeData','stack',id);
    if(!set||input>0)this.parents(s,p=>this.call('stackParentBeforeChange',p,id,input,set,onRegist));
    const r=this.row(s),type=r.stack_type;
    const sub=(negative=0)=>this.setStack(id,set?input:input>-1?s.stack-input:negative);
    const notifyCompare=()=>{const ok=this.compare(s,r);this.call('pushRelicAction',id,ok);this.toggle(id,ok);};
    switch(type){
      case 'STACK_NONE': this.use(id,value);break;
      case 'STACK_DEDUCTION_COMPARE_GE_0':
        if(s.stack>=0){
          this.setStack(id,set?input:input>=0?s.stack-input:-1);
          if(s.stack<0&&s.stack_restriction>0&&--s.stack_restriction==0)this.call('pushRelicInactive',id);
          this.call('pushRelicAction',id,s.stack>=0);
        }break;
      case 'STACK_DEDUCTION_CYCLE':
      case 'STACK_DEDUCTION_CYCLE_RESET_COND':
      case 'STACK_DEDUCTION_CYCLE_RESTORE': {
        if(s.stack<=0)break;
        const before=s.stack,proposed=set?input:input>-1?s.stack-input:0;
        sub();
        if(s.stack<=0){
          this.use(id,value);
          // Even an unlimited negative restriction is decremented by the game.
          if(s.stack_restriction<0||s.stack_restriction>0){
            --s.stack_restriction;this.setStack(id,s.stack_value);
            if(type==='STACK_DEDUCTION_CYCLE_RESET_COND'){this.resetCheckMap(id);this.resetConditionRecords(s);}
            if(s.stack_restriction==0){
              this.call('pushRelicInactive',id);
              if(type!=='STACK_DEDUCTION_CYCLE_RESTORE')this.remove(id);
              return;
            }
          }
        }
        if(type==='STACK_DEDUCTION_CYCLE_RESET_COND')this.call('stackUI1049',s,before,proposed);
        break;
      }
      case 'STACK_DEDUCTION_CYCLE_NON_RESET':
        if(s.stack>0){sub();if(s.stack<=0&&!onRegist)this.use(id,value);}break;
      case 'STACK_DEDUCTION_PER_STACK_NON_RESET':
        if(s.stack>0){this.use(id,value);sub();}this.resetCheckMap(id);break;
      case 'STACK_COMPARE':
        this.setStack(id,set?input:input>-1?s.stack+input:0);notifyCompare();break;
      case 'STACK_DEDUCTION_COMPARE':sub(s.init_value);notifyCompare();break;
      case 'STACK_CHARGE':case 'STACK_COUNT':case 'STACK_COUNT_RESET_COND_ONLY':
        if(set)this.setStack(id,input);
        else if(input>-1)this.setStack(id,s.stack+input);
        else if(s.stack_value>-1)this.setStack(id,s.stack_value);
        else throw new RangeError('invalid_stack_input');
        break;
      default:throw new MissingConditionInput('execution.stack_type:'+type);
    }
    this.record('action_stack',s);
  }
  procUse(id,value){
    const s=this.stack(id);if(s.inactive||s.stack_restriction==0)return;
    this.call('pushChangeData','stack',id);
    const r=this.row(s);
    switch(r.stack_type){
      case 'STACK_NONE':this.use(id,value);break;
      case 'STACK_DEDUCTION_COMPARE_GE_0':if(s.stack>=0)this.use(id,value);break;
      case 'STACK_COMPARE':case 'STACK_DEDUCTION_COMPARE':
        if(this.compare(s,r)){this.use(id,value);if(s.stack_restriction>0&&--s.stack_restriction==0)this.call('pushRelicInactive',id);}break;
      case 'STACK_CHARGE':if(s.stack>0){this.setStack(id,s.stack-1);this.use(id,value);}break;
      default:throw new RangeError('invalid_stack_type_on_use:'+r.stack_type);
    }
    this.record('action_stack_use',s);
  }
  procReset(id){
    const s=this.stack(id),r=this.row(s),type=r.stack_type;
    if(type==='STACK_DEDUCTION_CYCLE_RESTORE'){s.inactive=false;s.stack_restriction=need(r,'stack_restriction_value');}
    else if(s.inactive||s.stack_restriction==0)return;
    this.call('pushChangeData','stack',id);
    this.parents(s,p=>this.call('resetParentOutline',p,id));
    this.resetCheckMap(id);this.resetConditionRecords(s);
    switch(type){
      case 'STACK_NONE':this.setStack(id,0);this.toggle(id,false);break;
      case 'STACK_DEDUCTION_COMPARE_GE_0':this.setStack(id,s.stack_value);this.call('pushRelicAction',id,s.stack>=0);break;
      case 'STACK_DEDUCTION_CYCLE':case 'STACK_DEDUCTION_CYCLE_RESET_COND':case 'STACK_DEDUCTION_CYCLE_NON_RESET':case 'STACK_DEDUCTION_PER_STACK_NON_RESET':case 'STACK_DEDUCTION_CYCLE_RESTORE':this.setStack(id,s.stack_value);break;
      case 'STACK_COMPARE':case 'STACK_DEDUCTION_COMPARE':{
        this.setStack(id,type==='STACK_COMPARE'?0:s.init_value);const ok=this.compare(s,r);this.call('pushRelicAction',id,ok);this.toggle(id,ok);break;
      }
      case 'STACK_CHARGE':case 'STACK_COUNT':this.setStack(id,0);break;
      case 'STACK_COUNT_RESET_COND_ONLY':break;
      default:throw new MissingConditionInput('execution.stack_type:'+type);
    }
    this.record('action_stack_reset',s);
  }
  group(event){
    const e=need(this.enums,'EVENT_CONDITION_TYPE');
    for(const [key,group] of [['UNIT','condunit'],['CARD','condcard'],['TIMING','condtiming']])if(event.condition_type===need(e,key))return group;
    throw new MissingConditionInput('execution.condition_type:'+event.condition_type);
  }
  onEvent(event,checkTiming=true,value,isTrigger=true,onRegist=false){
    const s=this.stack(event.stack_id);if(!s||s.inactive)return;
    if(value!=null)s.value_triggered=value;
    if(event.set&&!onRegist&&s.stack==event.set_value)return;
    if(!this.wt.isPreview&&this.b.client_log)this.call('conditionLog',event,s);
    this.call('pushChangeData','stack',event.stack_id);
    if(event.set){this.setStack(event.stack_id,event.set_value);this.call('notiCheck',event.stack_id);return;}
    const m=s.check_map?.[event.trigger];if(!m)return;
    const pair=need(need(m,this.group(event)),event.res_id),before=pair[0];
    pair[0]=pair.length>1?pair[0]+1:1;
    const after=pair[0],ui=()=>this.call('conditionUI1049',s,before,after);
    if(!isTrigger||!this.check(s,event.trigger)){ui();return;}
    const current=this.b.current_state;
    if(s.and_or?.[event.trigger]!==ANDOR.OR_TIMING&&s.timingType?.[event.trigger]===TIMING.OTHERS&&
      (!checkTiming||current===need(this.enums.LogicState,'TIMING_NONE')||!s.timingMap?.[event.trigger]?.includes(current))){
      if(event.stack_input==1)delete s.stack_input;else s.stack_input=event.stack_input;
      ui();return;
    }
    switch(event.trigger){
      case TRIGGER.STACK:this.procStack(event.stack_id,event.stack_input,undefined,value,onRegist);break;
      case TRIGGER.USE:this.procUse(event.stack_id,value);break;
      case TRIGGER.RESET:this.procReset(event.stack_id);break;
      case TRIGGER.REMOVE:this.remove(event.stack_id);break;
      default:throw new RangeError('invalid_trigger_type');
    }
    this.call('notiCheck',event.stack_id);ui();
  }
  offEvent(event){
    const s=this.stack(event.stack_id);if(!s||s.inactive)return;
    const was=this.check(s,event.trigger),m=s.check_map?.[event.trigger];if(!m)return;
    need(need(m,this.group(event)),event.res_id)[0]=0;
    const now=this.check(s,event.trigger);
    if(was&&!now&&event.trigger===TRIGGER.STACK&&this.row(s).stack_type==='STACK_NONE')this.toggle(event.stack_id,false);
  }
  onTimingCheck(id,state){
    const s=this.stack(id);if(!s||s.inactive||!s.timingMap)return;
    const map=s.timingMap;let changed=false;
    for(const t of [TRIGGER.STACK,TRIGGER.USE,TRIGGER.RESET,TRIGGER.REMOVE]){
      // Native checks only the first two configured timing entries here.
      if(!(t in map)||(map[t][0]!=state&&map[t][1]!=state))continue;
      if(!this.check(this.stack(id)??null,t))continue;
      if(t===TRIGGER.STACK)this.procStack(id,s.stack_input??1);
      else if(t===TRIGGER.USE)this.procUse(id);
      else if(t===TRIGGER.RESET)this.procReset(id);
      else this.remove(id);
      changed=true;
    }
    if(changed)this.call('notiCheck',id);
  }
  // Connect existing original-order predicates to the mutating stack layer.
  dispatchUnit({eventType,params,value,rowsById,hooks,enums}){
    return dispatchUnitCondition({worktable:this.wt,eventType,params,value,rowsById,enums,mode:'applyNotifications',
      hooks:{...hooks,onEvent:(...a)=>this.onEvent(...a),offEvent:(...a)=>this.offEvent(...a)}});
  }
}
