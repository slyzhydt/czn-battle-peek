import {need,MissingConditionInput} from './condition-core.mjs';
import {evaluateUnitRuntimeEvent} from './runtime-context.mjs';
import {procUnitRuntime} from './unit-runtime.mjs';
import {COMMON_UNIT_EVENT_TYPES,handleCommonUnitCondition} from './unit-common-conditions.mjs';
import {CS_FIRST_EVENTS,handleCSFirstRuntime} from '../targeting/condition-cs-first.mjs';
import {CS_AGGREGATE_UNIT_EVENT_TYPES,handleCSAggregateUnitCondition} from '../attributes/unit-cs-aggregate-conditions.mjs';
import {DAMAGE_UNIT_EVENT_TYPES,handleDamageUnitEvent} from '../calculation/unit-damage-conditions.mjs';
import {SPOT_REGISTRATION_TYPES,probeSpotUnitRegistration} from './unit-registration-special.mjs';
import {probeFateRegistration} from '../attributes/registration-fate.mjs';

export const UNIT_RUNTIME_HANDLERS=Object.freeze([
  handleCommonUnitCondition,handleDamageUnitEvent,handleCSFirstRuntime,handleCSAggregateUnitCondition
]);
export const UNIT_RUNTIME_TYPES=Object.freeze([
  ...COMMON_UNIT_EVENT_TYPES,...DAMAGE_UNIT_EVENT_TYPES,...CS_FIRST_EVENTS,...CS_AGGREGATE_UNIT_EVENT_TYPES
]);
if(new Set(UNIT_RUNTIME_TYPES).size!==UNIT_RUNTIME_TYPES.length)throw new Error('overlapping independent condition handlers');
export const UNIT_REGISTRATION_ONLY_TYPES=Object.freeze([...SPOT_REGISTRATION_TYPES,'CONDITION_FATE_AMOUNT_SET']);
export const UNRESOLVED_UNIT_RESOURCE_TYPES=Object.freeze(['CONDITION_CHAR_USE_TACTIC_SKILL']);

// These are public entry points for independent reconstructed state. All named
// dynamic dependencies and actual payload fields remain mandatory when read.
export const evaluateUnitCondition=input=>evaluateUnitRuntimeEvent(input,UNIT_RUNTIME_HANDLERS);
export const dispatchUnitCondition=input=>procUnitRuntime({...input,handlers:UNIT_RUNTIME_HANDLERS});

export function probeStaticUnitCondition(input){
  const type=need(need(input,'row'),'condition_unit');
  if(UNRESOLVED_UNIT_RESOURCE_TYPES.includes(type))throw new MissingConditionInput('unresolved_legacy_resource_condition:'+type);
  if(SPOT_REGISTRATION_TYPES.includes(type))return probeSpotUnitRegistration(input);
  if(type==='CONDITION_FATE_AMOUNT_SET'){
    if(need(need(input,'event'),'unit_opt','event.unit_opt')?.includes('except_regist'))return {triggered:false,valueTriggered:null,registrationOnly:true};
    return {...probeFateRegistration(input),valueTriggered:null,registrationOnly:true};
  }
  throw new MissingConditionInput('not_registration_only_condition:'+type);
}
