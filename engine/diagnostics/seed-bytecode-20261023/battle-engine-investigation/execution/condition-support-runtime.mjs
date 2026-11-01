// Data-shape adapters for the independently handported condition predicates.
// Evidence: checkUnitOpt 0x53200 @439/593/884/1304/1431/1582/1692/1824/1891;
// procUnitEvent callback @16196..16329 and checkCondCard/check @0x11900.
import fs from 'node:fs';
const values=JSON.parse(fs.readFileSync(new URL('./value-enums.json',import.meta.url),'utf8'));
const literalMap=file=>Object.fromEntries([...fs.readFileSync(new URL(file,import.meta.url),'utf8').matchAll(/arg0\.(\w+) = "([^"]*)"/g)].map(m=>[m[1],m[2]]));
export const CONDITION_ENUMS={cardSort:values.CARD_SORT,cardCategory:values.CARD_CATEGORY,egoTypeString:values.EGO_TYPE_STRING,
 battleCardTarget:literalMap('../../card-pool-investigation/gamecore/battle/battle_enums.js.recovered.js'),
 csOrigin:literalMap('../attributes/gamecore/battle/continue_skill.js.recovered.js')};
CONDITION_ENUMS.BATTLE_CARD_TARGET=CONDITION_ENUMS.battleCardTarget;CONDITION_ENUMS.CS_ORIGIN=CONDITION_ENUMS.csOrigin;
export const CONDITION_SUPPORT_METHODS=['getCardRes','getCharBase','getMonsterRes','getSpecies','getCurrentShield','getConnectPassives','getCardSameNameCountInfo'];
export class ConditionSupportRuntime {
 constructor(e){this.e=e;this.db=e.db;}
 getCardRes(id){return this.db.table('card')[id]??null;}
 getCharBase(id){return this.db.table('char_base')[id]??null;}
 getMonsterRes(id){return this.db.table('monster')[id]??null;}
 getSpecies(id){return this.db.table('species')[id]??null;}
 getCurrentShield(id){return this.e.call('getStatus',id,'S_CURRENT_SHIELD');}
 // checkCardCondition local hook name: the native call is getPassiveByType.
 getConnectPassives(id,isCard){return this.e.call('getPassiveByType',{source_id:id,type:'SKILL_EFF_CARD_CONNECT',is_card:isCard});}
 // BattleCardProc module helper 0xbc00. Inputs are already localized and
 // normalized by the separately source-derived getBattleCardSameNameKey.
 getCardSameNameCountInfo(keys){const map=new Map();let max=0;for(const key of keys){const n=(map.get(key)??0)+1;map.set(key,n);if(n>max)max=n;}return {unique_count:map.size,max_same_name_count:max};}
}
