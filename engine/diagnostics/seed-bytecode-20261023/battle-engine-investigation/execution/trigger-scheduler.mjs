// BattleWorktable.addSkillTriggered, source in effects/queue-worktable.
// Selection and CS consumption are dispatched at their original positions.
import {queueName,insertTrigger} from './trigger-queues.mjs';
import {MissingBattleRule} from './resource-store.mjs';
export class TriggerScheduler {
  constructor({worktable,resources,ports,record}){this.wt=worktable;this.b=worktable.battle;this.db=resources;this.ports=ports;this.record=record;}
  call(name,...args){const fn=this.ports[name];if(typeof fn!=='function')throw new MissingBattleRule(name,{args});return fn(...args);}
  add(skillId,value,during=false,ritaValue,causeSkillId,groupId,snapshot,overrideTargets){
    if(during==null)during=false;
    const skill=this.b.skillMap[skillId];
    if(this.b.battle_step_mode?.next_wave){
      const blocked=skill!=null&&this.call('isWaveTransitionBlockedSkill',skillId);
      if(!blocked){
        if(!(skill!=null&&this.call('isMonsterByID',skill.caster_id))){
          (this.b.nextWaveDeferredAddTrig??=[]).push({skill_id:skillId,value,during,rita_value:ritaValue,
            trigger_cs_cause_skill_id:causeSkillId,pyeonrin_trigger_group_id:groupId,
            trigger_snapshot:snapshot??{card_triggered:skill?.card_triggered,bind_stack_triggered:skill?.bind_stack_triggered}});
        }return;
      }
    }
    if(skill==null||skill.removed)return;
    if(snapshot!=null){skill.card_triggered=snapshot.card_triggered;skill.bind_stack_triggered=snapshot.bind_stack_triggered;}
    const row=this.db.get('skill_eff',skill.res_id);
    // Source's guard records before increment and rejects only values > 10000.
    this.record?.({kind:'trigger-request',skill_id:skillId,res_id:skill.res_id});
    if(++this.wt.skillTriggeredCount>10000)throw new RangeError('err:skill_triggered_loop:'+skill.res_id);
    const immediate=this.db.array(row.run_check_opt).includes('immediate');
    const hasMotion=row.operation_trigger_motion_type!=='none'||skill.parent.type==='CS';
    const name=queueName({immediate,motion:hasMotion,parentIsCS:skill.parent.type==='CS',during:!!during});
    this.b[name]??=[];
    let target;
    if((row.target_unit_type!=='TARGET_UNIT_NONE'&&row.action_timing_target_renewal_flag==='NO')||
        (hasMotion&&row.target_unit_type==='TARGET_UNIT_SELECTED')){
      target=this.call('getSkillEffTarget',skillId);
      if(row.target_save_renewal_flag==='YES')this.call('saveSkillTarget',skillId,target,false);
    }else if(row.target_unit_type==='TARGET_UNIT_NONE'&&['CARD_SET_TRIGGERED','CARD_SET_TRIGGERED_OWNER'].includes(row.target_card_set)&&skill.card_triggered!=null){
      target=this.call('getTargetCards',skillId,false,false).target_cards_id;
    }else if(row.target_unit_type==='TARGET_UNIT_TRIGGERED'&&skill.target_triggered!=null)target=skill.target_triggered;
    if(overrideTargets?.length>0)target=overrideTargets;
    const entry={skill_id:skillId,target,priority:this.db.number(row,'run_priority'),value,
      card_triggered:skill.card_triggered,bind_stack_triggered:skill.bind_stack_triggered};
    if(ritaValue!=null)entry.rita_value=ritaValue;
    if(causeSkillId!=null)entry.trigger_cs_cause_skill_id=causeSkillId;
    if(groupId!=null)entry.pyeonrin_trigger_group_id=groupId;
    if(this.wt.pyeonrin_reaction_group_id!=null)entry.pyeonrin_reaction_group_id=this.wt.pyeonrin_reaction_group_id;
    insertTrigger(this.b,name,entry);
    this.record?.({kind:'enqueue',queue:name,entry:structuredClone(entry)});
    if(skill.parent.type==='CS'){
      const cs=this.b.csMap[skill.parent.id];
      if(cs){
        const res=this.db.get('cs',cs.res_id),types=[res.term_type_1,res.term_type_2];
        const valueTriggered=types.includes('TERM_VALUE_TRIGGERED');
        if(valueTriggered){value=Math.min(value??1,Math.max(cs.term_value,1));entry.value=value;}
        const prevLogs=this.wt.deferredSubLogs,prevActions=this.wt.deferredActions;
        this.wt.deferredSubLogs=[];this.wt.deferredActions=[];
        // Conditions reduce duration AFTER enqueue. Implementations must preserve
        // nested notifications; failing here invalidates the whole fork.
        this.call('consumeTriggerTerms',cs,skill,types,value,skillId===cs.skillEffs[cs.skillEffs.length-1]);
        if(this.wt.deferredSubLogs.length)entry.deferred_logs=this.wt.deferredSubLogs;
        if(this.wt.deferredActions.length)entry.deferred_actions=this.wt.deferredActions;
        this.wt.deferredSubLogs=prevLogs;this.wt.deferredActions=prevActions;
      }
    }
  }
}
