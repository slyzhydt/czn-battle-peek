// Handports of ContinueSkillProc. Source addresses and offsets are retained in
// evidence/lifecycle-runtime. This module never executes the recovered program.
import {MissingBattleRule} from './resource-store.mjs';
import {floorGame,roundGame} from '../effects/effect-arithmetic.mjs';
// continue_skill.js 0x13900 / 0x14600. CSV names enter the adapter; native
// skill instances store these two enum groups as numbers.
const CS_CATEGORY={VALUE_CATEGORY_NONE:0,VALUE_CATEGORY_EFF_VALUE:1,VALUE_CATEGORY_EFF_CARD_TARGET_COUNT:2,VALUE_CATEGORY_EFF_COUNT_VALUE:3,VALUE_CATEGORY_EFF_CONDITION_VALUE_0:4,VALUE_CATEGORY_EFF_CONDITION_VALUE_1:5};
const CS_OPERATION={OPERATION_NONE:0,OPERATION_TERM_VALUE_MULTIPLE:1,OPERATION_TERM_VALUE_MULTIPLE_BEFORE_ROUND:2,OPERATION_TERM_VALUE_ADD:3,OPERATION_TERM_VALUE_SET:4};
function csEnum(value,group){if(value==null||typeof value==='number')return value;if(Object.hasOwn(group,value))return group[value];throw new MissingBattleRule('createSkill.cs_enum',{value});}

export class LifecycleRuntime {
  constructor(engine){this.e=engine;this.w=engine.wt;this.b=engine.b;this.db=engine.db;this.depth=0;}
  get stage(){const stage=(this.w.battle_stage_worktable??this.e.state?.worktables?.BattleStageWorktable)?.battle_stage;
    if(!stage)throw new MissingBattleRule('BattleStageWorktable.battle_stage');return stage;}
  call(name,...args){return this.e.call(name,...args);}
  // BattleWorktable 0xa2300. Defer only an immediate passive inside a scope
  // with an existing meaningful sub-log; retain the exact sub-log reference.
  tryDeferImmediatePassiveCSLog(log,immediate){
    if(this.w.isPreview||!immediate||this.w.immediatePassiveCSLogScopeDepth<=0)return false;
    const sub=this.getLastMeaningfulSub();if(!sub)return false;
    this.w.deferredImmediatePassiveCSLogs??=[];
    this.snapshotNameOverrides(log);this.w.deferredImmediatePassiveCSLogs.push({log,sub});return true;
  }
  getLastMeaningfulSub(){if(this.w.isPreview)return;const major=this.b.battle_logs.at(-1);if(!major?.sub)return;
    let index=major.sub.length-1,sub=major.sub[index];while(sub?.major_first){sub=major.sub[--index];if(sub==null)break;}return sub;
  }
  snapshotNameOverrides(log){if(!this.b.name_override_used)return;return this.call('snapshotNameOverrides.active',log);}
  query(args){return this.e.ports.getPassiveByType(args);}
  event(type,params,value){return this.e.ports.procUnitEvent(type,params,value);}
  procMathSign(sign,current,value){
    // SkillEffectProc 0x1f5c00. Invalid signs reject the offline branch.
    if(sign.startsWith('MATHSIGN_ADD_MAX_'))return current+Math.min(value,Number(sign.split('_')[3]));
    switch(sign){
      case 'MATHSIGN_NONE':case 'MATHSIGN_REF':return current;
      case 'MATHSIGN_ADD':return current+value;
      case 'MATHSIGN_MULTIPLY':return current*value;
      case 'MATHSIGN_MULTIPLY_PCT':return current*value/100;
      case 'MATHSIGN_ADD_HUND_MULTIPLY_PCT':return current*(100+value)/100;
      case 'MATHSIGN_SUBTRACT_HUND_MULTIPLY_PCT':return current*(100-value)/100;
      case 'MATHSIGN_SET':return value;
      case 'MATHSIGN_SUBTRACT':return current-value;
      case 'MATHSIGN_SUBTRACT_MIN_0':return Math.max(0,current-value);
      case 'MATHSIGN_SUBTRACT_MIN_1':return Math.max(1,current-value);
      case 'MATHSIGN_DIVIDE':return roundGame(current/value);
      case 'MATHSIGN_DIVIDE_FLOOR':return floorGame(current/value);
      case 'MATHSIGN_MULTIPLY_GE1':return value>=1?current*value:current;
      default:throw new MissingBattleRule('invalid_math_sign',{sign});
    }
  }
  // 0x46e00. OWN_CHAR queries are additional, and duplicates are preserved.
  getCSScopedPassives(cs,type){
    const res=this.db.get('cs',cs.res_id);
    const args={source_id:cs.owner_id,type,is_card:cs.isCard};
    const result=this.query(args);
    if(cs.isCard)return result;
    if(['OWN_CHAR','OWN_CHAR_EFF_TEAM'].includes(res.own_type))result.push(...this.query({...args,char_id:cs.char_id}));
    else if(res.own_type==='OWN_CASTER')result.push(...this.query({...args,caster_id:cs.caster_id}));
    return result;
  }
  // 0x47900. A matched destroy extension remains matched even when no selectable
  // extension remains. It is retained in check_extension_passives in that case.
  resolveCSExtension(cs,{selectBest=true}={}){
    let extension_passive,extension_result=0,extension_matched=false;
    const check_extension_passives=[];
    for(const s of this.getCSScopedPassives(cs,'SKILL_EFF_CS_EXTENSION')){
      if(!s.link_cs_ids?.includes(cs.res_id))continue;
      extension_matched=true;
      if(s.parent.id==cs.cs_id)throw new MissingBattleRule('invalid_cs_extension_passive',{res_id:cs.res_id});
      const res=this.db.get('skill_eff',s.res_id);
      if(this.db.array(res.target_unit_type_opt).includes('destroy')){
        check_extension_passives.push(s);
        const unit=this.e.getUnit(cs.owner_id,true);
        if(!unit||unit.ego_field_value==null||unit.ego_field_value>0)continue;
      }
      if(selectBest){
        let value=cs.term_value;
        if(s.eff_opts?.includes('half'))value=floorGame(value/2);
        const cap=s.eff_opts?.find(v=>!isNaN(Number(v)));
        if(cap!=null)value=Math.min(value,Number(cap));
        if(extension_result<value){extension_passive=s;extension_result=value;}
      }else if(extension_passive==null)extension_passive=s;
    }
    return {extension_passive,extension_result,check_extension_passives,extension_matched};
  }
  // 0x49600. First matching skill wins after ID deduplication.
  resolveCSTermValueChangePassive(cs){
    const type='SKILL_EFF_CS_CHANGE_TERM_VALUE';
    const list=this.getCSScopedPassives(cs,type);
    if(!cs.isCard&&cs.caster_id!=cs.owner_id)list.push(...this.query({source_id:cs.caster_id,type,is_card:false,char_id:cs.char_id,caster_id:cs.caster_id,skip_error:true}));
    const seen=new Set();
    for(const s of list){
      if(seen.has(s.skill_id))continue;seen.add(s.skill_id);
      if(!s.link_cs_ids?.includes(cs.res_id)||s.parent.id==cs.cs_id)continue;
      if(s.eff_opts?.includes('own')&&s.caster_id!=cs.caster_id)continue;
      return s;
    }
  }
  // 0x4ce00 / 0x4e000. Reset before removals: removal callbacks may enqueue the
  // next batch. The formal path saves the actual value after addTermValue.
  applyChangeCS(){
    const remove=[];
    for(const key in this.b.change_cs){
      if(this.call('addTermValue',Number(key),this.b.change_cs[key],'MATHSIGN_ADD',this.b.char.id,false))
        remove.push([Number(key),this.b.change_cs[key]]);
    }
    this.b.change_cs={};
    remove.forEach(([id,delta])=>{const cs=this.b.csMap[id];if(cs)this.call('removeContinueSkill',id,cs.owner_id,cs.isCard,{old_tv:-delta});});
  }
  applyChangeCSPre(){
    const remove=[];
    for(const key in this.w.previewChangeCS)
      if(this.call('addTermValuePre',Number(key),this.w.previewChangeCS[key],'MATHSIGN_ADD',this.b.char.id,false))remove.push(Number(key));
    this.w.previewChangeCS={};
    remove.forEach(id=>{const cs=this.b.csMap[id];if(cs)this.removeContinueSkillPre(id,cs.owner_id,cs.isCard);});
  }
  removeContinueSkillPre(id,owner,isCard,notify=true,force=false){
    // 0x58b00 resolves the owner even though it only forwards to the passive map.
    if(isCard){const card=this.b.cardMap[owner];void card;}else this.e.getUnit(owner);
    this.call('removePassiveSkillPre',id,owner,isCard);
  }
  isImmediatePassiveCSSkill(skill){
    // 0xdc00. FINALLY is restricted to the last effect in that CS.
    if(skill?.parent.type!=='CS')return false;
    const cs=this.b.csMap[skill.parent.id];if(!cs)return false;
    const row=this.db.get('cs',cs.res_id),has=t=>row.term_type_1==t||row.term_type_2==t;
    return has('TERM_PASSIVE_IMMEDIATLEY')||has('TERM_PASSIVE_IMMEDIATLEY_WHOLE')||
      (cs.skillEffs.at(-1)==skill.skill_id&&has('TERM_PASSIVE_IMMEDIATLEY_FINALLY'));
  }
  setSkillTermValue(skill,value){if(value==0)delete skill.termValue;else skill.termValue=value;}
  sameDisplaySum(cs,list){
    let sum=0;list?.forEach(id=>{const other=this.b.csMap[id];if(other&&id!=cs.cs_id&&(other.show_cs_res_id??other.res_id)==(cs.show_cs_res_id??cs.res_id))sum+=other.term_value;});return sum;
  }
  ownerCSList(cs,row,preview=false){
    const unit=this.e.getUnit(cs.owner_id);let list=unit.continueSkill;
    const normalize=id=>!preview&&[4,5,6].includes(id)?id-3:id;
    if(!this.e.getMonster(cs.owner_id)&&['OWN_CHAR','OWN_CHAR_EFF_TEAM'].includes(row.own_type))list=this.b.char.continueSkillChar?.[normalize(cs.char_id)];
    else if(row.own_type==='OWN_CASTER')list=unit.continueSkillCaster?.[normalize(cs.caster_id)];
    if(!preview&&list==null)throw new MissingBattleRule('continueSkills_undefined',{res_id:cs.res_id,owner_id:cs.owner_id,char_id:cs.char_id,caster_id:cs.caster_id});
    return list;
  }
  // 0xf700 proves the only balanced groups. Unknown active group math remains
  // mandatory until its caps and effective-value distribution are connected.
  balanceGroup(res){return [['cs00_0001','cs00_0057'],['cs00_0012','cs00_0059'],['cs00_0008','cs00_0058']].find(g=>g.includes(res));}
  getBattleBalanceCSGroupTermValue(owner,list,res,additional){
    if(!this.balanceGroup(res))return undefined;
    return this.call('getBattleBalanceCSGroupTermValue.active',owner,list,res,additional);
  }
  refreshBattleBalanceCSGroup(owner,list,res,additional){
    if(!this.balanceGroup(res))return undefined;
    return this.call('refreshBattleBalanceCSGroup.active',owner,list,res,additional);
  }
  emitCSValueAction(cs,caster,isCard,value,delta,skill,invoke=false){
    if(delta==0)return;
    const action_cs={id:cs.cs_id,...(isCard?{card_id:cs.owner_id}:{char_id:cs.char_id,caster_id:cs.caster_id,target_id:cs.action_target_id}),
      cs_res_id:cs.show_cs_res_id??cs.res_id,value,delta,from_ego:cs.from_ego,from_relic:cs.from_relic,from_collapse:cs.from_collapse};
    if(!isCard&&!invoke)action_cs.from_card=skill?.parent.type==='CARD';
    this.e.pushAction({id:this.b.last_action_id++,type:'action_cs_value_change',source_id:caster,action_cs});
  }
  termChangeEvents(cs,old,display,isCard,skill,expired){
    const res=cs.show_cs_res_id??cs.res_id;
    if(isCard){
      this.call('procCardEvent','CONDITION_CARD_CS_TERM_VALUE_SET',0,cs.owner_id,{cs_res_id:res});
      this.call('procCardEvent','CONDITION_CARD_CS_AMOUNT',0,cs.owner_id,{cs_res_id:res});return;
    }
    if(!skill?.eff_opts?.includes('ignore_cs_amount_event')){
      this.event('CONDITION_CHAR_CS_AMOUNT',[cs.owner_id,res,display]);
      this.event('CONDITION_OWN_CHAR_CS_AMOUNT',[cs.owner_id,res,display]);
    }
    if(!expired){
      this.event('CONDITION_CHAR_CS_BUFF_TYPE_COUNT',[cs.owner_id]);
      this.event('CONDITION_OWN_CHAR_CS_BUFF_TYPE_COUNT',[cs.owner_id]);
      this.event('CONDITION_CHAR_CS_BUFF_TYPE_SET',[cs.owner_id]);
    }
    this.event('CONDITION_CHAR_CS_TERM_VALUE_SET',[cs.owner_id,res,display]);
    this.event('CONDITION_OWN_CHAR_CS_TERM_VALUE_SET',[cs.owner_id,res,display]);
    this.event('CONDITION_CHAR_CS_TERM_VALUE_CHANGED',[cs.owner_id,res,cs.char_id],cs.term_value-old);
    this.event('CONDITION_OWN_CHAR_CS_TERM_VALUE_CHANGED',[cs.owner_id,res,cs.char_id],cs.term_value-old);
  }
  // 0x52800, 2162 instructions. The real state mutation is performed here;
  // group caps, numerical calculation and passive registration stay explicit
  // collaborators. Logging remains ordered because it can itself be deferred.
  addTermValue(id,value,sign,caster,isCard,skillId,ignoreLimits=false,log=true){
    const cs=this.b.csMap[id];if(!cs)return false;
    this.e.pushChangeData('cs',id);
    const row=this.db.get('cs',cs.res_id),old=cs.term_value;
    let oldInvoke=0;
    if(row.ui_expose_value_type==='EXPOSE_VALUE_INVOKE_EFF_VALUE'&&cs.skillEffs.length>0)oldInvoke=this.call('calcValue',cs.skillEffs[0]);
    const desired=floorGame(this.procMathSign(sign,cs.term_value,value));
    if(cs.ignored&&desired<old&&sign!=='MATHSIGN_SET')return;
    let list,show=0;
    if(!isCard){list=this.ownerCSList(cs,row);show=this.sameDisplaySum(cs,list);if(row.overlay_rule==='OVERLAY_CS_EACH')show=0;}
    const oldGroup=isCard?undefined:this.getBattleBalanceCSGroupTermValue(cs.owner_id,list,cs.res_id);
    const balanced=this.balanceGroup(cs.res_id)!=null;
    cs.term_value=desired;
    if(!ignoreLimits){
      if(!balanced){
        if(cs.max!=null&&cs.term_value>old&&cs.term_value+show>cs.max)cs.term_value=Math.max(old,cs.max-show);
        if(cs.min!=null&&cs.term_value<old&&cs.term_value+show<cs.min)cs.term_value=Math.min(old,cs.min-show);
      }
      for(const passive of this.query({source_id:this.b.char.id,type:'SKILL_EFF_BAN_OVERLAY_DEBUFF',is_card:false,char_id:cs.char_id})){
        if(!passive.link_cs_ids?.includes(cs.show_cs_res_id??cs.res_id))continue;
        const cap=this.call('calcValue',passive.skill_id);
        if(cs.term_value>old&&cs.term_value+show>cap)cs.term_value=Math.max(old,cap-show);
      }
    }
    const skill=this.b.skillMap[skillId??-1],immediate=this.isImmediatePassiveCSSkill(skill),hasTriggerLog=skill?.triggerLog!=null;
    if(row.cs_buff_type!=='CS_BUFF_DEBUFF'&&cs.term_value<0)cs.term_value=0;
    const newGroup=isCard?undefined:this.refreshBattleBalanceCSGroup(cs.owner_id,list,cs.res_id);
    const display=newGroup??(cs.term_value+show),delta=oldGroup!=null&&newGroup!=null?newGroup-oldGroup:cs.term_value-old;
    if(log&&!isCard&&['SHOW_TYPE_ICON','SHOW_TYPE_ICON_OUTLINE'].includes(row.show_type)){
      const transition=skill&&['SKILL_EFF_TRANSITION_SELECTED_CS_TO','SKILL_EFF_TRANSITION_CS_TO'].includes(this.db.get('skill_eff',skill.res_id).eff_type);
      if(!transition&&delta!=0){
        const detail={type:this.call('getDetailLogType','log_skill_eff_cs_set_add'),params:[cs.owner_id,row.show_link_cs_id!=='none'?row.show_link_cs_id:cs.res_id,[delta,display,'log_remove']],param_types:['unit_id_cs_set_add','cs_res_id_cs_set_add','delta_result'].map(x=>this.call('getLogParamType',x))};
        if(!this.call('tryDeferImmediatePassiveCSLog',detail,immediate))this.call('addDetailLog',detail,hasTriggerLog);
      }
    }
    const expired=cs.term_value==0||(row.cs_buff_type!=='CS_BUFF_DEBUFF'&&cs.term_value<0);
    if(expired){
      if(!['SHOW_TYPE_NONE','SHOW_TYPE_OUTLINE'].includes(row.show_type)&&row.cs_buff_type==='CS_BUFF_DEBUFF')this.emitCSValueAction(cs,caster,isCard,display,delta,skill);
      this.termChangeEvents(cs,old,display,isCard,skill,true);return true;
    }
    if(newGroup==null){
      const count=cs.skillEffs.length;
      for(let i=0;i<count;i++){
        const s=this.b.skillMap[cs.skillEffs[i]];if(!s)continue;
        this.setSkillTermValue(s,cs.term_value);this.e.pushChangeData('skill',s.skill_id);
        this.call('checkPassiveSkill',s.skill_id,cs.owner_id,isCard);
      }
    }
    if(row.show_type!=='SHOW_TYPE_NONE'){
      if(['EXPOSE_VALUE_NONE','EXPOSE_VALUE_TERM_VALUE','EXPOSE_VALUE_TERM_VALUE_MAX'].includes(row.ui_expose_value_type))this.emitCSValueAction(cs,caster,isCard,display,delta,skill);
      else if(row.ui_expose_value_type==='EXPOSE_VALUE_INVOKE_EFF_VALUE'){
        if(!cs.skillEffs.length)throw new MissingBattleRule('no_skilleffs_expose_value_invoke_eff_value');
        const invoked=this.call('calcValue',cs.skillEffs[0]);this.emitCSValueAction(cs,caster,isCard,invoked,invoked-oldInvoke,skill,true);
      }else throw new MissingBattleRule('invalid_ui_expose_value_type',{value:row.ui_expose_value_type});
    }
    this.termChangeEvents(cs,old,display,isCard,skill,false);
    this.call('refreshAlwaysDamage',cs.owner_id,cs.res_id);return false;
  }
  // 0x51900 previews do not assign cs.term_value; only previewPassiveMap changes.
  addTermValuePre(id,value,sign,caster,isCard,ignoreLimits=false){
    const cs=this.b.csMap[id];if(!cs)return false;
    const row=this.db.get('cs',cs.res_id),old=cs.term_value;
    if(row.ui_expose_value_type==='EXPOSE_VALUE_INVOKE_EFF_VALUE'&&cs.skillEffs.length>0)this.call('calcValue',cs.skillEffs[0]);
    let next=floorGame(this.procMathSign(sign,cs.term_value,value)),show=0;
    if(!isCard){show=this.sameDisplaySum(cs,this.ownerCSList(cs,row,true));if(row.overlay_rule==='OVERLAY_CS_EACH')show=0;}
    if(!this.e.getMonster(cs.owner_id)&&!ignoreLimits){
      if(cs.max!=null&&next>old&&next+show>cs.max)next=Math.max(old,cs.max-show);
      if(cs.min!=null&&next<old&&next+show<cs.min)next=Math.min(old,cs.min-show);
    }
    // The source checks old term_value in the negative case, not computed next.
    if(next==0||(row.cs_buff_type!=='CS_BUFF_DEBUFF'&&cs.term_value<0))return true;
    for(let i=0,count=cs.skillEffs.length;i<count;i++)if(this.b.skillMap[cs.skillEffs[i]])this.w.previewPassiveMap.set(cs.skillEffs[i],next);
    return false;
  }
  // 0x59400. Remove owner membership before passive/effect teardown. Deferred
  // deletion keeps the marked object available to the remaining notifications.
  removeContinueSkill(id,owner,isCard,options={}){
    const {actionDebuff=true,event,noti=true,skip_amount_event=false}=options??{};
    const unit=isCard?this.b.cardMap[owner]:this.e.getUnit(owner),ret={},ret_skip={};
    const cs=this.b.csMap[id];if(!cs)return {ret,ret_skip};
    const old=options?.old_tv??cs.term_value,row=this.db.get('cs',cs.res_id);
    let list=unit.continueSkill;
    if(!isCard){
      const normalize=id=>[4,5,6].includes(id)?id-3:id;
      if(!this.e.getMonster(cs.owner_id)&&['OWN_CHAR','OWN_CHAR_EFF_TEAM'].includes(row.own_type))list=this.b.char.continueSkillChar?.[normalize(cs.char_id)];
      else if(row.own_type==='OWN_CASTER')list=unit.continueSkillCaster?.[normalize(cs.caster_id)];
    }
    const oldGroup=isCard?undefined:this.getBattleBalanceCSGroupTermValue(cs.owner_id,list,cs.res_id);
    let removed=false;
    for(let i=(list?.length??0)-1;i>=0;i--)if(list[i]==id){list.splice(i,1);removed=true;break;}
    if(!removed&&!isCard){
      const lists=[unit.continueSkill];
      if(!this.e.getMonster(cs.owner_id)&&this.b.char.continueSkillChar)for(const key in this.b.char.continueSkillChar)lists.push(this.b.char.continueSkillChar[key]);
      if(unit.continueSkillCaster)for(const key in unit.continueSkillCaster)lists.push(unit.continueSkillCaster[key]);
      for(const entry of lists){if(!entry)continue;const i=entry.lastIndexOf(id);if(i>=0){entry.splice(i,1);break;}}
    }
    this.call('removePassiveSkill',id,owner,isCard);
    const newGroup=isCard?undefined:this.refreshBattleBalanceCSGroup(cs.owner_id,list,cs.res_id);
    if(isCard){
      const card=this.b.cardMap[cs.owner_id],index=card.ccsOutline?.indexOf(cs.cs_id);
      if(index!=null&&index>=0)card.ccsOutline?.splice(index,1);
      if(cs.from_debuff&&actionDebuff){
        const index=card.debuffs?.findIndex(d=>d.debuff_res_id==cs.from_debuff);
        if((index??-1)>=0){
          const [debuff]=card.debuffs.splice(index,1);this.e.pushChangeData('card',card.id);
          if(row.term_type_1==='TERM_TURN_VALUE_DISCARD_BEFORE'||row.term_type_2==='TERM_TURN_VALUE_DISCARD_BEFORE')
            (debuff.debuff_show_skip?ret_skip:ret)[card.id]=card.debuffs?.slice();
          else this.e.pushAction({id:this.b.last_action_id++,type:'action_card_debuff',source_id:-1,
            action_card_debuff:{cards_debuffs:{[card.id]:card.debuffs?.slice()},effect_type:1,skip:debuff.debuff_show_skip}});
        }
      }
    }
    let show=isCard?0:this.sameDisplaySum(cs,list);if(!isCard&&row.overlay_rule==='OVERLAY_CS_EACH')show=0;
    const display=newGroup??show,delta=oldGroup!=null&&newGroup!=null?newGroup-oldGroup:-old;
    const count=cs.skillEffs.length;
    for(let i=0;i<count;i++)if(cs.skillEffs[i] in this.b.skillMap)this.call('removeSkill',cs.skillEffs[i],true);
    const freshRow=this.db.get('cs',cs.res_id);
    if(!['SHOW_TYPE_NONE','SHOW_TYPE_OUTLINE'].includes(freshRow.show_type)&&freshRow.cs_buff_type!=='CS_BUFF_DEBUFF'){
      const action_cs={id:cs.cs_id,char_id:cs.char_id,caster_id:cs.caster_id,...(isCard?{card_id:cs.owner_id}:{target_id:cs.action_target_id}),cs_res_id:cs.show_cs_res_id??cs.res_id,from_ego:cs.from_ego,from_relic:cs.from_relic,from_collapse:cs.from_collapse};
      let type='action_cs_remove',emit=true;
      if(newGroup!=null){action_cs.value=display;action_cs.delta=delta;type='action_cs_value_change';emit=delta!=0;}
      else if(show!=0){action_cs.delta=-old;type='action_cs_value_change';}
      if(emit)this.e.pushAction({id:this.b.last_action_id++,type,source_id:cs.caster_id,action_cs,skip_action:!noti});
    }
    cs.removed=true;this.call('markCsForRemoval',id);this.e.pushChangeData('cs',id);
    if(!isCard){
      this.event('CONDITION_CHAR_CS_BUFF_TYPE_COUNT',[cs.owner_id]);
      this.event('CONDITION_OWN_CHAR_CS_BUFF_TYPE_COUNT',[cs.owner_id]);
      this.event('CONDITION_CHAR_CS_BUFF_TYPE_SET',[cs.owner_id]);
    }
    if(event){
      const res=cs.show_cs_res_id??cs.res_id;
      if(!isCard){
        if(!skip_amount_event){this.event('CONDITION_CHAR_CS_AMOUNT',[cs.owner_id,res,display]);this.event('CONDITION_OWN_CHAR_CS_AMOUNT',[cs.owner_id,res,display]);}
        this.event('CONDITION_CHAR_CS_TERM_VALUE_SET',[cs.owner_id,res,display]);this.event('CONDITION_OWN_CHAR_CS_TERM_VALUE_SET',[cs.owner_id,res,display]);
      }else{
        this.call('procCardEvent','CONDITION_CARD_CS_TERM_VALUE_SET',0,cs.owner_id,{cs_res_id:res});
        this.call('procCardEvent','CONDITION_CARD_CS_AMOUNT',0,cs.owner_id,{cs_res_id:res});
      }
    }
    this.call('refreshAlwaysDamage',cs.owner_id,cs.res_id);
    if(isCard&&this.b.amount_check_ccs?.[cs.res_id]!=null)this.call('procCardAmountEvent',this.b.amount_check_ccs[cs.res_id]);
    if(cs.res_id==='cs02_0619'&&!isCard&&this.e.getMonster(owner)){
      const monster=this.e.getUnit(owner);
      if(!monster.continueSkill.some(id=>this.b.csMap[id]?.res_id==='cs02_0619')&&monster.state==='keep_half_death'){
        monster.state='none';const model=this.db.get('monster',monster.res_id).link_model_define_id.toString();
        this.e.pushAction({id:this.b.last_action_id++,type:'action_monster_half_death_revive',source_id:owner,skip_action:model=='3000390'});
        for(const type of ['CONDITION_MONSTER_AMOUNT','CONDITION_MONSTER_AMOUNT_SET','CONDITION_CHAR_CS_AMOUNT','CONDITION_OWN_CHAR_CS_AMOUNT'])this.event(type,[]);
      }
    }
    return {ret,ret_skip};
  }
  // Worktable 0x1ee700 / 0x1eee00. Backward iteration is important: removal
  // changes passive membership and can dispatch additional events.
  removePassiveSkill(csId,owner,isCard){
    const unit=isCard?this.b.cardMap[owner]:this.e.getUnit(owner);if(unit.passive==null)return;
    for(let i=unit.passive.length-1;i>=0;i--){const id=unit.passive[i][0],s=this.b.skillMap[id];
      if(s==null||s.parent.type!=='CS')continue;
      if(this.b.csMap[s.parent.id]?.cs_id==csId)this.call('removePassiveSkillBySkillID',id,owner,isCard);
    }
  }
  removePassiveSkillPre(csId,owner,isCard){
    const unit=isCard?this.b.cardMap[owner]:this.e.getUnit(owner);if(unit.passive==null)return;
    for(let i=unit.passive.length-1;i>=0;i--){const id=unit.passive[i][0],s=this.b.skillMap[id];
      if(!s||s.parent.type!=='CS')continue;
      if(this.b.csMap[s.parent.id]?.cs_id==csId)this.w.previewInactivePassives.push(id);
    }
  }
  markSkillForRemoval(id){const list=this.b.pendingSkillRemovals||(this.b.pendingSkillRemovals=[]);if(!list.includes(id))list.push(id);}
  unregisterCasterDeadTermCS(caster,id){
    const map=this.b.caster_dead_term_cs_map;if(!map)return;const list=map[caster];if(!list)return;
    const i=list.indexOf(id);if(i>=0)list.splice(i,1);if(list.length==0)delete map[caster];
  }
  markCsForRemoval(id){
    const cs=this.b.csMap[id];if(cs)this.unregisterCasterDeadTermCS(cs.caster_id,id);
    const list=this.b.pendingCsRemovals||(this.b.pendingCsRemovals=[]);if(!list.includes(id))list.push(id);
  }
  // SkillEffectProc.Remove 0x1aef00. Permanent shared stacks retain other owners;
  // child effects and during conditions are torn down in source order.
  removeSkill(id,notify){
    const s=this.b.skillMap[id];if(!s)return;
    this.e.pushChangeData('skill',id);s.removed=true;this.markSkillForRemoval(id);
    const card=s.parent.type==='CARD'&&s.parent.id>=0?this.b.cardMap[s.parent.id]:undefined;
    for(const key of ['stack_trigger','stack_value0','stack_value1','stack_count0','stack_count1']){
      const stack=s[key];if(!stack)continue;
      if(!this.e.stacks.remove(stack,notify)){
        const parents=this.b.stackParentMap[stack];
        while(true){const i=parents.findIndex(p=>p.parent_id==s.skill_id&&p.from==='SKILL');if(i<0)break;parents.splice(i,1);}
      }
      if(card?.handOutline&&stack in card.handOutline)delete card.handOutline[stack];
    }
    s.duringEffs?.forEach(child=>this.removeSkill(child,notify));
    s.duringConds?.forEach(stack=>this.e.stacks.remove(stack,notify));
  }
  visibleCS(row){return ['SHOW_TYPE_ICON','SHOW_TYPE_ICON_NOT_NOTI','SHOW_TYPE_ICON_NOT_LOG','SHOW_TYPE_ICON_OUTLINE'].includes(row.show_type);}
  // procAddCS children 0x1a000/0x1d200; the block passive's option array
  // really receives another debuff entry on each invocation.
  checkCSBlock(ctx,bad){
    const {target,res,row,caster,isCard,ignoreBlock}=ctx;if(isCard)return false;
    const blockers=this.query({source_id:target,type:'SKILL_EFF_BLOCK_DEBUFF',is_card:false});
    blockers.forEach(s=>{if(s.eff_opts)s.eff_opts.push('debuff');else s.eff_opts=['debuff'];});
    const bans=this.query({source_id:target,type:'SKILL_EFF_CS_SET_ADD_BAN',is_card:false});
    if(ignoreBlock)return false;
    for(const s of blockers.concat(bans)){
      if(!this.visibleCS(row))continue;
      if(s.link_cs_ids?.length&&!s.link_cs_ids.includes(res))continue;
      if(s.eff_opts?.includes('debuff')&&!bad)continue;
      this.checkTermValuePassive(s.skill_id,caster);
      this.call('addDetailLog',{type:'log_skill_eff_block_debuff',params:[target,res],param_types:['unit_id','cs_res_id']});
      this.e.pushAction({id:this.b.last_action_id++,type:'action_system_effect',source_id:target,command:'debuff_immune'});return true;
    }
    return false;
  }
  checkCSOverload(ctx,bad,delta){
    const overload=this.query({source_id:ctx.target,type:'SKILL_EFF_OVERLOAD',is_card:false});
    if(!overload.length||!this.visibleCS(ctx.row)||!bad)return -1;
    const targets=this.call('getTargetableMonstersID'),i=targets.findIndex(id=>id==ctx.target);if(i>=0)targets.splice(i,1);
    if(!targets.length)return -1;
    if(this.w.isPreview&&targets.length!=1)return undefined;
    const target=this.e.random.randomArrayMember(0,targets);
    return this.procAddCS(target,ctx.res,delta,ctx.caster,ctx.isCard,'MATHSIGN_ADD',ctx.forcedSet,ctx.ignoreBlock,ctx.charId,ctx.skillId,ctx.args);
  }
  // 0x18d00: shared prelude and additive-overlay branch 7527..10088.
  // Other overlay kinds remain explicit continuation ports.
  procAddCS(target,res,value,caster,isCard,sign,forcedSet,ignoreBlock,charId,skillId,args={}){
    args??={};res=this.stage.break_cs_changes?.[res]??res;
    const skill=this.b.skillMap[skillId],skillRow=skill?this.db.get('skill_eff',skill.res_id):undefined;
    const immediate=this.isImmediatePassiveCSSkill(skill),triggerLog=skill?.triggerLog!=null;
    if(!this.w.isPreview&&sign==='MATHSIGN_NONE'&&skillRow?.eff.startsWith('SKILL_EFF_CS_SET_ADD'))throw new MissingBattleRule('invalid_math_sign_with_eff',{res});
    if(!ignoreBlock&&!isCard&&target>0&&!this.e.getMonster(target)){
      for(const p of this.query({source_id:target,type:'SKILL_EFF_UNIQUE_RITA_1',is_card:false,char_id:charId}))if(p.link_cs_ids?.includes(res))return -1;
    }
    const row=this.db.get('cs',res);
    const parentCard=this.db.array(row.link_skill_eff_id).some(id=>this.db.array(this.db.get('skill_eff',id).eff_opt).includes('parent_card'));
    let log;
    if(!isCard&&['SHOW_TYPE_ICON','SHOW_TYPE_ICON_OUTLINE'].includes(row.show_type)){
      if(!skill||!['SKILL_EFF_TRANSITION_SELECTED_CS_TO','SKILL_EFF_TRANSITION_CS_TO'].includes(skillRow.eff_type))log={type:this.call('getDetailLogType','log_skill_eff_cs_set_add'),params:[target,row.show_link_cs_id==='none'?res:row.show_link_cs_id,[value,value,'log_remove']],param_types:['unit_id_cs_set_add','cs_res_id_cs_set_add','delta_result'].map(x=>this.call('getLogParamType',x))};
      if(this.call('checkActiveRelicCS',skill?skill.from_relic:args.fromRelic))log=undefined;
    }
    if(!isCard&&row.cs_buff_type!=='CS_BUFF_DEBUFF'){
      let plus=0,multi=1;
      const adjust=(p,take)=>{
        const r=this.db.get('skill_eff',p.res_id);
        if(!!p.eff_opts?.includes('take')!==take||!p.link_cs_ids?.includes(res))return;
        const v=this.call('calcValue',p.skill_id,target);
        if(r.eff_value_math_sign==='MATHSIGN_ADD')plus+=v;
        else if(r.eff_value_math_sign==='MATHSIGN_SUBTRACT')plus-=v;
        else if(r.eff_value_math_sign==='MATHSIGN_MULTIPLY')multi*=v;
        else throw new MissingBattleRule('CS_VALUE_ADD.math_sign',{sign:r.eff_value_math_sign});
        this.checkTermValuePassive(p.skill_id,caster,true);
      };
      this.query({source_id:caster,type:'SKILL_EFF_CS_VALUE_ADD',is_card:false,talent:undefined,skip_error:true}).forEach(p=>adjust(p,false));
      this.query({source_id:target,type:'SKILL_EFF_CS_VALUE_ADD',is_card:false,skip_error:true}).forEach(p=>adjust(p,true));
      if([row.term_type_1,row.term_type_2].includes('TERM_TURN_VALUE')&&!!this.e.getMonster(target)!==!!this.e.getMonster(caster)){
        const ps=this.query({source_id:caster,type:'SKILL_EFF_TERM_VALUE_ADD_TERM_TURN_VALUE',is_card:false});
        if(ps.length){const out=this.call('procAddCS.turn_value_modifier',ps,{target,res,caster,plus,multi});plus=out.plus;multi=out.multi;}
      }
      value=Math.max(0,value+plus)*multi;
    }
    if(isCard)return this.call('procAddCS.card',target,res,value,caster,isCard,sign,forcedSet,ignoreBlock,charId,skillId,args);
    const owner=this.e.getUnit(target);owner.continueSkill??=[];let list=owner.continueSkill,scope;
    const monster=!!this.e.getMonster(target);
    if(!monster&&['OWN_CHAR','OWN_CHAR_EFF_TEAM'].includes(row.own_type)){
      const norm=id=>[4,5,6].includes(id)?id-3:id;charId=norm(charId);if(![1,2,3,7].includes(charId))charId=norm(target);
      if(![1,2,3,7].includes(charId))throw new MissingBattleRule('invalid_char_id',{charId,target,res});
      this.b.char.continueSkillChar??={};list=this.b.char.continueSkillChar[charId]??=[];scope=charId;
    }else if(row.own_type==='OWN_CASTER'){
      if([4,5,6].includes(caster))caster-=3;owner.continueSkillCaster??={};list=owner.continueSkillCaster[caster]??=[];
    }
    let id=-1;for(const key of list){const cs=this.b.csMap[key];if(!cs||cs.removed)continue;if(cs.res_id==res)id=key;}
    if(row.overlay_rule==='OVERLAY_CS_EACH')return this.call('procAddCS.each',target,res,value,caster,isCard,sign,forcedSet,ignoreBlock,charId,skillId,args);
    if(args.exist_id)id=args.exist_id;
    if(this.db.array(row.cs_overlay_tag??'[]').length)return this.call('procAddCS.overlay_tags',target,res,value,caster,isCard,sign,forcedSet,ignoreBlock,charId,skillId,args);
    const ctx={target,res,row,caster,isCard,sign,forcedSet,ignoreBlock,charId,skillId,args,owner,list,scope,skill,skillRow,parentCard,log,immediate,triggerLog};
    if(id<0||args.forceIndependent)return this.procAddCSNew(ctx,value);
    if(forcedSet)return this.call('procAddCS.forced',ctx,id,value);
    const cs=this.b.csMap[id];if(!cs)return -1;
    let overlay=args.exist_id?'OVERLAY_ADD_TERM_VALUE':this.db.get('cs',cs.res_id).overlay_rule;
    if(cs.res_id!=res&&overlay==='OVERLAY_ADD_TERM_VALUE_UNIQUE')overlay='OVERLAY_UNIQUE';
    if(cs.res_id!=res&&overlay==='OVERLAY_ADD_TERM_VALUE_RENEWAL')overlay='OVERLAY_RENEWAL';
    if(!['OVERLAY_ADD_TERM_VALUE_UNIQUE','OVERLAY_ADD_TERM_VALUE_RENEWAL','OVERLAY_ADD_TERM_VALUE','OVERLAY_ADD_TERM_VALUE_GLOBAL_UNIQUE'].includes(overlay))return this.call('procAddCS.overlay',ctx,id,value,overlay);
    const old=cs.term_value,desired=this.procMathSign(sign,old,value);if(old==desired)return cs.cs_id;
    const bad=(['CS_BUFF','CS_BUFF_DEBUFF'].includes(row.cs_buff_type)&&desired-old<0)||(this.call('baseDebuffType',row.cs_buff_type)&&desired-old>0);
    if(this.checkCSBlock(ctx,bad))return -1;const redirected=this.checkCSOverload(ctx,bad,desired-old);if(redirected==null)return -1;if(redirected>=0)return redirected;
    const oldGroup=log?this.getBattleBalanceCSGroupTermValue(cs.owner_id,list,cs.res_id):undefined;
    if(this.call('addTermValue',id,value,sign,caster,isCard,skillId,args.ignoreMinMax,false))this.call('removeContinueSkill',id,target,isCard,{event:true,skip_amount_event:skill?.eff_opts?.includes('ignore_cs_amount_event')});
    const now=cs.term_value,changed=old!=now,newGroup=log?this.getBattleBalanceCSGroupTermValue(cs.owner_id,list,cs.res_id):undefined;
    this.csGiveEvents(ctx,cs,now-old);
    if(log){let before=old,after=now,wanted=desired;if(oldGroup!=null&&newGroup!=null){before=oldGroup;after=newGroup;wanted=after;}
      let reported=after;if(wanted>before&&after<wanted){reported=wanted;if(cs.max!=null&&reported>cs.max)reported=cs.max;}
      log.params[2][0]=reported-before;log.params[2][1]=reported;
      if(reported!=before&&!this.call('tryDeferImmediatePassiveCSLog',log,immediate))this.call('addDetailLog',log,triggerLog);
    }
    if(changed&&parentCard){const card=this.call('getParentCard',skillId);if(card)cs.parent_cards?.push(card.id);}
    return cs.cs_id;
  }
  csGiveEvents(ctx,cs,delta){
    const {args,charId,res,target,scope,skillId,caster,row}=ctx,shown=cs.show_cs_res_id??res;
    const give=[charId,shown,delta,target,scope??-1,skillId];
    if(!args.ignoreCond){
      this.event('CONDITION_CHAR_GIVE_CS',give);
      this.call('increaseOlgaCountOnGiveCS',shown,caster,delta,skillId);
      this.event('CONDITION_CHAR_TAKE_CS',[target,shown,delta,charId,skillId]);
      this.event('CONDITION_OWN_CHAR_TAKE_CS',[scope??target,shown,delta,charId,skillId]);
    }
    if(this.visibleCS(row))this.event('CONDITION_CHAR_GIVE_CS_ALL_EXCEPT_ICS',give);
  }
  // 0x18d00 offsets 18819..23923; creation events use the incoming value,
  // including when the constructor caps the stored term value.
  procAddCSNew(ctx,value){
    const {row,sign,owner,list,skillId,res,target,caster,isCard,charId,args,skill,log,parentCard,immediate,triggerLog}=ctx;
    if(sign!=='MATHSIGN_NONE')value=this.procMathSign(sign,0,value);
    const bad=(['CS_BUFF','CS_BUFF_DEBUFF'].includes(row.cs_buff_type)&&value<0)||(this.call('baseDebuffType',row.cs_buff_type)&&value>0);
    if(this.checkCSBlock(ctx,bad))return -1;
    const redirected=this.checkCSOverload(ctx,bad,value);if(redirected==null)return -1;if(redirected>=0)return redirected;
    if(!(value>0||(value<0&&row.cs_buff_type==='CS_BUFF_DEBUFF')))return -1;
    const oldGroup=log&&!isCard?this.getBattleBalanceCSGroupTermValue(target,list,res):undefined;
    const cs=this.createContinueSkill(owner,list,skillId,res,value,target,caster,isCard,charId,{
      fromEgo:args.fromEgo??skill?.from_ego,fromPotential:args.fromPotential??skill?.from_potential,
      fromCollapse:args.fromCollapse??skill?.from_collapse,fromRelic:args.fromRelic??skill?.from_relic,
      isAuto:args.isAuto,fromDebuff:args.fromDebuff,ignoreMinMax:args.ignoreMinMax,noti:args.noti??true,origin:args.origin});
    const captured=cs.term_value,newGroup=!isCard?this.getBattleBalanceCSGroupTermValue(cs.owner_id,list,cs.res_id):undefined;
    for(const id of cs.skillEffs){const s=this.b.skillMap[id];if(this.db.get('skill_eff',s.res_id).operation==='OPERATION_PASSIVE')this.call('addPassiveSkill',s.skill_id,owner?.id??this.b.char.id,isCard,skillId);}
    this.csGiveEvents(ctx,cs,value);
    if(isCard)return this.call('procAddCS.new.card_events',ctx,cs,value);
    const u=this.e.getUnit(cs.owner_id),uid=u?.id??this.b.char.id,shown=cs.show_cs_res_id??res;
    const display=newGroup??cs.term_value+(row.overlay_rule==='OVERLAY_CS_EACH'?0:this.sameDisplaySum(cs,list));
    if(!skill?.eff_opts?.includes('ignore_cs_amount_event'))for(const event of ['CONDITION_CHAR_CS_AMOUNT','CONDITION_OWN_CHAR_CS_AMOUNT'])this.event(event,[uid,shown,display]);
    for(const event of ['CONDITION_CHAR_CS_BUFF_TYPE_COUNT','CONDITION_OWN_CHAR_CS_BUFF_TYPE_COUNT','CONDITION_CHAR_CS_BUFF_TYPE_SET'])this.event(event,[uid]);
    for(const event of ['CONDITION_CHAR_CS_TERM_VALUE_SET','CONDITION_OWN_CHAR_CS_TERM_VALUE_SET'])this.event(event,[uid,shown,display]);
    for(const event of ['CONDITION_CHAR_CS_TERM_VALUE_CHANGED','CONDITION_OWN_CHAR_CS_TERM_VALUE_CHANGED'])this.event(event,[target,shown,charId],value);
    if(row.overlay_rule==='OVERLAY_ADD_TERM_VALUE_GLOBAL_UNIQUE')this.call('procAddCS.new.global_unique',ctx,cs);
    if(log){let before=0,after=captured;if(oldGroup!=null&&newGroup!=null){before=oldGroup;after=newGroup;}
      log.params[2]=[after-before,after,'log_remove'];
      if(after!=before&&!this.call('tryDeferImmediatePassiveCSLog',log,immediate))this.call('addDetailLog',log,triggerLog);
    }
    if(parentCard){const card=this.call('getParentCard',skillId);if(card)cs.parent_cards=[card.id];}
    return cs.cs_id;
  }
  // ContinueSkillProc 0xbf00, priority order is significant.
  determineOrigin(skillId,options={}){
    if(options.origin)return options.origin;
    if(skillId>=0){const parent=this.call('getRootParent',skillId);if(parent?.type==='CARD')return 'CARD_USE';if(parent?.type==='CS'&&this.b.csMap[parent.id]?.origin)return this.b.csMap[parent.id].origin;}
    for(const [key,origin] of [['fromDebuff','DEBUFF'],['fromEgo','FATE'],['fromPotential','POTENTIAL'],['fromCollapse','COLLAPSE'],['fromRelic','RELIC']])if(options[key])return origin;
    return 'UNKNOWN';
  }
  // ContinueSkillProc 0x3bb00. Ordinary linked-skill creation and registration
  // are required ports; special pick pools and card CS remain explicit gaps.
  createContinueSkill(owner,list,skillId,res,value,target,caster,isCard,charId,options={}){
    if(isCard)return this.call('createContinueSkill.card',owner,list,skillId,res,value,target,caster,isCard,charId,options);
    const cs={};if(options.isAuto)cs.byAuto=true;
    cs.skill_added=skillId;
    for(const [field,key] of [['from_ego','fromEgo'],['from_potential','fromPotential'],['from_collapse','fromCollapse'],['from_relic','fromRelic']])cs[field]=options[key];
    cs.cs_id=this.b.cs_id++;this.b.csMap[cs.cs_id]=cs;this.e.pushChangeData('cs',cs.cs_id);
    cs.res_id=res;cs.owner_id=[1,2,3,7].includes(target)?this.b.char.id:target;cs.action_target_id=target;cs.caster_id=caster;cs.char_id=charId;
    if(this.b.cardMap[this.b.current_card]?.by_monster)cs.by_monster=true;
    cs.from_debuff=options.fromDebuff;cs.origin=this.determineOrigin(skillId,options);
    const row=this.db.get('cs',res);
    if([row.term_type_1,row.term_type_2].includes('TERM_CASTER_DEAD_WHOLE'))this.call('registerCasterDeadTermCS',caster,cs.cs_id);
    if(row.show_link_cs_id!=='none')cs.show_cs_res_id=row.show_link_cs_id;
    if(row.ignore_during_monster_turn==='YES'){
      (this.b.ignored_cs_monster_turn??=[]).push(cs.cs_id);
      if(this.call('isDuringTurnOver'))this.call('setIgnoreCS',cs.cs_id,true);
    }
    const unit=this.e.getUnit(cs.owner_id);
    if(!this.e.getMonster(cs.owner_id)&&['OWN_CHAR','OWN_CHAR_EFF_TEAM'].includes(row.own_type))cs.action_target_id=[1,2,3,7].includes(charId)?charId:unit.id;
    const others=row.overlay_rule==='OVERLAY_CS_EACH'?0:this.sameDisplaySum(cs,list);
    const group=this.balanceGroup(res),hasGroup=group?this.call('getBattleBalanceCSGroupMembers',list,res).length>0:false;
    const oldGroup=this.getBattleBalanceCSGroupTermValue(cs.owner_id,list,res);
    cs.term_value=value;
    const bound=(field,resource,type,compare)=>{
      if(['MAX','-MAX'].includes(row[resource]))return;
      if(!Number.isFinite(Number(row[resource])))throw new MissingBattleRule('invalid_cs_bound',{res,field,value:row[resource]});
      cs[field]=Number(row[resource]);
      for(const p of this.query({source_id:this.b.char.id,type,is_card:false,char_id:cs.char_id})){
        const r=this.db.get('skill_eff',p.res_id);if(!p.link_cs_ids?.includes(cs.show_cs_res_id??res))continue;
        cs[field]=this.procMathSign(r.eff_value_math_sign,cs[field],this.call('calcValue',p.skill_id));
      }
      if(!options.ignoreMinMax&&compare(cs.term_value+others,cs[field]))cs.term_value=cs[field]-others;
    };
    bound('max','overlay_value_max','SKILL_EFF_OVERLAY_VALUE_MAX_ADD',(a,b)=>a>b);
    for(const p of this.query({source_id:this.b.char.id,type:'SKILL_EFF_BAN_OVERLAY_DEBUFF',is_card:false,char_id:cs.char_id}))if(p.link_cs_ids?.includes(cs.show_cs_res_id??res)){
      const max=this.call('calcValue',p.skill_id);if(!options.ignoreMinMax&&cs.term_value+others>max)cs.term_value=max-others;
    }
    bound('min','overlay_value_min','SKILL_EFF_OVERLAY_VALUE_MIN_ADD',(a,b)=>a<b);
    const categories=this.db.array(row.invoke_value_category),rules=this.db.array(row.operation_rule),links=this.db.array(row.link_skill_eff_id),tags=this.db.array(row.cs_overlay_tag);
    if(tags.length)cs.overlay_tags=tags;
    if(row.ui_expose_icon_type==='EXPOSE_ICON_PASSIVE')cs.is_passive=true;
    if(row.ui_expose_icon_type==='EXPOSE_ICON_BUFF_UNIQUE')cs.is_unique=true;
    cs.priority=Number(row.ui_expose_priority);cs.skillEffs=[];
    if((links.length!==categories.length||links.length!==rules.length)&&res!=='cs_collapse_000')throw new MissingBattleRule('invalid_cs_skill_arrays',{res});
    if(this.db.array(row.eff_pick_pool_order).length||this.db.array(row.eff_pick_pool_ratio).length)return this.call('createContinueSkill.pick_pool',cs,owner,list,options);
    for(let i=0;i<links.length;i++){
      const s=this.call('createSkill',links[i],charId,{type:'CS',id:cs.cs_id},categories[i],rules[i],cs.term_value,charId);cs.skillEffs.push(s.skill_id);
      if(cs.from_ego&&this.db.get('skill_eff',s.res_id).trigger_noti_type==='YES')this.b.egoActionMap[s.skill_id]={char_id:cs.char_id,ego_skill_res_id:cs.from_ego};
      if(cs.from_collapse&&this.db.get('skill_eff',s.res_id).trigger_noti_type==='YES')this.b.collapseActionMap[s.skill_id]={char_id:cs.char_id,collapse_passive_res_id:cs.from_collapse};
    }
    const newGroup=this.refreshBattleBalanceCSGroup(cs.owner_id,list,res,cs),delta=newGroup==null?undefined:newGroup-(oldGroup??0);
    if(cs.from_relic)for(const key in this.b.relicMap)if(this.b.relicMap[key].res_id==cs.from_relic){this.call('registRelicCS',this.b.relicMap[key].id,cs.cs_id);break;}
    if(!['SHOW_TYPE_NONE','SHOW_TYPE_OUTLINE'].includes(row.show_type)){
      if(!['EXPOSE_VALUE_NONE','EXPOSE_VALUE_TERM_VALUE','EXPOSE_VALUE_TERM_VALUE_MAX'].includes(row.ui_expose_value_type))return this.call('createContinueSkill.invoke_ui',cs,owner,list,options);
      const action={id:cs.cs_id,char_id:charId,caster_id:caster,target_id:cs.action_target_id,cs_res_id:cs.show_cs_res_id??res,value:newGroup??cs.term_value+others,from_ego:cs.from_ego,from_relic:cs.from_relic,from_collapse:cs.from_collapse,from_card:this.b.skillMap[skillId]?.parent?.type==='CARD'};
      if(newGroup!=null)action.delta=delta;else if(others!==0)action.delta=cs.term_value;
      if(newGroup==null||delta!==0)this.e.pushAction({id:this.b.last_action_id++,type:(newGroup!=null?hasGroup:others!==0)?'action_cs_value_change':'action_cs_new',source_id:caster,action_cs:action,skip_action:!(options.noti??true)});
    }
    cs.delay=0;const casterMon=this.e.getMonster(caster),ownerMon=this.e.getMonster(cs.owner_id);
    switch(row.cs_delay_type){
      case 'CS_DELAY_NONE':break;
      case 'CS_DELAY_MUST_1':cs.delay=1;break;
      case 'CS_DELAY_ACTIVE':if(casterMon?(ownerMon?ownerMon.actioned!=null:!this.b.player_turn):ownerMon&&ownerMon.actioned!=null)cs.delay=1;break;
      case 'CS_DELAY_PASSIVE':if((casterMon||ownerMon)&&!this.b.player_turn)cs.delay=1;break;
      case 'CS_DELAY_MONSTER_TURN':if(ownerMon&&ownerMon.actioned!=null)cs.delay=1;break;
      case 'CS_DELAY_ACTIVE_MONSTER_TURN':if(casterMon&&(ownerMon?ownerMon.actioned!=null:!this.b.player_turn))cs.delay=1;break;
      default:throw new MissingBattleRule('invalid_cs_delay_type',{res,type:row.cs_delay_type});
    }
    const index=list.findIndex(id=>{const old=this.b.csMap[id];if(!old)return false;if(owner&&cs.is_passive)return !old.is_passive||old.priority<cs.priority;if(owner&&cs.is_unique)return !old.is_passive&&(!old.is_unique||old.priority<cs.priority);return !old.is_passive&&!old.is_unique&&old.priority<cs.priority;});
    if(index<0)list.push(cs.cs_id);else list.splice(index,0,cs.cs_id);
    cs.init_tv=cs.term_value;this.call('refreshAlwaysDamage',cs.owner_id,cs.res_id);
    if(res==='cs02_0619'&&this.e.getMonster(target))this.call('createContinueSkill.half_death',cs,target);
    return cs;
  }
  registerCasterDeadTermCS(caster,id){const map=this.b.caster_dead_term_cs_map??={};const ids=map[caster]??[];if(!ids.includes(id)){ids.push(id);map[caster]=ids;}}
  // continue_skill 0x6a00 and ContinueSkillProc 0x5eb00.
  baseDebuffType(type){return type==='CS_DEBUFF'||type==='CS_DEBUFF_DOT';}
  checkActiveRelicCS(res){return !!res&&this.db.array(this.db.get('relic',res).outline_link_condition_id).length>0;}
  // ConstantMetagameImpl 0x1d00: return row.value without coercion. The
  // Default bootstrap ResourceError constructs an Error and returns. A live
  // override remains a separate runtime input/identity verification boundary.
  constantMetagame(id,options={}){
    const row=this.db.table('constant_meta')[id];if(row!=null)return row.value;
    if(!options?.skip_error)this.call('ResourceError',`err: constant_meta 테이블에 해당 key가 없습니다 <@silenteye> : ${id}`);
    return options?.def_value??0;
  }
  constantMetagameSkipError(id){const row=this.db.table('constant_meta')[id];return row?row.value:undefined;}
  // Worktable 0x24e00 / StageWorktable 0x57300. Slot seven is the assault
  // fourth character; the other slots are direct one-based array lookups.
  tryGetCharByCharId(id){return id==7?this.b.assault_fourth_char:this.b.chars[id-1];}
  tryGetStageCharByCharId(id,stageWT){const stage=stageWT===undefined?this.stage:stageWT.battle_stage;return id==7?stage.assault_fourth_char:stage.chars[id-1];}
  // BattleCardProc 0x20e00; only the two resource IDs below increment Olga,
  // only from player cards, and one per application regardless of value.
  increaseOlgaCountOnGiveCS(res,caster,delta,skillId){
    if(delta<=0||!['cs00_0369','cs00_0004'].includes(res)||this.e.getMonster(caster))return;
    const parent=this.call('getRootParent',skillId);if(parent?.type!=='CARD')return;
    const origin=this.b.cardMap[parent.id];if(!origin||origin.by_monster)return;
    for(const id of this.b.deck_info.all.slice()){
      const card=this.b.cardMap[id];if(!card||!card.talents?.some(t=>[52,55,56].includes(t)))continue;
      const current=card.olga_count??0;if(current>=(card.base_olga_count??0))continue;
      this.setOlgaCount(card.id,current+1);
    }
  }
  // BattleCardProc 0x1f800. Persist into both the battle and stage card.
  setOlgaCount(id,count,options={}){
    const card=this.b.cardMap[id];if(!card)return;
    count=Math.max(0,Math.min(card.base_olga_count??0,count));this.e.pushChangeData('card',id);card.olga_count=count;
    const stageCard=this.stage.all.find(c=>c.id==id);
    if(stageCard){stageCard.olga_count=count;stageCard.base_olga_count=card.base_olga_count;}
    this.e.pushAction({id:this.b.last_action_id++,type:'action_card_talent_olga',action_card_property:{card:id,olga_count:count,base_olga_count:card.base_olga_count},source_id:card.caster_id});
    if(options?.procCondition??true)this.call('procCardEvent','CONDITION_CARD_TALENT_UNIQUE_OLGA_STACK_AMOUNT',0,id);
  }
  // SkillEffectProc 0x1f4300.
  getStatSource(type,owner,caster,charId){
    switch(type){
      case 'NONE':return [4,5,6].includes(charId)?charId-3:charId;
      case 'STAT_SOURCE_MONSTER':return this.b.monsters[0].id;
      case 'STAT_SOURCE_USER':return this.b.char.id;
      case 'STAT_SOURCE_OWNER':return this.e.getMonster(owner)?owner:this.b.char.id;
      case 'STAT_SOURCE_APPLY':return this.e.getMonster(caster)?caster:this.b.char.id;
      case 'STAT_SOURCE_ENEMY':return this.e.getMonster(owner)?this.b.char.id:this.b.monsters[0].id;
      case 'STAT_SOURCE_TRIGGERED_CHAR':return -1;
      default:throw new MissingBattleRule('invalid_stat_source_type',{type});
    }
  }
  // 0x1a5800. Resource CSV numbers are decoded explicitly in the offline store.
  initSkillEffValue(row,charId){
    const value=Number(row.eff_value);
    if(!this.call('tryGetCharByCharId',charId))return value;
    const stageChar=this.call('tryGetStageCharByCharId',charId);
    return stageChar?.skill_ev_add==null?value:value+(stageChar.skill_ev_add[row.id]??0);
  }
  // 0x19fc00. The ordinary CS case covers cs03_0131_01. Complex during-
  // effects, condition-stack creation, relic registration and random fixed
  // values are explicit continuation ports instead of invented defaults.
  createSkill(res,caster,parent,category,rule,termValue,charId,skipTiming){
    const s={skill_id:this.b.skill_id++};this.b.skillMap[s.skill_id]=s;
    const nativeCategory=csEnum(category,CS_CATEGORY),nativeRule=csEnum(rule,CS_OPERATION);
    if(nativeCategory!==0)s.cs_value_category=nativeCategory;
    if(nativeRule!==0)s.cs_operation_rule=nativeRule;
    s.parent=parent;this.e.pushChangeData('skill',s.skill_id);s.action_char_id=[4,5,6].includes(charId)?charId-3:charId;
    const row=this.db.get('skill_eff',res);let owner=caster;
    if(parent.type==='CS'){const cs=this.b.csMap[parent.id];if(cs){owner=cs.owner_id;for(const key of ['from_ego','from_collapse','from_relic'])s[key]=cs[key];}}
    s.res_id=res;
    for(const [field,key] of [['eff_opts','eff_opt'],['eff_opt_multiple_link','eff_opt_multiple_link'],['link_cs_ids','link_cs_id'],['target_unit_type_opt','target_unit_type_opt']]){
      let arr=this.db.array(row[key]);if(field==='link_cs_ids')arr=arr.map(id=>this.stage.break_cs_changes?.[id]??id);if(arr.length)s[field]=arr;
    }
    s.caster_id=caster;this.setSkillTermValue(s,termValue);s.eff_value=this.initSkillEffValue(row,charId);s.stat_source=caster;
    if(parent.type==='CS'){const cs=this.b.csMap[parent.id];if(cs)s.stat_source=this.getStatSource(row.eff_value_stat_source_target,cs.owner_id,cs.caster_id,cs.char_id);}
    else if(parent.type==='CARD'){const c=this.b.cardMap[parent.id];s.stat_source=this.getStatSource(row.eff_value_stat_source_target,c.caster_id,c.caster_id,c.char_id);}
    else return this.call('createSkill.parent',s,{res,caster,parent,category,rule,termValue,charId,skipTiming});
    for(let i=0;;i++){
      const during=row[`during_eff_${i}_link_skill_eff_id`];
      if(during==null||['none','[]'].includes(during))break;
      if(during!==res)return this.call('createSkill.during',s,i,owner);
    }
    if(row.eff_link_condition_id==='never')s.usable=false;
    else if(row.eff_link_condition_id==='none'){
      delete s.usable;
      if(row.operation==='OPERATION_TRIGGER'&&!skipTiming)(this.b.check_timing_all??=[]).push(s.skill_id);
    }else return this.call('createSkill.condition',s,owner,row.eff_link_condition_id);
    if(s.from_relic)this.call('createSkill.relic',s,owner);
    for(const field of ['eff_value_0_link_condition_id','eff_value_1_link_condition_id','eff_count_value_0_link_condition_id','eff_count_value_1_link_condition_id'])if(row[field]!=='none')return this.call('createSkill.value_condition',s,owner,field);
    const fixed='VALUE_RANDOM_RANGE_VALUE_OPT_FIXED_BEFORE_USE';
    if([row.eff_value_type_1,row.eff_value_type_2].includes(fixed))this.call('calcValue',s.skill_id);
    if(row.eff_count_value_type===fixed)this.call('calcCountValue',s.skill_id);
    if(row.target_card_set_list_count_type===fixed)this.call('calcTargetCardSetListCount',s.skill_id);
    return s;
  }
  // Worktable 0x1d9900; insertion is descending priority, preserving equal
  // priorities. Registration may be deferred by unusable conditional skills.
  addPassiveSkill(skillId,owner,isCard,sourceSkill){
    const s=this.b.skillMap[skillId],ordinary=s.passiveDuring==null;
    if(s.usable===false&&ordinary){s.add_passive_info=[owner,isCard,sourceSkill,true];return;}
    if(s.stack_trigger&&ordinary)s.add_passive_info=[owner,isCard,sourceSkill,false];
    const row=this.db.get('skill_eff',s.res_id),unit=isCard?this.b.cardMap[owner]:this.e.getUnit(owner);
    if(isCard)unit.passive??=[];
    const list=unit.passive,index=list.findIndex(p=>p[1]<Number(row.run_priority)),item=[skillId,Number(row.run_priority)];
    if(index>=0)list.splice(index,0,item);else list.push(item);this.call('invalidatePassiveTypeIndex',list);
    if(isCard)return this.call('addPassiveSkill.card_effect',skillId,owner,isCard,sourceSkill);
    switch(row.eff){
      case 'SKILL_EFF_VALUE_CHANGE_PASSIVE':this.call('checkValueChangePassive',skillId);break;
      case 'SKILL_EFF_RUN_PCT_ADD':this.call('checkRunPctAddPassive',skillId,owner,false);break;
      case 'SKILL_EFF_DAMAGE_VALUE_ADD':if((owner==this.b.char.id&&s.eff_opts?.includes('take'))||(owner!=this.b.char.id&&!s.eff_opts?.includes('take')))this.call('refreshMonsterNoti');break;
      case 'SKILL_EFF_DAMAGE_FIX':case 'SKILL_EFF_MONSTER_NOTI_UNKNOWN':case 'SKILL_EFF_TARGET_CS_VALUE_ADD':this.call('refreshMonsterNoti');break;
      case 'SKILL_EFF_CARD_RETAIN':case 'SKILL_EFF_CARD_CONNECT':case 'SKILL_EFF_CARD_OVERWRITE':case 'SKILL_EFF_CARD_CHANGE_PASSIVE':case 'SKILL_EFF_ENERGY_MAINTAIN':case 'SKILL_EFF_CARD_USE_BAN':case 'SKILL_EFF_TUTORIAL_BAN_CARD_USE':case 'SKILL_EFF_TARGET_UNABLE':case 'SKILL_EFF_EGOSKILL_COST_CHANGE':case 'SKILL_EFF_CARD_COST_CHANGE_PASSIVE':case 'SKILL_EFF_OVERLAY_VALUE_MAX_ADD':case 'SKILL_EFF_OVERLAY_VALUE_MIN_ADD':case 'SKILL_EFF_CHANGE_EGO':return this.call('addPassiveSkill.effect',skillId,owner,isCard,sourceSkill,row.eff);
      // Source default has no eager side effect; the registered passive is
      // queried later by its corresponding combat rule.
    }
  }
  // Worktable 0x1e5600: remove the first matching registration before
  // recalculating dependent properties. Unsupported effect branches stop.
  removePassiveSkillBySkillID(skillId,owner,isCard){
    const unit=isCard?this.b.cardMap[owner]:this.e.getUnit(owner);
    if(unit.passive==null)return;
    const index=unit.passive.findIndex(p=>p[0]==skillId);if(index<0)return;
    const [entry]=unit.passive.splice(index,1);
    this.call('invalidatePassiveTypeIndex',unit.passive);
    const s=this.b.skillMap[entry[0]],row=this.db.get('skill_eff',s.res_id);
    const cardEvent=(type,place)=>this.call('procCardEvent',type,place,-1);
    const amounts=place=>{cardEvent('CONDITION_CARD_AMOUNT',place);cardEvent('CONDITION_CARD_AMOUNT_SET',place);};
    const cardAction=(type,property,extra={})=>this.e.pushAction({id:this.b.last_action_id++,type,action_card_property:{card:owner,...property},source_id:-1,...extra});
    if(isCard){
      switch(row.eff){
        case 'SKILL_EFF_CARD_USE_BAN':if(!this.call('checkBan',owner))cardAction('action_card_banned',{banned:false});break;
        case 'SKILL_EFF_TUTORIAL_BAN_CARD_USE':this.call('checkTutorialBan',owner);break;
        case 'SKILL_EFF_CARD_COST_CHANGE':{
          const {new_cost}=this.call('updateCostResult',owner);this.e.pushChangeData('card',owner);cardAction('action_card_cost',{cost:new_cost},{skip_action:unit.card_place!=2});break;
        }
        case 'SKILL_EFF_CARD_RETAIN':
          if(!this.query({source_id:owner,type:row.eff,is_card:true}).length){cardAction('action_card_retain',{retain:false});amounts(unit.card_place);}break;
        case 'SKILL_EFF_CARD_CONNECT':
          if(!this.query({source_id:owner,type:row.eff,is_card:true}).length){unit.connect_passive=false;cardAction('action_card_connect',{connect:false});amounts(unit.card_place);}break;
        case 'SKILL_EFF_CARD_TESTAMENT':
          if(!this.query({source_id:owner,type:row.eff,is_card:true}).length){
            unit.testament_passive=false;
            if(unit.testament_passive_outline_added&&unit.interruptKeywords){
              const i=unit.interruptKeywords.indexOf('SKILL_EFF_CARD_DISCARD');if(i>=0)unit.interruptKeywords.splice(i,1);
              if(!unit.interruptKeywords.length)unit.interruptKeywords=undefined;unit.testament_passive_outline_added=undefined;
            }
            this.e.pushChangeData('card',owner);amounts(unit.card_place);
          }break;
        case 'SKILL_EFF_RUN_PCT_ADD':this.call('checkRunPctAddPassive',skillId,owner,isCard??false);break;
        case 'SKILL_EFF_CHANGE_EGO':case 'SKILL_EFF_CARD_CHANGE_DEBUFF':
          return this.call('removePassiveSkillBySkillID.effect',skillId,owner,isCard,row.eff);
      }
      return;
    }
    switch(row.eff){
      case 'SKILL_EFF_CARD_RETAIN':amounts(2);break;
      case 'SKILL_EFF_VALUE_CHANGE_PASSIVE':this.call('checkValueChangePassive',skillId);break;
      case 'SKILL_EFF_RUN_PCT_ADD':this.call('checkRunPctAddPassive',skillId,owner,isCard??false);break;
      case 'SKILL_EFF_DAMAGE_VALUE_ADD':
        if(unit.id==this.b.char.id?s.eff_opts?.includes('take'):!s.eff_opts?.includes('take'))this.call('refreshMonsterNoti');break;
      case 'SKILL_EFF_DAMAGE_FIX':this.call('refreshMonsterNoti');break;
      case 'SKILL_EFF_TARGET_UNABLE':
        if(!this.query({source_id:owner,type:row.eff,is_card:false}).length){
          if(unit.state==='target_unable')unit.state='none';
          this.e.pushAction({id:this.b.last_action_id++,type:'action_monster_unclocking',source_id:owner});
          this.event('CONDITION_MONSTER_AMOUNT',[]);this.event('CONDITION_MONSTER_AMOUNT_SET',[]);
        }break;
      case 'SKILL_EFF_EGOSKILL_COST_CHANGE':{
        let changed=false;this.b.ep_skill_deck.forEach(ep=>{if(ep){const old=ep.cost;ep.cost=this.call('getEpSkillCost',ep);if(old!=ep.cost)changed=true;}});
        if(changed)this.e.pushAction({id:this.b.last_action_id++,type:'action_ep_skill_slots',source_id:-1,action_ep_skill_slots:this.b.ep_skill_deck.slice()});break;
      }
      case 'SKILL_EFF_CARD_CONNECT':{
        const targets=this.call('getTargetCards',skillId,false,false,false).target_cards_id;
        targets.forEach(id=>this.e.pushAction({id:this.b.last_action_id++,type:'action_card_connect',action_card_property:{card:id,connect:false},source_id:-1}));amounts(2);break;
      }
      case 'SKILL_EFF_CARD_CHANGE_PASSIVE':
        this.b.deck_info.all.forEach(id=>{
          const card=this.b.cardMap[id];if(!card)return;const previous=card.beforeCollapseCard;
          if(previous?.before_card_change_passive_card&&previous.card_change_passive_skill_id==skillId)card.beforeCollapseCard=structuredClone(previous.before_card_change_passive_card);
          if(card.before_card_change_passive_card&&card.card_change_passive_skill_id==skillId)this.call('recoverCardChangePassive',id);
        });break;
      case 'SKILL_EFF_CARD_USE_BAN':
        this.b.deck_info.all.forEach(id=>{if(!this.call('checkBan',id))this.e.pushAction({id:this.b.last_action_id++,type:'action_card_banned',action_card_property:{card:id,banned:false},source_id:-1});});break;
      case 'SKILL_EFF_TUTORIAL_BAN_CARD_USE':this.b.deck_info.all.forEach(id=>this.call('checkTutorialBan',id));break;
      case 'SKILL_EFF_CARD_COST_CHANGE_PASSIVE':
        this.b.deck_info.all.forEach(id=>{
          const card=this.b.cardMap[id],{changed,new_cost}=this.call('updateCostResult',id);this.e.pushChangeData('card',id);
          if(changed)this.e.pushAction({id:this.b.last_action_id++,type:'action_card_cost',action_card_property:{card:id,cost:new_cost},skip_action:card.card_place!=2,source_id:-1});
        });break;
      case 'SKILL_EFF_CARD_OVERWRITE':case 'SKILL_EFF_HAND_UNUSABLE_EXCEPT_1':case 'SKILL_EFF_CHANGE_EGO':
        return this.call('removePassiveSkillBySkillID.effect',skillId,owner,isCard,row.eff);
    }
  }
  // Worktable 0x1d0900 + callbacks: passive changes only refresh the
  // side effects selected here; the default is genuinely side-effect free.
  checkPassiveSkill(skillId,owner,isCard){
    const s=this.b.skillMap[skillId],row=this.db.get('skill_eff',s.res_id);
    const emitCost=(card,cost)=>this.e.pushAction({id:this.b.last_action_id++,type:'action_card_cost',action_card_property:{card:card.id,cost},source_id:-1,skip_action:card.card_place!=2});
    if(isCard){
      if(row.eff==='SKILL_EFF_CARD_COST_CHANGE'){
        const card=this.b.cardMap[owner],old=card.cost_result??card.cost,{changed,new_cost}=this.call('updateCostResult',owner);
        this.e.pushChangeData('card',owner);let log=changed,event=true;
        const spark=this.db.get('constant_meta','spark_cost_cs_id').value.toString();
        if(s.parent.type==='CS'){
          const cs=this.b.csMap[s.parent.id];
          if(cs){if(cs.res_id==spark){log=false;event=false;}if(cs.caster_id==card.id)event=false;}
        }
        if(log)this.call('addDetailLog',{type:'log_skill_eff_card_cost_change',params:[owner,new_cost-old],param_types:['card_id','cost']});
        if(changed){emitCost(card,new_cost);if(event&&new_cost<old)this.call('procCardEvent','CONDITION_CARD_COST_DECREASE',card.card_place,card.id,{skill_id:s.add_passive_info?.[2]});}
      }else if(row.eff==='SKILL_EFF_RUN_PCT_ADD')this.call('checkRunPctAddPassive',skillId,owner,true);
      else if(row.eff==='SKILL_EFF_UNIQUE_TIPERA_1'){
        const card=this.b.cardMap[owner],mode=s.eff_opts?.[0];
        if(mode==='ran'||mode==='all'){
          const pool=card.skill_eff_ids.filter(id=>!card.r_spark_skill_eff_ids?.includes(id));
          if(pool.length){
            const count=this.call('calcCountValue',skillId),indices=s.tipera_indices??[];
            if(count>indices.length){for(let i=indices.length;i<count;i++)indices.push(mode==='ran'?this.e.random.randRange(0,0,pool.length):0);s.tipera_indices=indices;}
            else if(count<indices.length)s.tipera_indices=indices.slice(0,count);
          }
        }
        if(card?.card_place==2){this.e.pushChangeData('card',owner);this.e.pushAction({id:this.b.last_action_id++,type:'action_card_text_refresh',action_card_property:{card:owner},source_id:-1});}
      }
      return;
    }
    if(owner==this.b.char.id){
      switch(row.eff){
        case 'SKILL_EFF_OVERLAY_VALUE_MAX_ADD':case 'SKILL_EFF_OVERLAY_VALUE_MIN_ADD':this.call('refreshMinMax',s.link_cs_ids);break;
        case 'SKILL_EFF_VALUE_CHANGE_PASSIVE':this.call('checkValueChangePassive',skillId);break;
        case 'SKILL_EFF_RUN_PCT_ADD':this.call('checkRunPctAddPassive',skillId,owner,false);break;
        case 'SKILL_EFF_DAMAGE_VALUE_ADD':if(s.eff_opts?.includes('take'))this.call('refreshMonsterNoti');break;
        case 'SKILL_EFF_DAMAGE_FIX':this.call('refreshMonsterNoti');break;
        case 'SKILL_EFF_EGOSKILL_COST_CHANGE':{
          let changed=false;this.b.ep_skill_deck.forEach(ep=>{if(ep){const old=ep.cost;ep.cost=this.call('getEpSkillCost',ep);if(old!=ep.cost)changed=true;}});
          if(changed)this.e.pushAction({id:this.b.last_action_id++,type:'action_ep_skill_slots',source_id:-1,action_ep_skill_slots:this.b.ep_skill_deck.slice()});break;
        }
        case 'SKILL_EFF_CARD_COST_CHANGE_PASSIVE':
          this.b.deck_info.all.forEach(id=>{
            const card=this.b.cardMap[id],{changed,old_cost,new_cost}=this.call('updateCostResult',id);
            if(changed){this.e.pushChangeData('card',id);emitCost(card,new_cost);if(new_cost<old_cost)this.call('procCardEvent','CONDITION_CARD_COST_DECREASE',card.card_place,card.id,{skill_id:s.add_passive_info?.[2]});}
          });break;
      }
    }else if(row.eff==='SKILL_EFF_DAMAGE_VALUE_ADD'&&!s.eff_opts?.includes('take'))this.call('refreshMonsterNoti');
  }
  // Worktable 0x1cb800, 0x1c6700 and children 0x1c7300/0x1c9d00.
  getWholeTermType(term){
    if(term==='TERM_TURN_VALUE')return 'TERM_TURN_VALUE_WHOLE';
    if(term==='TERM_TURN_VALUE_DISCARD_BEFORE')return 'TERM_TURN_VALUE_DISCARD_BEFORE_WHOLE';
    return term;
  }
  procCSTermByTiming(term){
    const whole=this.getWholeTermType(term),removed=[];
    const tick=(id,unit,isCard)=>{
      const cs=this.b.csMap[id];if(!cs)return;
      if(isCard&&!cs.isCard)throw new MissingBattleRule('invalid_card_cs',{id});
      const row=this.db.get('cs',cs.res_id),ext=this.resolveCSExtension(cs),selected=ext.extension_passive;
      const matches=t=>row.term_type_1==t||row.term_type_2==t;
      let delta,recordDelta,cardFlag=false;
      if(!selected){
        if(matches(term)){delta=-1;recordDelta=1;cardFlag=!!isCard;}
        else if(matches(whole)){delta=-cs.term_value;recordDelta=delta;}
      }else if(ext.extension_result<cs.term_value&&matches(whole)){
        delta=-cs.term_value+ext.extension_result;recordDelta=delta;
      }
      if(delta!==undefined){
        this.e.pushChangeData('cs',id);
        if(cs.delay>0)cs.delay--;
        else if(this.call('addTermValue',id,delta,'MATHSIGN_ADD',0,cardFlag))removed.push([id,recordDelta]);
      }
      // Extension selection consumes its own duration even if this CS did not
      // match the current timing; preserve the original control flow.
      if(selected)this.checkTermValuePassive(selected.skill_id,0);
      for(const s of ext.check_extension_passives)if(s.skill_id!=selected?.skill_id)this.checkTermValuePassive(s.skill_id,0);
      if(!isCard&&cs.res_id==this.call('constantMetagame','cs_pain'))unit.painTurnStart=cs.term_value;
    };
    this.e.reactionSupport.continueSkills(this.b.char).forEach(id=>tick(id,this.b.char,false));
    for(const mon of this.b.monsters){
      if(!this.call('isFieldMonster',mon))continue;
      mon.painTurnStart=undefined;
      for(const id of this.e.reactionSupport.continueSkills(mon))tick(id,mon,false);
    }
    for(const key in this.b.cardMap){
      const card=this.b.cardMap[key],missing=[];
      card.continueSkill?.forEach(id=>{if(!this.b.csMap[id]){missing.push(id);return;}tick(id,card,true);});
      card.continueSkill=card.continueSkill?.filter(id=>!missing.includes(id));
    }
    return removed;
  }
  // 0x1cc300. The returned delta for a one-point expiration is +1 in the
  // original, so old_tv is -1; do not normalize this apparent asymmetry.
  procCSTermByTurnDiscardBefore(){
    const ret={},skip={};
    for(const [id,delta] of this.procCSTermByTiming('TERM_TURN_VALUE_DISCARD_BEFORE')){
      const cs=this.b.csMap[id];if(!cs)continue;
      const result=this.call('removeContinueSkill',id,cs.owner_id,cs.isCard,{old_tv:-delta});
      if(result){for(const k in result.ret)ret[k]=result.ret[k];for(const k in result.ret_skip)skip[k]=result.ret_skip[k];}
    }
    for(const [map,hidden] of [[ret,false],[skip,true]])if(Object.keys(map).length){
      const payload={cards_debuffs:map,effect_type:1};if(hidden)payload.skip=true;
      this.e.pushAction({id:this.b.last_action_id++,type:'action_card_debuff',action_card_debuff:payload,source_id:-1});
    }
  }
  // 0x1cd700 + 0x1ce100.
  procCSTermByTurn(){
    if(this.b.turn==1)return;
    this.b.char.painTurnStart=undefined;
    for(const [id,delta] of this.procCSTermByTiming('TERM_TURN_VALUE')){
      const cs=this.b.csMap[id];if(!cs)throw new MissingBattleRule('invalid_cs_id',{id});
      this.call('removeContinueSkill',id,cs.owner_id,cs.isCard,{old_tv:-delta});
    }
    this.b.deck_info.hand.forEach(id=>{const card=this.b.cardMap[id];if(!card.by_turn_draw){this.e.pushChangeData('card',id);card.by_turn_draw=true;}});
  }
  // 0x4a200 + callbacks 0x4b400/0x4c300. Expirations are removed after iteration.
  checkTermValue(owner,term,caster,isCard=false,options={}){
    const {isWhole,exact_cs_id,delta_value,delta_pct,force_termination}=options??{};
    let list;
    if(isCard){const card=this.b.cardMap[owner];if(card.continueSkill==null)card.continueSkill=[];list=card.continueSkill;}
    else if(term==='TERM_ANY_OWN_CARD_USE'&&[1,2,3,7].includes(owner))list=this.b.char.continueSkillChar?.[owner]??[];
    else list=this.e.reactionSupport.continueSkills(this.e.getUnit(owner));
    const remove=[];
    list.forEach(id=>{
      if(exact_cs_id!=null&&exact_cs_id!=id)return;
      const cs=this.b.csMap[id];if(!cs||(cs.ignored&&!force_termination))return;
      const res=this.db.get('cs',cs.res_id);if(res.term_type_1!=term&&res.term_type_2!=term)return;
      const ext=force_termination?undefined:this.resolveCSExtension(cs);
      if(cs.delay>0&&!force_termination){cs.delay--;return;}
      const selected=ext?.extension_passive,checks=ext?.check_extension_passives??[];
      if(!selected){
        let delta=-1;
        if(isWhole)delta=-cs.term_value;
        else if(delta_pct!=null)delta=-cs.term_value+floorGame(cs.term_value*(100-delta_pct)/100);
        else if(delta_value!=null)delta=-Math.min(delta_value,cs.term_value);
        this.event('CONDITION_CHAR_TERM_TYPE',[owner,cs.show_cs_res_id??cs.res_id]);
        if(this.call('addTermValue',id,force_termination?0:delta,force_termination?'MATHSIGN_SET':'MATHSIGN_ADD',caster,isCard,undefined,force_termination))remove.push([id,delta]);
      }else this.checkTermValuePassive(selected.skill_id,caster);
      for(const s of checks)if(s.skill_id!=selected?.skill_id)this.checkTermValuePassive(s.skill_id,0);
    });
    remove.forEach(([id,delta])=>{const cs=this.b.csMap[id];if(cs)this.call('removeContinueSkill',id,cs.owner_id,cs.isCard,{old_tv:-delta});});
  }
  // 0x4f400. All passive term variants, immediate deduplication, deferred writes,
  // extension chaining, preview handling, and trigger events retain their order.
  checkTermValuePassive(skillId,caster,deferred=false,preview=false){
    if(++this.depth>256){this.depth--;throw new MissingBattleRule('passive_term_recursion_budget');}
    try{return this._checkTermValuePassive(skillId,caster,deferred,preview);}finally{this.depth--;}
  }
  _checkTermValuePassive(skillId,caster,deferred,preview){
    const skill=this.b.skillMap[skillId];
    if(skill.parent.type!=='CS')return;
    const id=skill.parent.id,cs=this.b.csMap[id];if(cs==null||cs.ignored)return;
    const res=this.db.get('cs',cs.res_id),has=t=>res.term_type_1===t||res.term_type_2===t;
    const last=cs.skillEffs.at(-1)==skillId;
    const whole=has('TERM_PASSIVE_WHOLE')||(last&&has('TERM_PASSIVE_WHOLE_FINALLY'))||has('TERM_PASSIVE_IMMEDIATLEY_WHOLE');
    const immediate=has('TERM_PASSIVE_IMMEDIATLEY')||(last&&has('TERM_PASSIVE_IMMEDIATLEY_FINALLY'))||has('TERM_PASSIVE_IMMEDIATLEY_WHOLE');
    const consuming=has('TERM_PASSIVE')||(last&&has('TERM_PASSIVE_FINALLY'))||whole||immediate;
    if(immediate){if(this.w.termPassiveImmediatlyList.includes(skillId))return;this.w.termPassiveImmediatlyList.push(skillId);}
    if(!skill.eff_opts?.includes('ignore_trigger_cs')){
      const params=[cs.char_id,cs.show_cs_res_id??cs.res_id];
      this.event('CONDITION_CHAR_CS_TRIGGER',params);
      this.event('CONDITION_OWN_CHAR_CS_TRIGGER',[...params]);
    }
    const skillRes=this.db.get('skill_eff',skill.res_id);
    if(this.w.isPreview&&skillRes.run_pct==100){
      const triggered=this.call('getTriggeredList',skillId).triggeredList;
      for(const field of ['relic','ego','cs'])this.w.triggeredList[field].push(...triggered[field]);
    }
    const ext=this.resolveCSExtension(cs,{selectBest:false});
    if(!ext.extension_matched&&consuming){
      const delta=whole?-cs.term_value:-1;
      if(deferred&&!immediate){
        if(preview){const map=this.w.previewChangeCS;map[id]=id in map?map[id]+delta:delta;}
        else{this.event('CONDITION_CHAR_TERM_TYPE',[cs.owner_id,cs.show_cs_res_id??cs.res_id]);const map=this.b.change_cs;map[id]=id in map?map[id]+delta:delta;}
      }else if(preview){
        if(this.call('addTermValuePre',id,delta,'MATHSIGN_ADD',caster,false))this.removeContinueSkillPre(id,cs.owner_id,cs.isCard);
      }else{
        this.event('CONDITION_CHAR_TERM_TYPE',[cs.owner_id,cs.show_cs_res_id??cs.res_id]);
        if(this.call('addTermValue',id,delta,'MATHSIGN_ADD',caster,false,skillId))this.call('removeContinueSkill',id,cs.owner_id,cs.isCard,{old_tv:-delta});
      }
    }
    if(ext.extension_passive)this.checkTermValuePassive(ext.extension_passive.skill_id,caster,undefined,preview);
    for(const s of ext.check_extension_passives)if(s.skill_id!=ext.extension_passive?.skill_id)this.checkTermValuePassive(s.skill_id,0);
  }
}
