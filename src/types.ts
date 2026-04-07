export type ControlName =
  | "key-left"
  | "key-middle"
  | "key-right"
  | "rotary-left"
  | "rotary-click"
  | "rotary-right";

export type BindingMap = Partial<Record<ControlName, string>>;

export interface AppConfig {
  version: number;
  activeAgent: string;
  activeKeypad: string;
  activeProfile: string | null;
  bindings: Record<string, BindingMap>;
  profiles: Record<string, ProfileState>;
  actionKeys: Record<string, string>;
  lastSync: Record<string, LastSyncMeta>;
}

export interface ProfileState {
  activeAgent: string;
  activeKeypad: string;
  bindings: Record<string, BindingMap>;
  actionKeys: Record<string, string>;
}

export interface LastSyncMeta {
  payload: string;
  agent: string;
  updatedAt: string;
}

export interface KeypadMeta {
  slug: string;
  name: string;
  vid: number;
  pid: number;
}

export type NativePadPayload = {
  orientation: string;
  rows: number;
  columns: number;
  knobs: number;
  layers: Array<{
    buttons: [string, string, string];
    knobs: [{
      ccw: string;
      press: string;
      cw: string;
    }];
  }>;
};
