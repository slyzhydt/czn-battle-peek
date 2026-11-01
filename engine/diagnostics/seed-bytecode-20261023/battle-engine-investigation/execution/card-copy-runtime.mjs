// BattleWorktable.copyCards0x128b00 and BattleCardProc.copyTalentCounts0x92300.
// Static trees: evidence/batch3-cards/selection-copy-source/ and olga-pyeonrin-source/.
import {TALENTS as T} from './card-talent-support.mjs';
export class CardCopyRuntime {
 constructor(e){this.e=e;this.b=e.b;this.w=e.wt;this.db=e.db;}
 call(n,...a){return this.e.call(n,...a);}
 event(n,p,id=-1,o){return this.call('procCardEvent',n,p,id,o);}
 action(type,fields){const a={id:this.b.last_action_id++,type,...fields};this.e.pushAction(a);return a;}
 contentError(message){throw this.call('contentError',message);}
 copyTalentCounts(from,to){for(const k of ['base_exhaust_count','exhaust_count','base_remove_count','remove_count','base_recall_count','recall_count','base_bind_count','bind_count','bind_max_count','ignite_count','base_tipera_count','tipera_count','base_olga_count','olga_count'])to[k]=from[k];to.desire_talent_counts=from.desire_talent_counts?{...from.desire_talent_counts}:undefined;to.tipera_ran_skill_index=from.tipera_ran_skill_index?from.tipera_ran_skill_index.slice():undefined;}
 copyCards(ids,to,N,skillId,args={}){
  const {ignoreCond,exceptCS,opts,copyTiperaDisabled,bindStack}=args,talentKeys=Object.keys(T).filter(k=>isNaN(Number(k))),talents=opts?.filter(o=>talentKeys.some(k=>o===k||o.startsWith(k)))??[],overflow=opts?.includes('overflow_to_deck_top')??false,noCount=opts?.includes('create_no_count')??false,stageInfos=[],map={},pending=[];
  let created=[],curse=false,limit=-1;const bans=this.call('getPassiveByType',{source_id:this.b.char.id,type:'SKILL_EFF_BAN_CARD_CREATION_TURN',is_card:false});if(bans.length)limit=this.call('calcValue',bans[0].skill_id);
  for(const id of ids){const from=this.b.cardMap[id],row=this.db.get('card',from.res_id);if(from.char_id>0&&this.call('isCollapseOnCharacterByID',from.char_id))continue;map[id]=[];if(row.card_category==='CARD_CURSE')curse=true;
   const collapse=['CARD_COLLAPSE','CARD_COLLAPSE_SKILL'].includes(row.card_category),counted=[1,2,3,7].includes(from.char_id)&&!collapse&&!noCount;
   let capacity=-1,slots=0;if(to===2&&!collapse)capacity=Math.max(0,this.call('getBattleHandMaxCount')-(this.b.sparking?1:0)-this.call('getHandCardCountForLimit'));
   for(let n=0;n<N;n++){
    if(counted&&limit>=0&&(this.b.turn_card_creation_count??0)>=limit){this.action('action_toast',{source_id:-1,msg:'ui_toast_ban_card_creation'});this.call('addDetailLog',{type:'log_ban_card_creation',params:[],param_types:[]});break;}
    const info=structuredClone(from);info.id=this.b.last_unit_id++;info.r_spark_candis=undefined;info.y_spark=undefined;
    const c=this.call('createBattleCard',info,from.override_skill_eff_res_ids?{override_skill_eff_ids:from.override_skill_eff_res_ids}:undefined);c.get_card=true;c.talents=from.talents?.slice();this.copyTalentCounts(from,c);
    if(bindStack!=null&&bindStack>0&&c.bind_max_count!=null)c.bind_count=bindStack-1;
    if(exceptCS)c.by_turn_draw=true;else {c.by_turn_draw=from.by_turn_draw;c.ccsOutline=from.ccsOutline;}
    if(talents.length)this.call('addTalents',c.id,talents,true);
    if(copyTiperaDisabled&&from.skill_eff_ids.length===c.skill_eff_ids.length)for(let i=0;i<from.skill_eff_ids.length;i++){const before=this.b.skillMap[from.skill_eff_ids[i]],after=this.b.skillMap[c.skill_eff_ids[i]];if(before?.tipera_disabled&&after)after.tipera_disabled=true;}
    created.push(c);map[id].push(c.id);
    const exempt=to===2&&this.call('isHandMaxAmountExceptCard',c.id),room=capacity===-1||slots<capacity,binding=to===2&&!room&&!exempt&&this.call('willBindInHand',c.id,pending);
    if(counted&&(room||exempt||binding)){this.b.turn_card_creation_count=(this.b.turn_card_creation_count??0)+1;this.event('CONDITION_CARD_GET_BAN_CHECKED',to,c.id);}
    if(!exempt&&room)slots++;if(to===2&&(room||exempt||binding))pending.push(c.id);if(curse)stageInfos.push(info);
   }
  }
  if(curse)stageInfos.forEach(cardInfo=>this.b.stage_actions.push({type:'get',id:cardInfo.id,cardInfo}));
  const destination=to;if(![1,2,3,4,5,6,7,11].includes(destination))this.contentError(destination===0?'err:to_place_none':'err:no_card_place_to:'+destination);
  for(let i=0;i<created.length;i++){const c=created[i],d=this.b.deck_info;if(destination===2){const before=c.by_turn_draw;if(this.call('pushHand',c.id,{isDraw:false,not_toast:i!==0,skill_id:skillId,allow_overflow:this.call('willBindInHand',c.id)})){d.all.push(c.id);this.call('setCardPlace',c.id,to,false);c.by_turn_draw=before;}else if(overflow){d.deck.unshift(c.id);d.all.push(c.id);this.call('setCardPlace',c.id,1,false);to=1;}else{created=created.slice(0,i);break;}}
   else {if(destination===1)this.call('pushDeck',c.id);else if(destination===5)d.deck.unshift(c.id);else d[{3:'discard',4:'exhaust',6:'deck',7:'using',11:'used'}[destination]].push(c.id);if(destination===4)c.exhaust_count=c.base_exhaust_count;d.all.push(c.id);this.call('setCardPlace',c.id,destination===5||destination===6?1:to,false);if(destination===11)this.b.used_cards.push(c.id);}
  }
  const quiet=opts?.includes('quiet')??false,action={id:this.b.last_action_id++,type:'action_card_copy',source_id:this.b.char.id,action_card_new:{cards:created,place_to:to,enemy_turn:this.b.enemy_turn,add_stage:false,skip_animation:quiet},card_map:this.b.cardMap};
  if(created.length){const skill=this.b.skillMap[skillId],eff=skill?this.db.get('skill_eff',skill.res_id)?.eff:undefined,origin=['SKILL_EFF_CARD_COPY_TO_ORIGIN','SKILL_EFF_CARD_COPY_TO_IGNORE_COND_ORIGIN','SKILL_EFF_CARD_COPY_TO_EXCEPT_CS_ORIGIN'].includes(eff);
   if(!quiet){const groups={};for(const c of created){if(!groups[c.res_id])groups[c.res_id]=[c.id,1];else groups[c.res_id][1]++;}for(const key in groups)this.call('addDetailLog',{type:origin?'log_skill_eff_card_get':'log_skill_eff_card_copy_to',params:[groups[key],to],param_types:['card_id_with_count','card_to_wo_hand']});}
   this.e.pushAction(action);if(to===3)this.call('trimDiscardToLimit',undefined,skillId);
   for(const c of created){if(this.call('checkBan',c.id))this.action('action_card_banned',{action_card_property:{card:c.id,banned:true},source_id:-1});const cost=this.call('updateCostResult',c.id);if(cost.changed){this.call('pushChangeData','card',c.id);this.action('action_card_cost',{action_card_property:{card:c.id,cost:cost.new_cost},skip_action:c.card_place!==2,source_id:-1});}if(origin)this.event(ignoreCond?'CONDITION_IGNORED_CARD_GET':'CONDITION_CARD_GET',to,c.id,ignoreCond?undefined:{skill_id:skillId});}
   this.call('pushLog','Copy Card');for(const place of [to,8]){this.event('CONDITION_CARD_AMOUNT',place);this.event('CONDITION_CARD_AMOUNT_SET',place);}
  }
  for(const original in map){const from=this.b.cardMap[original];for(const copied of map[original]){const c=this.b.cardMap[copied];if(!exceptCS)for(const csId of from.continueSkill??[]){const cs=this.b.csMap[csId];if(!cs)continue;const newId=this.call('procAddCS',c.id,cs.res_id,cs.term_value,cs.caster_id,true,'MATHSIGN_SET',false,true,cs.char_id,-1,{origin:cs.origin}),added=this.b.csMap[newId];if(!added)continue;
     if(cs.skillEffs.length!=added.skillEffs.length)this.contentError('err:something_wrong_at_copy_cards');for(let i=0;i<cs.skillEffs.length;i++){const before=this.b.skillMap[cs.skillEffs[i]],after=this.b.skillMap[added.skillEffs[i]];for(const key of ['stack_trigger','stack_value0','stack_value1','stack_count0','stack_count1'])if(after[key]&&before[key]&&this.b.stackMap[after[key]]&&this.b.stackMap[before[key]])this.e.stacks.setStack(after[key],this.b.stackMap[before[key]].stack);}
    }
    if(from.stage_save){if(curse)c.stage_save=true;for(let i=0;i<from.skill_eff_ids.length;i++){const before=this.b.skillMap[from.skill_eff_ids[i]],after=this.b.skillMap[c.skill_eff_ids[i]];if(before&&after){after.changed_value=before.changed_value?.slice();after.changed_count_value=before.changed_count_value;}}}
   }}
  this.call('checkOrleaCreation');if(action.action_card_new)action.action_card_new.bind_cards=this.call('checkCardBind');this.call('checkLightDark');return created.map(c=>this.call('checkCardChangePassive',this.call('checkOverwrite',c.id)));
 }
}
