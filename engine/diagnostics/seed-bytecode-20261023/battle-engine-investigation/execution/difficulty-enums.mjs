// Read literal data only, never execute recovered game code. world_enums.js
// 0x2000 defines names; module0x100 @82..300 defines the numeric mapping.
import fs from 'node:fs';
import {MissingBattleRule} from './resource-store.mjs';
const source=fs.readFileSync(new URL('evidence/difficulty-enums/source/gamecore/contents/world_enums.js.recovered.js',import.meta.url),'utf8');
const names={},numbers={};
for(const m of source.matchAll(/arg0\.([A-Z_0-9]+) = "(NONE|DIFFICULTY_LEVEL_\d+)"/g))if(m[1]===m[2])names[m[1]]=m[2];
for(const m of source.matchAll(/ACCU = "(NONE|DIFFICULTY_LEVEL_\d+)"\r?\n\s*r3 = ACCU\r?\n\s*ACCU = (-?\d+)\r?\n\s*define_literal_property\(r2, r3, ACCU, false, true\)/g))numbers[m[1]]=Number(m[2]);
if(Object.keys(names).length!==21||Object.keys(numbers).length!==21||numbers.NONE!==-1||numbers.DIFFICULTY_LEVEL_20!==20)throw new MissingBattleRule('world_difficulty_enum_evidence');
export const DIFFICULTY_LEVEL=Object.freeze(names);
export const DIFFICULTY_LEVEL_NUM=Object.freeze(numbers);
