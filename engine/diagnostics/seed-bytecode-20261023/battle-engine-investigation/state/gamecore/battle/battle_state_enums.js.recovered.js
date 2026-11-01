function anonymous_1() {
  // Bytecode 0xf00000000100 params=1 regs=4 frame=32
  let ACCU;
  let r0, r1, r2, r3;

  function anonymous_2(arg0) {
    // Bytecode 0xf00000000600 params=2 regs=3 frame=24
    arg0.TIMING_NONE = 0
    arg0[0] = "TIMING_NONE"
    arg0.TIMING_TACTIC_SKILL_BEFORE = 1
    arg0[1] = "TIMING_TACTIC_SKILL_BEFORE"
    arg0.TIMING_TACTIC_SKILL = 2
    arg0[2] = "TIMING_TACTIC_SKILL"
    arg0.TIMING_BATTLE_START = 3
    arg0[3] = "TIMING_BATTLE_START"
    arg0.TIMING_BATTLE_BEFORE_FIRST_TURN = 4
    arg0[4] = "TIMING_BATTLE_BEFORE_FIRST_TURN"
    arg0.TIMING_PLAYER_SEQUENCE_START = 5
    arg0[5] = "TIMING_PLAYER_SEQUENCE_START"
    arg0.TIMING_TURN_BEGIN = 6
    arg0[6] = "TIMING_TURN_BEGIN"
    arg0.TIMING_DRAW_BEFORE = 7
    arg0[7] = "TIMING_DRAW_BEFORE"
    arg0.TIMING_DRAW_AFTER = 8
    arg0[8] = "TIMING_DRAW_AFTER"
    arg0.TIMING_ADD_ENERGY_AFTER = 9
    arg0[9] = "TIMING_ADD_ENERGY_AFTER"
    arg0.TIMING_USE_CARD_BEFORE = 10
    arg0[10] = "TIMING_USE_CARD_BEFORE"
    arg0.TIMING_USE_CARD_AFTER = 11
    arg0[11] = "TIMING_USE_CARD_AFTER"
    arg0.TIMING_SKILL_EFF_AFTER = 12
    arg0[12] = "TIMING_SKILL_EFF_AFTER"
    arg0.TIMING_USE_CARD_FINISH = 13
    arg0[13] = "TIMING_USE_CARD_FINISH"
    arg0.TIMING_TURN_OVER_DISCARD_BEFORE = 14
    arg0[14] = "TIMING_TURN_OVER_DISCARD_BEFORE"
    arg0.TIMING_TURN_OVER_DISCARD_AFTER = 15
    arg0[15] = "TIMING_TURN_OVER_DISCARD_AFTER"
    arg0.TIMING_TURN_OVER_FINISH = 16
    arg0[16] = "TIMING_TURN_OVER_FINISH"
    arg0.TIMING_MON_SEQUENCE_START = 17
    arg0[17] = "TIMING_MON_SEQUENCE_START"
    arg0.TIMING_MON_TURN_BEGIN = 18
    arg0[18] = "TIMING_MON_TURN_BEGIN"
    arg0.TIMING_MON_USE_CARD_BEFORE = 19
    arg0[19] = "TIMING_MON_USE_CARD_BEFORE"
    arg0.TIMING_MON_USE_CARD_AFTER = 20
    arg0[20] = "TIMING_MON_USE_CARD_AFTER"
    arg0.TIMING_MON_SKILL_EFF_AFTER = 21
    arg0[21] = "TIMING_MON_SKILL_EFF_AFTER"
    arg0.TIMING_MON_TURN_OVER_FINISH = 22
    arg0[22] = "TIMING_MON_TURN_OVER_FINISH"
    arg0.Draw = 23
    arg0[23] = "Draw"
    arg0.AddEnergy = 24
    arg0[24] = "AddEnergy"
    arg0.MainPhase = 25
    arg0[25] = "MainPhase"
    arg0.MainPhaseAutoAvailable = 26
    arg0[26] = "MainPhaseAutoAvailable"
    arg0.PreBattle = 27
    arg0[27] = "PreBattle"
    arg0.Discard = 28
    arg0[28] = "Discard"
    arg0.CardInterrupt = 29
    arg0[29] = "CardInterrupt"
    arg0.EventInterrupt = 30
    arg0[30] = "EventInterrupt"
    arg0.Stress = 31
    arg0[31] = "Stress"
    arg0.EgoExpandGauge = 32
    arg0[32] = "EgoExpandGauge"
    arg0.proc_death_event = 33
    arg0[33] = "proc_death_event"
    arg0.TIMING_BATTLE_END = 34
    arg0[34] = "TIMING_BATTLE_END"
    arg0.Win = 35
    arg0[35] = "Win"
    arg0.Lose = 36
    arg0[36] = "Lose"
    arg0.PreLose = 37
    arg0[37] = "PreLose"
    arg0.BATTLE_NEXT_ENCOUNTER = 38
    arg0[38] = "BATTLE_NEXT_ENCOUNTER"
    arg0.BATTLE_NEXT_LOADING_STEP = 39
    arg0[39] = "BATTLE_NEXT_LOADING_STEP"
    arg0.SKIP_BATTLE_NEXT_ENCOUNTER = 40
    arg0[40] = "SKIP_BATTLE_NEXT_ENCOUNTER"
    arg0.HYPERSPACE_NEXT_BATTLE = 41
    arg0[41] = "HYPERSPACE_NEXT_BATTLE"
    arg0.DISASTER_BOSS_RANK_NEXT_BATTLE = 42
    arg0[42] = "DISASTER_BOSS_RANK_NEXT_BATTLE"
    arg0.COMBATANT_TRIAL_NEXT_BATTLE = 43
    arg0[43] = "COMBATANT_TRIAL_NEXT_BATTLE"
    arg0.AFTER_BATTLE_END = 999
    arg0[999] = "AFTER_BATTLE_END"
    return arg0
  }
  // Explicit control flow preserves exception completion and nested jumps.
  let __v8_pc = 0;
  dispatch: while (true) {
    switch (__v8_pc) {
    case 0: {
      // SwitchOnGeneratorState r0
      r2 = closure
      r3 = this
      ACCU = CreateJSGeneratorObject(r2, r3)
      r0 = ACCU
      // SuspendGenerator r0, state=0
      ACCU = ResumeGenerator(r0)
      r2 = ACCU
      ACCU = GeneratorGetResumeMode(r0)
      switch (ACCU) {
      case 0:
        __v8_pc = 39;
        continue dispatch;
      case 1:
        __v8_pc = 36;
        continue dispatch;
      }
      __v8_pc = 33;
      continue dispatch;
    }
    case 33: {
      ACCU = r2
      throw ACCU
    }
    case 36: {
      ACCU = r2
      return ACCU
    }
    case 39: {
      r1 = r2
      ACCU = anonymous_2
      r2 = ACCU
      ACCU = {}
      r3 = ACCU
      ACCU = r2(r3)
      // WARNING: unsupported bytecode StaModuleVariable [1], [0] @53
      ACCU = r1
      return ACCU
    }
    }
  }
}
