// CardProc0x96f00 and0x97b00. Reward CS are unit CS with RELIC origin;
// linked nonpassive card effects have their own eidolon_skill_eff_ids list.
import {TALENTS as T,parseBindTalent} from './card-talent-support.mjs';
export class CardEidolonRuntime {
 constructor(e){this.e=e;this.b=e.b;this.db=e.db;}
 call(n,...a){return this.e.call(n,...a);}
 applyEidolonRewardCS(id,reward){const c=this.b.cardMap[id],r=this.db.table('eidolon_card_reward')[reward];if(c==null||r==null)return;for(const res of this.db.array(r.link_cs_id))this.call('procAddCS',c.char_id,res,1,c.char_id,false,'MATHSIGN_ADD',false,true,c.char_id,-1,{origin:'RELIC'});}
 applyEidolonRewardEffect(id,reward){const c=this.b.cardMap[id],r=this.db.table('eidolon_card_reward')[reward];if(c==null||r==null)return;
  for(const res of this.db.array(r.link_skill_eff_id)){const s=this.call('createSkill',res,c.caster_id,{type:'CARD',id:c.id},0,0,0,c.char_id),row=this.db.get('skill_eff',s.res_id);
   if(row.operation==='OPERATION_PASSIVE')this.call('addPassiveSkill',s.skill_id,id,true);else(c.eidolon_skill_eff_ids??=[]).push(s.skill_id);
   if(row.operation==='OPERATION_CS_SET_AUTO'||row.eff==='SKILL_EFF_CS_SET_ADD_AUTO')this.call('procCSAddSetAuto',s.skill_id,true);
  }
  if(this.db.number(r,'slot_add_cost')!==0&&r.slot_add_cost_mathsign!=='MATHSIGN_NONE'){(c.r_spark_cost??=[]).push(this.db.number(r,'slot_add_cost'));(c.r_spark_cost_mathsign??=[]).push(r.slot_add_cost_mathsign);this.call('updateCostResult',id);}
  const talents=this.db.array(r.slot_add_card_talent);c.talents??=[];
  for(const text of talents){let handled=false;
   for(const key of ['exhaust','recall','remove','bind']){const name='TALENT_'+key.toUpperCase();if(!text.startsWith(name))continue;handled=true;const old=c[key+'_count']??0,p=key==='bind'?parseBindTalent(text):undefined,n=(key==='bind'?p?.stack:Number(text.slice(name.length+1)))||1;
    if(key==='bind'&&p?.max!=null)c.bind_max_count=p.max;if(n==0)c[key+'_count']=0;else{c['base_'+key+'_count']=n-1;c[key+'_count']=n-1;}
    if(c.talents.includes(T[name])){c['base_'+key+'_count']=(c['base_'+key+'_count']??0)+old+1;c[key+'_count']=(c[key+'_count']??0)+old+1;}else c.talents.push(T[name]);break;
   }if(handled)continue;
   let talent=T[text];if(text==='TALENT_IGNITE'||text.startsWith('TALENT_IGNITE_')){c.ignite_count??=0;talent=T.TALENT_IGNITE;}
   else if(text==='TALENT_CONNECT_INFINITE')talent=T.TALENT_CONNECT_INFINITE;else if(text.startsWith('TALENT_CONNECT'))talent=T.TALENT_CONNECT;
   if(talent!=null&&!c.talents.includes(talent))c.talents.push(talent);
  }
 }
}
