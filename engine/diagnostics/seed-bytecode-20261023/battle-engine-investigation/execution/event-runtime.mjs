import fs from 'node:fs';
import {CONDITION_ENUMS} from './condition-support-runtime.mjs';
import {dispatchUnitCondition} from '../conditions/unit-predicate-suite.mjs';
import {checkCardCondition,compareCondition,checkStack,checkCondMap,TRIGGER} from '../conditions/condition-core.mjs';
import {MissingBattleRule} from './resource-store.mjs';
import {CardEventSpecialRuntime,CARD_SPECIAL_EVENTS} from './card-event-special-runtime.mjs';
function literalMembers(file,prefix){const source=fs.readFileSync(new URL(file,import.meta.url),'utf8'),result={};for(const m of source.matchAll(/arg0\.([A-Za-z_0-9]+) = (?:"([^"]*)"|(\d+))/g))if(m[1].startsWith(prefix))result[m[1]]=m[2]??Number(m[3]);return Object.freeze(result);}
const ACTION=literalMembers('../state/gamecore/battle/battle_actiontype.js.recovered.js','action_');
const DAMAGE_ATTR=literalMembers('../attributes/gamecore/battle/skill_effect_enums.js.recovered.js','DMG_ATTR_');
if(ACTION.action_monster_hpmark!=='action_monster_hpmark'||DAMAGE_ATTR.DMG_ATTR_ADDITIONAL_ATTACK!=='DMG_ATTR_ADDITIONAL_ATTACK')throw new MissingBattleRule('unit_runtime_enum_evidence');
// Only source-confirmed nullable/optional fields are projected. These views
// write through to the real condition objects and never enter captured state.
// unit-runtime/main.linear.js 7262+ and 10673+: absent attribute/ego filters
// bypass the test; absence is not a missing mandatory event payload.
const OPTIONAL_EVENT='inactive isTrigger unit_opt unit_opt_cs unit_target unit_target_opt_monster unit_opt_multiple_link dmg_attr_opts unit_opt_ego_type prev prev_check no_duplicate duplicate_checks cs_check_opt card_opt link_card_id exclude_link_card_id card_char_slot card_type card_sort card_ego_type card_talent card_talent_not card_amount_opt card_opt_negate_flag card_debuff card_target_opt';
const optionalFields=new Map();
export function optionalView(object,keys){if(object==null)return object;let optional=optionalFields.get(keys);if(!optional){optional=new Set(keys.split(' '));optionalFields.set(keys,optional);}return new Proxy(object,{
  get:(o,k)=>o[k]===undefined&&optional.has(k)?null:o[k],
  set:(o,k,v)=>Reflect.set(o,k,v,o),
  getOwnPropertyDescriptor:(o,k)=>Reflect.getOwnPropertyDescriptor(o,k)??(optional.has(k)?{configurable:true,enumerable:false,writable:true,value:null}:undefined)
});}
// Immutable decoder shared by every isolated preview executor.
const CARD_PLACES=(()=>{const text=fs.readFileSync(new URL('../../card-pool-investigation/gamecore/battle/battle_enums.js.recovered.js',import.meta.url),'utf8'),result={};for(const m of text.matchAll(/arg0\.(CARD_PLACE_\w+) = (\d+)/g)){result[m[1]]=Number(m[2]);result[m[2]]=m[1];}if(result.CARD_PLACE_USED!==11)throw new MissingBattleRule('card_place_version');return Object.freeze(result);})();
export function readCardPlaces(){return CARD_PLACES;}
export class EventRuntime {
  constructor(e){this.e=e;this.b=e.b;this.w=e.wt;this.P=readCardPlaces();this.special=new CardEventSpecialRuntime(this);}
  call(n,...a){return this.e.call(n,...a);}
  checkStack(id){const s=this.b.stackMap[id];return checkStack(s?optionalView(s,'inactive and_or check_map'):null,s?this.e.db.get('condition',s.res_id):null);}
  checkCondMap(id,trigger){const t=typeof trigger==='string'?TRIGGER[trigger]:trigger;if(!Object.values(TRIGGER).includes(t))throw new MissingBattleRule('checkCondMap.trigger',{trigger});return checkCondMap(optionalView(this.b.stackMap[id],'and_or check_map')??null,t);}
  resolveCondUnitTargetId(type,stack){if(type==='CONDITION_UNIT_USER')return this.b.char.id;if(type==='CONDITION_UNIT_CASTER')return stack?.caster_id??-1;if(type==='CONDITION_UNIT_OWNER')return stack?.owner_id??-1;return -1;}
  forEachHpMarkEvent(type,proc){
    this.b.eventMaps.unitEventMap[type]?.forEach(id=>{const ev=this.b.condMap[id];if(ev.inactive)return;
      const row=this.e.db.table('cond_unit')[ev.res_id];if(row==null)return;
      const target=this.resolveCondUnitTargetId(row.condition_unit_type,this.b.stackMap[ev.stack_id]);if(target!==-1)proc(ev,target);
    });
  }
  pushHpMark(id,hp){this.e.pushAction({id:this.b.last_action_id++,type:'action_monster_hpmark',source_id:id,hp});}
  // 0x6fd00 +0x70f00: resource-filtered refresh has a distinct unchanged-stack
  // guard for AMOUNT_SET. It cannot be replaced by procCardEvent for every pile.
  procCardAmountEvent(resourceIds){
    for(const type of ['CONDITION_CARD_AMOUNT','CONDITION_CARD_AMOUNT_SET','CONDITION_CARD_AMOUNT_COMPARE']){
      const map=this.b.eventMaps.cardEventMap[type];if(!map)continue;
      for(const key in map)map[key].forEach(id=>{
        const ev=this.b.condMap[id];if(!resourceIds.includes(ev.res_id)||ev.inactive)return;
        if(type==='CONDITION_CARD_AMOUNT'){this.amountListener(type,Number(key),ev);return;}
        if(type==='CONDITION_CARD_AMOUNT_COMPARE'){
          const a=this.countCard(this.P[ev.card_opt?.[0]],ev,[]),b=this.countCard(this.P[ev.card_opt?.[1]],ev,[]);
          if(a==null||b==null)return;
          if(compareCondition(this.e.db.get('cond_card',ev.res_id).condition_card_value_ineq,a,b))this.e.stacks.onEvent(ev);else this.e.stacks.offEvent(ev);return;
        }
        if(ev.card_amount_opt?.includes('using_previous')&&ev.card_id!=-1&&this.b.deck_info.using.includes(ev.card_id)||ev.card_amount_opt?.includes('turn_over_previous')&&!this.b.player_turn)return;
        const n=this.countCard(Number(key),ev);if(n==null)return;const stack=this.b.stackMap[ev.stack_id];
        if(!stack||stack.inactive||stack.stack==n*ev.stack_input)return;
        ev.set_value=n*ev.stack_input;ev.set=true;this.e.stacks.onEvent(ev);
      });
    }
  }
  setCardTriggered(stack,id){for(const p of this.b.stackParentMap[stack]??[]){if(p.from!=='SKILL')continue;const s=this.b.skillMap[p.parent_id];if(!s)continue;const c=this.b.cardMap[id];s.card_triggered=id;s.bind_stack_triggered=c?.talents?.includes(37)?(c.bind_count??0)+1:0;}}
  setTargetTriggered(stack,ids){for(const p of this.b.stackParentMap[stack]??[])if(p.from==='SKILL')this.b.skillMap[p.parent_id].target_triggered=ids.slice();}
  countCard(place,event,opts,additional){
    const b=this.b,d=b.deck_info;let ids,placeKnown=true;
    const combined={15:['discard','used'],16:['deck','discard'],17:['deck','discard','used'],18:['deck','hand'],19:['discard','hand'],20:['discard','used','hand'],21:['deck','hand','discard'],22:['deck','discard','used','using']};
    if(combined[place])ids=combined[place].flatMap(k=>d[k]);
    else if(place===0||place===8)ids=d.all.slice();
    else if([1,2,3,4].includes(place))ids=d[{1:'deck',2:'hand',3:'discard',4:'exhaust'}[place]].slice();
    else if(place===5||place===6){placeKnown=false;ids=place===5?d.deck.slice(0,1):d.deck.slice(-1);}
    else if(place===11)ids=b.used_cards.slice();
    else if(place===9)ids=Object.values(d.monster).flatMap(a=>a.slice());
    else if(place===10){const s=b.stackMap[event.stack_id];if(!s||!this.e.getMonster(s.caster_id))throw new MissingBattleRule('countCard.monster_caster');ids=d.monster[s.caster_id]?.slice()??[];}
    else if(place===12||place===13)ids=d.all.filter(id=>![0,4,...(place===13?[9]:[])].includes(b.cardMap[id].card_place));
    else if(place===14)ids=this.e.state.worktables.BattleStageWorktable.battle_stage.all.map(x=>x.id).filter(id=>b.cardMap[id]!=null);
    else throw new MissingBattleRule('countCard.place',{place});
    if(additional)ids=ids.concat(additional);ids=ids.filter(id=>!this.call('isCardUninteractible',id));
    // anonymous_213 intentionally reads its resource and always returns true.
    for(const id of ids)this.e.db.get('card',b.cardMap[id].res_id);
    const total=ids.length,amountOpts=event.card_amount_opt??[],options=opts??event.card_opt??[];
    const supportedAmount=new Set(['using_previous','turn_over_previous','self','char_ego','except_this_card','retain','connect','trigger_retained','trigger_inspiration','trigger_attunment','odd','even','most_amount_ego','each_other_card','most_same_name']);
    if(amountOpts.some(o=>!supportedAmount.has(o)))throw new MissingBattleRule('countCard.amount_options',{options:amountOpts});
    // from_false controls registration/event transitions, not the count. The
    // original 0x156400 and its closures never inspect that marker.
    const supportedOptions=new Set(['original_cost','except_this_card','cost_changed','cost_increase','cost_decrease','own_other_char','from_false','own_char','card_with_this_cs','targeting']);
    if(options.some(o=>!supportedOptions.has(o)))throw new MissingBattleRule('countCard.options',{options});
    let targetEgo;
    if(amountOpts.includes('char_ego')){const char=this.call('tryGetCharByCharId',event.char_id);if(!char?.res_id)return 0;targetEgo=this.call('convertEgoCommon',this.e.db.get('char_combatant',char.res_id).link_ego_type_id);}
    const target=amountOpts.includes('self')?this.call('tryGetCharByCharId',event.char_id)?.id:undefined;
    ids=ids.filter(id=>{
      const c=b.cardMap[id],row=this.e.db.get('card',c.res_id);if(target!=null&&c.char_id!=target)return false;
      // anonymous_214 @67..114 computes an unknown-card flag. It suppresses
      // only filters which inspect hidden properties, not the count itself.
      // The early undefined/false results below are both false to Array.filter.
      const unknown=!placeKnown&&this.w.isPreview!=0&&c.known==false;
      if(unknown&&(event.exclude_link_card_id?.length||event.cs_check_opt?.length||event.link_cs_id?.length||event.link_card_id?.length||
        options.includes('card_with_this_cs')||amountOpts.some(o=>['retain','connect','trigger_retained','trigger_inspiration','trigger_attunment'].includes(o))||
        event.card_opt?.includes('own_other_char')||options.some(o=>['targeting','cost_changed','cost_increase','cost_decrease'].includes(o))||
        event.card_char_slot?.length||event.card_type?.length&&!event.card_type.includes('all')||event.card_sort?.length||event.card_ego_type?.length||event.card_talent?.length||
        !(event.min_cost==-1&&event.max_cost==999)))return false;
      if(event.exclude_link_card_id?.length&&event.exclude_link_card_id.includes(c.res_id))return false;
      // anonymous_214 @194..362: the CS check is on the party, whereas linked
      // CS resources are sought on this card and exclude removed entries.
      if(event.cs_check_opt?.length&&!this.call('checkCSopts',event.cs_check_opt,b.char))return false;
      if(event.link_cs_id?.length&&!event.link_cs_id.some(res=>(c.continueSkill??[]).some(i=>{const cs=b.csMap[i];return cs&&!cs.removed&&cs.res_id==res;})))return false;
      if(event.link_card_id?.length&&!event.link_card_id.includes(c.res_id))return false;
      if(options.includes('card_with_this_cs')){
        const parents=b.stackParentMap[event.stack_id];if(!parents)throw new MissingBattleRule('countCard.stack_parents',{stack_id:event.stack_id});
        if(!parents.some(p=>{if(p.from===this.e.enums.STACK_FROM.CARD)return p.parent_id==id;if(p.from!==this.e.enums.STACK_FROM.SKILL)return false;const parent=b.skillMap[p.parent_id]?.parent;if(parent?.type===this.e.enums.SkillParentType.CS){const cs=b.csMap[parent.id];return cs?.isCard&&cs.owner_id==id;}return parent?.type===this.e.enums.SkillParentType.CARD&&parent.id==id;}))return false;
      }
      // Native filter @530..1644: retain/connect each query team targets
      // before this-card passives. Do not cache across cards: queries can roll.
      for(const kind of ['retain','connect'])if(amountOpts.includes(kind)){
        const type=kind==='retain'?'SKILL_EFF_CARD_RETAIN':'SKILL_EFF_CARD_CONNECT';
        const targets=[];for(const p of this.call('getPassiveByType',{source_id:b.char.id,type,is_card:false})){
          const found=this.call('getTargetCards',p.skill_id,false,false,false).target_cards_id;
          targets.push(...found.filter(i=>!targets.includes(i)));
        }
        const own=this.call('getPassiveByType',{source_id:c.id,type,is_card:true}),T=this.e.passives.talent;
        if(!own.length&&!(kind==='connect'&&c.connect_passive)&&!c.talents?.includes(kind==='retain'?T.TALENT_RETAIN:T.TALENT_CONNECT)&&!(kind==='connect'&&c.talents?.includes(T.TALENT_CONNECT_INFINITE))&&!targets.includes(id))return false;
      }
      for(const [amount,opt]of [['trigger_retained','trigger_retained'],['trigger_inspiration','trigger_inspiration'],['trigger_attunment','trigger_attunment']])if(amountOpts.includes(amount)){
        const has=i=>b.skillMap[i].eff_opts?.includes(opt);
        if(!this.call('getAllCardSkillEffIds',c).some(has)&&!c.continueSkill?.some(i=>b.csMap[i]?.skillEffs.some(has)))return false;
      }
      if(event.card_opt?.includes('own_other_char')&&(c.char_id==-1||c.char_id==event.char_id))return false;
      if(options.includes('targeting')&&this.call('getTargetTypeByTargetForUI',row.target_for_ui)!=='TARGET_MONSTER')return false;
      if(options.includes('cost_changed')&&c.cost_result==c.cost)return false;
      if(options.includes('cost_increase')&&c.cost_result<=c.cost)return false;
      if(options.includes('cost_decrease')&&c.cost_result>=c.cost)return false;
      if(event.card_char_slot?.length&&!event.card_char_slot.includes(c.char_id))return false;
      if((options.includes('except_this_card')||amountOpts.includes('except_this_card'))&&event.card_id==id)return false;
      if(targetEgo&&!this.call('checkEgo',id,[targetEgo]))return false;
      if(event.card_type?.length&&!event.card_type.includes('all')&&!this.call('checkCategory',id,event.card_type))return false;
      if(event.card_sort?.length){const sorts=this.call('getSort',id),exclude=event.card_sort.includes('not'),matched=sorts.some(x=>event.card_sort.filter(s=>s!=='not').includes(x));if(exclude?matched:!matched)return false;}
      if(event.card_ego_type?.length&&!this.call('checkEgo',id,event.card_ego_type))return false;
      if(event.card_talent?.length){const T=this.e.passives.talent,test=t=>t===T.TALENT_CONNECT?!!(c.talents?.includes(T.TALENT_CONNECT)||c.talents?.includes(T.TALENT_CONNECT_INFINITE)||c.connect_passive):this.call('hasTalent',id,t);if(event.card_talent_not?event.card_talent.some(test):!event.card_talent.every(test))return false;}
      // Native @3174..3357 skips the unrestricted sentinel pair. Original
      // cost deliberately reads event.card_opt even when opts was overridden.
      if(!(event.min_cost==-1&&event.max_cost==999)){const cost=event.card_opt?.includes('original_cost')?Number(row.cost):c.cost_result;if(cost<event.min_cost||cost>event.max_cost)return false;}
      return true;
    });
    if(amountOpts.includes('odd')||amountOpts.includes('even')){const odd=amountOpts.includes('odd');return ids.filter(id=>{const c=b.cardMap[id];if(c.talents?.includes(this.e.passives.talent.TALENT_UNPLAYABLE))return false;const cost=event.card_opt?.includes('original_cost')?Number(this.e.db.get('card',c.res_id).cost):c.cost_result;return cost!=-1&&(odd?cost%2!=0:cost%2==0);}).length;}
    // Native early-return aggregate modes bypass negate_flag.
    if(amountOpts.includes('most_amount_ego')){const counts={};for(const id of ids){const ego=this.call('getEgo',id);counts[ego]=(counts[ego]??0)+1;}let max=0;for(const ego in counts)if(max<counts[ego]&&this.call('convertEgoCommon',ego)!=='EGO_ALL')max=counts[ego];return max+(counts.EGO_ALL??0);}
    if(amountOpts.includes('each_other_card')||amountOpts.includes('most_same_name')){const info=this.call('getCardSameNameCountInfo',ids.filter(id=>b.cardMap[id]).map(id=>this.call('getBattleCardSameNameKey',b.cardMap[id])));return amountOpts.includes('each_other_card')?info.unique_count:info.max_same_name_count;}
    return event.card_opt_negate_flag?total-ids.length:ids.length;
  }
  procUnitEvent(type,params,value){
    const b=this.b;
    // These three types dispatch further events even without direct listeners.
    // All other absent registrations are no-ops in procUnitRuntime. Avoid
    // building a full predicate frame for those in the admitted fast engine.
    if(this.e.fastBranches&&!Object.hasOwn(b.eventMaps.unitEventMap,type)&&
      !['CONDITION_CHAR_ENERGY','CONDITION_CHAR_CS_TERM_VALUE_SET','CONDITION_OWN_CHAR_CS_TERM_VALUE_SET'].includes(type))return;
    const condMap=new Proxy(b.condMap,{get:(o,k)=>optionalView(o[k],OPTIONAL_EVENT)});
    const unitView=o=>optionalView(o,'mon_turn ego_field_value ego_field_max_value ego_breaked opacity ep_skill');
    const mapView=(map,keys)=>new Proxy(map,{get:(o,k)=>optionalView(o[k],keys)});
    const battleView=optionalView({...b,condMap,csMap:mapView(b.csMap,'effective_term_value show_cs_res_id removed origin'),cardMap:mapView(b.cardMap,'ep_skill connect_passive'),stackMap:mapView(b.stackMap,'value_accrue'),monsters:b.monsters.map(unitView),chars:b.chars.map(unitView)},'assault_fourth_char current_card_use_action');
    // Battle counter writes in native condition code must reach the true battle,
    // even though the predicate sees nullable views of source-optional fields.
    const frame={...this.w,battle:new Proxy(battleView,{set:(o,k,v)=>{b[k]=v;return Reflect.set(o,k,v);}})};
    const stage=this.e.state.worktables?.BattleStageWorktable?.battle_stage;
    if(stage)frame.battle_stage_worktable={...(this.w.battle_stage_worktable??{}),battle_stage:optionalView(stage,'assault_fourth_char')};
    const hooks=new Proxy({
      onEvent:(ev,flag,v,trigger)=>this.e.stacks.onEvent(b.condMap[ev.id],flag,v??undefined,trigger??undefined),
      offEvent:ev=>this.e.stacks.offEvent(b.condMap[ev.id]),
      getUnitByID:id=>unitView(this.e.getUnit(id)),getUnitByIDskipError:id=>unitView(this.e.getUnit(id,true))??null,
      getRootParent:id=>this.call('getRootParent',id)??null,getParentCard:id=>optionalView(this.call('getParentCard',id),'ep_skill')??null,getCharByCharId:id=>unitView(this.call('getCharByCharId',id))??null,
      getCSRow:id=>this.e.db.get('cs',id),getCSRes:id=>this.e.db.table('cs')[id]??null,
      getAllMonstersIncludingRetired:()=>b.monsters.concat(b.retired_monsters).map(unitView)
    },{get:(o,k)=>o[k]??((...a)=>this.call(k,...a))});
    const symbolic=list=>Object.fromEntries(list.split(' ').map(x=>[x,x]));
    dispatchUnitCondition({worktable:frame,eventType:type,params,value:value??null,rowsById:this.e.db.table('cond_unit'),mode:'applyNotifications',hooks,
      enums:{...this.e.enums,...CONDITION_ENUMS,talent:this.e.passives.talent,BATTLE_ACTION_TYPE:ACTION,DMG_ATTR:DAMAGE_ATTR,CARD_PLACE:this.P,UNIT_STATE:symbolic('none summoned target_unable death run changed prop half_death keep_half_death'),CS_BUFF_TYPE:symbolic('CS_BUFF CS_DEBUFF CS_DEBUFF_DOT CS_BUFF_DEBUFF')}});
  }
  checkCard(event,id,known=false,skillId,value,talentPlace){
    const card=this.b.cardMap[id];
    const hooks=new Proxy({getSkill:id=>this.b.skillMap[id]??null,getCS:id=>this.b.csMap[id]??null,getStack:id=>this.b.stackMap[id]??null,checkCSopts:opts=>this.call('checkCSopts',opts,this.b.char),getTargetCards:id=>this.call('getTargetCards',id,false,false,false).target_cards_id},
      {get:(o,k)=>o[k]??((...a)=>this.call(k,...a)??null)});
    return checkCardCondition({event:optionalView(event,OPTIONAL_EVENT),card:card?optionalView(card,'get_card by_testament ego_field_dmg_increased ep_skill connect_passive by_turn_draw'):null,
      cardRes:card?this.e.db.get('card',card.res_id):null,hooks,enums:{...CONDITION_ENUMS,talent:this.e.passives.talent,skillParent:this.e.enums.SkillParentType,stackFrom:this.e.enums.STACK_FROM},
      checkKnown:known,skillId:skillId??null,value:value??null,talentPlace:talentPlace??null,parents:this.b.stackParentMap[event.stack_id]??[],
      playerTurn:this.b.player_turn,connectDiscardCardIds:this.b.connect_discard_card_ids??[],leaderId:this.b.char.id,selectTarget:this.b.select_target});
  }
  procCardEvent(type,place,id,args){
    const b=this.b,P=this.P,card=b.cardMap[id];
    if(type==='CONDITION_CARD_USE'&&card&&!args?.check_collapse){const sort=this.e.db.get('card',card.res_id).sort;
      if(sort==='SORT_COLLAPSE_SKILL')this.procCardEvent('CONDITION_CARD_AWAKEN_USE',place,id,{check_collapse:true});
      else if(sort==='SORT_COLLAPSE')this.procCardEvent('CONDITION_CARD_COLLAPSE_USE',place,id,{check_collapse:true});
      this.call('procTiperaUnique3CardUse',card);this.call('procTiperaTalentStackIncrease',card);}
    if(['CONDITION_CARD_USE','CONDITION_CARD_USE_IMMEDIATE','CONDITION_CARD_THROW'].includes(type)&&['SORT_COLLAPSE','SORT_BREAK_IN'].includes(this.e.db.get('card',card.res_id).sort))return;
    if(place===5||place===6)place=1;
    const amount=['CONDITION_CARD_AMOUNT','CONDITION_CARD_AMOUNT_SET'].includes(type);
    if(amount){
      if(![4,12,13].includes(place)){this.procCardEvent(type,12,-1);this.procCardEvent(type,13,-1);}
      const related={2:[18,19,20,21],1:[16,17,22,18,21],3:[16,17,22,15,19,20,21],11:[17,22,15,20],7:[22]}[place]??[];
      for(const p of related)this.procCardEvent(type,p,-1);
    }
    if(type==='CONDITION_CARD_EXHAUST'&&[3,11].includes(place))this.procCardEvent(type,15,id,{...args,skip_place_none:true});
    const maps=b.eventMaps.cardEventMap[type];
    if(amount){maps?.[place]?.forEach(cid=>this.amountListener(type,place,b.condMap[cid]));return;}
    if(CARD_SPECIAL_EVENTS.has(type))return this.special.dispatch(type,place,id,args);
    if(card==null||!maps)return;
    const triggered=args?.value??(card.cost_result<0?0:card.cost_result),rita=card.rita_value??triggered,input=args?.bind_merge_count??args?.value;
    const each=cid=>{const ev=b.condMap[cid];if(ev.inactive)return;if(args?.combine_material_only&&!ev.card_opt?.includes('card_with_this_cs'))return;
      const yes=this.checkCard(ev,id,this.w.isPreview!=0&&card.known==false,args?.skill_id,args?.value,type==='CONDITION_CARD_USE_IMMEDIATE'?place:undefined);
      if(yes==null)return;if(yes&&args?.off){this.e.stacks.offEvent(ev);return;}if(!yes)return;
      this.call('setCardTriggered',ev.stack_id,id);if(args?.target)this.call('setTargetTriggered',ev.stack_id,[args.target]);
      if(ev.no_duplicate)ev.duplicate_checks?.push(card.res_id);if(b.stackMap[ev.stack_id])b.stackMap[ev.stack_id].rita_value=rita;
      if(input!=null&&ev.card_opt?.includes('set_stack_input'))ev.stack_input=input;
      this.e.stacks.onEvent(ev,undefined,triggered);
    };
    if(!args?.skip_place_none&&place!==0&&!['CONDITION_CARD_MOVE_TO','CONDITION_CARD_MOVE_TO_NOT_FROM_USED','CONDITION_CARD_MOVE_TO_BY_EFF','CONDITION_CARD_MOVE_TO_HAND_BY_EFF'].includes(type))maps[0]?.forEach(each);
    maps[place]?.forEach(each);
  }
  amountListener(type,place,ev){
    if(ev.inactive)return;const b=this.b,keep=ev.card_amount_opt?.includes('using_previous')&&ev.card_id!=-1&&b.deck_info.using.includes(ev.card_id)||ev.card_amount_opt?.includes('turn_over_previous')&&!b.player_turn;
    if(type==='CONDITION_CARD_AMOUNT_SET'){if(keep)return;const count=this.call('countCard',place,ev);if(count!=null){ev.set_value=count*ev.stack_input;ev.set=true;this.e.stacks.onEvent(ev);}return;}
    const wasMissing=ev.prev==null,previous=ev.prev??0,count=keep?previous:this.call('countCard',place,ev),delta=count!=null?count-previous:0;
    ev.prev=count!=null?count:previous;const fromFalse=ev.card_opt?.includes('from_false'),sign=this.e.db.get('cond_card',ev.res_id).condition_card_value_ineq,prior=compareCondition(sign,previous,ev.value);
    if(count==null||delta==0&&!wasMissing)return;
    if(compareCondition(sign,count,ev.value)){if(!fromFalse||!prior)this.e.stacks.onEvent(ev,undefined,delta);}else if(!fromFalse||prior)this.e.stacks.offEvent(ev);
  }
}
