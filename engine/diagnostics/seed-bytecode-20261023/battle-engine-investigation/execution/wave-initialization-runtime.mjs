// Independent hand port of BattleStateProc.checkNextWave 0x17e00 and
// BattleProc initMonsters 0x4c200. See evidence/wave-init/HANDPORT-SCOPE.md.
// Recovered JavaScript is evidence only and is never executed.
import {MissingBattleRule} from './resource-store.mjs';
import {weightedKey} from '../../reward-investigation/weighted-core.mjs';
import {loadRowsByKey,relativeProbabilityIndex} from '../turn-enemy/monster-pattern-core.mjs';
import {ceilGame,roundGame} from '../effects/effect-arithmetic.mjs';
const SELECT_ACTIONS=['action_card_select','action_card_select_spark','action_card_res_select','action_card_option_select','action_card_r_spark_select','action_battle_event'];
export class WaveInitializationRuntime {
  constructor(e){this.e=e;this.b=e.b;this.w=e.wt;this.db=e.db;}
  call(n,...a){return this.e.call(n,...a);}
  get stage(){return (this.w.battle_stage_worktable??this.e.state.worktables.BattleStageWorktable).battle_stage;}
  get init(){return (this.w.battleInitWorktable??this.e.state.worktables.BattleInitWorktable).battle_init;}
  array(v){return Array.isArray(v)?v:this.db.array(v);}
  optional(t,id){return this.db.table(t)[id];}
  // BattleProc0x5f400/0x60200. Unknown status names retain native default1.
  applyDefaultBuff(types,row,status){for(const type of types){const field={S_ATK:'stat_atk_pct',S_HP:'stat_hp_pct',S_DEF:'stat_def_pct'}[type],pct=field?this.db.number(row,field):1;status.info[type]=this.call('procMathSign','MATHSIGN_MULTIPLY_PCT',status.info[type],pct);}}
  applyGroupDefaultBuff(types,row,status){this.applyDefaultBuff(types,row,status);}
  // 0x4a100. Native splices the chosen slot number, rather than its current
  // candidate-list position, and the last passive replaces the keyword array.
  checkMonsterKeywordNB(infos,passives){if(!passives.length)return;const candidates=[],targets=[];let keywords=[];
    infos.forEach((m,i)=>{if(m.res_id!=='none'&&m.res_id!=='')candidates.push(i);});
    for(const passive of passives){for(let i=0;i<passive.eff_value;i++){if(!candidates.length)break;const slot=this.e.random.randomArrayMember(0,candidates);targets.push(slot);candidates.splice(slot,1);}keywords=this.array(this.db.get('nb_eff',passive.res_id).opt_array_multiple_link);}
    return {nb_eff_keyword_arr:keywords,target_monster_index:targets};
  }
  // 0x4ae00/0x4ba00; MONSTER_CS_TARGET.BOSS='boss' is the literal enum0x18400
  // in attributes/gamecore/battle/continue_skill. Initial pass delays by1.
  applyMonsterStartCSToMonster(monster,delayed){const list=this.init.monster_start_cs;if(!list?.length)return;const row=this.optional('monster',monster.res_id);
    for(const entry of list){if(entry.target==='boss'&&row?.grade!=='GRADE_BOSS')continue;const id=this.call('procAddCS',monster.id,entry.cs_id,entry.value??1,monster.id,false,'MATHSIGN_ADD',false,true,-1,-1,{origin:entry.origin??'BATTLE_START_CS'}),cs=this.b.csMap[id];if(cs&&delayed)cs.delay=1;}
  }
  applyMonsterStartCS(){if(!this.init.monster_start_cs?.length)return;for(const monster of this.b.monsters)this.applyMonsterStartCSToMonster(monster,true);}
  // StageWT0x60400: missing tags read as1. The caller deliberately checks its
  // truthiness, so a stored zero does not replace the newly initialized HP.
  getPersistMonsterInfo(tag){if(!this.stage.persist_monster_info)throw new MissingBattleRule('stage.persist_monster_info');return this.stage.persist_monster_info[tag]??1;}
  // initMonsters0x16265..16811; this follows the difficulty block and therefore
  // also applies at DIFFICULTY_LEVEL.NONE. BOSS_TYPE.LIMITLESS='LIMITLESS'.
  applyBossInitialStats(info){if(this.b.battle_step_mode?.type!=='BATTLE_STEP_BOSS_MODE')return;const row=this.db.get('boss_mode_stage_component',this.stage.step_mode_stage.res_id);
    for(const [stat,key]of [['S_HP','hp'],['S_ATK','atk'],['S_DEF','def']])info[stat]*=(this.array(row['revise_'+key+'_pct']).map(Number)[0]??100)/100;
  }
  getCheatKeywordsForSlot(data,slot){const values=data?.keyword_slots?.[slot];return values?.length>0?values:undefined;}
  getAllCheatKeywords(data){const out=[];if(data?.keyword_slots==null)return out;for(const slot in data.keyword_slots)if(data.keyword_slots[slot]!=null)out.push(...data.keyword_slots[slot]);return out;}
  getKeywordListRowsSorted(){return this.keywordRows??=Object.values(this.db.table('keyword_list')).sort((a,b)=>a.id<b.id?-1:b.id<a.id?1:0);}
  keywordRank(row){return row.keyword_type.includes('UNIQUE')?'UNIQUE':row.keyword_type.includes('SPECIAL')?'SPECIAL':'COMMON';}
  applyKeywordEffect(row,status,csList){const key=row.keyword_opt_multiple_link.replace(/[[\]']/g,'');if(row.keyword_effect_type==='STAT')status.info[key]=this.call('procMathSign',row.mathsign,status.info[key],this.db.number(row,'keyword_tag_ev'));else csList.push([key,this.db.number(row,'keyword_tag_ev')]);}
  applyKeywordPairs(pairs,status,csList){for(const [id]of pairs)this.applyKeywordEffect(this.db.get('keyword_list',id),status,csList);}
  // createMonster0x2065..5433. Precedence: supplied pairs, per-slot cheat,
  // group, single and ordinary common generation. Empty common candidates
  // return the new object before insertion, exactly as native5074/5196 do.
  createMonsterKeywords(monster,row,provided,isCreatureBattleEnd,csList){const status=monster.status,comp=this.optional('stage_component',this.init.stage_id?.toString()),cheat=this.stage.cheat_info?.keyword_group_id,kind=cheat?'group':comp?.keyword_type??'none',tags=kind!=='group'&&comp?this.array(comp.monster_keyword_tag)??[]:[],allowed=this.canApplyKeywordToMonster(row),slot=this.getCheatKeywordsForSlot(this.stage.cheat_info?.keyword,monster.slot_idx),all=this.b.monsters.concat(this.b.retired_monsters),stats=['S_ATK','S_DEF','S_HP'];let group;
    if(kind==='group'||cheat){if(cheat)group=this.optional('keyword_group',cheat);else{const ids=this.array(comp?.monster_keyword_tag);const id=ids.length?this.e.random.randomArrayMember(0,ids):undefined;if(id)group=this.optional('keyword_group',id);}}
    if(allowed&&provided){monster.keywords=provided;this.applyKeywordPairs(provided,status,csList);return false;}
    if(allowed&&this.stage.cheat_info?.keyword?.cheat&&slot?.length){monster.keywords=[];for(const id of slot){const r=this.optional('keyword_list',id);if(!r)continue;const rank=this.keywordRank(r);if(rank==='UNIQUE')this.stage.hasUniqueMonster=true;monster.keywords.push([id,rank]);}const first=this.optional('keyword_list',slot[0]);if(first)this.applyDefaultBuff(stats,first,status);this.applyKeywordPairs(monster.keywords,status,csList);return false;}
    if(allowed&&kind==='group'&&group&&(cheat||row.grade==='GRADE_ELITE')&&!all.some(m=>m.keyword_group_id)&&(cheat||this.init.keyword_tag)){
      monster.keywords=[];monster.keyword_group_id=group.id;for(const id of this.array(group.link_keyword_list_id)){const r=this.optional('keyword_list',id);if(r)monster.keywords.push([id,this.keywordRank(r)]);}this.applyGroupDefaultBuff(stats,group,status);this.applyKeywordPairs(monster.keywords,status,csList);return false;
    }
    if(allowed&&kind==='single'&&tags.length>0&&!all.some(m=>m.keyword_group_id)&&this.init.keyword_tag){const id=this.e.random.randomArrayMember(0,tags),r=this.optional('keyword_list',id);if(r){monster.keywords=[[id,this.keywordRank(r)]];monster.keyword_group_id=id;this.applyDefaultBuff(stats,r,status);this.applyKeywordEffect(r,status,csList);}return false;}
    if(allowed&&!['group','single'].includes(kind)&&(this.init.keyword_tag||this.stage.cheat_info?.keyword?.cheat)){
      monster.keywords=[];
      if(slot?.length)monster.keywords=slot.map(id=>[id,'COMMON']);
      else if(!this.stage.hasUniqueMonster&&isCreatureBattleEnd&&(this.init.keyword_tag||this.stage.cheat_info?.keyword?.cheat)){
        const ban=this.array(row.ban_link_keyword_list_id),pool=this.init.eidolon_keyword_pool,poolSet=pool?.length?new Set(pool):null,rows=this.getKeywordListRowsSorted(),common=rows.filter(r=>(!poolSet||poolSet.has(r.id))&&!ban.includes(r.id)&&r.keyword_type==='COMMON'),disaster=rows.filter(r=>!ban.includes(r.id)&&r.keyword_type==='DISASTER_COMMON'&&tags.includes(r.id));
        // Both unique arrays are constructed in the source but not selected in
        // createMonster; initial-wave unique distribution is a separate path.
        const candidates=tags.length&&!poolSet?disaster:common;if(!candidates.length)return true;
        const index=relativeProbabilityIndex(candidates.map(r=>Number(r.keyword_ratio)),(a,b)=>this.e.random.randRange(0,a,b)),selected=candidates[index];monster.keywords.push([selected.id,'COMMON']);this.applyDefaultBuff(stats,selected,status);
      }
      this.applyKeywordPairs(monster.keywords,status,csList);
    }return false;
  }
  // StageWT0x5d700/0x5e000/0x5ec00 and constructor0x318..650. The data-store
  // cache is a stable group of resource IDs, rebuilt here from its original
  // builder. Unmatched differences leave the percentage map empty (no clamp).
  getFloor(){return this.init.floor;}
  getAddEncounterLevel(){return this.stage.extra_area_info?this.stage.extra_area_info.encounter_lv_add:0;}
  getCurrentEncounterLevel(){const row=this.db.get('floor_set',String(this.stage.floor_set_id)+'_'+String(this.getFloor()));return this.db.number(row,'encounter_level')+this.getAddEncounterLevel();}
  getEncounterStatPct(){const out={};if(this.init.ps_mode||!this.init.from_encounter)return out;
    const battle=this.db.get('battle',this.init.battle_res_id),diff=this.getCurrentEncounterLevel()-battle.encounter_battle_use_level,tier=this.db.get('tier_monster_stat',this.stage.tier_monster_stat_id),group=tier.link_compare_monster_level_stat_group,rows=Object.values(this.db.table('compare_monster_level_stat')).filter(row=>row.group===group);
    if(!rows.length)throw new MissingBattleRule('compare_monster_level_stat_group_not_found',{group});
    for(const row of rows)if(Number(row.encounter_level_compare)==diff)for(const key of ['atk','def','hp'])out[key]=Number(row['stat_'+key+'_pct']);return out;
  }
  // RewardTagFilter0x3c00 + reduce callback0x4700. No cache or candidate
  // synthesis: retain monster/reward order and duplicates. Missing cards have
  // an empty tag array in native, rather than causing a resource exception.
  getMonsterUniqueCards(monsterIds,extraTags,excludeUntagged){const out=[],hasTags=extraTags!=null&&extraTags.length>0;for(const res of monsterIds){if(res==='none'||res==='')continue;const row=this.db.get('monster',res);for(const cardId of this.array(row.reward_link_card_id)){if(cardId==='none'||cardId==='')continue;const card=this.optional('card',cardId),tags=card?this.array(card.link_extra_tag_id):[];if(hasTags&&extraTags){if(!tags.length){if(excludeUntagged)continue;}else if(!tags.some(tag=>extraTags.includes(tag)))continue;}else if(tags.length>0)continue;out.push(cardId);}}return out;}
  // BattleProc0x30b00 complete local constructor.
  createMonster(args){const init=this.init,stage=this.stage,b=this.b,row=this.db.get('monster',args.monster_res_id);
    const status={info:structuredClone(init.monsterStat.info)},v=status.info,m={id:b.last_unit_id++,content_id:args.monster_res_id,res_id:args.monster_res_id,slot_idx:args.coord,status,continueSkill:[],passive:[],state:'none',drop:true,usedCardBattle:{},usedCardPhase:{},currentCard:['',0],previousAttackedby:-1,previousDamageto:-1,previousDamagetoAll:[],previousAttackto:-1,previousAttacktoAll:[],painTurnStart:0,ps:ceilGame(args.ps),ps_offset:args.ps_offset,assault_slot_ps:args.assault_slot_ps};
    const encounter=this.getEncounterStatPct();let hp=this.calcMonStatByContent(v.S_HP,'S_HP')*(1+(encounter.hp??0)/100);if(init.ps_mode){const current=this.optional('powerstep_define',m.ps),base=this.optional('powerstep_define',row.default_powerstep);if(current&&base)hp*=current.hp_revise/base.hp_revise*(m.ps_offset??1);if(init.assault_ps){const r=this.optional('powerstep_define',init.assault_ps);if(r)hp*=r.hp_revise;}if(m.assault_slot_ps){const r=this.optional('powerstep_define',m.assault_slot_ps);if(r)hp*=r.hp_revise;}}
    const min=Number(row.stat_max_hp_pct_min),max=Number(row.stat_max_hp_pct_max),pct=b.battle_step_mode?(min+max)/2:min+this.e.random.nextInt(0)/2147483647*(max-min);v.S_HP=roundGame(hp*pct/100*init.monster_stat_pct/100);if(max===-1&&min)v.S_HP=min;
    v.S_ATK*=Number(row.stat_atk_pct)/100*(1+(encounter.atk??0)/100);v.S_DEF*=Number(row.stat_def_pct)/100*(1+(encounter.def??0)/100);const nerf=this.getMonsterStatNerfPct(row.grade);if(nerf!=null){v.S_HP=roundGame(v.S_HP*nerf/100);v.S_ATK*=nerf/100;v.S_DEF*=nerf/100;}v.S_ATK=this.calcMonStatByContent(v.S_ATK,'S_ATK');v.S_DEF=this.calcMonStatByContent(v.S_DEF,'S_DEF');v.S_CURRENT_SHIELD=0;
    const csList=[];if(this.createMonsterKeywords(m,row,args.keywords,args.isCreatureBattleEnd,csList))return m;
    this.applyDifficulty(v);this.applyBossInitialStats(v);if(this.call('isDTMode'))for(const stat of ['S_HP','S_ATK','S_DEF'])v[stat]*=1.1;
    v.S_HP=ceilGame(v.S_HP);v.S_CURRENT_HP=v.S_HP;if(args.persist_tag&&args.persist_tag!=='none'&&this.getPersistMonsterInfo(args.persist_tag))v.S_CURRENT_HP=ceilGame(v.S_HP*this.getPersistMonsterInfo(args.persist_tag));
    if((args.hpPct??0)>0)v.S_CURRENT_HP=roundGame(v.S_HP*args.hpPct/100);else if(args.originMonster!=null)v.S_CURRENT_HP=roundGame(v.S_HP*args.originMonster.status.info.S_CURRENT_HP/args.originMonster.status.info.S_HP);else v.S_CURRENT_HP=v.S_HP;
    v.S_HP=Math.max(1,v.S_HP);v.S_CURRENT_HP=Math.max(1,v.S_CURRENT_HP);v.S_HP_REGIST=v.S_CURRENT_HP;this.initializeEgoField(m,row);b.monsters.push(m);this.createMonsterCards(m,row);
    const states={GRADE_PROP:'prop',GRADE_PROP_KEEP_HALF_DEATH:'keep_half_death',GRADE_PROP_KEEP_HALF_DEATH_NOTICE:'half_death'};if(states[row.grade])m.state=states[row.grade];else if(args.init_state!=null)m.state=args.init_state;
    for(const [res,value]of csList)if(res!=='')this.call('procAddCS',m.id,res,value,m.id,false,'MATHSIGN_ADD',false,true,m.id,-1,{origin:'MONSTER'});
    for(const res of this.array(row.link_skill_eff_id))if(res&&res!=='none'){const s=this.call('createSkill',res,m.id,{type:'BATTLE_START',id:-1},'VALUE_CATEGORY_NONE','OPERATION_NONE',-1,m.id);this.call('procSkillEff',s.skill_id);}return m;
  }
  // 0x2a300: direct IDs and persisted matches consume no random number. Even
  // one weighted candidate consumes INGAME. The supplied history is read only.
  getMonsterIDfromList(type,id,history,index,ps,persistInfos){
    if(type==='BATTLE_SLOT_TYPE_ID')return {res_id:id,ps,phase:1};
    const r=this.db.get('battle_monster_list',id),ids=this.array(r.link_monster_id),weights=this.array(r.default_ratio).map(Number),revision=this.array(r.revision_ratio).map(Number),phases=this.array(r.monster_phase).map(Number),offsets=this.array(r.ps_offset_value).map(Number);
    const saved=persistInfos?.find(x=>x.slot_idx==index);
    if(saved)return {res_id:saved.res_id,phase:saved.stance,persist_tag:saved.persist_tag,content_id:saved.content_id,ps,ps_offset:offsets[ids.indexOf(saved.res_id)]??1};
    const choices={};
    for(let i=0;i<ids.length;i++){let w=weights[i]||0;const rev=revision[i]||0;if(ids[i] in history&&rev>0){w-=rev*history[ids[i]];if(w<=0)w=1;}choices[i.toString()]=w;}
    const i=Number(weightedKey(choices,(a,b)=>this.e.random.randRange(0,a,b),true,'monsterIDfromGroup:'+id));
    return {res_id:ids[i],phase:phases[i]||1,persist_tag:undefined,ps,ps_offset:offsets[i]??1};
  }
  // 0x17e00. Card repeats suspend before advancing cur or clearing next_wave.
  checkNextWaveActive(){
    const b=this.b,s=b.battle_step_mode,L=this.e.enums.LogicState;if(!s?.next_wave)return false;
    b.forced_turn_over=false;this.call('settleReactions',{interrupts:false});b.current_interrupt.type='NONE';
    for(const block of b.action_blocks)block.actions=block.actions.filter(a=>!SELECT_ACTIONS.includes(a.type));
    if(this.call('procCardRepeats'))return true;
    s.next_wave=false;++s.cur;b.turn_wave_reset=b.turn;
    b.check_timing_all_temp?.forEach(id=>{const skill=b.skillMap[id];if(skill)this.call('afterSkillCSCheck',skill);});b.check_timing_all_temp=undefined;
    const id=s.battle_ids[s.cur],r=this.db.get('battle',id);this.init.battle_res_id=id;
    const ps=s.pss[s.cur]??s.pss[0],assault=this.call('isAssaultMode')?this.db.get('assault_battle',id):undefined,infos=[];
    for(let i=0;;i++){
      const raw=r[`slot${i}_monster_multiple_link`],offset=r[`slot${i}_ps_offset_value`],assaultPs=assault?.[`slot${i}_link_powerstep_define_id`];if(!raw)break;
      if(raw==='none')infos.push({res_id:'none',phase:1,ps,ps_offset:offset==null?1:Number(offset),assault_slot_ps:assaultPs});
      else{const pick=this.getMonsterIDfromList(r[`slot${i}_type`],raw,{},i,ps);infos.push({res_id:pick.res_id,phase:pick.phase??1,ps:pick.ps,ps_offset:(pick.ps_offset??1)*(offset??1),assault_slot_ps:assaultPs});}
    }
    b.monster_res_ids=infos;let force;
    if(s.type==='BATTLE_STEP_WAVE_MODE'&&this.stage.step_mode_stage){const r=this.optional('wave_mode_stage_component',this.stage.step_mode_stage.res_id);if(r&&s.cur+1>=1&&s.cur+1<=5){const keys=r[`battle${s.cur+1}_link_keyword_list_id`];if(keys&&keys!=='none'){const arr=this.array(keys);if(arr.length)force=arr;}}}
    const monsters=this.initMonsters({args_monsterInitInfos:infos,initState:'summoned',isUnlock:true,wave:s.cur,force_keyword:force});
    this.e.ports.pushAction({id:b.last_action_id++,type:'action_monster_wave',source_id:-1,wave_info:id,value:s.cur});
    if([L.TIMING_DRAW_BEFORE,L.Draw,L.TIMING_DRAW_AFTER].includes(b.current_state)){
      this.call('procMonsterUpdate',monsters);
      if(this.w.turn_start_action){const clone=structuredClone(this.w.turn_start_action);this.w.turn_start_action.skip_action=true;clone.value=s.cur;clone.value_temp=s.battle_ids?.length??1;clone.skip_action=false;this.e.ports.pushAction(clone);}
    }
    this.w.turn_start_action=undefined;
    for(const type of ['CONDITION_MONSTER_AMOUNT','CONDITION_MONSTER_AMOUNT_SET','CONDITION_CHAR_FRONT_EMPTY'])this.call('procUnitEvent',type,[]);
    return true;
  }
  canApplyKeywordToMonster(row){return row?.link_model_define_id?.toString()!=='3000267';}
  getMonsterStatNerfPct(grade){return this.init[({GRADE_BOSS:'monster_stat_nerf_pct_b',GRADE_ELITE:'monster_stat_nerf_pct_e',GRADE_NORMAL:'monster_stat_nerf_pct_n'})[grade]];}
  getContentCategoryWithIngameContentConfigId(id){return this.optional('ingame_content_config',id??this.stage.ingame_content_config_id)?.content_category??'CONTENT_NONE';}
  calcMonStatByContent(value,stat){let out=this.call('computeWithZeroEff','ZERO_MONSTER_STAT__SPOT_TYPE_VALUE',value,{stat_type:stat});if(this.stage.assault_hardcore){const p=this.stage[({S_HP:'assault_hardcore_hp_pct',S_ATK:'assault_hardcore_atk_pct',S_DEF:'assault_hardcore_def_pct'})[stat]]??0;if(p!=0)out*=1+p/100;}return out;}
  // 0x2eb00, the earlier matching stage override wins.
  getMonsterEgo(res){
    if(this.init.before_break_in_ego)return this.init.before_break_in_ego;
    const s=this.stage,valid=x=>x&&x!=='none'&&x!=='NONE';let ego;
    if(s.remnants_boss_penalty_info){ego=this.optional('remnants_boss_penalty_list',s.remnants_boss_penalty_info.list_id)?.stage_ego;if(valid(ego))return ego;}
    if(s.hyperspace_info){const r=this.optional('hyperspace_content_list',s.hyperspace_info.hyperspace_content_list_id);ego=r?.[s.hyperspace_info.index==0?'team_1_stage_ego':'team_2_stage_ego'];if(valid(ego))return ego;}
    if(s.tower_info){ego=this.optional('tower_stage_list',s.tower_info.current_stage_res_id)?.stage_ego;if(valid(ego))return ego;}
    if(s.story_simulation_info?.story_map_simulation_id){ego=this.optional('story_map_simulation',s.story_simulation_info.story_map_simulation_id)?.stage_ego;if(valid(ego))return ego;}
    const r=this.db.get('monster',res);if(r.faction_ego==='EGO_NONE')return undefined;
    if(r.faction_ego==='none'){const model=this.db.get('model_define',r.link_model_define_id),species=this.db.get('species',model.link_species_id);return this.db.get('faction',species.link_faction_id).ego_type;}
    return r.faction_ego;
  }
  // 0x4c200 offsets638..918 and1477..2865. Forced keyword lists suppress
  // per-monster random keywords but NOT this earlier category/rank selection.
  // The seven meta values require observed native numeric types. CSV carriers
  // alone cannot establish them; never silently concatenate numeric strings.
  prepareKeywordSelection(args){
    let tag=this.init.keyword_tag,rankRatio=this.init.keyword_rank_ratio;
    const category=this.getContentCategoryWithIngameContentConfigId();
    if(args.isUnlock&&category!=='CONTENT_NONE'&&this.db.get('ingame_content_config',this.stage.ingame_content_config_id).enable_keyword_monster==='SPECIAL'){
      const read=id=>{const value=this.call('constantMetagame',id);if(typeof value!=='number')throw new MissingBattleRule('initMonsters.keyword_constant_native_type',{id,type:typeof value});return value;};
      tag=[read('battle_unique_keyword_ratio'),read('battle_common_keyword_ratio')];rankRatio={};for(const rank of ['a','b','c','d','s'])rankRatio[rank]=read('unique_keyword_rank_'+rank+'_ratio');
    }
    const cheat=this.stage.cheat_info?.keyword,enable=category!=='CONTENT_NONE'?this.db.get('ingame_content_config',this.stage.ingame_content_config_id).enable_keyword_monster:'NONE';
    if(!tag&&!cheat?.cheat){this.stage.hasUniqueMonster=false;return {categoryIndex:-1,uniqueIndex:-1,ranks:[],tag,enable,cheat};}
    const draw=weights=>relativeProbabilityIndex(weights,(a,b)=>this.e.random.randRange(0,a,b));
    let categoryIndex;const weights=[],ranks=[];let uniqueIndex=-1;
    if(cheat?.cheat){rankRatio=cheat.keyword_rank_ratio;categoryIndex=cheat.isUnique!=null?(cheat.isUnique?0:1):draw(cheat.keyword_ratio);this.stage.hasUniqueMonster=categoryIndex===0;}else categoryIndex=draw(tag);
    if(categoryIndex===0){
      for(const info of args.args_monsterInitInfos){
        if(info.res_id==='none'||info.res_id===''){weights.push(0);ranks.push('');continue;}
        const row=this.db.get('monster',info.res_id);if(!this.canApplyKeywordToMonster(row)){weights.push(0);ranks.push('');continue;}
        const rank=row.rank.toLowerCase().replace('rank_','');
        if(!rank||rankRatio==null){weights.push(0);ranks.push('');continue;}
        ranks.push(rank);weights.push(rank in rankRatio?rankRatio[rank]:0);
      }
      if(weights.length){uniqueIndex=draw(weights);const peers=ranks.map((rank,index)=>({rank,index})).filter(x=>x.rank==ranks[uniqueIndex]).map(x=>x.index);if(peers.length>1)uniqueIndex=this.e.random.randomArrayMember(0,peers);}
    }else this.stage.hasUniqueMonster=false;
    // Native normal-unique branch does not set hasUniqueMonster=true here.
    const all=this.getAllCheatKeywords(cheat);if(cheat?.cheat&&all.length)this.stage.hasUniqueMonster=all.some(id=>this.optional('keyword_list',id)?.keyword_type.includes('UNIQUE'));
    return {categoryIndex,uniqueIndex,ranks,tag,enable,cheat};
  }
  // initMonsters2868..5387: choose group/single/boss and nonbattle assignments
  // before any per-monster HP draw. Ordinary UNIQUE selection is separate.
  prepareInitialKeywords(args,selection){const comp=this.optional('stage_component',this.init.stage_id?.toString()),cheatGroup=this.stage.cheat_info?.keyword_group_id,kind=cheatGroup?'group':comp?.keyword_type??'none',tags=kind!=='group'&&comp?this.array(comp.monster_keyword_tag)??[]:[],infos=args.args_monsterInitInfos;
    let group,bossGroup,bossIndex=-1,groupIndex=-1,singleId,singleIndex=-1;
    if(kind==='group'||cheatGroup){if(cheatGroup)group=this.optional('keyword_group',cheatGroup);else{const ids=this.array(comp?.monster_keyword_tag),id=ids.length?this.e.random.randomArrayMember(0,ids):undefined;if(id)group=this.optional('keyword_group',id);}}
    if(this.stage.assault_hardcore&&comp){const id=this.array(comp.boss_link_keyword_group)[this.init.area_id??0];if(id&&id!=='none')bossGroup=this.optional('keyword_group',id);
      const battle=this.optional('battle',this.init.battle_res_id);if(bossGroup&&battle){const hidden=this.array(this.optional('assault_constant_meta','assault_hide_boss_battle_step')?.value);if(this.array(battle.battle_step).some(step=>hidden.includes(step))){const index=this.array(bossGroup.assault_hide_boss_battle).indexOf(this.init.battle_res_id),replacement=this.array(bossGroup.assault_hide_boss_keyword)[index];if(index>=0&&replacement&&replacement!=='none'){const row=this.optional('keyword_group',replacement);if(row)bossGroup=row;}}}
    }
    if(bossGroup)bossIndex=infos.findIndex(info=>info.res_id!=='none'&&info.res_id!==''&&this.optional('monster',info.res_id)?.grade==='GRADE_BOSS');
    const eligible=elite=>infos.map((info,index)=>({row:info.res_id==='none'||info.res_id===''?undefined:this.optional('monster',info.res_id),index})).filter(x=>x.row&&this.canApplyKeywordToMonster(x.row)&&(!elite||x.row.grade==='GRADE_ELITE')).map(x=>x.index);
    if(kind==='group'&&group){const elites=eligible(true);if(elites.length)groupIndex=this.e.random.randomArrayMember(0,elites);else if(cheatGroup){const all=eligible(false);if(all.length)groupIndex=this.e.random.randomArrayMember(0,all);}}
    if(kind==='single'&&tags.length){singleId=this.e.random.randomArrayMember(0,tags);const all=eligible(false);if(all.length)singleIndex=this.e.random.randomArrayMember(0,all);}
    const nonbattle=args.args_passives?.length?this.checkMonsterKeywordNB(infos,args.args_passives):undefined;return {...selection,kind,tags,cheatGroup,group,bossGroup,bossIndex,groupIndex,singleId,singleIndex,nonbattle};
  }
  // initMonsters8460..14411 callbacks51..64. True preserves native early
  // continue: skip insertion, cards, initial skills and output for this slot.
  applyInitialKeywords(monster,row,slot,args,ctx,csList){const stats=['S_ATK','S_DEF','S_HP'],allowed=this.canApplyKeywordToMonster(row),cheatSlot=this.getCheatKeywordsForSlot(ctx.cheat,slot),force=args.force_keyword;
    const group=data=>{monster.keywords=[];monster.keyword_group_id=data.id;for(const id of this.array(data.link_keyword_list_id)){const r=this.optional('keyword_list',id);if(r)monster.keywords.push([id,this.keywordRank(r)]);}this.applyGroupDefaultBuff(stats,data,monster.status);};
    if(allowed&&ctx.cheat?.cheat&&cheatSlot?.length&&!force){monster.keywords=[];for(const id of cheatSlot){const r=this.optional('keyword_list',id);if(r)monster.keywords.push([id,this.keywordRank(r)]);}const first=this.optional('keyword_list',cheatSlot[0]);if(first)this.applyDefaultBuff(stats,first,monster.status);}
    else if(allowed&&ctx.bossGroup&&row.grade==='GRADE_BOSS'&&slot===ctx.bossIndex)group(ctx.bossGroup);
    else if(allowed&&ctx.kind==='group'&&ctx.group&&!force&&slot===ctx.groupIndex&&(ctx.cheatGroup||ctx.tag))group(ctx.group);
    else if(allowed&&ctx.kind==='single'&&ctx.singleId&&!force&&slot===ctx.singleIndex&&ctx.tag){const r=this.optional('keyword_list',ctx.singleId);if(r){monster.keywords=[[ctx.singleId,this.keywordRank(r)]];monster.keyword_group_id=ctx.singleId;this.applyDefaultBuff(stats,r,monster.status);}}
    else if(allowed&&ctx.nonbattle&&!force){monster.keywords=[];if(ctx.nonbattle.target_monster_index.includes(slot)){const id=this.e.random.randomArrayMember(0,ctx.nonbattle.nb_eff_keyword_arr),r=this.db.get('keyword_list',id),rank=r.keyword_type.includes('COMMON')?'COMMON':r.keyword_type.includes('UNIQUE')?'UNIQUE':r.keyword_type.includes('SPECIAL')?'SPECIAL':'COMMON';monster.keywords.push([id,rank]);this.applyDefaultBuff(stats,r,monster.status);}}
    else if(allowed&&!['group','single'].includes(ctx.kind)&&(ctx.tag||ctx.cheat?.cheat)&&!force){monster.keywords=[];const bans=this.array(row.ban_link_keyword_list_id),pool=this.init.eidolon_keyword_pool,poolSet=pool?.length?new Set(pool):null,rows=this.getKeywordListRowsSorted(),common=rows.filter(r=>(!poolSet||poolSet.has(r.id))&&!bans.includes(r.id)&&r.keyword_type==='COMMON'),unique=rows.filter(r=>(!poolSet||poolSet.has(r.id))&&!bans.includes(r.id)&&r.keyword_type==='UNIQUE'),disasterCommon=rows.filter(r=>!bans.includes(r.id)&&r.keyword_type==='DISASTER_COMMON'&&ctx.tags.includes(r.id)),disasterUnique=rows.filter(r=>!bans.includes(r.id)&&r.keyword_type==='DISASTER_UNIQUE'&&ctx.tags.includes(r.id));
      if(ctx.cheat?.cheat){if(!common.length&&unique.length){ctx.categoryIndex=0;ctx.uniqueIndex=slot;}else if(common.length&&!unique.length)ctx.categoryIndex=1;}
      if(this.getAllCheatKeywords(ctx.cheat).length){if(cheatSlot?.length){const types=cheatSlot.map(id=>this.optional('keyword_list',id)?.keyword_type).filter(type=>type!=null),rank={COMMON:'COMMON',UNIQUE:'UNIQUE',SPECIAL:'SPECIAL'}[types[0]];monster.keywords=cheatSlot.map(id=>[id,rank]);this.applyDefaultBuff(stats,this.db.get('keyword_list',cheatSlot[0]),monster.status);}}
      else if(ctx.enable==='SPECIAL'){if(row.special_link_keyword_list_id!=='none'){const r=this.db.get('keyword_list',row.special_link_keyword_list_id);monster.keywords.push([r.id,'SPECIAL']);this.applyDefaultBuff(stats,r,monster.status);}}
      else{let selected,rank=ctx.categoryIndex===0?'UNIQUE':'COMMON';const disaster=ctx.tags.length&&!poolSet;
        if(ctx.categoryIndex===0){if(slot===ctx.uniqueIndex){let candidates=disaster?disasterUnique:unique;if(!candidates.length){candidates=disaster?disasterCommon:common;if(!candidates.length)return true;selected=this.selectKeyword(candidates);if(selected.keyword_type===(disaster?'DISASTER_COMMON':'COMMON'))rank='COMMON';}else selected=this.selectKeyword(candidates);}}
        else{let candidates=disaster?disasterCommon:common;if(!candidates.length){if(ctx.uniqueIndex!==-1)return true;candidates=disaster?disasterUnique:unique;if(!candidates.length)return true;selected=this.selectKeyword(candidates);if(selected.keyword_type===(disaster?'DISASTER_UNIQUE':'UNIQUE'))rank='UNIQUE';}else selected=this.selectKeyword(candidates);}
        if(selected){monster.keywords.push([selected.id,rank]);if(rank==='UNIQUE')this.stage.hasUniqueMonster=true;this.applyDefaultBuff(stats,selected,monster.status);}
      }
    }
    if(allowed&&force){monster.keywords??=[];const id=Array.isArray(force)?force[slot]:force;if(id&&id!==''){const r=this.optional('keyword_list',id);if(r){monster.keywords.push([r.id,'SPECIAL']);this.applyDefaultBuff(stats,r,monster.status);}}}
    if(monster.keywords)this.applyKeywordPairs(monster.keywords,monster.status,csList);return false;
  }
  selectKeyword(rows){return rows[relativeProbabilityIndex(rows.map(row=>this.db.number(row,'keyword_ratio')),(a,b)=>this.e.random.randRange(0,a,b))];}
  applyDifficulty(info){
    const s=this.stage,step=this.b.battle_step_mode,levels=this.e.enums.DIFFICULTY_LEVEL;
    if(levels?.NONE===undefined)throw new MissingBattleRule('DIFFICULTY_LEVEL.NONE');
    if(s.difficulty_level===levels.NONE)return;
    const mapping=this.e.enums.DIFFICULTY_LEVEL_NUM;if(!mapping||mapping[s.difficulty_level]===undefined)throw new MissingBattleRule('DIFFICULTY_LEVEL_NUM',{level:s.difficulty_level});
    const row=this.db.get('world_level_battle_stat_revise',mapping[s.difficulty_level]);
    let type=this.db.get('battle',this.init.battle_res_id).battle_type.split('_')[2].toLowerCase();
    if(step?.type==='BATTLE_STEP_WAVE_MODE')type=this.optional('battle',step.battle_ids[step.cur])?.battle_type.split('_')[2].toLowerCase()??type;
    if(type==='battle')type='normal';
    for(const [stat,key]of [['S_ATK','atk'],['S_DEF','def'],['S_HP','hp']])info[stat]*=isNaN(row[`${type}_${key}`])?1:Number(row[`${type}_${key}`]);
    if(step?.type==='BATTLE_STEP_WAVE_MODE'&&s.step_mode_stage){const r=this.db.get('wave_mode_stage_component',s.step_mode_stage.res_id);for(const [stat,key]of [['S_HP','hp'],['S_ATK','atk'],['S_DEF','def']])info[stat]*=(this.array(r[`revise_${key}_pct`]).map(Number)[step.cur]??100)/100;}
  }
  initializeEgoField(monster,row){
    const ego=this.getMonsterEgo(monster.res_id),hasEgo=ego!=null&&ego!=='NONE',base=Number(row.ego_field_value);
    if(!hasEgo&&!base)return;
    if(base){
      monster.ego_field_max_value=Math.min(1000,base);
      const ps=this.call('getPassiveByType',{source_id:this.b.char.id,type:'SKILL_EFF_BATTLE_MONSTER_EGO_FIELD'});
      if(ps.length){for(const p of ps)monster.ego_field_max_value=this.call('procMathSign',this.db.get('skill_eff',p.res_id).eff_value_math_sign,monster.ego_field_max_value,this.call('calcValue',p.skill_id));monster.ego_field_max_value=ceilGame(monster.ego_field_max_value);}
      if(this.stage.assault_hardcore){const n=Number(this.optional('assault_constant_meta','hardcore_add_ego')?.value??0);if(n>0)monster.ego_field_max_value=(monster.ego_field_max_value??0)+n;}
      monster.ego_field_value=monster.ego_field_max_value;
      const ps2=this.call('getPassiveByTypeGamecore','EFF_BATTLE_MONSTER_EGO_FIELD_PCT_SUBTRACT');
      if(ps2.length){monster.ego_field_value*=(100-ps2.reduce((n,p)=>n+p.eff_value,0))/100;monster.ego_field_value=roundGame(monster.ego_field_value*12)/12;}
    }
    monster.ego_field_egos=hasEgo?[this.call('convertEgoCommon',ego)]:[];
  }
  createMonsterCards(monster,row,initial=false){
    const create=(res,options)=>{const info=this.call('makeCardInfo',this.b.last_unit_id++,res,monster.id);this.b.monsterCards[monster.id+res]=this.call('createBattleCard',info,options).id;};
    for(const phase of loadRowsByKey(this.db.table('monster_pattern_set'),row.link_monster_pattern_set_key)){
      const id=phase.phase_link_monster_pattern_id;if(id==='none')continue;const r=this.db.get('monster_pattern',id);
      if(r.start_link_monster_card_id!=='none')create(r.start_link_monster_card_id,{isStart:true});
      for(const c of loadRowsByKey(this.db.table('monster_pattern_card'),initial?id:r.link_monster_pattern_card_key)){if(c.card_link_monster_card_id!=='none')create(c.card_link_monster_card_id,undefined);if(c.extra_card_link_monster_card_id&&c.extra_card_link_monster_card_id!=='none')create(c.extra_card_link_monster_card_id,undefined);}
    }
  }
  // MonsterPhase constructor 0xdf00 + field initializer0x14b00. Pattern
  // creation and its initial action/conditions run BEFORE phase conditions.
  createMonsterPhase({monster,phase=1}){
    const row=this.db.get('monster',monster.res_id);let selected;
    for(const entry of loadRowsByKey(this.db.table('monster_pattern_set'),row.link_monster_pattern_set_key))if(entry.phase==phase)selected=entry;
    if(!selected)throw new MissingBattleRule('createMonsterPhase.pattern_set_not_found',{monster:monster.res_id,phase});
    const result={stacks:[],current_phase:phase,mon_res_id:monster.res_id,mon_id:monster.id,next_phase:undefined,next_phase_ratio:undefined};
    this.b.monsterPhase[monster.id]=result;this.call('createMonsterPattern',selected.phase_link_monster_pattern_id,monster);
    result.next_phase=[];result.next_phase_ratio=[];
    for(let i=0;;i++){
      const next=selected['phase_change_phase_'+i];if(next==null)break;result.next_phase.push(this.array(next.toString()).map(Number));
      const ratio=selected['phase_change_phase_ratio_'+i];if(ratio==null)throw new MissingBattleRule('createMonsterPhase.phase_change_ratio_not_exist',{monster:monster.res_id,index:i});result.next_phase_ratio.push(this.array(ratio.toString()).map(Number));
      const condition=selected['phase_change_'+i+'_link_condition_id'];if(condition==null)throw new MissingBattleRule('createMonsterPhase.phase_change_condition_not_exist',{monster:monster.res_id,index:i});
      if(condition!=='none')result.stacks.push(this.call('getEventStack',{res_id:condition,from:'MONSTER',parent_id:monster.id,use:'INDEX',remove:'REMOVE',caster_id:monster.id,owner_id:monster.id,index:i}));
    }
    return result;
  }
  initMonsters(args){
    const b=this.b,init=this.init,stage=this.stage,out=[];
    for(const key in b.monsterPhase)b.monsterPhase[key].stacks.forEach(stack=>this.call('procRemoveStack',stack));b.monsterPhase={};
    const old=b.monsterInfos?.slice();
    const encounter=this.getEncounterStatPct();
    const keywords=this.prepareInitialKeywords(args,this.prepareKeywordSelection(args));
    let touched=false;
    for(let slot=0;slot<args.args_monsterInitInfos.length;slot++){
      const input=args.args_monsterInitInfos[slot],id=input.res_id;if(id==='none'||id==='')continue;
      const r=this.db.get('monster',id),saved=old?.find(x=>x.res_id==id&&x.slot_idx==slot);if(old&&(!saved||saved.death))continue;
      const status={info:structuredClone(init.monsterStat.info)},v=status.info,m={id:b.last_unit_id++,res_id:id,slot_idx:slot,status,continueSkill:[],passive:[],state:'none',drop:true,coord_dx:saved?.coord_dx??undefined,content_id:saved?.content_id??id??'',scale:saved?.scale,usedCardBattle:{},usedCardPhase:{},currentCard:['',0],start_phase:input.phase,persist_tag:input.persist_tag,ps:ceilGame(input.ps),ps_offset:input.ps_offset,assault_slot_ps:input.assault_slot_ps,wave:args.wave};
      let hp=this.calcMonStatByContent(v.S_HP,'S_HP')*(1+(encounter.hp??0)/100);
      if(init.ps_mode){const cur=this.optional('powerstep_define',m.ps),base=this.optional('powerstep_define',r.default_powerstep);if(cur&&base){let factor=cur.hp_revise/base.hp_revise;if(m.ps_offset!=null)factor*=m.ps_offset;hp*=factor;}if(init.assault_ps){const p=this.optional('powerstep_define',init.assault_ps);if(p)hp*=p.hp_revise;}if(m.assault_slot_ps){const p=this.optional('powerstep_define',m.assault_slot_ps);if(p)hp*=p.hp_revise;}}
      const min=Number(r.stat_max_hp_pct_min),max=Number(r.stat_max_hp_pct_max),pct=b.battle_step_mode?(min+max)/2:min+this.e.random.nextInt(0)/2147483647*(max-min);
      v.S_HP=roundGame(hp*pct/100*init.monster_stat_pct/100);const fixed=max===-1?min:undefined;if(fixed)v.S_HP=fixed;
      v.S_CURRENT_SHIELD=0;v.S_ATK*=Number(r.stat_atk_pct)/100*(1+(encounter.atk??0)/100);v.S_DEF*=Number(r.stat_def_pct)/100*(1+(encounter.def??0)/100);
      const nerf=this.getMonsterStatNerfPct(r.grade);if(nerf!=null){v.S_HP=roundGame(v.S_HP*nerf/100);v.S_ATK*=nerf/100;v.S_DEF*=nerf/100;}
      v.S_ATK=this.calcMonStatByContent(v.S_ATK,'S_ATK');v.S_DEF=this.calcMonStatByContent(v.S_DEF,'S_DEF');
      const csList=[];if(this.applyInitialKeywords(m,r,slot,args,keywords,csList))continue;
      this.applyDifficulty(v);
      this.applyBossInitialStats(v);
      if(this.call('isDTMode'))for(const key of ['S_HP','S_ATK','S_DEF'])v[key]*=1.1;
      v.S_HP=ceilGame(v.S_HP);v.S_CURRENT_HP=v.S_HP;
      if(input.persist_tag&&input.persist_tag!=='none'&&this.getPersistMonsterInfo(input.persist_tag))v.S_CURRENT_HP=ceilGame(v.S_HP*this.getPersistMonsterInfo(input.persist_tag));
      if(stage.zero_force_set_monster_hp_1!=null&&stage.zero_force_set_monster_hp_1>0&&!init.is_npc_attack){v.S_HP=v.S_CURRENT_HP=1;touched=true;}
      if(b.battle_step_mode?.type==='BATTLE_STEP_BOSS_MODE'){const row=this.db.get('boss_mode_stage_component',stage.step_mode_stage.res_id);if(m.res_id==row.target_link_monster_id&&row.boss_type==='LIMITLESS')m.is_limitless=true;}
      v.S_HP=Math.max(1,v.S_HP);v.S_CURRENT_HP=Math.max(1,v.S_CURRENT_HP);v.S_HP_REGIST=v.S_CURRENT_HP;
      m.content_id=input.content_id??id;b.monsters.push(m);this.initializeEgoField(m,r);
      if(saved){m.start_phase=saved.stance;m.pos=saved.pos;m.coord_dx=saved.coord_dx;m.content_id=saved.content_id;}
      if(b.battle_step_mode?.type==='BATTLE_STEP_BOSS_MODE'){const boss=this.db.get('boss_mode_stage_component',stage.step_mode_stage.res_id);if(m.res_id==boss.target_link_monster_id)m.start_phase=this.db.number(this.db.get('monster_pattern_set',boss.step0_link_monster_pattern_set_id),'phase');}
      this.createMonsterCards(m,r,true);
      const states={GRADE_PROP:'prop',GRADE_PROP_KEEP_HALF_DEATH:'keep_half_death',GRADE_PROP_KEEP_HALF_DEATH_NOTICE:'half_death'};if(states[r.grade])m.state=states[r.grade];if(args.initState)m.state=args.initState;
      for(const [res,value]of csList)if(res!=='')this.call('procAddCS',m.id,res,value,m.id,false,'MATHSIGN_ADD',false,true,m.id,-1,{origin:'MONSTER'});
      for(const res of this.array(r.link_skill_eff_id))if(res&&res!=='none'){const skill=this.call('createSkill',res,m.id,{type:'BATTLE_START',id:-1},'VALUE_CATEGORY_NONE','OPERATION_NONE',-1,m.id);this.call('procSkillEff',skill.skill_id);}
      out.push(m);
    }
    if(touched&&stage&&stage.zero_force_set_monster_hp_1)--stage.zero_force_set_monster_hp_1;
    return out;
  }
}
