// BattleWorktable.moveCard0x116700, all source/destination branches.
// Unlike moveCards, this native method permits USING and emits action_card_use.
export class SelectionMoveRuntime {
 constructor(e){this.e=e;this.b=e.b;this.w=e.wt;}
 call(n,...a){return this.e.call(n,...a);}
 error(s){throw this.call('contentError',s);}
 action(type,fields){this.e.pushAction({id:this.b.last_action_id++,type,...fields});}
 event(n,p,id=-1){this.call('procCardEvent',n,p,id);}
 amount(p){this.event('CONDITION_CARD_AMOUNT',p);this.event('CONDITION_CARD_AMOUNT_SET',p);}
 term(id,type){this.call('checkTermValue',id,type,this.b.char.id,true,{isWhole:true});}
 move(id,from,to,displayTo,monsterId,skipPlay){const b=this.b,d=b.deck_info;let c;const names={1:'deck',2:'hand',3:'discard',4:'exhaust',7:'using',11:'used'};
  if(from===0)this.error('err:from_place_none');
  if(names[from]){const pile=d[names[from]],index=pile.indexOf(id);if(index>=0){c=b.cardMap[id];if(from===4&&c.exhaust_count!=c.base_exhaust_count){c.exhaust_count=c.base_exhaust_count;this.call('pushChangeData','card',id);}pile.splice(index,1);if(from===2&&to!==7||from===7){if(from===7&&to!==11){const i=b.used_cards.indexOf(id);if(i>-1)b.used_cards.splice(i,1);}this.term(id,'TERM_CARD_MOVE');}}}
  else if(from===5){if(d.deck.length>0){c=b.cardMap[d.deck[0]];d.deck.splice(0,1);}}
  else if(from===6){const index=d.deck.length-1;c=b.cardMap[d.deck[index]];d.deck.splice(index,1);}
  else if(from===9){if(d.monster)for(const owner in d.monster){const index=d.monster[owner].indexOf(id);if(index>=0){c=b.cardMap[id];d.monster[owner].splice(index,1);}}}
  else this.error('err:no_card_place_from:'+from);
  if(c!=null){
   if(to===0){this.call('setCardPlace',id,to);this.action('action_card_remove',{card_id:id,source_id:b.char.id});displayTo=4;}
   else if(to===1){this.term(id,'TERM_CARD_MOVE_TO_DECK');this.call('pushDeck',c.id);this.call('setCardPlace',id,to);}
   else if(to===2){const isDraw=c.card_place==1;if(this.call('pushHand',c.id,{isDraw})){this.call('setCardPlace',id,to);if(isDraw){this.event('CONDITION_CARD_DRAW',from,c.id);if(![this.e.enums.LogicState.Draw,this.e.enums.LogicState.TIMING_MON_USE_CARD_AFTER].includes(b.current_state))this.event('CONDITION_CARD_DRAW_EXCEPT_TURN_DRAW',from,c.id);}}
    else if(from===1)this.call('pushDeck',c.id);else if(from===2){}else if(from===3)d.discard.push(c.id);else if(from===4)d.exhaust.push(c.id);else if(from===7||from===11){d.used.push(c.id);if(!b.used_cards.includes(c.id))b.used_cards.push(c.id);this.call('setCardPlace',id,11,undefined,true);to=11;displayTo=11;}else this.error('err:hand_full_process_error');
   }
   else if(to===3){d.discard.push(c.id);this.call('setCardPlace',id,to);if(from===1||from===2)this.event('CONDITION_CARD_DISCARD',from,c.id);if(from===2)this.call('procTalentFairy',c.id);}
   else if(to===4){if(c.talents?.includes(35)){this.term(id,'TERM_CARD_MOVE_TO_DECK');d.deck.unshift(c.id);this.call('setCardPlace',id,1);to=5;if(displayTo!=null)displayTo=5;}else{d.exhaust.push(c.id);this.call('setCardPlace',id,to);if(from===2)this.event('CONDITION_CARD_EXHAUST',from,c.id);}}
   else if(to===5||to===6){this.term(id,'TERM_CARD_MOVE_TO_DECK');if(to===5)d.deck.unshift(c.id);else d.deck.push(c.id);this.call('setCardPlace',id,1);}
   else if(to===7){c.place_before_using=from;d.using.push(c.id);this.call('setCardPlace',id,to);if(from===2)this.call('procTalentFairy',c.id);}
   else if(to===9){if(monsterId==null)this.error('err:invalid_card_move_to_monster');if(monsterId in d.monster)d.monster[monsterId].push(c.id);else d.monster[monsterId]=[c.id];this.call('setCardPlace',id,to);}
   else if(to===11){d.used.push(c.id);this.call('setCardPlace',id,to);}
   else this.error('err:no_card_place_to:'+to);
   if(from!==7&&to!==7){this.action('action_card_move',{source_id:b.char.id,action_card:{cards:[id],place_from:from,place_to:to,enemy_turn:b.enemy_turn,connect_source_card_id:this.w.connect_move_info?.source_card_id,connect_discard_card_ids:this.w.connect_move_info?.discard_card_ids}});this.call('pushLog','Move Card :'+id);}
   else{this.w.useAction=b.last_action_id;this.action('action_card_use',{source_id:b.cardMap[id].char_id,action_card:{cards:[id],place_from:from,place_to:displayTo??to,enemy_turn:b.enemy_turn},card_id:id,play:skipPlay?false:undefined});}
   if(from===7)this.amount(c.place_before_using);this.amount(from);if(from===9)this.amount(10);if(from===2)this.event('CONDITION_CARD_MOVE_FROM_HAND',0,c.id);this.event('CONDITION_CARD_MOVE_TO',to,c.id);if(from!==11)this.event('CONDITION_CARD_MOVE_TO_NOT_FROM_USED',to,c.id);if(to===3)this.call('trimDiscardToLimit');this.amount(to);if(to===9)this.amount(10);
  }
  this.event('CONDITION_CARD_AMOUNT_COMPARE',0);this.call('checkRecallReserved');const block=b.action_blocks[b.action_blocks.length-1],last=block?.actions?.[block.actions.length-1];if(last?.action_card)last.action_card.bind_cards=this.call('checkCardBind');this.call('checkLightDark');return c;
 }
}
