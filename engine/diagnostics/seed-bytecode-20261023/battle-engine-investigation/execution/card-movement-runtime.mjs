// Independent hand ports. Evidence: cards/functions/battle_card_proc.js,
// state/focused/{shuffleCard,moveCards}, cards/move-dependencies and local
// evidence/card-movement. No recovered code is executed.
import fs from 'node:fs';
import {MissingBattleRule} from './resource-store.mjs';
import {resdbShuffle} from '../../rng-investigation/resdb-shuffle.mjs';
const restrictions=JSON.parse(fs.readFileSync(new URL('../cards/restrictions.symbolic.json',import.meta.url),'utf8'));
const talents=JSON.parse(fs.readFileSync(new URL('../../card-pool-investigation/talent-enum.json',import.meta.url),'utf8'));
for(const [name,id]of Object.entries(talents))talents[id]=name;
const PLACE={1:'deck',2:'hand',3:'discard',4:'exhaust',7:'using',11:'used'};
// findFromMultiplePlaces 0x14a300 uses this ordered short-circuit search
// once for each requested card. These are not bulk moves of each source pile.
// ALL/NONE intentionally omit monster piles. EXCEPT_EXHAUST includes them,
// while EXCEPT_EXHAUST_MONSTER does not (0x14a300 @386..569).
const MULTIPLE={0:[1,2,3,4,11,7],8:[1,2,3,4,11,7],12:[1,2,3,11,7,9],13:[1,2,3,11,7],15:[3,11],16:[1,3],17:[1,3,11],18:[1,2],19:[3,2],20:[3,11,2],21:[1,2,3],22:[1,3,11,7]};
export class CardMovementRuntime {
  constructor(e){this.e=e;this.b=e.b;this.w=e.wt;}
  call(n,...a){return this.e.call(n,...a);}
  event(n,p,id=-1){return this.call('procCardEvent',n,p,id);}
  amount(p){this.event('CONDITION_CARD_AMOUNT',p);this.event('CONDITION_CARD_AMOUNT_SET',p);}
  action(type,fields){const a={id:this.b.last_action_id++,type,...fields};this.e.ports.pushAction(a);return a;}
  isRecallReservedCard(id){return this.b.recall_reserved?.some(x=>x[1]==id)??false;}
  isCardTestamentMoveLocked(id){return this.b.cardMap[id]?.talents?.includes(44)??false;}
  resetExhaustedFlag(){for(const key in this.b.cardMap){const c=this.b.cardMap[key];if(c.exhausted){c.exhausted=false;this.e.ports.pushChangeData('card',c.id);}}}
  procTalentVallista(id){if(this.b.cardMap[id]?.talents?.includes(38))this.call('pushCardCoop',{
    card_id:id,target:this.b.select_target,procUse:true,procCost:false,by_vallista:true});}
  isShuffleTarget(id){
    return !this.b.cardMap[id]?.testament_pending&&!this.isRecallReservedCard(id)&&
      this.e.passives.query({source_id:id,type:'SKILL_EFF_CARD_NOT_SHUFFLE',is_card:true}).length==0;
  }
  // GameRandomProvider.shuffleArray uses removal sampling (n calls); this is
  // distinct from GameResDB.shuffle below (Fisher-Yates, n-1 calls).
  shuffleArray(type,array){const indexes=array.map((_,i)=>i),result=[];for(let i=0;i<array.length;i++){
    const n=this.e.random.randRange(type,0,indexes.length);result.push(array[indexes[n]]);indexes.splice(n,1);}return result;}
  pushDeck(id){const d=this.b.deck_info.deck;d.splice(this.e.random.randRange(0,0,d.length),0,id);}
  getDrawableDeckCards(count){const d=this.b.deck_info.deck,result=[];count??=d.length;
    for(const id of d){if(result.length>=count)break;if(!this.isRestricted(this.b.cardMap[id],'RESTRICT_DRAW'))result.push(id);}return result;}
  isRestricted(card,restrict){
    const sort=this.e.db.get('card',card.res_id)?.sort;
    if(restrictions.sorts[sort]?.includes(restrict))return true;
    if(!Object.values(restrictions.talents).some(a=>a.includes(restrict)))return false;
    return this.call('getTalentByInfo',card).some(t=>restrictions.talents[talents[t]??t]?.includes(restrict));
  }
  filterMoveToHandRestrictedCards(ids,to){return to!=2||ids.length==0?ids:ids.filter(id=>!this.b.cardMap[id]||!this.isRestricted(this.b.cardMap[id],'RESTRICT_MOVE_TO_HAND'));}
  procLockHandBlocked(ps){for(const p of ps)this.call('checkTermValuePassive',p.skill_id,this.b.char.id);}
  filterLockHandCards(ids,to){
    if(to!=2||ids.length==0)return ids;
    const ps=this.e.passives.query({source_id:this.b.char.id,type:'SKILL_EFF_LOCK_HAND',is_card:false,ignore_cs_own_type:true});
    if(!ps.length)return ids;
    const blocked=[];const result=ids.filter(id=>{const c=this.b.cardMap[id];if(!c)return true;let deny=false;
      for(const p of ps){const r=this.e.db.get('skill_eff',p.res_id);
        if(this.call('matchCardPlaceSet',r.target_card_set_list_card_place,c.card_place)){deny=true;if(!blocked.includes(p))blocked.push(p);}}
      return !deny;});this.procLockHandBlocked(blocked);return result;
  }
  // 0x104b00: only the initial empty-deck amount notifications are optional.
  shuffleCard(byTurnDraw){
    byTurnDraw??=true;const b=this.b,d=b.deck_info;
    if(d.discard.length<1||!d.discard.some(id=>this.isShuffleTarget(id)))return false;
    const tutorial=this.e.passives.query({source_id:b.char.id,type:'SKILL_EFF_TUTORIAL_SHUFFLE',is_card:false});
    if(tutorial.length){this.action('action_tutorial',{source_id:-1,msg:tutorial[0].eff_opt_multiple_link?.[0]});b.action_tutorial++;
      this.call('checkTermValuePassive',tutorial[0].skill_id,b.char.id);}
    const oldDeck=d.deck.slice();d.deck=[];if(byTurnDraw)this.amount(1);
    const noShuffle=[];d.discard=d.discard.filter(id=>{
      const ps=this.e.passives.query({source_id:id,type:'SKILL_EFF_CARD_NOT_SHUFFLE',is_card:true});
      if(ps.length||this.isRecallReservedCard(id)){noShuffle.push(id);return false;}return true;});
    resdbShuffle(d.discard,()=>this.e.random.nextInt(0)/2147483647);
    d.discard.sort((a,c)=>{const x=b.cardMap[a].shuffle_order,y=b.cardMap[c].shuffle_order;
      return x==null?(y==null?0:1):y==null?-1:x-y;});
    d.discard.forEach(id=>b.cardMap[id].shuffle_order=undefined);
    const moved=[],pending=[];
    for(const id of d.discard){if(b.cardMap[id]?.testament_pending)pending.push(id);else{
      moved.push(id);this.setCardPlace(id,1);this.call('checkTermValue',id,'TERM_CARD_MOVE_TO_DECK',b.char.id,true,{isWhole:true});}}
    d.deck=oldDeck.concat(moved);d.discard=noShuffle.concat(pending);
    this.action('action_card_shuffle',{source_id:b.char.id,action_card:{cards:moved.slice().sort((a,c)=>a-c),place_from:3,place_to:1,enemy_turn:b.enemy_turn}});
    this.event('CONDITION_CARD_SHUFFLE',0);this.amount(3);
    for(const id of moved){this.event('CONDITION_CARD_MOVE_TO',1,id);this.event('CONDITION_CARD_MOVE_TO_NOT_FROM_USED',1,id);}
    if(!byTurnDraw)for(const id of moved)this.event('CONDITION_CARD_MOVE_TO_BY_EFF',1,id);
    this.amount(1);this.event('CONDITION_CARD_AMOUNT_COMPARE',0);return true;
  }
  trimDiscardToLimit(actionList,skillId){
    const max=this.call('constantMetagame','max_limit_place_discard',{def_value:Number.MAX_SAFE_INTEGER,skip_error:true});
    if(!Number.isFinite(max)||max<0)return;const extra=this.b.deck_info.discard.length-Math.floor(max);if(extra<=0)return;
    const ids=this.b.deck_info.discard.slice(0,extra).filter(id=>!this.isRecallReservedCard(id));if(!ids.length)return;
    this.call('moveCards',{skill_id:skillId,card_ids:ids,from:3,to:4,action_list:actionList||undefined,
      by_check_orlea_creation:true,by_check_recall_reserved:true,by_skip_card_event:true,by_force_detail_log:true});
  }
  // BattleCardProc 0x28d00; flags are positional native defaults.
  setCardPlace(id,place,updateCost,skipRecall,turnDraw){
    updateCost??=true;skipRecall??=false;turnDraw??=false;const b=this.b;
    this.e.ports.pushChangeData('card',id);const c=b.cardMap[id];if(!c)throw new MissingBattleRule('setCardPlace.invalid_card',{id});
    if(place==5||place==6)place=1;const old=c.card_place;
    if(old==2&&place!=2)c.dim=true;else if(old!=2&&place==2)c.dim=false;
    if(old==2){const ps=this.e.passives.query({source_id:b.char.id,type:'SKILL_EFF_HAND_UNUSABLE_EXCEPT_1'});
      if(ps.length&&ps[0].randValue==c.id)ps[0].randValue=0;}
    c.card_place=place;
    if(place==7&&old!=7){b.use_place_snapshot||={};const snapshot={};for(const k in b.cardMap){const x=b.cardMap[k];if(x)snapshot[x.id]=x.id==id?old:x.card_place;}b.use_place_snapshot[id]=snapshot;}
    else if(old==7&&place!=7&&b.use_place_snapshot)delete b.use_place_snapshot[id];
    if(place==2&&!turnDraw)c.by_turn_draw=undefined;
    if(place==1)c.known=false;else if(!this.w.isPreview)c.known=true;
    if(updateCost){const r=this.call('updateCostResult',id);if(r.changed){this.e.ports.pushChangeData('card',id);
      this.action('action_card_cost',{action_card_property:{card:id,cost:r.new_cost},skip_action:c.card_place!=2});}}
    if(!skipRecall&&!c.testament_pending&&!c.by_testament&&old!=3&&old!=11&&(place==3||place==11)&&c.recall_count!=null&&c.recall_count>=0){
      b.recall_reserved??=[];b.recall_reserved.push([place,id]);--c.recall_count;}
    if(place==4){this.call('cleanupCardResources',id);
      for(const other of b.deck_info.hand){if(other==id||this.call('isCardUninteractible',other))continue;
        const x=b.cardMap[other];if(!x||!x.talents?.includes(39)||x.cost_result<1)continue;
        x.ignite_count=(x.ignite_count??0)+1;const r=this.call('updateCostResult',other);this.e.ports.pushChangeData('card',other);
        this.action('action_card_ignite',{action_card_property:{card:other,ignite_count:x.ignite_count,cost:r.new_cost}});
        if(r.new_cost<r.old_cost){this.event('CONDITION_CARD_COST_DECREASE',x.card_place,other);
          this.call('addDetailLog',{type:'log_skill_eff_card_cost_change',params:[other,r.new_cost-r.old_cost],param_types:['card_id','cost']});}}
    }
    if(b.timing_pre_turn&&!b.sereniel_draw_triggered&&old==1&&place==2&&c.res_id.startsWith('c_30075_srt4')){
      const ps=this.e.passives.query({source_id:b.char.id,type:'SKILL_EFF_SERENIEL_SPECIAL'});
      if(ps.length){b.sereniel_draw_triggered=true;let draw=this.getDrawableDeckCards(1)[0];if(draw==null){this.shuffleCard(true);draw=this.getDrawableDeckCards(1)[0];}
        if(draw!=null)this.call('moveCards',{skill_id:ps[0].skill_id,card_ids:[draw],from:1,to:2});}}
  }
  sortHandCards(ids){
    const b=this.b,keys=b.assault_fourth_char?[7,3,2,1,'all']:[3,2,1,'all'],groups=Object.fromEntries(keys.map(k=>[k,[]])),creation=[];
    for(const id of ids??b.deck_info.hand){const c=b.cardMap[id],r=this.e.db.get('card',c.res_id);
      if(['CARD_ABNORM','CARD_CURSE'].includes(r.card_category))groups.all.push(id);
      else{if(c.talents?.includes(25))creation.push(c.char_id);groups[c.char_id in groups?c.char_id:'all'].push(id);}}
    for(const key of keys)groups[key].sort((a,c)=>{const x=b.cardMap[a],y=b.cardMap[c];if(x.collapse_count!=null)return 0;
      if(creation.some(z=>z==key)){const p=x.talents?.includes(25),q=y.talents?.includes(25);if(p&&!q)return 1;if(q&&!p)return -1;if(p&&q)return x.res_id.localeCompare(y.res_id);}
      const p=x.talents?.includes(6),q=y.talents?.includes(6);if(p&&!q)return 1;if(q&&!p)return -1;return a-c;});
    let result=keys.flatMap(k=>groups[k]);if(result.some(id=>b.cardMap[id]?.talents?.some(t=>t==59||t==60))){
      const light=[],mid=[],dark=[];for(const id of result){const t=b.cardMap[id]?.talents;(t?.includes(59)?light:t?.includes(60)?dark:mid).push(id);}result=light.concat(mid,dark);}
    if(ids)return result;b.deck_info.hand=result;return result;
  }
  // The concrete-pile and supported combined-pile branches share destination
  // processing, while combined sources retain per-card origin metadata.
  moveCards(args){
    const {from,to,skill_id}=args,b=this.b,combined=MULTIPLE[from];
    if((!PLACE[from]&&!combined&&![5,6,9,10].includes(from))||![0,1,2,3,4,5,6,7,9,11].includes(to))
      throw new MissingBattleRule('moveCards.branch',{from,to});
    let ids=this.filterMoveToHandRestrictedCards(args.card_ids,to);
    if(skill_id!=null)ids=this.filterLockHandCards(ids,to);
    ids=ids.filter(id=>args.move_to_monster_judgment||args.remove_uninteractible||!this.call('isCardUninteractible',id));
    if(to==3)for(const id of ids){const c=b.cardMap[id];if(c?.res_id=='c_1061_cre3')for(const sid of c.skill_eff_ids){
      const s=b.skillMap[sid];if(s?.stack_count0){const stack=b.stackMap[s.stack_count0];if(stack)c.testament_bullet_snapshot=stack.stack;}}}
    let moved=[],froms=[];const queued=[],unexhaust=[],unexhaustFroms={},skipCards=[];const source=b.deck_info[PLACE[from]];
    const findMonster=(id,skipSame=false)=>{if(skipSame&&to===9)return false;
      for(const owner in b.deck_info.monster){const pile=b.deck_info.monster[owner],index=pile.indexOf(id);if(index<0)continue;
        moved.push(...pile.splice(index,1));froms.push([9,Number(owner)]);return true;}return false;};
    if(from===5){if(b.deck_info.deck.length)moved.push(...b.deck_info.deck.splice(0,1));}
    else if(from===6){const index=b.deck_info.deck.length-1;moved.push(b.deck_info.deck[index]);b.deck_info.deck.splice(index,1);}
    for(const id of from===5||from===6?[]:ids){
      if(combined){
        for(const actual of combined){
          // Native findFrom* rejects the identical destination before looking
          // for a card, allowing the next source candidate to be examined.
          if(actual===to||actual===3&&b.cardMap[id]?.testament_pending)continue;
          if(actual===9){if(findMonster(id,true))break;continue;}
          if(actual===11&&!args.by_discard_used_pile&&this.call('isCardTestamentMoveLocked',id))continue;
          const pile=b.deck_info[PLACE[actual]],index=pile.indexOf(id);if(index<0)continue;
          moved.push(...pile.splice(index,1));froms.push([actual,-1]);
          if(actual===2&&to!==7||actual===11||actual===7)this.call('checkTermValue',id,'TERM_CARD_MOVE',b.char.id,true,{isWhole:true});
          if(actual===11){
            const handFull=to===2&&this.call('getHandCardCountForLimit')>=this.call('getBattleHandMaxCount')-(b.sparking?1:0);
            if(!handFull)this.call('redirectLatestCardUseActions',id,to,cardAction=>{if(to!==9&&(to===2||cardAction.place_from!==7)&&!skipCards.includes(id))skipCards.push(id);});
          }
          break;
        }
        continue;
      }
      if(from===9||from===10){findMonster(id);continue;}
      if(from==11&&!args.by_discard_used_pile&&this.call('isCardTestamentMoveLocked',id))continue;
      if(from==3&&b.cardMap[id]?.testament_pending)continue;
      const index=source.indexOf(id);if(index<0)continue;moved.push(...source.splice(index,1));
      if(from==2&&to!==7||from===7)this.call('checkTermValue',id,'TERM_CARD_MOVE',b.char.id,true,{isWhole:true});
      if(from===7){if(to!==11){const used=b.used_cards.indexOf(id);if(used>-1)b.used_cards.splice(used,1);}this.call('redirectLatestCardUseActions',id,to);}
      if(from==11){const used=b.used_cards.indexOf(id);if(used>-1)b.used_cards.splice(used,1);}}
    if(args.by_talent_unexhaustible){moved=ids;if(args.unexhaust_froms)froms=ids.map(id=>args.unexhaust_froms[id]??[from,-1]);}
    if(to==4){const keep=[],keptFroms=[],hasFroms=froms.length>0;moved.forEach((id,i)=>{if(b.cardMap[id].talents?.includes(35)){unexhaust.push(id);unexhaustFroms[id]=froms[i]??[from,-1];}else{keep.push(id);if(hasFroms)keptFroms.push(froms[i]);}});moved=keep;if(hasFroms)froms=keptFroms;}
    for(let i=0;i<moved.length;i++){
      const id=moved[i],c=b.cardMap[id];
      if(to==1||to==5||to==6){this.call('checkTermValue',id,'TERM_CARD_MOVE_TO_DECK',b.char.id,true,{isWhole:true});
        if(to==1)this.pushDeck(id);else if(to==5)b.deck_info.deck.unshift(id);else b.deck_info.deck.push(id);}
      else if(to==2){const isDraw=c.card_place==1;
        if(!this.call('pushHand',id,{isDraw,not_toast:i!=0,skill_id})){
          const suffix=moved.splice(i,moved.length);
          if(combined){for(let j=0;j<suffix.length;j++){const place=froms[i+j][0];if(place===1)this.pushDeck(suffix[j]);else if(place===9)b.deck_info.monster[froms[i+j][1]].push(suffix[j]);else if(place!==2)b.deck_info[place===7?'used':PLACE[place]].push(suffix[j]);}}
          else if(from===1)suffix.forEach(x=>this.pushDeck(x));else if(from===9||from===10){for(let j=0;j<suffix.length;j++)b.deck_info.monster[froms[i+j][1]].push(suffix[j]);}
          else if(from===7||from===11)b.deck_info.used.push(...suffix);else if(from===3||from===4)source.push(...suffix);break;}
        if(isDraw){queued.push(['CONDITION_CARD_DRAW',from,id]);const L=this.e.enums.LogicState;
          if(b.current_state!=L.Draw&&b.current_state!=L.TIMING_MON_USE_CARD_AFTER)queued.push(['CONDITION_CARD_DRAW_EXCEPT_TURN_DRAW',from,id]);}}
      else if(to==3){b.deck_info.discard.push(id);if(from==1||from==2)queued.push(['CONDITION_CARD_DISCARD',from,id]);
        const actual=froms[i]?.[0]??from;if(actual==1||actual==2){
          const count=(c.talents?.includes(44)?1:0)+this.e.passives.query({source_id:id,type:'SKILL_EFF_CARD_TESTAMENT',is_card:true}).length;
          if(count>0&&this.call('isCardAvailable',id)){c.testament_pending=true;for(let n=0;n<count;n++)this.call('pushCardCoop',{card_id:id,target:b.select_target,procUse:true,procCost:false,by_testament:true});}}
        if(actual==2)this.call('procTalentFairy',id);}
      else if(to==4){if(c.exhaust_count!=c.base_exhaust_count){c.exhaust_count=c.base_exhaust_count;this.e.ports.pushChangeData('card',id);}
        b.deck_info.exhaust.push(id);if(!args.by_skip_card_event)queued.push(['CONDITION_CARD_EXHAUST',froms[i]?.[0]??from,id]);}
      else if(to===7){c.place_before_using=from;b.deck_info.using.push(id);if((froms[i]?.[0]??from)===2)this.call('procTalentFairy',id);}
      else if(to==11)b.deck_info.used.push(id);
      else if(to===9){if(args.monster_id==null)throw this.contentError('err:invalid_card_move_to_monster');(b.deck_info.monster[args.monster_id]??=[]).push(id);}
    }
    let action;
    if(moved.length){
      // Native public moveCards deliberately rejects USING transitions after
      // source/destination edits; direct card-use methods own that animation.
      if(from===7||to===7)throw this.contentError('err:invalid_cards_move_using');
      if(skill_id!=null||args.by_force_detail_log){let type='log_skill_eff_card_move_to',params=[from,moved,to],param_types=['card_from','card_ids','card_to'];
        if(from==1&&to==2)type='log_skill_eff_card_draw';else if(from==2&&to==3)type='log_skill_eff_card_discard';else if(from==2&&to==4)type='log_skill_eff_card_exhaust';
        if(type!='log_skill_eff_card_move_to'){params=[moved];param_types=['card_ids'];}this.call('addDetailLog',{type,params,param_types});}
      const skip=args.by_check_card_bind&&from!=2,actionCards=moved.filter(id=>!skipCards.includes(id));
      if(actionCards.length){action={id:b.last_action_id++,type:'action_card_move',source_id:b.char.id,action_card:{cards:actionCards,place_from:from,place_to:to,
        place_froms:froms.length?actionCards.map(id=>froms[moved.indexOf(id)]?.[0]??from):undefined,
        enemy_turn:b.enemy_turn,caster_id:args.monster_id,move_to_monster_judgment:args.move_to_monster_judgment?true:undefined,hand_cards:to==2?this.sortHandCards(actionCards.slice()):undefined,
        skip_animation:skip,connect_source_card_id:this.w.connect_move_info?.source_card_id,connect_discard_card_ids:this.w.connect_move_info?.discard_card_ids},skip_action:skip};
      if(args.action_list)args.action_list.push(action);else if(args.action_list!==false)this.e.ports.pushAction(action);}
      this.e.ports.pushLog('Move Cards :'+moved);moved.forEach(id=>this.setCardPlace(id,to));
      if(!args.by_skip_card_event)for(const [type,place,id]of queued)this.call('procCardEvent',type,place,id,{skill_id});
      this.amount(from);
      for(const place of new Set(froms.map(p=>p[0]))){this.call('procCardEvent','CONDITION_CARD_AMOUNT',place,-1,{skill_id});this.call('procCardEvent','CONDITION_CARD_AMOUNT_SET',place,-1,{skill_id});}
      if(from===9){this.call('procCardEvent','CONDITION_CARD_AMOUNT',10,-1,{skill_id});this.call('procCardEvent','CONDITION_CARD_AMOUNT_SET',10,-1,{skill_id});}
      if(!args.by_skip_card_event)for(let i=0;i<moved.length;i++){const id=moved[i],actual=froms[i]?.[0]??from;
        if(actual==2)this.call('procCardEvent','CONDITION_CARD_MOVE_FROM_HAND',0,id,{skill_id});
        this.call('procCardEvent','CONDITION_CARD_MOVE_TO',to,id,{skill_id});
        if(actual!=11)this.call('procCardEvent','CONDITION_CARD_MOVE_TO_NOT_FROM_USED',to,id,{skill_id});
        if(skill_id!=null||!combined&&args.by_connect){this.call('procCardEvent','CONDITION_CARD_MOVE_TO_BY_EFF',to,id,{skill_id});
          if(to==2)this.call('procCardEvent','CONDITION_CARD_MOVE_TO_HAND_BY_EFF',actual,id,{skill_id});}}
      if(to==3)this.trimDiscardToLimit(undefined,skill_id);this.amount(to);if(to===9)this.amount(10);this.event('CONDITION_CARD_AMOUNT_COMPARE',0);
    }
    if(to==2&&from==1&&!args.by_additional_draw_passive&&moved.length){let count=0;
      for(const p of this.e.passives.query({source_id:b.char.id,type:'SKILL_EFF_ADDITIONAL_DRAW_PASSIVE',is_card:false})){
        count+=this.call('calcValue',p.skill_id);this.call('checkTermValuePassive',p.skill_id,b.char.id);}
      if(count>0){const extra=this.getDrawableDeckCards(count);if(extra.length)this.moveCards({skill_id,card_ids:extra,from:1,to:2,by_additional_draw_passive:true});}}
    // MissionConditionProc.dispatch is an empty client implementation. Preserve
    // its gating call and its declared event through the offline adapter.
    if(!args.by_skip_card_event&&this.call('checkMissionApply')&&args.skill_id)this.call('missionDispatch','CARD_MOVE',{battle_worktable:this.w,from,to,cards:moved});
    if(!args.by_check_orlea_creation&&!args.by_check_recall_reserved&&!args.by_check_card_bind){
      this.call('checkOrleaCreation');this.call('checkRecallReserved');if(action?.action_card)action.action_card.bind_cards=this.call('checkCardBind');this.call('checkLightDark');}
    if(unexhaust.length){args.card_ids=unexhaust;args.from=from;args.to=5;args.by_talent_unexhaustible=true;args.unexhaust_froms=unexhaustFroms;
      moved=moved.concat(this.moveCards(args));if(!args.by_check_orlea_creation&&!args.by_check_recall_reserved&&!args.by_check_card_bind&&action?.action_card)action.action_card.bind_cards=this.call('checkCardBind');}
    return moved;
  }
  // ContentError's native factory returns an ordinary Error. These callers
  // explicitly throw its result; the factory does not rename the error.
  contentError(message){return new Error(message);}
}
