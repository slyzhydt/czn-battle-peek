// Hand port: SkillEffectProc.checkValueAddOpts 0x3b600 (offsets 0..5563),
// including closures 0x3c200..0x49600. Original bytecode is never executed.
import fs from 'node:fs';
import {compareCondition} from '../conditions/condition-core.mjs';
import {MissingBattleRule} from './resource-store.mjs';
const DVA_EFFS=['SKILL_EFF_DAMAGE_VALUE_ADD','SKILL_EFF_DMG_VALUE_ADD_ADDITIONAL','SKILL_EFF_CRITICAL_DAMAGE_VALUE_ADD','SKILL_EFF_FINAL_DAMAGE_VALUE_ADD'];
const TALENTS=JSON.parse(fs.readFileSync(new URL('../../card-pool-investigation/talent-enum.json',import.meta.url),'utf8'));
for(const [k,v]of Object.entries(TALENTS))TALENTS[v]=k;Object.freeze(TALENTS);
export class ValueAddFilterRuntime {
  constructor(e){this.e=e;this.b=e.b;this.db=e.db;this.talents=TALENTS;}
  call(n,...a){return this.e.call(n,...a);}
  array(v){return Array.isArray(v)?v:this.db.array(v);}
  compare(op,left,right){return compareCondition('INEQUALITY_'+op.toUpperCase(),left,right);}
  // ContentsProc 0x3f00 + EGO_TYPE_STRING 0x46300 in defines.js.
  convertEgoCommon(value){
    if(typeof value!=='string')return 'NONE';
    const aliases={RED:'EGO_LOVE',GREEN:'EGO_NORMS',BLUE:'EGO_NARCISSISM',ORANGE:'EGO_INSTINCT',PURPLE:'EGO_CREED',BASIC:'EGO_BASIC',OWNER:'EGO_OWNER',ALL:'EGO_ALL'};
    if(Object.hasOwn(aliases,value))return aliases[value];
    return Object.values(aliases).includes(value)?value:'NONE';
  }
  // BattleCardProc 0x90800: random/all/player selections need no chosen monster.
  getTargetTypeByTargetForUI(value){return ['TARGET_SELECTED_MONSTER','TARGET_SELECTED_MONSTER_AUTO_RANDOM','TARGET_SELECTED_WITH_SPLASH','TARGET_MOST_MAX_HP_MONSTER'].includes(value)?'TARGET_MONSTER':'TARGET_NOTHING';}
  getCombatantEgo(id){const c=this.call('tryGetCharByCharId',id);if(c==null)return 'NONE';const r=this.db.table('char_combatant')[c.res_id];return r==null?'NONE':this.convertEgoCommon(r.link_ego_type_id);}
  checkEgo(id,values){if(!this.b.cardMap[id])return false;const ego=this.getEgo(id);return ego==='EGO_ALL'||values.includes(ego);}
  // 0x26b00: last card passive wins; otherwise last matching unit passive wins.
  // Every success writes curEgo, including queries made from passive filters.
  getEgo(id){
    const c=this.b.cardMap[id];if(!c)return 'NONE';const row=this.db.get('card',c.res_id),type='SKILL_EFF_CHANGE_EGO';
    const units=this.call('getPassiveByType',{source_id:this.b.char.id,type,is_card:false,char_id:c.char_id}),cards=this.call('getPassiveByType',{source_id:c.id,type,is_card:true});
    if(cards.length){const last=cards.at(-1),ego=last.eff_opt_multiple_link?.[0];if(!ego)throw new MissingBattleRule('getEgo.invalid_ego_change',{res_id:last.res_id});c.curEgo=ego;return this.convertEgoCommon(c.curEgo);}
    if(units.length){let changed=false,value='NONE';for(const p of units)if(this.call('getTargetCards',p.skill_id,false,false,false).target_cards_id.includes(c.id)){changed=true;value=p.eff_opt_multiple_link?.[0];}if(changed){c.curEgo=value;return this.convertEgoCommon(c.curEgo);}}
    if(this.convertEgoCommon(row.ego_type)==='EGO_OWNER'){
      const charId=[4,5,6].includes(c.char_id)?c.char_id-3:c.char_id,stageChar=this.call('tryGetStageCharByCharId',charId);
      // The game's bad-owner branch marks the server save dirty and throws.
      // Invalid offline inputs are rejected; no fictitious save context is made.
      if(stageChar==null)throw new MissingBattleRule(charId==7?'getEgo.assault_fourth_char_not_found':'getEgo.invalid_char_id_with_EGO_OWNER',{char_id:charId,res_id:row.id,native_dirty_battle_save:charId!=7});
      const cr=this.db.table('char_combatant')[stageChar.res_id];c.curEgo=cr?this.convertEgoCommon(cr.link_ego_type_id):c.curEgo;return c.curEgo;
    }
    c.curEgo=this.convertEgoCommon(row.ego_type);return c.curEgo;
  }
  // BattleWorktable 0x19a200: raw snapshot status, with source FP order.
  getParameterValueByKeyword(id,key){
    const s=this.e.getUnit(id).status.info;
    switch(key){case 'cur_hp':return s.S_CURRENT_HP;case 'max_hp':return s.S_HP;case 'shield':return s.S_CURRENT_SHIELD;case 'cur_hp_pct':return s.S_CURRENT_HP*100/s.S_HP;case 'shield_def_pct':return s.S_CURRENT_SHIELD/s.S_DEF*100;default:throw new MissingBattleRule('invalid_eff_opt:'+key);}
  }
  // Constants are loaded with Number(constant_meta[key].value), 0x3a00.
  getPlayerInjuryLt(){return Number(this.db.get('constant_meta','player_injury_lt').value);}
  getPlayerViabilityGe(){return Number(this.db.get('constant_meta','player_viability_ge').value);}
  monsterThreshold(kind){
    let value=Number(this.db.get('constant_meta','monster_'+kind).value);
    for(const p of this.call('getPassiveByType',{source_id:this.b.char.id,type:'SKILL_EFF_MONSTER_'+kind.toUpperCase()+'_VALUE_ADD',is_card:false}))value=this.call('procMathSign',this.db.get('skill_eff',p.res_id).eff_value_math_sign,value,this.call('calcValue',p.skill_id));
    return value;
  }
  getCurMonsterInjuryLt(){return this.monsterThreshold('injury_lt');}
  getCurMonsterViabilityGe(){return this.monsterThreshold('viability_ge');}
  isInjury(id){const pct=this.getParameterValueByKeyword(id,'cur_hp_pct'),threshold=this.e.getMonster(id)?this.getCurMonsterInjuryLt():this.getPlayerInjuryLt();return this.compare('LT',pct,threshold);}
  isViability(id){const pct=this.getParameterValueByKeyword(id,'cur_hp_pct'),threshold=this.e.getMonster(id)?this.getCurMonsterViabilityGe():this.getPlayerViabilityGe();return this.compare('GE',pct,threshold);}
  // BattleCardProc 0x80500: primary sort first, added sorts in first-seen order.
  getSort(id){const c=this.b.cardMap[id],out=[this.db.get('card',c.res_id).sort];for(const x of c.add_sorts??[])if(!out.includes(x))out.push(x);return out;}
  // BattleWorktable 0x212000. Global connect passives still use the ordinary
  // target-card resolver with its three false flags; no unconditional match.
  isCardConnected(id){
    const c=this.b.cardMap[id];if(!c||this.call('isCardUninteractible',id))return false;
    if(c.talents?.includes(this.talents.TALENT_CONNECT)||c.talents?.includes(this.talents.TALENT_CONNECT_INFINITE))return true;
    if(this.call('getPassiveByType',{source_id:id,type:'SKILL_EFF_CARD_CONNECT',is_card:true}).length>0||c.connect_passive)return true;
    for(const p of this.call('getPassiveByType',{source_id:this.b.char.id,type:'SKILL_EFF_CARD_CONNECT',is_card:false}))if(this.call('getTargetCards',p.skill_id,false,false,false).target_cards_id.includes(id))return true;
    return false;
  }
  // skill_eff.hasEgoField 0x7600: existence of max, including max === 0.
  hasEgoField(target){return target.ego_field_max_value!=null;}
  // checkCSopts 0x8700, same algorithm as targeting/unit-option-filters.mjs;
  // native optional removed fields are allowed here (undefined means active).
  checkCSopts(choices,target){
    const ids=this.call('getContinueSkills',target),active=id=>{const cs=this.b.csMap[id];return cs&&!cs.removed?cs:undefined;};
    return choices.some(option=>{const parts=option.split(':');if(parts.length===1)return ids.some(id=>active(id)?.res_id==option);
      const sum=ids.reduce((n,id)=>{const cs=active(id);return cs&&cs.res_id==parts[0]?n+cs.term_value:n;},0);
      return compareCondition('INEQUALITY_'+parts[1].slice(0,2),sum,Number(parts[1].slice(2)));
    });
  }
  // BattleCardProc 0x92b00 + closures: exact skill list order and optional CSs.
  isTriggerInspiration(id){
    const c=this.b.cardMap[id];if(!c)return;const matches=sid=>(this.b.skillMap[sid].eff_opts??[]).includes('trigger_inspiration');
    if(c.skill_eff_ids.concat(c.r_spark_skill_eff_ids??[],c.eidolon_skill_eff_ids??[]).some(matches))return true;
    return (c.continueSkill??[]).some(id=>{const cs=this.b.csMap[id];return cs?cs.skillEffs.some(matches):false;});
  }
  checkValueAddOpts(a){
    const p=this.b.skillMap[a.passive_id],r=this.db.get('skill_eff',p.res_id),id=a.card_id,t=a.target,opts=p.eff_opts??[],egoAttack=a.egoAttack??false;
    const arr=k=>this.array(r[k]),has=x=>opts.includes(x),card=()=>this.b.cardMap[id];
    if(opts.some(x=>x.toLowerCase()==='not_dmg_attr_additional_attack')&&a.dmg_attr?.includes('DMG_ATTR_ADDITIONAL_ATTACK'))return false;
    if(r.target_unit_type==='TARGET_UNIT_EXCEPT_CHAR'&&p.action_char_id==this.b.skillMap[a.skill_id].action_char_id)return;
    if(p.link_cs_ids?.length){const s=this.b.skillMap[a.skill_id];if(s.parent.type!=='CS')return false;const cs=this.b.csMap[s.parent.id];if(!cs||!p.link_cs_ids.includes(cs.res_id))return false;}
    if(a.dmg_attr){if(arr('eff_attr').some(x=>!a.dmg_attr.includes(x)))return false;}
    else if(a.shield_attr&&arr('eff_attr').some(x=>!a.shield_attr.includes(x)))return false;
    if(r.target_card_set==='CARD_SET_GET_CARD'){if(!card()||!card().get_card)return false;}
    else if(r.target_card_set==='CARD_SET_DESIGNED'){const links=arr('target_card_set_opt_multiple_link');if(links.length&&(!card()||!links.includes(card().res_id)))return false;}
    else {const links=arr('target_card_set_opt_multiple_link').map(Number);if(links.length){if(!card())return false;const char=this.call('tryGetCharByCharId',card().char_id);if(!char||!links.includes(char.res_id))return false;}}
    const talent=arr('target_card_set_talent');
    if(talent.length){
      if(!card())return false;const inverse=talent.includes('not'),wanted=talent.filter(x=>x!=='not').map(x=>this.talents[x]);
      if(!inverse&&has('connect')&&(wanted.includes(this.talents.TALENT_CONNECT)||wanted.includes(this.talents.TALENT_CONNECT_INFINITE))){if(!this.call('isCardConnected',id))return false;}
      else {const matched=wanted.some(x=>this.call('hasTalent',id,x));if(inverse?matched:!matched)return;}
    }
    const rarity=arr('target_card_set_opt_rarity');if(rarity.length&&(!card()||!rarity.includes(this.db.get('card',card().res_id).rarity)))return false;
    const sorts=arr('target_card_set_card_sort');if(sorts.length){if(!card())return false;const matched=this.call('getSort',id).some(x=>sorts.includes(x));if(sorts.includes('not')?matched:!matched)return false;}
    const categories=arr('target_card_set_card_type');if(categories.length){if(!card()||this.call('isRestricted',card(),'RESTRICT_DAMAGE_TARGET')||!this.call('checkCategory',card().id,categories))return false;}
    const units=arr('target_unit_type_opt'),unit=x=>units.includes(x),combatant=unit('combatant')&&DVA_EFFS.includes(r.eff),egos=arr('target_card_set_ego_type').map(x=>this.call('convertEgoCommon',x));
    if(egos.length){
      if(combatant){const charId=id!=-1?(card()?.char_id??-1):(this.b.skillMap[a.skill_id]?.action_char_id??-1);if(!egos.includes(this.call('getCombatantEgo',charId)))return false;}
      else if(id!=-1){if(!this.call('checkEgo',id,egos))return false;}
      else if(a.ego_type&&!egos.includes(this.call('convertEgoCommon',a.ego_type)))return false;
    }
    const factions=arr('target_card_set_faction');if(factions.length){const init=this.e.state?.worktables?.BattleInitWorktable?.battle_init;if(!init)throw new MissingBattleRule('checkValueAddOpts.battle_init');if(!factions.includes(this.db.get('battle',init.battle_res_id).link_faction_id))return false;}
    if(unit('shield')&&(!t||this.call('getStatus',t.id,'S_CURRENT_SHIELD')<=0))return false;
    if(unit('not_shield')&&(!t||this.call('getStatus',t.id,'S_CURRENT_SHIELD')>0))return false;
    if(unit('ego_attack')&&egoAttack==false)return false;
    if(has('cri')&&!a.crit||has('except_critical')&&a.crit||has('first_hit')&&!a.first_hit)return false;
    if(has('card_throw')&&(this.b.before_used_card==null||this.b.before_used_card<0||id!=this.b.before_used_card))return false;
    if(has('from_hand')&&(!card()||!(card().card_place==2||card().card_place==7&&card().place_before_using==2)))return false;
    if(has('connect')&&!this.call('isCardConnected',id))return false;
    if(has('targeting_attack')){const previous=this.b.cardMap[this.b.prev_used_card??-1];if(!previous)return false;const cr=this.db.get('card',previous.res_id);if(cr.card_category!=='CARD_ATK'||this.call('getTargetTypeByTargetForUI',cr.target_for_ui)!=='TARGET_MONSTER')return false;}
    if(unit('n_atk')){if(!t||!t.nextCard||!(t.mon_turn==null||t.mon_turn>0)||!this.db.get('card',t.nextCard).monster_noti_category.includes('ATK'))return false;}
    else if(unit('not_n_atk')){if(!t||!t.nextCard||this.db.get('card',t.nextCard).monster_noti_category.includes('ATK'))return false;}
    if(unit('injury')&&(!t||!this.call('isInjury',t.id)))return false;
    if(unit('viability')&&(!t||!this.call('isViability',t.id)))return false;
    for(const type of ['debuff','debuff_dot','buff'])if(unit(type)){
      if(!t)return false;
      if(!this.call('getContinueSkills',t).some(id=>{const cs=this.b.csMap[id];if(!cs)return false;const bt=this.db.get('cs',cs.res_id).cs_buff_type;
        return type==='debuff'?(this.call('baseDebuffType',bt)||bt==='CS_BUFF_DEBUFF'&&cs.term_value<0):type==='debuff_dot'?bt==='CS_DEBUFF_DOT':bt==='CS_BUFF'||bt==='CS_BUFF_DEBUFF'&&cs.term_value>0;
      }))return false;
    }
    const hp=units.filter(x=>x.startsWith('target_hp_')),field=units.filter(x=>x.startsWith('ego_field_pct_'));
    if(hp.length){if(!t)return false;if(hp.some(x=>x.slice(10,13)==='pct'?!this.compare(x.slice(14,16),this.call('getStatus',t.id,'S_CURRENT_HP')/this.call('getStatus',t.id,'S_HP')*100,Number(x.slice(17))):!this.compare(x.slice(10,12),this.call('getStatus',t.id,'S_CURRENT_HP'),Number(x.slice(13)))))return;}
    if(field.length){if(!t)return false;if(field.some(x=>t.ego_field_max_value==null||!this.compare(x.slice(14,16),(t.ego_field_value??0)/t.ego_field_max_value*100,Number(x.slice(17)))))return;}
    if(unit('no_ego_field')&&(!t||!this.e.getMonster(t.id)||this.call('hasEgoField',t)))return false;
    if(unit('break')){if(!t)return false;if(!t.ego_breaked)return;}
    if(unit('destroy')&&!a.destroy)return;
    if(unit('notice_not_move')){if(!t)return false;if(t.mon_turn!=null&&t.mon_turn<0)return;}
    for(const x of units.filter(x=>x.startsWith('turn_count_'))){if(!t)return false;let turn=t.mon_turn??Infinity;if(turn<0)turn=0;if(!this.compare(x.slice(11,13),turn,Number(x.slice(13))))return false;}
    const linked=arr('target_unit_type_opt_link_cs_id').map(x=>{const stage=this.e.state?.worktables?.BattleStageWorktable?.battle_stage;if(!stage)throw new MissingBattleRule('checkValueAddOpts.battle_stage');return stage.break_cs_changes?.[x]??x;});
    if(linked.length&&(!t||!this.call('checkCSopts',linked,t)))return false;
    const cost=this.call('parseCardCostFilter',r.target_card_set_opt_cost);if(cost){if(!card())return false;const value=card().cost_before_using??(card().cost_result<0?0:card().cost_result);if(!this.call('applyCardCostFilter',cost,id,value))return false;}
    if(has('trigger_inspiration_card')&&(!card()||!this.call('isTriggerInspiration',id)))return false;
    return true;
  }
}
