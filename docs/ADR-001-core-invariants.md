# ADR-001: Core invariants

1. Canonical learned executable knowledge is stored as language-neutral Blueprint IR.
2. Reference interpretation defines semantics; language backends are replaceable implementations.
3. Rust and TypeScript must both be supported early; this environment currently lacks rustc, so Rust execution tests are pending but source generation is implemented.
4. The logical knowledge graph is independent of its persistence engine.
5. Known programs are retrieved/run before synthesis; synthesis is an impasse path.
6. Episodes/evidence and abstraction learning are later layers; do not let an LLM hide deficiencies in the core synthesis loop.
7. Neural search guidance is allowed, but only after a measurable typed-search baseline exists.
8. Teacher output is structured proposed knowledge, not trusted truth.
