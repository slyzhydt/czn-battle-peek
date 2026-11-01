// Handports: EventStackHelper.getEventStack 0x16300 / createEventStack 0x7a00,
// EventStack field constructor/helpers, and EventSystem.registUnitEvent's
// CONDITION_CHAR_CUR_HP_CHANGE registration (the native probe does nothing).
import {MissingBattleRule} from './resource-store.mjs';
const fields='res_id stack_restriction init_value stack_value timingMap stack_id stack stack_input unitKeys cardKeys timingKeys timingType check_map and_or caster_id owner_id permanent resetConds resetDupConds inactive value_triggered rita_value value_accrue'.split(' ');
export class StackRegistrationRuntime {
 constructor(e){this.e=e;this.b=e.b;this.w=e.wt;this.db=e.db;}
 get stage(){const stage=(this.w.battle_stage_worktable??this.e.state?.worktables?.BattleStageWorktable)?.battle_stage;if(!stage)throw new MissingBattleRule('BattleStageWorktable.battle_stage');return stage;}
 call(name,...args){return this.e.call(name,...args);}
 // GameResDB.loadGameDBbyKey 0x1b200 probes zero-padding width, then stops
 // at the first missing numbered row; prefix filtering would be incorrect.
 loadGameDBbyKey(table,key,includeUnused=false){if(key==='none')return {};const rows=this.db.table(table),out={};let width=0;
  while(!rows[`${key}_${String(1).padStart(width,'0')}`]){if(++width>10){this.e.record?.({kind:'diagnostic',message:'loadGameDBbyKey:no_items',table,key});return out;}}
  for(let i=1;;i++){const id=`${key}_${String(i).padStart(width,'0')}`,row=rows[id];if(!row)break;if(includeUnused||row.no_use!=='YES')out[id]=row;}return out;
 }
 getLogicState(timing,ally){const l=this.e.enums.LogicState;
  if(timing==='TIMING_ALLY_SEQUENCE_START')return ally?l.TIMING_PLAYER_SEQUENCE_START:l.TIMING_MON_SEQUENCE_START;
  if(timing==='TIMING_ENEMY_SEQUENCE_START')return ally?l.TIMING_MON_SEQUENCE_START:l.TIMING_PLAYER_SEQUENCE_START;
  return timing==='TIMING_BATTLE_START'?l.TIMING_BATTLE_BEFORE_FIRST_TURN:l[timing];
 }
 getEventStack(a){const row=this.db.get('condition',a.res_id),parent={parent_id:a.parent_id,from:a.from,useType:a.use,removeType:a.remove};if(a.index!=null)parent.index=a.index;
  if(row.condition_type==='CONDITION_USER'){const id=this.b.userStackMap[row.id];(this.b.stackParentMap[id]??=[]).push(parent);return id;}
  return this.createEventStack(row,a.from,a.parent_id,a.use,a.remove,a.caster_id,a.owner_id,false,a.index).stack_id;
 }
 createEventStack(row,from,parentId,use,remove,caster,owner,permanent=false,index){const b=this.b,s=Object.fromEntries(fields.map(k=>[k,undefined]));s.stack=0;s.res_id=row.id;
  let ally=!this.e.getMonster(caster),cardId=-1;
  if(from==='CARD')cardId=parentId;
  else if(from==='SKILL'){const sk=b.skillMap[parentId];if(sk){if(sk.parent.type==='CS'&&b.csMap[sk.parent.id])ally=!this.e.getMonster(b.csMap[sk.parent.id].owner_id);const c=this.call('getParentCard',sk.skill_id);if(c)cardId=c.id;}}
  if(permanent)s.permanent=true;if(b.chars.some(c=>c.id==owner)||(b.assault_fourth_char!=null&&b.assault_fourth_char.id==owner))owner=b.char.id;
  s.caster_id=caster;s.owner_id=owner;s.stack_id=b.stack_id++;b.stackMap[s.stack_id]=s;this.e.pushChangeData('stack',s.stack_id);
  if(permanent)b.userStackMap[row.id]=s.stack_id;else {const p={parent_id:parentId,from,useType:use,removeType:remove};if(index!=null)p.index=index;b.stackParentMap[s.stack_id]=[p];}
  s.stack_restriction=this.db.number(row,'stack_restriction_value');s.stack_value=this.db.number(row,'stack_value');
  if(['STACK_DEDUCTION_CYCLE','STACK_DEDUCTION_CYCLE_RESET_COND','STACK_DEDUCTION_CYCLE_NON_RESET','STACK_DEDUCTION_PER_STACK_NON_RESET','STACK_DEDUCTION_COMPARE_GE_0','STACK_DEDUCTION_CYCLE_RESTORE'].includes(row.stack_type))s.stack=s.stack_value;
  const init=this.db.number(row,'stack_initial_value');if(init>=0)s.stack=init;s.init_value=s.stack;
  const pending=[];
  for(const c of Object.values(this.loadGameDBbyKey('condition_control',row.link_condition_control_key))){const trigger={stack:0,use:1,reset:2,remove:3}[c.type]??0;
   (s.and_or??={})[trigger]={AND:0,OR:1,OR_TIMING:2}[c.and_or];
   const units=this.db.array(c.link_cond_unit_id),cards=this.db.array(c.link_cond_card_id),times=this.db.array(c.link_cond_timing_id),timings=[this.getLogicState(c.battle_timing_0,ally),this.getLogicState(c.battle_timing_1,ally)];
   if(timings.some(t=>t!==this.e.enums.LogicState.TIMING_NONE)){(s.timingMap??={})[trigger]=timings;(s.timingType??={})[trigger]=1;for(const t of timings)if(t!==this.e.enums.LogicState.TIMING_NONE)(b.timingMap[t]??=[]).push(s.stack_id);}
   if(!units.length&&!cards.length&&!times.length)continue;
   const map=((s.check_map??={})[trigger]??={condunit:{},condcard:{},condtiming:{}});
   for(const id of units){const r=this.db.get('cond_unit',id);map.condunit[id]=[0];if(r.condition_unit_count>1)map.condunit[id].push(Number(r.condition_unit_count));
    const result=this.registUnitEvent(b.eventMaps,s.stack_id,trigger,r,caster,owner);(s.unitKeys??=[]).push(result.key);if(result.triggered)pending.push([result.event,result.value_triggered]);}
   for(const id of cards){const r=this.db.get('cond_card',id);map.condcard[id]=[0];if(r.condition_card_count>1)map.condcard[id].push(Number(r.condition_card_count));
    const result=this.call('registCardEvent',b.eventMaps,s.stack_id,trigger,r,cardId,caster);(s.cardKeys??=[]).push({key1:result.key1,key2:result.key2});if(result.triggered)pending.push([result.event,result.value_triggered]);}
   for(const id of times){const r=this.db.get('cond_timing',id);map.condtiming[id]=[0];
    // Native tests condition_unit_timing, then appends condition_timing_count.
    if(r.condition_unit_timing>1)map.condtiming[id].push(Number(r.condition_timing_count));
    const result=this.e.timing.registerTiming(b.eventMaps,s.stack_id,trigger,r);(s.timingKeys??=[]).push(result.key);if(result.triggered)pending.push([result.event,undefined]);}
  }
  if(['STACK_COMPARE','STACK_DEDUCTION_COMPARE','STACK_DEDUCTION_COMPARE_GE_0'].includes(row.stack_type)&&s.stack_value===-1)throw new MissingBattleRule('invalid_stack_value',{id:row.id});
  if(use!=='DURING_EFF')pending.forEach(([event,value])=>this.e.stacks.onEvent(event,undefined,value,undefined,true));return s;
 }
 registUnitEvent(maps,stackId,trigger,row,caster,owner,override){
  return this.call('registUnitEvent.other',maps,stackId,trigger,row,caster,owner,override);
 }
}
