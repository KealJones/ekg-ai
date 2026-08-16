# EKG-AI v0.3 — Pre-registered Independent Primitive-Holdout Experiment

**Status:** FROZEN DESIGN — implementation may change to execute this protocol, but success criteria may not be tuned after held-out results are observed.

## Why this exists
v0.2 proved that the harness and learning loop execute, but it did not establish compositional learning. The pilot was authored/evaluated by the same agent, its six filesystem successes shared one learned dependency, lexical-near items overlapped training semantics, and the k-NN baseline lacked a fair abstention option.

v0.3 asks one narrow question that is allowed to fail:

> Can one Teacher lesson create durable semantic knowledge that is reused to solve independently-produced, previously unseen compositions, rather than merely retrieving a task-family pattern?

## Primary hypotheses
**H1 — one-shot compositional acquisition.** After exactly one lesson for each of three previously absent semantic capabilities, Teacher-OFF accuracy at matched coverage improves on novel compositions containing those capabilities.

**H2 — better than selective retrieval.** EKG's risk/coverage frontier beats a threshold-swept k-NN cache at matched supervision; k-NN is allowed to abstain.

**H3 — compact durable growth.** Solving many novel compositions does not require one new durable artifact per test task. Growth is measured conditional on semantic novelty, not merely task count.

**H4 — regenerability.** Learned capability can be reconstructed without Teacher after deleting derived executable representations, with recovery cost increasing as progressively deeper knowledge is removed; recovery must fail safely once the semantic basis is removed.

## Independence requirements
Before any scored run:
- held-out utterances must not be authored by the EKG implementing/Teacher agent;
- gold denotations must come from executable reference semantics over >=3 deterministic fixtures per item;
- split assignment and novelty checks must be performed independently of learner state;
- baseline abstention thresholds are swept, never hand-picked to lose;
- benchmark/grader/protocol receive adversarial review by a different model family; a 60–100 item human-adjudicated sample is desirable before publication claims;
- held-out items remain unseen by learner/Teacher until the protocol and thresholds below are frozen.

External corpora may supply language, but must not dictate EKG's ontology. Selection/mapping is frozen before scored evaluation.

## Capability selection
Select exactly 3 semantic capabilities satisfying all of:
1. absent from durable EKG knowledge at checkpoint 0;
2. not directly available as a task-level host convenience capability;
3. expressible by composition over legitimate host/runtime primitives;
4. independently useful in >=40 novel held-out compositions;
5. capable of being taught in one minimal isolated lesson.

Do not force EKG to rediscover JSON parsing, arithmetic, storage, serialization, or other exact host machinery merely to make the benchmark difficult.

## Teaching budget
For each capability:
- exactly one Teacher intervention;
- minimal isolated teaching context;
- Teacher output, tokens, structured lesson, resulting mutations, and provenance logged;
- no additional Teacher teaching for that capability before held-out evaluation.

## Evaluation set
Target: ~120 scored items, ~40 per held-out capability.

Every answerable item:
- uses the held-out capability only in composition with already-known semantics;
- uses a compound structure not demonstrated in its lesson;
- executes against >=3 fixtures, including counterfactual fixtures with different correct denotations where possible;
- is graded by denotation, not textual/structural similarity.

A 100% ceiling result is treated as evidence that instrumentation may be too easy and triggers a harder *new benchmark version*, not post-hoc mutation of v0.3.

## Conditions
All scored conditions are Teacher-OFF with verified zero Teacher calls:
1. **EKG post-lesson**.
2. **Lesson-withheld EKG** — same system/search budget, no new semantic lesson.
3. **Selective k-NN** — same stored examples, similarity threshold swept over full range.
4. **Checkpoint-0 synthesis control** — seed machinery only, same search budgets.
5. **Teacher few-shot relevance comparison** — same lessons in context; reported for practical cost/headroom, not as evidence that EKG learned.

If practical, add RAG and fine-tuned baselines at matched supervision later without changing primary v0.3 criteria.

## Primary measurements
- denotation accuracy at matched coverage;
- risk/coverage curve and AURC;
- false confident execution rate (FCER);
- search nodes per solved item;
- cumulative Teacher tokens;
- durable-state serialized size and canonical-node count per layer;
- cross-family reuse of learned artifacts;
- MDL/compression ratio: `(durable reusable knowledge + solutions expressed through it) / solutions independently expressed from base primitives`;
- duplicate-synthesis rate: synthesis attempts whose canonical semantics already exist in the durable store.

Duplicate synthesis is a retrieval/planning diagnostic. The durable store must reject/dedupe exact canonical-semantic duplicates.

## Growth interpretation
Do **not** call every O(N) knowledge layer a cache. New semantic concepts can legitimately require new declarative knowledge.

The falsifying pattern is stronger:
> N new compositions of already-known semantics require approximately N new task-specific durable artifacts.

Growth curves must therefore separate **new semantic novelty** from **new compositions of known semantics**.

## Success / kill gate
Primary decision gate, frozen before results:

EKG passes the central v0.3 gate only if BOTH are true:
1. on independently sourced primitive-holdout compositions, EKG exceeds threshold-calibrated k-NN by **>=15 percentage points at matched coverage** on the preselected operating points / frontier comparison; and
2. durable state for novel *compositions of already-known semantics* grows visibly sublinearly relative to the k-NN cache's per-example growth, with no task-specific artifact-per-success pattern.

Additionally report, but do not substitute for either gate:
- lesson-withheld delta;
- FCER (must not increase to buy coverage);
- search cost;
- MDL ratio;
- cross-family reuse;
- Teacher-token efficiency.

If both primary conditions fail: classify the tested architecture as cache-like for this hypothesis and pivot/stop the compositional-acquisition claim rather than redefining success.
If composition fails but atomic use succeeds: conclude knowledge storage works but composition is not established.

## Knockout + recovery protocol
Run only after the primary evaluation, using preselected artifacts.

### A — Frozen knockout
Delete target artifact(s). Disable synthesis, compilation, learning, writes, and Teacher. Measure immediate damage and graded degradation.

### B — Autonomous recovery
Same deletion. Enable synthesis/compilation/validation/writes; Teacher remains OFF. Evaluate at recovery budgets 1x, 3x, 10x original solve cost. Grade reconstructed capability by denotation across >=3 fixtures.

### C — Semantic floor
Delete target plus transitive/alternative representations capable of encoding the same content: dependent concepts, relations, groundings, derived indexes/embeddings, validation artifacts, and Teacher-derived semantic meta-knowledge. Recovery after this deletion is not automatically celebrated; it may reveal seed machinery.

### D — Seed-only synthesis control
Fresh checkpoint-0 state, same recovery search budget. If it reconstructs at comparable cost, acquired knowledge did not cause recovery.

### E — Information audit
Mechanically search surviving durable state, caches, indexes, logs, prompts, and derived stores for isomorphic/residual representations of deleted content before counting recovery as evidence.

Report frozen damage and regenerability as separate axes.

## Recovery equivalence classes
Primary recovery criterion: denotational equivalence across >=3 fixtures, including a changed-answer counterfactual when possible.

Report:
1. denotationally equivalent + structurally different (strong synthesis evidence);
2. canonical-structurally equivalent but serialization differs;
3. byte-identical (audit for leakage/deterministic hidden copy before credit);
4. original-fixture-only equivalence (failure);
5. structurally similar but denotationally wrong (failure).

## Blueprint uniqueness invariant
At normal runtime, if a synthesized Blueprint canonicalizes to an existing durable Blueprint:
- do not persist the new duplicate;
- return/reuse the existing Blueprint;
- record a `duplicate synthesis / retrieval miss` diagnostic;
- investigate why RUN/ADAPT did not find it first.

This invariant does not prohibit behaviorally equivalent but structurally distinct plans, nor deliberate reconstruction after the original was removed.

## Reporting corrections carried forward from v0.2
Every benchmark report must emit mutually interpretable outcome counts:
- correct answer;
- wrong answer read-only;
- wrong effectful action;
- correct escalation;
- unnecessary escalation;
- missed escalation;
- correct clarification;
- unnecessary/uninformative clarification;
- abstention;
- timeout.

Never present overlapping `correct` and `escalation` totals without this confusion matrix.

Correlated items sharing one learned dependency are not treated as independent evidence of multiple learning events. Report family/artifact-level effective units alongside item-level scores.

## What v0.3 does NOT claim
Passing v0.3 would not prove general intelligence, replace LLMs, or establish scientific novelty over all program-learning systems. It would establish a narrower and useful fact: a small number of Teacher lessons can leave compact durable semantic knowledge that contributes to novel Teacher-OFF compositions better than selective nearest-neighbor retrieval under this protocol.
