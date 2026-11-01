// Hand port of procDamageApply 0x1d500's isPre=true path. Evidence:
// evidence/damage-apply-preview/procDamageApply_0xf0000001d500.linear.js.
// This calculates notices; active HP/shield writes still require the live-rule
// hand port. Unsupported special branches fail before returning a prediction.
import {MissingBattleRule} from './resource-store.mjs';
import {DamageApplySupport} from './damage-apply-support.mjs';
export class DamageApplyPreviewRuntime extends DamageApplySupport {
  constructor(e){super();this.e=e;this.b=e.b;this.w=e.wt;}
  call(n,...a){return this.e.call(n,...a);}
  event(n,p,v){return this.call('procUnitEvent','CONDITION_'+n,p,v);}
  query(source,type,extra={}){return this.e.passives.query({source_id:source,type:'SKILL_EFF_'+type,is_card:false,...extra});}
  procDamageApply(a){
    if(!a.isPre)throw new MissingBattleRule('procDamageApply.active');
    if(a.worktable!=null&&a.worktable!==this.w)throw new MissingBattleRule('procDamageApply.foreign_worktable');
    const target=a.target,caster=this.e.getUnit(a.caster_id),attrs=a.dmgAttr;
    if(!target?.status?.info||!Array.isArray(attrs))throw new MissingBattleRule('procDamageApply.preview_input');
    const hp=target.status.info.S_CURRENT_HP,rawShield=target.status.info.S_CURRENT_SHIELD;
    if(!Number.isFinite(hp)||!Number.isFinite(rawShield)||!Number.isFinite(a.eff_value))throw new MissingBattleRule('procDamageApply.preview_status');
    const has=x=>attrs.includes('DMG_ATTR_'+x),ignore=has('IGNORE_BLOCK');
    const query=type=>ignore?[]:this.e.passives.query({source_id:target.id,type:'SKILL_EFF_'+type,is_card:false});
    // The native pre path still queries these passives in this order. In
    // particular, the query's probability handling must not be skipped.
    const fixed=query('DAMAGE_FIX');let damage=a.eff_value;
    if(fixed.length){damage=Infinity;for(const p of fixed){damage=Math.min(damage,this.call('calcValue',p.skill_id,target.id));this.call('checkTermValuePassive',fixed[0].skill_id,caster.id);}}
    const unreducing=query('UNREDUCING_HP');query('UNREDUCING_HP_WHEN_DEATH');
    const noLoss=query('NO_LOSS_HP_LT');let max=-Infinity,highest;
    for(const p of noLoss){const value=this.call('calcValue',p.skill_id,target.id);if(value>max){max=value;highest=p;}}
    const shield=this.call('getStatus',target.id,'S_CURRENT_SHIELD');let nextHp,nextShield;
    if(has('PENETRATE')){nextShield=shield;nextHp=hp-damage;}
    else if(shield>=damage){nextShield=shield-damage;nextHp=hp;}
    else{nextShield=0;nextHp=hp-damage+shield;}
    const rawLoss=hp-nextHp,limitless=target.is_limitless===true;
    if(!limitless&&nextHp<0)nextHp=0;
    if(this.w.isPreview&&limitless&&rawLoss>0){const list=this.w.triggeredList;if(!list)throw new MissingBattleRule('procDamageApply.triggeredList');list.limitlessHpDiffMap??={};list.limitlessHpDiffMap[target.id]=(list.limitlessHpDiffMap[target.id]||0)+rawLoss;}
    let nonPsychosis=false;if(hp===0&&!this.e.getMonster(target.id)){
      const stage=(this.w.battle_stage_worktable??this.e.state?.worktables?.BattleStageWorktable)?.battle_stage;
      if(!stage)throw new MissingBattleRule('BattleStageWorktable.battle_stage');nonPsychosis=stage.chars.find(c=>c.link_crash_on==true)!=null&&this.call('isDTMode')==false;
    }
    let unexpected;
    const card=this.b.cardMap[a.card_id],casterMonster=!!this.e.getMonster(a.caster_id),targetMonster=!!this.e.getMonster(target.id);
    if(((hp-nextHp)>0||nonPsychosis)&&!this.b.enemy_turn&&!targetMonster&&casterMonster&&card&&!card.args?.isPassive&&!card.args?.isStart)unexpected=true;
    const info={damage,type:attrs,old_hp:hp,new_hp:nextHp,max_hp:this.call('getStatus',target.id,'S_HP'),is_auto:has('AUTO'),
      system_eff:a.system_eff==='none'?undefined:a.system_eff,break:false,crit:a.isCrit??false,dva_css:a.dva_css?.slice(),weak:a.weakEgoAttack,
      unexpected_attack:unexpected,non_psychosis_mode_end:nonPsychosis,target_char:a.target_char_id};
    if(rawShield>0)Object.assign(info,{old_shield:rawShield,new_shield:nextShield});
    if(a.dmg_additional)info.dmg_additional=true;if(a.ref)info.dmg_ref_index=a.index;
    if(this.w.isPreview&&!a.ignoreCond&&(hp>0||nonPsychosis)&&a.card_id>0)this.call('recordShieldDestruction',this.w.triggeredList,target.id,shield,nextShield);
    const casterDead=!casterMonster&&caster.status.info.S_CURRENT_HP==0;
    const leechHp=(has('LEECH_HP')?Number(a.opt?.[0]??100):0)+(has('LEECH_HP_PCT')?(a.attrArgs?.leech_hp??0):0);
    const leechShield=(has('LEECH_SHIELD')?Number(a.opt?.[0]??100):0)+(has('LEECH_SHIELD_PCT')?(a.attrArgs?.leech_shield??0):0);
    const actions=[[target.id,info]];if(rawLoss>0&&!casterDead){if(leechHp>0)this.leech(a,caster,rawLoss,leechHp,false,false,actions);if(leechShield>0)this.leech(a,caster,rawLoss,leechShield,true,false,actions);}
    let total=rawLoss;for(const value of a.dmgAdditionals??[]){const result=this.procDamageApply({worktable:this.w,caster_id:a.caster_id,target,eff_value:value,card_id:a.card_id,isPre:true,ignoreCond:true,index:a.index,opt:a.opt,fix:true,dmgAttr:['DMG_ATTR_FIX','DMG_ATTR_AUTO'],char_id:a.char_id,target_char_id:a.target_char_id,skill_id:a.skill_id,dmg_additional:true});total+=result.damage_amount;actions.push(...result.ret_actions);}
    const ego=highest&&max>=hp?0:a.egoFieldDmg;
    if(ego&&unreducing.length===0&&fixed.length===0&&!this.w.egoBreaked?.includes(target.id)&&target.ego_field_value>0)this.applyEgo(a,target,ego,actions);
    this.call('procUniqueChizuruDamage',{card_id:a.card_id,target,is_last_attack:a.is_last_attack,ref:a.ref,dmg_additional:a.dmg_additional});
    return {deadEvent:undefined,ret_actions:actions,prevHP:hp,damage_amount:total};
  }
}
