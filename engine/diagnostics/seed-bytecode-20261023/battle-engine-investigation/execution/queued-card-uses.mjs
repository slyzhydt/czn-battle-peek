// Hand port of BattleWorktable.drainQueuedCardUses 0x7e600 and its four
// closures. Execution/recall/cooperation effects remain required engine ports.
import {MissingBattleRule} from './resource-store.mjs';
import {SETTLE_ROUND_LIMIT} from './reaction-loop.mjs';
export class QueuedCardUses {
  constructor(e){this.e=e;this.b=e.b;}
  procCardRepeats(){const r=this.drain();if(r.interrupted&&r.resume_state!=null&&this.b.next_state==this.e.enums.LogicState.TIMING_NONE)this.b.next_state=r.resume_state;return r.interrupted;}
  drain(){
    const b=this.b,e=this.e;let used=false,resume_state,round=0,operations=0;
    // Native inner loops have no bound. Reject runaway offline branches.
    const tick=()=>{if(++operations>20000)throw new MissingBattleRule('offline_card_queue_budget');};
    const interrupted=()=>({interrupted:true,used,resume_state});
    const settle=()=>{const state=b.current_state;if(e.call('settleReactions')){resume_state=state;return true;}return false;};
    const use=entry=>e.call('procUseCardRepeat',entry)||settle();
    const take=name=>{tick();used=true;const entry=b[name].shift();if(b[name]?.length==0)b[name]=undefined;return entry;};
    const coops=()=>{
      while(b.cardCoops&&b.cardCoops.length>0){
        const entry=take('cardCoops');if(entry==null)break;
        if(e.call('skipQueuedCoopUse',entry)){
          const card=b.cardMap[entry.card_id];
          const another=b.cardCoops?.some(x=>x.by_testament&&x.card_id==entry.card_id)??false;
          if(entry.by_testament&&card?.testament_pending&&!another){
            card.testament_pending=undefined;
            // CARD_PLACE_DISCARD=3, battle_enums 0x13f00.
            if(card.card_place==3&&card.recall_count!=null&&card.recall_count>=0){
              b.recall_reserved??=[];b.recall_reserved.push([3,card.id]);--card.recall_count;
              e.call('checkRecallReserved');e.call('checkCardBind');if(settle())return true;
            }
          }
        }else if(use(entry))return true;
      }
      return false;
    };
    while(true){
      if(b.cardUses&&b.cardUses.length>0){
        const entry=take('cardUses');
        if(entry!=null){
          if(!e.call('deferCardUseForNextWave',entry)&&use(entry))return interrupted();
          // JumpConstant at 210 goes directly to 472, past the round guard.
          ++round;continue;
        }
      }
      while(b.cardRepeats&&b.cardRepeats.length>0){
        const entry=take('cardRepeats');if(entry==null)break;
        if(use(entry))return interrupted();
      }
      if(coops())return interrupted();
      e.call('checkCoopReserved');
      if(coops())return interrupted();
      if(!['cardUses','cardRepeats','cardCoops'].some(k=>(b[k]?.length??0)>0))break;
      if(round+1>=SETTLE_ROUND_LIMIT)throw new MissingBattleRule('drain_queued_card_uses_round_limit');
      ++round;
    }
    return {interrupted:false,used};
  }
}
