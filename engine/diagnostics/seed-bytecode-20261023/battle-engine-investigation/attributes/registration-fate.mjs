import {need} from '../conditions/condition-core.mjs';

// registUnitEvent 0xf0000001ae00 @1819..1892 and @13537..13614.
// This is a one-time registration probe, not a procUnitEvent runtime branch.
export function probeFateRegistration({event,worktable}){
  const init=need(need(worktable,'battleInitWorktable'),'battle_init');
  event.set=true;
  event.set_value=need(init,'fate_count','battle_init.fate_count')??0;
  return {triggered:true};
}
