// Executes only commands explicitly supplied by the caller. No move generation,
// search, ranking, pruning, recommendation, or optimality claim is made.
import {OfflineExecutor} from './offline-executor.mjs';
import {PLAYER_COMMAND_TYPES} from './player-command-runtime.mjs';
export function decisionPoint(e){
 const b=e.b,L=e.enums.LogicState,interrupt=b.current_interrupt;
 if(b.game_result!=='BATTLE_RESULT_TYPE_NONE')return {kind:'terminal',result:b.game_result};
 if([L.CardInterrupt,L.EventInterrupt].includes(b.current_state))return {kind:'choice',state:b.current_state,interrupt:structuredClone(interrupt),sparkCards:Object.values(b.cardMap).filter(c=>c.r_spark_candis||c.y_spark?.next_cards_resid).map(c=>({id:c.id,r_spark_candis:c.r_spark_candis,y_spark:c.y_spark}))};
 if(b.current_state===L.MainPhaseAutoAvailable)return {kind:'player',turn:b.turn,energy:b.energy,ep:b.ep,hand:b.deck_info.hand.slice()};
 return {kind:'internal',state:b.current_state,stateName:L[b.current_state]};
}
export function commandDisposition(response){
 if(response?.type==='ignore')return 'ignored';
 if(response?.type==='cancel')return 'cancelled';
 return response?.res==='ok'?'accepted':'rejected';
}
export function executeSequence(engine,commands,{maxCommands=1000,stopOnRejectedResponse=false}={}){
 if(!(engine instanceof OfflineExecutor))throw Error('An initialized OfflineExecutor is required');
 if(!Array.isArray(commands)||!Number.isInteger(maxCommands)||maxCommands<0||commands.length>maxCommands)throw Error('Invalid explicit command sequence/budget');
 const initial=structuredClone(engine.state),steps=[],trace=[];let current=engine;
 for(let i=0;i<commands.length;i++){
  const operation=commands[i];if(!PLAYER_COMMAND_TYPES.includes(operation?.type))return {ok:false,engine:current,steps,trace,failedAt:i,blocked:{rule:'unknown_player_command',operation},initialUnchanged:statesEqual(engine.state,initial)};
  const result=current.attempt(operation);trace.push(...result.trace.map(event=>({...event,sequenceStep:i})));
  if(!result.ok)return {ok:false,engine:current,steps,trace,failedAt:i,blocked:result.blocked,discardedBranch:result.discardedBranch,initialUnchanged:statesEqual(engine.state,initial)};
  current=result.branch;const disposition=commandDisposition(result.response);steps.push({index:i,operation:structuredClone(operation),response:result.response,disposition,decision:decisionPoint(current),randoms:[...current.state.randoms].map(([type,r])=>({type,state:r.state}))});
  if(stopOnRejectedResponse&&disposition!=='accepted')return {ok:false,engine:current,steps,trace,failedAt:i,rejected:{disposition,response:result.response},decision:decisionPoint(current),initialUnchanged:statesEqual(engine.state,initial)};
 }
 return {ok:true,engine:current,steps,trace,decision:decisionPoint(current),initialUnchanged:statesEqual(engine.state,initial),solverImplemented:false,optimalityProven:false};
}
// Node's structured clone graph can include Map/Set/cycles. deepStrictEqual
// checks values and graph cycles; identity preservation has separate v2 tests.
import {isDeepStrictEqual as statesEqual} from 'node:util';
