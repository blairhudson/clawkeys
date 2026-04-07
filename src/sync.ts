import { createHash } from "node:crypto";

import { buildPadPayload, effectiveActionBindings } from "./mapper.js";
import { getKeypadMeta, runPadUpload } from "./keypad.js";
import { isKnownKeypadConnected as nativeConnected } from "./native.js";
import { patchTuiKeybinds } from "./opencode.js";
import type { AppConfig } from "./types.js";

function serializePayload(payload: any) {
  const text = [
    `orientation: ${payload.orientation}`,
    `rows: ${payload.rows}`,
    `columns: ${payload.columns}`,
    `knobs: ${payload.knobs}`,
    "layers:",
    "  - buttons:",
    `    - [\"${payload.layers[0].buttons[0]}\", \"${payload.layers[0].buttons[1]}\", \"${payload.layers[0].buttons[2]}\"]`,
    "    knobs:",
    `      - ccw: \"${payload.layers[0].knobs[0].ccw}\"`,
    `        press: \"${payload.layers[0].knobs[0].press}\"`,
    `        cw: \"${payload.layers[0].knobs[0].cw}\"`
  ].join("\n") + "\n";

  return text;
}

function payloadHash(payload: any) {
  return createHash("sha256").update(serializePayload(payload)).digest("hex");
}

export async function syncIfNeeded(config: AppConfig) {
  const activeAgent = config.activeAgent || "opencode";
  const key = `${activeAgent}:${config.activeKeypad}`;

  const actionBindings = effectiveActionBindings(config);
  await patchTuiKeybinds(actionBindings);

  const payload = buildPadPayload(config);
  const hash = payloadHash(payload);

  if (config.lastSync[key] && config.lastSync[key].payload === hash && config.lastSync[key].agent === activeAgent) {
    return {
      changed: false,
      synced: false,
      reason: "up-to-date",
      hash
    };
  }

  let connected = false;
  try {
    const selected = getKeypadMeta(config.activeKeypad || "ch57x");
    if (!selected) {
      return {
        changed: true,
        synced: false,
        reason: "keypad-not-connected",
        hash
      };
    }

    connected = await nativeConnected(selected.vid, selected.pid);
  } catch (error: unknown) {
    return {
      changed: true,
      synced: false,
      reason: "helper-missing",
      details: (error as Error).message || "No keypad connectivity addon available",
      hash
    };
  }

  if (!connected) {
    return {
      changed: true,
      synced: false,
      reason: "keypad-not-connected",
      hash
    };
  }

  const yaml = serializePayload(payload);
  try {
    await runPadUpload(yaml);
  } catch (error: unknown) {
    const details = error instanceof Error ? error.message : "Unknown upload failure";

    if (details.includes("Missing bundled helper binary") || details.includes("tool binary") || details.includes("Native addon")) {
      return {
        changed: true,
        synced: false,
        reason: "helper-missing",
        details,
        hash
      };
    }

    return {
      changed: true,
      synced: false,
      reason: "upload-failed",
      details,
      hash
    };
  }

  config.lastSync[key] = {
    payload: hash,
    agent: activeAgent,
    updatedAt: new Date().toISOString()
  };

  return {
    changed: true,
    synced: true,
    reason: "uploaded",
    hash
  };
}

export { payloadHash, buildPadPayload };
