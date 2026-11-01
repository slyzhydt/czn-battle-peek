// SpotRewardProc.procDropReward, bytecode 0x2100 (32 instructions, 62 bytes).
// Both retained copies have raw instruction SHA256
// 0ca474b72287f1cdd594a7f33117c404850baad3d6ae84c7c0a96e5fd29104a7.
// This client function only defaults two local arguments and resolves undefined.
// It never reads a battle resource, worktable, RNG, or reward field. The caller
// awaits it without using the result. The synchronous offline adapter therefore
// projects that immediately fulfilled result; it does not generate/grant drops.
export const DROP_REWARD_METHODS=['procDropReward'];
export class DropRewardRuntime {
  constructor(engine){this.e=engine;}
  // Native args 0/1 are worktables retained by the engine. The remaining five
  // arguments correspond to args 2..6; only args 4/5 have native local defaults.
  procDropReward(battleRow,count,flag,first,wave){
    if(flag==null)flag=false;
    if(first==null)first=true;
    return undefined;
  }
}
