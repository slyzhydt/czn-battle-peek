/** Handwritten procUnitEvent/anonymous_91 damage event rules, bc 0x5e900.
 * Original main offsets 6999..16705; never evaluates the decompiled program.
 * Query methods come from the reconstructed worktable; notifications are explicit.
 */
import {MissingConditionInput} from '../conditions/condition-core.mjs';
import {checkUnitRuntimeOptions,matchesUnitRuntimeTarget} from '../conditions/unit-common-conditions.mjs';

export const DAMAGE_UNIT_EVENT_TYPES = Object.freeze([
 'CONDITION_CRITICAL','CONDITION_CHAR_ATK','CONDITION_CHAR_ATK_COUNT','CONDITION_CHAR_ALL_ATK','CONDITION_CHAR_ATK_AUTO',
 'CONDITION_CHAR_DMG','CONDITION_CHAR_IGNORE_COND_DMG','CONDITION_CHAR_IGNORE_COND_DMG_VALUE','CONDITION_CHAR_DMG_ACCRUE',
 'CONDITION_SHIELD_DESTROY','CONDITION_CHAR_DMG_BREAK_SHIELD','CONDITION_CHAR_CUR_HP_CHANGE',
 'CONDITION_CHAR_NO_DMG','CONDITION_CHAR_GIVE_NO_DMG','CONDITION_CHAR_TAKE_DMG','CONDITION_CHAR_IGNORE_COND_TAKE_DMG',
 'CONDITION_DMG_ATTR_DOT','CONDITION_CHAR_HIT','CONDITION_CHAR_HIT_EXCEPT_FIX','CONDITION_CHAR_HIT_NOT_MISS',
 'CONDITION_CHAR_HIT_SHIELD','CONDITION_CHAR_DEAD','CONDITION_CHAR_KILL','CONDITION_CHAR_OVERKILL','CONDITION_CHAR_KILL_MONSTER',
]);
const types=new Set(DAMAGE_UNIT_EVENT_TYPES);
const ev=(f,key)=>f.read(f.event,key,'event.'+key);
const options=f=>ev(f,'unit_opt');
const includes=(f,value)=>options(f)?.includes(value)??false;
const lookup=(map,key)=>Object.hasOwn(map,key)?map[key]:null;
const stackId=f=>ev(f,'stack_id');
const abort=f=>{f.aborted=true;f.result.on=false;f.result.off=false;return true;};

// EventSystemClass.checkDmgAttrOpts bc 0x57f00, anonymous_85 bc 0x58700.
export function checkDamageAttributeOptions(required,actual) {
 if(!Array.isArray(required))throw new MissingConditionInput('dmg_attr_opts');
 if(required.length===0)return true;
 if(!Array.isArray(actual))throw new MissingConditionInput('damage attrs event payload');
 return required.every(option=>actual.includes(option.toUpperCase()));
}
const attrs=(f,index)=>{
 const required=ev(f,'dmg_attr_opts');
 return required===null||checkDamageAttributeOptions(required,f.p(index));
};
const target=(f,index)=>f.emit('setTargetTriggered',stackId(f),[Number(f.p(index))]);
const checkEgo=(f,cardId)=>{
 const wanted=ev(f,'unit_opt_ego_type');
 if(wanted===null)return true;
 const card=lookup(f.read(f.battle,'cardMap'),cardId);
 return card!==null&&f.call('checkEgo',f.read(card,'id'),wanted);
};

function exceptOwnCS(f) {
 // anonymous_98 bc0x63700 keeps parent order and root lookups inside .some().
 if(!includes(f,'except_own_cs'))return false;
 const cause=f.call('getRootParent',Number(f.p(6)));
 if(cause===null||f.read(cause,'type')!=='CS')return false;
 const map=f.read(f.battle,'csMap'),causeCS=lookup(map,f.read(cause,'id'));
 const parents=lookup(f.read(f.battle,'stackParentMap'),stackId(f))??[];
 if(causeCS===null)return false;
 return parents.some(parent=>{
  if(f.read(parent,'from')!==f.enum('STACK_FROM','SKILL'))return false;
  const root=f.call('getRootParent',f.read(parent,'parent_id'));
  if(root===null||f.read(root,'type')!=='CS')return false;
  const cs=lookup(map,f.read(root,'id'));
  return (cs===null?null:f.read(cs,'res_id'))===f.read(causeCS,'res_id');
 });
}

function pushHPMark(f) {
 const kind=f.read(f.row,'condition_unit_type');
 if(kind!=='CONDITION_UNIT_CASTER'&&kind!=='CONDITION_UNIT_OWNER')return false;
 const id=f.stack===null?-1:(f.read(f.stack,kind==='CONDITION_UNIT_CASTER'?'caster_id':'owner_id')??-1);
 if(id===-1||!f.call('isMonsterByID',id))return null;
 const old=Number(f.read(f.battle,'last_action_id'));
 f.battle.last_action_id=old+1;
 f.emit('pushAction',{id:old,type:f.enum('BATTLE_ACTION_TYPE','action_monster_hpmark'),source_id:id,hp:-1});
 return true;
}

export function handleDamageUnitEvent(f) {
 if(!types.has(f.eventType))return false;
 const num=index=>Number(f.p(index));
 switch(f.eventType) {
  case 'CONDITION_CRITICAL':
   f.result.on=!!checkUnitRuntimeOptions(f,f.p(1),f.p(3));
   if(f.result.on)target(f,3);
   break;
  case 'CONDITION_CHAR_ATK':case 'CONDITION_CHAR_ATK_COUNT':case 'CONDITION_CHAR_ATK_AUTO': {
   if(!attrs(f,5))break;
   if(f.eventType==='CONDITION_CHAR_ATK_AUTO'){
    if(includes(f,'not_dmg_attr_additional_attack')&&f.p(5)?.includes(f.enum('DMG_ATTR','DMG_ATTR_ADDITIONAL_ATTACK')))break;
    if(includes(f,'atk_auto_once')){
     const action=f.read(f.battle,'current_card_use_action');
     if(action){
      let ids=f.read(action,'atk_auto_triggered_stacks');
      if(ids===null){ids=[];action.atk_auto_triggered_stacks=ids;}
      if(ids.includes(stackId(f)))break;
      ids.push(stackId(f)); // Before targetFilter/unit options, even when those reject.
     }
    }
   }
   const unit=f.call('getUnitByID',num(3),f.eventType);
   if(!matchesUnitRuntimeTarget(f,unit))break;
   f.valueTriggered=num(4);
   f.result.on=!!checkUnitRuntimeOptions(f,num(1),num(3),num(0));
   if(f.result.on&&f.eventType==='CONDITION_CHAR_ATK_COUNT')f.result.on=!!f.compare(f.valueTriggered,ev(f,'value'));
   if(f.result.on)target(f,3);
   break;
  }
  case 'CONDITION_CHAR_ALL_ATK':
   f.result.on=!!checkUnitRuntimeOptions(f,num(1),null,num(0));break;
  case 'CONDITION_CHAR_DMG':case 'CONDITION_CHAR_IGNORE_COND_DMG':case 'CONDITION_CHAR_IGNORE_COND_DMG_VALUE':
   if(exceptOwnCS(f))break;
   if(!checkUnitRuntimeOptions(f,num(1))||!attrs(f,5))break;
   f.valueTriggered=num(2);
   f.result.on=!!f.compare(num(2),ev(f,'value'));
   break;
  case 'CONDITION_CHAR_DMG_ACCRUE': {
   if(!checkUnitRuntimeOptions(f,num(1)))break;
   if(!checkEgo(f,num(1))||!attrs(f,5))break;
   const amount=num(2);
   if(f.stack!==null){
    f.stack.value_accrue=(f.read(f.stack,'value_accrue')??0)+amount;
    f.valueTriggered=f.read(f.stack,'value_accrue');
    f.result.on=!!f.compare(f.read(f.stack,'value_accrue'),ev(f,'value'));
   }
   break;
  }
  case 'CONDITION_SHIELD_DESTROY':case 'CONDITION_CHAR_DMG_BREAK_SHIELD':
   if(checkUnitRuntimeOptions(f,num(1))){
    f.result.on=!!f.compare(num(2),ev(f,'value'));
    if(f.result.on)target(f,3);
   }
   break;
  case 'CONDITION_CHAR_CUR_HP_CHANGE': {
   const change=num(2);
   if(!(includes(f,'dmg')&&change<0)&&!(includes(f,'heal')&&change>0))return abort(f);
   f.valueTriggered=Math.abs(change);
   if(!options(f)?.includes(f.p(1).toString()))break;
   f.result.on=!!f.compare(f.valueTriggered,ev(f,'value'));
   if(f.result.on&&includes(f,'cur_hp_pct')&&includes(f,'dmg')&&ev(f,'value')>0&&
    (f.ineq==='INEQUALITY_GE'||f.ineq==='INEQUALITY_GT')){
    if(pushHPMark(f)===null)return abort(f);
   }
   break;
  }
  case 'CONDITION_CHAR_NO_DMG':case 'CONDITION_CHAR_GIVE_NO_DMG':
   if(checkUnitRuntimeOptions(f,num(1)))f.result.on=true;
   break;
  case 'CONDITION_CHAR_TAKE_DMG':case 'CONDITION_CHAR_IGNORE_COND_TAKE_DMG': {
   if(!checkUnitRuntimeOptions(f,num(1))||!attrs(f,6))break;
   const amount=num(2);
   f.result.on=!!f.compare(amount,ev(f,'value'));
   f.valueTriggered=amount; // Recorded even when comparison is false.
   if(f.result.on)target(f,4);
   break;
  }
  case 'CONDITION_DMG_ATTR_DOT':
   if(checkUnitRuntimeOptions(f,num(1),num(0))&&attrs(f,6))f.result.on=true;
   break;
  case 'CONDITION_CHAR_HIT':case 'CONDITION_CHAR_HIT_EXCEPT_FIX':
   if(!checkUnitRuntimeOptions(f,num(1),num(0))||!checkEgo(f,num(1)))return abort(f);
   f.result.on=true;f.valueTriggered=num(3);
   f.emit('setCardTriggered',stackId(f),num(1));
   break;
  case 'CONDITION_CHAR_HIT_NOT_MISS':
   f.result.on=true;f.valueTriggered=num(3);break;
  case 'CONDITION_CHAR_HIT_SHIELD': {
   if(!checkUnitRuntimeOptions(f,num(1),num(0)))return abort(f);
   const amount=num(5);
   if(amount>0){f.result.on=true;f.valueTriggered=amount;}
   break;
  }
  case 'CONDITION_CHAR_DEAD':
   f.result.on=options(f)===null||includes(f,'all')||!!options(f)?.includes(f.p(1).toString());
   break;
  case 'CONDITION_CHAR_KILL': {
   const unit=f.call('getUnitByID',num(3),'CONDITION_CHAR_KILL');
   if(!matchesUnitRuntimeTarget(f,unit))return abort(f);
   f.result.on=(includes(f,'half_death')||f.p(6)==0)&&(includes(f,'creature')||f.p(7)==-1)&&
    !!checkUnitRuntimeOptions(f,num(1),num(3));
   if(f.result.on)target(f,3);
   break;
  }
  case 'CONDITION_CHAR_OVERKILL':
   f.valueTriggered=num(4)-num(2);f.result.on=f.valueTriggered>0;break;
  case 'CONDITION_CHAR_KILL_MONSTER': {
   f.result.on=true;
   const links=ev(f,'unit_opt_multiple_link');
   if(links!==null&&links.length>0){
    const cardId=f.p(2);
    if(cardId===null)return abort(f);
    const card=lookup(f.read(f.battle,'cardMap'),cardId);
    if(card===null||!links.includes(f.read(card,'res_id')))return abort(f);
   }
   if(includes(f,'eidolon')){
    const cardId=f.p(2);
    if(cardId===null)return abort(f);
    const card=lookup(f.read(f.battle,'cardMap'),cardId);
    if(card===null)return abort(f);
    const row=f.call('getCardRes',f.read(card,'res_id'));
    if(row===null||f.read(row,'sort')!=='SORT_EIDOLON')return abort(f);
   }
   const wanted=ev(f,'unit_target');
   if(wanted){
    const unit=f.call('getUnitByID',num(1),'CONDITION_CHAR_KILL_MONSTER');
    const monster=f.call('getMonsterRes',f.read(unit,'res_id'));
    if(monster){
     const species=f.call('getSpecies',f.read(monster,'link_species_id'));
     if(!species)throw new MissingConditionInput('err:species_not_found:'+f.read(monster,'link_species_id'));
     f.result.on=wanted.includes(f.read(species,'link_faction_id'));
    }
   }
   const ids=ev(f,'unit_target_opt_monster');
   if(ids&&ids.length>0){
    const unit=f.call('getUnitByID',num(1),'CONDITION_CHAR_KILL_MONSTER');
    f.result.on=f.result.on&&ids.includes(f.read(unit,'res_id'));
   }
   if(includes(f,'all_attack')&&f.p(3)!=true)return abort(f);
   break;
  }
 }
 return true;
}
