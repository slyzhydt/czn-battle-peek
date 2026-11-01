// Enumerate player choices; execution and all effects use the existing engine.
import {commandDisposition} from '../explicit-sequence.mjs';
export class SearchBoundary extends Error {
  constructor(rule,details){super(rule);this.name='SearchBoundary';this.rule=rule;this.details=details;}
}
// Order is preserved: selected card order can affect queued uses/effects.
export function* orderedSelections(values,min,max,prefix=[],remaining=values){
  if(prefix.length>=min)yield prefix;
  if(prefix.length===max)return;
  for(let i=0;i<remaining.length;i++)yield* orderedSelections(values,min,max,[...prefix,remaining[i]],remaining.filter((_,j)=>i!==j));
}
const op=(type,params)=>({type,params});
function* selections(e){
  const b=e.b;
  const c=b.current_interrupt;
  if(c.type==='CARD'||c.type==='CARD_RES'){
    const resources=c.type==='CARD_RES',pool=resources?c.candidates_res:c.candidates;
    if(!Array.isArray(pool)||!Number.isInteger(c.min)||!Number.isInteger(c.max)||c.min<0||c.max<c.min||c.max>pool.length)throw new SearchBoundary('invalid_choice_contract',c);
    for(const indices of orderedSelections(pool.map((_,i)=>i),c.min,c.max))yield resources?
      op('card_res_select',{source_ids:indices.map(i=>pool[i][0]),source_indices:indices}):op('card_select',{source_ids:indices.map(i=>pool[i])});
    return;
  }
  if(c.type==='OPTION_SELECT'){for(const id of c.candidates_option)yield op('card_option_select',{source_id:id});return;}
  if(c.type==='EVENT'){
    const row=e.db.get('battle_event',c.event_res_id);
    for(const id of e.db.array(row.link_battle_event_option_id))yield op('event_select',{source_id:e.db.get('battle_event_option',id).id});
    return;
  }
  if(c.type==='NONE'){
    // Match the spark handlers' last card_use, rather than scanning stale cards.
    const last=b.user_actions.findLast(a=>a.type==='card_use'),card=last&&b.cardMap[last.card_id];
    if(card&&b.deck_info.using.includes(card.id)){
      if(card.y_spark?.next_cards_resid?.length){for(const id of card.y_spark.next_cards_resid)yield op('card_select_spark',{source_id:id});return;}
      if(card.r_spark_candis?.length){for(const choice of card.r_spark_candis)yield op('card_r_spark_select',{source_id:structuredClone(choice)});return;}
    }
  }
  throw new SearchBoundary('unsupported_active_choice',{type:c.type,event:c.event_res_id});
}
function targets(e,card){
  const row=e.db.get('card',card.res_id),kind=e.call('getTargetTypeByTargetForUI',row.target_for_ui);
  if(kind==='TARGET_NOTHING')return [-1];
  if(kind!=='TARGET_MONSTER')throw new SearchBoundary('unsupported_ui_target',{card:card.id,kind});
  return e.call('getTargetableMonsterPassiveFilteredIDs',card.id);
}
export function* candidateOperations(engine){
  // Query helpers can annotate cards. One scratch branch owns these annotations.
  const e=engine.fork(),b=e.b,L=e.enums.LogicState;
  if(b.game_result!=='BATTLE_RESULT_TYPE_NONE')return;
  if(b.current_state===L.CardInterrupt||b.current_state===L.EventInterrupt){yield* selections(e);return;}
  if(b.current_state!==L.MainPhaseAutoAvailable)throw new SearchBoundary('not_player_decision',{state:b.current_state});
  yield op('turn_over',{turn:b.turn});
  for(const id of b.deck_info.hand){const c=b.cardMap[id];if(c.available===false)continue;for(const target of targets(e,c))yield op('card_use',{source_id:id,target_id:target});}
  const slots=b.temp_ep_skill_slot?[b.temp_ep_skill_slot]:b.ep_skill_deck.slice(0,3).filter(Boolean);
  for(const slot of slots){
    if(e.call('isCollapseOnCharacterByID',slot.char_id)||e.call('getEpSkillBanReason',slot))continue;
    if(!b.cost_cheat&&e.call('getEpSkillCost',slot)>b.ep)continue;
    const card=b.cardMap[slot.card_id],options=[];
    // Tipera can select before EGO execution. Without a preselection the same
    // source uses its ordinary OPTION_SELECT interrupt; expose both entries.
    if(card.res_id.startsWith('c_30084_eps'))for(const id of e.call('getSkills',card.id)){
      const skill=b.skillMap[id],row=e.db.get('skill_eff',skill.res_id);
      if(['SKILL_EFF_CARD_OPTION_SELECT','SKILL_EFF_CARD_RAN_SELECT_USE'].includes(row.eff))options.push(...(skill.eff_opt_multiple_link??[]));
    }
    for(const target of targets(e,card)){
      const params={char_id:slot.char_id,target_id:target,...(b.temp_ep_skill_slot?{is_temp_ep_skill:true}:{})};
      yield op('ep_skill',params);
      for(const option of new Set(options))yield op('ep_skill',{...params,option_select:option});
    }
  }
}
export function applyCandidate(engine,operation,options){
  const result=engine.attempt(operation,options);
  if(!result.ok)return {kind:'blocked',operation,blocked:result.blocked};
  const disposition=commandDisposition(result.response);
  return disposition==='accepted'?{kind:'accepted',operation,engine:result.branch}:{kind:'rejected',operation,disposition};
}
