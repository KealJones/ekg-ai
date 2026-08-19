# EKG Project Gospel

## Learning survives process restarts

Acquired competence and lived experience are not merely in-memory state. The runnable EKG brain must persist its graph, learned executable Blueprints, execution traces (successes and failures), and controller episodes to disk and load them again on startup. A capability is not “durable” if killing the process erases it. The current zero-dependency implementation uses one ordinary local brain file; external databases are optional future scale choices, not prerequisites for memory.


## North star

EKG is **not an LLM** and should not be developed as though it were one.

It is a lifelong, executable learning system whose growing body of concepts, language groundings, programs, capabilities, episodes, corrections, tests, and relationships is part of the intelligence itself.

- Knowledge is **not expected out of the box**. Learning machinery may bootstrap early; knowledge and understanding are acquired through education and experience.
- Zero-shot performance is not the product goal. An EKG instance that has never been taught is allowed to be ignorant.
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


### Blueprints as executable semantics

Treat it as a live architectural hypothesis that **Blueprints may serve multiple compatible functions**: executable plans, semantic structures, learned procedures, and an interlingua between natural language and cognition.

A target developmental loop is:

`language -> typed semantic/executable Blueprint -> reasoning/retrieval/execution -> result Blueprint -> language`

Language parsing and realization may themselves become learned reusable procedures/capabilities. Teacher demonstrations should therefore be mined not only for answers, but for durable transformations between surface language and structured meaning.

Do **not** impose a one-layer rule. A separate linguistic/semantic IR is allowed whenever it earns its keep—for example by preserving ambiguity, discourse/pragmatics, morphology, incomplete meaning, multilingual surface structure, or a materially cheaper representation. Conversely, do not invent a second layer merely because conventional NLP architectures have one if Blueprint can express the same semantics cleanly.

**Prefer shared semantics over duplicated semantics; prefer useful boundaries over minimal layer count.** See `docs/LANGUAGE_BLUEPRINTS.md`.

## Capability doctrine

Pure primitives should cover boring portable computation. Host capabilities expose the environment: files, paths, processes/shell, clocks, etc.

Effectful host capabilities are legitimate. They should be explicit, provenance-bearing, and sandboxable, but not forbidden merely to protect benchmark purity.

A task-level convenience operation should preferably be learned/composed rather than permanently gifted when the learner has enough substrate to construct it. When such a learned operation proves valid and useful, however, it may be promoted into durable capability knowledge and thereafter participate in future learning exactly like older abilities. The boundary between "learned program" and "native capability" is allowed to evolve over the lifetime of the system.

## Developmental benchmark doctrine

Expected-red tests are first-class.

EKGBench includes:

- the twenty bAbI prerequisite skill families as long-term language/reasoning probes;
- personal EKG milestones such as structured-object access;
- future capability alarms that may remain red for many versions.

A red developmental probe does **not** fail CI. The report records PASS / FAIL / ABSTAIN and, where possible, the failure layer: interpretation, missing knowledge, missing capability, synthesis, execution, or validation.

When a long-red probe turns green without directly gifting its solution, treat that as a milestone worth investigating and preserving.

## The sentence to remember

**Give EKG an alphabet, teach it for years, let every durable concept and capability become part of what it is, and watch that living competence revise and grow through experience.**

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

- EKG's semantic/experiential graph is part of cognition, but **no specific database product is part of EKG's identity**.
- The active v0 realization is `MemoryGraphStore`: synchronous, zero-dependency, in-process, and fully runnable in constrained/local environments.
- Prefer the simplest storage substrate that lets the learner actually run, learn, execute, repair, and be tested end-to-end. Do not add infrastructure merely because a more powerful database exists.
- `GraphStore` semantics are canonical. A future persistent or query-optimized backend may implement the same boundary if it provides enough benefit to justify its operational cost.
- Search v2 may consume graph/history priors, but executable correctness remains grounded in EKG evaluation rather than database ranking.
- Runtime graph/program/episode stores remain in-process for speed and portability, while `FileBrain` persists them to one local JSON brain file and reloads them at startup. Restart persistence is tested across separate Node processes.

## Storage is a host realization, not the mind's identity

EKG's accumulated executable knowledge and lived experience belong to EKG, not to a storage vendor. The semantic boundary is `GraphStore` / property-graph meaning. Today that boundary is realized by `MemoryGraphStore` plus the `FileBrain` snapshot wrapper; later hosts may add another graph engine without redefining what EKG can mean or learn. **Runability and portability outrank database sophistication.**
