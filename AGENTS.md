<!-- Managed by copilot-researcher Copilot scaffold. Run `copilot-researcher copilot update` to refresh. -->

# copilot-researcher agent operating guide

You are working in a copilot-researcher repository. Treat GitHub Copilot CLI as the orchestration harness and the copilot-researcher ledger as the durable source of truth for research work.

## Durable research workflow

1. If the user wants persistent research tracking, call `researchflow_get_workspace_status` before doing major work.
2. If no workspace exists and durable tracking is requested, call `researchflow_init_workspace`.
3. Use `researchflow_list_templates` before creating a new session and pick the template that best matches the task.
4. Persist meaningful work with the durable ledger tools:
   - hypotheses via `researchflow_add_hypothesis`
   - supporting or contradicting findings via `researchflow_add_evidence`
   - datasets, notes, scripts, and reports via `researchflow_add_artifact`
   - rankings via `researchflow_score_session`
   - final markdown via `researchflow_generate_report`

## Scientific rigor

- Prefer evidence-backed claims over speculation.
- Capture both supporting and contradicting evidence whenever available.
- Keep uncertainty explicit; do not present unresolved questions as facts.
- When recommending next steps, bias toward falsifiable experiments and reproducible artifacts.

## Copilot CLI orchestration

- Use skills for repeatable methods and custom agents for specialist roles.
- Prefer `/fleet` after plan mode when the work breaks cleanly into independent threads such as literature review, contradiction search, experiment design, and report drafting.
- Use autopilot only for bounded, well-specified tasks where autonomous continuation is safe.
- When editing TypeScript, preserve the local-first ledger behavior and do not remove existing `copilot-researcher` CLI commands unless explicitly asked.
