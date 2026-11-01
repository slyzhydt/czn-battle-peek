// Handwritten procSkillEff @68860..75744 and callbacks389..397.
// Retains native ordering and its raw stress_value versus clamped 'to' fields.
import {roundGame,floorGame} from '../effects/effect-arithmetic.mjs';
import {MissingBattleRule} from './resource-store.mjs';
const fixed2=x=>Number((x+1e-8).toFixed(2));
export const STRESS_EFFECT_NAMES=new Set(['STRESS_COLLAPSE_RECOVER','STRESS_ADD_NONE_COLLAPSE','STRESS_ADD_IGNORE_COND','STRESS_ADD','TUTORIAL_STRESS_ADD','FORCE_STRESS_SET'].map(x=>'SKILL_EFF_'+x));
export class StressEffectRuntime {
 constructor(e){this.e=e;this.b=e.b;this.w=e.wt;this.db=e.db;}
 call(n,...a){return this.e.call(n,...a);}
 get stage(){return this.e.state.worktables.BattleStageWorktable?.battle_stage;}
 get init(){return this.e.state.worktables.BattleInitWorktable.battle_init;}
 action(type,fields){this.e.pushAction({id:this.b.last_action_id++,type,...fields});}
 log(char,value){this.call('addDetailLog',{type:'log_skill_eff_stress_add',params:[char.id,value],param_types:['unit_id','delta']});}
 objectEvent(id){const kind=this.e.enums.CondUnitTargetType?.stress;if(kind===undefined)throw new MissingBattleRule('nativeEnum.CondUnitTargetType.stress');this.call('procUnitEvent','CONDITION_CHAR_OBJECT_COMPARE',[id,kind]);}
 extraLink(infos,id,char){if(id==null||id==char.id)return;const other=this.stage.chars.find(c=>c.id==id);if(other&&other.res_id>0)infos.push({char_res_id:other.res_id,from:other.ego_stress,to:other.ego_stress,stress_value:0,is_collapse_on:undefined,is_link_crash_on:true});}
 tutorial(infos){const turn=this.call('tutorialConstantValueNum','const_stress_battle_turn');if(this.init.battle_res_id==this.call('tutorialConstantId','const_stress_battle_id')&&turn&&this.b.turn==turn&&infos.length)this.action('action_tutorial',{source_id:-1,msg:this.call('tutorialConstantId','const_stress_tutorial_id')});}
 dispatch(id,c){const s=this.b.skillMap[id],r=this.db.get('skill_eff',s.res_id),infos=[];
  if(r.eff==='SKILL_EFF_STRESS_COLLAPSE_RECOVER'){
   for(const target of c.targets){const char=this.stage.chars.find(x=>x.id==target);if(!char||char.res_id<0)continue;const old=char.ego_stress??0;if(old==0)continue;
    this.call('setEgoStress',char,0,true);this.log(char,roundGame(-old));if(char.collapse_on){this.call('pushSubBattleLog',{type:this.call('getBattleLogType','collapse_recover'),logs:[],params:[char.res_id]});this.call('setSubFinished');}
    this.call('setCollapseOff',char);infos.push({char_res_id:char.res_id,from:old,to:char.ego_stress??0,stress_value:fixed2(-0),is_collapse_on:false});
   }
   this.call('addStressActionArray',infos,{for_each_delegate:target=>{this.call('procUnitEvent','CONDITION_CHAR_COLLAPSE',[target,'recover']);this.objectEvent(target);}});return {targets:c.targets};
  }
  if(r.eff==='SKILL_EFF_FORCE_STRESS_SET'){
   for(const target of c.targets){if(!this.stage)continue;const value=fixed2(this.call('calcValue',id,target)),char=this.stage.chars.find(x=>x.id==target);if(!char||char.res_id<0)continue;
    const old=char.ego_stress??0;this.call('setEgoStress',char,value,true);const oldCollapse=char.collapse_on,add=this.call('checkCollapse',{char,prev:old,next:char.ego_stress}),nextCollapse=char.collapse_on;
    const link=this.b.player_turn===true?this.call('checkLinkCrash',{except_hp_link_crash:true}):undefined,max=this.call('getMaxStress');
    this.log(char,char.ego_stress==max||char.ego_stress==0?roundGame(value):floorGame(char.ego_stress??0)-floorGame(old));
    infos.push({char_res_id:char.res_id,from:old,to:char.ego_stress??0,stress_value:value,is_collapse_on:oldCollapse==nextCollapse?undefined:nextCollapse,add_collapse_card_battle:add});this.extraLink(infos,link,char);
   }
   this.call('addStressActionArray',infos,{force:true,for_each_delegate:target=>this.objectEvent(target)});this.tutorial(infos);return {targets:c.targets};
  }
  if(this.stage.cheat_info.battle_stress_off==true)return {targets:c.targets};
  const fix=s.eff_opts?.includes('fix'),bans=this.call('getPassiveByType',{source_id:this.b.char.id,type:'SKILL_EFF_STRESS_EARN_BAN_UNDER_N',is_card:false}),changes=this.call('getPassiveByType',{source_id:this.b.char.id,type:'SKILL_EFF_EARN_STRESS_VALUE_CHANGE',is_card:false});
  for(const target of c.targets){if(!this.stage)continue;let value=this.call('calcValue',id,target);if(value==0)continue;const char=this.stage.chars.find(x=>x.id==target);if(!char||char.res_id<0)continue;const max=this.call('getMaxStress');if(char.ego_stress==max)continue;
   if(char.ego_stress==null)this.call('setEgoStress',char,0,true);const old=char.ego_stress??0,requested=this.call('procMathSign',r.eff_value_math_sign,old,value);let diff=requested-old;if(diff>0&&diff<1)diff=1;const gain=diff>0;
   if(!fix&&gain){this.db.get('battle',this.init.battle_res_id);
    for(const passive of changes){const row=this.db.table('skill_eff')[passive.res_id];if(row)value=this.call('procMathSign',row.eff_value_math_sign,value,this.call('calcValue',passive.skill_id));}
    let blocked=false;for(const passive of bans){const threshold=this.call('calcValue',passive.skill_id);if(passive.eff_opts?.length||threshold<value)continue;blocked=true;this.call('addDetailLog',{type:'log_skill_eff_stress_earn_ban_under_n',params:[char.id,threshold],param_types:['unit_id','value']});
     const ego=this.b.egoActionMap[passive.skill_id];if(ego){this.action('action_ego_active',{source_id:ego.char_id,ego_skill_res_id:ego.ego_skill_res_id});if(this.w.isPreview)this.w.triggeredList.ego.push([ego.ego_skill_res_id,ego.char_id]);}break;
    }if(blocked)continue;diff=this.call('calcIncreaseStress',value,char,{battle_worktable:this.w,skip_assault_area_stress_reduction:true});
   }
   let next=old+diff;if(r.eff==='SKILL_EFF_STRESS_ADD_NONE_COLLAPSE')next=Math.min(next,this.call('getMaxStress')-.01);this.call('setEgoStress',char,next,true);
   const tutorials=[1,2,3,4,5,6,7,8].map(n=>this.call('tutorialConstantId','const_main_battle_00'+n)),limits=this.call('getCustomStressVal','CUSTOM_STRESS_LIMIT');
   if(limits?.length){const values=limits.reduce((out,x)=>(out[x.source1_multiple_link.toString()]=x.custom_val,out),{});if(char.res_id.toString() in values){const limited=Math.max(Math.min(Number(values[char.res_id.toString()]),next),0),before=char.collapse_on,add=this.call('checkCollapse',{char,prev:old,next:limited}),after=char.collapse_on;infos.push({char_res_id:char.res_id,from:old,to:limited,stress_value:diff,is_collapse_on:before==after?undefined:after,add_collapse_card_battle:add});}
    else this.call('pushLog','err:simulate_battle_custom_source1_multiple_link_none:'+char.res_id);continue;
   }
   if(tutorials.includes(this.init.battle_res_id)&&gain&&(char.ego_stress??0)>=max){char.ego_stress=max-1;diff=char.ego_stress-old;}
   const before=char.collapse_on,add=this.call('checkCollapse',{char,prev:old,next:char.ego_stress}),after=char.collapse_on,link=this.b.player_turn===true?this.call('checkLinkCrash',{except_hp_link_crash:true}):undefined;
   this.log(char,char.ego_stress==max||char.ego_stress==0?roundGame(diff):floorGame(char.ego_stress??0)-floorGame(old));
   infos.push({char_res_id:char.res_id,from:old,to:char.ego_stress??0,stress_value:diff,is_collapse_on:before==after?undefined:after,add_collapse_card_battle:add});this.extraLink(infos,link,char);
  }
  this.call('addStressActionArray',infos,{for_each_delegate:target=>this.objectEvent(target),is_psychosis_effect:r.eff==='SKILL_EFF_STRESS_ADD_NONE_COLLAPSE',skip_take_stress_cond:r.eff==='SKILL_EFF_STRESS_ADD_IGNORE_COND'});this.tutorial(infos);
  if(r.eff==='SKILL_EFF_TUTORIAL_STRESS_ADD'&&infos.length){const msg=s.eff_opt_multiple_link?.[0];if(msg==null)throw new MissingBattleRule('stressEffect.tutorial_link_missing',{id});this.action('action_tutorial_stress_add',{source_id:-1,msg});++this.b.action_tutorial;}
  return {targets:c.targets};
 }
}
