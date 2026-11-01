// Hand ports: StageWorktable.addBattleTempCards0x30900 and
// BattleCardProc.checkOverwrite0x78b00 / applyOverwrite0x69300.
// Preserved static instructions: evidence/card-temp-overwrite/.
import {MissingBattleRule} from './resource-store.mjs';
export class CardOverwriteRuntime {
  constructor(e){this.e=e;this.b=e.b;this.db=e.db;}
  call(n,...args){return this.e.call(n,...args);}
  addBattleTempCards(ids){
    const stage=this.e.state.worktables?.BattleStageWorktable?.battle_stage;
    if(!stage)throw new MissingBattleRule('BattleStageWorktable.battle_stage');
    // Filter runs before push; repeated new IDs in the same input survive.
    stage.battle_temp_cards?.push(...ids.filter(id=>!stage.battle_temp_cards.includes(id)));
  }
  checkOverwrite(id){
    const card=this.b.cardMap[id];
    const passives=this.call('getPassiveByType',{source_id:this.b.char.id,type:'SKILL_EFF_CARD_OVERWRITE',is_card:false,char_id:card.char_id});
    passives.forEach(p=>{
      const row=this.db.get('skill_eff',p.res_id);
      if(this.db.array(row.target_card_set_opt_multiple_link).includes(card.res_id))this.applyOverwrite(id,p.eff_opt_multiple_link[0]);
    });
    // Native callback ignores applyOverwrite's return and keeps the input ID.
    return id;
  }
  applyOverwrite(id,resId){
    const card=this.b.cardMap[id];if(!card||card.before_change_debuff_card)return id;
    const before=structuredClone(card),next=this.call('changeCards',[id],resId)[0];
    if(!next)return id;
    next.before_overwrite_card=before;this.call('afterChangeCard',before,next.id);return next.id;
  }
}
