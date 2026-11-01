import {need,MissingConditionInput} from './condition-core.mjs';
import {evaluateUnitRuntimeEvent} from './runtime-context.mjs';

// procUnitEvent 0xf0000005d700 offsets 34..266; each listener's predicate is
// 0xf0000005e900. This module never loads or executes recovered target code.
// mode is explicit: predicates returns decisions; applyNotifications also
// invokes independently supplied onEvent/offEvent and cross-card dispatcher.
export function procUnitRuntime(input){
  const {worktable,eventType,params,value,handlers,hooks={},enums={}}=input;
  for(const key of ['worktable','eventType','params','value','handlers','rowsById','mode'])need(input,key,'runtime.'+key);
  if(!['predicates','applyNotifications'].includes(input.mode))throw new TypeError('mode must be predicates or applyNotifications');
  const battle=need(worktable,'battle','worktable.battle'),eventMap=need(need(battle,'eventMaps'),'unitEventMap');
  const condMap=need(battle,'condMap'),rows=need(input,'rowsById'),decisions=[],notifications=[];
  const emit=(name,...args)=>{
    notifications.push({name,args});
    if(input.mode==='applyNotifications'){
      const fn=hooks[name]??worktable[name];
      if(typeof fn!=='function')throw new MissingConditionInput('notification.'+name);
      fn.apply(worktable,args);
    }
  };
  const recursive={CONDITION_CHAR_CS_TERM_VALUE_SET:'CONDITION_CHAR_CS_TERM_VALUE_MAX_SET',
    CONDITION_OWN_CHAR_CS_TERM_VALUE_SET:'CONDITION_OWN_CHAR_CS_TERM_VALUE_MAX_SET'}[eventType];
  if(recursive){
    const earlier=procUnitRuntime({...input,eventType:recursive});
    decisions.push(...earlier.decisions);notifications.push(...earlier.notifications);
  }
  if(eventType==='CONDITION_CHAR_ENERGY'){
    // CARD_PLACE enum can be string or numeric; demand the actual definition.
    const place=need(need(enums,'CARD_PLACE','enums.CARD_PLACE'),'CARD_PLACE_NONE');
    emit('procCardEvent','CONDITION_CARD_COST_EQ_AP',place,-1);
  }
  let valueTriggered=value;
  // Explicit complete maps make a missing event key a known empty registration.
  const listeners=Object.hasOwn(eventMap,eventType)?eventMap[eventType]:null;
  if(listeners!==null){
    if(!Array.isArray(listeners))throw new TypeError('unitEventMap entry must be the original ordered array');
    listeners.forEach(id=>{
      if(!Object.hasOwn(condMap,id))throw new MissingConditionInput('battle.condMap['+id+']');
      const event=condMap[id];
      if(need(event,'inactive','event.inactive'))return;
      const resId=need(event,'res_id','event.res_id');
      const row=Object.hasOwn(rows,resId)?rows[resId]:null;
      if(row===null)return; // Original GameResDB lookup's confirmed absence.
      const out=evaluateUnitRuntimeEvent({worktable,event,row,eventType,params,value,valueTriggered,hooks,enums},handlers);
      valueTriggered=out.valueTriggered;
      decisions.push({id,eventType,event,...out});
      if(out.on)emit('onEvent',event,out.flag,valueTriggered,need(event,'isTrigger','event.isTrigger'));
      if(out.off)emit('offEvent',event);
    });
  }
  return {decisions,notifications,valueTriggered};
}
