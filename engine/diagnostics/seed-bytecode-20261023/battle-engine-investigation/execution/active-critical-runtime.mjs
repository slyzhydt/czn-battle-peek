// Hand port of the ACTIVE critical decision inside procDamageCalculate.
// Source: evidence/damage-preview/procDamageCalculate_0xf0000004a500.linear.js
// Outer 3526..3739, 5544..6011; anonymous_50 0x5a900, 0..947.
// This is ONE loop-iteration decision, not a damage calculator or a hit loop.
import {MissingBattleRule} from './resource-store.mjs';

export class ActiveCriticalRuntime {
  constructor(e){this.e=e;this.b=e.b;this.w=e.wt;this.db=e.db;}
  call(name,...args){return this.e.call(name,...args);}
  rollActiveCritical(a){
    // The caller must supply attrs/color after the native setup pass. Do not
    // infer them from a resource row, which misses transient/passive additions.
    if(a.is_pre!==false||this.w.isPreview!=0||!Array.isArray(a.targets)||!Array.isArray(a.dmg_attr)||typeof a.color_type!=='string'||a.card_id==null)
      throw new MissingBattleRule('activeCritical.prepared_context');
    const skill=this.b.skillMap[a.skill_id];
    if(!skill)throw new MissingBattleRule('activeCritical.skill',{id:a.skill_id});
    const source=this.e.getUnit(skill.caster_id),charId=a.coop_char??skill.action_char_id;
    // Native r11 is enabled only in actual calculation; r12 (CRITICAL_ALWAYS)
    // belongs to notice/UI calculation and is deliberately not evaluated here.
    if(a.dmg_attr.includes('DMG_ATTR_NO_STAT_CRI')||source.id===this.b.char.id&&a.targets.length===1&&a.targets[0]===this.b.char.id)return false;
    let chance=this.call('getStatus',charId,'S_CRI');
    const extra={is_pre:false,ignore_cs_list:a.ignore_cs_list};
    const sourcePassives=this.e.passives.query({source_id:source.id,type:'SKILL_EFF_CRITICAL_PCT_VALUE_ADD',is_card:false,...extra,char_id:charId});
    const cardId=a.parent_card_id??a.card_id;
    const cardPassives=this.e.passives.query({source_id:cardId,type:'SKILL_EFF_CRITICAL_PCT_VALUE_ADD',is_card:true,...extra});
    let plus=0,multi=1,set,fixedType;
    for(const p of sourcePassives.concat(cardPassives)){
      const row=this.db.get('skill_eff',p.res_id);
      const target=a.targets.length===1?this.e.getUnit(a.targets[0]):undefined;
      if(!this.call('checkValueAddOpts',{passive_id:p.skill_id,skill_id:skill.skill_id,card_id:cardId,target,ego_type:a.color_type}))continue;
      // Native consumes a matching passive before choosing its math operator;
      // lower-priority overrides still consume term even when calcValue skips.
      this.call('checkTermValuePassive',p.skill_id,skill.caster_id,true,false);
      const value=()=>this.call('calcValue',p.skill_id);
      switch(row.eff_value_math_sign){
        case 'MATHSIGN_ADD':plus+=value();break;
        case 'MATHSIGN_MULTIPLY':multi*=value();break;
        case 'MATHSIGN_MULTIPLY_PCT':multi*=value()/100;break;
        case 'MATHSIGN_ADD_HUND_MULTIPLY_PCT':multi*=(100+value())/100;break;
        case 'MATHSIGN_SUBTRACT_HUND_MULTIPLY_PCT':multi*=(100-value())/100;break;
        case 'MATHSIGN_SET':if(fixedType==null)set=Math.max(set??-Infinity,value());break;
        case 'MATHSIGN_FIX_R_SPARK':fixedType=1;set=value();break;
        case 'MATHSIGN_FIX_EQUIP':if(fixedType==null||fixedType>=2){fixedType=2;set=value();}break;
        case 'MATHSIGN_FIX_CARD':if(fixedType==null||fixedType>=3){fixedType=3;set=value();}break;
        default:throw new MissingBattleRule('activeCritical.math_sign',{id:p.skill_id,sign:row.eff_value_math_sign});
      }
    }
    chance=(chance+plus)*multi;if(set!=null)chance=set;
    // Native isNaN (not isFinite): infinity and values beyond [0,100] still
    // call RNG. 0% and 100% also advance it. NaN alone bypasses the draw.
    return isNaN(chance)?false:this.e.random.randomTFbyProbability(0,chance);
  }
}
