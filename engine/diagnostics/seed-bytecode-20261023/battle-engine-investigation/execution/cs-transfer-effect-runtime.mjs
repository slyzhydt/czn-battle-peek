// Hand ports of procSkillEff CS display/set/random/transfer/remove/copy families.
// Source: evidence/active-effects/structured callbacks232..292 and corresponding
// linear callbacks. This module never runs recovered source.
import {MissingBattleRule} from './resource-store.mjs';
import {floorGame} from '../effects/effect-arithmetic.mjs';
export const CS_TRANSFER_EFFECT_NAMES=new Set(['CS_SHOW_SET_IGNORE_COND','CS_SHOW_SET','CS_SET','CS_SET_ADD_RANDOM_IGNORE_COND','CS_SET_ADD_RANDOM','TRANSITION_CS_TO','TRANSITION_SELECTED_CS_TO','BUFF_TYPE_CS_SET_ADD','HAVE_CS_SET_ADD','REMOVE_CS','COPY_CS'].map(n=>'SKILL_EFF_'+n));
export const CS_TRANSFER_EFFECT_BINDINGS={'dispatchCSTransferEffect':'dispatch'};
export class CSTransferEffectRuntime {
 constructor(e){this.e=e;this.b=e.b;this.w=e.wt;this.db=e.db;}
 call(n,...a){return this.e.call(n,...a);}
 action(type){this.e.pushAction({id:this.b.last_action_id++,type,source_id:-1});}
 group(enabled,fn){if(enabled)this.action('action_group_start');fn();if(enabled)this.action('action_group_end');}
 // Each selected type visits the source list independently and preserves order.
 // Mixed positive/negative CS are classified by their signed term value.
 classify(ids,opts,collapse=false){const result=[];
  for(const type of ['CS_BUFF','CS_DEBUFF','CS_NEUTRAL',...(collapse?['CS_COLLAPSE']:[])])if(opts.includes(type))for(const id of ids){const cs=this.b.csMap[id];if(!cs)continue;const buff=this.db.get('cs',cs.res_id).cs_buff_type;
   if(type==='CS_BUFF'&&(buff==='CS_BUFF'||buff==='CS_BUFF_DEBUFF'&&cs.term_value>0)||type==='CS_DEBUFF'&&(this.call('baseDebuffType',buff)||buff==='CS_BUFF_DEBUFF'&&cs.term_value<0)||type==='CS_NEUTRAL'&&buff==='CS_NEUTRAL'||type==='CS_COLLAPSE'&&buff==='CS_COLLAPSE')result.push(id);
  }return result;
 }
 select(ids,opts,count){if(opts.includes('last'))return ids.slice(-1);if(opts.includes('random'))return !this.w.isPreview||ids.length==count?this.call('randomArrayMembers',0,ids,count):[];return ids;}
 dispatch(id,c){const s=this.b.skillMap[id],r=this.db.get('skill_eff',s.res_id),opts=s.eff_opts??[],targets=c.targets,isCard=r.target_unit_type==='TARGET_UNIT_NONE',links=s.link_cs_ids??[];let value;
  const calc=target=>value=this.call('calcValue',id,target),add=(target,res,n,card,sign,force,extra,caster=c.source_id,owner=s.action_char_id)=>this.call('procAddCS',target,res,n,caster,card,sign,false,force,owner,s.skill_id,...(extra?[extra]:[]));
  if(!CS_TRANSFER_EFFECT_NAMES.has(r.eff))throw new MissingBattleRule('csTransferEffect.dispatch',{eff:r.eff});
  if(r.eff.startsWith('SKILL_EFF_CS_SHOW_SET')){
   const res=links[0];if(res==null)throw new MissingBattleRule('csTransferEffect.cs_res_id_not_found',{res:s.res_id});const row=this.db.get('cs',res);
   for(const target of targets){const unit=this.call('getUnitByID',target);let ids=unit.continueSkill;
    if(!this.e.getMonster(target)&&['OWN_CHAR','OWN_CHAR_EFF_TEAM'].includes(row.own_type)){let owner=s.action_char_id;if(![1,2,3,7].includes(owner))owner=unit.id;ids=unit.continueSkillChar?.[owner]??[];}
    else if(row.own_type==='OWN_CASTER')ids=unit.continueSkillCaster?.[s.caster_id]??[];
    let shown=0;for(const csid of ids){const cs=this.b.csMap[csid];if((cs.show_cs_res_id??cs.res_id)==(row.show_link_cs_id==='none'?res:row.show_link_cs_id))shown+=cs.term_value;}
    if(row.overlay_rule==='OVERLAY_CS_EACH')shown=0;calc(target);if(value>shown)add(target,res,value-shown,false,'MATHSIGN_ADD',true,{ignoreCond:r.eff==='SKILL_EFF_CS_SHOW_SET_IGNORE_COND'});
   }
  }else if(r.eff==='SKILL_EFF_CS_SET'||r.eff.startsWith('SKILL_EFF_CS_SET_ADD_RANDOM')){
   let selected=targets;if(isCard){let n=this.call('calcEffCardTargetCount',id);if(n<0)n=targets.length;selected=targets.slice(0,n);}
   const random=r.eff!=='SKILL_EFF_CS_SET',grouped=!isCard&&(random?targets.length>1:targets.length>1||targets.some(t=>this.call('calcCountValue',id,t)+(c.count_value_additional??0)>1));
   this.group(grouped,()=>{for(const target of selected){const count=this.call('calcCountValue',id,target)+(c.count_value_additional??0);calc(target);let tar=target;
    for(let i=0;i<count;i++){
     if(r.target_unit_type==='TARGET_UNIT_ALL_RAN_ENEMY'&&i>0){const ids=this.call('getTargetableMonstersID',{skill_id:id});if(ids.length)tar=this.e.random.randomArrayMember(0,ids);}
     if(this.w.isPreview&&links.length!==1)continue;
     if(!random){for(const res of links)add(tar,res,value,isCard,isCard?r.eff_value_math_sign:'MATHSIGN_SET',!isCard,isCard?undefined:{ignoreCond:true});continue;}
     const map={},inc=res=>map[res]=(map[res]??0)+1;
     if(!isCard&&opts.includes('flat')){const base=floorGame(value/links.length);if(base>0)for(const res of links)map[res]=base;for(const res of this.call('randomArrayMembers',0,links,value%links.length,false))inc(res);}
     else for(let n=0;n<value;n++)inc(links[this.e.random.randRange(0,0,links.length)]);
     for(const [res,amount]of Object.entries(map)){const n=!isCard&&opts.includes('debuff')&&this.db.get('cs',res).cs_buff_type==='CS_BUFF_DEBUFF'?-amount:amount;
      add(tar,res,n,isCard,r.eff_value_math_sign,false,isCard?{ignoreCond:r.eff==='SKILL_EFF_CS_SET_ADD_RANDOM_IGNORE_COND'}:undefined);
     }
    }
   }});
  }else if(r.eff==='SKILL_EFF_TRANSITION_CS_TO'||r.eff==='SKILL_EFF_TRANSITION_SELECTED_CS_TO'){
   if(!isCard){const selected=r.eff==='SKILL_EFF_TRANSITION_SELECTED_CS_TO',unit=this.call('getUnitByID',selected?this.b.select_target:s.caster_id);let ids=this.classify(this.call('getContinueSkills',unit),opts);
    if(selected)for(const csid of this.call('getContinueSkills',unit)){const cs=this.b.csMap[csid];if(cs&&links.includes(cs.res_id))ids.push(csid);}
    ids=this.select(ids,opts,this.call('calcCountValue',id));
    if(!selected||targets.length>0){for(const target of targets)for(const csid of ids){const cs=this.b.csMap[csid];add(target,cs.res_id,cs.term_value,false,'MATHSIGN_ADD',true);}
     if(selected)for(const csid of ids){const cs=this.b.csMap[csid];this.call('addDetailLog',{type:'log_skill_eff_transition_selected_cs_to',params:[unit.id,targets,cs.res_id,cs.term_value],param_types:['unit_id','unit_id','cs_res_id','value']});}
     for(const csid of ids)this.call('removeContinueSkill',csid,unit.id,false);
    }
   }
  }else if(r.eff==='SKILL_EFF_BUFF_TYPE_CS_SET_ADD'||r.eff==='SKILL_EFF_HAVE_CS_SET_ADD'||r.eff==='SKILL_EFF_REMOVE_CS'){
   for(const target of targets){const unit=isCard?this.b.cardMap[target]:this.call('getUnitByID',target),all=isCard?(unit.continueSkill??[]):this.call('getContinueSkills',unit);let ids;
    if(r.eff==='SKILL_EFF_BUFF_TYPE_CS_SET_ADD'){calc(target);ids=this.select(this.classify(all,opts,true),opts,this.call('calcCountValue',id));}
    else if(r.eff==='SKILL_EFF_HAVE_CS_SET_ADD'){calc(target);ids=all.filter(id=>{const cs=this.b.csMap[id];return cs&&!cs.removed&&links.includes(cs.res_id);});}
    else ids=all;
    for(const csid of ids){const cs=this.b.csMap[csid];if(r.eff==='SKILL_EFF_REMOVE_CS'){if(links.includes(cs.res_id))this.call('removeContinueSkill',csid,target,isCard,{event:true});}
     else{if(r.eff==='SKILL_EFF_HAVE_CS_SET_ADD'&&(!cs||cs.removed))continue;add(target,cs.res_id,value,isCard,r.eff_value_math_sign,true,{exist_id:csid});}
    }
   }
  }else if(r.eff==='SKILL_EFF_COPY_CS'){
   const unit=this.call('getUnitByID',s.caster_id),copies=this.classify(this.call('getContinueSkills',unit),opts).map(id=>this.b.csMap[id]);
   for(const target of targets)for(const cs of copies)add(target,cs.res_id,cs.term_value,false,r.eff_value_math_sign,true,undefined,cs.caster_id,cs.char_id);
  }
  return value===undefined?{targets}:{targets,value};
 }
}
