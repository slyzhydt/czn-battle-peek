// Hand port: BattleCardProc.createBattleCard 0xe000; BattleWorktable change/getCards.
// See evidence/card-create/SCOPE.md. Unsupported active branches stop the fork.
import fs from 'node:fs';
import {MissingBattleRule} from './resource-store.mjs';
import {roundGame} from '../effects/effect-arithmetic.mjs';
import {CardSparkRuntime} from './card-spark-runtime.mjs';
import {TALENTS as T,parseBindTalent,getOlgaTalentBase,parseOlgaMaxStack,addTestamentInterruptOutline} from './card-talent-support.mjs';
const FIELDS=JSON.parse(fs.readFileSync(new URL('./card-create-fields.json',import.meta.url),'utf8'));
export class CardCreateRuntime {
  constructor(e){this.e=e;this.b=e.b;this.w=e.wt;this.db=e.db;this.spark=new CardSparkRuntime(e);}
  call(n,...a){return this.e.call(n,...a);}
  gap(n,x){throw new MissingBattleRule('cardCreate.'+n,x);}
  event(n,p,id=-1,options){return this.call('procCardEvent',n,p,id,options);}
  changed(id){this.call('pushChangeData','card',id);}
  action(type,args){const a={id:this.b.last_action_id++,type,...args};this.e.pushAction(a);return a;}
  stageChar(id){const stage=(this.w.battle_stage_worktable??this.e.state?.worktables?.BattleStageWorktable)?.battle_stage;if(!stage)this.gap('stage_missing',{});
    if(id===7){if(!stage.assault_fourth_char)this.gap('fourth_character',{id});return stage.assault_fourth_char;}return stage.chars[id-1];}
  ownerExists(id){id=[4,5,6].includes(id)?id-3:id;return id===7?this.b.assault_fourth_char:this.b.chars[id-1];}
  tuning(res,seen=new Set()){
    const r=this.db.table('skill_eff')[res];if(!r)return false;
    if(seen.has(res))this.gap('tuning_recursive_cycle',{res});seen.add(res);
    if(this.db.array(r.run_check_opt).includes('tuning'))return true;
    for(let i=0;;i++){const link=r['during_eff_'+i+'_link_skill_eff_id'];if(link==null||link==='none'||link==='[]')break;
      if(link!==res&&this.tuning(link,new Set(seen)))return true;}
    return false;
  }
  talent(c,s){
    for(const k of ['EXHAUST','REMOVE','RECALL'])if(s.startsWith('TALENT_'+k)){const base='TALENT_'+k,n=Number(s.slice(base.length+1)),field=k.toLowerCase()+'_count';c[field]=n==0?0:n-1;c['base_'+field]=c[field];c.talents.push(T[base]);return;}
    if(s.startsWith('TALENT_BIND')){const p=parseBindTalent(s),n=p?.stack??0;c.bind_count=n==0?0:n-1;c.base_bind_count=c.bind_count;c.bind_max_count=p?.max;c.talents.push(T.TALENT_BIND);return;}
    if(s==='TALENT_IGNITE'||s.startsWith('TALENT_IGNITE_')){c.ignite_count=0;c.talents.push(T.TALENT_IGNITE);return;}
    if(s.startsWith('TALENT_UNIQUE_TIPERA_')){const n=Number(s.slice('TALENT_UNIQUE_TIPERA_'.length));c.base_tipera_count=Math.max(0,isNaN(n)?0:n);c.tipera_count=0;c.talents.push(T.TALENT_UNIQUE_TIPERA);return;}
    const olga=getOlgaTalentBase(s);if(olga!=null){c.base_olga_count=parseOlgaMaxStack(s);c.olga_count=0;c.talents.push(olga);return;}
    if(s==='TALENT_CONNECT_INFINITE'){c.talents.push(T[s]);return;}
    if(s.startsWith('TALENT_CONNECT')){c.talents.push(T.TALENT_CONNECT);return;}
    if(s==='TALENT_NONE')return;if(T[s]==null)this.gap('invalid_talent',{talent:s});c.talents.push(T[s]);
  }
  createBattleCard(info,options){
    const c=Object.fromEntries(FIELDS.map(k=>[k,undefined]));c.place_before_using=0;c.card_place=0;c.curEgo='NONE';c.args=options;
    for(const k of ['collapse_count','collapse_need_count','nihilum_stack','res_id','r_spark','support_r_spark'])c[k]=info[k];
    if(info.light_dark_origin_r_spark)c.light_dark_origin_r_spark=structuredClone(info.light_dark_origin_r_spark);
    if(c.r_spark?.category==='CATEGORY_UNIQUE'){c.res_id=this.db.get('card_r_spark',c.r_spark.res_id).change_link_card_id;if(c.res_id==null)this.gap('change_link_card_id_empty',{spark:c.r_spark.res_id});c.card_r_spark_changed=true;}
    const r=this.db.get('card',c.res_id);c.caster_id=c.char_id=info.char_id;
    if(r.sort==='SORT_COLLAPSE'&&c.collapse_count==null){const ch=this.stageChar(c.char_id);if(!ch)this.gap('collapse_owner',{id:c.char_id});c.collapse_count=0;c.collapse_need_count=ch.collapse_need_count??this.call('getCollapseNeedCount',ch);}
    c.id=info.id;c.by_turn_draw=true;this.b.cardMap[c.id]=c;this.changed(c.id);
    if(r.card_usable_link_condition_id!=='none'){
      c.stack_use=this.call('getEventStack',{res_id:r.card_usable_link_condition_id,from:'CARD',parent_id:c.id,use:options?.isPassive?'TRIGGER':'AVAILABLE',remove:'REMOVE',caster_id:c.caster_id,owner_id:c.caster_id});
      if(!options?.isPassive){if(!this.call('checkStack',c.stack_use))c.unusable=true;
        if(c.unusable)this.action('action_card_usable',{action_card_property:{card:c.id,usable:false},source_id:c.caster_id});
        if(r.card_usable_condition_outline!=='NO'){c.handOutline??={};c.handOutline[c.stack_use]=!c.unusable;}}
    }
    const parent={type:'CARD',id:c.id},passives=[],ids=options?.override_skill_eff_ids??this.db.array(r.link_skill_eff_id);c.skill_eff_ids=[];
    if(options?.override_skill_eff_ids)c.override_skill_eff_res_ids=ids.slice();
    for(const res of ids){const s=this.call('createSkill',res,c.caster_id,parent,0,0,0,c.char_id),sr=this.db.get('skill_eff',res);c.skill_eff_ids.push(s.skill_id);
      if(sr.operation==='OPERATION_PASSIVE')passives.push(s.skill_id);
      if(['SKILL_EFF_DMG','SKILL_EFF_EXTRA_DMG','SKILL_EFF_DMG_IGNORE_COND'].includes(sr.eff)&&!this.db.array(sr.eff_attr).includes('DMG_ATTR_NO_STAT_CRI'))c.stat_crit=true;
      if(['SKILL_EFF_SHIELD','SKILL_EFF_EXTRA_SHIELD','SKILL_EFF_SHIELD_IGNORE_COND'].includes(sr.eff)&&c.stack_use==-1&&s.stack_trigger==-1)c.def_card=true;}
    c.is_tuning_card=ids.some(id=>this.tuning(id));c.is_efficiency_card=ids.some(id=>this.db.array(this.db.get('skill_eff',id).eff_opt).includes('trigger_efficiency'));
    for(const k of ['cost_changed','cost_set','cost_subtract'])c[k]=info[k];c.cost=r.sort==='SORT_COLLAPSE'?0:Number(r.cost);
    const talents=this.db.array(r.talent);if(talents.length){c.talents=[];talents.forEach(s=>this.talent(c,s));}
    for(const k of ['base_tipera_count','olga_count','base_olga_count','remove_count','base_remove_count'])if(info[k]!=null)c[k]=info[k];
    if(info.add_talents?.length){c.talents??=[];c.add_talents=info.add_talents;const add=info.add_talents.filter(t=>!c.talents.includes(t));c.talents.push(...add);}
    if(info.desire_talent_counts!=null)c.desire_talent_counts=info.desire_talent_counts;
    if(c.talents?.length===0)c.talents=undefined;
    addTestamentInterruptOutline(c);
    for(const id of passives)this.call('addPassiveSkill',id,c.id,true);
    this.spark.setRSpark(c.id);
    if(info.eidolon_reward_ids?.length){c.eidolon_reward_ids=info.eidolon_reward_ids;c.eidolon_slot_type_define_id=info.eidolon_slot_type_define_id;for(const id of info.eidolon_reward_ids)this.call('applyEidolonRewardCS',c.id,id);for(const id of info.eidolon_reward_ids)this.call('applyEidolonRewardEffect',c.id,id);}
    c.r_spark_candis=info.r_spark_candis;c.y_spark=info.y_spark;
    for(const id of c.skill_eff_ids){const sr=this.db.get('skill_eff',this.b.skillMap[id].res_id);if(sr.operation==='OPERATION_CS_SET_AUTO'||sr.eff==='SKILL_EFF_CS_SET_ADD_AUTO')this.call('procCSAddSetAuto',id,true);}
    // createBattleCard0xe000@3218 calls setCardAvailable0xc800(true),
    // which deletes the flag. This also applies to newly spawned monster cards.
    delete c.available;c.outline=false;c.interruptOutline=false;
    c.cost_result=c.cost_changed?0:c.cost_set!==undefined&&c.cost_set>=0?c.cost_set:c.cost_subtract!==undefined&&c.cost_subtract>=0?c.cost-c.cost_subtract:c.cost;
    c.shuffle_order=info.shuffle_order;if(!this.call('isMonsterByID',c.char_id))this.call('getEgo',c.id);return c;
  }
  checkBan(id){const c=this.b.cardMap[id],ps=this.e.passives.query({source_id:c.caster_id,type:'SKILL_EFF_CARD_USE_BAN',is_card:false,char_id:c.char_id}).concat(this.e.passives.query({source_id:c.id,type:'SKILL_EFF_CARD_USE_BAN',is_card:true}));
    c.banned=false;c.banned_allow_use=undefined;c.banned_cs=[];for(const p of ps)if(this.call('getTargetCards',p.skill_id,false,false).target_cards_id.includes(id)){
      c.banned=true;c.banned_allow_use=(c.banned_allow_use??true)&&p.eff_opts?.includes('allow_use');this.changed(id);if(p.parent?.type==='CS'){const cs=this.b.csMap[p.parent.id];if(cs)c.banned_cs.push(cs.cs_id);}}
    return c.banned;
  }
  afterChangeCard(old,newId){const c=this.b.cardMap[newId];c.before_r_spark_cost=old.before_r_spark_cost;c.continueSkill=old.continueSkill?.filter(id=>{const cs=this.b.csMap[id];return cs&&!cs.byAuto&&!cs.removed;});}
  // changeCards anonymous_141 @473..1445: capture before Remove mutates the
  // current card. keepCardState can be the saved pre-transformation card.
  captureChangeState(old,o){
    const state=o.keepCardState??old,keepSet=o.keepCSIds?.length?new Set(o.keepCSIds):undefined;
    const valid=id=>{const cs=this.b.csMap[id];return cs&&!cs.byAuto&&!cs.removed;};
    const list=o.keepCS?state.continueSkill?.filter(valid):keepSet?old.continueSkill?.filter(id=>valid(id)&&keepSet.has(id)):undefined;
    const saved=list?.length?list:undefined,savedSet=saved?new Set(saved):undefined,debuffs=new Set();
    saved?.forEach(id=>{const cs=this.b.csMap[id];if(cs?.from_debuff)debuffs.add(cs.from_debuff);});
    const passives=saved?state.passive?.filter(([id])=>saved.some(cs=>this.b.csMap[cs]?.skillEffs.includes(id))).map(([id,p])=>[id,p]):undefined;
    const carry={state,saved,passives,before_r_spark_cost:o.keepCS||saved?state.before_r_spark_cost:undefined,
      ccsOutline:o.keepCS?state.ccsOutline?.slice():savedSet?state.ccsOutline?.filter(id=>savedSet.has(id)):undefined,
      debuffs:o.keepCS?state.debuffs?.slice():debuffs.size?state.debuffs?.filter(d=>debuffs.has(d.debuff_res_id)):undefined,
      banned_debuff:o.keepCS?state.banned_debuff?.slice():debuffs.size?state.banned_debuff?.filter(([id])=>debuffs.has(id)):undefined,
      banned_cs:o.keepCS?state.banned_cs?.slice():saved?state.banned_cs?.filter(id=>saved.includes(id)):undefined};
    if(o.keepCS)for(const key of ['connect_passive','testament_passive','testament_passive_outline_added'])carry[key]=state[key];
    if(o.keepCS)carry.interruptKeywords=state.interruptKeywords?.slice();
    if(o.keepCS&&!o.keepCardState||keepSet&&saved!==undefined){const auto=old.continueSkill?.filter(id=>this.b.csMap[id]?.byAuto??false);old.continueSkill=auto?.length?auto:undefined;}
    return carry;
  }
  // @3832..4077 and anonymous_153/154/155: transfer only saved instances,
  // rebind ownership/caster IDs, merge passive priorities without duplicates.
  restoreChangeState(old,c,o,carry){if(!o.keepCS&&!carry.saved)return;
    for(const key of ['before_r_spark_cost','ccsOutline','debuffs','banned_debuff','banned_cs'])c[key]=carry[key];c.continueSkill=carry.saved;
    if(o.keepCS)for(const key of ['connect_passive','testament_passive','testament_passive_outline_added','interruptKeywords'])c[key]=carry[key];
    const matches=id=>id==old.id||id==carry.state.id;
    carry.saved?.forEach(id=>{const cs=this.b.csMap[id];if(!cs||cs.removed||!cs.isCard)return;
      for(const key of ['owner_id','action_target_id','caster_id'])if(matches(cs[key]))cs[key]=c.id;
      cs.skillEffs.forEach(id=>{const skill=this.b.skillMap[id];if(skill&&matches(skill.caster_id))skill.caster_id=c.id;});
    });
    carry.passives?.forEach(([id,priority])=>{if(c.passive?.some(p=>p[0]==id))return;c.passive??=[];const at=c.passive.findIndex(p=>p[1]<priority);if(at>=0)c.passive.splice(at,0,[id,priority]);else c.passive.push([id,priority]);this.call('invalidatePassiveTypeIndex',c.passive);});
  }
  changeCards(ids,res,options){
    const o=options??{},rows=Array.isArray(res)?res:ids.map(()=>res),places=[],out=[],changed=[];
    ids.forEach((id,index)=>{const old=this.b.cardMap[id],d=this.b.deck_info;if(!old||!d.all.includes(id)||this.call('isCardUninteractible',id))return;
      if(old.before_change_debuff_card&&!o.ignoreCardChangeDebuff&&!o.to_collapse)return;
      const resource=rows[index]??rows[0];if(!o.battleCard&&!o.cardInfo){const r=this.db.table('card')[resource];if(r&&!this.ownerExists(old.char_id)&&this.call('convertEgoCommon',r.ego_type)==='EGO_OWNER')return;}
      let place=old.card_place;const declared=place===0||this.call('isCardInDeclaredPlace',id,place);old.card_place=0;old.available=false;
      const bind=old.bind_count,olga=old.olga_count,carry=this.captureChangeState(old,o);this.changed(id);
      if(place===2&&declared)this.event('CONDITION_CARD_MOVE_FROM_HAND',0,id);
      if(!o.to_collapse)this.call('removeCard',id);
      const c=o.battleCard??this.createBattleCard(o.cardInfo??this.call('makeCardInfo',this.b.last_unit_id++,resource,old.char_id),undefined);
      c.bind_count=bind;if(olga!=null&&c.base_olga_count!=null)c.olga_count=Math.min(olga,c.base_olga_count);
      this.event('CONDITION_CARD_TALENT_BIND_STACK_AMOUNT',0,c.id);this.event('CONDITION_CARD_TALENT_BIND_STACK_AMOUNT_SET',0,c.id);
      const key={1:'deck',2:'hand',3:'discard',4:'exhaust',7:'using',11:'used'}[place];
      if(key){const at=d[key].indexOf(id);if(at>=0)d[key].splice(at,1,c.id);else place=0;}
      else if(place===9){let found=false;for(const pile of Object.values(d.monster)){const at=pile.indexOf(id);if(at>=0){pile.splice(at,1,c.id);found=true;}}if(!found)place=0;}
      d.all.splice(d.all.indexOf(id),1,c.id);c.nihilum_stack=old.nihilum_stack;this.call('setCardPlace',c.id,place,true,true);
      if(place===7){c.before_change_card_id=old.before_change_card_id??old.id;for(const k of ['place_before_using','place_after_using','cost_before_using','rita_value','ego_field_dmg_increased'])c[k]=old[k];}else c.before_change_card_id=undefined;
      c.by_turn_draw=old.by_turn_draw;this.restoreChangeState(old,c,o,carry);if(o.prepareNewCard){o.prepareNewCard(c,old);this.changed(c.id);}
      places.push(place);out.push(c);changed.push(id);o.changedCardIds?.push(id);
      const used=this.b.used_cards?.indexOf(id);if(used>=0)this.b.used_cards.splice(used,1,c.id);if(this.b.before_activated_card===id)this.b.before_activated_card=c.id;
    });
    if(!out.length)return out;
    const a=this.action(o.collapse?'action_collapse_card_change':'action_card_change',{source_id:-1,action_card:{cards:changed,new_cards:out.map(c=>this.call('createClientCardInfo',c)),place_from:0,place_to:0,enemy_turn:this.b.enemy_turn}});
    out.forEach((c,i)=>{if(!o.ignoreOlgaCondition)this.event('CONDITION_CARD_TALENT_UNIQUE_OLGA_STACK_AMOUNT',0,c.id);
      if(places[i]!=null&&places[i]!==0&&!o.collapse&&!o.collapse_recover&&!o.ignoreMoveToTrigger){this.event('CONDITION_CARD_MOVE_TO',places[i],c.id);this.event('CONDITION_CARD_MOVE_TO_NOT_FROM_USED',places[i],c.id);}
      if(this.checkBan(c.id))this.action('action_card_banned',{source_id:-1,action_card_property:{card:c.id,banned:true}});});
    for(const place of new Set(places.filter(x=>x!==0))){this.event('CONDITION_CARD_AMOUNT',place);this.event('CONDITION_CARD_AMOUNT_SET',place);}
    this.event('CONDITION_CARD_AMOUNT_COMPARE',0);this.call('checkOrleaCreation');a.action_card.bind_cards=this.call('checkCardBind');this.call('checkLightDark');
    this.call('addBattleTempCards',out.map(c=>c.res_id));return out;
  }
  // BattleWorktable willBindInHand 0xe4700; pending-created cards intentionally
  // use only group comparison, whereas current hand also checks exclusions.
  willBindInHand(id,pending=[]){const key=this.call('getBindGroupKey',this.b.cardMap[id]);if(key==null||this.call('isBindExcludedHandCard',id))return false;
    const same=x=>x!=id&&this.call('getBindGroupKey',this.b.cardMap[x])==key;
    return this.b.deck_info.hand.some(x=>same(x)&&!this.call('isBindExcludedHandCard',x))||pending.some(same);}
  findOwnerByResID(res){const id=this.b.deck_info.all.find(id=>{const c=this.b.cardMap[id];return c!=null&&c.res_id==res&&c.char_id>0;});
    if(id!=null&&this.b.cardMap[id]!=null)return this.b.cardMap[id].char_id;return this.b.chars.length>0?this.b.chars[0].id:1;}
  get stage(){const s=(this.w.battle_stage_worktable??this.e.state?.worktables?.BattleStageWorktable)?.battle_stage;if(!s)this.gap('stage_missing',{});return s;}
  // Source receives an already chosen resource list. Resource-pool weighting is
  // performed by the upstream skill operation, not repeated here.
  getCards(args){
    if(![1,2,3,4,5,6,7].includes(args.to))this.gap('getCards.scope',{to:args.to,addStage:args.addStage});
    let source=args.source_id,N=args.N,to=args.to,ranWhole=-1;const out=[],bySpark=args.bySpark??false,action=args.action??true,skill=args.skill_id>0?this.b.skillMap[args.skill_id]:undefined,sr=skill?this.db.get('skill_eff',skill.res_id):undefined;
    if(args.skill_id>0&&!skill)this.gap('getCards.skill_missing',{id:args.skill_id});
    const counts=Object.fromEntries(this.call('getAllChars').map(c=>[c.id,0]));if(!args.ep_skill&&[4,5,6].includes(source))source-=3;
    const currentChars=()=>this.call('getAllChars'),present=c=>c.id>0&&!this.stage.leaved_chars?.includes(c.res_id),available=()=>currentChars().filter(present);
    args.card_res_ids.forEach((resource,index)=>{
      const cardRow=this.db.get('card',resource);let owner=skill?-1:source;
      if(cardRow.require_owner_flag==='YES'&&skill&&sr){switch(sr.eff_card_target_char){
        case 'NONE':break;
        case 'CARD_TARGET_CHAR_OWNER':owner=source;break;
        case 'CARD_TARGET_CARD_OWNER':owner=args.card_owner_ids?.[index]>0?args.card_owner_ids[index]:this.findOwnerByResID(resource);break;
        case 'CARD_TARGET_CHAR_TRIGGERED':{const c=(skill.card_triggered?this.b.cardMap[skill.card_triggered]:undefined)??this.b.cardMap[this.b.current_card]??this.b.cardMap[this.b.before_used_card];owner=c?.char_id??-1;
          if(owner<0||!currentChars().some(c=>c.id===owner&&present(c))){const candidates=available();if(candidates.length)owner=this.e.random.randomArrayMember(0,candidates).id;}break;}
        case 'CARD_TARGET_CHAR_RAN_EACH':case 'CARD_TARGET_CHAR_EACH_FLAT':break;
        case 'CARD_TARGET_CHAR_RAN_WHOLE':{if(ranWhole>0)owner=ranWhole;else{const candidates=available();if(candidates.length)owner=ranWhole=this.e.random.randomArrayMember(0,candidates).id;}break;}
        case 'CARD_TARGET_CHAR_1':case 'CARD_TARGET_CHAR_2':case 'CARD_TARGET_CHAR_3':{const wanted=Number(sr.eff_card_target_char.slice(-1));if(currentChars().some(c=>c.id===wanted&&present(c)))owner=wanted;else{const candidates=available();if(candidates.length)owner=this.e.random.randomArrayMember(0,candidates).id;}break;}
        default:break;}}
      if(owner>0&&!args.collapse_card&&this.call('isCollapseOnCharacterByID',owner))return;
      const ps=this.e.passives.query({source_id:owner,type:'SKILL_EFF_CARD_GET_VALUE_ADD',is_card:false,char_id:owner,caster_id:owner});
      if(ps.length){let plus=0,multi=1;for(const p of ps){const r=this.db.get('skill_eff',p.res_id);if(r.target_card_set==='CARD_SET_DESIGNED'&&!this.db.array(r.target_card_set_opt_multiple_link).includes(resource))continue;
        if(r.eff_value_math_sign==='MATHSIGN_ADD')plus+=this.call('calcValue',p.skill_id);
        else if(r.eff_value_math_sign==='MATHSIGN_MULTIPLY')multi*=this.call('calcValue',p.skill_id);
        else if(r.eff_value_math_sign==='MATHSIGN_MULTIPLY_PCT')multi*=this.call('calcValue',p.skill_id)/100;
        else if(r.eff_value_math_sign==='MATHSIGN_ADD_HUND_MULTIPLY_PCT')multi*=(this.call('calcValue',p.skill_id)+100)/100;}
        N=roundGame((N+plus)*multi);}
      const overflow=args.eff_opt?.includes('overflow_to_deck_top')??false,bind=to===2&&!args.by_check_orlea_creation&&!args.by_check_card_bind,pending=[];
      let capacity=-1,slots=0;if(to===2&&!args.collapse_card&&!overflow)capacity=Math.max(0,this.call('getBattleHandMaxCount')+(args.allow_hand_overflow?1:0)-(this.b.sparking?1:0)-this.call('getHandCardCountForLimit'));
      const counted=[1,2,3,7].includes(source)&&!args.collapse_card&&!bySpark&&!args.by_check_orlea_creation&&!args.by_check_card_bind&&!args.eff_opt?.includes('create_no_count');let limit=-1;
      if(counted){const ps=this.e.passives.query({source_id:this.b.char.id,type:'SKILL_EFF_BAN_CARD_CREATION_TURN',is_card:false});if(ps.length)limit=this.call('calcValue',ps[0].skill_id);}
      const local=[];
      for(let i=0;i<N;i++){let res=resource,r=this.db.get('card',res);
        if(counted&&limit>=0&&(this.b.turn_card_creation_count??0)>=limit){this.action('action_toast',{source_id:-1,msg:'ui_toast_ban_card_creation'});this.call('addDetailLog',{type:'log_ban_card_creation',params:[],param_types:[]});break;}
        if(r.require_owner_flag==='YES'&&skill&&sr){
          if(sr.eff_card_target_char==='CARD_TARGET_CHAR_RAN_EACH'){const candidates=currentChars().filter(c=>c.id>0&&!this.call('isCollapseOnCharacterByID',c.id)&&!this.stage.leaved_chars?.includes(c.res_id)).map(c=>c.id);if(candidates.length)owner=this.e.random.randomArrayMember(0,candidates);}
          else if(sr.eff_card_target_char==='CARD_TARGET_CHAR_EACH_FLAT'){const keys=Object.keys(counts).map(Number),active=id=>id>0&&!this.call('isCollapseOnCharacterByID',id)&&!currentChars().some(c=>c.id===id&&this.stage.leaved_chars?.includes(c.res_id));
            const values=keys.filter(active).map(id=>counts[id]),min=values.length?Math.min(...values):0,candidates=keys.filter(id=>active(id)&&counts[id]==min);if(candidates.length){owner=candidates[this.e.random.randRange(0,0,candidates.length)];counts[owner]++;}}}
        const replaced=this.e.passives.query({source_id:this.b.char.id,type:'SKILL_EFF_CARD_GET_REPLACED',is_card:false,char_id:owner});
        for(const p of replaced){const pr=this.db.get('skill_eff',p.res_id);if(!this.db.array(pr.target_card_set_opt_multiple_link).includes(res))continue;
          if(!p.eff_opt_multiple_link?.length)this.gap('getCards.empty_replacement',{res_id:p.res_id});
          res=this.e.random.randomArrayMember(0,p.eff_opt_multiple_link);r=this.db.get('card',res);this.call('checkTermValuePassive',p.skill_id,owner);break;}
        const info=args.cards?.[index]??this.call('makeCardInfo',this.b.last_unit_id++,res,owner);
        if(skill){const sparks=this.e.passives.query({source_id:this.b.char.id,type:'SKILL_EFF_CARD_GET_COMMON_SPARK',is_card:false,char_id:owner});if(sparks.length&&info.r_spark==null){const spark=this.call('getRSparkCandis',info,[],undefined,true);if(spark)info.r_spark={res_id:spark,category:'CATEGORY_PUBLIC'};this.call('checkTermValuePassive',sparks[0].skill_id,owner);}}
        if(!this.ownerExists(owner)&&this.call('convertEgoCommon',r.ego_type)==='EGO_OWNER')continue;
        const c=this.createBattleCard(info,args.override_skill_eff_ids?{override_skill_eff_ids:args.override_skill_eff_ids}:undefined);c.get_card=!bySpark;c.by_turn_draw=true;
        if(skill&&this.call('isMonsterByID',skill.action_char_id))c.by_monster=true;
        if(args.cost_value!==undefined){c.cost=args.cost_value;this.call('updateCostResult',c.id);}local.push(c);
        const exempt=to===2&&this.call('isHandMaxAmountExceptCard',c.id),room=capacity===-1||slots<capacity,binding=bind&&!room&&!exempt&&this.willBindInHand(c.id,pending),eligible=room||exempt||binding;
        if(to===2&&eligible)pending.push(c.id);
        if(counted&&eligible){this.b.turn_card_creation_count=(this.b.turn_card_creation_count??0)+1;this.event('CONDITION_CARD_GET_BAN_CHECKED',to,c.id,{skill_id:args.skill_id});}
        if(args.addStage){this.call('stageAddCard',true,info);this.call('setStageGenerateID',this.b.last_unit_id);}
        if(eligible){if(args.ignoreCond)this.event('CONDITION_IGNORED_CARD_GET',to,c.id);else this.event('CONDITION_CARD_GET',to,c.id,{skill_id:args.skill_id});if(!exempt&&!binding)slots++;}
      }
      // Native selects its destination branch once before this resource batch.
      // An overflow can change shared `to`, while remaining cards still use pushHand.
      const destination=to;
      for(let j=0;j<local.length;j++){const c=local[j];if(destination===2){const before=c.by_turn_draw;
          if(this.call('pushHand',c.id,{isDraw:false,not_toast:j!==0,skill_id:args.skill_id,allow_overflow:args.allow_hand_overflow||(bind&&this.willBindInHand(c.id))})){this.b.deck_info.all.push(c.id);this.call('setCardPlace',c.id,to,false);c.by_turn_draw=before;}
          else if(overflow||args.collapse_card){this.b.deck_info.deck.unshift(c.id);this.b.deck_info.all.push(c.id);this.call('setCardPlace',c.id,1,false);to=1;}
          else{local.splice(j,local.length-j);break;}}
        else{if(destination===1)this.call('pushDeck',c.id);else if(destination===5)this.b.deck_info.deck.unshift(c.id);else this.b.deck_info[{3:'discard',4:'exhaust',6:'deck',7:'using'}[destination]].push(c.id);
          this.b.deck_info.all.push(c.id);this.call('setCardPlace',c.id,destination===5||destination===6?1:to,false);}}
      if(args.skill_id!=null&&local.length)this.call('addDetailLog',{type:'log_skill_eff_card_get',params:[[local[0].id,local.length],to],param_types:[this.call('getLogParamType','card_id_with_count'),this.call('getLogParamType','card_to_wo_hand')]});
      if(!args.addStage)this.call('addBattleTempCards',local.map(c=>c.res_id));out.push(...local);
    });
    let a;if(out.length){a={id:this.b.last_action_id++,type:'action_card_get',source_id:this.b.char.id,action_card_new:{cards:out.map(c=>structuredClone(c)),place_to:to,enemy_turn:this.b.enemy_turn,add_stage:args.addStage},wait_action:bySpark,skip_action:args.skip_action};
      if(action)this.e.pushAction(a);else args.sub_action?.push(a);
      if(to===3)this.call('trimDiscardToLimit',action?undefined:args.sub_action??false,args.skill_id);
      for(const c of out){if(this.checkBan(c.id))this.action('action_card_banned',{action_card_property:{card:c.id,banned:true},source_id:-1});
        if(!args.collapse_card){const cost=this.call('updateCostResult',c.id);if(cost.changed){this.changed(c.id);this.action('action_card_cost',{action_card_property:{card:c.id,cost:cost.new_cost},skip_action:c.card_place!==2,source_id:-1});}}}
      this.call('pushLog','Get Card:'+out.map(c=>c.id));for(const p of [to,8]){this.event('CONDITION_CARD_AMOUNT',p);this.event('CONDITION_CARD_AMOUNT_SET',p);}}
    if(!args.by_check_orlea_creation&&!args.by_check_card_bind){this.call('checkOrleaCreation');if(a)a.action_card_new.bind_cards=this.call('checkCardBind');this.call('checkLightDark');}
    return out.map(c=>this.b.cardMap[this.call('checkCardChangePassive',this.call('checkOverwrite',c.id))]);
  }
}
