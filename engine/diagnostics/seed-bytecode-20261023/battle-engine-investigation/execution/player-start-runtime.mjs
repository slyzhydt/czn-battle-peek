// Independent hand ports, evidence/player-{refresh,start,stage-passive,start-ego}.
// No recovered function is executed. Optional unsupported paths remain ports.
import {MissingBattleRule} from './resource-store.mjs';
const fixed2=value=>Number((value+1e-8).toFixed(2));
export class PlayerStartRuntime {
  constructor(e){this.e=e;this.b=e.b;this.w=e.wt;this.db=e.db;}
  call(n,...a){return this.e.call(n,...a);}
  get stage(){return this.w.battle_stage_worktable??this.e.state.worktables.BattleStageWorktable;}
  get init(){return (this.w.battleInitWorktable??this.e.state.worktables.BattleInitWorktable).battle_init;}
  // Retained battle_turns_cache.js 0x2700 is a literal false client stub.
  shouldRecordTurnInStage(){return false;}
  // WT useEP 0x10e300. A zero delta emits neither the gauge action nor event.
  useEP(amount,source){
    const old=this.b.ep;this.b.ep=Math.max(0,this.b.ep-amount);if(this.b.ep-old==0)return;
    this.e.pushAction({id:this.b.last_action_id++,type:'action_tactic_gauge',source_id:source,value:this.b.ep});
    this.call('procUnitEvent','CONDITION_EP_AMOUNT',[this.b.char.id]);
  }
  // 0x26800: these are the exact early exits, before custom/mode checks or RNG.
  // The retained real hyperspace snapshot has enable_stress_turn='NO'.
  procTurnStartStressAction(){
    if(this.stage.battle_stage.cheat_info.battle_stress_off==true||this.init.battle_stress_off==true)return;
    if(this.w.test||this.w.isPreview)return;
    if(!this.stage)return;
    const config=this.db.get('ingame_content_config',this.stage.battle_stage.ingame_content_config_id);
    if(config.enable_stress_turn!=='YES')return;
    const turn=this.getCustomStressVal('CUSTOM_TURN_STRESS_VAL'),mon=this.getCustomStressVal('CUSTOM_MON_STRESS_VAL');
    if(turn.length||mon.length)return;
    return this.procTurnStartStressActionActive();
  }
  // StressProc 0x26800 and callbacks 0x29d00..0x2de00. The first
  // applicable mode owns the stress switch; later modes do not override it.
  procTurnStartStressActionActive(){
    const s=this.stage.battle_stage,b=this.b;
    let mode;
    for(const [field,table,key]of [['disaster_boss_penalty_info','disaster_boss_penalty_list','penalty_list_id'],['disaster_boss_rank_info','disaster_boss_rank_list','rank_list_id'],['remnants_boss_penalty_info','remnants_boss_penalty_list','list_id'],['hyperspace_info','hyperspace_content_list','hyperspace_content_list_id'],['tower_info','tower_stage_list','current_stage_res_id']]){
      if(!s[field])continue;mode={row:table==='tower_stage_list'?this.db.table(table)[s[field][key]]:this.db.get(table,s[field][key])};break;
    }
    if(!mode&&s.simulation_content_info&&!this.call('isStory')&&['BATTLE_STEP_WAVE_MODE','BATTLE_STEP_BOSS_MODE'].includes(b.battle_step_mode?.type))mode={row:this.db.get('simulation_content_list',s.simulation_content_info.simulation_content_list_id)};
    if(mode?.row&&!Number(mode.row.turn_start_stress))return;
    const turn=b.turn-(b.turn_wave_reset??0),table=this.db.table('stress_battle'),rows=[];
    const first=table['turn_'+turn+'_1']??table.turn_0_1,single=first?.member==-1;
    for(let i=1;i<=3;i++){const row=table['turn_'+turn+'_'+i]??table['turn_0_'+i];if(row)rows.push(row);}if(rows.length===0)return;
    const stageChar=id=>s.chars.find(c=>c.id==id);
    const candidates=b.chars.filter(c=>c.res_id>0&&c.opacity!=0&&stageChar(c.id)&&!stageChar(c.id).collapse_on);if(!candidates.length)return;
    this.call('shuffleInPlace',0,candidates);candidates.sort((a,c)=>-(stageChar(a.id)?.ego_stress??0)+(stageChar(c.id)?.ego_stress??0));
    let selected;
    if(single){const pct=this.call('constantMetagame','top_stressed_target_pct',{def_value:50});selected=[candidates.length===1||this.e.random.randomTFbyProbability(0,pct)?candidates[0].res_id:this.e.random.randomArrayMember(0,candidates.slice(1).map(c=>c.res_id))];}
    else selected=candidates.slice(0,rows.length).map(c=>c.res_id);
    const except=['004','005','006','007','008'].map(n=>this.call('tutorialConstantId','const_main_battle_'+n)).includes(this.init.battle_res_id),infos=[];
    selected.forEach((res,index)=>{
      const c=s.chars.find(c=>c.res_id==res),row=rows[index];if(!c||c.res_id<=0||!row)return;
      const range=this.db.array(row.turn_stress).map(Number);if(range.length!==2)throw new MissingBattleRule('procTurnStartStressAction.turn_stress_length',{id:row.id,range});
      let value=this.e.random.nextInt(0)/2147483647*(range[1]-range[0])+range[0];value=this.call('calcIncreaseStress',value,c,{battle_worktable:this.w});
      const prev=c.ego_stress??0,max=this.call('getMaxStress');let next=fixed2(Math.max(0,Math.min(max,prev+value)));
      const limits=this.getCustomStressVal('CUSTOM_STRESS_LIMIT'),keys=limits.map(r=>r.source1_multiple_link.toString()),values=Object.fromEntries(limits.map(r=>[r.source1_multiple_link.toString(),r.custom_val]));
      if((except||limits.length>0)&&limits?.length>0)for(const r of limits){
        if(r.source1_multiple_link==='none'){this.e.record?.({kind:'client-error',message:'err:simulate_battle_custom_source1_multiple_link_none:'+r.id});return;}
        if(keys.includes(c.res_id.toString())){next=Math.max(0,Math.min(max,Number(values[c.res_id.toString()]),prev+value));value=fixed2(next-prev);}
      }
      const old=c.collapse_on,add=this.call('checkCollapse',{char:c,prev,next}),changed=c.collapse_on;if(next-prev==0)return;
      infos.push({char_res_id:res,from:prev,to:next,stress_value:value,is_collapse_on:old==changed?undefined:changed,add_collapse_card_battle:add});
    });this.call('addStressActionArray',infos);
  }
  getCustomStressVal(type){
    // GameConstants.loadSimulateBattleCustom 0xec00 concatenates resource lists
    // in enumeration order, without trimming or filtering sentinel strings.
    const ids=[];
    for(const row of Object.values(this.db.table('simulate_battle'))){
      if(row.link_battle_id==='none'||row.link_battle_id!=this.init.battle_res_id)continue;
      ids.push(...row.link_simulate_battle_custom_id.replace(/[\[\]]/g,'').split(','));
    }
    return ids.map(id=>this.db.get('simulate_battle_custom',id)).filter(row=>row.custom_type==type);
  }
  refreshRef(type,refresh=true,monster_turn=false){
    if(this.w.isPreview)return;
    if(type==='CONDITION_CHAR_HP_TURN_START'||type==='CONDITION_CHAR_HP_MON_REGIST_PCT'){
      if(monster_turn)return;
      return this.call('forEachHpMarkEvent',type,(event,id)=>{
        if(type==='CONDITION_CHAR_HP_TURN_START'&&refresh)event.ref=this.call('getStatus',id,'S_CURRENT_HP');
        this.call('pushHpMark',id,event.ref*event.value/100);
      });
    }
    if(type==='CONDITION_CHAR_TAKE_DMG_MAX_HP_PCT')return this.call('forEachHpMarkEvent',type,(event,id)=>this.call('pushHpMark',id,event.ref));
    if(type==='CONDITION_CHAR_TAKE_DMG_MAX_HP_PCT_TURN')return this.call('forEachHpMarkEvent',type,(event,id)=>{
      if(Boolean(monster_turn)!==Boolean(event.unit_opt?.includes('monster_turn')))return;
      if(refresh)event.ref=Math.floor(this.call('getStatus',id,'S_CURRENT_HP')-this.call('getStatus',id,'S_HP')*event.value/100);
      this.call('pushHpMark',id,event.ref);
    });
  }
  getPassiveByTypeGamecore(type,check='CHECK_LIMIT_NONE'){
    const passives=this.stage.battle_stage.passives;
    // The offline adapter exposes enum names; native numeric enum indexes reverse
    // to the same names before accessing this serialized object.
    if(!passives[type])return [];
    let checked=false;
    passives[type]=passives[type].filter(p=>{
      if(p.removed)return false;const row=this.db.get('nb_eff',p.res_id);
      if(row.operation!=='OPERATION_PASSIVE_LIMIT')return true;
      p.passive_activated_cnt??=0;if(p.passive_activated_cnt>=Number(row.passive_limit))return false;
      if(check==='CHECK_LIMIT_ALL'||check==='CHECK_LIMIT_FIRST'&&!checked){++p.passive_activated_cnt;checked=true;}
      return true;
    });
    return check==='CHECK_LIMIT_FIRST'?[passives[type][0]]:passives[type];
  }
  recoverEgoBreak(){
    for(const m of this.b.monsters){
      if(['death','changed','run'].includes(m.state))continue;
      if(m.ego_field_value==0&&m.ego_field_max_value!=null){
        m.ego_field_value=m.ego_field_max_value;
        const ps=this.getPassiveByTypeGamecore('EFF_BATTLE_MONSTER_EGO_FIELD_PCT_SUBTRACT');
        if(ps.length)m.ego_field_value=Math.round(m.ego_field_value*(100-ps.reduce((n,p)=>n+p.eff_value,0))/100*12)/12;
        m.ego_breaked=false;
        this.e.ports.pushAction({type:'action_ego_field',source_id:m.id,value:m.ego_field_value,id:this.b.last_action_id++});
        this.call('procUnitEvent','CONDITION_MONSTER_EGO_FIELD_AMOUNT',[m.id,m.ego_field_value]);
      }
    }
    this.call('procUnitEvent','CONDITION_MONSTER_AMOUNT',[]);
    this.call('procUnitEvent','CONDITION_MONSTER_AMOUNT_SET',[]);
  }
  getRageDiff(consume,extra){
    const ps=this.e.passives.query({source_id:this.b.char.id,type:'SKILL_EFF_MONSTER_RAGE_SET',is_card:false});
    if(!this.init.rage_enable&&!ps.length)return;
    const row=this.db.table('battle')[this.init.battle_res_id];if(!row)return;
    let threshold=this.call('constantMetagame',row.battle_type.slice('SPOT_TYPE_'.length).toLowerCase()+'_rage_turn')+Number(row.rage_turn_offset);
    if(ps.length){threshold=this.call('calcValue',ps[0].skill_id,this.b.char.id);if(consume)this.call('checkTermValuePassive',ps[0].skill_id,this.b.char.id,true,extra);}
    return this.b.turn-(this.b.turn_wave_reset??0)-threshold;
  }
  addEPwithCheckPassive(amount,immediate){
    const query=type=>this.e.passives.query({source_id:this.b.char.id,type,is_card:false});
    const blocked=query('SKILL_EFF_TACTIC_GAUGE_EARN_UNABLE');
    if(blocked.length){this.call('checkTermValuePassive',blocked[0].skill_id,this.b.char.id);return;}
    const power=this.b.chars.reduce((n,c)=>n+(c.status.info.S_CHARGING_POWER??0),0);
    const a=this.call('constantMetagame','charging_power_revise_a',{def_value:1}),b=this.call('constantMetagame','charging_power_revise_b',{def_value:0});
    amount=Math.ceil(amount*(1+a*(1-Math.exp(b*power))));
    let plus=0,multi=1;
    for(const p of query('SKILL_EFF_EP_GEN_VALUE_ADD')){
      const row=this.db.get('skill_eff',p.res_id),v=this.call('calcValue',p.skill_id);
      switch(row.eff_value_math_sign){
        case 'MATHSIGN_ADD':plus+=v;break;
        case 'MATHSIGN_MULTIPLY':multi*=v;break;
        case 'MATHSIGN_MULTIPLY_PCT':multi*=v/100;break;
        case 'MATHSIGN_ADD_HUND_MULTIPLY_PCT':multi*=(v+100)/100;break;
        case 'MATHSIGN_SUBTRACT_HUND_MULTIPLY_PCT':multi*=(100-v)/100;break;
      }
      this.call('checkTermValuePassive',p.skill_id,this.b.char.id);
    }
    amount=amount*multi+plus;
    const ps=this.stage?this.getPassiveByTypeGamecore('EFF_BATTLE_EARN_TACTIC_GAUGE_SUBTRACT_0_PASSIVE'):undefined;
    amount=Math.max(0,amount-(ps?.reduce((n,p)=>n+p.eff_value,0)??0));
    this.addEP(amount,-1,immediate);
  }
  isEarlyTutorial(){return [1,2,3,4].map(n=>this.call('tutorialConstantId',`const_main_battle_00${n}`)).includes(this.init.battle_res_id);}
  addEP(amount,source,immediate){
    if(this.isEarlyTutorial())return;
    const before=this.b.ep;this.b.ep+=amount;
    const max=this.call('constantMetagame',this.b.battle_step_mode?'tp_simulation_max_value':'tp_max_value');
    if(this.b.ep>max)this.b.ep=max;
    if(source==null||this.b.ep-before==0)return;
    const action={id:this.b.last_action_id++,type:'action_tactic_gauge',source_id:source};
    action[immediate==true?'value':'value_temp']=this.b.ep;
    this.e.ports.pushAction(action);this.call('procUnitEvent','CONDITION_EP_AMOUNT',[this.b.char.id]);
  }
  checkLead(){
    if(this.isEarlyTutorial())return;
    const base=this.call('constantMetagame','lead_pct')??0,pct={},actions=[];
    this.b.lead_cards??=[];
    for(const id of this.b.deck_info.hand){
      if(this.call('isCardUninteractible',id))continue;
      const c=this.b.cardMap[id];if(!c.talents?.includes(21))continue;
      if(pct[c.char_id]==null){
        const ps=this.e.passives.query({source_id:c.char_id,type:'SKILL_EFF_TALENT_LEAD_PCT_ADD',is_card:false,char_id:c.char_id,skip_error:true});
        pct[c.char_id]=ps.reduce((n,p)=>{this.db.get('skill_eff',this.b.skillMap[p.skill_id].res_id);return n+this.call('calcValue',p.skill_id);},base);
      }
      if(this.stage.battle_stage.cheat_info.lead||this.e.random.randomTFbyProbability(0,pct[c.char_id])){
        c.leaded=true;const cost=this.call('updateCostResult',id);this.e.ports.pushChangeData('card',id);
        actions.push({id:this.b.last_action_id++,type:'action_card_cost',action_card_property:{card:id,cost:cost.new_cost,lead:true},source_id:-1,skip_action:c.card_place!=2});
        if(cost.new_cost<cost.old_cost)this.call('procCardEvent','CONDITION_CARD_COST_DECREASE',c.card_place,c.id);
        this.b.lead_cards.push(id);
      }
    }
    if(this.b.lead_cards.length){
      this.b.lead_char=this.b.cardMap[this.e.random.randomArrayMember(0,this.b.lead_cards)].char_id;
      if(this.w.lead_action)this.w.lead_action.source_id=this.b.lead_char;
    }else if(this.w.lead_action)this.w.lead_action.source_id=-1;
    for(const a of actions)this.e.ports.pushAction(a);
  }
}
