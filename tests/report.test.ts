import assert from "node:assert/strict";
import test from "node:test";

import type { Artifact, Hypothesis, ResearchSession } from "../src/models.js";
import { renderMarkdownReport } from "../src/report.js";
import { DEFAULT_TEMPLATES, DEFAULT_WEIGHTS } from "../src/templates.js";

test("physics simulation reports include workflow guidance and artifact coverage", () => {
  const template = DEFAULT_TEMPLATES.find((entry) => entry.id === "physics-simulation");
  assert.ok(template);

  const session: ResearchSession = {
    id: "session_1",
    goal: "Rank multiphysics simulation studies for a plasma actuator program",
    question: "Which coupled model should we validate first?",
    templateId: template.id,
    templateName: template.name,
    status: "scored",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    summary: "A validated electro-thermal baseline is the best near-term path.",
    rankedHypothesisIds: ["hyp_1"],
    weights: DEFAULT_WEIGHTS
  };

  const hypotheses: Hypothesis[] = [
    {
      id: "hyp_1",
      sessionId: session.id,
      title: "Electro-thermal baseline first",
      statement:
        "Validating a reduced electro-thermal model before fluid coupling will de-risk the later multiphysics campaign.",
      tags: ["plasma", "multiphysics"],
      metrics: {
        novelty: 4,
        feasibility: 5,
        impact: 4,
        confidence: 4
      },
      score: {
        total: 0.82,
        baseScore: 0.74,
        evidenceScore: 0.36,
        contradictionScore: 0.08,
        rank: 1,
        nextAction: "design-experiment"
      },
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z"
    }
  ];

  const artifacts: Artifact[] = [
    {
      id: "art_1",
      sessionId: session.id,
      label: "validation-dataset",
      path: "/workspace/validation.csv",
      kind: "dataset",
      description: "Reference measurements for the baseline case.",
      createdAt: "2026-01-01T00:00:00.000Z"
    },
    {
      id: "art_2",
      sessionId: session.id,
      hypothesisId: "hyp_1",
      label: "solver-script",
      path: "/workspace/run-solver.ts",
      kind: "script",
      description: "Automates the baseline solve.",
      createdAt: "2026-01-01T00:00:00.000Z"
    }
  ];

  const report = renderMarkdownReport({
    session,
    template,
    hypotheses,
    evidence: [],
    artifacts
  });

  assert.match(report, /Template workflow guidance/);
  assert.match(report, /multiphysics coupling/i);
  assert.match(report, /publication-ready figures/i);
  assert.match(report, /Artifact coverage/);
  assert.match(report, /\| dataset \| yes \| 1 \| ready \|/);
  assert.match(report, /\| figure \| yes \| 0 \| missing \|/);
  assert.match(report, /\| report \| yes \| 0 \| missing \|/);
});

test("simulation paper reports emphasize publishable claims and reproducibility bundles", () => {
  const template = DEFAULT_TEMPLATES.find((entry) => entry.id === "simulation-paper");
  assert.ok(template);

  const session: ResearchSession = {
    id: "session_2",
    goal: "Package a sheath-erosion study into a paper outline",
    question: "Which validated claim should anchor the manuscript?",
    templateId: template.id,
    templateName: template.name,
    status: "scored",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    summary: "The validated erosion scaling figure is strong enough to lead the draft.",
    rankedHypothesisIds: ["hyp_2"],
    weights: DEFAULT_WEIGHTS
  };

  const hypotheses: Hypothesis[] = [
    {
      id: "hyp_2",
      sessionId: session.id,
      title: "Lead with the erosion scaling result",
      statement:
        "A validated sheath-erosion scaling figure and benchmark comparison can anchor the paper's core contribution.",
      tags: ["paper", "plasma"],
      metrics: {
        novelty: 4,
        feasibility: 4,
        impact: 5,
        confidence: 4
      },
      score: {
        total: 0.84,
        baseScore: 0.76,
        evidenceScore: 0.34,
        contradictionScore: 0.05,
        rank: 1,
        nextAction: "design-experiment"
      },
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z"
    }
  ];

  const artifacts: Artifact[] = [
    {
      id: "art_3",
      sessionId: session.id,
      label: "erosion-figure",
      path: "/workspace/erosion-figure.png",
      kind: "figure",
      description: "Primary figure for the results section.",
      createdAt: "2026-01-01T00:00:00.000Z"
    },
    {
      id: "art_4",
      sessionId: session.id,
      hypothesisId: "hyp_2",
      label: "analysis-script",
      path: "/workspace/analysis.py",
      kind: "script",
      description: "Reproduces the figure panels.",
      createdAt: "2026-01-01T00:00:00.000Z"
    }
  ];

  const report = renderMarkdownReport({
    session,
    template,
    hypotheses,
    evidence: [],
    artifacts
  });

  assert.match(report, /publishable claims/i);
  assert.match(report, /reproducible supplement|paper scaffold/i);
  assert.match(report, /\| figure \| yes \| 1 \| ready \|/);
  assert.match(report, /\| dataset \| yes \| 0 \| missing \|/);
  assert.match(report, /\| report \| yes \| 0 \| missing \|/);
});
