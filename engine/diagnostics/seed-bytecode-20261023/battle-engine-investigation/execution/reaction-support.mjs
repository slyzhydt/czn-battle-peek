// Small exact helpers and explicit continuation boundaries for reaction-loop.
export class ReactionSupport {
  constructor(e){this.e=e;this.wt=e.wt;this.b=e.b;}
  continueSkills(unit){
    const out=unit.continueSkill.slice();
    if(unit.continueSkillChar)for(const key in unit.continueSkillChar)out.push(...unit.continueSkillChar[key]);
    if(unit.continueSkillCaster)for(const key in unit.continueSkillCaster)out.push(...unit.continueSkillCaster[key]);
    return out;
  }
  checkUniqueChizuru(){
    const id=this.continueSkills(this.b.char).find(id=>this.b.csMap[id]?.res_id=='cs01_0730');
    if(!id)return;
    // Required stress, term consumption and card creation path is not elided.
    return this.e.call('checkUniqueChizuru.active',id);
  }
  setSubFinished(value=true){
    if(value==null)value=true;
    if(this.wt.isPreview)return;
    const subs=this.b.battle_logs.at(-1)?.sub;if(!subs)return;
    let index=subs.length-1,sub=subs[index];
    while(sub?.major_first){sub=subs[--index];if(sub==null)break;}
    if(sub)sub.is_fin=value;
  }
  finishPyeonrinSub(group){if(group.sub)group.sub.is_fin=true;group.sub=undefined;group.group=undefined;}
  openPyeonrinSub(group,entry){
    if(entry.pyeonrin_trigger_group_id==group.group){if(group.sub)group.sub.is_fin=undefined;return;}
    this.finishPyeonrinSub(group);if(entry.pyeonrin_trigger_group_id==null)return;
    return this.e.call('openPyeonrinSub.group',group,entry);
  }
  releaseLightDarkCombineWaiting(){
    if(!this.b.light_dark_combine_waiting||this.b.using_card||this.wt.checking_light_dark)return false;
    return this.e.call('releaseLightDarkCombineWaiting.active');
  }
  isSkippedAfterBattleEnd(entry){
    if(!this.b.game_end&&!this.b.battle_end)return false;
    if(entry.pyeonrin_trigger_group_id!=null||entry.pyeonrin_reaction_group_id!=null)return true;
    return this.e.call('isLightDarkReactionSkill',this.e.db.get('skill_eff',this.b.skillMap[entry.skill_id].res_id));
  }
}
