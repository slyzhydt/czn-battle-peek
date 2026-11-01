import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

export function toArray(value) {
  // GameResDB.toArray: brackets removed globally, split ',', then trim.
  value ||= '';
  const values = value.replace(/[\[\]]/gi, '').split(',');
  return values.length === 1 && values[0] === '' ? [] : values.map(x => x.trim());
}
export function sortedById(rows) {
  return [...rows].sort((a,b) => String(a.id)<String(b.id)?-1:String(b.id)<String(a.id)?1:0);
}
export function buildCaches(tables) {
  const cache = {};
  function put(prefix, group, id) {
    const key = prefix+':'+group;
    (cache[key] ??= []).push(id);
  }
  for (const row of sortedById(tables.card ?? []))
    for (const tag of toArray(row.reward_tag)) put('CARD_TAG',tag,row.id);
  for (const row of sortedById(tables.r_spark ?? []))
    if (row.category == 'CATEGORY_PUBLIC') put('R_SPARK_RARITY',row.rarity,row.id);
  for (const row of sortedById(tables.card_r_spark ?? []))
    put('CARD_R_SPARK_POOL',row.link_card_id,row.id);
  return cache;
}
export function loadTables(directory) {
  const wanted = new Set(['card','card_r_spark','r_spark','monster','monster_reward_deck','map_battle_reward_filter','char_combatant','potential_node','potential_node_effect','card_filter']);
  const tables={}, sources={}, collisions=[];
  for(const name of fs.readdirSync(directory).sort()) {
    if(!name.includes('@') || !name.endsWith('.json')) continue;
    const table = name.slice(name.lastIndexOf('@')+1,-5);
    if(!wanted.has(table)) continue;
    const data=JSON.parse(fs.readFileSync(path.join(directory,name),'utf8').replace(/^\uFEFF/,''));
    if(!Array.isArray(data)) throw Error('Not a row array: '+name);
    for(const row of data) {
      (tables[table]??=[]).push(row);
      const key=table+':'+row.id;
      if(sources[key]) collisions.push({key,sources:[...sources[key],name]});
      (sources[key]??=[]).push(name);
    }
  }
  if(collisions.length) throw Error('Ambiguous duplicate IDs: '+JSON.stringify(collisions));
  return {tables,sources,collisions};
}
export function buildCatalog(directory) {
  const {tables,sources,collisions}=loadTables(directory);
  const cache=buildCaches(tables);
  const byId=Object.fromEntries(Object.entries(tables).map(([table,rows])=>[table,Object.fromEntries(rows.map(r=>[r.id,r]))]));
  const missingChanges=(tables.card_r_spark??[]).filter(r=>!byId.card[r.change_link_card_id]).map(r=>({id:r.id,change_link_card_id:r.change_link_card_id}));
  return {schema:'czn-static-card-pools/v1',boundary:'Static packaged candidate universe; not a seeded run prediction. Rows retain exported string field types.',counts:Object.fromEntries(Object.entries(tables).map(([t,r])=>[t,r.length])),sources,collisions,missingChanges,cache,byId};
}
if(process.argv[1] && path.resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  const root=path.dirname(fileURLToPath(import.meta.url));
  const result=buildCatalog(process.argv[2]??path.join(root,'../resource-catalog/db'));
  const out=process.argv[3]??path.join(root,'card-pools.json');
  fs.writeFileSync(out,JSON.stringify(result,null,2)+'\n');
  console.log(JSON.stringify({counts:result.counts,cacheKeys:Object.keys(result.cache).length,missingChanges:result.missingChanges.length,collisions:result.collisions.length,output:out},null,2));
}
