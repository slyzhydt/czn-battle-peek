// Source-bound StressProc first-collapse orchestration and sequence generation.
// Evidence: evidence/death-outcome/stress/onGainCollapseCard_0xf0000004a100.linear.js
// and evidence/collapse-card. This does not fabricate card mutation/create ports.
import {MissingBattleRule} from './resource-store.mjs';
export class CollapseCardRuntime {
  constructor(e){this.e=e;this.b=e.b;this.w=e.wt;this.db=e.db;}
  call(n,...a){return this.e.call(n,...a);}
  get stage(){const s=(this.w.battle_stage_worktable??this.e.state?.worktables?.BattleStageWorktable)?.battle_stage;if(!s)throw new MissingBattleRule('BattleStageWorktable.battle_stage');return s;}
  getCharByCharId(id){if(id==7){if(!this.b.assault_fourth_char)throw new MissingBattleRule('getCharByCharId.assault_fourth_char',{id});return this.b.assault_fourth_char;}return this.b.chars[id-1];}
  // BattleWorktable 0x119800: unknown/synthetic places default true, NONE false.
  isCardInDeclaredPlace(id,place){const d=this.b.deck_info,key={1:'deck',5:'deck',6:'deck',2:'hand',3:'discard',4:'exhaust',7:'using',11:'used'}[place];
    if(key)return d[key].includes(id);if(place===9||place===10)return Object.values(d.monster).some(list=>list.includes(id));if(place===0)return false;return true;}
  onGainCollapseCard(char,skipLog=false,provider){
    skipLog??=false;if(!this.call('isDuringBattle'))return;
    this.call('procUnitEvent','CONDITION_CHAR_COLLAPSE',[char.id]);
    const row=this.db.get('char_combatant',char.res_id),passiveId=row.link_collapse_passive_id,actions=[];let logAction;
    if(!skipLog){logAction=this.call('pushSubBattleLog',{logs:[],type:'collapse_gain',params:[char.res_id,passiveId]},undefined,false);this.call('setSubFinished');}
    this.db.get('collapse_passive',passiveId);
    this.w.tempActions=actions;
    const cards=this.b.deck_info.all.filter(id=>{const c=this.b.cardMap[id];if(!c||c.card_place===0||!this.isCardInDeclaredPlace(id,c.card_place))return false;
      if(c.char_id===char.id&&this.db.get('card',c.res_id).sort!=='SORT_COLLAPSE_SKILL'){c.available=false;this.call('pushChangeData','card',id);return true;}return false;});
    if(cards.length){const need=char.collapse_need_count??this.call('getCollapseNeedCount',char);this.changeToCollapseCard(cards,need,char.collapse_card_count??0);this.generateCollapseSequence(char,need,provider);}
    const hand=this.b.deck_info.hand.filter(id=>this.b.cardMap[id].char_id===char.id);
    this.call('moveCards',{card_ids:hand,from:2,to:3});
    // Native allocates the id before calling createClientCards.
    const id=this.b.last_action_id++;
    this.e.pushAction({id,type:'action_stage_card_refresh',action_stage_cards:this.call('createClientCards',this.stage.all),source_id:-1});
    this.w.tempActions=undefined;
    this.call('procAddCS',char.id,'cs_collapse_000',1,char.id,false,'MATHSIGN_SET',true,true,char.id,-1,{origin:'COLLAPSE'});
    if(logAction)actions.push(logAction);
    this.checkMinCollapseCards(char,actions);return actions;
  }
  // StressProc 0x54300: deep-copy original cards before invoking the shared
  // changeCards pipeline, then assign snapshots to returned cards in order.
  changeToCollapseCard(ids,need,count){
    const first=this.b.cardMap[ids[0]];if(!first)throw new MissingBattleRule('changeToCollapseCard.first_card');
    const char=this.getCharByCharId(first.char_id);if(!char)throw new MissingBattleRule('changeToCollapseCard.character');
    const combatant=this.db.get('char_combatant',char.res_id),p=this.db.get('collapse_passive',combatant.link_collapse_passive_id);
    const res=this.call('isDTMode')==false?p.collapse_link_card_id:p.collapse_2_link_card_id;
    const valid=ids.filter(id=>this.b.cardMap[id]!=null);if(valid.length===0)return;
    const before=valid.map(id=>structuredClone(this.b.cardMap[id]));
    const changed=this.call('changeCards',valid,res,{to_collapse:true,ignoreCardChangeDebuff:true});
    let index=0;for(const c of changed){c.collapse_count=count;c.collapse_need_count=need;c.beforeCollapseCard=before[index++];}
  }
  // StressProc 0x48000. Every nonterminal slot draws a range value even when
  // the provider forces a penalty. A selected random penalty takes another
  // draw, including when its candidate list contains only one resource.
  generateCollapseSequence(char,need,provider){
    if(char.collapse_sequence||this.w.isPreview)return;
    if(this.stage.no_use_collapse_penalty){const seq=[];for(let i=0;i<need;i++)seq.push(i===need-1?{type:'recover',is_force:true}:null);char.collapse_sequence=seq;return;}
    const forced=provider?.getCollapsePenaltySkill();
    const penalty=char.collapse_penalty_occurred?0:this.call('constantMetagameSkipError','collapse_additional_penalty')??0;
    let recovery=this.call('constantMetagameSkipError','collapse_immediate_recovery')??0;
    recovery=this.call('computeWithZeroEff','ZERO_C_AWAKE_RATEUP__COUNT',recovery);
    const candidates=Object.values(this.db.table('collapse_penalty')).map(row=>String(row.id)).sort();
    const seq=[];let occurred=forced?true:char.collapse_penalty_occurred??false;
    for(let i=0;i<need;i++){
      if(i===need-1){seq.push({type:'recover',is_force:true});break;}
      const roll=this.e.random.randRange(0,0,100);
      if(!occurred&&roll<penalty||forced){const p=this.db.get('collapse_penalty',forced||this.e.random.randomArrayMember(0,candidates));seq.push({type:'penalty',penalty_id:p.id});occurred=true;}
      else if(roll<penalty+recovery){seq.push({type:'recover',is_force:false});break;}
      else seq.push(null);
    }
    char.collapse_sequence=seq;
  }
  // StressProc 0x4e700. Five is a native constant, not a guessed hand size.
  // Exhausted cards do not count; using/used cards do count.
  checkMinCollapseCards(char,subAction){
    const combatant=this.db.get('char_combatant',char.res_id),p=this.db.get('collapse_passive',combatant.link_collapse_passive_id),count=char.collapse_card_count??0;
    const current=this.b.deck_info.all.filter(id=>{const c=this.b.cardMap[id];if(!c)throw new MissingBattleRule('checkMinCollapseCards.missing_card',{id});return c.char_id===char.id&&c.collapse_count!=null&&[1,3,11,2,7].includes(c.card_place);});
    const dt=this.call('isDTMode');if(current.length>=5)return;
    const need=char.collapse_need_count??this.call('getCollapseNeedCount',char);
    const cards=this.call('getCards',{addStage:false,card_res_ids:[dt==false?p.collapse_link_card_id:p.collapse_2_link_card_id],N:5-current.length,source_id:char.id,to:1,action:subAction==null,sub_action:subAction,skip_action:true,collapse_card:true});
    for(const c of cards){c.collapse_count=count;c.collapse_need_count=need;}
  }
}
