import { createRequire } from "node:module";
import { existsSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);

const packageRoot = dirname(fileURLToPath(import.meta.url));
const candidates = ["clawkeys.darwin-x64.node", "clawkeys-darwin-x64.node", "clawkeys.darwin-x64.node.napi.node"];
const helperFile = "ch57x-keyboard-tool";

let bindingFile = candidates.find((name) => existsSync(join(packageRoot, name)));
if (!bindingFile) {
  const fallback = readdirSync(packageRoot).find((entry) => entry.startsWith("clawkeys") && entry.endsWith(".node"));
  bindingFile = fallback;
}

if (!bindingFile) {
  throw new Error("Native addon binary missing for clawkeys-darwin-x64");
}

const binding = require(`./${bindingFile}`);
const helperPath = existsSync(join(packageRoot, helperFile)) ? join(packageRoot, helperFile) : undefined;

const isKnownKeypadConnected = binding.isKnownKeypadConnected || binding.is_known_keypad_connected;
const runPadUpload = binding.runPadUpload || binding.run_pad_upload;

export { helperPath, isKnownKeypadConnected, runPadUpload };
