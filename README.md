# Executable Knowledge Graph Intelligence (EKG-AI)

EKG-AI is an experiment in **lifelong executable intelligence**: a system whose concepts, language, procedures, capabilities, corrections, tests, and lived episodes accumulate in an inspectable knowledge graph and executable program library.

> **This project is not an LLM.** It is not expected to know the world with zero training. Learning may be bootstrapped; knowledge and understanding are taught and accumulated. The graph and executable library are part of the intelligence itself.

## North star

- **Education, not zero-shot miracles.** EKG is allowed to start ignorant and get taught.
- **Ever-learning.** Useful knowledge is not frozen permanently into model weights.
- **Executable knowledge.** Concepts can ground into typed programs and host capabilities.
- **Makes tools from tools.** Reusable learned compositions become capabilities of the growing system rather than temporary agent-tool calls.
- **Host-adaptive.** Files, paths, process/shell, environment, clocks, and other affordances are explicit host boundaries; EKG should adapt to what a host provides.
- **Semantic portability, not lowest-common-denominator APIs.** A concept may enter the portable core when roughly 80–90% of representative runtimes support the same semantics and outliers have practical adapters (for example Bash + `jq` for recursive JSON/object data). Hosts adapt to EKG's semantic types; one runtime does not define the limits of EKG's ontology.
- **Lived context.** Past lessons, corrections, episodes, programs, semantic relations, and evidence are durable context retrieved from experience rather than repeatedly stuffed into a prompt.
- **Teacher as educator.** Frontier LLM assistance is scaffolding/Teacher supervision whose successful corrections become graph knowledge and future training data.

Read [`docs/PROJECT_GOSPEL.md`](docs/PROJECT_GOSPEL.md) before making architectural tradeoffs. It is the current product/research doctrine.

## What EKG has now

- language-neutral typed Blueprint IR;
- recursive JSON/object values;
- portable integer, boolean, string, list, and structured-data primitives;
- path/filesystem/environment/time host capabilities;
- bounded process execution and Bash as explicit effectful host capabilities;
- reference execution plus TypeScript/Rust backend support where applicable;
- graph-native concepts/capabilities/teaching traces/evidence;
- typed synthesis (Search v2) and learned-program reuse;
- early natural-language grounding and correction learning;
- **LadybugDB** embedded graph backend with OpenCypher queries (auto-fallback to in-memory JSON);
- **seed brain** with pre-installed English curriculum for instant language understanding;
- **EKGBench**, including all 20 bAbI prerequisite families plus personal aspirational program milestones.

## EKGBench

Developmental tests are allowed to be red. That is the point.

```bash
npm run benchmark:ekg
```

The object ladder currently begins with:

1. single-property access;
2. `foo.bar` nested access;
3. variable-depth nested access.

The latter tests are intended to remain red until education/runtime growth enables EKG to write the program.

## Run locally

```bash
npm install
npm run ekg
```

On first run, EKG loads the **seed brain** (`ekg-data/seed-brain.json`) containing the starter English curriculum, so language understanding works immediately. If `@ladybugdb/core` is installed (included as an optional dependency), the brain auto-upgrades to LadybugDB's embedded graph database (`.lbdb`). Otherwise it runs on an in-memory graph backed by a JSON file.

You can control the backend explicitly:

```bash
npm run ekg -- --backend ladybug    # force LadybugDB
npm run ekg -- --backend memory     # force JSON file
npm run ekg -- --backend auto       # default: LadybugDB if available
```

Example session:

```text
EKG> deduct six from this number
input[0] (int)> 20
14

EKG> deduct six from this number :: [20]
14
```

Type `/help` inside the CLI for `/brain`, `/capabilities`, `/programs`, `/experience`, `/run`, `/teach synonym`, Teacher-display controls, save, and exit commands. See [`docs/CLI.md`](docs/CLI.md).

Development/test commands:

```bash
npm test                          # full suite (190 tests)
npm run benchmark:ekg             # developmental report card
npm run benchmark:search-v2       # synthesis engine benchmark
npm run test:ladybug              # LadybugDB mock tests
npm run test:ladybug:integration  # real native round-trip (needs @ladybugdb/core)
```

## Historical experiments

The repository contains earlier frozen falsification/preregistration work. Preserve it as historical evidence where useful, but **do not constrain current architecture or education merely to preserve an old benchmark's purity**. Checkpoints exist so we can revisit old systems.


## Durable capability identity

Acquired capabilities become durable parts of the intelligence rather than disposable task-local tools. Once learned, validated, and integrated, a capability remains part of what EKG can do and can participate in future composition and learning unless later experience deliberately revises, supersedes, deprecates, or forgets it.

## v0.7.1 — Semantic language graph

Language knowledge is now graph-native rather than a tiny hard-coded intent dictionary. English forms are represented as **lexemes**, which may have one or more **senses**; senses express semantic relations; semantic relations denote concepts; concepts are grounded by typed executable capabilities. Synonyms may share semantic groundings, antonyms are explicit graph relations, and polysemous forms may retain multiple senses instead of being overwritten.

The starter English vocabulary is treated as **Teacher curriculum**. Before a lesson, an unknown form may correctly escalate. After a validated lesson, that lexical knowledge remains durable and can ground future requests without changing planner code. The planner resolves semantic relations through the graph and still requires a matching capability type contract before execution.

## v0.7.2 — Teacher School and durable competence

Teacher interaction is now a normal education path. `TeacherSchool` can teach lexical curriculum, synonyms, and validated executable programs. A successful executable lesson enters the program library **and** receives a durable learned-capability identity in the graph. It remains callable in future composition unless later learning explicitly revises or retires it. Rejected lessons are recorded as education episodes but do not mutate competence.

The Teacher impasse context now exposes the learner's actual registered capability catalog, including learned/program abilities through the education layer, so future LLM Teacher integration can teach against the world the learner really has rather than inventing tools.

## Context-sensitive language

A lexical form is not its meaning. EKG keeps explicit senses and may learn contextual evidence that selects among them without erasing alternatives. Context-sensitive resolution should combine lexical senses, semantic frames/graph coherence, type/execution constraints, and eventually neural candidate signals. See `docs/CONTEXTUAL_LANGUAGE.md`.

## Education example: a red milestone becomes durable competence

`OBJECT-PATH-001` is intentionally unsolved by the raw substrate. A Teacher lesson supplies a validated Blueprint composed from existing generic abilities (`string_split`, list indexing, `json_get`). After validation, that procedure is acquired as a durable learned capability. The same locked milestone then passes without adding a task-specific host primitive. `OBJECT-PATH-002` remains red because arbitrary-depth traversal has not yet been learned/supported.

This is the intended development model: **red -> teaching/experience -> durable competence -> later composition**, not an expectation of zero-shot miracles.

The curriculum is chosen for **general reuse**, not benchmark convenience. A red task should tell us which prerequisite concept is missing; we then teach that concept itself. For example, bAbI #4/#5 are valuable next targets because they expose broadly useful ideas like inverse relations, argument roles, and relation composition—not because those benchmark numbers need to turn green.

## EKGBench school: graph-native facts and learned grammar

The bAbI-style developmental suite is a curriculum, not a zero-shot exam. v0.8 introduces graph-native world facts plus durable symbolic grammar rules. Before location-language education, `BABI-01` abstains. Teaching two reusable rules (`{subject} went to the {place}` and `Where is {subject}?`) turns `BABI-01` green while multi-fact possession tasks remain red. This staged learning curve is desirable evidence of education, not failure.

### Multi-hop education

The next curriculum layer teaches possession as a separate relation plus a general graph inference rule:

`possesses(holder, item) AND located_in(holder, place) -> located_in(item, place)`

With only location language taught, EKGBench 1–3 score `[pass, fail, fail]`. After possession grammar and the reusable inference rule are taught, the same probes score `[pass, pass, pass]`. The inference engine is generic over graph-stored binary Horn-style rules; the bAbI answers are not hard-coded.

## v0.8.2 — Self-healing learned capability chains

Learned abilities now retain a validated executable Blueprint snapshot in durable graph memory. `SelfHealingProgramLibrary` can reconstruct a missing live program from that graph-native memory, revalidate it against the current capability/program environment, record a repair episode, and continue normal execution.

`runProgramResilient()` performs a dependency-health pass before execution. More importantly, ordinary learned-program lookup through the self-healing library can recover a dependency that disappears *after* preflight, so a broken inner link need not destroy the entire active run. When no durable implementation exists or revalidation fails, execution stops with an explicit dependency diagnosis rather than fabricating an answer.

This is a project invariant: **durable knowledge should be regenerable from the learner's accumulated state when possible.**

## v0.8.3 — Lived-experience recovery

Executable snapshots are no longer the only recovery source. Every learned-program and host-capability call may leave a durable execution-experience episode containing inputs, output or error, typed signature, caller/call stack, call-site expression, and the surrounding caller Blueprint. Successful and failed usages are both retained.

If a learned capability's live implementation and executable snapshot are missing or corrupt, resilience may reconstruct the capability from its accumulated successful usages. Recovery first narrows synthesis to the capability/program neighborhood observed in prior executions, validates the reconstructed candidate against all compatible remembered successful examples, persists the replacement as a new validated snapshot, records the repair provenance, and resumes execution. Historical failures remain available as diagnostic context rather than being erased by later success.

This is intentionally stronger than ordinary backup/restore: **lived experience is itself recovery evidence.** Teacher escalation is a last resort after durable implementation memory and accumulated usage evidence cannot repair the chain.

### Graph backend: LadybugDB or in-memory fallback

EKG's preferred graph backend is **LadybugDB** (the maintained Kuzu fork) - an embedded, serverless graph database with native OpenCypher support. `GraphStore` remains the semantic boundary; LadybugDB is a host realization, not EKG's identity.

Two backends ship:
- **`LadybugBrain`** (default when `@ladybugdb/core` is installed): embedded `.lbdb` database with OpenCypher queries, indexed episode lookups, and Cypher-pushdown optimizations for world-language fact queries. Programs and episodes persist in a sidecar JSON file alongside the `.lbdb`.
- **`FileBrain`** (fallback): in-memory `MemoryGraphStore` with debounced atomic JSON file persistence. Zero native dependencies.

Both implement the `Brain` interface. The CLI auto-detects which backend is available and auto-migrates from JSON to LadybugDB on first run when the native module is present.

A **seed brain** (`ekg-data/seed-brain.json`) ships with the repo containing the baseline English curriculum and portable substrate. Fresh brains start from this seed rather than bootstrapping from code. See [`docs/LADYBUGDB.md`](docs/LADYBUGDB.md).

### Search v2 benchmark

On the historical depth-3 `16x` guard task, the latest v0.9.6 run measured legacy search at ~6.40s versus Search v2 at ~120ms (~53.2x faster), with 7,204 scored legacy candidates versus 208 behaviorally distinct v2 candidates. See `benchmarks/v0.9-search-v2-report.json`.
