import assert from "node:assert/strict";
import test from "node:test";

import type { Evidence, Hypothesis } from "../src/models.js";
import { DEFAULT_WEIGHTS } from "../src/templates.js";
import { scoreHypotheses } from "../src/scoring.js";

test("scoreHypotheses ranks strong supported ideas above contradictory ones", () => {
  const hypotheses: Hypothesis[] = [
    {
      id: "hyp_1",
      sessionId: "session_1",
      title: "High-support idea",
      statement: "Strong upside with practical execution.",
      tags: ["battery"],
      metrics: {
        novelty: 4,
        feasibility: 4,
        impact: 5,
        confidence: 4
      },
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z"
    },
    {
      id: "hyp_2",
      sessionId: "session_1",
      title: "Contradicted idea",
      statement: "Interesting but currently weak.",
      tags: ["plasma"],
      metrics: {
        novelty: 5,
        feasibility: 2,
        impact: 3,
        confidence: 2
      },
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z"
    }
  ];

  const evidence: Evidence[] = [
    {
      id: "ev_1",
      sessionId: "session_1",
      hypothesisId: "hyp_1",
      summary: "Supportive result",
      source: "paper-a",
      strength: 5,
      relevance: 5,
      direction: "support",
      createdAt: "2026-01-01T00:00:00.000Z"
    },
    {
      id: "ev_2",
      sessionId: "session_1",
      hypothesisId: "hyp_2",
      summary: "Contradictory result",
      source: "paper-b",
      strength: 5,
      relevance: 5,
      direction: "contradict",
      createdAt: "2026-01-01T00:00:00.000Z"
    }
  ];

  const ranked = scoreHypotheses(hypotheses, evidence, DEFAULT_WEIGHTS);

  assert.equal(ranked[0]?.id, "hyp_1");
  assert.equal(ranked[0]?.score?.rank, 1);
  assert.equal(ranked[0]?.score?.nextAction, "design-experiment");
  assert.equal(ranked[1]?.score?.nextAction, "revise-or-retire");
  assert.ok((ranked[0]?.score?.total ?? 0) > (ranked[1]?.score?.total ?? 0));
});
