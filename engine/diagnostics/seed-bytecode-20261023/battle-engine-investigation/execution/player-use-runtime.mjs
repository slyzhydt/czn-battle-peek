// Hand port: BattleProc.procUseCard0x84a00, all 32 nested closures.
// Source: evidence/player-entry-boundary/*.linear.{js,instructions.json}.
// Restored target JavaScript is never imported or executed.
import {MissingBattleRule} from './resource-store.mjs';
import {TALENTS as T} from './card-talent-support.mjs';
import {PlayerSparkUseRuntime} from './player-spark-use-runtime.mjs';
import {PlayerUseCollapseRuntime} from './player-use-collapse-runtime.mjs';
export const PLAYER_USE_BINDINGS={procUseCard:'procUseCard',addCollapseOffAction:'addCollapseOffAction'};
const fixed2=n=>Number((n+1e-8).toFixed(2));
const DAMAGE=['SKILL_EFF_DMG','SKILL_EFF_DMG_COOP','SKILL_EFF_DMG_IGNORE_COND','SKILL_EFF_DMG_EXCEPT_NOTI'];
export class PlayerUseRuntime {
 constructor(e){this.e=e;this.b=e.b;this.w=e.wt;this.db=e.db;this.L=e.enums.LogicState;this.spark=new PlayerSparkUseRuntime(e);this.collapseSupport=new PlayerUseCollapseRuntime(e);}
 addCollapseOffAction(c){return this.collapseSupport.addCollapseOffAction(c);}
 get stageWT(){const w=this.w.battle_stage_worktable??this.e.state?.worktables?.BattleStageWorktable;if(!w)throw new MissingBattleRule('input.BattleStageWorktable.playerUse');return w;}
 get initWT(){const w=this.w.battleInitWorktable??this.e.state?.worktables?.BattleInitWorktable;if(!w)throw new MissingBattleRule('input.BattleInitWorktable.playerUse');return w;}
 call(n,...a){return this.e.call(n,...a);}
 action(type,fields={}){const a={id:this.b.last_action_id++,type,...fields};return this.e.pushAction(a);}
 error(message,args){return this.call('contentError',message,args);}
 dirty(){const d=this.w.uctx?.dirty??this.e.state?.uctx?.dirty??this.e.state?.runtimeInputs?.battleSaveDirty;if(!d)throw new MissingBattleRule('input.uctx.dirty.playerUse');d.battle_save=true;}
 constant(id){return this.call('constantMetagame',id);}
 // procCost_1 0x85800. Unlike Repeat's local cost closure, positive AP
 // records nominal cost on every card skill, but records Rita-adjusted AP use.
 cost(c,res,ctx){c.tuned=c.is_tuning_card?c.cost_result==this.b.energy:undefined;this.b.energy_before_card_use=this.b.energy;
  this.b.cost_deficit=ctx.origin>=0&&ctx.origin>this.b.energy?ctx.origin-this.b.energy:undefined;
  let passed=ctx.cost,spent=0;
  if(ctx.cost>0&&!this.b.cost_cheat){spent=this.call('procRitaUniqueCostDeduction',c.id,ctx.cost,{deduct:true});c.rita_value=spent;this.call('addEnergy',-spent,false,0);this.call('addEPwithCheckPassive',this.constant(this.b.battle_step_mode?'tp_simulation_gen_ap_use':'tp_gen_ap_use')*spent);}
  else if(ctx.cost==-1){passed=spent=ctx.origin=this.b.energy;c.rita_value=spent;this.call('addEnergy',0,true,0);this.call('addEPwithCheckPassive',this.constant(this.b.battle_step_mode?'tp_simulation_gen_ap_use':'tp_gen_ap_use')*spent);}
  else c.rita_value=0;
  this.b.dpt.energy_used+=spent;if(this.call('checkMissionApply'))this.call('missionDispatch','USE_AP_IN_TURN',{ap:spent});
  this.call('setCardCostUsed',c.id,passed);this.call('procUnitEvent','CONDITION_CHAR_USE_ENERGY',[c.char_id,spent,res.card_category]);this.call('procCardEvent','CONDITION_USE_ENERGY_AMOUNT_SET',0,-1,{energy:spent});
 }
 // anonymous108 +109..114. Positive talent filters require every named
 // talent; the "not" filter excludes any match. Preserve separate queries.
 additional(c,res,id,p){if(['SORT_SUPPORT','SORT_COLLAPSE_SKILL','SORT_COLLAPSE','SORT_BREAK_IN'].includes(res.sort))return 0;
  const r=this.db.get('skill_eff',p.res_id),links=this.db.array(r.target_unit_type_opt_link_cs_id).map(x=>this.stageWT.battle_stage.break_cs_changes?.[x]??x);
  if(links.length&&!this.call('checkCSopts',links,this.call('getUnitByID',this.b.select_target,'procUseCard:targetUnitTypeOpt')))return 0;
  let match=true;const types=this.db.array(r.target_card_set_card_type);if(types.length&&!this.call('checkCategory',c.id,types))match=false;
  const egos=this.db.array(r.target_card_set_ego_type).map(x=>this.call('convertEgoCommon',x));if(egos.length&&!this.call('checkEgo',id,egos))match=false;
  const talents=this.db.array(r.target_card_set_talent);if(talents.length){const negative=talents.includes('not'),values=talents.filter(x=>x!='not').map(x=>T[x]);if(negative?values.some(x=>this.call('hasTalent',id,x)):values.some(x=>!this.call('hasTalent',id,x)))match=false;}
  const filter=this.call('parseCardCostFilter',r.target_card_set_opt_cost,'target_card_set_opt_cost_at:'+r.id);if(filter&&!this.call('applyCardCostFilter',filter,id))match=false;
  if(!match)return 0;const n=this.call('calcValue',p.skill_id);this.call('checkTermValuePassive',p.skill_id,this.b.char.id);return n;
 }
 // anonymous116/117: damage targets beat non-damage targets; within that
 // class the last result with at least as many monsters wins.
 saveTargets(skills,targets){let damage=false,length=0;skills.forEach((sid,i)=>{if(targets[i].length==0)return;const ids=targets[i].filter(x=>this.call('isMonsterByID',x)),s=this.b.skillMap[sid],hit=DAMAGE.includes(this.db.get('skill_eff',s.res_id).eff);
  if(hit&&!damage||hit===damage&&ids.length>=length){damage=hit;length=ids.length;this.b.before_used_card_targets=ids;}});}
 penaltySkill(c,r,ret){this.call('pushSubBattleLog',{logs:[],type:'collapse_penalty',params:[r.id]});const s=this.call('createSkill',r.link_skill_eff_id,c.char_id,{type:'BATTLE_START',id:-1},0,0,-1,c.char_id);ret.push(s.skill_id);}
 // 5820..8284: malformed terminal sequence reports, then recovers. A
 // default ContentError factory merely returning Error does not stop it.
 collapse(c,res,owner,ret){let recovery=false,penalty;
  if(res.sort!=='SORT_COLLAPSE')return {recovery,penalty};
  const count=c.collapse_count??0,need=c.collapse_need_count??0,terminal=count+1>=need,seq=owner?.collapse_sequence;
  if(seq&&seq.length>0){const item=seq[count];if(item!=null){if(item.type==='penalty'&&this.w.isPreview==0){penalty=this.db.table('collapse_penalty')[item.penalty_id];if(penalty){this.penaltySkill(c,penalty,ret);if(owner)owner.collapse_penalty_occurred=true;}}
    else if(item.type==='recover'){if(item.is_force||this.w.isPreview==0)recovery=true;}}
   if(terminal){const forced=item?.type==='recover'&&item.is_force,mismatch=count+1!=need||!forced;if(mismatch&&this.w.isPreview==0){const init=this.initWT.battle_init,stage=this.stageWT.battle_stage;
     this.error('err:collapse_recover_sequence_mismatch',{value:{battle:{res_id:init.battle_res_id,content_config_id:stage.ingame_content_config_id,turn:this.b.turn,state:this.b.current_state,prev_state:this.b.prev_state,next_state:this.b.next_state,interrupt:this.b.current_interrupt?.type},card:{id:c.id,res_id:c.res_id,place:c.card_place,count,need,before_collapse:c.beforeCollapseCard?{res_id:c.beforeCollapseCard.res_id,count:c.beforeCollapseCard.collapse_count,need:c.beforeCollapseCard.collapse_need_count}:undefined},char:{id:owner.id,res_id:owner.res_id,count:owner.collapse_card_count,need:owner.collapse_need_count,experience:owner.collapse_experience_count,link_crash:owner.link_crash_on},sequence:{length:seq.length,item,items:seq.map(x=>x==null?'none':x.type==='penalty'?'penalty:'+x.penalty_id:x.is_force?'recover:force':'recover:random')}},channel:'#server_report_dev2',log_in_publisher_live:true});}
    recovery=true;}
  }else if(terminal)recovery=true;
  else if(!this.stageWT.battle_stage.no_use_collapse_penalty&&this.w.isPreview==0){const chance=owner?.collapse_penalty_occurred?0:this.call('constantMetagameSkipError','collapse_additional_penalty')??0,recover=this.call('constantMetagameSkipError','collapse_immediate_recovery')??0;
   const forced=this.call('getCollapsePenaltySkill'),roll=this.e.random.randRange(0,0,100);
   if(roll<chance||forced){const ids=Object.values(this.db.table('collapse_penalty')).map(x=>String(x.id)).sort();penalty=this.db.get('collapse_penalty',forced||this.e.random.randomArrayMember(0,ids));this.penaltySkill(c,penalty,ret);if(owner&&forced==null)owner.collapse_penalty_occurred=true;}
   else if(roll<chance+recover)recovery=true;
  }
  return {recovery,penalty};
 }
 // 8284..10627; updates persistent stage characters and the temporary EP
 // slot before normal card effects. Log creation precedes the link-crash guard.
 recover(c,owner,others){let from=owner?.ego_stress,delta=0,otherA,otherB;
  if(!owner)return {from,delta,otherA,otherB};const cr=this.db.get('char_combatant',owner.res_id);this.call('pushSubBattleLog',{type:'collapse_recover',logs:[],params:[owner.res_id,cr.link_collapse_passive_id]});this.call('setSubFinished');if(owner.link_crash_on)return {from,delta,otherA,otherB};
  if(owner.collapse_on)this.call('procUnitEvent','CONDITION_CHAR_COLLAPSE',[owner.id,'recover']);this.call('addCollapseOffAction',owner);
  if(owner.ego_stress){const percent=this.constant('col_cleanse_stress_decrease'),flat=this.constant('col_skill_decrease_stress');from=owner.ego_stress;delta=-fixed2((1-percent*.01)*owner.ego_stress+flat);this.call('setEgoStress',owner,owner.ego_stress+delta);}
  const target=this.constant('collapse_stress_heal_target'),amount=this.constant('collapse_stress_heal_other');
  const heal=x=>{const before=x.ego_stress;this.call('setEgoStress',x,x.ego_stress-amount);return {char_res_id:x.res_id,from:before,to:x.ego_stress,stress_value:-amount};};
  if(target==1){const x=others.sort((a,b)=>b.ego_stress-a.ego_stress)[0];if(x&&!x.collapse_on)otherA=heal(x);}
  else if(target==2)for(let i=0;i<others.length;i++){const x=others[i];if(x.collapse_on)continue;const info=heal(x);if(i==0)otherA=info;else if(i==1)otherB=info;}
  owner.collapse_skill_penalty_pct??=1;owner.collapse_skill_penalty_pct+=(this.constant('collapse_skill_penalty_pct')??0)/100;
  this.stageWT.battle_stage.chars.forEach(x=>{if(x.id==owner.id)x.collapse_recovered_cost_decreased=true;});
  const at=this.b.ep_skill_deck.findIndex(x=>x!=null&&x.char_id==owner.id);let skill;
  if(at>=0){skill=this.b.ep_skill_deck[at];skill.cost=this.call('getEpSkillCost',skill);}
  else {const res=cr.collapse_skill_link_card_id,next=this.call('createBattleCard',this.call('makeCardInfo',this.b.last_unit_id++,res,owner.id));next.ep_skill=true;
   skill={isPartner:false,char_id:owner.id,char_res_id:owner.res_id,card_res_id:res,cost:0,card_id:next.id,origin_cost:this.call('getCost',next.id)};skill.cost=this.call('getEpSkillCost',skill);this.b.deck_info.all.push(next.id);}
  this.action('action_card_use_collapse',{source_id:-1,action_ep_skill_slots:this.b.ep_skill_deck.slice(),recover_collapse:true});
  if(this.b.ep_skill_deck.slice(0,3).every(x=>x?.char_id!==skill?.char_id)){const empty=this.b.ep_skill_deck.findIndex(x=>x==null);if(empty>=0)this.b.ep_skill_deck[empty]=skill;else this.b.temp_ep_skill_slot=skill;}
  return {from,delta,otherA,otherB};
 }
 procUseCard(source,target,options={}){const b=this.b,w=this.w,L=this.L,stageWT=this.stageWT;
  if(!w.isPreview){b.cardUseKilled??={};b.cardUseKilled[source]=0;}if(b.cardMap[source])b.cardMap[source].by_card_use_reuse=undefined;
  let c=b.cardMap[source];if(!w.isPreview&&target>=0&&c!=null&&this.db.get('card',c.res_id).target_for_ui!=='TARGET_MOST_MAX_HP_MONSTER'){const ids=this.call('getTargetableMonsterPassiveFilteredIDs',c.id);if(ids.length>0&&!ids.includes(target))throw this.error('err:invalid_selected_target:not_targetable_only',{slack:false});}
  this.call('setStateMain',{state:L.TIMING_USE_CARD_BEFORE,proc:true,event:true});const {preBattle,before_throw_completed:before,after_r_spark:afterRed,after_y_spark_select:afterYellow}=options??{},handBefore=b.deck_info.hand.slice().filter(id=>id!=source);
  c=b.cardMap[source];if(c==null){this.dirty();throw this.error('err:card_not_exist:'+source);}c.is_thrown=true;c.trigger_retained_cnt=undefined;
  const ctx={origin:Math.min(this.call('getCost',source),c.before_r_spark_cost??Infinity)};const normalized=ctx.origin==-1?b.energy:ctx.origin==-2?0:ctx.origin;
  const red=c.r_spark_candis!=null&&c.before_overwrite_card==null;
  if(!before&&!afterRed&&!afterYellow&&!red&&c.y_spark?.next_cards_resid==null){const owner=this.call('getCharByCharId',c.char_id);this.call('pushBattleLog',{type:'card_use',params:[source,target,owner?.res_id],logs:[]});}
  ctx.cost=Math.min(normalized,this.call('getCost',source,true));if(!before&&!afterYellow)c.cost_before_using=ctx.cost==-1?b.energy:ctx.cost<0?0:ctx.cost;c.ego_field_dmg_increased=undefined;
  const res=this.db.get('card',c.res_id);
  if(before){delete c.available;c.card_place=2;const old=b.deck_info.using.shift();if(old)b.deck_info.hand.push(old);}
  if(!preBattle&&!this.call('isCardAvailable',c)&&w.isPreview==0){this.dirty();throw this.error('err:card_available_failed:'+c.res_id);}
  let sparkRes,nextCard;const beforeIndices=this.db.array(res.before_throw_index).map(Number),skip=this.initWT.battle_init.battle_skip_spark_interrupt==true;
  const enterSpark=()=>{b.current_state=L.CardInterrupt;b.deck_info.using=[c.id];c.place_before_using=c.card_place;c.card_place=7;b.deck_info.hand=b.deck_info.hand.filter(id=>id!=c.id);};
  if(c.y_spark?.next_cards_resid&&w.isPreview==0&&!skip){this.cost(c,res,ctx);this.call('pushLog','First Spark Select');this.action('action_card_select_spark',{source_id:source,action_card_select_spark:{cards:c.y_spark.next_cards_resid,char_id:c.char_id}});enterSpark();return {};}
  const ret=this.call('getSkills',c.id),hasBefore=beforeIndices.length>0;
  if((!hasBefore||before)&&c.y_spark?.next_card){nextCard=c.y_spark.next_card;b.sparking=true;c.y_spark={};const original=stageWT.battle_stage.all.find(x=>x.id==c.id);if(original)original.y_spark={};}
  else if(red&&w.isPreview==0&&!skip){if(b.cheat_next_r_spark!=null){b.cheat_next_r_spark.forEach((x,i)=>{if(x)c.r_spark_candis.splice(i,1,x);});b.cheat_next_r_spark=undefined;}if(b.cheat_next_add_r_spark!=null){c.r_spark_candis[1].god_r_spark_res_id=b.cheat_next_add_r_spark;b.cheat_next_add_r_spark=undefined;}
   c.before_r_spark_cost=ctx.origin;
   if(w.test){let candidates=c.r_spark_candis.slice(),allowed=candidates.filter(x=>{const r=this.db.table('auto_card_use_priority_define')[x.res_id];return !(r!=null&&r.index_type==='R_SPARK'&&r.use_type==='USE_BAN');});if(allowed.length>0)candidates=allowed;this.call('shuffleInPlace',3,candidates);c.r_spark=candidates[0];c.r_spark_candis=undefined;
    this.action('action_card_r_spark_select_auto',{source_id:source,action_card_r_spark_select:{card_id:c.id,r_sparks:candidates,selected:c.r_spark}});if(stageWT)this.spark.pushLogs(stageWT,{spark_log_type:'R_SPARKED',char_id:c.char_id,params:{card_id:c.id,r_spark:c.r_spark}});
    const log={type:'r_spark',logs:[],params:[c.id,c.r_spark]};this.call('pushSubBattleLog',log);this.call('setSubFinished');const owner=this.call('getCharByCharId',c.char_id);owner.levelUpLogs??=[];owner.levelUpLogs.push(log);this.call('setRSpark',c.id,false);this.spark.applyRSpark(stageWT,c.id,c.r_spark);const persistent=this.spark.getChar(stageWT,c.char_id);if(persistent)++persistent.total_spark_count;b.user_actions.push({type:'card_r_spark_select',card_id:source,target,r_spark:c.r_spark});
   }else {const data={card_id:c.id,r_sparks:c.r_spark_candis};this.call('pushLog','Red Spark\n'+JSON.stringify(data,undefined,2));this.action('action_card_r_spark_select',{source_id:source,action_card_r_spark_select:data});enterSpark();return {};}}
  const owner=stageWT.battle_stage.chars.find(x=>x.id==c.char_id),others=stageWT.battle_stage.chars.filter(x=>x.id!=owner?.id);
  let removing=c.talents?.includes(T.TALENT_REMOVE);if(['SORT_COLLAPSE_SKILL','SORT_SUPPORT'].includes(res.sort))removing=true;if(removing&&c.remove_count>0){this.call('setRemoveCount',c.id,c.remove_count-1);removing=false;}
  const [destination,baseDestination]=c.place_after_using??this.call('getCardDestination',c.id,removing);c.place_after_using=[destination,baseDestination];c.is_removing=removing?true:undefined;
  if(hasBefore){if(!before&&w.isPreview==0){b.deck_info.using=[c.id];c.place_before_using=c.card_place;const temporary=this.action('action_card_use',{source_id:c.char_id,action_card:{cards:[c.id],place_from:c.card_place,place_to:destination,enemy_turn:b.enemy_turn},card_id:c.id});c.card_place=7;b.deck_info.hand=b.deck_info.hand.filter(id=>id!=c.id);
    this.call('procCardEvent','CONDITION_CARD_AMOUNT',2,c.id);this.call('procCardEvent','CONDITION_CARD_AMOUNT_SET',2,c.id);beforeIndices.forEach(i=>this.call('procSkillEff',ret[i],{byCard:true}));if(!afterYellow)this.cost(c,res,ctx);
    if(this.call('procInterrupt')){b.current_use_info=b.temp_card_use_action;return {};}this.call('removeActionByID',temporary);
    if(c.y_spark?.next_card){nextCard=c.y_spark.next_card;c.y_spark={};const original=stageWT.battle_stage.all.find(x=>x.id==c.id);if(original)original.y_spark={};}}
   if(!afterYellow&&w.isPreview)this.cost(c,res,ctx);for(let i=beforeIndices.length-1;i>=0;--i)ret.splice(beforeIndices[i],1);
  }else if(!afterYellow)this.cost(c,res,ctx);
  c.place_after_using=undefined;if(this.call('checkMissionApply')){this.call('missionDispatch','BATTLE_CARD_USE',{card:c});this.call('missionDispatch','BATTLE_CARD_USE_ONLY',{card:c});}
  ++b.use_card_count;this.call('setCurrentCard',c.id);this.call('procCardEvent','CONDITION_CARD_THROW',0,c.id,{value:c.cost_before_using});this.call('removeLeads',c.id);c.before_r_spark_cost=undefined;let cardId=source;
  const {recovery,penalty}=this.collapse(c,res,owner,ret);let stress={from:owner?.ego_stress,delta:0};if(recovery&&owner)stress=this.recover(c,owner,others);
  if(removing)this.action('action_card_remove',{card_id:c.id,source_id:b.char.id});this.call('moveCard',source,2,7,destination,undefined,recovery);
  const connected=c.skill_eff_ids.some(id=>{const s=b.skillMap[id];return s?.eff_opts?.includes('connect')&&this.db.table('skill_eff')[s.res_id]?.eff==='SKILL_EFF_CARD_USE';});if(!connected)this.call('checkCardConnect',c);
  this.call('increaseCollapseCount',c.id);b.before_used_card=cardId;b.turn_count_card_id=cardId;c.applied_atk_count=undefined;b.before_used_card_targets=[];this.call('procCardEvent','CONDITION_CARD_BEFORE_EGO_TYPE',0,cardId,{except:true});const prevEgo=b.before_used_ego;b.before_used_ego=c.curEgo;
  if(prevEgo!=null&&prevEgo!=c.curEgo)this.call('procCardEvent','CONDITION_CARD_BEFORE_EGO_TYPE',0,-1,{outline_only:true});this.call('pushLog','Use Card '+cardId+':'+c.res_id+' to '+target);
  const banned=this.call('getPassiveByType',{source_id:c.id,type:'SKILL_EFF_BAN_EFFECT',is_card:true});if(banned.length==0&&c.talents?.includes(T.TALENT_TERMINATION))this.call('checkTermination');b.source_id=cardId;this.call('setStateMain',{state:L.TIMING_USE_CARD_AFTER,proc:false,event:true});
  const action={id:b.last_action_id++,type:'action_player_card_use',source_id:c.char_id,card_id:c.id,command:res.motion_type};if(banned.length>0)action.use_only=true;if(recovery)action.recover_collapse=true;if(penalty)action.collapse_penalty=penalty.id;b.current_card_use_action=action;
  if(b.usedCardMap[c.res_id]!=null)b.usedCardMap[c.res_id]=true;this.e.pushAction(action);if(source<0)throw this.error('err:invalid_source_id:'+source);if(target>=0&&!this.call('isMonsterByID',target))throw this.error('err:invalid_selected_target:not_monster:'+target);b.select_target=target;
  if(afterRed&&this.call('getTargetTypeByTargetForUI',res.target_for_ui)==='TARGET_MONSTER'&&target<0)b.select_target=this.e.random.randomArrayMember(0,this.call('getTargetableMonsterPassiveFilteredIDs',cardId));
  if(!w.isPreview&&target>=0&&res.target_for_ui!=='TARGET_MOST_MAX_HP_MONSTER'){const unit=this.call('getUnitByID',target,'procUseCard:'+c.res_id),invalid=['run','target_unable','changed','prop'].includes(unit.state),ids=this.call('getTargetableMonsterPassiveFilteredIDs',c.id),missing=ids.length>0&&!ids.includes(target);
   if(invalid||missing){if(ids.length==0)throw this.error('err:invalid_selected_target');b.select_target=this.e.random.randomArrayMember(0,ids);target=b.select_target;}
   const passives=this.call('getPassiveByType',{source_id:target,type:'SKILL_EFF_TARGETABLE_ONLY',is_card:false});passives.forEach(p=>{const r=this.db.get('skill_eff',p.res_id),types=this.db.array(r.target_card_set_card_type);if(types.length==0||this.call('checkCategory',c.id,types))this.call('checkTermValuePassive',p.skill_id,b.char.id);});}
  const additional=this.call('getPassiveByType',{source_id:b.char.id,type:'SKILL_EFF_CARD_USE_ADDITIONAL',is_card:false,char_id:c.char_id}).concat(this.call('getPassiveByType',{source_id:c.id,type:'SKILL_EFF_CARD_USE_ADDITIONAL',is_card:true}));
  let repeats=0;additional.forEach(p=>repeats+=this.additional(c,res,cardId,p));while(repeats>0){--repeats;b.cardRepeats??=[];b.cardRepeats?.push({card_id:cardId,target:b.select_target,procUse:false,procCost:false,repeat:true,preserve_target:true});}
  const event=this.db.number(res,'card_use_event_timing'),motion=this.db.number(res,'motion_start_timing');this.call('procCardEvent','CONDITION_CARD_USE_IMMEDIATE',2,c.id,{value:c.cost_before_using});b.char.previousDamagetoAll=undefined;b.char.previousAttacktoAll=undefined;
  const targets=this.call('procSkillEffs',ret,{byCard:true,event,card_id:c.id,motion_index:motion,procTriggered:false});const changed=ret.find(id=>b.skillMap[id]?.target_changed_motion);if(changed)action.command=b.skillMap[changed]?.target_changed_motion;
  if(c.nihilum_meta_motion==='nihilum_meta_execution_attack')this.call('pushSubBattleLog',{type:'log_nihilum_meta',logs:[],params:[c.nihilum_stack_inc],major_first:true,is_fin:true},true);
  this.saveTargets(ret,targets);this.call('procSkillTriggered',true,true);if(c.nihilum_meta_motion)action.command=c.nihilum_meta_motion;this.call('checkDeads',{proc_skill:true,proc_event:true,proc_interrupt:false});this.call('setStateMain',{state:L.TIMING_SKILL_EFF_AFTER,proc:false,event:true});
  if(nextCard!=null){b.sparking=undefined;const next=this.call('getCards',{source_id:nextCard.char_id,card_res_ids:[nextCard.res_id],to:2,N:1,addStage:true,skill_id:undefined,bySpark:true,ignoreCond:true})[0];if(next){sparkRes=next.res_id;const log={type:'y_spark',params:[next.id],logs:[],not_noti:false};this.call('pushSubBattleLog',log);const char=this.call('getCharByCharId',nextCard.char_id);char.levelUpLogs??=[];char.levelUpLogs.push(log);
    this.call('procAddCS',next.id,this.db.get('constant_meta','spark_cost_cs_id').value.toString(),1,b.char.id,true,'MATHSIGN_ADD',true,true,-1,-1,{origin:'SPARK'});this.spark.afterApplyYSpark(stageWT,next.id,!!w.isPreview);this.spark.pushLogs(stageWT,{spark_log_type:'Y_SPARKED',char_id:c.char_id,params:{next_card:nextCard.res_id}});}}
  this.call('pushChangeData','card',c.id);if(removing){const copy=structuredClone(c);b.removed_cards.push(c.id);b.stage_actions.push({type:'remove',id:c.id,cardInfo:copy});}this.call('pushLog','========card_use-end========');this.call('procSkillTriggered',true,true);
  if(!b.deck_info.using.includes(cardId)){const actual=b.cardMap[b.deck_info.using[0]];if(actual)cardId=actual.id;}if(destination==11&&b.deck_info.using.includes(cardId))b.used_cards.push(cardId);
  if(owner&&recovery&&owner.ego_stress!=null&&!owner.link_crash_on){const array=[{char_res_id:owner.res_id,from:stress.from??0,to:owner.ego_stress??0,stress_value:stress.delta,is_collapse_on:false}];if(stress.otherA)array.push(stress.otherA);if(stress.otherB)array.push(stress.otherB);this.call('addStressActionArray',array);}
  const coop=()=>{if(!['SORT_COLLAPSE','SORT_BREAK_IN'].includes(res.sort)){if(ctx.origin>=2)this.call('checkCelestial',handBefore);b.coop_reserved={char_id:c.char_id,target_ids:handBefore};}},result=()=>{action.card_use_targets=targets;b.current_card_use_action=undefined;return {spark_res_id:sparkRes,collapse_recovery:recovery};};
  if(this.call('procInterrupt')){this.call('suspendCurrentCardForInterrupt',c.id,destination,false);coop();return result();}
  if(c.r_spark_skill_eff_ids!=null)this.call('procSkillEffs',this.call('getActiveSparkSkills',c.id),{byCard:true,card_id:c.id,skip_not_break_additional:true});if(c.eidolon_skill_eff_ids!=null)this.call('procSkillEffs',this.call('getActiveEidolonSkills',c.id),{byCard:true,card_id:c.id,skip_not_break_additional:true});
  if(this.call('procInterrupt')){this.call('suspendCurrentCardForInterrupt',c.id,destination,true);coop();return result();}
  this.call('checkTermValue',c.id,'TERM_CARD_USE_WHOLE',b.char.id,true,{isWhole:true});this.call('checkTermValue',b.char.id,'TERM_ANY_CARD_USE',b.char.id,false);b.monsters.forEach(m=>{if(this.call('isFieldMonster',m))this.call('checkTermValue',m.id,'TERM_ANY_CARD_USE',m.id,false);});if(c.char_id!=-1)this.call('checkTermValue',c.char_id,'TERM_ANY_OWN_CARD_USE',b.char.id,false);if(event==-1)this.call('procCardUseEvent',c.id);
  b.before_activated_card=c.id;this.call('removeLeadUsedCads',c.id);this.call('setStateMain',{state:L.TIMING_USE_CARD_FINISH,proc:true,event:true,interrupt:false});this.call('removeSavedAll','card',c.id);this.call('getCost',c.id,false,true);this.call('applyChangeCS');const resetBind=!c.eff_banned&&(c.bind_count??0)>0;
  if(resetBind){c.bind_count=0;this.action('action_card_bind',{action_card_property:{card:c.id,bind_count:0},source_id:-1});}const current=this.call('getUsingCardIDAfterChange',cardId),actual=b.cardMap[current]??c;
  if(actual.card_place!=4){if(destination==0){b.deck_info.using=[];this.call('procCardEvent','CONDITION_CARD_AMOUNT',actual.place_before_using,-1);this.call('procCardEvent','CONDITION_CARD_AMOUNT_SET',actual.place_before_using,-1);actual.card_place=0;}else if(destination==4){this.call('moveCard',current,7,4);this.call('procCardEvent','CONDITION_CARD_EXHAUST',2,current);}else this.call('moveCard',current,7,destination);}
  if(recovery){this.call('recoverFromCollapseCard',current);this.call('addEPwithCheckPassive',this.constant(b.battle_step_mode?'tp_simulation_gen_col_restore':'tp_gen_col_restore'));}if(c.nihilum_meta_motion==='nihilum_meta_execution_attack')this.call('checkNihilumMetaStack',c);
  this.call('procCardEvent','CONDITION_CARD_BEFORE_EGO_TYPE',0,c.id);this.call('procCardEvent','CONDITION_CARD_USE_BEFORE_CHAR',0,cardId);coop();if(resetBind){this.call('procCardEvent','CONDITION_CARD_TALENT_BIND_STACK_AMOUNT',0,c.id);this.call('procCardEvent','CONDITION_CARD_TALENT_BIND_STACK_AMOUNT_SET',0,c.id);}this.call('resetIgniteCount',c.id);this.call('resetTiperaCount',c.id);this.call('procMain');if(c.is_thrown)c.is_thrown=undefined;if(c.is_removing)c.is_removing=undefined;if(b.cardUseScoreAccum)delete b.cardUseScoreAccum[c.id];return result();
 }
}
