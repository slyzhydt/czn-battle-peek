// Handwritten ports; retained source and byte offsets: evidence/hp-support/.
// setStatus 0x194300 HP/max-HP path, accumulateMonsterDamageDpt 0x193300,
// resolveDptCharResId 0x19df00. Existing shield implementation is reused.
import {MissingBattleRule} from './resource-store.mjs';
import {GameScoreRuntime} from './game-score-runtime.mjs';
const emptyStats=()=>({damage:0,shield_gained:0,heal:0,overheal:0,heal_with_overheal:0});
// GameMath.toFixed 0x3c00: Number(raw_to_fixed.call(value+EPSILON,n)).
const fixed2=n=>Number((n+1e-8).toFixed(2));
export class HpSupportRuntime {
  constructor(e){this.e=e;this.b=e.b;this.w=e.wt;this.score=new GameScoreRuntime(e);}
  call(n,...a){return this.e.call(n,...a);}
  get stage(){const s=this.e.state.worktables?.BattleStageWorktable?.battle_stage;if(!s)throw new MissingBattleRule('BattleStageWorktable.battle_stage');return s;}
  // BattleStageWorktable 0x63100/0x67400/0x67e00. Missing row has a
  // source-defined CONTENT_NONE/false result; missing table still fails.
  getContentCategoryWithIngameContentConfigId(id){const row=this.e.db.table('ingame_content_config')[id??this.stage.ingame_content_config_id];return row==null?'CONTENT_NONE':row.content_category;}
  isEventStory(){return this.e.db.table('ingame_content_config')[this.stage.ingame_content_config_id]?.parent_content_category==='PARENT_CONTENT_STORY_EVENT';}
  isStory(){return this.getContentCategoryWithIngameContentConfigId(this.stage.ingame_content_config_id)==='CONTENT_STORY'||this.isEventStory();}
  currentCharRes(){const c=this.b.current_card>=0?this.b.cardMap[this.b.current_card]:undefined;return c&&c.char_id>0?this.call('tryGetCharByCharId',c.char_id)?.res_id:undefined;}
  resolveDptCharResId(id){
    const chars=this.b.chars,fourth=this.b.assault_fourth_char;
    const direct=chars.find(c=>c&&c.id===id);if(direct)return direct.res_id;
    if(fourth&&fourth.id===id)return fourth.res_id;
    const unit=this.e.getUnit(id,true);if(unit?.summoner){const owner=chars.find(c=>c&&c.id===unit.summoner);if(owner)return owner.res_id;if(fourth&&fourth.id===unit.summoner)return fourth.res_id;}
  }
  accumulateMonsterDamageDpt(amount,resId){
    const d=this.b.dpt;d.damage+=amount;let who=this.currentCharRes();
    if(who==null&&d.last_caster_id!=null)who=this.resolveDptCharResId(d.last_caster_id);
    if(who!=null){const stats=d.char_stats[who]??=emptyStats();stats.damage+=amount;
      if(this.e.db.table('monster')[resId]?.grade==='GRADE_BOSS')stats.boss_damage=(stats.boss_damage??0)+amount;}
  }
  setStatus(id,type,value,options){
    if(type==='S_CURRENT_SHIELD')return this.e.monsterNotifications.setStatus(id,type,value,options);
    const {trigger=true,isCure=false,dpt=false,overheal=0}=options??{};
    const unit=this.e.getUnit(id),monster=!!this.e.getMonster(id),info=unit.status.info;
    // Limitless units record damage but retain HP and emit no HP events.
    if(type==='S_CURRENT_HP'&&unit.is_limitless===true){const loss=info[type]-value;if(monster&&dpt&&loss>0)this.accumulateMonsterDamageDpt(loss,unit.res_id);return info[type];}
    if(type==='S_CURRENT_HP'){
      if(this.w.test&&!monster&&value===0)value=1;
      if(value>info[type]){const bans=this.call('getPassiveByType',{source_id:id,type:isCure?'SKILL_EFF_CURE_BAN':'SKILL_EFF_HEAL_BAN',is_card:false});
        if(bans.length){this.call('addDetailLog',{type:'log_skill_eff_heal_ban',params:[id],param_types:['unit_id']});this.call('checkTermValuePassive',bans[0].skill_id,id);return info[type];}}
      if(value>info.S_HP)value=info.S_HP;
    }else if(type==='S_HP')value=Math.max(1,value);
    const old=info[type],oldPct=trigger?info.S_CURRENT_HP*100/info.S_HP:0;info[type]=value;
    const emit=(t,p)=>this.call('procUnitEvent',t,p);
    emit('CONDITION_CHAR_PARAMETER',[id,this.call('getKeywordByStatType',type),old,value]);
    if(type==='S_HP'){
      const oldHp=info.S_CURRENT_HP;
      if(value<oldHp)this.setStatus(id,'S_CURRENT_HP',value,{trigger:false,dpt});
      // Native reports the new maximum here even when actual HP was lower.
      if(trigger){emit('CONDITION_CHAR_PARAMETER',[id,'cur_hp',oldHp,value]);emit('CONDITION_CHAR_CUR_HP_CHANGE',[id,'cur_hp',value-oldHp]);}
    }
    if(trigger&&['S_CURRENT_HP','S_HP'].includes(type)){const pct=info.S_CURRENT_HP*100/info.S_HP,p=[id,'cur_hp_pct',oldPct,pct];
      for(const t of ['CONDITION_CHAR_PARAMETER','CONDITION_CHAR_VIABILITY','CONDITION_CHAR_INJURY'])emit(t,p);
      if(type==='S_CURRENT_HP')emit('CONDITION_CHAR_CUR_HP_CHANGE',[id,'cur_hp',value-old]);
      emit('CONDITION_CHAR_CUR_HP_CHANGE',[id,'cur_hp_pct',pct-oldPct]);}
    // These notifications are outside the trigger flag in the original.
    if(type==='S_CURRENT_HP'){
      emit('CONDITION_CHAR_HP_TURN_START',[id,value]);
      if(monster)emit('CONDITION_CHAR_HP_MON_REGIST_PCT',[id,value]);
      emit('CONDITION_CHAR_TAKE_DMG_MAX_HP_PCT_TURN',[id,value]);emit('CONDITION_CHAR_TAKE_DMG_MAX_HP_PCT',[id,value]);
      if(id==this.b.char.id)emit('CONDITION_HP_COMP_START',[value]);
    }
    if(monster&&type==='S_CURRENT_HP'){
      const loss=old-value;if(dpt&&loss>0)this.accumulateMonsterDamageDpt(loss,unit.res_id);
      if(unit.alwaysDamage!=null&&this.call('isAlwaysDamageFatal',unit,old,info.S_CURRENT_SHIELD)!=this.call('isAlwaysDamageFatal',unit))this.call('refreshMonsterNoti');
    }else if(!monster&&dpt&&type==='S_CURRENT_HP'){
      const d=this.b.dpt,loss=old-value,who=this.currentCharRes();
      if(loss>0)d.damage_taken+=loss;
      else if(loss<0){const gain=-loss;d.heal+=gain;d.overheal+=overheal;d.heal_with_overheal+=gain+overheal;
        if(who){const s=d.char_stats[who]??=emptyStats();s.heal+=gain;s.overheal+=overheal;s.heal_with_overheal+=gain+overheal;}}
      else if(overheal>0){d.overheal+=overheal;if(who)(d.char_stats[who]??=emptyStats()).overheal+=overheal;}
    }
    return value;
  }
  collectMonsterHitSlot(slot){if(this.w.monsterHitBatchDepth<=0||slot==null||slot<0)return;(this.w.monsterHitBatchSlots??=new Set()).add(slot);}
  accumulateCardValue(targetId,type,value){
    if(!this.call('checkMissionApply')||this.b.current_card<0||value<=0)return;
    const monster=!!this.e.getMonster(targetId),c=this.b.cardMap[this.b.current_card];if(!c||c.ep_skill||c.char_id<0)return;
    const key=type==='damage'&&monster?'damage_accumulated':type==='heal'&&!monster?'heal_accumulated':type==='shield'&&!monster?'shield_accumulated':undefined;
    if(key)c[key]=(c[key]??0)+value;
  }
  countCardUseKill(cardId){if(cardId<=0||this.w.isPreview)return;this.b.cardUseKilled??={};this.b.cardUseKilled[cardId]=(this.b.cardUseKilled[cardId]??0)+1;}
  saveValue(type,id,value){this.b.savedValue[type+id]=value;}
  saveCoeffValue(type,id,value){this.b.savedCoeffValue??={};this.b.savedCoeffValue[type+id]=value;}
  getAllChars(){return this.b.assault_fourth_char?[...this.b.chars,this.b.assault_fourth_char]:this.b.chars;}
  getTriggerCauseCardId(skill){if(skill?.trigger_cs_cause_skill_id==null)return;const cause=this.b.skillMap[skill.trigger_cs_cause_skill_id];if(!cause?.eff_opts?.includes('keep_during_on_trigger'))return;return cause.parent.type==='CARD'?cause.parent.id:undefined;}
  getCharOriginMaxHP(){return this.b.char.status.info.S_HP+this.stage.chars.reduce((n,c)=>n+(c.collapse_dec_max_hp??0),0);}
  accumulateStressDpt(resId,delta){if(delta===0)return;const s=this.b.dpt.char_stats[resId]??=emptyStats();const key=delta>0?'stress_gained':'stress_reduced';s[key]=fixed2((s[key]??0)+Math.abs(delta));}
  setEgoStress(c,value,force=false){const old=c.ego_stress??0,max=this.call('constantMetagame','default_stress_max'),min=force?0:c.link_crash_on==true||c.collapse_on==true?max:0;
    const next=Math.min(Math.max(min,value),max),delta=next-old;if(delta>0)c.stress_up_value=(c.stress_up_value??0)+delta;c.ego_stress=fixed2(next);}
  // StressProc 0x2ee00 + recovery-only path through 0x31400. Increasing
  // stress/collapse construction is not substituted by this adapter.
  createBattleStressRecoverAction(id,amount){
    if(this.w.isPreview)return;const c=this.stage.chars.find(c=>c.id==id);if(c==null)return;
    const max=this.call('constantMetagame','default_stress_max');if((c.ego_stress??0)>=max)return;
    const range=this.e.db.array(this.e.db.get('constant_meta','break_stress_decrease').value).map(Number);
    let value=amount??this.e.random.randRange(0,range[0],range[1]+1);
    if(amount==null){for(const p of this.call('getPassiveByType',{source_id:this.b.char.id,type:'SKILL_EFF_STRESS_BY_BREAK_VALUE_ADD',is_card:false,char_id:c.id})){
      const r=this.e.db.table('skill_eff')[p.res_id];if(!r)continue;value=this.call('procMathSign',r.eff_value_math_sign,value,this.call('calcValue',p.skill_id));this.call('checkTermValuePassive',p.skill_id,c.id);}
      value=Math.max(value,0);if(value==0)return;}
    value=fixed2(value);const from=c.ego_stress??0;let to=fixed2(Math.max(from-value,0));
    if(c.collapse_on&&from>=max&&to<max)to=max;
    // addStressActionArray's prelude precedes checkStressBeforeAdd/write.
    if(this.b.char.status.info.S_CURRENT_HP==0&&this.b.battle_step_mode!=null)return;
    const action={id:this.b.last_action_id++,type:'action_stress_change',source_id:-1,char_stress_info_array:[]};
    this.setEgoStress(c,to);
    const item={from,to,stress_value:-value,char_res_id:c.res_id,is_collapse_on:undefined,prev_collapse_stress:undefined,battle_actions:undefined,hp_link_crash:undefined,is_link_crash_on:c.link_crash_on,add_collapse_card_battle:undefined,by_psychosis:undefined};
    action.char_stress_info_array.push(item);if(item.is_link_crash_on==true)action.type='action_stress_change_wait';
    this.e.pushAction(action);this.accumulateStressDpt(c.res_id,fixed2(to-from));this.call('procUnitEvent','CONDITION_CHAR_TAKE_STRESS',[c.id,-value]);
    const hp=this.call('getStatus',this.b.char.id,'S_HP');let oldMax=1;
    for(const block of this.b.action_blocks)for(const a of block.actions)if(a.type==='action_collapse_on')for(const list of a.action_list??[])for(const [,info]of list.action_units)oldMax=Math.max(oldMax,info.old_max_hp??1);
    if(oldMax>1&&hp==1)this.call('applyHPLinkCrash');
  }
  beginImmediatePassiveCSLogScope(){if(this.w.isPreview)return;if(this.w.immediatePassiveCSLogScopeDepth==0)this.w.deferredImmediatePassiveCSLogs=undefined;this.w.immediatePassiveCSLogScopeDepth++;}
  endImmediatePassiveCSLogScope(){if(this.w.isPreview||this.w.immediatePassiveCSLogScopeDepth<=0)return;if(--this.w.immediatePassiveCSLogScopeDepth==0)this.flushDeferredImmediatePassiveCSLogs();}
  flushDeferredImmediatePassiveCSLogs(){
    if(!this.w.deferredImmediatePassiveCSLogs?.length)return;const list=this.w.deferredImmediatePassiveCSLogs;this.w.deferredImmediatePassiveCSLogs=undefined;
    for(const {log,sub}of list){sub.logs.push(log);
      if(log.type===this.call('getDetailLogType','log_skill_eff_cs_set_add')&&[1,2,3,this.b.char.id].includes(log.params[0]))this.e.pushAction({id:this.b.last_action_id++,type:'action_battle_log',source_id:-1,action_battle_log:{type:this.call('getBattleLogType','cs_gain'),logs:[],params:[log.params[1],log.params[2]],major_first:true,only_noti:true}});}
  }
  calculateScoreScaling(...a){return this.score.calculateScoreScaling(...a);}
  applyDisasterScoreScaling(...a){return this.score.applyDisasterScoreScaling(...a);}
  applyRemnantsScoreScaling(...a){return this.score.applyRemnantsScoreScaling(...a);}
  addDisasterScore(...a){return this.score.addDisasterScore(...a);}
  addDisasterShieldScore(...a){return this.score.addDisasterShieldScore(...a);}
  addDisasterHealScore(...a){return this.score.addDisasterHealScore(...a);}
  addRemnantsScore(...a){return this.score.addRemnantsScore(...a);}
  addDisasterScoreBonus(...a){return this.score.addDisasterScoreBonus(...a);}
  addRemnantsScoreBonus(...a){return this.score.addRemnantsScoreBonus(...a);}
  applyDisasterPerCardScoreCap(...a){return this.score.applyDisasterPerCardScoreCap(...a);}
  applyRemnantsPerCardScoreCap(...a){return this.score.applyRemnantsPerCardScoreCap(...a);}
}
