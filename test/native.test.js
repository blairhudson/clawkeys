import test from "node:test";
import assert from "node:assert/strict";

const native = await import("../dist/native.js");

test("resolveToolPath prefers explicit overrides", () => {
  assert.equal(native.resolveToolPath("/tmp/override-tool", "/tmp/bundled-tool"), "/tmp/override-tool");
});

test("resolveToolPath falls back to bundled helper", () => {
  assert.equal(native.resolveToolPath(undefined, "/tmp/bundled-tool"), "/tmp/bundled-tool");
});

test("resolveToolPath returns undefined when neither helper path is available", () => {
  assert.equal(native.resolveToolPath(undefined, undefined), undefined);
});
