import {checkUnitOptions,compareCondition,MissingConditionInput} from './condition-core.mjs';

// Manual reconstruction of procUnitEvent/anonymous_91, bytecode
// 0xf0000005e900: 3679..6995 and 33085..40155. No recovered JS is run.
export const COMMON_UNIT_EVENT_TYPES = Object.freeze([
  'CONDITION_CHAR_USE_EGO_SKILL','CONDITION_COMBATANT_EGO_SKILL_USED',
  'CONDITION_TURN_COUNT_DECREASE','CONDITION_TURN_COUNT_INCREASE',
  'CONDITION_MONSTER_HIT_SAMETIME','CONDITION_ALL_MONSTER_TURN_COUNT',
  'CONDITION_ANY_MONSTER_TURN_COUNT','CONDITION_MONSTER_NOTICE_ATTACK',
  'CONDITION_STACK_VALUE_COMPARE','CONDITION_CREDIT_CHANGE','CONDITION_STAGE_PARAM',
  'CONDITION_STAGE_PARAM_SET','CONDITION_SPOT_EIDOLON_CLEAR',
  'CONDITION_CHAR_VIABILITY','CONDITION_CHAR_INJURY','CONDITION_CHAR_TAKE_STRESS',
  'CONDITION_CHAR_COLLAPSE','CONDITION_CHAR_LINK_CRASH','CONDITION_CHAR_PARAMETER',
  'CONDITION_CHAR_OBJECT_COMPARE','CONDITION_CHAR_HP_TURN_START','CONDITION_HP_COMP_START',
  'CONDITION_CHAR_HP_MON_REGIST_PCT','CONDITION_CHAR_TAKE_DMG_MAX_HP_PCT',
  'CONDITION_CHAR_TAKE_DMG_MAX_HP_PCT_TURN','CONDITION_CHAR_ENERGY','CONDITION_EP_AMOUNT',
  'CONDITION_ENERGY_AMOUNT_SET','CONDITION_CHAR_EARN_ENERGY','CONDITION_CHAR_USE_ENERGY',
  'CONDITION_CHAR_SHIELD','CONDITION_CHAR_GET_SHIELD','CONDITION_CHAR_CURE',
  'CONDITION_CHAR_HEAL_CURE','CONDITION_MONSTER_AMOUNT','CONDITION_MONSTER_AMOUNT_SET',
  'CONDITION_CHAR_FRONT_EMPTY','CONDITION_CHAR_ID'
]);
const TYPES=new Set(COMMON_UNIT_EVENT_TYPES);
const options=f=>f.read(f.event,'unit_opt','event.unit_opt');
const includes=(f,s)=>options(f)?.includes(s)??false;
const ev=(f,k)=>f.read(f.event,k,'event.'+k);
const state=(f,m)=>f.read(m,'state','unit.state');
const unitState=(f,k)=>f.enum('UNIT_STATE',k);
const sameState=(f,m,k)=>state(f,m)==unitState(f,k);
const setOnOff=(f,on)=>{f.result.on=!!on;f.result.off=!on;};
const transition=(f,previous,next)=>{
  f.result.on=!previous&&!!next; f.result.off=!!previous&&!next;
};
const knownMap=(f,map,key,path)=>Object.hasOwn(map,key)?map[key]:null;

// The option algorithm is local code in condition-core.mjs. Callbacks below
// retrieve reconstructed state/resources; they do not decide the predicate.
export function checkUnitRuntimeOptions(f,cardId,unitId=null,casterId=null){
  const map=(name,key)=>knownMap(f,f.read(f.battle,name,'battle.'+name),key,'battle.'+name);
  const names=['getCardRes','getCharByCharId','getCharBase','getUnitByID',
    'getContinueSkills','getCurrentShield','getTargetTypeByTargetForUI','convertEgoCommon','getEgo'];
  const hooks=Object.fromEntries(names.map(name=>[name,(...args)=>f.call(name,...args)]));
  hooks.getCard=id=>map('cardMap',id);hooks.getStack=id=>map('stackMap',id);hooks.getCS=id=>map('csMap',id);
  return checkUnitOptions({event:f.event,cardId,unitId,casterId,hooks,enums:f.enums,
    get ep(){return f.read(f.battle,'ep','battle.ep');},
    get chars(){return f.read(f.battle,'chars','battle.chars');},
    get assaultFourthChar(){return f.read(f.battle,'assault_fourth_char','battle.assault_fourth_char');}});
}

// checkCondUnitCS @0xf00000000700 and procUnitEvent/targetFilter_2
// @0xf0000005e000. The exported module slot 7 resolves to checkCondUnitCS.
export function matchesUnitRuntimeTarget(f,unit){
  const ids=ev(f,'unit_opt_cs');
  if(ids!==null){
    const skills=f.call('getContinueSkills',unit),map=f.read(f.battle,'csMap');
    if(!skills.some(id=>{const cs=knownMap(f,map,id);if(cs===null)throw new MissingConditionInput('battle.csMap['+id+']');return ids?.includes(f.read(cs,'res_id'));}))return false;
  }
  const monsters=ev(f,'unit_target_opt_monster');
  if(monsters===null)return true;
  const included=monsters.includes(f.read(unit,'res_id'));
  return ev(f,'unit_target')?.includes('not')?!included:included;
}

function countMonsters(f,setMode){
  let count=0;
  for(const m of f.call('getAllMonstersIncludingRetired')){
    if(!matchesUnitRuntimeTarget(f,m))continue;
    if(!setMode&&includes(f,'ego_field')&&f.read(m,'ego_field_value')===null)continue;
    if(includes(f,'dead')&&sameState(f,m,'death')){count++;continue;}
    if(includes(f,'live')&&f.call('isFieldMonster',m)&&!sameState(f,m,'half_death')&&!sameState(f,m,'keep_half_death')){count++;continue;}
    if(includes(f,'half_death')&&(sameState(f,m,'half_death')||sameState(f,m,'keep_half_death'))){count++;continue;}
    // This name is misleading in the shipped algorithm: truthy ego_breaked
    // increments the not_break branch. Preserve the observed condition.
    if(!setMode&&includes(f,'not_break')&&f.read(m,'ego_breaked'))count++;
  }
  return count;
}

function pushHpMark(f){
  const id=f.call('resolveCondUnitTargetId',f.read(f.row,'condition_unit_type'),f.stack);
  if(id!==-1)f.emit('pushHpMark',id,-1);
}

export function handleCommonUnitCondition(f){
  if(!TYPES.has(f.eventType))return false;
  const value=()=>ev(f,'value'),num=i=>Number(f.p(i)),monsters=()=>f.read(f.battle,'monsters','battle.monsters');
  switch(f.eventType){
    case 'CONDITION_CHAR_USE_EGO_SKILL':case 'CONDITION_COMBATANT_EGO_SKILL_USED':
    case 'CONDITION_MONSTER_NOTICE_ATTACK':case 'CONDITION_SPOT_EIDOLON_CLEAR':
    case 'CONDITION_CHAR_LINK_CRASH': f.result.on=true;break;
    case 'CONDITION_TURN_COUNT_DECREASE':case 'CONDITION_TURN_COUNT_INCREASE':{
      // Original destructuring skips params[0] and params[2].
      const cause=f.opt(1)===null?'':String(f.p(1));
      const cardOnly=includes(f,'card'),breakOnly=includes(f,'break');
      if((cardOnly||breakOnly)&&!((cardOnly&&cause==='card')||(breakOnly&&cause==='break')))break;
      f.result.on=true;f.valueTriggered=num(3);
      if(cause==='card'||cause==='break'){
        let cardId=num(4);
        const map=f.read(f.battle,'cardMap');
        if(cause==='card'&&!(cardId>0&&knownMap(f,map,cardId)))cardId=f.read(f.battle,'current_card');
        if(cardId>0&&knownMap(f,map,cardId))f.emit('setCardTriggered',ev(f,'stack_id'),cardId);
      }
      break;
    }
    case 'CONDITION_MONSTER_HIT_SAMETIME':{
      const hits=f.p(0);if(!Array.isArray(hits)||hits.length===0)break;
      const slots=(options(f)??[]).map(Number).filter(n=>!isNaN(n));if(!slots.length)break;
      let anyHit=false,all=true;
      for(const slot of slots){
        if(hits.includes(slot)){anyHit=true;continue;}
        const m=monsters().find(m=>f.read(m,'slot_idx')==slot);if(!m)continue;
        if(!['death','run','changed','prop','half_death','keep_half_death'].some(k=>sameState(f,m,k))){all=false;break;}
      }
      f.result.on=anyHit&&all;if(f.result.on)f.valueTriggered=hits.length;break;
    }
    case 'CONDITION_ALL_MONSTER_TURN_COUNT':case 'CONDITION_ANY_MONSTER_TURN_COUNT':{
      const previous=ev(f,'prev_check')??false;
      const states=['none','summoned','target_unable'].map(k=>unitState(f,k));
      const ms=monsters().filter(m=>states.includes(state(f,m)));
      const pred=m=>{let turn=f.read(m,'mon_turn')??Infinity;if(turn<0)turn=0;return f.compare(turn,value());};
      const next=f.eventType==='CONDITION_ALL_MONSTER_TURN_COUNT'?ms.every(pred):ms.some(pred);
      if(next!=previous){f.event.prev_check=next;next?f.result.on=true:f.result.off=true;}
      break;
    }
    case 'CONDITION_STACK_VALUE_COMPARE':{
      if(!f.stack)break;const nextValue=f.read(f.stack,'stack');
      const previous=f.compare(ev(f,'prev')??0,value()),next=f.compare(nextValue,value());
      f.event.prev=nextValue;transition(f,previous,next);break;
    }
    case 'CONDITION_CREDIT_CHANGE':f.result.on=f.compare(num(1),value());break;
    case 'CONDITION_STAGE_PARAM':case 'CONDITION_STAGE_PARAM_SET':{
      if(!ev(f,'unit_opt_multiple_link')?.includes(f.p(0).toString()))break;
      if(f.eventType==='CONDITION_STAGE_PARAM')f.result.on=f.compare(num(1),value());
      else{f.event.set=true;f.event.set_value=num(1);f.result.on=true;}
      break;
    }
    case 'CONDITION_CHAR_VIABILITY':case 'CONDITION_CHAR_INJURY':{
      const injury=f.eventType==='CONDITION_CHAR_INJURY',isMonster=f.call('isMonsterByID',num(0));
      const threshold=f.call(isMonster?(injury?'getCurMonsterInjuryLt':'getCurMonsterViabilityGe'):(injury?'getPlayerInjuryLt':'getPlayerViabilityGe'));
      const sign=injury?'INEQUALITY_LT':'INEQUALITY_GE';
      let previous=compareCondition(sign,num(2),threshold),next=compareCondition(sign,num(3),threshold);
      if(includes(f,'not')){previous=!previous;next=!next;}
      if(includes(f,'from_false'))transition(f,previous,next);else setOnOff(f,next);
      break;
    }
    case 'CONDITION_CHAR_TAKE_STRESS':setOnOff(f,f.compare(num(1),value()));break;
    case 'CONDITION_CHAR_COLLAPSE':{
      if(ev(f,'unit_opt_multiple_link')!==null){
        const c=f.call('getCharByCharId',num(0));if(!c)break;
        if(!ev(f,'unit_opt_multiple_link').includes(f.call('getModel',f.read(c,'res_id')).toString()))break;
      }
      if(f.opt(1)!==null)f.result.off=true;else f.result.on=true;break;
    }
    case 'CONDITION_CHAR_PARAMETER':{
      f.result.flag=false;
      if(!options(f)?.includes(f.p(1).toString()))break;
      const previous=f.compare(num(2),value()),next=f.compare(num(3),value());
      if(includes(f,'from_false'))transition(f,previous,next);else setOnOff(f,next);
      if(f.result.on&&f.read(f.battle,'current_card')>=0)f.emit('setCardTriggered',ev(f,'stack_id'),f.battle.current_card);
      break;
    }
    case 'CONDITION_CHAR_OBJECT_COMPARE':{
      if(ev(f,'unit_target')?.[0]!=='stress'||f.p(1)!=='stress')break;
      const fourth=f.read(f.battle,'assault_fourth_char'),chars=f.read(f.battle,'chars');
      const owner=(fourth===null?chars:[...chars,fourth]).find(c=>f.read(c,'id')==f.p(0));
      if(!owner)throw new Error('invalid_owner_id_at_CONDITION_CHAR_OBJECT_COMPARE:'+f.p(0));
      const stage=f.read(f.read(f.worktable,'battle_stage_worktable'),'battle_stage');
      const fourthStage=f.read(stage,'assault_fourth_char'),stageChars=f.read(stage,'chars');
      const all=fourthStage===null?stageChars:[...stageChars,fourthStage];
      const stress=c=>f.read(c,'ego_stress')??0,own=all.find(c=>f.read(c,'id')==f.read(owner,'id'));
      const ownStress=own?stress(own):0,allStress=all.map(stress);
      f.result.on=ownStress==(includes(f,'high')?Math.max(...allStress):Math.min(...allStress));break;
    }
    case 'CONDITION_CHAR_HP_TURN_START':case 'CONDITION_CHAR_HP_MON_REGIST_PCT':{
      f.result.flag=false;const ref=ev(f,'ref');if(ref!==null){f.result.on=f.compare(num(1),ref*value()/100);if(f.result.on)pushHpMark(f);}break;
    }
    case 'CONDITION_HP_COMP_START':{
      f.result.flag=false;const ref=ev(f,'ref');if(ref!==null)setOnOff(f,f.compare(num(0)-ref,value()));break;
    }
    case 'CONDITION_CHAR_TAKE_DMG_MAX_HP_PCT':case 'CONDITION_CHAR_TAKE_DMG_MAX_HP_PCT_TURN':{
      f.result.flag=false;if(includes(f,'monster_turn')&&!f.read(f.battle,'monster_seq'))break;
      const ref=ev(f,'ref');if(ref!==null){f.result.on=f.compare(num(1),ref);if(f.result.on)pushHpMark(f);}break;
    }
    case 'CONDITION_CHAR_ENERGY':{
      if(includes(f,'exclude_turn_end')&&num(1)===1)break;
      setOnOff(f,f.compare(f.read(f.battle,'energy'),value()));break;
    }
    case 'CONDITION_EP_AMOUNT':setOnOff(f,f.compare(f.read(f.battle,'ep'),value()*100));break;
    case 'CONDITION_ENERGY_AMOUNT_SET':{
      if(includes(f,'exclude_turn_end')&&num(1)===1)break;
      f.event.set=true;f.event.set_value=f.read(f.battle,'energy');f.result.on=true;break;
    }
    case 'CONDITION_CHAR_EARN_ENERGY':{
      if(includes(f,'except_turn_start')&&num(2)===1)break;
      if(includes(f,'card_or_egoskill')&&!(num(3)>0))break;
      f.result.on=f.compare(num(1),value());break;
    }
    case 'CONDITION_CHAR_USE_ENERGY':{
      const reason=f.p(2).toString(),amount=num(1),targets=ev(f,'unit_target');
      if(targets!==null&&!targets?.includes(reason.toLowerCase()))break;
      if(includes(f,'accumulate'))f.result.on=f.compare((ev(f,'prev')??0)+amount,value());
      else{if(includes(f,'set_stack_input'))f.event.stack_input=amount;f.result.on=f.compare(amount,value());}
      f.valueTriggered=amount;break;
    }
    case 'CONDITION_CHAR_SHIELD':case 'CONDITION_CHAR_GET_SHIELD':
    case 'CONDITION_CHAR_CURE':case 'CONDITION_CHAR_HEAL_CURE':{
      if(checkUnitRuntimeOptions(f,num(1))){f.valueTriggered=num(2);f.result.on=f.compare(f.valueTriggered,value());}break;
    }
    case 'CONDITION_MONSTER_AMOUNT':{
      const count=countMonsters(f,false);f.result.on=f.compare(count,value());
      f.valueTriggered=count-(ev(f,'prev')??0);f.event.prev=count;f.result.off=!f.result.on;break;
    }
    case 'CONDITION_MONSTER_AMOUNT_SET':{
      f.event.set=true;f.event.set_value=countMonsters(f,true);f.result.on=true;break;
    }
    case 'CONDITION_CHAR_FRONT_EMPTY':{
      if(!f.stack)break;const caster=f.call('getUnitByID',f.read(f.stack,'caster_id'),'condition_char_front_empty');
      const coord=f.read(caster,'slot_idx')-1;if(coord<0)break;
      const occupied=monsters().some(m=>f.read(m,'slot_idx')==coord&&!['death','run','changed'].some(k=>sameState(f,m,k)));
      setOnOff(f,!occupied);break;
    }
    case 'CONDITION_CHAR_ID':{
      const predicate=c=>f.read(c,'opacity')!==0&&(ev(f,'unit_opt_multiple_link')?.includes(String(f.read(c,'res_id')))??false);
      const fourth=f.read(f.battle,'assault_fourth_char');
      setOnOff(f,f.read(f.battle,'chars').some(predicate)||(fourth!==null&&predicate(fourth)));break;
    }
  }
  return true;
}
