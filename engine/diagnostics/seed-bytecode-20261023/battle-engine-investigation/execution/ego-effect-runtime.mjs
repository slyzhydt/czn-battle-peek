// Handwritten active EGO field effects: procSkillEff @23640..23935,
// callbacks225/226 (0xfe000/0x100a00). Recovered JS is read only evidence.
import {roundGame} from '../effects/effect-arithmetic.mjs';
export const EGO_EFFECT_NAMES=new Set(['SKILL_EFF_EGO_FIELD_CHANGE','SKILL_EFF_EGO_FIELD_MAX_CHANGE']);
const fixed1=x=>Number((x+1e-8).toFixed(1));
export class EgoEffectRuntime {
 constructor(e){this.e=e;this.b=e.b;this.w=e.wt;this.db=e.db;}
 call(n,...a){return this.e.call(n,...a);}
 action(type,fields){this.e.pushAction({id:this.b.last_action_id++,type,...fields});}
 event(type,args=[]){this.call('procUnitEvent',type,args);}
 dispatch(id,c){const s=this.b.skillMap[id],r=this.db.get('skill_eff',s.res_id);let allLog;
  const isAll=r.target_unit_type==='TARGET_UNIT_ALL_ENEMY',isPct=this.db.array(r.eff_opt).includes('max_pct');
  for(const target of c.targets){const unit=this.call('getUnitByID',target,r.eff);if(unit.ego_field_max_value==null)continue;
   let value=this.call('calcValue',id,target);
   if(r.eff==='SKILL_EFF_EGO_FIELD_MAX_CHANGE'){
    if(value<0)value=0;const before=unit.ego_field_max_value;unit.ego_field_max_value=roundGame(this.call('procMathSign',r.eff_value_math_sign,before,value)*12)/12;
    if(unit.ego_field_max_value<0)unit.ego_field_max_value=0;if(before==unit.ego_field_max_value)continue;
    if(unit.ego_field_value!=null&&unit.ego_field_value>unit.ego_field_max_value){unit.ego_field_value=unit.ego_field_max_value;this.event('CONDITION_MONSTER_EGO_FIELD_AMOUNT',[unit.id,unit.ego_field_value]);}
    this.action('action_ego_field_max',{source_id:target,value:unit.ego_field_value??0,value_temp:unit.ego_field_max_value});continue;
   }
   if(unit.ego_field_value==null)continue;const before=unit.ego_field_value;
   if(isPct){value=(unit.ego_field_max_value??0)*value/100;unit.ego_field_value=roundGame((before+value)*12)/12;}
   else{if(value<0)value=unit.ego_field_max_value??0;unit.ego_field_value=roundGame(this.call('procMathSign',r.eff_value_math_sign,before,value)*12)/12;}
   if(unit.ego_field_value>unit.ego_field_max_value)unit.ego_field_value=unit.ego_field_max_value;if(unit.ego_field_value<0)unit.ego_field_value=0;if(before==unit.ego_field_value)continue;
   this.event('CONDITION_MONSTER_EGO_FIELD_AMOUNT',[unit.id,unit.ego_field_value]);let energy=0;
   if(before>0&&unit.ego_field_value==0){
    this.b.stress_recover=true;(this.w.egoBreaked??=[]).push(unit.id);unit.ego_breaked=true;
    if(this.w.triggeredList)(this.w.triggeredList.egoBreakSkillIdMap??={})[unit.id]=id;
    this.event('CONDITION_MONSTER_AMOUNT');this.event('CONDITION_MONSTER_AMOUNT_SET');
    if(this.b.current_card_use_action)(this.b.current_card_use_action.break_target_id_array??=[]).push(unit.id);
    if(unit.mon_turn&&unit.mon_turn>0){++unit.mon_turn;this.action('action_monster_turn_count',{source_id:unit.id,value:unit.mon_turn});
     this.event('CONDITION_TURN_COUNT_INCREASE',[unit.id,this.e.enums.CondUnitOptType.break_,s.action_char_id,1,this.call('getParentCard',id)?.id??-1]);
     this.event('CONDITION_ALL_MONSTER_TURN_COUNT');this.event('CONDITION_ANY_MONSTER_TURN_COUNT');
    }
    const bans=this.call('getPassiveByType',{source_id:this.b.char.id,type:'SKILL_EFF_BATTLE_MONSTER_EGO_BREAK_BAN',is_card:false,check_pct:false});
    if(!bans.length){this.call('addEnergy',1,false,0,{char_id:s.action_char_id,ego_break:true});energy=1;this.call('pushSubBattleLog',{type:this.call('getBattleLogType','energy'),logs:[],params:[1],major_first:true,is_fin:true},true);}
    const card=this.b.cardMap[this.b.current_card];this.event('CONDITION_CHAR_EGO_BREAK',[card?.char_id??this.b.char.id,card?.id??-1,unit.id]);this.event('CONDITION_MONSTER_EGO_BREAK',[unit.id]);this.event('CONDITION_MONSTER_AMOUNT');this.event('CONDITION_MONSTER_AMOUNT_SET');
    if(this.w.isPreview==0&&!this.w.egoBreak)this.b.ego_break_flag=true;if(this.call('checkMissionApply'))this.call('missionDispatch','BATTLE_EGO_BREAK',{});
   }else if(before==0&&unit.ego_field_value>0){unit.ego_breaked=false;this.event('CONDITION_MONSTER_AMOUNT');this.event('CONDITION_MONSTER_AMOUNT_SET');}
   this.action('action_ego_field',{source_id:target,value:unit.ego_field_value,value_temp:energy,msg:unit.ego_field_egos?.[0]??'NONE'});
   const delta=unit.ego_field_value-before,part=[target,Math.abs(fixed1(delta)),delta>0?'log_increase':'log_decrease'];
   if(isAll){if(!allLog){allLog={type:'log_skill_eff_ego_field_change',params:['log_all_enemy','',part[2],[part]],param_types:['text','value','text']};this.call('addDetailLog',allLog);}else{allLog.params[3].push(part);this.call('snapshotNameOverrides',allLog);}}
   else this.call('addDetailLog',{type:'log_skill_eff_ego_field_change',params:part,param_types:['unit_id','value','text']});
  }return {targets:c.targets};
 }
}
