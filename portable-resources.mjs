// Resource-only graph carrier. Never loads a battle capture or native query.
import fs from 'node:fs';
import {serialize,deserialize} from 'node:v8';
import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
import {fileURLToPath} from 'node:url';
export function encodeGraph(value){
 const objects=[],seen=new Map();
 function encode(v){
  if(v===null||typeof v!=='object'){
   if(['function','symbol'].includes(typeof v))throw Error('Unsupported resource scalar');
   return {v};
  }
  if(seen.has(v))return {r:seen.get(v)};
  const id=objects.length,record={array:Array.isArray(v),properties:[]};seen.set(v,id);objects.push(record);
  const proto=Object.getPrototypeOf(v);
  record.proto=proto===null?'null':proto===Object.prototype?'Object.prototype':proto===Array.prototype?'Array.prototype':encode(proto);
  for(const key of Reflect.ownKeys(v)){
   if(typeof key!=='string')throw Error('Symbol resource key');
   const d=Object.getOwnPropertyDescriptor(v,key);
   if(!Object.hasOwn(d,'value'))throw Error('Resource accessor');
   record.properties.push([key,{enumerable:d.enumerable,configurable:d.configurable,writable:d.writable},encode(d.value)]);
  }
  return {r:id};
 }
 const entry=encode(value);return {schema:'czn-resource-graph-v1',entry,objects};
}
export function decodeGraph(graph){
 if(graph.schema!=='czn-resource-graph-v1')throw Error('Unknown resource graph');
 const objects=graph.objects.map(o=>o.array?[]:Object.create(null));
 const decode=v=>Object.hasOwn(v,'r')?objects[v.r]:v.v;
 for(const [i,record]of graph.objects.entries()){
  const proto=record.proto==='null'?null:record.proto==='Object.prototype'?Object.prototype:record.proto==='Array.prototype'?Array.prototype:decode(record.proto);
  Object.setPrototypeOf(objects[i],proto);
  // Array length is encoded last by Reflect.ownKeys, preserving sparse arrays.
  for(const [key,flags,value]of record.properties)Object.defineProperty(objects[i],key,{...flags,value:decode(value)});
 }
 return decode(graph.entry);
}
export const resourceBytes=value=>serialize(encodeGraph(value));
export const resourceValue=bytes=>decodeGraph(deserialize(bytes));
export function loadPortableResources(directory){
 const manifest=JSON.parse(fs.readFileSync(new URL('manifest.json',directory))),loaded=new Map();
 if(manifest.schema!=='czn-portable-resource-pack-v1')throw Error('Unknown portable resource pack');
 function open(table){
  if(loaded.has(table))return loaded.get(table);
  const entry=manifest.tables.find(x=>x.table===table);
  if(!entry)throw Error('missing_battle_rule:portable_resource_table:'+table);
  const bytes=fs.readFileSync(new URL(entry.file,directory));
  if(createHash('sha256').update(bytes).digest('hex')!==entry.SHA256)throw Error('Resource digest mismatch: '+table);
  const data=resourceValue(entry.file.endsWith('.gz')?gunzipSync(bytes):bytes),lookups=new Map(data.lookups);
  const value={...data,lookups};loaded.set(table,value);return value;
 }
 return Object.freeze({
  root:fileURLToPath(new URL('../../engine/diagnostics/seed-bytecode-20261023/resource-catalog/',directory)),
  table(table){const data=open(table);if(data.enumeration===null)throw Error('missing_battle_rule:portable_enumeration:'+table);return data.enumeration;},
  get(table,key){const rows=open(table).lookups;if(!rows.has(key))throw Error('missing_battle_rule:portable_resource_lookup:'+table+':'+typeof key+':'+String(key));return rows.get(key);},
  number(row,key){for(let p=row;p!==null;p=Object.getPrototypeOf(p)){const d=Object.getOwnPropertyDescriptor(p,key);if(!d)continue;if(Object.hasOwn(d,'value')&&typeof d.value==='number'&&Number.isFinite(d.value))return d.value;break;}throw Error('missing_battle_rule:portable_numeric_field:'+key);},
  array(value){if(typeof value!=='string'&&value)throw Error('Unsupported resource array');value||='';const list=value.replace(/[\[\]]/gi,'').split(',');return list.length===1&&list[0]===''?[]:list.map(x=>x.trim());},
  sourceFor(row,key){return {kind:'portable-admitted-resource-field',key};},
  profile:Object.freeze({mode:'portable-admitted-resource-pack',staticFallback:false}),
  diagnostics:()=>({residentTables:[...loaded.keys()],staticFallback:false})
 });
}
export function requireSettled(state){
 const p=state.runtimeInputs.executionProtocol;
 if(p?.contextOwnerMatches!==true||p.pendingServerSteps?.available!==true||p.pendingServerSteps.count!==0)throw Error('Snapshot is not a settled owned battle input');
}
