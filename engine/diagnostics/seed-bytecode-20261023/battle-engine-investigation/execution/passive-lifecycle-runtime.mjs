// Source-bound eager passive effects. Retained source: evidence/batch2-passive*/.
// Registration/removal ordering remains in LifecycleRuntime; these ports run
// after insertion/removal and therefore query the resulting ordered list.
import {MissingBattleRule} from './resource-store.mjs';
import {PassiveCardSupportRuntime} from './passive-card-support-runtime.mjs';
export const PASSIVE_LIFECYCLE_BINDINGS={
 'addPassiveSkill.card_effect':'addPassiveCardEffect','addPassiveSkill.effect':'addPassiveUnitEffect',
 'removePassiveSkillBySkillID.effect':'removePassiveEffect',
 checkValueChangePassive:'checkValueChangePassive',checkRunPctAddPassive:'checkRunPctAddPassive',
 getEpSkillCost:'getEpSkillCost',recoverCardChangePassive:'recoverCardChangePassive',recoverOverwrite:'recoverOverwrite',
 getTutorialBanTargetCards:'getTutorialBanTargetCards',checkTutorialBan:'checkTutorialBan',
 cardUseBan:'cardUseBan',tutorialCardUseBan:'tutorialCardUseBan',isWaveTransitionBlockedSkill:'isWaveTransitionBlockedSkill',
 applyChangeDebuff:'applyChangeDebuff',recoverChangeDebuff:'recoverChangeDebuff',
 'useParent:CARD':'useCardParent','toggleParent:CARD':'toggleCardParent','removeParent:CARD':'removeCardParent',
 checkNihilumMetaStack:'checkNihilumMetaStack',setRSpark:'setRSpark',rSpark:'rSpark',cardRSpark:'cardRSpark'
};
export class PassiveLifecycleRuntime {
 constructor(e){this.e=e;this.b=e.b;this.w=e.wt;this.db=e.db;this.cardSupport=new PassiveCardSupportRuntime(e);}
 call(n,...a){return this.e.call(n,...a);}
 setRSpark(...a){return this.e.cardCreate.spark.setRSpark(...a);}
 rSpark(...a){return this.e.cardCreate.spark.rSpark(...a);}
 cardRSpark(...a){return this.e.cardCreate.spark.cardRSpark(...a);}
 skill(id){const s=this.b.skillMap[id];if(!s)throw new MissingBattleRule('passive.skill',{id});return s;}
 row(s){return this.db.get('skill_eff',s.res_id);}
 query(q){return this.call('getPassiveByType',q);}
 action(type,data){this.e.pushAction({id:this.b.last_action_id++,type,source_id:-1,...data});}
 cardAction(type,id,fields,extra={}){this.action(type,{action_card_property:{card:id,...fields},...extra});}
 amounts(place){for(const type of ['CONDITION_CARD_AMOUNT','CONDITION_CARD_AMOUNT_SET'])this.call('procCardEvent',type,place,-1);}
 targets(id){return this.call('getTargetCards',id,false,false,false).target_cards_id;}
 log(type,params,param_types,by){this.call('addDetailLog',{type,params,param_types,by});}
 text(card){this.e.pushChangeData('card',card.id);if(card.card_place==2)this.cardAction('action_card_text_refresh',card.id,{});}
 affectedChars(s){
  const cs=this.b.csMap[s.parent.id];if(!cs)return [-1,1,2,3];
  const type=this.db.get('cs',cs.res_id).own_type;
  return ['OWN_CHAR','OWN_CHAR_EFF_TEAM'].includes(type)?[cs.action_target_id]:type==='OWN_CASTER'?[cs.caster_id]:[-1,1,2,3];
 }
 // Worktable 0x1d5300 / 0x1d7200. These refresh text; no probability roll.
 checkValueChangePassive(id){const s=this.skill(id),chars=this.affectedChars(s);
  this.b.deck_info.all.forEach(cid=>{const c=this.b.cardMap[cid];if(chars.includes(c.char_id)&&c.skill_eff_ids.some(i=>{const other=this.b.skillMap[i];return other&&s.eff_opt_multiple_link?.includes(other.res_id);}))this.text(c);});
 }
 checkRunPctAddPassive(id,owner,isCard){const s=this.skill(id),nontrivial=c=>c.skill_eff_ids.some(i=>{const other=this.b.skillMap[i],row=other?this.db.table('skill_eff')[other.res_id]:undefined;return row&&this.db.number(row,'run_pct')!==100;});
  if(isCard){const c=this.b.cardMap[owner];if(c&&nontrivial(c))this.text(c);return;}
  const chars=this.affectedChars(s);this.b.deck_info.all.forEach(cid=>{const c=this.b.cardMap[cid];if(chars.includes(c.char_id)&&nontrivial(c))this.text(c);});
 }
 // BattleProc 0x77400: result is in hundredths of an EP, including modifiers.
 getEpSkillCost(ep,use=false){let cost=ep.origin_cost*100;const stageChar=this.call('tryGetStageCharByCharId',ep.char_id);
  if(stageChar?.collapse_recovered_cost_decreased)cost-=400;
  this.query({source_id:this.b.char.id,type:'SKILL_EFF_EGOSKILL_COST_CHANGE',is_card:false,char_id:ep.char_id}).forEach(p=>{
   if(p.eff_opts?.includes('combatant')&&ep.isPartner)return;
   const s=this.b.skillMap[p.skill_id];if(!s)return;
   cost=this.call('procMathSign',this.row(p).eff_value_math_sign,cost,this.call('calcValue',s.skill_id)*100);
   if(use)this.call('checkTermValuePassive',p.skill_id,ep.char_id);
  });return Math.max(0,cost);
 }
 refreshEp(){let changed=false;this.b.ep_skill_deck.forEach(ep=>{if(ep){const old=ep.cost;ep.cost=this.getEpSkillCost(ep);if(old!=ep.cost)changed=true;}});
  if(changed)this.action('action_ep_skill_slots',{action_ep_skill_slots:this.b.ep_skill_deck.slice()});
 }
 refreshEgo(ids,single=false){let changed=false;const places=[];
  ids.forEach(id=>{const c=this.b.cardMap[id],old=c.curEgo,ego=this.call('getEgo',id);if(old==ego)return;changed=true;places.push(c.card_place);this.cardAction('action_card_change_ego',id,{ego});});
  if(!changed)return;if(this.b.before_used_card>0)this.call('procCardEvent','CONDITION_CARD_BEFORE_EGO_TYPE',0,this.b.before_used_card);
  // Native keeps duplicate places, so retain their repeated notifications.
  if(single)this.amounts(this.b.cardMap[ids[0]].card_place);else places.forEach(p=>this.amounts(p));
 }
 addPassiveCardEffect(id,owner,isCard,sourceSkill){const s=this.skill(id),r=this.row(s),c=this.b.cardMap[owner];
  switch(r.eff){
   case 'SKILL_EFF_CARD_USE_BAN':if(this.call('checkBan',owner))this.cardAction('action_card_banned',owner,{banned:true});break;
   case 'SKILL_EFF_TUTORIAL_BAN_CARD_USE':this.checkTutorialBan(owner);break;
   case 'SKILL_EFF_CARD_COST_CHANGE':{
    const old=c.cost_result??c.cost,{changed,new_cost}=this.call('updateCostResult',owner);this.e.pushChangeData('card',owner);let show=changed,event=true;
    const spark=String(this.db.get('constant_meta','spark_cost_cs_id').value),cs=s.parent.type==='CS'?this.b.csMap[s.parent.id]:undefined;
    if(cs){if(cs.res_id==spark){show=false;event=false;}if(cs.caster_id==c.id)event=false;}
    if(show&&old!=new_cost)this.log('log_skill_eff_card_cost_change',[owner,new_cost-old],['card_id','cost'],sourceSkill);
    if(changed){this.cardAction('action_card_cost',owner,{cost:new_cost},{skip_action:c.card_place!=2});if(event&&new_cost<old)this.call('procCardEvent','CONDITION_CARD_COST_DECREASE',c.card_place,c.id,{skill_id:sourceSkill});}break;
   }
   case 'SKILL_EFF_CARD_RETAIN':this.log('log_skill_eff_card_retain',[owner],['card_id'],sourceSkill);this.cardAction('action_card_retain',owner,{retain:true});this.amounts(c.card_place);break;
   case 'SKILL_EFF_CARD_CONNECT':{
    const team=this.query({source_id:this.b.char.id,type:r.eff,is_card:false}),T=this.e.passives.talent;
    const already=c.connect_passive||c.talents?.includes(T.TALENT_CONNECT)||c.talents?.includes(T.TALENT_CONNECT_INFINITE)||this.query({source_id:owner,type:r.eff,is_card:true}).length>1||team.some(p=>this.targets(p.skill_id).includes(owner));
    c.connect_passive=true;if(!already)this.log('log_skill_eff_card_connect',[owner],['card_id'],sourceSkill);
    this.cardAction('action_card_connect',owner,{connect:true});this.amounts(c.card_place);break;
   }
   case 'SKILL_EFF_CARD_TESTAMENT':{
    c.testament_passive=true;if(this.db.get('card',c.res_id).ui_interrupt_outline==='YES'){
     c.interruptKeywords??=[];if(!c.interruptKeywords.includes('SKILL_EFF_CARD_DISCARD')){c.interruptKeywords.push('SKILL_EFF_CARD_DISCARD');c.testament_passive_outline_added=true;}
    }this.e.pushChangeData('card',owner);this.amounts(c.card_place);break;
   }
   case 'SKILL_EFF_CHANGE_EGO':this.refreshEgo([owner],true);break;
   case 'SKILL_EFF_CARD_CHANGE_DEBUFF':if(s.eff_opt_multiple_link?.[0])this.call('applyChangeDebuff',owner,s.eff_opt_multiple_link[0],id);break;
   case 'SKILL_EFF_RUN_PCT_ADD':this.checkRunPctAddPassive(id,owner,true);break;
   case 'SKILL_EFF_UNIQUE_TIPERA_1':{
    const mode=s.eff_opts?.[0];if(mode==='ran'||mode==='all'){
     const pool=c.skill_eff_ids.filter(i=>!c.r_spark_skill_eff_ids?.includes(i));if(pool.length){const n=this.call('calcCountValue',id);s.tipera_indices=[];for(let i=0;i<n;i++)s.tipera_indices.push(mode==='ran'?this.e.random.randRange(0,0,pool.length):0);}
    }if(c.card_place==2)this.text(c);break;
   }
  }
 }
 addPassiveUnitEffect(id,owner,isCard,sourceSkill,eff){const s=this.skill(id),r=this.row(s);
  if(eff!==r.eff)throw new MissingBattleRule('passive.effect_mismatch',{id,eff});
  switch(eff){
   case 'SKILL_EFF_CARD_RETAIN':this.amounts(2);break;
   case 'SKILL_EFF_CARD_CONNECT':this.targets(id).forEach(cid=>this.cardAction('action_card_connect',cid,{connect:true}));this.amounts(2);break;
   case 'SKILL_EFF_CARD_OVERWRITE':{const resources=this.db.array(r.target_card_set_opt_multiple_link);this.b.deck_info.all.forEach(cid=>{if(resources.includes(this.b.cardMap[cid].res_id))this.call('applyOverwrite',cid,s.eff_opt_multiple_link[0]);});break;}
   case 'SKILL_EFF_CARD_CHANGE_PASSIVE':{const res=s.eff_opts?.[0];if(res){const targets=this.targets(id),n=this.call('calcValue',id);(n<0?targets:targets.slice(0,n)).forEach(cid=>this.call('applyCardChangePassive',cid,res,id));}break;}
   case 'SKILL_EFF_ENERGY_MAINTAIN':this.call('addDetailLog',{type:'log_skill_eff_energy_maintain',params:[],param_types:[]});break;
   case 'SKILL_EFF_CARD_USE_BAN':{
    if(s.usable===false)return;this.targets(id).forEach(cid=>{const c=this.b.cardMap[cid];c.banned=true;c.banned_allow_use=(c.banned_allow_use??true)&&s.eff_opts?.includes('allow_use');this.e.pushChangeData('card',cid);
     const cs=s.parent.type==='CS'?this.b.csMap[s.parent.id]:undefined;if(cs)(c.banned_cs??=[]).push(cs.cs_id);this.cardAction('action_card_banned',cid,{banned:true});});break;
   }
   case 'SKILL_EFF_TUTORIAL_BAN_CARD_USE':if(s.usable!==false)this.b.deck_info.all.forEach(cid=>this.checkTutorialBan(cid));break;
   case 'SKILL_EFF_TARGET_UNABLE':this.e.getUnit(owner).state='target_unable';this.action('action_monster_clocking',{source_id:owner});for(const type of ['CONDITION_MONSTER_AMOUNT','CONDITION_MONSTER_AMOUNT_SET'])this.call('procUnitEvent',type,[]);break;
   case 'SKILL_EFF_EGOSKILL_COST_CHANGE':this.refreshEp();break;
   case 'SKILL_EFF_CARD_COST_CHANGE_PASSIVE':this.b.deck_info.all.forEach(cid=>{const c=this.b.cardMap[cid],{changed,old_cost,new_cost}=this.call('updateCostResult',cid);if(changed){this.e.pushChangeData('card',cid);this.cardAction('action_card_cost',cid,{cost:new_cost},{skip_action:c.card_place!=2});if(new_cost<old_cost)this.call('procCardEvent','CONDITION_CARD_COST_DECREASE',c.card_place,cid,{skill_id:s.add_passive_info?.[2]});}});break;
   case 'SKILL_EFF_OVERLAY_VALUE_MAX_ADD':case 'SKILL_EFF_OVERLAY_VALUE_MIN_ADD':this.call('refreshMinMax',s.link_cs_ids);break;
   case 'SKILL_EFF_CHANGE_EGO':this.refreshEgo(this.targets(id));break;
   default:throw new MissingBattleRule('addPassiveSkill.effect',{id,eff});
  }
 }
 removePassiveEffect(id,owner,isCard,eff){const s=this.skill(id),r=this.row(s);
  if(eff!==r.eff)throw new MissingBattleRule('passive.effect_mismatch',{id,eff});
  if(isCard){if(eff==='SKILL_EFF_CHANGE_EGO')this.refreshEgo([owner],true);else if(eff==='SKILL_EFF_CARD_CHANGE_DEBUFF')this.call('recoverChangeDebuff',owner,id);else throw new MissingBattleRule('removePassiveSkillBySkillID.effect',{id,eff,isCard});return;}
  switch(eff){
   case 'SKILL_EFF_CARD_OVERWRITE':{const choices=this.db.array(r.target_card_set_opt_multiple_link);this.b.deck_info.all.forEach(cid=>{const c=this.b.cardMap[cid],base=c.before_change_debuff_card??c;if(base.before_overwrite_card&&choices.includes(base.before_overwrite_card.res_id))this.recoverOverwrite(cid);});break;}
   case 'SKILL_EFF_CHANGE_EGO':this.refreshEgo(this.targets(id));break;
   case 'SKILL_EFF_HAND_UNUSABLE_EXCEPT_1':this.b.deck_info.all.filter(cid=>this.b.deck_info.hand.includes(cid)&&this.b.cardMap[cid].char_id==s.action_char_id).forEach(cid=>{
    const c=this.b.cardMap[cid],i=c.debuffs?.findIndex(d=>d.debuff_res_id==s.eff_opt_multiple_link?.[0]);if(i==null||i<0)return;
    const [removed]=c.debuffs.splice(i,1),j=c.banned_debuff?.findIndex(d=>d[0]==removed.debuff_res_id);if(j!=null&&j>=0)c.banned_debuff.splice(j,1);
    this.action('action_card_debuff',{source_id:s.caster_id,action_card_debuff:{cards_debuffs:{[c.id]:c.debuffs},effect_type:1,skip:true}});
   });break;
   default:throw new MissingBattleRule('removePassiveSkillBySkillID.effect',{id,eff,isCard});
  }
 }
 // BattleCardProc 0x7aa00 / 0x68600. copyCardInfo0x700 is structuredClone.
 recoverCardChangePassive(id){const card=this.b.cardMap[id];if(!card?.before_card_change_passive_card)return id;
  const before=structuredClone(card.before_card_change_passive_card),info=structuredClone(before);info.id=this.b.last_unit_id++;
  const next=this.call('changeCards',[id],before.res_id,{cardInfo:info})[0];if(!next)return id;
  next.before_card_change_passive_card=undefined;next.card_change_passive_skill_id=undefined;this.call('afterChangeCard',before,next.id);return next.id;
 }
 recoverOverwrite(id){const card=this.b.cardMap[id];if(!card)return id;
  if(card.before_change_debuff_card){const original=card.before_change_debuff_card.before_overwrite_card;if(!original)return id;card.before_change_debuff_card=structuredClone(original);this.e.pushChangeData('card',card.id);return id;}
  if(!card.before_overwrite_card)return id;const before=structuredClone(card.before_overwrite_card),next=this.call('changeCards',[id],before.res_id)[0];if(!next)return id;this.call('afterChangeCard',before,next.id);return next.id;
 }
 // BattleCardProc 0x2e900 / 0x30700: model allowlist bans other owners;
 // explicit card links add to that set, preserving insertion order.
 getTutorialBanTargetCards(id){const r=this.row(this.skill(id)),models=this.db.array(r.target_unit_type_opt_multiple_link),links=this.db.array(r.target_card_set_opt_multiple_link),result=new Set();
  if(models.length){const allowed=new Set();for(let i=0;i<3;i++){const c=this.b.chars[i];if(c&&c.opacity!=0&&models.includes(String(this.call('getModel',c.res_id))))allowed.add(i+1);}this.b.deck_info.all.forEach(cid=>{if(!allowed.has(this.b.cardMap[cid].char_id))result.add(cid);});}
  if(links.length)this.b.deck_info.all.forEach(cid=>{if(links.includes(this.b.cardMap[cid].res_id))result.add(cid);});return [...result];
 }
 checkTutorialBan(id){const c=this.b.cardMap[id],old=c.banned_tsp;c.banned_tsp=undefined;
  const ps=this.query({source_id:c.caster_id,type:'SKILL_EFF_TUTORIAL_BAN_CARD_USE',is_card:false,char_id:c.char_id}).concat(this.query({source_id:c.id,type:'SKILL_EFF_TUTORIAL_BAN_CARD_USE',is_card:true}));
  for(const p of ps)if(this.getTutorialBanTargetCards(p.skill_id).includes(id)){c.banned_tsp=p.eff_opt_multiple_link?.[0];break;}
  if(old!=c.banned_tsp)this.e.pushChangeData('card',id);
 }
 // SkillEffectProc onUse/offUse callbacks: refresh before passive insertion or
 // removal, and emit only a real banned-state transition.
 cardUseBan(s,on){this.targets(s.skill_id).forEach(id=>{const c=this.b.cardMap[id],old=c.banned;
  if(on){c.banned=true;c.banned_allow_use=(c.banned_allow_use??true)&&s.eff_opts?.includes('allow_use');const cs=s.parent.type==='CS'?this.b.csMap[s.parent.id]:undefined;if(cs)(c.banned_cs??=[]).push(cs.cs_id);if(old)return;}
  else if(!old||this.call('checkBan',id))return;
  this.e.pushChangeData('card',id);this.cardAction('action_card_banned',id,{banned:!!on});
 });}
 tutorialCardUseBan(){this.b.deck_info.all.forEach(id=>this.checkTutorialBan(id));}
 // Worktable0x73000: table entries are literal resource IDs, not an array.
 isWaveTransitionBlockedSkill(id){const s=this.b.skillMap[id];if(!s)return false;
  if(this.w._waveTransitionBlockedSet==null){const set=new Set();for(const row of Object.values(this.db.table('battle_wave_mode_skill_eff_list')))if(row.link_skill_eff_id!=null)set.add(row.link_skill_eff_id);this.w._waveTransitionBlockedSet=set;}
  return this.w._waveTransitionBlockedSet.has(s.res_id);
 }
 applyChangeDebuff(...a){return this.cardSupport.applyChangeDebuff(...a);}
 recoverChangeDebuff(...a){return this.cardSupport.recoverChangeDebuff(...a);}
 // EventStackHelper CARD routes -> BattleCardProc0x63000/0x64000.
 cardAvailability(parent,stackId,on){const c=this.b.cardMap[parent.parent_id];
  if(parent.useType==='AVAILABLE'){
   if(on?!c.unusable:c.unusable)return;c.unusable=on?undefined:true;
   this.cardAction('action_card_usable',c.id,{usable:on},{source_id:c.caster_id});if(c.handOutline&&stackId in c.handOutline)c.handOutline[stackId]=on;this.e.pushChangeData('card',c.id);
  }else if(on&&parent.useType==='TRIGGER'&&c&&!c.unusable){this.call('pushLog','card triggered : '+c.res_id);this.w.passiveTriggered.push([stackId,c.id]);}
  // VALUECOUNT and native defaults have no side effect.
 }
 useCardParent(parent,stackId){this.cardAvailability(parent,stackId,true);}
 toggleCardParent(parent,stackId,on){this.cardAvailability(parent,stackId,on);}
 // BattleCardProc.onRemove0x66100 is exactly undefined; return.
 removeCardParent(){}
 // Worktable0xd9e00: restore may advance a Nihilum card after its saved stack
 // crosses a resource-defined threshold. Missing numbered constants end list.
 checkNihilumMetaStack(card){if(card.nihilum_stack==null)return;
  const rows=this.db.table('constant_meta'),ids=[],ranges=[];
  for(let i=1;;i++){const id=rows['nihilum_meta_card_id_'+i]?.value,range=rows['nihilum_meta_stack_'+i]?.value;if(id==null||range==null)break;ids.push(id);ranges.push(this.db.array(range).map(Number));}
  let res=card.res_id,at=ids.indexOf(res);while(at>=0&&card.nihilum_stack>ranges[at][1]&&at+1<ids.length)res=ids[++at];
  const stage=this.e.state.worktables.BattleStageWorktable.battle_stage,original=stage.all.find(c=>c.id==card.id),temporary=stage.battle_temp_cards?.includes(card.res_id);
  if(!original&&!temporary)throw new MissingBattleRule('stage_card_not_found',{res_id:card.res_id});if(original)original.nihilum_stack=card.nihilum_stack;
  if(card.res_id==res)return card.id;if(card.before_change_debuff_card)return card.id;
  if(original){original.res_id=res;this.action('action_stage_card_refresh',{action_stage_cards:this.call('createClientCards',stage.all)});}
  return this.call('changeCards',[card.id],res)[0]?.id??card.id;
 }
}
