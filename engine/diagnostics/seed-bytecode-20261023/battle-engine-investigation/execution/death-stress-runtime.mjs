// Source-bound StressProc death-adjacent branches. Inner collapse-card creation
// and stress-action synthesis remain explicit ports, not fabricated no-ops.
import {MissingBattleRule} from './resource-store.mjs';
import {floorGame} from '../effects/effect-arithmetic.mjs';
const fixed2=v=>Number((v+1e-8).toFixed(2));
export class DeathStressRuntime {
  constructor(e){this.e=e;this.b=e.b;this.w=e.wt;}
  call(n,...a){return this.e.call(n,...a);}
  get stage(){return this.e.state.worktables.BattleStageWorktable.battle_stage;}
  getAllChars(){return this.b.assault_fourth_char?[...this.b.chars,this.b.assault_fourth_char]:this.b.chars;}
  isDuringBattle(){return !this.b.game_end&&this.b.chars.length>0;}
  isLinkCrashed(){return this.stage.chars.some(c=>c.link_crash_on==true);}
  getMaxStress(){return this.call('constantMetagame','default_stress_max');}
  // StressProc 0x13a00/0x15100; departed and negative resource placeholders
  // cannot trigger tutorial recovery.
  checkCharacterCollapsed(c){return c.collapse_on??false;}
  hasCollapsedCharacter(){return this.stage.chars.some(c=>c.res_id<0||this.stage.leaved_chars?.includes(c.res_id)==true?false:this.checkCharacterCollapsed(c));}
  // StressProc 0x1d500. Synchronize battle HP into stage before full recovery,
  // then apply the returned recovery state back to the active battle.
  applyStoryTutorialBattleRecovery(options){
    if(this.hasCollapsedCharacter()!=true)return;
    const active=this.b.char?.status?.info,stage=this.stage.player?.status?.info;
    if(active!=null&&stage!=null){stage.S_HP=active.S_HP;stage.S_CURRENT_HP=active.S_CURRENT_HP;}
    const info=this.call('recoverLinkCrash',{force:true,full_recovery:true});if(info==null)return;
    this.call('applyLinkCrashRecoveryInfoToBattle',info);if(options?.recover_cards===true)this.call('recoverBattleCollapseCards');return info;
  }
  getCollapseRemainCount(id){for(const k in this.b.cardMap){const c=this.b.cardMap[k];if(c.char_id==id&&c.collapse_count!=null&&c.collapse_need_count!=null)return c.collapse_need_count-c.collapse_count;}return 0;}
  // isDTMode is intentionally unused by native getLinkCrashCharScore 0x11000.
  getLinkCrashCharScore(c,isDTMode,remaining,randomIndex){return -(c.ego_stress??0)*100000-remaining*10-(4-randomIndex);}
  pickLinkCrashChar(chars,isDTMode,counts){const indexes=this.call('shuffleArray',0,[1,2,3]);const sorted=chars.map((c,i)=>({c,remaining:counts?.[i]??this.getCollapseRemainCount(c.id),random:indexes[i]??i+1}));
    sorted.sort((a,b)=>this.getLinkCrashCharScore(a.c,isDTMode,a.remaining,a.random)-this.getLinkCrashCharScore(b.c,isDTMode,b.remaining,b.random));
    if(!sorted.length)throw new MissingBattleRule('pickLinkCrashChar.empty_candidates');return sorted[0].c;}
  setLinkCrashOn(c,withBattle=true){if(c.link_crash_on==true)return;c.link_crash_on=true;if(c.link_crash_experience_count==null)c.link_crash_experience_count=0;++c.link_crash_experience_count;
    if(withBattle){this.call('procUnitEvent','CONDITION_CHAR_LINK_CRASH',[c.id]);if(!this.b.player_turn)this.b.link_crash_block_started=true;}}
  getCollapseNeedCount(c){const constant=(id,fallback)=>this.call('constantMetagameSkipError',id)??fallback;
    let initial=constant('bat_col_use_need_count',5),step=constant('collapse_card_step_need_count',1);
    if(this.call('isDTMode')==true){initial=constant('collapse_card_initial_dtmode',6);step=constant('collapse_card_step_dtmode',2);}
    const reduce=this.call('getPassiveByTypeGamecoreForChar','EFF_COLLAPSE_NEED_COUNT_SUBTRACT',c.id).reduce((a,p)=>a+p.eff_value,0);
    return Math.max(1,initial+step*Math.max(0,(c.collapse_experience_count??1)-1)-reduce);}
  setCollapseOn(c){if(c.collapse_on==true)return;c.collapse_on=true;if(c.collapse_experience_count==null)c.collapse_experience_count=0;++c.collapse_experience_count;c.collapse_card_count=0;c.collapse_need_count=this.getCollapseNeedCount(c);this.call('missionDispatch',{event:'COLLAPSE'});}
  setCollapseOff(c){if(c.collapse_on==false)return;c.collapse_on=false;for(const k of ['collapse_card_count','collapse_need_count','collapse_penalty_occurred','collapse_sequence'])c[k]=undefined;}
  setEgoStress(c,value,force=false){force??=false;const prev=c.ego_stress??0,max=this.getMaxStress(),min=force==true?0:c.link_crash_on==true||c.collapse_on==true?max:0,next=Math.min(Math.max(min,value),max),diff=next-prev;
    if(diff>0){if(c.stress_up_value==null)c.stress_up_value=0;c.stress_up_value+=diff;}c.ego_stress=fixed2(next);}
  checkCollapse(a){const prev=a.prev??0,next=a.next??0;if(prev>=next||a.char.res_id<0)return;
    const c=this.stage.chars.find(c=>c.res_id==a.char.res_id);if(!c)throw new MissingBattleRule('checkCollapse.stage_char');if(c.collapse_on==true)return;
    this.e.db.get('char_base',a.char.res_id);if(this.getMaxStress()>next||this.w.isPreview!=0||this.w.turnEndHpPreviewing)return;
    this.setCollapseOn(c);if(this.isDuringBattle()==true)this.addCollapseOnAction(a.char);return true;
  }
  addCollapseOnAction(c){const chars=this.stage.chars.filter(c=>!this.stage.leaved_chars?.includes(c.res_id));if(chars.length==1)return;
    const prev=this.call('getStatus',c.id,'S_CURRENT_HP'),living=chars.filter(c=>!c.collapse_on),oldMax=this.call('getStatus',this.b.char.id,'S_HP'),lost=Math.ceil(oldMax/(living.length+1));
    this.call('setStatus',this.b.char.id,'S_HP',oldMax-lost);const next=this.call('getStatus',c.id,'S_CURRENT_HP');c.collapse_dec_max_hp=lost;c.collapse_dec_cur_hp=prev-next;
    const max=this.call('getStatus',this.b.char.id,'S_HP');this.e.pushAction({id:this.b.last_action_id++,source_id:this.b.char.id,type:'action_collapse_on',action_list:[{action_units:[[this.b.char.id,{damage:next-prev,type:[],old_hp:prev,new_hp:next,max_hp:max,old_max_hp:oldMax,is_auto:true,is_collapse_on:true}]]}],skip_action:true});
  }
  checkStressBeforeAdd(c,a){const max=this.getMaxStress();if(c.collapse_on&&a.from>=max&&a.to<max)a.to=max;this.setEgoStress(c,a.to);return a;}
  addStressActionArray(infos,options={}){if(this.w.isPreview||infos.length==0||this.b.char.status.info.S_CURRENT_HP==0&&this.b.battle_step_mode!=null)return;
    const {force=false,for_each_delegate,non_check_max_hp=false,is_psychosis_effect=false,skip_take_stress_cond=false}=options;
    const action={id:this.b.last_action_id++,type:is_psychosis_effect?'action_stress_change_none_collapse':'action_stress_change',source_id:-1,char_stress_info_array:[]};
    for(let info of infos){const c=this.stage.chars.find(c=>c.res_id==info.char_res_id);if(!c)throw new MissingBattleRule('addStressActionArray.stage_char');if(!force)info=this.checkStressBeforeAdd(c,info);
      const item={from:info.from,to:info.to,stress_value:info.stress_value,char_res_id:info.char_res_id,is_collapse_on:info.is_collapse_on,prev_collapse_stress:info.prev_collapse_stress,battle_actions:info.battle_actions,hp_link_crash:info.hp_link_crash,is_link_crash_on:c.link_crash_on,add_collapse_card_battle:info.add_collapse_card_battle,by_psychosis:is_psychosis_effect?true:undefined};
      action.char_stress_info_array.push(item);if(item.is_collapse_on==true||item.hp_link_crash==true||item.is_link_crash_on==true)action.type='action_stress_change_wait';}
    this.e.pushAction(action);action.char_stress_info_array.forEach(info=>{const c=this.stage.chars.find(c=>c.res_id==info.char_res_id);if(!c)return;
      this.call('accumulateStressDpt',info.char_res_id,fixed2(info.to-info.from));if(for_each_delegate)for_each_delegate(c.id);
      if(!skip_take_stress_cond)this.call('procUnitEvent','CONDITION_CHAR_TAKE_STRESS',[c.id,info.stress_value]);
      if(info.add_collapse_card_battle==true)info.battle_actions=this.call('onGainCollapseCard',c);});
    if(non_check_max_hp==false){let oldMax=1;const max=this.call('getStatus',this.b.char.id,'S_HP');for(const b of this.b.action_blocks)for(const a of b.actions){if(a.type==='action_collapse_on')a.action_list?.forEach(l=>l.action_units.forEach(u=>{oldMax=Math.max(oldMax,u[1].old_max_hp??1);}));}if(oldMax>1&&max==1)this.applyHPLinkCrash();}
  }
  applyHPLinkCrash(){const stage=this.stage;
    if(stage.assault_hardcore){if(stage.fatal_end)return;this.e.pushAction({id:this.b.last_action_id++,type:'action_fatal_auto_attack',source_id:-1});stage.fatal_end=true;return;}
    const chars=stage.chars.filter(c=>!stage.leaved_chars?.includes(c.res_id));if(chars.find(c=>c.link_crash_on==true)!=null)return;
    const c=this.pickLinkCrashChar(chars,this.call('isDTMode'));this.setLinkCrashOn(c);
    if(c.collapse_on==true){this.e.pushAction({id:this.b.last_action_id++,type:'action_link_crash',source_id:-1,link_crash_char_id:c.id});return;}
    const max=this.getMaxStress(),prev=c.ego_stress??0,next=fixed2(max),diff=max-prev;if(next-prev==0)return;
    const old=c.collapse_on,add=this.checkCollapse({char:c,prev,next,skip_link_crash:false});
    this.addStressActionArray([{char_res_id:c.res_id,from:prev,to:next,stress_value:diff,is_collapse_on:old==c.collapse_on?undefined:c.collapse_on,add_collapse_card_battle:add,hp_link_crash:true}],{non_check_max_hp:true});
  }
  recoverLinkCrash(options){if(!options?.force&&!this.isLinkCrashed())return;
    const info=this.stage.player.status.info,oldMax=info.S_HP,oldHp=info.S_CURRENT_HP,maxStress=this.getMaxStress();
    const stress=options?.full_recovery?0:this.call('constantMetagame','link_crash_recovery_stress'),hpPct=options?.full_recovery?100:this.call('constantMetagame','link_crash_recovery_hp');
    const stressInfos=[];let restored=0;
    for(const c of this.stage.chars.filter(c=>c.res_id>=0&&!this.stage.leaved_chars?.includes(c.res_id))){
      const wasLink=c.link_crash_on,wasCollapse=c.collapse_on,prev=c.ego_stress??(wasCollapse==true||wasLink==true?maxStress:0),next=prev>=stress?stress:prev;
      c.link_crash_on=false;if(wasCollapse==true&&next<maxStress){restored+=c.collapse_dec_max_hp??0;c.collapse_dec_max_hp=undefined;c.collapse_dec_cur_hp=undefined;this.setCollapseOff(c);}
      this.setEgoStress(c,next,true);
      if(prev!=c.ego_stress||wasCollapse!=c.collapse_on||wasLink!=c.link_crash_on)stressInfos.push({char_res_id:c.res_id,from:prev,to:c.ego_stress??0,stress_value:fixed2((c.ego_stress??0)-prev),is_link_crash_on:wasLink==c.link_crash_on?undefined:c.link_crash_on,is_collapse_on:wasCollapse==c.collapse_on?undefined:c.collapse_on,link_crash_recovery:true});
    }
    const max=oldMax+restored;info.S_HP=max;const heal=options?.full_recovery?max:floorGame(max*hpPct*.01),hp=options?.full_recovery?max:Math.min(max,Math.max(0,oldHp)+heal);info.S_CURRENT_HP=hp;
    return {prev_hp:oldHp,hp,prev_max_hp:oldMax,max_hp:max,heal:hp-oldHp,stress_infos:stressInfos};
  }
  applyLinkCrashRecoveryInfoToBattle(info){this.b.char.status.info.S_HP=info.max_hp;this.b.char.status.info.S_CURRENT_HP=info.hp;
    const chars=this.getAllChars();for(const sc of this.stage.chars){const c=chars.find(c=>c.id==sc.id||c.res_id==sc.res_id);if(!c)continue;for(const k of ['link_crash_on','link_crash_experience_count','collapse_on','collapse_card_count','collapse_need_count','collapse_penalty_occurred','collapse_sequence','collapse_dec_max_hp','collapse_dec_cur_hp','ego_stress'])c[k]=sc[k];}}
  applyLinkCrashRecoveryByBossClear(){const info=this.recoverLinkCrash();if(info==null)return;this.applyLinkCrashRecoveryInfoToBattle(info);this.stage.link_crash_recovery_context={is_link_crash:true,info};this.stage.link_crash_recovered=true;return info;}
}
