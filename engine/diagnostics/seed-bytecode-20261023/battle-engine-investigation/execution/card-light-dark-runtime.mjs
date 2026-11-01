// WT0xf2b00/0xf4c00/0xf5400 with repaired loop tail. Module0x100
// @186..188 initializes context slot9 UNIQUE_BIND_MATERIAL_CARD_ID.
const MATERIAL='c_30134_cre1';
import {TALENTS as T} from './card-talent-support.mjs';
const stripMut=res=>res.endsWith('_mut1')||res.endsWith('_mut2')?res.slice(0,-5):undefined;
export class CardLightDarkRuntime {
 constructor(e){this.e=e;this.b=e.b;this.w=e.wt;this.db=e.db;}
 call(n,...a){return this.e.call(n,...a);}
 isTriggeredCardCopyIgnoreCond(row){return ['SKILL_EFF_CARD_COPY_TO_IGNORE_COND','SKILL_EFF_CARD_COPY_TO_IGNORE_COND_ORIGIN'].includes(row.eff)&&row.target_card_set==='CARD_SET_TRIGGERED';}
 isLightDarkReactionSkill(row){if(row.eff==='SKILL_EFF_TRIGGER_PYEONRIN')return true;if(!row.eff_link_condition_id||row.eff_link_condition_id==='none')return false;const condition=this.db.table('condition')[row.eff_link_condition_id];if(!condition)return false;
  for(const control of Object.values(this.call('loadGameDBbyKey','condition_control',condition.link_condition_control_key))){for(const id of this.db.array(control.link_cond_card_id)){const cond=this.db.table('cond_card')[id];if(!cond)continue;const talents=this.db.array(cond.condition_card_talent);if(talents.includes('not'))continue;if(talents.some(t=>[T.TALENT_LIGHT,T.TALENT_DARK,T.TALENT_LIGHT_DARK].includes(T[t])))return true;}}return false;
 }
 hasLightDarkCombineBlocking(){if((this.b.interrupts?.length??0)>0)return true;
  const bindCopy=(id,card)=>{if(card==null||this.b.cardMap[card]?.res_id!==MATERIAL)return false;const s=this.b.skillMap[id];if(!s)return false;const row=this.db.get('skill_eff',s.res_id);return this.isTriggeredCardCopyIgnoreCond(row)&&row.eff_card_place==='CARD_PLACE_HAND';};
  return [this.b.skillTrig,this.b.motionTrig,this.b.duringTrig].some(list=>list?.some(x=>x.pyeonrin_trigger_group_id!=null||x.pyeonrin_reaction_group_id!=null||bindCopy(x.skill_id,x.card_triggered)));
 }
 releaseLightDarkCombineWaiting(){if(!this.b.light_dark_combine_waiting||this.b.using_card||this.w.checking_light_dark||this.hasLightDarkCombineBlocking())return false;this.call('checkLightDark');return !this.b.light_dark_combine_waiting;}
 checkLightDarkCombine(){if(this.b.deck_info.hand.some(id=>this.b.cardMap[id]?.talents?.some(t=>t===59||t===60))&&this.call('hasLightDarkCombineBlocking')){this.b.light_dark_combine_waiting=true;return;}
  if(this.b.light_dark_combine_waiting)this.b.light_dark_combine_waiting=undefined;
  while(true){const hand=this.b.deck_info.hand;if(hand.length<2)return;const lights=[],darks=[],materials=[];let valid=true;
   for(const id of hand){const c=this.b.cardMap[id];if(!c)continue;const light=c.talents?.includes(59)??false,dark=c.talents?.includes(60)??false,bind=(c.talents?.includes(37)??false)&&c.bind_max_count!=null;
    if(!light&&!dark&&!bind){valid=false;break;}if([this.b.cardCoops,this.b.cardRepeats,this.b.cardUses].some(a=>a?.some(x=>x.card_id==id)))continue;
    if(light)lights.push(c);if(dark)darks.push(c);if(c.res_id===MATERIAL)materials.push(c);
   }if(!valid)return;
   const light=lights.find(c=>{const base=stripMut(c.res_id);return base!=null&&darks.some(d=>stripMut(d.res_id)==base);});if(light==null)return;
   const res=stripMut(light.res_id),dark=darks.find(c=>stripMut(c.res_id)==res);if(res==null||dark==null)return;
   if(!this.db.table('card')[res]){this.e.trace.push({kind:'content_error',source:'checkLightDarkCombine',message:'err:light_dark_combine_card_not_found:'+light.res_id,channel:'#server_report_dev2'});return;}
   const remove=[...new Set([dark.id,...materials.map(c=>c.id)])].filter(id=>id!=light.id);let info;
   if(light.light_dark_origin_r_spark){info=this.call('makeCardInfo',this.b.last_unit_id++,res,light.char_id);info.r_spark=structuredClone(light.light_dark_origin_r_spark);}
   const changed=this.call('changeCards',[light.id],res,info?{cardInfo:info,ignoreMoveToTrigger:true}:{ignoreMoveToTrigger:true});if(changed.length===0)return;
   for(const id of remove){if(this.b.cardMap[id]?.res_id!==MATERIAL||!this.b.deck_info.hand.includes(id)||this.call('isCardUninteractible',id))continue;this.call('procCardEvent','CONDITION_CARD_COMBINE',2,id,{combine_material_only:true});}
   const removed=this.call('moveCards',{card_ids:remove,from:2,to:0,by_check_orlea_creation:true});for(const id of removed)this.call('removeCard',id);
   this.call('addDetailLog',{type:'log_card_talent_light_dark_combine',params:[[changed[0].id]],param_types:['card_id']});this.call('procCardEvent','CONDITION_CARD_COMBINE',2,changed[0].id);
  }
 }
}
