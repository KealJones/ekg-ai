# Current handoff status

## Version
v0.0.8

## Test status
- Full suite: 34/34 passing.
- Negative/adversarial correctness suite is mandatory via `CLAUDE.md`.

## Frozen baseline
- Frozen v0.1 held-out learner: 4/5 solved.
- Exact memorize baseline: 0/5.
- Held-out search candidates: 25.
- Unsupported reverse-string task remains a deliberate TEACH/capability-gap case.

## First measured abstraction result
End-to-end, without hand-specifying the mined abstraction:

1. Independent primitive-only learner run synthesizes `3x`.
2. Separate independent primitive-only learner run synthesizes `4x`.
3. Exact-subgraph miner finds shared `2x` structure.
4. Separate validation task `6x` decides whether it should be promoted.
5. Untouched final task `8x` is evaluated only after the decision.

Results:
- Validation: 99 -> 86 candidates; solve rate unchanged; promotion accepted.
- Final untouched: 434 -> 82 candidates; solve rate unchanged.
- Search savings on untouched final task: 352 candidates (~81.1%).

Negative control:
- Frequent `max(x,x)` abstraction increases held-out search 9 -> 21 and is rejected.

## Important lesson
Blindly prioritizing an entire learned library is harmful. A temporary implementation did this and regressed the frozen held-out search from 25 -> 47 candidates. It was reverted.

Learned-first search is now explicit and should only be used for a small relevance-filtered/retrieved set. Scalable retrieval/ranking is therefore a genuine next research requirement, not optional polish.

## Immediate next gates
1. Candidate selection over multiple mined abstractions, not only top recurrence.
2. Add validation-family multiplicity to reduce overfitting to one validation task.
3. Add demotion/regression when a promoted abstraction becomes harmful under a changed distribution.
4. Introduce graph/context metadata for retrieval, then compare:
   - capabilities-first;
   - type-only learned retrieval;
   - graph/context retrieval;
   - eventually neural ranking.
5. Keep the final test split untouched by promotion decisions.


## v0.0.9 retrieval finding
A first explicit non-neural retriever now hard-filters by type and ranks compatible learned procedures using contextual metadata and local usage/centrality signals.

Tiny stress fixture (13 compatible learned programs, held-out `3x`):
- primitive-only: 5 candidates
- blind whole learned library first: 238 candidates
- retrieve top contextual procedure (`abstract.double`) then learned-first: 10 candidates

Interpretation: retrieval prevents most library explosion but should abstain on trivial tasks where primitives are cheaper. The next component is therefore an **activation/cost policy**, not a more elaborate retriever.


## v0.0.10 activation finding
Retrieval and use are now separate decisions. An offline oracle labels primitive-vs-learned measured outcomes, and a conservative online policy can abstain.

Known regimes:
- easy `3x`: 5 primitive candidates vs 10 with retrieved `double` => abstain.
- hard `8x`: 434 primitive candidates vs 82 with `double` => activate.

Next: store those measured utilities as graph/episode evidence so the system derives its own contextual activation priors rather than receiving them as inputs.


## v0.0.11 methodology decision: teach how to teach
Teacher reasoning is now first-class data. Do not directly implement a cognitive strategy once the learner can reasonably be made to discover it. Pose problems, capture impasses, ask discriminating questions, preserve hypotheses/counterexamples/results, extract reusable learner knowledge *and teacher-question strategies*, then measure whether future teacher intervention decreases.

First backfilled trace: `teaching/teach.activation.001.json`.
Primary long-term metric: teacher interventions per successfully solved novel task.


## v0.0.12 — Teacher Mode foundation
All five planned Teacher Mode groundwork steps are now implemented.

Current displacement claim is intentionally narrow: a scripted Teacher teaches one `compare-regimes` question-selection strategy on a cold impasse; three later structurally similar impasses select it from graph knowledge with zero additional teacher calls. Treat this as a test of the replacement plumbing, not a claim that an LLM faculty has been learned yet.

Next high-value work: real bounded learner tools for Teacher, then a second independently measurable faculty (hypothesis/test selection), followed by an actual provider-backed experiment when credentials/provider choice are available.


## v0.0.14 — Intent front door
The old hand-authored retrieval metadata is no longer the only route from a task to learned knowledge. A raw utterance can now become `Intent(signals, goal, constraints)`, plan through host capabilities, and retrieve related learned Blueprints.

Key fixture: `"multiply this number by six"` -> Multiply(input,6) -> executable portable plan -> 42 for input 7, with no manually supplied TaskSpec family/labels.

One real Teacher grounding (`twice -> Multiply`) increased the current five-utterance teacher-free language fixture from 80% to 100%. This is tiny but is the first direct demonstration of the intended replacement loop at the language boundary.


## v0.0.15 — 30-step language autonomy run
See `docs/30_STEP_RIP_V001.md`.

Most important new result: the frozen 13-case language curriculum drops from 5 Teacher-required cases to 2 after the learner infers and stores three new phrase groundings from behavioral examples. After learning: 9/9 executable tasks correct, 0 false executions, 84.6% Teacher-free over the whole mixed suite.

Do not interpret this as general language understanding. The next serious expansion should be object/property/collection Intent structure and learned compositional patterns, not adding dozens of hand-coded English phrases.


## v0.1.0 milestone reached
The first real-world end-to-end Teacher-displacement task family now passes.

Longest filename:
- one real Teacher intervention for reusable Intent grounding;
- learner BUILDs `argmax_string_len(list_filenames(folder))` in 3 candidates / depth 2;
- correct on untouched folder.

Repeat longest:
- RUN, 0 search, 0 Teacher.

Related shortest:
- 0 Teacher;
- ADAPT from longest;
- `argmin_string_len(list_filenames(folder))`;
- 4 candidates / depth 1;
- correct held-out result.

See `real-filesystem-milestone/` and the v0.1.0 section of `docs/PROGRESS.md`.
