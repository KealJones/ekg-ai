# EKG v0.4 Phase 0 findings

Status: **BLOCKED_SPEC_ENGINE_CONSTANT_POOL_MISMATCH**. No scored items and no treatment run were executed.

## Gates that passed

- Current normal synthesizer limit is `maxDepth = 3`.
- Empirical constant-free calibration ladder is reliable at depth 1 (`2x`), depth 2 (`4x`), and depth 3 (`8x`).
- A known depth-4 target (`16x`) is not solved when search is capped at depth 3.
- Therefore empirical `D_max = 3` for the current engine under the normal limit.
- Phase-0 instrumentation now logs controller action, search nodes/depth, wall time, Teacher-call count, per-task library before/after state, provenance, canonical durable-state measurements, and learned-program call-graph edges.

## Hard mismatch discovered

Claude's independent v0.4 reachability proof assumes BUILD can enumerate integer constants `{-2,-1,0,1,2,3}` as leaves. The actual v0.3.7/v0.4.0 synthesizer does **not** automatically enumerate constants; its normal leaf set is task inputs plus optional ADAPT seeds.

A direct `x + 1` probe therefore fails after exhausting depth 3. This means the independent reachability model currently describes a stronger search language than EKG actually uses.

Consequences:

1. The positive-control claims (`sub_int` depth 2, `min_int` depth 3) rely on constants and do not characterize the actual BUILD search language as shipped.
2. 127 / 184 generated draft benchmark items contain literal constants that the current BUILD search cannot invent.
3. Five `span_string_len` draft items implicitly split a CSV-like `String` into a `List<String>`, but the current substrate has no string-split operator.
4. The taught depth-4 witness Blueprints may legally contain constants because a Teacher can supply a Blueprint containing `Const`; that is distinct from saying BUILD itself can synthesize constant-bearing compound solutions.

## Required next decision

Do **not** run treatment or baselines from the draft benchmark yet. The independent protocol must choose explicitly between:

- redesigning the experiment against the actual constant-free BUILD language, or
- preregistering a substrate change that adds a fixed constant pool to synthesis, then re-running D_max, reachability, irreducibility, item generation, and every frozen hash from scratch.

Silently adding constants would change the system under test and invalidate the current preregistration.
