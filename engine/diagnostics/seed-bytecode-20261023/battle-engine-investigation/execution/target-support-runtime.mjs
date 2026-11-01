// Handwritten target-pipeline adapters. See evidence/batch1-target/COVERAGE.md.
// No recovered JS is imported or executed.
import fs from 'node:fs';
import {MissingBattleRule} from './resource-store.mjs';
const talents=JSON.parse(fs.readFileSync(new URL('../../card-pool-investigation/talent-enum.json',import.meta.url),'utf8'));
const talentNames=Object.fromEntries(Object.entries(talents).map(([name,id])=>[id,name]));
const restrictions=JSON.parse(fs.readFileSync(new URL('../cards/restrictions.symbolic.json',import.meta.url),'utf8'));
export const TARGET_SUPPORT_METHODS=['readCSResource','talentEnum','charCombatantEgo','getSavedCardCandidates','isCardRestrictedByInfo','emitCopyBlockedToast','ownerFaction','getModel','stageCharacters','isCollapseOnCharacter','monsterGrade','hasTriggerMotion','currentHP','hpRatio','randomArrayMembers'];
export class TargetSupportRuntime {
  constructor(e){this.e=e;this.b=e.b;this.db=e.db;}
  call(name,...args){return this.e.call(name,...args);}
  // A present resource table with no ID is native absence, not an unknown table.
  // Linked-CS filtering requires the native toArray result, not carrier text.
  readCSResource(id){const row=this.db.table('cs')[id];return row?{...row,link_skill_eff_id:this.db.array(row.link_skill_eff_id)}:null;}
  talentEnum(name){if(!(name in talents))throw new MissingBattleRule('target.talentEnum',{name});return talents[name];}
  charCombatantEgo(id){return this.db.get('char_combatant',id).link_ego_type_id;}
  getSavedCardCandidates(skill){const key=this.call('getSavedIndex',skill.skill_id);return this.b.savedTargetCandidates[key]??[];}
  // getTargetCards closure 0x67700 supplies ONLY talents to isCardRestricted.
  // Applying the card's sort here would change the earlier original-copy filter.
  isCardRestrictedByInfo(id,restriction){return this.call('getTalentByInfo',this.b.cardMap[id]).some(t=>restrictions.talents[talentNames[t]??t]?.includes(restriction));}
  emitCopyBlockedToast(){this.e.pushAction({id:this.b.last_action_id++,type:'action_toast',source_id:-1,msg:'battle_toast_try_origin_card_copy'});}
  // getTargetCards 0x6f000: character first, then support fallback. The card
  // resource read precedes both even though its return is unused in the source.
  ownerFaction(id){const card=this.b.cardMap[id];this.db.get('card',card.res_id);
    const char=this.call('tryGetCharByCharId',card.char_id)||this.e.state.worktables.BattleInitWorktable.battle_init.sups.find(x=>x&&x.id==card.char_id);
    return char?this.db.get('char_base',char.res_id).link_faction_id:null;
  }
  getModel(id){return this.db.get('char_base',id).model;}
  stageCharacters(){return this.e.state.worktables.BattleStageWorktable.battle_stage.chars;}
  isCollapseOnCharacter(char){return char.collapse_on==true;}
  monsterGrade(id){return this.db.get('monster',id).grade;}
  // Constants are exact literals from skill_effect_enums root @99 and @104.
  hasTriggerMotion(type){return type!='none'&&type!='motion_timing_only';}
  // Ranking helpers deliberately read raw status. getStatus may apply passives
  // and would introduce behavior/RNG absent from TargetProc's ranking callbacks.
  currentHP(unit){return unit.status.info.S_CURRENT_HP;}
  hpRatio(unit){return unit.status.info.S_CURRENT_HP/unit.status.info.S_HP;}
  // GameRandom 0x5300. Count is capped even when repeat=true; neither the final
  // singleton nor an equal-bound range is optimized away. Source leaves the
  // input untouched. Fractional/NaN/negative count follows native loop tests.
  randomArrayMembers(type,array,count,repeat){const result=[],indexes=[];count=Math.min(count,array.length);
    if(repeat){for(let i=0;i<count;i++)result.push(this.e.random.randomArrayMember(type,array));}
    else{for(let i=0;i<array.length;i++)indexes.push(i);for(let i=0;i<array.length&&i<count;i++){const k=this.e.random.randRange(type,0,indexes.length);result.push(array[indexes[k]]);indexes.splice(k,1);}}
    return result;
  }
}
