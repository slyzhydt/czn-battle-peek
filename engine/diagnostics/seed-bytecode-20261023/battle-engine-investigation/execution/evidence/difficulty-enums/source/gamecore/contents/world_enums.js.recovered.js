function anonymous_1() {
  // Bytecode 0xf00000000100 params=1 regs=4 frame=32
  let ACCU;
  let r0, r1, r2, r3;

  function anonymous_2(arg0) {
    // Bytecode 0xf00000000700 params=2 regs=0 frame=0
    arg0.BREAK_TYPE_CHAR_CARD_DMG_SHIELD_CURE_VALUE_HUND_ADD_PCT = "BREAK_TYPE_CHAR_CARD_DMG_SHIELD_CURE_VALUE_HUND_ADD_PCT"
    arg0.BREAK_TYPE_BATTLE_CS_ADD = "BREAK_TYPE_BATTLE_CS_ADD"
    arg0.BREAK_TYPE_BATTLE_CS_ADD_OVERWRITE = "BREAK_TYPE_BATTLE_CS_ADD_OVERWRITE"
    arg0.BREAK_TYPE_CARD_R_SPARK = "BREAK_TYPE_CARD_R_SPARK"
    arg0.BREAK_TYPE_BATTLE_CS_CHANGE = "BREAK_TYPE_BATTLE_CS_CHANGE"
    arg0.BREAK_TYPE_POTENTIAL_LEVEL_UP = "BREAK_TYPE_POTENTIAL_LEVEL_UP"
    return arg0
  }

  function anonymous_3(arg0) {
    // Bytecode 0xf00000002000 params=2 regs=0 frame=0
    arg0.NONE = "NONE"
    arg0.DIFFICULTY_LEVEL_1 = "DIFFICULTY_LEVEL_1"
    arg0.DIFFICULTY_LEVEL_2 = "DIFFICULTY_LEVEL_2"
    arg0.DIFFICULTY_LEVEL_3 = "DIFFICULTY_LEVEL_3"
    arg0.DIFFICULTY_LEVEL_4 = "DIFFICULTY_LEVEL_4"
    arg0.DIFFICULTY_LEVEL_5 = "DIFFICULTY_LEVEL_5"
    arg0.DIFFICULTY_LEVEL_6 = "DIFFICULTY_LEVEL_6"
    arg0.DIFFICULTY_LEVEL_7 = "DIFFICULTY_LEVEL_7"
    arg0.DIFFICULTY_LEVEL_8 = "DIFFICULTY_LEVEL_8"
    arg0.DIFFICULTY_LEVEL_9 = "DIFFICULTY_LEVEL_9"
    arg0.DIFFICULTY_LEVEL_10 = "DIFFICULTY_LEVEL_10"
    arg0.DIFFICULTY_LEVEL_11 = "DIFFICULTY_LEVEL_11"
    arg0.DIFFICULTY_LEVEL_12 = "DIFFICULTY_LEVEL_12"
    arg0.DIFFICULTY_LEVEL_13 = "DIFFICULTY_LEVEL_13"
    arg0.DIFFICULTY_LEVEL_14 = "DIFFICULTY_LEVEL_14"
    arg0.DIFFICULTY_LEVEL_15 = "DIFFICULTY_LEVEL_15"
    arg0.DIFFICULTY_LEVEL_16 = "DIFFICULTY_LEVEL_16"
    arg0.DIFFICULTY_LEVEL_17 = "DIFFICULTY_LEVEL_17"
    arg0.DIFFICULTY_LEVEL_18 = "DIFFICULTY_LEVEL_18"
    arg0.DIFFICULTY_LEVEL_19 = "DIFFICULTY_LEVEL_19"
    arg0.DIFFICULTY_LEVEL_20 = "DIFFICULTY_LEVEL_20"
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
      ACCU = [3]
      r2 = ACCU
      r3 = closure
      ACCU = StringReplaceNonGlobalRegExpWithFunction(r2, r3)
      ACCU = r0
      // SuspendGenerator r0, state=0
      ACCU = ResumeGenerator(r0)
      r2 = ACCU
      ACCU = GeneratorGetResumeMode(r0)
      switch (ACCU) {
      case 0:
        __v8_pc = 52;
        continue dispatch;
      case 1:
        __v8_pc = 49;
        continue dispatch;
      }
      __v8_pc = 46;
      continue dispatch;
    }
    case 46: {
      ACCU = r2
      throw ACCU
    }
    case 49: {
      ACCU = r2
      return ACCU
    }
    case 52: {
      r1 = r2
      ACCU = anonymous_2
      r2 = ACCU
      ACCU = {}
      r3 = ACCU
      ACCU = r2(r3)
      // WARNING: unsupported bytecode StaModuleVariable [1], [0] @66
      ACCU = anonymous_3
      r2 = ACCU
      ACCU = {}
      r3 = ACCU
      ACCU = r2(r3)
      // WARNING: unsupported bytecode StaModuleVariable [2], [0] @80
      ACCU = {  }
      r2 = ACCU
      ACCU = "NONE"
      r3 = ACCU
      ACCU = -1
      define_literal_property(r2, r3, ACCU, false, true)
      ACCU = "DIFFICULTY_LEVEL_1"
      r3 = ACCU
      ACCU = 1
      define_literal_property(r2, r3, ACCU, false, true)
      ACCU = "DIFFICULTY_LEVEL_2"
      r3 = ACCU
      ACCU = 2
      define_literal_property(r2, r3, ACCU, false, true)
      ACCU = "DIFFICULTY_LEVEL_3"
      r3 = ACCU
      ACCU = 3
      define_literal_property(r2, r3, ACCU, false, true)
      ACCU = "DIFFICULTY_LEVEL_4"
      r3 = ACCU
      ACCU = 4
      define_literal_property(r2, r3, ACCU, false, true)
      ACCU = "DIFFICULTY_LEVEL_5"
      r3 = ACCU
      ACCU = 5
      define_literal_property(r2, r3, ACCU, false, true)
      ACCU = "DIFFICULTY_LEVEL_6"
      r3 = ACCU
      ACCU = 6
      define_literal_property(r2, r3, ACCU, false, true)
      ACCU = "DIFFICULTY_LEVEL_7"
      r3 = ACCU
      ACCU = 7
      define_literal_property(r2, r3, ACCU, false, true)
      ACCU = "DIFFICULTY_LEVEL_8"
      r3 = ACCU
      ACCU = 8
      define_literal_property(r2, r3, ACCU, false, true)
      ACCU = "DIFFICULTY_LEVEL_9"
      r3 = ACCU
      ACCU = 9
      define_literal_property(r2, r3, ACCU, false, true)
      ACCU = "DIFFICULTY_LEVEL_10"
      r3 = ACCU
      ACCU = 10
      define_literal_property(r2, r3, ACCU, false, true)
      ACCU = "DIFFICULTY_LEVEL_11"
      r3 = ACCU
      ACCU = 11
      define_literal_property(r2, r3, ACCU, false, true)
      ACCU = "DIFFICULTY_LEVEL_12"
      r3 = ACCU
      ACCU = 12
      define_literal_property(r2, r3, ACCU, false, true)
      ACCU = "DIFFICULTY_LEVEL_13"
      r3 = ACCU
      ACCU = 13
      define_literal_property(r2, r3, ACCU, false, true)
      ACCU = "DIFFICULTY_LEVEL_14"
      r3 = ACCU
      ACCU = 14
      define_literal_property(r2, r3, ACCU, false, true)
      ACCU = "DIFFICULTY_LEVEL_15"
      r3 = ACCU
      ACCU = 15
      define_literal_property(r2, r3, ACCU, false, true)
      ACCU = "DIFFICULTY_LEVEL_16"
      r3 = ACCU
      ACCU = 16
      define_literal_property(r2, r3, ACCU, false, true)
      ACCU = "DIFFICULTY_LEVEL_17"
      r3 = ACCU
      ACCU = 17
      define_literal_property(r2, r3, ACCU, false, true)
      ACCU = "DIFFICULTY_LEVEL_18"
      r3 = ACCU
      ACCU = 18
      define_literal_property(r2, r3, ACCU, false, true)
      ACCU = "DIFFICULTY_LEVEL_19"
      r3 = ACCU
      ACCU = 19
      define_literal_property(r2, r3, ACCU, false, true)
      ACCU = "DIFFICULTY_LEVEL_20"
      r3 = ACCU
      ACCU = 20
      define_literal_property(r2, r3, ACCU, false, true)
      ACCU = r2
      // WARNING: unsupported bytecode StaModuleVariable [3], [0] @300
      ACCU = r1
      return ACCU
    }
    }
  }
}
