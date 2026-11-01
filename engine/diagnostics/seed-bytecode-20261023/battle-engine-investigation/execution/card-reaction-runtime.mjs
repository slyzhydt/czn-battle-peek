// Source: SkillEffectProc0xbf800/0xc0900, CardProc0x1f800/0x21e00,
// Worktable0x6d200/0x6e100. See evidence/batch3-cards/.
import {TALENTS as T} from './card-talent-support.mjs';
export class CardReactionRuntime {
 constructor(e){this.e=e;this.b=e.b;this.w=e.wt;this.db=e.db;}
 call(n,...a){return this.e.call(n,...a);}
 hasOlgaTalent(talents){return talents?.some(t=>[T.TALENT_UNIQUE_OLGA,T.TALENT_UNIQUE_OLGA1,T.TALENT_UNIQUE_OLGA2].includes(t))??false;}
 setOlgaCount(id,value,options){const c=this.b.cardMap[id];if(!c)return;value=Math.max(0,Math.min(c.base_olga_count??0,value));this.call('pushChangeData','card',id);c.olga_count=value;const stage=this.e.state.worktables.BattleStageWorktable.battle_stage.all.find(x=>x.id==id);if(stage){stage.olga_count=value;stage.base_olga_count=c.base_olga_count;}
  this.e.pushAction({id:this.b.last_action_id++,type:'action_card_talent_olga',action_card_property:{card:id,olga_count:value,base_olga_count:c.base_olga_count},source_id:c.caster_id});if(options?.procCondition??true)this.call('procCardEvent','CONDITION_CARD_TALENT_UNIQUE_OLGA_STACK_AMOUNT',0,id);
 }
 procOlgaStackSetAdd(id,targets){const row=this.db.get('skill_eff',this.b.skillMap[id].res_id);for(const target of targets){const c=this.b.cardMap[target];if(!c||!this.hasOlgaTalent(c.talents))continue;this.setOlgaCount(target,this.call('procMathSign',row.eff_value_math_sign,c.olga_count??0,this.call('calcValue',id,target)));}}
 resetAllOlgaCountOnBattleEnd(){for(const id of this.b.deck_info.all.slice()){const c=this.b.cardMap[id];if(c&&this.hasOlgaTalent(c.talents)&&(c.olga_count??0)!=0)this.setOlgaCount(c.id,0,{procCondition:false});}for(const c of this.e.state.worktables.BattleStageWorktable.battle_stage.all)if((c.olga_count??0)!=0)c.olga_count=0;}
 cardRelativeProbabilityIndex(ratios){let sum=0;for(const ratio of ratios)if(!(ratio<=0))sum+=ratio;const random=this.e.random.randRange(0,0,sum);sum=0;for(let i=0;i<ratios.length;i++){if(ratios[i]<=0)continue;sum+=ratios[i];if(random<sum)return i;}return NaN;}
 // WT0x1baa00, nested287..290. A matching TARGETABLE_ONLY on another
 // nonterminal monster excludes this one; every candidate repeats the query.
 getTargetableMonsterPassiveFilteredIDs(cardId){const matches=(monster,all=false)=>{const ps=this.call('getPassiveByType',{source_id:monster.id,type:'SKILL_EFF_TARGETABLE_ONLY',is_card:false}),match=p=>{const types=this.db.array(this.db.get('skill_eff',p.res_id).target_card_set_card_type);return types.length===0||this.call('checkCategory',cardId,types);};if(!all)return ps.some(match);let found=false;ps.forEach(p=>{if(match(p))found=true;});return found;};
  return this.call('getTargetableMonstersID').filter(id=>{const monster=this.b.monsters.find(m=>m.id==id);if(!monster||monster.state==='target_unable')return false;if(matches(monster,true))return true;return !this.b.monsters.some(m=>!['changed','death','half_death','keep_half_death','run'].includes(m.state)&&matches(m));});
 }
 triggerPyeonrin(targets,count){for(let i=0;i<count;i++)for(const cardId of targets){const c=this.b.cardMap[cardId];if(!c)continue;const marked=[],selected=[],collect=id=>{const s=this.b.skillMap[id];if(!s?.eff_opts?.includes('trigger_pyeonrin'))return;marked.push(id);if(['TARGET_UNIT_SELECTED','TARGET_UNIT_SELECTED_ONLY'].includes(this.db.get('skill_eff',s.res_id).target_unit_type))selected.push(id);};
   this.call('getAllCardSkillEffIds',c).forEach(collect);c.continueSkill?.forEach(id=>this.b.csMap[id]?.skillEffs.forEach(collect));if(!marked.length)continue;let target;
   if(selected.length){const candidates=this.call('getTargetableMonsterPassiveFilteredIDs',cardId);if(candidates.includes(this.b.select_target))target=[this.b.select_target];else if(candidates.length&&(!this.w.isPreview||candidates.length===1))target=[this.e.random.randomArrayMember(0,candidates)];}
   const group=(this.b.pyeonrin_trigger_group_seq??0)+1;this.b.pyeonrin_trigger_group_seq=group;for(const id of marked)this.call('addSkillTriggered',id,undefined,undefined,undefined,undefined,group,undefined,selected.includes(id)?target:undefined);
  }}
 openPyeonrinSubGroup(group,entry){const card=this.call('getParentCard',entry.skill_id);if(!card)return;if(this.moveOpenedPyeonrinSubToEnd(group,card.id,entry.pyeonrin_trigger_group_id))return;this.call('pushSubBattleLog',{type:26,params:[card.id],logs:[],merge_by:entry.pyeonrin_trigger_group_id,card_effect:true});const log=this.b.battle_logs[this.b.battle_logs.length-1];group.sub=log?.sub?.[log.sub.length-1];group.group=entry.pyeonrin_trigger_group_id;}
 moveOpenedPyeonrinSubToEnd(group,cardId,groupId){if(this.w.isPreview||this.w.deferredSubLogs)return false;const subs=this.b.battle_logs?.[this.b.battle_logs.length-1]?.sub;if(!subs)return false;let at=-1;for(let i=subs.length-2;i>=0;i--)if(subs[i].card_effect&&subs[i].merge_by==groupId&&subs[i].params?.[0]==cardId){at=i;break;}if(at<0)return false;const [sub]=subs.splice(at,1);
  for(const block of this.b.action_blocks){const action=block.actions.find(a=>a.action_battle_log===sub);if(action){this.call('removeActionByID',action.id);break;}}
  sub.is_fin=undefined;subs.push(sub);this.e.pushAction({id:this.b.last_action_id++,type:'action_battle_log',source_id:-1,action_battle_log:sub});group.sub=sub;group.group=groupId;return true;
 }
}
