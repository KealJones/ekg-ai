# EKG-AI v0.9.6 Audit

## Does it work?

**Yes, fundamentally.** 186/186 tests pass. Build is clean. CLI runs, executes natural language, teaches synonyms, persists across restarts, and the learning/reuse pipeline works as advertised. EKGBench and Search v2 benchmarks produce claimed results. The core `RUN -> ADAPT -> BUILD -> TEACH` loop is real and demonstrated. Synonym teaching persists and works across process restarts. This is a legitimate research prototype with real evidence behind its claims.

---

## Where are the gaps?

### Critical Issues

**1. Ghost infrastructure: LadybugDB**
CLAUDE.md has a "Graph backend doctrine" section directing readers to `docs/LADYBUGDB.md` and calling LadybugDB "the preferred embedded durable backend." That file doesn't exist. Zero LadybugDB code anywhere. Recent commit `b41c5f1` claims "Search v2 and LadybugDB durable brain" but only Search v2 shipped. The doctrine references should be removed or the work actually done.

**2. Dual experience stores (dead code path)**
`SelfHealingProgramLibrary.recordExperience` (`resilience.ts:133`) writes execution experiences as graph entities. But `MemoryProgramLibrary` also has its own `recordExperience` (`program-library.ts:75`) writing to an internal Map. The CLI only uses the graph path - `brain.programs.experiences` is always empty (confirmed: 0 entries vs 7 graph entities after real usage). This violates the project's own single-source-of-truth principle. The `/experience` command (`ekg-cli.ts:180`) merges both sources to cover this split, which is a smell.

**3. Save-on-every-mutation (FileBrain)**
Every `putEntity`, `putRelation`, `recordExperience` triggers a full JSON serialize + write + rename of the entire brain (`brain.ts:29`). During bootstrap alone that's 200+ full file rewrites. At 264KB now it's tolerable (~879ms cold start), but this is O(mutations x fileSize) and will hurt long before the graph reaches thousands of entities. Needs debounced/batched saves.

**4. No SIGINT handler**
`Ctrl+C` kills the process without saving. No `process.on("SIGINT", ...)` anywhere. Brain state accumulated since last explicit `/save` or `/exit` is lost.

### Architectural Concerns

**5. Graph store has no indexes**
`MemoryGraphStore.outgoing/incoming/relationsByKind/entitiesByKind` are all full linear scans (`graph.ts:32-41`). Plus every read does `structuredClone`. With 400 entities this is fine. With 10K+ it'll be visible. The inference engine (`world-language.ts:207-238`) calls `activeTriples(graph)` inside nested loops - O(rounds x rules x premises x facts^2).

**6. Search v2 per-candidate graph scan**
`historicalWeight()` (`synthesizer.ts:145`) calls `programs.experiencesFor(id)` for every synthesis candidate. Via `SelfHealingProgramLibrary`, that's a full `entitiesByKind("episode")` scan per call. During search with hundreds of candidates, this means hundreds of full graph scans on the hot path. Should be cached per synthesis run.

**7. Behavioral pruning completeness gap in Search v2**
`synthesizeV2` (`synthesizer.ts:249-261`) uses observational equivalence to prune candidates - two expressions with identical I/O on the observation inputs are treated as interchangeable. But a correct candidate can be evicted by a cheaper incorrect one if they agree on observation rows but disagree on property assertions. The evicted correct candidate is never regenerated. Worth an adversarial test per the project's own testing doctrine.

**8. Brain schema has no migration path**
`brain.ts:64` throws hard if `format !== "ekg-brain" || version !== 1`. Any future schema change needs a migration, but none exists. Orphaned `.tmp` files from crashes are never cleaned up.

### Usability Gaps

**9. CLI synonym teaching requires exact known single lexeme**
`/teach synonym triple = multiply by three` fails because `multiply by three` isn't a single lexical form. Only single known words work as the RHS. No error message explains what known forms are available. A `/vocabulary` command showing teachable base forms would help.

**10. No learned programs from normal CLI use**
Despite successful execution of 7+ utterances, `Learned programs: 0`. The intent planner creates transient `ProgramBlueprint`s for each execution but doesn't persist them into the program library. Repeated identical utterances re-plan from scratch every time instead of building up a reusable program library from conversational use. The learning loop (controller's `BUILD` path) is only exercised through the test/benchmark pathway, not the CLI's language controller.

**11. Experience entity growth is unbounded**
Every capability call and program call during execution creates a graph entity. Normal use generates 3-4 experience entities per utterance. With no pruning, compaction, or summary mechanism, the brain file will grow steadily. At 7 experiences = ~264KB, extrapolate 1000 utterances = ~40MB+ of brain JSON being serialized on every mutation.

### Bugs Found (CLI edge-case testing)

**15. `/exit` not honored during input prompt**
When an utterance needs a runtime input not supplied inline (e.g. `double this number` with no `::`), the CLI prompts `input[0] (int)>`. Typing `/exit` at that prompt is treated as a JSON parse attempt and fails (`Unexpected token '/'... is not valid JSON`) instead of cancelling/exiting. No way to bail out of an input prompt.

**16. `/teach synonym` can silently corrupt an already-grounded word**
`/teach synonym double = add` succeeds even though `double` is already grounded to Multiply-by-2. Afterward, `double this number :: [5]` - which previously returned 10 - breaks with a "multiple requested actions (Multiply, Add)" clarification prompt that itself fails. Teaching a new synonym can silently ambiguate/break a previously-working word with no warning and no undo. Should reject or warn when the new form already has a grounded sense.

### Testing Gaps

**12. No test coverage measurement** - no `c8`/Istanbul wired up. 186 tests sounds good but we don't know what % of `src/` is exercised.

**13. No test for corrupted brain.json** - `FileBrain.read()` assumes valid JSON. Truncated/corrupt file = crash with no recovery option.

**14. Missing adversarial test for Search v2 behavioral pruning** (finding #7 above).

---

## How could it improve?

### Near-term (high impact, low effort)

1. Add SIGINT handler to save brain on Ctrl+C
2. Debounce `FileBrain.save()` - batch mutations, flush on idle/exit
3. Cache `historicalWeight` lookups per synthesis run
4. Remove or update LadybugDB references from CLAUDE.md
5. Consolidate experience stores - pick graph entities and delete the dead `MemoryProgramLibrary.experience` path

### Medium-term

6. Add simple graph indexes (outgoing-by-from, incoming-by-to, entities-by-kind maps) to `MemoryGraphStore`
7. Persist intent-planned programs as learned programs after successful execution, so the CLI actually builds up its program library
8. Add brain schema migration support
9. Add `/vocabulary` command and better teaching UX
10. Wire up test coverage tooling

### Longer-term

11. Experience compaction/summarization to bound brain growth
12. Implement a real graph backend (even SQLite would be a huge step up from JSON-in-RAM)
13. Move inference engine to iterative with indexed fact retrieval instead of repeated full scans
