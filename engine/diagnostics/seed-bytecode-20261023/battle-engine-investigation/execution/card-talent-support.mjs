// BattleEnums parseBindTalent 0xbf00; getOlgaTalentBase 0xb100;
// module 0x100 literal OLGA_TALENTS=[52,55,56]. CardProc 0x1ee00.
import fs from 'node:fs';
import {MissingBattleRule} from './resource-store.mjs';
export const TALENTS=JSON.parse(fs.readFileSync(new URL('../../card-pool-investigation/talent-enum.json',import.meta.url),'utf8'));
const OLGA=['TALENT_UNIQUE_OLGA','TALENT_UNIQUE_OLGA1','TALENT_UNIQUE_OLGA2'];
export function parseBindTalent(s){const m=s.match(/^TALENT_BIND(?:_(\d+)(?:_(\d+)(?:_(.+))?)?)?$/);if(!m)return undefined;
 const max=m[2]==null?undefined:Number(m[2]);return {stack:m[1]==null?0:Number(m[1]),max:max>0?max:undefined,tooltipKey:m[3]?.length?m[3]:undefined};}
export function getOlgaTalentBase(s){const key=OLGA.find(k=>s.startsWith(k+'_'));return key==null?undefined:TALENTS[key];}
export function parseOlgaMaxStack(s){const base=OLGA.find(k=>s.startsWith(k+'_'));if(base==null)return 0;const raw=s.slice((base+'_').length),n=Number(raw);
 if(!/^\d+$/.test(raw)||!Number.isSafeInteger(n))throw new MissingBattleRule('cardCreate.invalid_olga_talent_max_stack',{talent:s});return n;}
export function addTestamentInterruptOutline(c){if(!c.talents?.includes(TALENTS.TALENT_TESTAMENT))return;c.interruptKeywords??=[];if(!c.interruptKeywords.includes('SKILL_EFF_CARD_DISCARD'))c.interruptKeywords.push('SKILL_EFF_CARD_DISCARD');}
