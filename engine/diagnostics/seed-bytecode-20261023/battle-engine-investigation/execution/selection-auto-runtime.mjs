// Handwritten migration. card_auto_priority0x38a00/3ba00/3c100;
// procSkillInterrupt0xa0200 callbacks118..133. No recovered code is executed.
import fs from 'node:fs';
import {TALENTS as T} from './card-talent-support.mjs';
const priority=JSON.parse(fs.readFileSync(new URL('./evidence/selection-runtime/auto-priority/priority-data.json',import.meta.url),'utf8'));
const variant=/_(rsp\d+|lbk|pot|mut\d*)$/,col2=/_col2$/;
const protectedCards=new Set(['c_30047_srt4','c_30134_cre1','c_30134_srt4','c_1060_uni4']);
export function getCardAutoPriority(res){let current=res;for(;;){const value=priority[current];if(value!==undefined)return value===0?9999:value;const next=current.replace(variant,'');if(next===current)break;current=next;}const col=res.replace(col2,'_col');if(col!==res&&priority[col]!==undefined)return priority[col]===0?9999:priority[col];if(res.startsWith('card_ab_'))return 7;if(['card_mon_','card_enc_','card_etc_','card_ne_','card_qu_','card_ta_pn_','card_ds01_','card_ds02_','card_ds03_'].some(p=>res.startsWith(p)))return 6;return 9999;}
export function isCardDiscardProtected(res){let current=res;for(;;){if(protectedCards.has(current))return true;const next=current.replace(variant,'');if(next===current)break;current=next;}const col=res.replace(col2,'_col');return col!==res&&protectedCards.has(col);}
export class SelectionAutoRuntime {
 constructor(e){this.e=e;this.b=e.b;this.w=e.wt;this.db=e.db;}
 call(n,...a){return this.e.call(n,...a);}
 hasIncinerateTrigger(res){const r=this.db.table('card')[res];if(!r)return false;for(const id of this.db.array(r.link_skill_eff_id)){const s=this.db.table('skill_eff')[id];if(s&&typeof s.eff_link_condition_id==='string'&&s.eff_link_condition_id.startsWith('cdp_incinerate'))return true;}return false;}
 choose(s,r,candidates,to,skillType,max,min){const selected=[],card=id=>this.b.cardMap[id],rank=id=>getCardAutoPriority(card(id).res_id),asc=(a,b)=>rank(a)-rank(b),desc=(a,b)=>rank(b)-rank(a),left=()=>candidates.filter(i=>!selected.includes(i)),take=(a,n)=>selected.push(...a.slice(0,n-selected.length)),shuffle=a=>{this.call('shuffleInPlace',3,a);return a;},eff=r.eff,copy=['SKILL_EFF_CARD_COPY_TO','SKILL_EFF_CARD_COPY_TO_IGNORE_COND','SKILL_EFF_CARD_COPY_TO_EXCEPT_CS','SKILL_EFF_CARD_COPY_TO_ORIGIN','SKILL_EFF_CARD_COPY_TO_IGNORE_COND_ORIGIN','SKILL_EFF_CARD_COPY_TO_EXCEPT_CS_ORIGIN'].includes(eff),n=Math.min(max,candidates.length);
  if((eff==='SKILL_EFF_CARD_MOVE_TO'||copy)&&to===2||['SKILL_EFF_CARD_DRAW','SKILL_EFF_CARD_DRAW_WHILE_UNIQUE'].includes(eff)){
   const zero=candidates.filter(i=>card(i).cost_result==0);if(zero.length){shuffle(zero);const cats={CARD_POWER:0,CARD_SKILL:1,CARD_ATK:2};zero.sort((a,b)=>{const d=-(cats[this.db.get('card',card(a).res_id).card_category]-cats[this.db.get('card',card(b).res_id).card_category]);return d==0?asc(a,b):d;});take(zero,n);}if(selected.length<n)take(left().sort(asc),n);
  }else if(eff==='SKILL_EFF_CARD_MOVE_TO'&&to===4||eff==='SKILL_EFF_CARD_EXHAUST'||skillType==='SKILL_EFF_CARD_DISCARD'){
   const discard=skillType==='SKILL_EFF_CARD_DISCARD';if(discard){const a=candidates.filter(i=>this.call('isCardTestament',i));if(a.length)take(shuffle(a),n);}
   if(discard&&selected.length<n){const parent=s.parent.type==='CARD'?card(s.parent.id)?.res_id:undefined;if(parent!=null&&parent.startsWith('c_30134_uni2_rsp2')){const a=left().filter(i=>{const t=card(i)?.talents;return t!=null&&(t.includes(T.TALENT_LIGHT)||t.includes(T.TALENT_DARK));});if(a.length)take(shuffle(a),n);}}
   if(!discard&&selected.length<n){const a=left().filter(i=>this.hasIncinerateTrigger(card(i).res_id));if(a.length)take(shuffle(a),n);}
   if(selected.length<n){const a=left().filter(i=>{const c=card(i),row=this.db.get('card',c.res_id);return !this.call('getTalentByInfo',c).includes(T.TALENT_ETHEREAL)&&['CARD_ABNORM','CARD_CURSE'].includes(row.card_category);});if(a.length)take(shuffle(a),n);}
   if(selected.length<n)take(left().filter(i=>rank(i)>=6).sort(desc),n);
   const preferred=discard?n:min;if(selected.length<preferred)take(left().filter(i=>!card(i)||!isCardDiscardProtected(card(i).res_id)).sort(desc),preferred);
   if(selected.length<min)take(left().sort(desc),min);
  }else if(skillType==='SKILL_EFF_CARD_TALENT_ADD'){
   const connect=(s.eff_opts??[]).includes('TALENT_CONNECT');const tier=id=>{if(!connect)return 0;const c=card(id);if(!c)return 3;const yes=c.talents?.includes(T.TALENT_CONNECT)===true||c.talents?.includes(T.TALENT_CONNECT_INFINITE)===true||c.connect_passive===true,testament=c.talents?.includes(T.TALENT_TESTAMENT)===true||c.testament_passive===true;return testament&&!yes?0:yes?1:2;};take(candidates.slice().sort((a,b)=>tier(a)-tier(b)||asc(a,b)),n);
  }else if(skillType==='SKILL_EFF_CARD_USE')take(candidates.slice().sort(asc),n);
  // Native fallback uses the full candidate list, including already selected IDs.
  if(selected.length<min)selected.push(...this.e.random.randomArrayMembers(3,candidates,min-selected.length));return selected;
 }
}
