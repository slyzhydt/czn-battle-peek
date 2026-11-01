// Local snapshot forecasts. No process, network or game command API is imported.
import fs from 'node:fs';
import readline from 'node:readline';
import {pathToFileURL} from 'node:url';
import {isDeepStrictEqual} from 'node:util';
import {snapshotToState,decodeRoots,validateRead} from './engine/diagnostics/runtime-interface-20261024/pre-solver-input/input-tools.mjs';
import {loadPortableResources,requireSettled} from './portable-resources.mjs';
import {OfflineExecutor} from './engine/diagnostics/seed-bytecode-20261023/battle-engine-investigation/execution/offline-executor.mjs';
import {commandDisposition,decisionPoint} from './engine/diagnostics/seed-bytecode-20261023/battle-engine-investigation/execution/explicit-sequence.mjs';
import {candidateOperations} from './engine/diagnostics/seed-bytecode-20261023/battle-engine-investigation/execution/solver/actions.mjs';
import {solverResources} from './engine/diagnostics/seed-bytecode-20261023/battle-engine-investigation/execution/solver/resources.mjs';

const root=new URL('./',import.meta.url),read=p=>JSON.parse(fs.readFileSync(p,'utf8'));
const profile=read(new URL('collector/profile.json',root));
const texts=new Map(read(new URL('data/card-names.json',root)).map(r=>[r.id,r.text]));
let resident;
const name=id=>texts.get('card@name@'+id)??texts.get('card@name@'+id?.replace(/_(rsp\d+|lbk|pot)$/,''))??id;
const card=(b,id)=>{const c=b.cardMap[id];if(!c)throw Error('找不到卡牌实例 '+id);return {id,resId:c.res_id,name:name(c.res_id),cost:c.cost_result};};
const errorInfo=e=>({message:e.message,rule:e.rule??e.path,details:e.details});
export function compatible(p){return ['targetSHA256','resourceManifestSHA256','scriptChunkSHA256'].every(k=>p[k]===profile[k]);}

function withCurrentNumericCache(resources,state){
 const cache=state.runtimeInputs.numericResourceCaches,rows=new Map();
 if(cache?.available===true)for(const table of cache.tables)for(const hit of table.rows){
  if(!hit.present)continue;
  const m=hit.result;
  if(table.table!=='powerstep_define'||hit.argument.type!=='number'||m.complete!==true||m.terminal!=='Object.prototype'||m.prototypeChain.length!==1||m.fields.some(f=>f.depth!==0||f.kind!=='data'||f.scalar.type!=='number'||!Number.isFinite(f.scalar.value)))continue;
  const row={};for(const f of m.fields)Object.defineProperty(row,f.key,{...f.flags,value:f.scalar.value});
  if(row.id!==hit.argument.value)throw Error('当前数值缓存编号不一致');
  rows.set(hit.argument.value,Object.freeze(row));
 }
 return Object.freeze({...resources,get(table,key){return table==='powerstep_define'&&rows.has(key)?rows.get(key):resources.get(table,key);},
  sourceFor(row,key){for(const [id,r]of rows)if(row===r)return {kind:'current-native-existing-numeric-cache',table:'powerstep_define',id,key};return resources.sourceFor(row,key);}});
}

export function createForecastContext(snapshot,config,selected){
 const state=snapshotToState(snapshot),b=state.worktable.battle;
 const summary={turn:b.turn,state:b.current_state,result:b.game_result,energy:b.energy,hp:b.char.status.info.S_CURRENT_HP,
  hand:b.deck_info.hand.map((id,i)=>({...card(b,id),position:i+1})),
  deck:b.deck_info.deck.map((id,i)=>({...card(b,id),position:i+1})),
  monsters:b.monsters.map((m,i)=>({id:m.id,position:i+1,resId:m.res_id,hp:m.status.info.S_CURRENT_HP,state:m.state})),
  randoms:[...state.randoms].map(([type,r])=>({type,state:r.state})),actionCount:b.user_actions.length,lastActionId:b.last_action_id};
 const context={state,summary,engine:null};
 if(!compatible(selected)){summary.forecastUnavailable='当前版本只验证了状态读取，尚无匹配的战斗规则；暴击和连续动作预测暂停。';return context;}
 try{
  requireSettled(state);validateRead(config);
  if(!isDeepStrictEqual(snapshot.before.database,config.before.database))throw Error('配置与当前资源环境不同，请重新刷新');
  const d=snapshot.before.database,l=state.runtimeInputs.resourceReuseLayers;
  if(d.pilotEnabled!==false||d.pilot.tables.length||d.client.tables.length||l?.available!==true||l.inventoryComplete!==true||l.empty!==true)throw Error('当前资源被覆盖，不能使用已核对的基础规则');
  const payload=decodeRoots({'/payload':config.payload}).roots['/payload'];
  state.runtimeInputs.loadedGameConstants=payload.GameConstants;state.runtimeInputs.runtimeEnums=payload.enums;
  if(!resident)resident={resources:solverResources(loadPortableResources(new URL('./data/resources/',import.meta.url)))};
  context.engine=new OfflineExecutor({state,resources:withCurrentNumericCache(resident.resources,state),enums:payload.enums,valueTextLocale:'zht',previewStateTransfer:true,captureDiagnostics:false,fastBranches:true});
  // Query restrictions on a private fork: even helper calls may consume a term.
  try{const scratch=context.engine.fork();summary.drawable=scratch.call('getDrawableDeckCards',10).map(id=>card(scratch.b,id));}
  catch(e){summary.drawableUnavailable=errorInfo(e);}
 }catch(e){summary.forecastUnavailable=errorInfo(e);}
 return context;
}

export function summarizeAction(before,after,operation,actions){
 const b=after.b,damages=[],arrivals=[];
 const visit=a=>{
  if(a.id<before.b.last_action_id)return;
  if(a.type==='action_damage')for(const hit of a.action_list??[])for(const [target,info]of hit.action_units??[])
   if(Object.hasOwn(info,'crit'))damages.push({cardId:a.card_id,cardName:a.card_id>0?card(b,a.card_id).name:'追加效果',target,damage:info.damage,crit:info.crit,hpAfter:info.new_hp});
  const move=a.action_card;
  if(move?.place_to===2)for(const [i,id]of move.cards.entries())arrivals.push({...card(b,id),from:move.place_froms?.[i]??move.place_from,kind:'move'});
  if(a.action_card_new?.place_to===2)for(const c of a.action_card_new.cards)arrivals.push({...card(b,c.id),from:0,kind:'created'});
 };
 for(const a of actions)visit(a);
 return {operation,damages,arrivals,energy:b.energy,hp:b.char.status.info.S_CURRENT_HP,decision:decisionPoint(after),
  hand:b.deck_info.hand.map(id=>card(b,id)),deck:b.deck_info.deck.slice(0,10).map(id=>card(b,id)),randoms:[...after.state.randoms].map(([type,r])=>({type,state:r.state}))};
}

export function predictAction(engine,operation){
 const branch=engine.fork(),actions=new Map(),push=branch.pushAction.bind(branch);
 // The command drains action_blocks into its response. Retain emitted action
 // objects on this private branch before that drain; do not inspect stale logs.
 branch.pushAction=(action,prev)=>{if(!branch.wt.isPreview)actions.set(action.id,action);return push(action,prev);};
 try{
  const response=branch.call('executePlayerCommand',operation),disposition=commandDisposition(response);
  if(disposition!=='accepted')return {ok:false,operation,blocked:{rule:disposition}};
  return {ok:true,engine:branch,result:summarizeAction(engine,branch,operation,[...actions.values()])};
 }catch(e){return {ok:false,operation,blocked:errorInfo(e)};}
}

export function peek(context){
 const result={...context.summary,previews:[],conditionalOnUnchangedSnapshot:true};
 if(!context.engine)return result;
 const started=performance.now();
 try{
  for(const op of candidateOperations(context.engine)){
   if(op.type!=='card_use')continue;
   const r=predictAction(context.engine,op),c=card(context.engine.b,op.params.source_id);
   result.previews.push({card:c,target:op.params.target_id,...(r.ok?{ok:true,...r.result}:{ok:false,blocked:r.blocked})});
  }
 }catch(e){result.enumerationError=errorInfo(e);}
 result.simulationMs=performance.now()-started;
 return result;
}

// A route is interpreted on successive predicted hands, not the initial hand.
export function plan(context,specs){
 if(!context.engine)throw Error('当前版本或状态不能进行动作预测');
 if(!Array.isArray(specs)||specs.length>20)throw Error('一次最多预测20步');
 let engine=context.engine;const steps=[];
 for(const spec of specs){
  if(decisionPoint(engine).kind!=='player')return {steps,stopped:'已到选牌或结算界面；后续不能自动假定选择',decision:decisionPoint(engine)};
  let op;
  if(spec.endTurn===true)op={type:'turn_over',params:{turn:engine.b.turn}};
  else{
   const id=engine.b.deck_info.hand[spec.hand-1],target=spec.target===0?-1:engine.b.monsters[spec.target-1]?.id;
   if(!Number.isInteger(spec.hand)||!Number.isInteger(spec.target)||id===undefined||target===undefined)throw Error('牌位或敌人位置超出当前预测状态');
   op={type:'card_use',params:{source_id:id,target_id:target}};
  }
  const next=predictAction(engine,op);
  if(!next.ok)return {steps,stopped:'本步未能完整预测，后续不继续',blocked:next.blocked,operation:op};
  steps.push(next.result);engine=next.engine;
 }
 return {steps,decision:decisionPoint(engine),conditionalOnUnchangedSnapshot:true};
}

if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 let current;
 for await(const line of readline.createInterface({input:process.stdin})){
  try{
   const request=JSON.parse(line);let result;
   if(request.type==='load'){current=null;current=createForecastContext(read(request.snapshot),read(request.config),request.profile);result=peek(current);}
   else if(request.type==='plan'){if(!current)throw Error('请先刷新状态');result=plan(current,request.steps);}
   else if(request.type==='invalidate'){current=null;result={invalidated:true};}
   else throw Error('不支持的请求');
   process.stdout.write(JSON.stringify({ok:true,result})+'\n');
  }catch(e){process.stdout.write(JSON.stringify({ok:false,error:errorInfo(e)})+'\n');}
 }
}
