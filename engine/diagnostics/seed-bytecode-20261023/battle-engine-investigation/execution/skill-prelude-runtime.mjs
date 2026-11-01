// procSkillEff common prelude, same native order. Source-only evidence:
// evidence/active-effects/common-prelude.linear.txt and callbacks194..223.
import {compareCondition} from '../conditions/condition-core.mjs';
import {MissingBattleRule} from './resource-store.mjs';
export const SKILL_PRELUDE_BINDINGS={procSkillEarlyChecks:'early',procSkillSpecialOptions:'specialOptions',checkCardDrawAllowed:'drawAllowed',procSkillLateRunChecks:'late',procSkillCardUnitOptions:'cardUnitOptions',procSkillUnitSystemEffect:'unitSystemEffect'};
export class SkillPreludeRuntime {
 constructor(e){this.e=e;this.b=e.b;this.w=e.wt;this.db=e.db;}
 call(n,...a){return this.e.call(n,...a);}
 log(s,prefix){this.call('pushLog',prefix+s.res_id);return false;}
 // Native tuning/testament/throw/removed checks traverse at most one SKILL
 // ancestor. They do not use the recursive getParentCard helper.
 directCard(s){if(s.parent.type==='CARD')return this.b.cardMap[s.parent.id];if(s.parent.type==='SKILL'){const p=this.b.skillMap[s.parent.id];if(p?.parent.type==='CARD')return this.b.cardMap[p.parent.id];}return undefined;}
 directCardID(s){if(s.parent.type==='CARD')return s.parent.id;if(s.parent.type==='SKILL'){const p=this.b.skillMap[s.parent.id];if(p?.parent.type==='CARD')return p.parent.id;}return -1;}
 early(id){const s=this.b.skillMap[id],r=this.db.get('skill_eff',s.res_id),checks=this.db.array(r.run_check_opt),has=x=>checks.includes(x);
  if(has('dummy')||has('preview_hide')&&this.w.isPreview)return false;
  if(has('not_stun')){const links=this.db.array(this.call('constantMetagame','not_stun',{skip_error:true})??'');
   if(links.length&&this.call('getContinueSkillsByCharID',s.action_char_id).some(cid=>{const cs=this.b.csMap[cid];return cs&&!cs.removed&&links.includes(cs.res_id);}))return this.log(s,'run_check_false:not_stun:');
  }
  if(has('hp0')&&this.call('getUnitByID',s.caster_id).status.info.S_CURRENT_HP<=0)return this.log(s,'run_check_false:');
  if(has('this_cs_tv_0')){const cs=this.b.csMap[s.parent.id];if(!cs)throw new MissingBattleRule('skillPrelude.parent_cs',{id,parent:s.parent});if(cs.term_value==0)return false;}
  if(has('not_collapse')){const c=this.call('tryGetStageCharByCharId',s.action_char_id);if(c&&this.call('isCollapseOnCharacter',c))return false;}
  if(has('check_collapse_cancel')){const c=this.call('tryGetStageCharByCharId',s.action_char_id);if(c&&this.call('isCollapseOnCharacter',c)){
   if(s.parent.type==='CS'){const cs=this.b.csMap[s.parent.id];if(cs)this.e.effects.procCSTermDecrement(s,cs);}
   return this.log(s,'run_check_collapse_cancel:');
  }}
  for(const [check,field]of [['tuning','tuned'],['testament','by_testament'],['card_throw','is_thrown']])if(has(check)&&this.directCardID(s)>=0&&!this.directCard(s)?.[field])return this.log(s,'run_check_false_'+check+':');
  if(!this.specialOptions(id))return false;
  if(has('removed')&&this.directCardID(s)>=0&&!this.directCard(s)?.is_removing)return this.log(s,'run_check_false_removed:');
  return true;
 }
 specialOptions(id){const s=this.b.skillMap[id],opts=s.eff_opts??[];
  if(opts.includes('skip_on_reuse')&&this.call('getParentCard',id)?.by_card_use_reuse)return false;
  const option=opts.find(x=>x.startsWith('turn_max_'));if(!option)return true;const limit=Number(option.slice('turn_max_'.length));if(isNaN(limit))return true;
  const card=this.call('getParentCard',id);if(!card)return true;card.turn_max_counts??={};let value=card.turn_max_counts[s.res_id];
  if(!value||value.turn!=this.b.turn)card.turn_max_counts[s.res_id]=value={turn:this.b.turn,count:0};
  if(value.count>=limit)return false;++value.count;return true;
 }
 drawAllowed(id){const bans=this.call('getPassiveByType',{source_id:this.b.char.id,type:'SKILL_EFF_CARD_DRAW_BAN',is_card:false});
  if(bans.length){this.e.pushAction({id:this.b.last_action_id++,type:'action_toast',source_id:bans[0].parent.type==='CS'?bans[0].parent.id:-1,msg:'battle_toast_card_draw_ban_deck'});return false;}
  const locks=this.call('getLockHandPassives',1);if(locks.length){this.call('procLockHandBlocked',locks);return false;}return true;
 }
 // procSkillEff @9313..13372. This gate belongs to TARGET_UNIT_NONE (a
 // card effect); it must not be replaced with normal unit-target filtering.
 cardUnitOptions(id,outline=false){const s=this.b.skillMap[id],r=this.db.get('skill_eff',s.res_id),opts=s.target_unit_type_opt?.slice()??[];
  if(!opts.length)return true;
  const attack=m=>!!m.nextCard&&this.db.get('card',m.nextCard).monster_noti_category.includes('ATK');
  if(opts.includes('n_atk')){
   if(this.b.select_target>0){const m=this.call('getUnitByID',this.b.select_target,'getSkillEffTarget:'+s.res_id);if(!m.nextCard||!(m.mon_turn==null||m.mon_turn>0)||!attack(m))return false;}
   else if(!this.b.monsters.some(attack))return false;
  }else if(opts.includes('not_n_atk')){
   if(this.b.select_target>0){const m=this.call('getUnitByID',this.b.select_target,'getSkillEffTarget:'+s.res_id);if(!m.nextCard||attack(m))return false;}
   else if(!this.b.monsters.some(m=>!!m.nextCard&&!attack(m)))return false;
  }else{
   const any=opts.includes('target_none');if(any)opts.splice(opts.indexOf('target_none'),1);
   if(!any&&this.b.select_target>0){const m=this.call('getUnitByID',this.b.select_target,'unit_opt_check');
    if(!this.cardOptionUnit(m,opts,r,true,s.res_id))return false;
   }else if(!any||!this.b.monsters.some(m=>!['death','run','changed'].includes(m.state)&&this.cardOptionUnit(m,opts,r)))return false;
  }
  if(outline&&r.target_unit_type_opt_outline==='YES')this.w.triggeredList.target_outline=true;return true;
 }
 turnOption(option,start,m){return compareCondition('INEQUALITY_'+option.slice(start,start+2).toUpperCase(),Math.max(0,m.mon_turn??Infinity),Number(option.slice(start+2)));}
 // Closures198..218: HP/shield reads deliberately use select_target even
 // in the target_none scan. Native source does not substitute the scanned ID.
 cardOptionUnit(m,opts,r,selected=false,resId){const grades=opts.filter(x=>x.startsWith('GRADE_'));
  if(grades.length){const row=this.db.table('monster')[m.res_id];if(row&&!grades.includes(row.grade))return false;}
  for(const opt of opts.filter(x=>x.startsWith('target_hp_'))){const pct=opt.slice(10,13)==='pct',at=pct?14:10,n=Number(opt.slice(pct?17:13));
   let value=this.call('getStatus',this.b.select_target,'S_CURRENT_HP');if(pct)value=value/this.call('getStatus',this.b.select_target,'S_HP')*100;
   if(!compareCondition('INEQUALITY_'+opt.slice(at,at+2).toUpperCase(),value,n))return false;
  }
  for(const opt of opts.filter(x=>x.startsWith('ego_field_pct_'))){const target=this.call('getUnitByID',this.b.select_target,'ego_field_pct');if(target.ego_field_max_value==null||!compareCondition('INEQUALITY_'+opt.slice(14,16).toUpperCase(),(target.ego_field_value??0)/target.ego_field_max_value*100,Number(opt.slice(17))))return false;}
  if(opts.includes('no_ego_field')&&this.call('hasEgoField',m))return false;
  if(selected){for(const option of opts.filter(x=>x.startsWith('turn_count_')))if(!this.turnOption(option,11,m))return false;
   for(const option of opts.filter(x=>x.startsWith('select_turn_count_'))){if(this.b.select_target===-1)return false;const target=this.call('getUnitByID',this.b.select_target,'getSkillEffTarget:'+resId);if(!target||!this.turnOption(option,18,target))return false;}}
  const links=this.db.array(r.target_unit_type_opt_link_cs_id).map(link=>this.e.state.worktables.BattleStageWorktable.battle_stage.break_cs_changes?.[link]??link);
  if(links.length){const matched=this.call('checkCSopts',links,m);if(opts.includes('not')?matched:!matched)return false;}
  if(opts.includes('shield')&&this.call('getStatus',this.b.select_target,'S_CURRENT_SHIELD')<=0)return false;
  for(const type of ['debuff','debuff_dot','buff'])if(opts.includes(type)&&!this.call('getContinueSkills',m).some(id=>{const cs=this.b.csMap[id];if(!cs)return false;const bt=this.db.get('cs',cs.res_id).cs_buff_type;
   return type==='debuff'?(this.call('baseDebuffType',bt)||bt==='CS_BUFF_DEBUFF'&&cs.term_value<0):type==='debuff_dot'?bt==='CS_DEBUFF_DOT':bt==='CS_BUFF'||bt==='CS_BUFF_DEBUFF'&&cs.term_value>0;
  }))return false;
  return true;
 }
 // Source @16237..17067, six damage categories handle their own system
 // effects. Party source is replaced by caster only for a real char caster.
 unitSystemEffect(id,targets){const s=this.b.skillMap[id],r=this.db.get('skill_eff',s.res_id);
  if(!r.link_battle_system_effect_id||r.link_battle_system_effect_id==='none'||['SKILL_EFF_DMG','SKILL_EFF_DMG_EXCEPT_NOTI','SKILL_EFF_EXTRA_DMG','SKILL_EFF_DMG_IGNORE_COND','SKILL_EFF_DMG_COOP','SKILL_EFF_NIHILUM_META_DMG'].includes(r.eff))return;
  const char=this.b.chars.some(c=>c?.id==s.caster_id);for(const target of targets)this.e.pushAction({id:this.b.last_action_id++,type:'action_system_effect',source_id:target==this.b.char.id&&char?s.caster_id:target,command:r.link_battle_system_effect_id});
 }
 // Source evaluates these after target/dead checks. A matching field monster
 // must satisfy all conditions; absent/negative turn uses Infinity/zero.
 late(id,outline){const s=this.b.skillMap[id],r=this.db.get('skill_eff',s.res_id),checks=this.db.array(r.run_check_opt).filter(x=>x.startsWith('turn_count_'));if(!checks.length)return true;
  const match=this.b.monsters.some(m=>this.call('isFieldMonster',m)&&checks.every(option=>compareCondition('INEQUALITY_'+option.slice(11,13).toUpperCase(),Math.max(0,m.mon_turn??Infinity),Number(option.slice(13)))));
  if(!match)return false;if(outline)this.w.triggeredList.run_check_outline=true;return true;
 }
}
