/** Entire buildCardFilter/parseCardCountOpts rule from gamecore/battle/card_filter.js.
 * Callbacks supply live sort/ego/talent/connected state; absent dependencies throw.
 * This is independent handwritten reconstruction, not executed recovered code.
 */
import {MissingStatusDependency} from './status-core.mjs';
const fn = (value, label) => {
  if (typeof value !== 'function') throw new MissingStatusDependency(label);
  return value;
};

export function parseCardCountOpts(options) {
  let max_count = -1, coeff = 1;
  for (const option of options) {
    const number = Number(option);
    if (option.length > 0 && !isNaN(number)) max_count = number;
    else if (option.startsWith('base_')) {
      const base = Number(option.slice(5));
      if (!isNaN(base)) coeff = base;
    }
  }
  return {max_count, coeff, using_previous: options.includes('using_previous'),
    stage_deck: options.includes('CARD_PLACE_STAGE_DECK')};
}

const placeExpansion = {
  CARD_PLACE_ALL: ['NONE','DECK','HAND','DISCARD','EXHAUST','USING','MONSTER','USED'],
  CARD_PLACE_EXCEPT_EXHAUST: ['DECK','HAND','DISCARD','USING','MONSTER','USED'],
  CARD_PLACE_EXCEPT_EXHAUST_MONSTER: ['DECK','HAND','DISCARD','USING','USED'],
  CARD_PLACE_DISCARD_USED: ['DISCARD','USED'], CARD_PLACE_DECK_DISCARD: ['DECK','DISCARD'],
  CARD_PLACE_DECK_DISCARD_USED: ['DECK','DISCARD','USED'], CARD_PLACE_DECK_HAND: ['DECK','HAND'],
  CARD_PLACE_DISCARD_HAND: ['DISCARD','HAND'], CARD_PLACE_DISCARD_USED_HAND: ['DISCARD','USED','HAND'],
  CARD_PLACE_DECK_HAND_DISCARD: ['DECK','HAND','DISCARD'],
  CARD_PLACE_DECK_DISCARD_USED_USING: ['DECK','DISCARD','USED','USING'],
};

export function buildCardFilterCommon(env, options, extra, enums, readCard) {
  for (const name of ['CARD_PLACE','CARD_SORT','CARD_CATEGORY','EGO_TYPE_STRING','TALENT'])
    if (!enums?.[name]) throw new MissingStatusDependency('enum:' + name);
  const {CARD_PLACE, CARD_SORT, CARD_CATEGORY, EGO_TYPE_STRING, TALENT} = enums;
  const expansions = new Map(Object.entries(placeExpansion).map(([name, places]) =>
    [CARD_PLACE[name], places.map(place => CARD_PLACE['CARD_PLACE_' + place])]));
  const places = options.map(key => CARD_PLACE[key]).filter(value => typeof value === 'number')
    .filter(value => value != CARD_PLACE.CARD_PLACE_STAGE_DECK)
    .flatMap(value => expansions.get(value) ?? [value]);
  const sorts = options.filter(value => Object.values(CARD_SORT).includes(value));
  const categories = options.filter(value => Object.values(CARD_CATEGORY).includes(value));
  const egos = options.filter(value => Object.values(EGO_TYPE_STRING).includes(value));
  const talents = options.filter(value => value.startsWith('TALENT_'));
  const talentAnd = options.includes('talent_and');
  const matchChar = extra?.force_char_match || options.includes('self');
  const excludeThis = extra?.force_except_this_card || options.includes('except_this_card');
  const thisCard = excludeThis ? fn(env.getThisCardId, 'getThisCardId')() : undefined;
  return cardId => {
    const card = fn(env.getCard, 'getCard')(cardId);
    if (!card) return false;
    if (fn(env.isUninteractible, 'isCardUninteractible')(cardId)) return false;
    if (matchChar && card.char_id != env.action_char_id) return false;
    if (thisCard != null && cardId == thisCard) return false;
    const place = env.place_of ? fn(env.place_of, 'place_of')(card) : card.card_place;
    if (place == null || (places.length > 0 && !places.includes(place))) return false;
    if (sorts.length > 0 && !fn(env.getSorts, 'getSort')(cardId).some(sort => sorts.includes(sort))) return false;
    if (categories.length > 0) {
      const resource = fn(readCard, 'card resource')(card.res_id);
      if (!resource) throw new MissingStatusDependency('card resource:' + card.res_id);
      if (!categories.some(category => resource.card_category === category)) return false;
    }
    if (egos.length > 0 && !egos.some(ego => fn(env.checkEgo, 'checkEgo')(cardId, ego))) return false;
    if (talents.length > 0) {
      const matches = symbol => {
        const talent = TALENT[symbol];
        if (talent == null) return false;
        if (talent == TALENT.TALENT_CONNECT) return fn(env.isConnected, 'isCardConnected')(cardId);
        return fn(env.hasTalent, 'hasTalent')(cardId, talent, env.place_of ? place : undefined);
      };
      if (!(talentAnd ? talents.every(matches) : talents.some(matches))) return false;
    }
    return true;
  };
}
