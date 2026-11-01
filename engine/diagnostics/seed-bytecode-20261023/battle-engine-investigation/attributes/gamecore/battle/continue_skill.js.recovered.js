function anonymous_1() {
  // Bytecode 0xf00000000100 params=1 regs=6 frame=48
  let ACCU;
  let r0, r1, r2, r3, r4;
  function parseTermSuffixNumber(arg0, arg1, arg2) {
    // Bytecode 0xf00000000600 params=4 regs=7 frame=56
    let ACCU;
    let r0, r1, r2, r3, r4, r5;
    r0 = (arg1 + "_")
    ACCU = arg0
    ACCU = isUndetectable(ACCU)
    if (!(truthy(ACCU))) {
      ACCU = arg0.startsWith(r0)
      if (!(truthy(ACCU))) {
        return null
      }
    }
    else {
      return null
    }
    r1 = arg0.slice(r0.length)
    r2 = r1.endsWith
    ACCU = context_slot[3]
    ACCU = checked_lexical(ACCU, "TERM_FINALLY_SUFFIX")
    r4 = ACCU
    if (truthy(r2.call(r1, r4))) {
      if (!truthy(arg2)) {
        return null
      }
      r2 = r1.slice
      r5 = r1.length
      r5 -= context_slot[3].length
      ACCU = r2.call(r1, 0, r5)
      r1 = ACCU
    }
    r3 = new RegExp("^[0-9]+$", "")
    if (!truthy(r3.test(r1))) {
      return null
    }
    return parseInt(r1, 10)
  }
  function parseTermDelta(arg0, arg1, arg2) {
    // Bytecode 0xf0000000a700 params=4 regs=5 frame=40
    let ACCU;
    let r0;
    r0 = context_slot[4](arg0, arg1, arg2)
    if (!truthy(isUndetectable(r0))) {
      ACCU = 1
      ACCU = (r0 < ACCU)
      if (truthy(ACCU)) {
        return null
      }
    }
    else {
      return null
    }
    return r0
  }
  function parseTermPct(arg0, arg1, arg2) {
    // Bytecode 0xf0000000ad00 params=4 regs=5 frame=40
    let r0;
    r0 = context_slot[4](arg0, arg1, arg2)
    if (truthy(isUndetectable(r0))) {
      return null
    }
    if (r0 > 100) {
      return 100
    }
    return r0
  }
  function anonymous_2(arg0) {
    // Bytecode 0xf00000005200 params=2 regs=0 frame=0
    arg0.OWN_TEAM = "OWN_TEAM"
    arg0.OWN_CHAR = "OWN_CHAR"
    arg0.OWN_CASTER = "OWN_CASTER"
    arg0.OWN_CHAR_EFF_TEAM = "OWN_CHAR_EFF_TEAM"
    return arg0
  }
  function anonymous_3(arg0) {
    // Bytecode 0xf00000005d00 params=2 regs=0 frame=0
    arg0.CS_BUFF = "CS_BUFF"
    arg0.CS_DEBUFF = "CS_DEBUFF"
    arg0.CS_DEBUFF_DOT = "CS_DEBUFF_DOT"
    arg0.CS_NEUTRAL = "CS_NEUTRAL"
    arg0.CS_BUFF_DEBUFF = "CS_BUFF_DEBUFF"
    arg0.CS_COLLAPSE = "CS_COLLAPSE"
    return arg0
  }
  function anonymous_4(arg0) {
    // Bytecode 0xf00000007800 params=2 regs=0 frame=0
    arg0.TERM_NONE = "TERM_NONE"
    arg0.TERM_BATTLE = "TERM_BATTLE"
    arg0.TERM_EFF = "TERM_EFF"
    arg0.TERM_TURN_VALUE = "TERM_TURN_VALUE"
    arg0.TERM_TURN_VALUE_WHOLE = "TERM_TURN_VALUE_WHOLE"
    arg0.TERM_TURN_VALUE_DISCARD_BEFORE = "TERM_TURN_VALUE_DISCARD_BEFORE"
    arg0.TERM_TURN_VALUE_DISCARD_BEFORE_WHOLE = "TERM_TURN_VALUE_DISCARD_BEFORE_WHOLE"
    arg0.TERM_ATTACKED = "TERM_ATTACKED"
    arg0.TERM_EFF_WHOLE = "TERM_EFF_WHOLE"
    arg0.TERM_TAKE_DAMAGE = "TERM_TAKE_DAMAGE"
    arg0.TERM_CASTER_DEAD_WHOLE = "TERM_CASTER_DEAD_WHOLE"
    arg0.TERM_CARD_MOVE = "TERM_CARD_MOVE"
    arg0.TERM_CARD_MOVE_TO_DECK = "TERM_CARD_MOVE_TO_DECK"
    arg0.TERM_CARD_USE_WHOLE = "TERM_CARD_USE_WHOLE"
    arg0.TERM_ANY_CARD_USE = "TERM_ANY_CARD_USE"
    arg0.TERM_ANY_OWN_CARD_USE = "TERM_ANY_OWN_CARD_USE"
    arg0.TERM_PASSIVE = "TERM_PASSIVE"
    arg0.TERM_PASSIVE_FINALLY = "TERM_PASSIVE_FINALLY"
    arg0.TERM_PASSIVE_WHOLE = "TERM_PASSIVE_WHOLE"
    arg0.TERM_PASSIVE_WHOLE_FINALLY = "TERM_PASSIVE_WHOLE_FINALLY"
    arg0.TERM_PASSIVE_IMMEDIATLEY = "TERM_PASSIVE_IMMEDIATLEY"
    arg0.TERM_PASSIVE_IMMEDIATLEY_WHOLE = "TERM_PASSIVE_IMMEDIATLEY_WHOLE"
    arg0.TERM_PASSIVE_IMMEDIATLEY_FINALLY = "TERM_PASSIVE_IMMEDIATLEY_FINALLY"
    arg0.TERM_CONDITION = "TERM_CONDITION"
    arg0.TERM_CONDITION_WHOLE = "TERM_CONDITION_WHOLE"
    arg0.TERM_CONDITION_FINALLY = "TERM_CONDITION_FINALLY"
    arg0.TERM_CONDITION_WHOLE_FINALLY = "TERM_CONDITION_WHOLE_FINALLY"
    arg0.TERM_CONDITION_HALF = "TERM_CONDITION_HALF"
    arg0.TERM_CONDITION_HALF_FINALLY = "TERM_CONDITION_HALF_FINALLY"
    arg0.TERM_CONDITION_PCT = "TERM_CONDITION_PCT"
    arg0.TERM_VALUE_TRIGGERED = "TERM_VALUE_TRIGGERED"
    arg0.TERM_STAGE = "TERM_STAGE"
    arg0.TERM_EFF_HALF = "TERM_EFF_HALF"
    arg0.TERM_COLLAPSE_RECOVER = "TERM_COLLAPSE_RECOVER"
    arg0.TERM_EFF_FINALLY = "TERM_EFF_FINALLY"
    arg0.TERM_EFF_WHOLE_FINALLY = "TERM_EFF_WHOLE_FINALLY"
    arg0.TERM_EFF_HALF_FINALLY = "TERM_EFF_HALF_FINALLY"
    arg0.TERM_EFF_PCT = "TERM_EFF_PCT"
    arg0.TERM_EFF_TARGET = "TERM_EFF_TARGET"
    arg0.TERM_EFF_TARGET_FINALLY = "TERM_EFF_TARGET_FINALLY"
    return arg0
  }
  function anonymous_7(arg0) {
    // Bytecode 0xf00000012700 params=2 regs=0 frame=0
    arg0.OVERLAY_ADD_TERM_VALUE = "OVERLAY_ADD_TERM_VALUE"
    arg0.OVERLAY_ADD_UNIQUE = "OVERLAY_ADD_UNIQUE"
    arg0.OVERLAY_ADD_RENEWAL = "OVERLAY_ADD_RENEWAL"
    arg0.OVERLAY_UNIQUE = "OVERLAY_UNIQUE"
    arg0.OVERLAY_RENEWAL = "OVERLAY_RENEWAL"
    arg0.OVERLAY_HIGHER = "OVERLAY_HIGHER"
    arg0.OVERLAY_CS_EACH = "OVERLAY_CS_EACH"
    arg0.OVERLAY_GLOBAL_UNIQUE = "OVERLAY_GLOBAL_UNIQUE"
    arg0.OVERLAY_ADD_TERM_VALUE_UNIQUE = "OVERLAY_ADD_TERM_VALUE_UNIQUE"
    arg0.OVERLAY_ADD_TERM_VALUE_RENEWAL = "OVERLAY_ADD_TERM_VALUE_RENEWAL"
    arg0.OVERLAY_ADD_TERM_VALUE_GLOBAL_UNIQUE = "OVERLAY_ADD_TERM_VALUE_GLOBAL_UNIQUE"
    return arg0
  }
  function anonymous_8(arg0) {
    // Bytecode 0xf00000013900 params=2 regs=3 frame=24
    arg0.VALUE_CATEGORY_NONE = 0
    arg0[0] = "VALUE_CATEGORY_NONE"
    arg0.VALUE_CATEGORY_EFF_VALUE = 1
    arg0[1] = "VALUE_CATEGORY_EFF_VALUE"
    arg0.VALUE_CATEGORY_EFF_CARD_TARGET_COUNT = 2
    arg0[2] = "VALUE_CATEGORY_EFF_CARD_TARGET_COUNT"
    arg0.VALUE_CATEGORY_EFF_COUNT_VALUE = 3
    arg0[3] = "VALUE_CATEGORY_EFF_COUNT_VALUE"
    arg0.VALUE_CATEGORY_EFF_CONDITION_VALUE_0 = 4
    arg0[4] = "VALUE_CATEGORY_EFF_CONDITION_VALUE_0"
    arg0.VALUE_CATEGORY_EFF_CONDITION_VALUE_1 = 5
    arg0[5] = "VALUE_CATEGORY_EFF_CONDITION_VALUE_1"
    return arg0
  }
  function anonymous_9(arg0) {
    // Bytecode 0xf00000014600 params=2 regs=3 frame=24
    arg0.OPERATION_NONE = 0
    arg0[0] = "OPERATION_NONE"
    arg0.OPERATION_TERM_VALUE_MULTIPLE = 1
    arg0[1] = "OPERATION_TERM_VALUE_MULTIPLE"
    arg0.OPERATION_TERM_VALUE_MULTIPLE_BEFORE_ROUND = 2
    arg0[2] = "OPERATION_TERM_VALUE_MULTIPLE_BEFORE_ROUND"
    arg0.OPERATION_TERM_VALUE_ADD = 3
    arg0[3] = "OPERATION_TERM_VALUE_ADD"
    arg0.OPERATION_TERM_VALUE_SET = 4
    arg0[4] = "OPERATION_TERM_VALUE_SET"
    return arg0
  }
  function anonymous_10(arg0) {
    // Bytecode 0xf00000015200 params=2 regs=0 frame=0
    arg0.EXPOSE_VALUE_NONE = "EXPOSE_VALUE_NONE"
    arg0.EXPOSE_VALUE_TERM_VALUE = "EXPOSE_VALUE_TERM_VALUE"
    arg0.EXPOSE_VALUE_INVOKE_EFF_VALUE = "EXPOSE_VALUE_INVOKE_EFF_VALUE"
    arg0.EXPOSE_VALUE_TERM_VALUE_MAX = "EXPOSE_VALUE_TERM_VALUE_MAX"
    return arg0
  }
  function anonymous_11(arg0) {
    // Bytecode 0xf00000015d00 params=2 regs=0 frame=0
    arg0.CS_DELAY_NONE = "CS_DELAY_NONE"
    arg0.CS_DELAY_MUST_1 = "CS_DELAY_MUST_1"
    arg0.CS_DELAY_ACTIVE = "CS_DELAY_ACTIVE"
    arg0.CS_DELAY_PASSIVE = "CS_DELAY_PASSIVE"
    arg0.CS_DELAY_MONSTER_TURN = "CS_DELAY_MONSTER_TURN"
    arg0.CS_DELAY_ACTIVE_MONSTER_TURN = "CS_DELAY_ACTIVE_MONSTER_TURN"
    return arg0
  }
  function anonymous_12(arg0) {
    // Bytecode 0xf00000016a00 params=2 regs=0 frame=0
    arg0.UNKNOWN = "UNKNOWN"
    arg0.CARD_USE = "CARD_USE"
    arg0.BATTLE_START_CS = "BATTLE_START_CS"
    arg0.FATE = "FATE"
    arg0.POTENTIAL = "POTENTIAL"
    arg0.RELIC = "RELIC"
    arg0.COLLAPSE = "COLLAPSE"
    arg0.TACTIC_PASSIVE = "TACTIC_PASSIVE"
    arg0.DEBUFF = "DEBUFF"
    arg0.MONSTER = "MONSTER"
    arg0.SINGULARITY = "SINGULARITY"
    arg0.LIMIT_BREAK = "LIMIT_BREAK"
    arg0.NB_EFF = "NB_EFF"
    arg0.ROTATION_COMBATANT = "ROTATION_COMBATANT"
    arg0.CS_STAGE = "CS_STAGE"
    arg0.STAGE_CS = "STAGE_CS"
    arg0.SPARK = "SPARK"
    arg0.PROP = "PROP"
    arg0.CHEAT = "CHEAT"
    return arg0
  }
  function anonymous_13(arg0) {
    // Bytecode 0xf00000018400 params=2 regs=0 frame=0
    arg0.ENEMY_ALL = "enemyall"
    arg0.BOSS = "boss"
    return arg0
  }
  function ContinueSkill_2() {
    // Bytecode 0xf00000019600 params=1 regs=0 frame=0
    define_literal_property(this, "cs_id", undefined, false, true)
    define_literal_property(this, "res_id", undefined, false, true)
    define_literal_property(this, "term_value", undefined, false, true)
    define_literal_property(this, "effective_term_value", undefined, false, true)
    define_literal_property(this, "temp_term_value", undefined, false, true)
    define_literal_property(this, "skillEffs", undefined, false, true)
    define_literal_property(this, "owner_id", undefined, false, true)
    define_literal_property(this, "action_target_id", undefined, false, true)
    define_literal_property(this, "isCard", undefined, false, true)
    define_literal_property(this, "caster_id", undefined, false, true)
    define_literal_property(this, "char_id", undefined, false, true)
    define_literal_property(this, "delay", undefined, false, true)
    define_literal_property(this, "is_passive", undefined, false, true)
    define_literal_property(this, "is_unique", undefined, false, true)
    define_literal_property(this, "priority", undefined, false, true)
    define_literal_property(this, "skill_added", undefined, false, true)
    define_literal_property(this, "from_debuff", undefined, false, true)
    define_literal_property(this, "from_ego", undefined, false, true)
    define_literal_property(this, "from_potential", undefined, false, true)
    define_literal_property(this, "from_collapse", undefined, false, true)
    define_literal_property(this, "from_tactic_passive", undefined, false, true)
    define_literal_property(this, "from_relic", undefined, false, true)
    define_literal_property(this, "origin", undefined, false, true)
    define_literal_property(this, "by_monster", undefined, false, true)
    define_literal_property(this, "show_cs_res_id", undefined, false, true)
    define_literal_property(this, "max", undefined, false, true)
    define_literal_property(this, "min", undefined, false, true)
    define_literal_property(this, "init_tv", undefined, false, true)
    define_literal_property(this, "removed", undefined, false, true)
    define_literal_property(this, "byAuto", undefined, false, true)
    define_literal_property(this, "overlay_tags", undefined, false, true)
    define_literal_property(this, "ignored", undefined, false, true)
    define_literal_property(this, "parent_cards", undefined, false, true)
    define_literal_property(this, "atk_cap", undefined, false, true)
    return undefined
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
      ACCU = HOLE
      context_slot[3] = ACCU
      ACCU = parseTermSuffixNumber
      context_slot[4] = ACCU
      ACCU = parseTermDelta
      context_slot[5] = ACCU
      ACCU = parseTermPct
      context_slot[6] = ACCU
      ACCU = [baseDebuffType, 15, 12, matchCsBuffType, 16, 16, parseEffPct, 17, 20, parseConditionPct, 18, 18, parseEffDelta, 19, 19, parseConditionDelta, 20, 17, termPctAddValue, 21, 26, pickTermSuffix, 22, 22, isTermDeltaFinally, 23, 15, stripEffTargetTerm, 24, 25, resolveEffTermTypes, 25, 24, hasDuplicatedEffSuffix, 26, 14, getCSEffectTermDecrement, 27, 13, parseTriggerCSTermDecrementOpt, 28, 21, resolveCSTermDecrement, 29, 23, 6]
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
        __v8_pc = 73;
        continue dispatch;
      case 1:
        __v8_pc = 70;
        continue dispatch;
      }
      __v8_pc = 67;
      continue dispatch;
    }
    case 67: {
      ACCU = r2
      throw ACCU
    }
    case 70: {
      ACCU = r2
      return ACCU
    }
    case 73: {
      r1 = r2
      ACCU = anonymous_2
      r2 = ACCU
      ACCU = {}
      r3 = ACCU
      ACCU = r2(r3)
      // WARNING: unsupported bytecode StaModuleVariable [9], [0] @87
      ACCU = anonymous_3
      r2 = ACCU
      ACCU = {}
      r3 = ACCU
      ACCU = r2(r3)
      // WARNING: unsupported bytecode StaModuleVariable [2], [0] @101
      ACCU = anonymous_4
      r2 = ACCU
      ACCU = {}
      r3 = ACCU
      ACCU = r2(r3)
      // WARNING: unsupported bytecode StaModuleVariable [5], [0] @115
      ACCU = "_FINALLY"
      context_slot[3] = ACCU
      ACCU = anonymous_7
      r2 = ACCU
      ACCU = {}
      r3 = ACCU
      ACCU = r2(r3)
      // WARNING: unsupported bytecode StaModuleVariable [8], [0] @133
      ACCU = anonymous_8
      r2 = ACCU
      ACCU = {}
      r3 = ACCU
      ACCU = r2(r3)
      // WARNING: unsupported bytecode StaModuleVariable [11], [0] @147
      ACCU = anonymous_9
      r2 = ACCU
      ACCU = {}
      r3 = ACCU
      ACCU = r2(r3)
      // WARNING: unsupported bytecode StaModuleVariable [1], [0] @161
      ACCU = anonymous_10
      r2 = ACCU
      ACCU = {}
      r3 = ACCU
      ACCU = r2(r3)
      // WARNING: unsupported bytecode StaModuleVariable [10], [0] @175
      ACCU = anonymous_11
      r2 = ACCU
      ACCU = {}
      r3 = ACCU
      ACCU = r2(r3)
      // WARNING: unsupported bytecode StaModuleVariable [3], [0] @189
      ACCU = anonymous_12
      r2 = ACCU
      ACCU = {}
      r3 = ACCU
      ACCU = r2(r3)
      // WARNING: unsupported bytecode StaModuleVariable [4], [0] @203
      ACCU = anonymous_13
      r2 = ACCU
      ACCU = {}
      r3 = ACCU
      ACCU = r2(r3)
      // WARNING: unsupported bytecode StaModuleVariable [7], [0] @217
      r4 = (class ContinueSkill {
        constructor() {
          // Bytecode 0xf00000018f00 params=1 regs=2 frame=16
          let ACCU;
          let r1;
          ACCU = closure["<RootObject 0xe00000001e80>"]
          if (!(ACCU === undefined)) {
            r1 = ACCU
            ACCU = r1.call(this)
          }
          return undefined
        }
      })
      r2 = r4
      ACCU = r4.prototype
      ACCU = ContinueSkill_2
      r2["<RootObject 0xe00000001e80>"] = ACCU
      ACCU = r4
      // WARNING: unsupported bytecode StaModuleVariable [6], [0] @248
      ACCU = r1
      return ACCU
    }
    }
  }
}

function baseDebuffType(arg0) {
  // Bytecode 0xf00000006a00 params=2 regs=0 frame=0
  let ACCU;
  ACCU = "CS_DEBUFF"
  ACCU = (arg0 == ACCU)
  if (!(truthy(ACCU))) {
    ACCU = "CS_DEBUFF_DOT"
    ACCU = (arg0 == ACCU)
  }
  return ACCU
}

function matchCsBuffType(arg0, arg1, arg2) {
  // Bytecode 0xf00000007100 params=4 regs=0 frame=0
  let ACCU;
  ACCU = arg1
  ACCU = (arg0 == ACCU)
  if (!(truthy(ACCU))) {
    ACCU = "CS_DEBUFF"
    ACCU = (arg1 == ACCU)
    if (truthy(ACCU)) {
      ACCU = "CS_DEBUFF_DOT"
      ACCU = (arg0 == ACCU)
    }
    if (!(truthy(ACCU))) {
      ACCU = "CS_BUFF"
      ACCU = (arg1 == ACCU)
      if (!(truthy(ACCU))) {
        ACCU = "CS_DEBUFF"
        ACCU = (arg1 == ACCU)
      }
      if (truthy(ACCU)) {
        ACCU = "CS_BUFF_DEBUFF"
        ACCU = (arg0 == ACCU)
        if (truthy(ACCU)) {
          ACCU = "CS_BUFF"
          ACCU = (arg1 == ACCU)
          if (truthy(ACCU)) {
            ACCU = 0
            ACCU = (arg2 > ACCU)
          }
          else {
            ACCU = 0
            ACCU = (arg2 < ACCU)
          }
        }
      }
    }
  }
  return ACCU
}

function parseEffPct(arg0) {
  // Bytecode 0xf0000000b300 params=2 regs=4 frame=32
  // Captures: parseTermPct <- anonymous_1 slot=6
  return parseTermPct(arg0, "TERM_EFF_PCT", true)
}

function parseConditionPct(arg0) {
  // Bytecode 0xf0000000ba00 params=2 regs=4 frame=32
  // Captures: parseTermPct <- anonymous_1 slot=6
  return parseTermPct(arg0, "TERM_CONDITION_PCT", true)
}

function parseEffDelta(arg0) {
  // Bytecode 0xf0000000c100 params=2 regs=4 frame=32
  // Captures: parseTermDelta <- anonymous_1 slot=5
  return parseTermDelta(arg0, "TERM_EFF", true)
}

function parseConditionDelta(arg0) {
  // Bytecode 0xf0000000c800 params=2 regs=4 frame=32
  // Captures: parseTermDelta <- anonymous_1 slot=5
  return parseTermDelta(arg0, "TERM_CONDITION", true)
}

function termPctAddValue(arg0, arg1) {
  // Bytecode 0xf0000000cf00 params=3 regs=4 frame=32
  let ACCU;
  let r0, r1, r2;
  ACCU = arg0
  ACCU = -ACCU
  r0 = ACCU
  // WARNING: unsupported bytecode LdaModuleVariable [-2], [0] @5
  r1 = checked_lexical(ACCU, "floor")
  ACCU = arg1
  ACCU = (100 - ACCU)
  ACCU = (arg0 * ACCU)
  ACCU /= 100
  r2 = ACCU
  return (r0 + r1(r2))
}

function pickTermSuffix(arg0, arg1, arg2, arg3) {
  // Bytecode 0xf0000000d600 params=5 regs=9 frame=72
  let ACCU;
  let r0, r1, r2, r3, r4, r5, r6, r7, r8;
  r0 = arg2(arg0)
  if (!truthy(isUndetectable(r0))) {
    ACCU = null
  }
  else {
    ACCU = arg3(arg0)
  }
  r1 = ACCU
  r2 = arg2(arg1)
  if (!truthy(isUndetectable(r2))) {
    ACCU = null
  }
  else {
    ACCU = arg3(arg1)
  }
  r3 = ACCU
  ACCU = r0
  ACCU = isUndetectable(ACCU)
  ACCU = !truthy(ACCU)
  if (!(truthy(ACCU))) {
    ACCU = r1
    ACCU = isUndetectable(ACCU)
    ACCU = !truthy(ACCU)
  }
  r4 = ACCU
  ACCU = r2
  ACCU = isUndetectable(ACCU)
  ACCU = !truthy(ACCU)
  if (!(truthy(ACCU))) {
    ACCU = r3
    ACCU = isUndetectable(ACCU)
    ACCU = !truthy(ACCU)
  }
  r5 = ACCU
  if (!truthy(r4)) {
    ACCU = r5
    if (!(truthy(ACCU))) {
      return null
    }
  }
  if (truthy(r4)) {
    ACCU = r0
  }
  else {
    ACCU = r2
  }
  r6 = ACCU
  if (truthy(r4)) {
    ACCU = r1
  }
  else {
    ACCU = r3
  }
  r7 = ACCU
  r8 = {
    term_type: undefined,
    value: undefined,
    is_pct: undefined,
    duplicated: undefined,
  };
  if (truthy(r4)) {
    ACCU = arg0
  }
  else {
    ACCU = arg1
  }
  define_literal_property(r8, "term_type", ACCU, false, true)
  ACCU = r6
  if (!(isNullish(ACCU))) {
  }
  else {
    ACCU = r7
    if (!(isNullish(ACCU))) {
    }
    else {
      ACCU = 0
    }
  }
  define_literal_property(r8, "value", ACCU, false, true)
  ACCU = r6
  define_literal_property(r8, "is_pct", isUndetectable(ACCU), false, true)
  ACCU = r4
  if (truthy(ACCU)) {
    ACCU = r5
  }
  define_literal_property(r8, "duplicated", ACCU, false, true)
  return r8
}

function isTermDeltaFinally(arg0) {
  // Bytecode 0xf0000000e100 params=2 regs=3 frame=24
  // Captures: TERM_FINALLY_SUFFIX <- anonymous_1 slot=3
  let ACCU;
  let r0, r2;
  r0 = arg0.endsWith
  ACCU = TERM_FINALLY_SUFFIX
  r2 = checked_lexical(ACCU, "TERM_FINALLY_SUFFIX")
  return r0.call(arg0, r2)
}

function stripEffTargetTerm(arg0) {
  // Bytecode 0xf0000000e800 params=2 regs=5 frame=40
  let ACCU;
  let r0, r1;
  ACCU = arg0
  ACCU = isUndetectable(ACCU)
  if (truthy(ACCU)) {
    return null
  }
  ACCU = "TERM_EFF_TARGET"
  ACCU = (arg0 == ACCU)
  if (truthy(ACCU)) {
    return "TERM_EFF"
  }
  ACCU = "_"
  ACCU = ("TERM_EFF_TARGET" + ACCU)
  r0 = ACCU
  if (!truthy(arg0.startsWith(r0))) {
    return null
  }
  r1 = ("TERM_EFF" + "_")
  return (r1 + arg0.slice(r0.length))
}

function resolveEffTermTypes(arg0, arg1, has_target) {
  // Bytecode 0xf0000000ef00 params=4 regs=4 frame=32
  let r2;

  function anonymous_5(arg0) {
    // Bytecode 0xf0000000f800 params=2 regs=2 frame=16
    // Captures: has_target <- resolveEffTermTypes slot=2 defined@7
    let ACCU;
    let r0, r1;
    // WARNING: unsupported bytecode LdaModuleVariable [25], [1] @0
    r1 = ACCU
    r0 = r1(arg0)
    if (truthy(isUndetectable(r0))) {
      ACCU = arg0
      if (!(isNullish(ACCU))) {
      }
      else {
        ACCU = "TERM_NONE"
      }
      return ACCU
    }
    if (truthy(has_target)) {
      ACCU = r0
    }
    else {
      ACCU = "TERM_NONE"
    }
    return ACCU
  }
  r2 = [0, 0]
  r2[0] = arg0
  r2[1] = arg1
  return r2.map(anonymous_5)
}

function hasDuplicatedEffSuffix(arg0, arg1) {
  // Bytecode 0xf00000010000 params=3 regs=3 frame=24
  let ACCU;
  let r0, r1, r2;
  // WARNING: unsupported bytecode LdaModuleVariable [25], [0] @0
  r2 = ACCU
  r0 = (r2(arg0) ?? arg0)
  // WARNING: unsupported bytecode LdaModuleVariable [25], [0] @15
  r1 = (r0(arg1) ?? arg1)
  // WARNING: unsupported bytecode LdaModuleVariable [19], [0] @30
  r2 = r1
  ACCU = r1(r0)
  ACCU = isUndetectable(ACCU)
  if (truthy(ACCU)) {
    // WARNING: unsupported bytecode LdaModuleVariable [20], [0] @41
    r2 = ACCU
    ACCU = r2(r0)
    ACCU = isUndetectable(ACCU)
    if (truthy(ACCU)) {
      return false
    }
  }
  // WARNING: unsupported bytecode LdaModuleVariable [19], [0] @54
  r2 = ACCU
  ACCU = r2(r1)
  ACCU = isUndetectable(ACCU)
  ACCU = !truthy(ACCU)
  if (!(truthy(ACCU))) {
    // WARNING: unsupported bytecode LdaModuleVariable [20], [0] @66
    r2 = ACCU
    ACCU = r2(r1)
    ACCU = isUndetectable(ACCU)
    ACCU = !truthy(ACCU)
  }
  return ACCU
}

function getCSEffectTermDecrement(arg0, arg1, arg2, arg3, arg4) {
  // Bytecode 0xf00000010600 params=6 regs=15 frame=120
  let ACCU;
  let r0, r1, r3, r4, r5, r6, r7, r8, r9, r10, r11, r12, r13, r14;
  // Explicit control flow preserves exception completion and nested jumps.
  let __v8_pc = 0;
  dispatch: while (true) {
    switch (__v8_pc) {
    case 0: {
      // WARNING: unsupported bytecode LdaModuleVariable [24], [0] @0
      r6 = ACCU
      r7 = arg1
      r8 = arg2
      r9 = arg4
      ACCU = r6(r7, r8, r9)
      r0 = ACCU
      ACCU = r0.includes
      r6 = ACCU
      ACCU = "TERM_EFF_WHOLE"
      r8 = ACCU
      ACCU = r6.call(r0, r8)
      __v8_pc = truthy(ACCU) ? 53 : 34;
      continue dispatch;
    }
    case 34: {
      ACCU = arg3
      __v8_pc = !(truthy(ACCU)) ? 56 : 38;
      continue dispatch;
    }
    case 38: {
      ACCU = r0.includes
      r6 = ACCU
      ACCU = "TERM_EFF_WHOLE_FINALLY"
      r8 = ACCU
      ACCU = r6.call(r0, r8)
      __v8_pc = !(truthy(ACCU)) ? 56 : 53;
      continue dispatch;
    }
    case 53: {
      ACCU = arg0
      return ACCU
    }
    case 56: {
      ACCU = r0.includes
      r6 = ACCU
      ACCU = "TERM_EFF"
      r8 = ACCU
      ACCU = r6.call(r0, r8)
      __v8_pc = truthy(ACCU) ? 90 : 71;
      continue dispatch;
    }
    case 71: {
      ACCU = arg3
      __v8_pc = !(truthy(ACCU)) ? 93 : 75;
      continue dispatch;
    }
    case 75: {
      ACCU = r0.includes
      r6 = ACCU
      ACCU = "TERM_EFF_FINALLY"
      r8 = ACCU
      ACCU = r6.call(r0, r8)
      __v8_pc = !(truthy(ACCU)) ? 93 : 90;
      continue dispatch;
    }
    case 90: {
      ACCU = 1
      return ACCU
    }
    case 93: {
      ACCU = r0.includes
      r6 = ACCU
      ACCU = "TERM_EFF_HALF"
      r8 = ACCU
      ACCU = r6.call(r0, r8)
      __v8_pc = truthy(ACCU) ? 127 : 108;
      continue dispatch;
    }
    case 108: {
      ACCU = arg3
      __v8_pc = !(truthy(ACCU)) ? 144 : 112;
      continue dispatch;
    }
    case 112: {
      ACCU = r0.includes
      r6 = ACCU
      ACCU = "TERM_EFF_HALF_FINALLY"
      r8 = ACCU
      ACCU = r6.call(r0, r8)
      __v8_pc = !(truthy(ACCU)) ? 144 : 127;
      continue dispatch;
    }
    case 127: {
      // WARNING: unsupported bytecode LdaModuleVariable [-1], [0] @127
      ACCU = checked_lexical(ACCU, "ceil")
      r6 = ACCU
      ACCU = arg0
      ACCU = (ACCU / 2)
      r7 = ACCU
      ACCU = r6(r7)
      return ACCU
    }
    case 144: {
      ACCU = GetIterator(r0)
      r7 = ACCU
      ACCU = r7.next
      r6 = ACCU
      ACCU = false
      r8 = ACCU
      r11 = context
      __v8_pc = 159;
      continue dispatch;
    }
    case 159: {
      try {
        ACCU = true
        r8 = ACCU
        ACCU = r6.call(r7)
        r12 = ACCU
        __v8_pc = isJSReceiver(ACCU) ? 173 : 168;
        continue dispatch;
      } catch (exception) {
        ACCU = exception;
        context = r11;
        __v8_pc = 288;
        continue dispatch;
      }
    }
    case 168: {
      try {
        ACCU = ThrowIteratorResultNotAnObject(r12)
        __v8_pc = 173;
        continue dispatch;
      } catch (exception) {
        ACCU = exception;
        context = r11;
        __v8_pc = 288;
        continue dispatch;
      }
    }
    case 173: {
      try {
        ACCU = r12.done
        __v8_pc = truthy(ACCU) ? 282 : 179;
        continue dispatch;
      } catch (exception) {
        ACCU = exception;
        context = r11;
        __v8_pc = 288;
        continue dispatch;
      }
    }
    case 179: {
      try {
        ACCU = r12.value
        r12 = ACCU
        ACCU = false
        r8 = ACCU
        r1 = r12
        r3 = r1
        ACCU = arg3
        __v8_pc = truthy(ACCU) ? 208 : 196;
        continue dispatch;
      } catch (exception) {
        ACCU = exception;
        context = r11;
        __v8_pc = 288;
        continue dispatch;
      }
    }
    case 196: {
      try {
        // WARNING: unsupported bytecode LdaModuleVariable [15], [0] @196
        r12 = ACCU
        ACCU = r12(r3)
        __v8_pc = !(truthy(ACCU)) ? 208 : 206;
        continue dispatch;
      } catch (exception) {
        ACCU = exception;
        context = r11;
        __v8_pc = 288;
        continue dispatch;
      }
    }
    case 206: {
      try {
        __v8_pc = 278;
        continue dispatch;
      } catch (exception) {
        ACCU = exception;
        context = r11;
        __v8_pc = 288;
        continue dispatch;
      }
    }
    case 208: {
      try {
        // WARNING: unsupported bytecode LdaModuleVariable [20], [0] @208
        r12 = ACCU
        ACCU = r12(r3)
        r4 = ACCU
        ACCU = isUndetectable(ACCU)
        __v8_pc = truthy(ACCU) ? 245 : 220;
        continue dispatch;
      } catch (exception) {
        ACCU = exception;
        context = r11;
        __v8_pc = 288;
        continue dispatch;
      }
    }
    case 220: {
      try {
        // WARNING: unsupported bytecode LdaModuleVariable [-1], [0] @220
        ACCU = checked_lexical(ACCU, "ceil")
        r12 = ACCU
        ACCU = r4
        ACCU = (arg0 * ACCU)
        ACCU = (ACCU / 100)
        r13 = ACCU
        ACCU = r12(r13)
        r10 = ACCU
        ACCU = 1
        r9 = ACCU
        __v8_pc = 291;
        continue dispatch;
      } catch (exception) {
        ACCU = exception;
        context = r11;
        __v8_pc = 288;
        continue dispatch;
      }
    }
    case 245: {
      try {
        // WARNING: unsupported bytecode LdaModuleVariable [19], [0] @245
        r12 = ACCU
        ACCU = r12(r3)
        r5 = ACCU
        ACCU = isUndetectable(ACCU)
        __v8_pc = truthy(ACCU) ? 278 : 257;
        continue dispatch;
      } catch (exception) {
        ACCU = exception;
        context = r11;
        __v8_pc = 288;
        continue dispatch;
      }
    }
    case 257: {
      try {
        ACCU = Math
        r13 = ACCU
        ACCU = r13.min
        r12 = ACCU
        ACCU = r12.call(r13, r5, arg0)
        r10 = ACCU
        ACCU = 1
        r9 = ACCU
        __v8_pc = 291;
        continue dispatch;
      } catch (exception) {
        ACCU = exception;
        context = r11;
        __v8_pc = 288;
        continue dispatch;
      }
    }
    case 278: {
      try {
        __v8_pc = 159;
        continue dispatch;
      } catch (exception) {
        ACCU = exception;
        context = r11;
        __v8_pc = 288;
        continue dispatch;
      }
    }
    case 282: {
      ACCU = -1
      r10 = ACCU
      r9 = ACCU
      __v8_pc = 291;
      continue dispatch;
    }
    case 288: {
      r10 = ACCU
      ACCU = 0
      r9 = ACCU
      __v8_pc = 291;
      continue dispatch;
    }
    case 291: {
      ACCU = HOLE
      // SetPendingMessage
      r11 = ACCU
      ACCU = r8
      __v8_pc = truthy(ACCU) ? 331 : 298;
      continue dispatch;
    }
    case 298: {
      r12 = context
      __v8_pc = 301;
      continue dispatch;
    }
    case 301: {
      try {
        ACCU = r7.return
        __v8_pc = isNullish(ACCU) ? 331 : 307;
        continue dispatch;
      } catch (exception) {
        ACCU = exception;
        context = r12;
        __v8_pc = 322;
        continue dispatch;
      }
    }
    case 307: {
      try {
        r13 = ACCU
        ACCU = r13.call(r7)
        __v8_pc = isJSReceiver(ACCU) ? 331 : 314;
        continue dispatch;
      } catch (exception) {
        ACCU = exception;
        context = r12;
        __v8_pc = 322;
        continue dispatch;
      }
    }
    case 314: {
      try {
        r14 = ACCU
        ACCU = ThrowIteratorResultNotAnObject(r14)
        __v8_pc = 320;
        continue dispatch;
      } catch (exception) {
        ACCU = exception;
        context = r12;
        __v8_pc = 322;
        continue dispatch;
      }
    }
    case 320: {
      __v8_pc = 331;
      continue dispatch;
    }
    case 322: {
      r12 = ACCU
      ACCU = 0
      ACCU = (r9 === ACCU)
      __v8_pc = truthy(ACCU) ? 331 : 328;
      continue dispatch;
    }
    case 328: {
      ACCU = r12
      throw ACCU
    }
    case 331: {
      ACCU = r11
      // SetPendingMessage
      ACCU = r9
      switch (ACCU) {
      case 0:
        __v8_pc = 342;
        continue dispatch;
      case 1:
        __v8_pc = 345;
        continue dispatch;
      }
      __v8_pc = 340;
      continue dispatch;
    }
    case 340: {
      __v8_pc = 348;
      continue dispatch;
    }
    case 342: {
      ACCU = r10
      throw ACCU
    }
    case 345: {
      ACCU = r10
      return ACCU
    }
    case 348: {
      ACCU = undefined
      return ACCU
    }
    }
  }
}

function parseTriggerCSTermDecrementOpt(arg0) {
  // Bytecode 0xf00000010e00 params=2 regs=6 frame=48
  let ACCU;
  let r0, r1, r2, r3, r4;

  function anonymous_6(arg0) {
    // Bytecode 0xf00000011300 params=2 regs=3 frame=24
    return arg0.startsWith("tv_dec_")
  }
  r4 = (arg0 ?? [])
  r0 = r4.filter(anonymous_6)
  r3 = r0.length
  ACCU = 1
  ACCU = (r3 == ACCU)
  if (!(truthy(ACCU))) {
    return undefined
  }
  r4 = new RegExp("^tv_dec_(max_)?([0-9]+)$", "")
  r1 = r4.exec(r0[0])
  if (!(truthy(r1))) {
    return undefined
  }
  r2 = Number(r1[2])
  r3 = { mode: undefined, value: undefined };
  if (truthy(r1[1])) {
    ACCU = "max"
  }
  else {
    ACCU = "set"
  }
  define_literal_property(r3, "mode", ACCU, false, true)
  define_literal_property(r3, "value", r2, false, true)
  return r3
}

function resolveCSTermDecrement(arg0, arg1, arg2) {
  // Bytecode 0xf00000012000 params=4 regs=7 frame=56
  let ACCU;
  let r0, r1, r2, r4;
  r1 = arg2.mode
  ACCU = "max"
  ACCU = (r1 == ACCU)
  if (truthy(ACCU)) {
    ACCU = Math.min(arg1, arg2.value)
  }
  else {
    ACCU = arg2.value
  }
  r0 = ACCU
  r2 = Math
  r1 = r2.min
  r4 = Math.max(0, r0)
  return r1.call(r2, arg0, r4)
}
