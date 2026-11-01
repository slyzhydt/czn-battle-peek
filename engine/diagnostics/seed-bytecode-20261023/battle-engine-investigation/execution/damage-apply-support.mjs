// Shared hand ports from procDamageApply 0x1d500 @11981..14818 and
// @16399..19535. isPre suppresses HP/shield writes, but native field/preview
// bookkeeping and the ordered field callbacks remain observable.
import {floorGame,roundGame} from '../effects/effect-arithmetic.mjs';
export class DamageApplySupport {
  leech(a,caster,rawLoss,pct,shield,dpt,actions){
    const key=shield?'leech_shield':'leech_hp',stat=shield?'S_CURRENT_SHIELD':'S_CURRENT_HP',kind=shield?'shield':'heal';
    const old=caster.status.info[stat],max=caster.status.info.S_HP;let amount=floorGame(rawLoss*pct/100);
    if(!this.e.getMonster(a.caster_id)){
      let cap=roundGame(this.call('getCharOriginMaxHP')*this.e.db.number(this.e.db.get('constant_meta','dmg_attr_'+key+'_cap'),'value')/100);
      const skill=this.b.skillMap[a.skill_id];if(skill)cap=Math.max(0,cap-(skill[key]??0));amount=Math.min(cap,amount);if(skill)skill[key]=(skill[key]??0)+amount;
    }
    const next=Math.min(old+amount,shield?max*2:max),actual=next-old;
    const info=shield?{shield:actual,old_shield:old,new_shield:next,dmg_ref_index:a.index,new_hp:caster.status.info.S_CURRENT_HP,is_auto:true}:{heal:amount,old_hp:old,new_hp:next,max_hp:max,dmg_ref_index:a.index,is_auto:true};
    if(!shield&&a.attrArgs?.leech_hp_relic)info.from_relic=a.attrArgs.leech_hp_relic;actions.push([caster.id,info]);
    if(a.isPre)return;
    this.call('setStatus',caster.id,stat,next,{dpt});this.call('accumulateCardValue',a.caster_id,kind,amount);
    if(!shield){if(actual>0&&caster.id===this.b.char.id){const score=this.call('addDisasterHealScore',actual);if(score){info.disaster_score=score.heal_score;info.disaster_bonus_score=score.bonus;}}if(actual>0)this.event('CHAR_HEAL_CURE',[a.caster_id,a.card_id,actual]);}
    else if(!a.ignoreCond&&actual>0){this.event('CHAR_SHIELD',[a.caster_id,a.card_id,actual]);this.event('CHAR_GET_SHIELD',[a.caster_id,a.card_id,actual]);}
  }
  applyEgo(a,target,value,actions){
    const old=target.ego_field_value;target.ego_field_value=roundGame(Math.max(0,old-value)*12)/12;
    const info={damage:value,old_ego:old,new_ego:target.ego_field_value};actions.push([target.id,info]);this.event('MONSTER_EGO_FIELD_AMOUNT',[target.id,target.ego_field_value]);
    if(target.ego_field_value!==0)return;
    (this.w.egoBreaked??=[]).push(target.id);this.b.stress_recover=true;target.ego_breaked=true;
    if(this.w.triggeredList)(this.w.triggeredList.egoBreakSkillIdMap??={})[target.id]=a.skill_id;
    this.event('MONSTER_AMOUNT',[]);this.event('MONSTER_AMOUNT_SET',[]);
    if(this.b.current_card_use_action)(this.b.current_card_use_action.break_target_id_array??=[]).push(target.id);
    if(target.mon_turn>0){target.mon_turn++;this.e.pushAction({id:this.b.last_action_id++,type:'action_monster_turn_count',source_id:target.id,value:target.mon_turn});this.event('TURN_COUNT_INCREASE',[target.id,'break',a.caster_id,1,a.card_id>0?a.card_id:-1]);this.event('ALL_MONSTER_TURN_COUNT',[]);this.event('ANY_MONSTER_TURN_COUNT',[]);}
    const ban=this.query(this.b.char.id,'BATTLE_MONSTER_EGO_BREAK_BAN',{check_pct:false});
    if(!ban.length){this.call('addEnergy',1,false,0,{char_id:a.caster_id,ego_break:true});this.call('pushSubBattleLog',{type:'energy',logs:[],params:[1],major_first:true,is_fin:true},true);}
    const current=this.b.cardMap[this.b.current_card];
    if(!a.isPre){this.event('CHAR_EGO_BREAK',[current?.char_id??this.b.char.id,current?.id??-1,target.id]);this.event('MONSTER_EGO_BREAK',[target.id]);this.event('MONSTER_AMOUNT',[]);this.event('MONSTER_AMOUNT_SET',[]);}
    if(a.isPre===false&&this.w.isPreview==0&&!this.w.egoBreak){this.w.egoBreak=info;this.b.ego_break_flag=true;info.ego_type=target.ego_field_egos?.[0]??current?.curEgo??'NONE';}
    if(this.w.egoBreak&&!ban.length)this.w.egoBreak.delta_energy=(this.w.egoBreak.delta_energy??0)+1;
    if(a.isPre===false&&this.call('checkMissionApply'))this.call('missionDispatch','BATTLE_EGO_BREAK',{});
  }
}
