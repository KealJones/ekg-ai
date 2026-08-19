# CLAUDE.md

## Quick orientation for new sessions

EKG-AI is a lifelong-learning system where knowledge lives in a graph, not in model weights. It understands language by looking up word meanings in its lexicon graph, executes typed programs composed from host capabilities, and learns from every interaction.

**Start here:**
1. `pnpm ekg` - run the CLI (no build needed, uses tsx)
2. `pnpm test` - 194 tests (builds first)
3. `pnpm run benchmark:ekg` - developmental report card (13/20 bAbI, 1/3 object milestones)

**Key architecture files to read first:**
- `src/cli/ekg-cli.ts` - the CLI entry point and main execution flow. `executeUtterance()` is the heart: semantic parser -> fallback to legacy intent system -> Teacher escalation
- `src/intent/semantic-parser.ts` - unified parser that classifies tokens by graph-backed word senses and infers sentence structure. Replaces template matching
- `src/intent/semantic-dispatch.ts` - routes parsed utterances to fact operations (assert/query) or capability execution (plan/run)
- `src/intent/token-classifier.ts` - classifies each token as action/entity/value/question/negation/structural/conversational using lexicon lookup + fuzzy matching
- `src/intent/lexicon.ts` - the lexicon graph: lexeme -> sense -> relation. `lexicalSensesForText()` and `contextualLexicalSensesForText()` are the core word-lookup functions
- `src/intent/planner.ts` - compiles Intent constraints into typed ProgramBlueprint IR for execution
- `src/language/world-language.ts` - world facts, inference engine (Horn-clause forward chaining), grammar rules (legacy, being replaced by semantic parser)
- `src/brain.ts` - `Brain` interface, `FileBrain` (JSON), `openBrainWithBackend()` factory
- `src/graph/ladybug-brain.ts` - `LadybugBrain` (embedded Cypher DB)
- `src/graph/graph.ts` - `GraphStore` interface, `MemoryGraphStore`
- `src/graph/ladybug.ts` - `LadybugGraphStore` with OpenCypher
- `src/cli/teacher-transport.ts` - LLM Teacher integration (Claude/ChatGPT CLI). Returns structured lessons: groundings, capability mappings, blueprints, facts, synonyms

**How language flows through the system:**
```
utterance
  -> tokenize + fuzzy-match to lexicon (token-classifier.ts)
  -> classify tokens by sense: action/entity/value/question/etc
  -> infer sentence structure (semantic-parser.ts)
  -> dispatch:
     fact-assert ("Ava went to the kitchen") -> assertWorldFact
     fact-query ("Where is Ava?") -> queryLatestWorldFact
     capability-command ("multiply seven by three") -> planIntent -> runProgram
     conversational ("hi!") -> greeting response
     unresolved -> legacy intent system -> Teacher (LLM) with structured learning
```

**How the Teacher teaches:**
When EKG can't handle an utterance, it asks the Teacher (Claude/ChatGPT via CLI). The Teacher returns structured JSON with:
- `answer` - direct response to show the user
- `groundings` - word meanings to add to the lexicon
- `capabilityMappings` - words that should invoke specific host capabilities
- `blueprints` - complete executable programs (validated before storage)
- `facts` - static world knowledge
- `synonyms` - word equivalences

Each lesson is validated and committed to the graph. The key metric: **teacher calls per novel task should decrease as knowledge accumulates**.

**Seed brain:** `ekg-data/seed-brain.json` ships with the repo (~4200 entities, 1100 lexemes from WordNet, 28 grammar rules, 3 inference rules). Fresh brains load from this. Update seed with `/export-seed` in the CLI after teaching sessions.

## Project intent
This repository experiments with **Executable Knowledge Graph Intelligence**: portable learned procedures + explicit evidence/knowledge, with the goal of reducing search and external teacher dependence over time.

Do not optimize for impressive demos. Optimize for falsifiable evidence that learning, reuse, abstraction, and transfer actually work.


## CURRENT PROJECT GOSPEL - READ THIS BEFORE OVERTHINKING

`docs/PROJECT_GOSPEL.md` is the current north-star doctrine and overrides older development instincts that treated zero-shot benchmark purity as the main product goal.

- EKG is **not an LLM** and is not expected to possess knowledge with zero training.
- Learning machinery may bootstrap; knowledge/understanding must be taught and accumulated.
- Expected-red developmental tests are desirable. Do not contort the architecture merely to keep them scientifically pristine.
- Teacher intervention is normal education. The desired trend is durable learning and decreasing repeated help.
- The graph/program library is part of the intelligence's lived experience, not an external cache.
- EKG should be able to compose/create reusable tools from its capabilities. **Acquired capabilities become durable parts of the learner's competence**, not disposable per-task tools. They remain part of what the AI can do unless later learning intentionally revises, supersedes, deprecates, or forgets them. A fixed agent harness/tool list is not the long-term architecture.
- Host/process/shell capabilities are legitimate environment affordances. Sandbox them for safety; do not ban them just to prevent benchmark shortcuts.
- Portable-core concepts do **not** require 100% native support across every host. Roughly 80-90% semantic convergence across representative runtimes is sufficient when outliers have practical adapters/ecosystem implementations. Compare semantics, not API spelling. Do not let the weirdest runtime veto EKG's ontology.
- Preserve old experimental checkpoints rather than freezing current development around old protocols.
- When forced to choose between making EKG more educable/capable and protecting an obsolete benchmark assumption, **build EKG and version the benchmark**.

## Core architectural invariants
- Canonical learned behavior lives in portable Blueprint IR, not Rust, TypeScript, or a particular host language.
- Rust/TypeScript/reference execution are backends, not ontology.
- Graph storage is an implementation detail behind the `GraphStore` interface.
- Known executable knowledge is attempted before synthesis: `RUN -> ADAPT -> BUILD -> TEACH`.
- Types/contracts constrain execution and synthesis before semantic similarity or learned ranking.
- Teacher/LLM output is a proposal with provenance and must be validated; it is never automatically truth.
- Learned programs remain decomposable even when higher layers treat them as atomic callable units.
- Record enough evidence/telemetry to measure search cost, reuse, failure, and teacher dependence.
- Add complexity only when benchmarks demonstrate a need.
- Host capabilities are cheap/exact machinery; learned Blueprints encode knowledge about how and when to compose that machinery.

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

When a negative test reveals existing incorrect behavior, **fix the implementation rather than weakening the test to match the implementation**.

## Graph backend doctrine

- Read `docs/LADYBUGDB.md` before changing graph persistence/retrieval.
- `GraphStore` semantics are canonical; LadybugDB is the preferred embedded durable backend, not EKG's identity.
- Keep `MemoryGraphStore` working as bootstrap/test/fallback.
- Use OpenCypher for graph-native retrieval when the backend supports it; do not reimplement graph traversal with whole-store JS scans when Cypher can answer the query directly.
- A **seed brain** (`ekg-data/seed-brain.json`) ships with the repo. Update the seed when baseline knowledge grows (use `/export-seed` in the CLI). The seed is the reproducible starting intelligence; runtime brains accumulate on top.
- Both `FileBrain` (JSON) and `LadybugBrain` (.lbdb) implement the `Brain` interface. The CLI auto-detects backend availability and auto-migrates from JSON to LadybugDB.
- `pnpm` is the package manager. `tsx` runs TypeScript directly for the CLI (no build step for `pnpm ekg`).

## Semantic parser doctrine

The semantic parser (`src/intent/semantic-parser.ts`) derives meaning from graph-backed word senses, not template matching. When adding language capabilities:
- Teach word meanings into the lexicon graph, not hardcoded patterns.
- The parser classifies tokens by looking up senses, then infers structure. No POS tagging, no external NLP libraries.
- Fuzzy matching (`src/intent/fuzzy.ts`) handles typos automatically.
- Values in utterances ("multiply seven by three") are extracted by the token classifier. The `:: [values]` syntax is only needed when the parser can't extract values from the words.
- World predicates (located_in, possesses) and capability relations (Multiply, Add) live in the same lexicon. The parser dispatches based on what the relation resolves to.
- The legacy template grammar (`world-language.ts` GrammarRule system) remains as fallback but should not be extended. New language understanding goes through the semantic parser.
- WordNet vocabulary (`ekg-data/wordnet-curated.json`) is imported at bootstrap. `wordnet.*` relations are vocabulary knowledge, not executable actions.

## Teacher Mode

The Teacher (Claude/ChatGPT via CLI) is the fallback for unknown utterances. It returns structured lessons that EKG validates and commits to its graph:

- **Capability mappings**: "time" -> `host.unix_time_seconds` (teaches EKG to call a capability)
- **Blueprints**: complete executable programs composed from capabilities (validated against the registry)
- **Groundings**: word meanings for the lexicon
- **Facts**: static world knowledge (NEVER for dynamic values like current time)
- **Synonyms**: word equivalences

The goal is for Teacher dependence to **decrease over time** as knowledge accumulates. If it doesn't, that's evidence against the core hypothesis.

Teacher is configured via `EKG_TEACHER=claude|chatgpt|auto` env var. Requires `claude` or `chatgpt` CLI to be installed.

## Resilience is a product invariant

Validated learned capabilities must preserve enough executable state in durable graph memory to be reconstructed. Self-healing program lookup can recover from graph snapshots or accumulated lived execution experience. Teacher escalation is a last resort after autonomous repair fails.

## Key docs

- `docs/PROJECT_GOSPEL.md` - product/research doctrine (read first for tradeoffs)
- `docs/PROGRESS.md` - detailed research log with evidence
- `docs/LADYBUGDB.md` - graph backend details
- `docs/FUTURE_WORK.md` - ideas and planned improvements
- `docs/AUDIT_V0.9.6.md` - architecture audit findings
- `docs/CONTEXTUAL_LANGUAGE.md` - context-sensitive language design
- `docs/ADR-001-core-invariants.md` - architectural decisions
- `CHANGELOG.md` - version history

## Work-session handoff discipline

Before substantial changes:
- read `docs/PROGRESS.md` tail for current state;
- run `pnpm test`;
- run `pnpm run benchmark:ekg`.

After substantial changes:
- add positive and negative/adversarial tests;
- rerun the full suite and benchmarks;
- update `docs/PROGRESS.md` with changes, evidence, limitations, and next gates;
- update `CHANGELOG.md`;
- regenerate seed brain if bootstrap/lexicon changed (`/export-seed` in CLI);
- do not claim a milestone without executable evidence.

## Research maxim
**Steal shit ruthlessly - with attribution/citation.**
