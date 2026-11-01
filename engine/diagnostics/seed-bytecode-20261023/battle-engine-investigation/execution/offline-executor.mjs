// Stateful offline integration. Unknown ports invalidate a fork; no target code,
// process attachment, network, or trace-fed trigger decisions are used here.
import fs from 'node:fs';
import {cloneBattleState} from './branch-state-clone.mjs';
import {restoreSnapshot,OfflineRandom} from './snapshot-state.mjs';
import {MissingBattleRule} from './resource-store.mjs';
import {StackLifecycle} from './stack-lifecycle.mjs';
import {SkillCallbacks} from './skill-callbacks.mjs';
import {TriggerScheduler} from './trigger-scheduler.mjs';
import {TimingDispatch} from './timing-dispatch.mjs';
import {PassiveRuntime} from './passive-runtime.mjs';
import {ActionEntry} from './action-entry.mjs';
import {ReactionLoop} from './reaction-loop.mjs';
import {ReactionSupport} from './reaction-support.mjs';
import {StateDriver} from './state-driver.mjs';
import {QueuedCardUses} from './queued-card-uses.mjs';
import {OutcomeRuntime} from './outcome-runtime.mjs';
import {RuntimeGuards} from './runtime-guards.mjs';
import {LifecycleRuntime} from './lifecycle-runtime.mjs';
import {EffectRuntime} from './effect-runtime.mjs';
import {PhaseRuntime} from './phase-runtime.mjs';
import {LogRuntime} from './log-runtime.mjs';
import {TurnSupportRuntime} from './turn-support-runtime.mjs';
import {EventRuntime} from './event-runtime.mjs';
import {CardMovementRuntime} from './card-movement-runtime.mjs';
import {CardStateRuntime} from './card-state-runtime.mjs';
import {ValueTargetRuntime} from './value-target-runtime.mjs';
import {CardPostRuntime} from './card-post-runtime.mjs';
import {MainPhaseRuntime} from './main-phase-runtime.mjs';
import {StackNotificationRuntime} from './stack-notification-runtime.mjs';
import {PlayerStartRuntime} from './player-start-runtime.mjs';
import {MonsterNotificationRuntime} from './monster-notification-runtime.mjs';
import {ActionFinalizeRuntime} from './action-finalize-runtime.mjs';
import {StackRegistrationRuntime} from './stack-registration-runtime.mjs';
import {DamageApplyPreviewRuntime} from './damage-apply-preview-runtime.mjs';
import {HpSupportRuntime} from './hp-support-runtime.mjs';
import {HealShieldRuntime} from './heal-shield-runtime.mjs';
import {DamageApplyRuntime} from './damage-apply-runtime.mjs';
import {DeathRuntime} from './death-runtime.mjs';
import {DeathStressRuntime} from './death-stress-runtime.mjs';
import {CollapseCardRuntime} from './collapse-card-runtime.mjs';
import {ValueAddFilterRuntime} from './value-add-filter-runtime.mjs';
import {ActiveCriticalRuntime} from './active-critical-runtime.mjs';
import {ZeroEffRuntime} from './zero-eff-runtime.mjs';
import {DamageStressRuntime} from './damage-stress-runtime.mjs';
import {ClientCardOutputRuntime} from './client-card-output-runtime.mjs';
import {ValueFactRuntime} from './value-fact-runtime.mjs';
import {CardOverwriteRuntime} from './card-overwrite-runtime.mjs';
import {CardCreateRuntime} from './card-create-runtime.mjs';
import {WaveInitializationRuntime} from './wave-initialization-runtime.mjs';
import {DIFFICULTY_LEVEL,DIFFICULTY_LEVEL_NUM} from './difficulty-enums.mjs';
import {CardEventRegistrationRuntime} from './card-event-registration-runtime.mjs';
import {UnitEventRegistrationRuntime} from './unit-event-registration-runtime.mjs';
import {CardActionSupportRuntime} from './card-action-support-runtime.mjs';
import {SharedArithmeticRuntime} from './shared-arithmetic-runtime.mjs';
import {TargetSupportRuntime,TARGET_SUPPORT_METHODS} from './target-support-runtime.mjs';
import {VALUE_QUERY_METHODS} from './value-query-runtime.mjs';
import {ConditionSupportRuntime,CONDITION_SUPPORT_METHODS} from './condition-support-runtime.mjs';
import {CSBalanceRuntime,CS_BALANCE_METHODS} from './cs-balance-runtime.mjs';
import {CSCreationRuntime,CS_CREATION_METHODS} from './cs-creation-runtime.mjs';
import {SkillCreationRuntime} from './skill-creation-runtime.mjs';
import {PassiveLifecycleRuntime,PASSIVE_LIFECYCLE_BINDINGS} from './passive-lifecycle-runtime.mjs';
import {DropRewardRuntime,DROP_REWARD_METHODS} from './drop-reward-runtime.mjs';
import {KillEffectRuntime,KILL_EFFECT_METHODS} from './kill-effect-runtime.mjs';
import {CardMechanicRuntime,CARD_MECHANIC_BINDINGS} from './card-mechanic-runtime.mjs';
import {CoreEffectRuntime} from './core-effect-runtime.mjs';
import {CSEffectRuntime} from './cs-effect-runtime.mjs';
import {CSTransferEffectRuntime,CS_TRANSFER_EFFECT_BINDINGS} from './cs-transfer-effect-runtime.mjs';
import {SkillPreludeRuntime,SKILL_PRELUDE_BINDINGS} from './skill-prelude-runtime.mjs';
import {EgoEffectRuntime} from './ego-effect-runtime.mjs';
import {StressEffectRuntime} from './stress-effect-runtime.mjs';
import {ACTIVE_EFFECT_ENUMS} from './native-effect-enums.mjs';
import {CombatantRuntime,COMBATANT_BINDINGS} from './combatant-runtime.mjs';
import {MonsterEffectRuntime,MONSTER_EFFECT_BINDINGS} from './monster-effect-runtime.mjs';
import {CharacterFactoryRuntime} from './character-factory-runtime.mjs';
import {SkillInterruptRuntime,SKILL_INTERRUPT_BINDINGS} from './skill-interrupt-runtime.mjs';
import {RewardContextRuntime,REWARD_CONTEXT_BINDINGS} from './reward-context-runtime.mjs';
import {CardEffectRuntime,CARD_EFFECT_BINDINGS} from './card-effect-runtime.mjs';
import {TriggeredMotionRuntime,TRIGGERED_MOTION_BINDINGS} from './triggered-motion-runtime.mjs';
import {NativeDiagnosticsRuntime} from './native-diagnostics-runtime.mjs';
import {SelectionRuntime,SELECTION_BINDINGS} from './selection-runtime.mjs';
import {StackParentRuntime,STACK_PARENT_BINDINGS} from './stack-parent-runtime.mjs';
import {PlayerUseSharedRuntime,PLAYER_USE_SHARED_BINDINGS} from './player-use-shared-runtime.mjs';
import {PlayerUseRuntime,PLAYER_USE_BINDINGS} from './player-use-runtime.mjs';
import {PlayerRepeatUseRuntime,PLAYER_REPEAT_USE_BINDINGS} from './player-repeat-use-runtime.mjs';
import {PlayerCommandRuntime,PLAYER_COMMAND_BINDINGS,PLAYER_COMMAND_TYPES} from './player-command-runtime.mjs';
import {PlayerEpCommandRuntime,PLAYER_EP_COMMAND_BINDINGS} from './player-ep-command-runtime.mjs';
import {PlayerSparkCommandRuntime,PLAYER_SPARK_COMMAND_BINDINGS} from './player-spark-command-runtime.mjs';
import {bindActiveRoots,adoptPreviewSideState} from './runtime-state-roots.mjs';
import {PlayerPreviewRuntime,PLAYER_PREVIEW_BINDINGS} from './player-preview-runtime.mjs';
import {PlayerAutoCommandRuntime,PLAYER_AUTO_COMMAND_BINDINGS} from './player-auto-command-runtime.mjs';
import {resdbShuffle} from '../../rng-investigation/resdb-shuffle.mjs';
const USER_LOCALE=JSON.parse(fs.readFileSync(new URL('./user-confirmed-locale.json',import.meta.url),'utf8')).valueTextLocale;
const PASSIVE_TALENTS=JSON.parse(fs.readFileSync(new URL('../../card-pool-investigation/talent-enum.json',import.meta.url),'utf8'));
for(const [k,v]of Object.entries(PASSIVE_TALENTS))PASSIVE_TALENTS[v]=k;
Object.freeze(PASSIVE_TALENTS);

export function readLogicState(){
  // Extract only literal enum assignments from retained evidence, never eval it.
  const text=fs.readFileSync(new URL('../state/gamecore/battle/battle_state_enums.js.recovered.js',import.meta.url),'utf8');
  const result={};
  for(const m of text.matchAll(/arg0\.([A-Za-z_0-9]+) = (\d+)\r?\n/g)){result[m[1]]=Number(m[2]);result[Number(m[2])]=m[1];}
  if(result.MainPhaseAutoAvailable!==26||result.TIMING_TURN_BEGIN!==6)throw new MissingBattleRule('LogicState_version');
  return result;
}
const symbolGroup=names=>Object.fromEntries(names.split(' ').map(n=>[n,n]));
export class OfflineExecutor {
  constructor({snapshot,state,resources,enums,ports={},valueTextLocale=USER_LOCALE,executionHost='client',previewStateTransfer=false,takeStateOwnership=false,captureDiagnostics=true,fastBranches=false}){
    // Ownership transfer is internal to an already isolated preview sandbox.
    // Root inputs and ordinary search forks keep their deep-copy boundary.
    this.state=state?(takeStateOwnership?state:fastBranches?cloneBattleState(state):structuredClone(state)):restoreSnapshot(snapshot);
    this.fastBranches=fastBranches;
    this.previewStateTransfer=previewStateTransfer;
    this.wt=this.state.worktable;this.b=this.wt.battle;this.db=resources;this.trace=[];this.captureDiagnostics=captureDiagnostics;this.eventCount=0;
    this.valueTextLocale=valueTextLocale;
    this.executionHost=Object.hasOwn(this.state.runtimeInputs??{},'executionHost')?this.state.runtimeInputs.executionHost:executionHost;
    if(!['client','server','none'].includes(this.executionHost))throw new MissingBattleRule('input.executionHost',{value:this.executionHost});
    this.enums=enums??{LogicState:readLogicState(),EVENT_CONDITION_TYPE:{UNIT:0,CARD:1,TIMING:2},
      STACK_FROM:symbolGroup('SKILL CARD MONSTER MONSTER_PATTERN USER COLOR CUSTOM_FINISH MISSION SINGULARITY'),
      STACK_PROC_TYPE:symbolGroup('AVAILABLE TRIGGER VALUECOUNT DURING_EFF'),SkillParentType:symbolGroup('CARD CS SKILL')};
    this.enums={DIFFICULTY_LEVEL,DIFFICULTY_LEVEL_NUM,...ACTIVE_EFFECT_ENUMS,...this.enums};
    // A diagnostic override installed on one fork must not change later
    // siblings or the parent. Callback functions may be shared, the registry
    // itself must not be. State already has its own deep clone above.
    this.extensions={...ports};
    this.random=new OfflineRandom(this.state.randoms,e=>this.record(e));
    const talent=PASSIVE_TALENTS;
    this.passives=new PassiveRuntime({worktable:this.wt,resources:this.db,getUnit:(id,skip)=>this.getUnit(id,skip),
      isMonster:id=>this.getMonster(id)!=null,random:this.random,talent,record:e=>this.record(e),indexed:fastBranches});
    this.ports={
      pushChangeData:(kind,id)=>this.pushChangeData(kind,id),
      pushAction:(action,prev)=>this.pushAction(action,prev),
      stackAction:(type,stack)=>this.pushAction({id:this.b.last_action_id++,type,source_id:stack.stack_id,event_stack:stack}),
      pushLog:message=>this.record({kind:'diagnostic',message}),
      addSkillTriggered:(...args)=>this.scheduler.add(...args),
      useParent:(p,id,value)=>this.useParent(p,id,value),
      toggleParent:(p,id,on)=>this.toggleParent(p,id,on),
      stackParentBeforeChange:(...args)=>this.stackParentBeforeChange(...args),
      resetParentOutline:(p,id)=>this.resetParentOutline(p,id),
      singularityStackAction:s=>{if(this.b.stackParentMap[s.stack_id]?.some(p=>p.from==='SINGULARITY'))this.call('pushSingularityStackAction',s);},
      procUnitEvent:(type,params,value)=>this.procUnitEvent(type,params,value),
      notiCheck:id=>this.notiCheck(id),
      pushRelicAction:(id,on)=>this.relicAction(id,on),
      pushRelicInactive:id=>this.relicInactive(id),
      unregisterStackEvents:s=>this.timing.unregisterStack(s),
      markCondForRemoval:id=>this.markRemoval('pendingCondRemovals',id),
      removeStack:(id,notify)=>this.removeStack(id,notify),
      isMonsterByID:id=>this.getMonster(id)!=null,
      getPassiveByType:args=>this.passives.query(args),
      getUnitByID:id=>this.getUnit(id),
      consumeTriggerTerms:(...args)=>this.consumeTriggerTerms(...args),
      skillStackChange:(p,id)=>this.call('skillStackChange',p,id),
    };
    const conditionRows=this.db.preparedConditionRows?this.db.preparedConditionRows():Object.fromEntries(Object.entries(this.db.table('condition')).map(([id,r])=>[id,{...r,
      stack_restriction_value:this.db.number(r,'stack_restriction_value')} ]));
    this.stacks=new StackLifecycle({worktable:this.wt,conditions:conditionRows,ports:this.ports,enums:this.enums,completeSnapshot:true});
    this.skills=new SkillCallbacks({worktable:this.wt,skills:this.db.table('skill_eff'),ports:this.ports,enums:this.enums});
    this.scheduler=new TriggerScheduler({worktable:this.wt,resources:this.db,ports:this.ports,record:e=>this.record(e)});
    this.timing=new TimingDispatch({worktable:this.wt,resources:this.db,stacks:this.stacks,enums:this.enums,ports:this.ports});
    this.actions=new ActionEntry(this);
    this.reactionSupport=new ReactionSupport(this);
    for(const name of ['checkUniqueChizuru','setSubFinished','finishPyeonrinSub','openPyeonrinSub','releaseLightDarkCombineWaiting','isSkippedAfterBattleEnd'])
      this.ports[name]=(...args)=>this.call(name,...args);
    for(const [k,fn]of Object.entries(ports))if(!Object.hasOwn(this.ports,k))this.ports[k]=(...args)=>fn(this,...args);
    this.reactions=new ReactionLoop({worktable:this.wt,ports:this.ports,record:e=>this.record(e),enums:this.enums});
    this.stateDriver=new StateDriver(this);this.queuedCards=new QueuedCardUses(this);
    this.internal={settleReactions:options=>this.reactions.settle(options),drainQueuedCardUses:()=>this.queuedCards.drain()};
    for(const name of ['setStateMain','setCurrentCard','checkLastActionBlock','procReservedTurnOver','checkGameEndAndReservedTurnOver'])
      this.internal[name]=(...args)=>this.stateDriver[name](...args);
    this.outcome=new OutcomeRuntime(this);this.guards=new RuntimeGuards(this);
    this.bindRuntime(this.outcome,['checkGameEnd','applyFailCountTurnLimit','getFailCountTurnLimit']);
    this.bindRuntime(this.guards,['checkDeads','procInterrupt','checkCoopReserved','flushDeferredLogs','procSingularityTriggeredImmediate']);
    this.bindRuntime(this.guards,['getBattleExecutionGuard']);
    this.lifecycle=new LifecycleRuntime(this);this.effects=new EffectRuntime(this);this.phases=new PhaseRuntime(this);
    this.bindRuntime(this.lifecycle,['applyChangeCS','applyChangeCSPre','checkTermValue','checkTermValuePassive','getCSScopedPassives','resolveCSExtension','resolveCSTermValueChangePassive','removeContinueSkillPre']);
    this.bindRuntime(this.phases,['procMain','checkNextWave','procMonsterUpdate']);
    this.bindRuntime(this.effects,['procTriggeredSkillData','getSkillCardId','setDuring','setCauseDuring','pushHand']);
    for(const name of ['getPassiveByType','getUnitByID','isMonsterByID','pushChangeData','pushAction','addSkillTriggered'])this.internal[name]=(...args)=>this.ports[name](...args);
    this.internal.procEndOfTurn=()=>this.actions.procEndOfTurn();
    this.internal.getContinueSkills=unit=>this.reactionSupport.continueSkills(unit);
    this.logs=new LogRuntime(this);this.bindRuntime(this.logs,['pushBattleLog','pushSubBattleLog','addDetailLog','getLogParamType','getBattleLogType','getDetailLogType']);
    this.turnSupport=new TurnSupportRuntime(this);
    this.bindRuntime(this.turnSupport,['isFieldMonster','isRetiredMonster','sumFieldMonsterTurnCount','getCurrentMonsterCursorPos','setCurrentMonsterCursorPos','resetCurrentMonsterCursor','getCurrentMonster','invalidateMonsterIdIndex','sweepRetiredMonsters','getBaseEnergy','addEnergy','addEnergyTurnBegin','checkEnergyMaintain','buildTurnRecordCharStats','initDptCharStats','pushTurnRecordOffline']);
    this.bindRuntime(this.phases,['turnDiscard','turnDraw','disCardUsedPile','monsterProcPattern','monsterProcPatternPre','monsterPatternGetCard','monsterProcCard','monsterProcCardPre','isAlwaysDamageFatal']);
    this.bindRuntime(this.effects,['getTriggeredList','isHandMaxAmountExceptCard','getHandCardCountForLimit','procMotionSkillTriggered','procMotionSkillTriggeredBody','beginMonsterHitBatch','endMonsterHitBatch','reserveLightDarkDivide','skipTriggeredSkillData']);
    this.bindRuntime(this.lifecycle,['addTermValue','addTermValuePre','removeContinueSkill','removeSkill','removePassiveSkill','removePassiveSkillPre','markCsForRemoval','markSkillForRemoval','unregisterCasterDeadTermCS','procMathSign','isImmediatePassiveCSSkill']);
    this.bindRuntime(this.lifecycle,['procCSTermByTiming','procCSTermByTurnDiscardBefore','procCSTermByTurn','getWholeTermType']);
    this.internal.constantMetagame=id=>this.db.get('constant_meta',id).value;
    // TutorialConstant in tutorial_proc, getRes0x2500/getValueNum0x5e00:
    // absent row is undefined and the carrier value is not coerced.
    this.internal.tutorialConstantValueNum=id=>this.db.table('tutorial_constant_id')[id]?.value_num;
    this.bindRuntime(this.queuedCards,['procCardRepeats']);
    this.events=new EventRuntime(this);this.bindRuntime(this.events,['procUnitEvent','procCardEvent','countCard','setCardTriggered','setTargetTriggered']);
    this.cardMovement=new CardMovementRuntime(this);
    this.bindRuntime(this.cardMovement,['isRecallReservedCard','isShuffleTarget','shuffleArray','pushDeck','getDrawableDeckCards','isRestricted','filterMoveToHandRestrictedCards','procLockHandBlocked','filterLockHandCards','shuffleCard','trimDiscardToLimit','setCardPlace','sortHandCards','moveCards']);
    this.bindRuntime(this.effects,['procSkillEff','procSkillEffs','procSkillEffsPre','procSkillEffPre','getRootParent','getParentCard']);
    this.bindRuntime(this.lifecycle,['checkPassiveSkill','removePassiveSkillBySkillID']);
    this.internal.invalidatePassiveTypeIndex=list=>this.passives.invalidate(list);
    this.internal.pushLog=this.ports.pushLog;
    this.bindRuntime(this.phases,['isCardUninteractible']);
    this.bindRuntime(this.cardMovement,['isCardTestamentMoveLocked','resetExhaustedFlag','procTalentVallista']);
    this.cardState=new CardStateRuntime(this);
    this.bindRuntime(this.cardState,['getTalentByInfo','hasTalent','getCategory','checkCategory','getCost','updateCostResult','cleanupCardResources']);
    this.valueTarget=new ValueTargetRuntime(this);
    this.bindRuntime(this.valueTarget,['calcValue','calcCountValue','calcEffCardTargetCount','calcTargetCardSetListCount','getSavedIndex','getCountValueAdditional','getSkillEffTarget','getTargetCards','getTargetableMonstersID','cardPlace','parseCardCostFilter','applyCardCostFilter','isCardReservedForUse']);
    this.bindRuntime(this.lifecycle,['procAddCS','createContinueSkill','determineOrigin','createSkill','addPassiveSkill','registerCasterDeadTermCS']);
    this.bindRuntime(this.lifecycle,['baseDebuffType','checkActiveRelicCS','tryGetCharByCharId','tryGetStageCharByCharId','increaseOlgaCountOnGiveCS']);
    this.bindRuntime(this.effects,['procSingularityTriggeredImmediate','afterSkillCSCheck','clearInterruptOrderPending','procCSTermDecrement','saveCountValue','resetRandValues','getCardUseDisplaySkillValue','setCardUseDisplaySkillValue']);
    this.bindRuntime(this.effects,['consumeTriggerTerms','getBattleHandMaxCount','checkCardChangePassive']);
    this.cardPost=new CardPostRuntime(this);
    this.bindRuntime(this.cardPost,['checkMissionApply','matchCardPlaceSet','getLockHandPassives','isCollapseOnCharacterByID','isBindExcludedHandCard','getBindGroupBaseResId','getBindGroupKey','checkCardBind','checkRecallReserved','checkOrleaCreation','resolveTalentFairyShield','procTalentFairy']);
    this.bindRuntime(this.cardPost,['checkLightDark','checkLightDarkDivide','checkLightDarkCombine']);
    this.mainPhase=new MainPhaseRuntime(this);this.bindRuntime(this.mainPhase,['mainPhaseMonsterActions','checkSpark','getFatalAttackTarget','checkFatalAttack','isAssaultMode','isDTMode']);
    this.bindRuntime(this.valueTarget,['getAllCardSkillEffIds']);this.bindRuntime(this.effects,['applyCardChangePassive']);
    this.bindRuntime(this.phases,['getBaseDraw']);this.bindRuntime(this.cardPost,['checkLightDarkTurnStart']);
    this.bindRuntime(this.events,['forEachHpMarkEvent','pushHpMark','resolveCondUnitTargetId']);
    this.stackNotifications=new StackNotificationRuntime(this);
    this.bindRuntime(this.stackNotifications,['conditionLog','skillStackChange','pushSingularityStackAction','stackUI1049','conditionUI1049','addCharUniqUIAction']);
    this.playerStart=new PlayerStartRuntime(this);this.bindRuntime(this.playerStart,['refreshRef','shouldRecordTurnInStage','getPassiveByTypeGamecore','recoverEgoBreak','getRageDiff']);
    this.monsterNotifications=new MonsterNotificationRuntime(this);this.bindRuntime(this.monsterNotifications,['removeMonShield','removeShield','pushMonsterNoti','checkGroggy','getStatus','setStatus','refreshMonsterNoti','getKeywordByStatType']);
    this.bindRuntime(this.events,['procCardAmountEvent']);this.bindRuntime(this.mainPhase,['tutorialConstantId','isMainPhase','checkLinkCrash']);
    this.actionFinalize=new ActionFinalizeRuntime(this);this.bindRuntime(this.actionFinalize,['finishBattleActionOffline','checkCards','checkCardAvailable','isCardAvailable','isPlayable','checkTutorialBan','getRitaUniqueAdditionalAP','procCharHpChangedEvent','procUnusablePassives','pushRemoveData','cleanupPendingRemovals','clearActionBlockOnFinish','procStageActions']);
    this.bindRuntime(this.lifecycle,['constantMetagame','constantMetagameSkipError']);
    this.bindRuntime(this.playerStart,['checkLead','addEP','addEPwithCheckPassive']);
    this.bindRuntime(this.playerStart,['procTurnStartStressAction','getCustomStressVal']);
    this.bindRuntime(this.monsterNotifications,['useParent:MONSTER','useParent:MONSTER_PATTERN','removeParent:MONSTER','removeParent:MONSTER_PATTERN','toggleParent:MONSTER','toggleParent:MONSTER_PATTERN','changePhaseTriggered','checkPhaseTriggered','addPhaseTriggered']);
    this.bindRuntime(this.monsterNotifications,['procChangePhase','createMonsterPattern','pushActionPhase','clearUnlockAction']);
    this.stackRegistration=new StackRegistrationRuntime(this);this.bindRuntime(this.stackRegistration,['getEventStack','createEventStack','registUnitEvent','loadGameDBbyKey','getLogicState']);
    this.bindRuntime(this.events,['checkStack','checkCondMap']);
    this.internal.isCardAvailable=(...args)=>this.actionFinalize.isCardAvailableCompatibility(...args);
    this.bindRuntime(this.monsterNotifications,['refreshAlwaysDamage','getBattlePreviewDmgKeys']);
    this.bindRuntime(this.lifecycle,['tryDeferImmediatePassiveCSLog','getLastMeaningfulSub','snapshotNameOverrides']);
    this.internal.procSkillTriggered=(...args)=>this.reactions.procSkills(...args);
    this.ports.procSkillTriggered=(...args)=>this.call('procSkillTriggered',...args);
    this.bindRuntime(this.reactionSupport,['checkUniqueChizuru','setSubFinished','finishPyeonrinSub','openPyeonrinSub','releaseLightDarkCombineWaiting','isSkippedAfterBattleEnd']);
    // Shipped MissionConditionProc.dispatch 0x2200 is LdaUndefined; Return.
    this.internal.missionDispatch=event=>{this.record({kind:'client-noop',method:'MissionConditionProc.dispatch',event});};
    this.damageApplyPreview=new DamageApplyPreviewRuntime(this);this.bindRuntime(this.damageApplyPreview,['procDamageApply']);
    this.bindRuntime(this.effects,['procDamageCalculate','resolveStatSource','getAttrInfo']);
    this.bindRuntime(this.effects,['saveSkillTarget']);
    this.bindRuntime(this.effects,['logEffectDeaths']);
    this.hpSupport=new HpSupportRuntime(this);
    this.bindRuntime(this.hpSupport,['setStatus','accumulateMonsterDamageDpt','resolveDptCharResId','collectMonsterHitSlot','accumulateCardValue','countCardUseKill','saveValue','beginImmediatePassiveCSLogScope','endImmediatePassiveCSLogScope','flushDeferredImmediatePassiveCSLogs','addDisasterScore','addDisasterShieldScore','addDisasterHealScore','addRemnantsScore','applyDisasterPerCardScoreCap','applyRemnantsPerCardScoreCap']);
    this.bindRuntime(this.hpSupport,['getCharOriginMaxHP','accumulateStressDpt','setEgoStress','createBattleStressRecoverAction']);
    this.healShield=new HealShieldRuntime(this);
    this.bindRuntime(this.healShield,['procHealApply','procShieldApply','procShieldExpire','procStressRecoverByCure','isAssaultRiskFactorActive','isShieldDestroyedByDamage','recordShieldDestruction']);
    this.damageApply=new DamageApplyRuntime(this);this.bindRuntime(this.damageApply,['procDamageApply']);
    this.deaths=new DeathRuntime(this);
    this.bindRuntime(this.deaths,['checkDeads','onDeath','procCasterDeadCSTerm','isMultiHpNotKillDead','removeMonsterCsWithCleanup','removeCard','canUseMonsterAsLastBattleEndDeath','isBattleEndLethalDamageEvent','canUseLethalDamageAsLastBattleEndDeath','findLastBattleEndDeathByActionOrder','refreshLastDeadMonsterForBattleEnd']);
    this.internal.procRemoveStack=(...args)=>this.stacks.remove(...args);
    this.bindRuntime(this.actionFinalize,['removeCsWithCleanup']);
    this.bindRuntime(this.outcome,['applyFinishedCondition','finishHardcoreDefeat','pushFinalDptAndTurnRecord','getBattleEndHpSnapshot','removeEndInterruptActions']);
    this.bindRuntime(this.hpSupport,['saveCoeffValue','getAllChars','getTriggerCauseCardId']);
    this.bindRuntime(this.healShield,['procHealCalculate','procShieldCalculate','isAssaultFourthCombatant','getPassiveByTypeGamecoreForChar','getNonBattleEffPctAdd']);
    this.deathStress=new DeathStressRuntime(this);this.bindRuntime(this.deathStress,['isLinkCrashed','getMaxStress','getCollapseRemainCount','getLinkCrashCharScore','pickLinkCrashChar','setLinkCrashOn','getCollapseNeedCount','setCollapseOn','setCollapseOff','checkCollapse','applyHPLinkCrash','recoverLinkCrash','applyLinkCrashRecoveryInfoToBattle','applyLinkCrashRecoveryByBossClear']);
    this.bindRuntime(this.deathStress,['isDuringBattle','addCollapseOnAction','checkStressBeforeAdd','addStressActionArray']);
    this.bindRuntime(this.hpSupport,['getContentCategoryWithIngameContentConfigId','isEventStory','isStory']);
    this.collapseCards=new CollapseCardRuntime(this);this.bindRuntime(this.collapseCards,['onGainCollapseCard','changeToCollapseCard','generateCollapseSequence','checkMinCollapseCards','isCardInDeclaredPlace','getCharByCharId']);
    this.valueAddFilters=new ValueAddFilterRuntime(this);this.bindRuntime(this.valueAddFilters,['checkValueAddOpts','getSort','isCardConnected','hasEgoField','checkCSopts','isTriggerInspiration']);
    this.bindRuntime(this.valueAddFilters,['convertEgoCommon','getTargetTypeByTargetForUI','getCombatantEgo','checkEgo','getEgo','getParameterValueByKeyword','getPlayerInjuryLt','getPlayerViabilityGe','getCurMonsterInjuryLt','getCurMonsterViabilityGe','isInjury','isViability']);
    this.activeCritical=new ActiveCriticalRuntime(this);this.bindRuntime(this.activeCritical,['rollActiveCritical']);
    this.zeroEffects=new ZeroEffRuntime(this);this.bindRuntime(this.zeroEffects,['getFilteredZeroSystemInfoArray','computeWithZeroEff']);
    this.damageStress=new DamageStressRuntime(this);this.bindRuntime(this.damageStress,['procDamageStressAction','calcIncreaseStress','getFilteredPotentialNodeEffectIds']);
    this.clientCards=new ClientCardOutputRuntime(this);this.bindRuntime(this.clientCards,['makeCardInfo','createClientCardInfo','createClientCards']);
    this.valueFacts=new ValueFactRuntime(this);this.bindRuntime(this.valueFacts,['readValueFact','getCostUsed']);
    this.bindRuntime(this.valueFacts.queries,VALUE_QUERY_METHODS);
    this.cardOverwrite=new CardOverwriteRuntime(this);this.bindRuntime(this.cardOverwrite,['addBattleTempCards','checkOverwrite','applyOverwrite']);
    this.cardCreate=new CardCreateRuntime(this);this.bindRuntime(this.cardCreate,['createBattleCard','changeCards','getCards','checkBan','afterChangeCard']);
    this.waveInitialization=new WaveInitializationRuntime(this);this.bindRuntime(this.waveInitialization,['checkNextWaveActive','initMonsters','createMonsterPhase','getMonsterIDfromList','getMonsterEgo','getMonsterStatNerfPct','canApplyKeywordToMonster','getContentCategoryWithIngameContentConfigId','calcMonStatByContent']);
    this.internal['checkNextWave.active']=(...args)=>this.waveInitialization.checkNextWaveActive(...args);
    this.bindRuntime(this.waveInitialization,['applyDefaultBuff','applyGroupDefaultBuff','checkMonsterKeywordNB','applyMonsterStartCSToMonster','applyMonsterStartCS','getPersistMonsterInfo','applyBossInitialStats']);
    this.bindRuntime(this.waveInitialization,['createMonster']);
    this.bindRuntime(this.waveInitialization,['getEncounterStatPct','getFloor','getAddEncounterLevel','getCurrentEncounterLevel']);
    this.bindRuntime(this.waveInitialization,['getMonsterUniqueCards']);
    this.bindRuntime(this.waveInitialization,['getAllCheatKeywords','getCheatKeywordsForSlot','getKeywordListRowsSorted']);
    this.cardEventRegistration=new CardEventRegistrationRuntime(this);this.bindRuntime(this.cardEventRegistration,['registCardEvent']);
    this.unitEventRegistration=new UnitEventRegistrationRuntime(this);
    this.internal['registUnitEvent.other']=(...args)=>this.unitEventRegistration.registUnitEvent(...args);
    this.cardActionSupport=new CardActionSupportRuntime(this);this.bindRuntime(this.cardActionSupport,['redirectLatestCardUseActions','procCSAddSetAuto']);
    this.sharedArithmetic=new SharedArithmeticRuntime(this);this.bindRuntime(this.sharedArithmetic,['getReviseRates','procRevise','procStatType']);
    this.targetSupport=new TargetSupportRuntime(this);this.bindRuntime(this.targetSupport,TARGET_SUPPORT_METHODS);
    this.conditionSupport=new ConditionSupportRuntime(this);this.bindRuntime(this.conditionSupport,CONDITION_SUPPORT_METHODS);
    this.bindRuntime(this.lifecycle,['getStatSource','initSkillEffValue']);
    this.csBalance=new CSBalanceRuntime(this);this.bindRuntime(this.csBalance,CS_BALANCE_METHODS);
    this.internal['getBattleBalanceCSGroupTermValue.active']=(...args)=>this.csBalance.getBattleBalanceCSGroupTermValue(...args);
    this.internal['refreshBattleBalanceCSGroup.active']=(...args)=>this.csBalance.refreshBattleBalanceCSGroup(...args);
    this.csCreation=new CSCreationRuntime(this);this.bindRuntime(this.csCreation,CS_CREATION_METHODS);
    // Legacy helpers call these on their own instance. Route both paths to the
    // same full implementation; never execute the prelude a second time.
    for(const name of ['procAddCS','createContinueSkill','removeContinueSkill'])this.lifecycle[name]=(...args)=>this.csCreation[name](...args);
    this.skillCreation=new SkillCreationRuntime(this);this.bindRuntime(this.skillCreation,['createSkill','isTriggered']);
    this.lifecycle.createSkill=(...args)=>this.skillCreation.createSkill(...args);
    this.passiveLifecycle=new PassiveLifecycleRuntime(this);
    for(const [port,method]of Object.entries(PASSIVE_LIFECYCLE_BINDINGS)){
      this.internal[port]=(...args)=>this.passiveLifecycle[method](...args);
      if(!Object.hasOwn(this.ports,port))this.ports[port]=(...args)=>this.call(port,...args);
    }
    this.dropReward=new DropRewardRuntime(this);this.bindRuntime(this.dropReward,DROP_REWARD_METHODS);
    this.killEffects=new KillEffectRuntime(this);this.bindRuntime(this.killEffects,KILL_EFFECT_METHODS);
    this.cardMechanics=new CardMechanicRuntime(this);this.bindAliases(this.cardMechanics,CARD_MECHANIC_BINDINGS);
    this.bindRuntime(this.hpSupport,['calculateScoreScaling','applyDisasterScoreScaling','applyRemnantsScoreScaling','addDisasterScoreBonus','addRemnantsScoreBonus']);
    this.coreEffects=new CoreEffectRuntime(this);
    this.csEffects=new CSEffectRuntime(this);
    this.bindRuntime(this.csEffects,['getCharIDsOwningCS','recentDrawPassive']);
    this.csTransfers=new CSTransferEffectRuntime(this);this.bindAliases(this.csTransfers,CS_TRANSFER_EFFECT_BINDINGS);
    this.egoEffects=new EgoEffectRuntime(this);this.stressEffects=new StressEffectRuntime(this);
    this.combatants=new CombatantRuntime(this);this.bindAliases(this.combatants,COMBATANT_BINDINGS);
    this.monsterEffects=new MonsterEffectRuntime(this);this.bindAliases(this.monsterEffects,MONSTER_EFFECT_BINDINGS);
    this.characterFactory=new CharacterFactoryRuntime(this);
    this.bindRuntime(this.characterFactory,['addCombatantByCustomData','addCombatantByCustomID','createCombatant','createSupporter','addSupporterByCustomID','calcCharData','refreshStat','refreshTeamStat','computeBattleAtk','getEquipMainStat','addEquipStat','removeEquipmentByID','onRemoveEquipment','addPlayerStatMap','addCharacterStatMap']);
    this.skillPrelude=new SkillPreludeRuntime(this);this.bindAliases(this.skillPrelude,SKILL_PRELUDE_BINDINGS);
    this.skillInterrupts=new SkillInterruptRuntime(this);this.bindAliases(this.skillInterrupts,SKILL_INTERRUPT_BINDINGS);
    this.rewardContext=new RewardContextRuntime(this);this.bindAliases(this.rewardContext,REWARD_CONTEXT_BINDINGS);
    this.cardEffects=new CardEffectRuntime(this);this.bindAliases(this.cardEffects,CARD_EFFECT_BINDINGS);
    this.triggeredMotion=new TriggeredMotionRuntime(this);this.bindAliases(this.triggeredMotion,TRIGGERED_MOTION_BINDINGS);
    this.diagnostics=new NativeDiagnosticsRuntime(this);this.bindRuntime(this.diagnostics,['contentError','ContentError','ResourceError']);
    this.selection=new SelectionRuntime(this);this.bindAliases(this.selection,SELECTION_BINDINGS);
    this.stackParents=new StackParentRuntime(this);this.bindAliases(this.stackParents,STACK_PARENT_BINDINGS);
    this.playerUseShared=new PlayerUseSharedRuntime(this);this.bindAliases(this.playerUseShared,PLAYER_USE_SHARED_BINDINGS);
    this.playerUse=new PlayerUseRuntime(this);this.bindAliases(this.playerUse,PLAYER_USE_BINDINGS);
    this.playerRepeatUse=new PlayerRepeatUseRuntime(this);this.bindAliases(this.playerRepeatUse,PLAYER_REPEAT_USE_BINDINGS);
    this.playerCommands=new PlayerCommandRuntime(this);this.bindAliases(this.playerCommands,PLAYER_COMMAND_BINDINGS);
    this.playerEp=new PlayerEpCommandRuntime(this);this.bindAliases(this.playerEp,PLAYER_EP_COMMAND_BINDINGS);
    this.playerSparkCommands=new PlayerSparkCommandRuntime(this);this.bindAliases(this.playerSparkCommands,PLAYER_SPARK_COMMAND_BINDINGS);
    this.playerPreview=new PlayerPreviewRuntime(this);this.bindAliases(this.playerPreview,PLAYER_PREVIEW_BINDINGS);
    this.playerAuto=new PlayerAutoCommandRuntime(this);this.bindAliases(this.playerAuto,PLAYER_AUTO_COMMAND_BINDINGS);
    this.bindRuntime(this.turnSupport,['isMonsterTurnCountSourceFromRelic','getMonsterTurnCountBlockPassives','checkMonsterTurnCountBlockPassiveRunPct','checkMonsterTurnCountBlockedByPassives','checkMonsterTurnCountBlocked','clearTempEpSkill']);
    this.bindRuntime(this.playerStart,['useEP']);
    this.bindRuntime(this.logs,['getUnitByExactID','snapshotNameOverrides','setUnitNameOverride']);
    this.bindRuntime(this.logs,['clearUnitNameOverride']);
    this.bindRuntime(this.deaths,['onBossModeDeath','isBossModeTargetMonster']);
    this.internal['snapshotNameOverrides.active']=(...args)=>this.logs.snapshotNameOverrides(...args);
    this.bindRuntime(this.outcome,['hpRatio','customFinishType','getRemnantsBossPenaltyTurnLimit','getDisasterBossRankTurnLimit']);
    this.bindRuntime(this.outcome,['createBattleCustomFinish','runEncounterCustomFinish']);
    this.internal.clearTempEpSkill=(remove=false)=>this.turnSupport.clearTempEpSkill(this.wt,remove);
    this.bindRuntime(this.turnSupport,['addTiperaIconAction','procStageActionBalloon']);
    this.bindRuntime(this.deathStress,['checkCharacterCollapsed','hasCollapsedCharacter','applyStoryTutorialBattleRecovery']);
    this.internal.shuffleInPlace=(type,array)=>resdbShuffle(array,()=>this.random.nextInt(type)/2147483647);
    this.ports.shuffleInPlace=(...args)=>this.call('shuffleInPlace',...args);
    this.internal.getExecutionHost=()=>this.executionHost;
    this.activeRootBindings=bindActiveRoots(this);
  }
  replaceBattleForPreview(battle){if(!battle||typeof battle!=='object')throw new MissingBattleRule('preview.battleReplacement');this.wt.battle=battle;}
  // The preview executor is discarded after adoption. Transfer its owned graph
  // while retaining active WT wrappers; the reference path still deep-copies.
  adoptPreviewSideState(sideState){adoptPreviewSideState(this,sideState,this.previewStateTransfer);}
  bindRuntime(runtime,names){for(const name of names){this.internal[name]=(...args)=>runtime[name](...args);if(!Object.hasOwn(this.ports,name))this.ports[name]=(...args)=>this.call(name,...args);}}
  bindAliases(runtime,bindings){for(const [port,method]of Object.entries(bindings)){this.internal[port]=(...args)=>runtime[method](...args);if(!Object.hasOwn(this.ports,port))this.ports[port]=(...args)=>this.call(port,...args);}}
  record(e){if((this.captureDiagnostics?this.trace.length:this.eventCount++)>=20000)throw new MissingBattleRule('offline_event_budget');if(this.captureDiagnostics)this.trace.push(e);}
  getMonster(id){return this.b.monsters.find(m=>m.id===id)??this.b.retired_monsters.find(m=>m.id===id);}
  getUnit(id,skip=false){
    const init=this.state.worktables?.BattleInitWorktable,stage=this.state.worktables?.BattleStageWorktable;
    if(id==-1||id==this.b.char.id||this.b.chars.some(c=>c.id==id))return this.b.char;
    if(!init?.battle_init?.sups)throw new MissingBattleRule('BattleInitWorktable.battle_init.sups');
    if(init.battle_init.sups.some(c=>c&&c.id==id)||(this.b.assault_fourth_char&&this.b.assault_fourth_char.id==id))return this.b.char;
    const monster=this.getMonster(id);if(monster)return monster;
    if(id in this.b.cardMap)return this.b.char;
    if(skip)return undefined;
    if(!stage?.battle_stage?.equipments)throw new MissingBattleRule('BattleStageWorktable.battle_stage.equipments');
    if(stage.battle_stage.equipments.find(e=>e.id==id))return this.b.char;
    throw new MissingBattleRule('invalid_unit_id',{id});
  }
  pushChangeData(kind,id){
    if(this.wt.isPreview)return;
    if(kind in this.wt.changeMap){if(!this.wt.changeMap[kind].includes(id))this.wt.changeMap[kind].push(id);}
    else this.wt.changeMap[kind]=[id];
    this.record({kind:'changed',objectType:kind,id});
  }
  pushAction(action,prev){
    action.byCard=action.byCard??this.wt.byCard;
    action.target_effect_off=this.wt.target_effect_off;
    if(this.b.current_card_use_action?.by_opening&&action.type!=='action_player_card_use'&&
      action.action_card?.place_to!==2&&action.action_card_new?.place_to!==2)action.skip_action=true;
    this.record({kind:'action',type:action.type,id:action.id,source_id:action.source_id});
    if(this.wt.deferredActions){this.wt.deferredActions.push(action);return -1;}
    if(this.wt.tempActions!=null){this.wt.tempActions.push(action);return -1;}
    if(this.b.action_blocks.length){this.b.action_blocks.at(-1).actions.push(action);return action.id;}
    const id=this.b.state_id++;
    this.b.action_blocks.push({state:0,actions:[action],id,prev,turn:this.b.turn});return id;
  }
  relicAction(stackId,on){
    const ready=stackId in this.b.relicReadyMap;
    if(!ready&&!(stackId in this.b.relicLoopMap))return;
    const map=ready?this.b.relicReadyMap:this.b.relicLoopMap;
    const type=ready?(on?'action_relic_ready':'action_relic_ready_off'):(on?'action_relic_loop':'action_relic_loop_end');
    this.pushAction({id:this.b.last_action_id++,type,source_id:map[stackId]});
  }
  relicInactive(stackId){
    const ready=stackId in this.b.relicReadyMap;
    if(!ready&&!(stackId in this.b.relicLoopMap))return;
    const map=ready?this.b.relicReadyMap:this.b.relicLoopMap;
    this.pushAction({id:this.b.last_action_id++,type:'action_relic_inactive',source_id:map[stackId],action_relic:this.b.stackMap[stackId].stack});
    this.b.stackParentMap[stackId].forEach(p=>{
      if(p.from!=='SKILL')return;
      const s=this.b.skillMap[p.parent_id];if(s?.parent?.type!=='CS')return;
      const cs=this.b.csMap[s.parent.id];if(!cs)return;
      if(this.db.get('cs',cs.res_id).cs_durationstage==='YES')this.b.stage_actions.push({type:'relic',id:map[stackId]});
    });
  }
  call(name,...args){
    if(typeof this.extensions[name]==='function')return this.extensions[name](this,...args);
    if(Object.hasOwn(this.internal??{},name))return this.internal[name](...args);
    const fn=this.extensions[name];if(typeof fn!=='function')throw new MissingBattleRule(name,{args});return fn(this,...args);
  }
  markRemoval(field,id){const list=this.b[field]??(this.b[field]=[]);if(!list.includes(id))list.push(id);}
  consumeTriggerTerms(cs,skill,types,value,last){
    // All condition forms, including numeric suffix forms, require the full
    // duration handler. Other types have no consumption in addSkillTriggered.
    if(types.some(t=>t==='TERM_VALUE_TRIGGERED'||t.startsWith('TERM_CONDITION')))
      this.call('consumeTriggerTerms',cs,skill,types,value,last);
  }
  useParent(parent,id,value){
    return this.call('useStackParent',parent,id,value);
  }
  toggleParent(parent,id,on){
    return this.call('toggleStackParent',parent,id,on);
  }
  stackParentBeforeChange(parent,id,input,set,onRegist){
    if(parent.from!=='SKILL'||parent.useType!=='VALUECOUNT')return;
    const skill=this.b.skillMap[parent.parent_id],card=this.b.cardMap[skill.parent.id];
    if(card==null||card.handOutline==null||!(id in card.handOutline))return;
    card.handOutline[id]=true;this.ports.pushChangeData('card',card.id);
    const stack=this.b.stackMap[id];
    if(!set&&!onRegist&&input>0&&card.card_place===2&&(stack.stack_value<0||stack.stack<stack.stack_value))
      this.pushAction({id:this.b.last_action_id++,type:'action_card_highlight',source_id:card.id,action_card_property:{card:card.id}});
  }
  resetParentOutline(parent,id){
    if(parent.from!=='SKILL'||parent.useType!=='VALUECOUNT')return;
    const skill=this.b.skillMap[parent.parent_id];if(skill.parent.type!=='CARD')return;
    const card=this.b.cardMap[skill.parent.id];
    if(card!=null&&card.handOutline!=null&&id in card.handOutline){card.handOutline[id]=false;this.ports.pushChangeData('card',card.id);}
  }
  notiCheck(id){
    const stack=this.b.stackMap[id];if(stack==null)return;
    const monsters={};
    for(const m of this.b.monsters)if(!['death','run','changed','prop'].includes(m.state)&&m.nextCard)monsters[this.b.monsterCards[m.id+m.nextCard]]=m;
    this.b.stackParentMap[stack.stack_id]?.forEach(p=>{
      if(p.from==='SKILL'){
        const s=this.b.skillMap[p.parent_id];if(s!=null&&s.parent.type==='CARD'&&s.parent.id in monsters)this.call('refreshMonsterNoti');
      }else if(p.from==='CARD'&&p.parent_id in monsters)this.call('refreshMonsterNoti');
    });
  }
  removeStack(id,notify=true){
    const s=this.b.stackMap[id];if(s==null||s.permanent)return;
    s.inactive=true;
    this.b.stackParentMap[s.stack_id].forEach(p=>{
      this.call('removeStackParent',p);
    });
    if(notify){this.markRemoval('pendingStackRemovals',id);if(id in this.b.relicStackMap)delete this.b.relicStackMap[id];}
  }
  procUnitEvent(type,params,value){
    // Even absent listeners may cause cross-event dispatch; only known general
    // no-listener cases return early. Remaining suite integration is explicit.
    if(type==='CONDITION_CHAR_ENERGY'||['CONDITION_CHAR_CS_TERM_VALUE_SET','CONDITION_OWN_CHAR_CS_TERM_VALUE_SET'].includes(type))
      return this.call('procUnitEvent',type,params,value);
    if(!this.b.eventMaps.unitEventMap[type]?.length)return;
    return this.call('procUnitEvent',type,params,value);
  }
  dispatchTiming(timing){
    if(!Number.isInteger(timing)||!Object.hasOwn(this.enums.LogicState,timing))throw new MissingBattleRule('invalid_timing',{timing});
    this.timing.procTiming(timing);
  }
  fork(){if(this.pendingCardFinalization)throw Error('Finalize pending card before branching');return new OfflineExecutor({state:this.state,resources:this.db,enums:this.enums,ports:this.extensions,valueTextLocale:this.valueTextLocale,executionHost:this.executionHost,previewStateTransfer:this.previewStateTransfer,captureDiagnostics:this.captureDiagnostics,fastBranches:this.fastBranches});}
  completeDeferredAction(){
    const opts=this.pendingCardFinalization;
    if(!opts)throw Error('No deferred card finalization');
    this.pendingCardFinalization=undefined;
    const output=this.actionFinalize.handleBattleEndOffline(opts);
    const last=this.b.user_actions.at(-1);if(last)last.seed=this.state.randoms.get(0).state;
    return output;
  }
  attempt(operation,{deferCardPreview=false}={}){
    const branch=this.fork();
    branch.deferCardPreview=deferCardPreview&&operation.type==='card_use';
    try{
      let response;
      if(operation.type==='dispatch_timing')branch.dispatchTiming(operation.timing);
      else if(operation.type==='enqueue')branch.scheduler.add(...operation.args);
      else if(PLAYER_COMMAND_TYPES.includes(operation.type))response=branch.call('executePlayerCommand',operation);
      else if(operation.type==='settle_reactions')branch.reactions.settle(operation.options);
      else throw new MissingBattleRule('unknown_operation',{operation});
      return {ok:true,scope:'Explicit operation execution; no action search or optimality claim',response,branch,trace:branch.trace};
    }catch(error){
      return {ok:false,blocked:{name:error.name,rule:error.rule??error.path??error.message,context:error.context,code:error.code,details:error.details},trace:branch.trace,
        discardedBranch:true};
    }
  }
}
