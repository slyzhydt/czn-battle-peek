function anonymous_1() {
  // Bytecode 0xf00000000100 params=1 regs=10 frame=80
  let ACCU;
  let r0, r1, r2, r3, r4, r5, r6, r7, r8, r9;

  function compareEnums(arg0, arg1, arg2) {
    // Bytecode 0xf00000000600 params=4 regs=14 frame=112
    let ACCU;
    let r0, r1, r2, r4, r5, r6, r7, r8, r9, r10, r11, r12, r13;
    // Explicit control flow preserves exception completion and nested jumps.
    let __v8_pc = 0;
    dispatch: while (true) {
      switch (__v8_pc) {
      case 0: {
        ACCU = Object
        r6 = ACCU
        ACCU = r6.keys
        r5 = ACCU
        ACCU = r5.call(r6, arg0)
        r0 = ACCU
        ACCU = Object
        r6 = ACCU
        ACCU = r6.keys
        r5 = ACCU
        ACCU = r5.call(r6, arg1)
        r1 = ACCU
        ACCU = r0.length
        r5 = ACCU
        ACCU = r1.length
        ACCU = (r5 === ACCU)
        __v8_pc = truthy(ACCU) ? 100 : 44;
        continue dispatch;
      }
      case 44: {
        ACCU = console
        r6 = ACCU
        ACCU = r6.log
        r5 = ACCU
        ACCU = "["
        r7 = ACCU
        ACCU = arg2
        ACCU = to_string(ACCU)
        ACCU = (r7 + ACCU)
        r7 = ACCU
        ACCU = "] \uae38\uc774\uac00 \ub2e4\ub985\ub2c8\ub2e4: "
        ACCU = (r7 + ACCU)
        r7 = ACCU
        ACCU = r0.length
        ACCU = to_string(ACCU)
        ACCU = (r7 + ACCU)
        r7 = ACCU
        ACCU = " vs "
        ACCU = (r7 + ACCU)
        r7 = ACCU
        ACCU = r1.length
        ACCU = to_string(ACCU)
        ACCU = (r7 + ACCU)
        r7 = ACCU
        ACCU = r5.call(r6, r7)
        ACCU = false
        return ACCU
      }
      case 100: {
        ACCU = GetIterator(r0)
        r6 = ACCU
        ACCU = r6.next
        r5 = ACCU
        ACCU = false
        r7 = ACCU
        r10 = context
        __v8_pc = 115;
        continue dispatch;
      }
      case 115: {
        try {
          ACCU = true
          r7 = ACCU
          ACCU = r5.call(r6)
          r11 = ACCU
          __v8_pc = isJSReceiver(ACCU) ? 129 : 124;
          continue dispatch;
        } catch (exception) {
          ACCU = exception;
          context = r10;
          __v8_pc = 250;
          continue dispatch;
        }
      }
      case 124: {
        try {
          ACCU = ThrowIteratorResultNotAnObject(r11)
          __v8_pc = 129;
          continue dispatch;
        } catch (exception) {
          ACCU = exception;
          context = r10;
          __v8_pc = 250;
          continue dispatch;
        }
      }
      case 129: {
        try {
          ACCU = r11.done
          __v8_pc = truthy(ACCU) ? 244 : 135;
          continue dispatch;
        } catch (exception) {
          ACCU = exception;
          context = r10;
          __v8_pc = 250;
          continue dispatch;
        }
      }
      case 135: {
        try {
          ACCU = r11.value
          r11 = ACCU
          ACCU = false
          r7 = ACCU
          r2 = r11
          r4 = r2
          ACCU = r2
          ACCU = arg0[ACCU]
          r11 = ACCU
          ACCU = r2
          ACCU = arg1[ACCU]
          ACCU = (r11 === ACCU)
          __v8_pc = truthy(ACCU) ? 240 : 164;
          continue dispatch;
        } catch (exception) {
          ACCU = exception;
          context = r10;
          __v8_pc = 250;
          continue dispatch;
        }
      }
      case 164: {
        try {
          ACCU = console
          r12 = ACCU
          ACCU = r12.log
          r11 = ACCU
          ACCU = "["
          r13 = ACCU
          ACCU = arg2
          ACCU = to_string(ACCU)
          ACCU = (r13 + ACCU)
          r13 = ACCU
          ACCU = "] "
          ACCU = (r13 + ACCU)
          r13 = ACCU
          ACCU = r4
          ACCU = to_string(ACCU)
          ACCU = (r13 + ACCU)
          r13 = ACCU
          ACCU = " \uac12\uc774 \ub2e4\ub985\ub2c8\ub2e4: "
          ACCU = (r13 + ACCU)
          r13 = ACCU
          ACCU = r4
          ACCU = arg0[ACCU]
          ACCU = to_string(ACCU)
          ACCU = (r13 + ACCU)
          r13 = ACCU
          ACCU = " vs "
          ACCU = (r13 + ACCU)
          r13 = ACCU
          ACCU = r4
          ACCU = arg1[ACCU]
          ACCU = to_string(ACCU)
          ACCU = (r13 + ACCU)
          r13 = ACCU
          ACCU = r11.call(r12, r13)
          ACCU = false
          r9 = ACCU
          ACCU = 1
          r8 = ACCU
          __v8_pc = 253;
          continue dispatch;
        } catch (exception) {
          ACCU = exception;
          context = r10;
          __v8_pc = 250;
          continue dispatch;
        }
      }
      case 240: {
        try {
          __v8_pc = 115;
          continue dispatch;
        } catch (exception) {
          ACCU = exception;
          context = r10;
          __v8_pc = 250;
          continue dispatch;
        }
      }
      case 244: {
        ACCU = -1
        r9 = ACCU
        r8 = ACCU
        __v8_pc = 253;
        continue dispatch;
      }
      case 250: {
        r9 = ACCU
        ACCU = 0
        r8 = ACCU
        __v8_pc = 253;
        continue dispatch;
      }
      case 253: {
        ACCU = HOLE
        // SetPendingMessage
        r10 = ACCU
        ACCU = r7
        __v8_pc = truthy(ACCU) ? 293 : 260;
        continue dispatch;
      }
      case 260: {
        r11 = context
        __v8_pc = 263;
        continue dispatch;
      }
      case 263: {
        try {
          ACCU = r6.return
          __v8_pc = isNullish(ACCU) ? 293 : 269;
          continue dispatch;
        } catch (exception) {
          ACCU = exception;
          context = r11;
          __v8_pc = 284;
          continue dispatch;
        }
      }
      case 269: {
        try {
          r12 = ACCU
          ACCU = r12.call(r6)
          __v8_pc = isJSReceiver(ACCU) ? 293 : 276;
          continue dispatch;
        } catch (exception) {
          ACCU = exception;
          context = r11;
          __v8_pc = 284;
          continue dispatch;
        }
      }
      case 276: {
        try {
          r13 = ACCU
          ACCU = ThrowIteratorResultNotAnObject(r13)
          __v8_pc = 282;
          continue dispatch;
        } catch (exception) {
          ACCU = exception;
          context = r11;
          __v8_pc = 284;
          continue dispatch;
        }
      }
      case 282: {
        __v8_pc = 293;
        continue dispatch;
      }
      case 284: {
        r11 = ACCU
        ACCU = 0
        ACCU = (r8 === ACCU)
        __v8_pc = truthy(ACCU) ? 293 : 290;
        continue dispatch;
      }
      case 290: {
        ACCU = r11
        throw ACCU
      }
      case 293: {
        ACCU = r10
        // SetPendingMessage
        ACCU = r8
        switch (ACCU) {
        case 0:
          __v8_pc = 304;
          continue dispatch;
        case 1:
          __v8_pc = 307;
          continue dispatch;
        }
        __v8_pc = 302;
        continue dispatch;
      }
      case 302: {
        __v8_pc = 310;
        continue dispatch;
      }
      case 304: {
        ACCU = r9
        throw ACCU
      }
      case 307: {
        ACCU = r9
        return ACCU
      }
      case 310: {
        ACCU = true
        return ACCU
      }
      }
    }
  }

  function anonymous_2(arg0) {
    // Bytecode 0xf00000005100 params=2 regs=3 frame=24
    arg0.R_SPARK_CATEGORY_PICK_BOTH = 0
    arg0[0] = "R_SPARK_CATEGORY_PICK_BOTH"
    arg0.R_SPARK_CATEGORY_PICK_PUBLIC_ONLY = 1
    arg0[1] = "R_SPARK_CATEGORY_PICK_PUBLIC_ONLY"
    arg0.R_SPARK_CATEGORY_PICK_UNIQUE_ONLY = 2
    arg0[2] = "R_SPARK_CATEGORY_PICK_UNIQUE_ONLY"
    return arg0
  }

  function anonymous_3(arg0) {
    // Bytecode 0xf00000005b00 params=2 regs=0 frame=0
    arg0.R_SPARK_RARITY_COMMON = "R_SPARK_RARITY_COMMON"
    arg0.R_SPARK_RARITY_UNIQUE = "R_SPARK_RARITY_UNIQUE"
    return arg0
  }

  function anonymous_4(arg0) {
    // Bytecode 0xf00000006400 params=2 regs=3 frame=24
    arg0.TALENT_NONE = 0
    arg0[0] = "TALENT_NONE"
    arg0.TALENT_ETHEREAL = 1
    arg0[1] = "TALENT_ETHEREAL"
    arg0.TALENT_EXHAUST = 2
    arg0[2] = "TALENT_EXHAUST"
    arg0.TALENT_INNATE = 3
    arg0[3] = "TALENT_INNATE"
    arg0.TALENT_UNPLAYABLE = 4
    arg0[4] = "TALENT_UNPLAYABLE"
    arg0.TALENT_ITEM = 5
    arg0[5] = "TALENT_ITEM"
    arg0.TALENT_RETAIN = 6
    arg0[6] = "TALENT_RETAIN"
    arg0.TALENT_REMOVE = 7
    arg0[7] = "TALENT_REMOVE"
    arg0.TALENT_OPTION_SELECT = 8
    arg0[8] = "TALENT_OPTION_SELECT"
    arg0.TALENT_IRREMOVABLE = 9
    arg0[9] = "TALENT_IRREMOVABLE"
    arg0.TALENT_MOVE_TO_DISCARD = 10
    arg0[10] = "TALENT_MOVE_TO_DISCARD"
    arg0.TALENT_SPARK = 11
    arg0[11] = "TALENT_SPARK"
    arg0.TALENT_BULLET = 15
    arg0[15] = "TALENT_BULLET"
    arg0.TALENT_SHADOW = 16
    arg0[16] = "TALENT_SHADOW"
    arg0.TALENT_POACHER = 17
    arg0[17] = "TALENT_POACHER"
    arg0.TALENT_DEXTERITY_BASE_DMG = 18
    arg0[18] = "TALENT_DEXTERITY_BASE_DMG"
    arg0.TALENT_DMG_DECREASE_BASE_DMG = 19
    arg0[19] = "TALENT_DMG_DECREASE_BASE_DMG"
    arg0.TALENT_WORM = 20
    arg0[20] = "TALENT_WORM"
    arg0.TALENT_LEAD = 21
    arg0[21] = "TALENT_LEAD"
    arg0.TALENT_COOP = 22
    arg0[22] = "TALENT_COOP"
    arg0.TALENT_ORLEA_CREATION = 25
    arg0[25] = "TALENT_ORLEA_CREATION"
    arg0.TALENT_NPC = 26
    arg0[26] = "TALENT_NPC"
    arg0.TALENT_PREEMPTIVE = 27
    arg0[27] = "TALENT_PREEMPTIVE"
    arg0.TALENT_RECALL = 28
    arg0[28] = "TALENT_RECALL"
    arg0.TALENT_NO_COUNT = 29
    arg0[29] = "TALENT_NO_COUNT"
    arg0.TALENT_CELESTIAL = 30
    arg0[30] = "TALENT_CELESTIAL"
    arg0.TALENT_TERMINATION = 31
    arg0[31] = "TALENT_TERMINATION"
    arg0.TALENT_REPLICATION = 32
    arg0[32] = "TALENT_REPLICATION"
    arg0.TALENT_WEAKPOINT = 33
    arg0[33] = "TALENT_WEAKPOINT"
    arg0.TALENT_SHIELD_DESTRUCT = 34
    arg0[34] = "TALENT_SHIELD_DESTRUCT"
    arg0.TALENT_UNEXHAUSTIBLE = 35
    arg0[35] = "TALENT_UNEXHAUSTIBLE"
    arg0.TALENT_ORIGIN = 36
    arg0[36] = "TALENT_ORIGIN"
    arg0.TALENT_BIND = 37
    arg0[37] = "TALENT_BIND"
    arg0.TALENT_VALLISTA = 38
    arg0[38] = "TALENT_VALLISTA"
    arg0.TALENT_IGNITE = 39
    arg0[39] = "TALENT_IGNITE"
    arg0.TALENT_UNIQUE_TIPERA = 40
    arg0[40] = "TALENT_UNIQUE_TIPERA"
    arg0.TALENT_CONNECT = 41
    arg0[41] = "TALENT_CONNECT"
    arg0.TALENT_CONNECT_INFINITE = 42
    arg0[42] = "TALENT_CONNECT_INFINITE"
    arg0.TALENT_EXHAUST_N = 43
    arg0[43] = "TALENT_EXHAUST_N"
    arg0.TALENT_TESTAMENT = 44
    arg0[44] = "TALENT_TESTAMENT"
    arg0.TALENT_FAIRY = 45
    arg0[45] = "TALENT_FAIRY"
    arg0.TALENT_OPENING = 46
    arg0[46] = "TALENT_OPENING"
    arg0.TALENT_RHYTHM = 47
    arg0[47] = "TALENT_RHYTHM"
    arg0.TALENT_EXPLORATION = 48
    arg0[48] = "TALENT_EXPLORATION"
    arg0.TALENT_CONTROL = 49
    arg0[49] = "TALENT_CONTROL"
    arg0.TALENT_POSSESSION = 50
    arg0[50] = "TALENT_POSSESSION"
    arg0.TALENT_SURVIVAL = 51
    arg0[51] = "TALENT_SURVIVAL"
    arg0.TALENT_UNIQUE_OLGA = 52
    arg0[52] = "TALENT_UNIQUE_OLGA"
    arg0.TALENT_MEMORY = 53
    arg0[53] = "TALENT_MEMORY"
    arg0.TALENT_MEMORY_SHARD = 54
    arg0[54] = "TALENT_MEMORY_SHARD"
    arg0.TALENT_UNIQUE_OLGA1 = 55
    arg0[55] = "TALENT_UNIQUE_OLGA1"
    arg0.TALENT_UNIQUE_OLGA2 = 56
    arg0[56] = "TALENT_UNIQUE_OLGA2"
    arg0.TALENT_UNINTERACTIBLE = 57
    arg0[57] = "TALENT_UNINTERACTIBLE"
    arg0.TALENT_LIGHT_DARK = 58
    arg0[58] = "TALENT_LIGHT_DARK"
    arg0.TALENT_LIGHT = 59
    arg0[59] = "TALENT_LIGHT"
    arg0.TALENT_DARK = 60
    arg0[60] = "TALENT_DARK"
    return arg0
  }

  function getBindGroupBaseResId(arg0) {
    // Bytecode 0xf0000000c900 params=2 regs=4 frame=32
    let ACCU;
    let r0, r2;
    r0 = arg0.replace
    ACCU = context_slot[3]
    r2 = checked_lexical(ACCU, "BIND_GROUP_VARIANT_SUFFIX_RE")
    return r0.call(arg0, r2, "")
  }

  function anonymous_6(arg0) {
    // Bytecode 0xf0000000d000 params=2 regs=0 frame=0
    arg0.SHOW_TYPE_ICON = "SHOW_TYPE_ICON"
    arg0.SHOW_TYPE_ICON_NOT_NOTI = "SHOW_TYPE_ICON_NOT_NOTI"
    arg0.SHOW_TYPE_NONE = "SHOW_TYPE_NONE"
    arg0.SHOW_TYPE_ACTION = "SHOW_TYPE_ACTION"
    arg0.SHOW_TYPE_GUIDE_CS = "SHOW_TYPE_GUIDE_CS"
    arg0.SHOW_TYPE_LOG_ONLY = "SHOW_TYPE_LOG_ONLY"
    arg0.SHOW_TYPE_ICON_NOT_LOG = "SHOW_TYPE_ICON_NOT_LOG"
    arg0.SHOW_TYPE_BUFF = "SHOW_TYPE_BUFF"
    arg0.SHOW_TYPE_OUTLINE = "SHOW_TYPE_OUTLINE"
    arg0.SHOW_TYPE_ICON_OUTLINE = "SHOW_TYPE_ICON_OUTLINE"
    return arg0
  }

  function anonymous_7(arg0) {
    // Bytecode 0xf0000000e100 params=2 regs=3 frame=24
    arg0.NONE = 0
    arg0[0] = "NONE"
    arg0.HAND = 1
    arg0[1] = "HAND"
    arg0.LOOK = 2
    arg0[2] = "LOOK"
    arg0.DECK = 3
    arg0[3] = "DECK"
    arg0.DISCARD = 4
    arg0[4] = "DISCARD"
    arg0.DRAW = 5
    arg0[5] = "DRAW"
    arg0.EXHAUST = 6
    arg0[6] = "EXHAUST"
    return arg0
  }

  function anonymous_8(arg0) {
    // Bytecode 0xf0000000ef00 params=2 regs=0 frame=0
    arg0.NONE = "NONE"
    arg0.CARD_TARGET_CHAR_OWNER = "CARD_TARGET_CHAR_OWNER"
    arg0.CARD_TARGET_CHAR_RAN_EACH = "CARD_TARGET_CHAR_RAN_EACH"
    arg0.CARD_TARGET_CHAR_RAN_WHOLE = "CARD_TARGET_CHAR_RAN_WHOLE"
    arg0.CARD_TARGET_CHAR_TRIGGERED = "CARD_TARGET_CHAR_TRIGGERED"
    arg0.CARD_TARGET_CHAR_EACH_FLAT = "CARD_TARGET_CHAR_EACH_FLAT"
    arg0.CARD_TARGET_CHAR_RAN_EXCEPT_OWNER = "CARD_TARGET_CHAR_RAN_EXCEPT_OWNER"
    arg0.CARD_TARGET_CHAR_1 = "CARD_TARGET_CHAR_1"
    arg0.CARD_TARGET_CHAR_2 = "CARD_TARGET_CHAR_2"
    arg0.CARD_TARGET_CHAR_3 = "CARD_TARGET_CHAR_3"
    arg0.CARD_TARGET_CHAR_HIGHEST_ATK = "CARD_TARGET_CHAR_HIGHEST_ATK"
    arg0.CARD_TARGET_CHAR_HIGHEST_ATK_EXCEPT_OWNER = "CARD_TARGET_CHAR_HIGHEST_ATK_EXCEPT_OWNER"
    arg0.CARD_TARGET_CHAR_CARD_ACTIVATED_BEFORE = "CARD_TARGET_CHAR_CARD_ACTIVATED_BEFORE"
    arg0.CARD_TARGET_CHAR_OWNER_TRIGGERED = "CARD_TARGET_CHAR_OWNER_TRIGGERED"
    arg0.CARD_TARGET_CHAR_CS_OWNER = "CARD_TARGET_CHAR_CS_OWNER"
    arg0.CARD_TARGET_CARD_OWNER = "CARD_TARGET_CARD_OWNER"
    return arg0
  }

  function anonymous_9(arg0) {
    // Bytecode 0xf00000010500 params=2 regs=0 frame=0
    arg0.CARD_SET_NONE = "CARD_SET_NONE"
    arg0.CARD_SET_ALL = "CARD_SET_ALL"
    arg0.CART_SET_ALL_INCLUDE_DESIGNED = "CARD_SET_ALL_INCLUDE_DESIGNED"
    arg0.CARD_SET_GET_CARD = "CARD_SET_GET_CARD"
    arg0.CARD_SET_DESIGNED = "CARD_SET_DESIGNED"
    arg0.CARD_SET_DESIGNED_R_SPARK = "CARD_SET_DESIGNED_R_SPARK"
    arg0.CARD_SET_ALL_EXCEPT_DESIGNED = "CARD_SET_ALL_EXCEPT_DESIGNED"
    arg0.CARD_SET_CHAR_EXCEPT_DESIGNED = "CARD_SET_CHAR_EXCEPT_DESIGNED"
    arg0.CARD_SET_CHAR_EXCEPT_THIS_CARD = "CARD_SET_CHAR_EXCEPT_THIS_CARD"
    arg0.CARD_SET_CHAR_EXCEPT_THIS_R_SPARK = "CARD_SET_CHAR_EXCEPT_THIS_R_SPARK"
    arg0.CARD_SET_THIS_CARD = "CARD_SET_THIS_CARD"
    arg0.CARD_SET_ALL_EXCEPT_THIS_CARD = "CARD_SET_ALL_EXCEPT_THIS_CARD"
    arg0.CARD_SET_ALL_EXCEPT_OWN_EGO = "CARD_SET_ALL_EXCEPT_OWN_EGO"
    arg0.CARD_SET_BEFORE_EFF_TARGET = "CARD_SET_BEFORE_EFF_TARGET"
    arg0.CARD_SET_BEFORE_EFF_EXCEPT_TARGET = "CARD_SET_BEFORE_EFF_EXCEPT_TARGET"
    arg0.CARD_SET_TURN_DRAW = "CARD_SET_TURN_DRAW"
    arg0.CARD_SET_TURN_DRAW_CHAR = "CARD_SET_TURN_DRAW_CHAR"
    arg0.CARD_SET_REWARD_ID = "CARD_SET_REWARD_ID"
    arg0.CARD_SET_USING = "CARD_SET_USING"
    arg0.CARD_SET_USED_BEFORE = "CARD_SET_USED_BEFORE"
    arg0.CARD_SET_TRIGGERED = "CARD_SET_TRIGGERED"
    arg0.CARD_SET_TRIGGERED_OWNER = "CARD_SET_TRIGGERED_OWNER"
    arg0.CARD_SET_USABLE = "CARD_SET_USABLE"
    arg0.CARD_SET_CHAR_EGO = "CARD_SET_CHAR_EGO"
    arg0.CARD_SET_CHAR = "CARD_SET_CHAR"
    arg0.CARD_SET_NOT_CHAR_OWNER = "CARD_SET_NOT_CHAR_OWNER"
    arg0.CARD_SET_EXCEPT_CHAR_OWNER = "CARD_SET_EXCEPT_CHAR_OWNER"
    arg0.CARD_SET_CLASS = "CARD_SET_CLASS"
    arg0.CARD_SET_USE_THIS_TURN = "CARD_SET_USE_THIS_TURN"
    arg0.CARD_SET_TRIGGER_INSPIRATION = "CARD_SET_TRIGGER_INSPIRATION"
    arg0.CARD_SET_TRIGGER_ATTUNMENT = "CARD_SET_TRIGGER_ATTUNMENT"
    return arg0
  }

  function anonymous_10(arg0) {
    // Bytecode 0xf00000012c00 params=2 regs=0 frame=0
    arg0.LIST_PICK_NONE = "LIST_PICK_NONE"
    arg0.LIST_PICK_ORDER = "LIST_PICK_ORDER"
    arg0.LIST_PICK_RAN = "LIST_PICK_RAN"
    arg0.LIST_PICK_ORDER_INVERSE = "LIST_PICK_ORDER_INVERSE"
    arg0.LIST_PICK_HIGH_RARITY = "LIST_PICK_HIGH_RARITY"
    arg0.LIST_PICK_LOW_RARITY = "LIST_PICK_LOW_RARITY"
    arg0.LIST_PICK_HIGH_COST = "LIST_PICK_HIGH_COST"
    arg0.LIST_PICK_LOW_COST = "LIST_PICK_LOW_COST"
    arg0.LIST_PICK_CHAR_EACH_FLAT = "LIST_PICK_CHAR_EACH_FLAT"
    arg0.LIST_PICK_HIGHEST_COST = "LIST_PICK_HIGHEST_COST"
    arg0.LIST_PICK_RAN_NOT_TRIGGERED_INSPIRATION = "LIST_PICK_RAN_NOT_TRIGGERED_INSPIRATION"
    arg0.LIST_PICK_DECK_FIRST = "LIST_PICK_DECK_FIRST"
    return arg0
  }

  function anonymous_11(arg0) {
    // Bytecode 0xf00000013f00 params=2 regs=3 frame=24
    arg0.CARD_PLACE_NONE = 0
    arg0[0] = "CARD_PLACE_NONE"
    arg0.CARD_PLACE_DECK = 1
    arg0[1] = "CARD_PLACE_DECK"
    arg0.CARD_PLACE_HAND = 2
    arg0[2] = "CARD_PLACE_HAND"
    arg0.CARD_PLACE_DISCARD = 3
    arg0[3] = "CARD_PLACE_DISCARD"
    arg0.CARD_PLACE_EXHAUST = 4
    arg0[4] = "CARD_PLACE_EXHAUST"
    arg0.CARD_PLACE_DECK_TOP = 5
    arg0[5] = "CARD_PLACE_DECK_TOP"
    arg0.CARD_PLACE_DECK_BOTTOM = 6
    arg0[6] = "CARD_PLACE_DECK_BOTTOM"
    arg0.CARD_PLACE_USING = 7
    arg0[7] = "CARD_PLACE_USING"
    arg0.CARD_PLACE_ALL = 8
    arg0[8] = "CARD_PLACE_ALL"
    arg0.CARD_PLACE_MONSTER = 9
    arg0[9] = "CARD_PLACE_MONSTER"
    arg0.CARD_PLACE_MONSTER_CASTER = 10
    arg0[10] = "CARD_PLACE_MONSTER_CASTER"
    arg0.CARD_PLACE_USED = 11
    arg0[11] = "CARD_PLACE_USED"
    arg0.CARD_PLACE_EXCEPT_EXHAUST = 12
    arg0[12] = "CARD_PLACE_EXCEPT_EXHAUST"
    arg0.CARD_PLACE_EXCEPT_EXHAUST_MONSTER = 13
    arg0[13] = "CARD_PLACE_EXCEPT_EXHAUST_MONSTER"
    arg0.CARD_PLACE_STAGE_DECK = 14
    arg0[14] = "CARD_PLACE_STAGE_DECK"
    arg0.CARD_PLACE_DISCARD_USED = 15
    arg0[15] = "CARD_PLACE_DISCARD_USED"
    arg0.CARD_PLACE_DECK_DISCARD = 16
    arg0[16] = "CARD_PLACE_DECK_DISCARD"
    arg0.CARD_PLACE_DECK_DISCARD_USED = 17
    arg0[17] = "CARD_PLACE_DECK_DISCARD_USED"
    arg0.CARD_PLACE_DECK_HAND = 18
    arg0[18] = "CARD_PLACE_DECK_HAND"
    arg0.CARD_PLACE_DISCARD_HAND = 19
    arg0[19] = "CARD_PLACE_DISCARD_HAND"
    arg0.CARD_PLACE_DISCARD_USED_HAND = 20
    arg0[20] = "CARD_PLACE_DISCARD_USED_HAND"
    arg0.CARD_PLACE_DECK_HAND_DISCARD = 21
    arg0[21] = "CARD_PLACE_DECK_HAND_DISCARD"
    arg0.CARD_PLACE_DECK_DISCARD_USED_USING = 22
    arg0[22] = "CARD_PLACE_DECK_DISCARD_USED_USING"
    return arg0
  }

  function anonymous_12(arg0) {
    // Bytecode 0xf00000015d00 params=2 regs=3 frame=24
    let ACCU;
    let r0, r1;
    r0 = isNaN
    r1 = Number
    r1 = r1(arg0)
    ACCU = r0(r1)
    if (truthy(ACCU)) {
      ACCU = arg0.startsWith("CARD_PLACE_")
    }
    return ACCU
  }

  function anonymous_13(arg0) {
    // Bytecode 0xf00000016500 params=2 regs=4 frame=32
    return arg0.replace("CARD_PLACE_", "")
  }

  function anonymous_14(arg0) {
    // Bytecode 0xf00000016c00 params=2 regs=3 frame=24
    let ACCU;
    ACCU = arg0.includes("_")
    return !truthy(ACCU)
  }

  function anonymous_16(arg0) {
    // Bytecode 0xf00000018100 params=2 regs=0 frame=0
    arg0.none = "none"
    arg0.N_ATK = "N_ATK"
    arg0.N_SHD = "N_SHD"
    arg0.N_BUFF = "N_BUFF"
    arg0.N_DBF = "N_DBF"
    arg0.N_UNKNOWN = "N_UNKNOWN"
    arg0.N_RUNAWAY = "N_RUNAWAY"
    arg0.N_ATK_STR = "N_ATK_STR"
    arg0.N_ATK_M = "N_ATK_M"
    arg0.N_ATK_STR_M = "N_ATK_STR_M"
    arg0.N_GROGGY = "N_GROGGY"
    arg0.N_SELF_DESTRUCT = "N_SELF_DESTRUCT"
    arg0.N_ATK_SELF_DESTRUCT = "N_ATK_SELF_DESTRUCT"
    arg0.N_HEAL = "N_HEAL"
    arg0.N_ATK_HEAL = "N_ATK_HEAL"
    arg0.N_SHD_HEAL = "N_SHD_HEAL"
    arg0.N_BUFF_HEAL = "N_BUFF_HEAL"
    arg0.N_DBF_HEAL = "N_DBF_HEAL"
    arg0.N_EXHAUSTION = "N_EXHAUSTION"
    arg0.N_SUMMON = "N_SUMMON"
    arg0.N_DBF_ABN = "N_DBF_ABN"
    arg0.N_DBF_CS = "N_DBF_CS"
    arg0.N_DBF_CARD = "N_DBF_CARD"
    arg0.N_LOADING = "N_LOADING"
    arg0.N_ATK_SHD = "N_ATK_SHD"
    arg0.N_ATK_BUFF = "N_ATK_BUFF"
    arg0.N_ATK_DBF = "N_ATK_DBF"
    arg0.N_SHD_BUFF = "N_SHD_BUFF"
    arg0.N_SHD_DBF = "N_SHD_DBF"
    arg0.N_BUFF_DBF = "N_BUFF_DBF"
    arg0.N_ATK_STR_SHD = "N_ATK_STR_SHD"
    arg0.N_ATK_STR_BUFF = "N_ATK_STR_BUFF"
    arg0.N_ATK_STR_DBF = "N_ATK_STR_DBF"
    arg0.N_ATK_SHD_M = "N_ATK_SHD_M"
    arg0.N_ATK_BUFF_M = "N_ATK_BUFF_M"
    arg0.N_ATK_DBF_M = "N_ATK_DBF_M"
    arg0.N_ATK_STR_SHD_M = "N_ATK_STR_SHD_M"
    arg0.N_ATK_DBF_CS_M = "N_ATK_DBF_CS_M"
    arg0.N_ATK_STR_BUFF_M = "N_ATK_STR_BUFF_M"
    arg0.N_ATK_STR_DBF_M = "N_ATK_STR_DBF_M"
    arg0.N_ATK_SUMMON = "N_ATK_SUMMON"
    arg0.N_ATK_STR_SUMMON = "N_ATK_STR_SUMMON"
    arg0.N_SUMMON_SHD = "N_SUMMON_SHD"
    arg0.N_SUMMON_BUFF = "N_SUMMON_BUFF"
    arg0.N_SUMMON_DBF = "N_SUMMON_DBF"
    arg0.N_ATK_DBF_ABN = "N_ATK_DBF_ABN"
    arg0.N_ATK_DBF_ABN_M = "N_ATK_DBF_ABN_M"
    arg0.N_STR_ATK_DBF_ABN = "N_STR_ATK_DBF_ABN"
    arg0.N_BUFF_DBF_ABN = "N_BUFF_DBF_ABN"
    arg0.N_SHD_DBF_ABN = "N_SHD_DBF_ABN"
    arg0.N_SUMMON_DBF_ABN = "N_SUMMON_DBF_ABN"
    arg0.N_ATK_DBF_CS = "N_ATK_DBF_CS"
    arg0.N_STR_ATK_DBF_CS = "N_STR_ATK_DBF_CS"
    arg0.N_BUFF_DBF_CS = "N_BUFF_DBF_CS"
    arg0.N_SHD_DBF_CS = "N_SHD_DBF_CS"
    arg0.N_SUMMON_DBF_CS = "N_SUMMON_DBF_CS"
    arg0.N_ATK_DBF_CARD = "N_ATK_DBF_CARD"
    arg0.N_ATK_DBF_CARD_M = "N_ATK_DBF_CARD_M"
    arg0.N_STR_ATK_DBF_CARD = "N_STR_ATK_DBF_CARD"
    arg0.N_BUFF_DBF_CARD = "N_BUFF_DBF_CARD"
    arg0.N_SHD_DBF_CARD = "N_SHD_DBF_CARD"
    arg0.N_SUMMON_DBF_CARD = "N_SUMMON_DBF_CARD"
    arg0.N_STR_ATK_DBF_CS_M = "N_STR_ATK_DBF_CS_M"
    arg0.N_ATK_SUMMON_M = "N_ATK_SUMMON_M"
    arg0.N_ATK_STR_SUMMON_M = "N_ATK_STR_SUMMON_M"
    arg0.N_ATK_HEAL_M = "N_ATK_HEAL_M"
    arg0.N_ATK_SELF_DESTRUCT_M = "N_ATK_SELF_DESTRUCT_M"
    arg0.N_STR_BUFF = "N_STR_BUFF"
    arg0.N_STR_SHD = "N_STR_SHD"
    arg0.N_STR_ATK_DBF_ABN_M = "N_STR_ATK_DBF_ABN_M"
    arg0.N_STR_ATK_DBF_CARD_M = "N_STR_ATK_DBF_CARD_M"
    arg0.N_PEN_ATK = "N_PEN_ATK"
    arg0.N_PEN_ATK_DBF_CS = "N_PEN_ATK_DBF_CS"
    arg0.N_PEN_ATK_SHD = "N_PEN_ATK_SHD"
    arg0.N_KILL = "N_KILL"
    return arg0
  }

  function anonymous_17(arg0) {
    // Bytecode 0xf0000001d300 params=2 regs=0 frame=0
    arg0.NONE = "NONE"
    arg0.CARD = "CARD"
    arg0.CARD_RES = "CARD_RES"
    arg0.OPTION_SELECT = "OPTION_SELECT"
    arg0.EVENT = "EVENT"
    return arg0
  }

  function anonymous_18(arg0) {
    // Bytecode 0xf0000001de00 params=2 regs=0 frame=0
    arg0.card_use = "card_use"
    arg0.prebattle_start = "prebattle_start"
    arg0.card_select = "card_select"
    arg0.card_select_spark = "card_select_spark"
    arg0.card_res_select = "card_res_select"
    arg0.card_option_select = "card_option_select"
    arg0.card_r_spark_select = "card_r_spark_select"
    arg0.event_select = "event_select"
    arg0.turn_over = "turn_over"
    arg0.ep_skill = "ep_skill"
    arg0.care_turn = "care_turn"
    arg0.care_card = "care_card"
    arg0.care_ep_skill = "care_ep_skill"
    arg0.cheat = "cheat"
    return arg0
  }

  function anonymous_19(arg0) {
    // Bytecode 0xf0000001f300 params=2 regs=3 frame=24
    arg0.card_use = 0
    arg0[0] = "card_use"
    arg0.before_battle_start = 1
    arg0[1] = "before_battle_start"
    arg0.turn_start = 2
    arg0[2] = "turn_start"
    arg0.turn_over = 3
    arg0[3] = "turn_over"
    arg0.monster_action = 4
    arg0[4] = "monster_action"
    arg0.tactic_skill = 5
    arg0[5] = "tactic_skill"
    arg0.y_spark = 6
    arg0[6] = "y_spark"
    arg0.battle_end = 7
    arg0[7] = "battle_end"
    arg0.care_card = 8
    arg0[8] = "care_card"
    arg0.select_card = 9
    arg0[9] = "select_card"
    arg0.select_card_res = 10
    arg0[10] = "select_card_res"
    arg0.select_card_option = 11
    arg0[11] = "select_card_option"
    arg0.r_spark = 12
    arg0[12] = "r_spark"
    arg0.select_event = 13
    arg0[13] = "select_event"
    arg0.monster_card = 14
    arg0[14] = "monster_card"
    arg0.stagecs = 15
    arg0[15] = "stagecs"
    arg0.cs = 16
    arg0[16] = "cs"
    arg0.ego = 17
    arg0[17] = "ego"
    arg0.equip = 18
    arg0[18] = "equip"
    arg0.collapse = 19
    arg0[19] = "collapse"
    arg0.draw = 20
    arg0[20] = "draw"
    arg0.energy = 21
    arg0[21] = "energy"
    arg0.cs_gain = 22
    arg0[22] = "cs_gain"
    arg0.collapse_gain = 23
    arg0[23] = "collapse_gain"
    arg0.collapse_recover = 24
    arg0[24] = "collapse_recover"
    arg0.collapse_penalty = 25
    arg0[25] = "collapse_penalty"
    arg0.ccs = 26
    arg0[26] = "ccs"
    arg0.log_nihilum_meta = 27
    arg0[27] = "log_nihilum_meta"
    arg0.talent = 28
    arg0[28] = "talent"
    return arg0
  }

  function anonymous_20(arg0) {
    // Bytecode 0xf00000021400 params=2 regs=3 frame=24
    arg0.unit_id = 0
    arg0[0] = "unit_id"
    arg0.cs_res_id = 1
    arg0[1] = "cs_res_id"
    arg0.monster_ids = 2
    arg0[2] = "monster_ids"
    arg0.cost = 3
    arg0[3] = "cost"
    arg0.delta = 4
    arg0[4] = "delta"
    arg0.delta_result = 5
    arg0[5] = "delta_result"
    arg0.value = 6
    arg0[6] = "value"
    arg0.count = 7
    arg0[7] = "count"
    arg0.card_id = 8
    arg0[8] = "card_id"
    arg0.card_ids = 9
    arg0[9] = "card_ids"
    arg0.card_from = 10
    arg0[10] = "card_from"
    arg0.card_id_with_count = 11
    arg0[11] = "card_id_with_count"
    arg0.card_to = 12
    arg0[12] = "card_to"
    arg0.card_from_wo_hand = 13
    arg0[13] = "card_from_wo_hand"
    arg0.card_to_wo_hand = 14
    arg0[14] = "card_to_wo_hand"
    arg0.debuff_res_id = 15
    arg0[15] = "debuff_res_id"
    arg0.tactic_res_id = 16
    arg0[16] = "tactic_res_id"
    arg0.text = 17
    arg0[17] = "text"
    arg0.unit_id_cs_set_add = 18
    arg0[18] = "unit_id_cs_set_add"
    arg0.cs_res_id_cs_set_add = 19
    arg0[19] = "cs_res_id_cs_set_add"
    arg0.talent = 20
    arg0[20] = "talent"
    return arg0
  }

  function anonymous_21(arg0) {
    // Bytecode 0xf00000022d00 params=2 regs=3 frame=24
    arg0.none = 0
    arg0[0] = "none"
    arg0.all_enemy = 1
    arg0[1] = "all_enemy"
    arg0.random_enemy = 2
    arg0[2] = "random_enemy"
    arg0.not_selected = 3
    arg0[3] = "not_selected"
    return arg0
  }

  function anonymous_22(arg0) {
    // Bytecode 0xf00000023700 params=2 regs=3 frame=24
    arg0.log_skill_eff_dmg = 0
    arg0[0] = "log_skill_eff_dmg"
    arg0.log_skill_eff_dmg_each = 1
    arg0[1] = "log_skill_eff_dmg_each"
    arg0.log_ego_break = 2
    arg0[2] = "log_ego_break"
    arg0.log_critical = 3
    arg0[3] = "log_critical"
    arg0.log_skill_eff_shield = 4
    arg0[4] = "log_skill_eff_shield"
    arg0.log_skill_eff_shield_each = 5
    arg0[5] = "log_skill_eff_shield_each"
    arg0.log_skill_eff_shield_change = 6
    arg0[6] = "log_skill_eff_shield_change"
    arg0.log_skill_eff_shield_maintain = 7
    arg0[7] = "log_skill_eff_shield_maintain"
    arg0.log_skill_eff_ego_field_change = 8
    arg0[8] = "log_skill_eff_ego_field_change"
    arg0.log_skill_eff_cs_set_add = 9
    arg0[9] = "log_skill_eff_cs_set_add"
    arg0.log_skill_eff_transition_selected_cs_to = 10
    arg0[10] = "log_skill_eff_transition_selected_cs_to"
    arg0.log_skill_eff_block_debuff = 11
    arg0[11] = "log_skill_eff_block_debuff"
    arg0.log_card_place_to = 12
    arg0[12] = "log_card_place_to"
    arg0.log_card_place_from = 13
    arg0[13] = "log_card_place_from"
    arg0.log_skill_eff_card_get = 14
    arg0[14] = "log_skill_eff_card_get"
    arg0.log_skill_eff_card_copy_to = 15
    arg0[15] = "log_skill_eff_card_copy_to"
    arg0.log_skill_eff_card_move_to = 16
    arg0[16] = "log_skill_eff_card_move_to"
    arg0.log_skill_eff_card_use = 17
    arg0[17] = "log_skill_eff_card_use"
    arg0.log_skill_eff_card_use_additional = 18
    arg0[18] = "log_skill_eff_card_use_additional"
    arg0.log_skill_eff_card_exhaust = 19
    arg0[19] = "log_skill_eff_card_exhaust"
    arg0.log_skill_eff_card_draw = 20
    arg0[20] = "log_skill_eff_card_draw"
    arg0.log_skill_eff_card_discard = 21
    arg0[21] = "log_skill_eff_card_discard"
    arg0.log_skill_eff_card_retain = 22
    arg0[22] = "log_skill_eff_card_retain"
    arg0.log_skill_eff_card_retain_turn_end = 23
    arg0[23] = "log_skill_eff_card_retain_turn_end"
    arg0.log_skill_eff_card_debuff_add = 24
    arg0[24] = "log_skill_eff_card_debuff_add"
    arg0.log_skill_eff_card_cost_change = 25
    arg0[25] = "log_skill_eff_card_cost_change"
    arg0.log_skill_eff_energy_change = 26
    arg0[26] = "log_skill_eff_energy_change"
    arg0.log_skill_eff_tactic_gauge_add = 27
    arg0[27] = "log_skill_eff_tactic_gauge_add"
    arg0.log_red_spark = 28
    arg0[28] = "log_red_spark"
    arg0.log_skill_eff_stage_param_change_credit = 29
    arg0[29] = "log_skill_eff_stage_param_change_credit"
    arg0.log_skill_eff_stress_add = 30
    arg0[30] = "log_skill_eff_stress_add"
    arg0.log_skill_eff_earn_stress_value_change_all = 31
    arg0[31] = "log_skill_eff_earn_stress_value_change_all"
    arg0.log_skill_eff_turn_count_add = 32
    arg0[32] = "log_skill_eff_turn_count_add"
    arg0.log_skill_eff_tactic_cooldown_add = 33
    arg0[33] = "log_skill_eff_tactic_cooldown_add"
    arg0.log_skill_eff_heal = 34
    arg0[34] = "log_skill_eff_heal"
    arg0.log_skill_eff_kill = 35
    arg0[35] = "log_skill_eff_kill"
    arg0.log_half_death = 36
    arg0[36] = "log_half_death"
    arg0.log_skill_eff_monster_change = 37
    arg0[37] = "log_skill_eff_monster_change"
    arg0.log_skill_eff_create = 38
    arg0[38] = "log_skill_eff_create"
    arg0.log_skill_eff_run = 39
    arg0[39] = "log_skill_eff_run"
    arg0.log_skill_eff_max_hp = 40
    arg0[40] = "log_skill_eff_max_hp"
    arg0.log_skill_eff_max_hp_decrease = 41
    arg0[41] = "log_skill_eff_max_hp_decrease"
    arg0.log_skill_eff_unreducing_hp = 42
    arg0[42] = "log_skill_eff_unreducing_hp"
    arg0.log_skill_eff_no_loss_hp_lt = 43
    arg0[43] = "log_skill_eff_no_loss_hp_lt"
    arg0.log_skill_eff_block_card_debuff = 44
    arg0[44] = "log_skill_eff_block_card_debuff"
    arg0.log_skill_eff_heal_ban = 45
    arg0[45] = "log_skill_eff_heal_ban"
    arg0.log_skill_eff_stress_earn_ban_under_n = 46
    arg0[46] = "log_skill_eff_stress_earn_ban_under_n"
    arg0.log_skill_eff_tactic_gauge_earn_unable = 47
    arg0[47] = "log_skill_eff_tactic_gauge_earn_unable"
    arg0.log_skill_eff_energy_maintain = 48
    arg0[48] = "log_skill_eff_energy_maintain"
    arg0.log_skill_eff_energy_maintain_turn_end = 49
    arg0[49] = "log_skill_eff_energy_maintain_turn_end"
    arg0.log_skill_eff_turn_over = 50
    arg0[50] = "log_skill_eff_turn_over"
    arg0.log_turn_card = 51
    arg0[51] = "log_turn_card"
    arg0.log_turn_back = 52
    arg0[52] = "log_turn_back"
    arg0.log_collapsed = 53
    arg0[53] = "log_collapsed"
    arg0.log_dmg_coop = 54
    arg0[54] = "log_dmg_coop"
    arg0.log_talent_orlea_creation = 55
    arg0[55] = "log_talent_orlea_creation"
    arg0.log_skill_eff_card_change = 56
    arg0[56] = "log_skill_eff_card_change"
    arg0.log_monster_rage = 57
    arg0[57] = "log_monster_rage"
    arg0.log_card_talent_bind_stack = 58
    arg0[58] = "log_card_talent_bind_stack"
    arg0.log_card_talent_bind_stack_from_card_place = 59
    arg0[59] = "log_card_talent_bind_stack_from_card_place"
    arg0.log_ban_card_creation = 60
    arg0[60] = "log_ban_card_creation"
    arg0.log_skill_eff_card_talent_add = 61
    arg0[61] = "log_skill_eff_card_talent_add"
    arg0.log_skill_eff_card_talent_remove = 62
    arg0[62] = "log_skill_eff_card_talent_remove"
    arg0.log_skill_eff_card_talent_replace = 63
    arg0[63] = "log_skill_eff_card_talent_replace"
    arg0.log_skill_eff_card_connect = 64
    arg0[64] = "log_skill_eff_card_connect"
    arg0.log_talent_fairy = 65
    arg0[65] = "log_talent_fairy"
    arg0.log_card_talent_light_dark_divide = 66
    arg0[66] = "log_card_talent_light_dark_divide"
    arg0.log_card_talent_light_dark_combine = 67
    arg0[67] = "log_card_talent_light_dark_combine"
    return arg0
  }

  function anonymous_23(arg0) {
    // Bytecode 0xf00000028200 params=2 regs=0 frame=0
    arg0.BATTLE_STEP_WAVE_MODE = "BATTLE_STEP_WAVE_MODE"
    arg0.BATTLE_STEP_BOSS_MODE = "BATTLE_STEP_BOSS_MODE"
    arg0.BATTLE_STEP_BATTLE_MODE = "BATTLE_STEP_BATTLE_MODE"
    return arg0
  }

  function anonymous_24(arg0) {
    // Bytecode 0xf00000028c00 params=2 regs=0 frame=0
    arg0.EFFECT_TYPE_NONE = "EFFECT_TYPE_NONE"
    arg0.EFFECT_TYPE_COMMON = "EFFECT_TYPE_COMMON"
    arg0.EFFECT_TYPE_COMMON_NO_STACK = "EFFECT_TYPE_COMMON_NO_STACK"
    arg0.EFFECT_TYPE_PASSIVE = "EFFECT_TYPE_PASSIVE"
    arg0.EFFECT_TYPE_PASSIVE_NO_STACK = "EFFECT_TYPE_PASSIVE_NO_STACK"
    arg0.EFFECT_TYPE_TOGGLE = "EFFECT_TYPE_TOGGLE"
    return arg0
  }

  function anonymous_25(arg0) {
    // Bytecode 0xf00000029900 params=2 regs=0 frame=0
    arg0.BATTLE_SLOT_TYPE_ID = "BATTLE_SLOT_TYPE_ID"
    arg0.BATTLE_SLOT_TYPE_GROUP = "BATTLE_SLOT_TYPE_GROUP"
    arg0.BATTLE_SLOT_TYPE_SUMMON = "BATTLE_SLOT_TYPE_SUMMON"
    return arg0
  }

  function anonymous_26(arg0) {
    // Bytecode 0xf0000002a300 params=2 regs=0 frame=0
    arg0.TARGET_NOTHING = "TARGET_NOTHING"
    arg0.TARGET_MONSTER = "TARGET_MONSTER"
    return arg0
  }
  // Explicit control flow preserves exception completion and nested jumps.
  let __v8_pc = 0;
  dispatch: while (true) {
    switch (__v8_pc) {
    case 0: {
      // SwitchOnGeneratorState r0
      r3 = closure
      r4 = this
      ACCU = CreateJSGeneratorObject(r3, r4)
      r0 = ACCU
      ACCU = HOLE
      context_slot[3] = ACCU
      ACCU = HOLE
      context_slot[4] = ACCU
      ACCU = compareEnums
      r1 = ACCU
      ACCU = [16, hasOlgaTalent, 25, 25, getOlgaTalentBase, 26, 23, getOlgaTalentBaseAny, 27, 24, parseBindTalent, 28, 27, 22, matchCardPlaceSet, 29, 26]
      r3 = ACCU
      r4 = closure
      ACCU = StringReplaceNonGlobalRegExpWithFunction(r3, r4)
      ACCU = r0
      // SuspendGenerator r0, state=0
      ACCU = ResumeGenerator(r0)
      r3 = ACCU
      ACCU = GeneratorGetResumeMode(r0)
      switch (ACCU) {
      case 0:
        __v8_pc = 63;
        continue dispatch;
      case 1:
        __v8_pc = 60;
        continue dispatch;
      }
      __v8_pc = 57;
      continue dispatch;
    }
    case 57: {
      ACCU = r3
      throw ACCU
    }
    case 60: {
      ACCU = r3
      return ACCU
    }
    case 63: {
      r2 = r3
      ACCU = anonymous_2
      r3 = ACCU
      ACCU = {}
      r4 = ACCU
      ACCU = r3(r4)
      // WARNING: unsupported bytecode StaModuleVariable [17], [0] @77
      ACCU = anonymous_3
      r3 = ACCU
      ACCU = {}
      r4 = ACCU
      ACCU = r3(r4)
      // WARNING: unsupported bytecode StaModuleVariable [18], [0] @91
      ACCU = anonymous_4
      r3 = ACCU
      ACCU = {}
      r4 = ACCU
      ACCU = r3(r4)
      // WARNING: unsupported bytecode StaModuleVariable [19], [0] @105
      ACCU = [52, 55, 56]
      // WARNING: unsupported bytecode StaModuleVariable [16], [0] @112
      ACCU = new RegExp("(?:_(?:rsp\\d+|lbk|pot|mut\\d*))+$", "")
      context_slot[3] = ACCU
      ACCU = getBindGroupBaseResId
      // WARNING: unsupported bytecode StaModuleVariable [22], [0] @126
      ACCU = anonymous_6
      r3 = ACCU
      ACCU = {}
      r4 = ACCU
      ACCU = r3(r4)
      // WARNING: unsupported bytecode StaModuleVariable [8], [0] @140
      ACCU = anonymous_7
      r3 = ACCU
      ACCU = {}
      r4 = ACCU
      ACCU = r3(r4)
      // WARNING: unsupported bytecode StaModuleVariable [9], [0] @154
      ACCU = anonymous_8
      r3 = ACCU
      ACCU = {}
      r4 = ACCU
      ACCU = r3(r4)
      // WARNING: unsupported bytecode StaModuleVariable [7], [0] @168
      ACCU = anonymous_9
      r3 = ACCU
      ACCU = {}
      r4 = ACCU
      ACCU = r3(r4)
      // WARNING: unsupported bytecode StaModuleVariable [20], [0] @182
      ACCU = anonymous_10
      r3 = ACCU
      ACCU = {}
      r4 = ACCU
      ACCU = r3(r4)
      // WARNING: unsupported bytecode StaModuleVariable [6], [0] @196
      ACCU = anonymous_11
      r3 = ACCU
      ACCU = {}
      r4 = ACCU
      ACCU = r3(r4)
      // WARNING: unsupported bytecode StaModuleVariable [5], [0] @210
      ACCU = Set
      r3 = ACCU
      ACCU = Object
      r8 = ACCU
      ACCU = r8.keys
      r7 = ACCU
      // WARNING: unsupported bytecode LdaModuleVariable [5], [0] @226
      r9 = ACCU
      ACCU = r7.call(r8, r9)
      r7 = ACCU
      ACCU = r7.filter
      r6 = ACCU
      ACCU = anonymous_12
      r8 = ACCU
      ACCU = r6.call(r7, r8)
      r6 = ACCU
      ACCU = r6.map
      r5 = ACCU
      ACCU = anonymous_13
      r7 = ACCU
      ACCU = r5.call(r6, r7)
      r5 = ACCU
      ACCU = r5.filter
      r4 = ACCU
      ACCU = anonymous_14
      r6 = ACCU
      ACCU = r4.call(r5, r6)
      r4 = ACCU
      ACCU = r3
      ACCU = new r3(r4)
      context_slot[4] = ACCU
      ACCU = anonymous_16
      r3 = ACCU
      ACCU = {}
      r4 = ACCU
      ACCU = r3(r4)
      // WARNING: unsupported bytecode StaModuleVariable [15], [0] @304
      ACCU = anonymous_17
      r3 = ACCU
      ACCU = {}
      r4 = ACCU
      ACCU = r3(r4)
      // WARNING: unsupported bytecode StaModuleVariable [12], [0] @318
      ACCU = anonymous_18
      r3 = ACCU
      ACCU = {}
      r4 = ACCU
      ACCU = r3(r4)
      // WARNING: unsupported bytecode StaModuleVariable [21], [0] @332
      ACCU = anonymous_19
      r3 = ACCU
      ACCU = {}
      r4 = ACCU
      ACCU = r3(r4)
      // WARNING: unsupported bytecode StaModuleVariable [4], [0] @346
      ACCU = anonymous_20
      r3 = ACCU
      ACCU = {}
      r4 = ACCU
      ACCU = r3(r4)
      // WARNING: unsupported bytecode StaModuleVariable [13], [0] @360
      ACCU = anonymous_21
      r3 = ACCU
      ACCU = {}
      r4 = ACCU
      ACCU = r3(r4)
      // WARNING: unsupported bytecode StaModuleVariable [14], [0] @374
      ACCU = anonymous_22
      r3 = ACCU
      ACCU = {}
      r4 = ACCU
      ACCU = r3(r4)
      // WARNING: unsupported bytecode StaModuleVariable [10], [0] @388
      ACCU = anonymous_23
      r3 = ACCU
      ACCU = {}
      r4 = ACCU
      ACCU = r3(r4)
      // WARNING: unsupported bytecode StaModuleVariable [3], [0] @402
      ACCU = anonymous_24
      r3 = ACCU
      ACCU = {}
      r4 = ACCU
      ACCU = r3(r4)
      // WARNING: unsupported bytecode StaModuleVariable [11], [0] @416
      ACCU = anonymous_25
      r3 = ACCU
      ACCU = {}
      r4 = ACCU
      ACCU = r3(r4)
      // WARNING: unsupported bytecode StaModuleVariable [2], [0] @430
      ACCU = anonymous_26
      r3 = ACCU
      ACCU = {}
      r4 = ACCU
      ACCU = r3(r4)
      // WARNING: unsupported bytecode StaModuleVariable [1], [0] @444
      ACCU = r2
      return ACCU
    }
    }
  }
}

function hasOlgaTalent(arg0) {
  // Bytecode 0xf0000000a300 params=2 regs=3 frame=24
  let ACCU;
  let r1;

  function anonymous_5(arg0) {
    // Bytecode 0xf0000000a800 params=2 regs=2 frame=16
    let ACCU;
    let r1;
    // WARNING: unsupported bytecode LdaModuleVariable [16], [0] @0
    r1 = checked_lexical(ACCU, "OLGA_TALENTS")
    return r1.includes(arg0)
  }
  ACCU = arg0
  r1 = arg0
  if (!(isNullish(ACCU))) {
    ACCU = r1.some(anonymous_5)
  }
  else {
    ACCU = undefined
  }
  if (!(isNullish(ACCU))) {
  }
  else {
    ACCU = false
  }
  return ACCU
}

function getOlgaTalentBase(arg0) {
  // Bytecode 0xf0000000b100 params=2 regs=5 frame=40
  let ACCU;
  let r0, r1, r2, r3, r4;
  ACCU = 0
  r0 = 0
  loop_2:
  while (true) {
    // WARNING: unsupported bytecode LdaModuleVariable [16], [0] @2
    r2 = checked_lexical(ACCU, "OLGA_TALENTS")
    ACCU = r2.length
    ACCU = (r0 < ACCU)
    if (!(truthy(ACCU))) {
      break loop_2
    }
    r1 = arg0.startsWith
    // WARNING: unsupported bytecode LdaModuleVariable [19], [0] @22
    r3 = r1
    // WARNING: unsupported bytecode LdaModuleVariable [16], [0] @26
    r4 = r3
    ACCU = r3[r0]
    r3 = r1[ACCU]
    r3 += "_"
    ACCU = r1.call(arg0, r3)
    if (truthy(ACCU)) {
      // WARNING: unsupported bytecode LdaModuleVariable [16], [0] @52
      r1 = ACCU
      return r1[r0]
    }
    ACCU = r0
    ACCU = ++ACCU
    r0 = ACCU
  }
  return undefined
}

function getOlgaTalentBaseAny(arg0) {
  // Bytecode 0xf0000000b800 params=2 regs=4 frame=32
  let ACCU;
  let r0, r1, r2, r3;
  ACCU = 0
  r0 = 0
  loop_2:
  while (true) {
    // WARNING: unsupported bytecode LdaModuleVariable [16], [0] @2
    r2 = checked_lexical(ACCU, "OLGA_TALENTS")
    ACCU = r2.length
    ACCU = (r0 < ACCU)
    if (!(truthy(ACCU))) {
      break loop_2
    }
    // WARNING: unsupported bytecode LdaModuleVariable [19], [0] @17
    r2 = ACCU
    // WARNING: unsupported bytecode LdaModuleVariable [16], [0] @21
    r3 = r2
    ACCU = r2[r0]
    ACCU = r2[ACCU]
    ACCU = (arg0 == ACCU)
    if (truthy(ACCU)) {
      // WARNING: unsupported bytecode LdaModuleVariable [16], [0] @38
      r1 = ACCU
      return r1[r0]
    }
    ACCU = r0
    ACCU = ++ACCU
    r0 = ACCU
  }
  // WARNING: unsupported bytecode LdaModuleVariable [23], [0] @57
  r1 = ACCU
  return r1(arg0)
}

function parseBindTalent(arg0) {
  // Bytecode 0xf0000000bf00 params=2 regs=9 frame=72
  let ACCU;
  let r0, r1, r2, r3, r4, r5, r6, r7, r8;
  // WARNING: unsupported bytecode LdaModuleVariable [19], [0] @0
  r5 = ACCU
  r0 = r5[37]
  r5 = arg0.match
  r7 = RegExp
  ACCU = r0
  ACCU = to_string(ACCU)
  r8 = ("^" + ACCU)
  r8 += "(?:_(\\d+)(?:_(\\d+)(?:_(.+))?)?)?$"
  ACCU = r7
  r7 = new r7(r8)
  r1 = r5.call(arg0, r7)
  if (!(truthy(r1))) {
    return undefined
  }
  ACCU = r1[1]
  ACCU = isUndetectable(ACCU)
  if (truthy(ACCU)) {
    ACCU = 0
  }
  else {
    ACCU = Number(r1[1])
  }
  r2 = ACCU
  ACCU = r1[2]
  ACCU = isUndetectable(ACCU)
  if (truthy(ACCU)) {
    ACCU = undefined
  }
  else {
    ACCU = Number(r1[2])
  }
  r3 = ACCU
  r4 = r1[3]
  r5 = { stack: r2, max: undefined, tooltipKey: undefined };
  ACCU = r3
  ACCU = isUndetectable(ACCU)
  if (!(truthy(ACCU))) {
    ACCU = 0
    ACCU = (r3 > ACCU)
    if (truthy(ACCU)) {
      ACCU = r3
    }
    else {
      ACCU = undefined
    }
  }
  else {
    ACCU = undefined
  }
  define_literal_property(r5, "max", ACCU, false, true)
  ACCU = r4
  ACCU = isUndetectable(ACCU)
  if (!(truthy(ACCU))) {
    r6 = r4.length
    ACCU = 0
    ACCU = (r6 > ACCU)
    if (truthy(ACCU)) {
      ACCU = r4
    }
    else {
      ACCU = undefined
    }
  }
  else {
    ACCU = undefined
  }
  define_literal_property(r5, "tooltipKey", ACCU, false, true)
  return r5
}

function matchCardPlaceSet(arg0, arg1) {
  // Bytecode 0xf00000017300 params=3 regs=7 frame=56
  let ACCU;
  let r0, r1, r2, r3, r4, r5, r6;

  function anonymous_15(arg0) {
    // Bytecode 0xf00000017800 params=2 regs=2 frame=16
    // Captures: CARD_PLACE_NAMES <- anonymous_1 slot=4
    let ACCU;
    let r1;
    ACCU = CARD_PLACE_NAMES
    r1 = checked_lexical(ACCU, "CARD_PLACE_NAMES")
    return r1.has(arg0)
  }
  // Explicit control flow preserves exception completion and nested jumps.
  let __v8_pc = 0;
  dispatch: while (true) {
    switch (__v8_pc) {
    case 0: {
      ACCU = arg0
      ACCU = (typeof ACCU === "number")
      r3 = arg0
      __v8_pc = !(truthy(ACCU)) ? 50 : 9;
      continue dispatch;
    }
    case 9: {
      ACCU = -2147483648
      r2 = ACCU
      ACCU = (r3 >= ACCU)
      __v8_pc = !(truthy(ACCU)) ? 50 : 21;
      continue dispatch;
    }
    case 21: {
      ACCU = 2147483647
      r2 = ACCU
      ACCU = (r3 <= ACCU)
      __v8_pc = !(truthy(ACCU)) ? 50 : 33;
      continue dispatch;
    }
    case 33: {
      ACCU = r3
      ACCU = (ACCU | 0)
      r2 = ACCU
      ACCU = (r3 === ACCU)
      __v8_pc = !(truthy(ACCU)) ? 50 : 44;
      continue dispatch;
    }
    case 44: {
      ACCU = r2
      switch (ACCU) {
      case 0:
        __v8_pc = 52;
        continue dispatch;
      case 1:
        __v8_pc = 50;
        continue dispatch;
      case 2:
        __v8_pc = 50;
        continue dispatch;
      case 3:
        __v8_pc = 50;
        continue dispatch;
      case 4:
        __v8_pc = 50;
        continue dispatch;
      case 5:
        __v8_pc = 90;
        continue dispatch;
      case 6:
        __v8_pc = 90;
        continue dispatch;
      case 7:
        __v8_pc = 50;
        continue dispatch;
      case 8:
        __v8_pc = 52;
        continue dispatch;
      case 9:
        __v8_pc = 50;
        continue dispatch;
      case 10:
        __v8_pc = 50;
        continue dispatch;
      case 11:
        __v8_pc = 50;
        continue dispatch;
      case 12:
        __v8_pc = 54;
        continue dispatch;
      case 13:
        __v8_pc = 68;
        continue dispatch;
      }
      __v8_pc = 50;
      continue dispatch;
    }
    case 50: {
      __v8_pc = 96;
      continue dispatch;
    }
    case 52: {
      ACCU = true
      return ACCU
    }
    case 54: {
      ACCU = 4
      ACCU = (arg1 == ACCU)
      ACCU = !truthy(ACCU)
      __v8_pc = !(truthy(ACCU)) ? 67 : 62;
      continue dispatch;
    }
    case 62: {
      ACCU = 0
      ACCU = (arg1 == ACCU)
      ACCU = !truthy(ACCU)
      __v8_pc = 67;
      continue dispatch;
    }
    case 67: {
      return ACCU
    }
    case 68: {
      ACCU = 4
      ACCU = (arg1 == ACCU)
      ACCU = !truthy(ACCU)
      __v8_pc = !(truthy(ACCU)) ? 89 : 76;
      continue dispatch;
    }
    case 76: {
      ACCU = 9
      ACCU = (arg1 == ACCU)
      ACCU = !truthy(ACCU)
      __v8_pc = !(truthy(ACCU)) ? 89 : 84;
      continue dispatch;
    }
    case 84: {
      ACCU = 0
      ACCU = (arg1 == ACCU)
      ACCU = !truthy(ACCU)
      __v8_pc = 89;
      continue dispatch;
    }
    case 89: {
      return ACCU
    }
    case 90: {
      ACCU = 1
      ACCU = (arg1 == ACCU)
      return ACCU
    }
    case 96: {
      // WARNING: unsupported bytecode LdaModuleVariable [5], [0] @96
      r3 = ACCU
      ACCU = arg1
      ACCU = r3[ACCU]
      __v8_pc = isNullish(ACCU) ? 109 : 107;
      continue dispatch;
    }
    case 107: {
      __v8_pc = 111;
      continue dispatch;
    }
    case 109: {
      ACCU = ""
      __v8_pc = 111;
      continue dispatch;
    }
    case 111: {
      r3 = ACCU
      ACCU = r3.replace
      r2 = ACCU
      ACCU = "CARD_PLACE_"
      r4 = ACCU
      ACCU = ""
      r5 = ACCU
      ACCU = r2.call(r3, r4, r5)
      r0 = ACCU
      // WARNING: unsupported bytecode LdaModuleVariable [5], [0] @130
      r4 = ACCU
      ACCU = arg0
      ACCU = r4[ACCU]
      __v8_pc = isNullish(ACCU) ? 143 : 141;
      continue dispatch;
    }
    case 141: {
      __v8_pc = 145;
      continue dispatch;
    }
    case 143: {
      ACCU = ""
      __v8_pc = 145;
      continue dispatch;
    }
    case 145: {
      r4 = ACCU
      ACCU = r4.replace
      r3 = ACCU
      ACCU = "CARD_PLACE_"
      r5 = ACCU
      ACCU = ""
      r6 = ACCU
      ACCU = r3.call(r4, r5, r6)
      r3 = ACCU
      ACCU = r3.split
      r2 = ACCU
      ACCU = "_"
      r4 = ACCU
      ACCU = r2.call(r3, r4)
      r1 = ACCU
      ACCU = r1.every
      r2 = ACCU
      ACCU = anonymous_15
      r4 = ACCU
      ACCU = r2.call(r1, r4)
      __v8_pc = !(truthy(ACCU)) ? 206 : 195;
      continue dispatch;
    }
    case 195: {
      ACCU = r1.includes
      r2 = ACCU
      ACCU = r2.call(r1, r0)
      return ACCU
    }
    case 206: {
      ACCU = arg1
      ACCU = (arg0 == ACCU)
      return ACCU
    }
    }
  }
}
