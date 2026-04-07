import { promises as fs } from "node:fs";
import path from "node:path";
import { homedir } from "node:os";

const TUI_PATH = {
  win32: () => path.join(process.env.APPDATA || path.join(homedir(), "AppData", "Roaming"), "opencode", "tui.json"),
  darwin: () => path.join(homedir(), ".config", "opencode", "tui.json"),
  linux: () => path.join(process.env.XDG_CONFIG_HOME || path.join(homedir(), ".config"), "opencode", "tui.json")
};

export function getTuiPath() {
  const builder = TUI_PATH[process.platform] || TUI_PATH.linux;
  return builder();
}

function getStateKeybinds() {
  return {
    filePath: getTuiPath(),
    detected: true,
    display: "OpenCode"
  };
}

export async function listAgents() {
  const state = getStateKeybinds();
  return [{
    slug: "opencode",
    name: state.display,
    detected: await exists(state.filePath),
    configPath: state.filePath
  }];
}

async function exists(filePath: string) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

export async function loadTuiConfig() {
  try {
    const raw = await fs.readFile(getTuiPath(), "utf8");
    return JSON.parse(raw);
  } catch (error: unknown) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return {
        "$schema": "https://opencode.ai/tui.json"
      };
    }

    throw error;
  }
}

export async function writeTuiConfig(payload: unknown) {
  await fs.mkdir(path.dirname(getTuiPath()), { recursive: true });
  await fs.writeFile(getTuiPath(), `${JSON.stringify(payload, null, 2)}\n`, "utf8");
}

export async function patchTuiKeybinds(actionKeyMap: Record<string, string>) {
  const before = await loadTuiConfig();
  const after = {
    ...before
  };

  after.keybinds = {
    ...(before.keybinds && typeof before.keybinds === "object" ? before.keybinds : {})
  };

  let changed = false;
  for (const [action, key] of Object.entries(actionKeyMap)) {
    const existing = after.keybinds[action];
    if (existing !== key) {
      after.keybinds[action] = key;
      changed = true;
    }
  }

  if (!changed) {
    return { changed: false, config: after };
  }

  await writeTuiConfig(after);
  return { changed: true, config: after };
}
