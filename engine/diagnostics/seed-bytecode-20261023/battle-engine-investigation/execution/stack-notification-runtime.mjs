// Independently hand-ported notifications from EventStackHelper, SkillEffectProc,
// and CharUniqUIProc. Evidence is retained under evidence/effect-runtime.
export class StackNotificationRuntime {
  constructor(engine){this.e=engine;this.b=engine.b;this.w=engine.wt;this.db=engine.db;}
  call(name,...args){return this.e.call(name,...args);}
  // EventStackHelper.onEvent 0x19000 offsets 89..143; caller applies log guards.
  conditionLog(event,stack){this.call('pushLog','[condition_triggered] '+event.res_id+':from_'+stack.res_id);}
  // EventStackHelper.setStack callback 0x14f00 -> SkillEffectProc 0x1a9600.
  skillStackChange(parent,stackId){
    const id=parent.parent_id,s=this.b.skillMap[id];if(s==null)return;
    this.call('pushChangeData','skill',id);if(parent.useType!=='VALUECOUNT')return;
    const row=this.db.get('skill_eff',s.res_id);
    if(row.operation==='OPERATION_PASSIVE'){
      if(s.parent.type==='CS'){const cs=this.b.csMap[s.parent.id];if(cs)this.call('checkPassiveSkill',id,cs.owner_id,cs.isCard);}
      else if(s.parent.type==='CARD'){const card=this.b.cardMap[s.parent.id];if(card)this.call('checkPassiveSkill',id,card.id,true);}
    }
    const card=this.call('getParentCard',id);if(!card)return;
    if(card.handOutline&&stackId in card.handOutline)card.handOutline[stackId]=!!this.b.stackMap[stackId]&&this.b.stackMap[stackId].stack>0;
    if(row.eff!=='SKILL_EFF_CARD_COST_CHANGE')return;
    const {changed,old_cost,new_cost}=this.call('updateCostResult',card.id);if(!changed)return;
    this.call('pushChangeData','card',card.id);
    this.e.pushAction({id:this.b.last_action_id++,type:'action_card_cost',action_card_property:{card:card.id,cost:new_cost},source_id:-1,skip_action:card.card_place!==this.call('cardPlace','CARD_PLACE_HAND')});
    const notify=!(s.parent.type==='CS'&&this.b.csMap[s.parent.id]?.caster_id==card.id);
    if(notify&&new_cost<old_cost)this.call('procCardEvent','CONDITION_CARD_COST_DECREASE',card.card_place,card.id,{skill_id:s.add_passive_info?.[2]});
  }
  // EventStackHelper 0x13300; event_stack intentionally keeps the mutable ref,
  // while stack_snapshot captures the counter at action creation.
  pushSingularityStackAction(stack){
    if(!(this.b.stackParentMap[stack.stack_id]?.some(p=>p.from==='SINGULARITY')??false))return;
    this.e.pushAction({id:this.b.last_action_id++,type:'action_stack',source_id:stack.stack_id,event_stack:stack,stack_snapshot:stack.stack});
  }
  // CharUniqUIProc.addCharUniqUIAction 0x9100; enum _1049 verified literal.
  addCharUniqUIAction(data){this.e.pushAction({id:this.b.last_action_id++,type:'action_char_unique_ui_change',source_id:data.stack_data?.stack_id??-1,char_uniq_ui_data_array:[data]});}
  // CharUniqUIProc.addStackAction_1049 0x2800.
  stackUI1049(stack,before,after){
    if(before==after||!['cd_char_1049_0tripple','cd_char_1049_1tripple'].includes(stack.res_id))return;
    const trigger=(this.b.skillTrig??[]).find(t=>this.b.stackParentMap[stack.stack_id]?.find(p=>p.parent_id==t.skill_id));
    this.addCharUniqUIAction({type:'_1049',stack_data:{stack_id:stack.stack_id,prev_stack_value:before,next_stack_value:after,is_condition_complete:trigger?.skill_id!=null||after==0}});
  }
  // CharUniqUIProc.addConditionAction_1049 0x4c00. Queue concatenation and
  // condition-key enumeration order affect which completion is displayed.
  conditionUI1049(stack,before,after){
    if(before==after||!['cd_char_1049_straight','cd_char_1049_fullhouse'].includes(stack.res_id))return;
    const triggers=[...this.b.motionTrig??[],...this.b.duringTrig??[],...this.b.skillTrig??[],...this.b.coopTrig??[]];
    const trigger=triggers.find(t=>this.b.stackParentMap[stack.stack_id]?.find(p=>p.parent_id==t.skill_id));
    const visible=[false,false,false];let i=-1;const conditions=stack.check_map?.[0]?.condcard;
    if(conditions!=null)for(const key in conditions){i++;const pair=conditions[key];if(pair.length===0)continue;visible[i]=pair[0]==1;}
    this.addCharUniqUIAction({type:'_1049',stack_data:{stack_id:stack.stack_id,visible_data:visible,is_condition_complete:trigger?.skill_id!=null}});
  }
}
