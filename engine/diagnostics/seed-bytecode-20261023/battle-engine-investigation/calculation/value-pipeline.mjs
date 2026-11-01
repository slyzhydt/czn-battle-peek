/** Handwritten orchestration of calcValue/calcCountValue and count selectors.
 * Never loads the decompiled game JavaScript. Every stateful game dependency is
 * explicit. Optional properties must be supplied as null when known absent;
 * an omitted property is treated as an unknown input, rather than zero/true.
 */
import {evaluateValueType,applyMathSign,MissingValueInput,UnsupportedValueRule} from './value-core.mjs';
import {floorGame,roundGame,valueChangeMathSign} from '../effects/effect-arithmetic.mjs';
import {skipSparkTypes} from './skip-spark-types.mjs';

const has=(value,key)=>value!=null&&Object.hasOwn(value,key);
const field=(value,key)=>{
  if (!has(value,key)||value[key]===undefined) throw new MissingValueInput(`Missing pipeline input: ${key}`);
  return value[key];
};
const invoke=(env,name,...args)=>{
  const fn=field(env,name);
  if (typeof fn!=='function') throw new MissingValueInput(`Missing pipeline callback: ${name}`);
  const result=fn(...args);
  if (result===undefined) throw new MissingValueInput(`Unknown pipeline callback result: ${name}`);
  return result;
};
const notify=(env,name,...args)=>{
  const fn=field(env,name);
  if (typeof fn!=='function') throw new MissingValueInput(`Missing pipeline callback: ${name}`);
  fn(...args);
};
const preprocessedEffects=new Set(['SKILL_EFF_DMG','SKILL_EFF_EXTRA_DMG','SKILL_EFF_DMG_IGNORE_COND',
 'SKILL_EFF_SHIELD','SKILL_EFF_EXTRA_SHIELD','SKILL_EFF_SHIELD_IGNORE_COND','SKILL_EFF_CURE','SKILL_EFF_CURE_IGNORE_COND']);
const absoluteValueTypes=new Set(['VALUE_BEFORE_EFF_APPLIED_VALUE','VALUE_BEFORE_EFF_APPLIED_VALUE_EQ0_SET0',
 'VALUE_BEFORE_EFF_APPLIED_VALUE_MULTIPLY_PCT','VALUE_USER_HP_PCT','VALUE_LOST_HP_PCT','VALUE_CHAR_HP_MAX_PCT',
 'VALUE_CASTER_LOSE_HP_MAX_ADD','VALUE_CASTER_LOSE_HP_MAX_MULTIPLY_PCT','VALUE_CUR_SHIELD_PER_HUND',
 'VALUE_CASTER_HP_PCT','VALUE_CASTER_HP_MAX_PCT','VALUE_TARGET_HP_MAX_PCT','VALUE_MONSTER_HP_MAX_PCT',
 'VALUE_STAGE_HP_MAX_PCT','VALUE_CASTER_CUR_HP_PROPORTION_MULTIPLY','VALUE_CASTER_HAVE_HP_ADD']);
// Actual continue_skill.js enums: category 0..5 and operation 0..4.
const categoryNames=['VALUE_CATEGORY_NONE','VALUE_CATEGORY_EFF_VALUE','VALUE_CATEGORY_EFF_CARD_TARGET_COUNT',
 'VALUE_CATEGORY_EFF_COUNT_VALUE','VALUE_CATEGORY_EFF_CONDITION_VALUE_0','VALUE_CATEGORY_EFF_CONDITION_VALUE_1'];
const operationNames=['OPERATION_NONE','OPERATION_TERM_VALUE_MULTIPLE','OPERATION_TERM_VALUE_MULTIPLE_BEFORE_ROUND',
 'OPERATION_TERM_VALUE_ADD','OPERATION_TERM_VALUE_SET'];
const category=skill=>{const value=field(skill,'cs_value_category');return typeof value==='number'?categoryNames[value]??value:value;};
const operation=skill=>{const value=field(skill,'cs_operation_rule');return typeof value==='number'?operationNames[value]??value:value;};
const termOperation=(value,term,operation,round)=>{
  if (operation==='OPERATION_NONE') return round(value);
  if (operation==='OPERATION_TERM_VALUE_ADD') return round(value)+term;
  if (operation==='OPERATION_TERM_VALUE_MULTIPLE') return round(value)*term;
  if (operation==='OPERATION_TERM_VALUE_SET') {round(value);return term;}
  if (operation==='OPERATION_TERM_VALUE_MULTIPLE_BEFORE_ROUND') return round(value*term);
  return value; // Explicit original switch fallthrough, not an unknown state default.
};
const coefficientTerm=(value,term,operation)=>{
  if (operation==='OPERATION_TERM_VALUE_ADD') return value+term;
  if (operation==='OPERATION_TERM_VALUE_MULTIPLE'||operation==='OPERATION_TERM_VALUE_MULTIPLE_BEFORE_ROUND') return value*term;
  if (operation==='OPERATION_TERM_VALUE_SET') return term;
  return value;
};

export function createValueCalculator(env) {
  const battle=()=>field(env,'battle');
  const resource=(table,id)=>invoke(env,'getResource',table,id);
  const getSkill=id=>{
    const result=invoke(env,'getSkill',id);
    if (!result) throw new MissingValueInput(`Missing skill instance ${id}`);
    return result;
  };
  const array=value=>{
    const result=Array.isArray(value)?value:invoke(env,'decodeArray',value);
    if (!Array.isArray(result)) throw new MissingValueInput('decodeArray did not return an array');
    return result;
  };
  const mapLookup=(key,id)=>field(battle(),key)[id]??null;
  const parent=skillId=>invoke(env,'getParentCard',skillId);
  const query=request=>{
    const result=invoke(env,'queryPassive',request);
    if (!Array.isArray(result)) throw new MissingValueInput('queryPassive did not return ordered passives');
    return result;
  };
  const passives=(skill,parentCard,type)=>{
    const caster=field(skill,'caster_id');
    const result=query({source_id:caster,type,is_card:false,char_id:caster,caster_id:caster});
    return result.concat(parentCard?query({source_id:field(parentCard,'id'),type,is_card:true,
      char_id:field(parentCard,'char_id'),caster_id:caster}):[]);
  };
  const powerRate=(row,effect)=>{
    if (effect.includes('DMG')) return field(row,'dmg_revise');
    if (effect.includes('SHIELD')) return field(row,'shield_revise');
    if (effect.includes('CURE')) return field(row,'cure_revise');
    return 1;
  };

  function applyInitialRevisions(skillId,skill,res,value) {
    const effect=field(res,'eff');
    if (!preprocessedEffects.has(effect)||absoluteValueTypes.has(field(res,'eff_value_type_1'))||absoluteValueTypes.has(field(res,'eff_value_type_2'))) return value;
    const action=field(skill,'action_char_id');
    if (invoke(env,'isMonsterByID',action)) {
      const init=field(env,'battleInit');
      if (field(init,'ps_mode')!=1) return value;
      const unit=invoke(env,'getUnitByID',action,'apply_ps');
      const mon=resource('monster',field(unit,'res_id'));
      const current=resource('powerstep_define',field(unit,'ps'));
      const initial=resource('powerstep_define',field(mon,'default_powerstep'));
      if (!current||!initial) return value;
      let ratio=powerRate(current,effect)/powerRate(initial,effect);
      const offset=field(unit,'ps_offset');
      if (offset!=null) ratio*=offset;
      value*=ratio;
      const assault=field(init,'assault_ps');
      if (assault) {
        const revise=resource('powerstep_define',assault);
        if (revise) value*=powerRate(revise,effect);
      }
      const slot=field(unit,'assault_slot_ps');
      if (slot) {
        const revise=resource('powerstep_define',slot);
        if (revise) value*=powerRate(revise,effect);
      }
      return value;
    }
    const char=invoke(env,'tryGetCharByCharId',action);
    if (!char) return value;
    const attrs=invoke(env,'getAttrInfo',1,field(res,'eff_attr'),{});
    let isCard=attrs.includes('DMG_ATTR_LIMIT_BREAK_ALLOW'),cardId=null;
    const originalParent=field(skill,'parent');
    if (isCard&&field(originalParent,'type')==='CS') {
      const cs=mapLookup('csMap',field(originalParent,'id'));
      if (cs&&field(cs,'isCard')) cardId=field(cs,'owner_id');
    }
    if (!isCard) {
      let type=field(originalParent,'type'),cursor=skillId;
      if (type==='CARD') cardId=field(originalParent,'id');
      else {
        const visited=new Set();
        while (type==='SKILL') {
          if (visited.has(cursor)) throw new MissingValueInput('Cyclic skill ancestry');
          visited.add(cursor);
          const current=getSkill(cursor),next=mapLookup('skillMap',field(field(current,'parent'),'id'));
          if (!next) break;
          type=field(field(next,'parent'),'type');cursor=field(field(next,'parent'),'id');
        }
        if (type==='CARD') cardId=cursor;
      }
      isCard=type==='CARD';
    }
    const info=field(field(char,'status'),'info');
    if (isCard) value*=(100+(field(info,'S_CHAR_CARD_DMG_SHIELD_CURE_VALUE_HUND_ADD_PCT')??0))/100;
    if (cardId) {
      const card=mapLookup('cardMap',cardId);
      if (card) {
        const row=resource('card',field(card,'res_id')),sort=field(row,'sort');
        if (sort==='SORT_START') value*=(100+(field(info,'S_NODE_REINFORCE_CARD_START')??0))/100;
        if (sort==='SORT_UNIQUE') value*=(100+(field(info,'S_NODE_REINFORCE_CARD_UNIQUE')??0))/100;
        if (sort==='SORT_NEUTRAL'||sort==='SORT_MONSTER_UNIQUE') value*=(100+(field(info,'S_NODE_REINFORCE_CARD_NEUTRAL')??0))/100;
      }
    }
    return value;
  }

  function applyValuePassives(skillId,skill,res,parentCard,value,targetId,count) {
    const rows=count&&parentCard&&field(parentCard,'ep_skill')?[]:
      passives(skill,parentCard,count?'SKILL_EFF_COUNT_VALUE_CHANGE_PASSIVE':'SKILL_EFF_VALUE_CHANGE_PASSIVE');
    let plus=count?(field(skill,'changed_count_value')??0):0,multi=0;
    if (!count) for (const amount of field(skill,'changed_value')??[]) plus+=amount;
    for (const passive of rows) {
      const row=resource('skill_eff',field(passive,'res_id'));
      if (!field(passive,'eff_opts')?.includes(field(res,'eff'))) continue;
      if (count&&!invoke(env,'checkValueAddOpts',{passive_id:field(passive,'skill_id'),skill_id:skillId,
        card_id:parentCard?field(parentCard,'id'):-1})) continue;
      const links=array(field(row,'eff_opt_multiple_link'));
      if (links.length&&!links.includes(field(skill,'res_id'))) continue;
      const amount=calcValue(field(passive,'skill_id'),targetId);
      const changes=valueChangeMathSign(field(row,'eff_value_math_sign'),amount);
      plus+=changes.plus;multi+=changes.multi;
    }
    return value*(1+multi)+plus;
  }

  function applyTipera(skill, res, value) {
    if (field(field(skill,'parent'),'type')!=='CARD'||field(res,'eff')==='SKILL_EFF_UNIQUE_TIPERA_1') return value;
    const card=mapLookup('cardMap',field(field(skill,'parent'),'id'));
    if (!card||field(card,'r_spark_skill_eff_ids')?.includes(field(skill,'skill_id'))) return value;
    const rows=query({source_id:field(card,'id'),type:'SKILL_EFF_UNIQUE_TIPERA_1',is_card:true});
    if (rows.length) {
      const ids=field(card,'skill_eff_ids').filter(id=>!field(card,'r_spark_skill_eff_ids')?.includes(id));
      const index=ids.indexOf(field(skill,'skill_id'));
      let multiplier=0;
      for (const passive of rows) {
        const option=field(passive,'eff_opts')?.[0];
        if (option==='all') multiplier+=field(passive,'tipera_indices')?.length??1;
        else if (option==='ran'&&ids.length>0&&index>=0)
          multiplier+=(field(passive,'tipera_indices')??[]).filter(value=>value===index).length;
      }
      if (multiplier>0) value*=multiplier+1;
    }
    if (field(card,'talents')?.includes(40)) {
      const ids=field(card,'skill_eff_ids').filter(id=>!field(card,'r_spark_skill_eff_ids')?.includes(id));
      const index=ids.indexOf(field(skill,'skill_id'));
      const times=index>=0?(field(card,'tipera_ran_skill_index')??[]).filter(value=>value===index).length:0;
      if (times>0) value*=times+1;
    }
    return value;
  }

  function applyCSEnchant(skill, value, recursion, count) {
    if (field(field(skill,'parent'),'type')!=='CS') return value;
    const cs=mapLookup('csMap',field(field(skill,'parent'),'id'));
    if (!cs) return value;
    const using=mapLookup('cardMap',field(battle(),'current_card'));
    const type=count?'SKILL_EFF_TARGET_CS_EFF_COUNT_ADD':'SKILL_EFF_TARGET_CS_VALUE_ADD';
    const rows=query({source_id:field(field(battle(),'char'),'id'),type,is_card:false,
      char_id:using?(field(using,'char_id')??field(cs,'char_id')):field(cs,'char_id')})
      .concat(using?query({source_id:field(using,'id'),type,is_card:true,char_id:field(using,'char_id')}):[]);
    let plus=0,multi=1,decrease=1,set=null;
    for (const passive of rows) {
      const row=resource('skill_eff',field(passive,'res_id'));
      if (field(row,'target_card_set')==='CARD_SET_DESIGNED') {
        const ids=array(field(row,'target_card_set_opt_multiple_link'));
        if (!using||!ids.includes(field(using,'res_id'))) continue;
      }
      const links=field(passive,'link_cs_ids');
      if (!links?.some(id=>id===field(cs,'res_id')||id===(field(cs,'show_cs_res_id')??field(cs,'res_id')))) continue;
      if (!count&&recursion) throw new MissingValueInput(`Recursive CS value enchant: ${field(passive,'res_id')}`);
      const opts=field(passive,'eff_opts')??[],ally=opts.includes('ally'),enemy=opts.includes('enemy');
      if (!(ally&&enemy)) {
        if (ally&&invoke(env,'isMonsterByID',field(cs,'owner_id'))) continue;
        if (enemy&&!invoke(env,'isMonsterByID',field(cs,'owner_id'))) continue;
      }
      if (opts.includes('own_char')&&field(cs,'char_id')!==field(passive,'action_char_id')) continue;
      if (!count) {
        const except=opts.find(value=>value.startsWith('except_'));
        if (except&&field(skill,'res_id')===except.slice(7)) continue;
      }
      const amount=calcValue(field(passive,'skill_id'),null,{recursion:!count});
      const sign=field(row,'eff_value_math_sign');
      let factor=null;
      if (sign==='MATHSIGN_SET') set=amount;
      else if (sign==='MATHSIGN_ADD') plus+=amount;
      else if (sign==='MATHSIGN_MULTIPLY') factor=amount;
      else if (sign==='MATHSIGN_MULTIPLY_PCT') factor=amount/100;
      else if (sign==='MATHSIGN_ADD_HUND_MULTIPLY_PCT') factor=(amount+100)/100;
      else if (sign==='MATHSIGN_SUBTRACT_HUND_MULTIPLY_PCT') factor=(100-amount)/100;
      else if (sign==='MATHSIGN_SUBTRACT'||sign==='MATHSIGN_SUBTRACT_MIN_0') plus-=amount;
      else throw new UnsupportedValueRule(`Unknown CS enchant math sign: ${sign}`);
      if (factor!=null) {if (factor<1) decrease*=factor;else multi+=factor-1;}
      notify(env,'checkTermValuePassive',field(passive,'skill_id'),field(skill,'caster_id'),true);
    }
    const revised=set!=null?set:(value+plus)*multi*decrease;
    return value*revised<0?0:revised;
  }

  function valueType(skillId,targetId,value,type,from,options,links,extra) {
    const context=invoke(env,'makeValueContext',skillId,targetId,from,extra);
    const ctx={...context,targetId,from,extra,options:array(options),linkOptions:array(links)};
    let cacheOwner=null;
    if(type==='VALUE_RANDOM_RANGE_VALUE_OPT_FIXED_BEFORE_USE'){
      cacheOwner=getSkill(skillId);ctx.randValues=field(cacheOwner,'randValues');
    }
    const result=evaluateValueType(type,value,ctx);
    if(cacheOwner&&ctx.randValues!==cacheOwner.randValues)cacheOwner.randValues=ctx.randValues;
    return result;
  }
  function randomZero(skill,value,flag,valueKey) {
    if (field(skill,flag)) return {value:field(skill,valueKey)??0,early:false};
    if (field(env,'isPreview')) return {value:0,early:true};
    const result=invoke(env,'nextRange',0,value+1);
    skill[valueKey]=result;skill[flag]=true;
    return {value:result,early:false};
  }
  function stack(skill,key) {
    const id=field(skill,key);
    return id?mapLookup('stackMap',id):null;
  }

  function calcValue(skillId,targetId=null,options={}) {
    const skill=getSkill(skillId),res=resource('skill_eff',field(skill,'res_id'));
    let value=applyInitialRevisions(skillId,skill,res,field(skill,'eff_value'));
    const parentCard=parent(skillId);
    value=applyValuePassives(skillId,skill,res,parentCard,value,targetId,false);
    value=applyTipera(skill,res,value);
    value=applyCSEnchant(skill,value,options.recursion??false,false);
    if (field(field(skill,'parent'),'type')==='CARD') {
      const card=mapLookup('cardMap',field(field(skill,'parent'),'id'));
      if (card&&field(card,'nihilum_stack')) value+=Number((field(skill,'eff_opts')??[])[0]??0)*field(card,'nihilum_stack');
    }
    const types=[field(res,'eff_value_type_1'),field(res,'eff_value_type_2')];
    for (let i=0;i<2;i++) {
      if (types[i]==='VALUE_RANDOM_GE_0') {
        const result=randomZero(skill,value,'rand','randValue');
        if (result.early) return 0;
        value=result.value;
      } else value=valueType(skillId,targetId,value,types[i],'ev',field(res,`value_opt_${i+1}`),field(res,`value_opt_${i+1}_multiple_link`),options.extra??null);
    }
    const round=types.includes('VALUE_IGNORE_ROUND')?value=>value:roundGame;
    const term=options.term_value??field(skill,'termValue')??0;
    const categoryValue=category(skill),operationValue=operation(skill);
    value=categoryValue==='VALUE_CATEGORY_EFF_VALUE'?termOperation(value,term,operationValue,round):round(value);
    const sign0=field(res,'eff_condition_value_math_sign_0'),stack0=stack(skill,'stack_value0');
    if (stack0) {
      const count=options.ecdv0_stack??field(stack0,'stack');
      let coefficient=field(res,'eff_condition_value_0');
      if (categoryValue==='VALUE_CATEGORY_EFF_CONDITION_VALUE_0') coefficient=coefficientTerm(coefficient,term,operationValue);
      value=applyMathSign(sign0,value,count*coefficient);
    }
    const stack1=stack(skill,'stack_value1'); // Original reads the second map before SET suppresses its math.
    if (sign0!=='MATHSIGN_SET'&&stack1) {
      let coefficient=field(res,'eff_condition_value_1');
      if (categoryValue==='VALUE_CATEGORY_EFF_CONDITION_VALUE_1') coefficient=coefficientTerm(coefficient,term,operationValue);
      value=applyMathSign(field(res,'eff_condition_value_math_sign_1'),value,field(stack1,'stack')*coefficient);
    }
    const spark=field(skill,'r_spark_value');
    if (spark!=null) {
      let amount=spark;
      for (let i=0;i<2;i++) if (!skipSparkTypes.has(types[i]))
        amount=valueType(skillId,targetId,amount,types[i],'fv',field(res,`value_opt_${i+1}`),field(res,`value_opt_${i+1}_multiple_link`),options.extra??null);
      value+=amount;
    }
    return value;
  }

  function calcCountValue(skillId,targetId=null,options={}) {
    const skill=getSkill(skillId),res=resource('skill_eff',field(skill,'res_id')),parentCard=parent(skillId);
    let value=field(res,'eff_count_value')+(field(skill,'r_spark_count_value')??0);
    value=applyValuePassives(skillId,skill,res,parentCard,value,targetId,true);
    value=applyCSEnchant(skill,value,false,true);
    const type=field(res,'eff_count_value_type');
    if (type==='VALUE_RANDOM_GE_0') {
      const result=randomZero(skill,value,'randCount','randCountValue');
      if (result.early) return 0;
      value=result.value;
    } else value=valueType(skillId,targetId,value,type,'ecv',field(res,'eff_count_value_type_opt'),field(res,'eff_count_value_type_opt_multiple_link'),null);
    value=roundGame(value);
    const term=options.term_value??field(skill,'termValue')??0;
    if (category(skill)==='VALUE_CATEGORY_EFF_COUNT_VALUE') {
      const op=operation(skill);
      if (op==='OPERATION_TERM_VALUE_ADD') value+=term;
      if (op==='OPERATION_TERM_VALUE_MULTIPLE') value*=term;
    }
    const sign0=field(res,'eff_condition_count_value_math_sign_0'),stack0=stack(skill,'stack_count0');
    if (stack0) {
      const snapshot=parentCard&&field(parentCard,'by_testament')?field(parentCard,'testament_bullet_snapshot'):null;
      const amount=snapshot??field(stack0,'stack');
      value=applyMathSign(sign0,value,amount*field(res,'eff_condition_count_value_0'));
    }
    const stack1=stack(skill,'stack_count1');
    if (sign0!=='MATHSIGN_SET'&&stack1) value=applyMathSign(field(res,'eff_condition_count_value_math_sign_1'),value,field(stack1,'stack')*field(res,'eff_condition_count_value_1'));
    value=floorGame(value);
    skill.last_count_value=Math.max(field(skill,'last_count_value')??0,value);
    return value;
  }
  function calcEffCardTargetCount(skillId) {
    const skill=getSkill(skillId),res=resource('skill_eff',field(skill,'res_id'));
    let value=field(res,'eff_card_target_count');
    if (category(skill)==='VALUE_CATEGORY_EFF_CARD_TARGET_COUNT') {
      const op=operation(skill),term=field(skill,'termValue')??0;
      if (op==='OPERATION_TERM_VALUE_ADD') value+=term;
      if (op==='OPERATION_TERM_VALUE_MULTIPLE') value*=term;
    }
    return value;
  }
  function calcTargetCardSetListCount(skillId,targetId=null) {
    const skill=getSkill(skillId),res=resource('skill_eff',field(skill,'res_id'));
    const type=field(res,'target_card_set_list_count_type'),value=field(res,'target_card_set_list_count');
    if (type==='VALUE_RANDOM_GE_0') return randomZero(skill,value,'randTcslc','randTcslcValue').value;
    return valueType(skillId,targetId,value,type,'tcslc',[],[],null);
  }
  return {calcValue,calcCountValue,calcEffCardTargetCount,calcTargetCardSetListCount};
}
