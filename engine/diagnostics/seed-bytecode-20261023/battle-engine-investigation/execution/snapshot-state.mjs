// Restore observation carriers; this module never attaches to a process.
import {MissingBattleRule} from './resource-store.mjs';
export class IncompleteBattleSnapshot extends Error {}
export function restoreSnapshot(snapshot){
  if(!['czn-runtime-battle-read-v1','czn-runtime-battle-read-v2'].includes(snapshot.schema)||snapshot.rngUnchanged!==true||snapshot.serialization?.limits?.length!==0)
    throw new IncompleteBattleSnapshot('Unsupported, changing or truncated snapshot');
  if(snapshot.schema.endsWith('v2')&&snapshot.serialization.identityMode!=='shared-and-cyclic')
    throw new IncompleteBattleSnapshot('Missing v2 identity contract');
  const source=snapshot.worktables?.BattleWorktable?.data;
  if(!source?.battle)throw new IncompleteBattleSnapshot('BattleWorktable missing');
  const refs=new Map(),fixups=[];
  function decode(v,path){
    if(v===null||typeof v!=='object')return v;
    if(Object.hasOwn(v,'$undefined'))return undefined;
    if(Object.hasOwn(v,'$omitted'))throw new IncompleteBattleSnapshot(path+':'+v.$omitted);
    if(Object.hasOwn(v,'$ref'))return {$resolve:v.$ref};
    let out;
    if(v.$type==='Map'){
      out=new Map();refs.set(path,out);
      for(let i=0;i<v.entries.length;i++){
        const k=decode(v.entries[i][0],path+'/k'+i),value=decode(v.entries[i][1],path+'/v'+i);
        fixups.push(()=>out.set(resolve(k),resolve(value)));
      }return out;
    }
    if(v.$type==='Set'){
      out=new Set();refs.set(path,out);
      v.values.forEach((x,i)=>{const value=decode(x,path+'/'+i);fixups.push(()=>out.add(resolve(value)));});return out;
    }
    out=Array.isArray(v)?[]:{};refs.set(path,out);
    for(const [k,x]of Object.entries(v)){
      const value=decode(x,path+'/'+k.replace(/~/g,'~0').replace(/\//g,'~1'));
      Object.defineProperty(out,k,{value,writable:true,enumerable:true,configurable:true});
      if(value&&typeof value==='object'&&Object.hasOwn(value,'$resolve'))fixups.push(()=>out[k]=resolve(value));
    }return out;
  }
  function resolve(v){
    if(v&&typeof v==='object'&&Object.hasOwn(v,'$resolve')){
      if(!refs.has(v.$resolve))throw new IncompleteBattleSnapshot('Unresolved reference '+v.$resolve);
      return refs.get(v.$resolve);
    }return v;
  }
  const worktables={};
  for(const [name,entry]of Object.entries(snapshot.worktables)){
    if(!entry?.data)throw new IncompleteBattleSnapshot('Missing '+name+'.data');
    worktables[name]=decode(entry.data,'/'+name);
  }
  // Optional separately captured roots join the same identity table. Absence
  // stays absent; an explicit native undefined remains an own undefined value.
  const extras={};
  for(const key of ['runtimeInputs','resourceCaches'])if(Object.hasOwn(snapshot,key))extras[key]=decode(snapshot[key],'/'+key);
  const worktable=worktables.BattleWorktable;
  fixups.forEach(fn=>fn());
  for(const key of ['stackMap','stackParentMap','skillMap','csMap','cardMap','condMap','eventMaps','timingMap','timingCount','deck_info','user_actions'])
    if(!Object.hasOwn(worktable.battle,key))throw new IncompleteBattleSnapshot('Missing battle.'+key);
  if(!Array.isArray(snapshot.rngAfter)||!snapshot.rngAfter.length)throw new IncompleteBattleSnapshot('RNG streams missing');
  const randoms=new Map();
  for(const row of snapshot.rngAfter){
    if(row.multiplier!==1103515245||row.increment!==12345||row.modulus!==2147483648||!Number.isFinite(row.state)||randoms.has(row.type))
      throw new IncompleteBattleSnapshot('Unsupported/duplicate RNG stream '+row.type);
    randoms.set(row.type,{state:row.state});
  }
  return {worktable,worktables,randoms,...extras,metadata:{schema:snapshot.schema,
    sharedIdentityCaptured:snapshot.serialization.identityMode==='shared-and-cyclic',
    limitation:snapshot.schema.endsWith('v1')?'v1 exported cycles but duplicated non-cyclic shared objects; full object identity is unverified':null}};
}
export class OfflineRandom {
  constructor(streams,record){this.streams=streams;this.record=record;}
  nextInt(type){
    const rng=this.streams.get(type);if(!rng)throw new IncompleteBattleSnapshot('Unknown RNG stream '+type);
    if(!Number.isFinite(rng.state))throw new IncompleteBattleSnapshot('Non-finite RNG state '+type);
    const before=rng.state;const after=(1103515245*before+12345)%2147483648;
    rng.state=after;this.record?.({kind:'random',type,before,after});return after;
  }
  randRange(type,min,max){
    // An unresolved dynamic bound is missing input, not a valid random draw.
    // Equal/reversed numeric ranges retain the source arithmetic and draw count.
    if(!Number.isFinite(min)||!Number.isFinite(max))throw new MissingBattleRule('random.range_bounds',{type,min,max});
    return min+Math.floor(this.nextInt(type)/2147483648*(max-min));
  }
  randomArrayMember(type,array){return array[this.randRange(type,0,array.length)];}
  // GameRandomProvider0x9600 -> Random0x5300. Count is capped to the
  // original length even when duplicates are allowed; fractional/NaN/negative
  // counts retain native loop comparisons. Input array and item identity stay.
  randomArrayMembers(type,array,count,allowDuplicate){
    const out=[],indices=[];count=Math.min(count,array.length);
    if(allowDuplicate){for(let i=0;i<count;i++)out.push(this.randomArrayMember(type,array));}
    else{for(let i=0;i<array.length;i++)indices.push(i);for(let i=0;i<array.length&&i<count;i++){const at=this.randRange(type,0,indices.length);out.push(array[indices[at]]);indices.splice(at,1);}}
    return out;
  }
  randomTFbyProbability(type,pct){return pct>this.nextInt(type)/2147483647*100;}
}
