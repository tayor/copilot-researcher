// Managed by copilot-researcher Copilot scaffold. Run `copilot-researcher copilot update` to refresh.

import { joinSession } from "@github/copilot-sdk/extension";
import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";

const execFileAsync = promisify(execFile);
const EXTENSION_DIR = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(EXTENSION_DIR, "..", "..", "..");
const LOCAL_DIST_CLI = resolve(REPO_ROOT, "dist", "cli.js");

function bridgeCommand() {
  if (existsSync(LOCAL_DIST_CLI)) {
    return {
      command: process.execPath,
      args: [LOCAL_DIST_CLI, "copilot", "bridge"],
    };
  }

  return {
    command: "copilot-researcher",
    args: ["copilot", "bridge"],
  };
}

async function callBridge(operation, payload = {}) {
  const bridge = bridgeCommand();
  const args = [
    ...bridge.args,
    "--operation",
    operation,
    "--cwd",
    REPO_ROOT,
    "--payload",
    JSON.stringify(payload),
  ];

  const { stdout } = await execFileAsync(bridge.command, args, {
    cwd: REPO_ROOT,
    env: process.env,
  });

  return JSON.parse(stdout);
}

function success(result) {
  return {
    textResultForLlm: JSON.stringify(result, null, 2),
    resultType: "success",
  };
}

function failure(error) {
  const message = error instanceof Error ? error.message : String(error);
  return {
    textResultForLlm: message,
    resultType: "failure",
  };
}

function makeTool(name, description, operation, parameters) {
  return {
    name,
    description,
    parameters,
    handler: async (args) => {
      try {
        const result = await callBridge(operation, args ?? {});
        return success(result);
      } catch (error) {
        return failure(error);
      }
    },
  };
}

function workspaceContext(status) {
  if (!status?.hasWorkspace) {
    return [
      "No copilot-researcher workspace is initialized in this repository yet.",
      "If the user wants durable research tracking, call researchflow_init_workspace.",
      "If they only want ephemeral advice, you can continue without the durable ledger."
    ].join("\n");
  }

  const sessions = Array.isArray(status.sessions)
    ? status.sessions
        .map((session) => `- ${session.id} (${session.status}): ${session.goal}`)
        .join("\n")
    : "No sessions recorded yet.";
  const templates = Array.isArray(status.templates)
    ? status.templates.map((template) => template.id).join(", ")
    : "";

  return [
    `copilot-researcher workspace: ${status.workspaceName} (${status.root})`,
    `Sessions:\n${sessions || "No sessions recorded yet."}`,
    `Templates: ${templates || "none"}`,
    "Prefer the researchflow_* tools for durable research state."
  ].join("\n");
}

const session = await joinSession({
  tools: [
    makeTool(
      "researchflow_get_workspace_status",
      "Inspect the current copilot-researcher workspace, available sessions, templates, and project scaffold status.",
      "get-workspace-status",
      {
        type: "object",
        properties: {},
      }
    ),
    makeTool(
      "researchflow_init_workspace",
      "Initialize a copilot-researcher workspace in the current repository when the user wants durable research tracking.",
      "init-workspace",
      {
        type: "object",
        properties: {
          name: { type: "string", description: "Optional workspace display name." },
          directory: { type: "string", description: "Optional subdirectory to initialize." },
        },
      }
    ),
    makeTool(
      "researchflow_list_templates",
      "List the available session templates for this workspace.",
      "list-templates",
      {
        type: "object",
        properties: {},
      }
    ),
    makeTool(
      "researchflow_create_session",
      "Create a durable session for a research goal and question.",
      "create-session",
      {
        type: "object",
        properties: {
          goal: { type: "string", description: "Research goal." },
          question: { type: "string", description: "Primary research question." },
          templateId: { type: "string", description: "Optional template id." },
        },
        required: ["goal", "question"],
      }
    ),
    makeTool(
      "researchflow_get_session",
      "Fetch the current session snapshot including ranked hypotheses, evidence, and artifacts.",
      "get-session",
      {
        type: "object",
        properties: {
          sessionId: { type: "string", description: "Session id." },
        },
        required: ["sessionId"],
      }
    ),
    makeTool(
      "researchflow_add_hypothesis",
      "Persist a hypothesis in the current session.",
      "add-hypothesis",
      {
        type: "object",
        properties: {
          sessionId: { type: "string" },
          title: { type: "string" },
          statement: { type: "string" },
          novelty: { type: "integer" },
          feasibility: { type: "integer" },
          impact: { type: "integer" },
          confidence: { type: "integer" },
          tags: {
            type: "array",
            items: { type: "string" },
          },
        },
        required: ["sessionId", "title", "statement", "novelty", "feasibility", "impact"],
      }
    ),
    makeTool(
      "researchflow_add_evidence",
      "Persist supporting, contradicting, or neutral evidence for a hypothesis.",
      "add-evidence",
      {
        type: "object",
        properties: {
          sessionId: { type: "string" },
          hypothesisId: { type: "string" },
          summary: { type: "string" },
          source: { type: "string" },
          strength: { type: "integer" },
          relevance: { type: "integer" },
          direction: {
            type: "string",
            enum: ["support", "contradict", "neutral"],
          },
        },
        required: ["sessionId", "hypothesisId", "summary", "source", "strength", "relevance", "direction"],
      }
    ),
    makeTool(
      "researchflow_add_artifact",
      "Register an artifact file for a session or hypothesis.",
      "add-artifact",
      {
        type: "object",
        properties: {
          sessionId: { type: "string" },
          label: { type: "string" },
          path: { type: "string" },
          kind: {
            type: "string",
            enum: ["dataset", "note", "script", "figure", "report", "other"],
          },
          description: { type: "string" },
          hypothesisId: { type: "string" },
        },
        required: ["sessionId", "label", "path"],
      }
    ),
    makeTool(
      "researchflow_score_session",
      "Rank the current session hypotheses based on the configured scoring rules.",
      "score-session",
      {
        type: "object",
        properties: {
          sessionId: { type: "string" },
        },
        required: ["sessionId"],
      }
    ),
    makeTool(
      "researchflow_generate_report",
      "Generate the markdown report artifact for a session.",
      "generate-report",
      {
        type: "object",
        properties: {
          sessionId: { type: "string" },
          outputPath: { type: "string" },
        },
        required: ["sessionId"],
      }
    ),
  ],
  hooks: {
    onSessionStart: async () => {
      try {
        const status = await callBridge("get-workspace-status");
        return { additionalContext: workspaceContext(status) };
      } catch {
        return undefined;
      }
    },
    onUserPromptSubmitted: async (input) => {
      if (!/research|hypothesis|evidence|experiment|report|replication/i.test(input.prompt)) {
        return undefined;
      }

      try {
        const status = await callBridge("get-workspace-status");
        if (status?.hasWorkspace) {
          return undefined;
        }

        return {
          additionalContext:
            "No copilot-researcher workspace exists yet. If the user wants durable research tracking, call researchflow_init_workspace before proceeding."
        };
      } catch {
        return undefined;
      }
    },
  },
});

await session.log("copilot-researcher Copilot extension ready", { ephemeral: true });
