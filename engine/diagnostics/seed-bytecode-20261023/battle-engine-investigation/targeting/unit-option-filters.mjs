import {UnresolvedTargetRule} from './selection-core.mjs';
import {compareCondition} from '../conditions/condition-core.mjs';
import {procStatType,procRevise} from '../effects/effect-arithmetic.mjs';

// getSkillEffTarget @0xf0000000c000 +14123..17049, helpers 0x32700..0x41f00.
// Constants below are literal values from SkillEffTargetUnitTypeOpt @0x14200.
// This file is handwritten; neither recovered JS nor target bytecode is run.
const read=(obj,key)=>{
  if(obj==null||!Object.hasOwn(obj,key)||obj[key]===undefined)throw new UnresolvedTargetRule('missing unit-option field '+key);
  return obj[key];
};
const invoke=(api,key,...args)=>{
  if(typeof api[key]!=='function')throw new UnresolvedTargetRule('missing unit-option method '+key);
  const result=api[key](...args);
  if(result===undefined)throw new UnresolvedTargetRule('missing unit-option result '+key);
  return result;
};
const cmp=(op,left,right)=>compareCondition('INEQUALITY_'+op.toUpperCase(),left,right);
const baseDebuff=type=>type==='CS_DEBUFF'||type==='CS_DEBUFF_DOT';

// checkCSopts @0x8700 is ANY option. Plain IDs test presence; ID:GE3
// compares the SUM of raw term_value. Removed entries are skipped.
export function checkLinkedUnitCS(unit,choices,{battle,api}){
  const skills=invoke(api,'getContinueSkills',unit),map=read(battle,'csMap');
  const active=id=>{
    // The supplied map must be complete: a key's absence is known no instance.
    const cs=Object.hasOwn(map,id)?map[id]:null;
    return cs!==null&&!read(cs,'removed')?cs:null;
  };
  return choices.some(option=>{
    const split=option.split(':');
    if(split.length===1)return skills.some(id=>{const cs=active(id);return cs!==null&&read(cs,'res_id')==option;});
    const total=skills.reduce((sum,id)=>{const cs=active(id);return cs!==null&&read(cs,'res_id')==split[0]?sum+read(cs,'term_value'):sum;},0);
    // This source does not uppercase the link-CS inequality substring.
    return compareCondition('INEQUALITY_'+split[1].slice(0,2),total,Number(split[1].slice(2)));
  });
}

export function applyUnitOptionFilters(ids,{battle,skill,targetOptions,linkedCS,api={}}){
  if(!Array.isArray(ids)||!Array.isArray(targetOptions)||!Array.isArray(linkedCS))throw new UnresolvedTargetRule('unit-option arrays must be resolved');
  let out=ids.slice();const original=ids.slice(),opts=targetOptions;
  const has=value=>opts.includes(value);
  const getUnit=id=>invoke(api,'getUnitByID',id,'getSkillEffTarget:'+read(skill,'res_id'));
  const status=(id,type)=>invoke(api,'getStatus',id,type);
  const nextAttack=unit=>read(invoke(api,'readCardResource',read(unit,'nextCard')),'monster_noti_category').includes('ATK');
  function attackGate(positive){
    const selected=read(battle,'select_target');
    if(selected>0){
      const unit=getUnit(selected);
      if(!read(unit,'nextCard'))return false;
      if(positive&&!(read(unit,'mon_turn')===null||read(unit,'mon_turn')>0))return false;
      return positive?nextAttack(unit):!nextAttack(unit);
    }
    return read(battle,'monsters').some(unit=>invoke(api,'isFieldMonster',unit)&&read(unit,'nextCard')&&(positive?nextAttack(unit):!nextAttack(unit)));
  }
  if(opts.length){
    // These are whole-selection gates. A failure returns immediately, before
    // linked-CS and priority; success skips all ordinary option predicates.
    if(has('n_atk')){if(!attackGate(true))return [];}
    else if(has('notice_not_attack')){if(!attackGate(false))return [];}
    else{
      const grades=opts.filter(o=>o.startsWith('GRADE_'));
      if(grades.length)out=out.filter(id=>{
        const unit=invoke(api,'getUnitByID',id,'getSkillEffTarget'+read(skill,'res_id'));
        const resource=invoke(api,'readMonsterResource',read(unit,'res_id'));
        return !resource||grades.includes(read(invoke(api,'readMonsterResource',read(unit,'res_id')),'grade'));
      });
      const hpOpts=opts.filter(o=>o.startsWith('target_hp_'));
      if(hpOpts.length)out=out.filter(id=>!hpOpts.some(o=>{
        if(o.slice(10,13)==='pct')return !cmp(o.slice(14,16),status(id,'S_CURRENT_HP')/status(id,'S_HP')*100,Number(o.slice(17)));
        return !cmp(o.slice(10,12),status(id,'S_CURRENT_HP'),Number(o.slice(13)));
      }));
      const egoOpts=opts.filter(o=>o.startsWith('ego_field_pct_'));
      if(egoOpts.length)out=out.filter(id=>!egoOpts.some(o=>{
        const unit=getUnit(id),maximum=read(unit,'ego_field_max_value');
        return maximum===null?false:!cmp(o.slice(14,16),(read(unit,'ego_field_value')??0)/maximum*100,Number(o.slice(17)));
      }));
      const atkOpts=opts.filter(o=>o.startsWith('atk_'));
      if(atkOpts.length)out=out.filter(id=>!atkOpts.some(o=>{
        // Threshold is a revised percent of the source ATK, compared to target
        // current HP. Names do not imply a target-ATK comparison here.
        const hp=status(id,'S_CURRENT_HP');
        const value=procStatType(1,Number(o.slice(7)),status(read(skill,'stat_source'),'S_ATK'));
        return !cmp(o.slice(4,6),hp,procRevise(1,value,invoke(api,'getReviseRates')));
      }));
      if(has('viability'))out=out.filter(id=>invoke(api,'isViability',id));
      if(has('injury'))out=out.filter(id=>invoke(api,'isInjury',id));
      if(has('break'))out=out.filter(id=>read(getUnit(id),'ego_breaked'));
      if(has('not_break'))out=out.filter(id=>!read(getUnit(id),'ego_breaked'));
      if(has('no_ego_field'))out=out.filter(id=>read(getUnit(id),'ego_field_max_value')===null);
      if(has('notice_not_move'))out=out.filter(id=>{const turn=read(getUnit(id),'mon_turn');return turn===null||turn>=0;});
      for(const o of opts.filter(o=>o.startsWith('turn_count_'))){
        out=out.filter(id=>{const unit=getUnit(id);return unit?cmp(o.slice(11,13),Math.max(0,read(unit,'mon_turn')??Infinity),Number(o.slice(13))):false;});
      }
      for(const o of opts.filter(o=>o.startsWith('select_turn_count_'))){
        const selected=read(battle,'select_target');
        if(selected===-1){out=[];continue;}
        const unit=getUnit(selected);
        if(!unit||!cmp(o.slice(18,20),Math.max(0,read(unit,'mon_turn')??Infinity),Number(o.slice(20))))out=[];
      }
      // Reverse iteration is observable: getStatus may consume passive RNG.
      if(has('shield'))for(let i=out.length-1;i>=0;i--)if(status(out[i],'S_CURRENT_SHIELD')<=0)out.splice(i,1);
      const csPredicate=(id,kind)=>{
        const unit=getUnit(id),csMap=read(battle,'csMap');
        return invoke(api,'getContinueSkills',unit).some(sid=>{
          const cs=Object.hasOwn(csMap,sid)?csMap[sid]:null;if(!cs)return false;
          const type=read(invoke(api,'readCSResource',read(cs,'res_id')),'cs_buff_type');
          if(kind==='dot')return type==='CS_DEBUFF_DOT';
          return kind==='debuff'?(baseDebuff(type)||type==='CS_BUFF_DEBUFF'&&read(cs,'term_value')<0):
            (type==='CS_BUFF'||type==='CS_BUFF_DEBUFF'&&read(cs,'term_value')>0);
        });
      };
      if(has('debuff'))out=out.filter(id=>csPredicate(id,'debuff'));
      if(has('debuff_dot'))out=out.filter(id=>csPredicate(id,'dot'));
      if(has('buff'))out=out.filter(id=>csPredicate(id,'buff'));
    }
  }
  // Resource array conversion precedes this function. The mapping is NOT done
  // by string splitting; each complete option is looked up as a map key.
  let mapped=linkedCS;
  if(linkedCS.length){
    const changes=read(api,'breakCSChanges');
    mapped=linkedCS.map(id=>changes?.[id]??id);
    out=out.filter(id=>has('not')?!checkLinkedUnitCS(getUnit(id),mapped,{battle,api}):checkLinkedUnitCS(getUnit(id),mapped,{battle,api}));
  }
  return has('priority')&&out.length===0?original:out;
}
