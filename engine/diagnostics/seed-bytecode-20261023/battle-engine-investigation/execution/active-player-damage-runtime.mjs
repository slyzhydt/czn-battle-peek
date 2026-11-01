// Source-derived ordinary player CARD -> monster ACTIVE calculation.
// Source map: evidence/active-player/HANDPORT-SCOPE.md.
// Run on an executor fork: unsupported later branches reject the whole fork.
import {MissingBattleRule} from './resource-store.mjs';
import {numericConstant} from './numeric-constant.mjs';
import {ActiveCriticalRuntime} from './active-critical-runtime.mjs';
import {damageMathSign,accumulateDamageMulti,procStatType,procRevise,decreaseDamage,floorGame,ceilGame,roundGame} from '../effects/effect-arithmetic.mjs';

export class ActivePlayerDamageRuntime {
  constructor(e){this.e=e;this.b=e.b;this.w=e.wt;this.db=e.db;this.critical=new ActiveCriticalRuntime(e);}
  call(n,...a){return this.e.call(n,...a);}
  query(type,id,isCard=false,extra={}){return this.e.passives.query({source_id:id,type:'SKILL_EFF_'+type,is_card:isCard,...extra});}
  deny(type,id,isCard=false,extra={}){
    const owner=isCard?this.b.cardMap[id]:this.e.getUnit(id,true);
    const candidates=(owner?.passive??[]).map(([sid])=>this.b.skillMap[sid]).filter(p=>p&&!p.removed&&p.usable!==false&&this.db.get('skill_eff',p.res_id).eff==='SKILL_EFF_'+type);
    if(candidates.length)throw new MissingBattleRule('activePlayerDamage.passive:'+type,{id,skills:candidates.map(p=>p.skill_id)});
    if(this.query(type,id,isCard,extra).length)throw new MissingBattleRule('activePlayerDamage.passive:'+type,{id});
  }
  constant(id){return numericConstant(this,id);}
  parentAllows(p){const o=p.eff_opts??[];return !o.includes('tactic')&&!o.includes('cs')&&!o.includes('coop');}
  convertEgoColor(ego){
    const map={EGO_NONE:'NONE',EGO_LOVE:'RED',EGO_NORMS:'GREEN',EGO_NARCISSISM:'BLUE',EGO_INSTINCT:'ORANGE',EGO_CREED:'PURPLE',EGO_BASIC:'BASIC',EGO_OWNER:'OWNER',EGO_ALL:'ALL'};
    return map[ego]??(Object.values(map).includes(ego)?ego:undefined);
  }
  isIncludeEgo(egos,ego){return !!egos&&(egos.includes('EGO_ALL')||egos.includes(ego??'NONE'));}
  // 0x5f900 and its 0x60700/0x61900 callbacks; dry skips term consumption,
  // but still performs ordered passive queries and value/condition evaluation.
  egoPassive(c,value,type,dry=false,omitTarget=false){
    const {s,source,target,cardId,crit,color,egoAttack,extraIgnore}=c;
    const src=this.query(type,source.id,false,extraIgnore);
    const incoming=omitTarget?[]:this.query(type,target.id,false,{is_pre:false,caster_id:s.action_char_id,ignore_cs_list:undefined});
    const card=this.query(type,cardId,true,{is_pre:false,ignore_cs_list:undefined});
    let plus=0,multi=1,set;let terms=[];
    for(const p of src.concat(incoming,card)){
      if(!this.call('checkValueAddOpts',{passive_id:p.skill_id,skill_id:s.skill_id,card_id:cardId,target,egoAttack,crit,ego_type:color}))continue;
      const sign=this.db.get('skill_eff',p.res_id).eff_value_math_sign;
      // Native reports duplicate SET but keeps the first. Error reporting is
      // deliberately fail closed instead of pretending that diagnostic ran.
      if(set!=null){if(sign==='MATHSIGN_SET'&&!dry)throw new MissingBattleRule('activePlayerDamage.duplicate_ego_set');continue;}
      terms.push([p.skill_id,target.id]);
      const n=this.call('calcValue',p.skill_id,target.id);
      if(sign==='MATHSIGN_SET'){set=n;terms=[[p.skill_id,target.id]];}
      else if(sign==='MATHSIGN_ADD')plus+=n;
      else if(sign==='MATHSIGN_MULTIPLY')multi*=n;
      else if(sign==='MATHSIGN_MULTIPLY_PCT')multi*=n/100;
      else if(sign==='MATHSIGN_ADD_HUND_MULTIPLY_PCT')multi*=(100+n)/100;
      else if(sign==='MATHSIGN_SUBTRACT_HUND_MULTIPLY_PCT')multi*=(100-n)/100;
      else throw new MissingBattleRule('activePlayerDamage.ego_math_sign',{sign});
    }
    if(!dry)for(const [id,targetId]of terms)this.call('checkTermValuePassive',id,targetId,true,false);
    return {value:set!=null?set:Math.max(0,(value+plus)*multi),is_set:set!=null};
  }
  egoDamage(c){
    const {a,s,source,target,cardId,extraIgnore}=c,card=this.b.cardMap[cardId];
    let ego=this.call('getEgo',cardId);if(ego==='EGO_ALL')ego=target.ego_field_egos?.[0]??'NONE';
    const matches=this.isIncludeEgo(target.ego_field_egos,ego);
    this.deny('NOT_EGO_ATTACK',s.caster_id,false,extraIgnore);this.deny('NOT_EGO_ATTACK',cardId,true);
    this.deny('EGO_ATTACK_TAKE_ALWAYS',target.id,false,{caster_id:s.caster_id});
    const egoAttack=matches||card.talents?.includes(33)===true;
    this.deny('WEAK_EGO_DAMAGE_ALWAYS',s.caster_id,false,{char_id:s.action_char_id});this.deny('WEAK_EGO_DAMAGE_ALWAYS',cardId,true);
    c={...c,egoAttack};
    const base=Math.max(0.5,Math.min(this.constant('ego_field_damage_cap'),s.cost_used??0));
    const ui=this.db.get('card',card.res_id).target_for_ui;
    const revise=['TARGET_SELECTED_MONSTER','TARGET_SELECTED_MONSTER_AUTO_RANDOM','TARGET_MOST_MAX_HP_MONSTER'].includes(ui)?1:0.5;
    const stage=v=>(egoAttack?v:v/3)*revise;
    // Non-final hit: native @4876..5755 applies only the per-hit fix;
    // @6024..6288 predicts eventual break for damage conditions without
    // consuming the ordinary field modifiers. Queries remain formal queries.
    if(c.i!==c.count-1){
      const actual=target.ego_breaked?0:this.egoPassive(c,0,'HIT_EGO_FIELD_DAMAGE_FIX_VALUE_ADD').value;
      let expected=actual;
      if(!target.ego_breaked&&target.ego_field_value!=null){
        const pre=this.egoPassive(c,base,'EGO_FIELD_DAMAGE_VALUE_ADD',true);
        let predicted=pre.is_set?pre.value:stage(pre.value);
        predicted=this.egoPassive(c,predicted,'EGO_FIELD_DAMAGE_FIX_VALUE_ADD',true).value;
        predicted=this.egoPassive(c,predicted,'HIT_EGO_FIELD_DAMAGE_FIX_VALUE_ADD',true).value;
        expected=Math.max(actual,predicted);
      }
      return {egoAttack,egoFieldDmg:actual,egoFieldExpected:expected};
    }
    if(egoAttack)this.call('procCardEvent','CONDITION_EGO_ATTACK_CARD_USE',card.place_before_using,cardId,{target:target.id});
    const first=this.egoPassive(c,base,'EGO_FIELD_DAMAGE_VALUE_ADD',true,true);
    let expected=first.is_set?first.value:stage(first.value);
    expected=this.egoPassive(c,expected,'EGO_FIELD_DAMAGE_FIX_VALUE_ADD',true,true).value;
    expected=this.egoPassive(c,expected,'HIT_EGO_FIELD_DAMAGE_FIX_VALUE_ADD',true,true).value;
    if(expected>stage(base))card.ego_field_dmg_increased=true;
    // Native retains the unmodified base on an already broken target.
    let egoFieldDmg=base;
    if(!target.ego_breaked){
      const actual=this.egoPassive(c,base,'EGO_FIELD_DAMAGE_VALUE_ADD');
      egoFieldDmg=actual.is_set?actual.value:stage(actual.value);
      egoFieldDmg=this.egoPassive(c,egoFieldDmg,'EGO_FIELD_DAMAGE_FIX_VALUE_ADD').value;
      egoFieldDmg=this.egoPassive(c,egoFieldDmg,'HIT_EGO_FIELD_DAMAGE_FIX_VALUE_ADD').value;
    }
    return {egoAttack,egoFieldDmg,egoFieldExpected:egoFieldDmg};
  }
  procDamageCalculate(a){
    const s=this.b.skillMap[a.skill_id];
    if(!s||a.is_pre||this.w.isPreview!=0||a.worktable!=null&&a.worktable!==this.w||s.parent?.type!=='CARD'||this.e.getMonster(s.action_char_id)||a.coop_char!=null||a.motion_triggered||a.preDeath||a.preview_args||a.from_hud_preview||a.nihilum_meta||a.autoClient)
      throw new MissingBattleRule('activePlayerDamage.ordinary_card_context',{skill_id:a.skill_id});
    const r=this.db.get('skill_eff',s.res_id),cardId=this.call('getSkillCardId',s),card=this.b.cardMap[cardId],target=this.e.getMonster(a.targets?.[0]),source=this.e.getUnit(s.caster_id);
    if(!card||cardId<=0||source.id!==this.b.char.id||!target||!['SKILL_EFF_DMG','SKILL_EFF_EXTRA_DMG','SKILL_EFF_DMG_IGNORE_COND'].includes(r.eff)||r.operation!=='OPERATION_ACTIVE'||r.target_unit_type!=='TARGET_UNIT_SELECTED'||!Array.isArray(a.targets)||a.targets.length!==1||a.targets[0]!==target.id)
      throw new MissingBattleRule('activePlayerDamage.target_or_parent');
    const attrArgs={},attrs=this.call('getAttrInfo',1,r.eff_attr,attrArgs);attrs.push(...(s.dmgAttrAdd??[]));
    if(attrs.length||Object.keys(attrArgs).length||s.eff_opts?.length||s.r_spark_multiply_pct_value||s.r_spark_count_value||card.talents?.some(t=>![0,1,2,3,6,7,9,10,11,27,28,29,31,32,33,35,36,43,44,46,57,59,60].includes(t))||card.nihilum_meta||s.parent_cards?.length||card.parent_cards?.length||r.value_save_renewal_flag==='YES'||this.db.get('card',card.res_id).sort==='SORT_SUPPORT')
      throw new MissingBattleRule('activePlayerDamage.special_attributes');
    if(this.w.test||a.card_activation!==true)throw new MissingBattleRule('activePlayerDamage.card_activation_required');
    const extra={is_pre:false,char_id:s.action_char_id},extraIgnore={...extra,ignore_cs_list:undefined};
    const beforeTargets=this.b.cur_card_dmg_targets,actions=[],used=[],targets=a.targets;
    this.call('beginImmediatePassiveCSLogScope');
    try{
      this.b.cur_card_dmg_targets=targets;
      // Native setup @623..886, @1425..1648; no added attributes in this slice.
      this.deny('EGO_ATTACK_ALWAYS',cardId,true);this.deny('EGO_ATTACK_ALWAYS',this.b.char.id,false,{char_id:s.action_char_id});s.ego_attack=undefined;
      this.deny('DMG_ATTR_ADD_PASSIVE',card.caster_id,false,{is_pre:false,char_id:card.char_id});this.deny('DMG_ATTR_ADD_PASSIVE',cardId,true,{is_pre:false});
      const stat=this.call('getStatus',this.call('resolveStatSource',s.skill_id,s.stat_source),'S_ATK');
      const color=this.convertEgoColor(this.call('getEgo',cardId));if(!color||color==='ALL'||color==='OWNER')throw new MissingBattleRule('activePlayerDamage.ego_color',{color});
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
          if(!Number.isInteger(count)||count<0||count>1000)throw new MissingBattleRule('activePlayerDamage.hit_count',{count});
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
        if(i===1000)throw new MissingBattleRule('activePlayerDamage.loop_bound');
      }
      if(!Array.isArray(this.w.triggeredList?.dmg_valueadd))throw new MissingBattleRule('activePlayerDamage.triggeredList');
      this.w.triggeredList.dmg_valueadd.push(...used);s.leech_shield=undefined;s.leech_hp=undefined;
      if(actions.length)this.e.pushAction({id:this.b.last_action_id++,type:'action_damage',source_id:s.action_char_id,action_list:actions,card_id:cardId,byCard:true});
      if(target.refresh_noti)this.call('refreshMonsterNoti');
      for(const action of actions)for(const [id,info]of action.action_units)if(info.damage&&info.type)this.e.getUnit(id).lastDamageEvent=info;
      const logged=actions.map(action=>({action_units:action.action_units.filter(x=>!x[1]?.no_log)})).filter(action=>action.action_units.length);
      if(logged.length)this.call('addDetailLog',{type:'log_skill_eff_dmg',params:[logged,targets,finalCount,0,0,undefined],param_types:[]});
      // post_dmg_log only invokes pressure action for monster sources.
      return undefined;
    }finally{this.b.cur_card_dmg_targets=beforeTargets;this.call('endImmediatePassiveCSLogScope');}
  }
  hit(c){
    const {a,s,r,source,target,cardId,attrs,attrArgs,color,stat,extra,extraIgnore,count,i,crit}=c;
    const currentCard=this.b.cardMap[cardId];
    if(s.ego_attack!=null||s.r_spark_multiply_pct_value)throw new MissingBattleRule('activePlayerDamage.changed_special_state');
    let value=this.call('calcValue',s.skill_id,target.id,false,undefined);
    const unreducing=this.query('UNREDUCING_HP',target.id).length>0;
    const {egoAttack,egoFieldDmg,egoFieldExpected}=this.egoDamage(c);
    const destroy=target.ego_field_value!=null&&target.ego_field_value-egoFieldExpected<=0;
    const outgoing=this.query('DAMAGE_VALUE_ADD',source.id,false,extraIgnore).filter(p=>!p.eff_opts?.includes('take')&&this.parentAllows(p));
    const incoming=this.query('DAMAGE_VALUE_ADD',target.id,false,{caster_id:s.action_char_id,is_pre:false,ignore_cs_list:undefined}).filter(p=>p.eff_opts?.includes('take')&&this.parentAllows(p));
    const fromCard=this.query('DAMAGE_VALUE_ADD',cardId,true,{is_pre:false,ignore_cs_list:undefined}).filter(p=>!p.eff_opts?.includes('take')&&this.parentAllows(p));
    let plus=0,buckets={multi:1,multi_dec:1,multi_final:1},takePlusMonster=0,takePlusUser=0,takeAmpMonster=0,takeAmpUser=0;const used=[];
    for(const p of outgoing.concat(incoming,fromCard)){
      const opts=p.eff_opts??[];
      if(!this.call('checkValueAddOpts',{passive_id:p.skill_id,skill_id:s.skill_id,card_id:cardId,target,egoAttack,dmg_attr:attrs,crit,destroy,ego_type:color,first_hit:i===0}))continue;
      if(opts.includes('multi')&&count<=1||opts.includes('single_hit')&&count!==1||opts.includes('all_attack_single_target')||opts.includes('all_attack')||opts.includes('multi_target'))continue;
      // TARGET_UNIT_SELECTED is a native single target.
      if(p.parent?.type==='CS')used.push(p.skill_id);
      if(!unreducing)this.call('checkTermValuePassive',p.skill_id,source.id,true,false);
      const pr=this.db.get('skill_eff',p.res_id),n=this.call('calcValue',p.skill_id,target.id,false,undefined,{card_id:cardId});
      if(!/^MATHSIGN_(?:ADD|SUBTRACT|(?:FINAL_)?(?:MULTIPLY|MULTIPLY_PCT|ADD_HUND_MULTIPLY_PCT|SUBTRACT_HUND_MULTIPLY_PCT))$/.test(pr.eff_value_math_sign))throw new MissingBattleRule('activePlayerDamage.math_sign',{id:p.skill_id});
      const ch=damageMathSign(pr.eff_value_math_sign,n),take=opts.includes('take');
      const byMonster=!!this.e.getMonster(p.caster_id)||p.parent?.type==='CS'&&this.b.csMap[p.parent.id]?.by_monster===true;
      plus+=ch.plus;
      if(ch.plus!==0){if(take&&ch.plus>0){if(byMonster)takePlusMonster+=ch.plus;else takePlusUser+=ch.plus;}}
      else if(ch.multiValue!=null){buckets=accumulateDamageMulti(ch.multiValue,ch.is_final,take,buckets);if(take&&ch.multiValue>=1){if(byMonster)takeAmpMonster+=ch.multiValue-1;else takeAmpUser+=ch.multiValue-1;}}
    }
    if(this.call('isAssaultFourthCombatant',s.action_char_id))throw new MissingBattleRule('activePlayerDamage.assault_fourth');
    buckets.multi+=(this.b.char.status.info.S_ZERO_TACTICS_DMG_UP_RATE__VALUE??0)/100;
    buckets.multi+=this.call('getNonBattleEffPctAdd','EFF_DMG_UP_RATE_PCT_MULTIPLY',s.action_char_id);
    plus=procRevise(0,procStatType(0,plus,stat),{});
    const final=buckets.multi_final*buckets.multi_dec,beforeFinal=value*buckets.multi+plus;
    value=beforeFinal*final;
    value=value>0?(final>1?ceilGame:final<1?floorGame:roundGame)(value):value<0?(final>1?floorGame:final<1?ceilGame:roundGame)(value):roundGame(value);
    const ampAll=beforeFinal*(takeAmpMonster+takeAmpUser)*buckets.multi_dec,ampMonster=beforeFinal*takeAmpMonster*buckets.multi_dec;
    const plusAll=(takePlusMonster+takePlusUser)*final,plusMonster=takePlusMonster*final;
    const monsterRatio=value>0?Math.max(0,Math.min(1,(value-ampAll-plusAll+ampMonster+plusMonster)/value)):1;
    this.call('setCardUseDisplaySkillValue',cardId,s.skill_id,target.id,{value});
    value=procRevise(1,procStatType(1,value,stat),{damage:this.constant('dmg_revise_rate')});
    if(color!=='BASIC')value*=((100+this.call('getStatus',s.action_char_id,'S_'+color+'_DMG_RATE',0))/100);if(value<0)value=0;
    if(value>0&&crit){
      this.deny('CRITICAL_DAMAGE_VALUE_ADD',source.id,false,extraIgnore);this.deny('CRITICAL_DAMAGE_VALUE_ADD',cardId,true,{is_pre:false,ignore_cs_list:undefined});
      value=ceilGame(value*this.call('getStatus',s.action_char_id,'S_CRI_DMG_RATE')/100);
    }
    if(egoAttack){
      this.deny('WEAK_EGO_DAMAGE_REVISE_VALUE_ADD',source.id,false,{char_id:s.action_char_id});
      let weak=this.call('getStatus',s.action_char_id,'S_WEAK_EGO_DMG_RATE')/100;if(Number.isNaN(weak))weak=1;
      value=ceilGame(value*weak);
    }
    value=decreaseDamage(value,{statType:1,isMonsterTarget:true,monsterRate:target.status.info.S_DMG_DECREASE_RATE});
    if(value>0){this.deny('CARD_MULTI_DAMAGE_VALUE_DECREASE',target.id);value=floorGame(value);if(value<=0)value=1;}
    if(value>0){this.deny('FINAL_DAMAGE_VALUE_ADD',source.id,false,extraIgnore);this.deny('FINAL_DAMAGE_VALUE_ADD',target.id,false,{caster_id:s.action_char_id,is_pre:false,ignore_cs_list:undefined});this.deny('FINAL_DAMAGE_VALUE_ADD',cardId,true,{is_pre:false,ignore_cs_list:undefined});}
    this.call('setCardUseDisplaySkillValue',cardId,s.skill_id,target.id,{result_value:value});
    this.deny('DMG_VALUE_ADD_ADDITIONAL',source.id,false,{...extra,caster_id:s.caster_id});this.deny('DMG_VALUE_ADD_ADDITIONAL',target.id,false,{is_pre:false,ignore_cs_own_type:true});
    const result=this.call('procDamageApply',{worktable:this.w,caster_id:s.action_char_id,target,eff_value:value,card_id:cardId,parent_card_id:undefined,skill_id:s.skill_id,isPre:false,ignoreCond:a.ignoreCond,dmgAttr:attrs,attrArgs,index:i,ref:undefined,opt:s.eff_opts??[],fix:false,weakEgoAttack:egoAttack,egoFieldDmg,system_eff:i===0?r.link_battle_system_effect_id:undefined,isCrit:crit,dva_css:used,dmgAdditionals:[],char_id:s.action_char_id,target_char_id:undefined,is_last_attack:i===count-1,monster_dmg_ratio:undefined});
    if(!Array.isArray(result?.ret_actions))throw new MissingBattleRule('activePlayerDamage.apply_result');
    if(result.deadEvent)this.b.deads.push({source_id:target.id,by:'card',killer:source.id,prevHP:result.prevHP,deadEvent:result.deadEvent,card_id:cardId,trigger_cause_card_id:this.call('getTriggerCauseCardId',this.b.skillMap[s.skill_id]),all_attack:false});
    return {actions:result.ret_actions,used};
  }
}


