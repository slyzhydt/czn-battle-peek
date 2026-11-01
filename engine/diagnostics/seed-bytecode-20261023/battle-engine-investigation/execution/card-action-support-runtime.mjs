// Hand ports: BattleWorktable.redirectLatestCardUseActions 0x141800,
// SkillEffectProc.procCSAddSetAuto 0x19e100. Static evidence in
// evidence/card-action-redirect; no recovered JavaScript is executed.
import {MissingBattleRule} from './resource-store.mjs';
export class CardActionSupportRuntime {
  constructor(e){this.e=e;this.b=e.b;this.w=e.wt;this.db=e.db;}
  call(n,...a){return this.e.call(n,...a);}
  redirectLatestCardUseActions(cardId,to,onRedirect){
    const matches=[];let latest=-1;
    // Preserve the native two-pass walk and payload references. The cutoff is
    // the greatest starting action ID, not the last array item encountered.
    this.b.action_blocks.forEach(block=>block.actions.forEach(action=>{
      if(action.type!=='action_card_use'&&action.type!=='action_card_use_power')return;
      if(!action.action_card?.cards.includes(cardId))return;
      matches.push({id:action.id,action_card:action.action_card});
      if(action.action_card.place_from!==7&&action.id>latest)latest=action.id;
    }));
    matches.forEach(({id,action_card})=>{if(id<latest)return;action_card.place_to=to;if(onRedirect)onRedirect(action_card);});
  }
  procCSAddSetAuto(skillId,forceSet){
    const s=this.b.skillMap[skillId];if(!s)throw new MissingBattleRule('procCSAddSetAuto.skill',{skillId});
    const r=this.db.get('skill_eff',s.res_id);if(r.eff!=='SKILL_EFF_CS_SET_ADD_AUTO')throw new MissingBattleRule('procCSAddSetAuto.invalid_skill_eff',{skillId,res_id:s.res_id,eff:r.eff});
    const isCard=r.target_unit_type==='TARGET_UNIT_NONE',targets=isCard?this.call('getTargetCards',skillId,false,false).target_cards_id:this.call('getSkillEffTarget',skillId);
    targets.forEach(target=>{
      const value=this.call('calcValue',skillId,target);
      if(this.w.isPreview&&s.link_cs_ids?.length!==1)return;
      // Even a single CS candidate consumes the native random selection call.
      const cs=this.e.random.randomArrayMember(0,s.link_cs_ids??[]);
      this.call('procAddCS',target,cs,value,s.parent.id,isCard,r.eff_value_math_sign,forceSet,false,s.action_char_id,s.skill_id,{isAuto:true});
    });
  }
}
