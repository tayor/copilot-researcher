import type { RankingWeights, ResearchTemplate } from "./models.js";

export const DEFAULT_WEIGHTS: RankingWeights = {
  novelty: 0.22,
  feasibility: 0.2,
  impact: 0.28,
  confidence: 0.12,
  evidence: 0.18,
  contradictionPenalty: 0.2
};

export const DEFAULT_TEMPLATE_ID = "literature-scout";

export const DEFAULT_TEMPLATES: ResearchTemplate[] = [
  {
    id: "literature-scout",
    name: "Literature scout",
    description:
      "Use when you want to scan prior work, capture candidate hypotheses, and rank what deserves deeper validation.",
    prompts: [
      "What claim is new enough to matter but grounded enough to validate?",
      "Which idea has the strongest upside if the next experiment succeeds?",
      "Where is evidence thin, contradictory, or missing?"
    ],
    evidenceQuestions: [
      "What prior result supports this?",
      "What result directly contradicts it?",
      "What is the weakest assumption?"
    ],
    recommendedArtifacts: ["note", "report", "dataset"],
    nextStepGuidance: [
      "Collect stronger supporting or contradicting evidence.",
      "Extract one experiment you can run in the next iteration."
    ]
  },
  {
    id: "experiment-design",
    name: "Experiment design",
    description:
      "Use when you already have candidate ideas and want to prioritize which experiments are practical and high-impact.",
    prompts: [
      "Which hypothesis is easiest to falsify or validate quickly?",
      "What experiment would change the roadmap if it worked?",
      "What artifact or dataset must exist before execution?"
    ],
    evidenceQuestions: [
      "What concrete measurement would confirm progress?",
      "What feasibility risk is still unresolved?"
    ],
    recommendedArtifacts: ["script", "dataset", "figure", "report"],
    nextStepGuidance: [
      "Promote high-scoring, high-feasibility ideas into experiment specs.",
      "Archive low-feasibility ideas unless impact is exceptional."
    ],
    defaultWeights: {
      feasibility: 0.26,
      impact: 0.3,
      evidence: 0.18
    }
  },
  {
    id: "physics-literature-scout",
    name: "Physics literature scout",
    description:
      "Use when you want to map governing equations, observables, benchmark cases, and open modeling gaps before committing to a simulation campaign.",
    prompts: [
      "Which governing equations, closures, or scaling laws are treated as settled in the literature, and which remain disputed?",
      "What benchmark geometry, experiment, or analytic limit appears often enough to anchor a first validation pass?",
      "Which missing coupling, material model, or regime transition is most likely to create a new research opportunity?"
    ],
    evidenceQuestions: [
      "What paper best supports the proposed physical mechanism?",
      "What source most strongly contradicts the expected trend or dominant effect?",
      "What observable should be measured or extracted to compare future simulations with prior work?"
    ],
    recommendedArtifacts: ["note", "dataset", "figure", "report"],
    nextStepGuidance: [
      "Capture the benchmark family, target observables, and parameter ranges before building a solver workflow.",
      "Separate settled assumptions from disputed ones so the next hypothesis focuses on the highest-value modeling gap.",
      "Promote only literature-backed ideas that can point to a concrete validation dataset or benchmark."
    ],
    defaultWeights: {
      novelty: 0.2,
      feasibility: 0.16,
      impact: 0.24,
      confidence: 0.1,
      evidence: 0.24,
      contradictionPenalty: 0.24
    }
  },
  {
    id: "physics-simulation",
    name: "Physics simulation",
    description:
      "Use when you need to connect literature review, simulation hypotheses, multiphysics modeling, validation assets, and paper-ready outputs in one workflow.",
    prompts: [
      "Which governing equations, scales, and physical regimes must the first simulation capture?",
      "What single-physics baseline should be validated before introducing multiphysics coupling?",
      "Which coupled effect, boundary condition, or constitutive assumption is most likely to change the conclusion?",
      "What result would be strong enough to support a publishable claim or paper section?"
    ],
    evidenceQuestions: [
      "What analytic solution, benchmark case, or experiment can validate the model?",
      "What assumption, mesh choice, or solver setting could invalidate the simulated result?",
      "Which paper most strongly supports or contradicts the expected mechanism?"
    ],
    recommendedArtifacts: ["dataset", "script", "figure", "note", "report"],
    nextStepGuidance: [
      "Record the governing equations, material parameters, boundary conditions, and solver assumptions in notes before scaling up complexity.",
      "Validate a reproducible single-physics baseline before enabling multiphysics coupling.",
      "Generate publication-ready figures and a literature-backed report once the simulation is stable enough to support a paper claim."
    ],
    defaultWeights: {
      novelty: 0.18,
      feasibility: 0.24,
      impact: 0.24,
      confidence: 0.12,
      evidence: 0.22,
      contradictionPenalty: 0.24
    }
  },
  {
    id: "multiphysics-validation",
    name: "Multiphysics validation",
    description:
      "Use when you need to verify solver behavior, benchmark coupled models, and rank which multiphysics configuration is credible enough for broader claims.",
    prompts: [
      "What single-physics or reduced-order baseline must pass before the coupled model is trustworthy?",
      "Which conservation law, convergence study, or benchmark comparison would invalidate the current setup immediately?",
      "What coupled regime is valuable enough to validate next once the baseline is stable?"
    ],
    evidenceQuestions: [
      "What benchmark, experiment, or analytic limit can serve as a validation gate?",
      "What numerical instability, boundary condition, or constitutive shortcut is the highest-risk failure mode?",
      "Which figure or residual trend would convince a reviewer that the model is converged and reproducible?"
    ],
    recommendedArtifacts: ["dataset", "script", "figure", "note", "report"],
    nextStepGuidance: [
      "Run convergence and sensitivity checks before escalating from a reduced model to a fully coupled one.",
      "Treat every accepted hypothesis as provisional until it matches a benchmark, experiment, or conserved quantity check.",
      "Package the benchmark setup, solver driver, and validation figure set together so the next iteration is reproducible."
    ],
    defaultWeights: {
      novelty: 0.12,
      feasibility: 0.28,
      impact: 0.22,
      confidence: 0.12,
      evidence: 0.26,
      contradictionPenalty: 0.26
    }
  },
  {
    id: "simulation-paper",
    name: "Simulation paper",
    description:
      "Use when validated findings need to be shaped into publishable claims, figure plans, reproducibility bundles, and paper-ready next actions.",
    prompts: [
      "Which validated result is strong enough to anchor the central paper claim?",
      "What figure, ablation, or benchmark comparison best communicates the mechanism and its limits?",
      "What missing supplement artifact would most weaken reproducibility or reviewer confidence if omitted?"
    ],
    evidenceQuestions: [
      "Which result most directly supports the paper's main contribution?",
      "What contradiction, limitation, or negative result must be surfaced to keep the manuscript credible?",
      "What artifact set is required for a reproducible supplement or methods section?"
    ],
    recommendedArtifacts: ["figure", "note", "dataset", "script", "report"],
    nextStepGuidance: [
      "Promote only publishable claims backed by validated figures, explicit limitations, and a traceable evidence trail.",
      "Draft the results narrative around one figure sequence and one benchmark comparison at a time.",
      "Bundle scripts, datasets, and methods notes early so the final report can serve as a paper scaffold."
    ],
    defaultWeights: {
      novelty: 0.14,
      feasibility: 0.18,
      impact: 0.3,
      confidence: 0.14,
      evidence: 0.24,
      contradictionPenalty: 0.22
    }
  },
  {
    id: "replication-check",
    name: "Replication check",
    description:
      "Use when your goal is to reproduce prior findings and track contradictions or missing artifacts.",
    prompts: [
      "Which claim is most testable with the assets already available?",
      "What missing artifact makes replication impossible today?"
    ],
    evidenceQuestions: [
      "What source is closest to a reproducible procedure?",
      "What contradiction would force a redesign?"
    ],
    recommendedArtifacts: ["dataset", "script", "note", "report"],
    nextStepGuidance: [
      "Bias toward concrete replication blockers and evidence quality.",
      "Flag any hypothesis with strong contradictions for revision."
    ],
    defaultWeights: {
      novelty: 0.12,
      feasibility: 0.28,
      impact: 0.22,
      evidence: 0.24
    }
  }
];
