// EventStackHelper use/on/off/remove parent callbacks, independently handported.
// Source scope and creation references: evidence/stack-parents/HANDPORT-SCOPE.md.
// Existing SKILL/CARD/MONSTER implementations remain the only owners of them.
export const STACK_PARENT_BINDINGS={
 useStackParent:'useStackParent',toggleStackParent:'toggleStackParent',removeStackParent:'removeStackParent',
 onUseColor:'onUseColor',offUseColor:'offUseColor',checkColorConditionNeedsPerChar:'checkColorConditionNeedsPerChar',
 applySingularityCsInfo:'applySingularityCsInfo',applySingularityDefaultCsInfo:'applySingularityDefaultCsInfo',
 registerSingularityCsController:'registerSingularityCsController',getSingularityCsInfoByStackID:'getSingularityCsInfoByStackID',
 onUseSingularityCsController:'onUseSingularityCsController',flushSingularityImmediateTriggers:'flushSingularityImmediateTriggers'
};
export class StackParentRuntime {
 constructor(e){this.e=e;this.b=e.b;this.db=e.db;}
 call(name,...args){return this.e.call(name,...args);}
 invalid(parent){throw this.call('ContentError','err:invalid_stack_from:'+parent.from);}
 // use callback0x29000: default throws, COLOR alone is a direct-return case.
 useStackParent(parent,id,value){
  switch(parent.from){
   case 'MISSION':{
    const stack=this.b.stackMap[id];
    if(!this.b.mission_comp?.includes(stack.res_id))(this.b.mission_comp??=[]).push(stack.res_id);
    if(this.b.stackParentMap[stack.stack_id].length==1)this.call('procRemoveStack',id,true);
    return;
   }
   case 'SKILL':this.e.skills.onUse(parent.parent_id,parent.useType,id,undefined,value,parent.index);return;
   case 'CARD':this.call('useParent:CARD',parent,id,value);return;
   case 'MONSTER':this.call('useParent:MONSTER',parent,id,value);return;
   case 'MONSTER_PATTERN':this.call('useParent:MONSTER_PATTERN',parent,id,value);return;
   case 'COLOR':return; // source @417 -> @557, no callback
   case 'SINGULARITY':{
    const stack=this.b.stackMap[id];
    this.e.pushAction({id:this.b.last_action_id++,type:'action_stack_use',source_id:stack.stack_id,event_stack:stack,stack_snapshot:stack.stack});
    this.call('onUseSingularityCsController',id);return;
   }
   default:return this.invalid(parent); // USER/CUSTOM_FINISH are not use cases.
  }
 }
 // procStackOn callback0x1cd00 / procStackOff callback0x1bc00 have no error
 // default. Only SKILL/CARD/COLOR have work; SINGULARITY explicitly returns.
 toggleStackParent(parent,id,on){
  switch(parent.from){
   case 'SKILL':if(on)this.e.skills.onUse(parent.parent_id,parent.useType,id,false,undefined,parent.index);else this.e.skills.offUse(parent.parent_id,parent.useType,id);return;
   case 'CARD':this.call('toggleParent:CARD',parent,id,on);return;
   case 'COLOR':this.call(on?'onUseColor':'offUseColor',parent.keyword);return;
   default:return; // Native default, including unknown from, has no side effect.
  }
 }
 // remove callback0x2a600: only MISSION/SINGULARITY are explicit empty cases.
 removeStackParent(parent){
  switch(parent.from){
   case 'SKILL':return; // SkillEffectProc.onRemove0x1ae900 is a proven empty method.
   case 'CARD':this.call('removeParent:CARD',parent);return;
   case 'MONSTER':this.call('removeParent:MONSTER',parent);return;
   case 'MONSTER_PATTERN':this.call('removeParent:MONSTER_PATTERN',parent);return;
   case 'MISSION':case 'SINGULARITY':return;
   default:return this.invalid(parent); // Includes COLOR/USER/CUSTOM_FINISH.
  }
 }
 // BattleWT0xafd00/0xb0500. Off rechecks every same-key COLOR parent first;
 // another still-satisfied stack keeps the shared color flag enabled.
 onUseColor(keyword){this.call('pushChangeData','color',keyword);this.b.colorMap[keyword]=true;}
 offUseColor(keyword){
  for(const id in this.b.stackParentMap){const parents=this.b.stackParentMap[id];if(parents&&parents.some(p=>p.from==='COLOR'&&p.keyword===keyword)&&this.call('checkStack',Number(id)))return;}
  this.call('pushChangeData','color',keyword);this.b.colorMap[keyword]=false;
 }
 checkColorConditionNeedsPerChar(row){
  const controls=this.call('loadGameDBbyKey','condition_control',row.link_condition_control_key);
  for(const id in controls)for(const unitId of this.db.array(controls[id].link_cond_unit_id)){
   const unit=this.db.table('cond_unit')[unitId];
   if(unit&&['CONDITION_UNIT_CHAR','CONDITION_UNIT_CHAR_PARTNER','CONDITION_UNIT_CASTER','CONDITION_UNIT_OWNER'].includes(unit.condition_unit_type))return true;
  }return false;
 }
 // BattleWT0x25600/0x26800. Controller applications are independent instances;
 // the default application intentionally omits forceIndependent and has no result.
 applySingularityCsInfo(info){
  const id=this.b.char.id,cs=this.call('procAddCS',id,info.cs_res_id,info.cs_value,id,false,'MATHSIGN_ADD',false,true,id,-1,{origin:'SINGULARITY',forceIndependent:true});
  return cs>0?[cs]:[];
 }
 applySingularityDefaultCsInfo(info){const id=this.b.char.id;this.call('procAddCS',id,info.cs_res_id,info.cs_value,id,false,'MATHSIGN_ADD',false,true,id,-1,{origin:'SINGULARITY'});}
 registerSingularityCsController(info){
  if(!info.condition_id||info.condition_id=='none')throw this.call('ContentError','err:hyperspace_singularity_condition_empty:'+info.cs_res_id);
  const row=this.db.table('condition')[info.condition_id];
  if(!row)throw this.call('ContentError','err:hyperspace_singularity_condition_not_found:'+info.condition_id);
  this.call('createEventStack',row,'SINGULARITY',0,'TRIGGER','NONE',this.b.char.id,this.b.char.id,false);
 }
 getSingularityCsInfoByStackID(id){
  if(!this.b.stackParentMap[id]?.some(p=>p.from=='SINGULARITY'))return;
  return this.e.state.worktables.BattleInitWorktable.battle_init.singularity_cs_infos?.[0];
 }
 onUseSingularityCsController(id){const info=this.call('getSingularityCsInfoByStackID',id);if(!info)return;this.call('applySingularityCsInfo',info);this.call('flushSingularityImmediateTriggers');}
 // 0x29c00: backward splices + unshift preserve initial candidate order.
 // 100 passes is the native loop limit, not an invented recursion workaround.
 flushSingularityImmediateTriggers(){
  let passes=0;
  while(this.b.check_timing_all&&this.b.check_timing_all.length>0&&passes++<100){
   const pending=this.b.check_timing_all,selected=[];
   for(let i=pending.length-1;i>=0;i--){const skill=this.b.skillMap[pending[i]];if(skill?.parent.type=='CS'&&this.b.csMap[skill.parent.id]?.origin=='SINGULARITY'){selected.unshift(pending[i]);pending.splice(i,1);}}
   if(pending.length==0)this.b.check_timing_all=undefined;
   if(selected.length==0)break;
   (this.b.check_timing_all_temp??=[]).push(...selected);
   selected.forEach(id=>this.call('addSkillTriggered',id));
   this.call('procSingularityTriggeredImmediate');
  }
 }
}
