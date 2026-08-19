# Implementation progress log

## v0.0.1 — Portable execution spike

Implemented:
- Language-neutral typed Blueprint IR.
- Reference interpreter.
- Replaceable capability registry.
- TypeScript backend execution.
- Rust source emitter (runtime execution pending availability of Rust toolchain).
- Logical GraphStore abstraction + in-memory graph.
- Tiny typed enumerative synthesis.

Evidence:
- Initial suite: 3/3 tests passing.
- Synthesizer independently finds `x * 2` from examples.

## v0.0.2 — Impasse controller

Implemented:
- `TaskSpec` as machine-grounded task contract.
- `MemoryProgramLibrary` for durable reusable programs.
- `Episode` / `EpisodeStore`.
- `LearnerController` with explicit `RUN -> ADAPT -> BUILD -> TEACH` flow.
- `ADAPT` seeds synthesis with subexpressions from compatible known programs.
- Search telemetry: candidates explored and depth reached are retained in results/episodes.
- Frozen smoke benchmark runner in `benchmarks/v0-controller.mjs`.

Evidence:
- 7/7 tests passing after controller addition.
- Tests explicitly cover all four decisions: RUN, ADAPT, BUILD, TEACH.

### Current limitations
- Program blueprints cannot yet call other learned programs as nested executable nodes; learned programs can be reused wholesale or mined as adaptation seeds.
- Task evaluation is example equality only; property/invariant tests are next.
- No abstraction mining/consolidation yet.
- No persistent EpisodeStore yet.
- No natural language, teacher LLM, embedding, or neural search by design.
- Rust code generation exists, but this runtime lacks `rustc`/`cargo` for differential execution.

### Next gates
1. Add property/invariant evaluation to TaskSpec.
2. Freeze a tiny train/test benchmark and memorize-only baseline.
3. Make learned programs callable/composable inside later blueprints.
4. Measure search savings from reuse before abstraction mining.
5. Add first abstraction-mining experiment only after baseline metrics are frozen.

## v0.0.3 — Falsifiable task evaluation + frozen learning benchmark

Implemented:
- Declarative, serializable property/invariant checks in `TaskSpec`.
- Property evaluator uses capability references rather than hidden JS callbacks.
- Frozen benchmark suite `v0.1` with fixed train/test splits.
- Exact-task memorize-only baseline.
- Learning benchmark report comparing learner vs memorize baseline.

Evidence:
- 10/10 tests passing at this milestone.
- Property test rejects a constant shortcut that fits the only example but violates the invariant.
- Frozen held-out benchmark: learner solves 4/5; memorize baseline solves 0/5.
- Held-out exact behavioral reuse reaches zero-search `RUN` for max2 and string-length.
- Novel triple/quadruple tasks are solved through `ADAPT`; unsupported string reversal remains `TEACH`.

## v0.0.4 — Learned programs become executable building blocks

Implemented:
- `program_call` in portable Blueprint IR.
- Reference interpreter resolves learned-program calls through `ProgramLibrary` with recursion-cycle protection.
- TypeScript and Rust emitters inline nested learned program semantics from the same canonical blueprint.
- Synthesizer may use learned programs as atomic callable units in future compositions.
- Conservative exact-subgraph abstraction miner.
- Local procedure-usage telemetry separating direct selection from structural centrality / parent-program reuse.

Evidence:
- 13/13 tests passing.
- A nested `double(double(x))` blueprint executes correctly via the reference interpreter and generated TypeScript and emits equivalent Rust structure.
- Abstraction miner detects a repeated `double(x)` subgraph independently present across multiple programs.
- Telemetry distinguishes a procedure that is rarely directly selected but structurally reused by parent blueprints.

### Current benchmark snapshot
- Frozen suite: `v0.1`.
- Learner held-out solve rate: 4/5.
- Exact memorize baseline: 0/5.
- Held-out search candidates explored: 25 total across 5 tasks.
- Known exact reusable programs can execute with 0 synthesis candidates.

### Current limitations
- Abstraction miner only detects exact canonical repeated subgraphs; no parameterized anti-unification/e-graphs yet.
- Abstraction candidates are not auto-promoted; promotion must be justified by measured compression/search/transfer utility.
- No persistent graph/episode backend yet.
- No neural guidance, natural-language front end, or teacher protocol yet by design.
- Rust source generation exists but this environment still lacks `rustc`/`cargo` for differential runtime execution.

### Next gates
1. Create an abstraction-promotion experiment that measures held-out search cost before/after promotion.
2. Add task-family/context metadata to program-usage telemetry and episode summaries.
3. Add deterministic benchmark report artifacts so progress comparisons survive refactors.
4. Only then consider anti-unification/e-graphs if exact-subgraph mining proves too brittle.
5. Keep Teacher Mode out until abstraction utility is measurable.

## v0.0.5 — adversarial / negative correctness suite

- Added runtime blueprint/value validation: input arity, runtime value types, capability/program arity, declared expression types, unknown capabilities/programs.
- Added graph integrity checks for dangling relations and confidence bounds.
- Added `tests/adversarial.test.mjs` covering explicit wrongness at every current layer:
  - malformed IR/input rejection;
  - wrong programs evaluate false;
  - contradictory/no-pattern task sets do not synthesize a fake solution;
  - near matches do not incorrectly `RUN`;
  - unsupported goals stay `TEACH`;
  - graph filters/integrity reject invalid structure;
  - abstraction miner does not invent recurrence across unrelated programs or from only one program.
- The adversarial suite itself exposed and helped fix a validator bug that incorrectly classified nested reuse like `double(double(x))` as recursion.
- Full suite: **26/26 passing**. Frozen benchmark remains healthy after validation changes.


## v0.0.6 — promotion gate groundwork + permanent testing contract

Implemented:
- Added root `CLAUDE.md` with architecture invariants, benchmark discipline, handoff rules, and the standing **Prove Wrong Things Are Wrong** requirement.
- Added an explicit abstraction-promotion decision layer.
- Promotion now requires three independent signals in v0: recurrence across independent programs, positive representation/compression gain, and positive held-out search savings.
- Added conversion from a supported exact abstraction candidate into a portable learned `ProgramBlueprint`; no Rust/TypeScript semantics are embedded in the abstraction.
- Added negative tests proving that frequency alone is insufficient and repetition inside one program is insufficient.

Important limitation:
- `heldoutSearchSavings` is currently accepted as measured evidence by the promotion gate; the next step is wiring a benchmark runner that performs the before/after experiment automatically rather than supplying those measurements manually.
- Exact-subgraph candidates only; parameterized anti-unification remains deferred.

Next gate:
1. Build the automatic before/after abstraction utility experiment.
2. Ensure the same frozen held-out tasks are run with and without the candidate abstraction.
3. Only commit/promote the abstraction to the reusable library when the measured gate passes.
4. Add a regression/demotion test where a once-useful abstraction becomes harmful after the task distribution changes.


## v0.0.7 — measured abstraction promotion experiment

Implemented:
- Added `runAbstractionPromotionExperiment`: runs the exact same held-out TaskSpecs with and without a proposed abstraction.
- Discovery/source programs are excluded from held-out search unless explicitly supplied, preventing the discovery corpus from leaking into the utility measurement.
- Promotion now refuses any candidate that reduces held-out solve rate.
- With equal solve rate, promotion requires a strict reduction in candidates explored.
- Search now prefers retrieved/learned callable programs before low-level host capabilities; this encodes the intended hierarchy where learned procedures can actually shorten search.
- Added `benchmark:promotion` with a positive and negative control.

Evidence:
- Helpful `triple(x)` abstraction: held-out search improves versus primitive-only synthesis and promotion is accepted.
- Frequent-but-irrelevant `max(x,x)` abstraction: held-out search becomes worse and promotion is rejected.
- This is the first automated before/after experiment where a learned-style abstraction must *earn* its place by measured held-out utility.

Important limitation:
- Discovery candidates in the promotion benchmark are still hand-constructed fixtures. The next step is an end-to-end run where programs learned by the controller are mined automatically, a candidate is proposed, then evaluated on a separately frozen validation family.
- Search relevance filtering is still crude: every callable program supplied to the synthesizer is tried before primitives. Long-term this must become graph/context retrieval plus learned/neural ranking so a large library does not itself explode search.

Next gates:
1. Build a three-way split: discovery/train -> promotion validation -> final untouched test.
2. Mine candidate abstractions only from discovery programs.
3. Promote using validation only.
4. Measure the promoted library on final untouched tests.
5. Add regression/demotion when a previously promoted abstraction becomes harmful under a changed task distribution.


### v0.0.7 correction — learned-first priority must be relevance-scoped

The first implementation briefly prioritized *all* learned callable programs before host primitives. The frozen benchmark exposed this as a regression: held-out search candidates increased from 25 to 47.

Correction:
- Default synthesis remains capability-first.
- `programCallPriority:"before-capabilities"` is explicit and is only appropriate for a small relevance-filtered/retrieved learned set.
- The promotion experiment may use learned-first priority because the candidate is the explicit item under evaluation.
- Added an adversarial test proving that blindly prioritizing an irrelevant learned procedure increases search cost.

This reinforces a core requirement for the next major phase: **promotion and storage are not enough; useful retrieval/context selection is required for a large learned library to remain computationally beneficial.**


## v0.0.8 — first end-to-end learned abstraction transfer

Implemented:
- Added an end-to-end three-stage abstraction benchmark:
  1. **Discovery:** separate primitive-only learner runs independently synthesize programs for `3x` and `4x`.
  2. **Validation:** the abstraction miner sees only those learned programs, discovers the repeated `2x` executable subgraph, and the promotion gate evaluates it on a separate `6x` task.
  3. **Final untouched test:** only after promotion is decided, the accepted abstraction is evaluated on an unseen `8x` task.
- Exported a utility measurement path separate from the promotion decision so final tests cannot influence whether a candidate is accepted.
- Added a regression test asserting the full discover -> mine -> validate -> final-transfer chain.

Evidence from the current deterministic fixture:
- Discovery is independent: each discovery synthesis starts from primitives with an empty learned library.
- Mined abstraction: shared `2x` subgraph, not hand-specified to the miner.
- Validation `6x`: candidate reduces synthesis search from **99 to 86** candidates and is accepted.
- Untouched final `8x`: candidate reduces synthesis search from **434 to 82** candidates while preserving solve rate.
- This is the first result in the repo demonstrating that independently learned programs can create a mined reusable abstraction that earns promotion on separate validation and materially reduces search on an untouched harder task.

Caveats:
- The task family is intentionally tiny and synthetic; this is evidence that the mechanism works, not evidence of general intelligence.
- The miner still recognizes exact canonical subgraphs only.
- The benchmark currently selects the top mined candidate by recurrence score; future versions need multiple-candidate validation and correction for selection bias.
- Relevance is supplied by the benchmark when the promoted abstraction is considered; scalable graph/neural retrieval remains a later requirement.


## v0.0.9 — first explicit learned-program retrieval layer

Architecture lock:
- Host capabilities are cheap/exact machinery.
- Learned Blueprints represent knowledge about how/when to compose capabilities.
- Rust/TypeScript/native math remain implementations, not ontology.
- The boundary may move later when measured evidence justifies compiling/promoting a universally useful learned procedure downward.

Implemented:
- Added a non-neural `retrievePrograms` layer separate from storage and synthesis.
- Type contracts are a hard retrieval gate: popularity/context can never make an incompatible procedure eligible.
- Compatible programs can be ranked using task labels/family plus local direct-use and structural-centrality telemetry.
- Retrieval returns reasons/scores so ranking remains inspectable during this phase.
- Added adversarial tests for wrong-type high-popularity procedures and contextual ranking.

Important experimental result:
- A blind learned-first library of only 13 compatible programs made a tiny held-out `3x` search explode from **5 primitive-only candidates to 238 candidates**.
- Context retrieval correctly selected `abstract.double` from that library, reducing learned-first search to **10 candidates**.
- This does **not** beat primitive-only search on this trivial task (5 vs 10), so retrieval is not yet allowed to claim a win. It does demonstrate that relevance filtering avoids most of the library-size explosion (238 -> 10).
- This is useful negative evidence: a learned abstraction should not automatically be injected merely because retrieval can find it. We need a second decision about whether learned knowledge is worth activating for the current task/search regime.

Next gate:
1. Add an activation/cost model that can choose primitive-only vs retrieved-learned search.
2. Evaluate retrieval as library size and task depth increase without OOMing enumerative search.
3. Retrieval success criterion: preserve solve rate while total search cost scales materially better than blind learned-first; on easy tasks it should be able to abstain and choose primitives.
4. Later replace hand-authored task labels/family with graph-derived context and eventually learned/neural ranking only if benchmarks justify it.


## v0.0.10 — retrieval activation / abstention policy

Implemented:
- Separated **retrieval** ("what learned knowledge is relevant?") from **activation** ("is using it worth the search overhead?").
- Added an offline activation oracle that labels measured primitive-vs-learned outcomes without sacrificing solve rate.
- Added a conservative online v0 activation policy with explicit abstention.
- Repeated measured savings can activate learned-first search; repeated non-positive savings force abstention.
- Without history, only a harder search + strong contextual match + very small retrieved set is allowed to activate learned-first.
- Added adversarial tests ensuring a cheap learned failure never beats a successful primitive path.

Evidence:
- Easy `3x` regime: primitive 5 vs retrieved-learned 10 => oracle says **ABSTAIN / primitive-only**.
- Hard `8x` regime from the abstraction experiment: primitive 434 vs learned 82 => oracle says **ACTIVATE learned-first**.
- The policy therefore encodes the distinction discovered in v0.0.9: relevance is not sufficient evidence of utility.

Important limitation:
- `primitiveDepthHint` is currently supplied externally; we do not yet have a principled online estimate of primitive difficulty before doing the expensive search.
- Prior savings are not yet persisted as graph evidence keyed by context/task family/program. That is the next useful integration.
- The online policy is deliberately hand-written scaffolding. Its job is to create a stable interface and training/evaluation target for a future learned policy, not to become permanent magic thresholds.

Next gate:
1. Persist activation outcomes as graph evidence linking task context -> retrieved procedure -> measured utility.
2. Derive priors from that evidence instead of injecting them manually.
3. Add exploration so unknown contexts can occasionally measure both arms without doing so forever.
4. Benchmark whether the policy learns to abstain on easy families and activate on harder families from its own episode history.


## v0.0.11 — Teacher Mode becomes first-class research data

Decision:
- We are changing the development methodology now: once the learner has enough infrastructure to discover a cognitive strategy, prefer **problem -> impasse -> diagnostic question -> minimal teaching -> learner proposal -> adversarial validation -> stored knowledge** over directly coding the cognitive answer.
- Infrastructure/plumbing may still be implemented directly. We are not making the learner rediscover serialization or storage for ideological purity.
- Teacher interactions are now considered valuable training/research data whose eventual purpose is to help replace Teacher Mode itself.

Implemented:
- Added the standing Teacher Mode development rule to `CLAUDE.md`.
- Added a serializable `TeachingTrace` schema with observation, impasse, teacher question, hypotheses, experiments, conclusion, extracted reusable knowledge, next question, intervention count, and provenance.
- Added validation and negative tests for malformed teaching traces.
- Backfilled the retrieval -> activation discovery as the first concrete teaching trace: `teaching/teach.activation.001.json`.
- The trace extracts not only the activation criterion but also a reusable **teacher question strategy**: when a strategy helps in one regime and hurts in another, construct discriminating cases and ask what distinguishes the regimes.

Long-term falsifiable metric:
- Track **teacher interventions/calls per successfully solved novel task** as experience grows.
- If accumulated experience does not drive that metric downward, the project is failing at its stated goal even if raw task solve rate improves.

Immediate next gate:
1. Persist teaching traces/lessons into the graph rather than JSON only.
2. Link impasses -> questions -> hypotheses -> experiments -> conclusions -> extracted procedures/concepts.
3. Make Teacher Mode emit a strict structured response matching this schema.
4. Build the first question-selection mechanism from stored teacher strategies.
5. Start recording teacher-intervention cost alongside search cost in episodes/benchmarks.


## v0.0.12 — five-step Teacher Mode foundation completed

### Step 1: graph-native teaching traces
- Teaching traces now materialize as graph-native observation/impasse/question/hypothesis/experiment/conclusion/knowledge structures.
- Extracted teacher strategies are first-class `question_strategy` entities.
- Invalid traces are rejected before graph mutation.

### Step 2: activation utility from experience
- Primitive-vs-learned outcomes can be stored as `utility_evidence`.
- Contextual priors are derived from graph history by task family + program.
- Repeated hard-family savings cause learned activation; repeated easy-family overhead causes abstention without manually injecting the prior.

### Step 3: question-selection faculty
- Added a transparent v0 selector over stored question strategies.
- A previously taught compare-regimes strategy can be selected for a new structurally similar impasse.
- The selector abstains when no strategy matches instead of inventing a question strategy.

### Step 4: structured Teacher adapter
- Added provider-agnostic `TeacherAdapter` + strict `TeachingTrace` parser.
- System contract explicitly tells Teacher Mode to make its own intervention unnecessary.
- Exposes a bounded learner-tool description surface (graph search, program/episode inspection, sandbox run, test proposal, knowledge proposal).
- Prose/malformed outputs are rejected. No provider is hard-coded.

### Step 5: teacher-displacement benchmark v0
- Added a benchmark for **question-selection faculty only**.
- Cold impasse has no stored strategy -> scripted Teacher is called once and teaches `teacher.compare-regimes`.
- Three later structurally similar impasses retrieve/select that strategy without another teacher call.
- This is deliberately scoped evidence: it demonstrates architecture-level displacement of one faculty using a scripted/mock teacher. It does NOT demonstrate frontier-LLM replacement or general teacher displacement.

Immediate next gates:
1. Replace crude keyword matching in question-strategy selection with graph/context structure and measurable held-out strategy selection.
2. Persist actual teacher-call cost/tokens/latency when a real provider is connected.
3. Add a second teacher faculty (hypothesis generation or test/counterexample selection) and test displacement independently.
4. Add Teacher protocol tool execution, not just tool descriptors: provider can inspect graph/programs through bounded read tools before returning a trace.
5. Build a curriculum where teacher intervention declines across multiple faculties while novel-task correctness remains stable.


## v0.0.13 — first real conversational Teacher episode

- Used the current conversational GPT-5.6 Sol instance as the actual outer-loop Teacher rather than a scripted/mock transport.
- Preserved every app/Teacher handoff under `real-teacher-run/`.
- First Teacher proposal (`activation.unknown-prior-probe`) was empirically rejected.
- The validation run also exposed a harness field-name bug; the buggy artifact is preserved and the corrected result is recorded.
- Rejection was handed back to Teacher Mode.
- Teacher revised the strategy to `activation.explore-then-exploit`.
- App validated the revised strategy using real search measurements in harmful and beneficial contexts.
- After two exploration observations per context, graph-derived priors chose the correct single search arm on later tasks without running both arms.
- Accepted reusable Teacher strategy: `teacher.convert-uncertainty-to-exploration`.

This is the first evidence in the repo of a real loop:
`app impasse -> real Teacher proposal -> app experiment -> rejection -> real Teacher revision -> app experiment -> acceptance`.

See `docs/REAL_TEACHER_EPISODE_001.md` for the exact record.

Next unresolved impasse from Teacher:
- how to choose contextual keys for utility transfer without mixing incompatible regimes or overfitting.


## v0.0.14 — Viv-inspired Intent Interpreter + first language Teacher displacement

Implemented:
- Added first-class `Intent` with **signals + goal + constraints + confidence/provenance**.
- Added a small seed/graph phrase-grounding interpreter.
- Added explicit `resolved | clarify | teacher` outcomes; the interpreter does not guess through unknown or conflicting language.
- Added a tiny typed Intent planner that compiles grounded `Multiply` / `Add` relations into portable Blueprint IR using host capabilities.
- Added Intent-native learned-program retrieval. It uses grounded semantics directly and no longer requires hand-authored TaskSpec family/labels for the raw-language fixture.
- Added durable graph phrase groundings and validated `IntentGroundingLesson`s. A bad Teacher mapping is tested in a temporary graph and rejected without poisoning durable knowledge.
- Tightened lexical matching so `address` does not accidentally match `add`; multiple conflicting actions request clarification.

First raw-language check:
`"multiply this number by six"`
- interpreted without TaskSpec labels/family;
- signals: numeric input + constant 6;
- goal: Number;
- constraint: Multiply(input, 6);
- planner emits portable `core.mul_int(input, 6)`;
- input 7 executes to 42;
- learned `abstract.double` is independently retrieved as semantically adjacent scaling knowledge.

First intent-Teacher displacement episode:
- `"twice this number"` initially returned `teacher` because `twice` had no action grounding.
- Current conversational GPT-5.6 Sol Teacher proposed `twice -> Multiply` plus validation examples.
- App validated the lesson before durable commit.
- After commit, `"twice this number"` resolves, plans, and executes `11 -> 22` with no Teacher.
- Five-utterance fixture moved from **4/5 teacher-free (80%) to 5/5 (100%)** after one validated Teacher intervention.
- Wrong `twice -> Add` Teacher proposal is explicitly rejected in tests.

Artifacts:
- `real-intent-teacher-run/01-app-teacher-request.json`
- `real-intent-teacher-run/02-teacher-response.json`
- `real-intent-teacher-run/03-app-validation-and-benchmark.json`
- `docs/ADR-002-viv-inspired-intent.md`

Important limitations:
- This is a deliberately tiny deterministic interpreter, not general NLP.
- Seed phrase mappings are hand-authored bootstrap scaffolding.
- Planner only handles one numeric constraint and a tiny relation set.
- It does not yet use planner feasibility to rerank multiple candidate interpretations.
- It does not yet learn phrase mappings automatically from ordinary successful executions; Teacher lesson validation is explicit.
- `IntentGroundingLesson` temporary validation currently assumes a constructible GraphStore implementation; proper graph transaction/snapshot support should replace this.

Next gates:
1. Multiple interpretation candidates ranked by graph/planner feasibility.
2. Clarification answer -> Intent update -> execution loop.
3. Learn lexical mappings from validated successful episodes/user corrections, not only explicit Teacher lessons.
4. Add compositional language patterns (`X with highest Y`, filters, filesystem concepts) and test against false compositions.
5. Measure teacher-free grounding on a frozen paraphrase/held-out language suite before adding neural ranking.


## v0.0.15 — 30-step language autonomy rip

Completed the thirty milestones documented in `docs/30_STEP_RIP_V001.md`.

Key new capabilities:
- candidate Intent ranking using planner feasibility;
- multi-turn clarification;
- sequential language composition;
- graph-native phrase/relation memory;
- phrase confidence strengthened/weakened by execution outcomes;
- conflict-safe semantic grounding;
- correction-driven learning;
- behavioral inference of relation + implied numeric value;
- automatic language-impasse packaging;
- raw-language controller/session;
- frozen language curriculum with false-execution and Teacher-dependence metrics.

Frozen language curriculum result:
- before autonomous behavioral learning: 5/13 require Teacher;
- after autonomous behavioral learning: 2/13 require Teacher;
- Teacher-free rate after: 84.6%;
- executable correctness after: 9/9;
- false executions: 0;
- autonomously grounded from behavior: `sixfold ×6`, `quadruple ×4`, `decuple ×10`.

Important interpretation:
- This is stronger than merely adding three aliases to the lexicon: the mappings are inferred from behavioral I/O evidence and enter the same graph grounding substrate used by the interpreter.
- It is still a tiny numeric domain. General compositional semantics, objects/collections, reference resolution, tense/context, and open vocabulary remain unsolved.
- The remaining `reverse` case is a real capability/semantic gap; `address` is intentionally adversarial and must remain unresolved rather than false-match `add`.

Next research gates:
1. Planner feedback over genuinely multiple complete candidate parses from raw language, not synthetic candidate fixtures.
2. Graph-grounded concepts for objects/collections/properties (`File`, `Filename`, `Length`, selection/filter relations).
3. Compositional pattern induction from multiple validated utterance/Intent pairs rather than phrase-only learning.
4. Learn clarification/question strategies from dialogue outcomes.
5. Frozen held-out paraphrase families so learned language patterns are tested outside their source wording.
6. Only then consider neural ranking/search if symbolic candidate generation becomes the bottleneck.


## v0.1.0 — first real-world Teacher-displacement milestone

Milestone gate reached: a real filesystem task family now exercises raw language -> Teacher-assisted intent acquisition -> learner synthesis -> held-out execution -> zero-search reuse -> related-task adaptation with lower Teacher dependence.

Exact real Teacher artifacts:
- `real-filesystem-milestone/01-app-to-teacher.json`
- `real-filesystem-milestone/02-teacher-to-app.json`
- `real-filesystem-milestone/03-app-experiment-result.json`

Task 1 — `"find the file with the longest filename in this folder"`:
- before domain knowledge: Intent interpretation -> TEACHER;
- one real GPT-5.6 Sol Teacher intervention teaches a reusable *file-extreme-filename* intent pattern, not executable host code;
- learner validates the pattern on longest + shortest contrast examples;
- learner receives actual folder-path -> expected-filename examples;
- learner independently synthesizes:
  `core.argmax_string_len(fs.list_filenames(folder))`;
- decision: **BUILD**;
- search: **3 candidates, depth 2**;
- untouched folder result correct.

Same learned cognition, new folder:
- decision: **RUN**;
- **0 search candidates**;
- **0 Teacher interventions**;
- correct.

Related unseen raw request — `"find the shortest file name in this directory"`:
- same single learned intent pattern resolves it;
- **0 additional Teacher interventions**;
- longest learned program is not incorrectly RUN;
- learner **ADAPTs** from longest-filename structure and synthesizes:
  `core.argmin_string_len(fs.list_filenames(folder))`;
- search: **4 candidates, depth 1**;
- held-out result correct;
- provenance records `adapted-from:learned.filesystem.longest-filename`.

Safety:
- neighboring unsupported `"find the largest file in this folder"` remains TEACHER rather than being conflated with filename length.
- filesystem I/O remains host machinery; no `findLongestFilename()` host capability exists.

This is the first repository result satisfying the intended v0.1 milestone shape:
1. useful real-world task;
2. first request requires Teacher;
3. Teacher teaches reusable structured knowledge rather than final code;
4. learner builds an executable Blueprint;
5. learned Blueprint generalizes to unseen data;
6. repeated task becomes zero-search RUN;
7. related unseen language needs fewer (zero) Teacher interventions;
8. related executable knowledge is acquired through ADAPT;
9. correctness is maintained and nearby unsupported semantics are not falsely executed.

Caveat:
The domain remains tiny and `core.argmax_string_len` / `core.argmin_string_len` are exact host capabilities. The learned intelligence here is the composition `Folder -> filenames -> select extremum`, intent pattern, reuse/adaptation behavior, and Teacher displacement—not rediscovery of the argmax algorithm itself.


## v0.2.0 — Claude-style falsification pilot

Added an external typed semantic-DAG benchmark layer separate from learner Intent/Blueprint internals, canonical structural hashing, multi-fixture denotation grading, exact/kNN cache baselines, Teacher-OFF checkpoints, test-time learning lockout, artifact knockout, dependency specificity, reuse-depth metrics, and leakage audits.

Pilot result:
- checkpoint 0: 7/13 = 53.8%;
- after one curriculum Teacher intervention: 13/13 = 100%, Teacher OFF;
- exact cache: 2/13;
- token-Jaccard kNN cache: 8/13 with 5 wrong answers;
- learned file-Intent-pattern knockout: 7/13;
- all 6/6 file test items depend on that artifact; dependency precision/recall 1.0/1.0;
- learned file-program knockout produces same 6-task loss;
- structural-compound mini-split: EKG 2/2, kNN 0/2;
- 0 wrong answers from EKG on the pilot.

Integrity failure intentionally recorded:
- lexical-near split has five cross-split 4-gram overlap pairs and exact SF overlap, so it is lexical/paraphrase evaluation only.
- Do not call the overall pilot compositional generalization.
- See `docs/VERDICT_CLAUDE_FALSIFICATION_PILOT.md`.

## v0.3 preregistration freeze — after hostile v0.2 review

No new scientific result is claimed here. v0.2 remains frozen as an integration/falsification pilot.

Added `docs/PREREGISTRATION_V0.3.md` before changing learner behavior. The next decisive experiment is a 3-capability, one-shot Teacher lesson / ~120 independently produced primitive-holdout composition benchmark with Teacher OFF, fair selective-kNN risk/coverage comparison, lesson-withheld and seed-only controls, durable-state/MDL measurements, and an A–E knockout/recovery protocol.

Corrected research interpretation:
- six file held-outs sharing one learned intent dependency are one acquired capability observed six times, not six independent learning events;
- v0.2 lexical-near items are not compositional evidence;
- forced-choice kNN vs abstaining EKG was not a fair calibration comparison;
- the old 3.33 artifact ratio is retired;
- growth is measured conditional on semantic novelty: linear storage of genuinely new concepts is not itself cache behavior; one task-specific artifact per novel composition of known semantics is the failure signature.

Added durable Blueprint uniqueness invariant: exact canonical-semantic duplicates cannot accumulate. Duplicate synthesis must reuse the existing Blueprint and is treated as a retrieval/planning miss diagnostic.

Repository agent convention is now `AGENTS.md` canonical with `CLAUDE.md -> AGENTS.md` symlink.

## v0.3 implementation — primitive-holdout protocol foundation

Implemented protocol machinery without authoring or inspecting scored held-out items:
- one-shot `PrimitiveLessonLedger` rejects a second lesson for the same capability and records Teacher-token cost/provenance;
- checkpoint-0 capability-absence audit mechanically rejects capabilities already present in the runtime registry;
- multi-fixture denotation grader requires >=3 fixtures and gives item credit only when every fixture passes;
- Teacher-OFF guard fails closed and records any attempted Teacher call;
- durable executable-state measurement records program count, canonical serialized bytes, canonical structural node count, and unique canonical semantics for growth curves;
- canonical duplicate Blueprints remain deduplicated by the existing program-library invariant.

Evidence:
- full suite: **117/117 passing**;
- frozen `benchmark:v0` unchanged: double BUILD, repeat RUN, triple ADAPT, unsupported reverse-string TEACH;
- negative/adversarial coverage includes second-lesson rejection, too-few-fixtures rejection, present-capability detection, duplicate-program non-growth, and attempted Teacher-call failure.

Scientific limitation:
- this is experiment infrastructure, not a v0.3 result;
- no scored primitive-holdout utterances or gold denotations were authored here;
- capability selection, external item ingestion, independent gold/reference semantics, split/novelty audit, and the actual scored conditions remain outstanding.

## v0.3 external-item/reference-gold pipeline milestone (2026-08-16)
- Added `src/benchmarks/external-items.ts` as the scored-item ingestion boundary.
- Scored holdout items carry explicit external corpus/record provenance and cannot contain authored gold denotations.
- Gold is derived only by an injected, provenance-tagged executable reference semantics implementation over >=3 fixtures.
- Frozen benchmark manifests are deterministic and tamper-evident via a stable integrity fingerprint covering language + gold.
- Added conservative provenance audit that rejects EKG/Teacher/self-authored scored items.
- Added validation for duplicate item/fixture IDs and insufficient fixture sets.
- This milestone contains **no held-out benchmark items and no scientific result**; it only makes the independence requirement mechanically enforceable before external data is imported.
- Full suite: **121/121 tests passing**.


## v0.3.3 — primitive selection + external-corpus mapping freeze
- Froze exactly three candidate semantic primitives **before importing scored held-out utterances**: `predicate.within_closed_int_window`, `predicate.string_contains`, and `logic.negate_predicate`.
- Added mechanical selection audits against checkpoint-0 host capability IDs/aliases and durable program IDs/aliases. A candidate that already exists is rejected rather than quietly counted as one-shot learning.
- Every candidate requires >=40 novel compositions and at least one external-corpus mapping rule.
- Mapping rules point at NL2Bash provenance/selection criteria only; no scored utterance or gold answer is copied into the repository at this stage.
- Negative tests prove selection fails for an existing capability, pre-existing durable task-family knowledge, fewer than three primitives, and insufficient held-out composition budget.
- **No experiment result is claimed.** This milestone freezes what will be tested without letting scored examples influence primitive choice.


## v0.3.4 — experiment runner + protocol freeze
- Added a deterministic v0.3 experiment protocol freeze keyed to the v0.3.3 primitive-selection hash.
- Frozen primary conditions: post-lesson EKG, lesson-withheld EKG, checkpoint-0 synthesis control, and selective k-NN. All primary scored conditions are Teacher-OFF.
- Production binding requires benchmark integrity/provenance checks, only the three preselected primitives, >=40 items per primitive, >=4 semantic families per primitive, and >=3 fixtures per item.
- Added hard per-item search budget, confidence validation, mutually exclusive outcome accounting, risk/coverage + AURC when confidence is available, FCER, search cost per solved item, per-primitive accuracy, and durable-state before/after deltas.
- Added a smoke-only binding mode so runner correctness can be tested without pretending developer-authored fixtures are scientific evidence. Production mode remains strict.
- Added `benchmark:v0.3-protocol`, which emits the frozen selection/protocol hashes while importing **zero scored held-out items**.
- Negative tests prove underpowered production sets, surprise primitives, missing conditions, and any Teacher call during scored evaluation fail closed.
- **Still no scientific result:** v0.3.4 freezes the instrument; the next step is independent corpus extraction/review, reference fixtures, final benchmark binding, then the scored run.

## v0.3.5 — external-corpus supply gate

Added a deterministic NL2Bash paired-corpus intake/audit path. It discovers candidate records from the external Bash command rather than EKG-authored utterance labels, preserves original line identity, and fails closed unless each frozen primitive has at least the preregistered 40 candidate records. Candidate discovery is explicitly **not scored evidence**: candidates still require independent semantic-family review, fixture construction, derived reference gold, freeze/bind, and only then Teacher-OFF evaluation.

This milestone also makes an important protocol constraint executable: if the chosen external corpus cannot supply 40 independently sourced compositions for any frozen primitive, v0.3 must stop/reselect rather than padding the benchmark with self-authored examples.

## 2026-08-16 — v0.7.0 education + structured-world milestone
- Project gospel switched development emphasis from zero-shot purity to lifelong education.
- Recursive JSON/object values added to the IR/value universe.
- Portable object primitives include parse/type/keys/get/has plus string split/list access building blocks.
- Bounded process execution and Bash added as explicit effectful host capabilities.
- EKGBench added with all 20 bAbI prerequisite families and personal object milestones.
- OBJECT-001 passes; dot-path and variable-depth path milestones intentionally remain red.
- 154/154 tests pass.

## 2026-08-16 — v0.8.3 lived-experience recovery
- Added durable execution-experience traces for learned programs and host capabilities, retaining successes and failures with inputs/results/errors, types, caller stack, call site, and surrounding caller Blueprint.
- Self-healing learned programs now fall back from canonical graph snapshot restoration to reconstruction from historical successful usages.
- Reconstruction uses historically observed capability/program neighborhoods to constrain synthesis before any broader fallback.
- Reconstructed programs are validated against remembered successful usages and persisted back into durable graph memory with explicit provenance.
- Added regression coverage proving recovery after deleting both the live program and all executable snapshots.

## 2026-08-18 — v0.9.5 persistent local brain
- Added `FileBrain`, a zero-service local persistence wrapper around the in-process graph, program library, execution experience, and controller episode stores.
- Brain state is atomically written to one ordinary JSON file (`ekg-data/brain.json` by default) and loaded automatically at startup.
- Native/host capability implementations remain runtime infrastructure and are reconstructed from the host; acquired graph/program/experience state persists.
- Added a real two-process restart test: process A teaches a novel executable procedure and records experience; process B starts fresh from the same brain file, Teacher OFF, restores the procedure/graph identity/history, executes it successfully, and continues episode numbering.
- This corrected earlier misuse of "durable" for state that had only been RAM-resident.

## 2026-08-18 — v0.9.6 EKG CLI + terminology cleanup
- Standardized active system terminology on **EKG** across code, tests, benchmark/API names, and current docs. The practical capability pack is `ekgCapabilities()` and the developmental report card is `EKGBench`.
- Added `npm run ekg`, a persistent local REPL backed by `FileBrain`.
- CLI supports typed input prompting and inline `utterance :: [inputs]` syntax, plus `/brain`, `/capabilities`, `/programs`, `/experience`, `/run`, `/teach synonym`, `/teacher`, `/save`, and `/exit`.
- New brains install the portable substrate + starter English curriculum exactly once via a graph bootstrap marker.
- Added a direct language-planning path from learned lexical grounding to acquired `ProgramBlueprint` calls when signatures match; learned procedures can therefore participate in language execution rather than only synthesis/reuse.
- Added negative parsing/type tests, CLI process tests, persisted synonym teaching across restart, typed prompt tests, and learned-language program-call tests.
- Full fast suite: **186/186 passing**.
- Frozen v0.1 report remains 4/5 held-out solved vs 0/5 memorize baseline.
- Search v2 historical `16x` guard rerun: legacy ~6.40s vs v2 ~120ms in the final v0.9.6 run (~53.2x), 7,204 scored legacy candidates vs 208 behaviorally distinct v2 candidates.

## 2026-08-19 - v0.9.7 LadybugDB durable graph backend + audit fixes

### Audit
- Comprehensive v0.9.6 audit performed: 16 findings documented in `docs/AUDIT_V0.9.6.md`.
- All critical and UX issues addressed in this release.

### LadybugDB integration
- LadybugDB (maintained Kuzu fork, `@ladybugdb/core`) is now the preferred embedded graph backend.
- `GraphStore` interface widened with `snapshot()` and optional `sandbox()`.
- `Brain` interface introduced - both `FileBrain` (JSON) and `LadybugBrain` (.lbdb) implement it.
- Auto-detection: uses LadybugDB when available, falls back to FileBrain if not.
- Auto-migration: existing `brain.json` migrates to `.lbdb` on first launch when native module present.
- CLI `--backend memory|ladybug|auto` flag and `EKG_GRAPH_BACKEND` env var.
- Platform-specific native module fallback (`@ladybugdb/core-{platform}-{arch}`).
- `grounding-lesson.ts` sandbox hack replaced with proper `sandbox()` interface method.

### Cypher pushdown optimizations
- `activeTriples()` uses Cypher `MATCH (f:EKGEntity) WHERE f.kind='fact'` when backend supports it.
- `deriveWorldFacts()` caches triple results per round instead of O(n^2) repeated scans.
- `experienceEntities()` uses promoted `subjectId` column for indexed episode lookups via Cypher.

### Seed brain
- `ekg-data/seed-brain.json` ships with the repo: pre-installed English curriculum + portable substrate.
- Fresh brains load from seed for instant language understanding on first run.
- Both `FileBrain` and `LadybugBrain` check for seed.

### Audit quick fixes
- SIGINT handler saves brain on Ctrl+C.
- Debounced `FileBrain` saves (dirty flag + 25ms timer) - eliminates 200+ file rewrites during bootstrap.
- Synonym overwrite guard prevents ambiguating existing grounded forms.
- `/exit` works during input prompts and clarification loops.
- Ghost LadybugDB doctrine references cleaned up and replaced with real integration.

### Evidence
- Full fast suite: **190/190 passing, 0 skipped** (with native module installed).
- LadybugDB integration test: real embedded round-trip with persistence across process restart.
- Auto-migration tested: JSON brain -> LadybugDB with synonym preservation.
- Search v2 benchmark unchanged.
