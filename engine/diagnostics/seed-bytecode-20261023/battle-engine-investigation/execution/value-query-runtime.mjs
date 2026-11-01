// Independent ports of shared dynamic-value queries. Original instructions:
// evidence/batch1-value/{queries,card,synergy,names,defines}; no recovered code runs.
import fs from 'node:fs';
import path from 'node:path';
import {MissingBattleRule} from './resource-store.mjs';
import {parseCardCountOpts,buildCardFilterCommon} from '../attributes/card-count-filter.mjs';
const ENUMS=JSON.parse(fs.readFileSync(new URL('./value-enums.json',import.meta.url),'utf8'));
const VISIBLE=new Set(['SHOW_TYPE_ICON','SHOW_TYPE_ICON_NOT_NOTI','SHOW_TYPE_ICON_NOT_LOG','SHOW_TYPE_ICON_OUTLINE']);
export const VALUE_QUERY_METHODS=['getContinueSkillsByCharID','getCsBuffTypeCount','getCSCount','getCSTermValue','matchCsBuffType','getDesireCount','getBattleCardSameNameKey'];
export class ValueQueryRuntime {
  constructor(e){this.e=e;this.b=e.b;this.db=e.db;this.texts=new Map();}
  call(n,...a){return this.e.call(n,...a);}
  // getContinueSkillsByCharID 0x188600: supports both support slot and its
  // original character, preserving duplicates and enumeration order.
  getContinueSkillsByCharID(id){
    if(this.call('isMonsterByID',id))return this.call('getContinueSkills',this.e.getUnit(id));
    const unit=this.b.char,out=unit.continueSkill.slice(),support=[4,5,6].includes(id);
    for(const key of ['continueSkillChar','continueSkillCaster'])if(unit[key]){
      if(unit[key][id])out.push(...unit[key][id]);
      if(support&&unit[key][id-3])out.push(...unit[key][id-3]);
    }return out;
  }
  // continue_skill.matchCsBuffType 0x7100. A neutral type only matches itself.
  matchCsBuffType(actual,wanted,value){return actual==wanted||wanted==='CS_DEBUFF'&&actual==='CS_DEBUFF_DOT'||
    (wanted==='CS_BUFF'||wanted==='CS_DEBUFF')&&actual==='CS_BUFF_DEBUFF'&&(wanted==='CS_BUFF'?value>0:value<0);}
  getCsBuffTypeCount(id,type){let count=0;for(const key of this.getContinueSkillsByCharID(id)){
    const cs=this.b.csMap[key];if(!cs||cs.removed)continue;const r=this.db.get('cs',cs.res_id);if(!VISIBLE.has(r.show_type))continue;
    const value=cs.effective_term_value??cs.term_value;
    if(type==='CS_BUFF'&&(r.cs_buff_type==='CS_BUFF'||r.cs_buff_type==='CS_BUFF_DEBUFF'&&value>0))count++;
    else if(type==='CS_DEBUFF'&&(this.call('baseDebuffType',r.cs_buff_type)||r.cs_buff_type==='CS_BUFF_DEBUFF'&&value<0))count++;
  }return count;}
  csTypeAmount(id,type,sum){let result=0;for(const key of this.call('getContinueSkills',this.e.getUnit(id))){
    const cs=this.b.csMap[key];if(cs==null||cs.removed)continue;const r=this.db.get('cs',cs.res_id);if(!VISIBLE.has(r.show_type))continue;
    const value=cs.effective_term_value??cs.term_value;
    if(this.matchCsBuffType(r.cs_buff_type,type,value))result+=sum?Math.abs(value):1;
  }return result;}
  getCSCount(id,type){return this.csTypeAmount(id,type,false);}
  getCSTermValue(id,type){return this.csTypeAmount(id,type,true);}
  // SynergyProc.getDesireCount 0x3a00: cached zero is meaningful. The fallback
  // includes resource talents + add_talents, not the flattened current talents.
  getDesireCount(card,talent){const cached=card.desire_talent_counts?.[talent];if(cached!=null)return cached;
    const ts=this.e.valueTarget.talents,row=this.db.table('card')[card.res_id];
    return [...this.db.array(row?.talent).map(n=>ts[n]),...(card.add_talents??[])].filter(n=>n==talent).length;
  }
  getCardNameText(id){if(!id||id==='none')return;const locale=this.e.valueTextLocale;
    if(!locale)throw new MissingBattleRule('value_query.localization_input',{required:'valueTextLocale',available:'zht'});
    if(!this.texts.has(locale)){const p=path.join(this.db.root,'localization','text',locale,'text.json');
      if(!fs.existsSync(p))throw new MissingBattleRule('value_query.localization_input',{locale,path:p});
      this.texts.set(locale,new Map(JSON.parse(fs.readFileSync(p,'utf8')).map(row=>[row.id,row.text])));}
    return this.texts.get(locale).get(id)||undefined;
  }
  getCardSameNameKey(name,res){const text=(name?this.getCardNameText(name):undefined)||name||res;
    // card_name_util0x700 strips each simple ASCII-parenthesized group.
    return text.replace(/\([^()]*\)/g,'').trim();
  }
  getBattleCardSameNameKey(card){const r=this.db.table('card')[card.res_id],name=r?.name;
    if(card.card_r_spark_changed&&name==='none'&&card.r_spark){const spark=this.db.table('card_r_spark')[card.r_spark.res_id],id=spark?.link_card_id;
      if(id){const origin=this.db.table('card')[id];if(origin)return this.getCardSameNameKey(origin.name,origin.id);}}
    return this.getCardSameNameKey(name,r?.id??card.res_id);
  }
  buildCardFilter(skillId,options,extra){const s=this.b.skillMap[skillId],call=(n,...a)=>this.call(n,...a);
    return buildCardFilterCommon({getCard:id=>this.b.cardMap[id],isUninteractible:id=>call('isCardUninteractible',id),
      getSorts:id=>call('getSort',id),checkEgo:(id,ego)=>call('checkEgo',id,[call('convertEgoCommon',ego)]),
      hasTalent:(id,talent,place)=>call('hasTalent',id,talent,place!=null?{place}:undefined),isConnected:id=>call('isCardConnected',id),
      getThisCardId:()=>call('getParentCard',skillId)?.id,action_char_id:s.action_char_id,place_of:extra?.place_of},
      options,extra,{...ENUMS,CARD_PLACE:this.e.valueTarget.places,TALENT:this.e.valueTarget.talents},id=>this.db.get('card',id));
  }
  callbacks(skillId){return {
    battleCardSameNameKey:card=>this.getBattleCardSameNameKey(card),
    buildCardFilter:(options,extra)=>this.buildCardFilter(skillId,options,extra),parseCardCountOpts,
    cardCost:id=>this.call('getCost',id),cardEgo:id=>this.call('getEgo',id),cardCheckEgo:(id,values)=>this.call('checkEgo',id,values),
    convertEgoCommon:ego=>this.call('convertEgoCommon',ego),getCSCount:(id,type)=>this.getCSCount(id,type),
    getCSTermValue:(id,type)=>this.getCSTermValue(id,type),getDesireCount:(card,talent)=>this.getDesireCount(card,talent),
    isCardUninteractible:id=>this.call('isCardUninteractible',id),sumFieldMonsterTurnCount:monsters=>this.call('sumFieldMonsterTurnCount',monsters),
    // procValueType calls resolveStatSource(worktable,skill_id,skill.stat_source).
    resolveStatSource:source=>this.call('resolveStatSource',skillId,source)
  };}
}
