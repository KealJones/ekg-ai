# LadybugDB: preferred durable EKG graph backend

LadybugDB is the preferred embedded durable graph realization for EKG. It is the maintained community fork/successor of KuzuDB (after the Apple acquisition), embedded/serverless, implemented in native code, MIT licensed, and exposes a Cypher property-graph interface from Node and Rust. EKG must not *become* LadybugDB: `GraphStore` remains the semantic boundary and `MemoryGraphStore` remains the zero-install bootstrap/test fallback.

npm: `@ladybugdb/core` (optional dependency, v0.19.1+)

## Architecture

Two brain backends implement the `Brain` interface:

- **`FileBrain`** (in-memory + JSON file): zero-dependency fallback. `MemoryGraphStore` with debounced atomic file persistence.
- **`LadybugBrain`** (LadybugDB + sidecar JSON): preferred durable backend. Graph lives in an embedded `.lbdb` database; programs and episodes persist in a `${path}.meta.json` sidecar.

The CLI auto-detects which backend is available (`--backend auto` default). If `@ladybugdb/core` is installed and no `.lbdb` exists but a `brain.json` does, auto-migration runs once.

`LadybugGraphStore.open({path:"./brain.lbdb"})` opens durable on-disk cognition. Omitting `path` creates an in-memory Ladybug database (used for tests and `sandbox()`).

## Schema

The store owns two physical tables:

- `EKGEntity(id STRING PRIMARY KEY, kind STRING, labelsJson STRING, attrsJson STRING, subjectId STRING, status STRING)`: generic semantic entities
- `EKG_RELATION(FROM EKGEntity TO EKGEntity, id STRING, kind STRING, confidence DOUBLE)`: generic typed semantic relations

The EKG-level `kind` remains a property so ontology growth does not require a schema migration for every new semantic kind. Arbitrary attributes retain a lossless JSON representation, while graph-hot fields used for native retrieval (currently episode `subjectId` and `status`) are projected into typed Ladybug properties.

### Property promotion policy

As new attributes prove cognitively/query-important, promote them into native graph properties instead of repeatedly parsing whole JSON blobs. Current promotions:
- `subjectId` - used by episode hot-path lookups in `experienceEntities()` and Search v2 operation weights
- `status` - used by episode filtering and Search v2 priors

Next candidate: `active` (boolean) on fact entities, currently filtered client-side after JSON parse.

## Cypher pushdown optimizations

Two hot paths use duck-typed Cypher pushdown via `hasCypher()` guards:

1. **World-language facts** (`world-language.ts`): `activeTriples()` issues `MATCH (f:EKGEntity) WHERE f.kind='fact'` instead of scanning all entities. Results are cached per inference round.
2. **Episode experiences** (`resilience.ts`): `experienceEntities()` issues `MATCH (e:EKGEntity) WHERE e.kind='episode' AND e.subjectId=$subjectId` - full pushdown on the promoted column.

Both fall back to `entitiesByKind()` + JS filter when the store has no `.cypher()` method.

## Sandbox

`LadybugGraphStore.sandbox()` returns a `MemoryGraphStore` seeded from the current snapshot. This is used by `grounding-lesson.ts` to validate Teacher-proposed knowledge in isolation before committing to durable state. Sandboxes are short-lived and small; transaction-based isolation is a valid future optimization.

## Seed brain

`ekg-data/seed-brain.json` is a version-controlled baseline brain snapshot containing the starter English curriculum (103 lexical lessons) and portable substrate. Fresh brains start from this seed rather than bootstrapping from code. Both `FileBrain` and `LadybugBrain` check for the seed when no prior brain exists.

## Search v2

`ladybugOperationWeights()` derives gentle operation priors from durable execution episodes via Cypher. This is retrieval/guidance, not program enumeration: Search v2 still performs bounded executable synthesis and never lets a graph prior make a capability semantically valid by itself.

## Remote execution lane

`.github/workflows/ekg-remote-lab.yml` is the authorized internet-enabled build lane for environments that cannot reach package registries. It installs `@ladybugdb/core`, runs the real embedded integration test, runs the living EKG suite, benchmarks Search v2, and uploads logs and the test brain as a workflow artifact.
