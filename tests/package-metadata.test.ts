import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import test from "node:test";

test("package metadata matches the public npm package identity", async () => {
  const packageJson = JSON.parse(
    await readFile(resolve(import.meta.dirname, "../package.json"), "utf8")
  ) as {
    bin?: Record<string, string>;
    author?: string;
    license?: string;
  };

  assert.equal(packageJson.bin?.["copilot-researcher"], "./dist/cli.js");
  assert.deepEqual(Object.keys(packageJson.bin ?? {}), ["copilot-researcher"]);
  assert.equal(packageJson.author, "tayor");
  assert.equal(packageJson.license, "MIT");
});
