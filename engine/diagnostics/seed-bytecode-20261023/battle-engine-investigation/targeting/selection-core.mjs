// Independent reconstruction of TargetProc's resolved-candidate selection tail.
// It is NOT the full target builder/filter pipeline. Unknown inputs fail explicitly.
import { resdbShuffle } from '../../rng-investigation/resdb-shuffle.mjs';

export class UnresolvedTargetRule extends Error {}
export function numberByRarity(rarity) {
  const ranks={RARITY_COMMON:0,RARITY_RARE:1,RARITY_LEGEND:2,RARITY_UNIQUE:3};
  if(!Object.hasOwn(ranks,rarity))throw new Error(`game behavior: err:invalid_rarity:${rarity}`);
  return ranks[rarity];
}
function need(condition, message) { if (!condition) throw new UnresolvedTargetRule(message); }
function cardOf(cards,id) { need(cards[id] != null, `missing card instance ${id}`); return cards[id]; }
function costOf(cards,id) { const card=cardOf(cards,id); need(typeof card.cost_result==='number',`unresolved cost_result ${id}`); return card.cost_result; }
function unplayable(cards,id) { const card=cardOf(cards,id); need(typeof card.unplayable==='boolean',`unresolved UNPLAYABLE talent ${id}`); return card.unplayable; }
function compareCost(cards,a,b,high) {
  let delta=Number(unplayable(cards,a))-Number(unplayable(cards,b));
  if (delta) return delta;
  const x=costOf(cards,a),y=costOf(cards,b);
  delta=Number(x===-1)-Number(y===-1); if(delta)return delta;
  const v=x===-2?0:x,w=y===-2?0:y;
  return high?w-v:v-w;
}

/** candidates must ALREADY have passed all game source/owner/place/condition filters.
 * rng is the current INGAME independent GameRandom (no fresh seed invented here).
 * charIds must match getAllChars() order; game Object keys still enumerate integers first.
 */
export function orderResolvedCards(candidates, mode, { cards, rng, charIds, count, isTriggerInspiration }={}) {
  let ret=candidates.slice();
  const shuffle=()=>{need(rng&&typeof rng.nextFloat==='function','missing INGAME RNG');resdbShuffle(ret,()=>rng.nextFloat());};
  switch(mode) {
    case 'LIST_PICK_NONE':case 'LIST_PICK_ORDER':return ret;
    // Present in retained resources, absent from CARD_SET_PICK_TYPE. Actual switch
    // reaches its unchanged default; RANDOM is not an alias for RAN.
    case 'LIST_PICK_RANDOM':case 'LIST_PICK_ALL':return ret;
    case 'LIST_PICK_ORDER_INVERSE':return ret.reverse();
    case 'LIST_PICK_RAN':shuffle();return ret;
    case 'LIST_PICK_HIGH_RARITY':case 'LIST_PICK_LOW_RARITY': {
      shuffle(); const buckets=[[],[],[],[]];
      for(const id of ret){const rank=cardOf(cards,id).rarityRank;need(Number.isInteger(rank)&&rank>=0&&rank<4,`unresolved getNumberbyRarity ${id}`);buckets[rank].push(id);}
      return (mode==='LIST_PICK_HIGH_RARITY'?buckets.reverse():buckets).flat();
    }
    case 'LIST_PICK_HIGH_COST':case 'LIST_PICK_LOW_COST':shuffle();return ret.sort((a,b)=>compareCost(cards,a,b,mode==='LIST_PICK_HIGH_COST'));
    case 'LIST_PICK_HIGHEST_COST': {
      shuffle();let tier=Infinity,max=-2,chosen=[];
      for(const id of ret){const raw=costOf(cards,id),u=unplayable(cards,id),t=u?2:(raw===-1?1:0),value=raw===-2?0:raw;if(t>tier)continue;
        if(t<tier||value>max){tier=t;max=value;chosen=[id];}else if(value===max)chosen.push(id);
      }return chosen;
    }
    case 'LIST_PICK_DECK_FIRST': {
      shuffle();const deck=[],other=[];for(const id of ret){const place=cardOf(cards,id).card_place;need(place!==undefined,`missing card_place ${id}`);(place==='CARD_PLACE_DECK'?deck:other).push(id);}return deck.concat(other);
    }
    case 'LIST_PICK_RAN_NOT_TRIGGERED_INSPIRATION': {
      shuffle();need(typeof isTriggerInspiration==='function','missing actual isTriggerInspiration predicate');
      // The shipped predicate is positive despite the enum name: by_turn_draw && trigger.
      return ret.filter(id=>cardOf(cards,id).by_turn_draw&&isTriggerInspiration(id));
    }
    case 'LIST_PICK_CHAR_EACH_FLAT': {
      need(Array.isArray(charIds),'missing getAllChars IDs');need(typeof count==='number','missing effective count');
      const groups={};for(const id of charIds)groups[id]=[];
      for(const id of ret){const owner=cardOf(cards,id).char_id;need(owner!==undefined,`missing card owner ${id}`);if(groups[owner])groups[owner].push(id);}
      const n=Object.keys(groups).length,each=Math.floor(count/n+1e-8);let remaining=count%n;const selected=[];
      for(const group of Object.values(groups))selected.push(...group.splice(0,each));
      while(remaining>0){const choices=Object.entries(groups).map(([id,group])=>[Number(id),group.length]).filter(pair=>pair[1]>0);if(!choices.length)break;
        need(rng&&typeof rng.randomArrayMember==='function','missing INGAME RNG');const choice=rng.randomArrayMember(choices);selected.push(groups[choice[0]].shift());remaining--;
      }
      return ret.filter(id=>selected.includes(id));
    }
    default:throw new UnresolvedTargetRule(`unimplemented card pick type ${mode}`);
  }
}

/** Verified common RAN_ENEMY resolved-candidate gate, not candidate construction.
 * During preview, >1 candidates returns []; singleton still draws once.
 */
export function pickResolvedRandomTarget(candidates, {rng,preview=false}={}) {
  if(!candidates.length||(preview&&candidates.length!==1))return [];
  need(rng&&typeof rng.randomArrayMember==='function','missing INGAME RNG');
  return [rng.randomArrayMember(candidates)];
}

export function assertSupportedMonsterSelected(type,casterIsMonster) {
  if(casterIsMonster&&['TARGET_UNIT_SELECTED','TARGET_UNIT_SELECTED_ONLY'].includes(type)) {
    throw new Error('game behavior: err:monster_target_not_implemented:TARGET_UNIT_SELECTED');
  }
}
