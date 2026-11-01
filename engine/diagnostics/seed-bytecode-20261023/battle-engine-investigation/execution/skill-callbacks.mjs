// SkillEffectProc.onUse/offUse outer control flow. Card-ban application,
// targeting and passive registration remain explicit mandatory ports.
// Sources: evidence/skill-callbacks, bytecode 0xf000001aaa00 / 0xf000001acd00.
import {need,MissingConditionInput} from '../conditions/condition-core.mjs';
export class SkillCallbacks {
  constructor({worktable,skills,enums,ports}){this.wt=worktable;this.b=need(worktable,'battle');this.rows=skills;this.enums=enums;this.ports=ports;}
  call(name,...args){const fn=this.ports[name];if(typeof fn!=='function')throw new MissingConditionInput('execution.port.'+name);return fn(...args);}
  row(s){return need(this.rows,s.res_id,'skill_eff:'+s.res_id);}
  refreshAvailability(s,stackId,on){
    if(on)delete s.usable;else s.usable=false;
    if(s.parent.type===need(this.enums.SkillParentType,'CARD')){
      const c=this.b.cardMap[s.parent.id];
      if(c!=null){if(c.handOutline&&stackId in c.handOutline)c.handOutline[stackId]=on;this.call('pushChangeData','card',c.id);}
    }else{
      const r=this.row(s);
      if(r.eff==='SKILL_EFF_CARD_USE_BAN')this.call('cardUseBan',s,on);
      else if(r.eff==='SKILL_EFF_TUTORIAL_BAN_CARD_USE')this.call('tutorialCardUseBan',s,on);
    }
    const info=s.add_passive_info;
    if(info&&info[3]==on){
      if(on)this.call('addPassiveSkill',s.skill_id,info[0],info[1],info[2]);
      else this.call('removePassiveSkillBySkillID',s.skill_id,info[0],info[1]);
      info[3]=!on;
    }
  }
  onUse(skillId,type,stackId,trigger=true,value,index){
    if(trigger==null)trigger=true;
    const s=this.b.skillMap[skillId];if(s==null)return;
    this.call('pushChangeData','skill',skillId);
    const types=this.enums.STACK_PROC_TYPE;
    if(type===need(types,'AVAILABLE')){
      this.call('pushLog','skill_usable_true : '+s.res_id);
      if(s.passiveDuring!==false)this.refreshAvailability(s,stackId,true);
    }else if(type===need(types,'TRIGGER')){
      if(trigger||this.row(s).eff==='SKILL_EFF_CS_ADD_COND_AUTO'){
        const stack=need(this.b.stackMap,stackId);
        this.call('pushLog','skill_triggered : '+s.skill_id+':'+s.res_id);
        this.call('addSkillTriggered',skillId,value??stack.value_triggered,undefined,stack.rita_value);
      }
    }else if(type===need(types,'DURING_EFF')){
      if(trigger&&index!=null){
        const stack=need(this.b.stackMap,stackId);
        this.call('pushLog','during_skill_triggered : '+s.skill_id+':'+s.res_id);
        this.call('addSkillTriggered',s.skill_id,value??stack.value_triggered,true,stack.rita_value);
      }
    }
    // Native default intentionally has no callback, e.g. VALUECOUNT.
  }
  offUse(skillId,type,stackId){
    const s=this.b.skillMap[skillId];if(s==null)return;
    this.call('pushChangeData','skill',skillId);
    const types=this.enums.STACK_PROC_TYPE;
    if(type===need(types,'AVAILABLE')){
      this.call('pushLog','skill_usable_false : '+s.res_id);
      this.refreshAvailability(s,stackId,false);
    }else if(type===need(types,'TRIGGER')&&this.row(s).eff==='SKILL_EFF_CS_ADD_COND_AUTO'){
      this.call('pushLog','skill_triggered_off : '+s.skill_id+':'+s.res_id);
      this.call('addSkillTriggered',skillId);
    }
  }
}
