// Independent offline reconstruction, never executing target bytecode.
// Covers comparison, check-map composition and stack predicates. Mutating event
// registration/dispatch and procStack/procUse/procReset are separate boundaries.
export class MissingConditionInput extends Error {
  constructor(path) { super('missing_condition_input:' + path); this.name = 'MissingConditionInput'; this.path = path; }
}
export function need(object, key, path = key) {
  if (object == null || !Object.hasOwn(object, key) || object[key] === undefined)
    throw new MissingConditionInput(path);
  return object[key];
}
function known(value, path) { if (value === undefined) throw new MissingConditionInput(path); return value; }
export function compareCondition(sign, left, right, onDiagnostic = () => {}) {
  if (typeof sign !== 'string') throw new MissingConditionInput('comparison.sign');
  if (sign === 'INEQUALITY_NONE') return true;
  known(left,'comparison.left'); known(right,'comparison.right');
  switch (sign) {
    case 'INEQUALITY_EQ': return left == right;
    case 'INEQUALITY_NE': return left != right;
    case 'INEQUALITY_LT': return left < right;
    case 'INEQUALITY_LE': return left <= right;
    case 'INEQUALITY_GT': return left > right;
    case 'INEQUALITY_GE': return left >= right;
  }
  if (sign.includes('RANGE')) {
    // Preserve the recovered RegExp source (empty parentheses), not an invented
    // "fix" which strips every opening/closing parenthesis.
    const values = sign.replace('RANGE','').replace(/\(\)/gi,'').split('~');
    if (values.length !== 2) { onDiagnostic('wrong_inequality_sign:range'); return left == right; }
    return left >= Number(values[0]) && left <= Number(values[1]);
  }
  throw new RangeError('wrong_inequality_sign:' + sign);
}
export const TRIGGER = Object.freeze({STACK:0, USE:1, RESET:2, REMOVE:3});
export const ANDOR = Object.freeze({AND:0, OR:1, OR_TIMING:2});
export const TIMING = Object.freeze({NONE:0, OTHERS:1});

// check_map=null and and_or entries=null represent *known absence*; an omitted
// container is unknown and rejected. This distinguishes a partial capture from
// an actual complete game's map containing no matching stack.
export function checkCondMap(stack, trigger) {
  if (stack === null) return false;
  const andOr = need(stack,'and_or','stack.and_or');
  const mode = andOr == null ? undefined : andOr[trigger];
  if (mode == ANDOR.OR_TIMING) return true;
  const maps = need(stack,'check_map','stack.check_map');
  const map = maps == null ? undefined : maps[trigger];
  if (!map) return mode == ANDOR.AND;
  if (mode == ANDOR.AND) {
    for (const group of ['condunit','condcard','condtiming']) {
      const entries = need(map,group,'check_map.'+group);
      if (entries == null) continue;
      for (const key in entries) {
        const pair = entries[key];
        if (!Array.isArray(pair) || !Object.hasOwn(pair,0) || pair[0] === undefined)
          throw new MissingConditionInput(group+'.'+key+'.value');
        if (!pair[0]) return false;
        if (pair.length > 1) {
          known(pair[1],group+'.'+key+'.threshold');
          if (pair[0] < pair[1]) return false;
        }
      }
    }
    return true;
  }
  for (const group of ['condunit','condcard','condtiming']) {
    const entries = need(map,group,'check_map.'+group);
    if (entries == null) continue;
    for (const key in entries) {
      const pair=entries[key];
      if (!Array.isArray(pair) || !Object.hasOwn(pair,0) || pair[0] === undefined)
        throw new MissingConditionInput(group+'.'+key+'.value');
      if (pair.length < 2 && pair[0]) return true;
      if (pair.length > 1) {
        known(pair[1],group+'.'+key+'.threshold');
        if (pair[0] >= pair[1]) return true;
      }
    }
  }
  return false;
}
export function checkStack(stack, condition) {
  if (stack === null) return false;
  if (need(stack,'inactive','stack.inactive')) return false;
  const type=need(condition,'stack_type','condition.stack_type');
  if (type == 'STACK_NONE') return checkCondMap(stack,TRIGGER.STACK);
  return compareCondition(need(condition,'stack_value_ineq'),need(stack,'stack'),need(stack,'stack_value'));
}
export function isTriggered(stack, condition, currentState) {
  if (stack === null) return false;
  if (need(stack,'inactive','stack.inactive')) return false;
  const types=need(stack,'timingType','stack.timingType');
  const maps=need(stack,'timingMap','stack.timingMap');
  const type=types?.[TRIGGER.USE], map=maps?.[TRIGGER.USE];
  if (type == TIMING.OTHERS) {
    known(currentState,'currentState');
    if (!map?.includes(currentState)) return false;
  }
  const stackType=need(condition,'stack_type','condition.stack_type');
  if (['STACK_DEDUCTION_CYCLE_NON_RESET','STACK_DEDUCTION_PER_STACK_NON_RESET'].includes(stackType))
    return need(stack,'stack') == 0;
  if (['STACK_COMPARE','STACK_DEDUCTION_COMPARE'].includes(stackType))
    return compareCondition(need(condition,'stack_value_ineq'),need(stack,'stack'),need(stack,'stack_value'));
  return false;
}

// Numerical clamping only; notifications from setStack must be replayed by an
// integrated event engine and are deliberately not represented as no-ops here.
export function clampStackValue(stack, condition, proposed) {
  known(proposed,'proposedStack');
  const type=need(condition,'stack_type');
  if (['STACK_CHARGE','STACK_COUNT','STACK_COUNT_RESET_COND_ONLY'].includes(type)) {
    const ceiling=need(stack,'stack_value');
    if (ceiling > -1) return Math.min(proposed,ceiling);
  }
  return proposed;
}

export function hasCardTalentCondition(card, talent, place, hooks, talentEnum) {
  const connect=need(talentEnum,'TALENT_CONNECT','enums.talent.TALENT_CONNECT');
  const invoke=(name,...args)=>{if(typeof hooks[name]!=='function')throw new MissingConditionInput('hook.'+name);return known(hooks[name](...args),'hook.'+name+'.result');};
  const id=need(card,'id');
  if(talent==connect){
    if(invoke('isCardUninteractible',id))return false;
    const talents=need(card,'talents');
    return !!(talents?.includes(connect)||talents?.includes(need(talentEnum,'TALENT_CONNECT_INFINITE'))||need(card,'connect_passive'));
  }
  return invoke('hasTalent',id,talent,{place});
}

// checkCondCard/check closure (event_system 0xf00000010d00/0xf00000011900).
// Event inputs must be the normalized event instance created by registCardEvent,
// not an unconverted raw DB row. Dependencies are exact named external calls.
export function checkCardCondition(input) {
  const {event,card,cardRes,hooks={},enums={}}=input;
  if (card === null) return false;
  known(card,'card'); known(event,'event');
  const read=(o,k,p=k)=>need(o,k,p);
  const e=k=>read(event,k,'event.'+k), c=k=>read(card,k,'card.'+k), r=k=>read(cardRes,k,'cardRes.'+k);
  const arr=k=>{const v=e(k);if(v!==null&&!Array.isArray(v))throw new TypeError('event array required:'+k);return v;};
  const opts=arr('card_opt') ?? [];
  const has=k=>opts.includes(k), ck=()=>need(input,'checkKnown');
  const call=(name,...args)=>{
    if(typeof hooks[name]!=='function') throw new MissingConditionInput('hook.'+name);
    return known(hooks[name](...args),'hook.'+name+'.result');
  };
  const enumValue=(group,name)=>read(read(enums,group,'enums.'+group),name,'enums.'+group+'.'+name);
  const skill=()=>{ const id=need(input,'skillId');return id===null?null:call('getSkill',id); };
  const run=()=>{
    if(has('player_turn')&&!need(input,'playerTurn'))return false;
    if(e('no_duplicate')&&(arr('duplicate_checks')??[]).includes(c('res_id')))return false;
    if(has('except_this_card')&&e('card_id')==c('id'))return false;
    const csOpts=arr('cs_check_opt');if(csOpts?.length&&!call('checkCSopts',csOpts))return false;
    const linked=arr('link_card_id');if(linked?.length){if(ck())return undefined;if(!linked.includes(r('id')))return false;}
    const excluded=arr('exclude_link_card_id');if(excluded){if(ck())return undefined;if(excluded.includes(r('id')))return false;}
    for(const [option,field] of [['get_card','get_card'],['testament','by_testament'],['ego_field_dmg_increased','ego_field_dmg_increased']]){
      if(has(option)){if(ck())return undefined;if(!c(field))return false;}
    }
    if(has('targeting')){if(ck())return undefined;if(call('getTargetTypeByTargetForUI',r('target_for_ui'))!=enumValue('battleCardTarget','TARGET_MONSTER'))return false;}
    const given=need(input,'value');
    const costResult=given!==null&&c('cost')>=0?given:c('cost_result');
    for(const [opt,predicate] of [['cost_changed',()=>costResult==c('cost')],['cost_increase',()=>costResult<=c('cost')],['cost_decrease',()=>costResult>=c('cost')]]){
      if(has(opt)){if(ck())return undefined;if(predicate())return false;}
    }
    const slots=arr('card_char_slot');if(slots?.length){if(ck())return undefined;if(!slots.includes(c('char_id')))return false;}
    if(has('card_with_this_cs')){
      if(ck())return undefined;
      const parents=need(input,'parents');let found=false;
      for(const p of parents){
        const from=read(p,'from');
        if(from==enumValue('stackFrom','CARD')){if(read(p,'parent_id')==c('id'))found=true;}
        else if(from==enumValue('stackFrom','SKILL')){
          const sk=call('getSkill',read(p,'parent_id'));
          const parent=sk===null?null:read(sk,'parent');
          if(parent?.type==enumValue('skillParent','CS')){const cs=call('getCS',read(parent,'id'));if(cs!==null&&read(cs,'isCard')&&read(cs,'owner_id')==c('id'))found=true;}
          else if(parent?.type==enumValue('skillParent','CARD')&&read(parent,'id')==c('id'))found=true;
        }else if(from==enumValue('stackFrom','MONSTER')||from==enumValue('stackFrom','MONSTER_PATTERN')){if(read(p,'parent_id')==c('caster_id'))found=true;}
      }
      if(!found)return false;
    }
    if(has('by_this_card_eff')){if(ck())return undefined;const s=skill();if(!s)return false;const p=read(s,'parent');if(read(p,'type')!=enumValue('skillParent','CARD')||read(p,'id')!=e('card_id'))return false;}
    if(has('by_owner_eff')){if(ck())return undefined;const s=skill();if(!s||read(s,'action_char_id')!=e('char_id'))return false;}
    if(has('by_char_eff')){
      if(ck())return undefined;const id=need(input,'skillId');
      if(id===null){if(!need(input,'connectDiscardCardIds').includes(c('id')))return false;}
      else{const s=skill();if(!s||call('isMonsterByID',read(s,'action_char_id')))return false;
        const parent=call('getRootParent',id);
        if(parent?.type==enumValue('skillParent','CS')){const cs=call('getCS',read(parent,'id'));
          if(cs!==null){const origin=read(cs,'origin');if(origin){const denied=['BATTLE_START_CS','FATE','DEBUFF','MONSTER','SINGULARITY','LIMIT_BREAK','CS_STAGE','STAGE_CS','NB_EFF'].map(x=>enumValue('csOrigin',x));if(denied.includes(origin))return false;}}}
      }
    }
    if(has('by_card_atk')){if(ck())return undefined;const id=need(input,'skillId');if(id===null)return false;const p=call('getParentCard',id);if(!p||!call('checkCategory',read(p,'id'),[enumValue('cardCategory','CARD_ATK')]))return false;}
    for(const opt of ['own_char','cs_owner','own_other_char','except_own_char','char_1','char_2','char_3']){
      if(!has(opt))continue;if(ck())return undefined;
      const char=c('char_id');
      if(opt==='own_char'&&e('char_id')!=char)return false;
      if(opt==='cs_owner'){const st=call('getStack',e('stack_id'));if(!st||read(st,'owner_id')!=char)return false;}
      if(opt==='own_other_char'&&(char==-1||e('char_id')==char))return false;
      if(opt==='except_own_char'&&e('char_id')==char)return false;
      if(opt.startsWith('char_')&&char!=Number(opt.slice(-1)))return false;
    }
    const categories=arr('card_type');if(categories?.length&&!categories.includes('all')){if(ck())return undefined;if(!call('checkCategory',c('id'),categories))return false;}
    const sorts=arr('card_sort');if(sorts?.length){if(ck())return undefined;const actual=call('getSort',c('id'));
      if(sorts.includes('not')){const denied=sorts.filter(x=>x!='not');if(denied.length&&actual.some(x=>denied.includes(x)))return false;}
      else if(!actual.some(x=>sorts.includes(x)))return false;
    }
    const egos=arr('card_ego_type');if(egos?.length){if(ck())return undefined;if(!call('checkEgo',c('id'),egos))return false;}
    const min=e('min_cost'),max=e('max_cost');
    if(!(min==-1&&max==999)){
      let cost=has('original_cost')?r('cost'):c('cost_result');
      if(given!==null&&(!has('original_cost')||cost<0))cost=given;
      if(cost<min||cost>max){if(ck())return undefined;return false;}
    }
    const talents=arr('card_talent');if(talents?.length){if(ck())return undefined;
      const test=t=>hasCardTalentCondition(card,t,need(input,'talentPlace'),hooks,need(enums,'talent','enums.talent'));
      if(e('card_talent_not')?talents.some(test):!talents.every(test))return false;
    }
    const amount=arr('card_amount_opt');if(amount?.includes('connect')){
      if(ck())return undefined;if(call('isCardUninteractible',c('id')))return false;
      const teamPassives=call('getConnectPassives',need(input,'leaderId'),false),targetIds=[];
      for(const passive of teamPassives){const ids=call('getTargetCards',read(passive,'skill_id'));for(const id of ids)if(!targetIds.includes(id))targetIds.push(id);}
      const ownPassives=call('getConnectPassives',c('id'),true);
      if(ownPassives.length===0&&!c('connect_passive')){
        const talentValues=c('talents')??[];
        if(!talentValues.includes(enumValue('talent','TALENT_CONNECT'))&&!talentValues.includes(enumValue('talent','TALENT_CONNECT_INFINITE'))&&!targetIds.includes(c('id')))return false;
      }
    }
    const target=arr('card_target_opt');if(target?.includes('injury')){
      const selected=need(input,'selectTarget');if(selected==-1||!call('isInjury',selected))return false;
    }
    if(has('triggered_inspiration')){if(ck())return undefined;if(c('by_turn_draw')||!call('isTriggerInspiration',c('id')))return false;}
    return true;
  };
  const result=run();if(result===undefined)return undefined;
  return e('card_opt_negate_flag')?!result:result;
}

// EventSystemClass.checkUnitOpt, 0xf00000053200. This only checks the
// normalized event's option list; it does NOT replace the main event dispatcher.
export function checkUnitOptions(input) {
  const {event,hooks={},enums={}}=input;
  const opts=need(event,'unit_opt','event.unit_opt'),csOpt=need(event,'unit_opt_cs','event.unit_opt_cs');
  if((opts===null||opts.length===0)&&csOpt===null)return true;
  const call=(name,...args)=>{if(typeof hooks[name]!=='function')throw new MissingConditionInput('hook.'+name);return known(hooks[name](...args),'hook.'+name+'.result');};
  const cardId=()=>need(input,'cardId'),unitId=()=>need(input,'unitId');
  const card=()=>{const id=cardId();return id===null?null:call('getCard',id);};
  const row=c=>call('getCardRes',need(c,'res_id'));
  const stack=()=>call('getStack',need(event,'stack_id'));
  const egoOpts=[],talentOpts=[];
  for(const opt of opts??[]){
    if(opt.startsWith('ep_')){
      if(!compareCondition('INEQUALITY_'+opt.slice(3,5).toUpperCase(),need(input,'ep'),Number(opt.slice(5))*100))return false;
      continue;
    }
    if(opt.startsWith('except_char_')){
      const model=Number(opt.slice(12)),c=card();
      if(c){const owner=call('getCharByCharId',need(c,'char_id'));if(owner){const base=call('getCharBase',need(owner,'res_id'));if(base!==null&&need(base,'model')==model)return false;}}
      const caster=need(input,'casterId');
      if(caster!==null){const chars=need(input,'chars'),fourth=need(input,'assaultFourthChar');
        const character=chars.find(x=>need(x,'id')==caster)??(fourth!==null&&need(fourth,'id')==caster?fourth:null);
        if(character!==null){const base=call('getCharBase',need(character,'res_id'));if(base!==null&&need(base,'model')==model)return false;}}
      continue;
    }
    if(opt.startsWith('turn_count_')){
      const id=unitId();if(id===null)return false;
      const unit=call('getUnitByID',id);if(unit===null)return false;
      let count=need(unit,'mon_turn');if(count===null)count=Infinity;if(count<0)count=0;
      if(!compareCondition('INEQUALITY_'+opt.slice(11,13).toUpperCase(),count,Number(opt.slice(13))))return false;
      continue;
    }
    switch(opt){
      // These branches deliberately reach the next option in this function;
      // their meaning in other event stages is outside this predicate.
      case 'all': case 'half_death': case 'creature':
      case 'not_dmg_attr_additional_attack': case 'atk_auto_once': case 'except_own_cs': continue;
      case 'card': {if(cardId()<=0)return false;const c=card();if(c===null)throw new MissingConditionInput('referenced card');if(need(c,'ep_skill'))return false;continue;}
      case 'card_or_egoskill': if(cardId()<=0)return false;continue;
      case 'from_caster': case 'from_other_caster': {
        const c=card(),s=stack();if(c===null||s===null)return false;
        const same=need(c,'caster_id')==need(s,'caster_id');if(opt==='from_caster'?!same:same)return false;continue;
      }
      case 'card_skill': case 'card_attack': {
        const c=card();if(c===null)return false;const r=row(c);
        if(need(r,'sort')==need(need(enums,'cardSort'),'SORT_COLLAPSE_SKILL'))return false;
        if(need(r,'card_category')!=(opt==='card_skill'?'CARD_SKILL':'CARD_ATK'))return false;continue;
      }
      case 'target_card': case 'non_target_card': {
        const c=card();if(c===null)return false;const r=row(c),target=call('getTargetTypeByTargetForUI',need(r,'target_for_ui'));
        if(target!=need(need(enums,'battleCardTarget'),opt==='target_card'?'TARGET_MONSTER':'TARGET_NOTHING'))return false;continue;
      }
      case 'shield': case 'not_shield': {
        const id=unitId();if(id===null)return false;const shield=call('getCurrentShield',id);
        if(opt==='shield'?shield<=0:shield>0)return false;continue;
      }
    }
    const ego=need(enums,'egoTypeString','enums.egoTypeString'),talent=need(enums,'talent','enums.talent');
    const egoKey=Object.keys(ego).filter(k=>isNaN(Number(k))).find(k=>k.toLowerCase()===opt.toLowerCase());
    const talentKey=Object.keys(talent).filter(k=>isNaN(Number(k))).find(k=>k.toLowerCase()===opt.toLowerCase());
    if(egoKey)egoOpts.push(call('convertEgoCommon',ego[egoKey]));
    else if(talentKey)talentOpts.push(talent[talentKey]);
    else throw new MissingConditionInput('unsupported_unit_opt:'+opt);
  }
  if(talentOpts.length){const c=card();if(c===null)return false;const talents=need(c,'talents');if(!talents?.some(t=>talentOpts.includes(t)))return false;}
  if(egoOpts.length&&!egoOpts.includes(call('getEgo',cardId())))return false;
  const id=unitId();
  if(csOpt!==null&&id!==null){
    const unit=call('getUnitByID',id),skills=call('getContinueSkills',unit);
    return skills.some(csId=>{const cs=call('getCS',csId);return cs!==null&&!need(cs,'removed')&&need(cs,'res_id')==csOpt;});
  }
  return true;
}

export function effectiveTermValue(cs) {
  const effective=need(cs,'effective_term_value','cs.effective_term_value');
  return effective??need(cs,'term_value','cs.term_value');
}

// Selected *registration-time* probes from registUnitEvent. These return the
// initial triggered/value_triggered fields; they do not register listeners or
// apply on-change events. Caller must already resolve CONDITION_UNIT_* owner
// selection and supply the actual getContinueSkills order for that owner.
export function probeUnitRegistration(input) {
  const {row,event,hooks={},csMap,csRows}=input;
  const type=need(row,'condition_unit'),sign=need(row,'condition_unit_value_ineq');
  const value=need(event,'value'),opts=need(event,'unit_opt'),csOpts=need(event,'unit_opt_cs');
  const call=(name,...args)=>{if(typeof hooks[name]!=='function')throw new MissingConditionInput('hook.'+name);return known(hooks[name](...args),'hook.'+name+'.result');};
  const singleSkills=()=>need(input,'ownerContinueSkillIds','resolved ownerContinueSkillIds');
  const csFor=id=>{known(csMap,'csMap');if(!Object.hasOwn(csMap,id))throw new MissingConditionInput('csMap.'+id);return csMap[id];};
  if(type==='CONDITION_CHAR_ENERGY')return {triggered:compareCondition(sign,need(input,'energy'),value),valueTriggered:null};
  if(type==='CONDITION_EP_AMOUNT')return {triggered:compareCondition(sign,need(input,'ep'),value*100),valueTriggered:null};
  if(type==='CONDITION_CHAR_PARAMETER'){
    if(need(input,'scope')!=='resolved-single')throw new MissingConditionInput('CHAR_PARAMETER resolved-single scope');
    let triggered=false;
    for(const keyword of opts??[]){if(keyword=='from_false')continue;
      triggered=compareCondition(sign,call('getParameterValueByKeyword',need(input,'resolvedUnitId'),keyword),value);}
    return {triggered,valueTriggered:null};
  }
  if(type!=='CONDITION_CHAR_CS_AMOUNT')throw new MissingConditionInput('unsupported_unit_registration_probe:'+type);
  if(!(opts??[]).includes('include_regist'))return {triggered:false,valueTriggered:null};
  if(need(input,'scope')==='all'){
    if(need(row,'condition_unit_type')!=='CONDITION_UNIT_ALL')throw new RangeError('invalid_condition_unit_type_with_UNIT_ALL');
    let amount=0;
    const units=need(input,'allResolvedContinueSkillIds');
    for(const skills of units)for(const id of skills){const cs=csFor(id);if(csOpts?.includes(need(cs,'res_id')))amount+=effectiveTermValue(cs);}
    return {triggered:compareCondition(sign,amount,value),valueTriggered:amount,eventPrev:amount};
  }
  if(need(input,'scope')!=='resolved-single')throw new MissingConditionInput('CS_AMOUNT resolved-single scope');
  const skills=singleSkills();
  if((opts??[]).includes('buff')||(opts??[]).includes('debuff')){
    // The original uses Math.max of classified term values, NOT a sum/count.
    const buff=(opts??[]).includes('buff');
    const values=skills.map(id=>{const cs=csFor(id),resId=need(cs,'res_id');
      if(csRows==null||!Object.hasOwn(csRows,resId))throw new MissingConditionInput('csRows.'+resId);
      const type=need(csRows[resId],'cs_buff_type'),term=effectiveTermValue(cs);
      if(buff){const types=need(input,'csBuffTypes');return type==need(types,'CS_BUFF')||(type==need(types,'CS_BUFF_DEBUFF')&&term>0)?term:0;}
      const types=need(input,'csBuffTypes');return call('baseDebuffType',type)||(type==need(types,'CS_BUFF_DEBUFF')&&term<0)?Math.abs(term):0;
    });
    const amount=Math.max(...values);return {triggered:compareCondition(sign,amount,value),valueTriggered:amount};
  }
  let triggered=false,valueTriggered=null;
  if(!isNaN(value))for(const resId of csOpts??[]){
    const id=skills.find(id=>{const cs=csFor(id);return cs!==null&&!need(cs,'removed')&&need(cs,'res_id')==resId;});
    // Known absence of a matching CS intentionally means zero in the game.
    const cs=id===undefined?null:csFor(id);const amount=cs===null?0:effectiveTermValue(cs);
    valueTriggered=amount;triggered=compareCondition(sign,amount,value);
  }
  return {triggered,valueTriggered};
}
