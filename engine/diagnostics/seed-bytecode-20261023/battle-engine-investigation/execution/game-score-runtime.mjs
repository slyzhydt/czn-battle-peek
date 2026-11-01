// Handwritten BattleStageWorktable scoring family. Source:
// evidence/hp-support/stage, bytecode 0x6d000..0x74b00.
import {floorGame} from '../effects/effect-arithmetic.mjs';
import {MissingBattleRule} from './resource-store.mjs';
export class GameScoreRuntime {
  constructor(e){this.e=e;this.b=e.b;}
  get stage(){const s=this.e.state?.worktables?.BattleStageWorktable?.battle_stage;if(!s)throw new MissingBattleRule('BattleStageWorktable.battle_stage');return s;}
  // Retained GameResDB.get call, e.g. addRemnantsScore @60..83. This is a
  // keyed lookup; an unobserved full-table enumeration is not required.
  row(table,id){return this.e.db.get(table,id);}
  calculateScoreScaling(id,prior,value,capMultiplier=1){
    const r=this.row('rank_buff_eff',id);if(!r)return value;
    const inflection=Number(r.score_inflection??0),rawCap=Number(r.score_cap??0),curve=Number(r.curve_factor??1),convergence=Number(r.convergence_rate??1);
    if(inflection<=0||rawCap<=0)return value;const cap=rawCap*capMultiplier;
    const scaled=total=>{if(total<inflection)return total;const above=total-inflection,range=cap-inflection;if(above<=0||range<=0)return total;
      const ratio=above/range,denominator=ratio*curve*convergence+1,fraction=1-1/Math.pow(denominator,1/curve);return inflection+range*fraction;};
    const before=scaled(prior),after=scaled(prior+value);return Math.max(0,floorGame(after)-floorGame(before));
  }
  applyDisasterScoreScaling(value){
    const s=this.stage.disaster_boss_rank_info;if(!s||s.stage_index!=2||!s.rank_buff_eff_id)return value;
    const r=this.row('rank_buff_eff',s.rank_buff_eff_id);if(!r)return value;
    const key='score_cap_turn_bonus_'+s.step1_turn;let multiplier=1;
    if(r[key]!==undefined)multiplier=Number(r[key]);else{let greatest=0;for(const k in r)if(k.startsWith('score_cap_turn_bonus_')){const n=Number(k.replace('score_cap_turn_bonus_',''));if(!isNaN(n)&&n<=s.step1_turn&&n>greatest)greatest=n;}
      if(greatest>0)multiplier=Number(r['score_cap_turn_bonus_'+greatest]);}
    return this.calculateScoreScaling(s.rank_buff_eff_id,s.damage_score_team2,value,multiplier);
  }
  applyRemnantsScoreScaling(value){const s=this.stage.remnants_boss_penalty_info;return !s||!s.rank_buff_eff_id?value:this.calculateScoreScaling(s.rank_buff_eff_id,s.damage_score,value);}
  cappedCard(cardId,value,cap){if(cap<0)return value;const map=this.b.cardUseScoreAccum??={},previous=map[cardId]??0,remaining=cap-previous;if(remaining<=0)return 0;const applied=Math.min(value,remaining);map[cardId]=previous+applied;return applied;}
  applyDisasterPerCardScoreCap(cardId,value){const s=this.stage.disaster_boss_rank_info;if(!s)return value;const r=this.row('disaster_boss_rank_list',s.rank_list_id);if(!r)return value;
    const define=this.row('disaster_boss_rank_define',r.link_disaster_boss_rank_define_id),cap=Number(define?.['rank_max_damageforscore_'+(r.level??0)]??-1);return this.cappedCard(cardId,value,cap);}
  applyRemnantsPerCardScoreCap(cardId,value){const s=this.stage.remnants_boss_penalty_info;if(!s)return value;const r=this.row('remnants_boss_penalty_list',s.list_id);return this.cappedCard(cardId,value,Number(r?.rank_max_damageforscore??-1));}
  addDisasterScore(value){
    const s=this.stage.disaster_boss_rank_info;if(!s)return;const factor=s.difficulty_bonus,scaled=this.applyDisasterScoreScaling(value);let applied=scaled;
    if(s.stage_index==1){const r=this.row('disaster_boss_rank_list',s.rank_list_id),level=r?.level??0,define=this.row('disaster_boss_rank_define',r.link_disaster_boss_rank_define_id),cap=Number(define?.['phase_1_score_max_'+level]??-1);
      if(cap>=0){const remaining=cap-(s.score-s.bonus_score);if(remaining<=0)applied=0;else if(scaled>remaining)applied=remaining;}}
    const previous=s.score-s.bonus_score-s.heal_score-s.shield_score-s.score_add_bonus,bonus=floorGame((previous+applied)*factor)-floorGame(previous*factor);
    s.damage_score+=value;if(s.stage_index==2)s.damage_score_team2+=value;s.bonus_score+=bonus;s.score+=applied+bonus;return {damage_score:applied,bonus};
  }
  addDisasterShieldScore(value,perfect){
    const s=this.stage.disaster_boss_rank_info;if(!s||s.stage_index!=2||!s.rank_buff_eff_id)return;const r=this.row('rank_buff_eff',s.rank_buff_eff_id);if(!r)return;
    const revise=Number(r.shield_score_revise??0),perfectRevise=Number(r.perfect_shield_score_revise??0);if(revise<=0)return;
    const applied=perfect&&perfectRevise>0?floorGame(value*revise*perfectRevise):floorGame(value*revise),bonus=floorGame(applied*s.difficulty_bonus);
    s.shield_score+=applied;s.bonus_score+=bonus;s.score+=applied+bonus;return {shield_score:applied,bonus};
  }
  addDisasterHealScore(value){
    const s=this.stage.disaster_boss_rank_info;if(!s||s.stage_index!=2||!s.rank_buff_eff_id)return;const r=this.row('rank_buff_eff',s.rank_buff_eff_id);if(!r)return;
    const revise=Number(r.heal_score_revise??0);if(revise<=0)return;const applied=floorGame(value*revise),bonus=floorGame(applied*s.difficulty_bonus);
    s.heal_score+=applied;s.bonus_score+=bonus;s.score+=applied+bonus;return {heal_score:applied,bonus};
  }
  addRemnantsScore(value){
    const s=this.stage.remnants_boss_penalty_info;if(!s)return;const scaled=this.applyRemnantsScoreScaling(value),factor=s.difficulty_bonus,previous=s.score-s.bonus_score-s.score_add_bonus;
    const r=this.row('remnants_boss_penalty_list',s.list_id),cap=Number(r?.battle_score_max??0),limited=cap>0,remaining=limited?Math.max(0,cap-(s.score-s.score_add_bonus)):0;
    const applied=limited?Math.min(scaled,remaining):scaled;let bonus=floorGame((previous+applied)*factor)-floorGame(previous*factor);if(limited)bonus=Math.min(bonus,remaining-applied);
    s.damage_score+=value;s.bonus_score+=bonus;s.score+=applied+bonus;return applied+bonus;
  }
  addDisasterScoreBonus(value){const s=this.stage.disaster_boss_rank_info;if(!s)return;s.score_add_bonus+=value;s.score+=value;return value;}
  addRemnantsScoreBonus(value){const s=this.stage.remnants_boss_penalty_info;if(!s)return;s.score_add_bonus+=value;s.score+=value;return value;}
}
