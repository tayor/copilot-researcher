import type { Evidence, Hypothesis, HypothesisScore, RankingWeights } from "./models.js";
import { normalizeFivePoint, round } from "./utils.js";

function nextActionFor(
  baseScore: number,
  evidenceScore: number,
  contradictionScore: number,
  hypothesis: Hypothesis
): string {
  if (contradictionScore >= 0.5 && baseScore < 0.7) {
    return "revise-or-retire";
  }

  if (evidenceScore < 0.35 && baseScore >= 0.65) {
    return "collect-supporting-evidence";
  }

  if (
    hypothesis.metrics.feasibility >= 4 &&
    hypothesis.metrics.impact >= 4 &&
    baseScore >= 0.65
  ) {
    return "design-experiment";
  }

  if (baseScore >= 0.55) {
    return "prototype-or-simulate";
  }

  return "archive-for-later";
}

function scoreEvidence(
  hypothesisId: string,
  evidence: Evidence[],
  weights: RankingWeights
): Pick<HypothesisScore, "evidenceScore" | "contradictionScore"> {
  const related = evidence.filter((entry) => entry.hypothesisId === hypothesisId);

  if (related.length === 0) {
    return { evidenceScore: 0, contradictionScore: 0 };
  }

  const support = related
    .filter((entry) => entry.direction === "support")
    .map((entry) => normalizeFivePoint(entry.strength) * normalizeFivePoint(entry.relevance));
  const contradiction = related
    .filter((entry) => entry.direction === "contradict")
    .map((entry) => normalizeFivePoint(entry.strength) * normalizeFivePoint(entry.relevance));
  const neutral = related
    .filter((entry) => entry.direction === "neutral")
    .map((entry) => normalizeFivePoint(entry.strength) * normalizeFivePoint(entry.relevance));

  const average = (values: number[]): number =>
    values.length === 0
      ? 0
      : values.reduce((total, value) => total + value, 0) / values.length;

  const supportScore = average(support);
  const contradictionScore = average(contradiction);
  const neutralScore = average(neutral);
  const evidenceScore = Math.max(
    0,
    supportScore + neutralScore * 0.25 - contradictionScore * weights.contradictionPenalty
  );

  return {
    evidenceScore: round(evidenceScore),
    contradictionScore: round(contradictionScore)
  };
}

export function scoreHypotheses(
  hypotheses: Hypothesis[],
  evidence: Evidence[],
  weights: RankingWeights
): Hypothesis[] {
  const weighted = hypotheses.map((hypothesis) => {
    const baseScore =
      normalizeFivePoint(hypothesis.metrics.novelty) * weights.novelty +
      normalizeFivePoint(hypothesis.metrics.feasibility) * weights.feasibility +
      normalizeFivePoint(hypothesis.metrics.impact) * weights.impact +
      normalizeFivePoint(hypothesis.metrics.confidence) * weights.confidence;

    const evidenceScores = scoreEvidence(hypothesis.id, evidence, weights);
    const total = Math.max(
      0,
      baseScore + evidenceScores.evidenceScore * weights.evidence
    );

    const score: HypothesisScore = {
      total: round(total),
      baseScore: round(baseScore),
      evidenceScore: evidenceScores.evidenceScore,
      contradictionScore: evidenceScores.contradictionScore,
      rank: 0,
      nextAction: nextActionFor(
        baseScore,
        evidenceScores.evidenceScore,
        evidenceScores.contradictionScore,
        hypothesis
      )
    };

    return {
      ...hypothesis,
      score,
      updatedAt: new Date().toISOString()
    };
  });

  const ranked = weighted.sort((left, right) => {
    const leftScore = left.score?.total ?? 0;
    const rightScore = right.score?.total ?? 0;
    if (rightScore !== leftScore) {
      return rightScore - leftScore;
    }

    return right.metrics.impact - left.metrics.impact;
  });

  return ranked.map((hypothesis, index) => ({
    ...hypothesis,
    score: {
      ...(hypothesis.score as HypothesisScore),
      rank: index + 1
    }
  }));
}
