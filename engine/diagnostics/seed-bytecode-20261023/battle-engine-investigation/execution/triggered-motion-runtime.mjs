// BattleWorktable.procMotionSkillTriggeredBody0x5b300, full own body and
// callbacks afterSkillCSCheck/22..33. Static tree: batch3-cards/motion-source/.
import {MissingBattleRule} from './resource-store.mjs';
export const TRIGGERED_MOTION_BINDINGS={'procMotionSkillTriggeredBody.full':'procMotionSkillTriggeredBody',removeActionByID:'removeActionByID'};
export class TriggeredMotionRuntime {
 constructor(e){this.e=e;this.b=e.b;this.w=e.wt;this.db=e.db;this.L=e.enums.LogicState;}
 call(n,...a){return this.e.call(n,...a);}
 action(type,fields){const a={id:this.b.last_action_id++,type,...fields};return {action:a,index:this.e.pushAction(a)};}
 collapse(id){return this.call('isCollapseOnCharacterByID',id);}
 // WT0x9b800: -1 denotes an action held outside committed action blocks.
 removeActionByID(id){if(id==-1)return;for(const block of this.b.action_blocks){const at=block.actions.findIndex(a=>a.id===id);if(at!==-1)return block.actions.splice(at,1);}}
 afterCS(s,data){const at=this.b.check_timing_all_temp?.indexOf(s.skill_id);if(at!=null&&at>-1){this.b.check_timing_all_temp?.splice(at,1);s.trigger_cs_cause_skill_id=data.trigger_cs_cause_skill_id;this.call('afterSkillCSCheck',s);s.trigger_cs_cause_skill_id=undefined;}}
 usableCoopTarget(id){const unit=this.e.getUnit(id);return !['death','run','half_death','changed','keep_half_death','prop'].includes(unit.state)&&unit.status.info.S_CURRENT_HP>0;}
 coopOwner(s,r,data){const choose=a=>this.e.random.randomArrayMember(0,a),chars=()=>this.call('getAllChars'),active=c=>!this.collapse(c.id);let id;
  switch(r.eff_card_target_char){
   case 'CARD_TARGET_CHAR_OWNER':id=s.action_char_id;break;
   case 'CARD_TARGET_CHAR_1':case 'CARD_TARGET_CHAR_2':case 'CARD_TARGET_CHAR_3':id=Number(r.eff_card_target_char.slice(-1));break;
   case 'CARD_TARGET_CHAR_RAN_EACH':if(!this.w.isPreview)id=choose(chars().map(c=>c.id).filter(id=>!this.collapse(id)));break;
   case 'CARD_TARGET_CHAR_RAN_EXCEPT_OWNER':if(!this.w.isPreview)id=choose(chars().map(c=>c.id).filter(id=>id!=s.action_char_id&&!this.collapse(id)));break;
   case 'CARD_TARGET_CHAR_HIGHEST_ATK':case 'CARD_TARGET_CHAR_HIGHEST_ATK_EXCEPT_OWNER':{const except=r.eff_card_target_char==='CARD_TARGET_CHAR_HIGHEST_ATK_EXCEPT_OWNER',pool=chars().filter(c=>(!except||c.id!=s.action_char_id)&&active(c)),max=pool.reduce((a,c)=>c.status.info.S_ATK>a?c.status.info.S_ATK:a,0),highest=pool.filter(c=>c.status.info.S_ATK==max);id=(highest.length>1?choose(highest):highest[0]).id;break;}
   case 'CARD_TARGET_CHAR_CARD_ACTIVATED_BEFORE':{const c=this.b.cardMap[this.b.current_card];if(c&&[1,2,3,7].includes(c.char_id))id=c.char_id;break;}
   case 'CARD_TARGET_CHAR_OWNER_TRIGGERED':if(data.card_triggered){const c=this.b.cardMap[data.card_triggered];if(c&&[1,2,3,7].includes(c.char_id))id=c.char_id;}break;
   case 'CARD_TARGET_CHAR_CS_OWNER':if(s.parent.type==='CS'){const cs=this.b.csMap[s.parent.id];if(cs){if(cs.isCard){const c=this.b.cardMap[cs.owner_id];if(c&&[1,2,3,7].includes(c.char_id))id=c.char_id;}else if([1,2,3,7].includes(cs.owner_id))id=cs.owner_id;}}break;
  }return id;
 }
 triggerLog(s,r){let self=false,log;const cs=s.parent.type==='CS'?this.b.csMap[s.parent.id]:undefined;if(cs)self=this.db.get('cs',cs.res_id).log_self_flag==='YES';
  if(s.from_relic&&!self)log={type:18,params:[s.from_relic],logs:[],not_noti:r.trigger_noti_type!=='YES',merge_by:s.action_char_id};
  else if(s.from_ego&&!self)log={type:17,params:[s.from_ego,s.action_char_id],logs:[],not_noti:r.trigger_noti_type!=='YES',merge_by:s.action_char_id};
  else if(s.from_collapse&&!self)log={type:19,params:[s.from_collapse],logs:[],not_noti:r.trigger_noti_type!=='YES',merge_by:s.action_char_id};
  else if(s.parent.type==='CS'){
   if(cs){const cr=this.db.get('cs',cs.res_id);if(['SHOW_TYPE_ICON','SHOW_TYPE_ICON_OUTLINE','SHOW_TYPE_LOG_ONLY'].includes(cr.show_type)){
     if(cs.isCard){const c=this.b.cardMap[cs.owner_id];this.action('action_card_exhibit',{source_id:c.id,card_from:c.card_place,value:1/3});log={type:26,params:[cs.owner_id],logs:[],not_noti:r.trigger_noti_type!=='YES'};}
     else log={type:16,params:[cr.show_link_cs_id!=='none'?cr.show_link_cs_id:cr.id],logs:[],not_noti:r.trigger_noti_type!=='YES'||this.call('isMonsterByID',cs.owner_id)};
   }}
  }else if(s.parent.type==='CARD'&&r.trigger_noti_type==='YES'){const c=this.b.cardMap[s.parent.id];this.action('action_card_exhibit',{source_id:c.id,card_from:c.card_place,value:1/3});}
  if(log)log.merge_srcs=[s.skill_id];if(r.trigger_noti_type!=='NO_LOG')s.triggerLog=log;
 }
 procMotionSkillTriggeredBody(){const start=this.b.current_state,group={};let changed=false,budget=10000;
  while(this.b.motionTrig?.length>0||this.b.coopTrig?.length>0){if(--budget<0)throw new MissingBattleRule('motion_trigger_budget');let data=this.b.motionTrig?.shift(),coop=false;
   if(data==null){data=this.b.coopTrig?.shift();coop=true;if(this.b.coopTrig?.length==0)this.b.coopTrig=undefined;}else if(this.b.motionTrig?.length==0)this.b.motionTrig=undefined;
   if(data==null)continue;if(!(data.skill_id in this.b.skillMap)){this.call('flushDeferredLogs',data);continue;}
   const s=this.b.skillMap[data.skill_id],r=this.db.get('skill_eff',s.res_id);coop=coop||r.eff==='SKILL_EFF_DMG_COOP';
   if(this.call('isSkippedAfterBattleEnd',data)){this.call('skipTriggeredSkillData',data);continue;}
   if(!coop&&!this.e.effects.hasMotion(r)){if(data.pyeonrin_trigger_group_id!=null)this.call('openPyeonrinSub',group,data);this.call('procTriggeredSkillData',data);this.afterCS(s,data);continue;}
   if(coop){const targetable=data.target&&data.target.length>0?data.target.some(id=>this.usableCoopTarget(id)):false;if(!targetable&&this.call('getTargetableMonstersID').length===0){this.afterCS(s,data);this.call('flushDeferredLogs',data);continue;}}
   if(this.b.game_end||this.b.battle_step_mode?.next_wave){const next=!this.b.game_end&&this.b.battle_step_mode?.next_wave===true,blocked=next&&this.call('isWaveTransitionBlockedSkill',s.skill_id);if(!blocked){if(next&&!this.call('isMonsterByID',s.caster_id)){data.target=undefined;(this.b.nextWaveDeferredTrig??=[]).push(data);this.call('flushDeferredLogs',data);continue;}this.afterCS(s,data);this.call('flushDeferredLogs',data);continue;}}
   if(!coop&&this.collapse(s.action_char_id)){if(this.db.array(r.run_check_opt).includes('check_collapse_cancel')&&s.parent.type==='CS'){const cs=this.b.csMap[s.parent.id];if(cs){s.trigger_cs_cause_skill_id=data.trigger_cs_cause_skill_id;this.call('procCSTermDecrement',s,cs);s.trigger_cs_cause_skill_id=undefined;}}this.call('flushDeferredLogs',data);continue;}
   let owner;if(coop){owner=this.coopOwner(s,r,data);if(owner==null||this.collapse(owner)){this.call('flushDeferredLogs',data);continue;}}
   if(!this.call('isMonsterByID',s.caster_id)&&this.b.char.state==='death'){this.call('flushDeferredLogs',data);continue;}
   const card=this.call('getSkillCardId',s);let pct=this.db.number(r,'run_pct');const passives=this.call('getPassiveByType',{source_id:s.caster_id,type:'SKILL_EFF_RUN_PCT_ADD',is_card:false,char_id:s.action_char_id}),cardPassives=card>0?this.call('getPassiveByType',{source_id:card,type:'SKILL_EFF_RUN_PCT_ADD',is_card:true}):[];
   for(const p of passives.concat(cardPassives))pct+=this.call('calcValue',p.skill_id);if(pct<100){if(this.w.isPreview){this.call('flushDeferredLogs',data);continue;}const roll=this.e.random.randRange(0,0,100);if(pct<=roll){this.call('pushLog','skill '+s.res_id+' canceled by pct : '+roll);this.call('flushDeferredLogs',data);continue;}}
   this.call('setStateMain',{state:this.L.TIMING_USE_CARD_AFTER,proc:false,event:false});changed=true;for(const [field,from] of [['value_triggered','value'],['card_triggered','card_triggered'],['bind_stack_triggered','bind_stack_triggered'],['rita_value','rita_value'],['pyeonrin_trigger_group_id','pyeonrin_trigger_group_id']])s[field]=data[from];
   const triggered=this.call('getTriggeredList',data.skill_id,false);let coopAction,coopActionIndex;if(coop){if(triggered.actionCSTriggerIndex)this.call('removeActionByID',triggered.actionCSTriggerIndex);triggered.actionCSTrigger=undefined;const pushed=this.action('action_coop_chain_attack',{motion_type:'attack',source_id:-1});coopAction=pushed.action;coopActionIndex=pushed.index;}
   this.triggerLog(s,r);this.call('setDuring',s.skill_id,true);if(s.stack_trigger&&this.b.relicToggleMap&&s.stack_trigger in this.b.relicToggleMap)this.action(this.call('checkStack',s.stack_trigger)?'action_relic_loop':'action_relic_loop_end',{source_id:this.b.relicToggleMap[s.stack_trigger]});
   if(r.target_card_set.startsWith('CARD_SET_TRIGGERED')&&data.target!=null&&data.target.length>0)s.card_triggered=data.target[0];s.trigger_cs_cause_skill_id=data.trigger_cs_cause_skill_id;this.call('setCauseDuring',data.trigger_cs_cause_skill_id,true);this.call('openPyeonrinSub',group,data);
   const result=this.call('procSkillEff',data.skill_id,{skipInterrupt:true,targets:data.target,skipRunCheck:true,coop_char_id:owner,motion_triggered:true});
   this.call('setCauseDuring',data.trigger_cs_cause_skill_id,false);s.pyeonrin_trigger_group_id=undefined;s.trigger_cs_cause_skill_id=undefined;this.afterCS(s,data);
   const current=this.b.skillMap[data.skill_id];if(triggered.actionCSTrigger&&current?.target_changed_motion)triggered.actionCSTrigger.motion_type=current.target_changed_motion;
   if(result==null){if(coopActionIndex)this.call('removeActionByID',coopActionIndex);else if(triggered.actionCSTriggerIndex)this.call('removeActionByID',triggered.actionCSTriggerIndex);}
   else {if(triggered.actionCSTrigger)triggered.actionCSTrigger.target_id=result;if(coop){coopAction.target_id=result;coopAction.source_id=owner;}}
   this.call('setDuring',s.skill_id,false);if(this.w.isPreview)for(const name of ['relic','ego','cs'])this.w.triggeredList[name].push(...triggered.triggeredList[name]);this.call('setSubFinished');this.call('flushDeferredLogs',data);this.call('applyChangeCS');this.call('setStateMain',{state:this.L.TIMING_USE_CARD_FINISH,proc:false,event:false,interrupt:false});
  }
  this.call('finishPyeonrinSub',group);if(changed&&!this.b.game_end&&this.b.current_interrupt.type==='NONE'&&[this.L.TIMING_USE_CARD_AFTER,this.L.TIMING_USE_CARD_FINISH].includes(this.b.current_state)&&this.b.current_state!=start){this.b.current_state=start;this.call('pushLog','timing_restored:'+this.L[start]);}
 }
}
