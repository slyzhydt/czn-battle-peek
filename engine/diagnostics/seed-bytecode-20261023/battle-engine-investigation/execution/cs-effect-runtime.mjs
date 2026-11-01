// Complete source jump families are added as units; no target program code is
// executed. Sources: evidence/active-effects/{ego-cs,trigger-cs,structured,cs-term}.
import {MissingBattleRule} from './resource-store.mjs';
export const CS_EFFECT_NAMES=new Set(['CS_SET_ADD','CS_SET_ADD_NO_SPARK','CS_SET_ADD_IGNORE_COND','CS_SET_ADD_CASTER_MODIFY','CS_SET_ADD_IGNORE_OVERLAY','CS_ADD_COND_AUTO','CS_SET_ADD_IGNORE_BLOCK','CS_SET_ADD_TERM_VALUE','TRIGGER_CS'].map(x=>'SKILL_EFF_'+x));
export class CSEffectRuntime {
 constructor(e){this.e=e;this.b=e.b;this.w=e.wt;this.db=e.db;}
 call(n,...a){return this.e.call(n,...a);}
 action(type){this.e.pushAction({id:this.b.last_action_id++,type,source_id:-1});}
 group(enabled,fn){if(enabled)this.action('action_group_start');fn();if(enabled)this.action('action_group_end');}
 // BattleWorktable.getCharIDsOwningCS0x189000: enumerate ownership buckets,
 // match active exact resource IDs, preserve native property enumeration order.
 getCharIDsOwningCS(resources){const result=[],map=this.b.char.continueSkillChar;if(!map)return result;for(const key in map){const owner=Number(key);if(result.includes(owner))continue;if(map[key]?.some(id=>{const cs=this.b.csMap[id];return cs&&!cs.removed&&resources.includes(cs.res_id);}))result.push(owner);}return result;}
 // setStateMain0x85100 callback0x86900/card-CS callback0x87400. Preview
 // suppression still consumes the passive term; singleton choices still draw.
 recentDrawPassive(passive){const value=this.call('calcValue',passive.skill_id),all=passive.eff_opts?.includes('all'),links=passive.link_cs_ids??[];
  if(!this.w.isPreview||links.length===1||all){const row=this.db.get('skill_eff',passive.res_id),selected=all?links:[this.e.random.randomArrayMember(0,links)];for(const res of selected)this.call('procAddCS',this.b.recent_draw,res,value,passive.action_char_id,true,row.eff_value_math_sign,false,false,passive.action_char_id,passive.skill_id);}
  this.call('checkTermValuePassive',passive.skill_id,this.b.char.id);
 }
 dispatch(id,c){const s=this.b.skillMap[id],r=this.db.get('skill_eff',s.res_id),targets=c.targets;
  switch(r.eff){
   case 'SKILL_EFF_CS_SET_ADD_TERM_VALUE':this.termValues(id,targets);break;
   case 'SKILL_EFF_TRIGGER_CS':this.trigger(id,targets);break;
   default:if(!CS_EFFECT_NAMES.has(r.eff))throw new MissingBattleRule('csEffect.dispatch',{id,eff:r.eff});this.repeatedAdd(id,targets,c.count_value_additional??0);
  }return {targets};
 }
 // procCSSetAddTermValue0x196300, exact resource IDs and cloned iteration.
 termValues(id,targets){const s=this.b.skillMap[id],r=this.db.get('skill_eff',s.res_id),links=new Set(s.link_cs_ids??[]);
  for(const target of targets){const value=this.call('calcValue',id,target),unit=this.call('getUnitByID',target);
   for(const csId of this.call('getContinueSkills',unit).slice()){const cs=this.b.csMap[csId];if(!cs||cs.removed||!links.has(cs.res_id))continue;
    if(this.call('addTermValue',csId,value,r.eff_value_math_sign,s.caster_id,false,s.skill_id))this.call('removeContinueSkill',csId,cs.owner_id,cs.isCard);
   }
  }
 }
 // 0x190e00..191f00. This only enqueues OPERATION_TRIGGER children; shared
 // scheduling later consumes their terms and runs them in the original order.
 trigger(id,targets){const s=this.b.skillMap[id],own=s.eff_opts?.includes('own')??false;
  for(const target of targets){const count=this.call('calcCountValue',id,target),unit=this.call('getUnitByID',target);
   for(const res of s.link_cs_ids??[])for(const csId of this.call('getContinueSkills',unit)){const cs=this.b.csMap[csId];if(cs.res_id!==res||own&&cs.caster_id!==s.caster_id)continue;
    for(const childId of cs.skillEffs){const child=this.b.skillMap[childId];if(this.db.get('skill_eff',child.res_id).operation!=='OPERATION_TRIGGER')continue;
     for(let i=0;i<count;i++)this.call('addSkillTriggered',childId,undefined,undefined,undefined,s.skill_id);
    }
   }
  }
 }
 // Ordinary CS_SET_ADD's own_other_char branch changes only existing CS from
 // another combatant, and uses exist_id rather than creating another instance.
 otherCaster(id,targets){const s=this.b.skillMap[id],r=this.db.get('skill_eff',s.res_id);
  this.group(targets.length>1,()=>{for(const target of targets){const value=this.call('calcValue',id,target),unit=this.e.getUnit(target,true);if(!unit)continue;
   const ids=this.call('getContinueSkills',unit).slice();for(const res of s.link_cs_ids??[])for(const csId of ids){const cs=this.b.csMap[csId];if(!cs||cs.removed||cs.res_id!==res)continue;
    const caster=[4,5,6].includes(cs.caster_id)?cs.caster_id-3:cs.caster_id;if(caster===s.action_char_id)continue;
    this.call('procAddCS',target,res,value,s.caster_id,false,r.eff_value_math_sign,false,false,s.action_char_id,s.skill_id,{exist_id:csId});
   }
  }});
 }
 repeatedAdd(id,targets,additional){const s=this.b.skillMap[id],r=this.db.get('skill_eff',s.res_id),eff=r.eff,opts=s.eff_opts??[],links=s.link_cs_ids??[];
  const ordinary=['SKILL_EFF_CS_SET_ADD','SKILL_EFF_CS_SET_ADD_NO_SPARK','SKILL_EFF_CS_SET_ADD_IGNORE_COND'].includes(eff),casterModify=eff==='SKILL_EFF_CS_SET_ADD_CASTER_MODIFY',overlay=eff==='SKILL_EFF_CS_SET_ADD_IGNORE_OVERLAY',conditional=eff==='SKILL_EFF_CS_ADD_COND_AUTO';
  const isCard=!casterModify&&r.target_unit_type==='TARGET_UNIT_NONE',ignoreBlock=eff==='SKILL_EFF_CS_SET_ADD_IGNORE_BLOCK';
  // This query precedes own_other_char and the all/pct setup in native code.
  const linked=ordinary?this.e.effects.getLinkCsOwnerCharIDs(s,r):undefined;
  if(ordinary&&opts.includes('own_other_char')){this.otherCaster(id,targets);return;}
  const all=ordinary&&opts.includes('all'),pct=ordinary?Number(opts.find(x=>x.startsWith('pct_'))?.slice(4)??100):100;
  if(ordinary&&!all&&links.length>1)s.log_all_cards=false;
  let selected=targets;if(isCard){let limit=this.call('calcEffCardTargetCount',id);if(limit<0)limit=targets.length;selected=targets.slice(0,limit);}
  const cached={},count=target=>cached[target]??=this.call('calcCountValue',id,target)+additional;
  let grouped=!ignoreBlock&&!isCard&&targets.length>1;
  if(!ignoreBlock&&!isCard&&!grouped&&!casterModify){for(const target of targets){const n=ordinary?this.call('calcCountValue',id,target)+additional:count(target);if(n>1)grouped=true;}}
  this.group(grouped,()=>{for(const target of selected){
   if(pct<100){if(this.w.isPreview)continue;if(pct<=this.e.random.randRange(0,0,100))continue;}
   const n=ordinary||eff==='SKILL_EFF_CS_SET_ADD_IGNORE_BLOCK'?this.call('calcCountValue',id,target)+additional:count(target),value=this.call('calcValue',id,target);let tar=target;
   for(let i=0;i<n;i++){
    if(r.target_unit_type==='TARGET_UNIT_ALL_RAN_ENEMY'&&i>0){const choices=this.call('getTargetableMonstersID',{skill_id:id});if(choices.length)tar=this.e.random.randomArrayMember(0,choices);}
    if(this.w.isPreview&&links.length!==1&&!all)continue;
    const chosen=all?links:[this.e.random.randomArrayMember(0,links)];
    for(const res of chosen){const owners=ordinary?this.e.effects.resolveCSOwnerCharIDs(res,linked,s.action_char_id):[casterModify?tar:s.action_char_id];
     for(const owner of owners){const sign=conditional?(this.call('checkStack',s.stack_trigger??-1)?'MATHSIGN_ADD':'MATHSIGN_SUBTRACT'):r.eff_value_math_sign;
      const extra=ordinary&&!isCard?{ignoreCond:eff==='SKILL_EFF_CS_SET_ADD_IGNORE_COND',fromRelic:s.from_relic}:overlay?{ignoreMinMax:true}:undefined;
      this.call('procAddCS',tar,res,value,casterModify?tar:s.caster_id,isCard,sign,false,eff==='SKILL_EFF_CS_SET_ADD_IGNORE_BLOCK',owner,s.skill_id,...(extra?[extra]:[]));
     }
    }
   }
  }});
 }
}
