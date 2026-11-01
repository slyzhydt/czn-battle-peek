// Static hand ports: battle_worktable.checkGameEnd 0x1a5d00,
// applyFailCountTurnLimit 0x1a3800; battle_custom_finish_helper.checkFinish.
// Terminal and wave-finish routing are hand ported below. Spawning the next
// wave is a separate phase-runtime port, not part of checkGameEnd.
import {MissingBattleRule} from './resource-store.mjs';
export class OutcomeRuntime {
  constructor(e){this.e=e;this.b=e.b;this.wt=e.wt;}
  get stage(){const s=this.e.state.worktables?.BattleStageWorktable?.battle_stage;if(!s)throw new MissingBattleRule('BattleStageWorktable.battle_stage');return s;}
  get init(){return this.e.state.worktables.BattleInitWorktable.battle_init;}
  // BattleCustomFinish initializer0x7000; BCF_DEFINE0x6000 is the literal
  // default1/default2. Helper createByResId0x5200, table0xec00, encounter0x7100.
  createBattleCustomFinish(res){const finish={check_types:[],result_type:'BATTLE_RESULT_TYPE_NONE',check_targets:[],check_options:[],check_values:[],result_option:'',check_andor:0,skip_result:false,res_id:res,enc_trigger:[],from_encounter:false,finish_pose:'STOP'};
    if(res==='default1'){finish.check_types.push('BATTLE_FIN_TYPE_USER_HP_0');finish.result_type=this.stage.disaster_boss_rank_info?'BATTLE_RESULT_TYPE_STAGE_CLEAR':'BATTLE_RESULT_TYPE_STAGE_FAILED';finish.check_targets.push('none');}
    else if(res==='default2'){finish.check_types.push('BATTLE_FIN_TYPE_ENEMY_DEFEAT_ALL');finish.result_type='BATTLE_RESULT_TYPE_REWARD';finish.check_targets.push('none');if(this.init.enc_custom_finish?.length)this.runEncounterCustomFinish(finish,this.init.enc_custom_finish[0]);}
    else{const row=this.e.db.get('battle_custom_finish',res);for(let i=1;;i++){const type=row['check_type_'+i],target=row['check_option_multiple_link_'+i],value=row['check_value_'+i];if(!type)break;if(!target||value==null||type==='BATTLE_FIN_TYPE_NONE')continue;finish.check_types.push(type);finish.check_values.push(this.e.db.number(row,'check_value_'+i));finish.check_targets.push(type==='BATTLE_FIN_TYPE_CONDITION'?String(this.e.call('getEventStack',{res_id:target,from:'CUSTOM_FINISH',parent_id:-1,use:'NONE',remove:'NONE',caster_id:this.b.char.id,owner_id:this.b.char.id})):target);}
      finish.result_type=row.result_type;finish.result_option=row.result_option_multiple_link;finish.check_andor={AND:0,OR:1}[row.check_and_or];finish.skip_result=row.skip_result==='YES';}
    return finish;
  }
  runEncounterCustomFinish(finish,entry){const triggers=entry.trigger===''?[]:entry.trigger.split(',');finish.enc_trigger=triggers;if(entry.skip_result)finish.skip_result=entry.skip_result==1;
    if(entry.type==0)finish.result_type=finish.skip_result?'BATTLE_RESULT_TYPE_SKIP':'BATTLE_RESULT_TYPE_REWARD';else if(entry.type==1){finish.result_type='BATTLE_RESULT_TYPE_EVENT';finish.result_option=entry.opt;}else if(entry.type==2)finish.result_type='BATTLE_RESULT_TYPE_SKIP';else if(entry.type==3)finish.result_type='BATTLE_RESULT_TYPE_STAGE_CLEAR';else if(entry.type==4)finish.result_type='BATTLE_RESULT_TYPE_STAGE_FAILED';
  }
  allMonsters(){return this.b.monsters.concat(this.b.retired_monsters);}
  hpRatio(unit){return unit.status.info.S_CURRENT_HP/unit.status.info.S_HP;}
  customFinishType(type,{target,option}){
    if(type==='BATTLE_FIN_TYPE_ENEMY_STANCE_CHANGE')return this.allMonsters().some(m=>{
      const pattern=this.b.monsterPattern[m.id];if(!pattern)return undefined;
      const command=this.e.db.table('monster_pattern')[pattern.pattern_id]?.command_set_name;return m.content_id==target&&command==option;
    });
    if(type==='BATTLE_FIN_LINKCRUSH')return this.stage.chars.some(c=>c.link_crash_on);
    // The native condition callback has no default return (offset1305).
    return undefined;
  }
  getRemnantsBossPenaltyTurnLimit(){return this.stage.remnants_boss_penalty_info?.max_turn;}
  // StageWT 0x61700, DisasterLogic 0x3400/0x3d00; stage enum0xd400.
  getDisasterBossRankTurnLimit(){
    const info=this.stage.disaster_boss_rank_info;if(!info)return undefined;
    const key=info.stage_index==1?'boss_rank_turn_limit':'boss_rank_turn_limit_2',raw=this.e.db.table('disaster_constant_meta')[key]?.value;
    const value=raw==null?undefined:Number(raw);if(!Number.isFinite(value))throw new MissingBattleRule('getDisasterBossRankTurnLimit.invalid_meta',{key,raw});
    return info.stage_index==1?value:value+info.turn_bonus;
  }
  getFailCountTurnLimit(){
    const id=this.stage.ingame_content_config_id;if(id==null||id=='')return undefined;
    const row=this.e.db.table('ingame_content_config')[id];if(row==null)return undefined;
    const limit=Number(row.fail_count_turn);return Number.isFinite(limit)&&limit>0?limit:undefined;
  }
  finishCondition(c){
    const b=this.b,stage=this.stage,monsters=this.allMonsters();
    const defeated=['death','run','changed','prop','half_death'];
    if(c.from_encounter&&!['story_00133','base_00278'].includes(this.init.battle_res_id))defeated.push('keep_half_death');
    if(stage.cheat_info.battle_skip&&!['BATTLE_RESULT_TYPE_RETRY_BATTLE_WITH_BCF','BATTLE_RESULT_TYPE_RETRY_TURN_WITH_CS','BATTLE_RESULT_TYPE_STAGE_FAILED'].includes(c.result_type)&&
      (!this.init.is_npc_attack||b.user_actions.some(a=>a.type=='prebattle_start')))return true;
    let only=false;const targets=[];
    const values=c.check_types.map((type,i)=>{
      const target=c.check_targets[i],value=c.check_values[i]??0,option=c.check_options[i]??'';
      switch(type){
        case 'BATTLE_FIN_TYPE_USER_HP_0':return b.char.state=='death';
        case 'BATTLE_FIN_TYPE_ENEMY_DEFEAT_ALL':return !monsters.some(m=>m.creature_type!='TYPE_CREATURE_BATTLE_END'&&!defeated.includes(m.state));
        case 'BATTLE_FIN_TYPE_ENEMY_DEFEAT_EXCEPT':return !monsters.some(m=>m.content_id==target?defeated.includes(m.state):m.creature_type!='TYPE_CREATURE_BATTLE_END'&&!defeated.includes(m.state));
        case 'BATTLE_FIN_TYPE_ENEMY_RUN_ALL_TARGET':
          if(target=='any'||target=='all'){
            monsters.forEach(m=>{if(m.state=='run')targets.push(m.content_id);});
            return target=='any'?monsters.some(m=>m.state=='run'):!monsters.some(m=>m.state!='run');
          }
          targets.push(target);return monsters.some(m=>m.content_id==target&&m.state=='run');
        case 'BATTLE_FIN_TYPE_ENEMY_HP_LE_ALL_TARGET':{
          const ratio=m=>this.e.call('hpRatio',m);
          if(target=='any')return monsters.some(m=>ratio(m)<=value/100&&ratio(m)>0);
          return !monsters.some(m=>(target=='all'||m.content_id==target)&&(ratio(m)>value/100||ratio(m)<=0));
        }
        case 'BATTLE_FIN_TYPE_ENEMY_DEFEAT_ALL_TARGET':
          // Native anonymous_16 computes includes then returns undefined.
          if(target=='any')return false;
          return !monsters.some(m=>(target=='all'||m.content_id==target)&&!defeated.includes(m.state));
        case 'BATTLE_FIN_TYPE_ENEMY_DEFEAT_ONE_TARGET':return monsters.some(m=>m.content_id==target&&defeated.includes(m.state));
        case 'BATTLE_FIN_TYPE_ENEMY_DEFEAT_ANYONE':return monsters.some(m=>defeated.includes(m.state));
        case 'BATTLE_FIN_TYPE_TURN_LT':return b.turn<value;
        case 'BATTLE_FIN_TYPE_TURN_GE':return b.turn>=value;
        case 'BATTLE_FIN_TYPE_ENEMY_PHASE_CHANGE':return monsters.some(m=>m.content_id==target&&(b.monsterPhase[m.id]?.current_phase??1)!=(m.start_phase??1));
        case 'BATTLE_FIN_TYPE_ESCAPE':return b.game_result=='BATTLE_RESULT_TYPE_SKIP';
        case 'BATTLE_FIN_TYPE_USE_CARD':if(b.usedCardMap[target]==null)b.usedCardMap[target]=false;return b.usedCardMap[target];
        case 'BATTLE_FIN_TYPE_CONDITION':return this.e.call('checkStack',Number(target));
        case 'BATTLE_FIN_TYPE_NIHILUM_META_ABSORB':return b.nihilum_meta_activated;
        case 'BATTLE_FIN_TYPE_ENEMY_DEFEAT_ONLY_TARGET':only=true;targets.push(target);return undefined;
        case 'BATTLE_FIN_DEFEAT':return stage.fatal_end==true||b.char.state=='death';
        case 'BATTLE_FIN_TYPE_GUIDE_CS':
          for(const id of b.char.continueSkill){const cs=b.csMap[id];if(cs.res_id==target)return cs.term_value>=value;}return false;
        default:return this.e.call('customFinishType',type,{target,value,option,condition:c});
      }
    });
    if(only){
      const ids=[];targets.forEach(t=>{const m=monsters.find(m=>m.content_id==t);if(m)ids.push(m.id);});
      values.push(!monsters.some(m=>ids.find(id=>id==m.id)?!defeated.includes(m.state):defeated.includes(m.state)));
    }
    const checked=values.filter(v=>v!=null);
    // ANDOR enum is numeric (default1/default2 constructors also assign AND).
    if(c.check_andor===0)return checked.every(v=>v==true);
    if(c.check_andor===1)return checked.some(v=>v==true);
    throw new MissingBattleRule('invalid_finish_andor',{value:c.check_andor});
  }
  applyFailCountTurnLimit(record=false){
    const b=this.b;if(b.game_end||b.game_result!='BATTLE_RESULT_TYPE_NONE')return false;
    const limit=this.getFailCountTurnLimit();if(limit==null||b.turn<=limit)return false;
    b.turn=limit;b.game_result_action='action_battle_lose';this.wt.check_types=['BATTLE_FIN_DEFEAT'];
    b.game_result='BATTLE_RESULT_TYPE_STAGE_FAILED';if(record)this.e.call('pushFinalDptAndTurnRecord');
    this.clearInterruptsForEnd();return true;
  }
  clearInterruptsForEnd(){
    const b=this.b;b.current_interrupt.type='NONE';b.interrupts=undefined;
    const types=['action_card_select','action_card_select_spark','action_card_res_select','action_card_option_select','action_card_r_spark_select','action_battle_event'];
    this.removeEndInterruptActions(types);
    b.block_interrupt=true;b.game_end=true;
  }
  removeEndInterruptActions(types){for(const block of this.b.action_blocks)block.actions=block.actions.filter(a=>!types.includes(a.type));}
  finishHardcoreDefeat(){this.b.game_result_action='action_battle_lose';this.wt.check_types=['BATTLE_FIN_DEFEAT'];this.b.game_result='BATTLE_RESULT_TYPE_STAGE_FAILED';this.pushFinalDptAndTurnRecord();this.clearInterruptsForEnd();return true;}
  checkBattleStepWave(){const step=this.b.battle_step_mode;if(step&&step.type==='BATTLE_STEP_WAVE_MODE'){if(step.cur<step.battle_ids.length-1){step.next_wave=true;return true;}}return false;}
  expireBattleEndCreatures(){const dead=[];this.b.monsters.forEach(m=>{if(!['death','run','changed'].includes(m.state)&&m.creature_type==='TYPE_CREATURE_BATTLE_END'){dead.push(m.id);m.state='death';}});return dead;}
  // checkGameEnd 0x1a5d00 offsets 897..3513, ordinary non-wave finish.
  applyFinishedCondition(c){
    const b=this.b,e=this.e;b.finished_condition=c.res_id;
    const row=e.db.table('battle_custom_finish')[c.res_id];
    if(!c.check_types.includes('BATTLE_FIN_TYPE_USER_HP_0')){
      const step=b.battle_step_mode;
      if(this.wt.isPreview==0&&step){
        if(!Array.isArray(step.battle_ids))throw new MissingBattleRule('applyFinishedCondition.battle_step_mode_input');
        (step.reward??=[]).push({battle_res_id:this.init.battle_res_id,wave:step.cur});
        e.call('refreshLastDeadMonsterForBattleEnd');b.last_dead_summons_battle_end=this.wt.last_dead_summons;
        const count=step.battle_ids.length;if(step.cur==count-1)step.cur=count;
      }
      if(step?.type==='BATTLE_STEP_WAVE_MODE'){
        // Native offsets1781/1787 jump to3523: continue the condition loop,
        // not terminal victory. The next phase creates the queued wave.
        if(step.next_wave)return undefined;
        if(this.checkBattleStepWave()){
          const dead=this.expireBattleEndCreatures();e.pushAction({id:b.last_action_id++,type:'action_monster_summon_death',target_id:dead,source_id:-1});
          if(b.player_turn){b.interrupts=[];this.wt.turn_over_reserved=true;}
          else if(b.turn==1&&b.spark_checked_turn==0){b.interrupts=[];this.wt.turn_over_first_turn=true;}
          return undefined;
        }
      }
    }
    if(row){const rewards=[];for(let i=0;;i++){const id=row['reward'+i+'_link_map_battle_reward_id'],pct=row['reward'+i+'_pct'];if(id==null||pct==null)break;if(id!=='none')rewards.push([id,pct]);}if(rewards.length)b.custom_rewards=rewards;}
    e.call('refreshLastDeadMonsterForBattleEnd');b.last_dead_summons_battle_end=this.wt.last_dead_summons;
    if(b.next_break_in){if(b.last_dmg_event)b.last_dmg_event.next_break_in=b.next_break_in;if(b.last_death_action)b.last_death_action.next_break_in=b.next_break_in;}
    if(c.check_types.includes('BATTLE_FIN_TYPE_USER_HP_0'))b.game_result_action='action_battle_lose';
    this.wt.check_types=c.check_types.slice();b.game_result=c.result_type;b.skip_reward=c.skip_result;b.enc_trigger=c.enc_trigger;b.result_opt=c.result_option;
    if(c.result_type!=='BATTLE_RESULT_TYPE_STAGE_FAILED'){
      const dead=this.expireBattleEndCreatures();
      this.wt.last_dead_summons=dead;e.pushAction({id:b.last_action_id++,type:'action_monster_summon_death',target_id:dead,source_id:-1});
      b.boss_clear=this.allMonsters().some(m=>(m.state==='death'||this.stage.cheat_info.battle_skip)&&e.db.table('monster')[m.res_id]?.grade==='GRADE_BOSS');
      const drops=e.db.array(e.call('constantMetagameSkipError','boss_drop_link_battle_id')??'[]');
      if(drops.includes(e.db.get('battle',this.init.battle_res_id).id))b.boss_clear=true;
      if(this.init.eidolon_keyword_pool?.length>0)e.call('procUnitEvent','CONDITION_SPOT_EIDOLON_CLEAR',[]);
      if(b.boss_clear)e.call('applyLinkCrashRecoveryByBossClear');
    }
    this.pushFinalDptAndTurnRecord();this.clearInterruptsForEnd();return true;
  }
  getBattleEndHpSnapshot(){const info=this.stage.link_crash_recovery_context?.info;return info!=null?{remaining_hp:info.hp,max_hp:info.max_hp}:{remaining_hp:this.b.char.status.info.S_CURRENT_HP??0,max_hp:this.b.char.status.info.S_HP??0};}
  // WT 0x1a0800, final-record once guard and all nine DPT accumulators.
  pushFinalDptAndTurnRecord(){
    const b=this.b,e=this.e;if(b._final_record_pushed)return;b._final_record_pushed=true;const d=b.dpt;
    for(const key of ['damage','shield_damage','damage_taken','shield_damage_taken','damage_taken_by_monster','heal','overheal','heal_with_overheal','shield_gained'])d['total_'+key]+=d[key];
    if(d.damage>d.max_damage)d.max_damage=d.damage;if(d.damage_taken_by_monster>d.max_damage_taken_by_monster)d.max_damage_taken_by_monster=d.damage_taken_by_monster;
    d.damage_taken_by_monster_per_turn.push(Math.round(d.damage_taken_by_monster));
    const hp=this.getBattleEndHpSnapshot(),i=this.init,s=this.stage;
    const record={battle_res_id:i.battle_res_id,area_id:i.area_id??0,floor:i.floor,spot_type:i.spot_type??'',turn:b.turn,damage_dealt:d.damage,damage_taken:d.damage_taken,
      damage_taken_by_monster:Math.round(d.damage_taken_by_monster),shield_gained:d.shield_gained,heal_gained:d.heal,overheal_gained:d.overheal,heal_with_overheal_gained:d.heal_with_overheal,
      remaining_hp:hp.remaining_hp,max_hp:hp.max_hp,char_stats:e.call('buildTurnRecordCharStats')};
    if(i.link_encounter_id)record.encounter_id=i.link_encounter_id;record.stage_enter_time=i.stage_enter_time??0;
    if(e.call('shouldRecordTurnInStage'))(s.turn_records??=[]).push(record);else if(s.turn_records!==undefined)s.turn_records=undefined;
    const first=i.first_enter_time??i.stage_enter_time??0;
    const contentId=s.hyperspace_info?.hyperspace_content_list_id??s.disaster_boss_rank_info?.rank_list_id??s.remnants_boss_penalty_info?.list_id??(s.step_mode_stage?.res_id!=null?String(s.step_mode_stage.res_id):undefined);
    const step=['BATTLE_STEP_WAVE_MODE','BATTLE_STEP_BOSS_MODE'].includes(b.battle_step_mode?.type);
    const content=contentId||step?{...(contentId?{content_id:contentId}:{}),...(step?{is_step_mode_stage:true}:{})}:undefined;
    e.call('pushTurnRecordOffline',first,structuredClone(record),content,s.stage_id);
    e.pushAction({id:b.last_action_id++,type:'action_dpt_info',source_id:b.turn,dpt_info:structuredClone(d)});
  }
  checkGameEnd(){
    const b=this.b,e=this.e;
    if(b.check_end||b.game_end||b.battle_step_mode?.next_wave)return false;
    const s=this.stage;
    if(!this.wt.isPreview&&s.assault_hardcore&&!s.fatal_end&&b.battle_step_mode==null&&!e.call('isStory')&&b.char.state!='death'&&b.char.status.info.S_CURRENT_HP<=0){
      const using=this.wt.monster_card_using;
      if(using&&!(b.player_turn==true&&using.is_passive)){s.fatal_end=true;using.fatal_pending=true;}
      else e.call('applyHPLinkCrash');
    }
    if(s.assault_hardcore&&s.fatal_end)return e.call('finishHardcoreDefeat');
    for(const [field,get] of [['disaster_boss_rank_info','getDisasterBossRankTurnLimit'],['remnants_boss_penalty_info','getRemnantsBossPenaltyTurnLimit']]){
      if(!s[field])continue;
      const limit=get==='getRemnantsBossPenaltyTurnLimit'?s[field].max_turn:e.call(get);
      if(limit!==undefined&&b.turn>limit){b.turn=limit;e.call('pushFinalDptAndTurnRecord');b.game_end=true;b.game_result='BATTLE_RESULT_TYPE_STAGE_CLEAR';return true;}
    }
    if(this.applyFailCountTurnLimit(true))return true;
    for(const c of b.finish_conditions)if(this.finishCondition(c)){const result=e.call('applyFinishedCondition',c);if(result!==undefined)return result;}
    return undefined;
  }
}
