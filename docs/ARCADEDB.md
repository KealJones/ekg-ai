# ArcadeDB durable cognition backend

EKG's ontology is **not ArcadeDB-specific**. `GraphStore` remains the semantic boundary. ArcadeDB is retained as an **optional network/server graph realization**. The preferred local durable backend is LadybugDB because it embeds directly in the host process; Arcade remains useful when a remote/server deployment is the better environmental fit.

Architecture:

```text
                 EKG GraphStore semantics
                         |
                 HybridGraphStore
                   /             \
          MemoryGraphStore    ArcadeGraphStore
          hot/synchronous     durable/OpenCypher
```

This hybrid architecture remains a supported **remote-backend adapter**: `MemoryGraphStore` supplies synchronous hot state while `ArcadeGraphStore` persists/hydrates over the network and exposes raw Cypher. It is no longer the default local brain; see `docs/LADYBUGDB.md` for the preferred embedded path.

## Search v2

Search v2 remains an executable synthesizer, not a Cypher program enumerator. ArcadeDB supplies **priors**: which capabilities worked, failed, co-occurred, or sit near the interpreted goal in the semantic graph. Those priors become operation weights; value-based/budgeted synthesis still decides what executable program works.

## Local integration

A real integration test exists at `tests/arcade-integration.test.mjs`. It skips unless `ARCADEDB_URL` and `ARCADEDB_PASSWORD` are available.

With an extracted ArcadeDB distribution:

```bash
ARCADEDB_HOME=/path/to/arcadedb ./scripts/arcadedb-local-test.sh
```

The launcher uses test mode and a bounded JVM heap, creates `ekg_test` if necessary, runs the actual OpenCypher round-trip, and shuts the server down.
