import { promises as fs } from "node:fs";
import path from "node:path";
import { homedir } from "node:os";

import { APP_NAME, CONFIG_FILE, defaultState } from "./constants.js";
import type { AppConfig } from "./types.js";

function getConfigDir() {
  if (process.platform === "win32") {
    return path.join(process.env.APPDATA || path.join(homedir(), "AppData", "Roaming"), APP_NAME);
  }

  const xdg = process.env.XDG_CONFIG_HOME;
  return path.join(xdg ? xdg : path.join(homedir(), ".config"), APP_NAME);
}

export function getConfigPath() {
  return path.join(getConfigDir(), CONFIG_FILE);
}

export async function readConfig(): Promise<AppConfig> {
  const configPath = getConfigPath();
  try {
    const raw = await fs.readFile(configPath, "utf8");
    const parsed = JSON.parse(raw);
    return normalizeConfig(parsed);
  } catch (error: unknown) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return defaultState() as AppConfig;
    }

    throw error;
  }
}

function normalizeConfig(config: any): AppConfig {
  const normalizedBindings = config.bindings && typeof config.bindings === "object" ? { ...config.bindings } : {};

  if (normalizedBindings && typeof normalizedBindings === "object") {
    if (Object.prototype.hasOwnProperty.call(normalizedBindings, "null")) {
      delete normalizedBindings.null;
    }
  }

  return {
    version: typeof config.version === "number" ? config.version : 1,
    activeAgent: config.activeAgent || "opencode",
    activeKeypad: config.activeKeypad || "ch57x",
    activeProfile: typeof config.activeProfile === "string" ? config.activeProfile : null,
    bindings: normalizedBindings,
    profiles: config.profiles && typeof config.profiles === "object" ? config.profiles : {},
    actionKeys: config.actionKeys && typeof config.actionKeys === "object" ? config.actionKeys : {},
    lastSync: config.lastSync && typeof config.lastSync === "object" ? config.lastSync : {}
  };
}

export async function writeConfig(config: AppConfig) {
  const configPath = getConfigPath();
  await fs.mkdir(path.dirname(configPath), { recursive: true });
  const payload = {
    ...config,
    version: 1
  };
  await fs.writeFile(configPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
}
