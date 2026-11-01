// Handwritten reconstruction of event_system procUnitEvent listener
// bc 0xf0000005e900, offsets 16715..26777 (exclusive). No target execution.
export const CS_FIRST_EVENTS=Object.freeze([
  'CONDITION_CHAR_CS_TRIGGER','CONDITION_OWN_CHAR_CS_TRIGGER',
  'CONDITION_CHAR_GIVE_CS_ALL_EXCEPT_ICS','CONDITION_CHAR_GIVE_CS',
  'CONDITION_CHAR_TAKE_CS','CONDITION_OWN_CHAR_TAKE_CS',
  'CONDITION_CHAR_CS_TERM_VALUE_CHANGED','CONDITION_OWN_CHAR_CS_TERM_VALUE_CHANGED',
  'CONDITION_CHAR_UNIQUE_RITA_1','CONDITION_CHAR_TERM_TYPE','CONDITION_CHAR_EGO_BREAK',
  'CONDITION_MONSTER_EGO_BREAK','CONDITION_MONSTER_EGO_FIELD_AMOUNT',
]);
const types=new Set(CS_FIRST_EVENTS);
const ev=(f,key)=>f.read(f.event,key,'event.'+key);
const has=(f,opt)=>ev(f,'unit_opt')?.includes(opt)??false;
const num=(f,index)=>Number(f.p(index));
const entry=(f,map,key)=>{const values=f.read(f.battle,map,'battle.'+map);return Object.hasOwn(values,key)?values[key]:null;};
const byCS=(f)=>ev(f,'unit_opt_cs')?.includes(String(f.p(1)))??false;
const isBaseDebuff=type=>type==='CS_DEBUFF'||type==='CS_DEBUFF_DOT'; // continue_skill/baseDebuffType bc0x6a00.
const sign=(f,value,inverted=false)=>(has(f,'positive')&&(inverted?value<0:value>0))||(has(f,'negative')&&(inverted?value>0:value<0));
const setTargets=(f,ids)=>f.emit('setTargetTriggered',ev(f,'stack_id'),ids);
const targetCardType=(f,card)=>f.call('getTargetTypeByTargetForUI',f.read(f.call('getCardRes',f.read(card,'res_id')),'target_for_ui'));

function passCardType(f,type){
  if(has(f,'target_card')&&type!=f.enum('BATTLE_CARD_TARGET','TARGET_MONSTER'))return false;
  if(has(f,'non_target_card')&&type!=f.enum('BATTLE_CARD_TARGET','TARGET_NOTHING'))return false;
  return true;
}
function triggerCS(f){
  // +16715: debuff_dot takes priority over explicit unit_opt_cs.
  if(has(f,'debuff_dot')){const info=f.call('getCSRes',f.p(1));f.result.on=info===null?false:f.read(info,'cs_buff_type')==f.enum('CS_BUFF_TYPE','CS_DEBUFF_DOT');}
  else f.result.on=byCS(f);
  if(f.result.on&&(has(f,'by_owner_eff')||has(f,'by_char_eff'))){
    const id=num(f,2),skill=entry(f,'skillMap',id);
    if(skill===null)f.result.on=false;
    else{
      if(has(f,'by_owner_eff')&&(f.stack===null||f.read(skill,'action_char_id')!=f.read(f.stack,'caster_id')))f.result.on=false;
      if(f.result.on&&has(f,'by_char_eff')){
        if(f.call('isMonsterByID',f.read(skill,'action_char_id')))f.result.on=false;
        else{
          const parent=f.call('getRootParent',id);
          if(parent!==null&&f.read(parent,'type')==f.enum('SkillParentType','CS')){
            const cs=entry(f,'csMap',f.read(parent,'id'));
            if(cs!==null&&f.read(cs,'origin')){
              const excluded=['BATTLE_START_CS','FATE','DEBUFF','MONSTER','SINGULARITY','LIMIT_BREAK','CS_STAGE','STAGE_CS','NB_EFF'].map(key=>f.enum('CS_ORIGIN',key));
              if(excluded.includes(cs.origin))f.result.on=false;
            }
          }
        }
      }
    }
  }
  if(f.result.on&&(has(f,'card')||has(f,'target_card')||has(f,'non_target_card'))){
    const card=f.call('getParentCard',num(f,2));
    if(card===null||f.read(card,'ep_skill'))f.result.on=false;
    else if((has(f,'target_card')||has(f,'non_target_card'))&&!passCardType(f,targetCardType(f,card)))f.result.on=false;
  }
  if(f.result.on)setTargets(f,f.params.slice(3).map(Number));
}

// GIVE and TAKE share category/sign rules but execute category assignments in
// sequence. A mixed BUFF_DEBUFF debuff check can overwrite a prior buff result.
function matchChangedCategory(f,includeDot){
  const value=num(f,2),buff=has(f,'buff'),debuff=has(f,'debuff'),dot=includeDot&&has(f,'debuff_dot');
  if(buff||debuff||dot){
    const info=f.call('getCSRes',f.p(1)),type=f.read(info,'cs_buff_type');
    if(buff&&(type==f.enum('CS_BUFF_TYPE','CS_BUFF')||type==f.enum('CS_BUFF_TYPE','CS_BUFF_DEBUFF')))f.result.on=sign(f,value);
    if(debuff){
      if(isBaseDebuff(type))f.result.on=sign(f,value);
      else if(type==f.enum('CS_BUFF_TYPE','CS_BUFF_DEBUFF'))f.result.on=sign(f,value,true);
    }
    if(dot&&type==f.enum('CS_BUFF_TYPE','CS_DEBUFF_DOT'))f.result.on=sign(f,value);
  }else if(sign(f,value))f.result.on=byCS(f);
}

function giveCS(f){
  // +19290: both units are looked up before any source-card option gate.
  const giver=f.call('getUnitByID',num(f,0),'CONDITION_CHAR_GIVE_CS'),receiver=f.call('getUnitByID',num(f,3),'CONDITION_CHAR_GIVE_CS');
  if(['card','card_or_egoskill','target_card','non_target_card'].some(opt=>has(f,opt))){
    const parent=f.call('getRootParent',f.p(5));
    if(parent===null||f.read(parent,'type')!=f.enum('SkillParentType','CARD'))return;
    const card=entry(f,'cardMap',f.read(parent,'id'));if(card===null)return;
    if(f.read(card,'ep_skill')&&!has(f,'card_or_egoskill'))return;
    if((has(f,'target_card')||has(f,'non_target_card'))&&!passCardType(f,targetCardType(f,card)))return;
  }
  if(!(has(f,'own_char_only')&&f.p(0)==f.p(4))&&f.read(giver,'id')==f.read(receiver,'id'))return;
  matchChangedCategory(f,true);
  if(f.result.on){setTargets(f,[num(f,3)]);f.valueTriggered=num(f,2);}
}

function takeCS(f){
  if(f.eventType==='CONDITION_OWN_CHAR_TAKE_CS'&&(f.stack===null||f.read(f.stack,'caster_id')!=f.p(0)))return;
  // +22814 deliberately checks the immediate skill parent, not getRootParent.
  if(has(f,'card')){
    const skill=entry(f,'skillMap',f.p(5));if(skill===null)return;
    const parent=f.read(skill,'parent');if(f.read(parent,'type')!=f.enum('SkillParentType','CARD'))return;
    const card=entry(f,'cardMap',f.read(parent,'id'));if(card===null||f.read(card,'ep_skill'))return;
  }
  if(has(f,'own_char')&&(f.stack===null||f.read(f.stack,'caster_id')!=f.p(3)))return;
  matchChangedCategory(f,false); // TAKE has no dedicated debuff_dot category gate.
  if(f.result.on){setTargets(f,[num(f,3)]);f.valueTriggered=num(f,2);}
}

export function handleCSFirstRuntime(f){
  if(!types.has(f.eventType))return false;
  switch(f.eventType){
    case 'CONDITION_CHAR_CS_TRIGGER':triggerCS(f);break;
    case 'CONDITION_OWN_CHAR_CS_TRIGGER':
      if(f.stack!==null&&f.read(f.stack,'caster_id')==f.p(0)){f.result.on=byCS(f);if(f.result.on)setTargets(f,f.params.slice(2).map(Number));}break;
    case 'CONDITION_CHAR_GIVE_CS_ALL_EXCEPT_ICS':case 'CONDITION_CHAR_GIVE_CS':giveCS(f);break;
    case 'CONDITION_CHAR_TAKE_CS':case 'CONDITION_OWN_CHAR_TAKE_CS':takeCS(f);break;
    case 'CONDITION_CHAR_CS_TERM_VALUE_CHANGED':case 'CONDITION_OWN_CHAR_CS_TERM_VALUE_CHANGED':case 'CONDITION_CHAR_UNIQUE_RITA_1': {
      if(f.eventType==='CONDITION_OWN_CHAR_CS_TERM_VALUE_CHANGED'&&(f.stack===null||f.read(f.stack,'caster_id')!=f.p(2)))break;
      if(has(f,'own_char')&&(f.stack===null||f.read(f.stack,'caster_id')!=f.p(2)))break;
      // Reads original procUnitEvent value, not the mutable valueTriggered.
      const value=f.read(f,'value','runtime.original value')??0;
      if(has(f,'positive')&&value<=0)break;
      if(has(f,'negative')&&value>=0)break;
      f.result.on=byCS(f);if(f.result.on)f.valueTriggered=Math.abs(value);break;
    }
    case 'CONDITION_CHAR_TERM_TYPE':f.result.on=byCS(f);break;
    case 'CONDITION_CHAR_EGO_BREAK': {
      f.result.on=true;
      f.emit('setCardTriggered',ev(f,'stack_id'),num(f,1));
      setTargets(f,[num(f,2)]);
      const target=f.call('getUnitByID',num(f,2),'CONDITION_CHAR_EGO_BREAK');f.valueTriggered=f.read(target,'ego_field_max_value')??0;break;
    }
    case 'CONDITION_MONSTER_EGO_BREAK':f.result.on=true;break;
    case 'CONDITION_MONSTER_EGO_FIELD_AMOUNT':f.valueTriggered=num(f,1);f.result.on=f.compare(f.valueTriggered,ev(f,'value'));f.result.off=!f.result.on;break;
  }
  return true;
}
