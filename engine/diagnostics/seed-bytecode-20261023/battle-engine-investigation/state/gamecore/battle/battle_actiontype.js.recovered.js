function anonymous_1() {
  // Bytecode 0xf00000000100 params=1 regs=4 frame=32
  let ACCU;
  let r0, r1, r2, r3;

  function anonymous_2(arg0) {
    // Bytecode 0xf00000000600 params=2 regs=3 frame=24
    arg0.action_none = 0
    arg0[0] = "action_none"
    arg0.action_battle_log = "action_battle_log"
    arg0.action_toast = "action_toast"
    arg0.action_group_start = "action_group_start"
    arg0.action_group_end = "action_group_end"
    arg0.action_player_turn = "action_player_turn"
    arg0.action_enemy_turn = "action_enemy_turn"
    arg0.action_boss_step = "action_boss_step"
    arg0.action_kill = "action_kill"
    arg0.action_motion_start = "action_motion_start"
    arg0.action_damage = "action_damage"
    arg0.action_stress_death = "action_stress_death"
    arg0.action_damage_auto = "action_damage_auto"
    arg0.action_shield = "action_shield"
    arg0.action_shield_auto = "action_shield_auto"
    arg0.action_shield_change = "action_shield_change"
    arg0.action_shield_expire = "action_shield_expire"
    arg0.action_heal = "action_heal"
    arg0.action_maxhp_decrease = "action_maxhp_decrease"
    arg0.action_hp_refresh = "action_hp_refresh"
    arg0.action_ego_field = "action_ego_field"
    arg0.action_ego_field_max = "action_ego_field_max"
    arg0.action_turn_over = "action_turn_over"
    arg0.action_monster_wave = "action_monster_wave"
    arg0.action_monster_half_death = "action_monster_half_death"
    arg0.action_monster_half_death_revive = "action_monster_half_death_revive"
    arg0.action_monster_death = "action_monster_death"
    arg0.action_monster_summon_death = "action_monster_summon_death"
    arg0.action_user_death = "action_user_death"
    arg0.action_monster_run = "action_monster_run"
    arg0.action_monster_clocking = "action_monster_clocking"
    arg0.action_monster_unclocking = "action_monster_unclocking"
    arg0.action_monster_card_use = "action_monster_card_use"
    arg0.action_monster_card_use_end = "action_monster_card_use_end"
    arg0.action_collapse_on = "action_collapse_on"
    arg0.action_collapse_off = "action_collapse_off"
    arg0.action_chain_gauge = "action_chain_gauge"
    arg0.action_card_use_power = "action_card_use_power"
    arg0.action_card_use = "action_card_use"
    arg0.action_card_use_collapse = "action_card_use_collapse"
    arg0.action_card_exhibit = "action_card_exhibit"
    arg0.action_player_card_use = "action_player_card_use"
    arg0.action_card_reserve = "action_card_reserve"
    arg0.action_tactic_gauge = "action_tactic_gauge"
    arg0.action_ep_skill_slots = "action_ep_skill_slots"
    arg0.action_tactic_skill = "action_tactic_skill"
    arg0.action_tactic_cooltime = "action_tactic_cooltime"
    arg0.action_tactic_cost = "action_tactic_cost"
    arg0.action_temp_ep_skill_remove = "action_temp_ep_skill_remove"
    arg0.action_card_turn_discard = "action_card_turn_discard"
    arg0.action_card_move = "action_card_move"
    arg0.action_card_copy = "action_card_copy"
    arg0.action_card_change = "action_card_change"
    arg0.action_collapse_card_change = "action_collapse_card_change"
    arg0.action_collapse_bless = "action_collapse_bless"
    arg0.action_stage_card_refresh = "action_stage_card_refresh"
    arg0.action_card_get = "action_card_get"
    arg0.action_card_shuffle = "action_card_shuffle"
    arg0.action_card_return = "action_card_return"
    arg0.action_card_select_auto = "action_card_select_auto"
    arg0.action_card_res_select_auto = "action_card_res_select_auto"
    arg0.action_card_option_select_auto = "action_card_option_select_auto"
    arg0.action_card_r_spark_select_auto = "action_card_r_spark_select_auto"
    arg0.action_battle_event_auto = "action_battle_event_auto"
    arg0.action_card_select_spark = "action_card_select_spark"
    arg0.action_card_select = "action_card_select"
    arg0.action_card_res_select = "action_card_res_select"
    arg0.action_card_option_select = "action_card_option_select"
    arg0.action_card_r_spark_select = "action_card_r_spark_select"
    arg0.action_card_rspark = "action_card_rspark"
    arg0.action_card_yspark = "action_card_yspark"
    arg0.action_battle_event = "action_battle_event"
    arg0.action_battle_continue = "action_battle_continue"
    arg0.action_card_turn_draw = "action_card_turn_draw"
    arg0.action_card_hand_full = "action_card_hand_full"
    arg0.action_card_usable = "action_card_usable"
    arg0.action_card_talent = "action_card_talent"
    arg0.action_card_talent_count = "action_card_talent_count"
    arg0.action_card_talent_tipera = "action_card_talent_tipera"
    arg0.action_card_talent_olga = "action_card_talent_olga"
    arg0.action_card_cost = "action_card_cost"
    arg0.action_card_retain = "action_card_retain"
    arg0.action_card_banned = "action_card_banned"
    arg0.action_card_debuff = "action_card_debuff"
    arg0.action_card_bind = "action_card_bind"
    arg0.action_card_ignite = "action_card_ignite"
    arg0.action_card_connect = "action_card_connect"
    arg0.action_card_lead = "action_card_lead"
    arg0.action_card_change_ego = "action_card_change_ego"
    arg0.action_card_refresh = "action_card_refresh"
    arg0.action_card_text_refresh = "action_card_text_refresh"
    arg0.action_cards_refresh = "action_cards_refresh"
    arg0.action_card_highlight = "action_card_highlight"
    arg0.action_card_replace = "action_card_replace"
    arg0.action_card_remove = "action_card_remove"
    arg0.action_energy_set = "action_energy_set"
    arg0.action_energy_change = "action_energy_change"
    arg0.action_deck_setting = "action_deck_setting"
    arg0.action_battle_win = "action_battle_win"
    arg0.action_battle_lose = "action_battle_lose"
    arg0.action_battle_prelose = "action_battle_prelose"
    arg0.action_battle_skip = "action_battle_skip"
    arg0.action_battle_restart = "action_battle_restart"
    arg0.action_battle_break_in = "action_battle_break_in"
    arg0.action_battle_spot_intrude = "action_battle_spot_intrude"
    arg0.action_battle_dice = "action_battle_dice"
    arg0.action_stagecs = "action_stagecs"
    arg0.action_cs_new = "action_cs_new"
    arg0.action_cs_value_change = "action_cs_value_change"
    arg0.action_cs_remove = "action_cs_remove"
    arg0.action_cs_trigger = "action_cs_trigger"
    arg0.action_cs_chain_attack = "action_cs_chain_attack"
    arg0.action_coop_chain_attack = "action_coop_chain_attack"
    arg0.action_system_effect = "action_system_effect"
    arg0.action_stagecs_active = "action_stagecs_active"
    arg0.action_phase_change = "action_phase_change"
    arg0.action_monster_noti = "action_monster_noti"
    arg0.action_monster_change = "action_monster_change"
    arg0.action_monster_summon = "action_monster_summon"
    arg0.action_monster_hpmark = "action_monster_hpmark"
    arg0.action_monster_unlock = "action_monster_unlock"
    arg0.action_monster_move = "action_monster_move"
    arg0.action_monster_turn_count = "action_monster_turn_count"
    arg0.action_relic_stack = "action_relic_stack"
    arg0.action_relic_active = "action_relic_active"
    arg0.action_relic_ready = "action_relic_ready"
    arg0.action_relic_ready_off = "action_relic_ready_off"
    arg0.action_relic_inactive = "action_relic_inactive"
    arg0.action_relic_loop = "action_relic_loop"
    arg0.action_relic_loop_end = "action_relic_loop_end"
    arg0.action_relic_remove = "action_relic_remove"
    arg0.action_ego_active = "action_ego_active"
    arg0.action_collapse_active = "action_collapse_active"
    arg0.action_spot_reward = "action_spot_reward"
    arg0.action_stage_result = "action_stage_result"
    arg0.action_ingame_currency = "action_ingame_currency"
    arg0.action_drop_reward = "action_drop_reward"
    arg0.action_drop_enc_quest_reward = "action_drop_enc_quest_reward"
    arg0.action_view_return = "action_view_return"
    arg0.action_npc_enter = "action_npc_enter"
    arg0.action_char_change = "action_char_change"
    arg0.action_char_add = "action_char_add"
    arg0.action_char_enter = "action_char_enter"
    arg0.action_tutorial = "action_tutorial"
    arg0.action_tutorial_account_skill = "action_tutorial_account_skill"
    arg0.action_tutorial_stress_add = "action_tutorial_stress_add"
    arg0.action_preset_play = "action_preset_play"
    arg0.action_story = "action_story"
    arg0.action_video = "action_video"
    arg0.action_prop_create = "action_prop_create"
    arg0.action_prop_remove = "action_prop_remove"
    arg0.action_prop_command = "action_prop_command"
    arg0.action_stress_change = "action_stress_change"
    arg0.action_stress_change_wait = "action_stress_change_wait"
    arg0.action_stress_change_none_collapse = "action_stress_change_none_collapse"
    arg0.action_fatal_attack = "action_fatal_attack"
    arg0.action_fatal_auto_attack = "action_fatal_auto_attack"
    arg0.action_link_crash = "action_link_crash"
    arg0.action_balloon = "action_balloon"
    arg0.action_balloon_judas = "action_balloon_judas"
    arg0.action_dpt_info = "action_dpt_info"
    arg0.action_next_story_contents = "action_next_story_contents"
    arg0.action_char_unique_ui_change = "action_char_unique_ui_change"
    arg0.action_custom_r_spark_select = "action_custom_r_spark_select"
    arg0.action_stack = "action_stack"
    arg0.action_stack_use = "action_stack_use"
    arg0.action_stack_reset = "action_stack_reset"
    arg0.action_score_bonus = "action_score_bonus"
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
