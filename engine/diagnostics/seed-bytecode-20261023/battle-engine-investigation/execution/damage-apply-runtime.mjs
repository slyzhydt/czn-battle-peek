// Hand port of SkillEffectProc.procDamageApply 0x1d500. Source offsets below
// refer to evidence/damage-apply-preview/procDamageApply_0xf0000001d500.linear.js.
// Run only on an executor fork: an unknown later passive can reject the fork
// after earlier events have been queued, just as other handwritten runtimes do.
import {MissingBattleRule} from './resource-store.mjs';
import {DamageApplyPreviewRuntime} from './damage-apply-preview-runtime.mjs';
import {floorGame} from '../effects/effect-arithmetic.mjs';

import {DamageApplySupport} from './damage-apply-support.mjs';

export class DamageApplyRuntime extends DamageApplySupport {
  constructor(e){super();this.e=e;this.b=e.b;this.w=e.wt;this.db=e.db;this.preview=new DamageApplyPreviewRuntime(e);}
  call(n,...a){return this.e.call(n,...a);}
  event(n,p,v){return this.call('procUnitEvent','CONDITION_'+n,p,v);}
  query(source,type,extra={}){return this.e.passives.query({source_id:source,type:'SKILL_EFF_'+type,is_card:false,...extra});}
  detail(type,params){this.call('addDetailLog',{type:'log_skill_eff_'+type,params,param_types:params.map((_,i)=>i===0?'unit_id':'value')});}
  procDamageApply(a){
    if(a.isPre)return this.preview.procDamageApply(a);
    if(a.worktable!=null&&a.worktable!==this.w)throw new MissingBattleRule('procDamageApply.foreign_worktable');
    const target=a.target,caster=this.e.getUnit(a.caster_id),attrs=a.dmgAttr;
    if(!target?.status?.info||!Array.isArray(attrs))throw new MissingBattleRule('procDamageApply.active_input');
    const hp=target.status.info.S_CURRENT_HP,rawShield=target.status.info.S_CURRENT_SHIELD;
    if(![hp,rawShield,a.eff_value].every(Number.isFinite))throw new MissingBattleRule('procDamageApply.active_status');
    const has=x=>attrs.includes('DMG_ATTR_'+x),ignore=has('IGNORE_BLOCK');
    const monster=!!this.e.getMonster(target.id),casterMonster=!!this.e.getMonster(a.caster_id);
    let nonPsychosis=false;
    if(hp===0&&!monster){const stage=(this.w.battle_stage_worktable??this.e.state?.worktables?.BattleStageWorktable)?.battle_stage;if(!stage)throw new MissingBattleRule('BattleStageWorktable.battle_stage');nonPsychosis=stage.chars.find(c=>c.link_crash_on==true)!=null&&this.call('isDTMode')==false;}
    const card=this.b.cardMap[a.card_id],skill=this.b.skillMap[a.skill_id];
    const dpt=(!monster&&card?.by_monster)||casterMonster!==monster;
    const shield=this.call('getStatus',target.id,'S_CURRENT_SHIELD');
    const row=skill?this.db.get('skill_eff',skill.res_id):undefined;
    // Per-turn CS attack cap accounting happens before protection queries.
    if(skill?.parent.type==='CS'&&row&&[row.eff_value_type_1,row.eff_value_type_2].includes('VALUE_MAX_CASTER_ATK_PCT')){
      const cs=this.b.csMap[skill.parent.id];if(cs){if(!cs.atk_cap||cs.atk_cap.turn!==this.b.turn)cs.atk_cap={turn:this.b.turn,used:0};cs.atk_cap.used+=Math.max(0,a.eff_value);}
    }
    const blockedQuery=t=>ignore?[]:this.query(target.id,t);
    const fixed=blockedQuery('DAMAGE_FIX');let damage=a.eff_value;
    if(fixed.length){damage=Infinity;for(const p of fixed){damage=Math.min(damage,this.call('calcValue',p.skill_id,target.id));this.call('checkTermValuePassive',fixed[0].skill_id,caster.id);}}
    const unreducing=blockedQuery('UNREDUCING_HP'),deathBlock=blockedQuery('UNREDUCING_HP_WHEN_DEATH'),noLoss=blockedQuery('NO_LOSS_HP_LT');
    let threshold=-Infinity,highest;for(const p of noLoss){const v=this.call('calcValue',p.skill_id,target.id);if(v>threshold){threshold=v;highest=p;}}
    let nextShield,nextHp,brokeThrough=false,ego=a.egoFieldDmg;
    if(has('PENETRATE')){nextShield=shield;nextHp=hp-damage;}
    else if(shield>=damage){nextShield=shield-damage;nextHp=hp;}
    else{brokeThrough=shield>0;nextShield=0;nextHp=hp-damage+shield;}
    if(highest&&threshold>=hp)ego=0;
    if(!a.ignoreCond&&!a.fix&&caster.id!==target.id)target.previousAttackedby=a.char_id??caster.id;
    let noLog=false;
    if(nextHp!==hp){
      if(unreducing.length){nextHp=hp;noLog=true;this.detail('unreducing_hp',[target.id]);this.call('checkTermValuePassive',unreducing[0].skill_id,caster.id);}
      else if(highest){if(nextHp<threshold){nextHp=Math.min(hp,threshold);if(nextHp===hp)noLog=true;this.detail('no_loss_hp_lt',[target.id,threshold]);this.call('checkTermValuePassive',highest.skill_id,caster.id);}}
      else if(deathBlock.length&&nextHp<=0){nextHp=hp;noLog=true;this.call('checkTermValuePassive',deathBlock[0].skill_id,caster.id);}
    }
    // 3338..3885: division chooses the first passive and ignores unavailable
    // recipients. The forwarded amount is applied recursively after leech.
    const rawBeforeDivision=hp-nextHp;let divisionTarget,forwarded=0;
    if(!a.ignoreCond&&!a.fix&&rawBeforeDivision>0){const division=blockedQuery('CASTER_DAMAGE_DIVISION');if(division.length){divisionTarget=this.e.getUnit(division[0].caster_id);if(!['death','half_death','keep_half_death','run','changed'].includes(divisionTarget.state)){
      const retained=floorGame(rawBeforeDivision*(100-this.call('calcValue',division[0].skill_id))/100);forwarded=rawBeforeDivision-retained;if(forwarded>0)nextHp=hp-retained;
    }}}
    const multi=monster&&this.db.get('monster',target.res_id)?.grade==='GRADE_MULTI_HP';
    const limitless=target.is_limitless===true,killed=!limitless&&(hp>0&&nextHp<=0||nonPsychosis);
    const rawLoss=hp-nextHp;if(!limitless&&nextHp<0)nextHp=0;
    const loss=limitless?rawLoss:hp-nextHp;
    if(this.w.isPreview&&limitless&&rawLoss>0){const list=this.w.triggeredList;if(!list)throw new MissingBattleRule('procDamageApply.triggeredList');list.limitlessHpDiffMap??={};list.limitlessHpDiffMap[target.id]=(list.limitlessHpDiffMap[target.id]||0)+rawLoss;}
    const unexpected=(loss>0||nonPsychosis)&&!this.b.enemy_turn&&!monster&&casterMonster&&card&&!card.args?.isPassive&&!card.args?.isStart?true:undefined;
    const info={damage:forwarded>0?damage-forwarded:damage,type:attrs,old_hp:hp,new_hp:nextHp,max_hp:this.call('getStatus',target.id,'S_HP'),is_auto:has('AUTO'),system_eff:a.system_eff==='none'?undefined:a.system_eff,break:false,crit:a.isCrit??false,dva_css:a.dva_css?.slice(),weak:a.weakEgoAttack,unexpected_attack:unexpected,non_psychosis_mode_end:nonPsychosis,target_char:a.target_char_id};
    if(rawShield>0)Object.assign(info,{old_shield:rawShield,new_shield:nextShield});
    if(noLog)info.no_log=true;if(a.dmg_additional)info.dmg_additional=true;if(a.ref)info.dmg_ref_index=a.index;
    const actions=[[target.id,info]];let deadEvent=killed?info:undefined;
    if(!limitless&&hp===0){const previous=this.b.deads.find(d=>d.source_id===target.id);if(previous){if(previous.deadEvent)previous.deadEvent.not_killed=true;previous.deadEvent=info;}}
    const shieldLoss=shield-nextShield,shieldDestroyed=shield>0&&nextShield===0;
    if(this.w.isPreview&&!a.ignoreCond&&(hp>0||nonPsychosis)&&a.card_id>0)this.call('recordShieldDestruction',this.w.triggeredList,target.id,shield,nextShield);
    // @6006/@6206 preserve the requested actor ID; getUnit may return the shared team unit.
    const given=[a.caster_id,a.card_id,loss,target.id,damage,attrs],taken=[target.id,a.card_id,loss,damage,a.caster_id,shieldLoss,attrs];
    let passiveAction;
    // 6257..8800: event dispatch precedes actual HP/shield writes. Do not
    // relocate these below setStatus even if final HP alone would look right.
    if(killed&&!multi&&a.card_id>0)this.call('countCardUseKill',a.card_id);
    if(!a.ref&&!a.dmg_additional)this.event('CHAR_ATK_AUTO',given);
    if(caster.id!==target.id){
      if(loss>0||nonPsychosis){caster.previousDamageto=target.id;caster.previousDamagetoAll??=[];if(!caster.previousDamagetoAll.includes(target.id))caster.previousDamagetoAll.push(target.id);}
      caster.previousAttackto=target.id;caster.previousAttacktoAll??=[];if(!caster.previousAttacktoAll.includes(target.id))caster.previousAttacktoAll.push(target.id);
    }
    if(!a.ignoreCond){
      if(a.isCrit)this.event('CRITICAL',given);
      if(hp>0||nonPsychosis){
      if(nextHp>0)for(const p of this.query(target.id,'FIX_SHIELD_ATTACKED')){
        const amount=floorGame(this.call('calcValue',p.skill_id));nextShield+=amount;nextShield=this.call('setStatus',target.id,'S_CURRENT_SHIELD',nextShield,{dpt});
        this.call('accumulateCardValue',target.id,'shield',amount);passiveAction=[target.id,{shield:amount,old_shield:shield,new_shield:nextShield,new_hp:nextHp,is_auto:true}];
        this.call('checkTermValuePassive',p.skill_id,caster.id);
      }
      this.event('CHAR_ATK',given);this.event('CHAR_HIT',taken);if(!a.fix)this.event('CHAR_HIT_EXCEPT_FIX',taken);this.event('CHAR_HIT_NOT_MISS',taken);
      if(shieldLoss>0)this.event('CHAR_HIT_SHIELD',taken);
      if(shieldDestroyed)this.event('SHIELD_DESTROY',[a.caster_id,a.card_id,1,target.id,damage,attrs]);
      this.call('checkTermValue',target.id,'TERM_ATTACKED',caster.id);
      if(loss>0){this.event('CHAR_DMG',given.concat([a.skill_id]));this.event('CHAR_DMG_ACCRUE',given);if(brokeThrough)this.event('CHAR_DMG_BREAK_SHIELD',given);this.event('CHAR_TAKE_DMG',taken,loss);this.call('checkTermValue',target.id,'TERM_TAKE_DAMAGE',caster.id);}
      else{this.event('CHAR_NO_DMG',taken);this.event('CHAR_GIVE_NO_DMG',given);}
      }
    }
    if(loss>0){this.event('CHAR_IGNORE_COND_DMG',given.concat([a.skill_id]));if(!a.fix)this.event('CHAR_IGNORE_COND_TAKE_DMG',taken,loss);}
    if(monster&&hp>0)this.call('collectMonsterHitSlot',target.slot_idx);
    if(has('DOT_ATTACK'))this.event('DMG_ATTR_DOT',taken);
    if(damage>0)this.event('CHAR_IGNORE_COND_DMG_VALUE',[a.caster_id,a.card_id,damage,target.id,damage,attrs,a.skill_id]);
    const stage=(this.w.battle_stage_worktable??this.e.state?.worktables?.BattleStageWorktable)?.battle_stage;
    if(!stage)throw new MissingBattleRule('BattleStageWorktable.battle_stage');
    if(loss>0&&target.id===this.b.char.id){stage.total_damaged_amount+=loss;if(caster.id!==this.b.char.id){this.b.damaged+=loss;this.b.damage_count++;}}
    if(loss>0&&!monster){const ratio=a.monster_dmg_ratio!=null&&a.monster_dmg_ratio>=0?a.monster_dmg_ratio:dpt?1:0;if(ratio>0)this.b.dpt.damage_taken_by_monster+=loss*ratio;}
    if(rawShield>0&&target.id===this.b.char.id){const delta=rawShield-nextShield;if(delta>0){const score=this.call('addDisasterShieldScore',delta,rawShield>=damage&&nextHp===hp);if(score&&info.old_shield!==undefined){info.disaster_score=score.shield_score;info.disaster_bonus_score=score.bonus;}}}
    if(loss>0&&target.id!==this.b.char.id&&target.summoner==null){
      const parent=a.card_id>0&&this.call('getParentCard',a.skill_id)?.id===a.card_id;
      const score=this.call('addDisasterScore',parent?this.call('applyDisasterPerCardScoreCap',a.card_id,loss):loss,target.res_id);
      if(score){info.disaster_score=score.damage_score;info.disaster_bonus_score=score.bonus;}
      const rem=this.call('addRemnantsScore',parent?this.call('applyRemnantsPerCardScoreCap',a.card_id,loss):loss);if(rem!=null)info.remnants_score=rem;
    }
    if(stage.disaster_boss_penalty_info&&monster&&target.summoner==null)stage.disaster_boss_penalty_info.boss_hp_percent=Math.floor(nextHp/info.max_hp*100);
    if(dpt)this.b.dpt.last_caster_id=a.caster_id;
    this.call('setStatus',target.id,'S_CURRENT_SHIELD',nextShield,{dpt});this.call('setStatus',target.id,'S_CURRENT_HP',nextHp,{dpt});
    if(dpt)this.b.dpt.last_caster_id=undefined;
    this.call('accumulateCardValue',target.id,'damage',damage);
    if(killed&&!multi){const half=this.query(target.id,'HALF_DEAD_ABLE');this.event('CHAR_KILL',given.concat([half.length,target.summoner??-1]));this.event('CHAR_OVERKILL',given);}
    const casterDead=!casterMonster&&caster.status.info.S_CURRENT_HP===0;
    // 11154..11981: all three queries happen even if there is no HP loss.
    if(!casterDead){
      const give=this.query(a.caster_id,'CURE_HIT_PASSIVE_IGNORE_COND',{char_id:a.caster_id}).filter(p=>!p.eff_opts?.includes('take'));
      const take=this.query(target.id,'CURE_HIT_PASSIVE_IGNORE_COND',{caster_id:a.caster_id}).filter(p=>p.eff_opts?.includes('take'));
      const byCard=this.query(a.card_id,'CURE_HIT_PASSIVE_IGNORE_COND',{is_card:true}).filter(p=>!p.eff_opts?.includes('take'));
      const parent=this.b.cardMap[a.parent_card_id??a.card_id],parentRow=parent?this.db.get('card',parent.res_id):undefined;
      for(const p of [...give,...take,...byCard]){
        const pr=this.db.get('skill_eff',p.res_id),categories=this.db.array(pr.target_card_set_card_type);
        if(categories.length&&(!parent||!parentRow||parentRow.sort==='SORT_COLLAPSE_SKILL'||!this.call('checkCategory',parent.id,categories)))continue;
        const healed=this.call('procHealCalculate',a.caster_id,[a.caster_id],p.skill_id,0,false,true,true,true);
        for(const action of healed.action_list)actions.push(...action.action_units);
        this.call('checkTermValuePassive',p.skill_id,a.caster_id);
      }
    }
    const hpPct=(has('LEECH_HP')?Number(a.opt?.[0]??100):0)+(has('LEECH_HP_PCT')?(a.attrArgs?.leech_hp??0):0);
    const shieldPct=(has('LEECH_SHIELD')?Number(a.opt?.[0]??100):0)+(has('LEECH_SHIELD_PCT')?(a.attrArgs?.leech_shield??0):0);
    if(rawLoss>0&&!casterDead){if(hpPct>0)this.leech(a,caster,rawLoss,hpPct,false,dpt,actions);if(shieldPct>0)this.leech(a,caster,rawLoss,shieldPct,true,dpt,actions);}
    if(passiveAction)actions.push(passiveAction);
    let totalLoss=rawLoss;
    const additionalActions=[];
    for(const value of a.dmgAdditionals??[]){
      const result=this.procDamageApply({worktable:this.w,caster_id:a.caster_id,target,eff_value:value,card_id:a.card_id,isPre:a.isPre,ignoreCond:true,index:a.index,opt:a.opt,fix:true,dmgAttr:['DMG_ATTR_FIX','DMG_ATTR_AUTO'],char_id:a.char_id,target_char_id:a.target_char_id,skill_id:a.skill_id,dmg_additional:true});
      totalLoss+=result.damage_amount;if(result.deadEvent)this.enqueueDead(a,target,result,row);
      additionalActions.push(...result.ret_actions);
    }
    if(deadEvent&&monster)for(const [id,event]of additionalActions)if(id===target.id&&event.dmg_additional===true&&event.old_hp===0&&event.new_hp===0){deadEvent.not_killed=true;deadEvent=event;}
    actions.push(...additionalActions);
    if(forwarded>0&&divisionTarget!=null){
      const forwardedAttrs=attrs.slice();if(!forwardedAttrs.includes('DMG_ATTR_AUTO'))forwardedAttrs.push('DMG_ATTR_AUTO');
      const result=this.procDamageApply({worktable:this.w,caster_id:a.caster_id,target:divisionTarget,eff_value:forwarded,card_id:a.card_id,skill_id:a.skill_id,isPre:a.isPre,ignoreCond:true,dmgAttr:forwardedAttrs,attrArgs:a.attrArgs,index:a.index,ref:true,opt:a.opt,fix:a.fix,weakEgoAttack:a.weakEgoAttack,char_id:a.char_id,target_char_id:a.target_char_id});
      if(result.deadEvent)this.enqueueDead(a,divisionTarget,result,row);
      actions.push(...result.ret_actions);totalLoss+=result.damage_amount;
    }
    if(ego&&unreducing.length===0&&fixed.length===0&&!this.w.egoBreaked?.includes(target.id)&&target.ego_field_value>0)this.applyEgo(a,target,ego,actions);
    this.call('procUniqueChizuruDamage',{card_id:a.card_id,target,is_last_attack:a.is_last_attack,ref:a.ref,dmg_additional:a.dmg_additional});
    // The original victim is enqueued by procDamageCalculate, not here.
    return {deadEvent,ret_actions:actions,prevHP:hp,damage_amount:totalLoss};
  }
  enqueueDead(a,target,result,row){this.b.deads.push({source_id:target.id,by:a.card_id>0?'card':'',killer:this.e.getUnit(a.caster_id).id,prevHP:result.prevHP,deadEvent:result.deadEvent,card_id:a.card_id>0?a.card_id:undefined,trigger_cause_card_id:this.call('getTriggerCauseCardId',this.b.skillMap[a.skill_id]),all_attack:row?.target_unit_type==='TARGET_UNIT_ALL_ENEMY'});}
}
