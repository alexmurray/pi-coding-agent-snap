// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: Canonical Ltd.
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

const script = new URL("../../snap/local/pi-workspace-packages.mjs", import.meta.url);

test("follows declared production dependencies beyond compiled imports, skips dev-only workspaces", (t) => {
  const root = mkdtempSync(join(tmpdir(), "pi-workspace-packages-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const scopedRoot = join(root, "node_modules", "@earendil-works");
  mkdirSync(scopedRoot, { recursive: true });

  const pkg = (dir, name, dependencies = {}, devDependencies = {}, js = "") => {
    const base = join(root, "packages", dir);
    mkdirSync(join(base, "dist"), { recursive: true });
    writeFileSync(join(base, "package.json"), JSON.stringify({ name, dependencies, devDependencies }));
    writeFileSync(join(base, "dist", "index.js"), js);
    symlinkSync(join("..", "..", "packages", dir), join(scopedRoot, name.split("/")[1]));
  };

  // Mirrors the real dependency shape: pi-telemetry is reachable only
  // through declared dependencies (pi-ai imports it as a type, which
  // compiles away), and pi-evals is a workspace nothing depends on in
  // production.
  pkg("coding-agent", "@earendil-works/pi-coding-agent", {
    "@earendil-works/pi-agent-core": "1.2.0",
  }, {
    "@earendil-works/pi-evals": "1.2.0",
  }, 'import "@earendil-works/pi-ai/compat";');
  pkg("agent", "@earendil-works/pi-agent-core", { "@earendil-works/pi-ai": "1.2.0" });
  pkg("ai", "@earendil-works/pi-ai", { "@earendil-works/pi-telemetry": "1.2.0" });
  pkg("telemetry", "@earendil-works/pi-telemetry");
  pkg("evals", "@earendil-works/pi-evals");

  const output = execFileSync(process.execPath, [script.pathname, "--scan-root", root], { encoding: "utf8" });
  assert.deepEqual(output.trim().split("\n"), ["agent", "ai", "coding-agent", "telemetry"]);
});
