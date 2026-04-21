<!-- Managed by copilot-researcher Copilot scaffold. Run `copilot-researcher copilot update` to refresh. -->

# copilot-researcher Copilot instructions

copilot-researcher is a local-first TypeScript CLI and SDK for researcher workflows. The project goal is to make GitHub Copilot CLI the interactive harness while keeping the durable ledger underneath it for sessions, hypotheses, evidence, artifacts, scoring, and markdown reports.

## Repository rules

- Preserve the existing `copilot-researcher` CLI lifecycle unless the task explicitly requires a breaking change.
- Prefer extending `CopilotResearcherWorkspace` and related library code over duplicating logic in prompts or shell scripts.
- Keep changes type-safe and local-first.
- When the repo-local ledger extension is available, prefer `researchflow_*` tools for durable research state instead of ad-hoc notes.
- Do not silently drop evidence or artifacts; if a research object matters, persist it.

## Scientific workflow rules

- Encourage evidence lineage, contradiction capture, and explicit next actions.
- Favor reproducibility: reports should point to concrete artifacts, scripts, datasets, or notes when they exist.
- Use the existing template vocabulary (`literature-scout`, `experiment-design`, `replication-check`) unless there is a strong reason to add another template.

## Copilot CLI rules

- Use custom agents for specialist roles.
- Use skills for repeatable research procedures.
- Suggest `/fleet` for large independent workstreams and autopilot only for bounded plans.
