---
applyTo: "src/**/*.ts,tests/**/*.ts"
---

<!-- Managed by copilot-researcher Copilot scaffold. Run `copilot-researcher copilot update` to refresh. -->

When editing copilot-researcher TypeScript code:

- Reuse the existing workspace, scoring, and report pipeline instead of creating parallel implementations.
- Prefer small library helpers over CLI-only logic when a behavior needs to be shared by commands and extensions.
- Keep the existing `commander` command style and the current build/test toolchain.
- Maintain strict typing; avoid `any` or unsafe casts when a guard or proper type can be used instead.
- Preserve the local-first `.researchflow` data model and event history semantics.
