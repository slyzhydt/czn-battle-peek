// Shared query bridge, not a new stat formula. GameConstants.loadConstants
// 0x3a00 @103..149 explicitly Number() converts these two resource values.
// getDmgReviseRate0x11600 / getShieldReviseRate0x11d00 return them;
// SkillEffectProc.procRevise0x1b3f00 multiplies then floors.
import {procRevise,procStatType} from '../effects/effect-arithmetic.mjs';
export class SharedArithmeticRuntime {
  constructor(e){this.e=e;this.db=e.db;}
  getReviseRates(){return {damage:this.db.number(this.db.get('constant_meta','dmg_revise_rate'),'value'),shield:this.db.number(this.db.get('constant_meta','shield_revise_rate'),'value')};}
  procRevise(type,value){return procRevise(type,value,this.getReviseRates());}
  procStatType(type,value,stat){return procStatType(type,value,stat);}
}
