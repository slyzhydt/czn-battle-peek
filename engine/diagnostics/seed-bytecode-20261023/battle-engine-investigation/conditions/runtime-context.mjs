import {MissingConditionInput,need,compareCondition} from './condition-core.mjs';

// All inputs and callbacks refer to an independently reconstructed worktable.
// No target bytecode, decompiler output, or live game methods are executed here.
export function createUnitRuntimeFrame(input) {
  for(const key of ['worktable','event','row','eventType','params','valueTriggered'])
    if(!Object.hasOwn(input,key)||input[key]===undefined)throw new MissingConditionInput('runtime.'+key);
  if(!Array.isArray(input.params))throw new TypeError('runtime.params must be the complete event payload array');
  const frame={...input,hooks:input.hooks??{},enums:input.enums??{},result:{on:false,off:false,flag:true},effects:[]};
  frame.read=(object,key,path=key)=>need(object,key,path);
  frame.p=index=>{if(!Object.hasOwn(frame.params,index)||frame.params[index]===undefined)throw new MissingConditionInput('params['+index+']:'+frame.eventType);return frame.params[index];};
  frame.opt=index=>Object.hasOwn(frame.params,index)?frame.params[index]??null:null;
  frame.enum=(group,key)=>need(need(frame.enums,group,'enums.'+group),key,'enums.'+group+'.'+key);
  frame.call=(name,...args)=>{
    const fn=frame.hooks[name]??frame.worktable[name];
    if(typeof fn!=='function')throw new MissingConditionInput('method.'+name);
    const result=fn.apply(frame.worktable,args);
    if(result===undefined)throw new MissingConditionInput('method.'+name+'.result');
    return result;
  };
  frame.emit=(name,...args)=>{
    const fn=frame.hooks[name]??frame.worktable[name];
    if(typeof fn!=='function')throw new MissingConditionInput('notification.'+name);
    frame.effects.push({name,args});return fn.apply(frame.worktable,args);
  };
  frame.battle=need(frame.worktable,'battle','worktable.battle');
  const stacks=need(frame.battle,'stackMap','battle.stackMap');
  // An explicitly complete stackMap may lack this key, which is known absence.
  frame.stack=Object.hasOwn(stacks,need(frame.event,'stack_id'))?stacks[frame.event.stack_id]:null;
  frame.ineq=need(frame.row,'condition_unit_value_ineq','cond_unit.condition_unit_value_ineq');
  frame.compare=(left,right)=>compareCondition(frame.ineq,left,right);
  return frame;
}

// Main callback 0xf0000005e900 offsets 0..1708, before event-specific dispatch.
export function matchesUnitRuntimeScope(frame) {
  const f=frame,r=f.read,event=f.event,params=f.params;
  if(r(event,'inactive','event.inactive'))return false;
  const type=r(f.row,'condition_unit_type');
  // Native 0x5e900 offsets382..405 (and CHAR/OWNER peers) explicitly
  // ignores a listener when params[0] is absent. Broadcast refreshes pass [].
  // Event-specific required fields still use p(), so malformed payloads fail.
  const first=()=>f.opt(0),validFirst=()=>first()!==null;
  switch(type){
    case 'CONDITION_UNIT_NONE': break;
    case 'CONDITION_UNIT_USER':{
      if(!validFirst())return false;
      if(r(r(f.battle,'char'),'id')!=first()&&![1,2,3,4,5,6,7].includes(Number(first())))return false;
      break;
    }
    case 'CONDITION_UNIT_CHAR':
      if(!validFirst()||f.stack===null||r(f.stack,'caster_id')!=first())return false;break;
    case 'CONDITION_UNIT_CHAR_PARTNER':{
      if(!validFirst()||f.stack===null)return false;
      const caster=r(f.stack,'caster_id'),partner=caster==7?8:caster>=1&&caster<=3?caster+3:-1;
      if(first()!=caster&&first()!=partner)return false;break;
    }
    case 'CONDITION_UNIT_CASTER': case 'CONDITION_UNIT_OWNER':{
      if(!validFirst()||f.stack===null)return false;
      const owner=r(f.stack,type==='CONDITION_UNIT_CASTER'?'caster_id':'owner_id');
      if(owner!=first()){
        const a=f.call('getUnitByIDskipError',owner),b=f.call('getUnitByID',Number(first()),type+':'+r(f.stack,'res_id'));
        if((a===null?null:r(a,'id'))!=r(b,'id'))return false;
      }
      break;
    }
    case 'CONDITION_UNIT_MONSTER':{
      if(f.eventType==='CONDITION_MONSTER_HIT_SAMETIME')break;
      if(!validFirst()||!f.call('isMonsterByID',first()))return false;
      const unit=f.call('getUnitByID',Number(first()),'CONDITION_UNIT_MONSTER');
      const targets=r(event,'unit_target'),ids=r(event,'unit_target_opt_monster');
      if(targets?.includes('not')){if(ids?.includes(r(unit,'res_id')))return false;}
      else if(!ids?.includes(r(unit,'res_id')))return false;
      break;
    }
    // CONDITION_UNIT_ALL and any enum not singled out here deliberately reach
    // dispatch without another scope gate in the recovered callback.
    default: break;
  }
  return true;
}

// Handler modules mutate frame.result/valueTriggered and event.prev only where
// observed. They return true if the symbolic event type belongs to their range.
export function evaluateUnitRuntimeEvent(input, handlers) {
  const frame=createUnitRuntimeFrame(input);
  if(!matchesUnitRuntimeScope(frame))return {...frame.result,ignored:true,aborted:false,valueTriggered:frame.valueTriggered,effects:frame.effects};
  if(!Array.isArray(handlers))throw new MissingConditionInput('runtime.handlers');
  if(!handlers.some(handler=>handler(frame)))throw new MissingConditionInput('unsupported_unit_runtime:'+frame.eventType);
  // A source-level early return skips the final on/off notification block,
  // while mutations/notifications already performed by the branch remain.
  if(frame.aborted===true){frame.result.on=false;frame.result.off=false;}
  return {...frame.result,ignored:false,aborted:frame.aborted===true,valueTriggered:frame.valueTriggered,effects:frame.effects};
}
