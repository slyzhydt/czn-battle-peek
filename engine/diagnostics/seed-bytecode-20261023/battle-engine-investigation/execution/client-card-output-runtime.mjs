// BattleInfoDataHelper in battle_worktable: makeCardInfo0x16000,
// createClientCardInfo0x17100, createClientCards0x17c00. Static evidence in
// evidence/client-card-output/. No cost/stat calculation occurs here.
import {MissingBattleRule} from './resource-store.mjs';
export class ClientCardOutputRuntime {
  constructor(e){this.e=e;}
  get stage(){const s=this.e.state.worktables?.BattleStageWorktable?.battle_stage;if(!s)throw new MissingBattleRule('BattleStageWorktable.battle_stage');return s;}
  makeCardInfo(id,resId,charId){
    const card={id,res_id:resId,char_id:charId??-1},spark=this.stage.break_r_spark_cards?.[resId];
    // defines.js0x3bb00 R_SPARK_CATEGORY values are strings.
    if(spark)card.r_spark={category:'CATEGORY_UNIQUE',res_id:spark,by_outgame:true};return card;
  }
  createClientCardInfo(card,deepClone){
    deepClone??=true;const out=deepClone?structuredClone(card):{...card};
    // Imported BattleCard helper0xc100 reads a flag, unlike WT's ID query.
    out.available=card.available!==false;return out;
  }
  createClientCards(cards,deepClone){deepClone??=true;return cards?.map(c=>this.createClientCardInfo(c,deepClone));}
}
