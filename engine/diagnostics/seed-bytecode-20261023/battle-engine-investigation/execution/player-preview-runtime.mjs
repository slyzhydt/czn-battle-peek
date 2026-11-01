// Hand ports of CardProc preview families. Source: evidence/player-auto-command/
// preview. Each simulation has a freshly constructed executor; non-restored
// side roots evolve between simulations and are committed, rather than lost.
import {MissingBattleRule} from './resource-store.mjs';
export const PLAYER_PREVIEW_BINDINGS={getCardPreview:'getCardPreview',createEmptyPreviewData:'createEmptyPreviewData',serializeBattleLean:'serializeBattleLean',captureSimInstanceState:'captureSimInstanceState',restoreSimInstanceState:'restoreSimInstanceState',fillUseSimTriggered:'fillUseSimTriggered',applyTurnEndHpPreview:'applyTurnEndHpPreview'};
export const PREVIEW_INSTANCE_FIELDS=Object.freeze(['byCard','changeMap','check_types','connect_move_info','deaths','deferredActions','deferredSubLogs','egoBreak','egoBreaked','interrupted','last_dead_mon','last_dead_summons','lead_action','monsterNotiCache','passiveTriggered','phaseTriggered','previewChangeCS','previewInactivePassives','previewPassiveMap','removeMap','skillTriggeredCount','sparking','target_effect_off','tempActions','termPassiveImmediatlyList','triggeredList','turn_over_first_turn','turn_over_reserved','turn_start_action','useAction','userActions']);
const DEEP=new Set(['changeMap','connect_move_info','lead_action','previewChangeCS','removeMap','turn_start_action']),SLICES=new Set(['check_types','deaths','deferredActions','deferredSubLogs','last_dead_summons','passiveTriggered','phaseTriggered','previewInactivePassives','tempActions','termPassiveImmediatlyList','userActions']),OPTIONAL=new Set(['check_types','deferredActions','deferredSubLogs','last_dead_summons','tempActions']),MAPS=new Set(['monsterNotiCache','previewPassiveMap']);
const live=m=>!['death','run','changed','prop','half_death','keep_half_death'].includes(m.state);
const clone=structuredClone;
export class PlayerPreviewRuntime {
 constructor(e){this.e=e;}
 get w(){return this.e.wt;}get b(){return this.e.b;}get stageWT(){const w=this.w.battle_stage_worktable??this.e.state.worktables?.BattleStageWorktable;if(!w)throw new MissingBattleRule('input.BattleStageWorktable.preview');return w;}
 call(n,...a){return this.e.call(n,...a);}
 createEmptyPreviewData(limitless=true){const out={relic:[],ego:[],cs:[],dmg_valueadd:[],shield_valueadd:[],maxHpMap:{},hpMap:{},shieldMap:{},egoMap:{},monTurnMap:{},energy:0};if(limitless)out.limitlessHpDiffMap={};return out;}
 instanceCopy(source){const out={};for(const k of PREVIEW_INSTANCE_FIELDS){const v=source[k];out[k]=DEEP.has(k)?clone(v):MAPS.has(k)?new Map(v):SLICES.has(k)?OPTIONAL.has(k)?v?.slice():v.slice():v;}return out;}
 captureSimInstanceState(w=this.w){return this.instanceCopy(w);}
 restoreSimInstanceState(saved,w=this.w){Object.assign(w,this.instanceCopy(saved));}
 serializeBattleLean(b=this.b){const logs=b.battle_logs,map=b.previewMap;b.battle_logs=[];b.previewMap={};try{return {json:JSON.stringify(b),battle_logs:logs};}finally{b.battle_logs=logs;b.previewMap=map;}}
 // Worktable.clearCardUseInfos0x4e400 creates fresh empty arrays, not undefined.
 clearUses(){this.b.cardRepeats=[];this.b.cardUses=[];this.b.cardCoops=[];this.b.coop_reserved=undefined;}
 makeExecutor(state,owned=false){return new this.e.constructor({state,resources:this.e.db,enums:this.e.enums,ports:this.e.extensions,valueTextLocale:this.e.valueTextLocale,executionHost:this.e.executionHost,previewStateTransfer:this.e.previewStateTransfer,takeStateOwnership:owned&&this.e.previewStateTransfer,captureDiagnostics:this.e.captureDiagnostics,fastBranches:this.e.fastBranches});}
 seed(e=this.e){const r=e.state.randoms.get(0);if(!r)throw new MissingBattleRule('preview.INGAME');return r.state;}
 setSeed(seed,e=this.e){const r=e.state.randoms.get(0);if(!r)throw new MissingBattleRule('preview.INGAME');r.state=seed;}
 replace(b){this.e.replaceBattleForPreview(b);}
 monster(id){return this.e.getMonster(id);}
 // CardProc.fillUseSimTriggered0xea00 and five closures. Maps hold absolute
 // post-simulation values, except limitless HP uses negative accumulated damage.
 fillUseSimTriggered(monsters,max,hp,shield,ego){const w=this.w,b=this.b,p=w.triggeredList,info=b.char.status.info,id=b.char.id;p.collapse_char_id_array=this.stageWT.battle_stage.chars.filter(x=>x.collapse_on==true).map(x=>x.id);p.maxHpMap[id]=info.S_HP;p.hpMap[id]=info.S_CURRENT_HP;p.shieldMap[id]=info.S_CURRENT_SHIELD;
  for(const previous of monsters){const m=this.monster(previous.id);if(!m)continue;const s=m.status.info,key=previous.id;if(s.S_HP!=max[key])p.maxHpMap[key]=s.S_HP;
   if(m.is_limitless===true){const diff=p.limitlessHpDiffMap?.[key]||0;if(diff>0||w.deaths.includes(m.id))p.hpMap[key]=diff>0?-diff:s.S_CURRENT_HP;}
   else if(s.S_CURRENT_HP!=hp[key]||w.deaths.includes(m.id))p.hpMap[key]=s.S_CURRENT_HP;
   if(s.S_CURRENT_SHIELD!=shield[key])p.shieldMap[key]=s.S_CURRENT_SHIELD;if(m.ego_field_value!=null&&m.ego_field_value!=ego[key])p.egoMap[key]=m.ego_field_value;if(m.mon_turn!=null)p.monTurnMap[key]=m.mon_turn;
  }
  w.deaths.forEach(key=>{if(p.hpMap[key]!=null){p.hpMap[key]=0;p.shieldMap[key]=0;}});w.egoBreaked?.forEach(key=>{if(p.egoMap[key]!=null)p.egoMap[key]=0;});p.energy=b.energy;
 }
 // CardProc.applyTurnEndHpPreview0x5a00. Only the source's nine instance
 // fields are restored; Init, other WT fields and non-INGAME streams survive.
 applyTurnEndHpPreview(data,monsters,max,hp,shield){const e=this.e,w=this.w,L=e.enums.LogicState;if(this.b.game_end)return;const main=[L.MainPhase,L.MainPhaseAutoAvailable].includes(this.b.current_state);if(!main&&w.isPreview==0)return;
  const seed=this.seed(),battleJSON=JSON.stringify(this.b),stageJSON=JSON.stringify(this.stageWT.battle_stage),saved={triggeredList:w.triggeredList,deaths:clone(w.deaths),monsterNotiCache:new Map(w.monsterNotiCache),changeMap:clone(w.changeMap),removeMap:clone(w.removeMap),skillTriggeredCount:w.skillTriggeredCount,egoBreak:w.egoBreak,egoBreaked:w.egoBreaked,turnEndHpPreviewing:w.turnEndHpPreviewing},baseHp={[this.b.char.id]:this.b.char.status.info.S_CURRENT_HP};
  monsters.forEach(x=>{const m=this.monster(x.id);if(m)baseHp[m.id]=m.status.info.S_CURRENT_HP;});const sim=this.makeExecutor(e.state),r=new PlayerPreviewRuntime(sim);
  try{sim.wt.triggeredList=clone(data);sim.wt.triggeredList.turn_end_final_ecv=undefined;sim.wt.turnEndHpPreviewing=true;if(!main)sim.b.current_state=L.MainPhase;sim.actions.start();if(!sim.call('procEndOfTurn',false))return;
   const p=sim.wt.triggeredList;if(p.limitlessHpDiffMap!=null)data.limitlessHpDiffMap=clone(p.limitlessHpDiffMap);if(p.turn_end_final_ecv!=null)data.turn_end_final_ecv=clone(p.turn_end_final_ecv);
   data.turnEndMaxHpMap={};data.turnEndHpMap={};data.turnEndHpDamageMap={};data.turnEndShieldMap={};const id=sim.b.char.id,s=sim.b.char.status.info;data.turnEndMaxHpMap[id]=s.S_HP;data.turnEndHpMap[id]=s.S_CURRENT_HP;data.turnEndHpDamageMap[id]=Math.max(0,baseHp[id]-s.S_CURRENT_HP);data.turnEndShieldMap[id]=s.S_CURRENT_SHIELD;
   for(const before of monsters){const m=sim.getMonster(before.id);if(!m)continue;const key=before.id,v=m.status.info;if(v.S_HP!=max[key])data.turnEndMaxHpMap[key]=v.S_HP;
    if(m.is_limitless===true){const diff=p.limitlessHpDiffMap?.[key]||0;if(diff>0||sim.wt.deaths.includes(m.id))data.turnEndHpMap[key]=diff>0?-diff:v.S_CURRENT_HP;}
    else if(v.S_CURRENT_HP!=hp[key]||sim.wt.deaths.includes(m.id))data.turnEndHpMap[key]=v.S_CURRENT_HP;
    if(v.S_CURRENT_SHIELD!=shield[key])data.turnEndShieldMap[key]=v.S_CURRENT_SHIELD;}
   sim.wt.deaths.forEach(key=>{if(data.turnEndHpMap?.[key]!=null){data.turnEndHpMap[key]=0;if(baseHp[key]!=null)data.turnEndHpDamageMap[key]=Math.max(0,baseHp[key]);data.turnEndShieldMap[key]=0;}});data.turnEndHpPreview=true;
  }finally{e.lastTurnEndPreviewTrace=clone(sim.trace);e.adoptPreviewSideState(sim.state);this.setSeed(seed);this.stageWT.battle_stage=JSON.parse(stageJSON);this.replace(JSON.parse(battleJSON));Object.assign(this.w,saved);e.record({kind:'preview-turn-end',randomDraws:sim.trace.filter(x=>x.kind==='random').length});}
 }
 targets(ids,monsters,auto){if(ids.length<=1||monsters.length<=1)return ids;const models=list=>{const seen=new Set(),out=[];for(const id of list){const m=monsters.find(x=>x.id==id);if(!m)continue;const key=m.res_id.split('_')[0];if(seen.has(key))continue;seen.add(key);out.push(id);}return out;};if(auto)return models(ids);const bosses=ids.filter(id=>{const m=monsters.find(x=>x.id==id);return m&&this.e.db.table('monster')[m.res_id]?.grade==='GRADE_BOSS';});return bosses.length?bosses:models(ids);}
 aggregate(out){let first=true;for(const key of Object.keys(out)){const p=out[key];if(first){out[-1]=clone(p);out[-1].target_outline=undefined;out[-1].run_check_outline=undefined;out[-1].turnEndHpPreview=undefined;out[-1].turn_end_checked=true;first=false;continue;}
   const all=out[-1];all.shieldDestroyedTargets=all.shieldDestroyedTargets?.filter(x=>p.shieldDestroyedTargets?.includes(x));for(const field of ['dmg_valueadd','shield_valueadd','relic','ego','cs'])all[field]=all[field].filter(x=>p[field].includes(x));
   if(all.final_ecv&&p.final_ecv)for(const k in p.final_ecv)all.final_ecv[k]=all.final_ecv[k]?Math.min(all.final_ecv[k],p.final_ecv[k]):p.final_ecv[k];}}
 getCardPreview(options){const e=this.e,w=this.w;if(this.b.ai_simulator_seed==null&&e.executionHost==='server')return;
  const seed=this.seed(),saved=this.captureSimInstanceState(),lean=this.serializeBattleLean(),battleJSON=lean.json,stageJSON=JSON.stringify(this.stageWT.battle_stage),map={},oldMap=this.b.previewMap,oldScope=w.preview_scope,oldPreview=w.isPreview,ep=this.b.ep_skill_deck.slice(0,3).filter(x=>x!=null),ids=this.b.deck_info.hand.slice().concat(ep.map(x=>x.card_id));if(this.b.temp_ep_skill_slot)ids.push(this.b.temp_ep_skill_slot.card_id);
  const monsters=clone(this.b.monsters.filter(live)),max={},hp={},shield={},ego={},turn={};for(const m of [this.b.char,...monsters]){max[m.id]=m.status.info.S_HP;hp[m.id]=m.status.info.S_CURRENT_HP;shield[m.id]=m.status.info.S_CURRENT_SHIELD;if(m!==this.b.char){ego[m.id]=m.ego_field_value;turn[m.id]=m.mon_turn;}}
  const targetTypes={};for(const id of ids){const c=this.b.cardMap[id],row=e.db.get('card',c.res_id);targetTypes[id]=this.call('getTargetTypeByTargetForUI',row.target_for_ui);}const auto=options?.scope==='auto';let last=e,success=false;e.lastPreviewTrace=[];
  const record=(phase,sim,details={})=>{const trace=clone(sim.trace);e.lastPreviewTrace.push({phase,...details,trace});e.record({kind:'preview-simulation',phase,...details,randomDraws:trace.filter(x=>x.kind==='random').length});};
  const prepare=(preview,clear=true)=>{const sim=this.makeExecutor(last.state,last!==e),r=new PlayerPreviewRuntime(sim);r.restoreSimInstanceState(saved);r.setSeed(seed);r.stageWT.battle_stage=JSON.parse(stageJSON);r.replace(JSON.parse(battleJSON));if(clear)r.clearUses();sim.wt.egoBreak=undefined;sim.wt.egoBreaked=undefined;sim.wt.isPreview=preview;last=sim;return {sim,r};};
  const setup=(sim,id,isTemp,limitless)=>{sim.wt.triggeredList=this.createEmptyPreviewData(limitless);sim.wt.deaths=[];sim.b.current_state=e.enums.LogicState.MainPhase;sim.b.interrupts=[];sim.wt.skillTriggeredCount=0;if(!isTemp)sim.b.temp_ep_skill_slot=undefined;};
  try{let initial=prepare(-2);initial.sim.wt.triggeredList=this.createEmptyPreviewData();initial.sim.wt.deaths=[];initial.sim.b.interrupts=[];initial.sim.wt.skillTriggeredCount=0;const turnData=clone(initial.sim.wt.triggeredList);initial.r.applyTurnEndHpPreview(turnData,monsters,max,hp,shield);if(initial.sim.lastTurnEndPreviewTrace){const trace=clone(initial.sim.lastTurnEndPreviewTrace);e.lastPreviewTrace.push({phase:'turn-end',trace});e.record({kind:'preview-simulation',phase:'turn-end',randomDraws:trace.filter(x=>x.kind==='random').length});}map[-1]={[-1]:turnData};
   // Native resets Battle/Stage here before reading the next card reference.
   initial=prepare(-2);for(const id of ids){const card=last.b.cardMap[id];map[id]={};if(targetTypes[id]==='TARGET_NOTHING'){const {sim,r}=prepare(id),temporary=sim.b.temp_ep_skill_slot?.card_id==id,isEp=ep.some(x=>x.card_id==id)||temporary;setup(sim,id,temporary,true);if(isEp)sim.call('epSkillUse',card.char_id);else sim.call('procUseCard',id,-1);r.fillUseSimTriggered(monsters,max,hp,shield,ego);map[id][-1]=clone(sim.wt.triggeredList);record('card',sim,{cardId:id,target:-1});}
    else{const start=prepare(id),temporary=start.sim.b.temp_ep_skill_slot?.card_id==id,isEp=ep.some(x=>x.card_id==id)||temporary,candidates=this.targets(start.sim.call('getTargetableMonsterPassiveFilteredIDs',id),monsters,auto),iteration=monsters.slice();let ran=false;
     for(const m of iteration){if(!candidates.includes(m.id))continue;const {sim,r}=ran?prepare(id,false):start;ran=true;const isTemp=sim.b.temp_ep_skill_slot?.card_id==id;setup(sim,id,isTemp,false);if(isEp)sim.call('epSkillUse',card.char_id,m.id);else sim.call('procUseCard',id,m.id);r.fillUseSimTriggered(monsters,max,hp,shield,ego);map[id][m.id]=clone(sim.wt.triggeredList);record('card',sim,{cardId:id,target:m.id});}
     this.aggregate(map[id]);}}
   success=true;
  }finally{if(last!==e){if(!success){record('failure',last);if(last.lastTurnEndPreviewTrace)e.lastPreviewTrace.at(-1).turnEndTrace=clone(last.lastTurnEndPreviewTrace);}e.adoptPreviewSideState(last.state);}this.setSeed(seed);this.stageWT.battle_stage=JSON.parse(stageJSON);this.replace(JSON.parse(battleJSON));this.b.battle_logs=lean.battle_logs;this.b.previewMap=success?map:oldMap;this.restoreSimInstanceState(saved);this.w.preview_scope=success?auto?'auto':'manual':oldScope;this.w.isPreview=oldPreview;e.record({kind:'preview-completed',success,scope:this.w.preview_scope,cards:ids.length});}
 }
}
