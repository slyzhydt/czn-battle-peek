// Independent hand ports of ContinueSkillProc 0x18d00 / 0x3bb00.
// The retained linear views are data, never imported or executed. Source quirks
// (RENEWAL's double math operation and the two-array pool splice) are deliberate.
import {LifecycleRuntime} from './lifecycle-runtime.mjs';
import {MissingBattleRule} from './resource-store.mjs';
import {readCardPlaces} from './event-runtime.mjs';
import {relativeProbabilityIndex} from '../turn-enemy/monster-pattern-core.mjs';

export const CS_CREATION_METHODS=['procAddCS','createContinueSkill','removeContinueSkill','isDuringTurnOver','setIgnoreCS','registRelicCS','isFromRSpark'];
const ADD=new Set(['OVERLAY_ADD_TERM_VALUE','OVERLAY_ADD_TERM_VALUE_UNIQUE','OVERLAY_ADD_TERM_VALUE_RENEWAL','OVERLAY_ADD_TERM_VALUE_GLOBAL_UNIQUE']);
const VALUE_UI=new Set(['EXPOSE_VALUE_NONE','EXPOSE_VALUE_TERM_VALUE','EXPOSE_VALUE_TERM_VALUE_MAX']);
const PLAYER_SLOTS=[1,2,3,7],norm=id=>[4,5,6].includes(id)?id-3:id;

export class CSCreationRuntime extends LifecycleRuntime {
  constructor(e){super(e);this.P=readCardPlaces();}
  // Keep callbacks in the public dispatcher: creation may recurse through a
  // block/redirect passive, and another runtime owns term consumption/removal.
  checkCSBlock(ctx,bad){
    if(ctx.isCard)return false;
    const blockers=this.query({source_id:ctx.target,type:'SKILL_EFF_BLOCK_DEBUFF',is_card:false});
    for(const p of blockers){if(p.eff_opts)p.eff_opts.push('debuff');else p.eff_opts=['debuff'];}
    const bans=this.query({source_id:ctx.target,type:'SKILL_EFF_CS_SET_ADD_BAN',is_card:false});
    if(ctx.ignoreBlock)return false;
    for(const p of blockers.concat(bans)){
      if(!this.visibleCS(ctx.row)||p.link_cs_ids?.length&&!p.link_cs_ids.includes(ctx.res)||p.eff_opts?.includes('debuff')&&!bad)continue;
      this.call('checkTermValuePassive',p.skill_id,ctx.caster);
      this.call('addDetailLog',{type:'log_skill_eff_block_debuff',params:[ctx.target,ctx.res],param_types:['unit_id','cs_res_id']});
      this.e.pushAction({id:this.b.last_action_id++,type:'action_system_effect',source_id:ctx.target,command:'debuff_immune'});return true;
    }
    return false;
  }
  checkCSOverload(ctx,bad,delta){
    const ps=this.query({source_id:ctx.target,type:'SKILL_EFF_OVERLOAD',is_card:false});
    if(!ps.length||!this.visibleCS(ctx.row)||!bad)return -1;
    const ids=this.call('getTargetableMonstersID'),index=ids.findIndex(id=>id==ctx.target);if(index>=0)ids.splice(index,1);
    if(!ids.length)return -1;
    if(this.w.isPreview&&ids.length!==1)return undefined;
    return this.call('procAddCS',this.e.random.randomArrayMember(0,ids),ctx.res,delta,ctx.caster,ctx.isCard,'MATHSIGN_ADD',ctx.forcedSet,ctx.ignoreBlock,ctx.charId,ctx.skillId,ctx.args);
  }
  badCS(row,value){return (['CS_BUFF','CS_BUFF_DEBUFF'].includes(row.cs_buff_type)&&value<0)||(this.call('baseDebuffType',row.cs_buff_type)&&value>0);}
  blockedResult(ctx,bad,value){if(this.checkCSBlock(ctx,bad))return -1;const redirect=this.checkCSOverload(ctx,bad,value);return redirect==null?-1:redirect>=0?redirect:undefined;}
  detail(ctx,log){if(log&&!this.call('tryDeferImmediatePassiveCSLog',log,ctx.immediate))this.call('addDetailLog',log,ctx.triggerLog);}
  csLog(owner,res,delta,value){return {type:this.call('getDetailLogType','log_skill_eff_cs_set_add'),params:[owner,res,[delta,value,'log_remove']],param_types:['unit_id_cs_set_add','cs_res_id_cs_set_add','delta_result'].map(x=>this.call('getLogParamType',x))};}
  changedEvents(ctx,cs,delta){for(const type of ['CONDITION_CHAR_CS_TERM_VALUE_CHANGED','CONDITION_OWN_CHAR_CS_TERM_VALUE_CHANGED'])this.event(type,[ctx.target,cs.show_cs_res_id??ctx.res,ctx.charId],delta);}
  cardCSEvents(cs,types){for(const type of types)this.call('procCardEvent',type,this.P.CARD_PLACE_NONE,cs.owner_id,{cs_res_id:cs.show_cs_res_id??cs.res_id});}
  stateEvents(ctx,cs,group,shown=cs.show_cs_res_id??ctx.res){
    const display=group??(cs.term_value+(ctx.row.overlay_rule==='OVERLAY_CS_EACH'?0:this.sameDisplaySum(cs,ctx.list)));
    const owner=this.e.getUnit(cs.owner_id),id=owner?.id??this.b.char.id;
    if(!ctx.skill?.eff_opts?.includes('ignore_cs_amount_event'))for(const type of ['CONDITION_CHAR_CS_AMOUNT','CONDITION_OWN_CHAR_CS_AMOUNT'])this.event(type,[id,shown,display]);
    for(const type of ['CONDITION_CHAR_CS_BUFF_TYPE_COUNT','CONDITION_OWN_CHAR_CS_BUFF_TYPE_COUNT','CONDITION_CHAR_CS_BUFF_TYPE_SET'])this.event(type,[id]);
    for(const type of ['CONDITION_CHAR_CS_TERM_VALUE_SET','CONDITION_OWN_CHAR_CS_TERM_VALUE_SET'])this.event(type,[id,shown,display]);
  }
  creationOptions(ctx){const {args,skill}=ctx;return {
    fromEgo:args.fromEgo??skill?.from_ego,fromPotential:args.fromPotential??skill?.from_potential,
    fromCollapse:args.fromCollapse??skill?.from_collapse,fromRelic:args.fromRelic??skill?.from_relic,
    isAuto:args.isAuto,fromDebuff:args.fromDebuff,ignoreMinMax:args.ignoreMinMax,noti:args.noti??true,origin:args.origin};}
  makeCS(ctx,value){return this.call('createContinueSkill',ctx.owner,ctx.list,ctx.skillId,ctx.res,value,ctx.target,ctx.caster,ctx.isCard,ctx.charId,this.creationOptions(ctx));}
  addCSChildPassives(ctx,cs){for(const id of cs.skillEffs){const s=this.b.skillMap[id];if(this.db.get('skill_eff',s.res_id).operation==='OPERATION_PASSIVE')this.call('addPassiveSkill',s.skill_id,ctx.owner?.id??this.b.char.id,ctx.isCard,ctx.skillId);}}
  removeCS(ctx,id,owner=ctx.target){return this.call('removeContinueSkill',id,owner,ctx.isCard,{event:true,skip_amount_event:ctx.skill?.eff_opts?.includes('ignore_cs_amount_event')});}
  parentCard(ctx,cs,append=false){if(!ctx.parentCard)return;const card=this.call('getParentCard',ctx.skillId);if(card){if(append)cs.parent_cards?.push(card.id);else cs.parent_cards=[card.id];}}

  // 0x18d00 0..4120: common modifiers and owner/instance selection, exactly once.
  procAddCS(target,res,value,caster,isCard,sign,forcedSet,ignoreBlock,charId,skillId,args={}){
    args??={};res=this.stage.break_cs_changes?.[res]??res;
    const skill=this.b.skillMap[skillId],skillRow=skill?this.db.get('skill_eff',skill.res_id):undefined;
    const immediate=this.isImmediatePassiveCSSkill(skill),triggerLog=skill?.triggerLog!=null;
    if(!this.w.isPreview&&sign==='MATHSIGN_NONE'&&skillRow?.eff.startsWith('SKILL_EFF_CS_SET_ADD'))throw new MissingBattleRule('invalid_math_sign_with_eff',{res});
    if(!ignoreBlock&&!isCard&&target>0&&!this.e.getMonster(target))for(const p of this.query({source_id:target,type:'SKILL_EFF_UNIQUE_RITA_1',is_card:false,char_id:charId}))if(p.link_cs_ids?.includes(res))return -1;
    const row=this.db.get('cs',res);
    if(row.own_type==null)throw new MissingBattleRule('procAddCS.own_type',{res});
    const parentCard=this.db.array(row.link_skill_eff_id).some(id=>this.db.array(this.db.get('skill_eff',id).eff_opt).includes('parent_card'));
    let log;
    if(!isCard&&['SHOW_TYPE_ICON','SHOW_TYPE_ICON_OUTLINE'].includes(row.show_type)){
      if(!skill||!['SKILL_EFF_TRANSITION_SELECTED_CS_TO','SKILL_EFF_TRANSITION_CS_TO'].includes(skillRow.eff_type))log=this.csLog(target,row.show_link_cs_id==='none'?res:row.show_link_cs_id,value,value);
      if(this.call('checkActiveRelicCS',skill?skill.from_relic:args.fromRelic))log=undefined;
    }
    if(!isCard&&row.cs_buff_type!=='CS_BUFF_DEBUFF'){
      let plus=0,multi=1;
      const adjust=(p,take,turn=false)=>{
        const pr=this.db.get('skill_eff',p.res_id);
        if(!turn&&(!!p.eff_opts?.includes('take')!==take||!p.link_cs_ids?.includes(res)))return;
        if(turn&&p.skill_id in this.b.egoActionMap){const ego=this.b.egoActionMap[p.skill_id];this.e.pushAction({id:this.b.last_action_id++,type:'action_ego_active',source_id:ego.char_id,ego_skill_res_id:ego.ego_skill_res_id});if(this.w.isPreview)this.w.triggeredList.ego.push([ego.ego_skill_res_id,ego.char_id]);}
        const n=this.call('calcValue',p.skill_id,target);
        if(pr.eff_value_math_sign==='MATHSIGN_ADD')plus+=n;
        else if(pr.eff_value_math_sign==='MATHSIGN_SUBTRACT')plus-=n;
        else if(pr.eff_value_math_sign==='MATHSIGN_MULTIPLY')multi*=n;
        else throw new MissingBattleRule('CS_VALUE_ADD.math_sign',{sign:pr.eff_value_math_sign});
        this.call('checkTermValuePassive',p.skill_id,caster,true);
      };
      this.query({source_id:caster,type:'SKILL_EFF_CS_VALUE_ADD',is_card:false,talent:undefined,skip_error:true}).forEach(p=>adjust(p,false));
      this.query({source_id:target,type:'SKILL_EFF_CS_VALUE_ADD',is_card:false,skip_error:true}).forEach(p=>adjust(p,true));
      if([row.term_type_1,row.term_type_2].includes('TERM_TURN_VALUE')&&!!this.e.getMonster(target)!==!!this.e.getMonster(caster))this.query({source_id:caster,type:'SKILL_EFF_TERM_VALUE_ADD_TERM_TURN_VALUE',is_card:false}).forEach(p=>adjust(p,false,true));
      value=Math.max(0,value+plus)*multi;
    }
    // fromRelic selects the unit lookup before the isCard branch in the source.
    const owner=args.fromRelic||!isCard?this.e.getUnit(target):this.b.cardMap[target];
    if(isCard&&!args.fromRelic){if(!owner)throw new MissingBattleRule('procAddCS.card_owner',{target});if(owner.card_place==this.P.CARD_PLACE_EXHAUST)return -1;this.e.pushChangeData('card',target);}
    let list=owner?(owner.continueSkill??=[]):[],scope;
    if(owner&&!isCard&&!this.e.getMonster(target)&&['OWN_CHAR','OWN_CHAR_EFF_TEAM'].includes(row.own_type)){
      charId=norm(charId);if(!PLAYER_SLOTS.includes(charId))charId=norm(target);
      if(!PLAYER_SLOTS.includes(charId))throw new MissingBattleRule('invalid_char_id',{charId,target,res});
      this.b.char.continueSkillChar??={};list=this.b.char.continueSkillChar[charId]??=[];scope=charId;
    }else if(owner&&!isCard&&row.own_type==='OWN_CASTER'){
      caster=norm(caster);owner.continueSkillCaster??={};list=owner.continueSkillCaster[caster]??=[];
    }
    let id=-1;for(const key of list){const cs=this.b.csMap[key];if(!cs||cs.removed)throw new MissingBattleRule('procAddCS.stale_cs',{key,target,res});if(cs.res_id==res)id=key;}
    if(row.overlay_rule==='OVERLAY_CS_EACH'){
      // 3528..3747: show sum is explicitly reset to zero for EACH.
      if(row.overlay_value_max!=='MAX'){const max=Number(row.overlay_value_max);if(value>max)value=max;if(value<=0)return -1;}id=-1;
    }
    if(args.exist_id)id=args.exist_id;
    const tags=this.db.array(row.cs_overlay_tag??'[]');
    if(tags.length){id=list.find(key=>{const cs=this.b.csMap[key];return cs&&!cs.removed&&tags.some(tag=>cs.overlay_tags?.includes(tag));})??-1;
      if(id>=0){const cs=this.b.csMap[id];if(!cs||cs.removed)return -1;if(this.db.get('cs',cs.res_id).overlay_rule!==row.overlay_rule)throw new MissingBattleRule('procAddCS.overlay_tag_rule',{res,existing:cs.res_id});}}
    const ctx={target,res,row,caster,isCard,sign,forcedSet,ignoreBlock,charId,skillId,args,owner,list,scope,skill,skillRow,parentCard,log,immediate,triggerLog};
    if(!owner||id<0||args.forceIndependent)return this.newCS(ctx,value);
    if(forcedSet)return this.forcedCS(ctx,id,value);
    const cs=this.b.csMap[id];if(!cs)return -1;
    let overlay=args.exist_id?'OVERLAY_ADD_TERM_VALUE':this.db.get('cs',cs.res_id).overlay_rule;
    if(cs.res_id!==res&&overlay==='OVERLAY_ADD_TERM_VALUE_UNIQUE')overlay='OVERLAY_UNIQUE';
    if(cs.res_id!==res&&overlay==='OVERLAY_ADD_TERM_VALUE_RENEWAL')overlay='OVERLAY_RENEWAL';
    if(ADD.has(overlay))return this.addCS(ctx,cs,value);
    if(['OVERLAY_UNIQUE','OVERLAY_GLOBAL_UNIQUE'].includes(overlay)){
      if(sign!=='MATHSIGN_NONE')value=this.procMathSign(sign,0,value);
      const stop=this.blockedResult(ctx,this.badCS(row,value),value);return stop??cs.cs_id;
    }
    if(overlay==='OVERLAY_RENEWAL'){
      if(sign!=='MATHSIGN_NONE'){value=this.procMathSign(sign,0,value);value=this.procMathSign(sign,0,value);}
      const stop=this.blockedResult(ctx,this.badCS(row,value),value);if(stop!==undefined)return stop;
      this.removeCS(ctx,id);if(value===0){if(log&&cs.term_value!==0)this.detail(ctx,this.csLog(target,this.db.get('cs',cs.res_id).show_link_cs_id==='none'?cs.res_id:this.db.get('cs',cs.res_id).show_link_cs_id,-cs.term_value,0));return -1;}
      return this.replaceCS(ctx,cs,value,false);
    }
    if(overlay==='OVERLAY_HIGHER'){
      if(sign!=='MATHSIGN_NONE')value=this.procMathSign(sign,0,value);
      const stop=this.blockedResult(ctx,row.cs_buff_type==='CS_BUFF_DEBUFF',value);if(stop!==undefined)return stop;
      const fresh=this.b.csMap[id];if(!fresh||fresh.removed)return -1;if(!(fresh.term_value<value))return cs.cs_id;
      const old=fresh.term_value;this.removeCS(ctx,id);return this.replaceCS(ctx,cs,value,true,old);
    }
    throw new MissingBattleRule('invalid_overlay_rule',{overlay,res});
  }
  addCS(ctx,cs,value){
    if(!ctx.sign)throw new MissingBattleRule('math_sign_missing');
    const old=cs.term_value,desired=this.procMathSign(ctx.sign,old,value);if(old===desired)return cs.cs_id;
    const stop=this.blockedResult(ctx,this.badCS(ctx.row,desired-old),desired-old);if(stop!==undefined)return stop;
    const oldGroup=ctx.log&&!ctx.isCard?this.getBattleBalanceCSGroupTermValue(cs.owner_id,ctx.list,cs.res_id):undefined;
    if(this.call('addTermValue',cs.cs_id,value,ctx.sign,ctx.caster,ctx.isCard,ctx.skillId,ctx.args.ignoreMinMax,false))this.removeCS(ctx,cs.cs_id);
    const now=cs.term_value,newGroup=ctx.log&&!ctx.isCard?this.getBattleBalanceCSGroupTermValue(cs.owner_id,ctx.list,cs.res_id):undefined;
    this.csGiveEvents(ctx,cs,now-old);
    if(ctx.isCard)this.cardCSEvents(cs,['CONDITION_CARD_TAKE_CS']);
    if(ctx.log){let before=old,after=now,wanted=desired;if(oldGroup!=null&&newGroup!=null){before=oldGroup;after=newGroup;wanted=after;}let reported=after;if(wanted>before&&after<wanted){reported=wanted;if(cs.max!=null&&reported>cs.max)reported=cs.max;}ctx.log.params[2][0]=reported-before;ctx.log.params[2][1]=reported;if(reported!==before)this.detail(ctx,ctx.log);}
    if(old!==now)this.parentCard(ctx,cs,true);return cs.cs_id;
  }
  // 4143..7526. Forced nonzero writes bypass bounds and block passives.
  forcedCS(ctx,id,value){
    if(ctx.log){ctx.log.params[2][0]=value;ctx.log.params[2][1]=value;this.detail(ctx,ctx.log);}
    if(value===0){this.removeCS(ctx,id);return -1;}
    const cs=this.b.csMap[id];if(!cs)return -1;if(value===cs.term_value)return cs.cs_id;
    const old=cs.term_value,oldGroup=ctx.isCard?undefined:this.getBattleBalanceCSGroupTermValue(cs.owner_id,ctx.list,cs.res_id);
    cs.term_value=value;this.e.pushChangeData('cs',cs.cs_id);
    const group=ctx.isCard?undefined:this.refreshBattleBalanceCSGroup(cs.owner_id,ctx.list,cs.res_id);value=cs.term_value;
    if(ctx.log){ctx.log.params[2][0]=(group??value)-(oldGroup??old);ctx.log.params[2][1]=group??value;}
    if(group==null)for(const id of cs.skillEffs){const s=this.b.skillMap[id];if(!s)continue;this.setSkillTermValue(s,cs.term_value);this.e.pushChangeData('skill',s.skill_id);this.call('checkPassiveSkill',s.skill_id,cs.owner_id,ctx.isCard);}
    if(ctx.isCard)this.cardCSEvents(cs,['CONDITION_CARD_TAKE_CS','CONDITION_CARD_CS_TERM_VALUE_SET','CONDITION_CARD_CS_AMOUNT']);
    else {this.stateEvents(ctx,cs,group,cs.show_cs_res_id??cs.res_id);this.csGiveEvents(ctx,cs,value-old);this.changedEvents(ctx,cs,value-old);}
    this.call('refreshAlwaysDamage',cs.owner_id,cs.res_id);return cs.cs_id;
  }
  // 10853..14636 / 15209..18761: same side effects, distinct delta/log rules.
  replaceCS(ctx,oldCS,value,higher,oldValue=oldCS.term_value){
    const cs=this.makeCS(ctx,value);this.addCSChildPassives(ctx,cs);
    this.csGiveEvents(ctx,cs,value-oldValue);
    if(ctx.isCard)this.cardCSEvents(cs,['CONDITION_CARD_TAKE_CS','CONDITION_CARD_CS_TERM_VALUE_SET','CONDITION_CARD_CS_AMOUNT']);else this.stateEvents(ctx,cs);
    if(value!==oldValue)this.changedEvents(ctx,cs,value-oldValue);
    if(ctx.log){
      let delta=value-oldValue;
      if(!higher){const previous=oldCS.show_cs_res_id??oldCS.res_id,incoming=ctx.row.show_cs_res_id??ctx.res,same=previous===incoming;
        if(!same){const row=this.db.get('cs',oldCS.res_id);this.detail(ctx,this.csLog(ctx.target,row.show_link_cs_id==='none'?oldCS.res_id:row.show_link_cs_id,-oldValue,0));delta=value;}}
      ctx.log.params[2][0]=delta;ctx.log.params[2][1]=value;if(delta!==0)this.detail(ctx,ctx.log);
    }
    return cs.cs_id;
  }
  // 18819..23925: new instance; notifications precede global uniqueness cleanup.
  newCS(ctx,value){
    if(ctx.sign!=='MATHSIGN_NONE')value=this.procMathSign(ctx.sign,0,value);
    const stop=this.blockedResult(ctx,this.badCS(ctx.row,value),value);if(stop!==undefined)return stop;
    if(!(value>0||value<0&&ctx.row.cs_buff_type==='CS_BUFF_DEBUFF'))return -1;
    const oldGroup=ctx.log&&!ctx.isCard?this.getBattleBalanceCSGroupTermValue(ctx.target,ctx.list,ctx.res):undefined;
    const cs=this.makeCS(ctx,value),captured=cs.term_value,group=ctx.isCard?undefined:this.getBattleBalanceCSGroupTermValue(cs.owner_id,ctx.list,cs.res_id);
    this.addCSChildPassives(ctx,cs);this.csGiveEvents(ctx,cs,value);
    if(ctx.isCard)this.cardCSEvents(cs,['CONDITION_CARD_TAKE_CS','CONDITION_CARD_CS_TERM_VALUE_SET','CONDITION_CARD_CS_AMOUNT']);else this.stateEvents(ctx,cs,group);
    this.changedEvents(ctx,cs,value);
    if(['OVERLAY_GLOBAL_UNIQUE','OVERLAY_ADD_TERM_VALUE_GLOBAL_UNIQUE'].includes(ctx.row.overlay_rule))for(const key in this.b.csMap){const old=this.b.csMap[key];if(!old||old.res_id!==ctx.res||old.removed||old.cs_id===cs.cs_id)continue;const row=this.db.get('cs',old.res_id);let removalLog;if(!ctx.isCard&&['SHOW_TYPE_ICON','SHOW_TYPE_ICON_OUTLINE'].includes(row.show_type))removalLog=this.csLog(old.owner_id,row.show_link_cs_id==='none'?old.res_id:row.show_link_cs_id,-old.term_value,0);this.removeCS(ctx,old.cs_id,old.owner_id);this.detail(ctx,removalLog);}
    if(ctx.log){const before=oldGroup!=null&&group!=null?oldGroup:0,after=oldGroup!=null&&group!=null?group:captured;ctx.log.params[2][0]=after-before;ctx.log.params[2][1]=after;if(after!==before)this.detail(ctx,ctx.log);}
    this.parentCard(ctx,cs);return cs.cs_id;
  }

  // 0x3bb00: construction is shared by card and unit CS, with no early return
  // after a random pool or an invoked-value display.
  createContinueSkill(owner,list,skillId,res,value,target,caster,isCard,charId,options={}){
    options??={};const cs={};if(options.isAuto)cs.byAuto=true;cs.skill_added=skillId;
    for(const [field,key] of [['from_ego','fromEgo'],['from_potential','fromPotential'],['from_collapse','fromCollapse'],['from_relic','fromRelic']])cs[field]=options[key];
    cs.cs_id=this.b.cs_id++;this.b.csMap[cs.cs_id]=cs;this.e.pushChangeData('cs',cs.cs_id);if(isCard)cs.isCard=true;
    cs.res_id=res;cs.owner_id=!isCard&&PLAYER_SLOTS.includes(target)?this.b.char.id:target;cs.action_target_id=target;cs.caster_id=caster;cs.char_id=charId;
    if(this.b.cardMap[this.b.current_card]?.by_monster)cs.by_monster=true;
    cs.from_debuff=options.fromDebuff;cs.origin=this.call('determineOrigin',skillId,options);
    const row=this.db.get('cs',res);
    if([row.term_type_1,row.term_type_2].includes('TERM_CASTER_DEAD_WHOLE'))this.call('registerCasterDeadTermCS',caster,cs.cs_id);
    if(row.show_link_cs_id!=='none')cs.show_cs_res_id=row.show_link_cs_id;
    if(row.ignore_during_monster_turn==='YES'){(this.b.ignored_cs_monster_turn??=[]).push(cs.cs_id);if(this.call('isDuringTurnOver'))this.call('setIgnoreCS',cs.cs_id,true);}
    let others=0;
    if(!isCard){const unit=this.e.getUnit(cs.owner_id);if(!this.e.getMonster(cs.owner_id)&&['OWN_CHAR','OWN_CHAR_EFF_TEAM'].includes(row.own_type))cs.action_target_id=PLAYER_SLOTS.includes(charId)?charId:unit.id;others=row.overlay_rule==='OVERLAY_CS_EACH'?0:this.sameDisplaySum(cs,list);}
    const hasGroup=!isCard&&(this.call('getBattleBalanceCSGroupMembers',list,res)?.length??0)>0;
    const oldGroup=isCard?undefined:this.getBattleBalanceCSGroupTermValue(cs.owner_id,list,res);cs.term_value=value;
    const bound=(field,key,type,compare)=>{
      if(['MAX','-MAX'].includes(row[key]))return;
      if(!Number.isFinite(Number(row[key])))throw new MissingBattleRule('invalid_cs_bound',{res,field,value:row[key]});
      cs[field]=Number(row[key]);
      for(const p of this.query({source_id:this.b.char.id,type,is_card:false,char_id:cs.char_id})){const pr=this.db.get('skill_eff',p.res_id);if(p.link_cs_ids?.includes(cs.show_cs_res_id??res))cs[field]=this.procMathSign(pr.eff_value_math_sign,cs[field],this.call('calcValue',p.skill_id));}
      if(!options.ignoreMinMax&&compare(cs.term_value+others,cs[field]))cs.term_value=cs[field]-others;
    };
    bound('max','overlay_value_max','SKILL_EFF_OVERLAY_VALUE_MAX_ADD',(a,b)=>a>b);
    for(const p of this.query({source_id:this.b.char.id,type:'SKILL_EFF_BAN_OVERLAY_DEBUFF',is_card:false,char_id:cs.char_id}))if(p.link_cs_ids?.includes(cs.show_cs_res_id??res)){const max=this.call('calcValue',p.skill_id);if(!options.ignoreMinMax&&cs.term_value+others>max)cs.term_value=max-others;}
    bound('min','overlay_value_min','SKILL_EFF_OVERLAY_VALUE_MIN_ADD',(a,b)=>a<b);
    const categories=this.db.array(row.invoke_value_category),rules=this.db.array(row.operation_rule),links=this.db.array(row.link_skill_eff_id),tags=this.db.array(row.cs_overlay_tag??'[]');
    if(tags.length)cs.overlay_tags=tags;if(row.ui_expose_icon_type==='EXPOSE_ICON_PASSIVE')cs.is_passive=true;if(row.ui_expose_icon_type==='EXPOSE_ICON_BUFF_UNIQUE')cs.is_unique=true;
    cs.priority=Number(row.ui_expose_priority);cs.skillEffs=[];
    if((links.length!==categories.length||links.length!==rules.length)&&res!=='cs_collapse_000')throw new MissingBattleRule('invalid_cs_skill_arrays',{res});
    const order=this.db.array(row.eff_pick_pool_order).map(Number),weights=this.db.array(row.eff_pick_pool_ratio).map(Number);
    if(order.length){if(order.length!==weights.length)throw new MissingBattleRule('createContinueSkill.pick_pool_length',{res});const selected=relativeProbabilityIndex(weights,(a,b)=>this.e.random.randRange(0,a,b));if(isNaN(selected))throw new MissingBattleRule('createContinueSkill.pick_pool_weights',{res});const length=order.length;order.splice(selected,1);for(let i=length-2;i>=0;i--){links.splice(order[i],1);categories.splice(order[i],1);}}
    // Native 3813..3885 does NOT splice rules. Preserve that index behavior.
    for(let i=0;i<links.length;i++){
      if(categories[i]==null||rules[i]==null)throw new MissingBattleRule('createContinueSkill.skill_arrays',{res,index:i});
      const s=this.call('createSkill',links[i],isCard?caster:charId,{type:'CS',id:cs.cs_id},categories[i],rules[i],cs.term_value,charId);cs.skillEffs.push(s.skill_id);
      if(cs.from_ego&&this.db.get('skill_eff',s.res_id).trigger_noti_type==='YES')this.b.egoActionMap[s.skill_id]={char_id:cs.char_id,ego_skill_res_id:cs.from_ego};
      if(cs.from_collapse&&this.db.get('skill_eff',s.res_id).trigger_noti_type==='YES')this.b.collapseActionMap[s.skill_id]={char_id:cs.char_id,collapse_passive_res_id:cs.from_collapse};
    }
    const group=isCard?undefined:this.refreshBattleBalanceCSGroup(cs.owner_id,list,res,cs),delta=group==null?undefined:group-(oldGroup??0);
    if(cs.from_relic)for(const key in this.b.relicMap)if(this.b.relicMap[key].res_id===cs.from_relic){this.call('registRelicCS',this.b.relicMap[key].id,cs.cs_id);break;}
    const skill=this.b.skillMap[skillId];
    if(!['SHOW_TYPE_NONE','SHOW_TYPE_OUTLINE'].includes(row.show_type)){
      let displayed=group??cs.term_value+others;
      if(!VALUE_UI.has(row.ui_expose_value_type)){if(row.ui_expose_value_type!=='EXPOSE_VALUE_INVOKE_EFF_VALUE')throw new MissingBattleRule('invalid_ui_expose_value_type',{res,value:row.ui_expose_value_type});displayed=this.call('calcValue',cs.skillEffs[0]);}
      const action={id:cs.cs_id,...(isCard?{card_id:cs.owner_id}:{char_id:charId,caster_id:caster,target_id:cs.action_target_id}),cs_res_id:cs.show_cs_res_id??res,value:displayed,from_ego:cs.from_ego,from_relic:cs.from_relic,from_collapse:cs.from_collapse};
      if(!isCard)action.from_card=skill?.parent.type==='CARD';
      if(VALUE_UI.has(row.ui_expose_value_type)){if(group!=null)action.delta=delta;else if(others!==0)action.delta=cs.term_value;}
      if(group==null||delta!==0)this.e.pushAction({id:this.b.last_action_id++,type:(group!=null?hasGroup:others!==0)?'action_cs_value_change':'action_cs_new',source_id:caster,action_cs:action,skip_action:!(options.noti??true)});
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
    const index=list.findIndex(id=>{const old=this.b.csMap[id];if(!old)return false;if(owner&&cs.is_passive)return !old.is_passive||old.priority<cs.priority;if(owner&&cs.is_unique)return !old.is_passive&&(!old.is_unique||old.priority<cs.priority);return !old.is_passive&&!old.is_unique&&old.priority<cs.priority;});if(index<0)list.push(cs.cs_id);else list.splice(index,0,cs.cs_id);
    if(isCard){const card=this.b.cardMap[cs.owner_id];if(row.show_type==='SHOW_TYPE_OUTLINE')(card.ccsOutline??=[]).push(cs.cs_id);
      else if((caster===cs.owner_id||skill?.parent.type==='CARD'&&skill?.parent.id===cs.owner_id)&&!options.isAuto&&this.db.get('card',card.res_id).ui_conditional_outline==='YES'&&!this.call('isFromRSpark',skillId))(card.ccsOutline??=[]).push(cs.cs_id);
      if(this.b.amount_check_ccs?.[res]!=null)this.call('procCardAmountEvent',this.b.amount_check_ccs[res]);}
    cs.init_tv=cs.term_value;this.call('refreshAlwaysDamage',cs.owner_id,cs.res_id);
    if(res==='cs02_0619'&&!isCard&&this.e.getMonster(target)){const unit=this.e.getUnit(target);if(!['death','run','changed'].includes(unit.state)){unit.state='keep_half_death';this.e.pushAction({id:this.b.last_action_id++,type:'action_monster_half_death',source_id:target});for(const type of ['CONDITION_MONSTER_AMOUNT','CONDITION_MONSTER_AMOUNT_SET','CONDITION_CHAR_CS_AMOUNT','CONDITION_OWN_CHAR_CS_AMOUNT'])this.event(type,[]);}}
    return cs;
  }
  // WT 0x8fd00 / ContinueSkillProc 0x5e400 / BattleProc 0x1af00.
  // 0x59400 was checked as a whole against the retained linear view: owner
  // removal, passive teardown, balance refresh, card outlines/debuffs, child
  // removal, deferred deletion, events, amount checks and half-death revival.
  // All collaborators in the shared hand port use the public dispatcher.
  removeContinueSkill(...args){return super.removeContinueSkill(...args);}
  isDuringTurnOver(){const L=this.e.enums.LogicState;return [L.TIMING_TURN_OVER_DISCARD_BEFORE,L.TIMING_TURN_OVER_DISCARD_AFTER,L.Discard,L.TIMING_TURN_OVER_FINISH].includes(this.b.current_state);}
  setIgnoreCS(id,value){const cs=this.b.csMap[id];if(cs)cs.ignored=value;}
  registRelicCS(relicId,id){const cs=this.b.csMap[id];if(!cs)return;if(this.db.get('cs',cs.res_id).relic_effect_type==='EFFECT_TYPE_NONE'||!(id>0))return;for(const skillId of cs.skillEffs){const s=this.b.skillMap[skillId];if(this.db.get('skill_eff',s.res_id).trigger_noti_type==='YES')this.b.relicActionMap[skillId]=relicId;}}
  // SkillEffectProc 0x1a6000 follows CS.skill_added and SKILL.parent.id;
  // the final membership test uses the card-level ancestor's skill_id.
  isFromRSpark(id){let s=this.b.skillMap[id];if(!s)return false;let count=0;while(s.parent.type!=='CARD'){if(s.parent.type==='CS'){const cs=this.b.csMap[s.parent.id];if(!cs)return false;s=this.b.skillMap[cs.skill_added];}else if(s.parent.type==='SKILL')s=this.b.skillMap[s.parent.id];else return false;if(!s)return false;if(++count>100)throw new MissingBattleRule('isFromRSpark.loop_limit',{id});}return this.b.cardMap[s.parent.id]?.r_spark_skill_eff_ids?.includes(s.skill_id);}
}
