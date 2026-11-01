// Card/queue source family. Static source files in evidence/batch3-cards/.
import {MissingBattleRule} from './resource-store.mjs';
import {resdbShuffle} from '../../rng-investigation/resdb-shuffle.mjs';
import {TALENTS as T} from './card-talent-support.mjs';
import {CardTalentRuntime} from './card-talent-runtime.mjs';
import {CardSparkPoolRuntime} from './card-spark-pool-runtime.mjs';
import {CardEidolonRuntime} from './card-eidolon-runtime.mjs';
import {CardCharacterRuntime} from './card-character-runtime.mjs';
import {CardRecoveryRuntime} from './card-recovery-runtime.mjs';
import {CardLightDarkRuntime} from './card-light-dark-runtime.mjs';
import {CardTiperaRuntime} from './card-tipera-runtime.mjs';
import {CardCopyRuntime} from './card-copy-runtime.mjs';
import {CardReactionRuntime} from './card-reaction-runtime.mjs';
import {CardFilterRuntime} from './card-filter-runtime.mjs';
export const CARD_MECHANIC_BINDINGS={getRandomCost:'getRandomCost',validateCardUseData:'validateCardUseData',pushCardUse:'pushCardUse',pushCardCoop:'pushCardCoop',pushCardRepeat:'pushCardRepeat',deferCardUseForNextWave:'deferCardUseForNextWave',skipQueuedCoopUse:'skipQueuedCoopUse',checkCoop:'checkCoop',checkOpening:'checkOpening',procRitaUniqueCostDeduction:'procRitaUniqueCostDeduction',csOriginCardUse:'csOriginCardUse',addTalents:'addTalents',removeTalents:'removeTalents',replaceTalents:'replaceTalents',getTalentBaseEnum:'getTalentBaseEnum',resetTalentCount:'resetTalentCount'};
for(const name of ['getCostByInfo','getRSparkReplaceCosts','getRSparkMatchCosts','hasCostInRange','getRSparkCandidates','getRSparkCandis'])CARD_MECHANIC_BINDINGS[name]=name;
for(const name of ['applyEidolonRewardCS','applyEidolonRewardEffect'])CARD_MECHANIC_BINDINGS[name]=name;
Object.assign(CARD_MECHANIC_BINDINGS,{'checkUniqueChizuru.active':'checkUniqueChizuruActive',procUniqueChizuruDamage:'procUniqueChizuruDamage',procNihilumMetaDamage:'procNihilumMetaDamage'});
for(const name of ['stageAddCard','stageAddCards','stageRemoveCard','getStageGenerateID','setStageGenerateID','checkEfficiency','getOwnerEgo','getUniqueCardList','getUniqueCardListWithCardRSparkChange'])CARD_MECHANIC_BINDINGS[name]=name;
for(const name of ['resolveCollapseRecoverCard','resyncCardHandOutline','recoverFromCollapseCard','recoverBattleCollapseCards'])CARD_MECHANIC_BINDINGS[name]=name;
for(const name of ['isCardTestament','procCardUseEvent','procNotBreakCardAdditional','pushHandCheatSpark'])CARD_MECHANIC_BINDINGS[name]=name;
Object.assign(CARD_MECHANIC_BINDINGS,{'checkLightDarkCombine.active':'checkLightDarkCombineActive',hasLightDarkCombineBlocking:'hasLightDarkCombineBlocking',releaseLightDarkCombineWaiting:'releaseLightDarkCombineWaiting',isTriggeredCardCopyIgnoreCond:'isTriggeredCardCopyIgnoreCond'});
CARD_MECHANIC_BINDINGS.isLightDarkReactionSkill='isLightDarkReactionSkill';
for(const name of ['setTiperaCount','resetTiperaCount','resetAllTiperaCountOnBattleEnd','resetTiperaUnique3OnBattleEnd','procTiperaUnique3CardUse','createTiperaUnique3CombinedCard','procTiperaTalentStackIncrease','addTiperaIconAction'])CARD_MECHANIC_BINDINGS[name]=name;
for(const name of ['copyCards','copyTalentCounts','setOlgaCount','procOlgaStackSetAdd','resetAllOlgaCountOnBattleEnd','cardRelativeProbabilityIndex','triggerPyeonrin','moveOpenedPyeonrinSubToEnd','getStageCard','willBindInHand'])CARD_MECHANIC_BINDINGS[name]=name;
CARD_MECHANIC_BINDINGS['openPyeonrinSub.group']='openPyeonrinSubGroup';
CARD_MECHANIC_BINDINGS.getTargetableMonsterPassiveFilteredIDs='getTargetableMonsterPassiveFilteredIDs';
for(const name of ['cardFilterProc','filterCard','filterExtraTag','checkRSparkRarity','getCodexSeasonExtraTags','getSortsByInfo','getAdditiveRSparkResIds','hasOriginTalentInUniqueRSpark','getUniqueRSparkCandidates'])CARD_MECHANIC_BINDINGS[name]=name;
export class CardMechanicRuntime {
 constructor(e){this.e=e;this.b=e.b;this.w=e.wt;this.db=e.db;this.talent=new CardTalentRuntime(e);this.sparkPool=new CardSparkPoolRuntime(e);this.eidolon=new CardEidolonRuntime(e);this.character=new CardCharacterRuntime(e);this.recovery=new CardRecoveryRuntime(e);this.lightDark=new CardLightDarkRuntime(e);this.tipera=new CardTiperaRuntime(e);this.copy=new CardCopyRuntime(e);this.cardReaction=new CardReactionRuntime(e);this.filter=new CardFilterRuntime(e);}
 call(n,...a){return this.e.call(n,...a);}
 copyCards(...a){return this.copy.copyCards(...a);}
 willBindInHand(...a){return this.e.cardCreate.willBindInHand(...a);}
 copyTalentCounts(...a){return this.copy.copyTalentCounts(...a);}
 setOlgaCount(...a){return this.cardReaction.setOlgaCount(...a);}
 procOlgaStackSetAdd(...a){return this.cardReaction.procOlgaStackSetAdd(...a);}
 resetAllOlgaCountOnBattleEnd(...a){return this.cardReaction.resetAllOlgaCountOnBattleEnd(...a);}
 cardRelativeProbabilityIndex(...a){return this.cardReaction.cardRelativeProbabilityIndex(...a);}
 triggerPyeonrin(...a){return this.cardReaction.triggerPyeonrin(...a);}
 getTargetableMonsterPassiveFilteredIDs(...a){return this.cardReaction.getTargetableMonsterPassiveFilteredIDs(...a);}
 openPyeonrinSubGroup(...a){return this.cardReaction.openPyeonrinSubGroup(...a);}
 moveOpenedPyeonrinSubToEnd(...a){return this.cardReaction.moveOpenedPyeonrinSubToEnd(...a);}
 getStageCard(id,stageWT){return (stageWT===undefined?this.stage:stageWT.battle_stage).all.find(c=>c.id==id);}
 cardFilterProc(...a){return this.filter.cardFilterProc(...a);}
 filterCard(...a){return this.filter.filterCard(...a);}
 filterExtraTag(...a){return this.filter.filterExtraTag(...a);}
 checkRSparkRarity(...a){return this.filter.checkRSparkRarity(...a);}
 getCodexSeasonExtraTags(...a){return this.filter.getCodexSeasonExtraTags(...a);}
 getSortsByInfo(...a){return this.filter.getSortsByInfo(...a);}
 getAdditiveRSparkResIds(...a){return this.filter.getAdditiveRSparkResIds(...a);}
 hasOriginTalentInUniqueRSpark(...a){return this.filter.hasOriginTalentInUniqueRSpark(...a);}
 getUniqueRSparkCandidates(...a){return this.filter.getUniqueRSparkCandidates(...a);}
 addTalents(...a){return this.talent.addTalents(...a);}
 removeTalents(...a){return this.talent.removeTalents(...a);}
 replaceTalents(...a){return this.talent.replaceTalents(...a);}
 getTalentBaseEnum(...a){return this.talent.getTalentBaseEnum(...a);}
 resetTalentCount(...a){return this.talent.resetTalentCount(...a);}
 getCostByInfo(...a){return this.sparkPool.getCostByInfo(...a);}
 getRSparkReplaceCosts(...a){return this.sparkPool.getRSparkReplaceCosts(...a);}
 getRSparkMatchCosts(...a){return this.sparkPool.getRSparkMatchCosts(...a);}
 hasCostInRange(...a){return this.sparkPool.hasCostInRange(...a);}
 getRSparkCandidates(...a){return this.sparkPool.getRSparkCandidates(...a);}
 getRSparkCandis(...a){return this.sparkPool.getRSparkCandis(...a);}
 applyEidolonRewardCS(...a){return this.eidolon.applyEidolonRewardCS(...a);}
 applyEidolonRewardEffect(...a){return this.eidolon.applyEidolonRewardEffect(...a);}
 checkUniqueChizuruActive(...a){return this.character.checkUniqueChizuruActive(...a);}
 procUniqueChizuruDamage(...a){return this.character.procUniqueChizuruDamage(...a);}
 procNihilumMetaDamage(...a){return this.character.procNihilumMetaDamage(...a);}
 resolveCollapseRecoverCard(...a){return this.recovery.resolveCollapseRecoverCard(...a);}
 resyncCardHandOutline(...a){return this.recovery.resyncCardHandOutline(...a);}
 recoverFromCollapseCard(...a){return this.recovery.recoverFromCollapseCard(...a);}
 recoverBattleCollapseCards(...a){return this.recovery.recoverBattleCollapseCards(...a);}
 checkLightDarkCombineActive(...a){return this.lightDark.checkLightDarkCombine(...a);}
 hasLightDarkCombineBlocking(...a){return this.lightDark.hasLightDarkCombineBlocking(...a);}
 releaseLightDarkCombineWaiting(...a){return this.lightDark.releaseLightDarkCombineWaiting(...a);}
 isTriggeredCardCopyIgnoreCond(...a){return this.lightDark.isTriggeredCardCopyIgnoreCond(...a);}
 isLightDarkReactionSkill(...a){return this.lightDark.isLightDarkReactionSkill(...a);}
 setTiperaCount(...a){return this.tipera.setTiperaCount(...a);}
 resetTiperaCount(...a){return this.tipera.resetTiperaCount(...a);}
 resetAllTiperaCountOnBattleEnd(...a){return this.tipera.resetAllTiperaCountOnBattleEnd(...a);}
 resetTiperaUnique3OnBattleEnd(...a){return this.tipera.resetTiperaUnique3OnBattleEnd(...a);}
 procTiperaUnique3CardUse(...a){return this.tipera.procTiperaUnique3CardUse(...a);}
 createTiperaUnique3CombinedCard(...a){return this.tipera.createTiperaUnique3CombinedCard(...a);}
 procTiperaTalentStackIncrease(...a){return this.tipera.procTiperaTalentStackIncrease(...a);}
 addTiperaIconAction(...a){return this.tipera.addTiperaIconAction(...a);}
 isCardTestament(id){const c=this.b.cardMap[id];if(!c)return false;return c.talents?.includes(T.TALENT_TESTAMENT)===true||this.call('getPassiveByType',{source_id:id,type:'SKILL_EFF_CARD_TESTAMENT',is_card:true}).length>0;}
 procCardUseEvent(id){const c=this.b.cardMap[id];this.call('procCardEvent','CONDITION_CARD_USE',c.place_before_using,id,{value:c.cost_before_using});c.cost_before_using=undefined;c.rita_value=undefined;c.ego_field_dmg_increased=undefined;}
 // procSkillEffs0x9bb00 @1280..1598; caller performed passive lookup once.
 procNotBreakCardAdditional(id,result,passives){const targets=result.flat().filter((x,i,a)=>a.indexOf(x)===i&&this.call('isMonsterByID',x)),target=targets.find(x=>{const m=this.e.getUnit(x);return !m.ego_breaked&&!['death','run','changed','half_death','keep_half_death'].includes(m.state);});
  if(target==null)return;this.call('pushCardRepeat',{card_id:id,target,procUse:false,procCost:false,repeat:true,by_not_break_additional:true,preserve_target:true},passives[0].skill_id);this.call('checkTermValuePassive',passives[0].skill_id,this.b.char.id);
 }
 // pushHand0xcd900 @449..753. Reverse iteration means the earliest matching
 // cheat entry remains on the card after all corresponding actions are sent.
 pushHandCheatSpark(id){const list=this.stage.cheat_info.cheat_turn_spark;if(!list)return;for(let i=list.length-1;i>=0;i--){const entry=list[i];if(this.b.turn!=entry[0])continue;const c=this.b.cardMap[id];if(c.char_id!=entry[1])continue;
   c.y_spark={next_card:this.call('makeCardInfo',this.call('getStageGenerateID'),entry[2],c.char_id)};this.e.pushAction({id:this.b.last_action_id++,type:'action_card_yspark',source_id:id,y_spark:c.y_spark});list.splice(i,1);
  }}
 get stage(){const stage=this.e.state.worktables.BattleStageWorktable?.battle_stage;if(!stage)throw new MissingBattleRule('cardMechanic.battle_stage');return stage;}
 stageAddCard(reward,info){this.stage.all.push(info);if(reward){this.stage.battle_card_rewards.push(info.id);this.db.get('card',info.res_id);}}
 stageAddCards(reward,...infos){for(const info of infos)this.stageAddCard(reward,info);}
 getUniqueCardListWithCardRSparkChange(res){const list=[res],cache=this.call('getDataCache','CARD_R_SPARK_CARD_CHANGE:'+res,{skipError:true});if(cache){const extra=JSON.parse(cache);if(extra&&extra.length>0)list.push(...extra);}return list;}
 getUniqueCardList(charRes){if(charRes<0)return [];const row=this.db.get('char_combatant',charRes);return [1,2,3,4].map(i=>this.getUniqueCardListWithCardRSparkChange(row['spark_card_'+i+'_link_card_id']));}
 stageRemoveCard(...ids){for(const id of ids){const s=this.stage,index=s.all.findIndex(c=>c.id==id);if(index<0)continue;const [card]=s.all.splice(index,1);if(!card)continue;const sort=this.db.table('card')[card.res_id]?.sort;if(!['SORT_DESIRE','SORT_MEMORY'].includes(sort))s.removed.push(card);
   if(s.spark.r_sparks[card.id]){delete s.spark.r_sparks[card.id];const owner=card.char_id-1;if(s.spark.r_spark_count[owner]!=null)++s.spark.r_spark_count[owner];}
  }}
 getStageGenerateID(){return this.stage.gen_id++;}
 setStageGenerateID(id){this.stage.gen_id=id;}
 checkEfficiency(skill){const c=this.call('getParentCard',skill.skill_id);if(!c||c.cost<0)return false;const cost=c.cost_before_using??c.cost_result;return cost>=0&&cost<c.cost;}
 // BattleCardProc0x25600 reads the stage owner, not the battle's currently
 // active leader. EGO_TYPE_STRING.NONE is the literal 'NONE'.
 getOwnerEgo(id){const c=this.b.cardMap[id];if(!c)return 'NONE';const owner=this.call('tryGetStageCharByCharId',c.char_id);return owner==null?'NONE':this.call('convertEgoCommon',this.db.get('char_combatant',owner.res_id).link_ego_type_id);}
 shuffle(a){return resdbShuffle(a,()=>this.e.random.nextInt(0)/2147483647);}
 // SkillEffectProc0x1f0600, GameResDB.shuffle mutates the supplied candidates.
 getRandomCost(id,candidates){const s=this.b.skillMap[id];if(s.cost_random==null||s.cost_random_index==null||s.cost_random_index>=s.cost_random.length){s.cost_random=this.shuffle(candidates);s.cost_random_index=0;}return s.cost_random[s.cost_random_index++];}
 // Worktable0x36f00: -1 is the explicit copy-only sentinel. Invalid input is
 // diagnosed and rejected, not silently added to a queue.
 validateCardUseData(data,skillId){if(data.card_id===-1||this.b.cardMap[data.card_id])return true;
  this.e.trace.push({kind:'content_error',source:'validateCardUseData',message:'err:invalid_card_use:card_id='+data.card_id+' not found in cardMap',skill_id:skillId,skill_res_id:this.b.skillMap[skillId]?.res_id});return false;
 }
 pushCardUse(data,skillId){if(!this.validateCardUseData(data,skillId)||this.b.cardMap[data.card_id]?.testament_pending)return;
  if(skillId!=null&&data.by_card_use_reuse==null){const s=this.b.skillMap[skillId];if(s&&this.db.get('skill_eff',s.res_id)?.eff==='SKILL_EFF_CARD_USE')data.by_card_use_reuse=true;}
  (this.b.cardUses??=[]).push(data);
 }
 pushCardCoop(data,skillId){if(this.validateCardUseData(data,skillId))(this.b.cardCoops??=[]).push(data);}
 pushCardRepeat(data,skillId){if(this.validateCardUseData(data,skillId))(this.b.cardRepeats??=[]).push(data);}
 deferCardUseForNextWave(data){if(!this.b.battle_step_mode?.next_wave||data.by_testament||data.copyInfo)return false;(this.b.nextWaveDeferredCardUses??=[]).push(data);return true;}
 skipQueuedCoopUse(data){const c=this.b.cardMap[data.card_id];
  if(data.by_celestial&&(!c.talents?.includes(T.TALENT_CELESTIAL)||c.card_place!==2))return true;
  if(data.by_testament&&(!this.call('isCardTestament',data.card_id)||![3,11].includes(c.card_place)))return true;
  if(data.by_opening){if(!c.talents?.includes(T.TALENT_OPENING)||![2,1].includes(c.card_place)||!this.call('isCardAvailable',data.card_id))return true;const cost=this.call('getCost',data.card_id,false);if(cost>0&&this.procRitaUniqueCostDeduction(data.card_id,cost)>this.b.energy)return true;}
  if(data.by_vallista){if(this.deferCardUseForNextWave(data))return true;return !c.talents?.includes(T.TALENT_VALLISTA)||c.card_place!==4;}
  return !this.call('isCardAvailable',data.card_id);
 }
 checkCoop(owner,ids){if(![1,2,3,7].includes(owner))return;this.call('sortHandCards');
  for(const id of this.b.deck_info.hand){if(!ids.includes(id)||this.call('isCardUninteractible',id))continue;const c=this.b.cardMap[id];if(c.char_id===owner||!c.talents?.includes(T.TALENT_COOP)||c.unusable)continue;
   this.pushCardCoop({card_id:id,target:this.b.select_target,procUse:true,procCost:false});return;
  }
 }
 checkOpening(){const ids=this.b.deck_info.hand.concat(this.b.deck_info.deck).filter(id=>this.b.cardMap[id].talents?.includes(T.TALENT_OPENING)&&this.call('isCardAvailable',id));if(!ids.length)return;this.shuffle(ids);let energy=this.b.energy;
  for(const id of ids){const cost=this.call('getCost',id,false),deducted=cost<=0?0:this.procRitaUniqueCostDeduction(id,cost);if(deducted>energy)continue;energy-=deducted;this.pushCardCoop({card_id:id,target:this.b.select_target,procUse:true,procCost:true,by_opening:true});}
 }
 // CardProc0x8af00: dry-run is the default; actual consumption also emits the
 // owner's RITA event with the real negative duration delta.
 procRitaUniqueCostDeduction(id,cost,options){const c=this.b.cardMap[id],deduct=options?.deduct??false;if(!c||cost<=0)return cost;
  const ps=this.call('getPassiveByType',{source_id:c.char_id,type:'SKILL_EFF_UNIQUE_RITA_1',is_card:false,char_id:c.char_id});if(!ps.length)return cost;const sorts=this.call('getSort',id);let result=cost;
  for(const p of ps){const r=this.db.get('skill_eff',p.res_id),visible=r.trigger_noti_type!=='NO_LOG',filter=this.db.array(r.target_card_set_card_sort);
   if(filter.length&&(filter.includes('not')?sorts.some(s=>filter.includes(s)):!sorts.some(s=>filter.includes(s))))continue;
   if(p.parent.type!=='CS')continue;const cs=this.b.csMap[p.parent.id];if(!cs||cs.removed||cs.term_value<=0)continue;const n=Math.min(result,cs.term_value);
   if(deduct){const old=cs.term_value;if(this.call('addTermValue',cs.cs_id,-n,'MATHSIGN_ADD',c.char_id,false,p.skill_id,false,visible))this.call('removeContinueSkill',cs.cs_id,cs.owner_id,cs.isCard,{old_tv:n});
    const delta=cs.term_value-old;if(delta!==0)this.call('procUnitEvent','CONDITION_CHAR_UNIQUE_RITA_1',[cs.owner_id,cs.show_cs_res_id??cs.res_id,cs.char_id],delta);
   }result-=n;if(result<=0)break;
  }return result;
 }
 csOriginCardUse(){return 'CARD_USE';} // native CS origin literal, also retained in captured auto-CS
}
