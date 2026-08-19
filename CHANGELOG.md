# Changelog

All notable changes to EKG-AI are documented here. For detailed research notes, evidence, and experimental results, see [`docs/PROGRESS.md`](docs/PROGRESS.md).

## v0.9.8 - 2026-08-19

### CLI learns from use
- Successfully executed utterances are now persisted as durable learned programs with full graph identity (concept, capability, program entities with Blueprint snapshots).
- Repeated identical utterances RUN the existing program directly instead of re-planning from scratch.
- THEN-composed programs persist as single learned procedures and survive restart.
- `/export-seed` CLI command exports current brain as a version-controlled seed brain.

### bAbI connected to EKGBench
- WorldLanguageEngine wired to EKGBench as a real QA agent. bAbI 1-5 now pass (was 0/20).
- EKGBench v0.2: color output with per-probe pass/skip/fail, real answers displayed.
- Bootstrap now installs world-language grammar (location, possession, spatial, giving) alongside the lexicon.

### Expanded vocabulary
- Semantic catalog expanded with conversational phrases for all existing relations.
- 12 new filesystem capability descriptors (list, read, write, exists, basename, dirname, ext, join, cwd, env).
- Starter lexicon doubled from ~104 to ~248 lexemes.

### Seed brain v2
- Regenerated with full grammar: 721 entities, 248 lexemes, 11 grammar rules, 1 inference rule.

### Evidence
- 190/190 tests passing.
- EKGBench: 5/20 bAbI passing, 14 abstained (awaiting grammar), 1 wrong (coreference). 1/3 object milestones.

## v0.9.7 - 2026-08-19

### LadybugDB integration
- LadybugDB (maintained Kuzu fork, `@ladybugdb/core`) is now the preferred embedded graph backend.
- `Brain` interface introduced - both `FileBrain` (JSON) and `LadybugBrain` (.lbdb) implement it.
- Auto-detection: uses LadybugDB when available, falls back to FileBrain.
- Auto-migration: existing `brain.json` migrates to `.lbdb` on first launch when native module present.
- CLI `--backend memory|ladybug|auto` flag and `EKG_GRAPH_BACKEND` env var.

### Seed brain
- `ekg-data/seed-brain.json` ships with the repo containing baseline English curriculum.
- Fresh brains load from seed for instant language understanding on first run.

### Cypher pushdown optimizations
- `activeTriples()` uses Cypher `MATCH` when backend supports it.
- `deriveWorldFacts()` caches triple results per round instead of O(n^2) repeated scans.
- `experienceEntities()` uses promoted `subjectId` column for indexed episode lookups.

### Audit fixes
- SIGINT handler saves brain on Ctrl+C.
- Debounced `FileBrain` saves (dirty flag + 25ms timer) - eliminates 200+ file rewrites during bootstrap.
- Synonym overwrite guard prevents ambiguating existing grounded forms.
- `/exit` works during input prompts and clarification loops.

### Evidence
- 190/190 tests passing.
- Search v2 `16x` guard: legacy ~6.40s vs v2 ~120ms (~53.2x faster).

## v0.9.6 - 2026-08-18

### EKG CLI
- Added `npm run ekg`, a persistent local REPL backed by `FileBrain`.
- CLI supports typed input prompting and inline `utterance :: [inputs]` syntax.
- Commands: `/brain`, `/capabilities`, `/programs`, `/experience`, `/run`, `/teach synonym`, `/teacher`, `/save`, `/exit`.
- New brains install portable substrate + starter English curriculum via graph bootstrap marker.

### Terminology cleanup
- Standardized active system terminology on **EKG** across code, tests, benchmark names, and docs.

### Language planning
- Direct language-planning path from learned lexical grounding to acquired `ProgramBlueprint` calls when signatures match.
- Learned procedures can participate in language execution, not only synthesis/reuse.

### Evidence
- 186/186 tests passing.

## v0.9.5 - 2026-08-18

### Persistent local brain
- `FileBrain` zero-service local persistence: graph, program library, execution experience, and controller episodes in one JSON file.
- Brain state atomically written and loaded automatically at startup.
- Two-process restart test: process A teaches, process B restarts from same brain file (Teacher OFF), restores procedure/graph/history, executes successfully.

## v0.8.3

### Lived-experience recovery
- Durable execution-experience traces for learned programs and host capabilities, retaining successes and failures.
- Self-healing falls back from canonical snapshot restoration to reconstruction from historical successful usages.
- Reconstruction uses historically observed capability/program neighborhoods to constrain synthesis.
- Reconstructed programs validated against remembered successful usages with explicit provenance.

## v0.8.2

### Self-healing learned capability chains
- Learned abilities retain a validated executable Blueprint snapshot in durable graph memory.
- `SelfHealingProgramLibrary` reconstructs missing live programs from graph-native memory.
- `runProgramResilient()` performs dependency-health pass before execution.
- When no durable implementation exists or revalidation fails, execution stops with explicit dependency diagnosis.

## v0.8.0

### EKGBench school: graph-native facts and learned grammar
- bAbI-style developmental suite treated as curriculum, not zero-shot exam.
- Graph-native world facts plus durable symbolic grammar rules.
- Teaching two reusable rules turns bAbI-01 green while multi-fact tasks remain red.
- Multi-hop education: possession relation + general graph inference rule (`possesses(holder, item) AND located_in(holder, place) -> located_in(item, place)`).
- Generic inference engine over graph-stored binary Horn-style rules - answers are not hard-coded.

## v0.7.2

### Teacher School and durable competence
- `TeacherSchool` teaches lexical curriculum, synonyms, and validated executable programs.
- Successful executable lessons enter the program library and receive durable learned-capability identity in the graph.
- Teacher impasse context exposes the learner's actual registered capability catalog.

## v0.7.1

### Semantic language graph
- Language knowledge is graph-native rather than a hard-coded intent dictionary.
- English forms represented as lexemes with one or more senses; senses express semantic relations; relations denote concepts; concepts grounded by typed executable capabilities.
- Synonyms share semantic groundings, antonyms are explicit graph relations, polysemous forms retain multiple senses.
- Starter English vocabulary treated as Teacher curriculum.

## v0.7.0

### Education + structured-world milestone
- Project gospel switched development emphasis from zero-shot purity to lifelong education.
- Recursive JSON/object values added to the IR/value universe.
- Portable object primitives: parse/type/keys/get/has plus string split/list access.
- Bounded process execution and Bash as explicit effectful host capabilities.
- EKGBench added with all 20 bAbI prerequisite families and personal object milestones.

## v0.3.x

### Primitive-holdout protocol
- Preregistered experiment with frozen primitives, external-corpus supply gates, and Teacher-OFF scored conditions.
- Deterministic experiment runner, benchmark integrity/provenance checks.
- See [`docs/PREREGISTRATION_V0.3.md`](docs/PREREGISTRATION_V0.3.md) for the full protocol.

## v0.2.0

### Claude-style falsification pilot
- External typed semantic-DAG benchmark layer.
- Canonical structural hashing, multi-fixture denotation grading, exact/kNN cache baselines.
- Teacher-OFF checkpoints, test-time learning lockout, artifact knockout, dependency specificity.
- See [`docs/VERDICT_CLAUDE_FALSIFICATION_PILOT.md`](docs/VERDICT_CLAUDE_FALSIFICATION_PILOT.md).

## v0.1.0

### First real-world Teacher-displacement milestone
- Real filesystem task family: raw language -> Teacher-assisted intent -> learner synthesis -> held-out execution -> zero-search reuse -> adaptation with lower Teacher dependence.
- One Teacher intervention teaches reusable intent pattern; learner independently synthesizes `core.argmax_string_len(fs.list_filenames(folder))`.
- Related unseen request ("shortest file name") adapts from longest-filename structure with zero additional Teacher interventions.

## v0.0.14

### Viv-inspired Intent Interpreter
- First-class `Intent` with signals + goal + constraints + confidence/provenance.
- Seed/graph phrase-grounding interpreter with explicit resolved/clarify/teacher outcomes.
- Durable graph phrase groundings and validated grounding lessons.
- First intent-Teacher displacement: `"twice this number"` grounded after one validated Teacher intervention.

## v0.0.15

### 30-step language autonomy
- Candidate Intent ranking using planner feasibility.
- Multi-turn clarification, sequential language composition, graph-native phrase memory.
- Correction-driven learning, behavioral inference of relation + implied numeric value.
- Teacher-free rate: 84.6% (up from initial 61.5%).

## v0.0.11 - v0.0.13

### Teacher Mode as research data
- Serializable `TeachingTrace` schema with full observation/impasse/hypothesis/experiment chain.
- Structured Teacher adapter with strict response parsing.
- Teacher-displacement benchmark: cold impasse teaches one strategy, three later impasses retrieve it without Teacher.
- First real conversational Teacher episode using GPT-5.6 Sol as outer-loop Teacher.
- See [`docs/REAL_TEACHER_EPISODE_001.md`](docs/REAL_TEACHER_EPISODE_001.md).

## v0.0.8 - v0.0.10

### Abstraction transfer + retrieval activation
- End-to-end three-stage abstraction benchmark: discovery -> validation -> final untouched test.
- Mined `2x` abstraction reduces untouched `8x` search from 434 to 82 candidates.
- Non-neural `retrievePrograms` layer with type contracts as hard retrieval gate.
- Retrieval activation/abstention policy: easy tasks use primitives, hard tasks activate learned-first search.

## v0.0.1 - v0.0.7

### Foundation
- Language-neutral typed Blueprint IR with reference interpreter.
- TypeScript and Rust backend execution.
- `LearnerController` with `RUN -> ADAPT -> BUILD -> TEACH` flow.
- Portable `ProgramLibrary`, `EpisodeStore`, `GraphStore`.
- Enumerative synthesis with learned-program callable units.
- Abstraction mining and measured promotion experiments.
- Frozen benchmark suite with memorize-only baseline.
- See `docs/PROGRESS.md` for detailed per-version evidence.
