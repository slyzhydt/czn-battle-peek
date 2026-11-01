// Focused, handwritten native monster-card notice path. This is deliberately
// narrower than procDamageCalculate: unsupported active families reject a fork.
// Evidence: evidence/damage-preview; procDamageCalculate 0x4a500,
// anonymous_53 0x5d300, filters 0x6d100..0x6ee00, dmgDecrease 0x72f00.
import {MissingBattleRule} from './resource-store.mjs';
import {damageMathSign,accumulateDamageMulti,procStatType,procRevise,decreaseDamage,floorGame,ceilGame,roundGame} from '../effects/effect-arithmetic.mjs';
export class DamagePreviewRuntime {
  constructor(e){this.e=e;this.b=e.b;this.w=e.wt;this.db=e.db;}
  call(n,...a){return this.e.call(n,...a);}
  query(type,source,isCard=false,extra={}){return this.e.passives.query({source_id:source,type,is_card:isCard,...extra});}
  absent(type,source,isCard=false,extra={}){
    const unit=isCard?this.b.cardMap[source]:this.e.getUnit(source,true),possible=(unit?.passive??[]).map(x=>this.b.skillMap[x[0]]).filter(s=>s&&!s.removed&&s.usable!==false&&this.db.get('skill_eff',s.res_id).eff===type);
    // Reject even a probabilistic unported passive before querying it; a failed
    // probability roll must not hide a missing branch or alter draw ordering.
    if(possible.length)throw new MissingBattleRule('damagePreview.passive:'+type,{source,skills:possible.map(x=>x.skill_id)});
    const found=this.query(type,source,isCard,extra);if(found.length)throw new MissingBattleRule('damagePreview.passive:'+type,{source,skills:found.map(x=>x.skill_id)});
  }
  resolveStatSource(id,source){if(source!==-1)return source;const s=this.b.skillMap[id],c=s?.card_triggered?this.b.cardMap[s.card_triggered]:null;return c?[4,5,6].includes(c.char_id)?c.char_id-3:c.char_id:this.b.char.id;}
  getAttrInfo(kind,input,args={}){
    const attrs=[],prefix=({1:'DMG',2:'SHIELD',3:'CURE',4:'HEAL'}[kind]??'')+'_ATTR_IGNORE_CS_';
    // Resource rows use raw packaged strings; the strict value adapter has
    // already decoded eff_attr. Native getAttrInfo iterates the array in both
    // callers. Never decode an already materialized array a second time.
    for(const item of Array.isArray(input)?input:this.db.array(input)){
      if(item.startsWith('DMG_ATTR_LEECH_HP_PCT')){args.leech_hp=(args.leech_hp??0)+Number(item.slice('DMG_ATTR_LEECH_HP_PCT'.length+1));attrs.push('DMG_ATTR_LEECH_HP_PCT');}
      else if(item.startsWith('DMG_ATTR_LEECH_SHIELD_PCT')){args.leech_shield=(args.leech_shield??0)+Number(item.slice('DMG_ATTR_LEECH_SHIELD_PCT'.length+1));attrs.push('DMG_ATTR_LEECH_SHIELD_PCT');}
      else if(item.startsWith('CURE_ATTR_MAX_HP_MAX_PCT')){args.cure_max_hp_pct=Number(item.slice('CURE_ATTR_MAX_HP_MAX_PCT'.length+1));attrs.push('CURE_ATTR_MAX_HP_MAX_PCT');}
      else if(item.startsWith(prefix)){(args.ignore_cs_list??=[]).push(item.slice(prefix.length));}
      else attrs.push(item);
    }return attrs;
  }
  // Restrict the adapter to rows whose additional filters have no active
  // branch. 'attack' is a term-consumption option, not a checkValueAddOpts gate.
  plainPassive(p,skill,target,cardId){
    const r=this.db.get('skill_eff',p.res_id),opts=p.eff_opts??[];
    const allowed=new Set(['attack','take','card','cs','tactic','coop','multi','single_hit','multi_target']);
    if(opts.some(x=>!allowed.has(x)))throw new MissingBattleRule('damagePreview.passive_options',{id:p.skill_id,opts});
    if(r.target_unit_type==='TARGET_UNIT_EXCEPT_CHAR'&&p.action_char_id===skill.action_char_id)return false;
    if(p.link_cs_ids?.length)return false; // Current root is CARD; native requires CS.
    for(const k of ['eff_attr','target_card_set_opt_multiple_link','target_card_set_talent','target_card_set_opt_rarity','target_card_set_card_sort','target_card_set_card_type','target_card_set_ego_type','target_card_set_faction','target_unit_type_opt','target_unit_type_opt_link_cs_id','target_card_set_opt_cost']){
      if(this.db.array(r[k]).length)throw new MissingBattleRule('damagePreview.passive_filter:'+k,{id:p.skill_id});
    }
    if(!['CARD_SET_NONE','CARD_SET_ALL'].includes(r.target_card_set))throw new MissingBattleRule('damagePreview.passive_card_set',{id:p.skill_id,value:r.target_card_set});
    if(opts.includes('tactic')||opts.includes('cs')||opts.includes('coop'))return false;
    return true;
  }
  procDamageCalculate(args){
    const s=this.b.skillMap[args.skill_id],r=this.db.get('skill_eff',s.res_id),cardId=this.call('getSkillCardId',s),card=this.b.cardMap[cardId];
    if(args.is_pre!==true||!this.e.getMonster(s.action_char_id)||s.parent.type!=='CARD'||args.coop_char!=null||args.motion_triggered||args.preDeath||args.preview_args||args.from_hud_preview)
      throw new MissingBattleRule('procDamageCalculate.outside_monster_notice',{id:s.skill_id});
    const attrArgs={},attrs=this.getAttrInfo(1,r.eff_attr,attrArgs);attrs.push(...(s.dmgAttrAdd??[]));
    if(attrs.length||s.eff_opts?.length||s.r_spark_multiply_pct_value||card.talents?.length||card.nihilum_meta||s.ego_attack!=null)
      throw new MissingBattleRule('damagePreview.attributes_or_card_options',{id:s.skill_id,attrs});
    if(r.target_unit_type!=='TARGET_UNIT_USER'||args.targets.some(id=>id!==this.b.char.id))throw new MissingBattleRule('damagePreview.target_mode',{id:s.skill_id});
    const source=this.e.getUnit(s.caster_id),target=this.b.char,extra={is_pre:true,char_id:s.action_char_id};
    this.absent('SKILL_EFF_DMG_ATTR_ADD_PASSIVE',card.caster_id,false,{is_pre:true,char_id:card.char_id});this.absent('SKILL_EFF_DMG_ATTR_ADD_PASSIVE',cardId,true,{is_pre:true});
    this.absent('SKILL_EFF_CHANGE_EGO',this.b.char.id,false,{char_id:card.char_id});this.absent('SKILL_EFF_CHANGE_EGO',cardId,true);
    // Empty inherited ego_type converts to NONE (ContentsProc 0x3f00 default).
    // NONE's color has its own status read with native default 0 below.
    const cr=this.db.get('card',card.res_id);if(!['','EGO_NONE','none','NONE'].includes(cr.ego_type))throw new MissingBattleRule('damagePreview.card_ego',{id:cardId,value:cr.ego_type});card.curEgo='NONE';
    for(const type of ['SKILL_EFF_COUNT_ADD_DESTROY','SKILL_EFF_CRITICAL_ALWAYS','SKILL_EFF_FIX_COUNT_DAMAGE_VALUE_ADD','SKILL_EFF_DMG_COUNT_VALUE_ADD']){this.absent(type,source.id,false,extra);this.absent(type,cardId,true,{is_pre:true});}
    if(!this.call('isFieldMonster',target))return [];
    for(const type of ['SKILL_EFF_NOT_EGO_ATTACK','SKILL_EFF_WEAK_EGO_DAMAGE_ALWAYS']){this.absent(type,source.id,false,extra);this.absent(type,cardId,true,{is_pre:true});}
    this.absent('SKILL_EFF_EGO_ATTACK_TAKE_ALWAYS',target.id,false,{caster_id:s.caster_id});
    const beforeTargets=this.b.cur_card_dmg_targets;this.b.cur_card_dmg_targets=args.targets;
    const result=[],usedPassives=[];
    try{
      // Source outer loop evaluates one final, non-executing iteration after
      // the last hit. It still refreshes final_count_value and immediate list.
      const count=this.call('calcCountValue',s.skill_id,target.id,args.preview_args)+(args.count_value_additional??0);
      if(!Number.isFinite(count)||count<0||count>1000)throw new MissingBattleRule('damagePreview.hit_count',{count});
      s.last_count_value=Math.max(s.last_count_value??0,count-(args.count_value_additional??0));card.applied_atk_count=count;
      for(let i=0;i<count;i++){
        this.w.termPassiveImmediatlyList=[];
        this.absent('SKILL_EFF_SKIP_TERM_CHECK',source.id,false,extra);
        let value=this.call('calcValue',s.skill_id,target.id,false,args.preview_args),rage=this.call('getRageDiff',true,true);
        if(rage!=null&&rage>=0)value*=Number(this.db.get('constant_meta','rage_base').value)*Math.pow(Number(this.db.get('constant_meta','rage_scale').value),rage);
        const unreducing=this.query('SKILL_EFF_UNREDUCING_HP',target.id).length>0;
        const outgoing=this.query('SKILL_EFF_DAMAGE_VALUE_ADD',source.id,false,extra).filter(p=>!p.eff_opts?.includes('take'));
        const incoming=this.query('SKILL_EFF_DAMAGE_VALUE_ADD',target.id,false,{is_pre:true,caster_id:s.action_char_id}).filter(p=>p.eff_opts?.includes('take'));
        const fromCard=this.query('SKILL_EFF_DAMAGE_VALUE_ADD',cardId,true,{is_pre:true}).filter(p=>!p.eff_opts?.includes('take'));
        let plus=0,buckets={multi:1,multi_dec:1,multi_final:1};const hitPassives=[];
        for(const p of outgoing.concat(incoming,fromCard)){
          if(!this.plainPassive(p,s,target,cardId))continue;
          const opts=p.eff_opts??[];if(opts.includes('multi')&&count<=1||opts.includes('single_hit')&&count!==1||opts.includes('multi_target')&&args.targets.length<2)continue;
          if(p.parent.type==='CS')hitPassives.push(p.skill_id);
          if(!unreducing)this.call('checkTermValuePassive',p.skill_id,source.id,true,true);
          const pr=this.db.get('skill_eff',p.res_id),v=this.call('calcValue',p.skill_id,target.id,false,undefined,{card_id:cardId}),change=damageMathSign(pr.eff_value_math_sign,v);
          plus+=change.plus;if(change.multiValue!=null)buckets=accumulateDamageMulti(change.multiValue,change.is_final,opts.includes('take'),buckets);
        }
        const final=buckets.multi_final*buckets.multi_dec;plus=procRevise(0,procStatType(0,plus,0),{});
        value=(value*buckets.multi+plus)*final;
        value=value>0?(final>1?ceilGame:final<1?floorGame:roundGame)(value):value<0?(final>1?floorGame:final<1?ceilGame:roundGame)(value):roundGame(value);
        this.call('setCardUseDisplaySkillValue',cardId,s.skill_id,target.id,{value});
        value=procRevise(1,procStatType(1,value,this.call('getStatus',this.resolveStatSource(s.skill_id,s.stat_source),'S_ATK')),{damage:Number(this.db.get('constant_meta','dmg_revise_rate').value)});
        const colorRate=this.call('getStatus',s.action_char_id,'S_NONE_DMG_RATE',0);value*=((100+colorRate)/100);if(value<0)value=0;
        value=decreaseDamage(value,{statType:1,isMonsterTarget:false,partyDef:this.call('getStatus',target.id,'S_DEF'),zeroValue:Number(this.db.get('constant_meta','dmg_decrease_rate_0_value').value),curveValue:Number(this.db.get('constant_meta','dmg_decrease_rate_curv_value').value)});
        this.absent('SKILL_EFF_FINAL_DAMAGE_VALUE_ADD',source.id,false,extra);this.absent('SKILL_EFF_FINAL_DAMAGE_VALUE_ADD',target.id,false,{caster_id:s.action_char_id,is_pre:true});this.absent('SKILL_EFF_FINAL_DAMAGE_VALUE_ADD',cardId,true,{is_pre:true});
        this.call('setCardUseDisplaySkillValue',cardId,s.skill_id,target.id,{result_value:value});
        this.absent('SKILL_EFF_DMG_VALUE_ADD_ADDITIONAL',source.id,false,{...extra,caster_id:s.caster_id});this.absent('SKILL_EFF_DMG_VALUE_ADD_ADDITIONAL',target.id,false,{is_pre:true,ignore_cs_own_type:true});
        const applied=this.call('procDamageApply',{caster_id:s.action_char_id,target,eff_value:value,card_id:cardId,skill_id:s.skill_id,isPre:true,ignoreCond:args.ignoreCond,dmgAttr:attrs,attrArgs,index:i,ref:undefined,opt:s.eff_opts??[],fix:false,weakEgoAttack:false,egoFieldDmg:0,system_eff:i===0?r.link_battle_system_effect_id:undefined,isCrit:false,dva_css:hitPassives,dmgAdditionals:[],char_id:s.action_char_id,target_char_id:undefined,is_last_attack:i===count-1,monster_dmg_ratio:1});
        // Native procDamageApply returns {deadEvent,ret_actions,prevHP,
        // damage_amount}; notice flattens ret_actions, not the death event.
        if(!Array.isArray(applied?.ret_actions))throw new MissingBattleRule('damagePreview.apply_shape');
        result.push(...applied.ret_actions);
        usedPassives.push(...hitPassives);
      }
      this.w.termPassiveImmediatlyList=[];s.final_count_value=count;if(this.b.current_card_use_action)this.b.current_card_use_action.max_hit=Math.max(this.b.current_card_use_action.max_hit??0,count);
      if(this.w.triggeredList?.dmg_valueadd)this.w.triggeredList.dmg_valueadd.push(...usedPassives);else throw new MissingBattleRule('damagePreview.triggeredList');
      if(r.value_save_renewal_flag==='YES')throw new MissingBattleRule('damagePreview.save_value');
      s.leech_shield=undefined;s.leech_hp=undefined;return result;
    }finally{this.b.cur_card_dmg_targets=beforeTargets;}
  }
}
