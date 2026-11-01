// SkillEffectProc0x1f6b00/0x1f8200/0x1fa000; CardProc0x1d200,
// 0x1e500,0x22800,0x23100; CharUniqUIProc0x9e00. Evidence batch3-cards.
import {TALENTS as T} from './card-talent-support.mjs';
export class CardTiperaRuntime {
 constructor(e){this.e=e;this.b=e.b;this.db=e.db;}
 call(n,...a){return this.e.call(n,...a);}
 get stage(){return this.e.state.worktables.BattleStageWorktable.battle_stage;}
 addTiperaIconAction(indices){this.call('addCharUniqUIAction',{type:'_30084',stack_data:{tipera_used_card_indices:indices}});}
 setTiperaCount(id,value){const c=this.b.cardMap[id];this.e.pushChangeData('card',id);c.tipera_count=value;if(value===0)c.tipera_ran_skill_index=[];
  const stageCard=this.stage.all.find(x=>x.id==id);if(stageCard){stageCard.tipera_count=value;stageCard.tipera_ran_skill_index=c.tipera_ran_skill_index?.length?[...c.tipera_ran_skill_index]:[];}
  const property={card:id,tipera_count:value,base_tipera_count:c.base_tipera_count};if(c.tipera_ran_skill_index?.length>0)property.tipera_ran_skill_index=[...c.tipera_ran_skill_index];else if(value===0)property.tipera_ran_skill_index=[];
  this.e.pushAction({id:this.b.last_action_id++,type:'action_card_talent_tipera',action_card_property:property,source_id:c.caster_id});
 }
 resetTiperaCount(id){const c=this.b.cardMap[id];if(!c||c.eff_banned||!c.talents?.includes(T.TALENT_UNIQUE_TIPERA)||(c.tipera_count??0)==0)return;this.setTiperaCount(id,0);}
 resetAllTiperaCountOnBattleEnd(){const ids=[];for(const key in this.b.cardMap){const c=this.b.cardMap[key];if((c.tipera_count??0)==0&&(c.tipera_ran_skill_index?.length??0)==0)continue;ids.push(c.id);}for(const id of ids)this.setTiperaCount(id,0);
  for(const c of this.stage.all){if((c.tipera_count??0)==0&&(c.tipera_ran_skill_index?.length??0)==0)continue;c.tipera_count=0;c.tipera_ran_skill_index=[];}
 }
 resetTiperaUnique3OnBattleEnd(){const ids=this.call('getContinueSkills',this.b.char).filter(id=>{const cs=this.b.csMap[id];return cs!=null&&!cs.removed&&cs.res_id==='cs00_0327';}),tracking=this.b.tipera_unique_3_tracking;
  if(!(ids.length>0||(tracking?.used_card_indices?.length??0)>0||(tracking?.used_cards?.length??0)>0||tracking?.turn_triggered==true))return;
  if(tracking!=null){tracking.used_cards=[];tracking.used_card_indices=[];tracking.turn_triggered=false;}this.addTiperaIconAction([]);
  for(const id of ids){const cs=this.b.csMap[id];if(cs==null||cs.removed)continue;this.call('removeContinueSkill',id,cs.owner_id,cs.isCard);}
 }
 procTiperaUnique3CardUse(card){const ps=this.call('getPassiveByType',{source_id:this.b.char.id,type:'SKILL_EFF_UNIQUE_TIPERA_3',is_card:false});if(!ps.length)return;const p=ps[0],opts=p.eff_opts??[];if(opts.length<7)return;
  const result=opts[0],resources=[opts[1],opts[2],opts[3]];if(!result)return;const index=resources.indexOf(card.res_id);if(index<0)return;
  this.b.tipera_unique_3_tracking??={used_cards:[],used_card_indices:[],turn_triggered:false,result_card_res_id:result};const tracking=this.b.tipera_unique_3_tracking;if(tracking.turn_triggered)return;
  tracking.used_cards.push(card.res_id);tracking.used_card_indices.push(index);if(tracking.used_card_indices.length==1)this.call('procAddCS',this.b.char.id,'cs00_0327',1,p.action_char_id,false,'MATHSIGN_ADD',false,false,p.action_char_id,p.skill_id);
  this.addTiperaIconAction([...tracking.used_card_indices]);if(tracking.used_cards.length>=3){this.createTiperaUnique3CombinedCard(tracking.used_cards,tracking.used_card_indices,opts,p.caster_id);tracking.turn_triggered=true;tracking.used_cards=[];}
 }
 createTiperaUnique3CombinedCard(resources,indices,opts,owner){const result=opts[0],links=[opts[4],opts[5],opts[6]];if(!result)return;const skills=[];for(const index of indices)if(index>=0&&index<links.length)skills.push(links[index]);
  const created=this.call('getCards',{source_id:owner,card_res_ids:[result],to:2,N:1,addStage:false,override_skill_eff_ids:skills,eff_opt:['create_no_count']});if(created.length)this.call('addDetailLog',{type:'log_skill_eff_card_get',params:[[created[0].id,1],2],param_types:['card_id_with_count','card_to_wo_hand']});
 }
 procTiperaTalentStackIncrease(card){if(!['c_30084_cre1','c_30084_cre2','c_30084_cre3'].includes(card.res_id))return;
  this.b.deck_info.hand.forEach(id=>{if(this.call('isCardUninteractible',id))return;const c=this.b.cardMap[id];if(!c||c.card_place!==2||!c.talents?.includes(T.TALENT_UNIQUE_TIPERA))return;
   const max=c.base_tipera_count??0,count=c.tipera_count??0;if(count>=max)return;const skills=c.skill_eff_ids.filter(id=>!c.r_spark_skill_eff_ids?.includes(id));if(skills.length){c.tipera_ran_skill_index??=[];c.tipera_ran_skill_index.push(this.e.random.randRange(0,0,skills.length));}this.setTiperaCount(id,count+1);
  });
 }
}
