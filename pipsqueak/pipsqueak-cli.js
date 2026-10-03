#!/usr/bin/env bun
// Usage: bun pipsqueak-cli.js <session.json> [--json] [--trim 250]
// Prints the analysis summary for a session saved from pipsqueak.html.
import { analyzeSession } from "./pipsqueak-analyze.js";

const args = process.argv.slice(2);
const file = args.find((a) => !a.startsWith("--"));
if (!file) {
  console.error("usage: bun pipsqueak-cli.js <session.json> [--json] [--trim <ms>]");
  process.exit(1);
}
const trimIdx = args.indexOf("--trim");
const trim = trimIdx >= 0 ? Number(args[trimIdx + 1]) : 250;

const session = await Bun.file(file).json();
const result = analyzeSession(session, { trimStartMs: trim, trimEndMs: trim });

if (args.includes("--json")) {
  // Drop the raw series to keep the output readable.
  const { steps, ...rest } = result;
  console.log(JSON.stringify({ ...rest, steps: steps.map(({ series, ...s }) => s) }, null, 2));
} else {
  console.log(result.text);
}
