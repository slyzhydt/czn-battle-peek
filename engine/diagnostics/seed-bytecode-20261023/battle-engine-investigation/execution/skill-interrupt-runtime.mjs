// procSkillEff0xdf800 @6083..8866, raw JumpConstant targets checked.
// InterruptType literals: battle_enums0x1d300 (CARD/CARD_RES/OPTION_SELECT/EVENT).
import {MissingBattleRule} from './resource-store.mjs';
export const SKILL_INTERRUPT_BINDINGS={procSkillSelectionInterrupt:'selection',procSkillAlreadyInterrupted:'already',markInterruptOrderPending:'mark'};
export class SkillInterruptRuntime {
 constructor(e){this.e=e;this.b=e.b;this.w=e.wt;this.db=e.db;}
 mark(){this.w.interrupted=true;}
 badManualTiming(s,r,explicit){if(s.parent.type!=='CARD')return;if(explicit&&r.timing_interrupt_flag!=='YES')return;
  const attr=this.db.array(r.eff_attr),bad=r.eff==='SKILL_EFF_DMG'&&!attr.includes('DMG_ATTR_AUTO')||r.eff==='SKILL_EFF_SHIELD'&&!attr.includes('SHIELD_ATTR_AUTO');if(!bad)return;
  const dirty=this.w.uctx?.dirty??this.e.state.uctx?.dirty??this.e.state.runtimeInputs?.battleSaveDirty;if(!dirty)throw new MissingBattleRule('input.uctx.dirty.invalid_interrupt_resource',{res_id:s.res_id});dirty.battle_save=false;
  this.e.call('ContentError',(explicit?'err:invalid_timing_interrupt_flag_with_not_auto_DMG_or_SHIELD:':'err:invalid_timing_with_not_auto_DMG_or_SHIELD:')+s.res_id,{channel:'#server_report_dev2'});dirty.battle_save=true;
 }
 frame(s,o,subsequent){return['CARD',s.skill_id,s.card_triggered,subsequent?true:undefined,s.bind_stack_triggered,s.pyeonrin_trigger_group_id,o.byCard==true||o.card_activation==true];}
 selection(id,o={}){const s=this.b.skillMap[id],r=this.db.get('skill_eff',s.res_id);this.b.interrupts??=[];let kind;
  if(['SKILL_EFF_CARD_GET','SKILL_EFF_CARD_GET_IGNORE_COND','SKILL_EFF_CARD_GET_OVERFLOW_TO_DECK_TOP','SKILL_EFF_CARD_GET_WITH_COST'].includes(r.eff))kind='CARD_RES';else if(['SKILL_EFF_CARD_OPTION_SELECT','SKILL_EFF_CARD_RAN_SELECT_USE'].includes(r.eff))kind='OPTION_SELECT';else if(r.eff==='SKILL_EFF_BATTLE_EVENT')kind='EVENT';
  if(kind)this.b.interrupts.push([kind,id,s.card_triggered,undefined]);else{this.badManualTiming(s,r,true);this.b.interrupts.push(this.frame(s,o,false));}
  if(!this.e.getMonster(s.caster_id))this.mark();return[];
 }
 already(id,o={}){const s=this.b.skillMap[id],r=this.db.get('skill_eff',s.res_id);this.badManualTiming(s,r,false);this.b.interrupts??=[];this.b.interrupts.push(this.frame(s,o,true));return[];}
}
