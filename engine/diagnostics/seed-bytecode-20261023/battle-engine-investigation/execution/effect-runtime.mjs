// Hand port of BattleWorktable.procTriggeredSkillData (0xf00000069900),
// getTriggeredList (0xf00000055300), and SkillEffectProc during helpers.
// Common procSkillEff prelude/finalization is included below. Each unported
// effect or active special branch remains a named mandatory rule.
import {MissingBattleRule} from './resource-store.mjs';
import {floorGame,ceilGame} from '../effects/effect-arithmetic.mjs';
import {DamagePreviewRuntime} from './damage-preview-runtime.mjs';
import {CSDamagePreviewRuntime} from './cs-damage-preview-runtime.mjs';
import {ActiveMonsterDamageRuntime} from './active-monster-damage-runtime.mjs';
import {ActivePlayerDamageRuntime} from './active-player-damage-runtime.mjs';
import {CORE_EFFECT_NAMES} from './core-effect-runtime.mjs';
import {CS_EFFECT_NAMES} from './cs-effect-runtime.mjs';
import {CS_TRANSFER_EFFECT_NAMES} from './cs-transfer-effect-runtime.mjs';
import {EGO_EFFECT_NAMES} from './ego-effect-runtime.mjs';
import {STRESS_EFFECT_NAMES} from './stress-effect-runtime.mjs';
import {COMBATANT_EFFECT_NAMES} from './combatant-runtime.mjs';
import {DamageCalculationRuntime} from './damage-calculation-runtime.mjs';
import {MONSTER_EFFECT_NAMES} from './monster-effect-runtime.mjs';
import {CARD_EFFECT_NAMES} from './card-effect-runtime.mjs';
export class EffectRuntime {
  constructor(engine){this.e=engine;this.b=engine.b;this.wt=engine.wt;this.db=engine.db;this.damagePreview=new DamagePreviewRuntime(engine);this.csDamagePreview=new CSDamagePreviewRuntime(engine);this.activeMonsterDamage=new ActiveMonsterDamageRuntime(engine);this.activePlayerDamage=new ActivePlayerDamageRuntime(engine);this.damageCalculation=new DamageCalculationRuntime(engine);}
  procDamageCalculate(args){
    return this.damageCalculation.procDamageCalculate(args);
  }
  resolveStatSource(...args){return this.damagePreview.resolveStatSource(...args);}
  getAttrInfo(...args){return this.damagePreview.getAttrInfo(...args);}
  call(name,...args){return this.e.call(name,...args);}
  row(s){return this.db.get('skill_eff',s.res_id);}
  action(type,fields){const a={id:this.b.last_action_id++,type,...fields};this.e.pushAction(a);return a;}
  boundary(){this.call('setStateMain',{state:this.b.current_state,proc:false,event:false,interrupt:false,check:false,prev:this.b.action_blocks.at(-1)?.prev});}
  hasMotion(row){if(row.operation_trigger_motion_type==='none')return false;return this.call('hasTriggerMotion',row.operation_trigger_motion_type);}
  clearInterruptOrderPending(){this.wt.interrupted=false;}
  // addSkillTriggered 0x74300 offsets 1745..3366. These reductions happen
  // when the trigger enters the queue, separately from after-effect reductions.
  consumeTriggerTerms(cs,skill,types,value,last){
    const check=(type,opts={})=>this.call('checkTermValue',cs.owner_id,type,skill.caster_id,cs.isCard,{...opts,exact_cs_id:cs.cs_id});
    for(const [type,opts]of [['TERM_CONDITION',{}],['TERM_CONDITION_WHOLE',{isWhole:true}],['TERM_CONDITION_HALF',{delta_pct:50}]])if(types.includes(type))check(type,opts);
    if(last)for(const [type,opts]of [['TERM_CONDITION_FINALLY',{}],['TERM_CONDITION_WHOLE_FINALLY',{isWhole:true}],['TERM_CONDITION_HALF_FINALLY',{delta_pct:50}]])if(types.includes(type))check(type,opts);
    // pickTermSuffix 0xd600 prefers the first valid term; duplicate valid
    // suffixes report a content error but still use the first one.
    const suffixes=types.map(type=>{
      const match=/^TERM_CONDITION_(PCT_)?([0-9]+)(_FINALLY)?$/.exec(type??'');if(!match)return undefined;
      const is_pct=!!match[1],parsed=parseInt(match[2],10);if(!is_pct&&parsed<1)return undefined;
      return {term_type:type,is_pct,value:is_pct?Math.min(parsed,100):parsed};
    }),selected=suffixes.find(x=>x!=null);
    if(selected){
      if(suffixes.filter(x=>x!=null).length>1)this.call('contentError',`err:duplicated_term_condition_suffix:${cs.res_id}:${types[0]},${types[1]}`,{channel:'#server_report_dev2'});
      if(last||!selected.term_type.endsWith('_FINALLY'))check(selected.term_type,{delta_value:selected.is_pct?undefined:selected.value,delta_pct:selected.is_pct?selected.value:undefined});
    }
    if(types.includes('TERM_VALUE_TRIGGERED'))check('TERM_VALUE_TRIGGERED',{delta_value:value});
  }
  // Worktable 0xca100 -> GameConstants 0x12400, loadConstants 0x3a00.
  getBattleHandMaxCount(){return this.db.number(this.db.get('constant_meta','battle_base_hand_max_count'),'value');}
  // BattleCardProc 0x7b500. Passives are applied in query order; each one
  // checks the potentially replaced card returned by the preceding passive.
  checkCardChangePassive(id){
    const card=this.b.cardMap[id];if(!card)return id;
    const passives=this.call('getPassiveByType',{source_id:this.b.char.id,type:'SKILL_EFF_CARD_CHANGE_PASSIVE',is_card:false,char_id:card.char_id});
    let current=id;
    for(const p of passives){
      const replacement=p.eff_opts?.[0];if(!replacement)continue;
      const now=this.b.cardMap[current];if(!now||now.res_id==replacement||now.before_card_change_passive_card)continue;
      const targets=this.call('getTargetCards',p.skill_id,false,false,false).target_cards_id;if(!targets.includes(current))continue;
      const limit=this.call('calcValue',p.skill_id);
      if(limit>=0&&this.b.deck_info.all.filter(x=>this.b.cardMap[x]?.card_change_passive_skill_id==p.skill_id).length>=limit)continue;
      current=this.call('applyCardChangePassive',current,replacement,p.skill_id);
    }
    return current;
  }
  // BattleCardProc 0x79e00: preserve the complete previous card for restoration.
  applyCardChangePassive(id,resId,skillId){
    const card=this.b.cardMap[id];if(!card||card.before_card_change_passive_card)return id;
    const before=structuredClone(card),next=this.call('changeCards',[id],resId)[0];if(!next)return id;
    next.before_card_change_passive_card=before;next.card_change_passive_skill_id=skillId;
    this.call('afterChangeCard',before,next.id);return next.id;
  }
  // 0x5a200 + predicate 0x5a800: only nonanimated CS-origin SINGULARITY
  // entries are drained; unrelated entries stay in their original order.
  procSingularityTriggeredImmediate(){
    let count=0;
    while(this.b.motionTrig&&this.b.motionTrig.length>0&&count++<1000){
      const index=this.b.motionTrig.findIndex(data=>{
        const s=this.b.skillMap[data.skill_id];if(!s||s.parent.type!=='CS')return false;
        const motion=this.db.table('skill_eff')[s.res_id]?.operation_trigger_motion_type;
        if(motion==null||this.hasMotion({operation_trigger_motion_type:motion}))return false;
        return this.b.csMap[s.parent.id]?.origin==='SINGULARITY';
      });
      if(index<0)break;const data=this.b.motionTrig.splice(index,1)[0];if(this.b.motionTrig.length===0)this.b.motionTrig=undefined;
      if(!(data.skill_id in this.b.skillMap))continue;
      const s=this.b.skillMap[data.skill_id];this.call('procTriggeredSkillData',data);
      const at=this.b.check_timing_all_temp?.indexOf(s.skill_id);
      if(at!=null&&at>-1){this.b.check_timing_all_temp?.splice(at,1);s.trigger_cs_cause_skill_id=data.trigger_cs_cause_skill_id;this.call('afterSkillCSCheck',s);s.trigger_cs_cause_skill_id=undefined;}
    }
  }
  saveCountValue(type,id,value){this.b.savedCountValue??={};this.b.savedCountValue[type+id]=value;}
  resetRandValues(id){
    const s=this.b.skillMap[id];if(!s?.randValues)return;
    for(const key in s.randValues){delete s.randValues[key];switch(key){case 'ev':this.call('calcValue',id);break;case 'ecv':this.call('calcCountValue',id);break;case 'tcslc':this.call('calcTargetCardSetListCount',id);break;}}
  }
  setCardUseDisplaySkillValue(cardId,id,target,values){
    const current=this.getCardUseDisplaySkillValue(cardId,id);if(!current)return;
    Object.assign(current,values);if(target==null)return;
    current.target_values??={};current.target_values[target.toString()]??={};Object.assign(current.target_values[target.toString()],values);
  }
  getCardUseDisplaySkillValue(cardId,id){
    const display=this.b.current_card_use_action?.card_use_display;if(!display)return;
    const card=this.b.cardMap[cardId];if(!card)return;const entry=display[cardId.toString()];if(!entry)return;
    if(entry.cost==null)entry.cost=card.cost_before_using;entry.skill_values??={};return entry.skill_values[id.toString()]??={};
  }
  // 0x198900; all event calls precede CS duration decrement.
  afterSkillCSCheck(s,o){
    const targets=o?.targets,at=this.b.check_timing_all_temp?.indexOf(s.skill_id);
    if(at!=null&&at>-1)this.b.check_timing_all_temp?.splice(at,1);
    this.call('applyChangeCS');if(s.parent.type!=='CS')s.triggerLog=undefined;
    if(s.last_count_value!=null)this.saveCountValue(s.parent.type.toLowerCase(),s.parent.id,s.last_count_value+(o?.count_value_additional??0));
    if(s.final_count_value!=null){
      if(s.parent.type==='CARD'&&this.wt.isPreview==s.parent.id){this.wt.triggeredList.final_ecv??={};this.wt.triggeredList.final_ecv[s.skill_id]=s.final_count_value;}
      if(s.parent.type==='CARD'&&this.wt.turnEndHpPreviewing&&this.e.getMonster(s.caster_id)){this.wt.triggeredList.turn_end_final_ecv??={};this.wt.triggeredList.turn_end_final_ecv[s.skill_id]=s.final_count_value;}
      if(s.parent.type==='CARD')this.setCardUseDisplaySkillValue(s.parent.id,s.skill_id,targets?.length===1?targets[0]:undefined,{final_ecv:s.final_count_value});
    }
    if(s.before_fix_count_value!=null){
      if(s.parent.type==='CARD'&&this.wt.isPreview==s.parent.id){this.wt.triggeredList.before_fix_ecv??={};this.wt.triggeredList.before_fix_ecv[s.skill_id]=s.before_fix_count_value;}
      if(s.parent.type==='CARD')this.setCardUseDisplaySkillValue(s.parent.id,s.skill_id,targets?.length===1?targets[0]:undefined,{before_fix_ecv:s.before_fix_count_value});
    }
    s.last_count_value=undefined;this.resetRandValues(s.skill_id);
    if(s.parent.type==='CS'){
      const cs=this.b.csMap[s.parent.id];if(!cs)return;
      if(!s.eff_opts?.includes('ignore_trigger_cs')){
        this.call('procUnitEvent','CONDITION_CHAR_CS_TRIGGER',[cs.char_id,cs.show_cs_res_id??cs.res_id,s.trigger_cs_cause_skill_id??-1,...(targets??[])]);
        this.call('procUnitEvent','CONDITION_OWN_CHAR_CS_TRIGGER',[cs.char_id,cs.show_cs_res_id??cs.res_id,...(targets??[])]);
      }
      this.procCSTermDecrement(s,cs,o?.term_eff_has_target??((targets?.length??0)>0));
    }
  }
  stripEffTargetTerm(type){if(type==null)return null;if(type==='TERM_EFF_TARGET')return 'TERM_EFF';return type.startsWith('TERM_EFF_TARGET_')?'TERM_EFF_'+type.slice('TERM_EFF_TARGET_'.length):null;}
  resolveEffTermTypes(a,b,hasTarget){return [a,b].map(t=>{const base=this.stripEffTargetTerm(t);return base==null?t??'TERM_NONE':hasTarget?base:'TERM_NONE';});}
  parseEffSuffix(type,pct=false){
    const prefix=pct?'TERM_EFF_PCT_':'TERM_EFF_';if(type==null||!type.startsWith(prefix))return null;
    let tail=type.slice(prefix.length);if(tail.endsWith('_FINALLY'))tail=tail.slice(0,-8);
    if(!/^[0-9]+$/.test(tail))return null;const n=parseInt(tail,10);return pct?Math.min(100,n):n<1?null:n;
  }
  getCSEffectTermDecrement(value,a,b,isLast,hasTarget){
    const terms=this.resolveEffTermTypes(a,b,hasTarget);
    if(terms.includes('TERM_EFF_WHOLE')||isLast&&terms.includes('TERM_EFF_WHOLE_FINALLY'))return value;
    if(terms.includes('TERM_EFF')||isLast&&terms.includes('TERM_EFF_FINALLY'))return 1;
    if(terms.includes('TERM_EFF_HALF')||isLast&&terms.includes('TERM_EFF_HALF_FINALLY'))return ceilGame(value/2);
    for(const term of terms){if(!isLast&&term.endsWith('_FINALLY'))continue;const pct=this.parseEffSuffix(term,true);if(pct!=null)return ceilGame(value*pct/100);const n=this.parseEffSuffix(term);if(n!=null)return Math.min(n,value);}
  }
  parseTriggerCSTermDecrementOpt(opts){const found=(opts??[]).filter(x=>x.startsWith('tv_dec_'));if(found.length!==1)return;const m=/^tv_dec_(max_)?([0-9]+)$/.exec(found[0]);if(m)return {mode:m[1]?'max':'set',value:Number(m[2])};}
  procCSTermDecrement(s,cs,hasTarget){
    const last=cs.skillEffs[cs.skillEffs.length-1]==s.skill_id,r=this.db.get('cs',cs.res_id);
    const delta=this.getCSEffectTermDecrement(cs.term_value,r.term_type_1,r.term_type_2,last,hasTarget??false);
    if(delta!=null){
      const terms=[r.term_type_1,r.term_type_2].map(x=>this.stripEffTargetTerm(x)??x);
      if(terms.every(x=>this.parseEffSuffix(x)!=null||this.parseEffSuffix(x,true)!=null))this.call('contentError',`err:duplicated_term_eff_suffix:${cs.res_id}:${r.term_type_1},${r.term_type_2}`);
    }
    const apply=(value,sign,caster,skill)=>{if(this.call('addTermValue',cs.cs_id,value,sign,caster,false,...(skill===undefined?[]:[skill])))this.call('removeContinueSkill',cs.cs_id,cs.owner_id,cs.isCard);};
    if(delta!=null&&s.trigger_cs_cause_skill_id!=null){
      const cause=this.b.skillMap[s.trigger_cs_cause_skill_id];
      if(cause&&this.row(cause).eff==='SKILL_EFF_TRIGGER_CS'){
        const opt=this.parseTriggerCSTermDecrementOpt(cause.eff_opts);
        if(opt){const value=Math.min(cs.term_value,Math.max(0,opt.mode==='max'?Math.min(delta,opt.value):opt.value));if(value===0)return;apply(-value,'MATHSIGN_ADD',s.caster_id,cause.skill_id);return;}
      }
    }
    if(delta!=null){
      const passive=this.call('resolveCSTermValueChangePassive',cs),pr=passive?this.row(passive):undefined,max=passive?.eff_opts?.includes('max')??false;
      if(passive&&pr&&(!max||pr.eff_value_math_sign==='MATHSIGN_SUBTRACT_MIN_0')){
        const value=this.call('calcValue',passive.skill_id,cs.owner_id);
        apply(max?-Math.min(delta,Math.max(0,floorGame(value))):value,max?'MATHSIGN_ADD':pr.eff_value_math_sign,passive.caster_id,passive.skill_id);
        this.call('checkTermValuePassive',passive.skill_id,s.caster_id);return;
      }
    }
    const {extension_passive:ext,extension_result:value,check_extension_passives:checked}=this.call('resolveCSExtension',cs);
    if(!ext){if(delta!=null)apply(-delta,'MATHSIGN_ADD',s.caster_id);}
    else{
      const terms=this.resolveEffTermTypes(r.term_type_1,r.term_type_2,hasTarget??false);
      if(value<cs.term_value&&terms.includes('TERM_EFF_WHOLE')||last&&terms.includes('TERM_EFF_WHOLE_FINALLY'))apply(-cs.term_value+value,'MATHSIGN_ADD',0);
      this.call('checkTermValuePassive',ext.skill_id,s.caster_id);
    }
    for(const passive of checked)if(passive.skill_id!=ext?.skill_id)this.call('checkTermValuePassive',passive.skill_id,0);
  }
  getRootParent(id){
    const s=this.b.skillMap[id];if(!s)return;let {type,id:parentId}=s.parent;
    for(let i=0;i<32&&type==='SKILL';i++){const p=this.b.skillMap[parentId];if(!p)break;type=p.parent.type;parentId=p.parent.id;}
    return {type,id:parentId};
  }
  getParentCard(id){const p=this.getRootParent(id);if(!p)return;if(p.type==='CARD')return this.b.cardMap[p.id];if(p.type==='CS'){const cs=this.b.csMap[p.id];if(cs?.isCard)return this.b.cardMap[cs.owner_id];}}
  isCardPreviewOutlineSource(id){
    if(!this.wt.isPreview)return false;const s=this.b.skillMap[id];if(!s||this.e.getMonster(s.action_char_id))return false;
    return this.getRootParent(id)?.type==='CARD';
  }
  initSkillTarget(id,isCard){const key=this.call('getSavedIndex',id);if(!this.b.savedTarget[key])this.b.savedTarget[key]=[[],isCard];}
  saveSkillTarget(id,targets,isCard){this.b.savedTarget[this.call('getSavedIndex',id)]=[targets,isCard];}
  // procSkillEff 89771..90720: log unresolved deaths under the triggering
  // sub-log, before afterSkillCSCheck. Do not process or dequeue them here.
  logEffectDeaths(){
    let type,ids=[];const flush=()=>{if(type)this.call('addDetailLog',{type,params:[ids.slice()],param_types:['monster_ids']});};
    for(const d of this.b.deads){
      if(d.detail_logged||this.call('isMultiHpNotKillDead',d))continue;
      d.detail_logged=true;
      const half=this.call('getPassiveByType',{source_id:d.source_id,type:'SKILL_EFF_HALF_DEAD_ABLE',is_card:false});
      const next=half.length?'log_half_death':'log_skill_eff_kill';
      if(next===type)ids.push(d.source_id);else{flush();type=next;ids=[d.source_id];}
    }flush();
  }
  // Common SkillEffectProc.procSkillEff setup/finalization, 0..17448 and
  // 89767..91732. Branch ports deliberately fail closed when exercised.
  procSkillEff(id,o={}){
    this.wt.termPassiveImmediatlyList=[];
    const s=this.b.skillMap[id];if(s.tipera_disabled)return;
    const opts=s.eff_opts??[];
    if(opts.includes('trigger_efficiency')&&!this.call('checkEfficiency',s))return;
    if(s.res_id==='eff_cs_collapse_1009_0'&&this.e.state.worktables.BattleInitWorktable.battle_init.stage_id?.toString()==='1001')return;
    const r=this.row(s),isCard=r.target_unit_type==='TARGET_UNIT_NONE';let source_id=s.caster_id;
    this.call('pushLog',`SkillEff ${id}:${s.res_id}:${r.eff}`+(s.eff_opts?`:opt=${JSON.stringify(s.eff_opts)}`:'')+(s.link_cs_ids?`:link_cs_id=${JSON.stringify(s.link_cs_ids)}`:''));
    if(r.target_save_renewal_flag==='YES')this.initSkillTarget(id,isCard);
    const cardId=this.getSkillCardId(s),outline=this.isCardPreviewOutlineSource(id);
    if(!o.skipInterrupt&&!o.skipRunCheck){
      let pct=this.db.number(r,'run_pct');
      for(const p of this.e.passives.query({source_id,type:'SKILL_EFF_RUN_PCT_ADD',is_card:false,char_id:s.action_char_id}))pct+=this.call('calcValue',p.skill_id);
      if(cardId>0)for(const p of this.e.passives.query({source_id:cardId,type:'SKILL_EFF_RUN_PCT_ADD',is_card:true}))pct+=this.call('calcValue',p.skill_id);
      if(pct<100){if(this.wt.isPreview)return;if(pct<=this.e.random.randRange(0,0,100)){this.call('pushLog','SkillEff cancel by run_pct');return;}}
    }
    const checks=this.db.array(r.run_check_opt);
    if(!this.call('procSkillEarlyChecks',id))return;
    if(['SKILL_EFF_CARD_DRAW','SKILL_EFF_CARD_DRAW_WHILE_UNIQUE'].includes(r.eff)&&!this.call('checkCardDrawAllowed',id))return [];
    if(!o.skipInterrupt&&(r.target_card_select_flag==='YES'||['SKILL_EFF_CARD_OPTION_SELECT','SKILL_EFF_CARD_RAN_SELECT_USE','SKILL_EFF_BATTLE_EVENT'].includes(r.eff)||r.timing_interrupt_flag==='YES'))return this.call('procSkillSelectionInterrupt',id,o);
    if(!o.skipInterrupt&&this.wt.interrupted)return this.call('procSkillAlreadyInterrupted',id,o);
    if(s.usable===false)return [];
    let targets=o.targets;
    if(targets==null||targets.length===0){
      if(!isCard){
        targets=this.call('getSkillEffTarget',id);
        if(outline&&r.target_unit_type_opt_outline==='YES'&&(this.db.array(r.target_unit_type_opt).length||this.db.array(r.target_unit_type_opt_link_cs_id).length)&&targets.length)this.wt.triggeredList.target_outline=true;
      }else{
        if(s.target_unit_type_opt?.length&&!this.call('procSkillCardUnitOptions',id,outline))return [];
        if(r.link_battle_system_effect_id&&r.link_battle_system_effect_id!=='none'&&!['SKILL_EFF_DMG','SKILL_EFF_DMG_EXCEPT_NOTI','SKILL_EFF_EXTRA_DMG','SKILL_EFF_DMG_IGNORE_COND'].includes(r.eff))this.action('action_system_effect',{source_id,command:r.link_battle_system_effect_id});
        targets=this.call('getTargetCards',id,false,false).target_cards_id.slice();
        if(targets.length===0&&r.card_place_toast_visible==='YES')this.emptyCardTargetToast(r);
      }
    }
    const skipDead=()=>{if(opts.includes('count_on_dead')&&s.parent.type==='CS'){if(s.triggerLog)this.call('pushSubBattleLog',s.triggerLog);this.call('afterSkillCSCheck',s,{targets});}};
    if(o.coop_char_id==null&&!isCard){
      const dead=id=>['death','run','changed'].includes(this.e.getUnit(id).state);
      if(targets.length===1){if(dead(targets[0]))return skipDead();}
      else{targets=targets.filter(id=>!dead(id));if(!targets.length&&!(this.wt.isPreview&&['SKILL_EFF_DMG','SKILL_EFF_DMG_EXCEPT_NOTI','SKILL_EFF_EXTRA_DMG','SKILL_EFF_DMG_IGNORE_COND'].includes(r.eff)))return skipDead();}
    }
    // procSkillEff @15915..15994, anonymous_220 0xf000000f3a00 @41..46:
    // "target_hp0" requires at least one target whose current HP is > 0.
    if(checks.includes('target_hp0')&&!targets.some(id=>this.e.getUnit(id).status.info.S_CURRENT_HP>0))return skipDead();
    if(!this.call('procSkillLateRunChecks',id,outline))return;
    if(!isCard&&r.link_battle_system_effect_id&&r.link_battle_system_effect_id!=='none')this.call('procSkillUnitSystemEffect',id,targets);
    const count_value_additional=this.call('getCountValueAdditional',cardId,id);
    let subPushed=false;
    if(s.triggerLog&&!['SKILL_EFF_CARD_DEBUFF_ADD','SKILL_EFF_CARD_DEBUFF_ADD_SHOW_SKIP'].includes(r.eff)&&(targets.length||['SKILL_EFF_CARD_GET','SKILL_EFF_CARD_GET_IGNORE_COND','SKILL_EFF_CARD_GET_OVERFLOW_TO_DECK_TOP','SKILL_EFF_CARD_GET_WITH_COST','SKILL_EFF_CARD_GET_USER'].includes(r.eff))){this.call('pushSubBattleLog',s.triggerLog);subPushed=true;}
    s.last_count_value=undefined;
    if(CARD_EFFECT_NAMES.has(r.eff)){
      const result=this.e.cardEffects.dispatch(id,{targets,options:o,count_value_additional,source_id,cardId,isCard,subPushed});
      if(result.returnEarly)return result.value;
      targets=result.targets;
      if(Object.hasOwn(result,'source_id'))source_id=result.source_id;
      if(Object.hasOwn(result,'subPushed'))subPushed=result.subPushed;
    }else switch(r.eff){
      // @53128 jumps straight to common finalization @89767. These skills
      // apply their CS when registered (procCSAddSetAuto), not on card use.
      case 'SKILL_EFF_CS_SET_ADD_AUTO':break;
      case 'SKILL_EFF_DMG':case 'SKILL_EFF_DMG_EXCEPT_NOTI':case 'SKILL_EFF_DMG_IGNORE_COND':case 'SKILL_EFF_EXTRA_DMG':
        // procSkillEff 22894..23358. Each calculator validates its context.
        this.call('procDamageCalculate',{targets,skill_id:id,worktable:this.wt,count_value_additional,is_pre:false,ignoreCond:r.eff==='SKILL_EFF_DMG_IGNORE_COND',...(r.eff==='SKILL_EFF_EXTRA_DMG'?{autoClient:true}:{}),motion_triggered:o.motion_triggered,card_activation:o.byCard==true||o.card_activation==true});break;
      case 'SKILL_EFF_SHIELD':case 'SKILL_EFF_SHIELD_IGNORE_VALUE_DEBUFF':case 'SKILL_EFF_SHIELD_IGNORE_COND':case 'SKILL_EFF_EXTRA_SHIELD':
        this.call('procShieldCalculate',targets,id,count_value_additional,r.eff==='SKILL_EFF_SHIELD_IGNORE_COND',r.eff==='SKILL_EFF_EXTRA_SHIELD');break;
      case 'SKILL_EFF_HEAL':case 'SKILL_EFF_HEAL_IGNORE_COND':case 'SKILL_EFF_CURE':case 'SKILL_EFF_CURE_IGNORE_COND':{
        // procSkillEff 512xx..51832, save both actual heal and coefficients.
        const result=this.call('procHealCalculate',source_id,targets,id,count_value_additional,undefined,r.eff==='SKILL_EFF_CURE'||r.eff==='SKILL_EFF_CURE_IGNORE_COND',r.eff.endsWith('_IGNORE_COND'));
        if(r.value_save_renewal_flag==='YES'){this.call('saveValue',s.parent.type.toLowerCase(),s.parent.id,result.total_heal_amount);this.call('saveCoeffValue',s.parent.type.toLowerCase(),s.parent.id,result.total_coeffs);}break;
      }
      case 'SKILL_EFF_SHIELD_CHANGE':this.call('procShieldExpire',source_id,targets,id,s.parent.type==='CARD'?'card':'',count_value_additional);break;
      case 'SKILL_EFF_CARD_MOVE_TO':case 'SKILL_EFF_CARD_MOVE_TO_MONSTER_JUDGMENT':targets=this.moveCardsEffect(id,targets);break;
      case 'SKILL_EFF_CS_SET_ADD':case 'SKILL_EFF_CS_SET_ADD_NO_SPARK':case 'SKILL_EFF_CS_SET_ADD_IGNORE_COND':
        ({targets}=this.e.csEffects.dispatch(id,{targets,options:o,count_value_additional,source_id,cardId,isCard}));break;
      case 'SKILL_EFF_KILL':targets=this.call('procKillEffect',id,targets,o.byCard);break;
      default:{
        if(MONSTER_EFFECT_NAMES.has(r.eff)){const result=this.e.monsterEffects.dispatch(id,{targets,options:o,count_value_additional,source_id,cardId,isCard});if(result.returnEarly)return result.value;targets=result.targets;break;}
        if(CS_TRANSFER_EFFECT_NAMES.has(r.eff)){const result=this.e.csTransfers.dispatch(id,{targets,options:o,count_value_additional,source_id,cardId,isCard});if(result.returnEarly)return result.value;targets=result.targets;break;}
        if(COMBATANT_EFFECT_NAMES.has(r.eff)){const result=this.e.combatants.dispatch(id,{targets,options:o,count_value_additional,source_id,cardId,isCard});if(result.returnEarly)return result.value;targets=result.targets;break;}
        if(EGO_EFFECT_NAMES.has(r.eff)){const result=this.e.egoEffects.dispatch(id,{targets,options:o,count_value_additional,source_id,cardId,isCard});if(result.returnEarly)return result.value;targets=result.targets;break;}
        if(STRESS_EFFECT_NAMES.has(r.eff)){const result=this.e.stressEffects.dispatch(id,{targets,options:o,count_value_additional,source_id,cardId,isCard});if(result.returnEarly)return result.value;targets=result.targets;break;}
        if(CS_EFFECT_NAMES.has(r.eff)){const result=this.e.csEffects.dispatch(id,{targets,options:o,count_value_additional,source_id,cardId,isCard});if(result.returnEarly)return result.value;targets=result.targets;break;}
        if(!CORE_EFFECT_NAMES.has(r.eff))throw new MissingBattleRule('procSkillEff.dispatch',{skill_id:id,eff:r.eff});
        const result=this.e.coreEffects.dispatch(id,{targets,options:o,count_value_additional,source_id,cardId,isCard});
        if(result.returnEarly)return result.value;targets=result.targets;break;
      }
    }
    if(subPushed&&this.b.deads.length)this.call('logEffectDeaths');
    this.call('afterSkillCSCheck',s,{targets,count_value_additional});
    if(r.target_save_renewal_flag==='YES')this.saveSkillTarget(id,targets,isCard);
    if(subPushed)this.call('setSubFinished');
    const card=this.getParentCard(id),group=s.pyeonrin_trigger_group_id;
    if(card){
      if(opts.includes('trigger_pyeonrin')&&group!=null){
        this.b.pyeonrin_triggered_groups??={};
        if(!this.b.pyeonrin_triggered_groups[group]){
          this.b.pyeonrin_triggered_groups[group]=true;const previous=this.wt.pyeonrin_reaction_group_id;this.wt.pyeonrin_reaction_group_id=group;
          try{this.call('procCardEvent','CONDITION_CARD_OPT_TRIGGERED',this.call('cardPlace','CARD_PLACE_NONE'),card.id,{skill_id:id});}finally{this.wt.pyeonrin_reaction_group_id=previous;}
        }
      }else if(!opts.includes('trigger_pyeonrin'))this.call('procCardEvent','CONDITION_CARD_OPT_TRIGGERED',this.call('cardPlace','CARD_PLACE_NONE'),card.id,{skill_id:id});
    }
    return targets??[];
  }
  emptyCardTargetToast(r){
    let msg;switch(r.eff){
      case 'SKILL_EFF_CARD_DRAW':case 'SKILL_EFF_CARD_DRAW_WHILE_UNIQUE':msg=this.b.deck_info.deck.length===0?'battle_toast_card_draw_empty_deck':'battle_toast_card_draw_no_target';break;
      case 'SKILL_EFF_CARD_DISCARD':msg='battle_toast_card_discard_empty';break;
      case 'SKILL_EFF_CARD_EXHAUST':msg='battle_toast_card_exhaust_empty';break;
      case 'SKILL_EFF_CARD_MOVE_TO':case 'SKILL_EFF_CARD_MOVE_TO_MONSTER_JUDGMENT':msg=['CARD_PLACE_MONSTER','CARD_PLACE_MONSTER_CASTER'].includes(r.target_card_set_list_card_place)?'battle_toast_card_move_to_empty_from_monster':'battle_toast_card_move_to_empty';break;
    }
    if(msg)this.action('action_toast',{source_id:-1,msg});
  }
  procSkillEffsPre(ids,preDeath=false){
    let result;this.wt.preSkillEvalDepth++;
    try{for(let i=0;i<ids.length;i++){const next=this.procSkillEffPre(ids[i],preDeath);if(next)result=result?result.concat(next):next;}}
    finally{this.wt.preSkillEvalDepth--;}
    return result;
  }
  procSkillEffPre(id,preDeath=false){
    const s=this.b.skillMap[id];if(s.usable===false||s.tipera_disabled)return;const r=this.row(s);
    switch(r.eff){
      case 'SKILL_EFF_DMG':case 'SKILL_EFF_EXTRA_DMG':case 'SKILL_EFF_DMG_IGNORE_COND':return this.call('procDamageCalculate',{targets:this.call('getSkillEffTarget',id,true),skill_id:id,count_value_additional:0,is_pre:true,ignoreCond:r.eff==='SKILL_EFF_DMG_IGNORE_COND',preDeath});
      case 'SKILL_EFF_SHIELD':case 'SKILL_EFF_EXTRA_SHIELD':case 'SKILL_EFF_SHIELD_IGNORE_COND':return this.call('procShieldCalculate',this.call('getSkillEffTarget',id,true),id,0,r.eff==='SKILL_EFF_SHIELD_IGNORE_COND',false,true);
      case 'SKILL_EFF_SHIELD_CHANGE':return this.call('procShieldExpire',s.caster_id,this.call('getSkillEffTarget',id,true),id,'card',0,true);
      case 'SKILL_EFF_CARD_DRAW':case 'SKILL_EFF_CARD_DRAW_WHILE_UNIQUE':{
        // Native procSkillEffPre +544..554 passes query=false, alreadyShuffled=true;
        // this adapter exposes ignoreCount before alreadyShuffled. Keep count enabled.
        let value=this.call('calcValue',id);const targets=this.call('getTargetCards',id,false,false,true).target_cards_id;
        if(value<0)value=this.call('getBattleHandMaxCount')-this.call('getHandCardCountForLimit');
        if(value>targets.length)value=Math.min(value,this.b.deck_info.deck.length+this.b.deck_info.discard.length);
        return [['draw',value]];
      }
    }
  }
  procSkillEffs(ids,o={}){
    const {byCard,event,card_id,motion_index,procUse=true,byMonster=false,procTriggered=true,skip_not_break_additional=false}=o,result=[];
    if(byCard)this.wt.byCard=true;
    const bans=card_id!=null?this.e.passives.query({source_id:card_id,type:'SKILL_EFF_BAN_EFFECT',is_card:true}):[];
    this.call('clearInterruptOrderPending');const card=this.b.cardMap[card_id??-1];if(card)card.eff_banned=undefined;
    for(let i=0;i<ids.length;i++){
      if(event!=null&&event===i&&card_id!=null&&procUse)this.call('procCardUseEvent',card_id);
      if(motion_index===i)this.action('action_motion_start',{source_id:-1});
      if(!bans.length){
        const s=this.b.skillMap[ids[i]];
        if(s.tipera_disabled){result.push([]);if(motion_index===i)this.action('action_motion_end',{source_id:-1});continue;}
        this.setDuring(s.skill_id,true);const off=this.row(s).target_effect_flag==='NO';if(off)this.wt.target_effect_off=true;
        const targets=this.procSkillEff(ids[i],{byCard});this.wt.target_effect_off=undefined;this.setDuring(s.skill_id,false);result.push(targets&&!off?targets:[]);
      }else{card.eff_banned=true;result.push([]);}
      if(byMonster&&this.b.monster_turn_end)break;
    }
    this.wt.byCard=undefined;
    if(this.b.deads.length)this.call('logEffectDeaths');
    this.call('clearInterruptOrderPending');
    if(card_id!=null&&!skip_not_break_additional){const list=this.e.passives.query({source_id:card_id,type:'SKILL_EFF_TARGET_MON_NOT_BREAK_CARD_USE_ADDITIONAL',is_card:true});if(list.length)this.call('procNotBreakCardAdditional',card_id,result,list);}
    if(procTriggered)this.call('procSkillTriggered',true,true);
    return result;
  }
  setDuring(id,on){
    const s=this.b.skillMap[id];if(!s)return;
    s.duringConds?.forEach(id=>{const st=this.b.stackMap[id];if(!st)return;st.inactive=on?undefined:true;if(on)this.e.stacks.procReset(id);});
    s.duringPassives?.forEach(id=>{const p=this.b.skillMap[id];if(on&&!p)return;p.passiveDuring=!!on;
      const usable=on?(p.stack_trigger?this.call('checkStack',p.stack_trigger):true):false;
      if(usable)delete p.usable;else p.usable=false;
    });
  }
  setCauseDuring(id,on){if(id==null)return;const s=this.b.skillMap[id];if(!s||s.removed||!s.eff_opts?.includes('keep_during_on_trigger'))return;this.setDuring(id,on);}
  getTriggeredList(id,split=false){
    const b=this.b,s=b.skillMap[id],r=this.row(s);
    const list={relic:[],ego:[],cs:[],dmg_valueadd:[],shield_valueadd:[],maxHpMap:{},hpMap:{},shieldMap:{},egoMap:{},monTurnMap:{},energy:0};
    if(id in b.relicActionMap){this.action('action_relic_active',{source_id:b.relicActionMap[id]});list.relic.push(b.relicMap[b.relicActionMap[id]].res_id);}
    if(id in b.egoActionMap){const x=b.egoActionMap[id];this.action('action_ego_active',{source_id:x.char_id,ego_skill_res_id:x.ego_skill_res_id});list.ego.push([x.ego_skill_res_id,x.char_id]);}
    if(id in b.collapseActionMap)this.action('action_collapse_active',{source_id:b.collapseActionMap[id].char_id});
    let action,index;
    const motion=!this.db.array(r.run_check_opt).includes('immediate')&&this.hasMotion(r);
    if(s.parent.type==='CS'||motion){
      const cs=b.csMap[s.parent.id];
      if(cs){
        const cr=this.db.get('cs',cs.res_id),visible=!['SHOW_TYPE_NONE','SHOW_TYPE_OUTLINE'].includes(cr.show_type);
        if(motion||(this.e.getMonster(cs.owner_id)&&r.trigger_noti_type==='YES'&&visible)){
          action={id:b.last_action_id++,type:motion?'action_cs_chain_attack':'action_cs_trigger',source_id:motion?s.action_char_id:cs.owner_id,
            action_cs:{id:cs.cs_id,char_id:cs.char_id,caster_id:motion?cs.caster_id:cs.owner_id,target_id:cs.action_target_id,cs_res_id:cs.show_cs_res_id??cs.res_id,from_ego:cs.from_ego,from_relic:cs.from_relic,from_collapse:cs.from_collapse}};
          if(motion)action.motion_type=r.operation_trigger_motion_type;
          if(split)this.boundary();index=this.e.pushAction(action);
        }
        if(visible&&r.trigger_noti_type==='YES')list.cs.push(cs.cs_id);
      }else{action={id:b.last_action_id++,type:'action_cs_chain_attack',source_id:s.action_char_id,motion_type:r.operation_trigger_motion_type};index=this.e.pushAction(action);}
    }
    return {triggeredList:list,actionCSTrigger:action,actionCSTriggerIndex:index};
  }
  triggerLog(s,r){
    const cs=s.parent.type==='CS'?this.b.csMap[s.parent.id]:undefined,cr=cs?this.db.get('cs',cs.res_id):undefined;
    const own=cr?.log_self_flag==='YES';let log;
    const base=(type,params,merge)=>({type,params,logs:[],not_noti:r.trigger_noti_type!=='YES',...(merge?{merge_by:s.action_char_id}:{})});
    if(s.from_relic&&!own)log=base(18,[s.from_relic],true);
    else if(s.from_ego&&!own)log=base(17,[s.from_ego,s.action_char_id],true);
    else if(s.from_collapse&&!own)log=base(19,[s.from_collapse],true);
    else if(cs&&['SHOW_TYPE_ICON','SHOW_TYPE_ICON_OUTLINE','SHOW_TYPE_LOG_ONLY'].includes(cr.show_type)){
      if(cs.isCard){
        const draws=r.eff==='SKILL_EFF_CARD_MOVE_TO'&&r.eff_card_place==='CARD_PLACE_HAND'||['SKILL_EFF_CARD_DRAW','SKILL_EFF_CARD_DRAW_WHILE_UNIQUE'].includes(r.eff);
        if(!draws){const c=this.b.cardMap[cs.owner_id];if(this.b.deck_info.all.includes(c.id))this.exhibit(c);}
        log=base(26,[cs.owner_id]);
      }else{log=base(16,[cr.show_link_cs_id==='none'?cr.id:cr.show_link_cs_id]);log.not_noti=log.not_noti||!!this.e.getMonster(cs.owner_id);}
    }else if(s.parent.type==='CARD'&&r.trigger_noti_type==='YES')this.exhibit(this.b.cardMap[s.parent.id]);
    if(log)log.merge_srcs=[s.skill_id];
    if(r.trigger_noti_type!=='NO_LOG')s.triggerLog=log;
  }
  exhibit(c){this.action('action_card_exhibit',{source_id:c.id,card_from:c.card_place,value:1/3});}
  getSkillCardId(s){let p=s.parent;const seen=new Set();while(p.type==='SKILL'){if(seen.has(p.id))throw new MissingBattleRule('cyclic_skill_parent');seen.add(p.id);const next=this.b.skillMap[p.id];if(!next)return -1;p=next.parent;}return p.type==='CARD'?p.id:-1;}
  isHandMaxAmountExceptCard(id){
    const c=this.b.cardMap[id];if(!c)return false;
    return this.e.passives.query({source_id:this.b.char.id,type:'SKILL_EFF_HAND_MAX_AMOUNT_EXCEPT_PASSIVE',is_card:false,char_id:c.char_id}).some(s=>{
      const all=this.b.deck_info.all,had=all.includes(id);if(!had)all.push(id);
      try{return this.call('getTargetCards',s.skill_id,false,false,false).target_cards_id.includes(id);}
      finally{if(!had){const i=all.indexOf(id);if(i>=0)all.splice(i,1);}}
    });
  }
  getHandCardCountForLimit(){let n=0;for(const id of this.b.deck_info.hand)if(!this.isHandMaxAmountExceptCard(id))n++;return n;}
  // pushHand 0xf000000cd900. The caller owns removal from the old pile and
  // setting card_place; pushHand only inserts, invokes draw hooks, and counts.
  pushHand(id,options){
    const o=options??{},c=this.b.cardMap[id];this.db.get('card',c.res_id);
    const except=this.isHandMaxAmountExceptCard(id);
    if(!o.allow_overflow&&!except&&this.getHandCardCountForLimit()>=this.call('getBattleHandMaxCount')-(this.b.sparking?1:0)){
      this.action('action_card_hand_full',{source_id:this.b.char.id});
      if(!o.not_toast){
        if(o.skill_id!=null){const s=this.b.skillMap[o.skill_id];if(s&&this.row(s).card_place_toast_visible!=='YES')return false;}
        this.action('action_toast',{source_id:-1,msg:'battle_toast_hand_full'});
      }return false;
    }
    this.b.recent_draw=id;this.b.deck_info.hand.push(id);this.call('reserveLightDarkDivide',[id]);c.by_turn_draw=o.turn_draw;
    this.call('checkCardChangePassive',id);
    if(!o.preBattle){
      const stage=this.e.state.worktables.BattleStageWorktable.battle_stage;
      if(!Object.hasOwn(stage,'cheat_info'))throw new MissingBattleRule('snapshot.battle_stage.cheat_info');
      if(stage.cheat_info.cheat_turn_spark)this.call('pushHandCheatSpark',id);
    }
    if(!o.turn_draw)this.b.dpt.draw_count++;return true;
  }
  procTriggeredSkillData(data){
    this.e.record?.({kind:'effect-execute',skill_id:data.skill_id,priority:data.priority,value:data.value,card_triggered:data.card_triggered});
    const s=this.b.skillMap[data.skill_id],r=this.row(s),card=this.getSkillCardId(s);
    if(s.eff_opts?.includes('run_check')&&s.stack_trigger){
      const cond=this.call('checkCondMap',s.stack_trigger,'STACK'),stack=this.call('checkStack',s.stack_trigger);
      if(!cond&&!stack){this.call('pushLog','skill '+s.res_id+' canceled by run_check');this.call('flushDeferredLogs',data);return;}
    }
    let pct=this.db.number(r,'run_pct');
    const unit=this.e.passives.query({source_id:s.caster_id,type:'SKILL_EFF_RUN_PCT_ADD',is_card:false,char_id:s.action_char_id});
    const cards=card>0?this.e.passives.query({source_id:card,type:'SKILL_EFF_RUN_PCT_ADD',is_card:true}):[];
    unit.concat(cards).forEach(p=>{pct+=this.call('calcValue',p.skill_id);});
    if(pct<100){
      if(this.wt.isPreview){this.call('flushDeferredLogs',data);return;}
      const roll=this.e.random.randRange(0,0,100);
      if(pct<=roll){this.call('pushLog','skill '+s.res_id+' canceled by pct : '+roll);this.call('flushDeferredLogs',data);return;}
    }
    s.value_triggered=data.value;s.card_triggered=data.card_triggered;s.bind_stack_triggered=data.bind_stack_triggered;
    s.rita_value=data.rita_value;s.pyeonrin_trigger_group_id=data.pyeonrin_trigger_group_id;
    const trig=this.getTriggeredList(data.skill_id,true);this.triggerLog(s,r);this.setDuring(s.skill_id,true);
    if(s.stack_trigger&&this.b.relicToggleMap&&s.stack_trigger in this.b.relicToggleMap){
      this.action(this.call('checkStack',s.stack_trigger)?'action_relic_loop':'action_relic_loop_end',{source_id:this.b.relicToggleMap[s.stack_trigger]});
    }
    if(r.target_card_set.startsWith('CARD_SET_TRIGGERED')&&data.target!=null&&data.target.length>0)s.card_triggered=data.target[0];
    s.trigger_cs_cause_skill_id=data.trigger_cs_cause_skill_id;this.setCauseDuring(data.trigger_cs_cause_skill_id,true);
    const targets=this.call('procSkillEff',data.skill_id,{targets:data.target,skipRunCheck:true});
    this.setCauseDuring(data.trigger_cs_cause_skill_id,false);s.pyeonrin_trigger_group_id=undefined;
    const at=this.b.check_timing_all_temp?.indexOf(s.skill_id);
    if(at!=null&&at>-1){this.b.check_timing_all_temp?.splice(at,1);this.call('afterSkillCSCheck',s);}
    s.trigger_cs_cause_skill_id=undefined;if(trig.actionCSTrigger&&targets)trig.actionCSTrigger.target_id=targets;
    this.setDuring(s.skill_id,false);
    if(this.wt.isPreview)for(const k of ['relic','ego','cs'])this.wt.triggeredList[k].push(...trig.triggeredList[k]);
    if(trig.actionCSTrigger)this.boundary();this.call('setSubFinished');this.call('flushDeferredLogs',data);this.call('applyChangeCS');
  }
  // Exact CARD_MOVE_TO switch body 46375..47027. Outer target/value/event
  // setup and finalization belong to procSkillEff, not this branch API.
  moveCardsEffect(skillId,targets){
    const s=this.b.skillMap[skillId],r=this.row(s);if(!['SKILL_EFF_CARD_MOVE_TO','SKILL_EFF_CARD_MOVE_TO_MONSTER_JUDGMENT'].includes(r.eff))throw new MissingBattleRule('moveCardsEffect.kind',{eff:r.eff});
    let count=this.call('calcValue',skillId);
    if(count<0){count=targets.length;if(r.eff_card_place==='CARD_PLACE_HAND'){const max=this.call('getBattleHandMaxCount'),n=this.call('getHandCardCountForLimit');if(n+count>max)count=max-n;}}
    return this.call('moveCards',{skill_id:s.skill_id,card_ids:targets.slice(0,count),from:this.call('cardPlace',r.target_card_set_list_card_place),to:this.call('cardPlace',r.eff_card_place),monster_id:s.caster_id,move_to_monster_judgment:r.eff==='SKILL_EFF_CARD_MOVE_TO_MONSTER_JUDGMENT'});
  }
  getLinkCsOwnerCharIDs(s,r){
    if(!s.eff_opts?.includes('link_cs_owner')||this.db.array(r.target_unit_type_opt).includes('not'))return;
    const changes=this.e.state.worktables.BattleStageWorktable.battle_stage.break_cs_changes;
    const linked=this.db.array(r.target_unit_type_opt_link_cs_id).map(id=>changes?.[id]??id);if(!linked.length)return;
    const owners=this.call('getCharIDsOwningCS',linked);return owners.length?owners:undefined;
  }
  resolveCSOwnerCharIDs(id,linked,fallback){return linked==null||this.db.table('cs')[id]?.own_type!=='OWN_CHAR'?[fallback]:linked;}
  // procSkillEff 27670..29523, UNIT branch + anonymous_242/243/244.
  // Outer setup supplies source_id and count_value_additional; these are never
  // inferred from a cached value or supplied from the observed post-state.
  csSetAddUnitEffect(skillId,targets,{source_id,count_value_additional,value}){
    const s=this.b.skillMap[skillId],r=this.row(s),linked=this.getLinkCsOwnerCharIDs(s,r);
    if(!['SKILL_EFF_CS_SET_ADD','SKILL_EFF_CS_SET_ADD_NO_SPARK','SKILL_EFF_CS_SET_ADD_IGNORE_COND'].includes(r.eff))throw new MissingBattleRule('csSetAddUnitEffect.kind',{eff:r.eff});
    if(s.eff_opts?.includes('own_other_char'))throw new MissingBattleRule('csSetAddUnitEffect.own_other_char');
    const all=s.eff_opts?.includes('all');if(!all&&(s.link_cs_ids?.length??0)>1)s.log_all_cards=false;
    const opts=s.eff_opts??[],pct=Number(opts.find(x=>x.startsWith('pct_'))?.slice(4)??100);
    if(r.target_unit_type==='TARGET_UNIT_NONE')throw new MissingBattleRule('csSetAddUnitEffect.card_targets');
    let group=targets.length>1;
    if(!group)for(const target of targets)if(this.call('calcCountValue',skillId,target)+count_value_additional>1)group=true;
    if(group)this.action('action_group_start',{source_id:-1});
    targets.forEach(target=>{
      if(pct<100){if(this.wt.isPreview)return;if(pct<=this.e.random.randRange(0,0,100))return;}
      const count=this.call('calcCountValue',skillId,target)+count_value_additional;
      value=this.call('calcValue',skillId,target);let tar=target;
      for(let i=0;i<count;i++){
        if(r.target_unit_type==='TARGET_UNIT_ALL_RAN_ENEMY'&&i>0){const choices=this.call('getTargetableMonstersID',{skill_id:skillId});if(choices.length)tar=this.e.random.randomArrayMember(0,choices);}
        if(this.wt.isPreview&&s.link_cs_ids?.length!==1&&!all)continue;
        const chosen=all?(s.link_cs_ids??[]):[this.e.random.randomArrayMember(0,s.link_cs_ids??[])];
        chosen.forEach(id=>this.resolveCSOwnerCharIDs(id,linked,s.action_char_id).forEach(owner=>{
          this.call('procAddCS',tar,id,value,source_id,false,r.eff_value_math_sign,false,false,owner,s.skill_id,{ignoreCond:r.eff==='SKILL_EFF_CS_SET_ADD_IGNORE_COND',fromRelic:s.from_relic});
        }));
      }
    });
    if(group)this.action('action_group_end',{source_id:-1});return {targets,value};
  }
  procMotionSkillTriggered(){this.call('beginMonsterHitBatch');try{this.procMotionSkillTriggeredBody();}finally{this.call('endMonsterHitBatch');}}
  beginMonsterHitBatch(){this.wt.monsterHitBatchDepth++;}
  endMonsterHitBatch(){
    if(this.wt.monsterHitBatchDepth<=0)return;if(--this.wt.monsterHitBatchDepth>0)return;
    const slots=this.wt.monsterHitBatchSlots;this.wt.monsterHitBatchSlots=undefined;
    if(!slots||slots.size===0)return;this.call('procUnitEvent','CONDITION_MONSTER_HIT_SAMETIME',[Array.from(slots)]);
  }
  reserveLightDarkDivide(ids){
    // TALENT_LIGHT_DARK=58 in retained battle_enums/talent-enum.json.
    for(const id of ids)if(this.b.cardMap[id]?.talents?.includes(58)){
      this.b.divide_reserved??=[];if(!this.b.divide_reserved.includes(id))this.b.divide_reserved.push(id);
    }
  }
  skipTriggeredSkillData(data){
    const s=this.b.skillMap[data.skill_id],at=this.b.check_timing_all_temp?.indexOf(s.skill_id);
    if(at!=null&&at>-1){this.b.check_timing_all_temp?.splice(at,1);s.trigger_cs_cause_skill_id=data.trigger_cs_cause_skill_id;this.call('afterSkillCSCheck',s);s.trigger_cs_cause_skill_id=undefined;}
    this.call('flushDeferredLogs',data);
  }
  procMotionSkillTriggeredBody(){
    return this.call('procMotionSkillTriggeredBody.full');
  }
}
