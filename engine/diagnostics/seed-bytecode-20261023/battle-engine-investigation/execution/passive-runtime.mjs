// Hand port: getPassiveByType 0xf0000018be00 (including nested predicates).
// Rebuild ordered type positions from the offline passive list; never reuse
// process-local identity caches across cloned simulation branches.
import {MissingBattleRule} from './resource-store.mjs';
export class PassiveRuntime {
  constructor({worktable,resources,getUnit,isMonster,random,talent,record,indexed=false}){
    Object.assign(this,{wt:worktable,b:worktable.battle,db:resources,getUnit,isMonster,random,talent,record,indexed});
    this.typeIndices=new WeakMap();
  }
  invalidate(list){this.typeIndices.delete(list);}
  positions(list,type){
    let entry=this.typeIndices.get(list);
    if(!entry){
      entry={types:new Map(),unknown:[],queries:new Map()};
      for(let i=0;i<list.length;i++){
        const skill=this.b.skillMap[list[i][0]];let row;
        if(skill)try{row=this.db.get('skill_eff',skill.res_id);}catch(error){
          if(!(error instanceof MissingBattleRule)&&error.name!=='ActualResourceBlocked')throw error;
          // Classification must not introduce errors for an inactive skill.
          // Its original enabled-path lookup below still raises the boundary.
        }
        if(row==null){entry.unknown.push(i);continue;}
        const positions=entry.types.get(row.eff)??[];positions.push(i);entry.types.set(row.eff,positions);
      }
      this.typeIndices.set(list,entry);
    }
    if(entry.queries.has(type))return entry.queries.get(type);
    const positions=entry.unknown.slice();
    // The original predicate is loose !=. Do not accidentally change numeric
    // versus string enum matching by using a strict Map.get(type) alone.
    for(const [eff,indices]of entry.types)if(eff==type)positions.push(...indices);
    positions.sort((a,b)=>a-b);entry.queries.set(type,positions);return positions;
  }
  parentCardId(skill){
    if(skill.parent.type==='CARD')return skill.parent.id;
    if(skill.parent.type==='SKILL'){
      const parent=this.b.skillMap[skill.parent.id];
      if(parent?.parent.type==='CARD')return parent.parent.id;
    }return -1;
  }
  query(args){
    const allowed=['source_id','type','is_card','talent','skip_error','is_pre','char_id','check_pct','ignore_cs_list','caster_id','defer_pct','ignore_cs_own_type'];
    for(const k of Object.keys(args))if(!allowed.includes(k))throw new MissingBattleRule('getPassiveByType.argument',{k});
    const {source_id,type,is_card,talent,char_id,caster_id}=args;
    const skip_error=args.skip_error??false,is_pre=args.is_pre??false,check_pct=args.check_pct??true,
      ignore_cs_list=args.ignore_cs_list??[],defer_pct=args.defer_pct??false,ignore_cs_own_type=args.ignore_cs_own_type??false;
    const unit=is_card?this.b.cardMap[source_id]:this.getUnit(source_id,skip_error);
    if(!unit&&(is_card||skip_error))return [];
    if(!unit)throw new MissingBattleRule('getPassiveByType.unit',{source_id});
    if(unit.passive==null)return [];
    let result=[];
    if(is_pre&&!Array.isArray(this.wt.previewInactivePassives)&&unit.passive.some(([id])=>this.b.skillMap[id]))throw new MissingBattleRule('previewInactivePassives');
    // Native captures loop length before iteration, including original duplicates.
    const positions=this.indexed&&['string','number'].includes(typeof type)?this.positions(unit.passive,type):null;
    const length=positions?positions.length:unit.passive.length;
    for(let offset=0;offset<length;offset++){
      const index=positions?positions[offset]:offset;
      const skill=this.b.skillMap[unit.passive[index][0]];
      if(!skill)continue;
      if(is_pre){
        if(this.wt.previewInactivePassives.includes(skill.skill_id))continue;
      }
      if(skill.usable===false)continue;
      if(skill.parent.type==='CS'){
        const cs=this.b.csMap[skill.parent.id];
        if(!cs||ignore_cs_list.includes(cs.res_id))continue;
      }
      const row=this.db.get('skill_eff',skill.res_id);
      if(row.eff!=type)continue;
      const chance=this.db.number(row,'run_pct');
      if(chance<100&&!(defer_pct&&skill.eff_opts?.includes('relic'))){
        // check_pct=false EXCLUDES probabilistic passives; it does not grant them.
        if(!check_pct||this.wt.isPreview)continue;
        const draw=this.random.randRange(0,0,100);
        if(chance<=draw){this.record?.({kind:'passive-cancelled',skill_id:skill.skill_id,draw,chance});continue;}
      }
      const options=this.db.array(row.run_check_opt),parent=this.parentCardId(skill);
      if(options.includes('tuning')&&parent>=0&&!this.b.cardMap[parent]?.tuned)continue;
      if(options.includes('card_throw')&&parent>=0&&!this.b.cardMap[parent]?.is_thrown)continue;
      if(talent!=null){
        if(!this.talent||!Object.hasOwn(this.talent,talent))throw new MissingBattleRule('TALENT.enum',{talent});
        if(!skill.eff_opts?.some(opt=>opt.toUpperCase()==this.talent[talent]))continue;
      }
      result.push(skill);
    }
    if(!is_card&&!['SKILL_EFF_HAND_UNUSABLE_EXCEPT_1','SKILL_EFF_SERENIEL_SPECIAL','SKILL_EFF_UNIQUE_CHIZURU'].includes(type)){
      result=result.filter(skill=>{
        if(skill.parent.type!=='CS')return true;
        const cs=this.b.csMap[skill.parent.id];if(!cs)return true;
        const row=this.db.get('cs',cs.res_id);
        if(ignore_cs_own_type)return true;
        if(row.own_type==='OWN_CHAR')return this.isMonster(cs.owner_id)||char_id==cs.char_id;
        if(row.own_type==='OWN_CASTER')return caster_id==cs.caster_id;
        return true;
      });
    }
    if(type!=='SKILL_EFF_DISABLE_PASSIVE'&&result.length){
      // Native recursive call intentionally does NOT propagate talent/defer_pct.
      const disable=this.query({source_id,type:'SKILL_EFF_DISABLE_PASSIVE',is_card,skip_error,is_pre,char_id,caster_id,
        check_pct,ignore_cs_list,ignore_cs_own_type});
      const ids=new Set();disable.forEach(s=>s.eff_opt_multiple_link?.forEach(id=>ids.add(id)));
      result=result.filter(s=>!ids.has(s.res_id));
    }
    return result;
  }
}
