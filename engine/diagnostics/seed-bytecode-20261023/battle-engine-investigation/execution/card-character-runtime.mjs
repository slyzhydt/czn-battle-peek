// Worktable0x71200 and damage-apply0x1d500 @19535..21569. Character
// helpers are shared by card/queue reactions and the formal damage pipeline.
export class CardCharacterRuntime {
 constructor(e){this.e=e;this.b=e.b;this.w=e.wt;this.db=e.db;}
 call(n,...a){return this.e.call(n,...a);}
 csLog(cs){const row=this.db.table('cs')[cs.res_id];if(row)this.call('pushSubBattleLog',{type:16,params:[row.show_link_cs_id!=='none'?row.show_link_cs_id:row.id],logs:[],not_noti:this.call('isMonsterByID',cs.owner_id)});}
 checkUniqueChizuruActive(id){const cs=this.b.csMap[id];if(!cs||this.call('isCollapseOnCharacterByID',cs.caster_id)||cs.term_value<5)return;
  this.csLog(cs);if(this.call('addTermValue',cs.cs_id,-5,'MATHSIGN_ADD',this.b.char.id,false))this.call('removeContinueSkill',cs.cs_id,this.b.char.id,false);
  this.call('getCards',{source_id:cs.caster_id,card_res_ids:['c_1060_uni4'],to:2,N:1,addStage:false,skill_id:-1});this.call('setSubFinished');
 }
 procUniqueChizuruDamage({card_id,target,is_last_attack,ref,dmg_additional}){
  if(card_id===-1||ref||dmg_additional)return;const card=this.b.cardMap[card_id];if(!card||this.call('getTalentByInfo',card).includes(37)||this.call('isCollapseOnCharacterByID',card.char_id))return;
  const passives=this.call('getPassiveByType',{source_id:target.id,type:'SKILL_EFF_UNIQUE_CHIZURU',is_card:false,check_pct:false});if(!passives.length)return;
  const byCard=this.w.byCard;this.w.byCard=undefined;
  for(const p of passives){if(this.call('isCollapseOnCharacterByID',p.caster_id))continue;const parent=this.b.csMap[p.parent.id];if(!p.link_cs_ids||!p.caster_id)continue;
   for(const res of p.link_cs_ids){const n=1+(is_last_attack?(parent?.term_value??0)-1:0),id=this.call('procAddCS',p.caster_id,res,n,p.caster_id,false,'MATHSIGN_ADD',false,false,p.caster_id,p.skill_id),cs=this.b.csMap[id];if(!id||!cs||cs.term_value<5)continue;
    this.csLog(cs);this.call('removeContinueSkill',id,p.caster_id,false);const row=this.db.table('skill_eff')[p.res_id];if(row?.target_card_set_opt_multiple_link){const cards=this.db.array(row.target_card_set_opt_multiple_link);if(cards.length)this.call('getCards',{source_id:p.caster_id,card_res_ids:[cards[0]],to:2,N:1,addStage:false,skill_id:-1});}this.call('setSubFinished');
   }
  }this.w.byCard=byCard;
 }
 // DamageCalculate target callback0x5d300 @11836..12534. Caller applies the
 // args.nihilum_meta gate; native also runs this tail while previewing.
 procNihilumMetaDamage({card_id,target,deadEvent}){const c=this.b.cardMap[card_id];if(!c||this.b.nihilum_meta_activated||!deadEvent)return;
  const row=this.db.table('monster')[target.res_id],step=this.b.battle_step_mode;if(step?.type==='BATTLE_STEP_BOSS_MODE'&&step.cur+1<3)return;
  if(!row||['GRADE_NPC','GRADE_GIANT','GRADE_INTERACTIVE_PROP','GRADE_PROP'].includes(row.grade)||this.call('getPassiveByType',{source_id:target.id,type:'SKILL_EFF_HALF_DEAD_ABLE',is_card:false}).length)return;
  deadEvent.skip_death_eff=true;const n=row.grade==='GRADE_BOSS'?3:row.grade==='GRADE_ELITE'?2:1;this.b.nihilum_meta_activated=true;c.nihilum_stack_inc=n;c.nihilum_stack=(c.nihilum_stack??0)+n;c.nihilum_meta_motion='nihilum_meta_execution_attack';
 }
}
