import {need,MissingConditionInput} from './condition-core.mjs';

// Registration-time probes in registUnitEvent 0xf0000001ae00,
// offsets 14256..14616. There are no corresponding procUnitEvent cases.
export const SPOT_REGISTRATION_TYPES=Object.freeze([
  'CONDITION_SPOT_TYPE_UNKNOWN','CONDITION_SPOT_MON_TYPE','CONDITION_SPOT_FACTION_TYPE'
]);
export function probeSpotUnitRegistration(input){
  const {worktable,event,row,hooks={}}=input,type=need(row,'condition_unit');
  if(!SPOT_REGISTRATION_TYPES.includes(type))throw new MissingConditionInput('unsupported_spot_registration:'+type);
  const opts=need(event,'unit_opt','event.unit_opt');
  const result=triggered=>({triggered:!!triggered,valueTriggered:null,registrationOnly:true});
  // Original outer gate @911..941 bypasses every initial probe.
  if(opts?.includes('except_regist'))return result(false);
  const init=()=>need(need(worktable,'battleInitWorktable','worktable.battleInitWorktable'),'battle_init');
  switch(type){
    case 'CONDITION_SPOT_TYPE_UNKNOWN':return result(need(init(),'from_encounter')==true);
    case 'CONDITION_SPOT_MON_TYPE':{
      if(opts===null)return result(false);
      const spot=need(init(),'spot_type');
      return result(opts.includes(spot.toString().slice('SPOT_TYPE_'.length).toLowerCase()));
    }
    case 'CONDITION_SPOT_FACTION_TYPE':{
      const ids=need(event,'unit_opt_multiple_link','event.unit_opt_multiple_link');
      if(ids===null)return result(false);
      const fn=hooks.getBattleRes??worktable.getBattleRes;
      if(typeof fn!=='function')throw new MissingConditionInput('method.getBattleRes');
      const resource=fn.call(worktable,need(init(),'battle_res_id'));
      return result(ids.includes(need(resource,'link_faction_id','battle_resource.link_faction_id')));
    }
  }
}
