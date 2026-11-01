/** Independent reconstruction of inspected dynamic-value branches.
 * Never imports or executes recovered game code. Unsupported branches stop.
 * ctx.read is an ordered, potentially stateful query, not a memoized snapshot.
 */
import { floorGame, ceilGame, roundGame, procStatType, procRevise } from '../effects/effect-arithmetic.mjs';
import {lastPainTerm,lastPainValue,sumPainTerms,discardedPainDamage} from '../attributes/pain-helpers.mjs';

// Inspected client enum values, battle_enums.js TALENT/CARD_PLACE definitions.
const TALENT_BIND=37, CARD_PLACE_EXHAUST=4;

export class MissingValueInput extends Error {}
export class UnsupportedValueRule extends Error {}
const own = (o,k) => o != null && Object.hasOwn(o,k);
function field(o,k) {
  if (!own(o,k) || o[k]===undefined) throw new MissingValueInput(`Missing dynamic-value input: ${k}`);
  return o[k];
}
function read(ctx,key,...args) {
  const fn=field(ctx,'read');
  if (typeof fn!=='function') throw new MissingValueInput('read must query current state');
  const result=fn(key,...args);
  if (result===undefined) throw new MissingValueInput(`Unknown dynamic-value fact: ${key}`);
  return result;
}
function invoke(ctx,key,...args) {
  const fn=field(ctx,key);
  if (typeof fn!=='function') throw new MissingValueInput(`${key} must be a query`);
  const result=fn(...args);
  if (result===undefined) throw new MissingValueInput(`Unknown result from ${key}`);
  return result;
}
function links(ctx) {
  const result=field(ctx,'linkOptions');
  if (!Array.isArray(result)) throw new MissingValueInput('linkOptions must be decoded');
  return result;
}
function csList(ctx,unit) { return read(ctx,'continueSkills',unit); }
function csSum(records,link,otherChar=false,actionChar=null) {
  let result=0;
  for (const cs of records) {
    if (field(cs,'res_id')!==link) continue;
    if (otherChar && normalizeCharacterId(field(cs,'caster_id'))===actionChar) continue;
    result+=field(cs,'term_value');
  }
  return result;
}
const extendedTypes=[
 'VALUE_BEFORE_EFF_TARGET_COUNT_ADD','VALUE_BEFORE_EFF_TARGET_COUNT_MULTIPLY',
 'VALUE_BEFORE_EFF_TARGET_COUNT_MULTIPLY_OPT_ADD','VALUE_CARD_TARGET_AMOUNT_ADD','VALUE_CARD_TARGET_AMOUNT_MULTIPLY',
 'VALUE_BEFORE_EFF_COUNT_VALUE','VALUE_BEFORE_EFF_COUNT_VALUE_MULTIPLY',
 'VALUE_BEFORE_EFF_APPLIED_VALUE','VALUE_BEFORE_EFF_APPLIED_VALUE_MULTIPLY_PCT','VALUE_BEFORE_EFF_APPLIED_VALUE_EQ0_SET0',
 'VALUE_BEFORE_EFF_APPLIED_COEFF_VALUE_ADD','VALUE_BEFORE_EFF_TARGET_COST_ADD','VALUE_BEFORE_EFF_TARGET_COST_SUM_MULTIPLY',
 'VALUE_TRIGGERED_CARD_COST_ADD','VALUE_TRIGGERED_CARD_COST_MULTIPLY','VALUE_UNIQUE_RITA_1',
 'VALUE_THIS_CARD_COST_APPLIED_ADD','VALUE_THIS_CARD_COST_APPLIED_MULTIPLY',
 'VALUE_TARGET_CS_EXIST_ADD_OPT','VALUE_TARGET_CS_COUNT_ADD_GT0','VALUE_TARGET_CS_COUNT_MULTIPLY_GT0',
 'VALUE_CASTER_CS_COUNT_ADD_GT0','VALUE_CASTER_CS_COUNT_MULTIPLY_GT0',
 'VALUE_TARGET_TRIGGERED_CS_COUNT_ADD_GT0','VALUE_TARGET_TRIGGERED_CS_COUNT_MULTIPLY_GT0',
 'VALUE_ADD_VALUE_OPT','VALUE_COND0_STACK_DIVIDE_BY_OPT_ADD','VALUE_COND0_STACK_DIVIDE_BY_OPT_MULTIPLY',
 'VALUE_OWNER_CS_AMOUNT_ADD','VALUE_OWNER_CS_AMOUNT_MULTIPLY','VALUE_CREDIT_AMOUNT_ADD','VALUE_CREDIT_AMOUNT_MULTIPLY',
 'VALUE_OWNER_TURN_COUNT_OPT1_ADD_OPT2','VALUE_THIS_CARD_TALENT_BIND_STACK_MULTIPLY',
 'VALUE_THIS_CARD_TALENT_UNIQUE_OLGA_STACK_ADD','VALUE_THIS_CARD_TALENT_UNIQUE_OLGA_STACK_MULTIPLY',
 'VALUE_PLACE_MONSTER_CARD_AMOUNT_MULTIPLY','VALUE_PLACE_MONSTER_CASTER_CARD_AMOUNT_MULTIPLY',
 'VALUE_PLACE_MONSTER_CASTER_CARD_AMOUNT_MULTIPLY_PCT','VALUE_CARD_DECK_TOP_COST_ADD','VALUE_CARD_DECK_TOP_COST_MULTIPLY',
 'VALUE_MONSTER_AMOUNT_KILLED_ADD','VALUE_FIELD_MONSTER_TURN_COUNT_SUM_ADD','VALUE_FIELD_MONSTER_TURN_COUNT_SUM_MULTIPLY',
 'VALUE_CHAR_HP_MAX_PCT','VALUE_MONSTER_HP_MAX_PCT','VALUE_LOST_HP_PCT','VALUE_TARGET_EGO_FIELD_MAX_PCT',
 'VALUE_TARGET_LOSE_EGO_MAX_MULTIPLY_OPT','VALUE_CARD_TARGET_NOTICE_ATTACK_DAMAGE_MULTIPLY',
 'VALUE_MAX_CASTER_ATK_PCT','VALUE_TARGET_TURN_COUNT_MULTIPLY_OPT_ADD','VALUE_TARGET_TURN_COUNT_ADD','VALUE_TARGET_TURN_COUNT_MULTIPLY',
 'VALUE_BEFORE_EFF_TARGET_COUNT_SUBTRACT_MIN_0','VALUE_APPLIED_BEFORE_CARD_ATK_COUNT_ADD','VALUE_APPLIED_BEFORE_CARD_ATK_COUNT_MULTIPLY',
 'VALUE_CARD_AMOUNT_ADD','VALUE_CARD_AMOUNT_MULTIPLY','VALUE_IDENTICAL_NAME_COUNT_MULTIPLY',
 'VALUE_CHAR_CARD_AMOUNT_EXCEPT_THIS_CARD_ADD','VALUE_CHAR_CARD_AMOUNT_EXCEPT_THIS_CARD_MULTIPLY',
 'VALUE_CHAR_CARD_AMOUNT_ADD','VALUE_CHAR_CARD_AMOUNT_MULTIPLY',
 'VALUE_HAND_CARD_AMOUNT_ADD','VALUE_HAND_CARD_AMOUNT_MULTIPLY','VALUE_HAND_CARD_AMOUNT_SUBTRACT_MIN_0',
 'VALUE_HAND_CARD_COST_ADD','VALUE_HAND_CARD_COST_MULTIPLY','VALUE_HAND_CARD_HIGH_COST_SUM_MULTIPLY',
 'VALUE_HAND_CARD_BIND_STACK_ADD_HUND_MULTIPLY_PCT','VALUE_HAND_CARD_BIND_STACK_ADD','VALUE_CARD_DEBUFF_OPT_AMOUNT_MULTIPLY',
 'VALUE_ALL_MONSTER_CS_COUNT_ADD','VALUE_CARD_TARGET_GET_CSTYPE_COUNT_ADD','VALUE_CARD_TARGET_GET_CSTYPE_COUNT_MULTIPLE',
 'VALUE_CARD_TARGET_GET_CSTYPE_STACK_ADD','VALUE_CARD_TARGET_GET_CSTYPE_STACK_MULTIPLE',
 'VALUE_ALL_TARGET_GET_CSTYPE_COUNT_ADD','VALUE_ALL_TARGET_GET_CSTYPE_COUNT_MULTIPLE',
 'VALUE_TRIGGERED_DESIRE_STACK_ADD','VALUE_TRIGGERED_DESIRE_STACK_MULTIPLY','VALUE_TRIGGERED_BIND_STACK_ADD',
 'VALUE_HAND_CARD_AMOUNT_EGO_MULTIPLY','VALUE_HAND_CARD_AMOUNT_SAME_EGO_MULTIPLY','VALUE_HAND_CARD_AMOUNT_SAME_EGO_USING_CARD_MULTIPLY',
 'VALUE_STAT_REVISE','VALUE_NOTICE_ATTACK_MON_COUNT_ADD','VALUE_NOTICE_ATTACK_MON_COUNT_MULTIPLY',
 'VALUE_TARGET_GET_PAIN_COUNT_THIS_TURN_MULTIPLE','VALUE_TARGET_GET_PAIN_COUNT_MULTIPLE','VALUE_TARGET_GET_PAIN_RESULT_MULTIPLE',
 'VALUE_TARGET_PAIN_DMG_PCT','VALUE_ALL_MONSTER_PAIN_DMG_PCT','VALUE_ALL_MONSTER_PAIN_COUNT_ADD',
 'VALUE_CARD_TARGET_GET_PAIN_COUNT_MULTIPLE',
];
function targetExists(ctx) { return !!field(ctx,'targetId'); }
function preview(ctx) { return !!field(ctx,'isPreview'); }
function option(ctx,i,fallback) {
  const values=field(ctx,'options');
  if (!Array.isArray(values)) throw new MissingValueInput('options must be a decoded array');
  const value=values[i];
  return value==null && arguments.length>=3 ? fallback : value==null ? value : Number(value);
}
function drawRange(ctx,lo,hi) {
  const fn=field(ctx,'nextRange');
  if (typeof fn!=='function') throw new MissingValueInput('nextRange must use the current INGAME stream');
  return fn(lo,hi);
}

export function applyMathSign(sign,left,right) {
  if (sign.startsWith('MATHSIGN_ADD_MAX_')) return left+Math.min(right,Number(sign.split('_')[3]));
  switch(sign) {
    case 'MATHSIGN_NONE': case 'MATHSIGN_REF': return left;
    case 'MATHSIGN_ADD': return left+right;
    case 'MATHSIGN_MULTIPLY': return left*right;
    case 'MATHSIGN_MULTIPLY_PCT': return left*right/100;
    case 'MATHSIGN_ADD_HUND_MULTIPLY_PCT': return left*(100+right)/100;
    case 'MATHSIGN_SUBTRACT_HUND_MULTIPLY_PCT': return left*(100-right)/100;
    case 'MATHSIGN_SET': return right;
    case 'MATHSIGN_SUBTRACT': return left-right;
    case 'MATHSIGN_SUBTRACT_MIN_0': return Math.max(0,left-right);
    case 'MATHSIGN_SUBTRACT_MIN_1': return Math.max(1,left-right);
    case 'MATHSIGN_DIVIDE': return roundGame(left/right);
    case 'MATHSIGN_DIVIDE_FLOOR': return floorGame(left/right);
    case 'MATHSIGN_MULTIPLY_GE1': return right>=1 ? left*right : left;
    default: throw new UnsupportedValueRule(`Unknown math sign: ${sign}`);
  }
}

// The cache represents ONE of rand/randCount/randTcslc, not a shared global flag.
export function randomZeroInclusive(base,cache,ctx) {
  if (field(cache,'used')) return field(cache,'value')??0;
  if (preview(ctx)) return 0;
  const result=drawRange(ctx,0,base+1);
  cache.value=result;
  cache.used=true;
  return result;
}

const direct = new Map([
 ['VALUE_X_COST_ADD',['costUsed','add']], ['VALUE_X_COST_MULTIPLY',['costUsed','mul']],
 ['VALUE_COST_DEFICIT_MULTIPLY',['costDeficit','mul']],
 ['VALUE_ENERGY_BEFORE_CARD_USE_MULTIPLY',['energyBeforeCardUseOrCurrent','mul']],
 ['VALUE_CUR_SHIELD_PER_HUND',['casterCurrentShield','pct']],
 ['VALUE_CASTER_HP_MAX_PCT',['casterMaxHp','pct']], ['VALUE_USER_HP_PCT',['partyCurrentHp','pct']],
 ['VALUE_STAGE_HP_MAX_PCT',['initialMaxHp','pct']], ['VALUE_CASTER_HAVE_HP_ADD',['casterCurrentHp','add']],
 ['VALUE_DECK_COUNT_MULTIPLY',['deckCount','mul']], ['VALUE_DISCARD_COUNT_MULTIPLY',['discardCount','mul']],
 ['VALUE_EXHAUST_COUNT_MULTIPLY',['exhaustCount','mul']], ['VALUE_TURN_MULTIPLY',['turn','mul']],
 ['VALUE_MONSTER_AMOUNT_LIVE_ADD',['liveFieldMonsterCount','add']],
 ['VALUE_MONSTER_AMOUNT_LIVE_MULTIPLY',['liveFieldMonsterCount','mul']],
]);
const buffRules=new Map();
for (const who of ['TARGET','CASTER']) for (const category of ['BUFF','DEBUFF']) {
  for (const mode of ['ADD','MULTIPLY','MULTIPLY_OPT_ADD']) {
    buffRules.set(`VALUE_${who}_${category}_COUNT_${mode}`,{
      who,mode,key:`${who.toLowerCase()}${category==='BUFF'?'Buff':'Debuff'}TypeCount`,
    });
  }
}

export const supportedValueTypes=Object.freeze([
 'VALUE_NONE','VALUE_COMMON','VALUE_IGNORE_ROUND','VALUE_MAX_OPT','VALUE_DIVIDE_BY_OPT',
 'VALUE_SUBTRACT_MIN_0_VALUE_OPT','VALUE_ROUND_MULTIPLY',...direct.keys(),...buffRules.keys(),
 'VALUE_TARGET_HP_MAX_PCT','VALUE_CASTER_HP_PCT','VALUE_CASTER_CUR_HP_PROPORTION_MULTIPLY',
 'VALUE_CASTER_LOSE_HP_MAX_ADD','VALUE_CASTER_LOSE_HP_MAX_MULTIPLY_PCT',
 'VALUE_TRIGGERED','VALUE_TRIGGERED_PCT','VALUE_RANDOM_RANGE_VALUE_OPT',
 'VALUE_RANDOM_RANGE_VALUE_OPT_MULTIPLY','VALUE_RANDOM_RANGE_VALUE_OPT_FIXED_BEFORE_USE',
 ...extendedTypes,
]);

export function evaluateValueType(type,value,ctx) {
  if (type==='VALUE_NONE'||type==='VALUE_COMMON'||type==='VALUE_IGNORE_ROUND') return value;
  if (type==='VALUE_MAX_OPT') return Math.min(value,option(ctx,0));
  if (type==='VALUE_DIVIDE_BY_OPT') return floorGame(value/option(ctx,0,1));
  if (type==='VALUE_SUBTRACT_MIN_0_VALUE_OPT') return Math.max(0,value-option(ctx,0,0));
  if (type==='VALUE_ROUND_MULTIPLY') return roundGame(value)*option(ctx,0);
  if (direct.has(type)) {
    const [key,mode]=direct.get(type),fact=read(ctx,key);
    return mode==='add' ? value+fact : mode==='pct' ? value*(fact/100) : value*fact;
  }
  if (buffRules.has(type)) {
    const rule=buffRules.get(type);
    if (rule.who==='TARGET'&&!targetExists(ctx)) return rule.mode==='MULTIPLY'?0:value;
    const count=read(ctx,rule.key);
    return rule.mode==='ADD'?value+count : rule.mode==='MULTIPLY'?value*count : value+count*option(ctx,0);
  }
  switch(type) {
    case 'VALUE_TARGET_GET_PAIN_COUNT_THIS_TURN_MULTIPLE': case 'VALUE_TARGET_GET_PAIN_COUNT_MULTIPLE':
    case 'VALUE_TARGET_GET_PAIN_RESULT_MULTIPLE': {
      if (!targetExists(ctx)) {
        if (type==='VALUE_TARGET_GET_PAIN_COUNT_MULTIPLE') throw new MissingValueInput('Pain count requires target');
        return value;
      }
      const unit=read(ctx,'unit',field(ctx,'targetId'));
      const ids=read(ctx,'continueSkillIds',unit),pain=field(ctx,'painContext');
      if (type==='VALUE_TARGET_GET_PAIN_RESULT_MULTIPLE') return value*lastPainValue(ids,0,pain);
      const amount=lastPainTerm(ids,0,pain);
      return value*(type==='VALUE_TARGET_GET_PAIN_COUNT_THIS_TURN_MULTIPLE'?amount-(field(unit,'painTurnStart')??0):amount);
    }
    case 'VALUE_TARGET_PAIN_DMG_PCT': {
      const id=read(ctx,'selectedTarget');
      if (!(id>0)) throw new MissingValueInput('Pain damage requires selected target');
      const unit=read(ctx,'unit',id);
      const amount=discardedPainDamage(read(ctx,'continueSkillIds',unit),0,field(ctx,'painContext'));
      return amount?value*amount/100:0;
    }
    case 'VALUE_ALL_MONSTER_PAIN_DMG_PCT': {
      let amount=0;
      for (const id of read(ctx,'targetableMonsterIds')) {
        const unit=read(ctx,'unit',id);
        amount+=discardedPainDamage(read(ctx,'continueSkillIds',unit),0,field(ctx,'painContext'));
      }
      return value*amount/100;
    }
    case 'VALUE_ALL_MONSTER_PAIN_COUNT_ADD': {
      const first=option(ctx,0),cap=first&&!isNaN(first)?first:Infinity;
      let amount=0;
      for (const id of read(ctx,'targetableMonsterIds')) {
        const unit=read(ctx,'unit',id);
        amount+=sumPainTerms(read(ctx,'continueSkillIds',unit),0,field(ctx,'painContext'));
      }
      return value+Math.min(amount,cap);
    }
    case 'VALUE_CARD_TARGET_GET_PAIN_COUNT_MULTIPLE': {
      const target=read(ctx,'selectedTarget');
      const pain=field(ctx,'painContext');
      if (target>0) {
        const unit=read(ctx,'unit',target);
        return value*lastPainTerm(read(ctx,'continueSkillIds',unit),0,pain);
      }
      let amount=0;
      for (const monster of read(ctx,'monsters')) {
        if (['death','changed','run','half_death','keep_half_death'].includes(field(monster,'state'))) continue;
        amount=sumPainTerms(field(monster,'continueSkill'),amount,pain);
      }
      return value*amount;
    }
    case 'VALUE_TARGET_HP_MAX_PCT':
      return field(ctx,'targetId')==null ? value : value*(read(ctx,'targetMaxHp')/100);
    case 'VALUE_CASTER_HP_PCT': {
      const hp=read(ctx,'casterCurrentHp'),max=read(ctx,'casterMaxHp');
      return ceilGame(hp/max*100); // This REPLACES the input, rather than multiplying it.
    }
    case 'VALUE_CASTER_CUR_HP_PROPORTION_MULTIPLY': {
      const hp=read(ctx,'casterCurrentHp'),max=read(ctx,'casterMaxHp');
      return value*(hp/max);
    }
    case 'VALUE_CASTER_LOSE_HP_MAX_ADD': {
      const max=read(ctx,'casterMaxHp'),hp=read(ctx,'casterCurrentHp');
      return value+(max-hp);
    }
    case 'VALUE_CASTER_LOSE_HP_MAX_MULTIPLY_PCT': {
      const max=read(ctx,'casterMaxHp'),hp=read(ctx,'casterCurrentHp');
      return value*((max-hp)/100);
    }
    case 'VALUE_TRIGGERED': case 'VALUE_TRIGGERED_PCT': {
      if (field(ctx,'preSkillEvalDepth')>0) return 0;
      const amount=field(ctx,'valueTriggered');
      if (amount==null) throw new MissingValueInput('valueTriggered is required outside pre-evaluation');
      return type==='VALUE_TRIGGERED'?value*amount:value*(amount/100);
    }
    case 'VALUE_RANDOM_RANGE_VALUE_OPT': case 'VALUE_RANDOM_RANGE_VALUE_OPT_MULTIPLY': {
      if (preview(ctx)) return 0;
      const result=drawRange(ctx,option(ctx,0),option(ctx,1)+1);
      return type==='VALUE_RANDOM_RANGE_VALUE_OPT'?result:value*result;
    }
    case 'VALUE_RANDOM_RANGE_VALUE_OPT_FIXED_BEFORE_USE': {
      let cache=field(ctx,'randValues');
      const key=field(ctx,'from');
      if (preview(ctx)) {
        const effects=['SKILL_EFF_CARD_COST_CHANGE','SKILL_EFF_CARD_COST_CHANGE_PASSIVE',
          'SKILL_EFF_TACTIC_SKILL_COST_CHANGE','SKILL_EFF_EGOSKILL_COST_CHANGE'];
        return cache?.[key]!=null&&effects.includes(field(ctx,'effect'))?cache[key]:0;
      }
      if (cache?.[key]!=null) return cache[key];
      if (cache===null) {cache={};ctx.randValues=cache;}
      return cache[key]=drawRange(ctx,option(ctx,0),option(ctx,1)+1);
    }
    default: return evaluateExtendedType(type,value,ctx);
  }
}

function evaluateExtendedType(type,value,ctx) {
  const sumMode=(amount,add)=>add?value+amount:value*amount;
  const csMode=(amount,add)=>add ? (amount?value+Math.max(0,amount)*option(ctx,0,1):value)
    : (amount?value*Math.max(0,amount):0);
  const selectedCs=(method)=>{
    const target=read(ctx,'selectedTarget');
    return target>0?invoke(ctx,method,target,field(ctx,'options')[0]):0;
  };
  const combinedHand=()=>read(ctx,'handIds').concat(read(ctx,'usingIds'));
  const filterCards=(ids,overrides={})=>ids.filter(invoke(ctx,'buildCardFilter',field(ctx,'options'),overrides));
  const handCost=id=>{
    const card=read(ctx,'card',id);
    const raw=field(ctx,'options').includes('original_cost')?read(ctx,'cardResourceCost',field(card,'res_id')):field(card,'cost_result');
    return raw<0?0:raw;
  };
  switch(type) {
    case 'VALUE_MAX_CASTER_ATK_PCT': {
      const percent=option(ctx,0);
      if (percent==null||isNaN(percent)) return value;
      let cap=floorGame(read(ctx,'casterAttack')*percent/100);
      const cs=read(ctx,'parentCS');
      if (cs) {
        const used=field(cs,'atk_cap');
        cap-=used&&field(used,'turn')===read(ctx,'turn')?field(used,'used'):0;
      }
      return Math.min(value,Math.max(0,cap));
    }
    case 'VALUE_TARGET_TURN_COUNT_MULTIPLY_OPT_ADD': {
      if (!targetExists(ctx)) return value;
      const unit=read(ctx,'unit',field(ctx,'targetId'));
      const cap=read(ctx,'maxDamageAttributeTurnCount');
      const turns=Math.max(0,Math.min(field(unit,'mon_turn')??cap,cap));
      return value+turns*option(ctx,0);
    }
    case 'VALUE_TARGET_TURN_COUNT_ADD': case 'VALUE_TARGET_TURN_COUNT_MULTIPLY': {
      const cap=Math.abs(option(ctx,0,0));
      let count=0;
      if (read(ctx,'targetUnitType')==='TARGET_UNIT_ALL_ENEMY') {
        for (const unit of read(ctx,'monsters')) if (invoke(ctx,'isFieldMonster',unit)) {
          const turn=field(unit,'mon_turn');
          count+=turn==null?Infinity:Math.max(0,turn);
        }
      } else if (targetExists(ctx)) {
        const unit=read(ctx,'unit',field(ctx,'targetId')),turn=field(unit,'mon_turn');
        count=turn==null?Infinity:Math.max(0,turn);
      }
      const result=sumMode(count,type.endsWith('_ADD'));
      return cap>0?Math.min(result,cap):result;
    }
    case 'VALUE_BEFORE_EFF_TARGET_COUNT_SUBTRACT_MIN_0': {
      const saved=read(ctx,'savedTarget');
      if (saved===null) throw new MissingValueInput('This branch directly requires savedTarget[root]');
      const unique=field(saved,0).filter((id,i,ids)=>ids.indexOf(id)===i);
      return Math.max(0,value-unique.length);
    }
    case 'VALUE_APPLIED_BEFORE_CARD_ATK_COUNT_ADD': case 'VALUE_APPLIED_BEFORE_CARD_ATK_COUNT_MULTIPLY':
      return sumMode(read(ctx,'beforeCardAppliedAttackCount')??0,type.endsWith('_ADD'));
    case 'VALUE_CARD_AMOUNT_ADD': case 'VALUE_CARD_AMOUNT_MULTIPLY': {
      const opts=invoke(ctx,'parseCardCountOpts',field(ctx,'options'));
      const overrides={place_of:undefined};
      if (field(opts,'using_previous')) {
        const parent=read(ctx,'parentCard');
        if (parent && read(ctx,'usingIds').includes(field(parent,'id'))) {
          const snapshot=read(ctx,'usePlaceSnapshot',field(parent,'id'));
          if (snapshot) overrides.place_of=card=>snapshot[field(card,'id')];
        }
      }
      const ids=field(opts,'stage_deck')?read(ctx,'stageDeckAll').map(card=>field(card,'id')):read(ctx,'allCardIds');
      let count=filterCards(ids,overrides).length;
      if (field(opts,'max_count')>=0) count=Math.min(count,field(opts,'max_count'));
      count*=field(opts,'coeff');
      return sumMode(count,type.endsWith('_ADD'));
    }
    case 'VALUE_IDENTICAL_NAME_COUNT_MULTIPLY': {
      const extra=field(ctx,'extra'),target=field(ctx,'targetId');
      let card;
      if (extra?.card_id!=null) card=read(ctx,'card',extra.card_id);
      else {
        const targetCard=target!=null?read(ctx,'card',target):null;
        card=targetCard||read(ctx,'parentCard');
      }
      if (!card) throw new MissingValueInput('No card for identical-name comparison');
      const key=invoke(ctx,'battleCardSameNameKey',card);
      const ids=read(ctx,'deckIds').concat(read(ctx,'handIds'),read(ctx,'discardIds'),read(ctx,'usedIds'),read(ctx,'usingIds'));
      let count=0;
      for (const id of ids) {
        const candidate=read(ctx,'card',id);
        if (invoke(ctx,'isCardUninteractible',id)) continue;
        if (candidate&&invoke(ctx,'battleCardSameNameKey',candidate)===key) count++;
      }
      return value*count;
    }
    case 'VALUE_CHAR_CARD_AMOUNT_EXCEPT_THIS_CARD_ADD': case 'VALUE_CHAR_CARD_AMOUNT_EXCEPT_THIS_CARD_MULTIPLY':
    case 'VALUE_CHAR_CARD_AMOUNT_ADD': case 'VALUE_CHAR_CARD_AMOUNT_MULTIPLY': {
      const count=filterCards(read(ctx,'allCardIds'),{force_char_match:true,force_except_this_card:type.includes('_EXCEPT_THIS_CARD_')}).length;
      return sumMode(count,type.endsWith('_ADD'));
    }
    case 'VALUE_HAND_CARD_AMOUNT_ADD': case 'VALUE_HAND_CARD_AMOUNT_MULTIPLY': case 'VALUE_HAND_CARD_AMOUNT_SUBTRACT_MIN_0':
    case 'VALUE_HAND_CARD_COST_ADD': case 'VALUE_HAND_CARD_COST_MULTIPLY': case 'VALUE_HAND_CARD_HIGH_COST_SUM_MULTIPLY': {
      const ids=filterCards(combinedHand());
      if (type.includes('_AMOUNT_')) return type.endsWith('_SUBTRACT_MIN_0')?Math.max(0,value-ids.length):sumMode(ids.length,type.endsWith('_ADD'));
      let costs=ids.map(handCost);
      if (type==='VALUE_HAND_CARD_HIGH_COST_SUM_MULTIPLY') {
        const raw=field(ctx,'options')[0];
        const amount=raw&&!isNaN(Number(raw))?Number(raw):1;
        costs=costs.sort((a,b)=>b-a).slice(0,amount);
      }
      return sumMode(costs.reduce((total,cost)=>total+cost,0),type.endsWith('_ADD'));
    }
    case 'VALUE_HAND_CARD_BIND_STACK_ADD_HUND_MULTIPLY_PCT': case 'VALUE_HAND_CARD_BIND_STACK_ADD': {
      const wanted=links(ctx).filter(id=>id!=='none');
      let count=0;
      for (const id of read(ctx,'handIds')) {
        const card=read(ctx,'card',id);
        if (!card||(wanted.length&&!wanted.includes(field(card,'res_id')))) continue;
        if (field(card,'talents')?.includes(TALENT_BIND)) count+=(field(card,'bind_count')??0)+1;
      }
      const amount=count*option(ctx,0,1);
      return type.endsWith('_PCT')?value+value*amount/100:value+amount;
    }
    case 'VALUE_CARD_DEBUFF_OPT_AMOUNT_MULTIPLY': {
      const wanted=links(ctx);
      let count=0;
      for (const id of read(ctx,'allCardIds')) {
        const card=read(ctx,'card',id),debuffs=field(card,'debuffs');
        if (debuffs&&debuffs.some(item=>wanted.includes(field(item,'debuff_res_id')))&&field(card,'card_place')!==CARD_PLACE_EXHAUST) count++;
      }
      return value*count;
    }
    case 'VALUE_ALL_MONSTER_CS_COUNT_ADD': {
      const first=option(ctx,0),cap=first&&!isNaN(first)?first:Infinity;
      let total=0;
      for (const id of read(ctx,'targetableMonsterIds')) total+=csSum(csList(ctx,read(ctx,'unit',id)),links(ctx)[0]);
      return value+Math.min(total,cap);
    }
    case 'VALUE_CARD_TARGET_GET_CSTYPE_COUNT_ADD': case 'VALUE_CARD_TARGET_GET_CSTYPE_COUNT_MULTIPLE':
      return sumMode(selectedCs('getCSCount'),type.endsWith('_ADD'));
    case 'VALUE_CARD_TARGET_GET_CSTYPE_STACK_ADD': case 'VALUE_CARD_TARGET_GET_CSTYPE_STACK_MULTIPLE':
      return sumMode(selectedCs('getCSTermValue'),type.endsWith('_ADD'));
    case 'VALUE_ALL_TARGET_GET_CSTYPE_COUNT_ADD': case 'VALUE_ALL_TARGET_GET_CSTYPE_COUNT_MULTIPLE': {
      let count=0;
      for (const id of read(ctx,'targetableMonsterIds')) count+=invoke(ctx,'getCSCount',id,field(ctx,'options')[0]);
      return sumMode(count,type.endsWith('_ADD'));
    }
    case 'VALUE_TRIGGERED_DESIRE_STACK_ADD': case 'VALUE_TRIGGERED_DESIRE_STACK_MULTIPLY': {
      const id=field(ctx,'cardTriggered')??-1,card=id>0?read(ctx,'card',id):null;
      let count=0;
      if (card) {
        const talents=field(ctx,'options').map(name=>read(ctx,'talentEnum',name)).filter(talent=>talent!=null);
        for (const talent of talents) count+=invoke(ctx,'getDesireCount',card,talent);
      }
      return sumMode(count,type.endsWith('_ADD'));
    }
    case 'VALUE_TRIGGERED_BIND_STACK_ADD': {
      const card=read(ctx,'card',field(ctx,'cardTriggered')??-1);
      const explicit=field(ctx,'bindStackTriggered');
      const amount=explicit??(card&&field(card,'talents')?.includes(TALENT_BIND)?(field(card,'bind_count')??0)+1:0);
      return value+amount;
    }
    case 'VALUE_HAND_CARD_AMOUNT_EGO_MULTIPLY': case 'VALUE_HAND_CARD_AMOUNT_SAME_EGO_MULTIPLY':
    case 'VALUE_HAND_CARD_AMOUNT_SAME_EGO_USING_CARD_MULTIPLY': {
      let wanted=null;
      if (type==='VALUE_HAND_CARD_AMOUNT_SAME_EGO_MULTIPLY') {
        const char=read(ctx,'actionChar');
        if (!char) return 0;
        wanted=invoke(ctx,'convertEgoCommon',read(ctx,'charResourceEgo',field(char,'res_id')));
      } else if (type==='VALUE_HAND_CARD_AMOUNT_SAME_EGO_USING_CARD_MULTIPLY') {
        const before=read(ctx,'beforeUsedCard');
        if (!before) return value;
        wanted=invoke(ctx,'cardEgo',field(before,'id'));
      }
      let count=0;
      const unique=[];
      for (const id of combinedHand()) {
        const card=read(ctx,'card',id);
        if (invoke(ctx,'isCardUninteractible',id)||!card) continue;
        if (type==='VALUE_HAND_CARD_AMOUNT_SAME_EGO_MULTIPLY') {
          if (invoke(ctx,'cardCheckEgo',field(card,'id'),[wanted])) count++;
        } else {
          const ego=invoke(ctx,'cardEgo',field(card,'id'));
          if (type==='VALUE_HAND_CARD_AMOUNT_EGO_MULTIPLY') {
            if (!unique.includes(ego)) {unique.push(ego);count++;}
          } else if (ego===wanted||ego===read(ctx,'egoAll')||wanted===read(ctx,'egoAll')) count++;
        }
      }
      return value*count;
    }
    case 'VALUE_STAT_REVISE': {
      const source=invoke(ctx,'resolveStatSource',field(ctx,'statSource'));
      const stat=field(ctx,'options')[0];
      if (stat!=='S_ATK'&&stat!=='S_DEF') return value;
      const kind=stat==='S_ATK'?1:2;
      return procRevise(kind,procStatType(kind,value,read(ctx,'status',source,stat)),read(ctx,'reviseRates'));
    }
    case 'VALUE_NOTICE_ATTACK_MON_COUNT_ADD': case 'VALUE_NOTICE_ATTACK_MON_COUNT_MULTIPLY': {
      let count=0;
      for (const monster of read(ctx,'monsters')) {
        if (!invoke(ctx,'isFieldMonster',monster)) continue;
        const next=field(monster,'nextCard');
        if (next&&read(ctx,'cardResourceNoticeCategory',next).includes('ATK')) count++;
      }
      return sumMode(count,type.endsWith('_ADD'));
    }
    case 'VALUE_BEFORE_EFF_TARGET_COUNT_ADD': case 'VALUE_BEFORE_EFF_TARGET_COUNT_MULTIPLY':
    case 'VALUE_BEFORE_EFF_TARGET_COUNT_MULTIPLY_OPT_ADD': {
      const saved=read(ctx,'savedTarget'); // null means the root-parent key is known absent.
      if (saved===null) return value;
      const count=field(saved,0).length;
      if (type.endsWith('_OPT_ADD')) return value+count*option(ctx,0);
      return sumMode(count,type.endsWith('_ADD'));
    }
    case 'VALUE_CARD_TARGET_AMOUNT_ADD': case 'VALUE_CARD_TARGET_AMOUNT_MULTIPLY': {
      const targets=read(ctx,'currentCardDamageTargets');
      const cap=field(ctx,'options').length ? option(ctx,0) : Infinity;
      return sumMode(Math.min(targets?.length??0,cap),type.endsWith('_ADD'));
    }
    case 'VALUE_BEFORE_EFF_COUNT_VALUE': case 'VALUE_BEFORE_EFF_COUNT_VALUE_MULTIPLY': {
      const saved=read(ctx,'savedCountValue')??0;
      return type.endsWith('_MULTIPLY')?value*saved:saved;
    }
    case 'VALUE_BEFORE_EFF_APPLIED_VALUE': case 'VALUE_BEFORE_EFF_APPLIED_VALUE_MULTIPLY_PCT':
    case 'VALUE_BEFORE_EFF_APPLIED_VALUE_EQ0_SET0': {
      const saved=read(ctx,'savedValue');
      if (type.endsWith('_EQ0_SET0')) return saved!==null&&saved===0?0:value;
      return type.endsWith('_MULTIPLY_PCT')?value*((saved??0)/100):(saved??0);
    }
    case 'VALUE_BEFORE_EFF_APPLIED_COEFF_VALUE_ADD': {
      let numerator=1,denominator=1;
      if (field(ctx,'options').length) {
        const parts=String(field(ctx,'options')[0]).split(':');
        numerator=Number(parts[0]); denominator=Number(parts[1]);
      }
      return value+floorGame((read(ctx,'savedCoeffValue')??0)*numerator/denominator);
    }
    case 'VALUE_BEFORE_EFF_TARGET_COST_ADD': case 'VALUE_BEFORE_EFF_TARGET_COST_SUM_MULTIPLY': {
      const saved=read(ctx,'savedTarget');
      if (saved===null) return value;
      const cards=field(saved,0),isCard=field(saved,1);
      if (!isCard) return value;
      let amount=0;
      for (const id of cards) {
        const raw=invoke(ctx,'cardCost',id),cost=raw===-2?0:raw;
        amount=type.endsWith('_ADD')?Math.max(amount,cost):amount+Math.max(0,cost);
      }
      return sumMode(amount,type.endsWith('_ADD'));
    }
    case 'VALUE_TRIGGERED_CARD_COST_ADD': case 'VALUE_TRIGGERED_CARD_COST_MULTIPLY': {
      const amount=field(ctx,'valueTriggered');
      if (amount==null) throw new MissingValueInput('Triggered card cost is required');
      return sumMode(amount,type.endsWith('_ADD'));
    }
    case 'VALUE_UNIQUE_RITA_1': {
      const amount=field(ctx,'ritaValue');
      if (amount==null) throw new MissingValueInput('rita_value is required');
      return value*amount;
    }
    case 'VALUE_THIS_CARD_COST_APPLIED_ADD': case 'VALUE_THIS_CARD_COST_APPLIED_MULTIPLY': {
      const card=read(ctx,'currentCard');
      if (!card) return value;
      const cost=field(card,'cost_before_using')??Math.max(0,field(card,'cost_result'));
      return sumMode(cost,type.endsWith('_ADD'));
    }
    case 'VALUE_TARGET_CS_EXIST_ADD_OPT': {
      const target=field(ctx,'targetId');
      if (target==null) return value;
      const unit=read(ctx,'unitSkipError',target);
      if (!unit) return value;
      return csList(ctx,unit).some(cs=>links(ctx).includes(field(cs,'res_id')))?value+option(ctx,0,0):value;
    }
    case 'VALUE_TARGET_CS_COUNT_ADD_GT0': case 'VALUE_TARGET_CS_COUNT_MULTIPLY_GT0': {
      if (field(ctx,'targetId')==null) return value;
      const unit=read(ctx,'unitSkipError',field(ctx,'targetId'));
      if (!unit) return value;
      const opts=field(ctx,'options');
      const action=read(ctx,'actionCharId');
      const records=opts.includes('own_caster') ? read(ctx,'continueSkillsByCaster',unit,action) : csList(ctx,unit);
      const amount=csSum(records,links(ctx)[0],type.includes('_MULTIPLY_')&&opts.includes('own_other_char'),action);
      return csMode(amount,type.includes('_ADD_'));
    }
    case 'VALUE_CASTER_CS_COUNT_ADD_GT0': case 'VALUE_CASTER_CS_COUNT_MULTIPLY_GT0': {
      const records=read(ctx,'continueSkillsByChar',read(ctx,'actionCharId'));
      const amount=csSum(records,links(ctx)[0]);
      return csMode(amount,type.includes('_ADD_'));
    }
    case 'VALUE_TARGET_TRIGGERED_CS_COUNT_ADD_GT0': case 'VALUE_TARGET_TRIGGERED_CS_COUNT_MULTIPLY_GT0': {
      const target=field(ctx,'targetTriggered')?.[0];
      if (!target) return value;
      const unit=read(ctx,'unitSkipError',target);
      if (!unit) return value;
      const amount=csSum(csList(ctx,unit),links(ctx)[0]);
      return csMode(amount,type.includes('_ADD_'));
    }
    case 'VALUE_ADD_VALUE_OPT': {
      const options=field(ctx,'options'),extra=Number(options[0]);
      if (options.length<=1) return value+extra;
      if (field(ctx,'targetId')==null) return value;
      const target=read(ctx,'unit',field(ctx,'targetId'));
      const ego=field(target,'ego_field_egos')?.[0];
      return options.slice(1).some(opt=>ego===invoke(ctx,'convertEgoCommon',opt))?value+extra:value;
    }
    case 'VALUE_COND0_STACK_DIVIDE_BY_OPT_ADD': case 'VALUE_COND0_STACK_DIVIDE_BY_OPT_MULTIPLY': {
      const stack=read(ctx,'conditionStack0');
      if (!stack) return value;
      for (const divisor of field(ctx,'options')) {
        const amount=floorGame(field(stack,'stack')/divisor);
        value=type.endsWith('_ADD')?value+amount:value*amount;
      }
      return value;
    }
    case 'VALUE_OWNER_CS_AMOUNT_ADD': case 'VALUE_OWNER_CS_AMOUNT_MULTIPLY': {
      const link=links(ctx)[0];
      if (!link) return value;
      let count=0;
      for (const char of read(ctx,'allChars')) {
        const records=read(ctx,'continueSkillsByChar',field(char,'id'));
        if (records.some(cs=>cs&&!field(cs,'removed')&&field(cs,'res_id')===link)) count++;
      }
      return sumMode(count,type.endsWith('_ADD'));
    }
    case 'VALUE_CREDIT_AMOUNT_ADD': case 'VALUE_CREDIT_AMOUNT_MULTIPLY':
      return sumMode(floorGame((read(ctx,'creditAmount')??0)/option(ctx,0,1)),type.endsWith('_ADD'));
    case 'VALUE_OWNER_TURN_COUNT_OPT1_ADD_OPT2': {
      const turn=read(ctx,'casterMonsterTurn'),wanted=option(ctx,0);
      const matches=wanted===-1?turn==null:wanted===0?turn!=null&&turn<=0:turn==wanted;
      return matches?value+option(ctx,1):value;
    }
    case 'VALUE_THIS_CARD_TALENT_BIND_STACK_MULTIPLY':
      return value*((read(ctx,'parentCardBindCount')??-1)+1);
    case 'VALUE_THIS_CARD_TALENT_UNIQUE_OLGA_STACK_ADD': case 'VALUE_THIS_CARD_TALENT_UNIQUE_OLGA_STACK_MULTIPLY': {
      const coefficient=field(ctx,'options').length?option(ctx,0):1;
      return sumMode((read(ctx,'parentCardOlgaCount')??0)*coefficient,type.endsWith('_ADD'));
    }
    case 'VALUE_PLACE_MONSTER_CARD_AMOUNT_MULTIPLY': {
      const monsterCards=read(ctx,'monsterCards');
      return value*(monsterCards?Object.values(monsterCards).reduce((sum,ids)=>sum+ids.length,0):0);
    }
    case 'VALUE_PLACE_MONSTER_CASTER_CARD_AMOUNT_MULTIPLY': case 'VALUE_PLACE_MONSTER_CASTER_CARD_AMOUNT_MULTIPLY_PCT': {
      if (!read(ctx,'casterIsMonster')) throw new MissingValueInput('This rule requires a monster caster');
      const cards=read(ctx,'monsterCasterCards');
      const result=value*(cards?.length??0);
      return type.endsWith('_PCT')?roundGame(result/100):result;
    }
    case 'VALUE_CARD_DECK_TOP_COST_ADD': case 'VALUE_CARD_DECK_TOP_COST_MULTIPLY': {
      const deck=read(ctx,'deckIds'),limit=option(ctx,0,1);
      let total=0;
      for (let i=0;i<Math.min(limit,deck.length);i++) {
        const card=read(ctx,'card',deck[i]);
        if (card) total+=Math.max(0,field(card,'cost_result'));
      }
      return sumMode(total,type.endsWith('_ADD'));
    }
    case 'VALUE_MONSTER_AMOUNT_KILLED_ADD':
      return value+(read(ctx,'parentCardKilledCount')??0);
    case 'VALUE_FIELD_MONSTER_TURN_COUNT_SUM_ADD': case 'VALUE_FIELD_MONSTER_TURN_COUNT_SUM_MULTIPLY': {
      const pending=read(ctx,'turnOverDisBeforePending');
      const saved=pending?read(ctx,'turnOverDisBeforeMonsterTurnSum'):null;
      const total=pending&&saved!=null?saved:invoke(ctx,'sumFieldMonsterTurnCount',read(ctx,'monsters'));
      return sumMode(total,type.endsWith('_ADD'));
    }
    case 'VALUE_CHAR_HP_MAX_PCT': {
      const char=read(ctx,'actionChar');
      return char?value*field(field(field(char,'status'),'info'),'S_HP')/100:0;
    }
    case 'VALUE_MONSTER_HP_MAX_PCT': {
      const values=read(ctx,'targetableMonsterIds').map(id=>read(ctx,'status',id,'S_HP'));
      return value*Math.max(...values)/100;
    }
    case 'VALUE_LOST_HP_PCT':
      return value*Math.max(0,read(ctx,'initialCurrentHp')-read(ctx,'partyRawCurrentHp'))/100;
    case 'VALUE_TARGET_EGO_FIELD_MAX_PCT': {
      if (field(ctx,'targetId')==null) return value;
      const unit=read(ctx,'unit',field(ctx,'targetId'));
      return value*(field(unit,'ego_field_max_value')??0)/100;
    }
    case 'VALUE_TARGET_LOSE_EGO_MAX_MULTIPLY_OPT': {
      if (field(ctx,'targetId')==null) return 0;
      const unit=read(ctx,'unit',field(ctx,'targetId'));
      const lost=floorGame((field(unit,'ego_field_max_value')??0)-(field(unit,'ego_field_value')??0));
      return value*Math.min(lost,option(ctx,0,Infinity));
    }
    case 'VALUE_CARD_TARGET_NOTICE_ATTACK_DAMAGE_MULTIPLY': {
      const id=read(ctx,'selectedTarget');
      if (id<=0) return value*0;
      const unit=read(ctx,'unit',id);
      return value*(field(unit,'noticeDamage')??0);
    }
    default: throw new UnsupportedValueRule(`Unimplemented value type: ${type}`);
  }
}

export const normalizeCharacterId=id=>[4,5,6].includes(id)?id-3:id;
export function getSavedIndex(rootParent) {
  if (rootParent===null) return '';
  if (rootParent===undefined) throw new MissingValueInput('Unknown root parent');
  return field(rootParent,'type').toLowerCase()+field(rootParent,'id');
}
export function getStatSource(type,ids) {
  const party=()=>field(ids,'partyId');
  const first=()=>field(ids,'firstMonsterId');
  const monster=id=>{
    const f=field(ids,'isMonster');
    if (typeof f!=='function') throw new MissingValueInput('isMonster must be a query');
    const result=f(id);
    if (result===undefined) throw new MissingValueInput(`Unknown unit classification: ${id}`);
    return result;
  };
  switch(type) {
    case 'NONE':return normalizeCharacterId(field(ids,'actionCharId'));
    case 'STAT_SOURCE_MONSTER':return first();
    case 'STAT_SOURCE_USER':return party();
    case 'STAT_SOURCE_OWNER': {const id=field(ids,'casterId');return monster(id)?id:party();}
    case 'STAT_SOURCE_APPLY': {const id=field(ids,'applyId');return monster(id)?id:party();}
    case 'STAT_SOURCE_ENEMY':return monster(field(ids,'casterId'))?party():first();
    case 'STAT_SOURCE_TRIGGERED_CHAR':return -1;
    default:throw new UnsupportedValueRule(`Unknown stat source: ${type}`);
  }
}

export function resolveStatSource(source,inputs) {
  if (source!==-1) return source;
  const triggered=field(inputs,'triggeredCard');
  if (triggered) return normalizeCharacterId(field(triggered,'char_id'));
  return field(inputs,'partyId');
}

export function applyValueChange(base,multiChange,plusChange) {
  return base*(1+multiChange)+plusChange;
}

// Pure inspected tail of calcValue / calcCountValue. All upstream filtering,
// powerstep, reinforcement, value-change and CS-enchant stages remain separate.
export function applyTermRule(value,term,operation,round=true) {
  const r=round?roundGame:x=>x;
  if (operation==='OPERATION_NONE') return r(value);
  if (operation==='OPERATION_TERM_VALUE_ADD') return r(value)+term;
  if (operation==='OPERATION_TERM_VALUE_MULTIPLE') return r(value)*term;
  if (operation==='OPERATION_TERM_VALUE_SET') { r(value);return term; }
  if (operation==='OPERATION_TERM_VALUE_MULTIPLE_BEFORE_ROUND') return r(value*term);
  throw new UnsupportedValueRule(`Unknown term operation: ${operation}`);
}

export function applyConditionStacks(value,stack0,stack1) {
  for (const [i,item] of [stack0,stack1].entries()) {
    if (i===1&&stack0?.sign==='MATHSIGN_SET') break;
    if (item===null) continue; // Explicitly known absent; undefined is an input gap.
    if (item===undefined) throw new MissingValueInput(`Unknown condition stack ${i}`);
    value=applyMathSign(field(item,'sign'),value,field(item,'stack')*field(item,'coefficient'));
  }
  return value;
}
