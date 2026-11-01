// Independent ports: StressProc 0x39b00 (932 instructions), 0x1ed00
// (214 instructions + callbacks). See evidence/damage-stress/SCOPE.md.
import {MissingBattleRule} from './resource-store.mjs';
import {resdbShuffle} from '../../rng-investigation/resdb-shuffle.mjs';
const fixed2=v=>Number((v+1e-8).toFixed(2));
export class DamageStressRuntime {
  constructor(e){this.e=e;this.b=e.b;this.w=e.wt;this.db=e.db;}
  call(n,...args){return this.e.call(n,...args);}
  get stage(){return this.e.state.worktables.BattleStageWorktable?.battle_stage;}
  get init(){return this.e.state.worktables.BattleInitWorktable?.battle_init;}
  float(){return this.e.random.nextInt(0)/2147483647;}
  // GameRandom.randomArrayMembers, without replacement; singleton consumes RNG.
  members(array,count){const indexes=array.map((_,i)=>i),out=[];count=Math.min(count,array.length);
    for(let i=0;i<array.length&&i<count;i++){const j=this.e.random.randRange(0,0,indexes.length);out.push(array[indexes[j]]);indexes.splice(j,1);}return out;}
  procDamageStressAction(actionList,casterId){
    const stage=this.stage;if(stage==null||this.w.isPreview)return;
    const config=this.db.get('ingame_content_config',stage.ingame_content_config_id);if(config.enable_stress_hit!=='YES')return;
    if(stage.remnants_boss_penalty_info){const row=this.db.get('remnants_boss_penalty_list',stage.remnants_boss_penalty_info.list_id);if(!Number(row.hit_stress_enable??1))return;}
    const custom=this.call('getCustomStressVal','CUSTOM_MON_STRESS_VAL');if(custom?.length>0)return;
    if(stage.cheat_info.battle_stress_off==true||this.init.battle_stress_off==true)return;
    let lost=0;for(const action of actionList)for(const [id,info]of action.action_units){if(id==this.b.char.id&&info.damage!=null)lost+=info.old_hp-info.new_hp;}
    if(!(lost>0))return;
    const maxHP=this.b.char.status.info.S_HP+stage.chars.reduce((n,c)=>n+(c.collapse_dec_max_hp??0),0),damagePct=lost/maxHP*100;
    // Native table enumeration retains the LAST qualifying row, not a sorted max.
    let row;for(const item of Object.values(this.db.table('stress_battle')))if(item!=null&&item.type==='STRESS_TYPE_DAMAGE'&&item.value<=damagePct)row=item;
    if(row==null||row.member<=0)return;
    const monster=this.db.get('monster',this.e.getUnit(casterId).res_id),range=this.db.array(row['dmg_'+monster.rank.toLowerCase()+'_stress']).map(Number);
    if(range.length!==2)return;
    const candidates=this.b.chars.filter(c=>c.res_id>0&&c.opacity!=0&&stage.chars.find(s=>s.id==c.id)!=null&&stage.chars.find(s=>s.id==c.id).collapse_on!=true);
    if(candidates.length===0)return;
    const pct=this.call('constantMetagame','top_stressed_target_pct',{def_value:50}),selected=[];
    if(this.e.random.randomTFbyProbability(0,pct)){
      resdbShuffle(candidates,()=>this.float());
      // Ties take the later item in the shuffled list.
      const top=candidates.reduce((a,b)=>(stage.chars.find(c=>c.id==a.id).ego_stress??0)>(stage.chars.find(c=>c.id==b.id).ego_stress??0)?a:b);
      selected.push(top.res_id);const rest=candidates.filter(c=>c.res_id!=top.res_id);
      selected.push(...this.members(rest,Math.min(rest.length,row.member-1)).map(c=>c.res_id));
    }else selected.push(...this.members(candidates,Math.min(candidates.length,row.member)).map(c=>c.res_id));
    const changes=[];
    for(const resId of selected){const char=stage.chars.find(c=>c.res_id==resId);if(char==null||char.res_id<=0)continue;
      let stress=this.calcIncreaseStress(this.float()*(range[1]-range[0])+range[0],char,{battle_worktable:this.w});
      const prev=char.ego_stress??0,max=this.call('getMaxStress');let next=fixed2(Math.max(Math.min(max,prev+stress),0));
      const tutorials=[4,5,6,8].map(n=>this.call('tutorialConstantId','const_main_battle_00'+n));
      const limits=this.call('getCustomStressVal','CUSTOM_STRESS_LIMIT'),ids=limits.map(c=>c.source1_multiple_link.toString()),values=limits.reduce((out,c)=>(out[c.source1_multiple_link.toString()]=c.custom_val,out),{});
      if((tutorials.includes(this.init.battle_res_id)||limits.length>0)&&limits.length>0){for(const limit of limits){
        // Native logs and returns on this malformed custom row; use a visible
        // failure rather than losing already built changes without explanation.
        if(limit.source1_multiple_link==='none')throw new MissingBattleRule('procDamageStressAction.custom_limit_none',{id:limit.id});
        if(ids.includes(char.res_id.toString())){next=Math.max(Math.min(max,Number(values[char.res_id.toString()]),prev+stress),0);stress=fixed2(next-prev);}
      }}
      const old=char.collapse_on,add=this.call('checkCollapse',{char,prev,next,skip_link_crash:true});
      if(next-prev==0)continue;
      changes.push({char_res_id:resId,from:prev,to:next,stress_value:stress,is_collapse_on:old==char.collapse_on?undefined:char.collapse_on,add_collapse_card_battle:add});
    }
    this.call('addStressActionArray',changes);
  }
  calcIncreaseStress(value,char,options){
    if(value<=0)return value;
    if(options?.battle_worktable){
      for(const p of this.e.passives.query({source_id:this.b.char.id,type:'SKILL_EFF_EARN_STRESS_VALUE_CHANGE_ALL',is_card:false,char_id:char.id})){
        const row=this.db.table('skill_eff')[p.res_id];if(!row)continue;
        const calc=this.call('calcValue',p.skill_id),old=value;value=this.call('procMathSign',row.eff_value_math_sign,value,calc);
        if(value!=old&&p.from_relic){this.call('pushSubBattleLog',{type:this.call('getBattleLogType','equip'),params:[p.from_relic],logs:[],not_noti:row.trigger_noti_type!=='YES',merge_by:p.action_char_id,merge_srcs:[p.skill_id]},true);
          this.call('addDetailLog',{type:this.call('getDetailLogType','log_skill_eff_earn_stress_value_change_all'),params:[char.id,calc],param_types:[this.call('getLogParamType','unit_id'),this.call('getLogParamType','value')]});}
        this.call('checkTermValuePassive',p.skill_id,char.id);
      }
    }
    value*=1+(this.stage.monsterStat.stress_get_pct??0)*.01;
    char.collapse_skill_penalty_pct??=1;value*=char.collapse_skill_penalty_pct;
    const effects=this.getFilteredPotentialNodeEffectIds('NODE_STRESS_GET_DECREASE_PCT',char.potential_node_ids??[]);
    let reduction=0;for(const id of effects){const row=this.db.table('potential_node_effect')[id];if(row!=null)reduction+=Number(row.value);}
    value*=1-reduction*.01;
    for(const p of this.call('getPassiveByTypeGamecore','EFF_EARN_STRESS_VALUE_CHANGE_PCT'))value*=(p.eff_value+(p.add_value??0))*.01;
    if(!options?.skip_assault_area_stress_reduction&&this.call('isAssaultMode')&&options?.battle_worktable&&this.init.area_id==0)value*=.7;
    value=Math.max(0,value);if(value<1&&value>0)value=1;return fixed2(value);
  }
  // CharacterProc 0x44d00: preserve node and link ordering, duplicates, and
  // native missing-row skips. Missing entire source tables remain errors.
  getFilteredPotentialNodeEffectIds(type,ids){const result=[];for(const id of ids??[]){const node=this.db.table('potential_node')[id];if(node==null)continue;
    for(const effId of this.db.array(node.link_potential_node_effect_id)){const effect=this.db.table('potential_node_effect')[effId];if(effect!=null&&effect.node_type==type)result.push(effect.id);}}
    return result;
  }
}
