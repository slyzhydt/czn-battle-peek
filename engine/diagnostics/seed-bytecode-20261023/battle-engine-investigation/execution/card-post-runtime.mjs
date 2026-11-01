// Independent ports of post-movement rules; see evidence/card-after-move,
// card-post-helpers, card-place-match, card-collapse and card-talent-utils.
// Retained decompiler output is never evaluated.
import fs from 'node:fs';
import {MissingBattleRule} from './resource-store.mjs';
import {CardLightDarkRuntime} from './card-light-dark-runtime.mjs';
const enumEvidence=JSON.parse(fs.readFileSync(new URL('../targeting/enum-evidence.json',import.meta.url),'utf8'));
const placeMap=enumEvidence.enum_maps.CARD_PLACE;
const placeNames=Object.fromEntries(Object.entries(placeMap).map(([k,v])=>[v,k.replace('CARD_PLACE_','')]));
const atomicPlaces=new Set(Object.values(placeNames).filter(n=>!n.includes('_')));
export class CardPostRuntime {
  constructor(e){this.e=e;this.b=e.b;this.w=e.wt;this.db=e.db;this.lightDark=new CardLightDarkRuntime(e);}
  call(n,...a){return this.e.call(n,...a);}
  event(n,id,extra){return this.call('procCardEvent',n,0,id,...(extra===undefined?[]:[extra]));}
  log(type,params,param_types){this.call('addDetailLog',{type,params,param_types});}
  checkMissionApply(){return !this.w.makeLogs&&!this.w.test&&!this.w.isPreview;}
  checkLightDarkTurnStart(){if(this.w.checking_light_dark||this.b.light_dark_turn_start==this.b.turn)return;
    this.b.light_dark_turn_start=this.b.turn;const d=this.b.deck_info;
    const all=[...new Set([...d.hand,...d.deck,...d.discard,...d.used])].filter(id=>{const ts=this.b.cardMap[id]?.talents;return ts?.includes(58)||ts?.includes(59)||ts?.includes(60);});
    if(!all.length)return;this.w.checking_light_dark=true;
    try{const move=this.call('filterLockHandCards',all.filter(id=>!d.hand.includes(id)),2);
      if(move.length)this.call('moveCards',{card_ids:move,from:17,to:2,by_check_orlea_creation:true,by_force_detail_log:true});
      this.b.divide_reserved=all.filter(id=>d.hand.includes(id)&&this.b.cardMap[id]?.talents?.includes(58));
    }finally{this.w.checking_light_dark=false;}
    this.checkLightDark();
  }
  checkLightDark(){if(this.w.checking_light_dark)return;this.w.checking_light_dark=true;
    try{this.checkLightDarkDivide();if(!this.b.using_card)this.checkLightDarkCombine();
      if(this.hasLightDarkInHand())this.call('sortHandCards');
    }finally{this.w.checking_light_dark=false;}}
  hasLightDarkInHand(){return this.b.deck_info.hand.some(id=>{const ts=this.b.cardMap[id]?.talents;return ts?.includes(59)||ts?.includes(60)||false;});}
  checkLightDarkDivide(){if(this.b.light_dark_divide_turn==this.b.turn)return;const reserved=this.b.divide_reserved;if(reserved==null)return;
    for(const id of reserved.slice()){const c=this.b.cardMap[id];
      if(!c?.talents?.includes(58)||!this.b.deck_info.hand.includes(id)){reserved.splice(reserved.indexOf(id),1);continue;}
      if(this.b.cardCoops?.some(x=>x.card_id==id)||this.b.cardRepeats?.some(x=>x.card_id==id)||this.b.cardUses?.some(x=>x.card_id==id))continue;
      const resources=[c.res_id+'_mut1',c.res_id+'_mut2'];
      if(!resources.every(r=>this.db.table('card')[r])){this.e.ports.pushLog('err:light_dark_divide_card_not_found:'+c.res_id);reserved.splice(reserved.indexOf(id),1);continue;}
      if(this.call('getHandCardCountForLimit')>this.call('getBattleHandMaxCount')-(this.b.sparking?1:0))return;
      const owner=c.char_id,spark=c.r_spark?structuredClone(c.r_spark):undefined;
      const changed=this.call('changeCards',[id],resources[0],{prepareNewCard:card=>{card.light_dark_origin_r_spark=spark;}});
      if(changed.length==0)continue;reserved.splice(reserved.indexOf(id),1);this.b.light_dark_divide_turn=this.b.turn;
      const added=this.call('getCards',{source_id:owner,card_res_ids:[resources[1]],to:2,N:1,addStage:false,ignoreCond:true,by_check_orlea_creation:true,allow_hand_overflow:true});
      this.log('log_card_talent_light_dark_divide',[[changed[0].id,...added.map(c=>c.id)]],['card_id']);
      this.call('procCardEvent','CONDITION_CARD_DIVIDE',2,changed[0].id);return;
    }
  }
  checkLightDarkCombine(){return this.lightDark.checkLightDarkCombine();}
  // Original API accepts enum numbers. Resource callers convert symbolic names
  // at the adapter boundary; supporting both here preserves that conversion.
  matchCardPlaceSet(set,place){if(typeof set==='string'&&set in placeMap)set=placeMap[set];
    if(set===0||set===8)return true;
    if(set===5||set===6)return place==1;
    if(set===12)return place!=4&&place!=0;
    if(set===13)return place!=4&&place!=9&&place!=0;
    const names=(placeNames[set]??'').split('_');
    return names.every(n=>atomicPlaces.has(n))?names.includes(placeNames[place]??''):set==place;
  }
  getLockHandPassives(place){const ps=this.e.passives.query({source_id:this.b.char.id,type:'SKILL_EFF_LOCK_HAND',is_card:false,ignore_cs_own_type:true});
    return ps.length?ps.filter(p=>this.matchCardPlaceSet(this.db.get('skill_eff',p.res_id).target_card_set_list_card_place,place)):ps;}
  isCollapseOnCharacterByID(id){const stage=this.w.battle_stage_worktable??this.e.state.worktables.BattleStageWorktable;
    if(!stage?.battle_stage?.chars)throw new MissingBattleRule('BattleStageWorktable.battle_stage.chars');
    return stage.battle_stage.chars.find(c=>c.id==id)?.collapse_on==true;}
  isBindExcludedHandCard(id){if(this.call('isCardUninteractible',id))return true;
    if(this.b.cardCoops?.some(x=>x.card_id==id))return true;
    if(this.b.cardRepeats?.some(x=>x.card_id==id))return true;
    return this.b.cardUses?.some(x=>x.card_id==id)??false;}
  getBindGroupBaseResId(id){return id.replace(/(?:_(?:rsp\d+|lbk|pot|mut\d*))+$/,'');}
  getBindGroupKey(card){if(!card?.talents?.includes(37)||card.bind_max_count==null)return;
    return `${card.char_id}:${this.getBindGroupBaseResId(card.res_id)}`;}
  checkCardBind(noAction=false){const bound=[];for(const [place,key]of [[1,'deck'],[2,'hand'],[3,'discard'],[4,'exhaust']]){
    const cards=this.b.deck_info[key],groups=new Map();
    for(const id of cards){if(place==2&&this.isBindExcludedHandCard(id))continue;const c=this.b.cardMap[id],group=this.getBindGroupKey(c);
      if(!c||group==null)continue;if(!groups.has(group))groups.set(group,[]);groups.get(group).push(c);}
    for(const group of groups.values()){if(group.length<2)continue;
      group.sort((a,b)=>cards.indexOf(a.id)-cards.indexOf(b.id));bound.push(...group.map(c=>c.id));
      let baseIndex=0;for(let i=1;i<group.length;i++)if((group[i].bind_count??0)>(group[baseIndex].bind_count??0))baseIndex=i;
      const base=group[baseIndex],others=group.filter((_,i)=>i!=baseIndex),before=(base.bind_count??0)+1,removed=[];
      let count=before;for(const c of others){count=Math.min(count+(c.bind_count??0)+1,base.bind_max_count);removed.push(c.id);}
      if(!removed.length)continue;base.bind_count=count-1;if(base.base_bind_count===undefined)base.base_bind_count=count-1;
      this.call('moveCards',{card_ids:removed,from:place,to:0,by_check_card_bind:true});
      for(const id of removed)this.call('removeCard',id);
      if(count>before){if(place==2)this.log('log_card_talent_bind_stack',[base.id,count],['card_id','value']);
        else this.log('log_card_talent_bind_stack_from_card_place',[place,base.id,count],['card_from','card_id','value']);}
      if(!noAction)this.e.ports.pushAction({id:this.b.last_action_id++,type:'action_card_bind',action_card_property:{card:base.id,bind_count:count},source_id:-1,skip_action:base.card_place!=2});
      this.e.ports.pushChangeData('card',base.id);this.event('CONDITION_CARD_TALENT_BIND_STACK_AMOUNT',base.id);
      this.event('CONDITION_CARD_TALENT_BIND_STACK_AMOUNT_SET',base.id);
      this.event('CONDITION_CARD_STACKED',base.id,{value:count-before,bind_merge_count:Math.min(removed.length,count-before)});
    }
  }return bound.length?bound:undefined;}
  checkRecallReserved(){if(this.b.recall_reserved==null)return;
    const pending=this.b.recall_reserved.slice();this.b.recall_reserved=undefined;
    let capacity=this.call('getBattleHandMaxCount')-(this.b.sparking?1:0)-this.call('getHandCardCountForLimit');
    const accepted=[],denied=[],blocked=[];
    for(const pair of pending){const ps=this.getLockHandPassives(pair[0]);
      if(ps.length){for(const p of ps)if(!blocked.includes(p))blocked.push(p);denied.push(pair[1]);continue;}
      const exempt=this.call('isHandMaxAmountExceptCard',pair[1]);
      if(exempt||capacity>0){accepted.push(pair);if(!exempt)capacity--;}else denied.push(pair[1]);}
    this.call('procLockHandBlocked',blocked);const groups=new Map();
    for(const [place,id]of accepted){if(!groups.has(place))groups.set(place,[]);groups.get(place).push(id);}
    const consume=id=>{const c=this.b.cardMap[id];if(c&&c.recall_count!=null&&c.recall_count<0){
      this.call('removeTalents',id,['TALENT_RECALL']);c.recall_count=undefined;c.base_recall_count=undefined;this.e.ports.pushChangeData('card',id);}};
    for(const [place,ids]of groups){this.call('moveCards',{from:place,to:2,card_ids:ids,by_check_recall_reserved:true});for(const id of ids)consume(id);}
    for(const id of denied)consume(id);if(pending.length)this.checkRecallReserved();this.call('checkLightDark');
  }
  checkOrleaCreation(){const groups={};for(const id of this.b.deck_info.hand){
    if(this.isBindExcludedHandCard(id))continue;const c=this.b.cardMap[id];if(!c)continue;
    const owner=[4,5,6].includes(c.char_id)?c.char_id-3:c.char_id;
    if(owner>0&&this.isCollapseOnCharacterByID(owner))continue;
    if(!c.talents?.includes(25))continue;const suffix=Number(c.res_id[c.res_id.length-1]),group=Math.floor((suffix-1)/3),tier=suffix%3;
    if(tier==0)continue;groups[group]??={};groups[group][tier]??=[];groups[group][tier].push(c);
  }
    for(const g in groups){const tiers=groups[g];while(tiers[1]?.length){let a,b;
      if(tiers[2]?.length){a=tiers[1].shift();b=tiers[2].shift();}
      else if(tiers[1].length>1){a=tiers[1].shift();b=tiers[1].shift();}else break;
      const find=c=>c.continueSkill?.find(id=>{const cs=this.b.csMap[id];return cs&&!cs.removed&&cs.res_id=='cs01_0632';});
      const ac=find(a),bc=find(b);let maintain=0;if(ac)maintain+=this.b.csMap[ac]?.term_value??0;if(bc)maintain+=this.b.csMap[bc]?.term_value??0;
      this.call('moveCards',{card_ids:[a.id,b.id],from:2,to:0,by_check_orlea_creation:true});this.call('removeCard',a.id);this.call('removeCard',b.id);
      const suffix=Number(b.res_id[a.res_id.length-1]),res=b.res_id.slice(0,-1)+(suffix+1);
      const added=this.call('getCards',{source_id:b.char_id,card_res_ids:[res],to:2,N:1,addStage:false,by_check_orlea_creation:true,ignoreCond:true});
      if(!added.length)continue;const id=added[0].id;this.event('CONDITION_CARD_STACKED',id);this.log('log_talent_orlea_creation',[[id]],['card_id']);
      if(maintain>0)this.call('procAddCS',id,'cs01_0632',maintain,id,true,'MATHSIGN_ADD',true,true,b.char_id,-1,{origin:this.call('csOriginCardUse')});
      const tier=suffix%3+1;if(tier<3){tiers[tier]??=[];tiers[tier].push(added[0]);}
    }}
  }
  resolveTalentFairyShield(id){if(!this.b.cardMap[id]?.talents?.includes(45))return;
    const chars=this.b.assault_fourth_char?[...this.b.chars,this.b.assault_fourth_char]:this.b.chars;
    const owner=chars.find(c=>Number(this.db.get('char_base',c.res_id)?.model)===1055);if(!owner)return;
    const hp=this.b.char.status.info.S_HP??0,shield=this.b.char.status.info.S_CURRENT_SHIELD??0;
    const constants=this.db.table('constant_meta'),a=Number(constants.talent_fairy_a?.value??0),b=Number(constants.talent_fairy_b?.value??0);
    if(shield>=hp*a/100)return;
    const def=this.call('getStatus',owner.id,'S_DEF_SHIELD');
    return {adelheit_id:owner.id,shield_amount:this.call('procRevise',2,this.call('procStatType',2,b,def))};
  }
  procTalentFairy(id){const out=this.resolveTalentFairyShield(id);if(!out)return;
    this.call('pushSubBattleLog',{type:'talent',params:[id,45],not_noti:true,logs:[]});
    const unit=this.call('procShieldApply',out.adelheit_id,this.b.char,out.shield_amount,id,false,false,true);
    const actions=[{action_units:[unit]}];this.e.ports.pushAction({id:this.b.last_action_id++,type:'action_shield_auto',source_id:out.adelheit_id,action_list:actions,card_id:id,byCard:true});
    this.log('log_skill_eff_shield',[actions,[this.b.char.id],1,0,false],[]);
    this.event('CONDITION_CARD_FAIRY',id,{value:out.shield_amount});this.call('setSubFinished');
  }
}
