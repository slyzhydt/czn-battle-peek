// Keep runtime adapters attached to the currently active native data roots.
// Native previews JSON-replace battle/stage objects; old object identities must
// remain old when separately referenced, rather than being mutated in place.
import {MissingBattleRule} from './resource-store.mjs';
export function bindActiveRoots(e){
 const original=e.wt.battle,stage=(e.wt.battle_stage_worktable??e.state.worktables.BattleStageWorktable)?.battle_stage,seen=new Set(),bindings=[];
 function visit(o,path){if(!o||typeof o!=='object'||seen.has(o)||o===e.db)return;const proto=Object.getPrototypeOf(o);if(proto===Object.prototype||proto===null||Array.isArray(o)||o instanceof Map||o instanceof Set)return;seen.add(o);
  for(const [key,d]of Object.entries(Object.getOwnPropertyDescriptors(o))){if(!Object.hasOwn(d,'value'))continue;
   if((key==='b'||key==='battle')&&d.value===original){Object.defineProperty(o,key,{enumerable:d.enumerable,configurable:true,get:()=>e.wt.battle});bindings.push(path+'.'+key);}
   else if(key==='stage'&&d.value===stage&&stage!==undefined){Object.defineProperty(o,key,{enumerable:d.enumerable,configurable:true,get:()=>(e.wt.battle_stage_worktable??e.state.worktables.BattleStageWorktable).battle_stage});bindings.push(path+'.stage');}
   else visit(d.value,path+'.'+key);
  }
 }
 visit(e,'executor');return bindings;
}
// The source restores only its explicit WT field list, INGAME, battle and stage.
// Other worktable roots and non-restored WT fields are real write-through state.
// Preserve each existing worktable wrapper, but copy the complete side graph
// with one memo so Map/Set, cycles and cross-worktable aliases survive.
export function adoptPreviewSideState(e,side,owned=false){
 if(!side?.worktable||!side.worktables||!(side.randoms instanceof Map))throw new MissingBattleRule('preview.sideStateInput');
 const pairs=new Map([[side.worktable,e.wt]]),activeSource=side.worktable.battle_stage_worktable??side.worktables.BattleStageWorktable,activeTarget=e.wt.battle_stage_worktable??e.state.worktables.BattleStageWorktable;
 if(!activeSource||!activeTarget)throw new MissingBattleRule('preview.stageSideRoot');
 for(const [name,source]of Object.entries(side.worktables)){const target=e.state.worktables[name];if(!target)throw new MissingBattleRule('preview.uncapturedWorktable',{name});if(pairs.has(source)&&pairs.get(source)!==target)throw new MissingBattleRule('preview.worktableAliasDrift',{name});pairs.set(source,target);}
 if(pairs.has(activeSource)&&pairs.get(activeSource)!==activeTarget)throw new MissingBattleRule('preview.activeStageAliasDrift');pairs.set(activeSource,activeTarget);
 const memo=new Map(pairs);
 function copy(v){if(v===null||typeof v!=='object')return v;if(memo.has(v))return memo.get(v);let out;
  if(v instanceof Map){out=owned?v:new Map();memo.set(v,out);const entries=Array.from(v);if(owned)out.clear();for(const [k,x]of entries)out.set(copy(k),copy(x));return out;}
  if(v instanceof Set){out=owned?v:new Set();memo.set(v,out);const entries=Array.from(v);if(owned)out.clear();for(const x of entries)out.add(copy(x));return out;}
  if(v instanceof Date){out=owned?v:new Date(v.getTime());memo.set(v,out);return out;}
  if(ArrayBuffer.isView(v)||v instanceof ArrayBuffer)throw new MissingBattleRule('preview.unexpectedBinaryState');
  const keys=Reflect.ownKeys(v).filter(k=>!(Array.isArray(v)&&k==='length')),descriptors=keys.map(k=>Object.getOwnPropertyDescriptor(v,k));
  // Fixed resource records can be frozen even inside a private simulator. Such
  // records keep the reference path's mutable-copy semantics instead of taking
  // ownership of an immutable resource object.
  const reuse=owned&&Object.isExtensible(v)&&descriptors.every(d=>d.writable&&d.configurable);
  out=reuse?v:Array.isArray(v)?new Array(v.length):Object.create(Object.getPrototypeOf(v));memo.set(v,out);for(let i=0;i<keys.length;i++){const key=keys[i],d=descriptors[i];if(!Object.hasOwn(d,'value'))throw new MissingBattleRule('preview.stateAccessor',{key:String(key)});const next=copy(d.value);if(!reuse||next!==d.value)Object.defineProperty(out,key,{value:next,writable:true,enumerable:d.enumerable,configurable:true});}return out;
 }
 // Prepare everything before applying to the target. Excluded roots get their
 // source-defined final JSON restoration from PlayerPreviewRuntime afterwards.
 const prepared=[];for(const [source,target]of pairs){const fields=new Map();for(const key of Reflect.ownKeys(source)){if(target===e.wt&&key==='battle'||target===activeTarget&&key==='battle_stage')continue;const d=Object.getOwnPropertyDescriptor(source,key);if(!Object.hasOwn(d,'value'))throw new MissingBattleRule('preview.worktableAccessor',{key:String(key)});fields.set(key,{value:copy(d.value),writable:true,enumerable:d.enumerable,configurable:true});}prepared.push({target,fields});}
 const stateFields=new Map();for(const key of Reflect.ownKeys(side))if(!['worktable','worktables'].includes(key))stateFields.set(key,copy(side[key]));
 for(const {target,fields}of prepared){for(const key of Reflect.ownKeys(target)){if(target===e.wt&&key==='battle'||target===activeTarget&&key==='battle_stage')continue;delete target[key];}for(const [key,d]of fields)Object.defineProperty(target,key,d);}
 for(const [key,v]of stateFields)e.state[key]=v;e.state.worktable=e.wt;e.random.streams=e.state.randoms;
}
