// Hand ports of pushBattleLog 0x9c600 / pushSubBattleLog 0x9cf00.
import fs from 'node:fs';
import {MissingBattleRule} from './resource-store.mjs';
const enumText=fs.readFileSync(new URL('../../card-pool-investigation/gamecore/battle/battle_enums.js.recovered.js',import.meta.url),'utf8');
function literalEnum(address){
  const marker='// Bytecode '+address+' ',start=enumText.indexOf(marker);
  if(start<0)throw new MissingBattleRule('log_enum_evidence',{address});
  const body=enumText.slice(start,enumText.indexOf('\n  }',start)),out={};
  for(const m of body.matchAll(/arg0\.([a-zA-Z_0-9]+) = (\d+)/g))out[m[1]]=Number(m[2]);
  return Object.freeze(out);
}
const B=literalEnum('0xf0000001f300'),P=literalEnum('0xf00000021400'),D=literalEnum('0xf00000023700');
function enumValue(group,value){if(typeof value==='number')return value;if(Object.hasOwn(group,value))return group[value];throw new MissingBattleRule('log_enum_value',{value});}
export class LogRuntime {
  constructor(e){this.e=e;this.b=e.b;this.wt=e.wt;}
  getLogParamType(value){return enumValue(P,value);}
  getBattleLogType(value){return enumValue(B,value);}
  getDetailLogType(value){return enumValue(D,value);}
  // WT 0xa3f00 / 0xa5900; static list pinned by 0x215900. Alias IDs that
  // resolve to the player aggregate must not borrow its display-name snapshot.
  getUnitByExactID(id){const unit=this.e.getUnit(id,true);return unit&&unit.id==id?unit:undefined;}
  // WT 0xa4700: display overrides are accepted for monster IDs only.
  setUnitNameOverride(id,name){if(!this.e.getMonster(id))return;const unit=this.getUnitByExactID(id);if(!unit)return;unit.name_uname=name;this.b.name_override_used=true;}
  // WT0xa5100. The historical used flag is deliberately not reset.
  clearUnitNameOverride(id){const unit=this.getUnitByExactID(id);if(unit)delete unit.name_uname;}
  snapshotNameOverrides(log){
    if(!this.b.name_override_used)return;
    const record=id=>{const unit=this.getUnitByExactID(id);if(!unit?.name_uname)return;(log.name_unames??={})[id]=unit.name_uname;};
    log.param_types?.forEach((type,i)=>{type=enumValue(P,type);if(type===P.unit_id||type===P.unit_id_cs_set_add)record(log.params[i]);else if(type===P.monster_ids)log.params[i]?.forEach(record);});
    const type=enumValue(D,log.type);
    if([D.log_skill_eff_dmg,D.log_skill_eff_shield,D.log_skill_eff_heal].includes(type)&&Array.isArray(log.params?.[1]))log.params[1].forEach(record);
    if(type===D.log_skill_eff_ego_field_change)log.params?.[3]?.forEach(pair=>record(pair[0]));
  }
  pushBattleLog(log){
    if(this.wt.isPreview)return;
    log.type=enumValue(B,log.type);
    if(!this.b.battle_logs)this.b.battle_logs=[];this.b.battle_logs.push(log);
    this.e.pushAction({id:this.b.last_action_id++,type:'action_battle_log',source_id:-1,action_battle_log:log});
  }
  pushSubBattleLog(log,force=false,emit=true){
    force??=false;emit??=true;if(this.wt.isPreview)return;
    log.type=enumValue(B,log.type);
    if(this.wt.deferredSubLogs){this.wt.deferredSubLogs.push(log);return;}
    const main=this.b.battle_logs.at(-1);if(!main)return;if(!main.sub)main.sub=[];
    const last=main.sub.at(-1);
    if(!force&&last&&!last.is_hard_fin&&last.type==log.type&&last.params?.[0]==log.params?.[0]&&last.merge_by==log.merge_by){
      if(last===log){last.is_fin=undefined;return;}
      const source=log.merge_srcs?.[0];
      if(source==null||!last.merge_srcs?.includes(source)){
        if(source!=null)(last.merge_srcs??=[]).push(source);last.is_fin=undefined;return;
      }
    }
    log.is_sub=true;main.sub.push(log);
    const action={id:this.b.last_action_id++,type:'action_battle_log',source_id:-1,action_battle_log:log};
    if(emit)this.e.pushAction(action);return action;
  }
  // addDetailLog 0xa9400; snapshotNameOverrides 0xa5900 early branch.
  addDetailLog(log,hasTriggerLog=false){
    hasTriggerLog??=false;if(this.wt.isPreview)return;
    const main=this.b.battle_logs.at(-1);if(!main)return;
    log.type=enumValue(D,log.type);log.param_types=log.param_types.map(x=>enumValue(P,x));
    if(this.b.name_override_used)this.e.call('snapshotNameOverrides',log);
    const retain=log.type===D.log_skill_eff_card_retain_turn_end;
    const all=!!(log.by&&this.b.skillMap[log.by]?.log_all_cards);
    if(all){const index=log.param_types.findIndex(x=>x===P.card_id||x===P.card_ids);if(index>=0){log.params[index]='log_all_card';log.param_types[index]=P.text;}}
    const gain=log.type===D.log_skill_eff_cs_set_add&&[1,2,3,this.b.char.id].includes(log.params[0]);
    const sub=(type,params,only_noti)=>this.pushSubBattleLog({type,logs:[],params,major_first:true,is_fin:true,...(only_noti?{only_noti:true}:{})},true);
    if(log.type===D.log_skill_eff_card_draw||(log.type===D.log_skill_eff_card_move_to&&log.params[0]===1&&log.params[2]===2)){sub(B.draw,[log.params[0]]);return;}
    if(log.type===D.log_skill_eff_energy_change){sub(B.energy,[log.params[0]]);return;}
    if(!hasTriggerLog&&gain){sub(B.cs_gain,[log.params[1],log.params[2]]);return;}
    const lastSub=main.sub?.at(-1),dest=lastSub?(lastSub.is_fin?(lastSub.parent_logs??=[]):lastSub.logs):main.logs;
    const last=dest.at(-1);
    if(retain&&dest.length>0){if(last.type===log.type){last.params[0].push(...log.params[0]);return;}}
    else if(all&&last?.by==log.by)return;
    dest.push(log);if(gain)sub(B.cs_gain,[log.params[1],log.params[2]],true);
  }
}
