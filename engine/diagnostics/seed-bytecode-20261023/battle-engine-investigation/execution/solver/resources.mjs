// Admitted inputs have fixed resources and empty overlays. Cache only lookups
// whose owner/version is frozen for the request. Preserve Number/String keys.
export function solverResources(source){
  const rows=new Map(),tables=new Map(),copies=new WeakMap(),originals=new WeakMap();let preparedConditions;
  const stats={getHits:0,getMisses:0,tableHits:0,tableMisses:0,sealedObjects:0,conditionBuilds:0,conditionHits:0};
  function seal(value){
    if(value===null||typeof value!=='object')return value;
    if(copies.has(value))return copies.get(value);
    if(value instanceof Map||value instanceof Set)throw Error('Mutable collection in shared resource row');
    const copy=Array.isArray(value)?new Array(value.length):Object.create(null);copies.set(value,copy);originals.set(copy,value);stats.sealedObjects++;
    const proto=Object.getPrototypeOf(value);Object.setPrototypeOf(copy,proto&&proto!==Object.prototype&&proto!==Array.prototype?seal(proto):proto);
    for(const [key,d]of Object.entries(Object.getOwnPropertyDescriptors(value))){if(Array.isArray(value)&&key==='length')continue;if(!('value'in d))throw Error('Accessor in shared resource row');Object.defineProperty(copy,key,{...d,value:seal(d.value)});}
    return Object.freeze(copy);
  }
  return Object.freeze({...source,
    get(table,key){let cache=rows.get(table);if(!cache){cache=new Map();rows.set(table,cache);}if(cache.has(key)){stats.getHits++;return cache.get(key);}stats.getMisses++;
      let value;try{value=seal(source.get(table,key));}catch(error){if(error.code)error.details={...error.details,lookup:{table,type:typeof key,value:key}};throw error;}cache.set(key,value);return value;},
    table(name){if(tables.has(name)){stats.tableHits++;return tables.get(name);}stats.tableMisses++;const value=seal(source.table(name));tables.set(name,value);return value;},
    preparedConditionRows(){
      if(preparedConditions){stats.conditionHits++;return preparedConditions;}
      // This wrapper admits fixed resources and seals nested values already.
      // Only the numeric projection is shared; all live stacks remain branch-owned.
      const result=Object.fromEntries(Object.entries(this.table('condition')).map(([id,r])=>[id,Object.freeze({...r,stack_restriction_value:this.number(r,'stack_restriction_value')})]));
      stats.conditionBuilds++;return preparedConditions=Object.freeze(result);
    },
    sourceFor:(object,key)=>source.sourceFor(originals.get(object)??object,key),
    solverDiagnostics:()=>({...stats})});
}
