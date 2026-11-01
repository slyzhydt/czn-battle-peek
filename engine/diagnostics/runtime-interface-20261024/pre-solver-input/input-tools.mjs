import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {ResourceStore,MissingBattleRule} from '../../seed-bytecode-20261023/battle-engine-investigation/execution/resource-store.mjs';
import {restoreSnapshot} from '../../seed-bytecode-20261023/battle-engine-investigation/execution/snapshot-state.mjs';
import {assessRuntimeConsistency} from './runtime-consistency.mjs';
export const TARGET_HASH='6f951e93c7ca9d5976d758df0bbe8c737f05e1227dbe50d5c25c515341612b78';
export const POLICY=JSON.parse(fs.readFileSync(new URL('policy.json',import.meta.url),'utf8'));
export const POLICY_HASH=createHash('sha256').update(fs.readFileSync(new URL('policy.json',import.meta.url))).digest('hex');
export class InputContractError extends Error{constructor(message){super(message);this.name='InputContractError';}}
const fail=message=>{throw new InputContractError(message);};
const esc=k=>String(k).replace(/~/g,'~0').replace(/\//g,'~1');
export const sha256=bytes=>createHash('sha256').update(bytes).digest('hex');
const exactKeys=(v,keys)=>Object.keys(v).length===keys.length&&keys.every(k=>Object.hasOwn(v,k));

// One graph across all roots, including references forward to another exported root.
export function decodeRoots(roots){
  const refs=new Map(),fixups=[],symbolValues=new Map();
  const pending=Symbol('pending'),hole=Symbol('hole');
  function decode(v,path){
    if(v===null||typeof v!=='object')return v;
    if(Object.hasOwn(v,'$omitted'))fail('Omitted data at '+path+': '+v.$omitted);
    if(exactKeys(v,['$undefined'])&&v.$undefined===true)return undefined;
    if(exactKeys(v,['$hole'])&&v.$hole===true)return hole;
    if(exactKeys(v,['$number'])){
      if(!['NaN','Infinity','-Infinity','-0'].includes(v.$number))fail('Invalid number marker at '+path);
      return v.$number==='-0'?-0:Number(v.$number);
    }
    if(exactKeys(v,['$bigint'])){if(!/^-?\d+$/.test(v.$bigint))fail('Invalid bigint at '+path);return BigInt(v.$bigint);}
    if(exactKeys(v,['$symbol'])){
      const s=v.$symbol;if(!s||typeof s.id!=='string'||!(s.description===null||typeof s.description==='string')||!(s.globalKey===null||typeof s.globalKey==='string'))fail('Invalid symbol at '+path);
      if(!symbolValues.has(s.id))symbolValues.set(s.id,{shape:JSON.stringify(s),value:s.globalKey===null?Symbol(s.description??undefined):Symbol.for(s.globalKey)});
      const prior=symbolValues.get(s.id);if(prior.shape!==JSON.stringify(s))fail('Inconsistent symbol identity');return prior.value;
    }
    if(exactKeys(v,['$ref'])){if(typeof v.$ref!=='string')fail('Invalid reference at '+path);return{[pending]:v.$ref};}
    let out;
    if(v.$type==='Map'){
      if(!exactKeys(v,['$type','entries'])||!Array.isArray(v.entries))fail('Invalid Map at '+path);
      out=new Map();refs.set(path,out);
      for(let i=0;i<v.entries.length;i++){const pair=v.entries[i];if(!Array.isArray(pair)||pair.length!==2)fail('Invalid Map entry');const k=decode(pair[0],path+'/k'+i),x=decode(pair[1],path+'/v'+i);fixups.push(()=>out.set(resolve(k),resolve(x)));}
      return out;
    }
    if(v.$type==='Set'){
      if(!exactKeys(v,['$type','values'])||!Array.isArray(v.values))fail('Invalid Set at '+path);
      out=new Set();refs.set(path,out);v.values.forEach((x,i)=>{const decoded=decode(x,path+'/'+i);fixups.push(()=>out.add(resolve(decoded)));});return out;
    }
    if(Object.keys(v).some(k=>k.startsWith('$')&&['$ref','$undefined','$omitted','$type','$number','$bigint','$symbol','$hole'].includes(k)))fail('Invalid reserved marker at '+path);
    out=Array.isArray(v)?new Array(v.length):Object.create(null);refs.set(path,out);
    for(const [key,value]of Object.entries(v)){
      const decoded=decode(value,path+'/'+esc(key));if(decoded===hole){if(!Array.isArray(out))fail('Hole outside array');continue;}
      Object.defineProperty(out,key,{value:decoded,writable:true,enumerable:true,configurable:true});
      if(decoded&&typeof decoded==='object'&&pending in decoded)fixups.push(()=>{out[key]=resolve(decoded);});
    }return out;
  }
  function resolve(v){if(v&&typeof v==='object'&&pending in v){if(!refs.has(v[pending]))fail('Unresolved reference '+v[pending]);return refs.get(v[pending]);}if(v===hole)fail('Hole in Map/Set');return v;}
  const decoded={};for(const [path,value]of Object.entries(roots))decoded[path]=decode(value,path);
  fixups.forEach(fn=>fn());for(const path of Object.keys(decoded))decoded[path]=resolve(decoded[path]);return{roots:decoded,referencePaths:[...refs.keys()]};
}

export function unpackReceipt(receipt,{prepared,allowSynthetic=false}={}){
  if(receipt.schema!=='czn-pre-solver-receipt-v1')fail('Unsupported receipt schema');
  if(receipt.synthetic===true&&!allowSynthetic)fail('Synthetic receipt is not live evidence');
  if(receipt.target_sha256!==TARGET_HASH)fail('Unsupported executable identity');
  for(const key of ['source_sha256','policy_sha256','core_sha256','bridge_sha256'])if(!/^[a-f0-9]{64}$/.test(receipt[key]??''))fail('Missing receipt identity '+key);
  if(receipt.policy_sha256!==POLICY_HASH)fail('Receipt policy bytes differ from this frozen parser policy');
  if(prepared)for(const key of ['source_sha256','policy_sha256','core_sha256','bridge_sha256','target_sha256'])if(prepared[key]!==receipt[key])fail('Prepared/receipt identity differs '+key);
  for(const flag of ['attached','script_loaded','completed_in_window','detached','process_alive_after'])if(receipt[flag]!==true)fail('Receipt failed '+flag);
  for(const key of ['error','unload_error','detach_error'])if(Object.hasOwn(receipt,key))fail('Receipt reports '+key);
  if(!Array.isArray(receipt.messages)||receipt.messages.some(m=>m.type==='error'))fail('Script error or missing messages');
  const evaluations=receipt.messages.filter(m=>m.type==='send'&&m.payload?.kind==='evaluation').map(m=>m.payload);
  const completions=receipt.messages.filter(m=>m.type==='send'&&m.payload?.kind==='probe-complete').map(m=>m.payload);
  if(evaluations.length!==1||completions.length!==1)fail('No unique evaluation/cleanup receipt');
  const [evaluation]=evaluations,[complete]=completions;
  if(evaluation.error||evaluation.exceptionCaught!==false&&evaluation.exceptionCaught!==0||!Array.isArray(evaluation.cleanupErrors)||evaluation.cleanupErrors.length)fail('Evaluation or handle cleanup failed');
  if(complete.hooksRemoved!==true||complete.evaluated!==true||complete.cleanupError)fail('Observation cleanup not confirmed');
  if(typeof evaluation.result!=='string'||Buffer.byteLength(evaluation.result)>1048576)fail('Missing/oversized bounded result');
  const data=JSON.parse(evaluation.result);
  if(!receipt.request||receipt.request.captureSetId!==data.captureSetId||receipt.request.requestId!==data.requestId)fail('Request/result identity differs');
  const schemas={snapshot:'czn-runtime-battle-read-v2',inventory:'czn-pre-solver-inventory-v1',config:'czn-pre-solver-config-v1',resource:'czn-pre-solver-page-v1',cache:'czn-pre-solver-page-v1',lookup:'czn-pre-solver-page-v1'};
  if(schemas[receipt.request.kind]!==data.schema)fail('Request/result kind differs');
  if(data.schema==='czn-pre-solver-page-v1'&&(receipt.request.kind!==data.kind||receipt.request.offset!==data.offset||receipt.request.limit!==data.limit||receipt.request.kind!=='cache'&&receipt.request.table!==data.table))fail('Page request differs');
  if(data.kind==='lookup'&&JSON.stringify(receipt.request.lookupIds)!==JSON.stringify(data.lookupIds))fail('Lookup request differs');
  return{data,provenance:{synthetic:receipt.synthetic===true,target_sha256:receipt.target_sha256,source_sha256:receipt.source_sha256,policy_sha256:receipt.policy_sha256,bodyProven:false,pid:receipt.pid,time:receipt.time_utc}};
}

export function validateRead(data){
  const inventory=data.schema==='czn-pre-solver-inventory-v1';
  if(data.policyId!==POLICY.id||typeof data.captureSetId!=='string'||typeof data.requestId!=='string')fail('Missing capture identity');
  if(data.rngUnchanged!==true||data.cohortUnchanged!==true||JSON.stringify(data.before)!==JSON.stringify(data.after))fail('Changing read/cohort');
  if(!Array.isArray(data.serialization?.limits)||data.serialization.limits.length||data.serialization.identityMode!=='shared-and-cyclic')fail('Truncated/missing identity contract');
  if(!Array.isArray(data.errors)||data.errors.length||!Array.isArray(data.missingInputs)||data.missingInputs.length||data.captureComplete!==true)fail('Missing input or collection error: '+JSON.stringify({errors:data.errors,missing:data.missingInputs}));
  if(!Array.isArray(data.rngAfter)||!inventory&&!data.rngAfter.length||JSON.stringify(data.rngBefore??data.before.rng)!==JSON.stringify(data.rngAfter))fail('Missing/changing random streams');
  if(!inventory&&(!data.before.database||data.before.database.pilot?.available!==true||data.before.database.client?.available!==true||data.before.database.pilot.complete!==true||data.before.database.client.complete!==true))fail('Effective override identity unavailable');
  return data;
}

export function snapshotToState(data){
  validateRead(data);if(data.schema!=='czn-runtime-battle-read-v2')fail('Expected native v2 snapshot');
  const roots={};for(const [name,entry]of Object.entries(data.worktables??{}))roots['/'+name]=entry.data;
  if(Object.hasOwn(data,'runtimeInputs'))roots['/runtimeInputs']=data.runtimeInputs;
  if(Object.hasOwn(data,'resourceCaches'))roots['/resourceCaches']=data.resourceCaches;
  const decoded=decodeRoots(roots).roots,worktables=Object.create(null);
  for(const name of POLICY.worktables){const w=decoded['/'+name];if(!w)fail('Missing '+name);worktables[name]=w;}
  const worktable=worktables.BattleWorktable,b=worktable.battle;
  for(const key of ['stackMap','stackParentMap','skillMap','csMap','cardMap','condMap','eventMaps','timingMap','timingCount','deck_info','user_actions'])if(!b||!Object.hasOwn(b,key))fail('Missing battle.'+key);
  const runtimeInputs=decoded['/runtimeInputs'],resourceCaches=decoded['/resourceCaches'];
  for(const key of ['battleExecutionGuard','battleSaveDirty','collapsePenaltySkill'])if(!runtimeInputs||!Object.hasOwn(runtimeInputs,key))fail('Missing own runtimeInputs.'+key);
  if(!runtimeInputs.battleSaveDirty||typeof runtimeInputs.battleSaveDirty!=='object')fail('Missing dirty object');
  if(Object.hasOwn(runtimeInputs,'executionHost')&&!['client','server','none'].includes(runtimeInputs.executionHost))fail('Unknown observed ExecutionExchange.host');
  if(runtimeInputs.collapsePenaltySkill!==null&&['object','function'].includes(typeof runtimeInputs.collapsePenaltySkill))fail('Collapse penalty must be a native scalar in this input profile');
  if(!resourceCaches?.game_data_store||typeof resourceCaches.game_data_store!=='object')fail('Missing GameDataStore cache');
  for(const [key,value]of Object.entries(resourceCaches.game_data_store))if(value!==undefined&&typeof value!=='string')fail('Unsupported native cache value '+key);
  const randoms=new Map();for(const row of data.rngAfter){if(row.multiplier!==1103515245||row.increment!==12345||row.modulus!==2147483648||!Number.isFinite(row.state)||randoms.has(row.type))fail('Unsupported random stream');randoms.set(row.type,{state:row.state});}
  const state={worktable,worktables,randoms,runtimeInputs,resourceCaches,metadata:{schema:data.schema,sharedIdentityCaptured:true,captureSetId:data.captureSetId,implementationIdentityProven:false,liveAcceptance:false,driverAccepted:false}};
  // OfflineExecutor copies state with structuredClone. Preserve unsupported scalar
  // evidence in the carrier, but reject an import it cannot faithfully copy.
  try{structuredClone(state);}catch(error){fail('State cannot enter existing executor structuredClone: '+error.message);}
  return state;
}

export function compareGraphs(a,b){
  const forward=new Map(),reverse=new Map(),differences=[];
  const add=(path,reason)=>differences.push({path,reason});
  function walk(x,y,path){
    if(x===null||y===null||typeof x!=='object'||typeof y!=='object'){if(!Object.is(x,y))add(path,'value/type');return;}
    if(forward.has(x)){if(forward.get(x)!==y)add(path,'shared identity differs');return;}
    if(reverse.has(y)){add(path,'one shared object became separate objects');return;}
    forward.set(x,y);reverse.set(y,x);
    if(x instanceof Map||y instanceof Map){if(!(x instanceof Map&&y instanceof Map)){add(path,'Map type');return;}if(x.size!==y.size)add(path,'Map size');const xe=[...x],ye=[...y];for(let i=0;i<Math.min(xe.length,ye.length);i++){walk(xe[i][0],ye[i][0],path+'/k'+i);walk(xe[i][1],ye[i][1],path+'/v'+i);}return;}
    if(x instanceof Set||y instanceof Set){if(!(x instanceof Set&&y instanceof Set)){add(path,'Set type');return;}if(x.size!==y.size)add(path,'Set size');const xe=[...x],ye=[...y];for(let i=0;i<Math.min(xe.length,ye.length);i++)walk(xe[i],ye[i],path+'/'+i);return;}
    if(Array.isArray(x)!==Array.isArray(y)){add(path,'array type');return;}
    if(Array.isArray(x)&&x.length!==y.length)add(path,'array length');
    const keys=new Set([...Object.keys(x),...Object.keys(y)]);for(const key of keys){if(Object.hasOwn(x,key)!==Object.hasOwn(y,key)){add(path+'/'+esc(key),'own presence');continue;}walk(x[key],y[key],path+'/'+esc(key));}
  }walk(a,b,'');return{match:differences.length===0,differences};
}

export function assemblePages(pages,{requiredTables=[],expectedCohort,captureSetId}={}){
  const groups=new Map();for(const page of pages){validateRead(page);if(page.schema!=='czn-pre-solver-page-v1')fail('Not a page');
    if(captureSetId&&page.captureSetId!==captureSetId)fail('Mixed capture sets');
    if(expectedCohort&&JSON.stringify(page.before)!==JSON.stringify(expectedCohort))fail('Cross-page cohort differs');
    if(!['resource','cache','lookup'].includes(page.kind))fail('Invalid page kind');if(page.kind!=='cache'&&!POLICY.resourceTables.includes(page.table))fail('Unapproved table');
    if(!Number.isSafeInteger(page.offset)||page.offset<0||!Number.isSafeInteger(page.total)||page.total<0||!Number.isSafeInteger(page.limit)||page.limit<1||page.limit>POLICY.budgets.pageRows)fail('Invalid page bounds');
    const key=page.kind+':'+page.table+(page.kind==='lookup'?':'+JSON.stringify(page.lookupIds):'');if(!groups.has(key))groups.set(key,[]);groups.get(key).push(page);
  }
  const tables=new Map(),lookups=new Map(),lookupOnly=new Map();let cache=null;
  for(const [key,group]of groups){group.sort((a,b)=>a.offset-b.offset);let offset=0;const total=group[0].total,signature=group[0].tableObservationChecksum,rows=Object.create(null),getRows=Object.create(null);
    for(const page of group){if(page.offset!==offset||page.total!==total||page.tableObservationChecksum!==signature)fail('Page gap/duplicate/content drift '+key);
      const values=decodeRoots({'/payload':page.payload}).roots['/payload'];if(!Array.isArray(values)||values.length>page.limit||!Array.isArray(page.typeEvidence)||page.typeEvidence.length!==values.length)fail('Invalid page rows/types');
      for(let i=0;i<values.length;i++){const item=values[i];if(item.ordinal!==offset||typeof item.key!=='string'||Object.hasOwn(rows,item.key))fail('Invalid ordinal/duplicate resource id');
        if(page.kind==='cache'){if(!POLICY.cachePrefixes.includes(item.key.split(':')[0]))fail('Cache prefix outside scope');if(item.row!==undefined&&typeof item.row!=='string')fail('Unsupported cache value');}
        else if(page.kind==='lookup'){
          if(!Object.hasOwn(item,'getRow'))fail('Missing explicit lookup result');
          if(item.getRow!=null)for(const field of page.typeEvidence[i])if(typeof item.getRow[field.key]!==field.type||!Object.hasOwn(item.getRow,field.key))fail('Lookup-only type evidence differs');
          getRows[item.key]=item.getRow;
        }else{if(!item.row||typeof item.row!=='object'||String(item.row.id)!==item.key||!Object.hasOwn(item,'getRow'))fail('Missing separate resource lookup view');
          for(const field of page.typeEvidence[i].filter(x=>Object.hasOwn(x,'key')))if(typeof item.row[field.key]!==field.type||!Object.hasOwn(item.row,field.key))fail('Resource type evidence differs');
          const lookupTypes=page.typeEvidence[i].find(x=>x.lookupTypes)?.lookupTypes;
          if(item.getRow!=null){if(!Array.isArray(lookupTypes))fail('Missing lookup type evidence');for(const field of lookupTypes)if(typeof item.getRow[field.key]!==field.type||!Object.hasOwn(item.getRow,field.key))fail('Lookup type evidence differs');}
          getRows[item.key]=item.getRow;}
        rows[item.key]=item.row;offset++;
      }
      if(page.nextOffset!==(offset<total?offset:null))fail('Wrong next page offset');
    }if(offset!==total)fail('Incomplete table '+key);
    if(group[0].kind==='cache')cache=rows;else if(group[0].kind==='lookup'){
      const name=group[0].table,target=lookupOnly.get(name)??Object.create(null);for(const [id,value]of Object.entries(getRows)){if(Object.hasOwn(target,id)&&!compareGraphs(target[id],value).match)fail('Lookup-only observations drifted');target[id]=value;}lookupOnly.set(name,target);
    }else{tables.set(group[0].table,rows);lookups.set(group[0].table,getRows);}
  }
  for(const [name,extra]of lookupOnly){if(!tables.has(name))fail('Lookup-only capture cannot prove table completeness '+name);const target=lookups.get(name);for(const [key,value]of Object.entries(extra)){if(Object.hasOwn(target,key)&&!compareGraphs(target[key],value).match)fail('Lookup observations drifted '+name+':'+key);target[key]=value;}}
  for(const table of [...tables.values(),...lookups.values()]){for(const row of Object.values(table))if(row&&typeof row==='object')Object.freeze(row);Object.freeze(table);}
  for(const name of requiredTables)if(!tables.has(name))fail('Missing effective resource table '+name);
  return{tables,lookups,cache,coverage:[...tables.keys()],lookupOnlyCoverage:[...lookupOnly].map(([table,rows])=>({table,keys:Object.keys(rows)})),multiReadAtomic:false};
}

export class CapturedResourceStore extends ResourceStore{
  constructor(tables,lookups){super(null);this.tables=tables;this.lookups=lookups;this.provenance=new Map([...tables].map(([name])=>[name,{kind:'native-effective-enumeration-and-get-pages'}]));}
  table(name){if(!this.tables.has(name))throw new MissingBattleRule('input.effective_resource_table:'+name);return this.tables.get(name);}
  get(name,id){this.table(name);const table=this.lookups.get(name);if(!table||!Object.hasOwn(table,id))throw new MissingBattleRule('input.effective_resource_lookup:'+name+':'+String(id));if(table[id]==null)throw new MissingBattleRule('resource:'+name+':'+String(id));return table[id];}
}

export function buildOfflineInputs({snapshot,pages,config,requiredTables,requireRuntimeConsistency=true,requiredEnums}){
  const state=snapshotToState(snapshot),assembled=assemblePages(pages,{requiredTables,expectedCohort:snapshot.after,captureSetId:snapshot.captureSetId});
  if(!Array.isArray(requiredTables)||!requiredTables.length)fail('Required table scope must be explicit');
  if(!assembled.cache)fail('A complete independent cache page set is required');
  const cacheCheck=compareGraphs(state.resourceCaches.game_data_store,assembled.cache);if(!cacheCheck.match)fail('Snapshot/cache pages disagree: '+JSON.stringify(cacheCheck.differences.slice(0,8)));
  validateRead(config);if(config.schema!=='czn-pre-solver-config-v1'||config.captureSetId!==snapshot.captureSetId||JSON.stringify(config.before)!==JSON.stringify(snapshot.after))fail('Missing/changing config cohort');
  const decoded=decodeRoots({'/payload':config.payload}).roots['/payload'];
  if(config.presence?.loaded!==true||decoded.GameConstants.loaded!==true)fail('GameConstants not observed loaded');
  state.runtimeInputs.loadedGameConstants=decoded.GameConstants;state.runtimeInputs.runtimeEnums=decoded.enums;
  state.metadata.configConsumption='Captured values supplied; existing ports may still recompute from db. Compare/wire before native-equivalence acceptance.';
  const resources=new CapturedResourceStore(assembled.tables,assembled.lookups);
  const runtimeConsistency=assessRuntimeConsistency({state,resources,requiredEnums});
  if(requireRuntimeConsistency&&!runtimeConsistency.passed)fail('Runtime configuration/enum preflight blocked: '+JSON.stringify(runtimeConsistency.checks.filter(x=>['blocked','mismatch'].includes(x.status))));
  return{state,resources,coverage:assembled.coverage,runtimeConsistency,acceptance:{inputCarriersValidated:true,runtimeConsistencyPassed:runtimeConsistency.passed,multiReadAtomic:false,implementationIdentityProven:false,liveAcceptance:false,driverAccepted:false,solverReady:false},
    limitations:['Resource enumeration and get views are separate; no static-resource fallback. Missing lookup-only keys require explicit bounded lookup capture, including native absence.','Loaded GameConstants/enums are explicit runtimeInputs; existing ports need passing consistency preflight or wiring before native-equivalence claims.','Function source text and matching executable do not prove mutable/private implementation identity.','Pagination is bounded repeated reads with cohort checks, not one atomic multi-read transaction.','Resource-row identities across pages or with battle roots are not retained; resource pages establish typed cell values and ordering.']};
}

export function inspectHistoricalV1(snapshot){
  if(snapshot.schema!=='czn-runtime-battle-read-v1')fail('Not a historical v1 carrier');
  const state=restoreSnapshot(snapshot);return{state,compatibleForHistoricalValueReplay:true,sharedIdentityCaptured:false,
    missing:['runtimeInputs.battleExecutionGuard','runtimeInputs.battleSaveDirty','runtimeInputs.collapsePenaltySkill','resourceCaches.game_data_store','effective resource/config identity'],
    normalizedGuardEvidence:{props:state.worktable.props,defaultStaticKey:'battle_execution_guard',currentStaticKeyObserved:false},
    limitations:['No v1 relabeling to v2 and no fabricated runtime input. Historical input decisions must be separate source-derived evidence.'],solverReady:false};
}
