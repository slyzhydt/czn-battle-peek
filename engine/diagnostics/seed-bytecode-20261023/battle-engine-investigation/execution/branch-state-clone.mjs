// Fast clone for the plain structured battle graph. Aliases, cycles, ordered
// Maps/Sets and sparse arrays are preserved. Other host types use the existing
// whole-graph structuredClone, never a partial fallback that breaks aliases.
const unsupported=Symbol('unsupported-state-type');
export function cloneBattleState(state){
  const memo=new Map();
  function copy(value){
    if(value===null||typeof value!=='object'){
      if(typeof value==='function'||typeof value==='symbol')throw unsupported;
      return value;
    }
    if(memo.has(value))return memo.get(value);
    let out;
    if(value instanceof Map){out=new Map();memo.set(value,out);for(const [k,v]of value)out.set(copy(k),copy(v));return out;}
    if(value instanceof Set){out=new Set();memo.set(value,out);for(const v of value)out.add(copy(v));return out;}
    if(value instanceof Date){out=new Date(value.getTime());memo.set(value,out);return out;}
    const proto=Object.getPrototypeOf(value);
    if(!Array.isArray(value)&&proto!==Object.prototype&&proto!==null)throw unsupported;
    out=Array.isArray(value)?new Array(value.length):{};memo.set(value,out);
    for(const key of Object.keys(value)){
      const v=copy(value[key]);
      if(key==='__proto__')Object.defineProperty(out,key,{value:v,enumerable:true,writable:true,configurable:true});else out[key]=v;
    }
    return out;
  }
  try{return copy(state);}catch(error){if(error!==unsupported)throw error;return structuredClone(state);}
}
