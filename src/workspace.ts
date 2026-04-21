import { dirname, join, resolve } from "node:path";
import { writeFile } from "node:fs/promises";
import { parse, stringify } from "yaml";

import type {
  AddArtifactInput,
  AddEvidenceInput,
  AddHypothesisInput,
  Artifact,
  Evidence,
  LedgerEvent,
  RankingWeights,
  ResearchSession,
  ResearchTemplate,
  WorkspaceConfig,
  CreateSessionInput,
  Hypothesis
} from "./models.js";
import { renderMarkdownReport } from "./report.js";
import { scoreHypotheses } from "./scoring.js";
import { DEFAULT_TEMPLATE_ID, DEFAULT_TEMPLATES, DEFAULT_WEIGHTS } from "./templates.js";
import {
  appendJsonLine,
  createId,
  ensureDirectory,
  fileExists,
  hashFileSha256,
  nowIso,
  readJsonFile,
  slugify,
  writeJsonFile
} from "./utils.js";

interface WorkspacePaths {
  root: string;
  configPath: string;
  ledgerDir: string;
  sessionsDir: string;
  reportsDir: string;
  templatesDir: string;
}

function workspacePaths(root: string): WorkspacePaths {
  const ledgerDir = join(root, ".researchflow");
  return {
    root,
    configPath: join(root, "researchflow.yml"),
    ledgerDir,
    sessionsDir: join(ledgerDir, "sessions"),
    reportsDir: join(ledgerDir, "reports"),
    templatesDir: join(ledgerDir, "templates")
  };
}

function mergeWeights(base: RankingWeights, override?: Partial<RankingWeights>): RankingWeights {
  return {
    ...base,
    ...override
  };
}

export class CopilotResearcherWorkspace {
  constructor(
    public readonly root: string,
    public readonly config: WorkspaceConfig
  ) {}

  static async init(rootDirectory: string, name?: string): Promise<CopilotResearcherWorkspace> {
    const root = resolve(rootDirectory);
    const paths = workspacePaths(root);

    if (await fileExists(paths.configPath)) {
      throw new Error(`copilot-researcher workspace already exists at ${paths.root}`);
    }

    await ensureDirectory(paths.root);
    await ensureDirectory(paths.sessionsDir);
    await ensureDirectory(paths.reportsDir);
    await ensureDirectory(paths.templatesDir);

    const config: WorkspaceConfig = {
      version: 1,
      name: name?.trim() || "copilot-researcher workspace",
      createdAt: nowIso(),
      defaultTemplateId: DEFAULT_TEMPLATE_ID,
      defaultWeights: DEFAULT_WEIGHTS
    };

    await writeFile(paths.configPath, stringify(config), "utf8");
    for (const template of DEFAULT_TEMPLATES) {
      const templatePath = join(paths.templatesDir, `${template.id}.yml`);
      await writeFile(templatePath, stringify(template), "utf8");
    }

    const workspace = new CopilotResearcherWorkspace(root, config);
    await workspace.recordWorkspaceEvent("workspace_initialized", {
      name: config.name
    });
    return workspace;
  }

  static async find(startDirectory: string): Promise<CopilotResearcherWorkspace> {
    let current = resolve(startDirectory);

    while (true) {
      const configPath = join(current, "researchflow.yml");
      if (await fileExists(configPath)) {
        const rawConfig = await readJsonOrYaml<WorkspaceConfig>(configPath);
        return new CopilotResearcherWorkspace(current, rawConfig);
      }

      const parent = dirname(current);
      if (parent === current) {
        throw new Error(
          `No copilot-researcher workspace found from ${startDirectory}; run "copilot-researcher init" first`
        );
      }
      current = parent;
    }
  }

  get paths(): WorkspacePaths {
    return workspacePaths(this.root);
  }

  private sessionDir(sessionId: string): string {
    return join(this.paths.sessionsDir, sessionId);
  }

  private sessionFile(sessionId: string): string {
    return join(this.sessionDir(sessionId), "session.json");
  }

  private eventsFile(sessionId: string): string {
    return join(this.sessionDir(sessionId), "events.jsonl");
  }

  private hypothesisDir(sessionId: string): string {
    return join(this.sessionDir(sessionId), "hypotheses");
  }

  private evidenceDir(sessionId: string): string {
    return join(this.sessionDir(sessionId), "evidence");
  }

  private artifactDir(sessionId: string): string {
    return join(this.sessionDir(sessionId), "artifacts");
  }

  async createSession(input: CreateSessionInput): Promise<ResearchSession> {
    const template = await this.loadTemplate(input.templateId);
    const id = createId(slugify(template.id || "session"));
    const createdAt = nowIso();
    const weights = mergeWeights(
      this.config.defaultWeights,
      template.defaultWeights
    );

    const session: ResearchSession = {
      id,
      goal: input.goal.trim(),
      question: input.question.trim(),
      templateId: template.id,
      templateName: template.name,
      status: "draft",
      createdAt,
      updatedAt: createdAt,
      summary: `Session created for "${input.goal.trim()}". Add hypotheses, evidence, and artifacts before scoring.`,
      rankedHypothesisIds: [],
      weights
    };

    await ensureDirectory(this.hypothesisDir(id));
    await ensureDirectory(this.evidenceDir(id));
    await ensureDirectory(this.artifactDir(id));
    await writeJsonFile(this.sessionFile(id), session);
    await this.recordEvent(id, "session_created", {
      goal: session.goal,
      question: session.question,
      templateId: session.templateId
    });
    return session;
  }

  async getSession(sessionId: string): Promise<ResearchSession> {
    const path = this.sessionFile(sessionId);
    if (!(await fileExists(path))) {
      throw new Error(`Session "${sessionId}" does not exist`);
    }
    return readJsonFile<ResearchSession>(path);
  }

  async listSessions(): Promise<ResearchSession[]> {
    if (!(await fileExists(this.paths.sessionsDir))) {
      return [];
    }

    const entries = await import("node:fs/promises").then((fs) =>
      fs.readdir(this.paths.sessionsDir, { withFileTypes: true })
    );
    const sessions = await Promise.all(
      entries
        .filter((entry) => entry.isDirectory())
        .map((entry) => readJsonFile<ResearchSession>(join(this.paths.sessionsDir, entry.name, "session.json")))
    );

    return sessions.sort((left, right) => left.createdAt.localeCompare(right.createdAt));
  }

  async listTemplates(): Promise<ResearchTemplate[]> {
    if (!(await fileExists(this.paths.templatesDir))) {
      return [...DEFAULT_TEMPLATES];
    }

    const entries = await import("node:fs/promises").then((fs) =>
      fs.readdir(this.paths.templatesDir, { withFileTypes: true })
    );
    const templates = await Promise.all(
      entries
        .filter((entry) => entry.isFile() && (entry.name.endsWith(".yml") || entry.name.endsWith(".yaml")))
        .map((entry) => readJsonOrYaml<ResearchTemplate>(join(this.paths.templatesDir, entry.name)))
    );

    return templates.sort((left, right) => left.name.localeCompare(right.name));
  }

  async listHypotheses(sessionId: string): Promise<Hypothesis[]> {
    return this.readCollection<Hypothesis>(this.hypothesisDir(sessionId));
  }

  async listEvidence(sessionId: string): Promise<Evidence[]> {
    return this.readCollection<Evidence>(this.evidenceDir(sessionId));
  }

  async listArtifacts(sessionId: string): Promise<Artifact[]> {
    return this.readCollection<Artifact>(this.artifactDir(sessionId));
  }

  async addHypothesis(input: AddHypothesisInput): Promise<Hypothesis> {
    const session = await this.getSession(input.sessionId);
    validateRating(input.novelty, "novelty");
    validateRating(input.feasibility, "feasibility");
    validateRating(input.impact, "impact");
    validateRating(input.confidence ?? 3, "confidence");

    const hypothesis: Hypothesis = {
      id: createId("hyp"),
      sessionId: session.id,
      title: input.title.trim(),
      statement: input.statement.trim(),
      tags: input.tags ?? [],
      metrics: {
        novelty: input.novelty,
        feasibility: input.feasibility,
        impact: input.impact,
        confidence: input.confidence ?? 3
      },
      createdAt: nowIso(),
      updatedAt: nowIso()
    };

    await writeJsonFile(
      join(this.hypothesisDir(session.id), `${hypothesis.id}.json`),
      hypothesis
    );
    await this.bumpSession(session, `Added hypothesis "${hypothesis.title}".`);
    await this.recordEvent(session.id, "hypothesis_added", {
      hypothesisId: hypothesis.id,
      title: hypothesis.title
    });
    return hypothesis;
  }

  async addEvidence(input: AddEvidenceInput): Promise<Evidence> {
    const session = await this.getSession(input.sessionId);
    await this.ensureHypothesisExists(session.id, input.hypothesisId);
    validateRating(input.strength, "strength");
    validateRating(input.relevance, "relevance");

    const evidence: Evidence = {
      id: createId("ev"),
      sessionId: session.id,
      hypothesisId: input.hypothesisId,
      summary: input.summary.trim(),
      source: input.source.trim(),
      strength: input.strength,
      relevance: input.relevance,
      direction: input.direction,
      createdAt: nowIso()
    };

    await writeJsonFile(
      join(this.evidenceDir(session.id), `${evidence.id}.json`),
      evidence
    );
    await this.bumpSession(session, `Added evidence for hypothesis ${input.hypothesisId}.`);
    await this.recordEvent(session.id, "evidence_added", {
      evidenceId: evidence.id,
      hypothesisId: evidence.hypothesisId,
      direction: evidence.direction
    });
    return evidence;
  }

  async addArtifact(input: AddArtifactInput): Promise<Artifact> {
    const session = await this.getSession(input.sessionId);
    if (!(await fileExists(resolve(this.root, input.path)))) {
      throw new Error(`Artifact path does not exist: ${input.path}`);
    }
    if (input.hypothesisId) {
      await this.ensureHypothesisExists(session.id, input.hypothesisId);
    }

    const absolutePath = resolve(this.root, input.path);
    const artifact: Artifact = {
      id: createId("art"),
      sessionId: session.id,
      label: input.label.trim(),
      path: absolutePath,
      kind: input.kind ?? "other",
      description: input.description?.trim() ?? "",
      sha256: await hashFileSha256(absolutePath),
      createdAt: nowIso()
    };
    if (input.hypothesisId) {
      artifact.hypothesisId = input.hypothesisId;
    }

    await writeJsonFile(
      join(this.artifactDir(session.id), `${artifact.id}.json`),
      artifact
    );
    await this.bumpSession(session, `Registered artifact "${artifact.label}".`);
    await this.recordEvent(session.id, "artifact_added", {
      artifactId: artifact.id,
      hypothesisId: artifact.hypothesisId ?? null,
      path: artifact.path
    });
    return artifact;
  }

  async scoreSession(sessionId: string): Promise<Hypothesis[]> {
    const session = await this.getSession(sessionId);
    const hypotheses = await this.listHypotheses(sessionId);
    if (hypotheses.length === 0) {
      throw new Error(`Session "${sessionId}" has no hypotheses to score`);
    }

    const evidence = await this.listEvidence(sessionId);
    const ranked = scoreHypotheses(hypotheses, evidence, session.weights);

    for (const hypothesis of ranked) {
      await writeJsonFile(
        join(this.hypothesisDir(sessionId), `${hypothesis.id}.json`),
        hypothesis
      );
    }

    session.status = "scored";
    session.updatedAt = nowIso();
    session.rankedHypothesisIds = ranked.map((entry) => entry.id);
    session.summary =
      ranked.length > 0
        ? `Top hypothesis: "${ranked[0]?.title}" with score ${ranked[0]?.score?.total}.`
        : session.summary;
    await writeJsonFile(this.sessionFile(sessionId), session);
    await this.recordEvent(sessionId, "session_scored", {
      rankedHypothesisIds: session.rankedHypothesisIds
    });
    return ranked;
  }

  async generateReport(sessionId: string, outputPath?: string): Promise<string> {
    const session = await this.getSession(sessionId);
    const hypotheses = await this.listHypotheses(sessionId);
    const evidence = await this.listEvidence(sessionId);
    const artifacts = await this.listArtifacts(sessionId);
    const template = await this.loadTemplate(session.templateId);

    const markdown = renderMarkdownReport({
      session,
      template,
      hypotheses: hypotheses.sort(
        (left, right) => (left.score?.rank ?? 999) - (right.score?.rank ?? 999)
      ),
      evidence,
      artifacts
    });

    const reportPath =
      outputPath ?? join(this.paths.reportsDir, `${session.id}.md`);
    await ensureDirectory(dirname(reportPath));
    await writeFile(reportPath, markdown, "utf8");

    session.status = "reported";
    session.updatedAt = nowIso();
    session.summary = `Report generated at ${reportPath}.`;
    await writeJsonFile(this.sessionFile(sessionId), session);
    await this.recordEvent(sessionId, "report_generated", { reportPath });
    return reportPath;
  }

  async loadTemplate(templateId?: string): Promise<ResearchTemplate> {
    const requestedId = templateId || this.config.defaultTemplateId;
    const templatePath = join(this.paths.templatesDir, `${requestedId}.yml`);
    if (await fileExists(templatePath)) {
      return readJsonOrYaml<ResearchTemplate>(templatePath);
    }

    const fallback = DEFAULT_TEMPLATES.find((template) => template.id === requestedId);
    if (!fallback) {
      throw new Error(`Unknown template "${requestedId}"`);
    }
    return fallback;
  }

  private async readCollection<T extends { createdAt?: string }>(directory: string): Promise<T[]> {
    if (!(await fileExists(directory))) {
      return [];
    }

    const entries = await import("node:fs/promises").then((fs) =>
      fs.readdir(directory, { withFileTypes: true })
    );
    const items = await Promise.all(
      entries
        .filter((entry) => entry.isFile() && entry.name.endsWith(".json"))
        .map((entry) => readJsonFile<T>(join(directory, entry.name)))
    );

    return items.sort((left, right) =>
      (left.createdAt ?? "").localeCompare(right.createdAt ?? "")
    );
  }

  private async ensureHypothesisExists(sessionId: string, hypothesisId: string): Promise<void> {
    const path = join(this.hypothesisDir(sessionId), `${hypothesisId}.json`);
    if (!(await fileExists(path))) {
      throw new Error(`Hypothesis "${hypothesisId}" does not exist in session "${sessionId}"`);
    }
  }

  private async bumpSession(session: ResearchSession, summary: string): Promise<void> {
    session.updatedAt = nowIso();
    session.summary = summary;
    await writeJsonFile(this.sessionFile(session.id), session);
  }

  private async recordWorkspaceEvent(
    type: LedgerEvent["type"],
    payload: Record<string, unknown>
  ): Promise<void> {
    const event: LedgerEvent = {
      id: createId("evt"),
      type,
      timestamp: nowIso(),
      payload
    };
    await appendJsonLine(join(this.paths.ledgerDir, "events.jsonl"), event);
  }

  private async recordEvent(
    sessionId: string,
    type: LedgerEvent["type"],
    payload: Record<string, unknown>
  ): Promise<void> {
    const event: LedgerEvent = {
      id: createId("evt"),
      type,
      timestamp: nowIso(),
      payload
    };
    await appendJsonLine(this.eventsFile(sessionId), event);
  }
}

function validateRating(value: number, label: string): void {
  if (!Number.isInteger(value) || value < 1 || value > 5) {
    throw new Error(`"${label}" must be an integer from 1 to 5`);
  }
}

async function readJsonOrYaml<T>(path: string): Promise<T> {
  const { readFile } = await import("node:fs/promises");
  const contents = await readFile(path, "utf8");
  if (path.endsWith(".json")) {
    return JSON.parse(contents) as T;
  }
  return parse(contents) as T;
}
