// Independent hand ports of SkillEffectProc 0x82900, 0x8d000, 0x95900,
// 0x8af00. Full static evidence lives in evidence/heal-shield/. Runtime
// worktable arguments are supplied by this instance; no recovered JS is run.
import {MissingBattleRule} from './resource-store.mjs';
import {floorGame,ceilGame,roundGame,procStatType,procRevise,damageMathSign,accumulateDamageMulti} from '../effects/effect-arithmetic.mjs';
export class HealShieldRuntime {
  constructor(e){this.e=e;this.b=e.b;this.w=e.wt;this.db=e.db;}
  call(n,...a){return this.e.call(n,...a);}
  get stage(){const s=this.e.state?.worktables?.BattleStageWorktable?.battle_stage;if(!s)throw new MissingBattleRule('healShield.stage');return s;}
  isAssaultRiskFactorActive(){if(!this.call('isAssaultMode'))return false;const id=this.stage.chaos_assault_list_id;return !!id&&this.db.get('chaos_assault_list',id)?.use_risk_factor==='yes';}
  isAssaultFourthCombatant(id){return this.call('isAssaultMode')&&id==7;}
  getPassiveByTypeGamecoreForChar(type,id){return this.call('getPassiveByTypeGamecore',type).filter(p=>p.linked_type!=='PARTNER_EGO_PASSIVE'||p.linked_char_id==null||p.linked_char_id==id);}
  getNonBattleEffPctAdd(type,id){return this.getPassiveByTypeGamecoreForChar(type,id).reduce((n,p)=>n+p.eff_value+(p.add_value??0),0)/100;}
  calculationParent(skill){
    let cardId=-1;if(skill.parent.type==='CARD')cardId=skill.parent.id;else if(skill.parent.type==='SKILL'){const p=this.b.skillMap[skill.parent.id];if(p.parent.type==='CARD')cardId=p.parent.id;}
    // Preserve the shipped walk: after each nested SKILL, the next cursor is
    // the parent's parent id. Missing intermediate parent breaks the walk.
    let kind=skill.parent.type,cursor=skill.skill_id,guard=0;while(kind==='SKILL'){
      if(++guard>1000)throw new MissingBattleRule('healShield.parent_cycle');
      const p=this.b.skillMap[this.b.skillMap[cursor].parent.id];if(!p)break;kind=p.parent.type;cursor=p.parent.id;
    }
    const card=this.b.cardMap[cardId],row=card?this.db.get('card',card.res_id):undefined;
    return {cardId,filter:p=>(!p.eff_opts?.includes('tactic')||(kind==='CARD'&&row?.sort==='SORT_SUPPORT'))&&(!p.eff_opts?.includes('cs')||kind==='CS')&&(!p.eff_opts?.includes('card')||(kind==='CARD'&&!!row&&row.sort!=='SORT_SUPPORT'))};
  }
  roundModified(value,final){return value>0?(final>1?ceilGame:final<1?floorGame:roundGame)(value):value<0?(final>1?floorGame:final<1?ceilGame:roundGame)(value):roundGame(value);}
  modifyAmount(value,{skill,row,target,cardId,filter,isPre,attrs,ignoreCs,kind,fixedWill=false}){
    const shield=kind==='shield',type=shield?'SKILL_EFF_SHIELD_VALUE_ADD':kind==='cure'?'SKILL_EFF_CURE_VALUE_ADD':'SKILL_EFF_HEAL_VALUE_ADD';
    const unitQuery={source_id:target.id,type,is_card:false,is_pre:isPre,char_id:skill.action_char_id},cardQuery={source_id:cardId,type,is_card:true,is_pre:isPre};
    if(shield){unitQuery.ignore_cs_list=ignoreCs;cardQuery.ignore_cs_list=ignoreCs;}
    const unitPs=this.call('getPassiveByType',unitQuery).filter(filter),cardPs=this.call('getPassiveByType',cardQuery).filter(filter);
    let plus=0,buckets={multi:1+(skill.r_spark_multiply_pct_value??0)/100,multi_dec:1,multi_final:1};
    if(shield&&!fixedWill)for(const n of [0,1])if(attrs.includes(`SHIELD_ATTR_DEXTERITY_REF_${n}`))plus+=(this.b.stackMap[skill['stack_value'+n]??-1]?.stack??0)*20;
    for(const p of unitPs.concat(cardPs)){
      const pr=this.db.get('skill_eff',p.res_id),opts={passive_id:p.skill_id,skill_id:skill.skill_id,card_id:cardId,target};if(shield)opts.shield_attr=attrs;
      if(!this.call('checkValueAddOpts',opts))continue;
      // Fixed shield's WILL branch 0x93400 has an outer ADD-only gate;
      // the copied multiplier branches inside that gate are unreachable for
      // these immutable resource rows. ADD checks options a second time,
      // deliberately omitting shield_attr (offsets 100..178).
      if(fixedWill){if(pr.eff_value_math_sign!=='MATHSIGN_ADD')continue;const again={...opts};delete again.shield_attr;if(!this.call('checkValueAddOpts',again))continue;}
      if(!shield)this.call('checkTermValuePassive',p.skill_id,target.id,true,isPre);
      const sign=pr.eff_value_math_sign;
      const valid=sign==='MATHSIGN_ADD'||!shield&&sign==='MATHSIGN_SUBTRACT'||/^MATHSIGN_(FINAL_)?(MULTIPLY|MULTIPLY_PCT|ADD_HUND_MULTIPLY_PCT|SUBTRACT_HUND_MULTIPLY_PCT)$/.test(sign);
      // Heal computes even an invalid sign's value before content reporting;
      // shield's dispatch reports an invalid sign before any calcValue call.
      let v;if(!shield)v=this.call('calcValue',p.skill_id,target.id);
      if(!valid)throw new MissingBattleRule('healShield.invalid_value_add_sign',{sign,id:p.skill_id});
      if(shield)v=this.call('calcValue',p.skill_id,target.id);const change=damageMathSign(sign,v);
      if(!shield&&change.plus===0&&change.multiValue==null)this.call('contentError',`err:invalid_math_sign:${sign}:${pr.id}`,{channel:'#server_report_dev2'});
      if(shield&&!fixedWill&&row.eff==='SKILL_EFF_SHIELD_IGNORE_VALUE_DEBUFF'&&(sign==='MATHSIGN_ADD'?v<=0:change.multiValue<=1))continue;
      plus+=change.plus;if(change.multiValue!=null)buckets=accumulateDamageMulti(change.multiValue,change.is_final,false,buckets);
      if(shield){if(this.w.isPreview==cardId&&p.parent.type==='CS')this.w.triggeredList.shield_valueadd.push(p.skill_id);this.call('checkTermValuePassive',p.skill_id,skill.caster_id,true,isPre);}
    }
    if(this.isAssaultFourthCombatant(skill.action_char_id))buckets.multi+=Number(this.db.get('chaos_assault_list',this.stage.chaos_assault_list_id??'')?.[shield?'combatant_4_shield_pct':'combatant_4_heal_pct']??0)/100;
    if(!this.e.getMonster(skill.action_char_id)){buckets.multi+=(this.b.char.status.info.S_ZERO_TACTICS_SHIELD_HEAL_UP_RATE__VALUE??0)/100;buckets.multi+=this.getNonBattleEffPctAdd('EFF_SHIELD_HEAL_UP_RATE_PCT_MULTIPLY',skill.action_char_id);}
    const final=buckets.multi_final*buckets.multi_dec;return this.roundModified((value*buckets.multi+plus)*final,final);
  }
  procHealCalculate(casterId,targets,skillId,countAdditional=0,isPre=false,isCure=false,ignoreCond=false,suppressAction=false){
    const skill=this.b.skillMap[skillId],source=this.call('resolveStatSource',skillId,skill.stat_source),row=this.db.get('skill_eff',skill.res_id),parent=this.calculationParent(skill),{cardId}=parent,args={},attrs=this.call('getAttrInfo',isCure?3:4,row.eff_attr,args),has=x=>attrs.includes((isCure?'CURE_ATTR_':'HEAL_ATTR_')+x);
    const stat=this.call('getStatus',source,isCure&&has('ATK')?'S_ATK':this.e.getMonster(source)?'S_DEF':'S_DEF_SHIELD'),revise=isCure&&has('IGNORE_REVISE')?0:2,statType=isCure&&has('IGNORE_STAT')?0:2;
    const counts={},actions=[];let total=0,coeffs=0,logged=false;
    for(let i=0;;i++){
      if(i>1000)throw new MissingBattleRule('procHealCalculate.iteration_budget');this.w.termPassiveImmediatlyList=[];const action={action_units:[]};let any=false;
      for(const id of targets){let target=this.e.getUnit(id);if(!this.call('isFieldMonster',target))continue;const count=counts[target.id]??=(this.call('calcCountValue',skillId,target.id)+countAdditional);if(i>=count)continue;
        if(row.target_unit_type==='TARGET_UNIT_ALL_RAN_ENEMY'&&i>0){const choices=this.call('getTargetableMonstersID',{skill_id:skillId});if(choices.length)target=this.e.getUnit(this.e.random.randomArrayMember(0,choices));}any=true;
        let value=this.call('calcValue',skillId,target.id),coeff=0;
        if(!has('FIX'))value=this.modifyAmount(value,{skill,row,target,...parent,isPre,attrs,kind:isCure?'cure':'heal'});
        if(isCure||has('BASE_ON_DEF')){coeff=value;value=procRevise(revise,procStatType(statType,coeff,stat),{shield:Number(this.db.get('constant_meta','shield_revise_rate').value)});}
        if(isCure&&has('MAX_HP_MAX_PCT')&&args.cure_max_hp_pct!=null)value=Math.min(value,floorGame(this.e.getUnit(casterId).status.info.S_HP*args.cure_max_hp_pct/100));
        if(!isCure||value>0){const applied=this.procHealApply(casterId,target,value,cardId,{isCure,ignoreCond,isAuto:has('AUTO')});if(applied!=null){if(isCure)coeffs+=coeff;logged=true;action.action_units.push(...applied);const first=applied[0];if(first[1].heal!=null)total+=first[1].new_hp-first[1].old_hp;}}
      }
      if(!any){skill.final_count_value=i;break;}actions.push(action);
    }
    if(!isPre&&!suppressAction&&actions.length){this.e.pushAction({id:this.b.last_action_id++,type:'action_heal',source_id:skill.action_char_id,action_list:actions,card_id:cardId,byCard:cardId>0});if(logged)this.call('addDetailLog',{type:'log_skill_eff_heal',params:[actions,targets,actions.length,row.target_unit_type==='TARGET_UNIT_ALL_RAN_ENEMY'],param_types:[]});if(total>0)this.procStressRecoverByCure(coeffs);}
    return {total_heal_amount:total,total_coeffs:coeffs,action_list:actions};
  }
  procShieldCalculate(targets,skillId,countAdditional=0,ignoreCond,autoClient=false,isPre=false){
    const skill=this.b.skillMap[skillId],source=this.call('resolveStatSource',skillId,skill.stat_source),row=this.db.get('skill_eff',skill.res_id),parent=this.calculationParent(skill),{cardId}=parent,args={},attrs=this.call('getAttrInfo',2,row.eff_attr,args);attrs.push(...(skill.shieldAttrAdd??[]));
    const has=x=>attrs.includes('SHIELD_ATTR_'+x),fix=has('FIX'),counts={},actions=[];let total=0,coeffs=0,hits=0;
    let stat=this.call('getStatus',source,'S_DEF');if(!this.e.getMonster(source))stat=this.call('getStatus',source,'S_DEF_SHIELD');
    for(let i=0;;i++){
      if(i>1000)throw new MissingBattleRule('procShieldCalculate.iteration_budget');this.w.termPassiveImmediatlyList=[];const action={action_units:[]};let any=false;
      for(const id of targets){let target=this.e.getUnit(id);if(!this.call('isFieldMonster',target)||this.call('getStatus',target.id,'S_CURRENT_HP')==0)continue;const count=counts[target.id]??=(this.call('calcCountValue',skillId,target.id)+countAdditional);if(i>=count)continue;
        if(row.target_unit_type==='TARGET_UNIT_ALL_RAN_ENEMY'&&i>0){const choices=this.call('getTargetableMonstersID',{skill_id:skillId});if(choices.length)target=this.e.getUnit(this.e.random.randomArrayMember(0,choices));}any=true;
        let value=this.call('calcValue',skillId,target.id);
        const will=this.call('getPassiveByType',{source_id:target.id,type:'SKILL_EFF_APPLY_WILL_TO_FIXEDSHIELD',is_card:false,is_pre:isPre,char_id:skill.action_char_id,ignore_cs_list:args.ignore_cs_list});
        if(!fix)value=this.modifyAmount(value,{skill,row,target,...parent,isPre,attrs,ignoreCs:args.ignore_cs_list,kind:'shield'});
        else if(will.length&&!this.e.getMonster(target.id))value=this.modifyAmount(value,{skill,row,target,...parent,isPre,attrs,ignoreCs:args.ignore_cs_list,kind:'shield',fixedWill:true});
        else if(skill.r_spark_multiply_pct_value)value=ceilGame(value*(1+skill.r_spark_multiply_pct_value/100));
        coeffs+=value;value=procRevise(has('IGNORE_REVISE')?0:2,procStatType(has('IGNORE_STAT')?0:2,value,stat),{shield:Number(this.db.get('constant_meta','shield_revise_rate').value)});if(value<0)value=0;
        if(value<=0&&(autoClient||has('AUTO')))continue;
        const applied=this.procShieldApply(skill.caster_id,target,value,cardId,ignoreCond,isPre,fix);action.action_units.push(applied);total+=applied[1].shield;
      }
      if(!any){hits=i;skill.final_count_value=i;if(this.b.current_card_use_action)this.b.current_card_use_action.max_hit=Math.max(this.b.current_card_use_action.max_hit??0,i);break;}
      if(row.value_save_renewal_flag==='YES'){this.call('saveValue',skill.parent.type.toLowerCase(),skill.parent.id,total);this.call('saveCoeffValue',skill.parent.type.toLowerCase(),skill.parent.id,coeffs);}actions.push(action);
    }
    if(isPre)return actions.flatMap(a=>a.action_units);
    const auto=has('AUTO')||autoClient,action={id:this.b.last_action_id++,type:auto?'action_shield_auto':'action_shield',source_id:skill.action_char_id,action_list:actions,card_id:cardId};if(!auto)action.byCard=cardId>0;this.e.pushAction(action);
    if(actions.length)this.call('addDetailLog',{type:'log_skill_eff_shield',params:[actions,targets,hits,0,row.target_unit_type==='TARGET_UNIT_ALL_RAN_ENEMY'],param_types:[]});
  }
  reduceAssault(target,amount,key){
    if(this.isAssaultRiskFactorActive()&&!this.e.getMonster(target.id)){
      const row=this.db.get('assault_constant_meta',key),turn=(this.b.turn??1)-1;
      if(row&&turn>0&&row.value>0)amount=floorGame(amount*Math.pow((100-row.value)/100,turn));
    }return amount;
  }
  procHealApply(casterId,target,amount,cardId,options){
    const {isCure,ignoreCond,isAuto}=options??{};
    amount=this.reduceAssault(target,amount,'assault_heal_reduce');
    const info=target.status.info,old=info.S_CURRENT_HP;let heal=floorGame(amount);
    if(!this.e.getMonster(target.id)){if(old==0)heal=0;}
    else if(['half_death','keep_half_death'].includes(target.state)){
      target.state='none';const model=this.db.get('monster',target.res_id).link_model_define_id.toString();
      this.e.pushAction({id:this.b.last_action_id++,type:'action_monster_half_death_revive',source_id:target.id,skip_action:model=='3000390'});
      for(const kind of ['CONDITION_MONSTER_AMOUNT','CONDITION_MONSTER_AMOUNT_SET','CONDITION_CHAR_CS_AMOUNT','CONDITION_OWN_CHAR_CS_AMOUNT'])this.call('procUnitEvent',kind,[]);
    }else if(old==0)return;
    if(heal>0){
      const ban=this.call('getPassiveByType',{source_id:target.id,type:isCure?'SKILL_EFF_CURE_BAN':'SKILL_EFF_HEAL_BAN',is_card:false});
      if(ban.length){this.call('addDetailLog',{type:'log_skill_eff_heal_ban',params:[target.id],param_types:[this.call('getLogParamType','unit_id')]});this.call('checkTermValuePassive',ban[0].skill_id,target.id);return;}
    }
    let next=old+heal;const max=info.S_HP;let overheal=0;if(next>max){overheal=next-max;next=max;}
    const result=[[target.id,{heal,old_hp:old,new_hp:next,max_hp:max,is_auto:isAuto}]];
    this.call('setStatus',target.id,'S_CURRENT_HP',next,{isCure,dpt:true,overheal});
    this.call('accumulateCardValue',target.id,'heal',heal);
    const actual=next-old;
    if(actual>0&&target.id==this.b.char.id){const score=this.call('addDisasterHealScore',actual);if(score){result[0][1].disaster_score=score.heal_score;result[0][1].disaster_bonus_score=score.bonus;}}
    if(!ignoreCond&&heal>0){
      if(actual>0)this.call('procUnitEvent','CONDITION_CHAR_HEAL_CURE',[casterId,cardId,actual]);
      if(isCure)this.call('procUnitEvent','CONDITION_CHAR_CURE',[casterId,cardId,heal]);
    }
    if(overheal>0&&isCure){
      const passives=this.call('getPassiveByType',{source_id:target.id,type:'SKILL_EFF_CURE_OVER_HP_CHANGE_SHIELD',is_card:false}),card=this.b.cardMap[cardId];
      if(card){passives.push(...this.call('getPassiveByType',{source_id:target.id,type:'SKILL_EFF_CURE_OVER_HP_CHANGE_SHIELD',is_card:false,char_id:card.char_id}));passives.push(...this.call('getPassiveByType',{source_id:card.id,type:'SKILL_EFF_CURE_OVER_HP_CHANGE_SHIELD',is_card:true}));}
      if(passives.length){const shield=this.procShieldApply(casterId,target,overheal,cardId,ignoreCond??false,undefined,false);this.call('checkTermValuePassive',passives[0].skill_id,target.id,false,false);result.push(shield);}
    }
    return result;
  }
  procShieldApply(casterId,target,amount,cardId,ignoreCond,isPre=false,isFix){
    amount=this.reduceAssault(target,amount,'assault_shield_reduce');let shield=amount;
    const ban=this.call('getPassiveByType',{source_id:target.id,type:'SKILL_EFF_SHIELD_GAIN_BAN',is_card:false});
    for(const p of ban){if(p.eff_opts?.includes('card')&&cardId==-1)continue;if(p.eff_opts?.includes('other')&&casterId==target.id)continue;shield=0;this.call('checkTermValuePassive',p.skill_id,casterId,undefined,isPre);break;}
    const info=target.status.info,old=info.S_CURRENT_SHIELD;shield=floorGame(shield);
    if(!this.e.getMonster(target.id)&&info.S_CURRENT_HP==0)shield=0;
    const next=Math.min(old+shield,this.e.getMonster(target.id)?999999:info.S_HP*2);
    const result=[target.id,{shield:next-old,old_shield:old,new_shield:next,new_hp:info.S_CURRENT_HP,type:isFix?['SHIELD_ATTR_FIX']:undefined}];
    if(!isPre){this.call('setStatus',target.id,'S_CURRENT_SHIELD',next,{dpt:true});this.call('accumulateCardValue',target.id,'shield',shield);
      if(!ignoreCond&&shield>0){this.call('procUnitEvent','CONDITION_CHAR_SHIELD',[casterId,cardId,shield]);this.call('procUnitEvent','CONDITION_CHAR_GET_SHIELD',[target.id,cardId,shield]);}}
    return result;
  }
  // 0x19100 / 0x19700: retained preview marker, distinct from actual events.
  isShieldDestroyedByDamage(old,next){return old>0&&next===0;}
  recordShieldDestruction(list,id,old,next){if(!this.isShieldDestroyedByDamage(old,next))return;const targets=list.shieldDestroyedTargets??=[];if(!targets.includes(id))targets.push(id);}
  procShieldExpire(casterId,targets,skillId,by,countAdditional,isPre=false){
    const skill=this.b.skillMap[skillId],row=this.db.get('skill_eff',skill.res_id),counts={},actions=[];
    let cardId=-1;if(skill.parent.type==='CARD')cardId=skill.parent.id;else if(skill.parent.type==='SKILL'){const parent=this.b.skillMap[skill.parent.id];if(parent.parent.type==='CARD')cardId=parent.parent.id;}
    for(let i=0;;i++){
      if(i>1000)throw new MissingBattleRule('procShieldExpire.iteration_budget');
      this.w.termPassiveImmediatlyList=[];const action={action_units:[]};let any=false;
      for(const initial of targets){let target=this.e.getUnit(initial);if(!this.call('isFieldMonster',target))continue;
        const count=counts[target.id]??=(this.call('calcCountValue',skillId,target.id)+countAdditional);if(i>=count)continue;
        if(row.target_unit_type==='TARGET_UNIT_ALL_RAN_ENEMY'&&i>0){const choices=this.call('getTargetableMonstersID',{skill_id:skillId});if(choices.length)target=this.e.getUnit(this.e.random.randomArrayMember(0,choices));}
        any=true;const value=this.call('calcValue',skillId,target.id),old=this.call('getStatus',target.id,'S_CURRENT_SHIELD');let next=Math.max(0,floorGame(this.call('procMathSign',row.eff_value_math_sign,old,value)));
        if(next>old){for(const p of this.call('getPassiveByType',{source_id:target.id,type:'SKILL_EFF_SHIELD_GAIN_BAN',is_card:false})){if(p.eff_opts?.includes('all')||p.eff_opts?.includes('card')&&by==='card'){next=old;this.call('checkTermValuePassive',p.skill_id,casterId,undefined,isPre);break;}}}
        if(next-old==0)continue;
        if(!isPre){this.call('addDetailLog',{type:'log_skill_eff_shield_change',params:[initial,value,next>old?'log_increase':'log_decrease',next-old],param_types:['unit_id','value','text','delta'].map(x=>this.call('getLogParamType',x))});next=this.call('setStatus',target.id,'S_CURRENT_SHIELD',next,{dpt:true});if(next>old)this.call('accumulateCardValue',initial,'shield',next-old);}
        action.action_units.push([target.id,{shield:next-old,old_shield:old,new_shield:next,new_hp:this.call('getStatus',target.id,'S_CURRENT_HP')}]);
      }
      if(!any)break;actions.push(action);
    }
    if(isPre)return actions.flatMap(x=>x.action_units);
    this.e.pushAction({id:this.b.last_action_id++,type:'action_shield_expire',source_id:skill.action_char_id,action_list:actions,card_id:cardId,byCard:cardId>0});
  }
  procStressRecoverByCure(amount){
    const max=this.call('constantMetagame','default_stress_max');
    const eligible=this.b.chars.filter(c=>{const s=this.call('tryGetStageCharByCharId',c.id);return !!s&&!this.stage.leaved_chars?.includes(s.res_id)&&s.ego_stress>0&&!s.collapse_on&&s.ego_stress!=max;});
    if(!eligible.length||eligible.length>1&&this.w.isPreview)return;
    const target=eligible.length===1?eligible[0]:this.e.random.randomArrayMember(0,eligible);
    const [a,b,c,d,e]=['a','b','c','d','e'].map((key,i)=>this.call('constantMetagame',`stress_cure_revise_${key}`,{def_value:[6,100,0,-5,4][i]}));
    // The extracted DB carrier has string cells; ConstantMetagame returns the
    // runtime row's value directly. Native dbt_row's scalar conversion is not
    // established by TSV override parsing. ResourceStore supplies the six
    // directly captured numeric types. Other providers must honor that input
    // contract too; never accept NaN/string concatenation as a valid state.
    if([a,b,c,d,e].some(v=>typeof v!=='number'||!Number.isFinite(v)))throw new MissingBattleRule('constantMeta.native_numeric_type',{keys:['a','b','c','d','e'].map(k=>'stress_cure_revise_'+k),types:[a,b,c,d,e].map(v=>typeof v)});
    const recovered=Math.max(Math.min(a*Math.log(amount-c)/Math.log(b)+d,e),0);if(recovered==0)return;
    const bans=this.call('getPassiveByType',{source_id:target.id,type:'SKILL_EFF_CURE_STRESS_BAN',is_card:false,char_id:target.id});
    if(bans.length){this.call('checkTermValuePassive',bans[0].skill_id,target.id);return;}
    this.call('createBattleStressRecoverAction',target.id,recovered);
  }
}
