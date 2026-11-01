import fs from 'node:fs';
import path from 'node:path';
import {toArray} from '../../card-pool-investigation/build-pools.mjs';
// Only directly observed native numeric types are adapted. Other constant_meta
// cells retain the carrier's representation; IDs are never guessed numeric.
const NATIVE_CONSTANT_NUMBERS={};
for(const file of ['constant-native-types.json','keyword-constant-native-types.json','balance-constant-native-types.json']){
  const observation=JSON.parse(fs.readFileSync(new URL(file,import.meta.url),'utf8'));
  for(const [id,value]of Object.entries(observation.numbers))NATIVE_CONSTANT_NUMBERS[id]=value;
}
// GameResDBClass static defaults 0x22400 and convertMonsterCardtoCard 0x3900.
// Materialize inherited defaults so adapter copies retain the native field reads.
const MONSTER_CARD_DEFAULTS=Object.freeze({id:'',name:'',desc:'',desc_outgame:'',card_skin_set:'',sort:'',card_category:'',rarity:'',ego_type:'',talent:'',cost:0,r_spark_replace_cost:'',link_skill_eff_id:'',reward_tag:'',reward_ratio:0,battle_r_spark_enable_flag:'',r_spark_tag_default:'',child_link_card_id:'',require_owner_flag:'',card_usable_link_condition_id:'',eff_pick_pool_order:'',eff_pick_pool_ratio:'',eff_pick_pool_count:0,motion_start_timing:0,card_use_event_timing:0,target_check_index:'',before_throw_index:'',spine_model:'',sct_name:'',motion_type:'',replace_motion_type:'',motion_type_for_cutin:'',target_for_ui:'',link_card_change_group:'',link_mercenary_id:'',mercenary_link_monster_pattern_id:'',ui_conditional_outline:'',ui_interrupt_outline:'',card_usable_condition_outline:'',extra_tag:'',link_extra_tag_id:'',ownable_link_base_class_define_id:'',motion_type_opt:'',assault_tag:'',assault_tag_match_drop:''});
export class MissingBattleRule extends Error {
  constructor(rule,context={}){super('missing_battle_rule:'+rule);this.name='MissingBattleRule';this.rule=rule;this.context=context;}
}
export class ResourceStore {
  constructor(root){this.root=root;this.tables=new Map();this.provenance=new Map();}
  table(name){
    if(this.tables.has(name))return this.tables.get(name);
    const result=Object.create(null),sources=Object.create(null),dir=path.join(this.root,'db');
    const files=fs.readdirSync(dir).filter(x=>x===name+'.json'||x.endsWith('@'+name+'.json')).sort();
    if(!files.length)throw new MissingBattleRule('resource_table:'+name);
    for(const file of files){
      const data=JSON.parse(fs.readFileSync(path.join(dir,file),'utf8'));
      if(!Array.isArray(data)){
        if(data&&typeof data==='object'&&!Object.keys(data).length)continue;
        throw new MissingBattleRule('resource_format:'+file);
      }
      for(const row of data){
        if(row.id===undefined)throw new MissingBattleRule('resource_id:'+file);
        if(Object.hasOwn(result,row.id)&&JSON.stringify(result[row.id])!==JSON.stringify(row))throw new MissingBattleRule('conflicting_resource:'+name+':'+row.id,{sources:[sources[row.id],file]});
        result[row.id]=Object.freeze({...row});sources[row.id]=file;
      }
    }
    // processDBDataOptimized0x1c300 only merges a nonempty raw card table;
    // addMonsterCardDataOptimized0x1d300 then overwrites identical IDs.
    if(name==='card'&&Object.keys(result).length)for(const [id,row]of Object.entries(this.table('monster_card'))){
      result[id]=Object.freeze({...MONSTER_CARD_DEFAULTS,...row});sources[id]='monster_card:'+this.provenance.get('monster_card')[id];
    }
    if(name==='constant_meta')for(const [id,observed]of Object.entries(NATIVE_CONSTANT_NUMBERS)){
      const row=result[id];if(!row)continue;const value=Number(row.value);
      if(!Number.isFinite(value)||value!==observed)throw new MissingBattleRule('constantMeta.numeric_capture_mismatch',{id,raw:row.value,observed});
      result[id]=Object.freeze({...row,value});
    }
    this.tables.set(name,result);this.provenance.set(name,sources);return result;
  }
  get(name,id){const row=this.table(name)[id];if(!row)throw new MissingBattleRule('resource:'+name+':'+id);return row;}
  number(row,key){if(!Object.hasOwn(row,key)||row[key]===''||!Number.isFinite(Number(row[key])))throw new MissingBattleRule('numeric_resource_field:'+key,{id:row.id,value:row[key]});return Number(row[key]);}
  array(value){return toArray(value);}
}
