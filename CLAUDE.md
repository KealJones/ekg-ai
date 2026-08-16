# CLAUDE.md

## Project intent
This repository experiments with **Executable Knowledge Graph Intelligence**: portable learned procedures + explicit evidence/knowledge, with the goal of reducing search and external teacher dependence over time.

Do not optimize for impressive demos. Optimize for falsifiable evidence that learning, reuse, abstraction, and transfer actually work.

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
