// Handwritten ClientGameDataStore cache builders and sorted rows0x9600.
// db.table supplies the processed GameResDB dictionary: card includes converted
// monster_card rows and any explicitly supplied overrides before this stage.
// No recovered JavaScript is executed. Evidence: evidence/client-cache-builders/
// and evidence/client-cache-builders-extra/.

function rowsSortedById(db,name){
 const table=db.table(name),rows=Object.keys(table).map(key=>table[key]);
 // Native idOf0xa600 uses string conversion and comparator0xad00 uses <,
 // not numeric sorting or localeCompare. Equal IDs retain enumeration order.
 return rows.sort((a,b)=>`${a.id}`<`${b.id}`?-1:`${b.id}`<`${a.id}`?1:0);
}

export function buildClientCache(prefix,{db,cache}){
 // 0x18d00 only publishes the literal empty default. It does not read the
 // simulate_battle_custom table or invent the originally requested group.
 if(prefix==='SIMULATE_STAGE_CUSTOM'){cache[prefix+':default']=JSON.stringify([]);return true;}
 if(!['CARD_TAG','CARD_R_SPARK_POOL','R_SPARK_RARITY'].includes(prefix))return false;
 const groups={};
 if(prefix==='CARD_TAG'){
  // 0xb500 @11..130; callback0xc100 pushes once per tag occurrence.
  for(const row of rowsSortedById(db,'card'))for(const tag of db.array(row.reward_tag)){
   groups[tag]??=[];groups[tag].push(row.id);
  }
 }else if(prefix==='CARD_R_SPARK_POOL'){
  // 0x10300 @0..115: no weight/enable filtering and no missing-key fallback.
  // An absent link_card_id becomes the native object key "undefined".
  for(const row of rowsSortedById(db,'card_r_spark')){
   groups[row.link_card_id]??=[];groups[row.link_card_id].push(row.id);
  }
 }else{
  // 0xf700 @64..123: only CATEGORY_PUBLIC, then the raw rarity key.
  // TestEqual and the truthy group guard are retained, including the native
  // ordinary-object behavior for inherited keys such as "constructor".
  for(const row of rowsSortedById(db,'r_spark')){
   if(row.category!='CATEGORY_PUBLIC')continue;
   if(!groups[row.rarity])groups[row.rarity]=[];
   groups[row.rarity].push(row.id);
  }
 }
 // 0xb500 @191..288 / 0x10300 @177..269 / 0xf700 @219..280:
 // write only actual group keys, without clearing older cached groups.
 // Empty tables do not invent ':default' or the originally requested key.
 for(const key in groups)cache[prefix+':'+key]=JSON.stringify(groups[key]);
 return true;
}
