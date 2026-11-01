// Read-only comparison of captured loaded values with current port recomputation.
// It never mutates an executor, fills a cache, overrides a port, or fabricates an enum.
import fs from 'node:fs';
const expected=JSON.parse(fs.readFileSync(new URL('runtime-enum-expectations.json',import.meta.url),'utf8'));
const numberBindings={base_draw:'battle_base_draw_count',base_energy:'battle_base_energy',dmg_revise_rate:'dmg_revise_rate',shield_revise_rate:'shield_revise_rate',battle_base_hand_max_count:'battle_base_hand_max_count',ethereal_rate:'ethereal_rate',player_viability_ge:'player_viability_ge',player_injury_lt:'player_injury_lt',monster_viability_ge:'monster_viability_ge',monster_injury_lt:'monster_injury_lt',ego_field_damage_cap:'ego_field_damage_cap'};
const repr=v=>v===undefined?{$undefined:true}:typeof v==='number'&&!Number.isFinite(v)?{$number:String(v)}:v;
const same=(a,b)=>{
  if(Object.is(a,b))return true;if(a===null||b===null||typeof a!=='object'||typeof b!=='object'||Array.isArray(a)!==Array.isArray(b))return false;
  const ak=Object.keys(a),bk=Object.keys(b);return ak.length===bk.length&&ak.every(k=>Object.hasOwn(b,k)&&same(a[k],b[k]));
};
export function assessRuntimeConsistency({state,resources,requiredEnums=Object.keys(expected.enums)}){
  const gc=state.runtimeInputs?.loadedGameConstants,enums=state.runtimeInputs?.runtimeEnums,checks=[];
  function check(key,fn){try{const value=fn();checks.push({key,...value});}catch(error){checks.push({key,status:'blocked',reason:error.message,rule:error.rule});}}
  const missing=message=>{throw Error(message);};
  const captured=key=>gc&&Object.hasOwn(gc,key)?gc[key]:missing('Loaded GameConstants.'+key+' not captured');
  check('GameConstants.loaded',()=>({status:captured('loaded')===true?'match':'blocked',captured:repr(captured('loaded'))}));
  for(const [field,id]of Object.entries(numberBindings))check('GameConstants.'+field,()=>{
    const live=captured(field),enumeration=Number(resources.table('constant_meta')[id]?.value),lookup=Number(resources.get('constant_meta',id).value);
    return{status:typeof live==='number'&&Number.isFinite(live)&&Object.is(live,enumeration)&&Object.is(live,lookup)?'match':'mismatch',captured:repr(live),fromEnumeration:repr(enumeration),portLookup:repr(lookup),source:'GameConstants.loadConstants 0x3a00; Number(row.value)'};
  });
  check('GameConstants.break_stress_decrease',()=>{
    const value=resources.table('constant_meta').break_stress_decrease?.value;
    const source=resources.array(value.toString()).map(Number),port=resources.array(resources.get('constant_meta','break_stress_decrease').value).map(Number),live=captured('break_stress_decrease');
    return{status:same(live,source)&&same(live,port)?'match':'mismatch',captured:live,fromEnumeration:source,portLookup:port,source:'loadConstants 0x3a00 @404..454; hp-support-runtime recovery consumer'};
  });
  check('GameConstants.battle_preview_dmg_keys',()=>{
    const derived=Object.values(resources.table('battle_cs_preview')).filter(row=>row.cs_preview_type.includes('DAMAGE')).map(row=>row.id),live=captured('battle_preview_dmg_keys');
    return{status:same(live,derived)?'match':'mismatch',captured:live,portEnumeration:derived,source:'loadConstants 0x3a00 @303..375; monster-notification-runtime.getBattlePreviewDmgKeys'};
  });
  check('GameConstants._simulate_battle_custom',()=>{
    const loaded=captured('_simulate_battle_custom_loaded'),live=captured('_simulate_battle_custom'),derived={};
    for(const row of Object.values(resources.table('simulate_battle'))){if(row.link_battle_id=='none')continue;(derived[row.link_battle_id]??=[]).push(...row.link_simulate_battle_custom_id.replace(/[\[\]]/g,'').split(','));}
    if(loaded===false)return{status:'deferred-native-load',capturedLoaded:false,sourceDefaultDerived:derived,limitation:'Default native loader would read these rows; current loader body identity remains unproven.'};
    if(loaded!==true)missing('simulate custom loaded flag not boolean');
    return{status:same(live,derived)?'match':'mismatch',captured:live,portEnumeration:derived,source:'loadSimulateBattleCustom 0xec00 / getSimulateBattleCustom 0x16d00; player-start-runtime.getCustomStressVal'};
  });
  for(const name of requiredEnums)check('runtimeEnums.'+name,()=>{
    if(!Object.hasOwn(expected.enums,name))missing('No exact default profile for '+name);
    if(!enums||!Object.hasOwn(enums,name))missing('Current enum not reachable/captured: '+name);
    const live=enums[name],want=expected.enums[name];
    const mode=expected.comparisonMode?.[name]??'exact',differences=[];
    for(const key of new Set([...Object.keys(want),...(mode==='consumed-subset'?[]:Object.keys(live))])){
      if(!Object.hasOwn(want,key)&&/^\d+$/.test(key)&&typeof live[key]==='string'&&want[live[key]]===Number(key)&&live[live[key]]===Number(key))continue;
      if(Object.hasOwn(want,key)!==Object.hasOwn(live,key)||!Object.is(want[key],live[key]))differences.push({key,expected:repr(want[key]),captured:repr(live[key])});
    }
    return{status:differences.length?'mismatch':'match',comparisonMode:mode,differences,extraKeys:Object.keys(live).filter(k=>!Object.hasOwn(want,k)),source:expected.sources[name]};
  });
  const failed=checks.filter(x=>['blocked','mismatch'].includes(x.status));
  return{schema:'czn-pre-solver-runtime-consistency-v1',passed:failed.length===0,checks,blocked:failed.length,changedPorts:false,
    currentImplementationBodiesProven:false,liveAcceptance:false,
    boundaries:['Matching loaded values permits the current db-recomputation profile only for the captured checkpoint; it does not substitute for directly consuming a changed live configuration.','Enums used as module constants and numeric literals cannot be changed through executor.enums alone; any observed drift blocks this default profile.','Unreachable private/module-local enums and ConstantMetagame private implementation stay explicitly unverified.','Direct ConstantMetagame consumers retain raw types and their own missing-row defaults; they are not GameConstants cached getters.']};
}
