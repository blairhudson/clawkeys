import { createRequire } from "node:module";
import { existsSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);

const packageRoot = dirname(fileURLToPath(import.meta.url));
const candidates = ["clawkeys.linux-arm64-gnu.node", "clawkeys-linux-arm64-gnu.node", "clawkeys.linux-arm64-gnu.node.napi.node"];

let bindingFile = candidates.find((name) => existsSync(join(packageRoot, name)));
if (!bindingFile) {
  const fallback = readdirSync(packageRoot).find((entry) => entry.startsWith("clawkeys") && entry.endsWith(".node"));
  bindingFile = fallback;
}

if (!bindingFile) {
  throw new Error("Native addon binary missing for clawkeys-linux-arm64-gnu");
}

const binding = require(`./${bindingFile}`);

const isKnownKeypadConnected = binding.isKnownKeypadConnected || binding.is_known_keypad_connected;
const runPadUpload = binding.runPadUpload || binding.run_pad_upload;

export { isKnownKeypadConnected, runPadUpload };
