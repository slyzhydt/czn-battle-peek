// Explicit native empty/inactive paths plus mandatory active continuations.
// These guards must stay tied to retained bytecode; they are not generic no-ops.
import {MissingBattleRule} from './resource-store.mjs';
export class RuntimeGuards {
  constructor(e){this.e=e;this.b=e.b;this.wt=e.wt;}
  // Native BattleWT0x1dd00 reads props[BattleWT.battleExecutionGuardKey].
  // The static-keyed props slot is a separate capture input. An explicit own
  // undefined means the native slot was absent; omission is not the same fact.
  getBattleExecutionGuard(){const inputs=this.e.state.runtimeInputs;if(!inputs||!Object.hasOwn(inputs,'battleExecutionGuard'))throw new MissingBattleRule('input.BattleWorktable.battleExecutionGuard');return inputs.battleExecutionGuard;}
  checkDeads(options){
    // checkDeads 0x16b000: empty deads skips log block and both size branches.
    if(this.b.deads.length===0)return false;
    return this.e.call('checkDeads.active',options);
  }
  procInterrupt(){
    return this.e.call('procInterrupt.active');
  }
  checkCoopReserved(){
    const x=this.b.coop_reserved;if(!x)return;
    this.e.call('checkCoop',x.char_id,x.target_ids);this.b.coop_reserved=undefined;
  }
  flushDeferredLogs(entry){
    if(entry.deferred_logs&&entry.deferred_logs.length>0){
      for(const log of entry.deferred_logs)this.e.call('pushSubBattleLog',log);entry.deferred_logs=undefined;
    }
    if(entry.deferred_actions&&entry.deferred_actions.length>0){
      for(const action of entry.deferred_actions)this.e.pushAction(action);entry.deferred_actions=undefined;
    }
  }
  procSingularityTriggeredImmediate(){
    // 0x5a200: no motion queue => no iteration. The active filter/effect path
    // still requires a port; absence of singularity may not be guessed.
    if(!this.b.motionTrig||this.b.motionTrig.length<=0)return;
    return this.e.call('procSingularityTriggeredImmediate.active');
  }
}
