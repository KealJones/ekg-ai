# Future Work

Ideas, research directions, and planned improvements. Items here are not committed to any timeline - they're documented so they don't get lost.

## Language & Knowledge

### ConceptNet integration
ConceptNet is a common-sense knowledge graph with relations like "a cat is an animal", "rain causes wetness", "a kitchen is a room". It maps directly to EKG's world fact system and would give the inference engine real-world knowledge to reason over.
- Source: https://conceptnet.io/ (Creative Commons)
- Format: JSON-LD, CSV, or API
- Maps to: `assertWorldFact` with provenance tagging
- Potential: thousands of common-sense facts for inference chains

### Expanded WordNet import
Current import covers ~245 high-frequency words with ~466 entries. WordNet has 147K+ words total.
- Open Multilingual WordNet covers 100+ languages (same import path gives Spanish, Japanese, etc.)
- VerbNet could add verb subcategorization frames (syntactic patterns per verb class)
- FrameNet-style frame import (EKG already has semantic frames)
- Consider: import on-demand instead of all-at-once (lazy loading from the npm package when a word isn't in the graph)

### Pronoun resolution (bAbI-11, 13)
"She went to the pantry" - resolve "She" to the most recently mentioned female entity. Needs:
- Entity tracking per conversation session (last-mentioned entities)
- Gender/animacy attributes on entities (from WorldNet or taught)
- Pronoun lexicon entries mapping "she"/"he"/"it"/"they" to entity lookup rules

### Temporal reasoning (bAbI-14)
"X happened before Y" - needs event sequencing. Current facts have a `sequence` counter but no temporal composition.
- Temporal predicates: before/after/during/while
- Event ordering from sequence numbers
- Temporal inference rules

### Conversational context / working memory
Track short-term session state:
- Last result available as "that"/"it" for follow-ups ("now double that")
- Entity recency for pronoun resolution
- Conversation topic tracking

### Induction (bAbI-16)
Infer class properties from examples rather than explicit universal rules.
- "Pip is a swan and white. Luma is a swan and white. Kiko is a swan. What color is Kiko?" -> "white"
- Need to detect pattern across examples and propose a tentative universal rule
- Confidence should be lower than explicitly taught rules

## Architecture

### Polymorphic capabilities
Replace `mul_int`, `mul_float`, `add_int`, `add_float` etc. with generic `mul`, `add` that dispatch by type at runtime. Would cut the 87 capability count dramatically and simplify the type system. Needs type inference/specialization work to not regress synthesis speed.

### Structured record types
The IR has `json` but no proper `{name: string, age: int}` type. Structured types would let synthesis reason about field access. Highest-value type system addition.

### Function types
`(int) -> int` as a value - enables higher-order composition (map, filter, reduce). Big unlock but increases synthesis search space.

### Learned parsing
The project doctrine says "Natural language should not permanently require a frontier LLM." The long-term goal is for EKG to learn its own parsing patterns from successful execution feedback. The semantic parser is scaffolding; successful parses should generate supervision data for learned parser rules.

## Infrastructure

### Experience compaction
Execution experiences grow unbounded. Need summarization/compaction:
- After N successful uses of the same capability, collapse into a summary
- Keep failures and first/last successes as distinct records
- Bound total experience entities per subject

### Coverage tooling
Wire up c8/Istanbul for test coverage measurement. 194 tests is good but we don't know what % of src/ is exercised.

### Brain schema migration
`FileBrain.read()` throws hard on version mismatch. Need forward-compatible loading and migration path for schema changes.
