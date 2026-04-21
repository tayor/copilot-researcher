import { readdir, readFile, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { delimiter, dirname, join, resolve } from "node:path";

import type {
  AddArtifactInput,
  AddEvidenceInput,
  AddHypothesisInput,
  ArtifactKind,
  CreateSessionInput,
  ResearchTemplate
} from "./models.js";
import { DEFAULT_TEMPLATES } from "./templates.js";
import { ensureDirectory, fileExists } from "./utils.js";
import { CopilotResearcherWorkspace } from "./workspace.js";

const MANAGED_MARKER = "Managed by copilot-researcher Copilot scaffold";
const LEGACY_MANAGED_MARKERS = [
  "Managed by ResearchFlow Copilot scaffold",
  MANAGED_MARKER
] as const;
const SKILL_NAMES = [
  "literature-scout",
  "hypothesis-scoring",
  "experiment-design",
  "replication-check",
  "report-synthesis"
] as const;

const PROJECT_SCAFFOLD_FILES = [
  "AGENTS.md",
  ".github/copilot-instructions.md",
  ".github/instructions/research.instructions.md",
  ".github/instructions/experiments.instructions.md",
  ".github/instructions/reports.instructions.md",
  ".github/agents/research-orchestrator.agent.md",
  ".github/agents/literature-reviewer.agent.md",
  ".github/agents/hypothesis-critic.agent.md",
  ".github/agents/experiment-designer.agent.md",
  ".github/agents/reproducibility-auditor.agent.md",
  ".github/agents/report-editor.agent.md",
  ".github/skills/literature-scout/SKILL.md",
  ".github/skills/hypothesis-scoring/SKILL.md",
  ".github/skills/experiment-design/SKILL.md",
  ".github/skills/replication-check/SKILL.md",
  ".github/skills/report-synthesis/SKILL.md",
  ".github/extensions/copilot-researcher-ledger/extension.mjs"
] as const;

type ScaffoldMode = "install" | "update";
export type CopilotInstallScope = "project" | "user";
export type CopilotBridgeOperation =
  | "init-workspace"
  | "get-workspace-status"
  | "list-templates"
  | "create-session"
  | "get-session"
  | "add-hypothesis"
  | "add-evidence"
  | "add-artifact"
  | "score-session"
  | "generate-report";

interface ScaffoldMapping {
  sourceRelativePath: string;
  destinationRelativePath: string;
  scope: CopilotInstallScope;
}

export interface CopilotScaffoldOptions {
  scope?: CopilotInstallScope;
  force?: boolean;
  update?: boolean;
  homeDir?: string;
}

export interface CopilotScaffoldResult {
  scope: CopilotInstallScope;
  mode: ScaffoldMode;
  targetRoot: string;
  written: string[];
  updated: string[];
  unchanged: string[];
  skipped: string[];
}

export interface CopilotDoctorResult {
  targetDir: string;
  copilotBinaryFound: boolean;
  copilotBinaryPath: string | null;
  workspaceFound: boolean;
  workspaceRoot: string | null;
  sessionCount: number;
  missingProjectFiles: string[];
  installedUserSkills: string[];
  missingUserSkills: string[];
}

const PROJECT_MAPPINGS: readonly ScaffoldMapping[] = PROJECT_SCAFFOLD_FILES.map((relativePath) => ({
  sourceRelativePath: relativePath,
  destinationRelativePath: relativePath,
  scope: "project"
}));

const USER_MAPPINGS: readonly ScaffoldMapping[] = SKILL_NAMES.map((skillName) => ({
  sourceRelativePath: `.github/skills/${skillName}/SKILL.md`,
  destinationRelativePath: `.copilot/skills/${skillName}/SKILL.md`,
  scope: "user"
}));

function packageRoot(): string {
  return resolve(import.meta.dirname, "..");
}

function mappingsForScope(scope: CopilotInstallScope): readonly ScaffoldMapping[] {
  return scope === "project" ? PROJECT_MAPPINGS : USER_MAPPINGS;
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null ? (value as Record<string, unknown>) : {};
}

function requireString(record: Record<string, unknown>, key: string): string {
  const value = record[key];
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`"${key}" must be a non-empty string`);
  }
  return value;
}

function optionalString(record: Record<string, unknown>, key: string): string | undefined {
  const value = record[key];
  if (typeof value !== "string" || value.trim() === "") {
    return undefined;
  }
  return value;
}

function requireInteger(record: Record<string, unknown>, key: string): number {
  const value = record[key];
  if (typeof value === "number" && Number.isInteger(value)) {
    return value;
  }
  if (typeof value === "string") {
    const parsed = Number.parseInt(value, 10);
    if (Number.isInteger(parsed)) {
      return parsed;
    }
  }
  throw new Error(`"${key}" must be an integer`);
}

function optionalStringArray(record: Record<string, unknown>, key: string): string[] | undefined {
  const value = record[key];
  if (!Array.isArray(value)) {
    return undefined;
  }
  const entries = value.filter((entry): entry is string => typeof entry === "string");
  return entries.length > 0 ? entries : [];
}

async function copyManagedFile(
  sourcePath: string,
  destinationPath: string,
  mode: ScaffoldMode,
  force = false
): Promise<"written" | "updated" | "unchanged" | "skipped"> {
  const sourceContents = await readFile(sourcePath, "utf8");
  await ensureDirectory(dirname(destinationPath));

  if (!(await fileExists(destinationPath))) {
    await writeFile(destinationPath, sourceContents, "utf8");
    return mode === "update" ? "updated" : "written";
  }

  const existingContents = await readFile(destinationPath, "utf8");
  if (existingContents === sourceContents) {
    return "unchanged";
  }

  if (force || (mode === "update" && isManagedScaffold(existingContents))) {
    await writeFile(destinationPath, sourceContents, "utf8");
    return mode === "update" ? "updated" : "written";
  }

  return "skipped";
}

function summarizeTemplate(
  template: ResearchTemplate
): Pick<
  ResearchTemplate,
  | "id"
  | "name"
  | "description"
  | "prompts"
  | "evidenceQuestions"
  | "recommendedArtifacts"
  | "nextStepGuidance"
  | "defaultWeights"
> {
  return {
    id: template.id,
    name: template.name,
    description: template.description,
    prompts: template.prompts,
    evidenceQuestions: template.evidenceQuestions,
    recommendedArtifacts: template.recommendedArtifacts,
    nextStepGuidance: template.nextStepGuidance,
    ...(template.defaultWeights ? { defaultWeights: template.defaultWeights } : {})
  };
}

export function projectScaffoldFiles(): readonly string[] {
  return PROJECT_SCAFFOLD_FILES;
}

export async function installCopilotScaffold(
  targetDir: string,
  options: CopilotScaffoldOptions = {}
): Promise<CopilotScaffoldResult> {
  const scope = options.scope ?? "project";
  const mode: ScaffoldMode = options.update ? "update" : "install";
  const targetRoot =
    scope === "user" ? resolve(options.homeDir ?? homedir()) : resolve(targetDir);
  const result: CopilotScaffoldResult = {
    scope,
    mode,
    targetRoot,
    written: [],
    updated: [],
    unchanged: [],
    skipped: []
  };

  await ensureDirectory(targetRoot);

  for (const mapping of mappingsForScope(scope)) {
    const sourcePath = resolve(packageRoot(), mapping.sourceRelativePath);
    const destinationPath = resolve(targetRoot, mapping.destinationRelativePath);
    const action = await copyManagedFile(sourcePath, destinationPath, mode, options.force);
    if (action === "written") {
      result.written.push(mapping.destinationRelativePath);
    } else if (action === "updated") {
      result.updated.push(mapping.destinationRelativePath);
    } else if (action === "unchanged") {
      result.unchanged.push(mapping.destinationRelativePath);
    } else {
      result.skipped.push(mapping.destinationRelativePath);
    }
  }

  return result;
}

async function findExecutable(name: string): Promise<string | null> {
  const pathValue = process.env.PATH ?? "";
  const directories = pathValue.split(delimiter).filter(Boolean);
  const candidates =
    process.platform === "win32"
      ? [name, `${name}.exe`, `${name}.cmd`, `${name}.bat`]
      : [name];

  for (const directory of directories) {
    for (const candidate of candidates) {
      const fullPath = join(directory, candidate);
      if (await fileExists(fullPath)) {
        return fullPath;
      }
    }
  }

  return null;
}

async function workspaceSummary(targetDir: string): Promise<{
  workspaceFound: boolean;
  workspaceRoot: string | null;
  sessionCount: number;
}> {
  try {
    const workspace = await CopilotResearcherWorkspace.find(targetDir);
    const sessions = await workspace.listSessions();
    return {
      workspaceFound: true,
      workspaceRoot: workspace.root,
      sessionCount: sessions.length
    };
  } catch {
    return {
      workspaceFound: false,
      workspaceRoot: null,
      sessionCount: 0
    };
  }
}

export async function runCopilotDoctor(
  targetDir: string,
  homeDir = homedir()
): Promise<CopilotDoctorResult> {
  const resolvedTargetDir = resolve(targetDir);
  const copilotBinaryPath = await findExecutable("copilot");
  const installedUserSkills: string[] = [];
  const missingUserSkills: string[] = [];

  for (const skillName of SKILL_NAMES) {
    const skillPath = resolve(homeDir, ".copilot", "skills", skillName, "SKILL.md");
    if (await fileExists(skillPath)) {
      installedUserSkills.push(skillName);
    } else {
      missingUserSkills.push(skillName);
    }
  }

  const missingProjectFiles: string[] = [];
  for (const relativePath of PROJECT_SCAFFOLD_FILES) {
    const fullPath = resolve(resolvedTargetDir, relativePath);
    if (!(await fileExists(fullPath))) {
      missingProjectFiles.push(relativePath);
    }
  }

  const workspace = await workspaceSummary(resolvedTargetDir);
  return {
    targetDir: resolvedTargetDir,
    copilotBinaryFound: copilotBinaryPath !== null,
    copilotBinaryPath,
    workspaceFound: workspace.workspaceFound,
    workspaceRoot: workspace.workspaceRoot,
    sessionCount: workspace.sessionCount,
    missingProjectFiles,
    installedUserSkills,
    missingUserSkills
  };
}

async function availableTemplates(cwd: string): Promise<ResearchTemplate[]> {
  try {
      const workspace = await CopilotResearcherWorkspace.find(cwd);
    return workspace.listTemplates();
  } catch {
    return [...DEFAULT_TEMPLATES];
  }
}

async function workspaceStatus(cwd: string): Promise<Record<string, unknown>> {
  const doctor = await runCopilotDoctor(cwd);

  try {
    const workspace = await CopilotResearcherWorkspace.find(cwd);
    const sessions = await workspace.listSessions();
    const templates = await workspace.listTemplates();
    return {
      hasWorkspace: true,
      root: workspace.root,
      workspaceName: workspace.config.name,
      sessionCount: sessions.length,
      sessions: sessions.map((session) => ({
        id: session.id,
        status: session.status,
        goal: session.goal,
        question: session.question,
        updatedAt: session.updatedAt
      })),
      templates: templates.map(summarizeTemplate),
      copilotProjectReady: doctor.missingProjectFiles.length === 0,
      missingProjectFiles: doctor.missingProjectFiles
    };
  } catch {
    return {
      hasWorkspace: false,
      recommendedCommand: 'copilot-researcher init . --copilot --name "My Research Project"',
      templates: DEFAULT_TEMPLATES.map(summarizeTemplate),
      copilotProjectReady: doctor.missingProjectFiles.length === 0,
      missingProjectFiles: doctor.missingProjectFiles
    };
  }
}

async function sessionSnapshot(cwd: string, sessionId: string): Promise<Record<string, unknown>> {
  const workspace = await CopilotResearcherWorkspace.find(cwd);
  const session = await workspace.getSession(sessionId);
  const hypotheses = await workspace.listHypotheses(sessionId);
  const evidence = await workspace.listEvidence(sessionId);
  const artifacts = await workspace.listArtifacts(sessionId);

  const rankedHypotheses = [...hypotheses].sort(
    (left, right) => (left.score?.rank ?? 999) - (right.score?.rank ?? 999)
  );

  return {
    session,
    hypotheses: rankedHypotheses,
    evidence,
    artifacts
  };
}

export async function executeCopilotBridge(
  operation: CopilotBridgeOperation,
  cwd: string,
  payload: unknown
): Promise<unknown> {
  const resolvedCwd = resolve(cwd);
  const record = asRecord(payload);

  switch (operation) {
    case "init-workspace": {
      const name = optionalString(record, "name");
      const directory = optionalString(record, "directory") ?? ".";
      const workspace = await CopilotResearcherWorkspace.init(resolve(resolvedCwd, directory), name);
      return {
        ok: true,
        root: workspace.root,
        workspaceName: workspace.config.name
      };
    }

    case "get-workspace-status":
      return workspaceStatus(resolvedCwd);

    case "list-templates": {
      const templates = await availableTemplates(resolvedCwd);
      return {
        templates: templates.map(summarizeTemplate)
      };
    }

    case "create-session": {
      const workspace = await CopilotResearcherWorkspace.find(resolvedCwd);
      const input: CreateSessionInput = {
        goal: requireString(record, "goal"),
        question: requireString(record, "question")
      };
      const templateId = optionalString(record, "templateId");
      if (templateId) {
        input.templateId = templateId;
      }
      const session = await workspace.createSession(input);
      return { session };
    }

    case "get-session":
      return sessionSnapshot(resolvedCwd, requireString(record, "sessionId"));

    case "add-hypothesis": {
      const workspace = await CopilotResearcherWorkspace.find(resolvedCwd);
      const input: AddHypothesisInput = {
        sessionId: requireString(record, "sessionId"),
        title: requireString(record, "title"),
        statement: requireString(record, "statement"),
        novelty: requireInteger(record, "novelty"),
        feasibility: requireInteger(record, "feasibility"),
        impact: requireInteger(record, "impact")
      };
      const confidence = record.confidence;
      if (confidence !== undefined) {
        input.confidence = requireInteger(record, "confidence");
      }
      const tags = optionalStringArray(record, "tags");
      if (tags) {
        input.tags = tags;
      }
      const hypothesis = await workspace.addHypothesis(input);
      return { hypothesis };
    }

    case "add-evidence": {
      const workspace = await CopilotResearcherWorkspace.find(resolvedCwd);
      const input: AddEvidenceInput = {
        sessionId: requireString(record, "sessionId"),
        hypothesisId: requireString(record, "hypothesisId"),
        summary: requireString(record, "summary"),
        source: requireString(record, "source"),
        strength: requireInteger(record, "strength"),
        relevance: requireInteger(record, "relevance"),
        direction: requireString(record, "direction") as AddEvidenceInput["direction"]
      };
      const evidence = await workspace.addEvidence(input);
      return { evidence };
    }

    case "add-artifact": {
      const workspace = await CopilotResearcherWorkspace.find(resolvedCwd);
      const input: AddArtifactInput = {
        sessionId: requireString(record, "sessionId"),
        label: requireString(record, "label"),
        path: requireString(record, "path")
      };
      const kind = optionalString(record, "kind");
      const description = optionalString(record, "description");
      const hypothesisId = optionalString(record, "hypothesisId");
      if (kind) {
        input.kind = kind as ArtifactKind;
      }
      if (description) {
        input.description = description;
      }
      if (hypothesisId) {
        input.hypothesisId = hypothesisId;
      }
      const artifact = await workspace.addArtifact(input);
      return { artifact };
    }

    case "score-session": {
      const workspace = await CopilotResearcherWorkspace.find(resolvedCwd);
      const rankedHypotheses = await workspace.scoreSession(requireString(record, "sessionId"));
      return { rankedHypotheses };
    }

    case "generate-report": {
      const workspace = await CopilotResearcherWorkspace.find(resolvedCwd);
      const reportPath = await workspace.generateReport(
        requireString(record, "sessionId"),
        optionalString(record, "outputPath")
      );
      return { reportPath };
    }

    default:
      throw new Error(`Unknown Copilot bridge operation: ${String(operation)}`);
  }
}

export async function scaffoldSourceManifest(): Promise<string[]> {
  const root = packageRoot();
  const files: string[] = [];
  for (const mapping of [...PROJECT_MAPPINGS, ...USER_MAPPINGS]) {
    const sourcePath = resolve(root, mapping.sourceRelativePath);
    if (await fileExists(sourcePath)) {
      files.push(mapping.sourceRelativePath);
    }
  }
  return files.sort();
}

export async function listPackageSkillNames(): Promise<string[]> {
  const skillsDir = resolve(packageRoot(), ".github", "skills");
  if (!(await fileExists(skillsDir))) {
    return [];
  }

  const entries = await readdir(skillsDir, { withFileTypes: true });
  return entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name).sort();
}
function isManagedScaffold(contents: string): boolean {
  return LEGACY_MANAGED_MARKERS.some((marker) => contents.includes(marker));
}
