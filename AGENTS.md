# CLAUDE.md

## Project intent
This repository experiments with **Executable Knowledge Graph Intelligence**: portable learned procedures + explicit evidence/knowledge, with the goal of reducing search and external teacher dependence over time.

Do not optimize for impressive demos. Optimize for falsifiable evidence that learning, reuse, abstraction, and transfer actually work.


## CURRENT PROJECT GOSPEL — READ THIS BEFORE OVERTHINKING

`docs/PROJECT_GOSPEL.md` is the current north-star doctrine and overrides older development instincts that treated zero-shot benchmark purity as the main product goal.

- EKG is **not an LLM** and is not expected to possess knowledge with zero training.
- Learning machinery may bootstrap; knowledge/understanding must be taught and accumulated.
- Expected-red developmental tests are desirable. Do not contort the architecture merely to keep them scientifically pristine.
- Teacher intervention is normal education. The desired trend is durable learning and decreasing repeated help.
- The graph/program library is part of the intelligence's lived experience, not an external cache.
- EKG should be able to compose/create reusable tools from its capabilities. **Acquired capabilities become durable parts of the learner's competence**, not disposable per-task tools. They remain part of what the AI can do unless later learning intentionally revises, supersedes, deprecates, or forgets them. A fixed agent harness/tool list is not the long-term architecture.
- Host/process/shell capabilities are legitimate environment affordances. Sandbox them for safety; do not ban them just to prevent benchmark shortcuts.
- Portable-core concepts do **not** require 100% native support across every host. Roughly 80–90% semantic convergence across representative runtimes is sufficient when outliers have practical adapters/ecosystem implementations. Compare semantics, not API spelling. Do not let the weirdest runtime veto EKG's ontology.
- Preserve old experimental checkpoints rather than freezing current development around old protocols.
- When forced to choose between making EKG more educable/capable and protecting an obsolete benchmark assumption, **build EKG and version the benchmark**.

## Core architectural invariants
- Canonical learned behavior lives in portable Blueprint IR, not Rust, TypeScript, or a particular host language.
- Rust/TypeScript/reference execution are backends, not ontology.
- Graph storage is an implementation detail behind an interface.
- Known executable knowledge is attempted before synthesis: `RUN -> ADAPT -> BUILD -> TEACH`.
- Types/contracts constrain execution and synthesis before semantic similarity or learned ranking.
- Future teacher/LLM output is a proposal with provenance and must be validated; it is never automatically truth.
- Learned programs remain decomposable even when higher layers treat them as atomic callable units.
- Record enough evidence/telemetry to measure search cost, reuse, failure, and future teacher dependence.
- Add complexity only when benchmarks demonstrate a need.
- Host capabilities are cheap/exact machinery; learned Blueprints encode knowledge about how and when to compose that machinery. Host-language implementations are not ontology, and the boundary may move only when evidence justifies promotion/optimization.

## Testing Rule: Prove Wrong Things Are Wrong
Every new capability must include:
- at least one positive/success case;
- at least one malformed or invalid-input case;
- at least one plausible-but-wrong counterexample.

Every learning mechanism must include:
- a fixture it **MUST** learn;
- a fixture it **MUST NOT** learn;
- a false-positive/adversarial case.

Do not accept tests that only demonstrate the happy path.

For abstraction/pattern learning specifically, test that:
- repeated useful structure can be proposed/promoted;
- superficially similar but semantically different structures are not merged;
- one-off structures are not promoted;
- frequent but non-useful structures are not promoted;
- abstractions that worsen held-out performance/search cost fail promotion or are demoted.

When a negative test reveals existing incorrect behavior, **fix the implementation rather than weakening the test to match the implementation**.

Prefer held-out tests, property/invariant tests, differential backend tests, adversarial fixtures, and memorize-only controls over hand-picked success demos.

## Benchmark discipline
- Keep frozen train/test splits stable unless intentionally versioning the benchmark.
- Report solve rate **and** cost: candidates explored, search depth, runtime where meaningful, direct reuse, structural reuse, and teacher usage when introduced.
- Compare against deliberately dumb baselines such as exact memorization.
- A new abstraction is not valuable because it exists. It must demonstrate measurable compression, held-out transfer, search reduction, execution savings, or another explicit utility.
- Never silently turn held-out tests into training data to make a metric improve.
- Record benchmark changes and rationale in `docs/PROGRESS.md`.

## Immediate research path
1. Portable IR and cross-backend semantics.
2. Typed synthesis.
3. `RUN -> ADAPT -> BUILD -> TEACH`.
4. Episodes and search/reuse telemetry.
5. Abstraction discovery.
6. **Abstraction promotion only when before/after held-out utility improves.**
7. Synthetic curriculum / learned search guidance only after baseline measurement.
8. Structured Teacher Mode later, explicitly teaching its own replacement.

## Work-session handoff discipline
Before substantial changes:
- read `docs/ADR-001-core-invariants.md`;
- read `docs/PROGRESS.md`;
- run the full test suite;
- run the frozen benchmark report.

After substantial changes:
- add positive and negative/adversarial tests;
- rerun the full suite and frozen benchmarks;
- update `docs/PROGRESS.md` with changes, evidence, limitations, and next gates;
- do not claim a milestone without executable evidence.

## Research maxim
**Steal shit ruthlessly — with attribution/citation.**


## Teacher Mode development rule

Once infrastructure exists for the learner to discover a cognitive procedure, do **not** automatically implement that procedure directly in host code.

Prefer this development cycle:

1. Pose a concrete problem or discriminating question.
2. Let the learner attempt it with current knowledge.
3. Record the impasse/failure and relevant context.
4. Teacher asks diagnostic questions or proposes explicit hypotheses/counterexamples.
5. Teacher provides the minimum structured hint/explanation necessary.
6. Learner proposes a Blueprint, concept, evaluation criterion, or other reusable knowledge.
7. Test it against positive, negative, adversarial, and held-out cases.
8. Store validated knowledge plus provenance and the teaching trace.
9. Reuse it on later tasks and measure whether teacher dependence falls.

Teacher interactions are research data. Preserve, when available:
- observation / impasse;
- question asked;
- hypotheses considered;
- alternatives rejected and why;
- experiment or counterexample proposed;
- result;
- conclusion/invariant;
- reusable procedure/concept produced;
- confidence and provenance;
- what question should be asked next.

The goal is not immediate zero-teacher bootstrapping. The goal is for Teacher Mode to progressively produce the procedures and evidence needed to replace pieces of Teacher Mode itself.

Do not force the learner to rediscover implementation plumbing (serialization, storage mechanics, etc.) merely for purity. The distinction is between infrastructure and cognitive strategy.

A primary long-term metric is **teacher calls/interventions required per successfully solved novel task as experience accumulates**. If accumulated experience does not reduce teacher dependence, treat that as evidence against the core hypothesis.


## Intent interpretation architecture

Natural language should not permanently require a frontier LLM.

Near-term front door:
`raw utterance -> Viv-inspired Intent Interpreter -> signals + goal + constraints -> graph/program retrieval + planner -> execution`

Rules:
- Do not use hand-authored `TaskSpec.family` / `labels` as a substitute for understanding raw language.
- Seed obvious vocabulary/groundings when rediscovering them has no research value.
- Unknown language should fall back to clarification or Teacher, not guessing.
- Validated Teacher interpretations must leave structured phrase/concept/relation grounding evidence that can remove later Teacher calls.
- Graph/planner feasibility should eventually feed back into interpretation ranking.
- The Viv-inspired interpreter is scaffolding, not the desired final architecture.
- Long term, learned graph mappings + generic matching/composition/ranking should progressively absorb both the hand-built interpreter and most LLM interpretation.
- Track `teacher-free intent grounding rate` and `Teacher interventions per novel language task`.

Attribution / prior art:
- Viv Labs' Natural Language Intent Interpreter and Concept Action Network patent family is explicit inspiration for the signals/goal typed-intent + planner boundary. Preserve attribution when documenting or publishing this architecture.


## v0.1 milestone principle
The primary research loop is now demonstrated on a small real-world filesystem family:
`raw language -> impasse -> Teacher teaches structured reusable knowledge -> learner synthesizes Blueprint -> held-out validation -> RUN/ADAPT with reduced Teacher dependence`.

Preserve this shape when expanding domains. Do not replace the learner's composition problem with convenience host calls such as `findLongestFilename()`. Native I/O and exact low-level operations may remain host capabilities; task-level procedures should be learned/composed and measured.

## v0.3 preregistration lock
Before changing learner behavior for the next scientific experiment, read `docs/PREREGISTRATION_V0.3.md`.
Do not tune success thresholds after seeing v0.3 held-out results. Any protocol change after the preregistration freeze must be logged as a new benchmark version.

### Blueprint uniqueness invariant
The durable program store must not contain two Blueprints with identical canonical executable semantics.
If synthesis creates a canonical match for a Blueprint already present, reuse the existing Blueprint and record the event as a retrieval/planning miss; do not persist the duplicate.
Exact canonical identity is stronger than same-fixture denotation. Behaviorally equivalent but structurally distinct plans may coexist when their semantics, costs, portability, tie behavior, or other declared properties differ.

## Context-sensitive language

A lexical form is not its meaning. EKG keeps explicit senses and may learn contextual evidence that selects among them without erasing alternatives. Context-sensitive resolution should combine lexical senses, semantic frames/graph coherence, type/execution constraints, and eventually neural candidate signals. See `docs/CONTEXTUAL_LANGUAGE.md`.

## Developmental education rule

A red benchmark is not a blocker and must not trigger benchmark-lawyering. Prefer teaching the missing concept/procedure and recording the resulting learning curve. A validated learned procedure becomes durable competence and remains part of the learner until it is explicitly revised/deprecated/forgotten by learning logic. Do not replace an aspirational learned skill with a task-specific host primitive merely to make the benchmark green.

## Language/world education doctrine

Do not hard-code answers to EKGBench families. Teach reusable grammar, semantic relations, world facts, and inference procedures into durable graph state. It is acceptable and expected for later tasks to remain red until prerequisite concepts are taught. Prefer staged curriculum reports showing `before -> lesson -> after` over zero-shot claims.

### Teach rules, not benchmark answers

When a developmental task requires multi-hop reasoning, prefer a general durable inference rule over task-family code. Keep language parsing rules, predicate semantics, world facts, and inference rules inspectable and separately teachable so failures identify the missing prerequisite.

### Curriculum selection invariant

Select the next lesson because it teaches a reusable concept or procedure the learner is missing, not because it is the shortest path to making a benchmark green. Benchmarks are sensors for missing prerequisites. If a task reveals a need for inverse relations, argument roles, relation composition, temporal ordering, negation, counting, or another general concept, teach that concept directly and let any benchmark improvement be a consequence. Do not add benchmark-family-specific solvers or task-shaped knowledge unless the domain itself genuinely requires that abstraction.

## Graph backend doctrine

- Read `docs/LADYBUGDB.md` and the storage doctrine in `docs/PROJECT_GOSPEL.md` before changing graph persistence/retrieval.
- `GraphStore` semantics are canonical; LadybugDB is the preferred embedded durable backend, not EKG's identity.
- Keep `MemoryGraphStore` working as bootstrap/test/fallback.
- Use OpenCypher for graph-native retrieval when the backend supports it; do not reimplement graph traversal with whole-store JS scans when Cypher can answer the query directly.
- Search v2 may consume graph/history priors, but executable correctness remains grounded in EKG evaluation, not database ranking.
- A **seed brain** (`ekg-data/seed-brain.json`) ships with the repo. Update the seed when baseline knowledge grows. The seed is the reproducible starting intelligence; runtime brains accumulate on top.
- Both `FileBrain` (JSON) and `LadybugBrain` (.lbdb) implement the `Brain` interface. The CLI auto-detects backend availability and auto-migrates from JSON to LadybugDB.

## Resilience is a product invariant

Do not treat learned-program/library entries as disposable single points of failure. Validated learned capabilities must preserve enough executable state in durable graph memory to be reconstructed. Normal EKG execution should use self-healing program lookup / resilient preflight when learned-program chains are involved. Repair from existing validated knowledge first; revalidate; record the repair. If recovery is impossible, escalate with a concrete broken-dependency diagnosis. Do not silently invent replacements, and do not abandon an entire chain merely because one live implementation pointer disappeared.

### Lived experience is recovery state

Resilience must not depend solely on one canonical Blueprint snapshot. Preserve durable execution context for learned-program and host-capability usage whenever practical, including successful and failed calls, actual inputs/outputs or errors, typed signatures, caller/call-stack context, call-site expressions, surrounding caller Blueprints, provenance, and repair history. Do not discard a failed usage merely because a later usage succeeds.

When a learned implementation is missing/corrupt, recovery order is:
1. restore and revalidate the canonical durable executable snapshot when available;
2. otherwise reconstruct from accumulated lived usage evidence, preferring the historically observed execution neighborhood over unconstrained global search;
3. validate the reconstruction against remembered successful usages and current dependencies;
4. persist the validated replacement plus reconstruction provenance;
5. only then escalate to Teacher with the complete diagnosis/evidence if autonomous repair fails.

The learner's past executions are part of its durable context and may contain enough evidence to recover knowledge even when the original implementation artifact is gone.
