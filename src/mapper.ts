import {
  FALLBACK_CONTROL_SEQUENCES,
  KNOWN_OPENCODE_ACTIONS,
  KEYPAD_ACTION_KEYS
} from "./constants.js";
import type { AppConfig, NativePadPayload } from "./types.js";

export function validateAction(action: string) {
  return KNOWN_OPENCODE_ACTIONS.includes(action as never);
}

export function ensureActionKey(action: string, config: AppConfig) {
  if (config.actionKeys[action]) {
    return config.actionKeys[action];
  }

  const used = new Set(Object.values(config.actionKeys || {}));
  const pick = KEYPAD_ACTION_KEYS.find((candidate) => !used.has(candidate));
  if (!pick) {
    throw new Error("No free function key remains for new action mapping");
  }

  config.actionKeys[action] = pick;
  return pick;
}

export function controlBindingToSequence(control: string, config: AppConfig) {
  const binding = config.bindings[config.activeAgent]?.[control];
  if (!binding) {
    return FALLBACK_CONTROL_SEQUENCES[control as keyof typeof FALLBACK_CONTROL_SEQUENCES];
  }

  const actionKey = config.actionKeys[binding];
  if (!actionKey) {
    return FALLBACK_CONTROL_SEQUENCES[control as keyof typeof FALLBACK_CONTROL_SEQUENCES];
  }

  return actionKey.replaceAll("+", "-");
}

export function effectiveActionBindings(config: AppConfig): Record<string, string> {
  const active = config.bindings[config.activeAgent] || {};
  const result: Record<string, string> = {};

  for (const action of Object.values(active)) {
    if (!action) {
      continue;
    }

    if (!config.actionKeys[action]) {
      throw new Error(`Missing action key mapping for ${action}`);
    }

    result[action] = config.actionKeys[action];
  }

  return result;
}

export function buildPadPayload(config: AppConfig): NativePadPayload {
  const controls: [string, string, string] = [
    "key-left",
    "key-middle",
    "key-right"
  ].map((control) => controlBindingToSequence(control, config)) as [string, string, string];

  const knobs = {
    ccw: controlBindingToSequence("rotary-left", config),
    press: controlBindingToSequence("rotary-click", config),
    cw: controlBindingToSequence("rotary-right", config)
  };

  return {
    orientation: "normal",
    rows: 1,
    columns: 3,
    knobs: 1,
    layers: [
      {
        buttons: controls,
        knobs: [knobs]
      }
    ]
  };
}
