// procSkillEff 0xdf800 @63270..63819, callbacks 0x162900/0x163300/0x163a00.
// Only SKILL_EFF_KILL enters this native branch; adjacent effects have separate
// targets. Recovered JavaScript is evidence only and is never executed.
import {compareCondition} from '../conditions/condition-core.mjs';
import {MissingBattleRule} from './resource-store.mjs';
export const KILL_EFFECT_METHODS=['procKillEffect'];
export class KillEffectRuntime {
  constructor(e){this.e=e;this.b=e.b;}
  call(n,...args){return this.e.call(n,...args);}
  // Return the exact incoming array when no atk_* filter is used, or the new
  // filtered array otherwise. Do not mutate the incoming array. The dispatcher
  // assigns this return value to its targets before common finalization.
  procKillEffect(id,targets,byCard){
    if(!targets.length)return targets;
    const s=this.b.skillMap[id];if(!s)throw new MissingBattleRule('procKillEffect.skill',{id});
    const opts=s.eff_opts??[],attack=opts.filter(opt=>opt.startsWith('atk_'));
    if(attack.length){
      const sign='INEQUALITY_'+attack[0].slice(4).toUpperCase();
      targets=targets.filter(target=>{
        const hp=this.call('getStatus',target,'S_CURRENT_HP');
        const value=this.call('calcValue',id,target);
        const source=this.call('resolveStatSource',id,s.stat_source);
        const threshold=this.call('procRevise',1,this.call('procStatType',1,value,this.call('getStatus',source,'S_ATK')));
        return compareCondition(sign,hp,threshold);
      });
    }
    const cardId=this.call('getParentCard',id)?.id;
    for(const target of targets){
      const previous=this.call('getStatus',target,'S_CURRENT_HP');
      this.call('setStatus',target,'S_CURRENT_HP',0,{trigger:false});
      this.b.deads.push({source_id:target,by:opts.includes('half_death')?'half_death':'kill',killer:s.caster_id,prevHP:previous,card_id:cardId});
      if(cardId!=null)this.call('countCardUseKill',cardId);
    }
    // The native initial length guard precedes filtering: empty-after-filter
    // still emits this action, and still reaches the common effect finalizer.
    this.e.pushAction({id:this.b.last_action_id++,type:'action_kill',source_id:s.caster_id,target_id:targets,byCard});
    return targets;
  }
}
