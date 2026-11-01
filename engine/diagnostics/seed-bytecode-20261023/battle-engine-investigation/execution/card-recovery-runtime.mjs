// StressProc resolveCollapseRecoverCard0x4d800, recoverFromCollapseCard0x50f00,
// recoverBattleCollapseCards0x1c800; WT resyncCardHandOutline0x203100.
export class CardRecoveryRuntime {
 constructor(e){this.e=e;this.b=e.b;}
 call(n,...a){return this.e.call(n,...a);}
 action(type,fields){this.e.pushAction({id:this.b.last_action_id++,type,...fields,source_id:-1});}
 resolveCollapseRecoverCard(card){if(!card.before_change_debuff_card)return card;const s=card.change_debuff_skill_id==null?undefined:this.b.skillMap[card.change_debuff_skill_id],cs=s?.parent.type==='CS'?this.b.csMap[s.parent.id]:undefined;
  return s&&!s.removed&&cs&&!cs.removed?card:structuredClone(card.before_change_debuff_card);
 }
 resyncCardHandOutline(owner){for(const id of this.b.deck_info.all){const c=this.b.cardMap[id];if(!c||c.char_id!=owner||c.handOutline==null)continue;let changed=false;
   for(const key in c.handOutline){const sid=Number(key);if(this.b.stackMap[sid]==null)continue;const value=this.call('checkStack',sid);if(c.handOutline[sid]===value)continue;c.handOutline[sid]=value;changed=true;}
   if(changed)this.call('checkCardAvailable',id);
  }
 }
 recoverFromCollapseCard(id){const c=this.b.cardMap[id];this.call('procAddCS',c.char_id,'cs_collapse_000',0,c.char_id,false,'MATHSIGN_SET',false,true,c.char_id,-1,{origin:'COLLAPSE'});
  const owned=this.b.deck_info.all.filter(i=>this.b.cardMap[i].char_id==c.char_id),empty=[];let handCount=0;
  for(const cid of owned){const card=this.b.cardMap[cid];if(card.beforeCollapseCard){let recovered=this.resolveCollapseRecoverCard(structuredClone(card.beforeCollapseCard));if(recovered.before_overwrite_card)recovered=structuredClone(recovered.before_overwrite_card);this.call('changeCards',[card.id],recovered.res_id,{collapse_recover:true,battleCard:recovered});}
   else if(card.collapse_count!=null){if(card.card_place===2)handCount++;empty.push(card.id);}
  }
  this.call('moveCards',{card_ids:empty,from:8,to:0});if(this.b.deck_info.deck.length>0)this.call('moveCards',{card_ids:this.call('getDrawableDeckCards',handCount),from:1,to:2});
  const stage=this.e.state.worktables.BattleStageWorktable.battle_stage;this.action('action_stage_card_refresh',{action_stage_cards:this.call('createClientCards',stage.all)});
  this.resyncCardHandOutline(c.char_id);const properties=[];for(const cid of this.b.deck_info.all){const card=this.b.cardMap[cid];if(card)properties.push({card:cid,card_info:this.call('createClientCardInfo',card)});}
  if(properties.length)this.action('action_cards_refresh',{action_card_properties:properties});
 }
 recoverBattleCollapseCards(){const owners=[];for(const id of this.b.deck_info.all.slice()){const c=this.b.cardMap[id];if(!c||c.char_id<=0||owners.includes(c.char_id)||c.collapse_count==null&&c.beforeCollapseCard==null)continue;owners.push(c.char_id);this.recoverFromCollapseCard(c.id);}}
}
