---
name: hypothesis-scoring
description: Use when the user asks to rank ideas, shortlist hypotheses, prioritize experiments, or compare competing research directions.
license: MIT
---

<!-- Managed by copilot-researcher Copilot scaffold. Run `copilot-researcher copilot update` to refresh. -->

# Hypothesis scoring

Follow this workflow:

1. Check `researchflow_get_workspace_status`.
2. Ensure the session has hypotheses and recorded evidence.
3. If durable tracking is wanted, create or update hypotheses with `researchflow_add_hypothesis`.
4. Use `researchflow_score_session` to compute ranked priorities.
5. Explain the top-ranked ideas in terms of novelty, feasibility, impact, confidence, and contradiction pressure.

Bias toward a shortlist that changes what the team should do next, not a long ranking that hides the decision.
