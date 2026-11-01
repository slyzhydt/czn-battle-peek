// Native handwritten algorithms for getTargetCards closures 158..166.
// Main call +15725; closure bytecodes 0x77300..0x7c400 are fully retained.
import {UnresolvedTargetRule} from './selection-core.mjs';
const need=(ok,path)=>{if(!ok)throw new UnresolvedTargetRule(path);};
const field=(obj,key)=>{need(obj!==null&&obj!==undefined&&Object.hasOwn(obj,key),`missing ${key}`);return obj[key];};
const array=(value,path)=>{need(Array.isArray(value),`missing resolved ${path}`);return value;};
const call=(api,key,...args)=>{need(typeof api[key]==='function',`missing ${key}`);const value=api[key](...args);need(value!==undefined,`missing ${key}.result`);return value;};

/** `recurse` is the same independent getTargetCardsReconstructed function, passed
 * by target-core to avoid a circular import. It is never an opaque game helper.
 * Resource link arrays must have been decoded already. A confirmed absent CS
 * emits its game diagnostic and continues; a missing linked skill is a game throw.
 */
export function filterLinkedCSCards(candidates,options,recurse) {
  const {battle,skill,row,api={},isRandom}=options;
  let ret=candidates.slice();
  const card=id=>{const c=field(battle,'cardMap')[id];need(c!=null,`missing card ${id}`);return c;};
  for(const csResID of (field(skill,'link_cs_ids')??[])){
    const csInfo=call(api,'readCSResource',csResID);
    if(csInfo===null){
      need(typeof api.reportContentError==='function','missing reportContentError');
      api.reportContentError(`err:cs_not_found:${csResID}:at ${skill.res_id}`);continue;
    }
    for(const effID of array(field(csInfo,'link_skill_eff_id'),'cs.link_skill_eff_id')){
      const info=call(api,'skillEffInfo',effID);
      if(info===null)throw new Error(`game behavior: err:cs_skill_not_found:${effID}:parent_${csResID}`);
      switch(field(info,'eff')){
        case 'SKILL_EFF_CARD_REFRESH':
          ret=ret.filter(id=>!(card(id).continueSkill??[]).some(cid=>{
            const cs=field(battle,'csMap')[cid];
            return cs!=null&&cs.res_id==field(csInfo,'id')&&cs.term_value==Number(field(csInfo,'overlay_value_max'));
          }));break;
        case 'SKILL_EFF_CARD_USE_BAN':
          ret=ret.filter(id=>!card(id).banned||(card(id).banned_allow_use&&(info.eff_opts??[]).includes('allow_use')));break;
        case 'SKILL_EFF_CARD_COST_CHANGE': {
          ret=ret.filter(id=>!call(api,'isRestricted',id,'RESTRICT_COST_CHANGE'));
          if(isRandom&&field(row,'eff_value_math_sign')==='MATHSIGN_ADD'){
            const sign=field(info,'eff_value_math_sign');
            if(sign==='MATHSIGN_SUBTRACT_MIN_0'||(sign==='MATHSIGN_SET'&&field(info,'eff_value')==0))
              ret=ret.filter(id=>field(card(id),'cost_result')>0);
          }
          break;
        }
        case 'SKILL_EFF_CARD_RETAIN': {
          const passives=array(call(api,'getPassiveByType',{source_id:field(battle.char,'id'),type:'SKILL_EFF_CARD_RETAIN',is_card:false}),'user retain passives'),userRetainCards=[];
          for(const passive of passives){
            const skillId=field(passive,'skill_id'),nested=field(battle,'skillMap')[skillId];need(nested!=null,`missing passive skill ${skillId}`);
            const nestedRow=call(api,'skillEffInfo',field(nested,'res_id'));need(nestedRow!==null,`missing passive skill resource ${nested.res_id}`);
            need(typeof recurse==='function','missing independent target recursion');
            const targets=recurse({...options,skill:nested,skillId,row:nestedRow,query:false,alreadyShuffled:false,ignoreCount:true,overridePlace:undefined}).target_cards_id;
            // Array.filter sees the reducer accumulator before this entire push.
            userRetainCards.push(...targets.filter(id=>!userRetainCards.includes(id)));
          }
          const ethereal=call(api,'talentEnum','TALENT_ETHEREAL'),retain=call(api,'talentEnum','TALENT_RETAIN');
          ret=ret.filter(id=>{
            const talents=card(id).talents??[];
            if(talents.includes(ethereal)||talents.includes(retain))return false;
            if(array(call(api,'getPassiveByType',{source_id:id,type:'SKILL_EFF_CARD_RETAIN',is_card:true}),'card retain passives').length)return false;
            return !userRetainCards.includes(id);
          });
          break;
        }
        default:break; // The shipped closure singles out only these four effects.
      }
    }
  }
  return ret;
}
