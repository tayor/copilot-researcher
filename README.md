# copilot-researcher

**copilot-researcher** is a Copilot-native researcher harness and local-first TypeScript CLI/SDK. GitHub Copilot CLI is the interactive runtime, and `copilot-researcher` keeps durable session, hypothesis, evidence, artifact, scoring, and Markdown report state in `.researchflow/`.

It is designed for teams that want AI-assisted research workflows without giving up inspectable state, reproducible rankings, or portable markdown outputs.

## What it does

- scaffolds a GitHub Copilot CLI project with instructions, agents, skills, and a repo-local extension
- initializes a local-first research workspace
- tracks sessions, hypotheses, evidence, and artifacts in `.researchflow/`
- ranks competing ideas and recommends next actions
- generates Markdown reports that can be shared in docs, issues, or lab notes

## Why this shape

Most research tooling is either:

- notebook-heavy and manual
- cloud-first and opaque
- generic agent orchestration without durable research provenance

copilot-researcher keeps the durable layer explicit:

- **local-first workspaces**
- **research sessions**
- **hypothesis + evidence lineage**
- **artifact manifests**
- **reproducible scoring and ranking**
- **Markdown reporting**

GitHub Copilot CLI then sits on top as the execution harness with custom instructions, agents, skills, `/fleet`, autopilot, and repo-local extension tools.

## Install

### Prerequisites

- Node.js 20+
- GitHub Copilot CLI installed and authenticated

Install Copilot CLI:

```bash
npm install -g @github/copilot
```

Install the package:

```bash
npm install -g copilot-researcher
```

Run it on demand with:

```bash
npx copilot-researcher --help
```

For local development in this repository:

```bash
npm install
npm run build
```

If you change `src/cli.ts` or `src/copilot.ts`, run `npm run build` before using the repo-local Copilot extension so `dist/cli.js` stays in sync with bridge options.

## Quick start

Create a new Copilot-ready research project:

```bash
npx copilot-researcher init ./my-lab --name "Battery materials" --copilot
cd ./my-lab
copilot
```

Inside Copilot CLI you can now:

- use `/agent` to switch into the project agents
- use `/skills list` to inspect the installed research skills
- ask for a literature scout, hypothesis shortlist, experiment design, or report
- use `/fleet` for large parallelizable research jobs

Create and manage a session from the command line:

```bash
copilot-researcher session:create \
  --goal "Find promising cathode additives for fast-charging cells" \
  --question "Which additive should be validated first?" \
  --template experiment-design

copilot-researcher hypothesis:add \
  --session <session-id> \
  --title "Boron-rich surface additive" \
  --statement "A boron-rich coating may suppress interface degradation." \
  --novelty 4 \
  --feasibility 4 \
  --impact 5 \
  --confidence 3

copilot-researcher evidence:add \
  --session <session-id> \
  --hypothesis <hypothesis-id> \
  --summary "Related interface-stability study suggests improved cycling." \
  --source "doi:10.0000/example" \
  --strength 4 \
  --relevance 5 \
  --direction support

copilot-researcher score --session <session-id>
copilot-researcher report --session <session-id>
```

List the available workflow templates, including the physics simulation workflow:

```bash
copilot-researcher template:list
```

### Template library

copilot-researcher ships with a small set of templates that reuse the same ledger, scoring, and report pipeline:

- `literature-scout` — scan prior work, capture hypotheses, and rank what deserves validation
- `experiment-design` — turn candidate ideas into practical experiments and next steps
- `physics-literature-scout` — map governing equations, observables, benchmark families, and open modeling gaps
- `physics-simulation` — plan a simulation campaign, including multiphysics coupling and publication-oriented outputs
- `multiphysics-validation` — prioritize convergence, benchmark checks, and coupled-model credibility
- `simulation-paper` — turn validated results into publishable claims, figure plans, and reproducibility bundles
- `replication-check` — reproduce prior findings and capture missing artifacts or contradictions

### Physics workflow templates

Use the built-in physics template family when you want one project to cover prior art, simulation hypotheses, validation gates, and paper-ready outputs:

- `physics-literature-scout` — map governing equations, observables, benchmark families, and open modeling gaps before you commit to solver work
- `physics-simulation` — plan the main simulation campaign, including multiphysics coupling, assumptions, and publication-oriented outputs
- `multiphysics-validation` — prioritize convergence, benchmark checks, and coupled-model credibility before expanding claims
- `simulation-paper` — turn validated results into publishable claims, figure plans, and reproducibility bundles

```bash
copilot-researcher session:create \
  --goal "Prioritize a multiphysics simulation campaign for Hall thruster erosion" \
  --question "Which coupled model should be validated first?" \
  --template physics-simulation
```

The template is tuned to:

- rank simulation hypotheses with reproducibility-oriented weights
- capture benchmark or experimental evidence alongside contradictions
- track the artifact set usually needed for simulation work: datasets, scripts, figures, notes, and reports
- push reports toward publishable claims, validation gaps, and next simulation moves

For example, to start from prior art before building the main model:

```bash
copilot-researcher session:create \
  --goal "Map governing equations and benchmark datasets for a plasma-wall interaction model" \
  --question "Which observable and benchmark should anchor the first validation pass?" \
  --template physics-literature-scout
```

Or, once the simulation is validated, shape it into a manuscript workflow:

```bash
copilot-researcher session:create \
  --goal "Package a validated Hall thruster erosion result into a paper draft" \
  --question "Which figure sequence and evidence bundle best support the central claim?" \
  --template simulation-paper
```

## Copilot scaffold

Project installs create the following structure:

```text
.github/
  copilot-instructions.md
  instructions/
  agents/
  skills/
  extensions/
AGENTS.md
researchflow.yml
.researchflow/
```

The repo-local extension exposes `researchflow_*` tools to Copilot so the agent can persist research state instead of leaving important work buried in chat text.

## Copilot workflows

### Project scaffold commands

- `copilot-researcher init <dir> --copilot` — initialize a workspace and scaffold Copilot project files
- `copilot-researcher copilot install --scope project|user` — install project scaffold files or user-scoped skills
- `copilot-researcher copilot update --scope project|user` — refresh managed scaffold files
- `copilot-researcher copilot doctor --dir <dir>` — verify Copilot CLI availability, workspace presence, and scaffold status

### Recommended interactive flow

1. Start with plan mode in Copilot CLI.
2. Break the work into literature review, contradiction search, hypothesis creation, experiment design, and report synthesis.
3. Use `/fleet` when those threads can run independently.
4. Use autopilot only for bounded, well-specified plans.
5. Persist durable findings with the `researchflow_*` tools or the `copilot-researcher` CLI.

## Workspace layout

```text
researchflow.yml
.researchflow/
  templates/
  sessions/
    <session-id>/
      session.json
      events.jsonl
      hypotheses/
      evidence/
      artifacts/
  reports/
```

## CLI surface

### Research ledger commands

- `copilot-researcher init`
- `copilot-researcher session:create`
- `copilot-researcher template:list`
- `copilot-researcher hypothesis:add`
- `copilot-researcher evidence:add`
- `copilot-researcher artifact:add`
- `copilot-researcher score`
- `copilot-researcher status`
- `copilot-researcher report`

### Copilot integration commands

- `copilot-researcher copilot install`
- `copilot-researcher copilot update`
- `copilot-researcher copilot doctor`

## Library usage

```ts
import { CopilotResearcherWorkspace } from "copilot-researcher";

const workspace = await CopilotResearcherWorkspace.find(process.cwd());
const session = await workspace.createSession({
  goal: "Identify next replication target",
  question: "What should we validate first?",
  templateId: "replication-check"
});
```

## Scope

copilot-researcher is **not** a replacement terminal chat client and **not** a generic multi-agent framework. It focuses on the inspectable, durable layer around research work:

- what hypotheses were proposed
- what evidence supported or contradicted them
- what artifacts were produced
- what should happen next

That makes it a strong substrate beneath GitHub Copilot CLI, notebooks, scripts, and manual research workflows.
