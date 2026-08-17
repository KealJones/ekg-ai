# LadybugDB: preferred durable EKG graph backend

LadybugDB is the preferred grown-up durable graph realization for EKG because it is embedded/serverless, implemented in native code, MIT licensed, and exposes a Cypher property-graph interface from Node and Rust. EKG must not *become* LadybugDB: `GraphStore` remains the semantic boundary and `MemoryGraphStore` remains the zero-install bootstrap/test fallback.

## Architecture

- `MemoryGraphStore`: smallest bootstrap/test/fallback realization.
- `LadybugGraphStore`: preferred embedded durable realization. It implements the synchronous `GraphStore` contract directly; no remote daemon or JVM is required.
- `ArcadeGraphStore`: optional network/server adapter retained for portability experiments, not the preferred brain.

`LadybugGraphStore.open({path:"./ekg-brain.lbdb"})` opens durable on-disk cognition. Omitting `path` creates an in-memory Ladybug database.

The store owns two physical tables:

- `EKGEntity`: generic semantic entities (`concept`, `sense`, `program`, `episode`, etc.)
- `EKG_RELATION`: generic typed semantic relations

The EKG-level kind remains a property so ontology growth does not require a schema migration for every new semantic kind. Arbitrary attributes retain a lossless JSON representation, while graph-hot fields used for native retrieval (currently episode `subjectId` and `status`) are projected into typed Ladybug properties. As new attributes prove cognitively/query-important, promote them into native graph properties instead of repeatedly parsing whole JSON blobs. Raw Cypher remains available through `store.cypher(...)` for graph-native retrieval and analysis.

## Search v2

`ladybugOperationWeights()` derives gentle operation priors from durable execution episodes. This is retrieval/guidance, not program enumeration: Search v2 still performs bounded executable synthesis and never lets a graph prior make a capability semantically valid by itself.

## Remote execution lane

`.github/workflows/ekg-remote-lab.yml` is the authorized internet-enabled build lane when a ChatGPT execution sandbox cannot reach package registries. It:

1. installs TypeScript and `@ladybugdb/core` from npm,
2. runs the real embedded Ladybug integration test,
3. runs the living EKG suite,
4. runs the Search v2 benchmark,
5. uploads logs and the test brain as a workflow artifact.

This is deliberately an authorized external runner, not a sandbox bypass.
