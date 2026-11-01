// Independent hand ports of BattleCardProc and cleanupCardResources.
// Evidence: execution/evidence/card-state, bytecode addresses recorded there.
import fs from 'node:fs';
import {MissingBattleRule} from './resource-store.mjs';
const T=JSON.parse(fs.readFileSync(new URL('../../card-pool-investigation/talent-enum.json',import.meta.url),'utf8'));
export class CardStateRuntime {
  constructor(e){this.e=e;this.b=e.b;this.w=e.wt;this.db=e.db;}
  call(n,...args){return this.e.call(n,...args);}
  getTalentByInfo(card,options){
    const skip=options?.skip_exhaust_n??false;
    let result=[];
    const parse=(name,isSpark)=>{
      if(name.startsWith('TALENT_EXHAUST'))return skip&&name.length>'TALENT_EXHAUST'.length?43:2;
      for(const prefix of ['TALENT_REMOVE','TALENT_RECALL','TALENT_BIND','TALENT_IGNITE'])if(name.startsWith(prefix))return T[prefix];
      if(name=='TALENT_CONNECT_INFINITE')return 42;
      if(name.startsWith('TALENT_CONNECT'))return 41;
      if(!isSpark&&name=='TALENT_NONE')return null;
      return T[name];
    };
    const append=(names,spark=false)=>{for(const name of names){const value=parse(name,spark);if(value!==null)result.push(value);}};
    append(this.db.array(this.db.get('card',card.res_id).talent));
    const spark=id=>append(this.db.array(this.db.get('r_spark',id).add_talent),true);
    if(card.r_spark?.category=='CATEGORY_UNIQUE'){
      const replacement=this.db.get('card_r_spark',card.r_spark.res_id),copy=structuredClone(card);
      copy.res_id=replacement.change_link_card_id;copy.r_spark=undefined;copy.support_r_spark=undefined;
      result=this.getTalentByInfo(copy,options);
    }else if(card.r_spark?.category=='CATEGORY_PUBLIC')spark(card.r_spark.res_id);
    if(card.r_spark?.god_r_spark_res_id)spark(card.r_spark.god_r_spark_res_id);
    if(card.support_r_spark)spark(card.support_r_spark.res_id);
    if(card.add_talents&&card.add_talents.length>0)result.push(...card.add_talents.filter(t=>!result.includes(t)));
    if(card.eidolon_reward_ids)for(const id of card.eidolon_reward_ids){
      // Native get may return no row, which is explicitly skipped.
      const r=this.db.table('eidolon_card_reward')[id];if(!r)continue;
      for(const name of this.db.array(r.slot_add_card_talent)){
        let value;
        if(name.startsWith('TALENT_EXHAUST'))value=2;
        else if(name.startsWith('TALENT_RECALL'))value=28;
        else if(name.startsWith('TALENT_REMOVE'))value=7;
        else if(name.startsWith('TALENT_BIND'))value=37;
        else if(name=='TALENT_IGNITE'||name.startsWith('TALENT_IGNITE_'))value=39;
        else if(name=='TALENT_CONNECT_INFINITE')value=42;
        else if(name.startsWith('TALENT_CONNECT'))value=41;
        else value=T[name];
        if(value!=null&&!result.includes(value))result.push(value);
      }
    }
    return result;
  }
  hasTalent(id,talent,options){
    const card=this.b.cardMap[id];if(!card)return false;
    if(card.talents?.includes(talent))return true;if(talent!=47)return false;
    const place=options?.place??card.card_place;
    if(!(place==2||place==7&&card.place_before_using==2))return false;
    return this.e.passives.query({source_id:id,type:'SKILL_EFF_UNIQUE_TENEBRIA',is_card:true,check_pct:false})
      .some(p=>p.parent.type==this.e.enums.SkillParentType.CARD&&p.parent.id==id);
  }
  getCategory(id){const r=this.db.get('card',this.b.cardMap[id].res_id);
    const ps=this.e.passives.query({source_id:id,type:'SKILL_EFF_CARD_STATE_ABNORM',is_card:true});
    return ps.length>0?[r.card_category,'CARD_ABNORM']:[r.card_category];}
  checkCategory(id,categories){if(this.db.get('card',this.b.cardMap[id].res_id).sort=='SORT_COLLAPSE')return false;
    // Native computes getCategory separately for each candidate; don't cache
    // this passive lookup since a query can consume a random probability.
    return categories.some(category=>this.getCategory(id).includes(category));}
  getCost(id,onThrow,finishUse){
    onThrow??=false;finishUse??=false;const c=this.b.cardMap[id];
    if(c.cost<0)return c.cost;
    if(['SORT_COLLAPSE_SKILL','SORT_SUPPORT','SORT_COLLAPSE'].includes(this.db.get('card',c.res_id).sort))return c.cost;
    const local=this.e.passives.query({source_id:id,type:'SKILL_EFF_CARD_COST_CHANGE',is_card:true});
    let cost=c.cost_changed?0:c.cost_set!==undefined&&c.cost_set>=0?c.cost_set:
      c.cost_subtract!==undefined&&c.cost_subtract>=0?c.cost-c.cost_subtract:c.cost;
    if(c.r_spark_cost!=null&&c.r_spark_cost_mathsign!=null)c.r_spark_cost.forEach((v,i)=>cost=this.call('procMathSign',c.r_spark_cost_mathsign[i],cost,v));
    for(const p of local){const r=this.db.get('skill_eff',p.res_id);
      cost=this.call('procMathSign',r.eff_value_math_sign,cost,this.call('calcValue',p.skill_id));
      if(finishUse)this.call('checkTermValuePassive',p.skill_id,id);}
    const global=this.e.passives.query({source_id:this.b.char.id,type:'SKILL_EFF_CARD_COST_CHANGE_PASSIVE',is_card:false,char_id:c.char_id});
    for(const p of global){const r=this.db.get('skill_eff',p.res_id);
      if(!this.call('getTargetCards',p.skill_id,false,false,false).target_cards_id.includes(id))continue;
      const sign=r.eff_value_math_sign;
      if(sign=='MATHSIGN_RANDOM_SET'||sign=='MATHSIGN_RANDOM_SET_MIN_1'){
        const index=c.random_by?.findIndex(x=>x==p.skill_id);
        if(index!=null&&index>=0)cost=c.random_cost?.[index]??0;
        else{
          const min=sign=='MATHSIGN_RANDOM_SET'?0:1;
          if(p.eff_opts?.includes('equal')){
            const max=this.call('calcValue',p.skill_id),candidates=[];
            if(!Number.isFinite(max)||max>100000)throw new MissingBattleRule('getCost.random_candidate_limit',{max});
            for(let n=min;n<=max;n++)candidates.push(n);
            if(!this.w.isPreview)cost=this.call('getRandomCost',p.skill_id,candidates);
          }else if(!this.w.isPreview)cost=this.e.random.randRange(0,min,this.call('calcValue',p.skill_id)+1);
          c.random_by??=[];c.random_by.push(p.skill_id);c.random_cost??=[];c.random_cost.push(cost);
        }
      }else cost=this.call('procMathSign',sign,cost,this.call('calcValue',p.skill_id));
      if(onThrow)this.call('checkTermValuePassive',p.skill_id,this.b.char.id);
    }
    if(c.leaded)--cost;if(c.ignite_count&&c.ignite_count>0)cost-=c.ignite_count;
    if(cost<0)cost=0;else if(cost>9)cost=9;return cost;
  }
  updateCostResult(id,onThrow,finishUse){onThrow??=false;finishUse??=false;
    const c=this.b.cardMap[id],old_cost=c.cost_result,new_cost=this.getCost(id,onThrow,finishUse);c.cost_result=new_cost;
    if(old_cost!=new_cost){this.call('procCardEvent','CONDITION_CARD_COST_EQ_AP',0,id);this.call('procCardEvent','CONDITION_THIS_CARD_COST_COMPARE',0,id);}
    return {changed:old_cost!=new_cost,old_cost,new_cost};
  }
  cleanupCardResources(id){
    const stage=this.w.battle_stage_worktable??this.e.state.worktables.BattleStageWorktable;
    if(!stage?.battle_stage?.disaster_boss_rank_info)return;
    const c=this.b.cardMap[id];if(!c||c.res_id.startsWith('c_30047_srt4'))return;
    if(c.res_id.startsWith('c_30075_srt4')){if(this.b.exhaustedSrt4Count===undefined)this.b.exhaustedSrt4Count=0;
      if(this.b.exhaustedSrt4Count<10){this.b.exhaustedSrt4Count++;return;}}
    this.b.pendingCardRemovals||=[];if(!this.b.pendingCardRemovals.includes(id))this.b.pendingCardRemovals.push(id);
  }
}
