import { listAgents, getTuiPath } from "./opencode.js";
import { CONTROL_DEFAULT_TOKENS, CONTROL_DISPLAY, KNOWN_OPENCODE_ACTIONS, SUPPORTED_CONTROLS, defaultState } from "./constants.js";
import { listKeypadCatalog, isKnownKeypadConnected, supportedKeypadSlugs } from "./keypad.js";
import { buildPadPayload, controlBindingToSequence, ensureActionKey, validateAction } from "./mapper.js";
import { payloadHash, syncIfNeeded } from "./sync.js";
import { readConfig, writeConfig } from "./config.js";

function usage() {
  return [
    "clawkeys (ck)",
    "",
    "Usage:",
    "  ck list",
    "  ck list agents",
    "  ck list keypads",
    "  ck use agent <name>",
    "  ck use keypad <name>",
    "  ck keybinds <control> <action>",
    "  ck profile save <name>",
    "  ck profile load <name>",
    "  ck profile list",
    "  ck profile load default (restore built-in defaults)",
    "  ck status",
    "",
    "Controls:",
    "  key-left | key-middle | key-right | rotary-left | rotary-click | rotary-right",
    "  Restore defaults: default | key-left=approve_once | key-middle=approve_always | key-right=reject",
    ""
  ].join("\n");
}

function printHeader(title: string) {
  console.log(title);
  console.log("-".repeat(title.length));
}

const CONTROL_DEFAULT_TOKEN = "default";
const BUILTIN_PROFILE_NAME = "default";

function defaultBindingTokenFor(control: string) {
  return CONTROL_DEFAULT_TOKENS[control as keyof typeof CONTROL_DEFAULT_TOKENS] || CONTROL_DEFAULT_TOKEN;
}

function cloneProfileSnapshot(config: { activeAgent: string; activeKeypad: string; bindings: Record<string, unknown>; actionKeys: Record<string, string> }) {
  return {
    activeAgent: config.activeAgent,
    activeKeypad: config.activeKeypad,
    bindings: JSON.parse(JSON.stringify(config.bindings)),
    actionKeys: { ...config.actionKeys }
  };
}

function clearActiveProfileIfChanged(config: { activeProfile: string | null }, changed: boolean) {
  if (changed) {
    config.activeProfile = null;
  }
}

function formatSyncMessage(actionLabel: string, result: any) {
  if (result.reason === "up-to-date") {
    return `${actionLabel}. No upload needed.`;
  }

  if (result.synced) {
    return `${actionLabel}. Synced keypad.`;
  }

  if (result.reason === "helper-missing") {
    const hint = "Reinstall @clawkeys/ck so the matching platform package can provide the bundled helper, or set CLAWKEYS_TOOL_PATH to override it with a compatible ch57x-keyboard-tool binary.";
    return `${actionLabel}. Native helper unavailable. ${hint}`;
  }

  if (result.reason === "upload-failed") {
    return `${actionLabel}. Upload failed. ${result.details || "No details provided"}`;
  }

  if (result.reason === "keypad-not-connected") {
    return `${actionLabel}. No keypad detected with the configured mapping.`;
  }

  return `${actionLabel}. ${result.reason}.`;
}

export async function run(argv: string[] = []) {
  const command = argv[0];

  if (!command) {
    console.log(usage());
    return;
  }

  if (command === "--help" || command === "-h") {
    console.log(usage());
    return;
  }

  const config = await readConfig();

  if (command === "list") {
    const mode = argv[1];
    if (!mode) {
      const agents = await listAgents();
      const keypads = listKeypadCatalog();
      const connected = await isKnownKeypadConnected(config.activeKeypad || "ch57x");

      printHeader("Agents");
      for (const agent of agents) {
        const active = agent.slug === config.activeAgent ? "*" : " ";
        const status = agent.detected ? "detected" : "not detected";
        console.log(`${active} ${agent.slug.padEnd(10)} ${status}  (${agent.configPath})`);
      }

      printHeader("Keypads");
      for (const keypad of keypads) {
        const active = keypad.slug === config.activeKeypad ? "*" : " ";
        const isConnected = await isKnownKeypadConnected(keypad.slug);
        console.log(`${active} ${keypad.slug.padEnd(10)} ${isConnected ? "connected" : "not connected"}`);
      }

      const payload = buildPadPayload(config);
      const hash = payloadHash(payload);
      console.log(`\nCurrent map hash: ${hash}`);
      console.log(`Active keypad connected: ${connected ? "yes" : "no"}`);
      return;
    }

    if (mode === "agents") {
      const agents = await listAgents();
      printHeader("Agents");
      for (const agent of agents) {
        const status = agent.detected ? "detected" : "not detected";
        console.log(`${agent.slug.padEnd(14)} ${status}  ${agent.configPath}`);
      }
      return;
    }

    if (mode === "keypads") {
      const keypads = listKeypadCatalog();
      printHeader("Keypads");
      for (const keypad of keypads) {
        const connected = await isKnownKeypadConnected(keypad.slug);
        console.log(`${keypad.slug.padEnd(14)} ${connected ? "connected" : "not connected"}`);
      }
      return;
    }

    console.error("Unknown list target. Use: ck list | agents | keypads");
    process.exitCode = 1;
    return;
  }

  if (command === "status") {
    const agents = await listAgents();
    const keypads = listKeypadCatalog();
    const activeAgent = agents.find((agent) => agent.slug === config.activeAgent) || agents[0];
    const activeKeypad = keypads.find((keypad) => keypad.slug === config.activeKeypad);
    const connected = await isKnownKeypadConnected(config.activeKeypad || "ch57x");

    printHeader("Status");
    console.log(`Agent:    ${activeAgent ? `${activeAgent.slug} (${activeAgent.name || ""})` : config.activeAgent}`);
    console.log(`Keypad:   ${activeKeypad ? `${activeKeypad.slug} (${activeKeypad.name})` : config.activeKeypad}`);
    console.log(`Profile:  ${config.activeProfile || "none"}`);
    console.log(`Connected: ${connected ? "yes" : "no"}`);
    console.log(`tui.json: ${getTuiPath()}`);
    console.log("\nBindings:");

    const activeBindings = config.bindings[config.activeAgent] || {};
    for (const control of SUPPORTED_CONTROLS) {
      const action = activeBindings[control] || "<unmapped>";
      const seq = controlBindingToSequence(control, config);
      const label = CONTROL_DISPLAY[control] || control;
      const prettyAction = action === "<unmapped>" ? (CONTROL_DEFAULT_TOKENS[control as keyof typeof CONTROL_DEFAULT_TOKENS] || "default") : `${action}`;
      console.log(`${label.padEnd(14)}  ${prettyAction.padEnd(34)} -> ${seq}`);
    }

    const payload = buildPadPayload(config);
    const hash = payloadHash(payload);
    const key = `${config.activeAgent}:${config.activeKeypad}`;
    const previous = config.lastSync[key];
    console.log(`\nPad map hash: ${hash}`);
    if (!previous) {
      console.log("Last synced: never");
    } else if (previous.payload === hash) {
      console.log(`Last synced: up to date (${previous.updatedAt || "no timestamp"})`);
    } else {
      console.log(`Last synced: previous hash ${previous.payload}`);
    }
    return;
  }

  if (command === "use") {
    const kind = argv[1];
    const value = argv[2];

    if (!kind || !value) {
      console.error("Usage: ck use agent <name> | ck use keypad <name>");
      process.exitCode = 1;
      return;
    }

    if (kind === "agent") {
      const agents = await listAgents();
      const found = agents.find((agent) => agent.slug === value);
      if (!found) {
        const options = agents.map((agent) => agent.slug).join(", ");
        console.error(`Unknown agent ${value}. Available: ${options}`);
        process.exitCode = 1;
        return;
      }

      if (!found.detected) {
        console.warn(`Warning: ${value} config not detected at ${found.configPath}. CLI will create/update file on first sync.`);
      }

      const changed = config.activeAgent !== value;
      config.activeAgent = value;
      clearActiveProfileIfChanged(config, changed);
      await writeConfig(config);

      const result = await syncIfNeeded(config);
      await writeConfig(config);
      console.log(formatSyncMessage(`Active agent set to ${value}`, result));
      return;
    }

    if (kind === "keypad") {
      const supported = supportedKeypadSlugs();
      if (!supported.includes(value)) {
        console.error(`Unknown keypad ${value}. Supported: ${supported.join(", ")}`);
        process.exitCode = 1;
        return;
      }

      const changed = config.activeKeypad !== value;
      config.activeKeypad = value;
      clearActiveProfileIfChanged(config, changed);
      await writeConfig(config);
      const result = await syncIfNeeded(config);
      await writeConfig(config);
      console.log(formatSyncMessage(`Active keypad set to ${value}`, result));
      return;
    }

    console.error("Unknown use target. Use: ck use agent <name> or ck use keypad <name>");
    process.exitCode = 1;
    return;
  }

  if (command === "profile") {
    const subcommand = argv[1];
    const name = argv[2];

    if (subcommand === "list") {
      const profiles = Object.keys(config.profiles || {});
      printHeader("Profiles");
      const builtinMarker = config.activeProfile ? " " : "*";
      console.log(`${builtinMarker} ${BUILTIN_PROFILE_NAME} (built-in defaults)`);
      if (profiles.length === 0) {
        console.log("No saved profiles");
        return;
      }

      for (const profileName of profiles) {
        const marker = profileName === config.activeProfile ? "*" : " ";
        console.log(`${marker} ${profileName}`);
      }
      return;
    }

    if (subcommand === "save") {
      if (!name) {
        console.error("Usage: ck profile save <name>");
        process.exitCode = 1;
        return;
      }

      if (name === BUILTIN_PROFILE_NAME) {
        console.error(`Cannot save profile ${BUILTIN_PROFILE_NAME}; use ${BUILTIN_PROFILE_NAME} only for built-in defaults.`);
        process.exitCode = 1;
        return;
      }

      config.profiles = config.profiles || {};
      config.profiles[name] = cloneProfileSnapshot(config);
      config.activeProfile = name;
      await writeConfig(config);
      console.log(`Saved profile ${name}`);
      return;
    }

    if (subcommand === "load") {
      if (!name) {
        console.error("Usage: ck profile load <name>");
        process.exitCode = 1;
        return;
      }

      if (name === BUILTIN_PROFILE_NAME) {
        const defaults = defaultState();
        config.activeProfile = null;
        config.activeAgent = defaults.activeAgent;
        config.activeKeypad = defaults.activeKeypad;
        config.bindings = JSON.parse(JSON.stringify(defaults.bindings));
        config.actionKeys = { ...defaults.actionKeys };

        const result = await syncIfNeeded(config);
        await writeConfig(config);
        console.log(formatSyncMessage("Loaded built-in default profile", result));
        return;
      }

      const profile = config.profiles && config.profiles[name];
      if (!profile) {
        const candidates = Object.keys(config.profiles || {}).join(", ");
        console.error(`Unknown profile ${name}. Saved profiles: ${candidates || "none"}`);
        process.exitCode = 1;
        return;
      }

      config.activeProfile = name;
      config.activeAgent = profile.activeAgent || config.activeAgent;
      config.activeKeypad = profile.activeKeypad || config.activeKeypad;
      config.bindings = JSON.parse(JSON.stringify(profile.bindings || {}));
      config.actionKeys = { ...(profile.actionKeys || {}) };

      const result = await syncIfNeeded(config);
      await writeConfig(config);
      console.log(formatSyncMessage(`Loaded profile ${name}`, result));
      return;
    }

    console.error("Unknown profile command. Use: ck profile save <name> | ck profile load <name> | ck profile list");
    process.exitCode = 1;
    return;
  }

  if (command === "keybinds") {
    const control = argv[1];
    const action = argv[2];
    if (!control || !action) {
      console.error("Usage: ck keybinds <control> <action>");
      process.exitCode = 1;
      return;
    }

    if (!SUPPORTED_CONTROLS.includes(control as never)) {
      console.error(`Unknown control ${control}`);
      console.error(`Controls: ${SUPPORTED_CONTROLS.join(", ")}`);
      process.exitCode = 1;
      return;
    }

    const resetToken = defaultBindingTokenFor(control);

    if (action === CONTROL_DEFAULT_TOKEN || action === resetToken) {
      const previous = config.bindings[config.activeAgent]?.[control];
      if (config.bindings[config.activeAgent]) {
        delete config.bindings[config.activeAgent][control];
      }

      clearActiveProfileIfChanged(config, previous !== undefined);

      await writeConfig(config);
      const result = await syncIfNeeded(config);
      await writeConfig(config);

      console.log(formatSyncMessage(`Restored ${control} to default`, result));
      return;
    }

    if (!validateAction(action)) {
      console.error(`Unknown OpenCode action ${action}`);
      const hints = Object.entries(CONTROL_DEFAULT_TOKENS).map(([key, token]) => `${key}=${token}`).join(", ");
      console.error(`Known actions: ${KNOWN_OPENCODE_ACTIONS.slice(0, 12).join(", ")}, ...`);
      console.error(`Use '${CONTROL_DEFAULT_TOKEN}' or ${Object.values(CONTROL_DEFAULT_TOKENS).join(", ")} to restore defaults (${hints}).`);
      process.exitCode = 1;
      return;
    }

    const previous = config.bindings[config.activeAgent]?.[control];
    config.bindings[config.activeAgent] = config.bindings[config.activeAgent] || {};
    config.bindings[config.activeAgent][control] = action;
    ensureActionKey(action, config);
    clearActiveProfileIfChanged(config, previous !== action);

    await writeConfig(config);
    const result = await syncIfNeeded(config);
    await writeConfig(config);

    console.log(formatSyncMessage(`Updated binding ${control} -> ${action}`, result));
    return;
  }

  console.error(`Unknown command: ${command}`);
  console.log(usage());
  process.exitCode = 1;
}

export default run;
