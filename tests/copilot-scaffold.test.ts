import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { promisify } from "node:util";

import { installCopilotScaffold, runCopilotDoctor } from "../src/copilot.js";

const execFileAsync = promisify(execFile);
const cliPath = resolve(import.meta.dirname, "../src/cli.ts");
const tsxPath = resolve(import.meta.dirname, "../node_modules/.bin/tsx");

async function runCli(cwd: string, args: string[]): Promise<string> {
  const { stdout } = await execFileAsync(tsxPath, [cliPath, ...args], { cwd });
  return stdout.trim();
}

async function runCliJson<T>(cwd: string, args: string[]): Promise<T> {
  const output = await runCli(cwd, args);
  return JSON.parse(output) as T;
}

test("init --copilot scaffolds a Copilot-ready project and bridge commands work end to end", async () => {
  const workspaceRoot = await mkdtemp(join(tmpdir(), "copilot-researcher-copilot-"));

  await runCli(workspaceRoot, ["init", ".", "--name", "Copilot Harness", "--copilot"]);

  const projectFiles = [
    "AGENTS.md",
    ".github/copilot-instructions.md",
    ".github/agents/research-orchestrator.agent.md",
    ".github/skills/literature-scout/SKILL.md",
    ".github/extensions/copilot-researcher-ledger/extension.mjs"
  ];

  for (const relativePath of projectFiles) {
    const contents = await readFile(join(workspaceRoot, relativePath), "utf8");
    assert.ok(contents.includes("copilot-researcher"));
  }

  const doctor = await runCliJson<{
    workspaceFound: boolean;
    missingProjectFiles: string[];
  }>(workspaceRoot, ["copilot", "doctor", "--dir", ".", "--json"]);
  assert.equal(doctor.workspaceFound, true);
  assert.equal(doctor.missingProjectFiles.length, 0);

  const status = await runCliJson<{
    hasWorkspace: boolean;
    templates: Array<{
      id: string;
      description: string;
      recommendedArtifacts: string[];
    }>;
  }>(workspaceRoot, [
    "copilot",
    "bridge",
    "--operation",
    "get-workspace-status",
    "--cwd",
    workspaceRoot,
    "--payload",
    "{}"
  ]);
  assert.equal(status.hasWorkspace, true);
  assert.ok(status.templates.length >= 7);
  const templateIds = new Set(status.templates.map((template) => template.id));
  assert.ok(templateIds.has("physics-literature-scout"));
  assert.ok(templateIds.has("physics-simulation"));
  assert.ok(templateIds.has("multiphysics-validation"));
  assert.ok(templateIds.has("simulation-paper"));

  const validationTemplate = status.templates.find(
    (template) => template.id === "multiphysics-validation"
  );
  assert.ok(validationTemplate);
  assert.match(validationTemplate.description, /benchmark|coupled/i);
  assert.deepEqual(validationTemplate.recommendedArtifacts, [
    "dataset",
    "script",
    "figure",
    "note",
    "report"
  ]);

  const created = await runCliJson<{
    session: { id: string; templateId: string };
  }>(workspaceRoot, [
    "copilot",
    "bridge",
    "--operation",
    "create-session",
    "--cwd",
    workspaceRoot,
    "--payload",
    JSON.stringify({
      goal: "Find the most credible near-term experiment",
      question: "Which hypothesis deserves validation first?",
      templateId: "experiment-design"
    })
  ]);
  assert.equal(created.session.templateId, "experiment-design");

  await runCliJson<{ hypothesis: { id: string } }>(workspaceRoot, [
    "copilot",
    "bridge",
    "--operation",
    "add-hypothesis",
    "--cwd",
    workspaceRoot,
    "--payload",
    JSON.stringify({
      sessionId: created.session.id,
      title: "Boron-rich coating",
      statement: "A boron-rich coating may improve interface stability.",
      novelty: 4,
      feasibility: 4,
      impact: 5,
      confidence: 4,
      tags: ["battery", "coating"]
    })
  ]);

  const snapshot = await runCliJson<{
    session: { id: string };
    hypotheses: Array<{ title: string }>;
  }>(workspaceRoot, [
    "copilot",
    "bridge",
    "--operation",
    "get-session",
    "--cwd",
    workspaceRoot,
    "--payload",
    JSON.stringify({ sessionId: created.session.id })
  ]);
  assert.equal(snapshot.session.id, created.session.id);
  assert.equal(snapshot.hypotheses[0]?.title, "Boron-rich coating");
});

test("installCopilotScaffold installs user-scoped skills into a custom home directory", async () => {
  const fakeHome = await mkdtemp(join(tmpdir(), "copilot-researcher-home-"));
  const result = await installCopilotScaffold(fakeHome, {
    scope: "user",
    homeDir: fakeHome
  });

  assert.ok(result.written.length >= 5);

  const doctor = await runCopilotDoctor(fakeHome, fakeHome);
  assert.equal(doctor.missingUserSkills.length, 0);
});
