import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");

async function createSandbox() {
  const root = await mkdtemp(path.join(tmpdir(), "clawkeys-test-"));
  return {
    root,
    home: path.join(root, "home"),
    configHome: path.join(root, "config"),
    appData: path.join(root, "appdata")
  };
}

function runCli(sandbox, args) {
  const result = spawnSync(process.execPath, ["bin/ck.js", ...args], {
    cwd: repoRoot,
    env: {
      ...process.env,
      HOME: sandbox.home,
      XDG_CONFIG_HOME: sandbox.configHome,
      APPDATA: sandbox.appData
    },
    encoding: "utf8"
  });

  if (result.status !== 0) {
    throw new Error(`ck ${args.join(" ")} failed\nstdout:\n${result.stdout}\nstderr:\n${result.stderr}`);
  }

  return result.stdout;
}

async function readConfig(sandbox) {
  const configPath = path.join(sandbox.configHome, "clawkeys", "config.json");
  const raw = await readFile(configPath, "utf8");
  return JSON.parse(raw);
}

test("saved profiles can be loaded back into the active config", async (t) => {
  const sandbox = await createSandbox();
  t.after(async () => {
    await rm(sandbox.root, { recursive: true, force: true });
  });

  runCli(sandbox, ["keybinds", "key-left", "agent_cycle"]);
  runCli(sandbox, ["profile", "save", "work"]);
  runCli(sandbox, ["keybinds", "key-left", "default"]);

  const output = runCli(sandbox, ["profile", "load", "work"]);
  const status = runCli(sandbox, ["status"]);
  const config = await readConfig(sandbox);

  assert.match(output, /Loaded profile work/);
  assert.match(status, /Profile:\s+work/);
  assert.match(status, /Key Left\s+agent_cycle\s+-> tab/);
  assert.equal(config.activeProfile, "work");
  assert.equal(config.bindings.opencode["key-left"], "agent_cycle");
});

test("built-in default profile restores shipped defaults without deleting saved profiles", async (t) => {
  const sandbox = await createSandbox();
  t.after(async () => {
    await rm(sandbox.root, { recursive: true, force: true });
  });

  runCli(sandbox, ["keybinds", "key-left", "agent_cycle"]);
  runCli(sandbox, ["profile", "save", "work"]);

  const output = runCli(sandbox, ["profile", "load", "default"]);
  const status = runCli(sandbox, ["status"]);
  const config = await readConfig(sandbox);

  assert.match(output, /Loaded built-in default profile/);
  assert.match(status, /Profile:\s+none/);
  assert.match(status, /Key Left\s+approve_once\s+-> enter/);
  assert.match(status, /Rotary Left\s+model_cycle_recent_reverse\s+-> shift-f13/);
  assert.equal(config.activeProfile, null);
  assert.equal(config.profiles.work.activeAgent, "opencode");
});

test("editing a loaded profile clears the active profile marker", async (t) => {
  const sandbox = await createSandbox();
  t.after(async () => {
    await rm(sandbox.root, { recursive: true, force: true });
  });

  runCli(sandbox, ["profile", "save", "work"]);
  runCli(sandbox, ["profile", "load", "work"]);
  runCli(sandbox, ["keybinds", "key-left", "agent_cycle"]);

  const status = runCli(sandbox, ["status"]);
  const config = await readConfig(sandbox);

  assert.match(status, /Profile:\s+none/);
  assert.equal(config.activeProfile, null);
});
