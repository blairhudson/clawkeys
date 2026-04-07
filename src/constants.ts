export const APP_NAME = "clawkeys";
export const CONFIG_FILE = "config.json";

export const SUPPORTED_CONTROLS = [
  "key-left",
  "key-middle",
  "key-right",
  "rotary-left",
  "rotary-click",
  "rotary-right"
] as const;

export const CH57X_VID = 0x1189;
export const CH57X_PID = 0x8890;

export const FALLBACK_CONTROL_SEQUENCES = {
  "key-left": "enter",
  "key-middle": "right,enter",
  "key-right": "right,right,enter",
  "rotary-left": "shift-f13",
  "rotary-click": "tab",
  "rotary-right": "f13"
} as const;

export const KNOWN_OPENCODE_ACTIONS = [
  "leader",
  "app_exit",
  "editor_open",
  "theme_list",
  "sidebar_toggle",
  "scrollbar_toggle",
  "username_toggle",
  "status_view",
  "session_export",
  "session_new",
  "session_list",
  "session_timeline",
  "session_fork",
  "session_rename",
  "session_delete",
  "stash_delete",
  "model_provider_list",
  "model_favorite_toggle",
  "session_share",
  "session_unshare",
  "session_interrupt",
  "session_compact",
  "messages_page_up",
  "messages_page_down",
  "messages_line_up",
  "messages_line_down",
  "messages_half_page_up",
  "messages_half_page_down",
  "messages_first",
  "messages_last",
  "messages_next",
  "messages_previous",
  "messages_last_user",
  "messages_copy",
  "messages_undo",
  "messages_redo",
  "messages_toggle_conceal",
  "tool_details",
  "model_list",
  "model_cycle_recent",
  "model_cycle_recent_reverse",
  "model_cycle_favorite",
  "model_cycle_favorite_reverse",
  "command_list",
  "agent_list",
  "agent_cycle",
  "agent_cycle_reverse",
  "variant_cycle",
  "input_clear",
  "input_paste",
  "input_submit",
  "input_newline",
  "input_move_left",
  "input_move_right",
  "input_move_up",
  "input_move_down",
  "input_select_left",
  "input_select_right",
  "input_select_up",
  "input_select_down",
  "input_line_home",
  "input_line_end",
  "input_select_line_home",
  "input_select_line_end",
  "input_visual_line_home",
  "input_visual_line_end",
  "input_select_visual_line_home",
  "input_select_visual_line_end",
  "input_buffer_home",
  "input_buffer_end",
  "input_select_buffer_home",
  "input_select_buffer_end",
  "input_delete_line",
  "input_delete_to_line_end",
  "input_delete_to_line_start",
  "input_backspace",
  "input_delete",
  "input_undo",
  "input_redo",
  "input_word_forward",
  "input_word_backward",
  "input_select_word_forward",
  "input_select_word_backward",
  "input_delete_word_forward",
  "input_delete_word_backward",
  "history_previous",
  "history_next",
  "session_child_first",
  "session_child_cycle",
  "session_child_cycle_reverse",
  "session_parent",
  "terminal_suspend",
  "terminal_title_toggle",
  "tips_toggle",
  "plugin_manager",
  "display_thinking"
] as const;

export const DEFAULT_ACTION_TO_KEY = {
  "agent_cycle": "tab",
  "model_cycle_recent": "f13",
  "model_cycle_recent_reverse": "shift+f13"
};

export const KEYPAD_ACTION_KEYS = [
  "f13",
  "f14",
  "f15",
  "f16",
  "f17",
  "f18",
  "f19",
  "f20",
  "f21",
  "f22",
  "f23",
  "f24",
  "shift+f13",
  "shift+f14",
  "shift+f15",
  "shift+f16",
  "shift+f17",
  "shift+f18",
  "shift+f19",
  "shift+f20",
  "shift+f21",
  "shift+f22",
  "shift+f23",
  "shift+f24"
] as const;

export const CONTROL_DISPLAY = {
  "key-left": "Key Left",
  "key-middle": "Key Middle",
  "key-right": "Key Right",
  "rotary-left": "Rotary Left",
  "rotary-click": "Rotary Click",
  "rotary-right": "Rotary Right"
};

export const CONTROL_DEFAULT_TOKENS = {
  "key-left": "approve_once",
  "key-middle": "approve_always",
  "key-right": "reject"
};

export function defaultState() {
    return {
      version: 1,
      activeAgent: "opencode",
      activeKeypad: "ch57x",
      activeProfile: null,
      bindings: {
        opencode: {
          "rotary-left": "model_cycle_recent_reverse",
          "rotary-click": "agent_cycle",
          "rotary-right": "model_cycle_recent"
        }
      },
      profiles: {},
      actionKeys: {
        ...DEFAULT_ACTION_TO_KEY
      },
      lastSync: {}
    };
}
