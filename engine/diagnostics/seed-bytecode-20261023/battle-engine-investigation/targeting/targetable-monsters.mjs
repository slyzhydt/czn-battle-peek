// getTargetableMonstersID 0xf000001bd400, closure 0x1c2100 and helpers.
// Separate from TargetProc's final option filters: the shipped algorithms differ.
import {UnresolvedTargetRule} from './selection-core.mjs';
import {compareCondition} from '../conditions/condition-core.mjs';
import {procStatType,procRevise} from '../effects/effect-arithmetic.mjs';
import {checkLinkedUnitCS} from './unit-option-filters.mjs';
const read=(o,key)=>{if(o==null||!Object.hasOwn(o,key)||o[key]===undefined)throw new UnresolvedTargetRule('missing monster-target field '+key);return o[key];};
const call=(api,key,...args)=>{if(typeof api[key]!=='function')throw new UnresolvedTargetRule('missing monster-target method '+key);const value=api[key](...args);if(value===undefined)throw new UnresolvedTargetRule('missing monster-target result '+key);return value;};
const array=(v,name)=>{if(!Array.isArray(v))throw new UnresolvedTargetRule('missing resolved monster-target array '+name);return v;};
const cmp=(op,left,right)=>compareCondition('INEQUALITY_'+op.toUpperCase(),left,right);

export function getAllCharacters(battle){
  const extra=read(battle,'assault_fourth_char'),chars=array(read(battle,'chars'),'chars');
  return extra?[...chars,extra]:chars;
}

export function getTargetableMonsterIDs({battle,api={}},query={}){
  const {except_id,checkHP=true,skill_id}=query;
  let opts=[],links=[],skill=null;
  if(skill_id!=null){
    const map=read(battle,'skillMap');skill=Object.hasOwn(map,skill_id)?map[skill_id]:null;
    if(skill){
      opts=read(skill,'target_unit_type_opt')??[];
      const row=call(api,'skillEffInfo',read(skill,'res_id'));
      links=array(read(row,'target_unit_type_opt_link_cs_id'),'target_unit_type_opt_link_cs_id');
      if(links.length){const changes=read(api,'breakCSChanges');links=links.map(id=>changes?.[id]??id);}
    }
  }
  array(opts,'target options');
  const has=opt=>opts.includes(opt),monsters=array(read(battle,'monsters'),'monsters');
  // Original early path ignores state, HP, except_id and linked CS.
  if(has('n_atk')||has('notice_not_attack'))return monsters.map(m=>read(m,'id'));
  const grades=opts.filter(o=>o.startsWith('GRADE_')),hp=opts.filter(o=>o.startsWith('target_hp_')),atk=opts.filter(o=>o.startsWith('atk_')),ego=opts.filter(o=>o.startsWith('ego_field_pct_')),turns=opts.filter(o=>o.startsWith('turn_count_'));
  const unitState=name=>call(api,'unitState',name);
  const rawStatus=(u,type)=>typeof api.readStatusInfo==='function'?call(api,'readStatusInfo',u,type):read(read(read(u,'status'),'info'),call(api,'statEnum',type));
  const getStatus=(id,type)=>call(api,'getStatus',id,type);
  const fieldMonster=u=>!['death','run','changed','prop'].some(name=>read(u,'state')==unitState(name));
  const half=u=>read(u,'state')==unitState('half_death')||read(u,'state')==unitState('keep_half_death');
  const ret=[],ret2=[];
  for(const monster of monsters){
    const resource=call(api,'readMonsterResource',read(monster,'res_id')),grade=read(resource,'grade');
    if(grade==='GRADE_PROP_KEEP_HALF_DEATH_NOTICE'&&!has('with_half_death')&&!has('only_half_death'))continue;
    const hpAllowed=!checkHP||rawStatus(monster,'S_CURRENT_HP')>0||grade==='GRADE_MULTI_HP';
    if(!(fieldMonster(monster)&&hpAllowed)&&!half(monster))continue;
    if(has('only_half_death')){if(!half(monster))continue;}
    else if(!has('with_half_death')&&half(monster))continue;
    const id=read(monster,'id');ret2.push(id); // Before every option and except_id.
    if(!opts.length&&!links.length){if(id!=except_id)ret.push(id);continue;}
    if(has('shield')&&rawStatus(monster,'S_CURRENT_SHIELD')<=0)continue;
    // Original performs the resource lookup again for grade filtering.
    if(grades.length&&!grades.includes(read(call(api,'readMonsterResource',read(monster,'res_id')),'grade')))continue;
    if(hp.some(o=>o.slice(10,13)==='pct'?!cmp(o.slice(14,16),getStatus(id,'S_CURRENT_HP')/getStatus(id,'S_HP')*100,Number(o.slice(17))):!cmp(o.slice(10,12),getStatus(id,'S_CURRENT_HP'),Number(o.slice(13)))))continue;
    if(ego.some(o=>{
      const max=read(monster,'ego_field_max_value');
      // In this helper (unlike final TargetProc filtering), no field rejects.
      if(max===null)return true;
      // Preserve the actual slice offsets 17/19/20, even for malformed input.
      return !cmp(o.slice(17,19),(read(monster,'ego_field_value')??0)/max*100,Number(o.slice(20)));
    }))continue;
    if(atk.length){
      if(skill_id==null)continue;
      // The source accepts SOME failed comparison here. Do not invert it into
      // the seemingly more natural all-pass behavior of TargetProc's tail.
      const someFailure=atk.some(o=>{
        const current=getStatus(id,'S_CURRENT_HP');
        const threshold=procStatType(1,Number(o.slice(7)),getStatus(read(skill,'stat_source'),'S_ATK'));
        return !cmp(o.slice(4,6),current,procRevise(1,threshold,call(api,'getReviseRates')));
      });
      if(!someFailure)continue;
    }
    if(has('viability')&&!call(api,'isViability',id))continue;
    if(has('injury')&&!call(api,'isInjury',id))continue;
    if(has('break')&&!read(monster,'ego_breaked'))continue;
    if(has('not_break')&&read(monster,'ego_breaked'))continue;
    if(has('no_ego_field')&&read(monster,'ego_field_max_value')!==null)continue;
    if(turns.some(o=>!cmp(o.slice(11,13),Math.max(0,read(monster,'mon_turn')??Infinity),Number(o.slice(13)))))continue;
    if(links.length){const matched=checkLinkedUnitCS(monster,links,{battle,api});if(has('not')?matched:!matched)continue;}
    if(id!=except_id)ret.push(id);
  }
  if(has('priority')&&!ret.length){
    if(checkHP&&!ret2.length)return getTargetableMonsterIDs({battle,api},{except_id,checkHP:false,skill_id});
    return ret2; // May include except_id; the original fallback does too.
  }
  if(checkHP&&!ret.length)return getTargetableMonsterIDs({battle,api},{except_id,checkHP:false,skill_id});
  return ret;
}
