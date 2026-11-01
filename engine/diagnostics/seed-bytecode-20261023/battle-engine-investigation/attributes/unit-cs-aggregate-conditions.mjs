import {effectiveTermValue} from '../conditions/condition-core.mjs';

// Independent reconstruction of procUnitEvent inner callback 0xf0000005e900,
// offsets 26777..33081 and helpers 0x66600..0x6b500. Not recovered JS execution.
export const CS_AGGREGATE_UNIT_EVENT_TYPES=Object.freeze([
  'CONDITION_CHAR_CS_AMOUNT','CONDITION_OWN_CHAR_CS_AMOUNT',
  'CONDITION_CHAR_CS_BUFF_TYPE_COUNT','CONDITION_OWN_CHAR_CS_BUFF_TYPE_COUNT',
  'CONDITION_CHAR_CS_BUFF_TYPE_SET','CONDITION_CHAR_CS_TERM_VALUE_SET',
  'CONDITION_OWN_CHAR_CS_TERM_VALUE_SET','CONDITION_CHAR_CS_TERM_VALUE_MAX_SET',
  'CONDITION_OWN_CHAR_CS_TERM_VALUE_MAX_SET'
]);
const TYPES=new Set(CS_AGGREGATE_UNIT_EVENT_TYPES);
const ev=(f,k)=>f.read(f.event,k,'event.'+k);
const opts=f=>ev(f,'unit_opt');
const has=(f,k)=>opts(f)?.includes(k)??false;
const ids=f=>ev(f,'unit_opt_cs');
const csFor=(f,id)=>f.read(f.read(f.battle,'csMap','battle.csMap'),id,'battle.csMap['+id+']');
const compare=(f,a,b)=>{f.result.on=f.compare(a,b);f.result.off=!f.result.on;};
const ownChar=f=>f.stack===null?null:f.read(f.stack,'caster_id','stack.caster_id');
const previous=f=>ev(f,'prev')??0;
const setValue=(f,value)=>{f.event.set_value=value;f.event.set=true;f.result.on=true;};
const buffType=(f,key)=>f.enum('CS_BUFF_TYPE',key);
const shownId=(f,cs)=>f.read(cs,'show_cs_res_id','cs.show_cs_res_id')??f.read(cs,'res_id','cs.res_id');

function amount(f,skillIds,displayId=false,allowAll=false){
  let total=0;
  for(const id of skillIds){
    const cs=csFor(f,id),choices=ids(f);
    if(allowAll&&choices===null||choices?.includes(displayId?shownId(f,cs):f.read(cs,'res_id')))
      total+=effectiveTermValue(cs);
  }
  return total;
}
function buffAmount(f,id,debuff){
  const cs=csFor(f,id),resource=f.call('getCSRow',f.read(cs,'res_id'));
  const type=f.read(resource,'cs_buff_type','cs.cs_buff_type');
  if(debuff){
    // baseDebuffType @continue_skill.js:0x6a00 is exactly these two strings.
    if(type==='CS_DEBUFF'||type==='CS_DEBUFF_DOT')return Math.abs(effectiveTermValue(cs));
    if(type===buffType(f,'CS_BUFF_DEBUFF')&&effectiveTermValue(cs)<0)return Math.abs(effectiveTermValue(cs));
  }else{
    if(type===buffType(f,'CS_BUFF'))return effectiveTermValue(cs);
    if(type===buffType(f,'CS_BUFF_DEBUFF')&&effectiveTermValue(cs)>0)return effectiveTermValue(cs);
  }
  return 0;
}
function maximumAmount(f,skillIds,debuff){return Math.max(...skillIds.map(id=>buffAmount(f,id,debuff)));}
function count(f,own,type){return own?f.call('getCsBuffTypeCount',ownChar(f),type):f.call('getCSCount',Number(f.p(0)),type);}

function csAmount(f,own){
  f.result.flag=false;
  const threshold=ev(f,'value');
  if(f.read(f.row,'condition_unit_type')==='CONDITION_UNIT_ALL'){
    const source=f.opt(1);
    if(source!==null&&!ids(f)?.includes(source.toString()))return;
    let total=0;
    if(own)total=amount(f,f.call('getContinueSkillsByCharID',ownChar(f)));
    else{
      const all=f.call('getTargetableMonstersID').concat(f.read(f.read(f.battle,'char'),'id'));
      for(const id of all)total+=amount(f,f.call('getContinueSkills',f.call('getUnitByID',id,'CONDITION_CHAR_CS_AMOUNT_with_UNIT_ALL')));
    }
    f.valueTriggered=total-previous(f);f.event.prev=total;compare(f,total,threshold);return;
  }
  if(isNaN(threshold)){f.result.off=true;return;}
  if(ids(f)===null||ids(f)?.includes(f.opt(1)?.toString())){
    f.valueTriggered=own?amount(f,f.call('getContinueSkillsByCharID',ownChar(f)),true,true):Number(f.p(2));
    compare(f,f.valueTriggered,threshold);return;
  }
  const buff=has(f,'buff'),debuff=has(f,'debuff');
  if(!buff&&!debuff)return;
  let skills;
  if(own)skills=f.call('getContinueSkillsByCharID',ownChar(f));
  else{
    const unit=f.call('getUnitByIDskipError',Number(f.p(0)));
    if(unit===null)return;
    skills=f.call('getContinueSkills',unit);
  }
  // An empty source produces -Infinity, as Math.max(...[]) does in the game.
  f.valueTriggered=maximumAmount(f,skills,!buff);
  compare(f,f.valueTriggered,threshold);
}
function buffTypeCount(f,own){
  f.result.flag=false;
  if(own&&ownChar(f)===null)return;
  if(has(f,'compare_buff_debuff')){
    compare(f,count(f,own,buffType(f,'CS_BUFF')),count(f,own,buffType(f,'CS_DEBUFF')));return;
  }
  const total=count(f,own,buffType(f,has(f,'buff')?'CS_BUFF':'CS_DEBUFF'));
  f.valueTriggered=total-previous(f);
  if(f.valueTriggered===0)return;
  f.event.prev=total;compare(f,has(f,'change')?f.valueTriggered:total,ev(f,'value'));
}
function maxSet(f,own){
  const choices=ids(f);
  if(choices===null||!choices?.includes(f.p(1).toString()))return;
  if(own&&ownChar(f)===null)return;
  const unit=own?null:f.call('getUnitByID',Number(f.p(0)),'CONDITION_CHAR_CS_TERM_VALUE_MAX_SET');
  const values={};
  for(const choice of choices){
    const skills=own?f.call('getContinueSkillsByCharID',ownChar(f)):f.call('getContinueSkills',unit);
    for(const id of skills){
      const cs=csFor(f,id);
      if(shownId(f,cs)==choice){values[choice]??=0;values[choice]+=effectiveTermValue(cs);}
    }
    values[choice]??=0;
  }
  let maximum=-Infinity;
  for(const key in values)maximum=Math.max(maximum,values[key]);
  if(maximum!==-Infinity)setValue(f,maximum*ev(f,'stack_input'));
}
export function handleCSAggregateUnitCondition(f){
  if(!TYPES.has(f.eventType))return false;
  switch(f.eventType){
    case 'CONDITION_CHAR_CS_AMOUNT':csAmount(f,false);break;
    case 'CONDITION_OWN_CHAR_CS_AMOUNT':csAmount(f,true);break;
    case 'CONDITION_CHAR_CS_BUFF_TYPE_COUNT':buffTypeCount(f,false);break;
    case 'CONDITION_OWN_CHAR_CS_BUFF_TYPE_COUNT':buffTypeCount(f,true);break;
    case 'CONDITION_CHAR_CS_BUFF_TYPE_SET':{
      if(has(f,'compare_buff_debuff'))throw new Error('invalid_opt_compare_buff_debuff_at_CONDITION_CHAR_CS_BUFF_TYPE_SET:'+ev(f,'res_id'));
      setValue(f,count(f,false,buffType(f,has(f,'buff')?'CS_BUFF':'CS_DEBUFF')));break;
    }
    case 'CONDITION_CHAR_CS_TERM_VALUE_SET':case 'CONDITION_OWN_CHAR_CS_TERM_VALUE_SET':{
      f.result.flag=false;
      if(ids(f)?.includes(f.p(1).toString()))setValue(f,Number(f.p(2))*ev(f,'stack_input'));
      else if(has(f,'buff')||has(f,'debuff')){
        let value=0;
        if(has(f,'buff'))value+=count(f,false,buffType(f,'CS_BUFF'));
        if(has(f,'debuff'))value+=count(f,false,buffType(f,'CS_DEBUFF'));
        setValue(f,value);
      }
      break;
    }
    case 'CONDITION_CHAR_CS_TERM_VALUE_MAX_SET':maxSet(f,false);break;
    case 'CONDITION_OWN_CHAR_CS_TERM_VALUE_MAX_SET':maxSet(f,true);break;
  }
  return true;
}
