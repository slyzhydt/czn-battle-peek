// Complete native dispatch jump families; construction delegates to the same
// BattleProc hand-port used by waves. Source ranges: PROGRESS.md and callbacks.
import {MissingBattleRule} from './resource-store.mjs';
import {weightedKey} from '../../reward-investigation/weighted-core.mjs';
export const MONSTER_EFFECT_NAMES=new Set(['TURN_COUNT_ADD','MONSTER_CREATE','MOVE_SLOT','MONSTER_TURN_COUNT','MONSTER_CHANGE_DEATH_EFFECT','MONSTER_CHANGE','MONSTER_CARD_RESELECT_FORCE','MONSTER_CARD_RESELECT','MONSTER_CARD_OVERWRITE','RUN','USER_RUN','BATTLE_SKIP','CONTINUE_BATTLE','MULTI_HP_COND_CHANGE','TURN_OVER','ADD_CUSTOM_FINISH','PROP_CREATE','PROP_CREATE_REVERSE','MODEL_CREATE_REVERSE','PROP_REMOVE','PROP_COMMAND'].map(n=>'SKILL_EFF_'+n));
export const MONSTER_EFFECT_BINDINGS={dispatchMonsterEffect:'dispatch',removeProp:'removeProp'};
const PROP_KEYS=['id','content_id','res_id','visible','command','location','coord_dx','flip','name','scale','opacity','animation','anim_point','stance','z_order'];
export class MonsterEffectRuntime {
 constructor(e){this.e=e;this.b=e.b;this.w=e.wt;this.db=e.db;}
 call(n,...a){return this.e.call(n,...a);}
 get init(){return this.e.state.worktables.BattleInitWorktable.battle_init;}
 get stage(){return this.e.state.worktables.BattleStageWorktable.battle_stage;}
 action(type,source_id=-1,data={}){const action={id:this.b.last_action_id++,type,source_id,...data};this.e.pushAction(action);return action;}
 detail(type,params,param_types){this.call('addDetailLog',{type,params,param_types});}
 events(types){for(const type of types)this.call('procUnitEvent',type,[]);}
 occupied(slot){return this.b.monsters.find(m=>m.slot_idx==slot&&!['death','run','changed'].includes(m.state));}
 deathParts(state){for(const m of this.b.monsters)if(!['death','run','changed'].includes(m.state)&&['3000389','3000390'].includes(this.db.table('monster')[m.res_id]?.link_model_define_id?.toString()))m.state=state;}
 dispatch(id,c){const s=this.b.skillMap[id],r=this.db.get('skill_eff',s.res_id),opts=s.eff_opts??[],links=this.db.array(r.eff_opt_multiple_link),targets=c.targets,b=this.b;let value;
  if(!MONSTER_EFFECT_NAMES.has(r.eff))throw new MissingBattleRule('monsterEffect.dispatch',{eff:r.eff});
  switch(r.eff){
   case 'SKILL_EFF_TURN_COUNT_ADD':{const checked=b.spark_checked_turn==b.turn,old=b.turn;b.turn=this.call('procMathSign',r.eff_value_math_sign,b.turn,this.call('calcValue',id));if(checked)b.spark_checked_turn=b.turn;this.detail('log_skill_eff_turn_count_add',[b.turn-old],['delta']);this.e.timing.procTimingEvent('TIMING_TURN');break;}
   case 'SKILL_EFF_TURN_OVER':b.forced_turn_over=true;break;
   case 'SKILL_EFF_CONTINUE_BATTLE':this.action('action_battle_continue');break;
   case 'SKILL_EFF_RUN':{const m=this.call('getUnitByID',s.caster_id);m.state='run';if(this.db.table('monster')[m.res_id]?.link_model_define_id?.toString()==='3000383')this.deathParts('run');if(!m.summoner)this.w.last_dead_mon=m.id;this.action('action_monster_run',c.source_id,{card_id:s.parent.type==='CARD'?s.parent.id:-1,byCard:c.options?.byCard});this.detail('log_skill_eff_run',[m.id],['unit_id']);this.call('removeMonsterCsWithCleanup',m);this.events(['CONDITION_MONSTER_AMOUNT','CONDITION_MONSTER_AMOUNT_SET','CONDITION_CHAR_FRONT_EMPTY','CONDITION_CHAR_CS_AMOUNT','CONDITION_OWN_CHAR_CS_AMOUNT']);break;}
   case 'SKILL_EFF_USER_RUN':{const chance=this.call('calcValue',id);if(chance==100){b.game_result='BATTLE_RESULT_TYPE_SKIP';b.game_end=true;this.action('action_battle_skip');return {targets:[],returnEarly:true};}
    const threshold=(100-chance)/5,roll=this.e.random.randRange(0,1,21);if(roll>=threshold){b.game_result='BATTLE_RESULT_TYPE_SKIP';b.game_end=true;this.action('action_battle_skip',-1,{play:true,value:roll,value_temp:threshold});return {targets:[],returnEarly:true};}this.action('action_battle_dice',-1,{value:roll,value_temp:threshold});break;}
   case 'SKILL_EFF_BATTLE_SKIP':{const battle=this.db.table('battle')[this.init.battle_res_id];if(!battle)break;let escape=false;
    for(const res of this.db.array(battle.link_battle_custom_finish_id))if(this.db.get('battle_custom_finish',res).check_type==='BATTLE_FIN_TYPE_ESCAPE'){escape=true;b.game_result='BATTLE_RESULT_TYPE_SKIP';}
    for(const finish of b.finish_conditions)if(finish.check_types.includes('BATTLE_FIN_TYPE_ESCAPE')){b.game_result='BATTLE_RESULT_TYPE_SKIP';return {targets:[],returnEarly:true};}
    if(!escape&&battle.battle_type!=='SPOT_TYPE_BOSS'){b.game_result='BATTLE_RESULT_TYPE_SKIP';b.game_end=true;this.action('action_battle_skip');return {targets:[],returnEarly:true};}break;}
   case 'SKILL_EFF_MOVE_SLOT':{const slot=opts.map(x=>Number(x.slice('slot'.length))).find(x=>!this.occupied(x));if(slot>=0){const m=this.call('getUnitByID',s.caster_id);m.slot_idx=slot;this.action('action_monster_move',m.id,{target_id:[slot]});this.events(['CONDITION_CHAR_FRONT_EMPTY']);}break;}
   case 'SKILL_EFF_MONSTER_TURN_COUNT':this.turnCount(id,targets);break;
   case 'SKILL_EFF_MONSTER_CARD_RESELECT_FORCE':case 'SKILL_EFF_MONSTER_CARD_RESELECT':
    if(!b.enemy_turn)for(const target of targets){const m=this.call('getUnitByID',target);this.call('monsterProcPatternPre',m,{reselect:true,except_before:!opts.includes('allow_reuse'),force:r.eff==='SKILL_EFF_MONSTER_CARD_RESELECT_FORCE'});this.unlock();}break;
   case 'SKILL_EFF_MONSTER_CARD_OVERWRITE':for(const target of targets){const m=this.call('getUnitByID',target);this.call('monsterProcPatternPre',m,{force_refresh:true,overwrite:opts[0]});this.unlock();}break;
   case 'SKILL_EFF_MULTI_HP_COND_CHANGE':{const index=Number(opts[0]);if(!isNaN(index))for(const target of targets){if(!this.e.getMonster(target))continue;const m=this.call('getUnitByID',target);if(this.db.table('monster')[m.res_id]?.grade!=='GRADE_MULTI_HP')continue;m.multi_hp_index=Math.min(index,1);if(opts.includes('hp_max')){const max=this.call('getStatus',target,'S_HP'),old=this.call('getStatus',target,'S_CURRENT_HP');this.call('setStatus',target,'S_CURRENT_HP',max,{trigger:false});this.action('action_heal',target,{action_list:[{action_units:[[target,{heal:max-old,old_hp:old,new_hp:max,max_hp:max}]]}]});}}break;}
   case 'SKILL_EFF_ADD_CUSTOM_FINISH':for(let i=links.length-1;i>=0;i--)b.finish_conditions.unshift(this.call('createBattleCustomFinish',links[i]));break;
   case 'SKILL_EFF_MONSTER_CREATE':this.summon(id,links,c);break;
   case 'SKILL_EFF_MONSTER_CHANGE':case 'SKILL_EFF_MONSTER_CHANGE_DEATH_EFFECT':for(const target of targets){const old=this.call('getUnitByID',target);if(old.state==='changed')return {targets:[],returnEarly:true};this.change(id,old,links[0],c);}break;
   case 'SKILL_EFF_PROP_REMOVE':this.removeProp(opts);break;
   case 'SKILL_EFF_PROP_COMMAND':{const location=opts[0],command=opts[1];if(location==null)throw new MissingBattleRule('prop_remove_effect_option_count_under_1');const prop=Object.values(b.propMap??{}).find(p=>p.location==location);if(command==null)throw new MissingBattleRule('prop_command_option_not_exist');if(prop&&prop.command!=='sys_remove'){prop.command=command;this.action('action_prop_command',-1,{action_prop:{prop_id:prop.id,prop_info:prop}});}break;}
   default:this.createProp(r.eff,opts,links);
  }return value===undefined?{targets}:{targets,value};
 }
 unlock(){this.call('refreshMonsterNoti');this.call('clearUnlockAction');this.b.phase_changed=true;this.action('action_monster_unlock');}
 turnCount(id,targets){const s=this.b.skillMap[id],r=this.db.get('skill_eff',s.res_id),actionMonsters=[];let changed=false;
  for(const target of targets){const m=this.call('getUnitByID',target);if(!this.call('isFieldMonster',m)||m.mon_turn==null||!(m.mon_turn>0))continue;
   const blockers=this.call('getMonsterTurnCountBlockPassives',m.id,s.caster_id);if(this.call('checkMonsterTurnCountBlockedByPassives',blockers,s.caster_id))continue;
   const old=m.mon_turn,next=Math.max(0,this.call('procMathSign',r.eff_value_math_sign,m.mon_turn,this.call('calcValue',id,target)));if(this.call('checkMonsterTurnCountBlockedByPassives',blockers,s.caster_id,{is_increase:next>old,source_skill_id:s.skill_id,relic_only:true}))continue;
   m.mon_turn=next;if(next==old)continue;changed=true;this.action('action_monster_turn_count',m.id,{value:next});const delta=next-old,kind=this.b.using_card?'card':'',parent=this.call('getParentCard',id)?.id,card=kind==='card'?(parent??this.b.current_card):-1;
   this.call('procUnitEvent',delta>0?'CONDITION_TURN_COUNT_INCREASE':'CONDITION_TURN_COUNT_DECREASE',[m.id,kind,s.action_char_id,Math.abs(delta),card]);if(next==0&&!this.b.using_card)actionMonsters.push(m);
  }
  if(changed)this.events(['CONDITION_ALL_MONSTER_TURN_COUNT','CONDITION_ANY_MONSTER_TURN_COUNT']);
  const fatal=this.call('checkFatalAttack',actionMonsters);if(fatal.fatal&&fatal.target!=null&&fatal.owner!=null){this.action('action_fatal_attack',fatal.owner.id,{stress_death_char_res_id:fatal.target.res_id,card_res_id:fatal.owner.nextCard});this.stage.fatal_end=true;this.stage.fatal_target_res_id=fatal.target.res_id;if(this.b.finish_conditions.every(c=>!c.check_types.includes('BATTLE_FIN_DEFEAT'))){this.b.game_end=true;this.b.game_result='BATTLE_RESULT_TYPE_STAGE_FAILED';}}
  else for(const m of actionMonsters)this.call('monsterProcPattern',m);
 }
 removeProp(opts){const location=opts[0];if(location==null)throw new MissingBattleRule('prop_remove_effect_option_count_under_1');let removed;for(const id in this.b.propMap){const p=this.b.propMap[id];if(p.location==location){removed=p;delete this.b.propMap[id];this.call('pushRemoveData','prop',id);break;}}
  if(removed){removed.command='sys_remove';this.action('action_prop_remove',-1,{action_prop:{prop_id:removed.id,prop_info:removed}});}
 }
 createProp(eff,opts,links){const location=opts[0],res=eff==='SKILL_EFF_MODEL_CREATE_REVERSE'?'model/'+links[1]:links[0],command=opts[1];if(location==null||res==null)throw new MissingBattleRule('prop_create_effect_option_count_under_2');
  const id=this.b.last_unit_id++;this.db.get('prop_instance',res.toString());const info={id,command:'sys_create',name:res,content_id:id.toString(),res_id:res,location,coord_dx:0,visible:true,animation:'',opacity:255,scale:100,z_order:0};if(eff!=='SKILL_EFF_PROP_CREATE')info.flip=true;
  if(Object.values(this.b.propMap??{}).some(p=>p.location==location))this.removeProp([location]);const prop=Object.fromEntries(PROP_KEYS.map(k=>[k,info[k]]));this.b.propMap[id]=prop;this.action('action_prop_create',-1,{action_prop:{prop_id:id,prop_info:info}});
  if(command!=null&&command!==''){prop.command=command;this.action('action_prop_command',-1,{action_prop:{prop_id:id,prop_info:prop}});}
 }
 // Construction/phase chain callbacks342..354. All summoners are collected
 // before action creation; CS and phase setup follow the summon action.
 summon(id,resIds,c){const s=this.b.skillMap[id],opts=s.eff_opts??[],summoner=this.call('getUnitByID',s.caster_id),created=[];
  for(const res of resIds){const r=this.db.get('monster_create',res),copies=this.e.csTransfers.classify(summoner.continueSkill,opts).map(id=>this.b.csMap[id]);let slot=-1;
   switch(r.create_position_type){case 'TYPE_CREATURE_PARENT_FRONT':slot=summoner.slot_idx-1;while(slot>=0&&this.occupied(slot))--slot;break;
    case 'TYPE_SLOT':for(const n of this.db.array(r.create_position).map(Number))if(!this.occupied(n)){slot=n;break;}break;
    case 'TYPE_RANDOM':{const battle=this.db.get('battle',this.init.battle_res_id);let count=0;for(let i=0;battle['slot'+i+'_type']!=null;i++)if(battle['slot'+i+'_type']!=='none')++count;const empty=[];for(let i=0;i<count;i++)if(!this.occupied(i))empty.push(i);slot=this.e.random.randomArrayMember(0,empty);break;}
    default:throw new MissingBattleRule('invalid_CREATE_POSITION_TYPE',{res,type:r.create_position_type});}
   if(!(slot>=0))continue;const weights={},choices=[];for(let i=0;;i++){const monster=r['create_'+i+'_link_monster_id'];if(monster==null||monster==='none')break;const phase=Number(r['create_'+i+'_monster_phase']),key=monster+phase;if(key in weights)throw new MissingBattleRule('duplicate_create_link_monster_id',{res,key});weights[key]=Number(r['create_'+i+'_ratio']);choices.push({res_id:monster,phase,prop_id:r['create_'+i+'_link_prop_instance_id']||'none',ps_offset:r['create_'+i+'_ps_offset_value']==null?undefined:Number(r['create_'+i+'_ps_offset_value'])});}
   const key=weightedKey(weights,(a,b)=>this.e.random.randRange(0,a,b),false,'summon_creature'),resId=key.slice(0,-1),phase=Number(key.slice(-1)),pick=choices.find(c=>c.res_id==resId&&c.phase==phase),info=this.b.monster_res_ids[slot];if(!info)throw new MissingBattleRule('monster_create.slot_init_info',{slot});
   const m=this.call('createMonster',{worktable:this.w,monster_res_id:resId,coord:slot,originMonster:opts.includes('eq_pct_hp')?summoner:undefined,isCreatureBattleEnd:r.create_monster_type==='TYPE_CREATURE_IRRELEVENT',init_state:'summoned',ps:info.ps??1,ps_offset:(info.ps_offset??1)*(pick?.ps_offset??1),assault_slot_ps:info.assault_slot_ps});
   m.summoner=summoner.id;m.drop=false;m.creature_type=r.create_monster_type;(summoner.creatures??=[]).push(m.id);const position=this.b.empty_coords?.find(p=>p.slot_idx==m.slot_idx);if(position){m.coord_dx=position.coord_dx;m.pos=position.coord;}m.content_id=pick?.prop_id??pick?.res_id??'';created.push([m,r,copies,phase]);
  }
  if(created.length){this.action('action_monster_summon',s.action_char_id,{action_monster_new:created.map(([m])=>({new_id:m.id,index:m.slot_idx,hp:m.status.info.S_CURRENT_HP,max_hp:m.status.info.S_HP,coord:m.pos,coord_dx:m.coord_dx})),byCard:c.options?.byCard});this.detail('log_skill_eff_create',[created.map(([m])=>m.id)],['monster_ids']);}
  for(const [m,r,copies,phase]of created){if(r.create_monster_cs!=='none')this.call('procAddCS',m.id,r.create_monster_cs,1,summoner.id,false,'MATHSIGN_ADD',true,true,summoner.id,s.skill_id);this.call('createMonsterPhase',{monster:m,phase});this.events(['CONDITION_MONSTER_AMOUNT','CONDITION_MONSTER_AMOUNT_SET','CONDITION_CHAR_FRONT_EMPTY']);this.call('pushLog','create_monster '+m.res_id);
   for(const cs of copies)this.call('procAddCS',m.id,cs.res_id,cs.term_value,cs.caster_id,false,'MATHSIGN_SET',false,true,cs.char_id,s.skill_id);this.call('applyMonsterStartCSToMonster',m);
   if(!this.b.enemy_turn&&!['prop','keep_half_death'].includes(m.state)){const card=s.parent.type==='CARD'?this.b.cardMap[s.parent.id]:undefined,delayed=s.parent.type!=='CARD'||card.args?.isPassive||card.args?.isStart;if(m.state!=='half_death')m.state='none';if(delayed){if(!this.w.isPreview)m.mon_turn_delay=true;}else{m.actioned=true;m.mon_turn=-1;this.action('action_monster_turn_count',m.id,{value:m.mon_turn});}this.call('monsterProcPatternPre',m);this.call('refreshMonsterNoti');}
  }
 }
 change(id,old,res,c){const s=this.b.skillMap[id],r=this.db.get('skill_eff',s.res_id),copies=this.e.csTransfers.classify(this.call('getContinueSkills',old),s.eff_opts??[]).map(id=>this.b.csMap[id]),m=this.call('createMonster',{worktable:this.w,monster_res_id:res,coord:old.slot_idx,originMonster:old,hpPct:this.call('calcValue',id,old.id),keywords:old.keywords,ps:old.ps,ps_offset:old.ps_offset,assault_slot_ps:old.assault_slot_ps});
  if(!s.eff_opts?.includes('shield_reset'))this.call('setStatus',m.id,'S_CURRENT_SHIELD',old.status.info.S_CURRENT_SHIELD);m.drop=old.drop;
  if(old.drop_mon_card!=null){const cards=this.call('getMonsterUniqueCards',[m.res_id],this.stage.content_extra_tags,this.call('isAssaultMode'));m.drop_mon_card=cards.length?this.e.random.randomArrayMember(0,cards):undefined;}
  old.state='changed';old.changed=m.id;this.call('removeMonsterCsWithCleanup',old);if(old.summoner!=null){const summoner=this.call('getUnitByID',old.summoner),index=summoner.creatures?.findIndex(id=>id==old.id);if(index>=0)summoner.creatures[index]=m.id;m.summoner=old.summoner;}m.coord_dx=old.coord_dx;
  this.call('pushLog','change_monster '+old.res_id+' to '+m.res_id);this.action('action_monster_change',s.action_char_id,{action_monster_new:[{old_id:old.id,new_id:m.id,index:m.slot_idx,hp:m.status.info.S_CURRENT_HP,max_hp:m.status.info.S_HP,shield:m.status.info.S_CURRENT_SHIELD,coord:m.pos,coord_dx:m.coord_dx,ego_field_value:m.ego_field_value,ego_field_max_value:m.ego_field_max_value}],byCard:c.options?.byCard,play:r.eff==='SKILL_EFF_MONSTER_CHANGE_DEATH_EFFECT'});this.detail('log_skill_eff_monster_change',[old.id,m.id],['unit_id','unit_id']);this.call('createMonsterPhase',{monster:m});this.events(['CONDITION_MONSTER_AMOUNT','CONDITION_MONSTER_AMOUNT_SET','CONDITION_CHAR_FRONT_EMPTY','CONDITION_CHAR_CS_AMOUNT','CONDITION_OWN_CHAR_CS_AMOUNT']);
  for(const cs of copies)this.call('procAddCS',m.id,cs.res_id,cs.term_value,cs.caster_id==old.id?m.id:cs.caster_id,false,'MATHSIGN_SET',false,true,cs.char_id==old.id?m.id:cs.char_id,s.skill_id);
  if(!this.b.enemy_turn){m.state='none';this.call('monsterProcPatternPre',m);this.call('refreshMonsterNoti');}else m.state='summoned';
 }
}
