// Source: EventSystem.registUnitEvent 0x1ae00, bounded source-proven paths.
// Details: evidence/unit-event-registration/HANDPORT-SCOPE.md.
import fs from 'node:fs';
import {MissingBattleRule} from './resource-store.mjs';
import {compareCondition} from '../conditions/condition-core.mjs';
import {UnitRegistrationProbes} from './unit-registration-probes.mjs';
const attrSource=fs.readFileSync(new URL('../attributes/gamecore/battle/skill_effect_enums.js.recovered.js',import.meta.url),'utf8');
const DMG_ATTR=Object.fromEntries([...attrSource.matchAll(/arg0\.(DMG_ATTR_\w+) = "([^"]*)"/g)].map(m=>[m[1],m[2]]));
if(DMG_ATTR.DMG_ATTR_ADDITIONAL_ATTACK!=='DMG_ATTR_ADDITIONAL_ATTACK')throw new MissingBattleRule('registUnitEvent.damage_enum_source');
// Every entry below explicitly jumps to 3600/9819/10289 (no initial probe).
const NO_PROBE=new Set(('CONDITION_CHAR_USE_EGO_SKILL CONDITION_COMBATANT_EGO_SKILL_USED CONDITION_CHAR_USE_ENERGY CONDITION_CHAR_TAKE_STRESS CONDITION_TURN_COUNT_DECREASE CONDITION_TURN_COUNT_INCREASE CONDITION_CHAR_EARN_ENERGY CONDITION_CHAR_ALL_ATK CONDITION_CHAR_ATK_COUNT CONDITION_CHAR_ATK_AUTO CONDITION_CHAR_ATK CONDITION_CHAR_DMG CONDITION_CHAR_IGNORE_COND_DMG CONDITION_CHAR_IGNORE_COND_DMG_VALUE CONDITION_CHAR_DMG_ACCRUE CONDITION_SHIELD_DESTROY CONDITION_CHAR_DMG_BREAK_SHIELD CONDITION_CHAR_TAKE_DMG CONDITION_CHAR_IGNORE_COND_TAKE_DMG CONDITION_DMG_ATTR_DOT CONDITION_CHAR_HIT CONDITION_CHAR_HIT_EXCEPT_FIX CONDITION_CHAR_HIT_NOT_MISS CONDITION_CHAR_HIT_SHIELD CONDITION_CHAR_DEAD CONDITION_CHAR_KILL_MONSTER CONDITION_CHAR_KILL CONDITION_CHAR_OVERKILL CONDITION_CHAR_NO_DMG CONDITION_CHAR_GIVE_NO_DMG CONDITION_CHAR_GIVE_CS CONDITION_CHAR_GIVE_CS_ALL_EXCEPT_ICS CONDITION_CHAR_TAKE_CS CONDITION_OWN_CHAR_TAKE_CS CONDITION_CHAR_CS_TERM_VALUE_CHANGED CONDITION_OWN_CHAR_CS_TERM_VALUE_CHANGED CONDITION_CHAR_UNIQUE_RITA_1 CONDITION_CHAR_TERM_TYPE CONDITION_CHAR_EGO_BREAK CONDITION_CRITICAL CONDITION_CHAR_CS_TRIGGER CONDITION_OWN_CHAR_CS_TRIGGER CONDITION_CHAR_CURE CONDITION_CHAR_HEAL_CURE CONDITION_CHAR_SHIELD CONDITION_CHAR_GET_SHIELD CONDITION_MONSTER_HIT_SAMETIME CONDITION_CHAR_CUR_HP_CHANGE').split(' '));
export class UnitEventRegistrationRuntime {
 constructor(e){this.e=e;this.b=e.b;this.w=e.wt;this.db=e.db;}
 call(n,...a){return this.e.call(n,...a);}
 registUnitEvent(maps,stackId,trigger,row,caster,owner,override){
  const allOpts=this.db.array(row.condition_unit_opt),attrs=allOpts.filter(x=>Object.hasOwn(DMG_ATTR,x.toUpperCase())),opts=allOpts.filter(x=>!Object.hasOwn(DMG_ATTR,x.toUpperCase()));
  const key=row.condition_unit,type=row.condition_unit_type,single=['CONDITION_UNIT_USER','CONDITION_UNIT_CASTER','CONDITION_UNIT_OWNER','CONDITION_UNIT_CHAR','CONDITION_UNIT_CHAR_PARTNER'].includes(type);
  const val=k=>override?.column===k?override.value:this.db.number(row,k);
  const event={id:this.b.cond_id++,stack_id:stackId,res_id:row.id,condition_type:this.e.enums.EVENT_CONDITION_TYPE.UNIT,trigger,value:val('condition_unit_value'),stack_input:val('condition_unit_stack_input')};
  if(opts.length)event.unit_opt=opts;if(attrs.length)event.dmg_attr_opts=attrs.map(x=>DMG_ATTR[x.toUpperCase()]);
  for(const [field,column]of [['unit_opt_multiple_link','condition_unit_opt_multiple_link'],['unit_target','condition_unit_target_opt'],['unit_target_opt_monster','condition_unit_target_opt_link_monster_id']]){const values=this.db.array(row[column]);if(values.length)event[field]=values;}
  const css=this.db.array(row.condition_unit_opt_link_cs_id??'[]');
  if(css.length){const stage=(this.w.battle_stage_worktable??this.e.state?.worktables?.BattleStageWorktable)?.battle_stage;if(!stage)throw new MissingBattleRule('registUnitEvent.battle_stage');event.unit_opt_cs=css.map(id=>stage.break_cs_changes?.[id]??id);}
  const egos=this.db.array(row.condition_unit_opt_ego_type);if(egos.length)event.unit_opt_ego_type=egos.map(id=>this.call('convertEgoCommon',id));
  if(row.condition_unit_trigger!=='NO')event.isTrigger=true;
  this.b.condMap[event.id]=event;if(!type)throw new MissingBattleRule('registUnitEvent.invalid_unit_type',{id:row.id});
  (maps.unitEventMap[key]??=[]).push(event.id);
  let triggered=false,value_triggered;
  if(!opts.includes('except_regist')){
   if(type==='CONDITION_UNIT_MONSTER'){
    // Native @1159..1764 always returns early for MONSTER, including keys
    // without an initial probe. In particular it bypasses accumulate.
    if(key==='CONDITION_CHAR_CS_AMOUNT'&&opts.includes('include_regist')&&!isNaN(event.value)){
     for(const monster of this.b.monsters){
      if(triggered)break;if(['death','run','changed','prop'].includes(monster.state))continue;
      const included=event.unit_target_opt_monster?.includes(monster.res_id);
      if(event.unit_target?.includes('not')?included:!included)continue;
      for(const res of event.unit_opt_cs??[]){if(triggered)break;const found=this.call('getContinueSkills',monster).find(i=>{const cs=this.b.csMap[i];return cs&&!cs.removed&&cs.res_id==res;});
       const cs=found==null?undefined:this.b.csMap[found],n=cs==null?0:cs.effective_term_value??cs.term_value;
       if(compareCondition(row.condition_unit_value_ineq,n,event.value)){triggered=true;value_triggered=n;}
      }
     }
    }return {key,triggered,event,value_triggered};
   }
   const id=single?(type==='CONDITION_UNIT_USER'?this.b.char.id:type==='CONDITION_UNIT_OWNER'?owner:caster):undefined;
   ({triggered,value_triggered}=new UnitRegistrationProbes(this.e).probe(row,event,id,NO_PROBE));
  }
  if(opts.includes('accumulate'))(this.b.stackMap[stackId].resetConds??=[]).push(event.id);
  return {key,triggered,event,value_triggered};
 }
}
