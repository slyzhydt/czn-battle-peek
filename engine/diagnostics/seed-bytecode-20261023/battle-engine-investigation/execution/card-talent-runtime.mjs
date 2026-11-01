// BattleCardProc0x31e00/33300/34700/35100/35a00. Source callbacks are kept
// separate from constructor and Spark talent parsers: their counter semantics
// differ (addTalents does not reset the constructor's base counters).
import {TALENTS as T,parseBindTalent,getOlgaTalentBase,parseOlgaMaxStack,addTestamentInterruptOutline} from './card-talent-support.mjs';
export class CardTalentRuntime {
 constructor(e){this.e=e;this.b=e.b;}
 call(n,...a){return this.e.call(n,...a);}
 notify(c){this.e.pushAction({id:this.b.last_action_id++,type:'action_card_talent',action_card_property:{card:c.id,talent:c.talents?.slice()},source_id:-1});for(const event of ['CONDITION_CARD_AMOUNT','CONDITION_CARD_AMOUNT_SET'])this.call('procCardEvent',event,c.card_place,-1);this.call('procCardEvent','CONDITION_CARD_AMOUNT_COMPARE',0,-1);}
 getTalentBaseEnum(text){const s=text.toUpperCase();for(const name of ['TALENT_EXHAUST','TALENT_REMOVE','TALENT_RECALL','TALENT_BIND','TALENT_UNIQUE_TIPERA','TALENT_UNIQUE_OLGA','TALENT_UNIQUE_OLGA1','TALENT_UNIQUE_OLGA2'])if(s===name||s.startsWith(name+'_'))return T[name];
  if(s==='TALENT_IGNITE'||s.startsWith('TALENT_IGNITE_'))return T.TALENT_IGNITE;if(T[s]!=null)return T[s];if(s.startsWith('TALENT_CONNECT'))return T.TALENT_CONNECT;return undefined;
 }
 resetTalentCount(c,t){let keys=[];switch(t){case T.TALENT_EXHAUST:keys=['exhaust_count'];break;case T.TALENT_REMOVE:keys=['remove_count'];break;case T.TALENT_RECALL:keys=['recall_count'];break;case T.TALENT_BIND:keys=['bind_count','base_bind_count','bind_max_count'];break;case T.TALENT_IGNITE:keys=['ignite_count'];break;case T.TALENT_UNIQUE_TIPERA:keys=['tipera_count','base_tipera_count'];break;case T.TALENT_UNIQUE_OLGA:keys=['olga_count','base_olga_count'];break;}keys.forEach(k=>c[k]=undefined);}
 addTalents(id,texts,skipNotify){const c=this.b.cardMap[id],testament=c.talents?.includes(T.TALENT_TESTAMENT)===true;let changed=false;
  for(const text of texts){const s=text.toUpperCase();let talent=T[s],handled=false;
   for(const key of ['exhaust','remove','recall','bind']){const name='TALENT_'+key.toUpperCase();if(!s.startsWith(name))continue;handled=true;talent=T[name];if(c.talents?.includes(talent))break;
    const p=key==='bind'?parseBindTalent(s):undefined,n=key==='bind'?(p?.stack??0):Number(s.slice(name.length+1));c[key+'_count']=n==0?0:n-1;if(key==='bind'&&p?.max!=null)c.bind_max_count=p.max;(c.talents??=[]).push(talent);changed=true;break;
   }if(handled)continue;
   if(s==='TALENT_IGNITE'||s.startsWith('TALENT_IGNITE_')){talent=T.TALENT_IGNITE;if(c.talents?.includes(talent))continue;c.ignite_count??=0;}
   else if(getOlgaTalentBase(s)!=null){talent=getOlgaTalentBase(s);if(c.talents?.includes(talent))continue;c.base_olga_count=parseOlgaMaxStack(s);c.olga_count=0;}
   else if(s==='TALENT_CONNECT_INFINITE'){talent=T.TALENT_CONNECT_INFINITE;if(c.talents?.includes(talent))continue;}
   else if(talent==null||c.talents?.includes(talent)){if(!s.startsWith('TALENT_CONNECT')||c.talents?.includes(T.TALENT_CONNECT))continue;talent=T.TALENT_CONNECT;}
   (c.talents??=[]).push(talent);changed=true;
  }
  if(!testament&&c.talents?.includes(T.TALENT_TESTAMENT))addTestamentInterruptOutline(c);
  if(changed&&!skipNotify){this.call('pushChangeData','card',id);this.notify(c);}
 }
 removeTalents(id,texts){const c=this.b.cardMap[id],removed=[];for(const text of texts){const t=T[text.toUpperCase()];if(!c.talents?.includes(t))continue;c.talents.splice(c.talents.indexOf(t),1);if(!c.talents.length)c.talents=undefined;removed.push(t);}
  if(!removed.length)return;if(removed.includes(T.TALENT_RECALL))this.call('procCardEvent','CONDITION_CARD_TALENT_RECALL_REMOVED',0,id);if(removed.includes(T.TALENT_CONNECT))this.call('procCardEvent','CONDITION_CARD_TALENT_CONNECT_REMOVED',0,id);this.notify(c);
 }
 replaceTalents(id,texts){if(!texts.length)return;const c=this.b.cardMap[id];texts.forEach(text=>{const t=this.getTalentBaseEnum(text);if(t==null)return;const i=c.talents?.indexOf(t)??-1;if(i>=0){c.talents.splice(i,1);if(!c.talents.length)c.talents=undefined;}this.resetTalentCount(c,t);});this.addTalents(id,texts);}
}
