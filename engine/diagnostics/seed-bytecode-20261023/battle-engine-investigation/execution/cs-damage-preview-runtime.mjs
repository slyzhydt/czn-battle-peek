// CS-origin periodic-damage notice hand-port; never flips is_pre to active.
// Source: evidence/damage-preview/procDamageCalculate_0xf0000004a500.linear.js
// and evidence/batch2-cs-preview/. Scope is the unit-CS refreshAlwaysDamage
// family (owner target, no parent card), including FIX / DOT / penetration.
import {MissingBattleRule} from './resource-store.mjs';
import {numericConstant,damageReductionConstants} from './numeric-constant.mjs';
import fs from 'node:fs';
import {damageMathSign,accumulateDamageMulti,procStatType,procRevise,decreaseDamage,floorGame,ceilGame,roundGame} from '../effects/effect-arithmetic.mjs';
const NON_SINGLE=new Set(['TARGET_UNIT_ALL_ENEMY','TARGET_UNIT_DAMAGE_ENEMY_ALL','TARGET_UNIT_ALL_ENEMY_EXCEPT_CASTER','TARGET_UNIT_EXCEPT_OWNER','TARGET_UNIT_SELECTED_BOTH_SIDE','TARGET_UNIT_NOT_SELECTED']);
const COLOR={EGO_NONE:'NONE',EGO_LOVE:'RED',EGO_NORMS:'GREEN',EGO_NARCISSISM:'BLUE',EGO_INSTINCT:'ORANGE',EGO_CREED:'PURPLE',EGO_BASIC:'BASIC',EGO_OWNER:'OWNER',EGO_ALL:'ALL'};
// Literal-only enum extraction, matching EventRuntime's retained native enum.
const DAMAGE_ATTR=new Set([...fs.readFileSync(new URL('../attributes/gamecore/battle/skill_effect_enums.js.recovered.js',import.meta.url),'utf8').matchAll(/arg0\.(DMG_ATTR_[A-Za-z_0-9]+) = /g)].map(m=>m[1]));
if(!DAMAGE_ATTR.has('DMG_ATTR_DOT_ATTACK'))throw new MissingBattleRule('csDamagePreview.attr_enum_evidence');
export class CSDamagePreviewRuntime {
  constructor(e){this.e=e;this.b=e.b;this.w=e.wt;this.db=e.db;}
  call(name,...args){return this.e.call(name,...args);}
  query(type,source,isCard=false,extra={}){return this.e.passives.query({source_id:source,type:'SKILL_EFF_'+type,is_card:isCard,...extra});}
  constant(id){return numericConstant(this,id);}
  revise(type,value){return procRevise(type,value,type===1?{damage:this.constant('dmg_revise_rate')}:{});}
  // Native filterParentForPassives 0x4d000, with is_cs=true and no card/coop.
  parentAllows(p){const opts=p.eff_opts??[];return !opts.includes('tactic')&&!opts.includes('card')&&!opts.includes('coop');}
  check(p,c,extra={}){return this.call('checkValueAddOpts',{passive_id:p.skill_id,skill_id:c.s.skill_id,card_id:-1,target:c.target,egoAttack:c.egoAttack,dmg_attr:c.attrs,crit:c.crit,destroy:c.destroy,ego_type:c.color,...extra});}
  specialTargetAllows(p,c,ordinary=false){
    const opts=p.eff_opts??[];
    if(opts.includes('single_target')&&NON_SINGLE.has(c.r.target_unit_type)||opts.includes('except_penetrate')&&c.attrs.includes('DMG_ATTR_PENETRATE'))return false;
    if(opts.includes('all_attack_single_target')&&(c.r.target_unit_type!=='TARGET_UNIT_ALL_ENEMY'||c.targets.length!==1))return false;
    if(opts.includes('all_attack')&&c.r.target_unit_type!=='TARGET_UNIT_ALL_ENEMY')return false;
    if(ordinary&&(opts.includes('multi')&&c.count<=1||opts.includes('single_hit')&&c.count!==1||opts.includes('multi_target')&&c.targets.length<2))return false;
    return true;
  }
  // Callback 0x5bb00. With card_id=-1, only empty resource-card filters can
  // match unless an explicit skill-resource link already selected the passive.
  skipTerms(p,s){if(p.eff_opt_multiple_link?.length)return p.eff_opt_multiple_link.includes(s.res_id);
    return this.db.array(this.db.get('skill_eff',p.res_id).target_card_set_opt_multiple_link??'').length===0;}
  // 0x6ee00 ordinary additive/multiplicative buckets. All filter and value
  // decisions use the formal shared interfaces, including linked-CS options.
  ordinaryValue(c,value){
    const {s,source,target,attrs,extraIgnore}=c;
    const outgoing=this.query('DAMAGE_VALUE_ADD',source.id,false,extraIgnore).filter(p=>!p.eff_opts?.includes('take')&&this.parentAllows(p));
    const incoming=this.query('DAMAGE_VALUE_ADD',target.id,false,{caster_id:s.action_char_id,is_pre:true,ignore_cs_list:c.ignore}).filter(p=>p.eff_opts?.includes('take')&&this.parentAllows(p));
    let plus=0,buckets={multi:1,multi_dec:1,multi_final:1};const used=[];
    if(s.r_spark_multiply_pct_value)buckets.multi+=s.r_spark_multiply_pct_value/100;
    if(attrs.includes('DMG_ATTR_STRENGTH_REF_0'))plus+=(this.b.stackMap[s.stack_value0??-1]?.stack??0)*20;
    if(attrs.includes('DMG_ATTR_STRENGTH_REF_1'))plus+=(this.b.stackMap[s.stack_value1??-1]?.stack??0)*20;
    for(const p of outgoing.concat(incoming)){
      if(!this.check(p,c,{first_hit:c.index===0})||!this.specialTargetAllows(p,c,true))continue;
      if(p.parent.type==='CS')used.push(p.skill_id);
      const skipped=p.parent.type==='CS'&&c.skip.some(q=>q.link_cs_ids?.includes(this.b.csMap[p.parent.id]?.res_id));
      if(!c.a.preDeath&&!c.unreducing&&!skipped)this.call('checkTermValuePassive',p.skill_id,source.id,true,true);
      const row=this.db.get('skill_eff',p.res_id),n=this.call('calcValue',p.skill_id,target.id,false,undefined,{card_id:-1});
      if(!/^MATHSIGN_(?:ADD|SUBTRACT|(?:FINAL_)?(?:MULTIPLY|MULTIPLY_PCT|ADD_HUND_MULTIPLY_PCT|SUBTRACT_HUND_MULTIPLY_PCT))$/.test(row.eff_value_math_sign))throw new MissingBattleRule('csDamagePreview.damage_math_sign',{sign:row.eff_value_math_sign,id:p.skill_id});
      const change=damageMathSign(row.eff_value_math_sign,n);plus+=change.plus;
      if(change.multiValue!=null)buckets=accumulateDamageMulti(change.multiValue,change.is_final,p.eff_opts?.includes('take'),buckets);
    }
    if(this.call('isAssaultFourthCombatant',s.action_char_id)){
      const stage=(this.w.battle_stage_worktable??this.e.state.worktables.BattleStageWorktable).battle_stage;
      const row=this.db.table('chaos_assault_list')[stage.chaos_assault_list_id??''];buckets.multi+=Number(row?.combatant_4_dmg_pct??0)/100;
    }
    if(!this.e.getMonster(s.action_char_id)){
      buckets.multi+=(this.b.char.status.info.S_ZERO_TACTICS_DMG_UP_RATE__VALUE??0)/100;
      buckets.multi+=this.call('getNonBattleEffPctAdd','EFF_DMG_UP_RATE_PCT_MULTIPLY',s.action_char_id);
    }
    plus=this.revise(1-c.reviseType,procStatType(1-c.statType,plus,c.stat));
    const final=buckets.multi_final*buckets.multi_dec;value=(value*buckets.multi+plus)*final;
    value=value>0?(final>1?ceilGame:final<1?floorGame:roundGame)(value):value<0?(final>1?floorGame:final<1?ceilGame:roundGame)(value):roundGame(value);
    return {value,used};
  }
  // Callbacks 0x71600 / 0x72600 / 0x76200: ADD changes the rate,
  // multiplicative operators combine, DELTA_ONLY adds (value-1) to its bucket.
  rateModifiers(c,list,base,{consume=false,targetFilters=false,kind}={}){
    let plus=0,multi=1,delta=1;
    for(const p of list){
      if(!this.check(p,c)||targetFilters&&!this.specialTargetAllows(p,c))continue;
      if(consume)this.call('checkTermValuePassive',p.skill_id,c.target.id,true,true);
      const row=this.db.get('skill_eff',p.res_id),v=this.call('calcValue',p.skill_id,c.target.id);
      switch(row.eff_value_math_sign){
        case 'MATHSIGN_ADD':plus+=v;break;
        case 'MATHSIGN_MULTIPLY':multi*=v;break;
        case 'MATHSIGN_MULTIPLY_PCT':multi*=v/100;break;
        case 'MATHSIGN_ADD_HUND_MULTIPLY_PCT':multi*=(100+v)/100;break;
        case 'MATHSIGN_SUBTRACT_HUND_MULTIPLY_PCT':multi*=(100-v)/100;break;
        case 'MATHSIGN_MULTIPLY_DELTA_ONLY':delta+=v-1;break;
        default:throw new MissingBattleRule('csDamagePreview.rate_math_sign',{sign:row.eff_value_math_sign,id:p.skill_id});
      }
    }
    // These three native callbacks deliberately use different FP orders and
    // units; in particular critical's delta bucket operates before /100.
    if(kind==='critical')return (1+(((base+plus)*multi)-1)*delta)/100;
    if(kind==='final')return 1+((((base+plus)/100)*multi)-1)*delta;
    if(kind==='weak')return 1+((base*multi+plus)-1)*delta;
    throw new MissingBattleRule('csDamagePreview.rate_kind',{kind});
  }
  // calcEgoFieldDamagePassive 0x5f900, for the per-hit fix which native
  // is_pre still evaluates even without a card. Ordinary card field damage
  // is not activated by this CS preview entry.
  hitEgoField(c){
    const list=this.query('HIT_EGO_FIELD_DAMAGE_FIX_VALUE_ADD',c.source.id,false,c.extraIgnore)
      .concat(this.query('HIT_EGO_FIELD_DAMAGE_FIX_VALUE_ADD',c.target.id,false,{is_pre:true,caster_id:c.s.action_char_id,ignore_cs_list:c.ignore}),this.query('HIT_EGO_FIELD_DAMAGE_FIX_VALUE_ADD',-1,true,{is_pre:true,ignore_cs_list:c.ignore}));
    let plus=0,multi=1,set;const terms=[];
    for(const p of list){
      if(!this.call('checkValueAddOpts',{passive_id:p.skill_id,skill_id:c.s.skill_id,card_id:-1,target:c.target,egoAttack:c.egoAttack,crit:c.crit,ego_type:c.color}))continue;
      const sign=this.db.get('skill_eff',p.res_id).eff_value_math_sign;
      if(set!=null){if(sign==='MATHSIGN_SET')throw new MissingBattleRule('csDamagePreview.duplicate_ego_set');continue;}
      terms.push(p.skill_id);const value=this.call('calcValue',p.skill_id,c.target.id);
      if(sign==='MATHSIGN_SET'){set=value;terms.splice(0,terms.length,p.skill_id);}
      else if(sign==='MATHSIGN_ADD')plus+=value;
      else if(sign==='MATHSIGN_MULTIPLY')multi*=value;
      else if(sign==='MATHSIGN_MULTIPLY_PCT')multi*=value/100;
      else if(sign==='MATHSIGN_ADD_HUND_MULTIPLY_PCT')multi*=(100+value)/100;
      else if(sign==='MATHSIGN_SUBTRACT_HUND_MULTIPLY_PCT')multi*=(100-value)/100;
      else throw new MissingBattleRule('csDamagePreview.ego_math_sign',{sign});
    }
    for(const id of terms)this.call('checkTermValuePassive',id,c.target.id,true,true);
    return set??Math.max(0,plus*multi);
  }
  prepareAttrs(s,cs,r){
    const attrArgs={};let attrs=this.call('getAttrInfo',1,r.eff_attr,attrArgs);const ignore=attrArgs.ignore_cs_list;attrs.push(...s.dmgAttrAdd??[]);
    const add=this.query('DMG_ATTR_ADD_PASSIVE',cs.owner_id,cs.isCard,{is_pre:true,char_id:cs.char_id,caster_id:cs.caster_id});
    for(const p of add){
      if(!p.link_cs_ids?.includes(cs.res_id))continue;
      if(!p.eff_opts)throw new MissingBattleRule('csDamagePreview.undefined_attr_options',{res:p.res_id});
      const next=this.call('getAttrInfo',1,p.eff_opts,attrArgs);
      if(attrArgs.leech_hp_relic==null&&p.from_relic&&next.some(a=>a==='DMG_ATTR_LEECH_HP'||a==='DMG_ATTR_LEECH_HP_PCT')&&this.db.get('skill_eff',p.res_id).trigger_noti_type==='YES')attrArgs.leech_hp_relic=p.from_relic;
      attrs=attrs.concat(next);this.call('checkTermValuePassive',p.skill_id,s.caster_id,true,true);
    }
    const bans=this.query('TARGET_CS_DMG_ATTR_BAN',this.b.char.id,false,{is_pre:true,char_id:s.action_char_id,caster_id:s.caster_id});
    for(const p of bans){
      if(!p.link_cs_ids?.includes(cs.res_id))continue;
      const opts=p.eff_opts??[],ally=opts.includes('ally'),enemy=opts.includes('enemy');
      if(!(ally&&enemy)&&(ally&&this.e.getMonster(cs.owner_id)||enemy&&!this.e.getMonster(cs.owner_id)))continue;
      attrs=attrs.filter(a=>!opts.includes(a));
    }
    // These introduce separate target/ego algorithms outside unit periodic
    // notices. Reject their activation rather than ignore an added attribute.
    for(const attr of ['DMG_ATTR_COUNT','DMG_ATTR_EGO_FIELD_0','DMG_ATTR_CLASS'])if(attrs.includes(attr))throw new MissingBattleRule('csDamagePreview.special_attribute',{attr});
    return {attrs,attrArgs,ignore};
  }
  procDamageCalculate(a){
    const s=this.b.skillMap[a.skill_id];
    if(a.is_pre!==true||!s||s.parent.type!=='CS'||a.coop_char!=null||a.motion_triggered||a.from_hud_preview||a.preview_args||a.nihilum_meta||this.call('getSkillCardId',s)!==-1)
      throw new MissingBattleRule('csDamagePreview.context',{skill_id:a.skill_id});
    const cs=this.b.csMap[s.parent.id],r=this.db.get('skill_eff',s.res_id);
    if(s.eff_opts?.includes('parent_card'))throw new MissingBattleRule('csDamagePreview.parent_card_context');
    if(!cs||cs.isCard||r.target_unit_type!=='TARGET_UNIT_OWNER'||!Array.isArray(a.targets)||a.targets.length>1||a.targets.some(id=>id!=cs.owner_id)||!['SKILL_EFF_DMG','SKILL_EFF_EXTRA_DMG','SKILL_EFF_DMG_IGNORE_COND'].includes(r.eff))throw new MissingBattleRule('csDamagePreview.source_or_target',{skill_id:a.skill_id});
    const before=this.b.cur_card_dmg_targets;this.b.cur_card_dmg_targets=a.targets;
    try{
      const source=this.e.getUnit(s.caster_id),isMonster=!!this.e.getMonster(s.action_char_id),prepared=this.prepareAttrs(s,cs,r),{attrs,attrArgs,ignore}=prepared;
      const statId=this.call('resolveStatSource',s.skill_id,s.stat_source);let stat=this.call('getStatus',statId,'S_ATK');
      if(attrs.includes('DMG_ATTR_BASE_ON_DEF'))stat=this.call('getStatus',statId,'S_DEF')*2.1+stat*.3;
      else if(attrs.includes('DMG_ATTR_DEF_80_PCT'))stat=this.call('getStatus',statId,'S_DEF')*.8+stat*.2;
      else if(attrs.includes('DMG_ATTR_DEF_100_PCT'))stat=this.call('getStatus',statId,'S_DEF');
      let ego='BASIC';if([1,2,3,7].includes(s.caster_id)){const char=this.call('tryGetCharByCharId',s.caster_id);if(char)ego=this.db.get('char_combatant',char.res_id).link_ego_type_id;}
      const color=COLOR[ego]??(Object.values(COLOR).includes(ego)?ego:undefined);if(color==null)throw new MissingBattleRule('csDamagePreview.ego_color',{ego});
      const extra={is_pre:true,char_id:s.action_char_id},extraIgnore={...extra,ignore_cs_list:ignore};
      const single=a.targets.length===1?this.e.getUnit(a.targets[0]):undefined;
      const simpleCheck=p=>this.call('checkValueAddOpts',{passive_id:p.skill_id,skill_id:s.skill_id,card_id:-1,target:single,ego_type:color});
      const destroyPassives=this.query('COUNT_ADD_DESTROY',source.id,false,extra).filter(simpleCheck),counts={},result=[],used=[];
      let addedDestroy=0,finalCount=0;
      for(let index=0;index<=1000;index++){
        if(addedDestroy===0&&destroyPassives.length&&a.targets.some(id=>{const t=this.e.getUnit(id);return this.call('isFieldMonster',t)&&t.ego_breaked;}))addedDestroy=destroyPassives.reduce((sum,p)=>sum+this.call('calcValue',p.skill_id),0);
        this.w.termPassiveImmediatlyList=[];
        let crit=false;
        if(!attrs.includes('DMG_ATTR_NO_STAT_CRI')&&!(source.id===this.b.char.id&&a.targets.length===1&&a.targets[0]===this.b.char.id)){
          const forced=this.query('CRITICAL_ALWAYS',source.id,false,extra).filter(simpleCheck);
          if(forced.length){crit=true;this.call('checkTermValuePassive',forced[0].skill_id,s.caster_id,true,true);}
        }
        const skip=this.query('SKIP_TERM_CHECK',source.id,false,extra).filter(p=>this.skipTerms(p,s));let hit=false;
        for(const id of a.targets){
          const target=this.e.getUnit(id);if(!this.call('isFieldMonster',target))continue;
          const count=counts[id]??(counts[id]=this.call('calcCountValue',s.skill_id,id,a.preview_args)+(a.count_value_additional??0));
          if(!Number.isFinite(count)||count<0||count+addedDestroy>1000)throw new MissingBattleRule('csDamagePreview.hit_count',{count,addedDestroy});
          s.last_count_value=Math.max(s.last_count_value??0,count-(a.count_value_additional??0));if(index>=count+addedDestroy)continue;hit=true;
          let value=this.call('calcValue',s.skill_id,id,false,a.preview_args);
          if(isMonster&&!attrs.includes('DMG_ATTR_IGNORE_RAGE')){const rage=this.call('getRageDiff',true,true);if(rage!=null&&rage>=0)value*=this.constant('rage_base')*Math.pow(this.constant('rage_scale'),rage);}
          const unreducing=this.query('UNREDUCING_HP',id).length>0;
          let egoAttack=false;
          const noEgo=this.query('NOT_EGO_ATTACK',s.caster_id,false,extraIgnore);
          if(!noEgo.length){
            // Native still performs the incoming query even with card_id=-1;
            // its result cannot grant card weakness in a notice calculation.
            this.query('EGO_ATTACK_TAKE_ALWAYS',id,false,{caster_id:s.caster_id}).filter(p=>!p.eff_opt_multiple_link?.length||p.eff_opt_multiple_link.map(x=>this.call('convertEgoCommon',x)).includes('NONE'));
            const weak=this.query('WEAK_EGO_DAMAGE_ALWAYS',s.caster_id,false,{char_id:s.action_char_id});
            egoAttack=weak.filter(p=>this.call('checkValueAddOpts',{passive_id:p.skill_id,skill_id:s.skill_id,card_id:-1,target,crit,ego_type:color})).length>0;
          }
          const c={a,s,r,source,target,targets:a.targets,attrs,ignore,color,crit,egoAttack,extraIgnore,skip,unreducing,count,index,stat,statType:attrs.includes('DMG_ATTR_IGNORE_STAT')?0:1,reviseType:attrs.includes('DMG_ATTR_IGNORE_REVISE')?0:1};
          let egoFieldDmg=target.ego_breaked?0:this.hitEgoField(c);if(attrs.includes('DMG_ATTR_NOT_EGO_FIELD'))egoFieldDmg=0;c.destroy=target.ego_field_value!=null&&target.ego_field_value-egoFieldDmg<=0;
          let hitUsed=[];
          if(attrs.includes('DMG_ATTR_FIX')){value*=s.r_spark_multiply_pct_value?1+s.r_spark_multiply_pct_value/100:1;if(s.r_spark_multiply_pct_value)value=ceilGame(value);}
          else{const x=this.ordinaryValue(c,value);value=x.value;hitUsed=x.used;}
          value=this.revise(c.reviseType,procStatType(c.statType,value,stat));
          if(color!=='BASIC')value*=(100+this.call('getStatus',s.action_char_id,'S_'+color+'_DMG_RATE',0))/100;
          if(attrs.includes('DMG_ATTR_ADDITIONAL_ATTACK'))value*=(100+this.call('getStatus',s.action_char_id,'S_ADDI_ATK_DMG_RATE',0))/100;
          if(attrs.includes('DMG_ATTR_DOT_ATTACK'))value*=(100+this.call('getStatus',s.action_char_id,'S_DOT_ATK_DMG_RATE',0))/100;
          if(value<0)value=0;
          if(value>0&&crit){
            const mods=this.query('CRITICAL_DAMAGE_VALUE_ADD',source.id,false,extraIgnore).concat(this.query('CRITICAL_DAMAGE_VALUE_ADD',-1,true,{is_pre:true,ignore_cs_list:ignore}));const rate=this.rateModifiers(c,mods,this.call('getStatus',s.action_char_id,'S_CRI_DMG_RATE'),{targetFilters:true,kind:'critical'});value=ceilGame(value*rate);
          }
          if(egoAttack){let base=this.call('getStatus',s.action_char_id,'S_WEAK_EGO_DMG_RATE')/100;if(isNaN(base))base=1;
            const mods=this.query('WEAK_EGO_DAMAGE_REVISE_VALUE_ADD',source.id,false,{char_id:s.action_char_id});value=ceilGame(value*this.rateModifiers(c,mods,base,{consume:true,kind:'weak'}));}
          const monsterTarget=!!this.e.getMonster(id),partyDef=c.statType!==0&&!monsterTarget?this.call('getStatus',this.b.char.id,'S_DEF'):undefined;
          value=decreaseDamage(value,{statType:c.statType,isMonsterTarget:monsterTarget,monsterRate:target.status.info.S_DMG_DECREASE_RATE,partyDef,...(partyDef!==undefined?damageReductionConstants(this,partyDef):{})});
          if(value>0){
            const mods=this.query('FINAL_DAMAGE_VALUE_ADD',source.id,false,extraIgnore).filter(p=>!p.eff_opts?.includes('take')).concat(this.query('FINAL_DAMAGE_VALUE_ADD',id,false,{caster_id:s.action_char_id,is_pre:true,ignore_cs_list:ignore}).filter(p=>p.eff_opts?.includes('take')),this.query('FINAL_DAMAGE_VALUE_ADD',-1,true,{is_pre:true,ignore_cs_list:ignore}).filter(p=>!p.eff_opts?.includes('take')));
            const rate=this.rateModifiers(c,mods,100,{kind:'final'});if(rate!==1)value=ceilGame(value*rate);
          }
          // Additional damage still requires the native isPre sub-application.
          // The shared pre-apply runtime rejects active leech/additional paths;
          // forwarding them intact keeps that explicit boundary visible.
          const additions=[];
          for(const p of this.query('DMG_VALUE_ADD_ADDITIONAL',source.id,false,{...extra,caster_id:s.caster_id}).filter(p=>!p.eff_opts?.includes('take'))){if(this.check(p,c)){const n=ceilGame(value*this.call('calcValue',p.skill_id,id)/100);if(n>0)additions.push(n);}}
          for(const p of this.query('DMG_VALUE_ADD_ADDITIONAL',id,false,{is_pre:true,ignore_cs_own_type:true}).filter(p=>p.eff_opts?.includes('take'))){
            const required=(p.eff_opts??[]).filter(x=>DAMAGE_ATTR.has(x));
            if(required.every(x=>attrs.includes(x))&&this.check(p,c)){const n=ceilGame(value*this.call('calcValue',p.skill_id,id)/100);if(n>0)additions.push(n);}
          }
          const applied=this.call('procDamageApply',{worktable:this.w,caster_id:s.action_char_id,target,eff_value:value,card_id:-1,parent_card_id:undefined,skill_id:s.skill_id,isPre:true,ignoreCond:a.ignoreCond,dmgAttr:attrs,attrArgs,index,ref:undefined,opt:s.eff_opts??[],fix:attrs.includes('DMG_ATTR_FIX'),weakEgoAttack:egoAttack,egoFieldDmg,system_eff:index===0?r.link_battle_system_effect_id:undefined,isCrit:crit,dva_css:attrs.includes('DMG_ATTR_FIX')?undefined:hitUsed,dmgAdditionals:additions,char_id:s.action_char_id,target_char_id:undefined,is_last_attack:index===count+addedDestroy-1,monster_dmg_ratio:undefined});
          if(!Array.isArray(applied?.ret_actions))throw new MissingBattleRule('csDamagePreview.apply_shape');result.push(...applied.ret_actions);
          for(const passiveId of hitUsed)if(!used.includes(passiveId))used.push(passiveId);
        }
        if(!hit){finalCount=index;break;}
        if(index===1000)throw new MissingBattleRule('csDamagePreview.loop_budget');
      }
      s.final_count_value=finalCount;if(this.b.current_card_use_action)this.b.current_card_use_action.max_hit=Math.max(this.b.current_card_use_action.max_hit??0,finalCount);
      if(!Array.isArray(this.w.triggeredList?.dmg_valueadd))throw new MissingBattleRule('csDamagePreview.triggeredList');this.w.triggeredList.dmg_valueadd.push(...used);
      if(r.value_save_renewal_flag==='YES')throw new MissingBattleRule('csDamagePreview.save_value');s.leech_shield=undefined;s.leech_hp=undefined;return result;
    }finally{this.b.cur_card_dmg_targets=before;}
  }
}
