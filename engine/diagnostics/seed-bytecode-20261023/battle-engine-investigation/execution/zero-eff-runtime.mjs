// Hand ports of ZeroSystemProcGamecore combat consumers. Unrelated map/shop
// computations remain explicit boundaries rather than guessed formulas.
// Evidence: evidence/zero-eff; computeWithZeroEff 0x5100 -> getComputeResult
// 0x1ab00 -> getMultiAbleComputeResult 0x15300 -> getComputeValue 0x19700 ->
// getMultiAbleComputeValue 0x6600 offsets17733..18266. No target code execution.
import {MissingBattleRule} from './resource-store.mjs';
import {floorGame,ceilGame} from '../effects/effect-arithmetic.mjs';
export class ZeroEffRuntime {
  constructor(e){this.e=e;this.db=e.db;}
  get stage(){const s=this.e.state?.worktables?.BattleStageWorktable?.battle_stage;if(!s)throw new MissingBattleRule('BattleStageWorktable.battle_stage');return s;}
  // 0x3600 + callback0x4200: validate every entry in the requested bucket,
  // including resource entries whose declared zero_eff is later filtered out.
  getFilteredZeroSystemInfoArray(effect,stageWT){
    const stage=stageWT===undefined?this.stage:stageWT.battle_stage;
    const map=stage.zero_system_effs;if(map==null)throw new MissingBattleRule('zeroEff.zero_system_effs');
    const list=map[effect];if(list==null)return[];
    if(!Array.isArray(list))throw new MissingBattleRule('zeroEff.effect_bucket',{effect});
    return list.filter(info=>{if(info?.zero_system_eff_id==null)throw new MissingBattleRule('zeroEff.zero_system_eff_id',{effect});return this.db.get('zero_system_eff',info.zero_system_eff_id).zero_eff===effect;});
  }
  computeWithZeroEff(effect,origin,options,stageWT){
    const infos=this.getFilteredZeroSystemInfoArray(effect,stageWT);if(infos.length===0)return origin;
    // Explicit foreign StageWT keeps its own native battle_worktable link.
    // Current-stage calls retain the captured split-root adapter; no foreign
    // stage silently borrows this executor's BattleInitWorktable.
    const current=this.e.state?.worktables?.BattleStageWorktable;
    options??={};const init=stageWT===undefined||stageWT===current?this.e.state?.worktables?.BattleInitWorktable?.battle_init:stageWT?.battle_worktable?.battleInitWorktable?.battle_init;
    if(!init)throw new MissingBattleRule('BattleInitWorktable.battle_init');
    // Native mutates the caller's options only on the nonempty path, even
    // though the awake-rate branch does not use the current spot afterwards.
    options.curr_spot_type=init.spot_type;
    if(effect==='ZERO_SET_LEVEL__VALUE'){
      if(infos.length>1)throw new MissingBattleRule('zeroEff.too_many_single_infos',{effect});
      const value=infos[0].opt_values?.opt_1;
      if(infos[0].opt_values==null)throw new MissingBattleRule('zeroEff.opt_values_missing',{id:infos[0].zero_system_eff_id});
      if(value==null||isNaN(value))throw new MissingBattleRule('zeroEff.opt_1_undefined',{id:infos[0].zero_system_eff_id});
      return value>origin?ceilGame(value):value<origin?floorGame(value):value;
    }
    if(['INCREASE_EXTRA_REWARD_CARD_PROP__ID_RATIO','INCREASE_EXTRA_REWARD_EQUIP_PROP__ID_RATIO','INCREASE_EXTRA_REWARD_FATE_PROP__ID_RATIO'].includes(effect))return this.extraReward(infos,origin,options);
    if(effect==='ZERO_MONSTER_STAT__SPOT_TYPE_VALUE')return this.computeMonsterStat(infos,origin,options);
    if(effect!=='ZERO_C_AWAKE_RATEUP__COUNT')throw new MissingBattleRule('zeroEff.computeWithZeroEff:'+effect);
    let rate=0;
    for(const info of infos){const row=this.db.get('zero_system_eff',info.zero_system_eff_id),value=this.db.array(row.opt_1).map(Number)[0];
      // Original tests truthiness before isNaN: zero and absent are content
      // errors; negative and fractional values remain legal. Do not clamp.
      if(!value||isNaN(value))throw new MissingBattleRule('zeroEff.rate_undefined',{id:info.zero_system_eff_id});
      rate+=value;
    }
    // This effect is multi-eligible (not in 0x1a200 single-effect list), and
    // has is_integer=false: no final integer rounding or percent multiplier.
    return origin+rate;
  }
  // getSingleComputeValue0x16100 @363..631 and result0x1ab00 @523:
  // opt_values is required even though this branch reads its ratio from row.
  extraReward(infos,origin,options){if(infos.length>1)throw new MissingBattleRule('zeroEff.too_many_single_infos');const info=infos[0],id=info.zero_system_eff_id;if(info.opt_values==null)throw new MissingBattleRule('zeroEff.opt_values_missing',{id});const row=this.db.get('zero_system_eff',id),wanted=this.db.array(row.opt_1_multiple_link)[0];if(wanted==null)throw new MissingBattleRule('zeroEff.opt_1_undefined',{id});let prob=options.extra_reward_prob_id;if(info.desc_options?.extra_reward_prob_id!=null)prob=info.desc_options.extra_reward_prob_id;const value=this.db.array(row.opt_2).map(Number)[0];if(value==null||isNaN(value))throw new MissingBattleRule('zeroEff.opt_2_undefined',{id});const found=this.db.table('extra_reward_prob')[prob];return origin+(prob!=null&&found&&prob==wanted?value:0);}
  // getMultiAbleComputeValue 0x6600 @11207..12576, then
  // getMultiAbleComputeResult 0x15300 @592..627. First matching row wins;
  // description overrides persist to later rows exactly as source locals do.
  computeMonsterStat(infos,origin,options){
    let stat=options.stat_type,spot=options.curr_spot_type,pct=0;
    const spotNames={SPOT_TYPE_BATTLE:'normal',SPOT_TYPE_ELITE:'elite',SPOT_TYPE_BOSS:'boss',SPOT_TYPE_UNKNOWN:'encounter'};
    const fail=(name,id)=>{throw new MissingBattleRule('zeroEff.'+name,{id});};
    for(const info of infos){
      const id=info.zero_system_eff_id,row=this.db.get('zero_system_eff',id),values=info.opt_values;
      if(values==null)fail('opt_values_missing',id);
      if(info.desc_options?.curr_spot_type!=null)spot=info.desc_options.curr_spot_type;
      if(spot==null||spotNames[spot]==null)fail('spot_type_undefined',id);
      const spots=this.db.array(row.opt_1);if(spots.length===0)fail('opt_1_length_zero',id);
      if(!spots.includes(spotNames[spot]))continue;
      const stats=this.db.array(row.opt_2_multiple_link);if(stats.length===0)fail('opt_2_length_zero',id);
      if(info.desc_options?.stat_type!=null)stat=info.desc_options.stat_type;
      if(stat==null)fail('stat_type_undefined',id);
      if(!stats.includes(stat))continue;
      pct=values.opt_3;if(pct==null||isNaN(pct))fail('opt_3_undefined',id);
      pct=Math.max(-100,pct);break;
    }
    // Native is_integer=false; preserve fractional stats here.
    return Math.max(0,origin*(1+pct*.01));
  }
}
