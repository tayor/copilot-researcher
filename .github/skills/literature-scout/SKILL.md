---
name: literature-scout
description: Use when the user asks for prior-art review, related work, evidence gathering, or a literature scan for research questions.
license: MIT
---

<!-- Managed by copilot-researcher Copilot scaffold. Run `copilot-researcher copilot update` to refresh. -->

# Literature scout

When this skill is relevant:

1. Call `researchflow_get_workspace_status`.
2. If the user wants durable tracking and no workspace exists, call `researchflow_init_workspace`.
3. Prefer a `literature-scout` session template when opening a new session.
4. Convert concrete findings into `researchflow_add_evidence` entries with clear support, contradiction, or neutral direction.
5. Surface weak assumptions and unresolved contradictions instead of smoothing them over.

Do not turn every paper note into a hypothesis. Promote only the findings that are novel enough, actionable enough, or risky enough to compete for the next experiment slot.
