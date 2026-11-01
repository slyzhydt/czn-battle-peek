// Numeric consumer bridge. These five direct ConstantMetagame users have
// native missing-row fallback; cached GameConstants and raw required DB reads
// must not silently inherit it. No resource rows are fabricated.
import {MissingBattleRule} from './resource-store.mjs';
const DIRECT_META=new Set(['shield_destruct_dmg_pct','rage_base','rage_scale','dtr_cnt_add_hund_multiply_pct','dmg_attr_count_max_turn_count']);
export function numericConstant(runtime,id,options){
  const value=DIRECT_META.has(id)?runtime.call('constantMetagame',id,options):runtime.e.db.get('constant_meta',id).value;
  return runtime.e.db.number({id,value},'value');
}
// dmgDecrease0x72f00 reads raw GameResDB.get(...)? .value ?? defaults,
// not ConstantMetagame.get. Only the exact adapter missing-row exception is
// translated to native absence; all other extraction failures still stop.
function optionalValue(db,id){try{return db.get('constant_meta',id)?.value;}catch(error){if(error instanceof MissingBattleRule&&error.rule==='resource:constant_meta:'+id)return undefined;throw error;}}
export function damageReductionConstants(runtime,partyDef){return{zeroValue:Number(optionalValue(runtime.e.db,'dmg_decrease_rate_0_value')??partyDef),curveValue:Number(optionalValue(runtime.e.db,'dmg_decrease_rate_curv_value')??0)};}
