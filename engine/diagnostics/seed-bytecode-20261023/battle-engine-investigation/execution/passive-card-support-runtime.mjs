// BattleCardProc reversible debuff transformation, 0x69d00..0x78300.
// Every retained JS file is source evidence only, never imported or executed.
const STACK_KEYS=['stack_trigger','stack_value0','stack_value1','stack_count0','stack_count1']; // module0x100
const PRESERVED='id skill_eff_ids r_spark_skill_eff_ids eidolon_skill_eff_ids passive continueSkill ccsOutline debuffs banned_debuff banned_cs stack_use handOutline card_place dim known by_turn_draw before_change_card_id place_before_using place_after_using cost_before_using rita_value ego_field_dmg_increased'.split(' ');
export class PassiveCardSupportRuntime {
 constructor(e){this.e=e;this.b=e.b;this.w=e.wt;}
 call(n,...a){return this.e.call(n,...a);}
 getChangeDebuffCSID(id){const s=this.b.skillMap[id];if(s?.parent.type!=='CS')return;const cs=this.b.csMap[s.parent.id];if(cs?.isCard&&!cs.removed&&!cs.byAuto)return cs.cs_id;}
 getChangeDebuffStackSnapshot(card){return card.skill_eff_ids.map(id=>{const s=this.b.skillMap[id],snapshot={};if(s)for(const key of STACK_KEYS){const stack=s[key]==null?undefined:this.b.stackMap[s[key]];if(stack)snapshot[key]=stack.stack;}return snapshot;});}
 makeChangeDebuffOriginCard(card,csId){const before=structuredClone(card),cs=this.b.csMap[csId],skills=new Set(cs?.skillEffs??[]);
  const filter=(key,predicate)=>{before[key]=before[key]?.filter(predicate);if(before[key]?.length===0)before[key]=undefined;};
  filter('continueSkill',id=>id!=csId);filter('passive',([id])=>!skills.has(id));filter('ccsOutline',id=>id!=csId);
  if(cs?.from_debuff){filter('debuffs',d=>d.debuff_res_id!=cs.from_debuff);filter('banned_debuff',([id,res])=>id!=cs.from_debuff||res!=cs.res_id);}
  if(cs)filter('banned_cs',id=>id!=cs.cs_id);before.before_change_debuff_card=undefined;before.change_debuff_skill_id=undefined;return before;
 }
 applyChangeDebuff(id,res,skillId){const c=this.b.cardMap[id];if(!c||c.before_change_debuff_card||!c.passive?.some(([i])=>i==skillId))return id;
  const csId=this.getChangeDebuffCSID(skillId);if(csId==null||!c.continueSkill?.includes(csId))return id;
  const snapshot=this.getChangeDebuffStackSnapshot(c),before=this.makeChangeDebuffOriginCard(c,csId),next=this.call('changeCards',[id],res,{keepCSIds:[csId],ignoreCardChangeDebuff:true})[0];if(!next)return id;
  next.before_change_debuff_card=before;next.change_debuff_skill_id=skillId;next.change_debuff_stack_snapshot=snapshot;return next.id;
 }
 isRestoredCardHandOutlineStack(stackId,cardId){if(!this.b.stackMap[stackId])return false;
  return this.b.stackParentMap[stackId]?.some(p=>{if(p.from==='CARD')return p.parent_id==cardId;if(p.from!=='SKILL')return false;const s=this.b.skillMap[p.parent_id];if(!s)return false;return s.parent.type==='CARD'&&s.parent.id==cardId||this.call('getParentCard',s.skill_id)?.id==cardId;})??false;
 }
 restoreChangeDebuffCardState(next,before){const preserved=Object.fromEntries(PRESERVED.map(k=>[k,next[k]]));for(const k of Object.keys(next))delete next[k];Object.assign(next,structuredClone(before),preserved);
  next.before_change_debuff_card=undefined;next.change_debuff_skill_id=undefined;next.change_debuff_stack_snapshot=undefined;
  const outline={...(next.handOutline??{})};let has=Object.keys(outline).length>0;
  if(before.handOutline)for(const key in before.handOutline){const id=Number(key);if(Number.isInteger(id)&&this.isRestoredCardHandOutlineStack(id,next.id)){outline[id]=before.handOutline[id];has=true;}}
  next.handOutline=has?outline:undefined;
 }
 restoreChangeDebuffSkillStacks(card,snapshots){snapshots.forEach((snapshot,i)=>{const s=this.b.skillMap[card.skill_eff_ids[i]];if(!s)return;for(const key of STACK_KEYS)if(snapshot[key]!=null&&s[key]!=null&&this.b.stackMap[s[key]])this.e.stacks.setStack(s[key],snapshot[key]);});}
 procRestoredChangeDebuffCurrentTimingStacks(cardId,start){const current=this.b.current_state;if(current===this.e.enums.LogicState.TIMING_NONE)return;
  const end=this.b.stack_id;for(let id=start;id<end;id++){const s=this.b.stackMap[id];if(!s||s.inactive||!s.timingMap||!Object.values(s.timingMap).some(a=>a.includes(current))||!this.isRestoredCardHandOutlineStack(id,cardId))continue;this.e.stacks.onTimingCheck(id,current);}
 }
 recoverChangeDebuff(id,skillId){const c=this.b.cardMap[id];if(!c?.before_change_debuff_card||c.change_debuff_skill_id!=null&&c.change_debuff_skill_id!=skillId)return id;
  const snapshots=c.change_debuff_stack_snapshot,before=structuredClone(c.before_change_debuff_card),info=structuredClone(before);info.id=this.b.last_unit_id++;const start=this.b.stack_id;
  const next=this.call('changeCards',[id],before.res_id,{cardInfo:info,keepCS:true,keepCardState:before,ignoreCardChangeDebuff:true,
   prepareNewCard:card=>{this.restoreChangeDebuffCardState(card,before);if(snapshots)this.restoreChangeDebuffSkillStacks(card,snapshots);}})[0];if(!next)return id;
  const s=this.b.skillMap[skillId],cs=s?.parent.type==='CS'?this.b.csMap[s.parent.id]:undefined;
  const remap=(from,to)=>{if(!cs?.isCard)return;for(const key of ['owner_id','action_target_id','caster_id'])if(from.includes(cs[key]))cs[key]=to;cs.skillEffs.forEach(i=>{const sk=this.b.skillMap[i];if(sk&&from.includes(sk.caster_id))sk.caster_id=to;});};
  remap([id,before.id],next.id);const final=this.call('checkNihilumMetaStack',next)??next.id;if(final!=next.id)remap([next.id],final);
  this.procRestoredChangeDebuffCurrentTimingStacks(final,start);return final;
 }
}
