import { CH57X_PID, CH57X_VID } from "./constants.js";
import type { KeypadMeta } from "./types.js";
import { isKnownKeypadConnected as checkNativePadConnected, runPadUpload as uploadViaNative } from "./native.js";

const KNOWN_KEYPADS: Record<string, KeypadMeta> = {
  ch57x: {
    slug: "ch57x",
    name: "CH57x 3-key + rotary",
    vid: CH57X_VID,
    pid: CH57X_PID
  }
};

export function getKeypadMeta(slug: string) {
  return KNOWN_KEYPADS[slug] || null;
}

export function listKeypadCatalog() {
  return Object.values(KNOWN_KEYPADS);
}

export function supportedKeypadSlugs() {
  return Object.keys(KNOWN_KEYPADS);
}

export async function isKnownKeypadConnected(slug: string) {
  const device = KNOWN_KEYPADS[slug];
  if (!device) {
    return false;
  }

  try {
    return await checkNativePadConnected(device.vid, device.pid);
  } catch {
    return false;
  }
}

export const runPadUpload = uploadViaNative;
