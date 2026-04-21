import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const cliPath = resolve(import.meta.dirname, "../src/cli.ts");
const tsxPath = resolve(import.meta.dirname, "../node_modules/.bin/tsx");

async function runCli(cwd: string, args: string[]): Promise<string> {
  const { stdout } = await execFileAsync(tsxPath, [cliPath, ...args], { cwd });
  return stdout.trim();
}

test("CLI supports a complete local-first research session lifecycle", async () => {
  const workspaceRoot = await mkdtemp(join(tmpdir(), "copilot-researcher-"));

  await runCli(workspaceRoot, ["init", ".", "--name", "copilot-researcher E2E"]);

  const templates = JSON.parse(
    await runCli(workspaceRoot, ["template:list", "--json"])
  ) as Array<{ id: string }>;
  assert.ok(templates.some((template) => template.id === "physics-literature-scout"));
  assert.ok(templates.some((template) => template.id === "multiphysics-validation"));
  assert.ok(templates.some((template) => template.id === "simulation-paper"));

  const sessionOutput = await runCli(workspaceRoot, [
    "session:create",
    "--goal",
    "Identify the next high-value battery additive experiment",
    "--question",
    "Which additive should be validated first?",
    "--template",
    "experiment-design"
  ]);
  const sessionId = sessionOutput.replace("Created session ", "").trim();

  const hypothesisOneOutput = await runCli(workspaceRoot, [
    "hypothesis:add",
    "--session",
    sessionId,
    "--title",
    "Boron-rich coating",
    "--statement",
    "A boron-rich coating may improve interface stability during fast charging.",
    "--novelty",
    "4",
    "--feasibility",
    "4",
    "--impact",
    "5",
    "--confidence",
    "4",
    "--tags",
    "battery,coating"
  ]);
  const hypothesisOneId = hypothesisOneOutput.replace("Added hypothesis ", "").trim();

  await runCli(workspaceRoot, [
    "hypothesis:add",
    "--session",
    sessionId,
    "--title",
    "Exotic electrolyte blend",
    "--statement",
    "A low-availability blend might improve charging speed.",
    "--novelty",
    "5",
    "--feasibility",
    "2",
    "--impact",
    "3",
    "--confidence",
    "2"
  ]);

  await runCli(workspaceRoot, [
    "evidence:add",
    "--session",
    sessionId,
    "--hypothesis",
    hypothesisOneId,
    "--summary",
    "Interface-stability literature suggests reduced degradation.",
    "--source",
    "doi:10.0000/supporting-study",
    "--strength",
    "4",
    "--relevance",
    "5",
    "--direction",
    "support"
  ]);

  const artifactFile = join(workspaceRoot, "notes.txt");
  await writeFile(artifactFile, "candidate experiment notes\n", "utf8");

  await runCli(workspaceRoot, [
    "artifact:add",
    "--session",
    sessionId,
    "--hypothesis",
    hypothesisOneId,
    "--label",
    "coating-notes",
    "--path",
    "notes.txt",
    "--kind",
    "note"
  ]);

  const scoreOutput = await runCli(workspaceRoot, ["score", "--session", sessionId]);
  assert.match(scoreOutput, /Boron-rich coating/);
  assert.match(scoreOutput, /design-experiment|collect-supporting-evidence/);

  const statusOutput = await runCli(workspaceRoot, ["status", "--session", sessionId]);
  assert.match(statusOutput, /Goal:/);
  assert.match(statusOutput, /Boron-rich coating/);

  const reportOutput = await runCli(workspaceRoot, ["report", "--session", sessionId]);
  const reportPath = reportOutput.replace("Generated report ", "").trim();
  const reportContents = await readFile(reportPath, "utf8");
  assert.match(reportContents, /copilot-researcher report/);
  assert.match(reportContents, /Ranked hypotheses/);
  assert.match(reportContents, /Boron-rich coating/);

  const sessionContents = JSON.parse(
    await readFile(
      join(workspaceRoot, ".researchflow", "sessions", sessionId, "session.json"),
      "utf8"
    )
  ) as { status: string; rankedHypothesisIds: string[] };
  assert.equal(sessionContents.status, "reported");
  assert.equal(sessionContents.rankedHypothesisIds.length, 2);
});
