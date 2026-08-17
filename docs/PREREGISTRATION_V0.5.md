# EKG v0.5 — Constant-Free Redesign
## Response to `BLOCKED_SPEC_ENGINE_CONSTANT_POOL_MISMATCH`

**Recommendation: Option A, with one correction to how you framed it.** Do not add constants. But the problem is not constants — it is that the constant-free substrate has **no subtraction at any depth**, which kills all three v0.4 taught primitives outright, not just 127 of the items.

**Your refusal to patch EKG was correct and is the most important decision in this round.** Had you added the constant pool, you would have altered the system under test, invalidated the measured depth ladder, and done it in the exact direction that made a pre-written benchmark work. Hold that line.

Everything below is verified by exhaustive enumeration against the constant-free substrate, not asserted.

---

## 1. Independent confirmation of your Phase 0 measurement

I rebuilt the substrate model with **task inputs as the only leaves** and enumerated by observational equivalence. It reproduces your calibration ladder exactly:

```
depth 0:   1 distinct Int behaviour
depth 1:   2        2x = add(x,x)
depth 2:  11        4x = add(add(x,x),add(x,x))
depth 3: 168        8x = add(add(add(x,x),add(x,x)),add(add(x,x),add(x,x)))
depth 4: 18,325     16x  ← first depth at which 16x appears
```

Your engine solved 2x/4x/8x and failed 16x. The model says 16x first appears at depth 4. **`D_max = 3` is confirmed independently**, and the depth-4 taught-abstraction design is sound. (Q1: yes.)

This is also the first time in this project that an independent prediction about EKG matched a measurement. Worth noting.

---

## 2. The real finding: the substrate has no subtraction, at any depth

Leaves are task inputs; the Int operators are `{add_int, mul_int, max_int}`. On the non-negative orthant:

- every input is convex and non-decreasing;
- `add` and `max` preserve convexity and monotonicity;
- the product of two non-negative convex non-decreasing functions is convex non-decreasing.

**Therefore every reachable Int expression is convex and non-decreasing on non-negative inputs.** A second invariant: `f(0,0,…,0) = 0` for every reachable expression, since all leaves and all three operators vanish at zero.

Consequences, confirmed by exhaustive depth-3 enumeration (12,005 distinct behaviours over two Int inputs, positive controls `add` and `max` correctly found at depth 1):

| Target | Status |
|---|---|
| `add(x,y)`, `max(x,y)` — positive controls | reachable, depth 1 |
| `x - y` | **not reachable at any depth** (decreasing in y) |
| `min(x,y)` | **not reachable at any depth** (concave) |
| `abs(x-y)` | **not reachable at any depth** |

The reachable class is the **(max, +, ×) semiring over task inputs**. Not a ring — there is no additive inverse anywhere in the language.

### 2.1 What this does to the v0.4 primitives

All three were defined by differences or minima:

| v0.4 primitive | Requires | Status |
|---|---|---|
| `clamp_int` | `min` | **inexpressible at any depth** |
| `abs_diff_string_len` | subtraction | **inexpressible at any depth** |
| `span_string_len` | subtraction | **inexpressible at any depth** |
| `mid_int` (NC1) | `sum − max − min` | **inexpressible at any depth** |

Under §0.2 of the v0.4 spec, a primitive that no Blueprint can express is not teachable — it could only be installed as host code, which is an API addition and tests nothing. **So all three taught primitives and NC1 are dead, independent of the constant issue.** The 127-item constant audit understated the damage; the true figure is 184/184.

(Q5: no, the candidates cannot be repaired. Q6: yes, controls must be regenerated. Q3: yes, the draft benchmark is fully burned.)

---

## 3. Should you add a constant pool? No. (Q2)

**Adding constants would be a substrate change made to fit a benchmark**, and three concrete harms follow:

1. **It invalidates your measured `D_max`.** Your ladder was measured on a constant-free search space with 168 distinct behaviours at depth 3. Adding six constants takes the two-input depth-2 space from 95 behaviours to roughly 5,600 — a ~60× branching increase. Under a fixed node budget, effective `D_max` would very likely drop below 3, and every depth claim would need remeasuring.
2. **It changes the system under test mid-experiment**, exactly as you said.
3. **It is the change that makes a pre-written benchmark work.** That is the strongest possible reason to refuse it.

**However — one thing I would flag independently of this experiment, and want to be explicit that I am *not* asking you to fix now:** a capability set with `add_int`, `mul_int`, `max_int`, and `gte_int` but no way to compute a difference is a semiring, not a ring. EKG can compare two integers but cannot compute how much larger one is. That is an unusual expressive gap and is worth a design decision on its own merits, at a time when no experiment depends on the answer. **Make that decision after this run, not before, and not as part of it.** If you decide to add subtraction later, treat it as a substrate version bump that burns all reachability proofs and all benchmarks.

---

## 4. Replacement primitives (Q4) — verified, not asserted

The primitives must live inside the semiring at depth 4. Domain: **fixed-width text layout sizing over string lists** — all such quantities are genuinely monotone, so the semiring restriction is honest here rather than worked around.

Each witness was checked against its reference on 60 probe fixtures (exact match), and each was checked for depth-3 reachability by exhaustive enumeration.

### T1 — `padded_block_size(L: List<String>, w: Int) -> Int`
Cells needed to render `L` as a fixed-width column at least `w` wide.
```
= list_len(L) × max(len(argmax_len L), w)
Witness (base depth 4):
  mul_int( list_len_string(L), max_int( string_len(argmax_string_len(L)), w ) )
Enumeration: d0=1 d1=3 d2=23 d3=737   →  NOT reachable at depth ≤3   ✓
```

### T2 — `pair_name_width(p: String, q: String, k: Int) -> Int`
Combined basename width of two paths, scaled by `k`.
```
= ( len(basename p) + len(basename q) ) × k
Witness (base depth 4):
  mul_int( add_int( string_len(basename(p)), string_len(basename(q)) ), k )
Enumeration: d0=1 d1=4 d2=37 d3=1787  →  NOT reachable at depth ≤3   ✓
```

### T3 — `merged_block_size(L: List<String>, M: List<String>) -> Int`
Cells to render two lists stacked in one column of common width.
```
= max(len(argmax_len L), len(argmax_len M)) × ( list_len(L) + list_len(M) )
Witness (base depth 4):
  mul_int( max_int( string_len(argmax_string_len(L)), string_len(argmax_string_len(M)) ),
           add_int( list_len_string(L), list_len_string(M) ) )
Enumeration: d0=0 d1=2 d2=11 d3=213   →  NOT reachable at depth ≤3   ✓
```

### NC1 — `interleave_cost(L, M)` — **never taught**, difficulty-matched
```
= ( len(argmin_len L) + len(argmin_len M) ) × max(list_len L, list_len M)
Base depth 4. Same type signature and same enumeration space as T3 (213 behaviours at d3).
Deliberately built on argmin where T1–T3 use argmax, so that teaching T1–T3 does not
partially enable it through shared subexpressions.
NOT reachable at depth ≤3   ✓
```

### NC2 — `mod_int(a, b)` — **never taught**, absolute floor
Periodic and non-convex; unreachable at any depth with or without constants. **Any NC2 solve voids the run.**

### 4.1 Two honest costs of this redesign

- **The primitives are reverse-engineered from the algebra.** "Padded block size" is a real thing, but I found it by asking what is expressible, not by asking what is interesting. Since this experiment has no natural language, semantic naturalness buys little scientifically — what matters is irreducibility, expressibility, compositional positions, and not being a task-family bundle, and all four hold. But you should not describe these as independently motivated operations.
- **The search space is very small.** 213–1,787 distinct behaviours at depth 3, versus 5,642 with constants. This *strengthens* the C2 lesson-withheld gate (near-zero solve is close to certain) and *weakens* the search-economy metric. Threshold adjusted in §7.

---

## 5. Regenerated benchmark

Generated, gated, and verified. **Every literal constant is promoted to a task input.** No string-split. No filesystem access.

| Primitive | Items | Families | Distinct structures | Fixtures | Literal constants |
|---|---|---|---|---|---|
| `padded_block_size` (T1) | 44 | 5 | 12 | 132 | 0 |
| `pair_name_width` (T2) | 44 | 5 | 12 | 132 | 0 |
| `merged_block_size` (T3) | 44 | **4** | 10 | 132 | 0 |
| `interleave_cost` (NC1) | 26 | 4 | 6 | 78 | 0 |
| `mod_int` (NC2) | 26 | 5 | 6 | 78 | 0 |
| **Total** | **184** | — | **46** | **552** | **0** |

T3 and NC1 have **4 families, not 5**: family F1 (composed argument) requires building a `List<String>` argument, and the only `List<String>` producer in the substrate besides task inputs is `fs.list_filenames`. Rather than pull the filesystem into this experiment, T3/NC1 use F2–F5. This meets the ≥4 bar; it is a reduction and I am flagging it rather than hiding it.

**Per-item irreducibility gate:** every item's own input→output behaviour was checked against exhaustive base-op enumeration at depth ≤3 for its type signature. Items that collapse to something base-synthesizable were discarded at generation time. All 184 survivors carry `"gate": "irreducible<=3"`.

---

## 6. Phase 0 compatibility gates (Q7)

Everything below must pass before a single teaching event. These are the gates that would have caught the current failure.

### Substrate-model gates
| Gate | Check | Threshold |
|---|---|---|
| P0-1 | Capability list extracted from source, not from spec | Documented, hashed |
| P0-2 | **Synthesis leaf set enumerated from source** | Explicit list. This is the gate that failed this round. |
| P0-3 | Constant availability | Confirmed absent; recorded |
| P0-4 | Depth ladder measured | `D_max` = 3, matches independent model |
| P0-5 | Independent model reproduces the ladder | 2x@1, 4x@2, 8x@3, 16x@4 ✓ |

### Benchmark-compatibility gates (new; the missing category)
| Gate | Check | Threshold |
|---|---|---|
| P0-6 | **Every item expressible using only leaves in P0-2** | 184/184 |
| P0-7 | **Zero literal constants in any item** | 0 |
| P0-8 | **Every operation used by any item is in the P0-1 capability list** | 100% |
| P0-9 | Every taught primitive has a witness Blueprint over P0-1 ops only | 3/3 |
| P0-10 | Every witness verified against reference on ≥60 probes | exact match |
| P0-11 | Every taught primitive not reachable at `D_max` | exhaustive |
| P0-12 | Every control primitive not reachable at `D_max` | exhaustive |
| P0-13 | Per-item behaviour not reachable at `D_max` in base ops | 184/184 |
| P0-14 | Positive controls detected by the reachability checker | `add`@1, `max`@1, `2x`@1, `8x`@3 |
| P0-15 | Fixture denotation variation | ≥2 distinct per item |
| P0-16 | Instrumentation live | controller action, nodes, depth, wall time, Teacher count, library delta, provenance, call graph |

**Generalized rule to prevent a third round of this:** before any benchmark is frozen, mechanically execute every reference implementation *through the engine's own capability registry*, not through Python. If an operation cannot be named in the registry, the item is invalid. The current failure happened because reference semantics were written in Python, where `x+1` is free.

---

## 7. Changes to the v0.4 protocol

Everything else in `v0_4-arith-decomposition-preregistration.md` carries over unchanged — conditions C1–C7, the six decomposition signals in §10, the knockout/recovery design, and the analysis gates. Three numeric amendments:

| Item | v0.4 | v0.5 | Reason |
|---|---|---|---|
| Search-economy threshold | ≥3× node reduction | **≥2×** | Constant-free space is 3–8× smaller; less headroom |
| C2 lesson-withheld gate | <15% | **<5%** | Primitives now inexpressible at ≤3 *and* the space is tiny; near-zero expected |
| T3/NC1 family requirement | ≥5 | **≥4** | F1 needs a List producer; declining to add one |

The primary criteria are unchanged and remain the point of the experiment: controller-action mix, artifact-utility singleton fraction, library growth, cross-family reuse, embedding-depth spread.

One addition specific to this substrate: **because the reachable space is small, log the fraction of the depth-≤3 space the enumerator actually visits per item.** If BUILD is exhausting the whole space every time, "search node reduction" is measuring enumeration order rather than knowledge, and should be reported as such.

---

## 8. Answers

1. **Does `D_max = 3` still support the depth-4 design?** Yes. Independently confirmed — my model reproduces your ladder exactly.
2. **Add a constant pool?** No. It would invalidate the measured ladder (~60× branching increase at depth 2), change the system under test, and do so in the direction that rescues a pre-written benchmark. Separately: the absence of subtraction is a genuine expressive gap worth deciding on its own merits, **after** this run.
3. **Is the 184-item draft burned?** Completely — and worse than the audit showed. Not 127/184 but 184/184, because all three taught primitives are inexpressible at any depth without subtraction.
4. **Constant-free primitives instead?** Yes. Three provided, each verified irreducible at depth ≤3 by exhaustive enumeration and expressible at depth 4 by a witness checked on 60 probes.
5. **Can `clamp_int` / `abs_diff_string_len` / `span_string_len` be reused?** No. All three require subtraction or `min`, neither of which exists at any depth. Candidate selection restarted.
6. **Regenerate the negative controls?** Yes. `mid_int` also requires subtraction. Replaced by `interleave_cost` (matched, semiring depth-4, never taught) and `mod_int` (absolute floor, any solve voids the run).
7. **Phase 0 gates?** §6 — sixteen gates, of which P0-2, P0-6, P0-7 and P0-8 are the new compatibility category that this round's failure exposed.
8. **Revised package?** Attached: reference module with self-test, generator, 184 regenerated items, enumeration scripts.

---

## 9. Process note

Two rounds in a row, a preflight caught a fatal mismatch before any scored run: v0.3's 0/120 substrate gap and now v0.5's constant-free algebra. Both were found by mechanically checking the benchmark against the engine rather than by reasoning about it. Neither cost you a contaminated result.

The pattern worth keeping is that the *implementers* ran the audit against the real system and refused to patch the system to fit the spec. That refusal is the reason this round produced a correction instead of a false positive.
