// Manual registration probes, EventSystem.registUnitEvent 0x1ae00.
// These are NOT runtime event predicates: native initial value/prev/set writes
// and the MONSTER early return are deliberately preserved separately.
import {MissingBattleRule} from './resource-store.mjs';
import {floorGame} from '../effects/effect-arithmetic.mjs';
import {compareCondition} from '../conditions/condition-core.mjs';
export class UnitRegistrationProbes {
 constructor(e){this.e=e;this.b=e.b;this.db=e.db;}
 call(n,...a){return this.e.call(n,...a);}
 get stage(){return this.e.state.worktables.BattleStageWorktable.battle_stage;}
 get init(){return this.e.state.worktables.BattleInitWorktable.battle_init;}
 skills(unit,own){return own==null?this.call('getContinueSkills',unit):this.call('getContinueSkillsByCharID',own);}
 term(id){const cs=this.b.csMap[id];if(!cs)throw new MissingBattleRule('registUnitEvent.cs_index',{id});return cs.effective_term_value??cs.term_value;}
 // targetFilter_1 0x1bb00 delegates module slot 7, checkCondUnitCS 0x700.
 target(event,m){if(event.unit_opt_cs&&!this.call('getContinueSkills',m).some(id=>event.unit_opt_cs.includes(this.b.csMap[id].res_id)))return false;
  if(event.unit_target_opt_monster==null)return true;const yes=event.unit_target_opt_monster.includes(m.res_id);return event.unit_target?.includes('not')?!yes:yes;}
 countMonsters(event,set){const opts=event.unit_opt??[];let n=0;
  for(const m of this.b.monsters.concat(this.b.retired_monsters)){if(!this.target(event,m))continue;
   if(!set&&opts.includes('ego_field')&&m.ego_field_value==null)continue;
   if(opts.includes('dead')&&m.state==='death'){n++;continue;}
   if(opts.includes('live')&&this.call('isFieldMonster',m)&&!['half_death','keep_half_death'].includes(m.state)){n++;continue;}
   if(opts.includes('half_death')&&['half_death','keep_half_death'].includes(m.state)){n++;continue;}
   // The shipped spelling is not_break, but the test is positive ego_breaked.
   if(!set&&opts.includes('not_break')&&m.ego_breaked)n++;
  }return n;
 }
 probe(row,event,id,noProbe){const key=row.condition_unit,opts=event.unit_opt??[],single=id!==undefined,cmp=(a,b=event.value)=>compareCondition(row.condition_unit_value_ineq,a,b);let triggered=false,value_triggered;
  const result=()=>({triggered,value_triggered}),set=n=>{event.set=true;event.set_value=n;triggered=true;};
  const own=this.b.stackMap[event.stack_id]?.caster_id;
  if(key==='CONDITION_FATE_AMOUNT_SET')set(this.init.fate_count??0);
  const unit=single?this.e.getUnit(Number(id)):undefined;
  if(single){
   if(noProbe.has(key))return result();
   switch(key){
    case 'CONDITION_MONSTER_EGO_BREAK':triggered=unit.ego_breaked==true;break;
    case 'CONDITION_MONSTER_EGO_FIELD_AMOUNT':value_triggered=unit.ego_field_value??0;triggered=cmp(value_triggered);break;
    case 'CONDITION_CHAR_CS_AMOUNT':case 'CONDITION_OWN_CHAR_CS_AMOUNT':{
     if(!opts.includes('include_regist'))break;const owned=key.startsWith('CONDITION_OWN');if(owned&&own==null)break;
     const ids=this.skills(unit,owned?own:undefined);
     if(opts.includes('buff')||opts.includes('debuff')){
      value_triggered=Math.max(...ids.map(i=>{const cs=this.b.csMap[i],r=this.db.get('cs',cs.res_id),n=this.term(i);return opts.includes('buff')?(r.cs_buff_type==='CS_BUFF'||r.cs_buff_type==='CS_BUFF_DEBUFF'&&n>0?n:0):(this.call('baseDebuffType',r.cs_buff_type)||r.cs_buff_type==='CS_BUFF_DEBUFF'&&n<0?Math.abs(n):0);}));triggered=cmp(value_triggered);
     }else if(!isNaN(event.value))for(const res of event.unit_opt_cs??[]){const found=ids.find(i=>{const cs=this.b.csMap[i];return cs&&!cs.removed&&cs.res_id==res;});value_triggered=found==null?0:this.term(found);triggered=cmp(value_triggered);}
     break;
    }
    case 'CONDITION_CHAR_CS_BUFF_TYPE_COUNT':case 'CONDITION_OWN_CHAR_CS_BUFF_TYPE_COUNT':case 'CONDITION_CHAR_CS_BUFF_TYPE_SET':{
     const owned=key.startsWith('CONDITION_OWN');if(owned&&own==null)break;const fn=owned?'getCsBuffTypeCount':'getCSCount',who=owned?own:Number(id);
     if(opts.includes('compare_buff_debuff')){if(key.endsWith('_SET'))throw new MissingBattleRule('registUnitEvent.invalid_compare_buff_debuff');triggered=cmp(this.call(fn,who,'CS_BUFF'),this.call(fn,who,'CS_DEBUFF'));}
     else {const n=this.call(fn,who,opts.includes('buff')?'CS_BUFF':'CS_DEBUFF');if(key.endsWith('_SET'))set(n);else {event.prev=value_triggered=n;triggered=opts.includes('change')?false:cmp(n);}}break;
    }
    case 'CONDITION_CHAR_CS_TERM_VALUE_SET':case 'CONDITION_OWN_CHAR_CS_TERM_VALUE_SET':case 'CONDITION_CHAR_CS_TERM_VALUE_MAX_SET':case 'CONDITION_OWN_CHAR_CS_TERM_VALUE_MAX_SET':{
     const owned=key.startsWith('CONDITION_OWN');if(owned&&own==null)break;const ids=this.skills(unit,owned?own:undefined),counts={};
     for(const res of event.unit_opt_cs??[]){let n=0,matched=false;for(const i of ids){const cs=this.b.csMap[i];if((cs.show_cs_res_id??cs.res_id)==res){matched=true;n+=this.term(i);}}
      if(key.endsWith('_MAX_SET'))counts[res]=n;else if(matched)set(n*event.stack_input);
     }if(key.endsWith('_MAX_SET')){const n=Math.max(...Object.values(counts));if(n!==-Infinity)set(n*event.stack_input);}break;
    }
    case 'CONDITION_CHAR_PARAMETER':for(const opt of opts)if(opt!=='from_false')triggered=cmp(this.call('getParameterValueByKeyword',Number(id),opt));break;
    case 'CONDITION_CHAR_OBJECT_COMPARE':{
     const chars=this.b.chars.concat(this.b.assault_fourth_char??[]),owner=chars.find(c=>c.id==id);if(!owner)throw new MissingBattleRule('registUnitEvent.invalid_object_owner',{id});
     const extreme=opts.includes('high')?Math.max:Math.min,field=event.unit_target?.[0],stat={hp:'S_HP',defense:'S_DEF',attack:'S_ATK'}[field];
     if(stat)triggered=owner.status.info[stat]==extreme(...chars.map(c=>c.status.info[stat]));
     else if(field==='card'){const count=c=>this.stage.all.filter(card=>card.char_id==c.id).length;triggered=count(owner)==extreme(...chars.map(count));}
     else if(field==='stress'){const cs=this.stage.chars.concat(this.stage.assault_fourth_char??[]);triggered=(cs.find(c=>c.id==owner.id)?.ego_stress??0)==extreme(...cs.map(c=>c.ego_stress??0));}break;
    }
    case 'CONDITION_CHAR_VIABILITY':case 'CONDITION_CHAR_INJURY':{
     const viability=key==='CONDITION_CHAR_VIABILITY',monster=this.call('isMonsterByID',Number(id)),v=this.call('getParameterValueByKeyword',Number(id),'cur_hp_pct');
     const limit=this.call(monster?(viability?'getCurMonsterViabilityGe':'getCurMonsterInjuryLt'):(viability?'getPlayerViabilityGe':'getPlayerInjuryLt'));
     triggered=viability?v>=limit:v<limit;if(opts.includes('not'))triggered=!triggered;break;
    }
    case 'CONDITION_CHAR_COLLAPSE':case 'CONDITION_CHAR_LINK_CRASH':{
     const field=key==='CONDITION_CHAR_COLLAPSE'?'collapse_on':'link_crash_on';
     triggered=id==this.b.char.id?this.stage.chars.some(c=>(field!=='collapse_on'||event.unit_opt_multiple_link==null||event.unit_opt_multiple_link.includes(c.res_id.toString()))&&c[field]):(this.stage.chars.find(c=>c.id==id)?.[field]??false);break;
    }
    case 'CONDITION_CHAR_ENERGY':triggered=cmp(this.b.energy);break;
    case 'CONDITION_EP_AMOUNT':triggered=cmp(this.b.ep,event.value*100);break;
    case 'CONDITION_ENERGY_AMOUNT_SET':set(this.b.energy);break;
    case 'CONDITION_MONSTER_AMOUNT':case 'CONDITION_MONSTER_AMOUNT_SET':{
     if(!this.b.monsters.length&&!this.b.retired_monsters.length)break;const n=this.countMonsters(event,key.endsWith('_SET'));
     if(key.endsWith('_SET'))set(n);else {triggered=cmp(n);value_triggered=n-(event.prev??0);event.prev=n;}break;
    }
    case 'CONDITION_CHAR_HP_TURN_START':case 'CONDITION_CHAR_HP_MON_REGIST_PCT':case 'CONDITION_CHAR_TAKE_DMG_MAX_HP_PCT':case 'CONDITION_CHAR_TAKE_DMG_MAX_HP_PCT_TURN':{
     const loss=key.includes('TAKE_DMG'),base=this.call('getStatus',Number(id),key==='CONDITION_CHAR_HP_MON_REGIST_PCT'?'S_HP_REGIST':'S_CURRENT_HP');
     event.ref=loss?floorGame(base-this.call('getStatus',Number(id),'S_HP')*event.value/100):base;
     this.e.pushAction({id:this.b.last_action_id++,type:'action_monster_hpmark',source_id:Number(id),hp:loss?event.ref:event.ref*event.value/100});break;
    }
    // Native @11489..11577 constructs a diagnostic and continues. The
    // bootstrap ContentError helper returns an Error; this caller has no throw.
    default:this.call('ContentError','err:invalid_event_type_cond_with_param:'+key+':at_'+event.res_id,{channel:'#server_report_dev2'});break;
   }return result();
  }
  // No resolved single unit: native second switch @11583..16291.
  if(new Set('CONDITION_CHAR_USE_EGO_SKILL CONDITION_COMBATANT_EGO_SKILL_USED CONDITION_CREDIT_CHANGE CONDITION_TURN_COUNT_INCREASE CONDITION_TURN_COUNT_DECREASE CONDITION_DMG_ATTR_DOT CONDITION_CHAR_DEAD CONDITION_CHAR_CS_TRIGGER CONDITION_OWN_CHAR_CS_TRIGGER CONDITION_CHAR_GIVE_CS CONDITION_CHAR_GIVE_CS_ALL_EXCEPT_ICS CONDITION_CHAR_TAKE_CS CONDITION_OWN_CHAR_TAKE_CS CONDITION_SPOT_EIDOLON_CLEAR CONDITION_CHAR_USE_ENERGY CONDITION_CHAR_EARN_ENERGY CONDITION_MONSTER_NOTICE_ATTACK'.split(' ')).has(key))return result();
  switch(key){
   case 'CONDITION_STACK_VALUE_COMPARE':if(this.b.stackMap[event.stack_id]){event.prev=this.b.stackMap[event.stack_id].stack;triggered=cmp(event.prev);}break;
   case 'CONDITION_CHAR_CS_AMOUNT':case 'CONDITION_OWN_CHAR_CS_AMOUNT':{
    if(!opts.includes('include_regist'))break;const owned=key.startsWith('CONDITION_OWN');if(owned&&own==null)break;
    if(row.condition_unit_type!=='CONDITION_UNIT_ALL')throw new MissingBattleRule('registUnitEvent.invalid_all_cs_target');
    const ids=owned?this.call('getContinueSkillsByCharID',own):this.call('getTargetableMonstersID').concat(this.b.char.id).flatMap(i=>this.call('getContinueSkills',this.e.getUnit(i)));
    value_triggered=ids.reduce((n,i)=>event.unit_opt_cs?.includes(this.b.csMap[i].res_id)?n+this.term(i):n,0);event.prev=value_triggered;triggered=cmp(value_triggered);break;
   }
   case 'CONDITION_CHAR_ENERGY':triggered=cmp(this.b.energy);break;
   case 'CONDITION_EP_AMOUNT':triggered=cmp(this.b.ep,event.value*100);break;
   case 'CONDITION_ENERGY_AMOUNT_SET':set(this.b.energy);break;
   case 'CONDITION_FATE_AMOUNT_SET':set(this.init.fate_count??0);break;
   case 'CONDITION_MONSTER_AMOUNT':case 'CONDITION_MONSTER_AMOUNT_SET':{
    if(!this.b.monsters.length&&!this.b.retired_monsters.length)break;const n=this.countMonsters(event,key.endsWith('_SET'));if(key.endsWith('_SET'))set(n);else{event.prev=value_triggered=n;triggered=cmp(n);}break;
   }
   case 'CONDITION_CHAR_FRONT_EMPTY':if(own!=null){const coord=this.e.getUnit(own).slot_idx-1;if(coord>=0)triggered=!this.b.monsters.some(m=>m.slot_idx==coord&&!['death','run','changed'].includes(m.state));}break;
   case 'CONDITION_SPOT_TYPE_UNKNOWN':triggered=this.init.from_encounter==true;break;
   case 'CONDITION_SPOT_MON_TYPE':triggered=opts.includes(this.init.spot_type.toString().slice('SPOT_TYPE_'.length).toLowerCase());break;
   case 'CONDITION_SPOT_FACTION_TYPE':triggered=!!event.unit_opt_multiple_link?.includes(this.db.get('battle',this.init.battle_res_id).link_faction_id);break;
   case 'CONDITION_CHAR_EGO_AMOUNT':{let n=0;for(const c of this.b.chars.concat(this.b.assault_fourth_char??[]))if(opts.includes(this.call('convertEgoCommon',this.db.get('char_combatant',c.res_id).link_ego_type_id)))n++;triggered=cmp(n);break;}
   case 'CONDITION_CHAR_ID':triggered=this.b.chars.some(c=>c.opacity!==0&&event.unit_opt_multiple_link?.includes(c.res_id.toString()))||(this.b.assault_fourth_char?.opacity!==0&&this.b.assault_fourth_char!=null&&event.unit_opt_multiple_link?.includes(this.b.assault_fourth_char.res_id.toString()));break;
   case 'CONDITION_HP_COMP_START':event.ref=this.call('getStatus',this.b.char.id,'S_HP_REGIST');triggered=cmp(this.call('getStatus',this.b.char.id,'S_CURRENT_HP')-event.ref);break;
   case 'CONDITION_STAGE_PARAM':case 'CONDITION_STAGE_PARAM_SET':{const p=Object.values(this.stage.stage_parameters).find(p=>event.unit_opt_multiple_link?.includes(p.resid));if(p){if(key.endsWith('_SET'))set(p.value);else triggered=cmp(p.value);}break;}
   case 'CONDITION_ALL_MONSTER_TURN_COUNT':case 'CONDITION_ANY_MONSTER_TURN_COUNT':{const ms=this.b.monsters.filter(m=>['none','summoned','target_unable'].includes(m.state)),check=m=>cmp(Math.max(m.mon_turn??Infinity,0));event.prev_check=key.startsWith('CONDITION_ALL')?ms.every(check):ms.some(check);if(event.prev_check)triggered=true;break;}
   // Native @16203..16291 has the same no-throw diagnostic on the global
   // route. Keep the common accumulate tail and later event dispatch intact.
   default:this.call('ContentError','err:invalid_event_type_cond_without_param:'+key+':at_'+event.res_id,{channel:'#server_report_dev2'});break;
  }return result();
 }
}
