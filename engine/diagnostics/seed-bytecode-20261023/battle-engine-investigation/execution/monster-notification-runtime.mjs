import {createStatusReader} from '../attributes/status-core.mjs';
import {roundGame} from '../effects/effect-arithmetic.mjs';
import {MissingBattleRule} from './resource-store.mjs';
import {relativeProbabilityIndex,loadRowsByKey} from '../turn-enemy/monster-pattern-core.mjs';
// Hand ports of BattleWorktable notification and shield maintenance functions.
export class MonsterNotificationRuntime {
  constructor(engine){
    this.e=engine;this.b=engine.b;this.w=engine.wt;this.db=engine.db;
    this.readStatus=createStatusReader({battle:this.b,stage:engine.state?.worktables?.BattleStageWorktable?.battle_stage??this.w.battle_stage_worktable?.battle_stage,
      queryPassive:q=>this.call('getPassiveByType',q),evalSkill:id=>this.call('calcValue',id),readSkill:id=>this.db.get('skill_eff',id),
      getUnit:id=>this.e.getUnit(id),isMonster:id=>!!this.e.getMonster(id),getConstant:(...a)=>this.call('constantMetagame',...a)});
  }
  call(name,...args){return this.e.call(name,...args);}
  getStatus(id,type,fallback){return this.readStatus(id,type,fallback);}
  // 0x22e00: cache comparison intentionally ignores refresh and outer cardRes.
  pushMonsterNoti(id,noti,refresh,cardRes,cardId){
    const key=`${noti.noti_type}|${noti.card_res_id}|${cardId}|${noti.extra_turn}|${noti.damage}|${noti.dmg_attr}`;
    if(!(this.w.monsterNotiCache instanceof Map))throw new MissingBattleRule('monsterNotiCache.Map');
    if(this.w.monsterNotiCache.get(id)===key)return;this.w.monsterNotiCache.set(id,key);
    this.e.pushAction({id:this.b.last_action_id++,type:'action_monster_noti',source_id:id,action_noti:noti,refresh,card_res_id:cardRes,card_id:cardId});
  }
  // 0x1b8a00.
  checkGroggy(id,type){const m=this.e.getMonster(id);if(m)m.groggy=type==='N_GROGGY';}
  // EventStackHelper.use -> MonsterPhase.onChange 0x13c00.
  ['useParent:MONSTER'](parent){
    const phase=this.b.monsterPhase[parent.parent_id];if(!phase||parent.useType!=='INDEX'||parent.index==null)return;
    this.call('pushLog','phase_changed:'+phase.mon_res_id+':'+phase.next_phase[parent.index]);
    this.changePhaseTriggered(phase,parent.index);
  }
  // MonsterPhase.changePhaseTriggered 0x12f00. Even one candidate consumes
  // the weighted selection draw; an already queued phase consumes none.
  changePhaseTriggered(phase,index){
    if(this.checkPhaseTriggered(phase.mon_id))return;
    const unit=this.e.getUnit(phase.mon_id);if(!this.call('isFieldMonster',unit))return;
    const draw=relativeProbabilityIndex(phase.next_phase_ratio[index],(min,max)=>this.e.random.randRange(0,min,max));
    const next=phase.next_phase[index][draw];
    if(phase.current_phase==next){this.call('contentError','err:invalid_phase_change:same_phase:'+phase.mon_res_id+':phase '+next,{channel:'#server_report_dev2'});return;}
    phase.current_phase=next;this.addPhaseTriggered(phase.mon_id);
  }
  checkPhaseTriggered(id){return this.w.phaseTriggered.includes(id);}
  addPhaseTriggered(id){this.w.phaseTriggered.push(id);}
  // Verified native empty callbacks: MonsterPattern.onTrigger 0xab00,
  // MonsterPattern.onRemove 0xb100 and MonsterPhase.onRemove 0x14600.
  ['useParent:MONSTER_PATTERN'](){}
  ['removeParent:MONSTER_PATTERN'](){}
  ['removeParent:MONSTER'](){}
  // Neither MONSTER kind is a case in procStackOn/off 0x1c700/0x1b600.
  ['toggleParent:MONSTER'](){}
  ['toggleParent:MONSTER_PATTERN'](){}
  // MonsterPhase.procChangePhase 0xfe00. Rebuild both condition ownership and
  // the new action pattern; never reuse trace results or old condition stacks.
  procChangePhase(id){
    const unit=this.e.getUnit(id);if(!this.call('isFieldMonster',unit))return;
    if(!this.w.isPreview)unit.mon_turn_delay=true;
    const actioned=unit.actioned,wasActioned=actioned===true,phase=this.b.monsterPhase[id],monster=this.db.get('monster',phase.mon_res_id);
    let row;for(const r of loadRowsByKey(this.db.table('monster_pattern_set'),monster.link_monster_pattern_set_key))if(r.phase==phase.current_phase)row=r;
    if(!row)throw this.call('contentError',`err:pattern_set_not_found:${monster.name}:phase ${phase.current_phase}`);
    const previous=this.b.monsterPattern[id];
    if(['PATTERN_TYPE_NON_RESET','PATTERN_TYPE_NON_RESET_NEXT_SKILL'].includes(previous.type)){
      if(!(id in this.b.savedPattern))this.b.savedPattern[id]={};this.b.savedPattern[id][previous.pattern_id]=previous.phaseCounter;
      if(!(id in this.b.savedUsedCards))this.b.savedUsedCards[id]={};if(unit.usedCardPhase)this.b.savedUsedCards[id][previous.pattern_id]=structuredClone(unit.usedCardPhase);
    }
    const previousCounter=previous.phaseCounter,previousUsed=structuredClone(unit.usedCardPhase);unit.usedCardPhase={};
    const count=phase.stacks.length;for(let i=0;i<count;i++)this.e.stacks.remove(phase.stacks[i]);phase.stacks=[];
    const patternId=row.phase_link_monster_pattern_id;
    previous.passive_card_ids?.forEach(id=>{this.b.cardMap[id].unusable=true;});previous.stacks.forEach(id=>this.e.stacks.remove(id));
    unit.nextCard=undefined;unit.nextnextCard=undefined;unit.noticeDamage=0;this.w.monsterNotiCache.delete(unit.id);
    this.createMonsterPattern(patternId,unit,true,wasActioned);
    phase.next_phase=[];phase.next_phase_ratio=[];
    for(let i=0;;i++){
      const next=row['phase_change_phase_'+i];if(next==null)break;
      phase.next_phase.push(this.db.array(next.toString()).map(Number));
      const ratio=row['phase_change_phase_ratio_'+i];if(ratio==null)throw this.call('contentError',`err:phase_change_ratio_not_exist:${unit.res_id}:phase_change_phase_ratio_${i}`);
      phase.next_phase_ratio.push(this.db.array(ratio.toString()).map(Number));
      const condition=row['phase_change_'+i+'_link_condition_id'];if(condition==null)throw this.call('contentError',`err:phase_change_condition_not_exist:${unit.res_id}:phase_change_${i}_link_condition_id`);
      if(condition!=='none')phase.stacks.push(this.call('getEventStack',{res_id:condition,from:'MONSTER',parent_id:unit.id,use:'INDEX',remove:'REMOVE',caster_id:unit.id,owner_id:unit.id,index:i}));
    }
    if(patternId==null)throw this.call('contentError','err:invalid_phase_number');
    const pattern=this.b.monsterPattern[id];
    if(pattern.type==='PATTERN_TYPE_NON_RESET'||pattern.type==='PATTERN_TYPE_NON_RESET_NEXT_SKILL'){
      if(id in this.b.savedPattern&&patternId in this.b.savedPattern[id])pattern.phaseCounter=this.b.savedPattern[id][patternId]+(pattern.type==='PATTERN_TYPE_NON_RESET_NEXT_SKILL'?1:0);
      if(id in this.b.savedUsedCards&&patternId in this.b.savedUsedCards[id])unit.usedCardPhase=structuredClone(this.b.savedUsedCards[id][patternId]);
    }else if(pattern.type==='PATTERN_TYPE_KEEP_BEFORE'){pattern.phaseCounter=previousCounter;unit.usedCardPhase=previousUsed;}
    if(!wasActioned)this.call('monsterProcPatternPre',unit,{force:true});
    if(!this.b.enemy_turn&&actioned)unit.actioned=true;
    this.call('refreshMonsterNoti');this.clearUnlockAction();this.b.phase_changed=true;
    this.e.pushAction({id:this.b.last_action_id++,type:'action_monster_unlock',source_id:-1});
  }
  // MonsterPattern constructor 0x7700 (+ field initializer 0xd800).
  createMonsterPattern(patternId,unit,play,actioned){
    const row=this.db.get('monster_pattern',patternId),pattern={stacks:[],pattern_id:row.id,phaseCounter:undefined,type:row.pattern_type};
    const model=row.change_link_model_define_id?.toString();if(model&&model!=='none'&&model!=='0')unit.model_define_id=model;
    this.b.monsterPattern[unit.id]=pattern;this.pushActionPhase(unit,undefined,play,actioned);pattern.phaseCounter=1;
    let i=0;for(const r of loadRowsByKey(this.db.table('monster_pattern_card'),patternId)){
      const condition=r.card_link_condition_id;
      pattern.stacks.push(condition==='none'?-1:this.call('getEventStack',{res_id:condition,from:'MONSTER_PATTERN',parent_id:unit.id,use:'INDEX',remove:'REMOVE',caster_id:unit.id,owner_id:unit.id,index:i}));i++;
    }
    if(row.start_link_monster_card_id!=='none')this.b.startCardsReserved.push([unit.id,row.start_link_monster_card_id]);
    for(let i=0;;i++){
      const resId=row['passive'+i+'_link_monster_card_id'];if(resId==null)break;if(resId==='none')continue;
      const cardInfo=this.call('makeCardInfo',this.b.last_unit_id++,resId,unit.id),card=this.call('createBattleCard',cardInfo,{isPassive:true});
      (pattern.passive_card_ids??=[]).push(card.id);
    }
    return pattern;
  }
  // MonsterProc.pushActionPhase 0x2b200.
  pushActionPhase(unit,useStart=false,play=false,actioned){
    useStart??=false;play??=false;
    if(!actioned){this.w.monsterNotiCache.delete(unit.id);this.pushMonsterNoti(unit.id,{noti_type:'N_UNKNOWN',card_res_id:''},false);this.checkGroggy(unit.id,'N_UNKNOWN');}
    const pattern=this.b.monsterPattern[unit.id],phase=this.b.monsterPhase[unit.id];let patternId,index;
    if(pattern&&phase){patternId=pattern.pattern_id;index=phase.current_phase;}
    else if(useStart&&unit.start_phase!=null){
      const monster=this.db.get('monster',unit.res_id);let row;
      for(const r of loadRowsByKey(this.db.table('monster_pattern_set'),monster.link_monster_pattern_set_key))if(r.phase==unit.start_phase)row=r;
      if(!row)return;patternId=row.phase_link_monster_pattern_id;index=unit.start_phase;
    }else return;
    this.e.pushAction({id:this.b.last_action_id++,type:'action_phase_change',source_id:unit.id,pattern_id:patternId,pattern_index:index,play});
  }
  // Worktable 0xad400: remove only the first unlock in the newest matching block.
  clearUnlockAction(){
    for(let i=this.b.action_blocks.length-1;i>=0;i--){const actions=this.b.action_blocks[i].actions,at=actions.findIndex(a=>a.type==='action_monster_unlock');if(at>=0){actions.splice(at,1);return;}}
  }
  shieldMaintain(unit,player){
    const old=unit.status.info.S_CURRENT_SHIELD;if(old==0)return;
    const passives=this.call('getPassiveByType',{source_id:unit.id,type:'SKILL_EFF_SHIELD_MAINTAIN',is_card:false});
    let pct=0,chosen=-1;
    passives.forEach(p=>{const value=this.call('calcValue',p.skill_id);if(chosen<0||value>pct){pct=value;chosen=p.skill_id;}});
    if(pct>100)pct=100;const next=roundGame(old*pct/100);
    if(chosen>=0)this.call('checkTermValuePassive',chosen,-1);
    this.call('setStatus',unit.id,'S_CURRENT_SHIELD',next);
    if(player&&chosen>=0&&next>0)this.call('addDetailLog',{type:this.call('getDetailLogType','log_skill_eff_shield_maintain'),params:[unit.id,next],param_types:[this.call('getLogParamType','unit_id'),this.call('getLogParamType','value')]});
    const current=unit.status.info.S_CURRENT_SHIELD;
    this.e.pushAction({id:this.b.last_action_id++,type:player?'action_shield_change':'action_shield',source_id:unit.id,action_list:[{action_units:[[unit.id,{shield:current-old,old_shield:old,new_shield:current,new_hp:unit.status.info.S_CURRENT_HP}]]}],card_id:0});
    this.call('procUnitEvent','CONDITION_CHAR_SHIELD',[unit.id,'',current-old]);
  }
  // 0xc5b00 / 0xc8500. Native monster loop captures initial length.
  removeShield(){if(!this.w.isPreview)this.shieldMaintain(this.b.char,true);}
  removeMonShield(){
    const length=this.b.monsters.length;
    for(let i=0;i<length;i++){const m=this.b.monsters[i];if(['death','half_death','keep_half_death','run','changed','prop'].includes(m.state))continue;this.shieldMaintain(m,false);}
  }
  getKeywordByStatType(type){return ({S_CURRENT_HP:'cur_hp',S_HP:'max_hp',S_CURRENT_SHIELD:'shield'})[type]??'';}
  // GameConstants 0x9300 and loadConstants 0x3a00/anonymous_4,5.
  getBattlePreviewDmgKeys(){
    return Object.values(this.db.table('battle_cs_preview')).filter(row=>row.cs_preview_type.includes('DAMAGE')).map(row=>row.id);
  }
  // MonsterProc 0x17200. Only configured periodic-damage CS changes rebuild
  // the total; the preview evaluator keeps its native RNG and event semantics.
  refreshAlwaysDamage(id,resId){
    if(this.w.isPreview||!this.e.getMonster(id))return;
    const keys=this.getBattlePreviewDmgKeys();if(!keys.includes(resId))return;
    const monster=this.e.getUnit(id),wasFatal=this.call('isAlwaysDamageFatal',monster);
    monster.alwaysDamage=keys.reduce((total,key)=>total+this.call('getContinueSkills',monster)
      .filter(csId=>this.b.csMap[csId]?.res_id==key)
      .reduce((sum,csId)=>{
        const cs=this.b.csMap[csId];if(!cs||cs.removed)return sum;
        const preview=this.call('procSkillEffsPre',cs.skillEffs);
        return sum+(preview?.reduce((damage,[targetId,result])=>targetId==id&&result.damage!=null?damage+result.damage:damage,0)??0);
      },0),0);
    if(wasFatal!=this.call('isAlwaysDamageFatal',monster))this.call('refreshMonsterNoti');
  }
  // setStatus 0x194300 shield branch, with native parameter notifications,
  // notice refresh and optional damage statistics. Other stats are mandatory.
  setStatus(id,type,value,options={}){
    if(type!=='S_CURRENT_SHIELD')throw new MissingBattleRule('setStatus.nonShield',{id,type,value,options});
    const {trigger=true,dpt=false}=options??{},unit=this.e.getUnit(id),monster=!!this.e.getMonster(id),info=unit.status.info;
    if(!monster&&value>info.S_HP*2)value=info.S_HP*2;
    const old=info[type];info[type]=value;
    this.call('procUnitEvent','CONDITION_CHAR_PARAMETER',[id,'shield',old,value]);
    // Both arguments read after the assignment in native bytecode 1324..1485.
    if(trigger)this.call('procUnitEvent','CONDITION_CHAR_PARAMETER',[id,'shield_def_pct',info.S_CURRENT_SHIELD/info.S_DEF*100,value/info.S_DEF*100]);
    const damage=old-value;
    if(monster){
      if(dpt&&damage>0)this.b.dpt.shield_damage+=damage;
      let refresh=this.call('getPassiveByType',{source_id:id,type:'SKILL_EFF_NOTICE_CHANGE_SHIELD',is_card:false}).length>0;
      if(unit.alwaysDamage!=null){const previous=this.call('isAlwaysDamageFatal',unit,info.S_CURRENT_HP??0,old),now=this.call('isAlwaysDamageFatal',unit);if(previous!=now)refresh=true;}
      if(refresh)this.call('refreshMonsterNoti');
    }else if(dpt){
      if(damage>0)this.b.dpt.shield_damage_taken+=damage;
      else if(damage<0){
        const gained=-damage;this.b.dpt.shield_gained+=gained;
        let res;const card=this.b.current_card>=0?this.b.cardMap[this.b.current_card]:undefined;
        if(card&&card.char_id>0)res=this.call('tryGetCharByCharId',card.char_id)?.res_id;
        if(res){const stats=this.b.dpt.char_stats[res]??={damage:0,shield_gained:0,heal:0,overheal:0,heal_with_overheal:0};stats.shield_gained+=gained;}
      }
    }
    return value;
  }
  // MonsterProc 0x15e00, preview refresh without reselection.
  refreshMonsterNoti(force=false){
    if(this.w.isPreview)return;
    this.b.turn_end_dmg=0;this.w.previewPassiveMap.clear();this.w.previewInactivePassives=[];this.w.previewChangeCS={};
    for(const m of this.b.monsters){
      if(!this.call('isFieldMonster',m))continue;const old=m.mon_turn;
      const changed=this.call('monsterProcPatternPre',m,{reselect:false,death:this.call('isAlwaysDamageFatal',m)});
      if(force||!changed&&old!=m.mon_turn)this.e.pushAction({id:this.b.last_action_id++,type:'action_monster_turn_count',source_id:m.id,value:m.mon_turn});
      this.call('applyChangeCSPre');
    }
  }
}
