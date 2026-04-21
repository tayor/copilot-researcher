#!/usr/bin/env node

import { Command } from "commander";
import { resolve } from "node:path";

import {
  executeCopilotBridge,
  installCopilotScaffold,
  runCopilotDoctor,
  type CopilotBridgeOperation,
  type CopilotInstallScope
} from "./copilot.js";
import type {
  AddArtifactInput,
  AddEvidenceInput,
  AddHypothesisInput,
  ArtifactKind,
  EvidenceDirection,
  ResearchTemplate
} from "./models.js";
import { DEFAULT_TEMPLATES } from "./templates.js";
import { CopilotResearcherWorkspace } from "./workspace.js";

function parseRating(value: string, label: string): number {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 5) {
    throw new Error(`${label} must be an integer from 1 to 5`);
  }
  return parsed;
}

function parseTags(value?: string): string[] {
  if (!value) {
    return [];
  }
  return value
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

async function resolveWorkspace(directory?: string): Promise<CopilotResearcherWorkspace> {
  return CopilotResearcherWorkspace.find(resolve(directory ?? process.cwd()));
}

async function resolveTemplates(directory?: string): Promise<ResearchTemplate[]> {
  try {
    const workspace = await resolveWorkspace(directory);
    return workspace.listTemplates();
  } catch (error) {
    if (
      error instanceof Error &&
      error.message.includes("No copilot-researcher workspace found")
    ) {
      return [...DEFAULT_TEMPLATES];
    }

    throw error;
  }
}

function parseCopilotScope(value: string): CopilotInstallScope {
  if (value === "project" || value === "user") {
    return value;
  }
  throw new Error(`scope must be one of project, user`);
}

function printScaffoldSummary(prefix: string, result: Awaited<ReturnType<typeof installCopilotScaffold>>): void {
  const changed = result.written.length + result.updated.length;
  console.log(`${prefix} ${changed} file(s) in ${result.targetRoot}`);
  if (result.skipped.length > 0) {
    console.log(`Skipped ${result.skipped.length} file(s) with local changes.`);
  }
}

const program = new Command();

program
  .name("copilot-researcher")
  .description("Local-first CLI for research sessions, hypotheses, evidence, and reports.")
  .version("0.1.0");

program
  .command("init")
  .argument("[dir]", "Workspace directory", ".")
  .option("--name <name>", "Workspace display name")
  .option("--copilot", "Scaffold GitHub Copilot CLI project assets")
  .action(async (dir: string, options: { name?: string; copilot?: boolean }) => {
    const workspace = await CopilotResearcherWorkspace.init(dir, options.name);
    console.log(`Initialized copilot-researcher workspace at ${workspace.root}`);
    if (options.copilot) {
      const scaffold = await installCopilotScaffold(workspace.root, { scope: "project" });
      printScaffoldSummary("Installed Copilot scaffold with", scaffold);
    }
  });

program
  .command("template:list")
  .description("List built-in or workspace templates with workflow guidance.")
  .option("--workspace <dir>", "Workspace directory")
  .option("--json", "Emit JSON output")
  .action(async (options: { workspace?: string; json?: boolean }) => {
    const templates = await resolveTemplates(options.workspace);
    if (options.json) {
      process.stdout.write(`${JSON.stringify(templates, null, 2)}\n`);
      return;
    }

    for (const template of templates) {
      console.log(`${template.id} :: ${template.name}`);
      console.log(`  ${template.description}`);
      console.log(`  Artifacts: ${template.recommendedArtifacts.join(", ")}`);
      console.log(`  Prompt: ${template.prompts[0] ?? "n/a"}`);
      console.log(
        `  Evidence: ${template.evidenceQuestions[0] ?? "n/a"}`
      );
    }
  });

program
  .command("session:create")
  .requiredOption("--goal <goal>", "Research goal")
  .requiredOption("--question <question>", "Primary research question")
  .option("--template <templateId>", "Template id to apply")
  .option("--workspace <dir>", "Workspace directory")
  .action(
    async (options: {
      goal: string;
      question: string;
      template?: string;
      workspace?: string;
    }) => {
      const workspace = await resolveWorkspace(options.workspace);
      const sessionInput = {
        goal: options.goal,
        question: options.question
      } as {
        goal: string;
        question: string;
        templateId?: string;
      };
      if (options.template) {
        sessionInput.templateId = options.template;
      }

      const session = await workspace.createSession(sessionInput);
      console.log(`Created session ${session.id}`);
    }
  );

program
  .command("hypothesis:add")
  .requiredOption("--session <sessionId>", "Session id")
  .requiredOption("--title <title>", "Hypothesis title")
  .requiredOption("--statement <statement>", "Hypothesis statement")
  .requiredOption("--novelty <score>", "Novelty score 1-5")
  .requiredOption("--feasibility <score>", "Feasibility score 1-5")
  .requiredOption("--impact <score>", "Impact score 1-5")
  .option("--confidence <score>", "Confidence score 1-5", "3")
  .option("--tags <items>", "Comma-separated tags")
  .option("--workspace <dir>", "Workspace directory")
  .action(
    async (options: {
      session: string;
      title: string;
      statement: string;
      novelty: string;
      feasibility: string;
      impact: string;
      confidence: string;
      tags?: string;
      workspace?: string;
    }) => {
      const workspace = await resolveWorkspace(options.workspace);
      const hypothesis = await workspace.addHypothesis({
        sessionId: options.session,
        title: options.title,
        statement: options.statement,
        novelty: parseRating(options.novelty, "novelty"),
        feasibility: parseRating(options.feasibility, "feasibility"),
        impact: parseRating(options.impact, "impact"),
        confidence: parseRating(options.confidence, "confidence"),
        tags: parseTags(options.tags)
      } satisfies AddHypothesisInput);
      console.log(`Added hypothesis ${hypothesis.id}`);
    }
  );

program
  .command("evidence:add")
  .requiredOption("--session <sessionId>", "Session id")
  .requiredOption("--hypothesis <hypothesisId>", "Hypothesis id")
  .requiredOption("--summary <summary>", "Evidence summary")
  .requiredOption("--source <source>", "Evidence source")
  .requiredOption("--strength <score>", "Strength score 1-5")
  .requiredOption("--relevance <score>", "Relevance score 1-5")
  .requiredOption("--direction <direction>", "support | contradict | neutral")
  .option("--workspace <dir>", "Workspace directory")
  .action(
    async (options: {
      session: string;
      hypothesis: string;
      summary: string;
      source: string;
      strength: string;
      relevance: string;
      direction: EvidenceDirection;
      workspace?: string;
    }) => {
      const direction = options.direction;
      if (!["support", "contradict", "neutral"].includes(direction)) {
        throw new Error(`direction must be one of support, contradict, neutral`);
      }

      const workspace = await resolveWorkspace(options.workspace);
      const evidence = await workspace.addEvidence({
        sessionId: options.session,
        hypothesisId: options.hypothesis,
        summary: options.summary,
        source: options.source,
        strength: parseRating(options.strength, "strength"),
        relevance: parseRating(options.relevance, "relevance"),
        direction
      } satisfies AddEvidenceInput);
      console.log(`Added evidence ${evidence.id}`);
    }
  );

program
  .command("artifact:add")
  .requiredOption("--session <sessionId>", "Session id")
  .requiredOption("--label <label>", "Artifact label")
  .requiredOption("--path <path>", "Artifact path")
  .option("--kind <kind>", "dataset | note | script | figure | report | other", "other")
  .option("--description <description>", "Artifact description", "")
  .option("--hypothesis <hypothesisId>", "Link artifact to hypothesis")
  .option("--workspace <dir>", "Workspace directory")
  .action(
    async (options: {
      session: string;
      label: string;
      path: string;
      kind: ArtifactKind;
      description: string;
      hypothesis?: string;
      workspace?: string;
    }) => {
      const workspace = await resolveWorkspace(options.workspace);
      const artifactInput = {
        sessionId: options.session,
        label: options.label,
        path: options.path,
        kind: options.kind,
        description: options.description
      } as AddArtifactInput;
      if (options.hypothesis) {
        artifactInput.hypothesisId = options.hypothesis;
      }

      const artifact = await workspace.addArtifact(artifactInput);
      console.log(`Added artifact ${artifact.id}`);
    }
  );

program
  .command("score")
  .requiredOption("--session <sessionId>", "Session id")
  .option("--workspace <dir>", "Workspace directory")
  .action(async (options: { session: string; workspace?: string }) => {
    const workspace = await resolveWorkspace(options.workspace);
    const ranked = await workspace.scoreSession(options.session);
    for (const hypothesis of ranked) {
      console.log(
        `#${hypothesis.score?.rank} ${hypothesis.title} :: total=${hypothesis.score?.total} next=${hypothesis.score?.nextAction}`
      );
    }
  });

program
  .command("status")
  .requiredOption("--session <sessionId>", "Session id")
  .option("--workspace <dir>", "Workspace directory")
  .action(async (options: { session: string; workspace?: string }) => {
    const workspace = await resolveWorkspace(options.workspace);
    const session = await workspace.getSession(options.session);
    const hypotheses = await workspace.listHypotheses(options.session);
    const ranked = hypotheses.sort(
      (left, right) => (left.score?.rank ?? 999) - (right.score?.rank ?? 999)
    );

    console.log(`${session.id} :: ${session.status}`);
    console.log(`Goal: ${session.goal}`);
    console.log(`Question: ${session.question}`);
    if (ranked.length === 0) {
      console.log("No hypotheses logged yet.");
      return;
    }

    for (const hypothesis of ranked) {
      console.log(
        `#${hypothesis.score?.rank ?? "-"} ${hypothesis.title} (${hypothesis.score?.total ?? "unscored"})`
      );
    }
  });

program
  .command("report")
  .requiredOption("--session <sessionId>", "Session id")
  .option("--out <path>", "Output Markdown file")
  .option("--workspace <dir>", "Workspace directory")
  .action(
    async (options: { session: string; out?: string; workspace?: string }) => {
      const workspace = await resolveWorkspace(options.workspace);
      const reportPath = await workspace.generateReport(options.session, options.out);
      console.log(`Generated report ${reportPath}`);
    }
  );

const copilotProgram = program
  .command("copilot")
  .description("Manage GitHub Copilot CLI scaffold files and bridge operations.");

copilotProgram
  .command("install")
  .option("--scope <scope>", "project | user", "project")
  .option("--dir <dir>", "Project directory", ".")
  .option("--force", "Overwrite existing scaffold files")
  .action(
    async (options: {
      scope: string;
      dir: string;
      force?: boolean;
    }) => {
      const scope = parseCopilotScope(options.scope);
      const result = await installCopilotScaffold(resolve(options.dir), {
        scope,
        ...(options.force ? { force: true } : {})
      });
      printScaffoldSummary(
        scope === "user" ? "Installed user Copilot skills with" : "Installed project Copilot scaffold with",
        result
      );
    }
  );

copilotProgram
  .command("update")
  .option("--scope <scope>", "project | user", "project")
  .option("--dir <dir>", "Project directory", ".")
  .option("--force", "Overwrite all scaffold files, even if they were edited locally")
  .action(
    async (options: {
      scope: string;
      dir: string;
      force?: boolean;
    }) => {
      const scope = parseCopilotScope(options.scope);
      const result = await installCopilotScaffold(resolve(options.dir), {
        scope,
        update: true,
        ...(options.force ? { force: true } : {})
      });
      printScaffoldSummary(
        scope === "user" ? "Updated user Copilot skills with" : "Updated project Copilot scaffold with",
        result
      );
    }
  );

copilotProgram
  .command("doctor")
  .option("--dir <dir>", "Project directory", ".")
  .option("--json", "Emit JSON output")
  .action(async (options: { dir: string; json?: boolean }) => {
    const result = await runCopilotDoctor(resolve(options.dir));
    if (options.json) {
      console.log(JSON.stringify(result, null, 2));
      return;
    }

    console.log(`Copilot CLI: ${result.copilotBinaryFound ? "found" : "missing"}`);
    if (result.copilotBinaryPath) {
      console.log(`  Path: ${result.copilotBinaryPath}`);
    }
    console.log(`Workspace: ${result.workspaceFound ? "found" : "missing"}`);
    if (result.workspaceRoot) {
      console.log(`  Root: ${result.workspaceRoot}`);
      console.log(`  Sessions: ${result.sessionCount}`);
    }
    console.log(
      `Project scaffold: ${result.missingProjectFiles.length === 0 ? "complete" : `missing ${result.missingProjectFiles.length} file(s)`}`
    );
    if (result.missingProjectFiles.length > 0) {
      for (const file of result.missingProjectFiles) {
        console.log(`  - ${file}`);
      }
    }
    console.log(
      `User skills: ${result.installedUserSkills.length} installed, ${result.missingUserSkills.length} missing`
    );
  });

copilotProgram
  .command("bridge")
  .description("Internal bridge command used by the repo-local Copilot extension.")
  .requiredOption("--operation <operation>", "Bridge operation")
  .option("--cwd <dir>", "Working directory", process.cwd())
  .option("--payload <json>", "JSON payload", "{}")
  .action(
    async (options: {
      operation: string;
      cwd: string;
      payload: string;
    }) => {
      const payload = JSON.parse(options.payload) as unknown;
      const result = await executeCopilotBridge(
        options.operation as CopilotBridgeOperation,
        options.cwd,
        payload
      );
      process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    }
  );

export async function runCli(argv = process.argv): Promise<void> {
  await program.parseAsync(argv);
}

runCli().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exitCode = 1;
});
