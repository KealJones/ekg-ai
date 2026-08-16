# Executable Knowledge Graph Intelligence — v0 spike

This is the first executable skeleton of the research architecture.

## What exists

- Language-neutral typed Blueprint IR.
- Reference interpreter.
- Replaceable capability registry.
- TypeScript backend that emits/executes generated code.
- Rust backend source emitter (execution test activates once a Rust toolchain exists).
- Storage-agnostic logical graph interface with an in-memory implementation.
- Tiny type-directed enumerative synthesizer.
- Tests proving reference/TS equivalence and a first synthesized program.

## Intentionally not here yet

Teacher/LLM integration, natural language, embeddings, neural search, persistence DB, abstraction mining, episodes, prediction, self-modification, or global sharing.

Those are withheld until the minimal learning/search mechanism has benchmark evidence.

## Run

```bash
npm test
```

## Next acceptance gates

1. Add TaskSpec + property tests and randomized IR differential testing.
2. Execute generated Rust under cargo/rustc in a Rust-capable environment.
3. Add Episode schema/store and RUN -> ADAPT -> BUILD controller.
4. Freeze a tiny train/test synthesis benchmark + memorize baseline.
5. Add abstraction mining only after the benchmark is frozen.
