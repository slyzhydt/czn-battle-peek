// Queue mechanics ONLY, not a replacement for all addSkillTriggered side effects.
// Sources: effects/queue-worktable/addSkillTriggered offsets 580..798,1128..1418;
// procSkillTriggered 11..249; procMotionSkillTriggeredBody motion before coop.
import {need,MissingConditionInput} from '../conditions/condition-core.mjs';
export function queueName({immediate,motion,parentIsCS,during}){
  for(const [k,v] of Object.entries({immediate,motion,parentIsCS,during}))if(typeof v!=='boolean')throw new MissingConditionInput('queue.'+k);
  return !immediate&&(motion||parentIsCS)?'motionTrig':during?'duringTrig':'skillTrig';
}
export function insertTrigger(battle,name,entry){
  if(!['duringTrig','skillTrig','motionTrig','coopTrig'].includes(name))throw new RangeError('unknown_queue:'+name);
  need(entry,'priority');need(entry,'skill_id');
  const q=battle[name]??(battle[name]=[]);
  const i=q.findIndex(x=>x.priority<entry.priority);
  if(i<0)q.push(entry);else q.splice(i,0,entry);
}
export function shiftTrigger(battle,motion=false){
  for(const name of motion?['motionTrig','coopTrig']:['duringTrig','skillTrig']){
    const q=battle[name];if(!q?.length)continue;
    const entry=q.shift();
    if(!motion&&!q.length)battle[name]=undefined;
    return {name,entry};
  }
  return null;
}
export function triggeredProbability({runPct,isPreview,nextRange}){
  if(typeof runPct!=='number'||typeof isPreview!=='boolean')throw new MissingConditionInput('triggeredProbability.inputs');
  if(runPct>=100)return {execute:true,draw:null};
  if(isPreview)return {execute:false,draw:null};
  if(typeof nextRange!=='function')throw new MissingConditionInput('nextRange');
  const draw=nextRange(0,100);
  return {execute:!(runPct<=draw),draw};
}
