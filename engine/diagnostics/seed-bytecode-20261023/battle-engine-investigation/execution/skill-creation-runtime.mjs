// Hand-port of SkillEffectProc.createSkill 0x19fc00 and the construction-time
// EventStackHelper.isTriggered 0x28300. Sources: evidence/batch2-skill/.
// Recovered JavaScript is evidence only and is never imported or executed.
import {MissingBattleRule} from './resource-store.mjs';
import {compareCondition,TRIGGER,TIMING} from '../conditions/condition-core.mjs';

// continue_skill 0x13900 / 0x14600: resource names are normalized only at the
// resource boundary; SkillEff instances retain the native numeric enum values.
const CATEGORY={VALUE_CATEGORY_NONE:0,VALUE_CATEGORY_EFF_VALUE:1,VALUE_CATEGORY_EFF_CARD_TARGET_COUNT:2,VALUE_CATEGORY_EFF_COUNT_VALUE:3,VALUE_CATEGORY_EFF_CONDITION_VALUE_0:4,VALUE_CATEGORY_EFF_CONDITION_VALUE_1:5};
const OPERATION={OPERATION_NONE:0,OPERATION_TERM_VALUE_MULTIPLE:1,OPERATION_TERM_VALUE_MULTIPLE_BEFORE_ROUND:2,OPERATION_TERM_VALUE_ADD:3,OPERATION_TERM_VALUE_SET:4};
const fields='res_id stack_trigger stack_value0 stack_value1 stack_count0 stack_count1 card_triggered bind_stack_triggered target_triggered add_passive_info caster_id usable passiveDuring termValue skill_id parent action_char_id stat_source eff_opts eff_opt_multiple_link link_cs_ids target_unit_type_opt eff_value r_spark_value r_spark_multiply_pct_value r_spark_count_value cost_used changed_value changed_count_value value_triggered rita_value cost_random_index cost_random duringConds duringEffs duringPassives from_ego from_potential from_collapse from_relic ego_attack dmgAttrAdd shieldAttrAdd triggerLog trigger_cs_cause_skill_id pyeonrin_trigger_group_id log_all_cards target_changed_motion last_count_value final_count_value before_fix_count_value randValues removed randTcslc randTcslcValue rand randValue randCount randCountValue tipera_indices cs_value_category cs_operation_rule leech_shield leech_hp tipera_disabled'.split(' ');
function nativeEnum(value,group){
  if(value==null||typeof value==='number')return value;
  if(Object.hasOwn(group,value))return group[value];
  throw new MissingBattleRule('createSkill.cs_enum',{value});
}
// SkillEff 0xdb00: enabled means the own property is absent, not true.
function setUsable(skill,on){if(on)delete skill.usable;else skill.usable=false;}

export class SkillCreationRuntime {
  constructor(e){this.e=e;this.w=e.wt;this.b=e.b;this.db=e.db;}
  call(name,...args){return this.e.call(name,...args);}
  get stage(){const stage=(this.w.battle_stage_worktable??this.e.state?.worktables?.BattleStageWorktable)?.battle_stage;
    if(!stage)throw new MissingBattleRule('BattleStageWorktable.battle_stage');return stage;}
  // Native getCurrentState 0x8f500 is precisely battle.current_state. The
  // timing guard precedes resource lookup, including for missing/inactive stacks.
  isTriggered(id){
    const stack=this.b.stackMap[id];if(!stack||stack.inactive)return false;
    if(stack.timingType?.[TRIGGER.USE]==TIMING.OTHERS&&!stack.timingMap?.[TRIGGER.USE]?.includes(this.b.current_state))return false;
    const row=this.db.get('condition',stack.res_id);
    if(['STACK_DEDUCTION_CYCLE_NON_RESET','STACK_DEDUCTION_PER_STACK_NON_RESET'].includes(row.stack_type))return stack.stack==0;
    if(['STACK_COMPARE','STACK_DEDUCTION_COMPARE'].includes(row.stack_type))return compareCondition(row.stack_value_ineq,stack.stack,stack.stack_value);
    return false; // Native default, including STACK_NONE and STACK_COUNT.
  }
  createSkill(res,caster,parent,category,rule,termValue,charId,skipTiming){
    // SkillEff field initializer 0xfb00 creates all of these own undefined
    // fields. The setters below preserve the native deletion semantics.
    const s=Object.fromEntries(fields.map(key=>[key,undefined]));
    s.skill_id=this.b.skill_id++;this.b.skillMap[s.skill_id]=s;
    const cat=nativeEnum(category,CATEGORY),op=nativeEnum(rule,OPERATION);
    if(cat!==0)s.cs_value_category=cat;if(op!==0)s.cs_operation_rule=op;
    s.parent=parent;this.e.pushChangeData('skill',s.skill_id);
    s.action_char_id=[4,5,6].includes(charId)?charId-3:charId;
    const row=this.db.get('skill_eff',res);let owner=caster;
    if(parent.type==='CS'){
      const cs=this.b.csMap[parent.id];
      if(cs){owner=cs.owner_id;s.from_ego=cs.from_ego;s.from_collapse=cs.from_collapse;s.from_relic=cs.from_relic;}
    }
    s.res_id=res;
    for(const [field,key] of [['eff_opts','eff_opt'],['eff_opt_multiple_link','eff_opt_multiple_link'],['link_cs_ids','link_cs_id'],['target_unit_type_opt','target_unit_type_opt']]){
      let arr=this.db.array(row[key]);
      if(field==='link_cs_ids')arr=arr.map(id=>this.stage.break_cs_changes?.[id]??id);
      if(arr.length)s[field]=arr;
    }
    s.caster_id=caster;
    // SkillEff.setTermValue 0xc900.
    if(termValue==0)delete s.termValue;else s.termValue=termValue;
    s.eff_value=this.call('initSkillEffValue',row,charId);s.stat_source=caster;
    if(parent.type==='CS'){
      const cs=this.b.csMap[parent.id];
      if(cs)s.stat_source=this.call('getStatSource',row.eff_value_stat_source_target,cs.owner_id,cs.caster_id,cs.char_id);
    }else if(parent.type==='CARD'){
      const c=this.b.cardMap[parent.id];
      if(!c)throw new MissingBattleRule('invalid_createSkill_parent_card',{parent});
      s.stat_source=this.call('getStatSource',row.eff_value_stat_source_target,c.caster_id,c.caster_id,c.char_id);
    }else if(parent.type==='SKILL'){
      const p=this.b.skillMap[parent.id];
      if(!p)throw new MissingBattleRule('invalid_createSkill_parent_skill',{parent});
      if(p.parent.type==='CARD'){
        const c=this.b.cardMap[p.parent.id];
        if(!c)throw new MissingBattleRule('invalid_createSkill_parent_card',{parent:p.parent});
        s.stat_source=this.call('getStatSource',row.eff_value_stat_source_target,c.caster_id,c.caster_id,c.char_id);
      }else s.stat_source=p.stat_source;
    }else s.stat_source=this.b.char.id;

    for(let index=0;;index++){
      const childRes=row[`during_eff_${index}_link_skill_eff_id`];
      if(childRes==null||childRes==='none'||childRes==='[]')break;
      if(childRes==s.res_id)continue;
      const condition=row[`during_eff_${index}_link_condition_id`];
      if(condition==null)throw new MissingBattleRule('invalid_skill_eff_during_condition',{res,index});
      const child=this.call('createSkill',childRes,caster,{id:s.skill_id,type:'SKILL'},0,0,0,charId,true);
      (s.duringEffs??=[]).push(child.skill_id);
      if(condition==='none'){
        (s.duringPassives??=[]).push(child.skill_id);
        setUsable(child,false);child.passiveDuring=false;
        this.call('addPassiveSkill',child.skill_id,caster,false,s.skill_id);
      }else{
        const id=this.call('getEventStack',{worktable:this.w,res_id:condition,from:'SKILL',parent_id:child.skill_id,use:'DURING_EFF',remove:'REMOVE',caster_id:caster,owner_id:owner,index});
        (s.duringConds??=[]).push(id);
        const stack=this.b.stackMap[id];this.e.stacks.procReset(id);stack.inactive=true;
      }
    }

    let triggered=false;
    // Native reads cardMap[parent.id] before testing the parent type.
    const card=this.b.cardMap[parent.id];
    const makeStack=(condition,use)=>this.call('getEventStack',{worktable:this.w,res_id:condition,from:'SKILL',parent_id:s.skill_id,use,remove:'REMOVE',caster_id:caster,owner_id:owner});
    const setOutline=(id,on)=>{
      const stack=this.b.stackMap[id];
      if(card!=null&&this.db.array(row.outline_link_condition_id).includes(stack.res_id))(card.handOutline??={})[id]=on;
    };
    if(row.eff_link_condition_id==='never')setUsable(s,false);
    else if(row.operation==='OPERATION_TRIGGER'&&row.eff_link_condition_id==='none'){
      setUsable(s,true);if(!skipTiming)(this.b.check_timing_all??=[]).push(s.skill_id);
    }else if(row.eff_link_condition_id!=='none'){
      if(parent.type==='CS'&&row.operation==='OPERATION_PASSIVE'){
        s.stack_trigger=makeStack(row.eff_link_condition_id,'AVAILABLE');
        setUsable(s,this.call('checkStack',s.stack_trigger));
      }else if(parent.type==='CS'||(parent.type==='CARD'&&row.operation==='OPERATION_TRIGGER')){
        s.stack_trigger=makeStack(row.eff_link_condition_id,'TRIGGER');
        setUsable(s,true);triggered=this.call('isTriggered',s.stack_trigger);
      }else{
        s.stack_trigger=makeStack(row.eff_link_condition_id,'AVAILABLE');
        const available=this.call('checkStack',s.stack_trigger);
        setUsable(s,available);setOutline(s.stack_trigger,!!available);
      }
    }else setUsable(s,true);

    if(s.from_relic){
      const cs=this.b.csMap[parent.id];
      if(cs){
        const resource=this.db.get('cs',cs.res_id),type=resource.relic_effect_type;
        const mapKey=type==='EFFECT_TYPE_TOGGLE'&&row.eff==='SKILL_EFF_CS_ADD_COND_AUTO'?'relicToggleMap':type==='EFFECT_TYPE_COMMON'?'relicStackMap':undefined;
        if(mapKey)for(const id in this.b.relicMap){
          if(s.stack_trigger&&this.b.relicMap[id].res_id==s.from_relic){
            if(!this.b[mapKey])throw new MissingBattleRule('createSkill.relic_map_input',{mapKey});
            this.b[mapKey][s.stack_trigger]=Number(id);break;
          }
        }
      }
    }
    for(const [field,key] of [['stack_value0','eff_value_0_link_condition_id'],['stack_value1','eff_value_1_link_condition_id'],['stack_count0','eff_count_value_0_link_condition_id'],['stack_count1','eff_count_value_1_link_condition_id']]){
      if(row[key]==='none')continue;
      s[field]=makeStack(row[key],'VALUECOUNT');
      if(parent.type==='CARD')setOutline(s[field],this.b.stackMap[s[field]].stack>0);
    }
    if(triggered)this.e.skills.onUse(s.skill_id,'TRIGGER',s.stack_trigger??-1,true);
    const fixed='VALUE_RANDOM_RANGE_VALUE_OPT_FIXED_BEFORE_USE';
    if(row.eff_value_type_1===fixed||row.eff_value_type_2===fixed)this.call('calcValue',s.skill_id);
    if(row.eff_count_value_type===fixed)this.call('calcCountValue',s.skill_id);
    if(row.target_card_set_list_count_type===fixed)this.call('calcTargetCardSetListCount',s.skill_id);
    return s;
  }
}
