// Static hand ports of BattleWorktable death handling. Source and exact scope:
// evidence/death-outcome/*.linear.js and HANDPORT-SCOPE.md. Never run target JS.
import {MissingBattleRule} from './resource-store.mjs';
import {roundGame,floorGame} from '../effects/effect-arithmetic.mjs';
export class DeathRuntime {
  constructor(e){this.e=e;this.b=e.b;this.w=e.wt;}
  call(n,...a){return this.e.call(n,...a);}
  query(id,type){return this.call('getPassiveByType',{source_id:id,type:'SKILL_EFF_'+type,is_card:false});}
  unitEvent(type,params){return this.call('procUnitEvent',type,params);}
  get stage(){return this.e.state.worktables.BattleStageWorktable.battle_stage;}
  isMultiHpNotKillDead(d){if(d.by==='kill'||!this.e.getMonster(d.source_id))return false;const m=this.e.getUnit(d.source_id,true);return !!m&&this.e.db.table('monster')[m.res_id]?.grade==='GRADE_MULTI_HP';}
  // checkDeath's native helper always returns true on every reachable path.
  checkDeads(options){
    const ds=this.b.deads;let logType,ids=[];
    const flush=()=>{if(logType)this.call('addDetailLog',{type:logType,params:[ids.slice()],param_types:[this.call('getLogParamType','monster_ids')]});};
    for(const d of ds){if(d.detail_logged||this.isMultiHpNotKillDead(d))continue;d.detail_logged=true;
      const type=this.query(d.source_id,'HALF_DEAD_ABLE').length?'log_half_death':'log_skill_eff_kill';
      if(type===logType)ids.push(d.source_id);else{flush();logType=type;ids=[d.source_id];}}
    flush();
    const state=()=>this.call('setStateMain',{state:this.e.enums.LogicState.proc_death_event,proc:options?.proc_skill??false,event:options?.proc_event??false,interrupt:options?.proc_interrupt??false});
    if(ds.length>1){state();while(ds.length){const d=ds.shift();if(d!=null){this.onDeath(d);this.procCasterDeadCSTerm(d.source_id);}}return true;}
    if(ds.length===1){const d=ds.shift();if(d){state();this.onDeath(d);this.procCasterDeadCSTerm(d.source_id);return true;}}
    return false;
  }
  procCasterDeadCSTerm(id){
    if(this.e.getUnit(id,true)?.state!=='death')return;
    for(const csid of this.b.caster_dead_term_cs_map?.[id]?.slice()??[]){const cs=this.b.csMap[csid];
      if(!cs||cs.removed)this.call('unregisterCasterDeadTermCS',id,csid);
      else this.call('checkTermValue',cs.owner_id,'TERM_CASTER_DEAD_WHOLE',id,cs.isCard,{isWhole:true,exact_cs_id:csid,force_termination:true});}
  }
  healAction(id,value,max){this.e.pushAction({id:this.b.last_action_id++,source_id:id,type:'action_heal',action_list:[{action_units:[[id,{heal:value,old_hp:0,new_hp:value,max_hp:max}]]}]});}
  onDeath(d,action=true){
    action??=true;const id=d.source_id,by=d.by,killer=d.killer,ev=d.deadEvent;
    this.w.deaths.push(id);
    const revives=this.query(id,'REVIVE');
    if(revives.length){const p=revives[0];this.call('setStatus',id,'S_CURRENT_HP',0);
      const max=this.call('getStatus',id,'S_HP'),value=this.call('calcValue',p.skill_id),opts=p.eff_opts??[];
      const hp=opts.includes('before_hp_multiply')?Math.min(d.prevHP*value,max):opts.includes('fixed_value')?value:roundGame(max*value/100);
      if(opts.includes('monster_turn_end')&&this.b.enemy_turn)this.b.monster_turn_end=true;
      this.healAction(id,hp,max);this.call('setStatus',id,'S_CURRENT_HP',hp);
      if(p.skill_id in this.b.egoActionMap){const ego=this.b.egoActionMap[p.skill_id];this.e.pushAction({id:this.b.last_action_id++,type:'action_ego_active',source_id:ego.char_id,ego_skill_res_id:ego.ego_skill_res_id});if(this.w.isPreview)this.w.triggeredList.ego.push([ego.ego_skill_res_id,ego.char_id]);}
      this.call('checkTermValuePassive',p.skill_id,killer);if(ev)ev.not_killed=true;return;
    }
    if(id===this.b.char.id){
      if(this.b.battle_step_mode==null&&!this.call('isStory')&&!ev?.non_psychosis_mode_end){
        if(!this.call('isLinkCrashed')){if(this.b.player_turn==true)this.call('applyHPLinkCrash');}
        else if(!this.b.link_crash_block_started)this.playerDeath(d,action);
      }else this.playerDeath(d,action);
      this.call('pushLog',id+' dead');return;
    }
    const m=this.e.getUnit(id,true);
    if(this.onBossModeDeath(m,ev))return;
    if(m&&!['changed','death'].includes(m.state)){
      const row=this.e.db.table('monster')[m.res_id];
      if(row?.grade==='GRADE_MULTI_HP'&&by!=='kill'){
        const max=this.call('getStatus',id,'S_HP');this.call('setStatus',id,'S_CURRENT_HP',0,{trigger:false});
        if(action)this.healAction(id,max,max);this.call('setStatus',id,'S_CURRENT_HP',max,{trigger:false});if(ev)ev.not_killed=true;return;
      }
      const half=this.query(id,'HALF_DEAD_ABLE');
      if(half.length&&by!=='kill'){
        m.state=half[0].eff_opts?.includes('keep')?'keep_half_death':'half_death';
        const removed=this.call('getContinueSkills',m).filter(csid=>{const cs=this.b.csMap[csid];if(!cs)return false;const r=this.e.db.get('cs',cs.res_id);return this.call('baseDebuffType',r.cs_buff_type)&&['SHOW_TYPE_ICON','SHOW_TYPE_ICON_OUTLINE'].includes(r.show_type)&&r.ui_expose_icon_type!=='EXPOSE_ICON_PASSIVE';});
        removed.forEach(csid=>this.call('removeContinueSkill',csid,id,false));
        if(action)this.e.pushAction({id:this.b.last_action_id++,type:'action_monster_half_death',source_id:id});
        for(const t of ['CONDITION_MONSTER_AMOUNT','CONDITION_MONSTER_AMOUNT_SET','CONDITION_CHAR_CS_AMOUNT','CONDITION_OWN_CHAR_CS_AMOUNT'])this.unitEvent(t,[]);
        if(ev)ev.not_killed=true;
      }else{
        if(ev)this.b.last_dmg_event=ev;
        if(this.w.isPreview&&(d.card_id==this.w.isPreview||d.trigger_cause_card_id==this.w.isPreview)){this.w.triggeredList.fatal=true;if((m.summoner??-1)==-1)this.w.triggeredList.fatal_except_creature=true;}
        this.call('addEPwithCheckPassive',this.call('constantMetagame',this.b.battle_step_mode?'tp_simulation_gen_monster_kill':'tp_gen_monster_kill'));
        if(this.call('checkMissionApply'))this.call('missionDispatch',{event:'KILL_MONSTER',battle_worktable:this.w,monster_id:m.res_id});
        this.unitEvent('CONDITION_CHAR_DEAD',[id,by]);m.state='death';
        if(String(row?.link_model_define_id)==='3000383')for(const part of this.b.monsters){if(['death','run','changed'].includes(part.state))continue;if(['3000389','3000390'].includes(this.e.db.table('monster')[part.res_id]?.link_model_define_id?.toString()))part.state='death';}
        if(killer==this.b.char.id||this.b.chars.some(c=>c.id==killer)||this.b.assault_fourth_char&&this.b.assault_fourth_char.id==killer){
          ++this.b.monsterKill;this.unitEvent('CONDITION_CHAR_KILL_MONSTER',[this.b.char.id,m.id,d.card_id,d.all_attack]);}
        if(action){
          if(by==='summoner'){if(m.drop)this.w.last_dead_mon=m.id;this.e.pushAction({id:this.b.last_action_id++,type:'action_monster_summon_death',source_id:id});}
          else{if(!m.summoner||m.drop){this.w.last_dead_mon=m.id;if(this.b.game_end)this.refreshLastDeadMonsterForBattleEnd();}
            const a={id:this.b.last_action_id++,type:'action_monster_death',source_id:id};this.e.pushAction(a);this.b.last_death_action=a;}
        }
        for(const t of ['CONDITION_MONSTER_AMOUNT','CONDITION_MONSTER_AMOUNT_SET','CONDITION_CHAR_FRONT_EMPTY'])this.unitEvent(t,[]);
        const copy=this.query(this.b.char.id,'COPY_CS_TO_RANDOM_PCT').concat(this.query(id,'COPY_CS_TO_RANDOM_PCT'));
        if(copy.length)this.copyDeathCS(m,copy);
        this.removeMonsterCsWithCleanup(m);
        for(const t of ['CONDITION_CHAR_CS_AMOUNT','CONDITION_OWN_CHAR_CS_AMOUNT'])this.unitEvent(t,[]);
        if(m.creatures){const dead=[];m.creatures.forEach(cid=>{const c=this.e.getUnit(cid);if(!['death','run','changed'].includes(c.state)&&!['TYPE_CREATURE_BATTLE_END','TYPE_CREATURE_IRRELEVENT'].includes(c.creature_type)){dead.push(c.id);c.state='death';}});
          this.call('addDetailLog',{type:'log_skill_eff_kill',params:[m.creatures],param_types:[this.call('getLogParamType','monster_ids')]});
          this.w.last_dead_summons=dead;this.e.pushAction({id:this.b.last_action_id++,type:'action_monster_summon_death',target_id:dead,source_id:m.id});}
      }
      if(m.lastDamageEvent)m.lastDamageEvent.last=true;
      if(this.b.game_end)this.refreshLastDeadMonsterForBattleEnd();this.call('refreshMonsterNoti');
    }
    this.call('pushLog',id+' dead');
  }
  // WT0x16e600. The base resource remains a target alongside the current
  // replacement. CYCLE and INFINITE change only the step-resource lookup.
  isBossModeTargetMonster(res){const step=this.b.battle_step_mode;if(step?.type!=='BATTLE_STEP_BOSS_MODE')return false;const row=this.e.db.get('boss_mode_stage_component',this.stage.step_mode_stage.res_id),max=step.max??3;let index=step.cur;if(index>=max){if(row.boss_type==='CYCLE')index=step.cur%max;else if(row.boss_type==='INFINITE')index=max-1;}return res==row.target_link_monster_id||res==row['step'+index+'_target_link_monster_id'];}
  // onDeath1428..5472 and callbacks240..246. True means native returned before
  // the ordinary death/event/statistics branch; terminal NORMAL falls through.
  onBossModeDeath(monster,event){const b=this.b,step=b.battle_step_mode;if(step?.type!=='BATTLE_STEP_BOSS_MODE'||!this.stage.step_mode_stage||!monster)return false;
    const row=this.e.db.get('boss_mode_stage_component',this.stage.step_mode_stage.res_id);if(!this.isBossModeTargetMonster(monster.res_id))return false;const max=step.max??3;
    let disasterClear=false;const rank=this.stage.disaster_boss_rank_info;if(rank&&rank.stage_index==1){const list=this.e.db.get('disaster_boss_rank_list',rank.rank_list_id),define=this.e.db.get('disaster_boss_rank_define',list.link_disaster_boss_rank_define_id);disasterClear=(step.cur??0)+1>=Number(define.phase_2_kill_count??5);}
    if(row.boss_type==='NORMAL'&&!(step.cur+1<max)){step.cur=max;return false;}
    ++step.cur;monster.state=disasterClear?'death':'half_death';if(disasterClear)this.call('clearUnitNameOverride',monster.id);this.w.phaseTriggered=[];b.interrupts=undefined;
    b.monsterPhase[monster.id]?.stacks.forEach(id=>this.call('procRemoveStack',id));b.monsterPattern[monster.id]?.stacks.forEach(id=>this.call('procRemoveStack',id));this.call('pushLog',monster.id+' dead');
    this.call('addEPwithCheckPassive',this.call('constantMetagame','tp_simulation_gen_monster_kill',{def_value:20}));delete b.monsterPhase[monster.id];let index=step.cur,reset=false;
    if(index>=max){if(row.boss_type==='CYCLE'){index=step.cur%max;reset=true;}else if(row.boss_type==='INFINITE'){index=max-1;reset=true;}}
    if(monster.creatures){const dead=[];for(const id of monster.creatures){const unit=this.e.getUnit(id);if(!['death','run','changed'].includes(unit.state)&&!['TYPE_CREATURE_BATTLE_END','TYPE_CREATURE_IRRELEVENT'].includes(unit.creature_type)){dead.push(unit.id);unit.state='death';}}
      this.call('addDetailLog',{type:'log_skill_eff_kill',params:[monster.creatures],param_types:[this.call('getLogParamType','monster_ids')]});this.w.last_dead_summons=dead;this.e.pushAction({id:b.last_action_id++,type:'action_monster_summon_death',target_id:dead,source_id:monster.id});}
    if(!disasterClear){this.e.pushAction({id:b.last_action_id++,type:'action_boss_step',source_id:monster.id,value:index,value_temp:step.cur});b.turn_wave_reset=b.turn;
      if(reset){step.next_wave=true;this.call('procMotionSkillTriggered');step.next_wave=undefined;}
      let next=monster;const res=row['step'+index+'_target_link_monster_id'];if(res&&res!=='none'){
        next=this.call('createMonster',{worktable:this.w,monster_res_id:res,coord:monster.slot_idx,originMonster:monster,hpPct:0,ps:monster.ps,ps_offset:monster.ps_offset,assault_slot_ps:monster.assault_slot_ps});this.call('setStatus',next.id,'S_CURRENT_HP',0);monster.state='death';next.state='half_death';
        const info=next.status.info;this.e.pushAction({id:b.last_action_id++,type:'action_monster_change',source_id:monster.id,action_monster_new:[{old_id:monster.id,new_id:next.id,index:next.slot_idx,hp:info.S_CURRENT_HP,max_hp:info.S_HP,shield:info.S_CURRENT_SHIELD,coord:next.pos,coord_dx:next.coord_dx,ego_field_value:next.ego_field_value,ego_field_max_value:next.ego_field_max_value}],play:true});next.summoner=monster.id;
        const primary=[],other=[];for(const id of this.call('getContinueSkills',monster)){const cs=b.csMap[id];if(!cs)continue;if(reset&&this.call('baseDebuffType',this.e.db.get('cs',cs.res_id).cs_buff_type)){this.call('removeContinueSkill',id,monster.id,false,{noti:false});continue;}(cs.res_id==='cs00_0194'?primary:other).push(id);}
        for(const id of other.concat(primary)){const cs=b.csMap[id];if(!cs)continue;this.call('procAddCS',next.id,cs.res_id,cs.term_value,cs.caster_id==monster.id?next.id:cs.caster_id,false,'MATHSIGN_ADD',false,true,cs.char_id==monster.id?next.id:cs.char_id,cs.skill_added,{isAuto:true,ignoreCond:true,noti:false,origin:cs.origin});this.call('removeContinueSkill',id,monster.id,false,{noti:false});}
      }else if(reset)for(const id of this.call('getContinueSkills',next)){const cs=b.csMap[id];if(cs&&this.call('baseDebuffType',this.e.db.get('cs',cs.res_id).cs_buff_type))this.call('removeContinueSkill',id,next.id,false,{noti:false});}
      next.state='none';next.drop=true;const hp=next.status.info.S_HP;this.call('setStatus',next.id,'S_CURRENT_HP',hp);this.e.pushAction({id:b.last_action_id++,type:'action_heal',source_id:next.id,action_list:[{action_units:[[next.id,{heal:hp,old_hp:0,new_hp:hp,max_hp:hp}]]}],play:false});const pattern=this.e.db.get('monster_pattern_set',row['step'+index+'_link_monster_pattern_set_id']);this.call('createMonsterPhase',{monster:next,phase:this.e.db.number(pattern,'phase')});if(b.enemy_turn)next.actioned=true;this.call('monsterProcPatternPre',next);if(event)event.not_killed=true;
    }
    if(disasterClear){b.interrupts=undefined;b.block_interrupt=true;if(!b.check_end)b.game_end=true;b.game_result='BATTLE_RESULT_TYPE_STAGE_CLEAR';}return true;
  }
  // onDeath callbacks251..253 (0x180000..0x180f00). A CS can be copied only
  // once across the combined player/deceased passive list. Each passive still
  // consumes its term, including when no matching source CS remains.
  copyDeathCS(monster,passives){const targets=this.b.monsters.filter(m=>m.id!==monster.id&&!['death','run','changed','prop'].includes(m.state)&&m.status.info.S_CURRENT_HP>0);if(!targets.length)return;const copied=[];
    for(const passive of passives){for(const id of this.call('getContinueSkills',monster)){if(copied.includes(id))continue;const cs=this.b.csMap[id];if(!cs||!passive.link_cs_ids?.includes(cs.res_id))continue;copied.push(id);const target=this.e.random.randomArrayMember(0,targets),value=floorGame(cs.term_value*this.call('calcValue',passive.skill_id)/100);this.call('procAddCS',target.id,cs.res_id,value,cs.caster_id,false,'MATHSIGN_ADD',false,false,cs.char_id,passive.skill_id);}
      this.call('checkTermValuePassive',passive.skill_id,this.b.char.id);
    }
  }
  playerDeath(d,action){this.b.char.state='death';this.unitEvent('CONDITION_CHAR_DEAD',[d.source_id,d.by]);this.b.block_interrupt=true;
    if(action)this.e.pushAction({id:this.b.last_action_id++,type:'action_user_death',source_id:d.source_id});
    this.e.getUnit(d.source_id).state='death';if(this.b.char.lastDamageEvent)this.b.char.lastDamageEvent.last=true;this.call('checkGameEnd');}
  removeMonsterCsWithCleanup(m){
    m.continueSkill.forEach(id=>this.call('removeCsWithCleanup',id));m.continueSkill=[];m.passive=[];
    if(this.call('getContinueSkills',m).length){const ids=this.b.pendingDeadMonsterCsCleanup??=[];if(!ids.includes(m.id))ids.push(m.id);}
    const cards=new Set();for(const k in this.b.monsterCards){const id=this.b.monsterCards[k],c=this.b.cardMap[id];if(c&&c.char_id==m.id){cards.add(id);delete this.b.monsterCards[k];}}
    const p=this.b.monsterPattern[m.id];if(p){p.stacks.forEach(id=>{if(id>=0)this.call('procRemoveStack',id);});p.passive_card_ids?.forEach(id=>cards.add(id));delete this.b.monsterPattern[m.id];}
    const phase=this.b.monsterPhase[m.id];if(phase){phase.stacks.forEach(id=>{if(id>=0)this.call('procRemoveStack',id);});delete this.b.monsterPhase[m.id];}
    cards.forEach(id=>this.removeCard(id));
  }
  // BattleCardProc.Remove 0x64a00 detaches effects; it does NOT delete cardMap.
  removeCard(id){const c=this.b.cardMap[id];c.continueSkill?.slice().forEach(cs=>this.call('removeContinueSkill',cs,c.id,true));c.continueSkill=undefined;
    if(c.stack_use)this.call('procRemoveStack',c.stack_use,true);
    c.skill_eff_ids.forEach(s=>{this.call('removePassiveSkillBySkillID',s,id,true);this.call('removeSkill',s,true);});c.skill_eff_ids=[];}
  canUseMonsterAsLastBattleEndDeath(id){const m=this.e.getMonster(id);return !!m&&(!m.summoner||!!m.drop);}
  isBattleEndLethalDamageEvent(v){return 'new_hp' in v&&'damage' in v&&!v.not_killed&&v.last==true&&v.new_hp!=null&&v.new_hp<=0;}
  canUseLethalDamageAsLastBattleEndDeath(id,v){if(!this.canUseMonsterAsLastBattleEndDeath(id)||!this.isBattleEndLethalDamageEvent(v))return false;const m=this.e.getUnit(id,true);return !!m&&!['GRADE_BOSS','GRADE_ELITE','GRADE_GIANT'].includes(this.e.db.table('monster')[m.res_id]?.grade);}
  findLastBattleEndDeathByActionOrder(){let last,half;const seen=new Set();for(const block of this.b.action_blocks)for(const a of block.actions){
    if(a.action_list)for(const l of a.action_list)for(const [id,v]of l.action_units){if(!seen.has(id)&&this.canUseLethalDamageAsLastBattleEndDeath(id,v)){seen.add(id);last=id;}}
    if(a.type==='action_monster_half_death'){const m=this.e.getUnit(a.source_id,true);if(['half_death','keep_half_death'].includes(m?.state)&&this.canUseMonsterAsLastBattleEndDeath(a.source_id))half=a.source_id;}
    else if(a.type==='action_monster_death'&&!seen.has(a.source_id)&&this.canUseMonsterAsLastBattleEndDeath(a.source_id)){seen.add(a.source_id);last=a.source_id;}}
    return last??half;
  }
  refreshLastDeadMonsterForBattleEnd(){const id=this.findLastBattleEndDeathByActionOrder();if(id!=null)this.w.last_dead_mon=id;this.b.last_dead_mon_battle_end=this.w.last_dead_mon;}
}
