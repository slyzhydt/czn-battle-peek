// Independently handported from BattleProc finishBattleAction/handleBattleEnd and
// BattleWorktable. Retained instruction evidence: evidence/lifecycle-runtime.
// Native preview runs through independent offline executors. Native transport
// serialization remains an explicit output boundary; no target code runs.
import {ceilGame} from '../effects/effect-arithmetic.mjs';

export class ActionFinalizeRuntime {
  constructor(e){this.e=e;this.w=e.wt;this.b=e.b;this.db=e.db;}
  call(name,...args){return this.e.call(name,...args);}
  query(args){return this.e.ports.getPassiveByType(args);}
  get stage(){return this.w.battle_stage_worktable?.battle_stage??this.e.state.worktables?.BattleStageWorktable?.battle_stage;}
  isMainPhase(){return this.b.current_state===this.e.enums.LogicState.MainPhase;}
  changed(id){this.e.pushChangeData('card',id);}
  setAvailable(c,value){if(value)delete c.available;else c.available=false;}
  // Two imported symbols share a name in native modules. The card helper only
  // reads the flag; BattleWorktable's method takes an ID and evaluates rules.
  cardAvailableFlag(card){return card.available!==false;}
  isCardAvailableCompatibility(value,options){return value!==null&&typeof value==='object'?this.cardAvailableFlag(value):this.isCardAvailable(value,options);}
  // BattleCard helpers 0xc100/0xc800: undefined encodes available.
  isCardUninteractible(id){const c=this.b.cardMap[id];if(!c)return false;
    return !!c.talents?.includes(57)||this.query({source_id:c.id,type:'SKILL_EFF_CARD_TALENT',is_card:true,talent:57}).length>0;}
  isPlayable(id){const c=this.b.cardMap[id];if(!c.talents?.includes(4))return true;
    const res=this.db.get('card',c.res_id);
    return this.query({source_id:this.b.char.id,type:'SKILL_EFF_IGNORE_TALENT_UNPLAYABLE',is_card:false}).some(p=>{
      const r=this.db.get('skill_eff',p.res_id),types=this.db.array(r.target_card_set_card_type),links=this.db.array(r.target_card_set_opt_multiple_link);
      return (!types.length||this.call('checkCategory',id,types))&&(!links.length||links.includes(res.id));
    });
  }
  isCardAvailable(id,{by_skill_eff=false}={}){const c=this.b.cardMap[id];if(this.isCardUninteractible(id))return false;
    const blocked=this.query({source_id:c.id,type:'SKILL_EFF_CARD_TALENT',is_card:true,talent:4});
    if(blocked.length){const cs=this.b.csMap[blocked[0].parent.id];if(cs&&!cs.removed)(c.banned_debuff??=[]).push([cs.from_debuff,cs.res_id]);return false;}
    if(c.banned&&!(by_skill_eff&&c.banned_allow_use)||c.unusable||!this.isPlayable(id))return false;
    if(c.collapse_count!=null&&this.call('tryGetStageCharByCharId',c.char_id)?.link_crash_on)return false;
    return true;
  }
  checkTutorialBan(id){const c=this.b.cardMap[id],old=c.banned_tsp;c.banned_tsp=undefined;
    const list=this.query({source_id:c.caster_id,type:'SKILL_EFF_TUTORIAL_BAN_CARD_USE',is_card:false,char_id:c.char_id})
      .concat(this.query({source_id:c.id,type:'SKILL_EFF_TUTORIAL_BAN_CARD_USE',is_card:true}));
    for(const p of list)if(this.call('getTutorialBanTargetCards',p.skill_id).includes(id)){c.banned_tsp=p.eff_opt_multiple_link?.[0];break;}
    if(old!=c.banned_tsp)this.changed(id);
  }
  getRitaUniqueAdditionalAP(id){const c=this.b.cardMap[id];if(!c)return 0;
    const passives=this.query({source_id:c.char_id,type:'SKILL_EFF_UNIQUE_RITA_1',is_card:false,char_id:c.char_id});if(!passives.length)return 0;
    const sort=this.call('getSort',id);let sum=0;
    for(const p of passives){const r=this.db.get('skill_eff',p.res_id),sorts=this.db.array(r.target_card_set_card_sort);
      if(sorts.length){const yes=sort.some(s=>sorts.includes(s));if(sorts.includes('not')?yes:!yes)continue;}
      if(p.parent.type==='CS'){const cs=this.b.csMap[p.parent.id];if(cs&&!cs.removed&&cs.term_value>0)sum+=cs.term_value;}
    }return sum;
  }
  // 0x201900. The event is delivered even for a subsequently missing card.
  checkCardAvailable(id){this.call('procCardEvent','CONDITION_CARD_HAND_ORDER',2,id);
    const c=this.b.cardMap[id];if(!c)return;
    const old=c.available!==false,costBefore=c.cost_result,outlineBefore=c.outline;this.setAvailable(c,false);
    const cost=this.call('updateCostResult',id).new_cost;this.checkTutorialBan(id);
    if(this.b.deck_info.hand.includes(id)){
      this.setAvailable(c,this.isCardAvailable(id));
      if(cost>this.b.energy+this.getRitaUniqueAdditionalAP(id)){
        const ignores=this.query({source_id:c.id,type:'SKILL_EFF_ALLOW_CARD_USE_IGNORE_COST',is_card:false,char_id:c.char_id})
          .filter(p=>this.call('getTargetCards',p.skill_id,false,false).target_cards_id.includes(id));
        if(!ignores.length)this.setAvailable(c,false);
      }
    }
    c.outline=undefined;
    for(const key in c.handOutline??{})if(c.handOutline[key]){const stack=this.b.stackMap[Number(key)],row=stack&&this.db.table('condition')[stack.res_id];
      if(row&&row.stack_value_ineq!=='INEQUALITY_NONE'&&!this.call('checkStack',Number(key)))continue;c.outline=true;
    }
    if(c.is_tuning_card&&c.cost_result==this.b.energy)c.outline=true;
    if(c.is_efficiency_card&&c.cost>=0&&c.cost_result<c.cost)c.outline=true;
    if(this.b.current_state!==this.e.enums.LogicState.CardInterrupt&&c.interruptOutline){c.interruptOutline=false;this.changed(id);}
    if(c.ccsOutline?.length>0)c.outline=true;
    if(old!=(c.available!==false)||costBefore!=c.cost_result||outlineBefore!=c.outline)this.changed(id);
  }
  checkCards(){this.call('sortHandCards');this.b.deck_info.all.forEach(id=>this.checkCardAvailable(id));this.procCharHpChangedEvent();this.procUnusablePassives();}
  procCharHpChangedEvent(){this.b.eventMaps.unitEventMap.CONDITION_CHAR_CUR_HP_CHANGE?.forEach(id=>{
    const cond=this.b.condMap[id];if(cond.inactive||!cond.unit_opt?.includes('cur_hp_pct')||!cond.unit_opt?.includes('dmg')||cond.value==0)return;
    const row=this.db.table('cond_unit')[cond.res_id];if(!row){this.call('ContentError','curr_hp_changed missing cond_unit',{value:cond.res_id});return;}
    if(!['INEQUALITY_GE','INEQUALITY_GT'].includes(row.condition_unit_value_ineq)||row.condition_unit_type!=='CONDITION_UNIT_CASTER')return;
    const caster=this.b.stackMap[cond.stack_id]?.caster_id??-1;if(caster===-1||!this.e.getMonster(caster))return;
    const hp=this.call('getStatus',caster,'S_CURRENT_HP')-ceilGame(this.call('getStatus',caster,'S_HP')*cond.value/100);
    this.e.pushAction({id:this.b.last_action_id++,type:'action_monster_hpmark',source_id:caster,hp});
  });}
  procUnusablePassives(){const seen=new Set();for(const p of this.query({source_id:this.b.char.id,type:'SKILL_EFF_HAND_UNUSABLE_EXCEPT_1',is_card:false})){
    if(seen.has(p.action_char_id))continue;seen.add(p.action_char_id);
    const b=this.b,hand=b.deck_info.hand.filter(id=>{const c=b.cardMap[id];this.db.get('card',c.res_id);return c.char_id==p.action_char_id;}),available=hand.filter(id=>b.cardMap[id].available!==false);
    if(p.randValue==null||!b.deck_info.hand.includes(p.randValue))p.randValue=this.e.random.randomArrayMember(0,available.length?available:hand);
    const other=b.deck_info.all.filter(id=>!b.deck_info.hand.includes(id)&&b.cardMap[id].char_id==p.action_char_id),debuff=p.eff_opt_multiple_link?.[0];
    const action=(c,effect_type)=>this.e.pushAction({id:b.last_action_id++,type:'action_card_debuff',action_card_debuff:{cards_debuffs:{[c.id]:c.debuffs},effect_type,skip:true},source_id:p.caster_id});
    for(const id of other){const c=b.cardMap[id],index=c.debuffs?.findIndex(d=>d.debuff_res_id==debuff);if(index!=null&&index>=0){c.debuffs.splice(index,1);action(c,1);}}
    for(const id of hand){const c=b.cardMap[id];if(c.id!=p.randValue){
      if(!c.debuffs?.some(d=>d.debuff_res_id==debuff)){
        (c.debuffs??=[]).push({debuff_res_id:debuff,debuff_caster:p.action_char_id,debuff_show_skip:true});
        (c.banned_debuff??=[]).push([debuff,undefined]);action(c,-1);
      }this.setAvailable(c,false);
    }else{const index=c.debuffs?.findIndex(d=>d.debuff_res_id==debuff);if(index!=null&&index>=0){const spliced=c.debuffs.splice(index,1),ban=c.banned_debuff?.findIndex(d=>d[0]==spliced?.[0].debuff_res_id);if(ban!=null&&ban>=0)c.banned_debuff.splice(ban,1);action(c,1);}}}
  }}
  pushRemoveData(kind,id){if(this.w.isPreview)return;const map=this.w.removeMap;if(kind in map){if(!map[kind].includes(id))map[kind].push(id);}else map[kind]=[id];}
  // ContinueSkillProc.remove 0x57b00 only tears down child skill effects.
  continueSkillRemove(id){const cs=this.b.csMap[id];if(cs)cs.skillEffs.forEach(id=>this.call('removeSkill',id,true));}
  removeCsWithCleanup(id){const cs=this.b.csMap[id];if(!cs||cs.removed)return;cs.removed=true;this.call('markCsForRemoval',id);this.e.pushChangeData('cs',id);this.continueSkillRemove(id);}
  // 0x3f100: queued skills keep their dependent objects alive until drained.
  cleanupPendingRemovals(){const b=this.b,w=this.b,skills=new Set(),stacks=new Set(),conds=new Set(),css=new Set();
    const collect=id=>{skills.add(id);const s=b.skillMap[id];if(!s)return;
      for(const k of ['stack_trigger','stack_value0','stack_value1','stack_count0','stack_count1'])if(s[k])stacks.add(s[k]);
      s.duringConds?.forEach(id=>conds.add(id));if(s.parent?.type==='CS')css.add(s.parent.id);
    };
    for(const key of ['skillTrig','motionTrig','duringTrig'])b[key]?.forEach(t=>collect(t.skill_id));b.interrupts?.forEach(t=>collect(t[1]));
    if(w.pendingDeadMonsterCsCleanup){const keep=[];for(const id of w.pendingDeadMonsterCsCleanup){const mon=this.e.getMonster(id);if(!mon)continue;
      const ids=this.call('getContinueSkills',mon).filter(id=>b.csMap[id]&&!b.csMap[id].removed);
      if(ids.some(id=>css.has(id))){keep.push(id);continue;}ids.forEach(id=>this.removeCsWithCleanup(id));mon.continueSkill=[];mon.continueSkillCaster=undefined;mon.continueSkillChar=undefined;
    }w.pendingDeadMonsterCsCleanup=keep;}
    if(w.pendingCardRemovals){const keep=[];for(const id of w.pendingCardRemovals){const c=b.cardMap[id];if(!c)continue;if(c.skill_eff_ids.some(id=>skills.has(id)))keep.push(id);else this.call('removeCard',id);}w.pendingCardRemovals=keep;}
    for(const [pending,map,kind,protectedIds]of [['pendingSkillRemovals','skillMap','skill',skills],['pendingCsRemovals','csMap','cs',css],['pendingCondRemovals','condMap','cond',conds],['pendingStackRemovals','stackMap','stack',stacks]]){
      if(!w[pending])continue;const keep=[];for(const id of w[pending]){if(protectedIds.has(id)){keep.push(id);continue;}delete b[map][id];if(kind==='stack')delete b.stackParentMap[id];this.pushRemoveData(kind,id);}w[pending]=keep;
    }
  }
  clearActionBlockOnFinish(){const keep=new Set(['action_card_select','action_card_select_spark','action_card_res_select','action_card_option_select','action_card_r_spark_select','action_battle_event','action_spot_reward','action_battle_win','action_battle_prelose','action_stage_result','action_battle_skip']),blocks=[];
    for(let block;(block=this.b.action_blocks.shift())!==undefined;){while(block.actions.length){const a=block.actions[0];if(keep.has(a.type)||(a.type==='action_tutorial'&&a.msg==='tsp_0_0005'))break;block.actions.shift();}if(block.actions.length)blocks.push(block);}this.b.action_blocks=blocks;
  }
  procStageActions(){for(const a of this.b.stage_actions){switch(a.type){
    case 'remove':if(a.cardInfo)this.call('stageRemoveCard',a.cardInfo.id);break;
    case 'get':if(a.cardInfo){this.call('stageAddCard',true,a.cardInfo);this.call('setStageGenerateID',this.b.last_unit_id);}break;
    case 'relic':{const r=this.stage.equipments.find(r=>r.id==a.id);if(r)r.active=false;break;}
    case 'bg_save':this.stage.playing_battle_bg=a.bg;break;
    case 'balloon':this.call('procStageActionBalloon',a);break;
    case 'mission_card_use':if(this.call('checkMissionApply'))this.call('missionDispatch','BATTLE_CARD_USE',{card:a.cardInfo});break;
  }}this.b.stage_actions=[];}
  finishBattleActionOffline(options={}){const opts={...options,achievement_check:options.achievement_check??true,preview:options.preview??true,check_auto_available:options.check_auto_available??true},b=this.b,w=this.w;
    w.skillTriggeredCount=0;b.user_actions.push(...w.userActions);w.userActions=[];
    if(b.current_interrupt?.type==='EVENT'&&b.current_interrupt.event_res_id){const row=this.db.get('battle_event',b.current_interrupt.event_res_id);
      const choices=this.db.array(row.link_battle_event_option_id).map(id=>({id:this.db.get('battle_event_option',id).id,false_index_list:[]}));
      this.e.pushAction({id:b.last_action_id++,type:'action_battle_event',source_id:-1,msg:row.id,options:choices});
    }
    this.procStageActions();this.call('checkGameEnd');
    if(!opts.prev_game_end&&b.game_result!=='BATTLE_RESULT_TYPE_NONE'){
      this.call('resetAllTiperaCountOnBattleEnd');this.call('resetTiperaUnique3OnBattleEnd');this.call('resetAllOlgaCountOnBattleEnd');
    }
    let count=0,forcedTurnOver=false;
    while(b.forced_turn_over&&this.isMainPhase()){
      if(count>=200){this.call('ContentError','forced_turn_over_limit',{turn:b.turn});break;}count++;b.forced_turn_over=false;w.skillTriggeredCount=0;
      this.call('addDetailLog',{type:'log_skill_eff_turn_over',params:[],param_types:[]});this.e.pushAction({id:b.last_action_id++,type:'action_turn_over',source_id:-1});
      this.call('procEndOfTurn',opts.achievement_check);forcedTurnOver=true;this.procStageActions();
    }
    if(b.battle_step_mode?.reward?.length){const count=this.stage.simulation_content_info?.drop_count??1;
      for(let i=0;i<b.battle_step_mode.reward.length;i++){const item=b.battle_step_mode.reward[i];for(let j=0;j<count;j++){const row=this.db.table('battle')[item.battle_res_id];if(row)this.call('procDropReward',row,j+1,false,i===0&&j===0,item.wave);}}
      b.battle_step_mode.reward=undefined;
    }
    this.checkCards();return this.handleBattleEndOffline({...opts,forcedTurnOver});
  }
  handleBattleEndOffline(opts){let b=this.b;const w=this.w,gameEnd=!opts.prev_game_end&&b.game_result!=='BATTLE_RESULT_TYPE_NONE';
    // Search-only suspension, after all effects/checkCards and before preview.
    // Interrupts, forced turns, terminals and preview executors stay synchronous.
    if(this.e.deferCardPreview&&!w.isPreview&&!gameEnd&&!opts.forcedTurnOver&&this.isMainPhase()){
      this.e.deferCardPreview=false;this.e.pendingCardFinalization=opts;
      return {kind:'deferred_card_finalization'};
    }
    if(gameEnd&&(w.battleInitWorktable??this.e.state.worktables?.BattleInitWorktable)?.battle_init?.battle_res_id==='story_00044')this.call('applyStoryTutorialBattleRecovery');
    const omitted=[];if(!opts.makeLogs){
      this.call('getCardPreview',opts.preview_scope==='auto'?{scope:'auto'}:undefined);
      // The native preview replaces WT.battle through JSON restoration. Every
      // read after the call must use the new root, including outline and output.
      b=this.b;
      if(this.isMainPhase())for(const id of b.deck_info.hand){const preview=b.previewMap[id]?.[-1],c=b.cardMap[id];if(preview?.run_check_outline&&c&&!c.outline){c.outline=true;this.changed(id);}}
    }
    // Non-default guard mode requires the actual captured guard, never a default.
    const cleanup=opts.check_auto_available||this.call('getBattleExecutionGuard')?.cleanup_pending_removals==true;
    if(this.isMainPhase()&&cleanup){if(opts.check_auto_available)b.current_state=this.e.enums.LogicState.MainPhaseAutoAvailable;this.cleanupPendingRemovals();
      if(opts.check_auto_available){const last=b.action_blocks.at(-1),block={state:this.e.enums.LogicState.MainPhaseAutoAvailable,actions:[],id:last?.id??b.state_id++,turn:b.turn};b.action_blocks.splice(-1,1,block);block.actions=last?.actions??[];}
    }
    const output={kind:'offline_action_result',native_client_data_generated:false,omitted,
      current_state:b.current_state,
      stage_state:this.stage?.stage_state,battle_end:gameEnd,forced_turn_over:opts.forcedTurnOver,
      action_blocks:structuredClone(b.action_blocks),changeMap:structuredClone(w.changeMap),removeMap:structuredClone(w.removeMap)};
    if(!opts.skip_client_data)omitted.push('BattleInfoDataHelper.createClientData: native transport schema not serialized');
    if(!opts.not_clear_data&&!w.makeLogs){this.clearActionBlockOnFinish();if(!w.keepBattleLogs)b.battle_logs=[];}
    this.e.lastOfflineActionResult=output;this.e.record?.({kind:'offline_action_finalized',omitted,gameEnd});return output;
  }
}
