// Team-changing active effects and BattleProc enter/leave helpers. Evidence:
// active-effects/combatants.linear.txt, combatant-callbacks, combatant-helpers,
// combatant-passives, combatant-stage-helpers (actual snapshot string mapping).
import {MissingBattleRule} from './resource-store.mjs';
import {buildClientCache} from './client-cache-builders.mjs';
export const COMBATANT_EFFECT_NAMES=new Set(['SKILL_EFF_COMBATANT_CHANGE_TEAM_WITH_HAND','SKILL_EFF_COMBATANT_ADD_TEAM']);
export const COMBATANT_BINDINGS={onLeaveCombatant:'leave',onAddCombatant:'enter',getCardDeck:'getCardDeck',applySupporterPassive:'supporterPassive',applyPieceSet:'pieceSet',applyPotentialCS:'potentialCS',getDataCache:'getDataCache'};
export class CombatantRuntime {
 constructor(e){this.e=e;this.b=e.b;this.w=e.wt;this.db=e.db;}
 get stage(){return this.e.state.worktables.BattleStageWorktable.battle_stage;}
 call(n,...a){return this.e.call(n,...a);}
 action(type,fields){this.e.pushAction({id:this.b.last_action_id++,type,...fields});}
 getChar(id){const char=this.call('tryGetCharByCharId',id);if(!char)throw new MissingBattleRule('combatant.battle_char',{id});return char;}
 stageChar(id){const char=this.call('tryGetStageCharByCharId',id);if(!char)throw new MissingBattleRule('combatant.stage_char',{id});return char;}
 // ClientGameDataStore.getCache0x7b00 returns exact captured cache strings.
 // Its supporter builder0x16100 only creates ':default', not group indexes.
 // Do not invent group contents from rows; a real run must export tag_cache.
 getDataCache(key,options){const cache=this.e.state.resourceCaches?.game_data_store;if(cache==null)throw new MissingBattleRule('input.GameDataStore.tag_cache',{key});if(cache[key]==null){const prefix=key.split(':')[0];if(['SUPPORTER_TACTIC_PASSIVE_GROUP','CARD_R_SPARK_CARD_CHANGE'].includes(prefix))cache[prefix+':default']=JSON.stringify([]);else if(!buildClientCache(prefix,{db:this.db,cache}))throw new MissingBattleRule('clientDataCache.builder',{key});}if(options?.skipError)return cache[key];if(cache[key]==null)throw new MissingBattleRule('clientDataCache.key_absent',{key});return cache[key];}
 parameterEvents(oldMax,oldHP,max,hp,delta){const id=this.b.char.id,emit=(type,args)=>this.call('procUnitEvent',type,args),before=oldHP*100/oldMax,after=hp*100/max;
  emit('CONDITION_CHAR_PARAMETER',[id,'max_hp',oldMax,max]);emit('CONDITION_CHAR_PARAMETER',[id,'cur_hp',oldHP,hp]);emit('CONDITION_CHAR_CUR_HP_CHANGE',[id,'cur_hp',delta]);emit('CONDITION_CHAR_PARAMETER',[id,'cur_hp_pct',before,after]);emit('CONDITION_CHAR_CUR_HP_CHANGE',[id,'cur_hp_pct',after-before]);
 }
 healAction(s,byCard,oldHP,max,delta){this.action('action_heal',{source_id:s.action_char_id,action_list:[{action_units:[[this.b.char.id,{heal:delta,old_hp:oldHP,new_hp:oldHP+delta,max_hp:max}]]}],card_id:s.parent.type==='CARD'?s.parent.id:-1,byCard,skip_action:true});}
 leave(ids){for(const key in this.b.csMap){const cs=this.b.csMap[key];if(!cs||cs.removed)continue;const row=this.db.get('cs',cs.res_id);if(['OWN_CHAR','OWN_CASTER','OWN_CHAR_EFF_TEAM'].includes(row.own_type)&&ids.includes(cs.caster_id))this.call('removeContinueSkill',cs.cs_id,cs.owner_id,cs.isCard);}
  this.call('moveCards',{card_ids:this.b.deck_info.all.filter(id=>ids.includes(this.b.cardMap[id].char_id)),from:this.call('cardPlace','CARD_PLACE_ALL'),to:this.call('cardPlace','CARD_PLACE_NONE')});
 }
 enter(ids){this.stage.supporters.forEach(sup=>{if(!sup)return;const char=this.stageChar(sup.id-3);if(ids.includes(char.id))this.supporterPassive(char,sup);});for(const char of this.stage.chars)if(ids.includes(char.id)){this.pieceSet(char);this.potentialCS(char);}}
 supporterPassive(char,sup){const combatant=this.db.get('char_combatant',char.res_id),partner=this.db.get('char_partner',sup.res_id),restriction=partner.passive_condition_link_base_class_define_id;
  if(restriction&&restriction!=='none'&&combatant.link_base_class_define_id!=restriction)return;if(partner.link_partner_passive_group==='none')return;
  const ids=this.call('getDataCache','SUPPORTER_TACTIC_PASSIVE_GROUP:'+partner.link_partner_passive_group);
  for(const id of typeof ids==='string'?JSON.parse(ids):ids){const row=this.db.get('partner_passive',id);if(this.db.number(row,'level')!==sup.limit_break+1)continue;const links=this.db.array(row.link_cs_id),values=this.db.array(row.cs_add_value).map(Number);
   links.forEach((res,i)=>{const csId=this.call('procAddCS',this.b.char.id,res,values[i],char.id,false,'MATHSIGN_ADD',false,true,char.id,-1,{origin:'TACTIC_PASSIVE'}),cs=this.b.csMap[csId];if(cs)cs.from_tactic_passive=row.id;});
  }
 }
 pieceSet(char){if(!char.piece_set_options)return;for(const set of char.piece_set_options){const row=this.db.table('piece_set_option')[set.res_id];if(!row||row['set'+set.satisfiedSet+'_type']!=='SET_TYPE_CS')continue;
  this.call('procAddCS',this.b.char.id,row['set'+set.satisfiedSet+'_option_multiple_link'],Number(row['set'+set.satisfiedSet+'_value']),this.b.char.id,false,'MATHSIGN_ADD',false,false,char.id,-1,{origin:'RELIC'});
 }}
 potentialCS(char){if(char.potential_cs==null)return;for(const id in char.potential_cs){const row=this.db.get('potential_node_effect',id);char.potential_cs[id].forEach(res=>{const csId=this.call('procAddCS',this.b.char.id,res,this.db.number(row,'value'),char.id,false,'MATHSIGN_ADD',false,true,char.id,-1,{fromPotential:id,origin:'POTENTIAL'});const cs=this.b.csMap[csId];if(cs)cs.delay=1;});}}
 dispatch(id,c){const s=this.b.skillMap[id],r=this.db.get('skill_eff',s.res_id);if(r.eff==='SKILL_EFF_COMBATANT_ADD_TEAM')this.add(s,c.options?.byCard);else this.change(s,c.options?.byCard);return {targets:c.targets};}
 add(s,byCard){const members=s.eff_opt_multiple_link??[];if(!members.length)throw new MissingBattleRule('combatant.add_empty',{id:s.skill_id});const added=[];
  members.forEach(member=>{const index=this.stage.leaved_chars?.findIndex(x=>x==Number(member));if(index==null||index===-1)return;const res=this.stage.leaved_chars?.splice(index,1)[0];if(!res)return;const char=this.b.chars.find(x=>x.res_id==res);if(!char)throw new MissingBattleRule('combatant.add_missing_char',{res});added.push(char.id);char.opacity=255;this.action('action_char_add',{source_id:char.id,value:res});
   const delta=char.status.info.S_HP,oldMax=this.call('getStatus',this.b.char.id,'S_HP'),oldHP=this.call('getStatus',this.b.char.id,'S_CURRENT_HP'),max=this.call('setStatus',this.b.char.id,'S_HP',oldMax+delta),hp=this.call('setStatus',this.b.char.id,'S_CURRENT_HP',oldHP+delta);
   this.parameterEvents(oldMax,oldHP,max,hp,delta);this.healAction(s,byCard,oldHP,max,delta);this.call('addDetailLog',{type:'log_skill_eff_max_hp',params:[this.b.char.id,delta],param_types:['unit_id','value']});
  });
  added.forEach(charId=>{const cards=this.stage.all.filter(x=>x.char_id==charId);this.call('getCards',{source_id:1,card_res_ids:cards.map(x=>x.res_id),cards,to:this.call('cardPlace','CARD_PLACE_DECK'),N:1,addStage:false,eff_opt:s.eff_opts??[]});});
  if(added.length){this.enter(added);this.call('procUnitEvent','CONDITION_CHAR_ID',[this.b.char.id]);}
 }
 getCardDeck(group,inBattle=false){const remaining=inBattle?[]:this.stage.all.slice(),selected=[],rows=Object.values(this.db.table('card_deck')).filter(x=>x.group==group).sort((a,b)=>a.order-b.order);if(!rows.length)throw new MissingBattleRule('combatant.card_deck_not_found',{group});
  const listType=rows[0].deck_list_type;for(const row of rows){const res=row.link_card_id,slot=this.db.number(row,'owner_slot'),order=this.db.number(row,'after_shuffle_order'),opts=JSON.parse(row.additional_opt);if(res==null||res==='none')continue;
   if(res.startsWith('battle_card_reward_')){const reward=this.stage.battle_card_rewards[Number(res.slice('battle_card_reward_'.length))];if(reward==null)continue;const i=remaining.findIndex(x=>x.id==reward);if(i>=0){if(order!=-1)remaining[i].shuffle_order=order;selected.push(remaining[i]);remaining.splice(i,1);}continue;}
   const spark=opts.r_spark?{res_id:opts.r_spark,category:this.db.table('card_r_spark')[opts.r_spark]?'CATEGORY_UNIQUE':'CATEGORY_PUBLIC'}:undefined,old=remaining.findIndex(x=>x.res_id==res),already=selected.findIndex(x=>x.res_id==res);
   if(already>=0&&order!=-1){selected[already].shuffle_order=order;continue;}
   if(old>=0){if(order!=-1)remaining[old].shuffle_order=order;if(spark)remaining[old].r_spark=spark;selected.push(remaining[old]);remaining.splice(old,1);}
   else{const info={id:inBattle?this.b.last_unit_id++:this.call('getStageGenerateID'),res_id:res,char_id:slot<0?1:slot+1,shuffle_order:order!=-1?order:undefined,r_spark:spark};this.call('stageAddCard',false,info);selected.push(info);}
  }
  let result=selected;if(listType!=='LIST_TYPE_FORCE')result=selected.concat(listType==='LIST_TYPE_DECK_ORDER'?this.call('shuffleInPlace',0,remaining):remaining);
  return [result,!['LIST_TYPE_ORDER','LIST_TYPE_DECK_ORDER','LIST_TYPE_FORCE'].includes(listType)];
 }
 change(s,byCard){const opts=s.eff_opts??[];if(!opts.length)throw new MissingBattleRule('combatant.change_empty',{id:s.skill_id});const slot=Number(opts[0]),custom=opts[1],deck=opts[2],hand=Number(opts[3]),before=this.getChar(slot+1),stageBefore=this.stageChar(slot+1),collapsed=this.call('isCollapseOnCharacter',stageBefore),sub=[];
  this.w.tempActions=sub;this.leave([slot+1]);let awaken=-1,partner=-1;this.b.ep_skill_deck.forEach((x,i)=>{if(x?.char_id==slot+1)awaken=i;else if(x?.char_id-3==slot+1)partner=i;});if(awaken>=0)this.b.ep_skill_deck[awaken]=undefined;if(partner>=0)this.b.ep_skill_deck[partner]=undefined;this.action('action_ep_skill_slots',{source_id:-1,action_ep_skill_slots:this.b.ep_skill_deck.slice()});
  this.call('moveCards',{card_ids:this.b.deck_info.hand.slice(),from:this.call('cardPlace','CARD_PLACE_HAND'),to:this.call('cardPlace','CARD_PLACE_DISCARD')});
  const [cards]=this.getCardDeck(deck,true),oldHP=this.call('getStatus',this.b.char.id,'S_CURRENT_HP'),oldMax=this.call('getStatus',this.b.char.id,'S_HP'),effectiveMax=collapsed?oldMax+(stageBefore.collapse_dec_max_hp??0):oldMax,newTeam=this.call('addCombatantByCustomData',slot,custom,true);if(!newTeam)return;
  const char=newTeam[0],row=this.db.get('char_combatant',char.res_id);this.w.tempActions=undefined;this.action('action_char_change',{source_id:slot+1,value:char.res_id,character_info:char,action_sub:sub});const live=this.getChar(slot+1);live.res_id=char.res_id;live.status=char.status;live.total_spark_count=char.total_spark_count;
  const delta=newTeam[0].status.info.S_HP-before.status.info.S_HP,max=this.call('setStatus',this.b.char.id,'S_HP',effectiveMax+delta),hp=this.call('setStatus',this.b.char.id,'S_CURRENT_HP',oldHP+delta);this.parameterEvents(oldMax,oldHP,max,hp,delta);
  this.w.tempActions=sub;if(delta>0)this.healAction(s,byCard,oldHP,max,delta);else this.action('action_hp_refresh',{source_id:-1,hp,max_hp:max});this.w.tempActions=undefined;
  const makeSlot=(unit,res,isPartner,index)=>{const card=this.call('createBattleCard',this.call('makeCardInfo',this.b.last_unit_id++,res,unit.id));if(isPartner)card.ep_skill=true;this.b.deck_info.all.push(card.id);const cost=this.db.number(this.db.get('card',res),'cost'),value={isPartner,char_id:unit.id,char_res_id:unit.res_id,card_res_id:res,cost:cost*100,card_id:card.id,origin_cost:cost};if(index>=0)this.b.ep_skill_deck[index]=value;else this.b.ep_skill_deck.push(value);};
  makeSlot(char,row.collapse_skill_link_card_id,false,awaken);if(newTeam[1])makeSlot(newTeam[1],this.db.get('char_partner',newTeam[1].res_id).link_card_id,true,partner);else if(partner>=0)this.b.ep_skill_deck.splice(partner,1);
  this.action('action_ep_skill_slots',{source_id:-1,action_ep_skill_slots:this.b.ep_skill_deck.slice()});for(const [group,to]of [[cards.slice(0,hand),'CARD_PLACE_HAND'],[cards.slice(hand),'CARD_PLACE_DECK_BOTTOM']])this.call('getCards',{source_id:slot+1,card_res_ids:group.map(x=>x.res_id),cards:group,to:this.call('cardPlace',to),N:1,addStage:true,eff_opt:opts});
  this.action('action_stage_card_refresh',{action_stage_cards:this.call('createClientCards',this.stage.all),source_id:-1});this.call('procUnitEvent','CONDITION_CHAR_ID',[this.b.char.id]);
 }
}
