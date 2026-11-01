// CardProc setRSpark 0x58300, rSpark 0x58d00 (+callbacks 54..58),
// cardRSpark 0x60a00. Source evidence: evidence/batch2-spark*/.
import {MissingBattleRule} from './resource-store.mjs';
import {TALENTS as T,parseBindTalent,addTestamentInterruptOutline} from './card-talent-support.mjs';
const CS_EFFECTS=new Set(['SKILL_EFF_CS_SET','SKILL_EFF_CS_SET_ADD','SKILL_EFF_CS_SET_ADD_NO_SPARK','SKILL_EFF_CS_SET_ADD_IGNORE_BLOCK','SKILL_EFF_CS_SET_ADD_IGNORE_OVERLAY','SKILL_EFF_CS_SET_ADD_IGNORE_COND']);
export class CardSparkRuntime {
 constructor(e){this.e=e;this.b=e.b;this.db=e.db;}
 call(n,...a){return this.e.call(n,...a);}
 gap(n,x){throw new MissingBattleRule('cardSpark.'+n,x);}
 action(type,id,fields,extra={}){this.e.pushAction({id:this.b.last_action_id++,type,action_card_property:{card:id,...fields},source_id:-1,...extra});}
 changed(id){this.call('pushChangeData','card',id);}
 setRSpark(id,creating=true){const c=this.b.cardMap[id];if(c.r_spark){if(c.r_spark.category==='CATEGORY_PUBLIC')this.rSpark(id,creating);else this.cardRSpark(id);
   if(c.r_spark.god_r_spark_res_id)this.rSpark(id,creating,'god');}if(c.support_r_spark)this.rSpark(id,creating,'support');}
 rSpark(id,creating=true,mode){const c=this.b.cardMap[id];
  if(mode==='god'){if(c.god_r_spark_applied)return;c.god_r_spark_applied=true;}
  if(mode==='support'){if(c.support_r_spark_applied)return;c.support_r_spark_applied=true;}
  const info=mode==='support'?c.support_r_spark:c.r_spark;if(info==null)this.gap('spark_info_missing',{id,mode});
  const res=mode==='god'?info.god_r_spark_res_id:info.res_id,r=this.db.get('r_spark',res??''),effs=this.db.array(r.add_target_eff);
  if(effs.length&&effs[0]!=='none'){
   const links=this.db.array(r.add_link_cs_id),counts=this.db.array(r.add_target_eff_count_value).map(Number),values=this.db.array(r.add_value).map(Number),addCounts=this.db.array(r.add_count_value).map(Number),targets=this.db.array(r.add_target_eff_target),multis=this.db.array(r.add_multiply_pct_value).map(Number),flags=this.db.array(r.add_target_eff_during_eff_flag);
   if([values,addCounts,counts].some(a=>a.length!==effs.length))this.gap('invalid_spark_array_counts',{id,res});
   const modify=(sid,i,rootId,during)=>{const s=this.b.skillMap[sid],sr=this.db.get('skill_eff',s.res_id),user=['TARGET_UNIT_CASTER','TARGET_UNIT_OWNER','TARGET_UNIT_USER'].includes(sr.target_unit_type);
    if(sr.eff!==effs[i]||!(counts[i]<=0||counts[i]==sr.eff_count_value)||!(targets[i]==='all'||targets[i]==='user'&&user||targets[i]==='monster'&&!user))return;
    // Native callback 55 marks the outer skill, even when modifying its child.
    this.call('pushChangeData','skill',rootId);
    if(CS_EFFECTS.has(sr.eff)){
     if(links.length<=i)this.gap('invalid_target_eff_opt',{id,res,index:i});
     if(!s.link_cs_ids?.includes(links[i]))return;
     s.r_spark_value=(s.r_spark_value??0)+values[i];
     // 0x5cd00 @512..539 explicitly only initializes this property. Its
     // add_count[i] is read and discarded; raw opcodes confirm no Add/store.
     s.r_spark_count_value=during?(s.r_spark_count_value??0):(s.r_spark_count_value??0)+addCounts[i];
     s.r_spark_multiply_pct_value=(s.r_spark_multiply_pct_value??0)+multis[i];
    }else{s.r_spark_value=(s.r_spark_value??0)+values[i];s.r_spark_count_value=(s.r_spark_count_value??0)+addCounts[i];s.r_spark_multiply_pct_value=(s.r_spark_multiply_pct_value??0)+multis[i];}
   };
   effs.forEach((_,i)=>c.skill_eff_ids.forEach(sid=>{if(flags[i]==='eff')modify(sid,i,sid,false);else if(flags[i]==='during_eff')this.b.skillMap[sid].duringEffs?.forEach(child=>modify(child,i,sid,true));}));
  }
  c.r_spark_cost??=[];c.r_spark_cost.push(this.db.number(r,'add_cost_value'));c.r_spark_cost_mathsign??=[];c.r_spark_cost_mathsign.push(r.add_cost_mathsign);
  const cost=this.call('updateCostResult',id);if(!creating&&cost.changed){this.changed(id);this.action('action_card_cost',id,{cost:cost.new_cost},{skip_action:c.card_place!==2});}
  this.db.array(r.add_link_skill_eff_id).forEach(res=>this.addSkill(c,res));
  const talents=this.db.array(r.add_talent);if(talents.length){const testament=c.talents?.includes(T.TALENT_TESTAMENT)===true,diffs={};
   for(const key of ['exhaust','remove','recall','bind'])diffs[key]=(c['base_'+key+'_count']??0)-(c[key+'_count']??0);
   talents.forEach(t=>this.addTalent(c,t,diffs));if(c.add_talents?.length){const add=c.add_talents.filter(t=>!c.talents?.includes(t));if(add.length){c.talents??=[];c.talents.push(...add);}}
   if(c.talents?.length===0)c.talents=undefined;if(!testament&&c.talents?.includes(T.TALENT_TESTAMENT))addTestamentInterruptOutline(c);
   // Native talent notification is unconditional for nonempty add_talent,
   // including construction (unlike the cost notification above).
   this.action('action_card_talent',c.id,{talent:c.talents});
  }
 }
 addSkill(c,res){const s=this.call('createSkill',res,c.caster_id,{type:'CARD',id:c.id},0,0,0,c.char_id),r=this.db.get('skill_eff',s.res_id);
  if(r.operation==='OPERATION_PASSIVE')this.call('addPassiveSkill',s.skill_id,c.id,true);else{c.r_spark_skill_eff_ids??=[];c.r_spark_skill_eff_ids.push(s.skill_id);}
  if(r.operation==='OPERATION_CS_SET_AUTO'||r.eff==='SKILL_EFF_CS_SET_ADD_AUTO')this.call('procCSAddSetAuto',s.skill_id,true);
  const outline=this.db.array(r.outline_link_condition_id);if(outline.length)for(const key of ['stack_trigger','stack_value0','stack_value1','stack_count0','stack_count1']){const id=s[key],stack=this.b.stackMap[id];if(id!=null&&stack&&outline.includes(stack.res_id)){c.handOutline??={};c.handOutline[id]=this.call('checkStack',id);}}
  if(!c.is_tuning_card&&this.db.array(r.run_check_opt).includes('tuning'))c.is_tuning_card=true;
  if(!c.is_efficiency_card&&this.db.array(r.eff_opt).includes('trigger_efficiency'))c.is_efficiency_card=true;
 }
 addTalent(c,s,diffs){const push=t=>{c.talents??=[];if(!c.talents.includes(t))c.talents.push(t);};
  for(const key of ['exhaust','remove','recall','bind']){const base='TALENT_'+key.toUpperCase();if(!s.startsWith(base))continue;
   const old=c[key+'_count']??0,parsed=key==='bind'?parseBindTalent(s):undefined,n=key==='bind'?(parsed?.stack??0):Number(s.slice(base.length+1));
   if(n==0)c[key+'_count']=0;else{c['base_'+key+'_count']=n-1;c[key+'_count']=Math.max(c['base_'+key+'_count']-diffs[key],0);}
   if(key==='bind'&&parsed?.max!=null)c.bind_max_count=parsed.max;
   if(c.talents?.includes(T[base])){c['base_'+key+'_count']=(c['base_'+key+'_count']??0)+old+1;c[key+'_count']=(c[key+'_count']??0)+old+1;}else push(T[base]);return;
  }
  if(s==='TALENT_IGNITE'||s.startsWith('TALENT_IGNITE_')){c.ignite_count??=0;push(T.TALENT_IGNITE);return;}
  if(s==='TALENT_CONNECT_INFINITE'){push(T.TALENT_CONNECT_INFINITE);return;}
  if(s.startsWith('TALENT_CONNECT')){push(T.TALENT_CONNECT);return;}
  if(T[s]==null)this.gap('invalid_talent',{talent:s,id:c.id});
  // Default branch does not deduplicate, including TALENT_NONE (enum 0).
  c.talents??=[];c.talents.push(T[s]);
 }
 cardRSpark(id){const c=this.b.cardMap[id];if(c.r_spark==null)this.gap('card_r_spark_not_exist',{id});if(c.r_spark.category!=='CATEGORY_UNIQUE')this.gap('card_r_spark_category',{id,category:c.r_spark.category});
  this.changed(id);if(c.card_r_spark_changed)return;
  const saved=c.continueSkill?.filter(id=>{const cs=this.b.csMap[id];return cs&&!cs.byAuto&&!cs.removed;});c.continueSkill=c.continueSkill?.filter(id=>this.b.csMap[id]?.byAuto);
  this.call('removeCard',id);const next=this.call('createBattleCard',c);next.before_r_spark_cost=c.before_r_spark_cost;next.continueSkill=saved;
  if(next.cost_result!=c.cost_result){this.changed(id);this.action('action_card_cost',next.id,{cost:next.cost_result},{skip_action:c.card_place!==2});}
  if(next.talents?.length!=c.talents?.length||!next.talents?.every((t,i)=>t==c.talents?.[i])){this.changed(id);this.action('action_card_talent',next.id,{talent:next.talents});}
 }
}
