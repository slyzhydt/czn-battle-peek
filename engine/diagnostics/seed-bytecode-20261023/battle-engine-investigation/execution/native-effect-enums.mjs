// Literal enum reads from exact static callback bodies, not evaluated code.
// procSkillEff ModuleInfo regular imports -28/-29 request2 ./event_system.ts.
import fs from 'node:fs';
const read=file=>Object.fromEntries([...fs.readFileSync(new URL('./evidence/active-effects/condition-enum-literals/'+file,import.meta.url),'utf8').matchAll(/arg0\.(\w+) = "([^"]*)"/g)].map(m=>[m[1],m[2]]));
export const ACTIVE_EFFECT_ENUMS={CondUnitOptType:read('anonymous_0xf0000000a000.js'),CondUnitTargetType:read('anonymous_0xf0000000d700.js')};
if(ACTIVE_EFFECT_ENUMS.CondUnitOptType.break_!=='break'||ACTIVE_EFFECT_ENUMS.CondUnitTargetType.stress!=='stress')throw Error('native_effect_enum_evidence_changed');
