// Independent ports; evidence/turn-support{,2,3}, turn-constants.
const zeroStats=()=>({damage:0,shield_gained:0,heal:0,overheal:0,heal_with_overheal:0});
export class TurnSupportRuntime {
  constructor(e){this.e=e;this.b=e.b;this.wt=e.wt;}
  call(n,...a){return this.e.call(n,...a);}
  isFieldMonster(m){return !['death','run','changed','prop'].includes(m.state);}
  isRetiredMonster(m){return ['death','run','changed'].includes(m.state);}
  sumFieldMonsterTurnCount(ms){return ms.reduce((n,m)=>this.isFieldMonster(m)&&m.mon_turn!=null&&Number.isFinite(m.mon_turn)?n+Math.max(0,m.mon_turn):n,0);}
  getCurrentMonsterCursorPos(){const b=this.b;if(b.current_monster_id!=null){const i=b.monsters.findIndex(m=>m.id==b.current_monster_id);if(i>=0)return i;}return b.current_monster_index;}
  setCurrentMonsterCursorPos(i){this.b.current_monster_index=i;this.b.current_monster_id=this.b.monsters[i]?.id;}
  resetCurrentMonsterCursor(){this.b.current_monster_index=-1;this.b.current_monster_id=undefined;}
  // WT 0x190000..0x192c00. Relic-only suppression defers its probability
  // until the actual increase/suppression source is known.
  isMonsterTurnCountSourceFromRelic(id){
    let s=this.b.skillMap[id],count=0;
    while(s!=null&&count<32){
      if(s.from_relic!=null&&s.from_relic!==''||s.skill_id in this.b.relicActionMap)return true;
      if(s.parent.type==='CS'){const cs=this.b.csMap[s.parent.id];return !!(cs&&(cs.from_relic!=null&&cs.from_relic!==''||cs.origin==='RELIC'));}
      if(s.parent.type!=='SKILL')return false;s=this.b.skillMap[s.parent.id];++count;
    }return false;
  }
  getMonsterTurnCountBlockPassives(target,caster){
    if(caster<=0||!this.e.getMonster(target)||this.e.getMonster(caster))return [];
    return this.call('getPassiveByType',{source_id:target,type:'SKILL_EFF_BLOCK_MONSTER_TURN_COUNT',is_card:false,caster_id:caster,defer_pct:true});
  }
  checkMonsterTurnCountBlockPassiveRunPct(p){
    const r=this.e.db.table('skill_eff')[p.res_id];if(!r)return false;const pct=this.e.db.number(r,'run_pct');
    if(pct>=100)return true;if(this.wt.isPreview)return false;
    const draw=this.e.random.randRange(0,0,100);if(pct<=draw){this.call('pushLog','skill '+r.id+' canceld by pct : '+draw);return false;}return true;
  }
  checkMonsterTurnCountBlockedByPassives(passives,caster,args){
    const p=passives.find(p=>{
      if(!p.eff_opts?.includes('relic'))return args?.relic_only===true?false:true;
      return args!=null&&args.source_skill_id!=null&&(args.is_increase===true||args.is_suppress===true)&&this.isMonsterTurnCountSourceFromRelic(args.source_skill_id)&&this.checkMonsterTurnCountBlockPassiveRunPct(p);
    });if(!p)return false;this.call('checkTermValuePassive',p.skill_id,caster);return true;
  }
  checkMonsterTurnCountBlocked(target,caster,args){return this.checkMonsterTurnCountBlockedByPassives(this.getMonsterTurnCountBlockPassives(target,caster),caster,args);}
  // BattleProc 0x75200. The temporary slot is retained unless removal is
  // explicitly requested; an existing same-character slot is never duplicated.
  clearTempEpSkill(worktable,remove=false){
    const b=worktable.battle,index=b.ep_skill_deck.findIndex(x=>x?.char_id===b.temp_ep_skill_slot?.char_id);
    if(remove){if(index!==-1)b.ep_skill_deck.splice(index,1);}else if(index===-1)b.ep_skill_deck.push(b.temp_ep_skill_slot);
    b.temp_ep_skill_slot=undefined;return {res:'ok'};
  }
  // CharUniqUIProc 0x9e00. Enum names are preserved by the offline UI adapter.
  addTiperaIconAction(indices){this.call('addCharUniqUIAction',{type:'_30084',stack_data:{tipera_used_card_indices:indices}});}
  // BattleWorktableProc 0x2e00 has no parameter reads or local effects and only
  // resolves undefined. The synchronous offline projection has the same effects.
  procStageActionBalloon(){return undefined;}
  getCurrentMonster(){return this.b.monsters[this.getCurrentMonsterCursorPos()];}
  // Client invalidates a WeakMap speed cache. This executor resolves every
  // lookup from the current array and maintains no corresponding cache.
  invalidateMonsterIdIndex(){}
  sweepRetiredMonsters(){const b=this.b;if(!b.monsters.some(m=>this.isRetiredMonster(m)))return;
    const kept=[];for(const m of b.monsters)(this.isRetiredMonster(m)?b.retired_monsters:kept).push(m);b.monsters=kept;}
  getBaseEnergy(){return this.e.db.number(this.e.db.get('constant_meta','battle_base_energy'),'value');}
  addEnergy(amount,set,delta,options){
    const b=this.b,{turn_start,turn_end,ego_break}=options??{},old=b.energy;
    if(set){b.energy=amount+delta;if(b.energy<0){b.energy=0;delta=-amount;}else if(b.energy>9)b.energy=9;
      this.e.pushAction({id:b.last_action_id++,type:'action_energy_set',source_id:b.char.id,action_energy:{default:amount,delta}});
    }else{if(b.energy+amount<0)amount=-b.energy;else if(b.energy+amount>9)amount=9-b.energy;b.energy+=amount;
      if(!ego_break)this.e.pushAction({id:b.last_action_id++,type:'action_energy_change',source_id:b.char.id,action_energy:{delta:amount}});}
    this.e.ports.procUnitEvent('CONDITION_CHAR_ENERGY',[b.char.id,turn_end?1:0]);
    this.e.ports.procUnitEvent('CONDITION_ENERGY_AMOUNT_SET',[b.char.id,turn_end?1:0]);
    const gained=b.energy-old;
    if(gained>0)this.e.ports.procUnitEvent('CONDITION_CHAR_EARN_ENERGY',[options?.char_id??b.char.id,gained,turn_start?1:0,options?.source_card_id??-1]);
  }
  addEnergyTurnBegin(){if(this.e.state.worktables.BattleInitWorktable.battle_init.isPreBattle)return;this.addEnergy(this.getBaseEnergy(),false,0,{turn_start:true});}
  checkEnergyMaintain(){
    const rows=this.call('getPassiveByType',{source_id:this.b.char.id,type:'SKILL_EFF_ENERGY_MAINTAIN',is_card:false});
    if(!rows.length||this.b.energy<=0)return 0;
    let selected=rows[0];const value=rows.reduce((n,s)=>{if((s.eff_opts?.length??0)==0){selected=s;return Infinity;}if(n<Number(s.eff_opts?.[0])){selected=s;return Number(s.eff_opts?.[0]);}return n;},0);
    this.call('checkTermValuePassive',selected.skill_id,this.b.char.id);
    this.call('addDetailLog',{type:'log_skill_eff_energy_maintain_turn_end',params:[value],param_types:[this.call('getLogParamType','value')]});return value;
  }
  buildTurnRecordCharStats(){const result=structuredClone(this.b.dpt.char_stats);for(const c of this.e.state.worktables.BattleStageWorktable.battle_stage.chars){if(c.res_id<0)continue;(result[c.res_id]??=zeroStats()).final_stress=c.ego_stress??0;}return result;}
  initDptCharStats(){const result={};for(const c of this.b.chars)if(c&&c.res_id>0)result[c.res_id]=zeroStats();if(this.b.assault_fourth_char?.res_id>0)result[this.b.assault_fourth_char.res_id]=zeroStats();this.b.dpt.char_stats=result;}
  // Deliberate offline output boundary. Native sends this result into an
  // account cache; simulation retains the same arguments without touching it.
  pushTurnRecordOffline(firstEnterTime,record,content,stageId){this.e.record({kind:'offline-turn-record',firstEnterTime,record,content,stageId});}
}
