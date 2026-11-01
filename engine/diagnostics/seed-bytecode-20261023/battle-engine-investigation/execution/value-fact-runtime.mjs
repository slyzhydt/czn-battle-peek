// Source-bound bridge for already reconstructed procValueType predicates.
// Evidence: evidence/value-facts/procValueType_0xf000001c9200.linear.js;
// getCostUsed0xe300. Queries are ordered and never cached across evaluation.
import {MissingBattleRule} from './resource-store.mjs';
import {ValueQueryRuntime} from './value-query-runtime.mjs';
const OPTIONAL=new Set(('atk_cap cost_before_using cost_result mon_turn painTurnStart removed talents bind_count debuffs noticeDamage ego_field_egos ego_field_max_value ego_field_value nextCard').split(' '));
export class ValueFactRuntime {
  constructor(e){this.e=e;this.b=e.b;this.w=e.wt;this.queries=new ValueQueryRuntime(e);this.views=new WeakMap();}
  call(n,...a){return this.e.call(n,...a);}
  get init(){return this.e.state.worktables.BattleInitWorktable.battle_init;}
  required(o,k){if(o?.[k]===undefined)throw new MissingBattleRule('value_fact:'+k);return o[k];}
  getCostUsed(skill){return skill.cost_used??0;}
  view(o){if(o==null||typeof o!=='object')return o;if(this.views.has(o))return this.views.get(o);
    const p=new Proxy(o,{get:(t,k)=>{const value=t[k];return value===undefined&&OPTIONAL.has(k)?null:value;},getOwnPropertyDescriptor:(t,k)=>Reflect.getOwnPropertyDescriptor(t,k)??(OPTIONAL.has(k)?{value:null,writable:true,enumerable:false,configurable:true}:undefined)});
    this.views.set(o,p);return p;
  }
  // Use at the valueContext return boundary. Required fields remain strict;
  // only source-proven optional members are represented by explicit null.
  completeValueContext(base,id,targetId,from,extra){const s=this.b.skillMap[id],ctx={skill_id:id,targetId,from,extra};
    const overrides=new Set(['currentCard','beforeUsedCard','turnOverDisBeforeMonsterTurnSum','cardResourceNoticeCategory']);
    const read=(key,...args)=>{let value=overrides.has(key)?this.readValueFact(key,ctx,...args):base.read(key,...args);
      if(['unit','unitSkipError','card','parentCard','parentCS','actionChar','currentCard','beforeUsedCard'].includes(key))return this.view(value);
      if(key==='monsters'||key==='allChars')return value.map(x=>this.view(x));return value;};
    return {...base,...this.queries.callbacks(id),read,preSkillEvalDepth:this.w.preSkillEvalDepth??0,targetTriggered:s.target_triggered??null,cardTriggered:s.card_triggered??null,bindStackTriggered:s.bind_stack_triggered??null,
      painContext:{csMap:this.b.csMap,skillMap:this.b.skillMap,getPainId:()=>this.call('constantMetagame','cs_pain'),
        calcValue:sid=>this.call('calcValue',sid),resolveStatSource:(sid,source)=>this.call('resolveStatSource',sid,source),getStatus:(...a)=>this.call('getStatus',...a)}};
  }
  readValueFact(key,context,...args){
    const s=this.b.skillMap[context.skill_id];if(!s)throw new MissingBattleRule('value_fact.skill',{id:context.skill_id});
    switch(key){
      case 'costUsed':return this.getCostUsed(s); //4186/4243
      case 'costDeficit':return this.b.cost_deficit??0; //4300
      case 'energyBeforeCardUseOrCurrent':return this.b.energy_before_card_use??this.b.energy; //4353
      case 'casterCurrentShield':return this.call('getStatus',s.caster_id,'S_CURRENT_SHIELD'); //4431
      case 'casterMaxHp':return this.call('getStatus',s.caster_id,'S_HP'); //13410
      case 'casterCurrentHp':return this.call('getStatus',s.caster_id,'S_CURRENT_HP'); //13505/14075
      case 'casterAttack':return this.call('getStatus',s.caster_id,'S_ATK'); //3516
      case 'targetMaxHp':return this.call('getStatus',context.targetId,'S_HP'); //13810
      case 'partyCurrentHp':return this.call('getStatus',this.b.char.id,'S_CURRENT_HP'); //13894
      case 'initialMaxHp':return this.required(this.init,'max_hp_init'); //14013
      case 'initialCurrentHp':return this.required(this.init,'init_curhp'); //26514
      case 'partyRawCurrentHp':return this.required(this.b.char.status.info,'S_CURRENT_HP'); //26589
      case 'actionChar':return this.e.valueTarget.view(this.call('tryGetCharByCharId',s.action_char_id))??null; //13278
      case 'currentCard':return this.view(this.b.cardMap[this.b.current_card])??null; //21766
      case 'beforeUsedCard':return this.view(this.b.cardMap[this.b.before_used_card])??null; //18135
      case 'beforeCardAppliedAttackCount':return this.b.cardMap[this.b.before_used_card]?.applied_atk_count??0; //8606/8734
      case 'cardResourceCost':return this.e.db.number(this.e.db.get('card',args[0]),'cost');
      // procValueType callback0x1eec00 @44..57 calls the raw string's
      // includes('ATK'). Decoding 'N_ATK' to ['N_ATK'] changes substring logic.
      case 'cardResourceNoticeCategory':return this.e.db.get('card',args[0]).monster_noti_category;
      case 'casterMonsterTurn':return this.e.getUnit(s.caster_id).mon_turn??null; //27080
      case 'charResourceEgo':return this.e.db.get('char_combatant',args[0]).link_ego_type_id; //17774
      case 'conditionStack0':return s.stack_value0?this.view(this.b.stackMap[s.stack_value0])??null:null; //25480
      case 'continueSkillIds':return this.call('getContinueSkills',args[0]);
      // Linked-CS sums intentionally retain removed records; only the explicit
      // buff/count queries below filter them. This follows the native reducers.
      case 'continueSkills':return this.call('getContinueSkills',args[0]).map(n=>this.view(this.b.csMap[n]));
      case 'continueSkillsByCaster':return (args[0].continueSkillCaster?.[args[1]]??[]).map(n=>this.view(this.b.csMap[n])); //22431/22859
      case 'continueSkillsByChar':return this.queries.getContinueSkillsByCharID(args[0]).map(n=>this.view(this.b.csMap[n]));
      case 'creditAmount':return this.e.state.worktables.BattleStageWorktable?.battle_stage.ingame_currency.ingame_currency?.amount??0; //defines export16='ingame_currency';28330
      case 'currentCardDamageTargets':return this.b.cur_card_dmg_targets??null; //cur_card_dmg_targets
      case 'egoAll':return 'EGO_ALL';
      case 'maxDamageAttributeTurnCount':return Number(this.call('constantMetagame','dmg_attr_count_max_turn_count')); //4621; native missing-row default is zero
      case 'monsterCards':return this.b.deck_info.monster??null; //19412
      case 'monsterCasterCards':return this.b.deck_info.monster[s.caster_id]??null; //19615
      case 'parentCardBindCount':{const c=this.call('getParentCard',context.skill_id);return this.b.cardMap[c?.id??-1]?.bind_count??null;}
      case 'parentCardOlgaCount':return this.call('getParentCard',context.skill_id)?.olga_count??0;
      case 'parentCardKilledCount':{const c=this.call('getParentCard',context.skill_id);return c?this.b.cardUseKilled?.[c.id]??0:0;}
      case 'reviseRates':return this.call('getReviseRates');
      case 'stageDeckAll':return this.required(this.e.state.worktables.BattleStageWorktable?.battle_stage,'all');
      case 'talentEnum':return this.e.valueTarget.talents[args[0]]??null;
      case 'usePlaceSnapshot':return this.b.use_place_snapshot?.[args[0]]??null;
      case 'turnOverDisBeforeMonsterTurnSum':return this.b.turn_over_dis_before_mon_turn_sum??null; //19049, native field differs from old adapter
      case 'targetBuffTypeCount':return this.queries.getCsBuffTypeCount(context.targetId,'CS_BUFF');
      case 'targetDebuffTypeCount':return this.queries.getCsBuffTypeCount(context.targetId,'CS_DEBUFF');
      case 'casterBuffTypeCount':return this.queries.getCsBuffTypeCount(s.caster_id,'CS_BUFF');
      case 'casterDebuffTypeCount':return this.queries.getCsBuffTypeCount(s.caster_id,'CS_DEBUFF');
      case 'deckCount':return this.b.deck_info.deck.length; //19208
      case 'discardCount':return this.b.deck_info.discard.length; //19276
      case 'exhaustCount':return this.b.deck_info.exhaust.length; //19344
      case 'liveFieldMonsterCount':return this.b.monsters.filter(m=>this.call('isFieldMonster',m)&&!['half_death','keep_half_death'].includes(m.state)).length; //18753,callback0x1e8600
      default:throw new MissingBattleRule('readValueFact:'+key,{context,args});
    }
  }
}
