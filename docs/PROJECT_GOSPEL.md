# EKG Project Gospel

## North star

EKG is **not an LLM** and should not be developed as though it were one.

It is a lifelong, executable learning system whose growing body of concepts, language groundings, programs, capabilities, episodes, corrections, tests, and relationships is part of the intelligence itself.

- Knowledge is **not expected out of the box**. Learning machinery may bootstrap early; knowledge and understanding are acquired through education and experience.
- Zero-shot performance is not the product goal. A baby that has never been taught is allowed to be ignorant.
- Teacher interaction is normal. The important trajectory is that teaching leaves durable reusable knowledge and future related tasks require less help.
- The graph is not an accessory cache. It is long-lived semantic and procedural memory: part of the system's lived experience.
- EKG should not depend on a giant prompt/context window to remember what it knows. Relevant context should be retrieved from its accumulated experience.
- EKG does not fundamentally depend on a fixed agent harness or a permanently fixed externally supplied tool list.
- **Tools are learnable knowledge and acquired capabilities become part of the learner.** EKG may compose existing capabilities into reusable tools; when its representational/runtime substrate supports it, it may create or acquire new capabilities, validate them, attach provenance, and integrate them into its durable competence. A capability is not a one-off task artifact to be discarded after use. Once acquired, it should remain available as part of what the AI knows how to do unless later learning deliberately revises, supersedes, deprecates, or forgets it.
- EKG should adapt to the host environment in which it runs. Host capabilities are environment affordances, not the identity of the intelligence.
- **Portable ontology follows semantic convergence, not unanimous native APIs.** If roughly 80–90% of representative runtimes independently support the same fundamental concept, that concept may belong in EKG's portable core even when an outlier host lacks a native representation. The outlier must have a practical adapter or ecosystem realization (for example, Bash using `jq` for recursive JSON/object semantics). One runtime does not get veto power over what EKG is allowed to understand. Count semantic equivalence, not identical API shape. Hosts adapt to EKG's semantic universe; EKG's ontology should not be artificially reduced to the lowest-common-denominator native type system.
- The system is intended to keep learning and adjusting during its lifetime rather than freezing all useful knowledge into model weights after training.

## Education over purity

Developmental evaluation and scientific falsification are different activities.

For normal development:

1. Give the learner the boring universal computational substrate humans/programmers reasonably take for granted.
2. Teach concepts, language, procedures, relationships, and strategies explicitly.
3. Keep aspirational tests red until learning makes them green.
4. Record why failures happened and use them to choose curriculum.
5. Prefer a learning curve over a one-shot purity contest.
6. Do not avoid useful capabilities merely because they make an old benchmark inconvenient.
7. Preserve old checkpoints if a clean historical experiment matters; do not freeze current development around them.

A benchmark is a **developmental report card**, not a sacred artifact. Frozen experiments may still exist when useful, but they do not get to dictate the architecture.

### Curriculum serves the learner, not the benchmark

Choose teaching targets because they add **general reusable knowledge** that expands what the learner can understand, infer, or build—not merely because they flip a particular benchmark item from red to green.

- Prefer concepts such as inverse relations, semantic roles, relation composition, temporal ordering, negation, counting, and reusable procedures over benchmark-specific handlers.
- A benchmark may reveal a missing prerequisite, but the response should be to teach the prerequisite itself.
- If a lesson only makes one named benchmark family pass and has no plausible reuse outside that family, treat it as suspiciously task-shaped.
- Preserve red tasks when prerequisite knowledge is genuinely missing; they are useful developmental sensors.
- When a general lesson happens to make several old red tasks turn green, that is the preferred kind of progress.

**Benchmarks diagnose education needs. They do not define the learner's ontology or curriculum.**

## Teacher doctrine

The Teacher exists to educate itself out of repeated work, not to make a one-shot score look good.

A useful lesson should leave behind some combination of:

- lexical grounding;
- word sense;
- semantic relation;
- concept/property/definition;
- positive and contrastive examples;
- reusable procedure/Blueprint;
- test or invariant;
- failure/correction;
- provenance and confidence;
- a better question to ask next time.

Repeated lessons are allowed. Humans and language models both require substantial training. Measure how competence changes with experience.

## Language doctrine

Language understanding is expected to emerge from a hybrid:

`utterance -> small neural candidate signal -> graph retrieval/sense resolution -> typed semantic composition -> execution/validation -> learning`

The neural intent layer is not required to contain the whole world in frozen weights. It may provide fuzzy candidate generation while the graph supplies explicit senses, synonyms, antonyms, definitions, relations, examples, type constraints, programs, and history.

Validated Teacher corrections become supervision for both graph growth and optional later retraining/distillation of the small neural layer.

## Capability doctrine

Pure primitives should cover boring portable computation. Host capabilities expose the environment: files, paths, processes/shell, clocks, etc.

Effectful host capabilities are legitimate. They should be explicit, provenance-bearing, and sandboxable, but not forbidden merely to protect benchmark purity.

A task-level convenience operation should preferably be learned/composed rather than permanently gifted when the learner has enough substrate to construct it. When such a learned operation proves valid and useful, however, it may be promoted into durable capability knowledge and thereafter participate in future learning exactly like older abilities. The boundary between "learned program" and "native capability" is allowed to evolve over the lifetime of the system.

## Developmental benchmark doctrine

Expected-red tests are first-class.

BabyBench includes:

- the twenty bAbI prerequisite skill families as long-term language/reasoning probes;
- personal EKG milestones such as structured-object access;
- future capability alarms that may remain red for many versions.

A red developmental probe does **not** fail CI. The report records PASS / FAIL / ABSTAIN and, where possible, the failure layer: interpretation, missing knowledge, missing capability, synthesis, execution, or validation.

When a long-red probe turns green without directly gifting its solution, treat that as a milestone worth investigating and preserving.

## The sentence to remember

**Give baby an alphabet, teach it for years, let every durable concept and capability become part of what it is, and watch that living competence revise and grow through experience.**

## Resilience doctrine

A durable learned capability must not become a single brittle pointer whose disappearance destroys every downstream skill.

- Before execution, inspect learned-program dependencies when practical and repair missing links from durable knowledge.
- During execution, a dependency lookup may self-heal from validated graph memory rather than immediately collapsing the whole run.
- Acquired executable abilities must retain enough validated representation to be reconstructed, not merely metadata saying that they once existed.
- Repairs are observable episodes with provenance. Never silently fabricate a replacement.
- Recovered implementations are revalidated before rejoining active competence.
- If the system cannot repair from existing knowledge/context, escalate with a diagnosis of the broken dependency and what evidence is missing.
- Learning itself may later revise or replace broken/stale knowledge; resilience is not permission to preserve bad knowledge forever.

**A chain is allowed to bend, repair, and continue. A missing implementation should not automatically mean lost understanding.**

## Storage is an implementation detail; graph semantics are cognition

- EKG's durable semantic/experiential graph is part of cognition, but **no specific database product is part of EKG's identity**.
- Prefer a capable open property-graph backend when the environment supports one. **LadybugDB is the current preferred grown-up local backend** because it is embedded, native, persistent, Cypher-capable, and replaceable behind `GraphStore`. ArcadeDB remains a valid optional network/server realization rather than the canonical brain.
- `MemoryGraphStore` remains a zero-install bootstrap/test/fallback brain. EKG must be able to hydrate/adapt when a durable backend becomes available.
- Use Cypher aggressively for semantic traversal, language sense context, provenance, lived-experience recovery, and search priors. Do **not** use the database as a substitute for executable synthesis.
- The learner should exploit the best storage/query substrate available in its environment without becoming dependent on that substrate for its ontology.

## Storage is a host realization, not the mind's identity

EKG's accumulated executable knowledge and lived experience belong to EKG, not to a database vendor. The semantic boundary is `GraphStore` / property-graph meaning. A capable host may realize that boundary with embedded LadybugDB and Cypher; a tiny host may use memory; another host may use a compatible graph database. Backend choice may improve retrieval and durability but must not redefine what EKG can mean or learn. Native/portable exports and reproducible reconstruction remain required so the learner's experience can move with it.
