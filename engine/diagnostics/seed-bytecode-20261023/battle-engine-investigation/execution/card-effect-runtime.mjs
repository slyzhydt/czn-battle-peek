// SkillEffectProc.procSkillEff0xdf800. Switch navigation and full nested static
// evidence are in evidence/batch3-cards/effect-groups.json/effect-closures/.
import fs from 'node:fs';
import {MissingBattleRule} from './resource-store.mjs';
import {TALENTS as T} from './card-talent-support.mjs';
const groups=JSON.parse(fs.readFileSync(new URL('./evidence/batch3-cards/effect-groups.json',import.meta.url),'utf8'));
export const CARD_EFFECT_NAMES=new Set(groups.aliases.map(x=>x.effect));
export const CARD_EFFECT_BINDINGS={};
export class CardEffectRuntime {
 constructor(e){this.e=e;this.b=e.b;this.w=e.wt;this.db=e.db;}
 call(n,...a){return this.e.call(n,...a);}
 action(type,fields){const a={id:this.b.last_action_id++,type,...fields};this.e.pushAction(a);return a;}
 log(type,params,param_types){this.call('addDetailLog',{type,params,param_types});}
 place(name){return this.call('cardPlace',name);}
 dispatch(id,context){let {targets,source_id,subPushed}=context,value;const options=context.options??{},s=this.b.skillMap[id],r=this.db.get('skill_eff',s.res_id),eff=r.eff,opts=s.eff_opts??[],links=s.eff_opt_multiple_link??[];
  const calc=()=>this.call('calcValue',id),count=()=>this.call('calcCountValue',id),selected=()=>{value=calc();if(value<0)value=targets.length;return targets.slice(0,value);},finish=()=>({targets,value,subPushed,source_id});
  switch(eff){
   case 'SKILL_EFF_DMG_COOP':{
    if(!options.skipInterrupt){(this.b.coopTrig??=[]).push({skill_id:id,target:targets,priority:r.eff_priority});break;}
    if(targets.length===1){this.b.select_target=targets[0];const unit=this.e.getUnit(targets[0]);if(['death','run','target_unable','changed','half_death','keep_half_death'].includes(unit.state)){
      if(opts.includes('require_target'))return {...finish(),returnEarly:true,value:undefined};const available=this.call('getTargetableMonstersID');if(!available.length||this.w.isPreview&&available.length!==1)return {...finish(),returnEarly:true,value:undefined};this.b.select_target=this.e.random.randomArrayMember(0,available);targets=[this.b.select_target];
     }}this.call('procDamageCalculate',{targets,skill_id:id,worktable:this.w,count_value_additional:context.count_value_additional,is_pre:false,ignoreCond:true,coop_char:options.coop_char_id,motion_triggered:options.motion_triggered});break;
   }
   case 'SKILL_EFF_NIHILUM_META_DMG':this.call('procDamageCalculate',{targets,skill_id:id,worktable:this.w,count_value_additional:context.count_value_additional,is_pre:false,ignoreCond:false,nihilum_meta:true,motion_triggered:options.motion_triggered,card_activation:options.byCard===true||options.card_activation===true});break;
   case 'SKILL_EFF_EGOSKILL_SLOT_REPLACE':if(this.b.ep_skill_deck.length>3){const head=this.b.ep_skill_deck.slice(0,3);this.call('shuffleInPlace',0,head);this.b.ep_skill_deck=this.b.ep_skill_deck.slice(3).concat(head);this.action('action_ep_skill_slots',{source_id:-1,action_ep_skill_slots:this.b.ep_skill_deck.slice()});}break;
   // Native cases37154/37158 jump directly to the common tail89767.
   case 'SKILL_EFF_TACTIC_COOLDOWN_ADD':case 'SKILL_EFF_TACTIC_COOLDOWN_ADD_RANDOM':break;
   case 'SKILL_EFF_CARD_USE':{
    targets=selected();if(this.w.isPreview&&!this.w.turnEndHpPreviewing)targets=[];const n=targets.length?count():1,allow=opts.includes('allow_use');
    const data=(cardId,procUse,ids,first)=>{const d={card_id:cardId,...(ids?{card_ids:ids}:{}),target:this.b.select_target,procUse,procCost:procUse&&(opts.includes('use_cost')??false),return_hand:procUse&&opts.includes('return_hand'),exhaust:procUse&&(opts.includes('exhaust')??false),usable:!procUse||allow||(ids?ids.every(i=>this.call('isCardAvailable',i,{by_skill_eff:true})):this.call('isCardAvailable',cardId,{by_skill_eff:true})),force_usable:!procUse||allow};if(ids)d.instant=true;else if(first)d.targetCardPlace=this.b.cardMap[cardId]?.card_place;return d;};
    if(opts.includes('instant_resolve')&&targets.length){const procUse=targets.every(i=>this.b.cardMap[i]?.card_place!==4);this.call('pushCardUse',data(targets[0],procUse,targets,true),id);for(let i=1;i<n;i++)this.call('pushCardUse',data(targets[0],procUse,targets,false),id);}
    else targets.forEach(cardId=>{const procUse=this.b.cardMap[cardId]?.card_place!==4;this.call('pushCardUse',data(cardId,procUse,undefined,true),id);for(let i=1;i<n;i++)this.call('pushCardUse',data(cardId,procUse,undefined,false),id);});
    if(r.value_save_renewal_flag==='YES')this.call('saveValue',s.parent.type.toLowerCase(),s.parent.id,targets.length);break;
   }
   case 'SKILL_EFF_CARD_DRAW':case 'SKILL_EFF_CARD_DRAW_WHILE_UNIQUE':{
    value=calc();const max=value<0||eff==='SKILL_EFF_CARD_DRAW_WHILE_UNIQUE'?this.call('getBattleHandMaxCount'):undefined,hand=value<0||eff==='SKILL_EFF_CARD_DRAW_WHILE_UNIQUE'?this.call('getHandCardCountForLimit'):undefined;
    if(value<0){if(hand+targets.length<max&&r.auto_shuffle_flag==='YES'){const discard=this.call('getTargetCards',id,false,true,false,3).target_cards_id;if(discard.some(i=>this.call('isShuffleTarget',i))){this.call('shuffleCard');targets=this.call('getTargetCards',id,false,true).target_cards_id.slice();}}value=targets.length;if(hand+value>max)value=max-hand;}
    if(eff==='SKILL_EFF_CARD_DRAW'){targets=this.call('moveCards',{skill_id:id,card_ids:targets.slice(0,value),from:1,to:2});break;}
    if(hand+value>max)value=max-hand;const drawn=[];let previous;for(let i=0;i<value;i++){if(this.call('getHandCardCountForLimit')>=max)break;const choices=this.call('getTargetCards',id,false,true).target_cards_id;if(choices.length===0)break;const moved=this.call('moveCards',{skill_id:id,card_ids:[choices[0]],from:1,to:2});if(moved.length===0)break;const card=this.b.cardMap[moved[0]];if(!card)break;if(previous!==undefined&&previous===card.res_id)break;drawn.push(moved[0]);previous=card.res_id;}targets=drawn;break;
   }
   case 'SKILL_EFF_CARD_DISCARD':case 'SKILL_EFF_CARD_EXHAUST':this.call('moveCards',{skill_id:id,card_ids:selected(),from:2,to:eff==='SKILL_EFF_CARD_DISCARD'?3:4});break;
   case 'SKILL_EFF_CARD_MOVE_TO':case 'SKILL_EFF_CARD_MOVE_TO_MONSTER_JUDGMENT':{
    value=calc();const to=this.place(r.eff_card_place);if(value<0){value=targets.length;if(to===2){const max=this.call('getBattleHandMaxCount'),hand=this.call('getHandCardCountForLimit');if(hand+value>max)value=max-hand;}}
    targets=this.call('moveCards',{skill_id:id,card_ids:targets.slice(0,value),from:this.place(r.target_card_set_list_card_place),to,monster_id:s.caster_id,move_to_monster_judgment:eff==='SKILL_EFF_CARD_MOVE_TO_MONSTER_JUDGMENT'});break;
   }
   case 'SKILL_EFF_CARD_REMOVE':targets=targets.filter(i=>this.removeFilter(i));targets=this.call('moveCards',{skill_id:id,card_ids:targets,from:this.place(r.target_card_set_list_card_place),to:0,remove_uninteractible:s.eff_opts?.includes('include_uninteractible')});targets.forEach(i=>this.removeAfter(i,source_id));break;
   case 'SKILL_EFF_ORLEA_CREATION_EVOLVE':{
    const maintain='cs01_0632';targets=targets.filter(i=>{const c=this.b.cardMap[i];return c.talents?.includes(T.TALENT_ORLEA_CREATION)&&!['3','6','9'].some(n=>c.res_id.endsWith(n));});
    const next=targets.map(i=>{const c=this.b.cardMap[i];return [c.res_id.slice(0,-1)+(Number(c.res_id.slice(-1))+1),c.continueSkill?.map(i=>this.b.csMap[i]).find(cs=>cs&&!cs.removed&&cs.res_id===maintain)?.term_value??0];});
    this.call('moveCards',{card_ids:targets,from:8,to:0,by_check_orlea_creation:true});targets.forEach(i=>this.call('removeCard',i));
    const cards=this.call('getCards',{source_id:s.action_char_id,card_res_ids:next.map(x=>x[0]),to:this.place(r.target_card_set_list_card_place),N:1,addStage:false,by_check_orlea_creation:true,ignoreCond:true});
    cards.forEach((c,i)=>{if(next[i][1]>0)this.call('procAddCS',c.id,maintain,next[i][1],c.id,true,'MATHSIGN_ADD',true,true,c.char_id,-1);});if(targets.length)this.call('checkOrleaCreation');break;
   }
   case 'SKILL_EFF_CARD_USE_AND_COPY':{
    const ids=selected();if(!ids.length)break;const reserveAction=this.action('action_card_reserve',{source_id:-1,target_id:ids,card_tos:ids.map(()=>11)});
    ids.forEach((card_id,index)=>this.call('pushCardUse',{card_id,target:this.b.select_target,procUse:true,procCost:opts.includes('use_cost')??false,exhaust:opts.includes('exhaust')??false,skip_exhibit:true,reserveInfo:{reserveAction,index}},id));
    this.call('pushCardUse',{card_id:-1,target:-1,procUse:false,procCost:false,copyInfo:{card_ids:ids,to:this.place(r.target_card_set_list_card_place),count:this.call('calcEffCardTargetCount',id)}},id);break;
   }
   case 'SKILL_EFF_CARD_CHANGE':{
    let candidates=opts.filter(x=>this.db.table('card')[x]!=null);if(candidates.length!==1&&this.w.isPreview)break;const pick=a=>a.length===1?a[0]:this.e.random.randomArrayMember(0,a);let replacements;
    if(opts.includes('random'))replacements=targets.map(i=>{let a=candidates;if(opts.includes('exclude_self')){const f=a.filter(x=>x!==this.b.cardMap[i]?.res_id);if(f.length)a=f;}return pick(a);});
    else {if(opts.includes('exclude_self')&&targets.length){const previous=new Set(targets.map(i=>this.b.cardMap[i]?.res_id).filter(x=>x!=null)),a=candidates.filter(x=>!previous.has(x));if(a.length)candidates=a;}replacements=pick(candidates);}
    const changedCardIds=[],cards=this.call('changeCards',targets,replacements,{ignoreMoveToTrigger:opts.includes('ignore_move_to_trigger'),changedCardIds}),logs={};
    cards.forEach((c,i)=>{const original=changedCardIds[i];if(original===undefined)return;const entry=logs[c.res_id]??={original_ids:[],rep_new_card_id:c.id};entry.original_ids.push(original);});
    for(const key in logs){const x=logs[key];this.log('log_skill_eff_card_change',[x.original_ids,x.rep_new_card_id],['card_ids','card_id']);}break;
   }
   case 'SKILL_EFF_UNIQUE_TIPERA_2':{
    const candidates=opts.filter(x=>this.db.table('card')[x]!=null);if(candidates.length!==1&&this.w.isPreview)break;const changedCardIds=[],cards=this.call('changeCards',targets,candidates.length===1?candidates[0]:this.e.random.randomArrayMember(0,candidates),{keepCS:true,keepGodSpark:true,changedCardIds});
    if(cards.length)this.log('log_skill_eff_card_change',[changedCardIds,cards[0].id],['card_ids','card_id']);break;
   }
   case 'SKILL_EFF_UNIQUE_TIPERA_4':{
    if(this.w.isPreview)break;const copied=this.call('copyCards',targets,2,1,id,{copyTiperaDisabled:true});copied?.forEach(i=>{const c=this.b.cardMap[i];if(!c)return;const skills=c.skill_eff_ids.filter(i=>!this.b.skillMap[i]?.tipera_disabled);if(skills.length)this.b.skillMap[this.e.random.randomArrayMember(0,skills)].tipera_disabled=true;});break;
   }
   case 'SKILL_EFF_CARD_GET':case 'SKILL_EFF_CARD_GET_IGNORE_COND':case 'SKILL_EFF_CARD_GET_OVERFLOW_TO_DECK_TOP':case 'SKILL_EFF_CARD_GET_WITH_COST':{
    if(s.parent?.type==='CS'){const cs=this.b.csMap[s.parent.id];if(cs)source_id=cs.char_id;}value=calc();let list=this.db.array(r.target_card_set_opt_multiple_link);const result=[],addStage=opts.includes('stage_deck'),costMode=eff==='SKILL_EFF_CARD_GET_WITH_COST',get=(resources,owners)=>{
      const cards=this.call('getCards',{source_id:s.action_char_id,card_res_ids:resources,card_owner_ids:owners,to:this.place(r.eff_card_place),N:costMode?1:value,addStage,skill_id:id,bySpark:undefined,ignoreCond:eff==='SKILL_EFF_CARD_GET_IGNORE_COND',eff_opt:opts,cost_value:costMode?value:undefined});result.push(...cards.map(c=>c.id));};
    if(list.length){if(r.target_card_set==='CARD_SET_DESIGNED'){
      const pool=[],random=opts.includes('random');let n=this.call('calcEffCardTargetCount',id);if(n<0)n=list.length;if(random){n*=value;value=1;}
      for(let i=0;i<n;i++){const ratios=opts.filter(x=>!isNaN(Number(x))).map(Number);if(ratios.length===list.length)pool.push(list[this.call('cardRelativeProbabilityIndex',ratios)]);else if(list.length===1)pool.push(...list);else if(random){this.e.trace.push({kind:'content_error',source:'CARD_GET',message:'invalid ratio'});for(let j=0;j<list.length-ratios.length;j++)ratios.push(1);pool.push(list[this.call('cardRelativeProbabilityIndex',ratios)]);}else pool.push(...list);}get(pool);
     }else if(r.target_card_set==='CARD_SET_REWARD_ID'){
      const ratios=opts.filter(x=>!isNaN(Number(x))).map(Number);if(ratios.length===list.length)list=[list[this.call('cardRelativeProbabilityIndex',ratios)]];const pool=[];
      for(const res of list)for(const entry of this.call('cardFilterProc',{uctx:this.w.uctx,filter_res_id:res,battle_stage_worktable:this.e.state.worktables.BattleStageWorktable,battle_worktable:this.w,from_fate:!!s.from_ego})){
       if(typeof entry==='number'){const c=this.call('getStageCard',entry);if(c)pool.push({res_id:c.res_id,source_char_id:c.char_id>0?c.char_id:0});}else pool.push({res_id:entry,source_char_id:0});
      }this.call('shuffleInPlace',0,pool);let n=r.eff_card_target_count;if(n==-1)n=pool.length;const subset=pool.slice(0,n);get(subset.map(c=>c.res_id),subset.map(c=>c.source_char_id));
     }else this.contentError('invalid target_card_set:'+r.target_card_set);
    }targets=result;break;
   }
   case 'SKILL_EFF_CARD_GET_USER':{
    value=calc();const resources=this.db.array(r.target_card_set_opt_multiple_link),created=[];if(resources.length){const stage=this.e.state.worktables.BattleStageWorktable.battle_stage;for(const c of this.call('getAllChars').filter(c=>c.id>0&&c.res_id>=0&&c.opacity!=0&&!(stage.leaved_chars??[]).includes(c.res_id)&&!this.call('tryGetStageCharByCharId',c.id)?.collapse_on))created.push(...this.call('getCards',{source_id:c.id,card_res_ids:resources,to:this.place(r.eff_card_place),N:value,addStage:false,skill_id:id,bySpark:undefined,ignoreCond:false,eff_opt:opts}).map(c=>c.id));}targets=created;break;
   }
   case 'SKILL_EFF_CARD_DEBUFF_ADD':case 'SKILL_EFF_CARD_DEBUFF_ADD_SHOW_SKIP':{
    const pct=Number(opts.find(x=>x.startsWith('pct_'))?.slice(4)??100),res=links[0],changes={},skip=eff==='SKILL_EFF_CARD_DEBUFF_ADD_SHOW_SKIP';
    targets.forEach(cardId=>{const c=this.b.cardMap[cardId];if(pct<100){if(this.w.isPreview)return;if(pct<=this.e.random.randRange(0,0,100))return;}
     if(s.triggerLog&&!subPushed){this.call('pushSubBattleLog',s.triggerLog);subPushed=true;}if(!c)this.contentError('card not found:'+cardId);
     const blockers=this.call('getPassiveByType',{source_id:this.b.char.id,type:'SKILL_EFF_BLOCK_CARD_DEBUFF',is_card:false,char_id:c.char_id});if(blockers.length){const ego=this.b.egoActionMap[blockers[0].skill_id];if(ego){this.action('action_ego_active',{source_id:ego.char_id,ego_skill_res_id:ego.ego_skill_res_id});if(this.w.isPreview)this.w.triggeredList.ego.push([ego.ego_skill_res_id,ego.char_id]);}this.log('log_skill_eff_block_card_debuff',[links[0]],['debuff_res_id']);this.call('checkTermValuePassive',blockers[0].skill_id,source_id);return;}
     if(c.debuffs?.some(d=>d.debuff_res_id==res))return;(c.debuffs??=[]).push({debuff_res_id:res,debuff_caster:source_id,debuff_show_skip:skip});this.call('pushChangeData','card',c.id);
     this.call('procAddCS',cardId,this.db.get('card_debuff',res).cs_link_cs_id,1,source_id,true,'MATHSIGN_ADD',false,false,s.action_char_id,s.skill_id,{isAuto:false,fromDebuff:res});changes[c.id]=c.debuffs.slice();
    });const keys=Object.keys(changes);if(keys.length)this.log('log_skill_eff_card_debuff_add',[this.place(r.target_card_set_list_card_place),keys,res,'log_gain'],['card_from_wo_hand','card_ids','debuff_res_id','text']);this.action('action_card_debuff',{action_card_debuff:{cards_debuffs:changes,effect_type:-1,skip},source_id:s.caster_id});break;
   }
   case 'SKILL_EFF_CARD_DEBUFF_REMOVE':{
    const changes={};for(const cardId of targets){const c=this.b.cardMap[cardId];if(c.debuffs==null)continue;let removed=false;const all=links.length===0;
     c.debuffs.forEach(d=>{if(!all&&!links.includes(d.debuff_res_id))return;const at=c.continueSkill?.findIndex(i=>this.b.csMap[i].from_debuff==d.debuff_res_id);if(at!=null&&at>=0){removed=true;this.call('removeContinueSkill',c.continueSkill[at],cardId,true,{actionDebuff:false,event:true});}});
     if(all){c.debuffs=undefined;changes[c.id]=undefined;}else if(removed){c.debuffs=c.debuffs.filter(d=>!links.includes(d.debuff_res_id));changes[c.id]=c.debuffs.slice();}this.call('pushChangeData','card',c.id);
    }const skip=Object.keys(changes).reduce((v,key)=>v&&(changes[key]?.reduce((v,d)=>v&&d.debuff_show_skip,true)??true),true);this.action('action_card_debuff',{action_card_debuff:{cards_debuffs:changes,effect_type:1,skip},source_id:s.caster_id});break;
   }
   case 'SKILL_EFF_MIX_DECK':this.call('shuffleInPlace',0,this.b.deck_info.deck);break;
   case 'SKILL_EFF_CARD_SHUFFLE':this.call('shuffleCard');if(s.eff_opts?.includes('random'))this.call('shuffleInPlace',0,this.b.deck_info.deck);break;
   case 'SKILL_EFF_CARD_COPY_TO_IGNORE_COND':case 'SKILL_EFF_CARD_COPY_TO':case 'SKILL_EFF_CARD_COPY_TO_EXCEPT_CS':case 'SKILL_EFF_CARD_COPY_TO_ORIGIN':case 'SKILL_EFF_CARD_COPY_TO_IGNORE_COND_ORIGIN':case 'SKILL_EFF_CARD_COPY_TO_EXCEPT_CS_ORIGIN':{
    value=calc();let n=this.call('calcEffCardTargetCount',id);if(n<0)n=targets.length;const copied=this.call('copyCards',targets.slice(0,n),this.place(r.eff_card_place),value,id,{ignoreCond:['SKILL_EFF_CARD_COPY_TO_IGNORE_COND','SKILL_EFF_CARD_COPY_TO_IGNORE_COND_ORIGIN'].includes(eff),exceptCS:['SKILL_EFF_CARD_COPY_TO_EXCEPT_CS','SKILL_EFF_CARD_COPY_TO_EXCEPT_CS_ORIGIN'].includes(eff),opts:s.eff_opts,bindStack:this.call('isTriggeredCardCopyIgnoreCond',r)?s.bind_stack_triggered:undefined});if(copied)targets=copied;break;
   }
   case 'SKILL_EFF_CARD_TALENT_ADD':case 'SKILL_EFF_CARD_TALENT_REMOVE':case 'SKILL_EFF_CARD_TALENT_REPLACE':{
    const ids=selected(),visible=ts=>ts.filter(t=>T[t.toUpperCase()]!==T.TALENT_RHYTHM);
    if(eff==='SKILL_EFF_CARD_TALENT_ADD'){for(const cardId of ids){const c=this.b.cardMap[cardId],added=opts.filter(t=>T[t.toUpperCase()]==null||!c.talents?.includes(T[t.toUpperCase()]));if(!added.length)continue;const logs=visible(added);if(logs.length)this.log('log_skill_eff_card_talent_add',[[cardId],logs],['card_ids','text']);this.call('addTalents',cardId,added);}}
    else{const log=visible(opts);if(ids.length&&log.length)this.log(eff==='SKILL_EFF_CARD_TALENT_REMOVE'?'log_skill_eff_card_talent_remove':'log_skill_eff_card_talent_replace',[ids,log],['card_ids',eff==='SKILL_EFF_CARD_TALENT_REMOVE'?'text':'talent']);for(const cardId of ids)this.call(eff==='SKILL_EFF_CARD_TALENT_REMOVE'?'removeTalents':'replaceTalents',cardId,opts);}break;
   }
   case 'SKILL_EFF_CARD_TALENT_UNIQUE_OLGA_STACK_SET_ADD':{const own=this.call('getParentCard',id)?.id;this.call('procOlgaStackSetAdd',id,targets.length?targets:own==null?[]:[own]);break;}
   case 'SKILL_EFF_TRIGGER_RETAINED':case 'SKILL_EFF_TRIGGER_INSPIRATION':case 'SKILL_EFF_TRIGGER_ATTUNMENT':{
    const n=count(),opt=({SKILL_EFF_TRIGGER_RETAINED:'trigger_retained',SKILL_EFF_TRIGGER_INSPIRATION:'trigger_inspiration',SKILL_EFF_TRIGGER_ATTUNMENT:'trigger_attunment'})[eff];for(let i=0;i<n;i++)for(const cardId of targets)this.triggerCardOption(cardId,opt);break;
   }
   case 'SKILL_EFF_TRIGGER_PYEONRIN':this.call('triggerPyeonrin',targets,count());break;
   // Every CARD_EFFECT_NAMES member has an explicit case above. The public
   // dispatcher enters here only for that set; direct foreign kinds are invalid.
   default:throw new MissingBattleRule('CardEffectRuntime.invalid_effect_kind',{eff,skill_id:id});
  }return finish();
 }
 triggerCardOption(id,opt){const c=this.b.cardMap[id];if(!c)return;if(opt==='trigger_retained')c.trigger_retained_cnt=(c.trigger_retained_cnt??0)+1;let applied=false;const visit=skillId=>{if(this.b.skillMap[skillId].eff_opts?.includes(opt)){this.call('addSkillTriggered',skillId);applied=true;}};
  this.call('getAllCardSkillEffIds',c).forEach(visit);c.continueSkill?.forEach(id=>{const cs=this.b.csMap[id];if(cs)cs.skillEffs.forEach(visit);});if(opt==='trigger_inspiration'&&applied)c.by_turn_draw=undefined;
 }
 contentError(message){throw this.call('contentError',message);}
 removeFilter(id){const c=this.b.cardMap[id];return !this.call('isRestricted',c,'RESTRICT_REMOVE')&&!c.talents?.includes(T.TALENT_IRREMOVABLE);}
 removeAfter(id,source_id){const c=this.b.cardMap[id];this.action('action_card_remove',{card_id:id,source_id});const cardInfo={available:c.available!==false,char_id:c.char_id,id:c.id,res_id:c.res_id,r_spark:c.r_spark};this.b.removed_cards.push(c.id);this.b.stage_actions.push({type:'remove',id:c.id,cardInfo});}
}

