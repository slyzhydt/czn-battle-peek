// EventSystem.registCardEvent 0x45600, source/evidence map in
// evidence/card-event-registration/HANDPORT-SCOPE.md. Never executes game JS.
import fs from 'node:fs';
import {MissingBattleRule} from './resource-store.mjs';
import {readCardPlaces} from './event-runtime.mjs';
import {compareCondition} from '../conditions/condition-core.mjs';
const TALENT=JSON.parse(fs.readFileSync(new URL('../../card-pool-investigation/talent-enum.json',import.meta.url)));
export class CardEventRegistrationRuntime {
 constructor(e){this.e=e;this.b=e.b;this.w=e.wt;this.db=e.db;this.P=readCardPlaces();}
 call(n,...a){return this.e.call(n,...a);}
 registCardEvent(maps,stackId,trigger,row,cardId,charId,override){
  const b=this.b,arr=k=>this.db.array(row[k]??'[]'),opts=arr('condition_card_opt'),dup=opts.indexOf('no_duplicate');
  if(dup>=0)opts.splice(dup,1); // only first occurrence, distinct from field flag
  const n=k=>override?.column===k?override.value:this.db.number(row,k);
  const event={id:b.cond_id++,stack_id:stackId,res_id:row.id,condition_type:this.e.enums.EVENT_CONDITION_TYPE.CARD,trigger,value:n('condition_card_value'),stack_input:n('condition_card_stack_input'),min_cost:n('condition_card_min_cost'),max_cost:n('condition_card_max_cost'),card_id:cardId,char_id:charId};
  if(opts.length)event.card_opt=opts;
  for(const [field,key]of [['card_type','condition_card_card_type'],['card_target_opt','condition_card_target_opt'],['card_sort','condition_card_sort'],['card_amount_opt','condition_card_amount_opt'],['link_card_id','condition_card_opt_link_card_id'],['exclude_link_card_id','condition_exclude_card_opt_link_card_id'],['cs_check_opt','condition_card_check_opt_multiple_link']]){const values=arr(key);if(values.length)event[field]=values;}
  const talents=arr('condition_card_talent'),withoutNot=talents.filter(t=>t!=='not');
  // Native callback70 0x47800 directly indexes TALENT, including missing keys.
  // Preserve undefined for the later includes/every comparison; do not alias it.
  if(withoutNot.length){event.card_talent=withoutNot.map(t=>TALENT[t]);if(withoutNot.length!==talents.length)event.card_talent_not=true;}
  const egos=arr('condition_card_ego_type');if(egos.length)event.card_ego_type=egos.map(x=>this.call('convertEgoCommon',x));
  const css=arr('condition_card_opt_link_cs_id');if(css.length){const stage=(this.w.battle_stage_worktable??this.e.state?.worktables?.BattleStageWorktable)?.battle_stage;if(!stage)throw new MissingBattleRule('registCardEvent.battle_stage');event.link_cs_id=css.map(x=>stage.break_cs_changes?.[x]??x);}
  const slots=arr('condition_card_char_slot').map(Number);if(slots.length)event.card_char_slot=slots;
  if(row.card_opt_negate_flag==='YES')event.card_opt_negate_flag=true;
  if(row.condition_card_no_duplicate==='YES')event.no_duplicate=true;
  b.condMap[event.id]=event;
  if(dup>=0){event.duplicate_checks=[];(b.stackMap[stackId].resetDupConds??=[]).push(event.id);}
  // Native deliberately looks up the char argument in cardMap before folding
  // auxiliary character slots 4/5/6 back to 1/2/3.
  if(b.cardMap[charId])event.char_id=b.cardMap[charId].char_id;
  if([4,5,6].includes(event.char_id))event.char_id-=3;
  const key1=row.condition_card,key2=this.P[row.condition_card_card_place];
  if(key2==null)throw new MissingBattleRule('registCardEvent.invalid_card_place',{id:row.id,place:row.condition_card_card_place});
  (((maps.cardEventMap[key1]??={})[key2])??=[]).push(event.id);
  const card=b.cardMap[cardId];
  if(card&&opts.includes('card_with_this_cs')&&this.db.get('card',card.res_id).ui_interrupt_outline==='YES'){
   card.interruptKeywords??=[];let effects=[];
   if(['CONDITION_CARD_DRAW_EXCEPT_TURN_DRAW','CONDITION_CARD_DRAW','CONDITION_CARD_MOVE_TO_HAND_BY_EFF'].includes(key1))effects=['SKILL_EFF_CARD_DRAW','SKILL_EFF_CARD_DRAW_WHILE_UNIQUE'];
   else if(key1==='CONDITION_CARD_DISCARD')effects=['SKILL_EFF_CARD_DISCARD'];
   else if(key1==='CONDITION_CARD_EXHAUST')effects=['SKILL_EFF_CARD_EXHAUST'];
   else if(['CONDITION_CARD_MOVE_FROM_HAND','CONDITION_CARD_MOVE_TO_BY_EFF','CONDITION_CARD_MOVE_TO_NOT_FROM_USED','CONDITION_CARD_MOVE_TO'].includes(key1))effects=({[this.P.CARD_PLACE_HAND]:['SKILL_EFF_CARD_DRAW','SKILL_EFF_CARD_DRAW_WHILE_UNIQUE'],[this.P.CARD_PLACE_DISCARD]:['SKILL_EFF_CARD_DISCARD'],[this.P.CARD_PLACE_EXHAUST]:['SKILL_EFF_CARD_EXHAUST']})[Number(key2)]??[];
   card.interruptKeywords.push(...effects);
  }
  let triggered=false,value_triggered;
  if(['CONDITION_CARD_AMOUNT','CONDITION_CARD_AMOUNT_SET','CONDITION_CARD_AMOUNT_COMPARE'].includes(key1)){
   if(event.link_cs_id?.length){b.amount_check_ccs??={};for(const id of event.link_cs_id)(b.amount_check_ccs[id]??=[]).push(event.res_id);}
   if(event.card_amount_opt?.includes('turn_over_previous'))(b.amount_check_player_turn??=[]).push(event.res_id);
  }
  // Registration-time probes are separate from ordinary event dispatch.
  if(!opts.includes('except_regist')){
   const compare=(left,right)=>compareCondition(row.condition_card_value_ineq,left,right);
   const previousUsing=()=>event.card_amount_opt?.includes('using_previous')&&b.deck_info.using.length>0?b.deck_info.using:undefined;
   if(key1==='CONDITION_CARD_AMOUNT'){
    const amount=this.call('countCard',key2,event,undefined,previousUsing()),zeroMatches=compare(0,event.value);
    triggered=amount!=null?compare(amount,event.value):false;if(opts.includes('from_false'))triggered=!zeroMatches&&triggered;
    value_triggered=amount;event.prev=amount;(b.stackMap[stackId].resetConds??=[]).push(event.id);
   }else if(key1==='CONDITION_CARD_AMOUNT_SET'){
    const amount=this.call('countCard',key2,event,undefined,previousUsing());if(amount!=null){triggered=true;event.set=true;event.set_value=amount*event.stack_input;}
   }else if(key1==='CONDITION_CARD_AMOUNT_COMPARE'){
    const left=this.call('countCard',this.P[event.card_opt?.[0]],event,[]),right=this.call('countCard',this.P[event.card_opt?.[1]],event,[]);triggered=left!=null&&right!=null?compare(left,right):false;
   }else if(['CONDITION_CARD_CS_TERM_VALUE_SET','CONDITION_CARD_CS_AMOUNT'].includes(key1)){
    if(!card)throw new MissingBattleRule('registCardEvent.card_for_cs_probe',{cardId});
    const sum=card.continueSkill?.reduce((v,id)=>{const cs=b.csMap[id];return cs&&event.link_cs_id?.includes(cs.res_id)?v+(cs.effective_term_value??cs.term_value):v;},0);
    if(key1==='CONDITION_CARD_CS_TERM_VALUE_SET'){triggered=true;event.set=true;event.set_value=(sum??0)*event.stack_input;}
    else{triggered=compare(sum??0,event.value);event.prev=sum;}
   }else if(key1==='CONDITION_CARD_BEFORE_EGO_TYPE'){
    if(b.before_used_ego&&b.before_used_ego!=='NONE'){
     if(opts.includes('combo')){if(!card)throw new MissingBattleRule('registCardEvent.card_for_ego_probe',{cardId});triggered=this.call('getEgo',card.id)!=b.before_used_ego;}
     else if(opts.includes('sequential')){if(!card)throw new MissingBattleRule('registCardEvent.card_for_ego_probe',{cardId});const ego=this.call('getEgo',card.id),previous=this.call('convertEgoCommon',b.before_used_ego);triggered=ego==='EGO_ALL'||previous==='EGO_ALL'||ego==previous;}
     else{const previous=this.call('convertEgoCommon',b.before_used_ego);triggered=previous==='EGO_ALL'||event.card_ego_type?.includes(previous)===true;}
    }
   }else if(key1==='CONDITION_CARD_USE_BEFORE_CHAR'){
    if(b.before_used_card!==-1)event.prev=b.cardMap[b.before_used_card]?.char_id;
   }else if(key1==='CONDITION_CARD_COST_EQ_AP'){
    if(card){triggered=card.cost_result===b.energy;event.prev_triggered=triggered;}
   }else if(key1==='CONDITION_THIS_CARD_COST_COMPARE'){
    if(card){
     // 0x45600 @5451..5519 reads cost_result before createBattleCard's
     // final assignment. The constructor owns this known-undefined field;
     // native compare receives undefined and the numeric event.value.
     // Do not turn an incomplete capture (property absent) into that case.
     const sign=row.condition_card_value_ineq;
     if(Object.hasOwn(card,'cost_result')&&card.cost_result===undefined&&['INEQUALITY_NONE','INEQUALITY_EQ','INEQUALITY_NE','INEQUALITY_LT','INEQUALITY_LE','INEQUALITY_GT','INEQUALITY_GE'].includes(sign))triggered=sign==='INEQUALITY_NONE'||sign==='INEQUALITY_NE';
     else if(Object.hasOwn(card,'cost_result')&&card.cost_result===undefined&&typeof sign==='string'&&sign.includes('RANGE'))triggered=false;
     else triggered=compare(card.cost_result,event.value);
     event.prev_triggered=triggered;
    }
   }
  }
  return {key1,key2,triggered,event,value_triggered};
 }
}
