// setStateMain 0x85100 offsets1450..2529 and nested0x88800..0x8e500.
// StressProc0x3fb00/0x41700; BattleStageWorktable0x53f00/0x57b00.
export class MainPhaseRuntime {
  constructor(e){this.e=e;this.b=e.b;this.w=e.wt;this.stage=e.state.worktables.BattleStageWorktable.battle_stage;}
  call(n,...a){return this.e.call(n,...a);}
  tutorialConstantId(id){return this.e.db.table('tutorial_constant_id')[id]?.dbres_multiple_link??'';}
  isMainPhase(){return this.b.current_state==this.e.enums.LogicState.MainPhase;}
  // StressProc0x37d00; active collapse mutations remain mandatory continuations.
  checkLinkCrash(options){
    const chars=this.stage.chars.filter(c=>!this.stage.leaved_chars?.includes(c.res_id));if(chars.length<=1)return;
    if(this.b.battle_step_mode==null&&this.b.char.status.info.S_CURRENT_HP==0){if(!options?.except_hp_link_crash&&!this.call('isStory'))this.call('applyHPLinkCrash');return;}
    if(chars.find(c=>c.link_crash_on==true))return;const collapsed=chars.filter(c=>c.collapse_on==true);if(collapsed.length!=chars.length)return;
    const target=this.call('pickLinkCrashChar',collapsed,this.isDTMode());this.call('setLinkCrashOn',target);
    this.e.pushAction({id:this.b.last_action_id++,type:'action_link_crash',source_id:-1});return target.id;
  }
  isAssaultMode(){return this.stage.ingame_content_config_id==='CONTENT_CHAOS_ASSAULT';}
  isDTMode(){const row=this.e.db.table('ingame_content_config')[this.stage.ingame_content_config_id];return row?.enable_dtmode==='YES'&&this.stage.chars.find(c=>c.psychosis_id!=null)!=null;}
  getFatalAttackTarget(){const all=this.stage.chars,active=all.filter(c=>c.res_id>0&&!this.stage.leaved_chars?.includes(c.res_id)).filter(c=>c.link_crash_on==true);return active.length?active[0]:all.find(c=>c.link_crash_on==true);}
  checkFatalAttack(monsters){
    if(this.stage.fatal_end||!monsters&&this.b.enemy_turn!=true)return {};
    const dt=this.isDTMode(),assault=this.isAssaultMode();if(dt==false&&assault==false)return {};
    const owner=(monsters??this.b.monsters).find(m=>{
      if(!['target_unable','none'].includes(m.state)||!m.nextCard)return false;
      const row=this.e.db.table('card')[m.nextCard];return !!row&&!m.actioned&&row.monster_noti_category.includes('ATK');
    });
    if(!owner)return {};const target=this.getFatalAttackTarget();return target==null?{}:{owner,target,fatal:true};
  }
  checkSpark(){if(this.b.spark_checked_turn==this.b.turn)return;this.b.spark_checked_turn=this.b.turn;}
  decreaseMonsterTurn(m,decrease,actions){
    if(!this.call('isFieldMonster',m))return;
    if(decrease&&m.mon_turn!=null&&m.mon_turn>0&&!m.mon_turn_delay){
      if(this.getFatalAttackTarget()){
        if(!m.nextCard)return false;const card=this.e.db.table('card')[m.nextCard];if(!card)return false;
        if(card.monster_noti_category.includes('ATK'))return;
      }
      const query=(id,is_card)=>this.e.passives.query({source_id:id,type:'SKILL_EFF_TURN_COUNT_VALUE_ADD',is_card});
      const ps=query(m.id,false).concat(query(this.b.char.id,false),this.b.deck_info.hand.reduce((a,id)=>this.call('isCardUninteractible',id)?a:a.concat(query(id,true)),[]));
      let amount=1,plus=0,multi=1;
      for(const s of ps){
        const sign=this.e.db.get('skill_eff',s.res_id).eff_value_math_sign,value=this.call('calcValue',s.skill_id);
        const suppress=sign==='MATHSIGN_ADD'&&value<0||sign==='MATHSIGN_SUBTRACT'&&value>0||sign==='MATHSIGN_MULTIPLY'&&value<1;
        if(suppress&&this.call('checkMonsterTurnCountBlocked',m.id,s.caster_id,{source_skill_id:s.skill_id,is_suppress:true}))continue;
        if(sign==='MATHSIGN_ADD')plus+=value;else if(sign==='MATHSIGN_SUBTRACT')plus-=value;else if(sign==='MATHSIGN_MULTIPLY')multi*=value;
      }
      amount=Math.min(m.mon_turn,Math.max(0,(amount+plus)*multi));
      if(amount!=0){m.mon_turn-=Math.min(m.mon_turn,Math.max(0,amount));
        this.e.pushAction({id:this.b.last_action_id++,type:'action_monster_turn_count',source_id:m.id,value:m.mon_turn});
        if(amount>0)this.call('procUnitEvent','CONDITION_TURN_COUNT_DECREASE',[m.id,'',0,amount,-1]);}
    }
    if(m.mon_turn==0&&!m.actioned)actions.push(m);
  }
  mainPhaseMonsterActions({prev}={}){
    const b=this.b,actions=[],id=prev==null?b.turn_count_card_id:undefined;
    if(id!=null)b.turn_count_card_id=undefined;
    if(id!=null){const card=b.cardMap[id],decrease=!card?.ep_skill&&!card?.talents?.includes(29);for(const m of b.monsters)this.decreaseMonsterTurn(m,decrease,actions);}
    else for(const m of b.monsters)if(this.call('isFieldMonster',m)&&m.mon_turn==0&&!m.actioned)actions.push(m);
    for(const m of b.monsters)m.mon_turn_delay=undefined;
    const fatal=this.checkFatalAttack(actions);
    if(fatal.fatal&&fatal.target!=null&&fatal.owner!=null){
      this.e.pushAction({id:b.last_action_id++,type:'action_fatal_attack',stress_death_char_res_id:fatal.target.res_id,card_res_id:fatal.owner.nextCard,source_id:fatal.owner.id});
      this.stage.fatal_end=true;this.stage.fatal_target_res_id=fatal.target.res_id;
      if(b.finish_conditions.every(c=>!c.check_types.includes('BATTLE_FIN_DEFEAT'))){b.game_end=true;b.game_result='BATTLE_RESULT_TYPE_STAGE_FAILED';return true;}
    }
    actions.forEach(m=>this.call('monsterProcPattern',m));
    this.call('procUnitEvent','CONDITION_ALL_MONSTER_TURN_COUNT',[]);this.call('procUnitEvent','CONDITION_ANY_MONSTER_TURN_COUNT',[]);
    this.checkSpark();b.select_target=-1;for(const m of b.monsters)m.mon_turn_delay=undefined;
  }
}
