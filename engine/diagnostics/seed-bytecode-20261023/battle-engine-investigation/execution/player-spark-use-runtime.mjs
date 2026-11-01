// Hand port of StageWT getCard0x34000/getCharByCharId0x56b00,
// applyRSpark0x1fa00/afterApplyYSpark0x21200/pushSparkLogs0x1bc00.
// Explicit StageWT arguments preserve the caller's actual object graph.
export class PlayerSparkUseRuntime {
 constructor(e){this.e=e;}
 getCard(w,id){return w.battle_stage.all.find(c=>c.id==id);}
 getChar(w,id){if(id==7){const c=w.battle_stage.assault_fourth_char;if(c==null)throw this.e.call('contentError','err:assault_fourth_char_not_found:char_id='+id);return c;}return w.battle_stage.chars[id-1];}
 applyRSpark(w,id,spark){const c=this.getCard(w,id);if(c){c.r_spark=spark;c.r_spark_candis=undefined;this.e.call('missionDispatch','CARD_DESTINY',{count:1});this.e.call('missionDispatch','SPARK',{count:1});}}
 afterApplyYSpark(w,id,isPreview){const c=this.getCard(w,id);if(!c)return;if(!isPreview)this.e.call('missionDispatch','SPARK',{count:1});
  const at=w.battle_stage.spark.spark_cards[c.char_id]?.findIndex(x=>x[0]==c.res_id);if(at>=0)w.battle_stage.spark.spark_cards[c.char_id][at][2]=false;
  const owner=w.battle_stage.chars.find(x=>x.id==c.char_id);if(owner){++owner.spark_count;++owner.total_spark_count;}}
 pushLogs(w,log){w.battle_stage.spark.spark_logs.push(log);}
}
