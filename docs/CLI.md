# EKG local CLI

The local CLI is the simplest way to interact with the current EKG runtime without writing Node snippets.

## Start

```bash
npm install
npm run ekg
```

By default EKG loads or creates:

```text
ekg-data/brain.json
```

That file contains the persisted graph, learned executable Blueprints, execution experience, and controller episodes. Restarting the process reloads the same brain.

Use a different brain file with:

```bash
npm run ekg -- --brain ./my-ekg-brain.json
```

## Natural-language input

The current language layer separates the utterance from typed runtime values. You can let the CLI prompt for those values:

```text
EKG> deduct six from this number
input[0] (int)> 20
14
```

Or provide them inline after `::` as a JSON array:

```text
EKG> deduct six from this number :: [20]
14
```

For one list-valued runtime input, nest the list inside the input array:

```text
EKG> some list operation :: [[1,2,3]]
```

The current intent interpreter does not yet treat every literal embedded in arbitrary English as a complete argument structure. The explicit runtime-input boundary is therefore intentional scaffolding, not a claim of full English parsing.

## Commands

```text
/help
/brain
/capabilities [filter]
/programs [filter]
/experience [subject-id]
/run <program-id> :: [args]
/teach synonym NEW = KNOWN
/teacher on|off|status
/save
/exit
```

### `/brain`

Shows the persisted brain path, file size, graph entity/relation counts, learned program count, execution experience count, controller episode count, and Teacher display state.

### `/capabilities`

Lists runtime/core/host capabilities currently supplied by the host environment. These are infrastructure available when EKG starts; they are not acquired learned procedures.

### `/programs`

Lists acquired executable `ProgramBlueprint`s currently persisted in EKG's program library.

### `/experience`

Shows recent successful and failed execution traces. Supplying a subject ID filters to one capability or learned program.

### `/run`

Directly executes an acquired procedure by program ID through the self-healing runtime:

```text
/run learned.some-procedure :: [20,7]
```

### `/teach synonym`

A small local/manual Teacher path that learns a new lexical form by grounding it through already-known language:

```text
/teach synonym dock = subtract
```

The lesson is persisted immediately. A later process can then understand:

```text
dock six from this number :: [20]
```

This is deliberately narrow. The CLI does not yet contain an external LLM Teacher transport.

### `/teacher`

Controls whether unresolved language displays Teacher-escalation context. It does not currently contact an external Teacher by itself.

## One-shot mode

Useful for scripts/tests:

```bash
npm run ekg -- --once "deduct six from this number" --inputs '[20]'
```

Teacher display can be disabled with:

```bash
npm run ekg -- --teacher off
```

## Startup curriculum

On the first start of a new brain, EKG installs the portable capability/concept substrate and the starter English curriculum once, then writes a bootstrap marker into the graph. Later starts load the persisted state and do not re-run that bootstrap curriculum.
