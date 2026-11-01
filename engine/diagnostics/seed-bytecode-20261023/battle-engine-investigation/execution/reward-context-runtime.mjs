// Handwritten StageWT0xbe00/0xd900,0x14300..17000,0x6b700..6c800 and
// AssaultLogic0xea00..13f00. Evidence: active-effects/card-reward-*.
import fs from 'node:fs';
import {MissingBattleRule} from './resource-store.mjs';
import {TALENTS} from './card-talent-support.mjs';
const restrictions=JSON.parse(fs.readFileSync(new URL('../cards/restrictions.symbolic.json',import.meta.url),'utf8')),talentNames=Object.fromEntries(Object.entries(TALENTS).map(([name,id])=>[id,name]));
export const REWARD_CONTEXT_BINDINGS={getExtraTagRewardContext:'context',getExtraTagRewardContextForStage:'contextForStage',stageIsAssaultMode:'assaultMode',stageIsAssaultFourthCombatant:'assaultFourth',getActiveAssaultSeasonTags:'activeSeasonTags',getActiveAssaultSeasonTagsForStage:'activeSeasonTagsForStage',isAssaultSeasonExcluded:'seasonExcluded',stageCheckRSparkAvailableNow:'sparkNow',stageIsRSparkAvailable:'rSparkAvailable',stageIsSparkAvailable:'sparkAvailable',stageHasPendingRSpark:'pendingSpark',stageClearCardRepos:'clearRepos',stageSaveCardToRepos:'saveRepos',stageLoadCardFromRepos:'loadRepos'};
export class RewardContextRuntime {
 constructor(e){this.e=e;this.db=e.db;}
 get stageWT(){return this.e.state.worktables.BattleStageWorktable;}
 get stage(){return this.stageWT.battle_stage;}
 context(){return this.contextForStage(this.stageWT);}
 contextForStage(w){const stage=w?.battle_stage,row=this.db.table('stage_component')[stage?.stage_id],tags=this.db.array(row?.link_extra_tag_id??''),prob=row?.link_extra_reward_prob_id??'none',base={stage_component_res:row,extra_tags:tags,extra_reward_prob_id:prob,is_extra_area_group:false},areaID=stage?.extra_area_info?.extra_area_id;if(areaID==null||areaID==''||areaID=='none')return base;const area=this.db.table('extra_area')[areaID],group=area?this.db.table('extra_area_group')[area.group]:undefined,extra=this.db.array(group?.link_extra_tag_id??'');if(extra.length===0)return base;return{stage_component_res:row,extra_tags:extra,extra_reward_prob_id:prob,is_extra_area_group:true};}
 assaultMode(w=this.stageWT){return w.battle_stage.ingame_content_config_id==='CONTENT_CHAOS_ASSAULT';}
 assaultFourth(id,w=this.stageWT){return this.assaultMode(w)&&id==7;}
 parseTags(raw){return this.db.array(raw??'').filter(x=>x!=''&&x!='none');}
 rotationTags(schedule){if(!schedule)return[];const row=this.db.table('assault_rotation_schedule')[schedule];return row==null?[]:this.parseTags(row.link_extra_tag_id);}
 seasonTag(tag){return this.db.table('extra_tag')[tag]?.type=='DISASTER_SEASON';}
 activeSeasonTags(w=this.stageWT){return this.activeSeasonTagsForStage(w);}
 activeSeasonTagsForStage(w){return this.rotationTags(w?.battle_stage?.assault_rotation_schedule_id).filter(tag=>this.seasonTag(tag));}
 seasonExcluded(tags,active){if(active.length===0)return false;const seasons=tags.filter(tag=>this.seasonTag(tag));if(seasons.length===0)return false;return !seasons.some(tag=>active.includes(tag));}
 sparkAvailable(card){const row=this.db.get('card',card.res_id);if(restrictions.sorts[row.sort]?.includes('RESTRICT_SPARK'))return false;if(['CARD_ABNORM','CARD_CURSE'].includes(row.card_category))return false;const talents=this.e.call('getTalentByInfo',card);if(talents.some(t=>restrictions.talents[talentNames[t]??t]?.includes('RESTRICT_SPARK')))return false;return !talents.some(t=>t==TALENTS.TALENT_REMOVE);}
 rSparkAvailable(card){if(card.support_r_spark)return false;const row=this.db.get('card',card.res_id);return row.battle_r_spark_enable_flag=='YES'?this.sparkAvailable(card):false;}
 pendingSpark(card,w=this.stageWT){if(card.r_spark_candis)return true;return !!w.battle_stage.spark.r_sparks[card.id];}
 sparkNow(card,w=this.stageWT){if(!this.rSparkAvailable(card))return false;if(card.r_spark)return false;if(this.pendingSpark(card,w))return false;return true;}
 repos(w=this.stageWT){if(w.battle_stage.saved_cards==null)throw new MissingBattleRule('input.BattleStageWorktable.saved_cards');return w.battle_stage.saved_cards;}
 clearRepos(type,w=this.stageWT){this.repos(w)[type]=[];}
 saveRepos(type,...cards){const repos=this.repos();repos[type]??=[];repos[type].push(...cards);}
 loadRepos(type,w=this.stageWT){const repos=this.repos(w);repos[type]??=[];return repos[type];}
}
