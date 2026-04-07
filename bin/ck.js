#!/usr/bin/env node
let run;
try {
  ({ run } = await import("../dist/cli.js"));
} catch (error) {
  console.error("clawkeys: compiled CLI entrypoint not found. Run npm run build:ts first.");
  throw error;
}

run(process.argv.slice(2));
