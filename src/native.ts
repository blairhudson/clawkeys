import { execSync } from "node:child_process";

type NativeBinding = {
  isKnownKeypadConnected?: (vendorId: number, productId: number) => boolean | Promise<boolean>;
  is_known_keypad_connected?: (vendorId: number, productId: number) => boolean | Promise<boolean>;
  runPadUpload?: (payload: string, toolPath?: string) => void | Promise<void>;
  run_pad_upload?: (payload: string, toolPath?: string) => void | Promise<void>;
};

type CanonicalNativeBinding = {
  isKnownKeypadConnected: (vendorId: number, productId: number) => boolean | Promise<boolean>;
  runPadUpload: (payload: string, toolPath?: string) => void | Promise<void>;
};

const PLATFORM_PACKAGES: Record<string, string> = {
  "darwin-arm64": "@clawkeys/ck-darwin-arm64",
  "darwin-x64": "@clawkeys/ck-darwin-x64",
  "linux-x64-gnu": "@clawkeys/ck-linux-x64-gnu",
  "linux-arm64-gnu": "@clawkeys/ck-linux-arm64-gnu",
  "linux-x64-musl": "@clawkeys/ck-linux-x64-musl",
  "win32-x64-msvc": "@clawkeys/ck-win32-x64-msvc"
};

const TOOL_PATH_ENV = "CLAWKEYS_TOOL_PATH";

let nativeBinding: CanonicalNativeBinding | null = null;

function getLinuxLibc(): "gnu" | "musl" {
  const report = typeof process.report?.getReport === "function" ? process.report.getReport() : undefined;
  const header: Record<string, unknown> | undefined = (report && typeof report === "object") ? (report as any).header : undefined;
  if (header && typeof header === "object") {
    const runtime = (header as { glibcVersionRuntime?: string }).glibcVersionRuntime;
    if (runtime) {
      return "gnu";
    }
  }

  try {
    const output = execSync("ldd --version", { encoding: "utf8" }).toLowerCase();
    if (output.includes("musl")) {
      return "musl";
    }
  } catch {
    // best effort only
  }

  return "gnu";
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
    return `linux-x64-${getLinuxLibc()}`;
  }
  if (platform === "linux" && arch === "arm64") {
    return "linux-arm64-gnu";
  }
  if (platform === "win32" && arch === "x64") {
    return "win32-x64-msvc";
  }

  return null;
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

async function loadNativeBinding(): Promise<CanonicalNativeBinding> {
  if (nativeBinding) {
    return nativeBinding;
  }

  const platformKey = getCurrentPlatformKey();
  if (!platformKey) {
    throw new Error(`Unsupported platform ${process.platform}/${process.arch}`);
  }

  const packageName = PLATFORM_PACKAGES[platformKey];
  if (!packageName) {
    throw new Error(`No native package configured for ${platformKey}`);
  }

  let imported: Record<string, unknown>;
  try {
    imported = await import(packageName) as unknown as Record<string, unknown>;
  } catch (error: unknown) {
    const message = (error as Error).message || String(error);
    if (message.includes("ERR_MODULE_NOT_FOUND")) {
      throw new Error(`Native addon package ${packageName} is not installed. Reinstall @clawkeys/ck so the matching optional platform package can be installed.`);
    }
    throw error;
  }

  nativeBinding = normalizeBinding(imported as NativeBinding);
  return nativeBinding;
}

export async function isKnownKeypadConnected(vendorId: number, productId: number): Promise<boolean> {
  const binding = await loadNativeBinding();
  return Boolean(await binding.isKnownKeypadConnected(vendorId, productId));
}

export async function runPadUpload(payloadYaml: string): Promise<void> {
  const binding = await loadNativeBinding();
  await binding.runPadUpload(payloadYaml, process.env[TOOL_PATH_ENV]);
}
