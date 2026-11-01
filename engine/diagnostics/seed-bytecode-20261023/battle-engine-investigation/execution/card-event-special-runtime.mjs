// EventSystem.procCardEvent 0x72600, callbacks 122,125..145. Static hand port;
// each dedicated branch keeps its own native filters and notification shape.
import {compareCondition} from '../conditions/condition-core.mjs';
export const CARD_SPECIAL_EVENTS=new Set(['CONDITION_CARD_AMOUNT_COMPARE','CONDITION_CARD_CS_TERM_VALUE_SET','CONDITION_CARD_CS_AMOUNT','CONDITION_CARD_TALENT_BIND_STACK_AMOUNT','CONDITION_CARD_TALENT_UNIQUE_OLGA_STACK_AMOUNT','CONDITION_CARD_TALENT_BIND_STACK_AMOUNT_SET','CONDITION_CARD_TAKE_CS','CONDITION_CARD_COST_EQ_AP','CONDITION_THIS_CARD_COST_COMPARE','CONDITION_USE_ENERGY_AMOUNT_SET','CONDITION_CARD_BEFORE_EGO_TYPE','CONDITION_CARD_USE_BEFORE_CHAR','CONDITION_CARD_SHUFFLE','CONDITION_MONSTER_ACTION_CARD_USE','CONDITION_MONSTER_CARD_USE','CONDITION_CARD_HAND_ORDER','CONDITION_CARD_OPT_TRIGGERED']);
export class CardEventSpecialRuntime {
 constructor(events){this.events=events;this.e=events.e;this.b=events.b;this.w=events.w;}
 call(n,...a){return this.e.call(n,...a);}
 on(ev,...a){return this.e.stacks.onEvent(ev,...a);}
 off(ev){return this.e.stacks.offEvent(ev);}
 compare(ev,value){return compareCondition(this.e.db.get('cond_card',ev.res_id).condition_card_value_ineq,value,ev.value);}
 edge(ev,previous,value,delta){const before=this.compare(ev,previous),now=this.compare(ev,value),edge=ev.card_opt?.includes('from_false');
  if(now){if(!edge||!before){if(delta)this.on(ev,undefined,value-previous);else this.on(ev);}}else if(!edge||before)this.off(ev);
 }
 linkedSum(c,ev){return c.continueSkill?.reduce((sum,id)=>{const cs=this.b.csMap[id];return cs&&ev.link_cs_id?.includes(cs.res_id)?sum+(cs.effective_term_value??cs.term_value):sum;},0);}
 costCompare(c,ev){const sign=this.e.db.get('cond_card',ev.res_id).condition_card_value_ineq;
  // createBattleCard creates an own undefined before assigning final cost.
  // Absence still goes through the strict incomplete-input rejection.
  if(Object.hasOwn(c,'cost_result')&&c.cost_result===undefined){if(['INEQUALITY_NONE','INEQUALITY_EQ','INEQUALITY_NE','INEQUALITY_LT','INEQUALITY_LE','INEQUALITY_GT','INEQUALITY_GE'].includes(sign))return sign==='INEQUALITY_NONE'||sign==='INEQUALITY_NE';if(typeof sign==='string'&&sign.includes('RANGE'))return false;}
  return this.compare(ev,c.cost_result);
 }
 dispatch(type,place,id,args){const map=this.b.eventMaps.cardEventMap[type];if(!map)return;const c=this.b.cardMap[id],refresh=[];
  const each=cid=>{const ev=this.b.condMap[cid];if(ev.inactive)return;
   switch(type){
    case 'CONDITION_CARD_AMOUNT_COMPARE':{const a=this.events.countCard(this.events.P[ev.card_opt?.[0]],ev,[]),b=this.events.countCard(this.events.P[ev.card_opt?.[1]],ev,[]);if(a!=null&&b!=null){if(compareCondition(this.e.db.get('cond_card',ev.res_id).condition_card_value_ineq,a,b))this.on(ev);else this.off(ev);}return;}
    case 'CONDITION_CARD_CS_TERM_VALUE_SET':case 'CONDITION_CARD_CS_AMOUNT':{
     if(ev.card_id!=id||args?.cs_res_id==null||!ev.link_cs_id?.includes(args.cs_res_id))return;
     const sum=this.linkedSum(c,ev);if(type==='CONDITION_CARD_CS_TERM_VALUE_SET'){if(sum!==undefined){ev.set_value=sum*ev.stack_input;ev.set=true;this.on(ev);}}
     else{const previous=ev.prev??0;ev.prev=sum;this.edge(ev,previous,sum??0,false);}return;
    }
    case 'CONDITION_CARD_TALENT_BIND_STACK_AMOUNT':case 'CONDITION_CARD_TALENT_UNIQUE_OLGA_STACK_AMOUNT':{
     const olga=type==='CONDITION_CARD_TALENT_UNIQUE_OLGA_STACK_AMOUNT';if(olga&&ev.card_id!=id||!c||!(olga?c.talents?.some(t=>[52,55,56].includes(t)):c.talents?.includes(37)))return;
     if(!this.events.checkCard(ev,id,this.w.isPreview!=0&&c.known==false,args?.skill_id))return;
     const value=olga?(c.olga_count??0):(c.bind_count??-1)+1,previous=ev.prev??0;ev.prev=value;this.edge(ev,previous,value,true);return;
    }
    case 'CONDITION_CARD_TALENT_BIND_STACK_AMOUNT_SET':if(ev.card_id!=id||!c?.talents?.includes(37))return;ev.set_value=((c.bind_count??-1)+1)*ev.stack_input;ev.set=true;this.on(ev);return;
    case 'CONDITION_CARD_TAKE_CS':if(ev.card_id==id&&args?.cs_res_id!=null&&ev.link_cs_id?.includes(args.cs_res_id))this.on(ev);return;
    case 'CONDITION_CARD_COST_EQ_AP':case 'CONDITION_THIS_CARD_COST_COMPARE':{
     const equal=type==='CONDITION_CARD_COST_EQ_AP';if(equal?(id>=0&&ev.card_id!=id):ev.card_id!=id)return;
     const card=this.b.cardMap[ev.card_id];if(!card)return;const previous=ev.prev_triggered??false,value=equal?card.cost_result===this.b.energy:this.costCompare(card,ev);
     if(!previous&&value)this.on(ev);else if(previous&&!value)this.off(ev);ev.prev_triggered=value;return;
    }
    case 'CONDITION_USE_ENERGY_AMOUNT_SET':if(args?.energy==null)throw new Error('err:energy_undefined_at_CONDITION_USE_ENERGY_AMOUNT_SET');ev.set_value=args.energy;ev.set=true;this.on(ev);return;
    case 'CONDITION_CARD_BEFORE_EGO_TYPE':this.beforeEgo(ev,id,c,args,refresh);return;
    case 'CONDITION_CARD_USE_BEFORE_CHAR':{const value=ev.prev!=null&&ev.prev!=-1&&ev.prev==c?.char_id;ev.prev=c?.char_id;if(value)this.on(ev);else this.off(ev);return;}
    case 'CONDITION_CARD_SHUFFLE':this.on(ev);return;
    case 'CONDITION_MONSTER_ACTION_CARD_USE':case 'CONDITION_MONSTER_CARD_USE':if(this.events.checkCard(ev,id,this.w.isPreview!=0&&c.known==false,args?.skill_id))this.on(ev);return;
    case 'CONDITION_CARD_HAND_ORDER':{
     if(ev.card_id!=c.id)return;const hand=this.b.deck_info.hand,index=hand.findIndex(x=>x==c.id);if(index<0){this.off(ev);return;}
     let match;const opts=ev.card_opt;if(opts?.includes('left'))match=this.compare(ev,index+1);else if(opts?.includes('right'))match=this.compare(ev,hand.length-index);else if(opts?.includes('mid'))match=(hand.length-1)/2==index;else if(opts?.includes('not_mid'))match=(hand.length-1)/2!=index;else return;
     if(match)this.on(ev);else this.off(ev);return;
    }
    case 'CONDITION_CARD_OPT_TRIGGERED':{
     if(args?.skill_id==null)return;const s=this.b.skillMap[args.skill_id];if(!s?.eff_opts||!ev.card_opt||!ev.card_opt.some(o=>s.eff_opts.includes(o))||c==null)return;
     if(!this.events.checkCard(ev,id,this.w.isPreview!=0&&c.known==false,args.skill_id))return;
     this.call('setCardTriggered',ev.stack_id,id);this.on(ev);return;
    }
   }
  };
  // OPT_TRIGGERED visits the requested place first, then NONE. Other dedicated
  // branches use exactly their registered place, never the generic fallback.
  const places=type==='CONDITION_CARD_OPT_TRIGGERED'&&place!==0?[place,0]:[place];for(const p of places)map[p]?.forEach(each);
  for(const cardId of refresh)this.call('checkCardAvailable',cardId);
 }
 beforeEgo(ev,id,card,args,refresh){const sequential=ev.card_opt?.includes('sequential')??false,except=args?.except;
  if(!sequential&&ev.card_id==id||except&&ev.card_id<0||ev.card_id>0&&id>0&&!except)return;
  const own=this.b.cardMap[ev.card_id],previous=except&&card&&ev.card_id!=id?card.curEgo:this.b.before_used_ego;let value=false;
  if(previous&&previous!=='NONE'){
   if(ev.card_opt?.includes('combo')||sequential){if(!own)throw new Error('err:invalid_this_card_ego_at_CONDITION_CARD_BEFORE_EGO_TYPE:'+ev.res_id+':'+this.b.stackMap[ev.stack_id]?.res_id);
    const ego=this.call('getEgo',own.id),prior=this.call('convertEgoCommon',previous);value=ego==='EGO_ALL'||prior==='EGO_ALL'||(ev.card_opt?.includes('combo')?ego!=prior:ego==prior);
   }else value=ev.card_ego_type?.includes(previous)===true;
  }
  if(!args?.outline_only){if(value)this.on(ev);else this.off(ev);}
  if(sequential&&ev.card_id>0&&own){if(value){own.handOutline??={};const old=own.handOutline[ev.stack_id];own.handOutline[ev.stack_id]=true;if(old!==true&&!refresh.includes(own.id))refresh.push(own.id);}
   else if(own.handOutline&&ev.stack_id in own.handOutline){const old=own.handOutline[ev.stack_id];own.handOutline[ev.stack_id]=false;if(old!==false&&!refresh.includes(own.id))refresh.push(own.id);}
  }
 }
}
