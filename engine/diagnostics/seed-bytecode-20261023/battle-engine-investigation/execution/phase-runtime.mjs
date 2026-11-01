// Independent hand port of BattleStateProc; retained source is
// ../turn-enemy/battle_state_proc/*.linear.js. No recovered function is executed.
// phase methods return the client's suspend/stop boolean, not success evidence.
import {MissingBattleRule} from './resource-store.mjs';
import {loadRowsByKey,selectMonsterPatternCard,baseMonsterTurnCount,relativeProbabilityIndex} from '../turn-enemy/monster-pattern-core.mjs';
const DPT_FIELDS=['damage','shield_damage','damage_taken','shield_damage_taken','damage_taken_by_monster','energy_used','draw_count','heal','overheal','heal_with_overheal','shield_gained'];
export class PhaseRuntime {
  constructor(e){this.e=e;this.b=e.b;this.wt=e.wt;this.L=e.enums.LogicState;}
  call(name,...args){return this.e.call(name,...args);}
  next(name,event=true){return this.call('setStateMain',{state:this.L[name],proc:true,event});}
  // 0x17e00 9..34,1755. Active wave creation remains a required continuation.
  checkNextWave(){return this.b.battle_step_mode?.next_wave?this.call('checkNextWave.active'):false;}
  // 0x2bf00. Offline iteration cap rejects a non-quiescent branch; the client
  // loop itself has no such guard. No unchanged-state heuristic is substituted.
  procMain(){
    const b=this.b,w=this.wt,L=this.L;let stop=false,iterations=0;
    while(!stop&&!b.game_end){
      if(++iterations>1000)throw new MissingBattleRule('offline_phase_iteration_budget');
      if(w.turn_over_first_turn){w.turn_over_first_turn=undefined;if(this.call('procEndOfTurn',true))break;continue;}
      if(w.turnEndHpPreviewing&&b.current_state==L.TIMING_PLAYER_SEQUENCE_START)break;
      this.e.record?.({kind:'phase',state:b.current_state,name:L[b.current_state]});
      switch(b.current_state){
        case L.TIMING_BATTLE_START: break;
        case L.TIMING_PLAYER_SEQUENCE_START:stop=this.procTimingPlayerSequenceStart();break;
        case L.TIMING_TURN_BEGIN:stop=this.procTimingTurnBegin();break;
        case L.TIMING_DRAW_BEFORE:stop=this.procTimingDrawBefore();break;
        case L.Draw:stop=this.procDraw();break;
        case L.TIMING_DRAW_AFTER:stop=this.procTimingDrawAfter();break;
        case L.AddEnergy:stop=this.procAddEnergy();break;
        case L.TIMING_ADD_ENERGY_AFTER:stop=this.procTimingAddEnergyAfter();break;
        case L.TIMING_SKILL_EFF_AFTER:case L.TIMING_USE_CARD_AFTER:case L.CardInterrupt:case L.EventInterrupt:
          // 0x2bf00@522..582 reports ContentError without throwing, marks the
          // save dirty, then runs the normal use-card finish continuation.
          // This path also occurs in previews made while a selection is open.
          {const dirty=w.uctx?.dirty??this.e.state.uctx?.dirty??this.e.state.runtimeInputs?.battleSaveDirty;
          if(!dirty)throw new MissingBattleRule('input.uctx.dirty.procMain',{state:b.current_state});
          dirty.battle_save=true;this.call('ContentError','err:invalid_state:'+b.current_state,{channel:'#server_report_dev2'});
          this.e.record?.({kind:'native-content-error',state:b.current_state,preview:w.isPreview});
          stop=this.procTimingUseCardFinish();break;}
        case L.TIMING_USE_CARD_FINISH:stop=this.procTimingUseCardFinish();break;
        case L.MainPhase:stop=this.procMainPhaseSettle();break;
        case L.TIMING_TURN_OVER_DISCARD_BEFORE:stop=this.procTimingTurnOverDiscardBefore();break;
        case L.Discard:stop=this.procDiscard();break;
        case L.TIMING_TURN_OVER_DISCARD_AFTER:stop=this.procTimingTurnOverDiscardAfter();break;
        case L.TIMING_TURN_OVER_FINISH:stop=this.procTimingTurnOverFinish();break;
        case L.TIMING_MON_SEQUENCE_START:stop=this.procTimingMonSequence();break;
        case L.TIMING_MON_TURN_BEGIN:stop=this.procTimingMonTurnBegin();break;
        case L.TIMING_MON_TURN_OVER_FINISH:stop=this.procTimingMonTurnOverFinish();break;
        case L.TIMING_MON_SKILL_EFF_AFTER:stop=this.next('MainPhase');break;
        case L.Win:case L.Lose:stop=true;break;
        default:return this.next('MainPhase');
      }
    }
    this.call('checkLastActionBlock');return w;
  }
  // 0x11e00; pending survives repeat-card interruption so counters and term
  // expiration are applied exactly once when this phase is resumed.
  procTimingTurnOverDiscardBefore(){
    const b=this.b;
    if(!b.turn_over_dis_before_pending){
      b.turn_over_dis_before_pending=true;
      this.call('pushBattleLog',{type:'turn_over',logs:[],params:[b.turn]});
      b.ignored_cs_monster_turn?.forEach(id=>{if(b.csMap[id])this.call('setIgnoreCS',id,true);});
      this.call('procCSTermByTurnDiscardBefore');
      b.turn_over_dis_before_mon_turn_sum=this.call('sumFieldMonsterTurnCount',b.monsters);
      this.call('sweepRetiredMonsters');
      b.monsters.sort((a,c)=>(a.mon_turn??Infinity)-(c.mon_turn??Infinity)||a.slot_idx-c.slot_idx);
      this.call('invalidateMonsterIdIndex');
      b.monsters.forEach(m=>{
        if(!this.call('isFieldMonster',m))return;
        if(m.mon_turn!=null&&m.mon_turn<=0)return;
        m.mon_turn=0;
        this.e.ports.pushAction({id:b.last_action_id++,type:'action_monster_turn_count',source_id:m.id,value:m.mon_turn});
      });
      this.e.ports.procUnitEvent('CONDITION_ALL_MONSTER_TURN_COUNT',[]);
      this.e.ports.procUnitEvent('CONDITION_ANY_MONSTER_TURN_COUNT',[]);
    }
    this.call('settleReactions',{interrupts:false});
    if(this.call('procCardRepeats'))return true;
    b.turn_over_dis_before_pending=false;b.turn_over_dis_before_mon_turn_sum=undefined;
    return this.next('Discard');
  }
  // 0x15400
  procDiscard(){
    const b=this.b;
    if(!b.turn_over_discard_pending){b.turn_over_discard_pending=true;this.call('disCardUsedPile');this.call('turnDiscard');}
    if(this.call('procCardRepeats'))return true;
    b.turn_over_discard_pending=false;b.turn_end_dmg=0;return this.next('TIMING_TURN_OVER_DISCARD_AFTER');
  }
  // 0x16000: addEnergy has absolute=true, source_id=0, turn_end=true.
  procTimingTurnOverDiscardAfter(){
    this.call('addEnergy',Math.max(0,Math.min(this.b.energy,this.call('checkEnergyMaintain'))),true,0,{turn_end:true});
    return this.next('TIMING_TURN_OVER_FINISH');
  }
  // 0x16e00
  procTimingTurnOverFinish(){
    this.b.ignored_cs_monster_turn?.forEach(id=>{if(this.b.csMap[id])this.call('setIgnoreCS',id,false);});
    return this.next('TIMING_MON_SEQUENCE_START');
  }
  // 0x1e300
  procTimingMonSequence(){
    if(this.checkNextWave())return this.next('TIMING_PLAYER_SEQUENCE_START');
    this.call('resetCurrentMonsterCursor');
    this.call('refreshRef','CONDITION_CHAR_TAKE_DMG_MAX_HP_PCT_TURN',undefined,true);
    this.b.monster_seq=true;this.call('removeMonShield');
    const fatal=this.call('checkFatalAttack');
    if(fatal.fatal&&fatal.target!=null&&fatal.owner!=null){
      this.e.ports.pushAction({id:this.b.last_action_id++,type:'action_fatal_attack',stress_death_char_res_id:fatal.target.res_id,card_res_id:fatal.owner.nextCard,source_id:fatal.owner.id});
      const stage=this.e.state?.worktables?.BattleStageWorktable??this.wt.battle_stage_worktable;
      if(stage){stage.battle_stage.fatal_end=true;stage.battle_stage.fatal_target_res_id=fatal.target.res_id;}
      if(this.b.finish_conditions.every(c=>!c.check_types.includes('BATTLE_FIN_DEFEAT'))){
        this.b.game_end=true;this.b.game_result='BATTLE_RESULT_TYPE_STAGE_FAILED';
      }
    }
    return this.next('TIMING_MON_TURN_BEGIN');
  }
  // 0x29700. Explicit false actioned is preserved after procPattern; undefined
  // becomes true. Do not replace this comparison with a truthiness check.
  procTimingMonTurnBegin(){
    if(this.checkNextWave())return this.next('TIMING_PLAYER_SEQUENCE_START');
    if(this.call('getCurrentMonsterCursorPos')<0)this.call('setCurrentMonsterCursorPos',0);
    const m=this.call('getCurrentMonster');if(m==null)return this.next('TIMING_PLAYER_SEQUENCE_START');
    if(!['death','run','summoned','changed','prop'].some(s=>s==m.state)&&m.actioned!=true){
      if(!this.b.monster_turn_end)this.call('monsterProcPattern',m,true);
      if(m.actioned!=false)m.actioned=true;
    }
    return this.next('TIMING_MON_TURN_OVER_FINISH');
  }
  // 0x2aa00
  procTimingMonTurnOverFinish(){
    if(this.checkNextWave())return this.next('TIMING_PLAYER_SEQUENCE_START');
    const pos=this.call('getCurrentMonsterCursorPos')+1;this.call('setCurrentMonsterCursorPos',pos);
    return this.next(pos>=this.b.monsters.length?'TIMING_PLAYER_SEQUENCE_START':'TIMING_MON_TURN_BEGIN');
  }
  // MonsterPattern.getCard 0xb700 integrates the previously independently
  // verified selector, preserving DB enumeration and a draw for singleton pools.
  monsterPatternGetCard(pattern,id,excludeCardId){
    const e=this.e,row=e.db.get('monster_pattern',pattern.pattern_id),unit=e.getUnit(id);
    const numeric=['card_use_limit','card_cont_use_limit','card_use_phase_limit','card_must_use_phase_turn','card_must_use_phase_cycle','card_priority','card_select_ratio'];
    const rows=loadRowsByKey(e.db.table('monster_pattern_card'),pattern.pattern_id).map(r=>{
      const x={...r};for(const key of numeric)x[key]=e.db.number(r,key);return x;
    });
    const selection=selectMonsterPatternCard({rows,pattern,patternType:row.pattern_type,unit,excludeCardId,
      nextRange:(min,max)=>e.random.randRange(0,min,max),checkStack:id=>e.call('checkStack',id),
      onDiagnostic:message=>e.ports.pushLog(message)});
    e.record?.({kind:'monster-pattern-choice',monster_id:id,pattern_id:pattern.pattern_id,branch:selection.branch,
      candidates:selection.eligibleRows.map(r=>r.card_link_monster_card_id),selected:selection.row.card_link_monster_card_id});
    return selection.row;
  }
  // MonsterProc.procPattern 0x20b00.
  monsterProcPattern(monster,immediate){
    const b=this.b,m=monster;if(!this.call('isFieldMonster',m))return;
    m.actioned=undefined;const card=m.nextCard;if(!card)return;
    if(m.currentCard){if(m.currentCard[0]==card)++m.currentCard[1];else{m.currentCard[0]=card;m.currentCard[1]=1;}}
    if(!m.isExtraCard)++b.monsterPattern[m.id].phaseCounter;m.isExtraCard=undefined;
    for(const key of ['usedCardPhase','usedCardBattle'])if(m[key]){if(card in m[key])++m[key][card];else m[key][card]=1;}
    this.e.ports.pushLog(m.id+' used card '+card);this.call('monsterProcCard',m,card);
    if(m.nextnextCard){
      this.monsterProcPatternPre(m,{extra_turn:true,extra_turn_immediate:immediate});
      if(immediate){
        m.isExtraCard=undefined;m.actioned=true;m.mon_turn=0;this.monsterTurnAction(m);
        this.call('monsterProcCard',m,m.nextCard,false,undefined,true);
        this.call('pushMonsterNoti',m.id,{card_res_id:'',noti_type:'N_LOADING'},true);this.call('checkGroggy',m.id,'N_LOADING');
      }
    }else if(m.actioned!=false){
      m.actioned=true;this.call('pushMonsterNoti',m.id,{card_res_id:'',noti_type:'N_LOADING'},true);this.call('checkGroggy',m.id,'N_LOADING');
      m.mon_turn=-1;this.monsterTurnAction(m);
    }
  }
  monsterTurnAction(m){this.e.ports.pushAction({id:this.b.last_action_id++,type:'action_monster_turn_count',source_id:m.id,value:m.mon_turn});}
  // MonsterProc.isAlwaysDamageFatal 0x15200.
  isAlwaysDamageFatal(m,hp,shield){
    if(m.alwaysDamage==null)return false;
    return m.alwaysDamage>=(hp??m.status.info.S_CURRENT_HP??0)+(shield??m.status.info.S_CURRENT_SHIELD??0);
  }
  // MonsterProc.procCardPre 0x21a00. "Pre" calculates the notice on this
  // worktable; it is not an instruction to clone or roll back formal RNG.
  // Separate external preview worktables require separate RNG ownership.
  monsterProcCardPre(m,resId,death){
    death??=false;const b=this.b,id=b.monsterCards[m.id+resId],card=b.cardMap[id];
    if(card==null)throw new MissingBattleRule('monster_preview_card_missing',{id,resId});
    m.refresh_noti=card.skill_eff_ids.some(id=>{
      const skill=b.skillMap[id],row=this.e.db.get('skill_eff',skill.res_id);
      return row.eff_value_type_1=='VALUE_CASTER_CUR_HP_PROPORTION_MULTIPLY'||row.eff_value_type_2=='VALUE_CASTER_CUR_HP_PROPORTION_MULTIPLY';
    });
    return this.call('procSkillEffsPre',card.skill_eff_ids,death);
  }
  // MonsterProc.procCard 0x23100. Effects execute under a temporary context
  // restored with finally, including when a missing rule rejects the branch.
  monsterProcCard(m,resId,passive,cardId,extraTurn){
    const b=this.b,w=this.wt,e=this.e;
    if(resId!=null){cardId=b.monsterCards[m.id+resId];if(cardId==null)return;}
    else if(cardId==null)throw new MissingBattleRule('invalid_monster_procCard',{id:m.id});
    const card=b.cardMap[cardId];if(card==null)return;
    const row=e.db.get('card',card.res_id);
    if(row.monster_noti_category!='none')this.call('pushBattleLog',{type:'monster_card',logs:[],params:[m.id,card.res_id]});
    const first=b.skillMap[card.skill_eff_ids[0]];
    if(first==null||e.db.get('skill_eff',first.res_id).eff=='SKILL_EFF_NONE'){
      if(b.usedCardMap[card.res_id]!=null)b.usedCardMap[card.res_id]=true;return;
    }
    const state=b.current_state,prev=b.state_id-1;
    this.call('setStateMain',{state:this.L.TIMING_MON_USE_CARD_AFTER,proc:!passive,event:!passive,interrupt:false});
    e.ports.pushLog('monster_use_card '+String(resId));
    if(b.usedCardMap[card.res_id]!=null)b.usedCardMap[card.res_id]=true;
    const ids=card.skill_eff_ids.slice(),order=e.db.array(row.eff_pick_pool_order).map(Number),ratios=e.db.array(row.eff_pick_pool_ratio).map(Number);
    const count=Math.max(1,e.db.number(row,'eff_pick_pool_count'))+(card.eff_pick_pool_count_add??0);
    if(order.length>0){
      if(order.length!=ratios.length)throw new MissingBattleRule('invalid_eff_pick_pool_lengths',{id:row.id});
      for(let i=0;i<count;i++){
        const selected=relativeProbabilityIndex(ratios,(a,c)=>e.random.randRange(0,a,c));
        if(isNaN(selected))throw new MissingBattleRule('invalid_eff_pick_pool_weights',{id:row.id});
        order.splice(selected,1);ratios.splice(selected,1);
      }
      for(let i=order.length-1;i>=0;i--)ids.splice(order[i],1);
    }
    const active=ids.filter(id=>!['OPERATION_PASSIVE','OPERATION_TRIGGER'].includes(e.db.get('skill_eff',b.skillMap[id].res_id).operation));
    const action={id:b.last_action_id++,type:'action_monster_card_use',source_id:m.id,card_res_id:card.res_id,play:passive,extra_turn:extraTurn};
    e.ports.pushAction(action);
    const previous=w.monster_card_using,context={is_passive:passive==true};w.monster_card_using=context;
    try{action.card_use_targets=this.call('procSkillEffs',active,{byCard:true,byMonster:true});}finally{w.monster_card_using=previous;}
    const stage=(e.state?.worktables?.BattleStageWorktable??w.battle_stage_worktable)?.battle_stage;
    if(stage?.assault_hardcore){
      if(this.call('getStatus',b.char.id,'S_CURRENT_HP')<=0||context.fatal_pending){
        if(stage.fatal_end&&!context.fatal_pending)return;
        if(context.fatal_pending&&!this.call('isFieldMonster',m)){
          e.ports.pushAction({id:b.last_action_id++,type:'action_fatal_auto_attack',source_id:-1});return;
        }
        const candidates=stage.chars.filter(c=>c.res_id>0&&!stage.leaved_chars?.includes(c.res_id));
        let target=candidates.find(c=>c.link_crash_on==true);
        if(!target)target=candidates[this.call('shuffleArray',0,candidates.map((_,i)=>i))[0]];
        e.ports.pushAction({id:b.last_action_id++,type:'action_fatal_attack',stress_death_char_res_id:target.res_id,card_res_id:card.res_id,source_id:m.id});
        stage.fatal_end=true;stage.fatal_target_res_id=target.res_id;
        if(b.finish_conditions.every(c=>!c.check_types.includes('BATTLE_FIN_DEFEAT'))){b.game_end=true;b.game_result='BATTLE_RESULT_TYPE_STAGE_FAILED';}
        return;
      }
    }
    e.ports.pushAction({id:b.last_action_id++,type:'action_monster_card_use_end',source_id:m.id});
    this.call('settleReactions',{interrupts:false});this.call('checkDeads',{proc_skill:true,proc_event:true,proc_interrupt:false});
    if(!passive)this.call('setStateMain',{state:this.L.TIMING_MON_SKILL_EFF_AFTER,proc:true,event:true,interrupt:false});
    else this.call('setStateMain',{state,proc:false,event:false,interrupt:false,check:undefined,prev});
    this.cardEvent('CONDITION_MONSTER_CARD_USE',0,card.id);
    if(!passive)this.cardEvent('CONDITION_MONSTER_ACTION_CARD_USE',0,card.id);
    this.call('applyChangeCS');this.call('settleReactions',{interrupts:false});
  }
  // MonsterProc.procPatternPre 0x1a100 with child predicates / preview damage
  // aggregation. Damage calculation remains a required downstream port.
  monsterProcPatternPre(m,options){
    const b=this.b,e=this.e;let changed=false;
    if(this.wt.isPreview)return changed;
    if(!options?.extra_turn&&b.monsters.findIndex(x=>x.id==m.id)<=this.call('getCurrentMonsterCursorPos'))return changed;
    if(m.state=='summoned'||!this.call('isFieldMonster',m))return changed;
    const {reselect=true,force_refresh=false,death=false,overwrite,force=false,except_before=false,extra_turn=false,extra_turn_immediate=false}=options??{};
    if(force||extra_turn)m.actioned=false;
    if(m.actioned){
      const id=this.monsterPatternGetCard(b.monsterPattern[m.id],m.id).card_link_monster_card_id;
      const card=e.db.table('card')[id],noti=card&&id&&card.monster_noti_category=='N_GROGGY'?{card_res_id:id,noti_type:card.monster_noti_category}:{card_res_id:'',noti_type:'N_LOADING'};
      this.call('checkGroggy',m.id,noti.noti_type);
      if(m.mon_turn!=null&&m.mon_turn>0){changed=true;m.mon_turn=-1;this.monsterTurnAction(m);}
      this.call('pushMonsterNoti',m.id,noti,force_refresh||reselect);m.nextCard=undefined;return changed;
    }
    let id,extra;
    if(overwrite){
      id=overwrite;const info=this.call('makeCardInfo',b.last_unit_id++,overwrite,m.id);
      b.monsterCards[m.id+overwrite]=this.call('createBattleCard',info,undefined).id;
    }else if(reselect&&!m.actioned){
      const pattern=b.monsterPattern[m.id];if(!pattern)throw new MissingBattleRule('invalid_monster_pattern',{id:m.id});
      if(extra_turn){id=m.nextnextCard;m.nextnextCard=undefined;}
      else{
        const selected=this.monsterPatternGetCard(pattern,m.id,except_before?m.nextCard:undefined);id=selected.card_link_monster_card_id;
        if(selected.extra_card_link_monster_card_id&&selected.extra_card_link_monster_card_id!='none')extra=selected.extra_card_link_monster_card_id;
        else{
          const stage=(e.state?.worktables?.BattleStageWorktable??this.wt.battle_stage_worktable).battle_stage;
          if(stage.cheat_info.monster_extra)extra=id;
        }
        if(b.enemy_turn){
          const card=e.db.get('card',id);
          if(e.db.array(card.link_skill_eff_id).some(id=>e.db.get('skill_eff',id).eff=='SKILL_EFF_DMG')&&m.nextCard){id=m.nextCard;extra=m.nextnextCard;}
        }
      }
      if(!extra_turn_immediate){
        const row=e.db.get('card',id),values=e.db.array(row.monster_turn_count).map(Number);
        if(values.some(x=>!Number.isFinite(x)))throw new MissingBattleRule('monster_turn_count_numeric',{id});
        let count=baseMonsterTurnCount(values,(a,c)=>e.random.randRange(0,a,c));
        if(count>=0){
          const passives=e.passives.query({source_id:m.id,type:'SKILL_EFF_MONSTER_TURN_COUNT_PASSIVE',is_card:false})
            .concat(e.passives.query({source_id:b.char.id,type:'SKILL_EFF_MONSTER_TURN_COUNT_PASSIVE',is_card:false}));
          passives.forEach(p=>{
            const blocked=this.call('getMonsterTurnCountBlockPassives',m.id,p.caster_id);
            if(this.call('checkMonsterTurnCountBlockedByPassives',blocked,p.caster_id))return;
            const row=e.db.get('skill_eff',p.res_id),next=this.call('procMathSign',row.eff_value_math_sign,count,this.call('calcValue',p.skill_id,m.id));
            if(this.call('checkMonsterTurnCountBlockedByPassives',blocked,p.caster_id,{is_increase:next>count,source_skill_id:p.skill_id,relic_only:true}))return;
            count=next;
          });
        }
        m.mon_turn=count>=0?count:undefined;changed=true;this.monsterTurnAction(m);
        e.ports.procUnitEvent('CONDITION_ALL_MONSTER_TURN_COUNT',[]);e.ports.procUnitEvent('CONDITION_ANY_MONSTER_TURN_COUNT',[]);
      }
    }else if(m.nextCard){id=m.nextCard;extra=m.nextnextCard;}else return changed;
    const card=e.db.get('card',id),preview=this.call('monsterProcCardPre',m,id,death);
    let noti={noti_type:card.monster_noti_category,card_res_id:id};m.noticeDamage=0;
    if(preview&&preview.length>0){
      const damage=[];
      preview.forEach(([target,info])=>{if(target==b.char.id&&info.damage!=null){damage.push(info.damage);m.noticeDamage+=info.damage;noti.dmg_attr=info.type;b.turn_end_dmg=(b.turn_end_dmg??0)+info.damage;}});
      noti.damage=damage;if(damage.length>1&&!card.monster_noti_category.endsWith('_M'))noti.noti_type=card.monster_noti_category+'_M';
    }
    if(e.passives.query({source_id:b.char.id,type:'SKILL_EFF_MONSTER_NOTI_UNKNOWN',is_card:false}).length>0)noti={card_res_id:'',noti_type:'N_UNKNOWN'};
    if(reselect&&noti.noti_type.includes('ATK'))e.ports.procUnitEvent('CONDITION_MONSTER_NOTICE_ATTACK',[]);
    if(extra)noti.extra_turn=true;if(extra_turn_immediate)noti.is_extra_action=true;
    this.call('pushMonsterNoti',m.id,noti,force_refresh||reselect,id,b.monsterCards[m.id+id]);this.call('checkGroggy',m.id,noti.noti_type);
    m.nextCard=id;m.nextnextCard=extra;if(extra_turn)m.isExtraCard=true;return changed;
  }
  // 0x08900
  procTimingTurnBegin(){
    this.checkNextWave();this.b.this_turn_used_cards=[];
    this.call('resetExhaustedFlag');this.call('removeShield');this.call('procCSTermByTurn');return this.next('AddEnergy');
  }
  // 0x09b00, 0x0a600, 0x0d600
  procTimingDrawBefore(){this.checkNextWave();if(this.b.turn==1)this.call('checkOpening');return this.next('Draw');}
  procDraw(){this.b.lead_checked=false;this.call('turnDraw');return this.next('TIMING_DRAW_AFTER');}
  procAddEnergy(){this.checkNextWave();this.call('addEnergyTurnBegin');return this.next('TIMING_ADD_ENERGY_AFTER');}
  // 0x0e000 (for-of intentionally observes appended elements).
  procMonsterUpdate(monsters){
    for(const m of monsters){
      if(m.state=='summoned')m.state='none';
      if(!this.call('isFieldMonster',m))continue;
      if(!(m.id in this.b.monsterPhase))this.call('createMonsterPhase',{monster:m,phase:m.start_phase});
      this.call('monsterProcPatternPre',m,{death:this.call('isAlwaysDamageFatal',m)});
      this.call('applyChangeCSPre');
    }
  }
  // 0x0f500
  procTimingAddEnergyAfter(){
    this.checkNextWave();this.call('resetCurrentMonsterCursor');this.call('sweepRetiredMonsters');
    this.b.monsters.sort((a,b)=>a.slot_idx-b.slot_idx);this.call('invalidateMonsterIdIndex');
    this.wt.previewPassiveMap.clear();this.wt.previewInactivePassives=[];this.wt.previewChangeCS={};
    this.procMonsterUpdate(this.b.monsters);return this.next('TIMING_DRAW_BEFORE');
  }
  // 0x0b100. Clear deferred lists before visiting them so newly deferred work
  // remains deferred. Motion insertion is stable for equal priority.
  procTimingDrawAfter(){
    const b=this.b;this.checkNextWave();this.call('checkLightDarkTurnStart');
    if(b.nextWaveDeferredAddTrig&&b.nextWaveDeferredAddTrig.length>0){
      const list=b.nextWaveDeferredAddTrig;b.nextWaveDeferredAddTrig=undefined;
      for(const x of list)this.e.ports.addSkillTriggered(x.skill_id,x.value,x.during,x.rita_value,x.trigger_cs_cause_skill_id,x.pyeonrin_trigger_group_id,x.trigger_snapshot);
    }
    if(b.nextWaveDeferredTrig&&b.nextWaveDeferredTrig.length>0){
      const list=b.nextWaveDeferredTrig;b.nextWaveDeferredTrig=undefined;
      for(const x of list){
        if(b.motionTrig==null)b.motionTrig=[];
        const pos=b.motionTrig.findIndex(y=>y.priority<x.priority);
        if(pos<0)b.motionTrig.push(x);else b.motionTrig.splice(pos,0,x);
      }
    }
    if(b.nextWaveDeferredCardUses&&b.nextWaveDeferredCardUses.length>0){
      const list=b.nextWaveDeferredCardUses;b.nextWaveDeferredCardUses=undefined;
      for(const x of list)if(b.cardMap[x.card_id]){x.target=-1;this.call('pushCardUse',x);}
    }
    this.call('settleReactions',{interrupts:false});b.player_turn=true;b.link_crash_block_started=undefined;
    if(b.amount_check_player_turn)this.call('procCardAmountEvent',b.amount_check_player_turn);
    this.e.timing.procTimingEvent('TIMING_PLAYER_TURN');this.call('checkLinkCrash');
    if(!b.lead_checked){b.lead_checked=true;this.call('checkLead');}
    return this.next('MainPhase');
  }
  // 0x10d00
  procTimingUseCardFinish(){
    if(this.call('procCardRepeats'))return true;
    this.b.using_card=false;this.call('checkLightDark');
    if(this.b.turn_over_dis_before_pending){this.b.using_card=false;return this.next('TIMING_TURN_OVER_DISCARD_BEFORE',false);}
    if(this.b.turn_over_discard_pending){this.b.using_card=false;return this.next('Discard',false);}
    return this.next('MainPhase');
  }
  // 0x2b400
  procMainPhaseSettle(){
    let stop=true;
    if(this.call('settleReactions'))this.b.next_state=this.L.MainPhase;
    if(this.b.current_interrupt.type!='NONE')return stop;
    if(this.call('procCardRepeats'))return stop;
    this.call('checkGameEnd');
    if(!this.b.game_end&&this.b.using_card){this.b.using_card=false;this.call('checkLightDark');stop=false;}
    if(this.call('procReservedTurnOver'))return true;
    if(!this.call('isMainPhase'))stop=false;
    return stop;
  }
  cardEvent(type,place,id){return this.call('procCardEvent',type,place,id);}
  amountEvents(place){this.cardEvent('CONDITION_CARD_AMOUNT',place,-1);this.cardEvent('CONDITION_CARD_AMOUNT_SET',place,-1);}
  // Worktable 0x200300.
  isCardUninteractible(id){
    const card=this.b.cardMap[id];if(!card)return false;if(card.talents?.includes(57))return true;
    return this.e.passives.query({source_id:card.id,type:'SKILL_EFF_CARD_TALENT',is_card:true,talent:57}).length>0;
  }
  // Worktable 0xd7c00: an empty used pile still produces the empty move action.
  disCardUsedPile(){
    const b=this.b;b.used_cards=[];const ids=[],length=b.deck_info.used.length;
    for(let i=0;i<length;i++)ids.push(b.cardMap[b.deck_info.used[i]].id);
    this.call('moveCards',{card_ids:ids,from:11,to:3,by_discard_used_pile:true});
    if(length==0)this.e.ports.pushAction({id:b.last_action_id++,type:'action_card_move',source_id:b.char.id,action_card:{cards:[],place_from:11,place_to:0,enemy_turn:b.enemy_turn}});
  }
  // Worktable 0xfbe00 + nested 0xfc700..0x101000. Talent numbers are pinned
  // by ../../card-pool-investigation/talent-enum.json; CARD_PLACE by its enum.
  turnDiscard(){
    const b=this.b,deck=b.deck_info,discard=[],removeIndices=[],exhaust=[];
    const globalRetain=this.e.passives.query({source_id:b.char.id,type:'SKILL_EFF_CARD_RETAIN',is_card:false});
    const retained=globalRetain.reduce((acc,p)=>{
      const ids=this.call('getTargetCards',p.skill_id,false,false,false).target_cards_id;
      acc.push(...ids.filter(id=>!acc.includes(id)));return acc;
    },[]);
    const length=deck.hand.length;
    for(let index=0;index<length;index++){
      const id=deck.hand[index],card=b.cardMap[id];if(this.call('isCardUninteractible',id))continue;
      const ethereal=this.e.passives.query({source_id:card.id,type:'SKILL_EFF_CARD_TALENT',is_card:true,talent:1});
      if(ethereal.length>0||card.talents?.includes(1)){
        if(ethereal.length>0)this.call('checkTermValuePassive',ethereal[0].skill_id,b.char.id);
        this.call('checkTermValue',id,'TERM_CARD_MOVE',b.char.id,true,{isWhole:true});
        removeIndices.push(index);exhaust.push(id);
        this.cardEvent('CONDITION_CARD_EXHAUST',2,id);this.cardEvent('CONDITION_CARD_TALENT_ETHEREAL',2,id);
      }else{
        const personal=this.e.passives.query({source_id:id,type:'SKILL_EFF_CARD_RETAIN',is_card:true});
        if(personal.length==0&&!card.talents?.includes(6)&&!card.talents?.includes(5)&&!retained.includes(id)){
          this.call('checkTermValue',id,'TERM_CARD_MOVE',b.char.id,true,{isWhole:true});
          removeIndices.push(index);discard.push(id);this.cardEvent('CONDITION_CARD_TURN_DISCARD',2,id);
        }else{
          this.call('addDetailLog',{type:'log_skill_eff_card_retain_turn_end',params:[[id]],param_types:['card_ids']});
          const has=id=>b.skillMap[id]?.eff_opts?.includes('trigger_retained');
          if(this.call('getAllCardSkillEffIds',card).some(has)||card.continueSkill?.some(id=>b.csMap[id]?.skillEffs.some(has)))
            card.trigger_retained_cnt=(card.trigger_retained_cnt??0)+1;
          this.cardEvent('CONDITION_CARD_RETAINED',0,id);
        }
      }
    }
    deck.discard=deck.discard.concat(discard);deck.exhaust=deck.exhaust.concat(exhaust);
    for(let i=removeIndices.length-1;i>=0;i--)deck.hand.splice(removeIndices[i],1);
    const action={id:b.last_action_id++,type:'action_card_turn_discard',source_id:b.char.id};
    if(discard.length>0||exhaust.length>0)this.e.ports.pushAction(action);
    for(const [ids,to,field,talentMethod] of [[discard,3,'action_card','procTalentFairy'],[exhaust,4,'action_card2','procTalentVallista']]){
      if(ids.length==0)continue;
      action[field]={cards:ids,place_from:2,place_to:to,enemy_turn:b.enemy_turn};
      ids.forEach(id=>{
        this.call('setCardPlace',id,to);this.call(talentMethod,id);
        this.cardEvent('CONDITION_CARD_MOVE_FROM_HAND',0,id);this.cardEvent('CONDITION_CARD_MOVE_TO',to,id);
        this.cardEvent('CONDITION_CARD_MOVE_TO_NOT_FROM_USED',to,id);
      });
      if(to===3)this.call('trimDiscardToLimit');
      this.amountEvents(to);
      if(to===4)this.call('addDetailLog',{type:'log_skill_eff_card_exhaust',params:[exhaust],param_types:['card_ids']});
    }
    this.amountEvents(2);this.cardEvent('CONDITION_CARD_AMOUNT_COMPARE',0,-1);b.use_card_count=0;
    this.e.ports.pushLog('Turn Discard');this.call('checkLightDark');this.call('checkRecallReserved');
  }
  // Worktable 0xd0400 + nested 0xd1200..0xd6f00. Only successful pushHand
  // consumes draw count; rejected target/restricted cards remain in the deck.
  turnDraw(withAction){
    withAction??=true;const b=this.b,w=this.wt,deck=b.deck_info;
    const init=(this.e.state?.worktables?.BattleInitWorktable??w.battleInitWorktable).battle_init;
    let amount=this.call('getBaseDraw');
    const decrease=this.e.passives.query({source_id:b.char.id,type:'SKILL_EFF_TURN_DRAW_DECREASE',is_card:false});
    if(!init.isPreBattle)decrease.forEach(p=>{amount-=this.call('calcValue',p.skill_id);this.call('checkTermValuePassive',p.skill_id,b.char.id);});
    if(init.isPreBattle){amount=deck.hand.length;deck.deck.unshift(...deck.hand);deck.hand=[];}
    if(withAction){
      const action={id:b.last_action_id++,type:'action_player_turn',source_id:-1},step=b.battle_step_mode;
      if(step?.type=='BATTLE_STEP_WAVE_MODE'){
        const count=step.battle_ids?.length??1;
        if(b.turn==1){action.value=0;action.value_temp=count;}
        else if(step.next_wave!=null){action.value=step.cur;action.value_temp=count;}
      }
      w.turn_start_action=action;this.e.ports.pushAction(action);
    }
    const drawn=[],targets=this.e.passives.query({source_id:b.char.id,type:'SKILL_EFF_TURN_DRAW_TARGET',is_card:false});
    const lastDraw=id=>b.cardMap[id]?.talents?.some(t=>t==58||t==59||t==60)??false;
    const candidates=()=>deck.deck.slice().sort((a,c)=>init.isPreBattle?0:Number(lastDraw(a))-Number(lastDraw(c)));
    let list=candidates(),count=0,iterations=0;
    while(count<amount){
      if(++iterations>10000)throw new MissingBattleRule('offline_turn_draw_iteration_budget');
      const id=list.shift();
      if(id==null){if(this.call('shuffleCard')){list=candidates();continue;}break;}
      const index=deck.deck.indexOf(id);if(index<0)continue;
      if(this.call('isRestricted',b.cardMap[id],'RESTRICT_DRAW'))continue;
      if(targets.length>0){
        const card=b.cardMap[id];
        const excluded=targets.some(p=>{
          const row=this.e.db.get('skill_eff',p.res_id);
          if(row.target_card_set!='CARD_SET_ALL_EXCEPT_DESIGNED')return false;
          return this.e.db.array(row.target_card_set_opt_multiple_link).includes(card.res_id);
        });
        const invalid=!targets.some(p=>{
          const row=this.e.db.get('skill_eff',p.res_id),types=this.e.db.array(row.target_card_set_card_type);
          return types.length>0?this.call('checkCategory',card.id,types):true;
        });
        if(excluded||invalid)continue;
      }
      if(!this.call('pushHand',id,{isDraw:true,preBattle:!withAction,turn_draw:true}))break;
      deck.deck.splice(index,1);++count;drawn.push(id);
    }
    targets.forEach(p=>this.call('checkTermValuePassive',p.skill_id,b.char.id));
    const action={id:b.last_action_id++,type:'action_card_turn_draw',source_id:b.char.id,
      action_card:{cards:drawn,place_from:1,place_to:2,enemy_turn:b.enemy_turn,hand_cards:this.call('sortHandCards',drawn.slice())}};
    if(drawn.length>0){
      if(!init.isPreBattle){
        w.lead_action={id:b.last_action_id++,type:'action_card_lead',source_id:-1};
        this.e.ports.pushAction(w.lead_action);this.e.ports.pushAction(action);
      }
      b.turn_draw_cards=drawn;
      if(withAction){
        drawn.forEach(id=>{this.call('setCardPlace',id,2,undefined,undefined,true);this.cardEvent('CONDITION_CARD_DRAW',1,id);this.cardEvent('CONDITION_CARD_TURN_DRAW',1,id);});
        this.amountEvents(1);
        drawn.forEach(id=>{this.cardEvent('CONDITION_CARD_MOVE_TO',2,id);this.cardEvent('CONDITION_CARD_MOVE_TO_NOT_FROM_USED',2,id);});
        this.amountEvents(2);this.cardEvent('CONDITION_CARD_AMOUNT_COMPARE',0,-1);
      }
    }
    this.e.ports.pushLog('Turn Draw');this.call('checkOrleaCreation');
    action.action_card.bind_cards=this.call('checkCardBind');this.call('checkLightDark');
  }
  getBaseDraw(){return Number(this.e.db.get('constant_meta','battle_base_draw_count').value);}
  // 0x20900: accounting is performed before incrementing turn; duration and
  // stress events run only after turn limits and previous/current DPT transfer.
  procTimingPlayerSequenceStart(){
    const b=this.b,w=this.wt;this.checkNextWave();b.timing_pre_turn=true;b.sereniel_draw_triggered=false;
    const tip=b.tipera_unique_3_tracking;
    if(tip){
      if(tip.turn_triggered){
        tip.used_card_indices=[];this.call('addTiperaIconAction',[]);
        const id=this.call('getContinueSkills',b.char).find(id=>b.csMap[id]?.res_id=='cs00_0327');
        if(id!=null)this.call('removeContinueSkill',id,b.char.id,false);
      }
      tip.turn_triggered=false;
    }
    b.monsters.forEach(m=>m.actioned=undefined);this.call('recoverEgoBreak');
    const d=b.dpt;
    for(const key of DPT_FIELDS)d['total_'+key]+=d[key];
    if(d.damage>d.max_damage)d.max_damage=d.damage;
    if(d.damage_taken_by_monster>d.max_damage_taken_by_monster)d.max_damage_taken_by_monster=d.damage_taken_by_monster;
    if(b.turn>=1)d.damage_taken_by_monster_per_turn.push(Math.round(d.damage_taken_by_monster));
    const init=(this.e.state?.worktables?.BattleInitWorktable??w.battleInitWorktable)?.battle_init;
    const stage=(this.e.state?.worktables?.BattleStageWorktable??w.battle_stage_worktable)?.battle_stage;
    if(!init||!stage)throw new MissingBattleRule('phase_initialization_worktables');
    const record={battle_res_id:init.battle_res_id,area_id:init.area_id??0,floor:init.floor,spot_type:init.spot_type??'',turn:b.turn,
      damage_dealt:d.damage,damage_taken:d.damage_taken,damage_taken_by_monster:Math.round(d.damage_taken_by_monster),
      shield_gained:d.shield_gained,heal_gained:d.heal,overheal_gained:d.overheal,heal_with_overheal_gained:d.heal_with_overheal,
      remaining_hp:b.char.status.info.S_CURRENT_HP??0,max_hp:b.char.status.info.S_HP??0,char_stats:this.call('buildTurnRecordCharStats')};
    if(init.link_encounter_id)record.encounter_id=init.link_encounter_id;
    record.stage_enter_time=init.stage_enter_time??0;
    if(this.call('shouldRecordTurnInStage')){if(!stage.turn_records)stage.turn_records=[];stage.turn_records.push(record);}
    else if(stage.turn_records!==undefined)stage.turn_records=undefined;
    const firstEnterTime=init.first_enter_time??init.stage_enter_time??0;
    const contentId=stage.hyperspace_info?.hyperspace_content_list_id??stage.disaster_boss_rank_info?.rank_list_id??stage.remnants_boss_penalty_info?.list_id??(stage.step_mode_stage?.res_id!=null?String(stage.step_mode_stage.res_id):undefined);
    const stepType=b.battle_step_mode?.type;
    const isStep=stepType==='BATTLE_STEP_WAVE_MODE'||stepType==='BATTLE_STEP_BOSS_MODE';
    const content=contentId||isStep?{...(contentId?{content_id:contentId}:{}),...(isStep?{is_step_mode_stage:true}:{})}:undefined;
    // Adapter supplies external cache context; no user/account identifiers are
    // needed by this independent battle state and none are fabricated here.
    this.call('pushTurnRecordOffline',firstEnterTime,structuredClone(record),content,stage.stage_id);
    this.e.ports.pushAction({id:b.last_action_id++,type:'action_dpt_info',source_id:b.turn,dpt_info:structuredClone(d)});
    ++b.turn;
    if(!w.makeLogs&&!w.test&&!w.isPreview){
      if(stage.hyperspace_info)this.e.record?.({kind:'client-noop',method:'MissionConditionProc.dispatch',event:'HYPER_SPACE_TURN_END'});
      if(stage.story_simulation_info)this.e.record?.({kind:'client-noop',method:'MissionConditionProc.dispatch',event:'STORY_NODE_TURN_END'});
    }
    for(const [field,method] of [['disaster_boss_rank_info','getDisasterBossRankTurnLimit'],['remnants_boss_penalty_info','getRemnantsBossPenaltyTurnLimit']]){
      if(stage[field]){const limit=this.call(method);if(limit!==undefined&&b.turn>limit){b.turn=limit;b.game_end=true;b.game_result='BATTLE_RESULT_TYPE_STAGE_CLEAR';return true;}}
    }
    if(this.call('applyFailCountTurnLimit',false))return true;
    for(const key of DPT_FIELDS)d['prev_'+key]=d[key];
    d.prev_char_stats=structuredClone(d.char_stats);
    for(const key of DPT_FIELDS)d[key]=0;
    this.call('initDptCharStats');
    if(b.turn!=1){
      this.call('pushBattleLog',{type:'turn_start',logs:[],params:[b.turn]});
      const rage=this.call('getRageDiff');if(rage!=null&&rage>=0)this.call('addDetailLog',{type:'log_monster_rage',params:[],param_types:[]});
    }
    this.e.timing.procTimingEvent('TIMING_TURN');this.e.timing.procTimingEvent('TIMING_TURN_WAVE_RESET');
    this.call('refreshRef','CONDITION_CHAR_HP_TURN_START');this.call('refreshRef','CONDITION_CHAR_TAKE_DMG_MAX_HP_PCT_TURN');
    b.monster_seq=false;this.e.timing.procTimingEvent('TIMING_PLAYER_TURN');
    this.call('addEPwithCheckPassive',this.call('constantMetagame',b.battle_step_mode?'tp_simulation_gen_turn_start':'tp_gen_turn_start'),true);
    this.call('procTurnStartStressAction');return this.next('TIMING_TURN_BEGIN');
  }
}
