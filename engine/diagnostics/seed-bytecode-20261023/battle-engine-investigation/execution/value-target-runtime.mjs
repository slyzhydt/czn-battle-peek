// Adapter over the independently hand-ported value and target pipelines.
// The full, nontruncated object snapshot distinguishes absent optional members
// from unknown required fields. Optional JS undefined reads are represented as
// null only at the strict pipeline boundary; writes still hit the live fork.
import fs from 'node:fs';
import {createValueCalculator} from '../calculation/value-pipeline.mjs';
import {getTargetCardsReconstructed,getSkillEffTargetReconstructed,resolveParentCardIDs} from '../targeting/target-core.mjs';
import {getTargetableMonsterIDs,getAllCharacters} from '../targeting/targetable-monsters.mjs';
import {applyUnitOptionFilters} from '../targeting/unit-option-filters.mjs';
import {allCardSkillEffIds} from '../targeting/card-target-helpers.mjs';
import {MissingBattleRule} from './resource-store.mjs';
const OPTIONAL=new Set(('changed_value changed_count_value r_spark_value r_spark_count_value termValue cs_value_category cs_operation_rule stack_value0 stack_value1 stack_count0 stack_count1 rand randValue randCount randCountValue randTcslc randTcslcValue last_count_value eff_opts randValues value_triggered rita_value ep_skill by_testament testament_bullet_snapshot r_spark_skill_eff_ids eidolon_skill_eff_ids talents tipera_ran_skill_index nihilum_stack show_cs_res_id current_card assault_fourth_char cardUses target_unit_type_opt target_triggered card_triggered before_activated_card before_used_card before_used_card_targets ps_offset assault_slot_ps assault_ps nextCard target_card_set_list_count mon_turn ego_field_max_value ego_field_value ego_breaked removed S_CHAR_CARD_DMG_SHIELD_CURE_VALUE_HUND_ADD_PCT S_NODE_REINFORCE_CARD_START S_NODE_REINFORCE_CARD_UNIQUE S_NODE_REINFORCE_CARD_NEUTRAL').split(' '));
const NUMERIC=new Set(('eff_value eff_count_value eff_card_target_count target_card_set_list_count eff_condition_value_0 eff_condition_value_1 eff_condition_count_value_0 eff_condition_count_value_1 eff_card_value_min dmg_revise shield_revise cure_revise cost run_pct').split(' '));
const ARRAYS=new Set(('value_opt_1 value_opt_2 value_opt_1_multiple_link value_opt_2_multiple_link eff_opt_multiple_link eff_attr eff_count_value_type_opt eff_count_value_type_opt_multiple_link target_card_set_opt_multiple_link target_card_set_card_sort target_card_set_ego_type target_card_set_card_type target_card_set_talent target_card_set_faction target_card_set_card_debuff target_unit_type_opt target_unit_type_opt_link_cs_id').split(' '));
// These are immutable decoder dictionaries, not per-battle configuration.
// Build them once; every preview still owns its battle views and calculators.
const PLACES={};for(const m of fs.readFileSync(new URL('../../card-pool-investigation/gamecore/battle/battle_enums.js.recovered.js',import.meta.url),'utf8').matchAll(/arg0\.(CARD_PLACE_[A-Z_]+) = (\d+)/g)){PLACES[m[1]]=Number(m[2]);PLACES[Number(m[2])]=m[1];}
if(PLACES.CARD_PLACE_HAND!==2)throw new MissingBattleRule('card_place_enum_evidence');
Object.freeze(PLACES);
const TARGET_TALENTS=Object.freeze(JSON.parse(fs.readFileSync(new URL('../../card-pool-investigation/talent-enum.json',import.meta.url),'utf8')));
export class ValueTargetRuntime {
  constructor(e){
    this.e=e;this.b=e.b;this.w=e.wt;this.db=e.db;this.views=new WeakMap();this.rows=new Map();
    this.places=PLACES;this.talents=TARGET_TALENTS;
    const runtime=this;
    const env={get battle(){return runtime.battleView();},get battleInit(){return runtime.view(e.state.worktables.BattleInitWorktable.battle_init);},
      get isPreview(){return !!e.wt.isPreview;},getSkill:id=>this.view(this.b.skillMap[id])??null,
      getResource:(table,id)=>this.resource(table,id),getParentCard:id=>this.view(this.call('getParentCard',id))??null,
      queryPassive:q=>e.passives.query(q).map(x=>this.view(x)),decodeArray:v=>this.db.array(v),
      isMonsterByID:id=>!!e.getMonster(id),getUnitByID:id=>this.view(e.getUnit(id)),
      tryGetCharByCharId:id=>this.view(this.call('tryGetCharByCharId',id))??null,
      getAttrInfo:(...a)=>this.call('getAttrInfo',...a),nextRange:(a,b)=>e.random.randRange(0,a,b),
      makeValueContext:(id,targetId,from,extra)=>this.valueContext(id,targetId,from,extra),
      // Native callers use this predicate's truthiness; several confirmed
      // reject branches return undefined. The strict pipeline needs false.
      checkValueAddOpts:(...a)=>!!this.call('checkValueAddOpts',...a),checkTermValuePassive:(...a)=>this.call('checkTermValuePassive',...a)};
    this.calculator=createValueCalculator(env);
    // GameRandom.nextFloat0x3e00 divides by modulus-1. nextRange0x4500
    // separately divides by modulus; using its denominator here changes picks.
    this.rng={nextRange:(a,b)=>e.random.randRange(0,a,b),nextFloat:()=>e.random.nextInt(0)/2147483647,randomArrayMember:a=>e.random.randomArrayMember(0,a),randomArrayMembers:(...a)=>this.call('randomArrayMembers',0,...a)};
  }
  call(n,...a){return this.e.call(n,...a);}
  cardPlace(value){if(value==null)return value;if(!(value in this.places))throw new MissingBattleRule('card_place_enum',{value});return this.places[value];}
  view(o){
    if(o==null||typeof o!=='object')return o;if(this.views.has(o))return this.views.get(o);
    const p=new Proxy(o,{get:(t,k)=>{const v=t[k];if(k==='status'||k==='info')return this.view(v);return v===undefined&&OPTIONAL.has(k)?null:v;},set:(t,k,v)=>{t[k]=v;return true;},getOwnPropertyDescriptor:(t,k)=>Reflect.getOwnPropertyDescriptor(t,k)??(OPTIONAL.has(k)?{value:null,writable:true,enumerable:false,configurable:true}:undefined)});
    this.views.set(o,p);return p;
  }
  mapView(map,card=false){return new Proxy(map,{get:(t,k)=>{const o=t[k];if(o==null||typeof o!=='object')return o;const v=this.view(o);return card?new Proxy(v,{get:(t,k)=>k==='card_place'?this.cardPlace(t[k]):t[k]}):v;}});}
  battleView(){
    const maps={skillMap:this.mapView(this.b.skillMap),csMap:this.mapView(this.b.csMap),cardMap:this.mapView(this.b.cardMap,true)};
    return new Proxy(this.view(this.b),{get:(t,k)=>maps[k]??(k==='monsters'?t[k].map(x=>this.view(x)):t[k])});
  }
  resource(table,id){
    const key=table+':'+id;if(this.rows.has(key))return this.rows.get(key);const raw=this.db.get(table,id),row={...raw};
    for(const key of Object.keys(row)){if(NUMERIC.has(key))row[key]=this.db.number(raw,key);else if(ARRAYS.has(key))row[key]=this.db.array(row[key]);}
    this.rows.set(key,row);return row;
  }
  calcValue(...a){return this.calculator.calcValue(...a);}
  calcCountValue(...a){return this.calculator.calcCountValue(...a);}
  calcEffCardTargetCount(...a){return this.calculator.calcEffCardTargetCount(...a);}
  calcTargetCardSetListCount(...a){return this.calculator.calcTargetCardSetListCount(...a);}
  getSavedIndex(id){const p=this.call('getRootParent',id);return p?p.type.toLowerCase()+p.id:'';}
  // BattleCardProc 0x87700/0x88900, literal grammar and origin/X behavior.
  parseCardCostFilter(value,context){
    if(!value)return;const cleaned=value.replace(/[\[\]]/gi,'');if(cleaned.length===0)return;
    let use_origin=false;const costs=[];
    for(const item of cleaned.split(',')){
      const token=item.trim();
      if(token==='')throw new MissingBattleRule('use_empty_target_card_set_opt_cost',{value,context});
      if(token==='origin'){use_origin=true;continue;}
      if(token==='X'||token==='x'){costs.push(-1);continue;}
      const n=Number(token);if(Number.isNaN(n))throw new MissingBattleRule('invalid_token_in_target_card_set_opt_cost',{token,value,context});costs.push(n);
    }
    if(costs.length)return {use_origin,costs};
  }
  applyCardCostFilter(filter,id,computed){
    const c=this.b.cardMap[id];if(!c||c.cost===-2)return false;if(c.cost===-1)return filter.costs.includes(-1);
    return filter.costs.includes(filter.use_origin?c.cost:computed!==undefined?computed:this.call('getCost',id));
  }
  isCardReservedForUse(id){return this.b.cardUses?.some(x=>x.card_id==id||(x.card_ids?.includes(id)??false))??false;}
  isCardUninteractible(id){
    const c=this.b.cardMap[id];if(!c)return false;const talent=this.talents.TALENT_UNINTERACTIBLE;
    if(c.talents?.includes(talent))return true;
    return this.e.passives.query({source_id:c.id,type:'SKILL_EFF_CARD_TALENT',is_card:true,talent}).length>0;
  }
  getCountValueAdditional(cardId,id){
    const s=this.b.skillMap[id],r=this.resource('skill_eff',s.res_id);if(r.eff_attr.includes('DMG_ATTR_ADDITIONAL_ATTACK'))return 0;
    let result=0;if(cardId>0){
      const card=this.b.cardMap[cardId],cr=this.resource('card',card.res_id);
      if(!['SORT_COLLAPSE_SKILL','SORT_COLLAPSE','SORT_SUPPORT','SORT_BREAK_IN'].includes(cr.sort)){
        const cp=this.e.passives.query({source_id:cardId,type:'SKILL_EFF_COUNT_VALUE_ADDITIONAL',is_card:true});
        const up=this.e.passives.query({source_id:this.b.char.id,type:'SKILL_EFF_COUNT_VALUE_ADDITIONAL',is_card:false,char_id:s.action_char_id});
        for(const p of up.concat(cp)){
          const opts=p.eff_opts??[];if(!opts.includes(r.eff)||opts.includes('active_only')&&r.operation!=='OPERATION_ACTIVE')continue;
          if(opts.includes('multi')&&this.calcCountValue(id)+result<=1)continue;
          if(!this.call('checkValueAddOpts',{passive_id:p.skill_id,card_id:cardId,skill_id:id}))continue;
          result+=this.calcValue(p.skill_id);this.call('checkTermValuePassive',p.skill_id,s.caster_id);
        }
      }
    }return result;
  }
  valueContext(id,targetId,from,extra){
    const s=this.b.skillMap[id],r=this.resource('skill_eff',s.res_id),raw=(obj,key)=>{if(!(key in obj))throw new MissingBattleRule('value_fact:'+key);return obj[key]??null;};
    const read=(key,...args)=>{
      switch(key){
        case 'monsters':return this.b.monsters.map(x=>this.view(x));
        case 'cardResourceNoticeCategory':return this.db.get('card',args[0]).monster_noti_category;
        case 'turn':return this.b.turn;
        case 'savedTarget':return this.b.savedTarget[this.getSavedIndex(id)]??null;
        case 'savedValue':return this.b.savedValue[this.getSavedIndex(id)]??null;
        case 'savedCountValue':return this.b.savedCountValue[this.getSavedIndex(id)]??null;
        case 'savedCoeffValue':return this.b.savedCoeffValue[this.getSavedIndex(id)]??null;
        case 'parentCard':return this.view(this.call('getParentCard',id))??null;
        case 'parentCS':return s.parent.type==='CS'?this.view(this.b.csMap[s.parent.id])??null:null;
        case 'casterIsMonster':return !!this.e.getMonster(s.caster_id);
        // procValueType 0x1c9200 offsets13410..13499: source HP is a
        // status query at evaluation time, not cached raw status.info.
        case 'casterMaxHp':return this.call('getStatus',s.caster_id,'S_HP');
        case 'actionCharId':return s.action_char_id;
        case 'status':return this.call('getStatus',...args);
        case 'unit':return this.view(this.e.getUnit(args[0]));
        case 'unitSkipError':return this.view(this.e.getUnit(args[0],true))??null;
        case 'card':return this.view(this.b.cardMap[args[0]])??null;
        case 'currentCard':return this.b.current_card??null;
        case 'beforeUsedCard':return this.b.before_used_card??null;
        case 'selectedTarget':return this.b.select_target;
        case 'targetUnitType':return r.target_unit_type;
        case 'allCardIds':return this.b.deck_info.all;
        case 'handIds':return this.b.deck_info.hand;
        case 'deckIds':return this.b.deck_info.deck;
        case 'discardIds':return this.b.deck_info.discard;
        case 'usedIds':return this.b.deck_info.used;
        case 'usingIds':return this.b.deck_info.using;
        case 'allChars':return getAllCharacters(this.battleView());
        case 'targetableMonsterIds':return this.getTargetableMonstersID(args[0]);
        case 'turnOverDisBeforePending':return this.b.turn_over_dis_before_pending??null;
        case 'turnOverDisBeforeMonsterTurnSum':return raw(this.b,'turn_over_dis_before_monster_turn_sum');
        default:return this.call('readValueFact',key,{skill_id:id,targetId,from,extra},...args);
      }
    };
    const base={targetId,from,extra,isPreview:!!this.w.isPreview,preSkillEvalDepth:this.w.preSkillEvalDepth,
      effect:r.eff,valueTriggered:s.value_triggered??null,ritaValue:s.rita_value??null,statSource:s.stat_source,
      nextRange:(a,b)=>this.e.random.randRange(0,a,b),isFieldMonster:m=>this.call('isFieldMonster',m),
      resolveStatSource:(...a)=>this.call('resolveStatSource',...a),read};
    return this.e.valueFacts.completeValueContext(base,id,targetId,from,extra);
  }
  targetAPI(id){
    const s=this.b.skillMap[id],r=s?this.resource('skill_eff',s.res_id):null;
    const api={
      calcValue:(...a)=>this.calcValue(...a),calcEffCardTargetCount:(...a)=>this.calcEffCardTargetCount(...a),calcTargetCardSetListCount:(...a)=>this.calcTargetCardSetListCount(...a),
      getPassiveByType:q=>this.e.passives.query(q),getUnitByID:id=>this.view(this.e.getUnit(id)),isMonsterByID:id=>!!this.e.getMonster(id),
      skillEffInfo:id=>this.resource('skill_eff',id),readCardResource:id=>this.resource('card',id),readMonsterResource:id=>this.resource('monster',id),
      unitState:name=>name,statEnum:name=>name,readStatusInfo:(u,key)=>{const value=u.status.info[key];if(value===undefined)throw new MissingBattleRule('target_raw_status:'+key);return value;},
      breakCSChanges:this.e.state.worktables.BattleStageWorktable.battle_stage.break_cs_changes??null,
      unitMultipleLinks:()=>r.target_unit_type_opt_multiple_link?this.db.array(r.target_unit_type_opt_multiple_link):[],
      getAllChars:()=>getAllCharacters(this.battleView()),getTargetableMonstersID:q=>this.getTargetableMonstersID(q),
      getSavedUnitTarget:id=>this.b.savedTarget[this.getSavedIndex(id)],getSavedCardTarget:s=>this.b.savedTarget[this.getSavedIndex(s.skill_id)],
      resolveThisCardIDs:s=>resolveParentCardIDs(this.battleView(),s),applyUnitOptionFilters,
      getAllCardSkillEffIds:id=>this.getAllCardSkillEffIds(this.b.cardMap[id]),
      parseCardCostFilter:(...a)=>this.parseCardCostFilter(...a),applyCardCostFilter:(...a)=>this.applyCardCostFilter(...a),
      isCardReservedForUse:id=>this.isCardReservedForUse(id),isCardUninteractible:id=>this.isCardUninteractible(id),
      isRestricted:(id,type)=>this.call('isRestricted',this.b.cardMap[id],type),
      shuffleCard:isDraw=>this.call('shuffleCard',isDraw),reportContentError:message=>{throw new MissingBattleRule('content_error',{message});}
    };
    return new Proxy(api,{get:(t,k)=>k in t?t[k]:(...args)=>this.call(k,...args)});
  }
  getSkillEffTarget(id,forcePreview=false){
    const s=this.b.skillMap[id],r=this.resource('skill_eff',s.res_id),changes=this.e.state.worktables.BattleStageWorktable.battle_stage.break_cs_changes;
    return getSkillEffTargetReconstructed({battle:this.battleView(),skill:this.view(s),skillId:id,row:r,api:this.targetAPI(id),isPreview:!!this.w.isPreview,forcePreview,casterIsMonster:!!this.e.getMonster(s.caster_id),rng:this.rng,linkedCS:r.target_unit_type_opt_link_cs_id.map(x=>changes?.[x]??x)});
  }
  getTargetCards(id,query=false,ignoreCount=false,alreadyShuffled=false,overridePlace){
    const s=this.b.skillMap[id],r=this.resource('skill_eff',s.res_id);
    const result=getTargetCardsReconstructed({battle:this.battleView(),skill:this.view(s),skillId:id,row:r,api:this.targetAPI(id),isPreview:!!this.w.isPreview,rng:this.rng,query,ignoreCount,alreadyShuffled,overridePlace:typeof overridePlace==='number'?this.cardPlace(overridePlace):overridePlace});
    return {...result,from:this.cardPlace(result.from),to:this.cardPlace(result.to)};
  }
  getTargetableMonstersID(q={}){return getTargetableMonsterIDs({battle:this.battleView(),api:this.targetAPI(q.skill_id)},q);}
  getAllCardSkillEffIds(card){return allCardSkillEffIds(card);}
}
