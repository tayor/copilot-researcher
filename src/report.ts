import type {
  Artifact,
  ArtifactKind,
  Evidence,
  Hypothesis,
  ResearchSession,
  ResearchTemplate
} from "./models.js";

function formatHypothesisRow(hypothesis: Hypothesis): string {
  const score = hypothesis.score;
  return `| ${score?.rank ?? "-"} | ${hypothesis.title} | ${score?.total ?? "-"} | ${score?.evidenceScore ?? "-"} | ${score?.contradictionScore ?? "-"} | ${score?.nextAction ?? "-"} |`;
}

function evidenceSection(hypothesisId: string, evidence: Evidence[]): string[] {
  const related = evidence.filter((entry) => entry.hypothesisId === hypothesisId);
  if (related.length === 0) {
    return ["No evidence logged yet."];
  }

  return related.map(
    (entry) =>
      `- **${entry.direction}** (${entry.strength}/5 strength, ${entry.relevance}/5 relevance) — ${entry.summary} _[${entry.source}]_`
  );
}

function artifactSection(hypothesisId: string, artifacts: Artifact[]): string[] {
  const related = artifacts.filter((entry) => entry.hypothesisId === hypothesisId);
  if (related.length === 0) {
    return ["No hypothesis-linked artifacts yet."];
  }

  return related.map(
    (entry) =>
      `- \`${entry.kind}\` ${entry.label}: ${entry.path}${entry.sha256 ? ` (sha256 ${entry.sha256.slice(0, 12)}...)` : ""}`
  );
}

function templateWorkflowSection(template: ResearchTemplate): string[] {
  return [
    "## Template workflow guidance",
    `- **Recommended artifacts:** ${template.recommendedArtifacts.map((kind) => `\`${kind}\``).join(", ")}`,
    ...template.nextStepGuidance.map((step, index) => `${index + 1}. ${step}`),
    ""
  ];
}

function artifactCoverageSection(template: ResearchTemplate, artifacts: Artifact[]): string[] {
  const artifactCounts = artifacts.reduce(
    (counts, artifact) => {
      counts[artifact.kind] = (counts[artifact.kind] ?? 0) + 1;
      return counts;
    },
    {} as Partial<Record<ArtifactKind, number>>
  );

  return [
    "## Artifact coverage",
    "",
    "| Artifact kind | Recommended | Present | Coverage |",
    "| --- | --- | --- | --- |",
    ...template.recommendedArtifacts.map((kind) => {
      const present = artifactCounts[kind] ?? 0;
      return `| ${kind} | yes | ${present} | ${present > 0 ? "ready" : "missing"} |`;
    }),
    ""
  ];
}

export function renderMarkdownReport(params: {
  session: ResearchSession;
  template: ResearchTemplate;
  hypotheses: Hypothesis[];
  evidence: Evidence[];
  artifacts: Artifact[];
}): string {
  const { session, template, hypotheses, evidence, artifacts } = params;
  const top = hypotheses[0];
  const report: string[] = [
    `# copilot-researcher report: ${session.goal}`,
    "",
    `- **Session ID:** ${session.id}`,
    `- **Question:** ${session.question}`,
    `- **Template:** ${template.name}`,
    `- **Status:** ${session.status}`,
    `- **Updated:** ${session.updatedAt}`,
    "",
    "## Executive Summary",
    session.summary,
    "",
    "## Template prompts",
    ...template.prompts.map((prompt) => `- ${prompt}`),
    "",
    ...templateWorkflowSection(template),
    ...artifactCoverageSection(template, artifacts),
    "## Ranked hypotheses",
    "",
    "| Rank | Hypothesis | Total | Evidence | Contradiction | Next action |",
    "| --- | --- | --- | --- | --- | --- |",
    ...hypotheses.map(formatHypothesisRow),
    "",
    "## Recommended next moves",
    ...(top
      ? [
          `1. Advance **${top.title}** with \`${top.score?.nextAction ?? "review"}\`.`,
          "2. Add at least one contradictory and one supporting evidence source for the top-ranked ideas.",
          "3. Attach the minimum artifact set needed to reproduce the next experiment."
        ]
      : ["No hypotheses have been added yet."]),
    ""
  ];

  for (const hypothesis of hypotheses) {
    report.push(`## ${hypothesis.score?.rank ?? "-"}: ${hypothesis.title}`);
    report.push("");
    report.push(hypothesis.statement);
    report.push("");
    report.push(
      `- **Metrics:** novelty ${hypothesis.metrics.novelty}/5, feasibility ${hypothesis.metrics.feasibility}/5, impact ${hypothesis.metrics.impact}/5, confidence ${hypothesis.metrics.confidence}/5`
    );
    if (hypothesis.score) {
      report.push(
        `- **Score:** total ${hypothesis.score.total}, base ${hypothesis.score.baseScore}, evidence ${hypothesis.score.evidenceScore}, contradiction ${hypothesis.score.contradictionScore}`
      );
      report.push(`- **Next action:** ${hypothesis.score.nextAction}`);
    }
    if (hypothesis.tags.length > 0) {
      report.push(`- **Tags:** ${hypothesis.tags.join(", ")}`);
    }
    report.push("");
    report.push("### Evidence");
    report.push(...evidenceSection(hypothesis.id, evidence));
    report.push("");
    report.push("### Artifacts");
    report.push(...artifactSection(hypothesis.id, artifacts));
    report.push("");
  }

  if (artifacts.length > 0) {
    report.push("## Session artifacts");
    report.push(
      ...artifacts
        .filter((entry) => !entry.hypothesisId)
        .map(
          (entry) =>
            `- \`${entry.kind}\` ${entry.label}: ${entry.path}${entry.sha256 ? ` (sha256 ${entry.sha256.slice(0, 12)}...)` : ""}`
        )
    );
    report.push("");
  }

  report.push("## Evidence questions");
  report.push(...template.evidenceQuestions.map((question) => `- ${question}`));
  report.push("");

  return report.join("\n");
}
