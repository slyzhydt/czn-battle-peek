// Source-derived ordinary monster CARD -> player ACTIVE calculation.
// Source map: evidence/active-critical/ACTIVE-MONSTER-SCOPE.md.
// Run on an executor fork: unsupported later branches reject the whole fork.
import {MissingBattleRule} from './resource-store.mjs';
import {numericConstant,damageReductionConstants} from './numeric-constant.mjs';
import {ActiveCriticalRuntime} from './active-critical-runtime.mjs';
import {damageMathSign,accumulateDamageMulti,procStatType,procRevise,decreaseDamage,floorGame,ceilGame,roundGame} from '../effects/effect-arithmetic.mjs';

export class ActiveMonsterDamageRuntime {
  constructor(e){this.e=e;this.b=e.b;this.w=e.wt;this.db=e.db;this.critical=new ActiveCriticalRuntime(e);}
  call(n,...a){return this.e.call(n,...a);}
  query(type,id,isCard=false,extra={}){return this.e.passives.query({source_id:id,type:'SKILL_EFF_'+type,is_card:isCard,...extra});}
  deny(type,id,isCard=false,extra={}){
    const owner=isCard?this.b.cardMap[id]:this.e.getUnit(id,true);
    const candidates=(owner?.passive??[]).map(([sid])=>this.b.skillMap[sid]).filter(p=>p&&!p.removed&&p.usable!==false&&this.db.get('skill_eff',p.res_id).eff==='SKILL_EFF_'+type);
    if(candidates.length)throw new MissingBattleRule('activeMonsterDamage.passive:'+type,{id,skills:candidates.map(p=>p.skill_id)});
    if(this.query(type,id,isCard,extra).length)throw new MissingBattleRule('activeMonsterDamage.passive:'+type,{id});
  }
  constant(id){return numericConstant(this,id);}
  parentAllows(p){const o=p.eff_opts??[];return !o.includes('tactic')&&!o.includes('cs')&&!o.includes('coop');}
  procDamageCalculate(a){
    const s=this.b.skillMap[a.skill_id];
    if(!s||a.is_pre||this.w.isPreview!=0||a.worktable!=null&&a.worktable!==this.w||s.parent?.type!=='CARD'||!this.e.getMonster(s.action_char_id)||a.coop_char!=null||a.motion_triggered||a.preDeath||a.preview_args||a.from_hud_preview||a.nihilum_meta||a.autoClient)
      throw new MissingBattleRule('activeMonsterDamage.ordinary_card_context',{skill_id:a.skill_id});
    const r=this.db.get('skill_eff',s.res_id),cardId=this.call('getSkillCardId',s),card=this.b.cardMap[cardId],target=this.b.char,source=this.e.getUnit(s.caster_id);
    if(!card||cardId<=0||source.id!==s.action_char_id||!['SKILL_EFF_DMG','SKILL_EFF_EXTRA_DMG','SKILL_EFF_DMG_IGNORE_COND'].includes(r.eff)||r.operation!=='OPERATION_ACTIVE'||r.target_unit_type!=='TARGET_UNIT_USER'||!Array.isArray(a.targets)||a.targets.length!==1||a.targets[0]!==target.id)
      throw new MissingBattleRule('activeMonsterDamage.target_or_parent');
    const attrArgs={},attrs=this.call('getAttrInfo',1,r.eff_attr,attrArgs);attrs.push(...(s.dmgAttrAdd??[]));
    if(attrs.length||Object.keys(attrArgs).length||s.eff_opts?.length||s.r_spark_multiply_pct_value||s.r_spark_count_value||card.talents?.length||card.nihilum_meta||s.parent_cards?.length||card.parent_cards?.length||r.value_save_renewal_flag==='YES'||this.db.get('card',card.res_id).sort==='SORT_SUPPORT')
      throw new MissingBattleRule('activeMonsterDamage.special_attributes');
    if(target.ego_field_value!=null||target.ego_field_egos?.length)throw new MissingBattleRule('activeMonsterDamage.player_ego_field');
    const extra={is_pre:false,char_id:s.action_char_id},extraIgnore={...extra,ignore_cs_list:undefined};
    const beforeTargets=this.b.cur_card_dmg_targets,actions=[],used=[],targets=a.targets;
    this.call('beginImmediatePassiveCSLogScope');
    try{
      this.b.cur_card_dmg_targets=targets;
      // Native setup @623..886, @1425..1648; no added attributes in this slice.
      this.deny('EGO_ATTACK_ALWAYS',cardId,true);this.deny('EGO_ATTACK_ALWAYS',target.id,false,{char_id:s.action_char_id});s.ego_attack=undefined;
      this.deny('DMG_ATTR_ADD_PASSIVE',card.caster_id,false,{is_pre:false,char_id:card.char_id});this.deny('DMG_ATTR_ADD_PASSIVE',cardId,true,{is_pre:false});
      const stat=this.call('getStatus',this.call('resolveStatSource',s.skill_id,s.stat_source),'S_ATK');
      const color=this.call('getEgo',cardId);if(color!=='NONE')throw new MissingBattleRule('activeMonsterDamage.ego_color',{color});
      this.deny('COUNT_ADD_DESTROY',source.id,false,extra);this.deny('COUNT_ADD_DESTROY',cardId,true,{is_pre:false});
      let count,finalCount=0;
      for(let i=0;i<=1000;i++){
        // @5136..6011 precedes the per-target count/termination test. Never
        // pre-roll: procDamageApply events may advance RNG between iterations.
        this.w.termPassiveImmediatlyList=[];
        const crit=this.critical.rollActiveCritical({skill_id:s.skill_id,card_id:cardId,is_pre:false,targets,dmg_attr:attrs,color_type:color});
        this.deny('SKIP_TERM_CHECK',source.id,false,extra);
        let hit=false;
        if(this.call('isFieldMonster',target)){
          this.deny('DMG_COUNT_VALUE_ADD',source.id,false,extra);this.deny('DMG_COUNT_VALUE_ADD',cardId,true,{is_pre:false});
          if(count==null)count=this.call('calcCountValue',s.skill_id,target.id,undefined)+(a.count_value_additional??0);
          if(!Number.isFinite(count)||count<0||count>1000)throw new MissingBattleRule('activeMonsterDamage.hit_count',{count});
          s.last_count_value=Math.max(s.last_count_value??0,count-(a.count_value_additional??0));
          this.deny('FIX_COUNT_DAMAGE_VALUE_ADD',source.id,false,extraIgnore);this.deny('FIX_COUNT_DAMAGE_VALUE_ADD',cardId,true,{is_pre:false});
          card.applied_atk_count=count;
          if(i<count){
            hit=true;
            const info=this.hit({a,s,r,source,target,cardId,attrs,attrArgs,color,stat,extra,extraIgnore,count,i,crit});
            actions.push({action_units:info.actions});
            used.push(...info.used.filter(id=>!used.includes(id)));
          }
        }
        if(!hit){
          finalCount=i;s.final_count_value=i;card.applied_atk_count=i;
          if(this.b.current_card_use_action)this.b.current_card_use_action.max_hit=Math.max(this.b.current_card_use_action.max_hit??0,i);
          if(!a.ignoreCond)this.call('procUnitEvent','CONDITION_CHAR_ATK_COUNT',[s.action_char_id,cardId,0,targets[0]??-1,i,attrs]);
          break;
        }
        if(i===1000)throw new MissingBattleRule('activeMonsterDamage.loop_bound');
      }
      if(!Array.isArray(this.w.triggeredList?.dmg_valueadd))throw new MissingBattleRule('activeMonsterDamage.triggeredList');
      this.w.triggeredList.dmg_valueadd.push(...used);s.leech_shield=undefined;s.leech_hp=undefined;
      if(actions.length)this.e.pushAction({id:this.b.last_action_id++,type:'action_damage',source_id:s.action_char_id,action_list:actions,card_id:cardId,byCard:true});
      if(target.refresh_noti)this.call('refreshMonsterNoti');
      for(const action of actions)for(const [id,info]of action.action_units)if(info.damage&&info.type)this.e.getUnit(id).lastDamageEvent=info;
      const logged=actions.map(action=>({action_units:action.action_units.filter(x=>!x[1]?.no_log)})).filter(action=>action.action_units.length);
      if(logged.length)this.call('addDetailLog',{type:'log_skill_eff_dmg',params:[logged,targets,finalCount,0,0,undefined],param_types:[]});
      // post_dmg_log 0x80200 is gameplay: pressure selection can consume RNG.
      if(actions.length)this.call('procDamageStressAction',actions,s.action_char_id);
      return undefined;
    }finally{this.b.cur_card_dmg_targets=beforeTargets;this.call('endImmediatePassiveCSLogScope');}
  }
  hit(c){
    const {a,s,r,source,target,cardId,attrs,attrArgs,color,stat,extra,extraIgnore,count,i,crit}=c;
    const currentCard=this.b.cardMap[cardId];
    if(s.ego_attack!=null||s.r_spark_multiply_pct_value||currentCard?.talents?.length||target.ego_field_value!=null||target.ego_field_egos?.length)
      throw new MissingBattleRule('activeMonsterDamage.changed_special_state');
    let value=this.call('calcValue',s.skill_id,target.id,false,undefined),rage=this.call('getRageDiff',true,false);
    if(rage!=null&&rage>=0)value*=this.constant('rage_base')*Math.pow(this.constant('rage_scale'),rage);
    const unreducing=this.query('UNREDUCING_HP',target.id).length>0;
    if(this.call('getEgo',cardId)!=='NONE')throw new MissingBattleRule('activeMonsterDamage.changed_ego_color');
    // Target is the player, so neither ordinary ego attack nor field damage
    // applies. Query order is still native; unsupported modifiers reject.
    this.deny('NOT_EGO_ATTACK',s.caster_id,false,extraIgnore);this.deny('NOT_EGO_ATTACK',cardId,true);
    this.deny('EGO_ATTACK_TAKE_ALWAYS',target.id,false,{caster_id:s.caster_id});
    this.deny('WEAK_EGO_DAMAGE_ALWAYS',s.caster_id,false,{char_id:s.action_char_id});this.deny('WEAK_EGO_DAMAGE_ALWAYS',cardId,true);
    if(a.card_activation===true&&!target.ego_breaked){
      this.deny('HIT_EGO_FIELD_DAMAGE_FIX_VALUE_ADD',source.id,false,extraIgnore);
      this.deny('HIT_EGO_FIELD_DAMAGE_FIX_VALUE_ADD',target.id,false,{is_pre:false,caster_id:s.action_char_id,ignore_cs_list:undefined});
      this.deny('HIT_EGO_FIELD_DAMAGE_FIX_VALUE_ADD',cardId,true,{is_pre:false,ignore_cs_list:undefined});
    }
    const outgoing=this.query('DAMAGE_VALUE_ADD',source.id,false,extraIgnore).filter(p=>!p.eff_opts?.includes('take')&&this.parentAllows(p));
    const incoming=this.query('DAMAGE_VALUE_ADD',target.id,false,{caster_id:s.action_char_id,is_pre:false,ignore_cs_list:undefined}).filter(p=>p.eff_opts?.includes('take')&&this.parentAllows(p));
    const fromCard=this.query('DAMAGE_VALUE_ADD',cardId,true,{is_pre:false,ignore_cs_list:undefined}).filter(p=>!p.eff_opts?.includes('take')&&this.parentAllows(p));
    let plus=0,buckets={multi:1,multi_dec:1,multi_final:1},takePlusMonster=0,takePlusUser=0,takeAmpMonster=0,takeAmpUser=0;const used=[];
    for(const p of outgoing.concat(incoming,fromCard)){
      const opts=p.eff_opts??[];
      if(!this.call('checkValueAddOpts',{passive_id:p.skill_id,skill_id:s.skill_id,card_id:cardId,target,egoAttack:false,dmg_attr:attrs,crit,destroy:false,ego_type:color,first_hit:i===0}))continue;
      if(opts.includes('multi')&&count<=1||opts.includes('single_hit')&&count!==1||opts.includes('all_attack_single_target')||opts.includes('all_attack')||opts.includes('multi_target'))continue;
      if(opts.includes('single_target'))throw new MissingBattleRule('activeMonsterDamage.isSingleTarget_USER');
      if(p.parent?.type==='CS')used.push(p.skill_id);
      if(!unreducing)this.call('checkTermValuePassive',p.skill_id,source.id,true,false);
      const pr=this.db.get('skill_eff',p.res_id),n=this.call('calcValue',p.skill_id,target.id,false,undefined,{card_id:cardId});
      if(!/^MATHSIGN_(?:ADD|SUBTRACT|(?:FINAL_)?(?:MULTIPLY|MULTIPLY_PCT|ADD_HUND_MULTIPLY_PCT|SUBTRACT_HUND_MULTIPLY_PCT))$/.test(pr.eff_value_math_sign))throw new MissingBattleRule('activeMonsterDamage.math_sign',{id:p.skill_id});
      const ch=damageMathSign(pr.eff_value_math_sign,n),take=opts.includes('take');
      const byMonster=!!this.e.getMonster(p.caster_id)||p.parent?.type==='CS'&&this.b.csMap[p.parent.id]?.by_monster===true;
      plus+=ch.plus;
      if(ch.plus!==0){if(take&&ch.plus>0){if(byMonster)takePlusMonster+=ch.plus;else takePlusUser+=ch.plus;}}
      else if(ch.multiValue!=null){buckets=accumulateDamageMulti(ch.multiValue,ch.is_final,take,buckets);if(take&&ch.multiValue>=1){if(byMonster)takeAmpMonster+=ch.multiValue-1;else takeAmpUser+=ch.multiValue-1;}}
    }
    if(this.call('isAssaultFourthCombatant',s.action_char_id))throw new MissingBattleRule('activeMonsterDamage.assault_fourth');
    plus=procRevise(0,procStatType(0,plus,stat),{});
    const final=buckets.multi_final*buckets.multi_dec,beforeFinal=value*buckets.multi+plus;
    value=beforeFinal*final;
    value=value>0?(final>1?ceilGame:final<1?floorGame:roundGame)(value):value<0?(final>1?floorGame:final<1?ceilGame:roundGame)(value):roundGame(value);
    const ampAll=beforeFinal*(takeAmpMonster+takeAmpUser)*buckets.multi_dec,ampMonster=beforeFinal*takeAmpMonster*buckets.multi_dec;
    const plusAll=(takePlusMonster+takePlusUser)*final,plusMonster=takePlusMonster*final;
    const monsterRatio=value>0?Math.max(0,Math.min(1,(value-ampAll-plusAll+ampMonster+plusMonster)/value)):1;
    this.call('setCardUseDisplaySkillValue',cardId,s.skill_id,target.id,{value});
    value=procRevise(1,procStatType(1,value,stat),{damage:this.constant('dmg_revise_rate')});
    value*=((100+this.call('getStatus',s.action_char_id,'S_NONE_DMG_RATE',0))/100);if(value<0)value=0;
    if(value>0&&crit){
      this.deny('CRITICAL_DAMAGE_VALUE_ADD',source.id,false,extraIgnore);this.deny('CRITICAL_DAMAGE_VALUE_ADD',cardId,true,{is_pre:false,ignore_cs_list:undefined});
      value=ceilGame(value*this.call('getStatus',s.action_char_id,'S_CRI_DMG_RATE')/100);
    }
    const partyDef=this.call('getStatus',target.id,'S_DEF');value=decreaseDamage(value,{statType:1,isMonsterTarget:false,partyDef,...damageReductionConstants(this,partyDef)});
    if(value>0){this.deny('FINAL_DAMAGE_VALUE_ADD',source.id,false,extraIgnore);this.deny('FINAL_DAMAGE_VALUE_ADD',target.id,false,{caster_id:s.action_char_id,is_pre:false,ignore_cs_list:undefined});this.deny('FINAL_DAMAGE_VALUE_ADD',cardId,true,{is_pre:false,ignore_cs_list:undefined});}
    this.call('setCardUseDisplaySkillValue',cardId,s.skill_id,target.id,{result_value:value});
    this.deny('DMG_VALUE_ADD_ADDITIONAL',source.id,false,{...extra,caster_id:s.caster_id});this.deny('DMG_VALUE_ADD_ADDITIONAL',target.id,false,{is_pre:false,ignore_cs_own_type:true});
    const result=this.call('procDamageApply',{worktable:this.w,caster_id:s.action_char_id,target,eff_value:value,card_id:cardId,parent_card_id:undefined,skill_id:s.skill_id,isPre:false,ignoreCond:a.ignoreCond,dmgAttr:attrs,attrArgs,index:i,ref:undefined,opt:s.eff_opts??[],fix:false,weakEgoAttack:false,egoFieldDmg:0,system_eff:i===0?r.link_battle_system_effect_id:undefined,isCrit:crit,dva_css:used,dmgAdditionals:[],char_id:s.action_char_id,target_char_id:undefined,is_last_attack:i===count-1,monster_dmg_ratio:monsterRatio});
    if(!Array.isArray(result?.ret_actions))throw new MissingBattleRule('activeMonsterDamage.apply_result');
    if(result.deadEvent)this.b.deads.push({source_id:target.id,by:'card',killer:source.id,prevHP:result.prevHP,deadEvent:result.deadEvent,card_id:cardId,trigger_cause_card_id:this.call('getTriggerCauseCardId',this.b.skillMap[s.skill_id]),all_attack:false});
    return {actions:result.ret_actions,used};
  }
}
