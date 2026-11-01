// Complete handwritten battle-balance group helpers. ContinueSkillProc source
// 0x600,0x9400..0x18200 and refreshMinMax0x45b00 in evidence/batch2-balance/.
// This module never imports or evaluates the recovered program.
import {floorGame} from '../effects/effect-arithmetic.mjs';
const GROUPS=[['cs00_0001','cs00_0057'],['cs00_0012','cs00_0059'],['cs00_0008','cs00_0058']];
const KEYS=['max_limit_morale','max_limit_fortitude','max_limit_resolve'];
const DIRS=[{sign:1,metaKeySuffix:'',monsterOnly:false},{sign:-1,metaKeySuffix:'_debuff',monsterOnly:true}];
const part=(dir,n)=>dir.sign>0?Math.max(0,n):Math.min(0,n);
export const CS_BALANCE_METHODS=['getBattleBalanceCSGroupResIds','getBattleBalanceCSGroupMembers','getBattleBalanceCSBound','getBattleBalanceCSStackLimit','getBattleBalanceCSEffectiveTermValues','getBattleBalanceCSGroupTermValue','refreshBattleBalanceCSGroup','isBattleBalanceNoDurationCS','refreshMinMax'];
export class CSBalanceRuntime {
  constructor(e){this.e=e;this.b=e.b;this.db=e.db;}
  call(n,...args){return this.e.call(n,...args);}
  key(res){const i=GROUPS.findIndex(group=>group.includes(res));return i<0?undefined:KEYS[i];}
  getBattleBalanceCSGroupResIds(res){return GROUPS.find(group=>group.includes(res))?.slice()??[];}
  dirLimit(key,dir){
    // Native Number.isFinite does not coerce carrier strings. Only the six
    // same-version observed keys are adapted by ResourceStore; no blanket cast.
    const n=this.call('constantMetagame',key+dir.metaKeySuffix,{def_value:Number.MAX_SAFE_INTEGER,skip_error:true});
    return Number.isFinite(n)&&n>=0?floorGame(n):undefined;
  }
  getBattleBalanceCSStackLimit(res,isMonster,value){const key=this.key(res);if(key==null)return;
    const dir=DIRS.find(x=>x.monsterOnly==isMonster);if(dir==null||part(dir,value)==0)return;return this.dirLimit(key,dir);
  }
  getBattleBalanceCSBound(owner,res,dir){const key=this.key(res);if(key==null||this.call('isMonsterByID',owner)!=dir.monsterOnly)return;
    const limit=this.dirLimit(key,dir);return limit==null?undefined:dir.sign*limit;
  }
  isBattleBalanceNoDurationCS(row){return ['TERM_BATTLE','TERM_NONE'].includes(row.term_type_1)&&['TERM_BATTLE','TERM_NONE'].includes(row.term_type_2);}
  getBattleBalanceCSGroupMembers(list,res,additional){const group=this.getBattleBalanceCSGroupResIds(res);if(group.length===0)return;
    const members=[];list?.forEach(id=>{const cs=this.b.csMap[id];if(cs&&!cs.removed&&group.includes(cs.res_id))members.push(cs);});
    if(additional&&!additional.removed&&group.includes(additional.res_id)&&!members.some(cs=>cs.cs_id==additional.cs_id))members.push(additional);return members;
  }
  getBattleBalanceCSEffectiveTermValues(owner,list,res,additional){const members=this.getBattleBalanceCSGroupMembers(list,res,additional);if(members==null)return;
    const values=new Map();let total=0;members.forEach(cs=>{values.set(cs.cs_id,cs.term_value);total+=cs.term_value;});
    for(const dir of DIRS){const bound=this.getBattleBalanceCSBound(owner,res,dir);
      if(bound==null||!(dir.sign>0?total>bound:total<bound))continue;
      let excess=dir.sign*(total-bound);
      // Duration-bearing instances lose effective value before permanent ones;
      // original list order and raw term_value are both observable.
      for(const noDuration of [false,true])for(const cs of members){
        if(excess<=0||dir.sign*cs.term_value<=0)continue;
        if(this.isBattleBalanceNoDurationCS(this.db.get('cs',cs.res_id))!=noDuration)continue;
        const amount=Math.min(dir.sign*cs.term_value,excess);values.set(cs.cs_id,cs.term_value-dir.sign*amount);excess-=amount;
      }
    }return values;
  }
  getBattleBalanceCSGroupTermValue(owner,list,res,additional){const values=this.getBattleBalanceCSEffectiveTermValues(owner,list,res,additional);if(values==null)return;
    let total=0;values.forEach(n=>total+=n);return total;
  }
  refreshBattleBalanceCSGroup(owner,list,res,additional){const members=this.getBattleBalanceCSGroupMembers(list,res,additional),values=this.getBattleBalanceCSEffectiveTermValues(owner,list,res,additional);
    if(members==null||values==null)return;let total=0;const changed=[];
    members.forEach(cs=>{const n=values.get(cs.cs_id)??cs.term_value;total+=n;if(cs.effective_term_value==n)return;
      cs.effective_term_value=n;changed.push(cs);this.e.pushChangeData('cs',cs.cs_id);
      cs.skillEffs.forEach(id=>{const s=this.b.skillMap[id];if(!s)return;if(n==0)delete s.termValue;else s.termValue=n;this.e.pushChangeData('skill',s.skill_id);});
    });
    // Refresh every member's fields first, then run passive callbacks. Reentrant
    // queries must never observe a half-updated group.
    changed.forEach(cs=>cs.skillEffs.forEach(id=>{if(this.b.skillMap[id])this.call('checkPassiveSkill',id,cs.owner_id,false);}));return total;
  }
  refreshMinMax(resourceIds){
    this.call('getContinueSkills',this.b.char).forEach(id=>{const cs=this.b.csMap[id];if(!cs||!resourceIds?.includes(cs.res_id))return;
      const row=this.db.get('cs',cs.res_id);
      for(const [field,column,type]of [['max','overlay_value_max','SKILL_EFF_OVERLAY_VALUE_MAX_ADD'],['min','overlay_value_min','SKILL_EFF_OVERLAY_VALUE_MIN_ADD']]){
        if(['MAX','-MAX'].includes(row[column]))continue;const old=cs[field];cs[field]=Number(row[column]);
        const passives=this.call('getPassiveByType',{source_id:this.b.char.id,type,is_card:false,char_id:cs.char_id});
        if(passives.length===0)continue;
        for(const p of passives){const r=this.db.get('skill_eff',p.res_id);if(p.link_cs_ids?.includes(cs.show_cs_res_id??cs.res_id))cs[field]=this.call('procMathSign',r.eff_value_math_sign,cs[field],this.call('calcValue',p.skill_id));}
        if(cs[field]!=old)this.e.pushChangeData('cs',id);
      }
    });
  }
}
