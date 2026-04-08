import { execSync } from "node:child_process";
import { existsSync } from "node:fs";

type NativeBinding = {
  isKnownKeypadConnected?: (vendorId: number, productId: number) => boolean | Promise<boolean>;
  is_known_keypad_connected?: (vendorId: number, productId: number) => boolean | Promise<boolean>;
  runPadUpload?: (payload: string, toolPath?: string) => void | Promise<void>;
  run_pad_upload?: (payload: string, toolPath?: string) => void | Promise<void>;
};

type NativeModule = NativeBinding & {
  helperPath?: string;
};

type CanonicalNativeBinding = {
  isKnownKeypadConnected: (vendorId: number, productId: number) => boolean | Promise<boolean>;
  runPadUpload: (payload: string, toolPath?: string) => void | Promise<void>;
};

type LoadedNativeModule = {
  binding: CanonicalNativeBinding;
  helperPath?: string;
  platformKey: string;
};

const PLATFORM_PACKAGES: Record<string, string> = {
  "darwin-arm64": "@clawkeys/ck-darwin-arm64",
  "darwin-x64": "@clawkeys/ck-darwin-x64",
  "linux-x64-gnu": "@clawkeys/ck-linux-x64-gnu",
  "linux-arm64-gnu": "@clawkeys/ck-linux-arm64-gnu",
  "win32-x64-msvc": "@clawkeys/ck-win32-x64-msvc"
};

const TOOL_PATH_ENV = "CLAWKEYS_TOOL_PATH";

let loadedNativeModule: LoadedNativeModule | null = null;

function isLinuxMusl(): boolean {
  const report = typeof process.report?.getReport === "function" ? process.report.getReport() : undefined;
  const header: Record<string, unknown> | undefined = (report && typeof report === "object") ? (report as any).header : undefined;
  if (header && typeof header === "object") {
    const runtime = (header as { glibcVersionRuntime?: string }).glibcVersionRuntime;
    if (runtime) {
      return false;
    }
  }

  try {
    const output = execSync("ldd --version", { encoding: "utf8" }).toLowerCase();
    if (output.includes("musl")) {
      return true;
    }
  } catch {
    // best effort only
  }

  return false;
}

function getCurrentPlatformKey(): string | null {
  const platform = process.platform;
  const arch = process.arch;

  if (platform === "darwin" && arch === "arm64") {
    return "darwin-arm64";
  }
  if (platform === "darwin" && arch === "x64") {
    return "darwin-x64";
  }
  if (platform === "linux" && arch === "x64") {
    return isLinuxMusl() ? null : "linux-x64-gnu";
  }
  if (platform === "linux" && arch === "arm64") {
    return "linux-arm64-gnu";
  }
  if (platform === "win32" && arch === "x64") {
    return "win32-x64-msvc";
  }

  return null;
}

function getUnsupportedPlatformMessage(): string {
  if (process.platform === "linux" && process.arch === "x64" && isLinuxMusl()) {
    return "Unsupported platform linux/x64 musl. Bundled helper binaries are published for darwin-arm64, darwin-x64, linux-x64-gnu, linux-arm64-gnu, and win32-x64-msvc.";
  }

  return `Unsupported platform ${process.platform}/${process.arch}`;
}

function normalizeBinding(binding: NativeBinding): CanonicalNativeBinding {
  const isKnownKeypadConnected = binding.isKnownKeypadConnected || binding.is_known_keypad_connected;
  const runPadUpload = binding.runPadUpload || binding.run_pad_upload;

  if (typeof isKnownKeypadConnected !== "function") {
    throw new Error("Native binding missing isKnownKeypadConnected export");
  }
  if (typeof runPadUpload !== "function") {
    throw new Error("Native binding missing runPadUpload export");
  }

  return {
    isKnownKeypadConnected,
    runPadUpload
  };
}

async function loadNativeModule(): Promise<LoadedNativeModule> {
  if (loadedNativeModule) {
    return loadedNativeModule;
  }

  const platformKey = getCurrentPlatformKey();
  if (!platformKey) {
    throw new Error(getUnsupportedPlatformMessage());
  }

  const packageName = PLATFORM_PACKAGES[platformKey];
  if (!packageName) {
    throw new Error(`No native package configured for ${platformKey}`);
  }

  let imported: NativeModule;
  try {
    imported = await import(packageName) as NativeModule;
  } catch (error: unknown) {
    const message = (error as Error).message || String(error);
    if (message.includes("ERR_MODULE_NOT_FOUND")) {
      throw new Error(`Native addon package ${packageName} is not installed. Reinstall @clawkeys/ck so the matching optional platform package can be installed.`);
    }
    throw error;
  }

  loadedNativeModule = {
    binding: normalizeBinding(imported),
    helperPath: typeof imported.helperPath === "string" && existsSync(imported.helperPath) ? imported.helperPath : undefined,
    platformKey
  };

  return loadedNativeModule;
}

export function resolveToolPath(explicitToolPath: string | undefined, bundledToolPath: string | undefined) {
  if (explicitToolPath) {
    return explicitToolPath;
  }

  if (bundledToolPath) {
    return bundledToolPath;
  }

  return undefined;
}

export async function isKnownKeypadConnected(vendorId: number, productId: number): Promise<boolean> {
  const nativeModule = await loadNativeModule();
  return Boolean(await nativeModule.binding.isKnownKeypadConnected(vendorId, productId));
}

export async function runPadUpload(payloadYaml: string): Promise<void> {
  const nativeModule = await loadNativeModule();
  const toolPath = resolveToolPath(process.env[TOOL_PATH_ENV], nativeModule.helperPath);

  if (!toolPath) {
    throw new Error(`Bundled helper binary missing for ${nativeModule.platformKey}. Reinstall @clawkeys/ck or set ${TOOL_PATH_ENV} to a compatible ch57x-keyboard-tool binary.`);
  }

  await nativeModule.binding.runPadUpload(payloadYaml, toolPath);
}
