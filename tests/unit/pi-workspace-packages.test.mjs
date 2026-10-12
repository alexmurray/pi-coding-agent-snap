// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: Canonical Ltd.
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

const script = new URL("../../snap/local/pi-workspace-packages.mjs", import.meta.url);

test("includes production workspaces used outside CLI imports, but not dev workspaces", (t) => {
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

  pkg("coding-agent", "@earendil-works/pi-coding-agent", {
    "@earendil-works/chord": "1.1.0",
  }, {
    "@earendil-works/pi-server": "1.1.0",
  }, 'import "@earendil-works/pi-ai/compat";');
  pkg("chord", "@earendil-works/chord"); // Only an extension/runner imports chord/context.
  pkg("ai", "@earendil-works/pi-ai", { "@earendil-works/pi-telemetry": "1.1.0" });
  pkg("telemetry", "@earendil-works/pi-telemetry");
  pkg("server", "@earendil-works/pi-server");

  const output = execFileSync(process.execPath, [script.pathname, "--scan-root", root], { encoding: "utf8" });
  assert.deepEqual(output.trim().split("\n"), ["ai", "chord", "coding-agent", "telemetry"]);
});
