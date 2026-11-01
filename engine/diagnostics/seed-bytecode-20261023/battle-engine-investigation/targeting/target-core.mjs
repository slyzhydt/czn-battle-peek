// Independent handwritten reconstruction. Never evaluates recovered target code.
// Sources, placement, option filters, dynamic counts and RNG remain separate
// stages; the public entry points below compose their local algorithms.
import { UnresolvedTargetRule, pickResolvedRandomTarget, orderResolvedCards,numberByRarity } from './selection-core.mjs';
import {filterLinkedCSCards} from './linked-cs-card-filters.mjs';
import {applyUnitOptionFilters as filterUnitOptions} from './unit-option-filters.mjs';
import {getTargetableMonsterIDs,getAllCharacters} from './targetable-monsters.mjs';
import {allCardSkillEffIds,cardTriggersInspiration} from './card-target-helpers.mjs';
const need=(ok,msg)=>{if(!ok)throw new UnresolvedTargetRule(msg);};
const call=(api,name,...args)=>{need(typeof api[name]==='function',`missing ${name}`);return api[name](...args);};
const list=(value,name)=>{need(Array.isArray(value),`missing resolved array ${name}`);return value;};
const field=(object,key)=>{need(object!=null&&Object.hasOwn(object,key),`missing ${key}`);return object[key];};
const gameError=message=>{throw new Error(`game behavior: ${message}`);};
const normalizeOwner=id=>[4,5,6].includes(id)?id-3:id;

export function resolveParentCardIDs(battle,skill) {
  const parent=field(skill,'parent');
  if(parent.type==='CARD')return [parent.id];
  if(parent.type==='SKILL') {
    const nested=battle.skillMap[parent.id];need(nested!=null,`missing parent skill ${parent.id}`);
    if(nested.parent.type==='CARD')return [nested.parent.id];
    if(nested.parent.type!=='CS')return [];
    return resolveParentCardIDs(battle,nested);
  }
  if(parent.type!=='CS')return [];
  const cs=battle.csMap[parent.id];if(!cs)return [];
  if(cs.caster_id in battle.cardMap)return [cs.caster_id];
  if(cs.owner_id in battle.cardMap)return [cs.owner_id];
  if(list(field(battle.deck_info,'using'),'using').length)return battle.deck_info.using.slice();
  gameError(`err:invalid_card_set_this_card:${skill.res_id}`);
}

/** Select ONLY the card source stage, bytecode +669..+9380, before placement/filters.
 * row arrays MUST already be decoded through GameResDB.toArray, not guessed from text.
 * `resolveThisCardIDs(skill, purpose)` must reproduce parent CARD/CS/SKILL behavior;
 * owner/ego/previous-effect rules require that callback only when encountered.
 */
export function resolveCardSource({battle,skill,row,api={}}) {
  const all=list(field(battle.deck_info,'all'),'deck_info.all'), cards=field(battle,'cardMap');
  const card=id=>{need(cards[id]!=null,`missing card ${id}`);return cards[id];};
  const opts=()=>list(field(row,'target_card_set_opt_multiple_link'),'target_card_set_opt_multiple_link');
  const action=()=>field(skill,'action_char_id');
  const owner=()=>normalizeOwner(action());
  const thisCards=purpose=>typeof api.resolveThisCardIDs==='function'?api.resolveThisCardIDs(skill,purpose):resolveParentCardIDs(battle,skill);
  let ids=[],forcedIds=[],logAllEligible=true;
  switch(row.target_card_set) {
    case 'CARD_SET_NONE':case 'CARD_SET_ALL':ids=all.slice();break;
    case 'CARD_SET_ALL_INCLUDE_DESIGNED': {
      const resids=opts();ids=all.slice();
      forcedIds=all.filter(id=>{const c=card(id),s=String(c.res_id);let found='_rsp';
        // Closure variable found is overwritten by Array.some callback, not a regex.
        const has=['_lbk','_pot','_rsp'].some(middle=>{found=middle;return s.includes(found);});
        return resids.includes(c.res_id)||resids.includes(has?s.split(found)[0]:c.res_id);
      });break;
    }
    case 'CARD_SET_TRIGGER_INSPIRATION':case 'CARD_SET_TRIGGER_ATTUNMENT': {
      const opt=row.target_card_set==='CARD_SET_TRIGGER_INSPIRATION'?'trigger_inspiration':'trigger_attunment';
      ids=all.filter(id=>{
        if(!cards[id])return false;
        return list(typeof api.getAllCardSkillEffIds==='function'?api.getAllCardSkillEffIds(id):allCardSkillEffIds(card(id)),'card skillEffIds').some(sid=>(battle.skillMap[sid].eff_opts??[]).includes(opt))||
          (card(id).continueSkill??[]).some(cid=>battle.csMap[cid].skillEffs.some(sid=>(battle.skillMap[sid].eff_opts??[]).includes(opt)));
      });break;
    }
    case 'CARD_SET_DESIGNED':ids=all.filter(id=>opts().includes(card(id).res_id));logAllEligible=false;break;
    case 'CARD_SET_DESIGNED_R_SPARK':ids=all.filter(id=>card(id).r_spark?.category==='CATEGORY_UNIQUE'&&opts().includes(card(id).r_spark.res_id));logAllEligible=false;break;
    case 'CARD_SET_ALL_EXCEPT_DESIGNED':ids=all.filter(id=>!opts().includes(card(id).res_id));logAllEligible=false;break;
    case 'CARD_SET_CHAR_EXCEPT_DESIGNED':ids=all.filter(id=>card(id).char_id==action()&&!opts().includes(card(id).res_id));logAllEligible=false;break;
    case 'CARD_SET_CHAR_EXCEPT_THIS_CARD': {
      const thisId=thisCards('CHAR_EXCEPT_THIS_CARD')[0];
      ids=all.filter(id=>card(id).char_id==action()&&id!=thisId);logAllEligible=false;break;
    }
    case 'CARD_SET_CHAR_EXCEPT_THIS_R_SPARK': {
      const thisId=thisCards('CHAR_EXCEPT_THIS_R_SPARK')[0],thisCard=card(thisId);
      ids=all.filter(id=>card(id).char_id==action()&&(card(id).res_id!=thisCard.res_id||card(id).r_spark?.res_id!=thisCard.r_spark?.res_id));logAllEligible=false;break;
    }
    case 'CARD_SET_CHAR_EGO': {
      const char=call(api,'tryGetCharByCharId',action());if(!char)gameError(`err:invalid_card_set_char_ego:${skill.res_id}`);
      const ego=call(api,'convertEgoCommon',call(api,'charCombatantEgo',char.res_id));
      ids=all.filter(id=>call(api,'checkEgo',id,[ego]));logAllEligible=false;break;
    }
    case 'CARD_SET_CHAR':ids=all.filter(id=>card(id).char_id==owner());logAllEligible=false;break;
    case 'CARD_SET_NOT_CHAR_OWNER':ids=all.filter(id=>card(id).char_id!=owner());logAllEligible=false;break;
    case 'CARD_SET_EXCEPT_CHAR_OWNER':ids=all.filter(id=>card(id).char_id!=owner()&&card(id).char_id!=-1);logAllEligible=false;break;
    case 'CARD_SET_THIS_CARD':ids=list(thisCards('THIS_CARD'),'this cards');logAllEligible=false;break;
    case 'CARD_SET_ALL_EXCEPT_THIS_CARD': {
      const thisIds=list(thisCards('ALL_EXCEPT_THIS_CARD'),'this cards');
      // At +6532 only target_cards[0] is excluded, not every fallback using card.
      ids=all.filter(id=>id!=thisIds[0]);logAllEligible=false;break;
    }
    case 'CARD_SET_ALL_EXCEPT_OWN_EGO': {
      const thisId=thisCards('ALL_EXCEPT_OWN_EGO')[0],ego=call(api,'getEgo',thisId);
      ids=all.filter(id=>call(api,'getEgo',id)!=ego);logAllEligible=false;break;
    }
    case 'CARD_SET_BEFORE_EFF_TARGET': {
      const saved=call(api,'getSavedCardTarget',skill);if(!saved)gameError(`err:invalid_save_target_type:${skill.res_id}`);
      ids=saved[1]?list(saved[0],'saved card target'):[];logAllEligible=false;break;
    }
    case 'CARD_SET_BEFORE_EFF_EXCEPT_TARGET': {
      const saved=call(api,'getSavedCardTarget',skill);if(!saved)gameError(`err:invalid_save_target_type:${skill.res_id}`);
      if(saved[1]){const selected=new Set(list(saved[0],'saved card target'));ids=list(call(api,'getSavedCardCandidates',skill),'saved card candidates').filter(id=>!selected.has(id));}
      logAllEligible=false;break;
    }
    case 'CARD_SET_TURN_DRAW':ids=list(field(battle,'turn_draw_cards'),'turn_draw_cards');logAllEligible=false;break;
    case 'CARD_SET_TURN_DRAW_CHAR':ids=list(field(battle,'turn_draw_cards'),'turn_draw_cards').filter(id=>card(id).char_id==action());logAllEligible=false;break;
    case 'CARD_SET_USING': {
      const trigger=field(skill,'card_triggered'),current=field(battle,'current_card');
      const id=trigger!=null&&trigger in cards?trigger:(current in cards?current:field(battle,'before_used_card'));
      ids=id in cards?[id]:[];logAllEligible=false;break;
    }
    case 'CARD_SET_USED_BEFORE': {const id=field(battle,'before_activated_card');ids=id in cards?[id]:[];logAllEligible=false;break;}
    case 'CARD_SET_TRIGGERED':if(!field(skill,'card_triggered'))gameError(`err:invalid_CARD_SET_TRIGGERED:${skill.res_id}`);ids=[skill.card_triggered];logAllEligible=false;break;
    case 'CARD_SET_TRIGGERED_OWNER': {
      if(!field(skill,'card_triggered'))gameError(`err:invalid_CARD_SET_TRIGGERED:${skill.res_id}`);
      const target=normalizeOwner(card(skill.card_triggered).char_id);ids=all.filter(id=>card(id).char_id==target);logAllEligible=false;break;
    }
    case 'CARD_SET_USABLE':call(api,'checkCards');ids=list(field(battle.deck_info,'hand'),'hand').filter(id=>call(api,'isCardAvailable',id));logAllEligible=false;break;
    case 'CARD_SET_USE_THIS_TURN':ids=list(field(battle,'this_turn_used_cards'),'this_turn_used_cards').slice();logAllEligible=false;break;
    // Defined enum/resource values have no dedicated switch case in this method.
    // Preserve its known default for these values, not their English implication.
    case 'CARD_SET_GET_CARD':case 'CARD_SET_REWARD_ID':case 'CARD_SET_CLASS':ids=all.slice();break;
    default:throw new UnresolvedTargetRule(`unimplemented target_card_set ${row.target_card_set}; game default is all.slice()`);
  }
  return {ids,forcedIds,logAllEligible};
}

/** Placement stage +9380..+12323. Resolved CARD_PLACE names are required.
 * Mixed-place branches preserve SOURCE order; individual piles use PILE order.
 * `overridePlace` matches argument 5 and replaces candidates only, not from/to.
 */
export function placeCardSource(source,{battle,skill,row,api={},overridePlace}) {
  const selected=source.ids,deck=battle.deck_info,has=id=>selected.includes(id),card=id=>{need(battle.cardMap[id]!=null,`missing card ${id}`);return battle.cardMap[id];};
  const pile=name=>list(field(deck,name),name),isMove=['SKILL_EFF_CARD_EXHAUST','SKILL_EFF_CARD_MOVE_TO','SKILL_EFF_CARD_MOVE_TO_MONSTER_JUDGMENT'].includes(row.eff);
  const isPending=id=>(field(battle,'cardUses')??[]).some(use=>use.card_id==id);
  const intersection=name=>pile(name).filter(has);
  let from=row.target_card_set_list_card_place,to=row.eff_card_place,ids=[],handUI=false;
  if(['SKILL_EFF_CARD_DRAW','SKILL_EFF_CARD_DRAW_WHILE_UNIQUE'].includes(row.eff)){
    from='CARD_PLACE_DECK';to='CARD_PLACE_HAND';ids=pile('deck').filter(id=>has(id)&&!call(api,'isCardReservedForUse',id));
  }else if(row.eff==='SKILL_EFF_CARD_DISCARD'){
    from='CARD_PLACE_HAND';to='CARD_PLACE_DISCARD';handUI=true;ids=pile('hand').filter(id=>has(id)&&!isPending(id));
  }else if(row.eff==='SKILL_EFF_CARD_EXHAUST'){
    from='CARD_PLACE_HAND';to='CARD_PLACE_EXHAUST';handUI=true;const allow=(field(skill,'eff_opts')??[]).includes('before_pending');ids=pile('hand').filter(id=>has(id)&&(allow||!isPending(id)));
  }else{
    const mixed={CARD_PLACE_DISCARD_USED:['DISCARD','USED'],CARD_PLACE_DECK_DISCARD:['DECK','DISCARD'],CARD_PLACE_DECK_HAND:['DECK','HAND'],CARD_PLACE_DISCARD_HAND:['DISCARD','HAND'],CARD_PLACE_DECK_HAND_DISCARD:['DECK','HAND','DISCARD'],CARD_PLACE_DISCARD_USED_HAND:['DISCARD','USED','HAND'],CARD_PLACE_DECK_DISCARD_USED:['DECK','DISCARD','USED'],CARD_PLACE_DECK_DISCARD_USED_USING:['DECK','DISCARD','USED','USING']};
    const movePendingExcluded=['CARD_PLACE_DISCARD_HAND','CARD_PLACE_DECK_HAND_DISCARD','CARD_PLACE_DISCARD_USED_HAND','CARD_PLACE_DECK_DISCARD_USED','CARD_PLACE_DECK_DISCARD_USED_USING'];
    if(Object.hasOwn(mixed,from))ids=selected.filter(id=>mixed[from].map(x=>'CARD_PLACE_'+x).includes(card(id).card_place)&&!(isMove&&movePendingExcluded.includes(from)&&card(id).card_place==='CARD_PLACE_DISCARD'&&card(id).testament_pending));
    else switch(from){
      case 'CARD_PLACE_NONE':from='CARD_PLACE_ALL';ids=selected.slice();break;
      case 'CARD_PLACE_ALL':ids=selected.slice();break;
      case 'CARD_PLACE_EXCEPT_EXHAUST_MONSTER':ids=selected.filter(id=>!['CARD_PLACE_EXHAUST','CARD_PLACE_MONSTER','CARD_PLACE_NONE'].includes(card(id).card_place));break;
      case 'CARD_PLACE_EXCEPT_EXHAUST':ids=selected.filter(id=>!['CARD_PLACE_EXHAUST','CARD_PLACE_NONE'].includes(card(id).card_place));break;
      case 'CARD_PLACE_DECK':ids=intersection('deck');break;
      case 'CARD_PLACE_HAND':ids=intersection('hand');handUI=true;break;
      case 'CARD_PLACE_DISCARD':ids=intersection('discard').filter(id=>!isMove||!card(id).testament_pending);break;
      case 'CARD_PLACE_EXHAUST':ids=intersection('exhaust');break;
      case 'CARD_PLACE_USED':ids=intersection('used');break;
      case 'CARD_PLACE_USING':ids=intersection('using');break;
      case 'CARD_PLACE_DECK_TOP':{const id=pile('deck')[0];ids=has(id)?[id]:[];break;}
      case 'CARD_PLACE_DECK_BOTTOM':{const p=pile('deck'),id=p[p.length-1];ids=has(id)?[id]:[];break;}
      case 'CARD_PLACE_MONSTER':for(const key in (field(deck,'monster')??{}))ids.push(...list(deck.monster[key],`monster pile ${key}`).filter(has));break;
      case 'CARD_PLACE_MONSTER_CASTER':if(!call(api,'isMonsterByID',skill.caster_id))gameError(`err:invalid_card_place_monster_caster_at_target:${skill.res_id}`);if(skill.caster_id in field(deck,'monster'))ids=deck.monster[skill.caster_id].filter(has);break;
      case 'CARD_PLACE_ HAND':from=undefined;ids=[];break; // Shipped malformed row value maps to undefined enum, empty default.
      default:throw new UnresolvedTargetRule(`unimplemented card place ${from}`);
    }
  }
  if(overridePlace!=null){const names={CARD_PLACE_DISCARD:'discard',CARD_PLACE_DECK:'deck',CARD_PLACE_HAND:'hand'};ids=Object.hasOwn(names,overridePlace)?pile(names[overridePlace]).filter(id=>has(id)&&!call(api,'isCardReservedForUse',id)):[];}
  const placeLogsAll=!['CARD_PLACE_DECK_TOP','CARD_PLACE_DECK_BOTTOM','CARD_PLACE_MONSTER_CASTER','CARD_PLACE_USING'].includes(row.target_card_set_list_card_place)||['SKILL_EFF_CARD_DRAW','SKILL_EFF_CARD_DRAW_WHILE_UNIQUE','SKILL_EFF_CARD_DISCARD','SKILL_EFF_CARD_EXHAUST'].includes(row.eff);
  return {ids,forcedIds:source.forcedIds.filter(id=>ids.includes(id)),from,to,handUI,logAllEligible:source.logAllEligible&&placeLogsAll};
}

export function copyRestrictForEffect(eff) {
  if(['SKILL_EFF_CARD_COPY_TO','SKILL_EFF_CARD_COPY_TO_IGNORE_COND','SKILL_EFF_CARD_COPY_TO_EXCEPT_CS','SKILL_EFF_CARD_USE_AND_COPY'].includes(eff))return 'RESTRICT_COPY';
  if(['SKILL_EFF_CARD_COPY_TO_ORIGIN','SKILL_EFF_CARD_COPY_TO_IGNORE_COND_ORIGIN','SKILL_EFF_CARD_COPY_TO_EXCEPT_CS_ORIGIN'].includes(eff))return 'RESTRICT_COPY_ORIGIN';
  return undefined;
}

/** +12470..+14447 candidate chain, before dynamic count. Returns trace evidence.
 * Side effect toast is required through api, or can be explicitly recorded there.
 */
export function resolvePreCountCards(options) {
  const {battle,skill,row,api={},query=false}=options;
  const placed=placeCardSource(resolveCardSource(options),options),trace=[];let ids=placed.ids,logAllEligible=placed.logAllEligible;
  const filter=(name,predicate,affectsLog=true)=>{const before=ids.length;ids=ids.filter(predicate);if(affectsLog&&before!==ids.length)logAllEligible=false;trace.push({stage:name,ids:ids.slice()});};
  const copy=copyRestrictForEffect(row.eff);
  if(copy==='RESTRICT_COPY'){
    const before=ids.length;filter('copy original talent restriction',id=>!call(api,'isCardRestrictedByInfo',id,'RESTRICT_COPY'),false);
    if(!query&&before>0&&!ids.length)call(api,'emitCopyBlockedToast');
  }
  const commonMeta={logAllEligible:true};ids=filterCommonCards(ids,options,commonMeta);if(!commonMeta.logAllEligible)logAllEligible=false;trace.push({stage:'common sort/ego/category/talent/faction/cost/debuff',ids:ids.slice()});
  if(['SKILL_EFF_CARD_DEBUFF_ADD','SKILL_EFF_CARD_DEBUFF_ADD_SHOW_SKIP'].includes(row.eff))filter('debuff restriction',id=>!call(api,'isRestricted',id,'RESTRICT_DEBUFF'));
  if(copy!==undefined)filter('copy effective restriction',id=>!call(api,'isRestricted',id,copy));
  const isDraw=['SKILL_EFF_CARD_DRAW','SKILL_EFF_CARD_DRAW_WHILE_UNIQUE'].includes(row.eff),moveToHand=row.eff==='SKILL_EFF_CARD_MOVE_TO'&&placed.to==='CARD_PLACE_HAND';
  if(isDraw||moveToHand)filter('move/draw restriction',id=>!call(api,'isRestricted',id,'RESTRICT_MOVE_TO_HAND')&&(!isDraw||!call(api,'isRestricted',id,'RESTRICT_DRAW')));
  return {...placed,ids,trace,isDraw,moveToHand,logAllEligible};
}

/** Main card target pipeline with exact dynamic helpers supplied explicitly.
 * This is executable for a supported snapshot; it is NOT a closed game runtime.
 * `shuffleCard` must mutate the same offline battle+RNG snapshot used by callbacks.
 */
export function getTargetCardsReconstructed(options) {
  const {battle,skill,skillId,row,api={},query=false,ignoreCount=false,isPreview=false,rng}=options;
  const countEffects=['SKILL_EFF_CS_SET','SKILL_EFF_CARD_COPY_TO','SKILL_EFF_CARD_COPY_TO_IGNORE_COND','SKILL_EFF_CARD_COPY_TO_EXCEPT_CS','SKILL_EFF_CARD_COPY_TO_ORIGIN','SKILL_EFF_CARD_COPY_TO_IGNORE_COND_ORIGIN','SKILL_EFF_CARD_COPY_TO_EXCEPT_CS_ORIGIN','SKILL_EFF_CS_SET_ADD','SKILL_EFF_CS_SET_ADD_NO_SPARK','SKILL_EFF_CS_SET_ADD_IGNORE_BLOCK','SKILL_EFF_CS_SET_ADD_IGNORE_COND'];
  const csEffects=['SKILL_EFF_CS_SET','SKILL_EFF_CS_SET_ADD','SKILL_EFF_CS_SET_ADD_NO_SPARK','SKILL_EFF_CS_SET_ADD_IGNORE_COND'];
  let alreadyShuffled=Boolean(options.alreadyShuffled),final,logAllEligible=true;
  for(let attempt=0;attempt<2;attempt++){
    const pre=resolvePreCountCards(options);let ids=pre.ids;if(!pre.logAllEligible)logAllEligible=false;
    // calcValue is called even if a later effect-specific count replaces it.
    let count=call(api,'calcValue',skillId);
    if(countEffects.includes(row.eff))count=call(api,'calcEffCardTargetCount',skillId);
    if(ignoreCount)count=-1;
    ids.push(...pre.forcedIds.filter(id=>!ids.includes(id)));
    if(count<0){count=ids.length;
      if(options.overridePlace==null&&pre.to==='CARD_PLACE_HAND'&&(pre.isDraw||row.eff==='SKILL_EFF_CARD_MOVE_TO')){
        const max=call(api,'getBattleHandMaxCount'),inHand=call(api,'getHandCardCountForLimit');
        if(inHand+count>max)count=max-inHand;
      }
    }else logAllEligible=false;
    const randomMode=['LIST_PICK_RAN','LIST_PICK_RAN_NOT_TRIGGERED_INSPIRATION','LIST_PICK_CHAR_EACH_FLAT'].includes(row.target_card_set_list_pick_type);
    const card=id=>{need(battle.cardMap[id]!=null,`missing card ${id}`);return battle.cardMap[id];};
    if(row.eff==='SKILL_EFF_CARD_USE_BAN')ids=ids.filter(id=>!card(id).banned||(card(id).banned_allow_use&&(skill.eff_opts??[]).includes('allow_use')));
    else if(['SKILL_EFF_CARD_MOVE_TO','SKILL_EFF_CARD_MOVE_TO_MONSTER_JUDGMENT'].includes(row.eff))ids=ids.filter(id=>!call(api,'isCardReservedForUse',id));
    else if(row.eff==='SKILL_EFF_CARD_USE')ids=ids.filter(id=>!call(api,'isRestricted',id,'RESTRICT_USE')&&(card(id).banned_allow_use==null||card(id).banned_allow_use==true)&&!(battle.cardUses??[]).some(use=>use.card_id==id));
    else if(csEffects.includes(row.eff)&&(field(skill,'link_cs_ids')??[]).length)ids=filterLinkedCSCards(ids,{...options,isRandom:randomMode},getTargetCardsReconstructed);
    if(row.eff!=='SKILL_EFF_CARD_MOVE_TO_MONSTER_JUDGMENT'&&!(skill.eff_opts??[]).includes('include_uninteractible'))ids=ids.filter(id=>!call(api,'isCardUninteractible',id));
    const mode=row.target_card_set_list_pick_type;
    let sortCards=options.cards??battle.cardMap;
    const rarityMode=['LIST_PICK_HIGH_RARITY','LIST_PICK_LOW_RARITY'].includes(mode),costMode=['LIST_PICK_HIGH_COST','LIST_PICK_LOW_COST','LIST_PICK_HIGHEST_COST'].includes(mode);
    if(!options.cards&&(rarityMode||costMode)){
      sortCards={...battle.cardMap};
      for(const id of ids){const original=card(id),adapted={...original};
        if(rarityMode&&adapted.rarityRank===undefined)adapted.rarityRank=numberByRarity(field(call(api,'readCardResource',field(original,'res_id')),'rarity'));
        if(costMode&&adapted.unplayable===undefined)adapted.unplayable=(original.talents??[]).includes(call(api,'talentEnum','TALENT_UNPLAYABLE'));
        sortCards[id]=adapted;
      }
    }
    const charIds=options.charIds??(mode==='LIST_PICK_CHAR_EACH_FLAT'?(typeof api.getAllChars==='function'?api.getAllChars():getAllCharacters(battle)).map(c=>c.id):undefined);
    ids=orderResolvedCards(ids,mode,{...options,cards:sortCards,charIds,count,isTriggerInspiration:options.isTriggerInspiration??(id=>cardTriggersInspiration(battle,id))});
    if(['SKILL_EFF_CARD_DEBUFF_ADD','SKILL_EFF_CARD_DEBUFF_ADD_SHOW_SKIP'].includes(row.eff)){
      const debuff=list(field(row,'eff_opt_multiple_link'),'eff_opt_multiple_link')[0],withDebuff=[],without=[];
      for(const id of ids)((card(id).debuffs??[]).some(d=>d.debuff_res_id==debuff)?withDebuff:without).push(id);
      ids=without.concat(withDebuff);
    }
    let selectedCount=count,all=false,ui='UI_INTERRUPT_NONE';
    if(query){selectedCount=call(api,'calcTargetCardSetListCount',skillId);if(ignoreCount)selectedCount=-1;
      if(selectedCount<0){selectedCount=ids.length;all=true;}else logAllEligible=false;
      ui=pre.handUI?'UI_INTERRUPT_ALL_HAND':(selectedCount<5&&skill.eff_value==1&&row.eff_card_value_min==1?'UI_INTERRUPT_CARD_CHOICE':'UI_INTERRUPT_CARD_DECK_LIST');
    }
    let chosen=ids.slice(0,selectedCount);
    if(!alreadyShuffled&&chosen.length<selectedCount&&pre.from==='CARD_PLACE_DECK'&&row.auto_shuffle_flag==='YES'){
      const discardResult=getTargetCardsReconstructed({...options,alreadyShuffled:true,ignoreCount:true,overridePlace:'CARD_PLACE_DISCARD'});
      if(discardResult.target_cards_id.some(id=>call(api,'isShuffleTarget',id))){call(api,'shuffleCard',pre.isDraw);alreadyShuffled=true;continue;}
    }
    if(isPreview&&randomMode&&ids.length>selectedCount)chosen=[];
    if(logAllEligible)skill.log_all_cards=true;
    final={target_cards_id:chosen.filter(id=>{if(id===-1){call(api,'reportContentError',`err:invalid_card_id:${id}:skill_id=${skillId}:skill_res_id=${skill.res_id}`);return false;}return !card(id).ep_skill;}),ui_type:ui,from:pre.from,to:pre.to,trace:pre.trace,all};
    return final;
  }
  throw new UnresolvedTargetRule('unexpected exhausted TargetProc rescan loop');
}

/** Common filters +12671..+13976 in original order, excluding effect-specific gates.
 * A missing dynamic callback throws when (and only when) its stage is used.
 * Card/talent numeric enums must be resolved by the adapter. This never invents them.
 */
export function filterCommonCards(ids,{row,battle,skill,api={}},meta=null) {
  let ret=ids.slice();
  const filtered=()=>{if(meta)meta.logAllEligible=false;};
  let sorts=list(field(row,'target_card_set_card_sort'),'target_card_set_card_sort');
  if(sorts.length){filtered();const inverse=sorts.includes('not');ret=ret.filter(id=>Boolean(list(call(api,'getSort',id),'getSort').some(x=>sorts.includes(x)))!==inverse);}
  const egos=list(field(row,'target_card_set_ego_type'),'target_card_set_ego_type').map(x=>call(api,'convertEgoCommon',x));
  if(egos.length){filtered();ret=ret.filter(id=>call(api,'checkEgo',id,egos));}
  let categories=list(field(row,'target_card_set_card_type'),'target_card_set_card_type');
  if(categories.length&&!categories.includes('all')){filtered();const inverse=categories.includes('not');categories=categories.filter(x=>x!=='not');ret=ret.filter(id=>Boolean(call(api,'checkCategory',id,categories))!==inverse);}
  let talents=list(field(row,'target_card_set_talent'),'target_card_set_talent');
  if(talents.length){filtered();const inverse=talents.includes('not');talents=talents.filter(x=>x!=='not').map(x=>call(api,'talentEnum',x));
    const connectOpt=(field(skill,'eff_opts')??[]).includes('connect')&&(talents.includes(call(api,'talentEnum','TALENT_CONNECT'))||talents.includes(call(api,'talentEnum','TALENT_CONNECT_INFINITE')));
    ret=ret.filter(id=>connectOpt&&!inverse?call(api,'isCardConnected',id):(inverse?!talents.some(t=>call(api,'hasTalent',id,t)):talents.every(t=>call(api,'hasTalent',id,t))));}
  const factions=list(field(row,'target_card_set_faction'),'target_card_set_faction');
  if(factions.length){filtered();ret=ret.filter(id=>factions.includes(call(api,'ownerFaction',id)));}
  const parsed=call(api,'parseCardCostFilter',field(row,'target_card_set_opt_cost'));
  if(parsed){filtered();ret=ret.filter(id=>call(api,'applyCardCostFilter',parsed,id));}
  const debuffs=list(field(row,'target_card_set_card_debuff'),'target_card_set_card_debuff');
  if(debuffs.length){filtered();ret=ret.filter(id=>(battle.cardMap[id].debuffs??[]).some(x=>debuffs.includes(x.debuff_res_id)));}
  return ret;
}

/** Base unit selection, before +14123 option filters. Effective type must already
 * include SKILL_EFF_CHANGE_TARGET_UNIT_TYPE (last applicable passive wins).
 * `getTargetableMonstersID` is a required exact helper, not simply live HP > 0.
 */
export function resolveBaseUnitTargets({battle,skill,skillId,type,casterIsMonster,preview=false,isPreview,rng,api={},targetOptions=[]}) {
  need(typeof casterIsMonster==='boolean','missing resolved caster side');
  const unit=id=>call(api,'getUnitByID',id),isMonster=id=>call(api,'isMonsterByID',id);
  const chars=()=>list(typeof api.getAllChars==='function'?api.getAllChars():getAllCharacters(battle),'getAllChars');
  const monsters=except=>{const query={skill_id:skillId,...(except===undefined?{}:{except_id:except})};return list(typeof api.getTargetableMonstersID==='function'?api.getTargetableMonstersID(query):getTargetableMonsterIDs({battle,api},query),'targetable monsters');};
  const random=ids=>pickResolvedRandomTarget(ids,{rng,preview});
  const result=(ids,skipPostFilters=false)=>({ids,skipPostFilters});
  const aggregate=()=>field(battle.char,'id');
  const caster=()=>field(skill,'caster_id');
  const current=()=>unit(caster());
  if(casterIsMonster&&['TARGET_UNIT_SELECTED','TARGET_UNIT_SELECTED_ONLY'].includes(type))gameError(`err:monster_target_not_implemented:${skill.res_id}:TARGET_UNIT_SELECTED`);
  if(!casterIsMonster&&['TARGET_UNIT_RAN_ENEMY_EXCEPT_CASTER_1','TARGET_UNIT_RAN_ENEMY_EXCEPT_CASTER_2','TARGET_UNIT_LOWEST_HP_PCT_ENEMY_EXCEPT_CASTER_1','TARGET_UNIT_LOWEST_HP_PCT_ENEMY_EXCEPT_CASTER_2','TARGET_UNIT_ALL_ENEMY_EXCEPT_CASTER','TARGET_UNIT_CREATURE_PARENT','TARGET_UNIT_CHANGE_MONSTER'].includes(type))gameError(`err:target_type_nonexist:${skill.res_id}:${type}`);
  if(casterIsMonster&&['TARGET_UNIT_EXCEPT_CHAR','TARGET_UNIT_COOP','TARGET_UNIT_NOT_SELECTED'].includes(type))gameError(`err:target_type_nonexist:${skill.res_id}:${type}`);
  if(type==='TARGET_UNIT_SELECT')gameError(`err:target_type_nonexist:${skill.res_id}:${type}`); // Shipped resource typo; no alias in defines.
  switch(type) {
    case 'TARGET_UNIT_NONE':return result([]);
    case 'TARGET_UNIT_CASTER':return result([casterIsMonster?caster():aggregate()]);
    case 'TARGET_UNIT_USER':return result([aggregate()]);
    case 'TARGET_UNIT_SELECTED':case 'TARGET_UNIT_SELECTED_ONLY':return result(field(battle,'select_target')>0?[battle.select_target]:[]);
    case 'TARGET_UNIT_CHAR': {
      const id=field(skill,'action_char_id');let ids=[id];
      if(id<1||(id>3&&(casterIsMonster||id!=7))){call(api,'reportContentError',`err:invalid_TARGET_UNIT_CHAR:${skill.res_id}`);ids=[1,2,3];}
      return result(casterIsMonster?ids:ids.filter(i=>{const c=call(api,'getCharByCharId',i);return c&&c.opacity!=0;}),true);
    }
    case 'TARGET_UNIT_EXCEPT_CHAR':need(!casterIsMonster,'game target_type_nonexist for monster EXCEPT_CHAR');return result(chars().map(c=>c.id).filter(id=>{const c=call(api,'getCharByCharId',id);return c&&c.opacity!=0&&c.id!=skill.action_char_id;}),true);
    case 'TARGET_UNIT_CHAR_ALL':return result(chars().filter(c=>casterIsMonster||c.opacity!=0).map(c=>c.id),true);
    case 'TARGET_UNIT_CHAR_ID':return result(list(field(battle,'chars'),'battle.chars').map(c=>c.id).filter(id=>{const c=call(api,'getCharByCharId',id);return c&&c.opacity!=0&&list(call(api,'unitMultipleLinks'),'unit multiple links').includes(String(call(api,'getModel',c.res_id)));}),true);
    case 'TARGET_UNIT_CHAR_RANDOM': {
      need(isPreview!==undefined,'missing actual isPreview');
      const opts=field(skill,'target_unit_type_opt'),min=Number(opts?.[0]),max=Number(opts?.[1]),excludeCS=opts?.[2];
      if(isPreview&&min!=max)return result([],true);
      let count=1;
      if(opts?.length==2){need(rng&&typeof rng.nextRange==='function','missing INGAME nextRange');count=rng.nextRange(min,max+1);}
      count=Math.min(3,count);
      if(Number.isNaN(count)){call(api,'reportContentError',`err:invalid_target_unit_type_opt_with_TARGET_UNIT_CHAR_RANDOM:${skill.res_id}`);count=1;}
      if(isPreview&&count!=3)return result([],true);
      const ids=list(field(battle,'chars'),'battle.chars').filter(c=>casterIsMonster||c.opacity!=0).map(c=>c.id).filter(id=>!excludeCS||!(battle.char.continueSkillChar?.[id].some(cid=>battle.csMap[cid]?.res_id==excludeCS)));
      need(rng&&typeof rng.randomArrayMembers==='function','missing INGAME randomArrayMembers');return result(rng.randomArrayMembers(ids,count),true);
    }
    case 'TARGET_UNIT_CHAR_HIGHEST_STRESS': {
      const candidates=list(call(api,'stageCharacters'),'stage characters').filter(c=>call(api,'getCharByCharId',c.id)?.opacity!=0&&!call(api,'isCollapseOnCharacter',c));
      if(!candidates.length)return result([],true);
      const max=Math.max(...candidates.map(c=>c.ego_stress??0)),tied=candidates.filter(c=>c.ego_stress==max).map(c=>c.id);
      if(tied.length===1)return result(tied,true);
      need(rng&&typeof rng.randomArrayMember==='function','missing INGAME randomArrayMember');return result([rng.randomArrayMember(tied)],true);
    }
    case 'TARGET_UNIT_CHAR_CARD_USED_BEFORE': {
      const c=battle.cardMap[field(battle,'before_used_card')];return result(c&&c.char_id>0?[c.char_id]:[]);
    }
    case 'TARGET_UNIT_TRIGGERED':if(field(skill,'target_triggered')==null)gameError(`err:invalid_target_type_triggered:no_triggered_id:${skill.res_id}`);return result(list(skill.target_triggered,'target_triggered'));
    case 'TARGET_UNIT_COOP':need(!casterIsMonster,'game target_type_nonexist for monster COOP');return result(field(battle,'before_used_card_targets')??[]);
    case 'TARGET_UNIT_ALL_ENEMY':return result(monsters());
    case 'TARGET_UNIT_NOT_SELECTED':need(!casterIsMonster,'game target_type_nonexist for monster NOT_SELECTED');return result(monsters(field(battle,'select_target')).slice());
    case 'TARGET_UNIT_ALL_ENEMY_EXCEPT_CASTER':return result(monsters(caster()));
    case 'TARGET_UNIT_RAN_ENEMY':case 'TARGET_UNIT_ALL_RAN_ENEMY':return result(random(monsters()));
    case 'TARGET_UNIT_RAN_ENEMY_EXCEPT_TARGET':return result(random(monsters(field(battle,'select_target'))));
    case 'TARGET_UNIT_RAN_ENEMY_EXCEPT_CASTER_1':return result(random(monsters(caster())));
    case 'TARGET_UNIT_RAN_ENEMY_EXCEPT_CASTER_2': {const ids=monsters(caster());return result(ids.length?random(ids):[caster()]);}
    case 'TARGET_UNIT_MONSTER_ID': {const resids=list(call(api,'unitMultipleLinks'),'unit multiple links');return result(monsters().filter(id=>resids.includes(unit(id).res_id)));}
    case 'TARGET_UNIT_DAMAGE_ENEMY':case 'TARGET_UNIT_ATTACK_ENEMY': {
      const value=current()[type==='TARGET_UNIT_DAMAGE_ENEMY'?'previousDamageto':'previousAttackto']??-1;
      return result(casterIsMonster?[value]:(isMonster(value)?[value]:[]));
    }
    case 'TARGET_UNIT_DAMAGE_ENEMY_ALL':case 'TARGET_UNIT_ATTACK_ENEMY_ALL': {
      const ids=current()[type==='TARGET_UNIT_DAMAGE_ENEMY_ALL'?'previousDamagetoAll':'previousAttacktoAll']??[];
      return result(casterIsMonster?ids:ids.filter(isMonster));
    }
    case 'TARGET_UNIT_HIT_ENEMY': {
      const id=current().previousAttackedby??-1;return result(casterIsMonster?[[1,2,3,4,5,6].includes(id)?aggregate():id]:(isMonster(id)?[id]:[]));
    }
    case 'TARGET_UNIT_ATTACK_ENEMY_RAN': {const previous=current().previousAttackto??-1,ids=monsters();return result(ids.includes(previous)?[previous]:random(ids));}
    case 'TARGET_UNIT_TARGET_BEFORE': {
      const saved=call(api,'getSavedUnitTarget',skillId);if(!saved)gameError(`err:invalid_save_target_type:${skill.res_id}`);return result(saved[1]?[]:saved[0]);
    }
    case 'TARGET_UNIT_OWNER':case 'TARGET_UNIT_EXCEPT_OWNER': {
      if(field(skill.parent,'type')!=='CS')gameError(`err:invalid_target_type_${type==='TARGET_UNIT_OWNER'?'owner':'except_owner'}:no_cs_id:${skill.res_id}`);
      const cs=battle.csMap[skill.parent.id];if(!cs)return result([]);
      if(type==='TARGET_UNIT_OWNER')return result([isMonster(cs.owner_id)?cs.owner_id:aggregate()]);
      let owner=cs.owner_id;if(!isMonster(owner)&&cs.action_target_id>0)owner=cs.action_target_id;
      return result(isMonster(owner)?monsters(owner):chars().filter(c=>casterIsMonster||c.opacity!=0).map(c=>c.id).filter(id=>id!=owner));
    }
    case 'TARGET_UNIT_CREATURE_PARENT': {const id=current().summoner;if(!id)gameError(`err:summoner_not_exist:TARGET_UNIT_CREATURE_PARENT:${skill.res_id}`);return result([id]);}
    case 'TARGET_UNIT_CHANGE_MONSTER':need(casterIsMonster,'game target_type_nonexist for CHANGE_MONSTER');return result(current().changed?[current().changed]:[]);
    case 'TARGET_UNIT_SELECTED_BOTH_SIDE': {
      let selected=field(battle,'select_target');
      if(selected==-1&&skill.parent.type==='CS'){const cs=battle.csMap[skill.parent.id];if(cs)selected=cs.owner_id;}
      if(!isMonster(selected))selected=caster();
      if(!isMonster(selected)){call(api,'reportContentError',`err:invalid_target_type_selected_both_side:no_monster_id:${skill.res_id}`);return result([]);}
      const center=unit(selected),blocked=['death','run','half_death','keep_half_death','prop','changed'].map(s=>call(api,'unitState',s));
      let left=-1,right=-1,leftID=-1,rightID=-1;
      for(const u of list(field(battle,'monsters'),'monsters')){
        if(call(api,'monsterGrade',u.res_id)==='GRADE_PROP_KEEP_HALF_DEATH_NOTICE'||blocked.includes(u.state))continue;
        if(u.slot_idx<center.slot_idx&&(left<0||left<u.slot_idx)){left=u.slot_idx;leftID=u.id;}
        else if(u.slot_idx>center.slot_idx&&(right<0||right>u.slot_idx)){right=u.slot_idx;rightID=u.id;}
      }
      return result([...(leftID>=0?[leftID]:[]),...(rightID>=0?[rightID]:[])]);
    }
    default: {
      const rankTypes={TARGET_UNIT_LOWEST_HP_ENEMY:['hp',false],TARGET_UNIT_HIGHEST_HP_ENEMY:['hp',true],TARGET_UNIT_LOWEST_HP_PCT_ENEMY:['ratio',false],TARGET_UNIT_HIGHEST_HP_PCT_ENEMY:['ratio',true],TARGET_UNIT_LOWEST_TURN_COUNT_ENEMY:['turn',false],TARGET_UNIT_LOWEST_HP_PCT_ENEMY_EXCEPT_CASTER_1:['ratio',false],TARGET_UNIT_LOWEST_HP_PCT_ENEMY_EXCEPT_CASTER_2:['ratio',false]};
      if(Object.hasOwn(rankTypes,type)) {
        const [metric,high]=rankTypes[type],except=type.includes('EXCEPT_CASTER'),ids=monsters(except?caster():undefined);let best=metric==='turn'?Infinity:-1,candidates=[];
        for(const id of ids){const u=unit(id);if(metric==='turn'&&u.actioned)continue;
          const value=metric==='turn'?(u.mon_turn??Infinity):call(api,metric==='hp'?'currentHP':'hpRatio',u);
          if((!high&&metric!=='turn'&&best<0)||(high?value>best:value<best)){best=value;candidates=[id];}else if(value==best)candidates.push(id);
        }
        return result(candidates.length?random(candidates):(type.endsWith('EXCEPT_CASTER_2')?[caster()]:[]));
      }
      throw new UnresolvedTargetRule(`unimplemented unit type ${type}`);
    }
  }
}

/** Base selection followed by the recovered unit-option and linked-CS pipeline. */
export function resolveUnits(options) {
  const base=resolveBaseUnitTargets(options);
  if(base.skipPostFilters)return base.ids;
  need(Array.isArray(options.targetOptions),'targetOptions must be explicitly resolved');
  need(Array.isArray(options.linkedCS),'linkedCS must be explicitly resolved');
  if(options.targetOptions.length||options.linkedCS.length)return list((options.api?.applyUnitOptionFilters??filterUnitOptions)(base.ids,options),'filtered units');
  return base.ids;
}

/** Preface +146..+538 plus unit base/filter chain. Passive selection order and
 * checkTermValuePassive are observable state changes, not optional decoration.
 * Required helpers operate only on the caller's offline snapshot.
 */
export function getSkillEffTargetReconstructed(options) {
  const {battle,skill,row,api={},isPreview,forcePreview=false}=options;
  need(isPreview!==undefined,'missing actual isPreview');
  const passives=list(call(api,'getPassiveByType',{type:'SKILL_EFF_CHANGE_TARGET_UNIT_TYPE',is_card:false,source_id:skill.caster_id,char_id:skill.action_char_id,caster_id:skill.caster_id}),'active target-type passives');
  let type=row.target_unit_type,last;
  skill.target_changed_motion=undefined;
  for(const passive of passives)if((passive.eff_opt_multiple_link??[]).includes(skill.res_id)){last=passive;type=list(passive.eff_opts,'passive eff_opts')[0];}
  if(last){
    call(api,'checkTermValuePassive',last.skill_id,skill.caster_id);
    const info=call(api,'skillEffInfo',last.res_id);
    if(call(api,'hasTriggerMotion',info.operation_trigger_motion_type))skill.target_changed_motion=info.operation_trigger_motion_type;
  }
  const targetOptions=(field(skill,'target_unit_type_opt')??[]).slice();
  return resolveUnits({...options,battle,skill,type,targetOptions,preview:Boolean(forcePreview)||!(isPreview==0)});
}

/** Source + common filter + resolved order, deliberately not a full getTargetCards.
 * Candidates require the actual placement/restriction/count pipeline before using it.
 */
export function composeResolvedCardSelection(candidates,options) {
  const filtered=filterCommonCards(candidates,options);
  return orderResolvedCards(filtered,options.row.target_card_set_list_pick_type,options);
}
