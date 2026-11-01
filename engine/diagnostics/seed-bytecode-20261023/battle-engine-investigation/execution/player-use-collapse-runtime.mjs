// StressProc.addCollapseOffAction0x43100 and closure0x43700, 287 instructions.
// This helper is reached by procUseCard's recovery before setEgoStress.
import {floorGame} from '../effects/effect-arithmetic.mjs';
export class PlayerUseCollapseRuntime {
 constructor(e){this.e=e;}
 addCollapseOffAction(c){const e=this.e,b=e.b,stage=(e.wt.battle_stage_worktable??e.state.worktables.BattleStageWorktable).battle_stage,chars=stage.chars.filter(x=>!stage.leaved_chars?.includes(x.res_id));
  if(chars.length===1||stage.chars.some(x=>x.link_crash_on==true)){e.pushAction({id:b.last_action_id++,source_id:b.char.id,type:'action_collapse_off',skip_action:true});e.call('setCollapseOff',c);return;}
  const oldMax=e.call('getStatus',c.id,'S_HP'),lostMax=c.collapse_dec_max_hp??0,lostHp=c.collapse_dec_cur_hp??0,max=oldMax+lostMax;c.collapse_dec_max_hp=undefined;e.call('setStatus',b.char.id,'S_HP',max);
  const oldHp=e.call('getStatus',c.id,'S_CURRENT_HP'),pct=e.call('constantMetagame','collapse_hp_restore_pct',{def_value:0}),heal=floorGame(lostHp*pct*.01),next=Math.min(oldHp+heal,max);c.collapse_dec_cur_hp=undefined;e.call('setStatus',b.char.id,'S_CURRENT_HP',next);
  e.pushAction({id:b.last_action_id++,source_id:b.char.id,type:'action_collapse_off',action_list:[{action_units:[[b.char.id,{heal:next-oldHp,old_hp:oldHp,new_hp:next,max_hp:max,is_collapse_off:true}]]}],skip_action:true});e.call('setCollapseOff',c);
 }
}
