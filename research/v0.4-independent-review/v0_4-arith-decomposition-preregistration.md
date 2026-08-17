# EKG v0.4 — Arithmetic Decomposition Experiment
## Preregistration specification, designed against the exact v0.3.7 substrate

**Status:** design complete, item generator implemented and run, irreducibility verified by exhaustive enumeration. Ready to hand to an implementing agent.
**Companion artifacts:** `ekg_v04_reference.py` (reference semantics + witnesses + generator), `bench_v04_draft.json` (184 generated items, 552 fixtures).

---

## 0. Read this first: the experiment you asked for is not quite the experiment worth running

You asked for a primitive-holdout composition test. Two facts about your substrate make the naive version of that test nearly vacuous, and one of them also makes it incoherent.

### 0.1 Enumerative synthesis makes "novel composition" close to tautological

Your BUILD step is typed enumerative synthesis over a small operator set, graded against TaskSpec examples. Once primitive `f` is in the callable set, **every task solvable with `f` within depth budget will be found by brute force.** There is no representational decision for the system to get right or wrong. "Did EKG compose the taught primitive in a novel structure?" reduces to "was the structure within the search budget?"

So a high score on a primitive-holdout suite would be evidence about your *enumerator*, not about acquired reusable knowledge. It would not distinguish library from cache, which is the question that actually matters after the v0.3 preflight.

### 0.2 On this substrate, "irreducible" and "teachable" are mutually exclusive

Your Blueprint language admits only constants, inputs, base-capability calls, and learned-program calls. Therefore:

- If a primitive is **absolutely irreducible** (e.g. `mod_int`, `gcd`), no Blueprint can express it. "Teaching" it can only mean **installing new host code**. That is an API addition, not learning, and it tests nothing about the architecture.
- If a primitive is **expressible** in base operations, the Teacher can hand over a Blueprint — but then enumerative search could in principle find it too.

The only coherent middle is: **expressible in base operations, but at a depth strictly greater than the preregistered search budget.** The Teacher's lesson is then a genuine gift — a Blueprint the learner provably could not have found — and it remains *decomposable*, which is what makes knockout, ADAPT-recovery, and abstraction mining measurable.

**Every primitive in this specification is budget-irreducible and base-expressible.** I rejected the alternatives myself; see §1.3.

### 0.3 What this experiment therefore measures

Reframed, and this is the version worth your money:

> **Primary question.** When the Teacher hands over one decomposable abstraction, does EKG store and use it as a *shared semantic unit reused inside many independently synthesized programs* (library), or does it accumulate one task-shaped program per task (cache)?

Composition is the *vehicle*; decomposition and reuse are the *measurement*. That directly targets the `intent-pattern:file-extreme-filename` concern and it is answerable on your current substrate. The primitive-holdout structure is retained because it gives a clean causal handle and a negative control — not because composition success is itself the result.

---

## 1. Candidate taught primitives

### 1.1 Verified reachability of the checkpoint-0 Int substrate

Exhaustive observational enumeration over `core.add_int`, `core.mul_int`, `core.max_int` with inputs `{x,y,z}` and constants `{-2,-1,0,1,2,3}`, on a 50-point probe set:

```
depth 0:      9 distinct behaviours
depth 1:     64
depth 2:  5,569        (cumulative ≤2 = 5,642)
depth 3:  checked exhaustively per target by inversion + pair scan
```

Results (exhaustive, not sampled):

| Candidate | Reachable at depth ≤3? | Witness found |
|---|---|---|
| `sub_int(x,y)` | **YES, depth 2** | `add(add(x,y), mul(y,-2))` |
| `min_int(x,y)` | **YES, depth 3** | `add(add(x,y), mul(max(x,y),-1))` |
| `abs_diff_int(x,y)` | **YES, depth 3** | `add(mul(add(x,y),-1), max(add(x,x),add(y,y)))` |
| `clamp_int(x,lo,hi)` | **NO** | — |
| `mid_int(x,y,z)` | **NO** | — |
| `mod_int(x,y)` | **NO** (and unreachable at any depth) | — |

**Consequence:** `min_int`, `abs_diff_int`, and `sub_int` are disqualified as taught primitives at `D_max = 3`. This is exactly the failure mode I warned about in the previous review — two of them look "obviously new" and are depth-3 compositions. Do not reintroduce them.

### 1.2 The three taught primitives

All are base-expressible at **depth 4**, verified constructively (20,000 randomized trials each, all exact).

**T1 — `core.clamp_int(Int, Int, Int) -> Int`**
Precondition: `lo ≤ hi` (enforced by the generator).
```
clamp(x, lo, hi) = min(max(x,lo), hi)
Witness Blueprint (base depth 4):
  add( add(max_int(x,lo), hi),
       mul( max_int(max_int(x,lo), hi), -1 ) )
```

**T2 — `core.abs_diff_string_len(String, String) -> Int`**
```
abs_diff_string_len(a,b) = | len(a) - len(b) |
Witness Blueprint (base depth 4):
  add( max_int( add(string_len(a), string_len(a)),
                add(string_len(b), string_len(b)) ),
       mul( add(string_len(a), string_len(b)), -1 ) )
```

**T3 — `core.span_string_len(List<String>) -> Int`**
```
span(L) = len(argmax_len L) - len(argmin_len L)
Witness Blueprint (base depth 4):
  add( string_len(argmax_string_len(L)),
       mul( string_len(argmin_string_len(L)), -1 ) )
```

Why these three, specifically:

- **Type-signature diversity.** Ternary Int, binary String, unary List — three different arities and three different entry points into the type graph. This maximizes the structural variety available for composition on a substrate where variety is scarce.
- **They bridge the type islands.** T2 and T3 are the only realistic way to make the `List<String> → String → Int` chain carry compositional weight, since `List<String>` has just three consumers and no constructors.
- **Partial mutual overlap.** T1 and T2 both contain the "max-of-negations" pattern. This is a feature: it creates a testable cross-primitive transfer prediction (§10.6) without either being derivable from the other at budget.
- **Each composes in ≥5 structurally distinct positions** — verified by the generator, which produced 10–11 distinct structures per primitive across 5 families.

### 1.3 Candidates I rejected

| Rejected | Reason |
|---|---|
| `min_int`, `abs_diff_int`, `sub_int` | Reachable at depth ≤3. Empirically disqualified above. |
| `mod_int`, `gcd_int`, `isqrt`, `digit_count`, `popcount` | Absolutely irreducible ⇒ not expressible as a Blueprint ⇒ "teaching" = host installation ⇒ tests nothing (§0.2). Retained only as a negative control. |
| `count_char(String,String)` | Absolutely irreducible (no character-level operator exists at all). Same problem. |
| `second_longest(List<String>)`, `count_longer_than(...)` | Require list construction/filtering. **No operator in the substrate produces a `List<String>` except `fs.list_filenames` and task inputs.** Not expressible at any depth. |
| `clamped_span`, `scaled_clamp`, etc. | Deep enough, but transparently a bundle of two primitives. Exactly the artifact shape we are trying to detect; using one as a taught primitive would pre-commit the answer. |

---

## 2. Negative-control primitives

Two, because they control for different things and both are cheap.

**NC1 — `core.mid_int(Int, Int, Int) -> Int`** (median of three). **Never taught.**
Matched to T1: same type signature, same arity, base-expressible, verified **not reachable at depth ≤3**. Its base depth is ≥4 (constructively 5). Because it is difficulty-matched to a taught primitive, failure on NC1 items cannot be attributed to the items simply being harder.

**NC2 — `core.mod_int(Int, Int) -> Int`**. **Never taught.**
Absolutely irreducible: `mod` is periodic, while every expression over `{add, mul, max}` with integer constants is a max of polynomials and therefore eventually monotone. No finite Blueprint equals it. NC2 is the hard floor — if any NC2 item is solved, something is fundamentally wrong (host leakage, probe-set table-encoding, or grader error), and the whole run is void.

**Expected result for both:** TEACH impasse, at or below the abstention floor. NC1 and NC2 items use the *same structural templates* as the taught items, so a system that solves taught items via structure-matching rather than via the primitive would also solve control items.

---

## 3. Irreducibility test protocol

Run once at checkpoint 0, and **re-run immediately before each held-out phase** — the library grows, and a primitive that was irreducible against the base set may become reachable once earlier-learned programs are callable atoms. This re-verification step is mandatory and is the most likely thing to be skipped.

### 3.1 Procedure

1. **Fix `D_max` empirically.** `D_max` is not a free parameter — it is whatever your enumerator actually reaches under the preregistered per-task budget. Measure it: run BUILD on a calibration ladder of known-depth targets and record the greatest depth reliably solved within budget. **Preregister the measured value.** All of §1 assumes `D_max = 3`; if your measured `D_max ≥ 4`, every primitive here is disqualified and you must go deeper (see §11.3).
2. **Build the reachable set.** Observational-equivalence enumeration to depth `D_max` over: all base capabilities **plus every learned program currently in the library**, with the preregistered constant set.
3. **Probe set.** ≥50 input tuples, including adversarial structure: ties, zeros, negatives, ordered and reverse-ordered triples, equal pairs. Provided in the reference module. The probe set must be large enough that a depth-`D_max` expression cannot table-encode it.
4. **Membership test.** The primitive's behaviour vector on the probe set must not appear in the reachable set.
5. **Rejection criterion.** If any expression of depth ≤ `D_max` reproduces the primitive's behaviour on the probe set, **the primitive is disqualified**, permanently, and the enumerating expression is recorded in the preregistration as the reason. No appeal, no "but the expression is unnatural" — if search can find it, search will find it.
6. **Positive control on the test itself.** Verify the procedure detects `min_int` at depth 3 and `sub_int` at depth 2. If it does not, the enumerator is broken. These two are the built-in canaries.

### 3.2 Probe fixtures

Provided in `ekg_v04_reference.py`. Int probes span `[-40,40]` including all sign combinations and equalities. String probes span lengths 0–15 including empty strings, equal lengths, and repeated elements. List probes span sizes 1–8 including singletons and all-equal-length lists.

### 3.3 Item-level irreducibility gate

Every generated scored item must additionally pass: **the item's own input→output behaviour is not reachable in base operations at depth ≤ `D_max`.** This catches degenerate compositions (`mul(clamp(...), 0)`, `add(span(L), 0)`) that collapse to something trivially synthesizable. Items failing this gate are discarded before selection, and the discard count is reported.

---

## 4. One-shot teaching events

### 4.1 What the Teacher may provide

**Exactly one lesson per primitive, containing exactly these four things:**

1. The primitive's **name** and **type signature**.
2. The **witness Blueprint** from §1.2, expressed purely in checkpoint-0 base operations.
3. **Four input/output examples** applying the primitive to *raw task inputs only* — arguments at structural depth 0, no composed arguments, no embedding.
4. Nothing else.

**Explicitly forbidden in the lesson:**

- Any example where an argument is itself a composed expression.
- Any example where the primitive's result feeds another operation.
- Any demonstration of the primitive used twice.
- Any of the five test composition families (§5.2).
- Any mention of the other taught primitives.
- Any natural-language guidance about "where this is useful."
- More than one lesson, or a retry after failure.

Lessons are authored **mechanically from a template** by the reference module, frozen and hashed before any run. The Teacher model does not free-write them. This removes the Teacher-authoring coupling that undermined earlier rounds.

### 4.2 Lesson structure hash disjointness

The lesson's structure is `f(input, input, input)` — depth 1, f at root, all arguments raw. Every scored item has structure depth ≥2 with f either embedded under a base op, applied to a composed argument, repeated, or under a Bool head. **Structure-hash disjointness between lesson and every scored item is enforced mechanically** and reported.

### 4.3 Healthy acquisition vs suspicious bundling — at the artifact level

Measured immediately after the lesson, before any scored item is attempted:

| | **Healthy (decomposed)** | **Suspicious (bundled)** |
|---|---|---|
| Library delta | Exactly **one** new entry | More than one; or entries whose names/shapes encode task structure |
| Entry's Blueprint | The depth-4 witness, decomposable, expressed in base ops | Opaque atom; or a Blueprint containing task-specific constants from the lesson examples |
| Entry's signature | Generic over its declared types | Specialized to the lesson's example values |
| Callability | Registered as a callable unit available to synthesis at any argument position | Registered only as a whole-task solution |
| Constants | None baked in | Lesson example constants present in the stored Blueprint |

**Gate G-ACQ:** if the lesson produces more than one library entry, or the stored Blueprint contains any constant drawn from the lesson's examples, the acquisition is bundled and that primitive is dropped from the run. Record and report.

---

## 5. Independent test-set construction

### 5.1 Generation strategy — mechanical, no LLM authoring

The scored items are **not natural language and not authored by any model.** Your TaskSpec is already machine-grounded (input/output examples), which means this experiment can dispense with NL entirely — and with it, the entire annotation-coupling problem that dominated v0.3.

The generator (`gen_items.py`, run and verified):

1. Enumerates a fixed set of **composition templates** per primitive, one per (family, structural shape).
2. Samples task inputs from typed random samplers with a fixed seed.
3. Samples constants from a per-primitive constrained pool (e.g. `clamp` gets `lo < hi`).
4. Computes gold by **executing the reference implementation** — never by authoring.
5. Emits a TaskSpec with 4 training examples plus **3 fixtures of 4 held-out examples each**.
6. Discards any item whose 3 fixtures do not exhibit ≥2 distinct denotations.
7. Discards any item failing the §3.3 item-level irreducibility gate.

Templates are structural skeletons; the human/model contribution is the *skeleton set*, which is frozen, hashed, and published before any run, and which is deliberately uniform across taught and control primitives (§2).

### 5.2 Composition families

| Family | Shape | Example |
|---|---|---|
| **F1** `arg_composed` | `f(g(...), ...)` | `clamp(add(x,y), c0, c1)` |
| **F2** `under_base` | `g(f(...), ...)` | `max(clamp(x,c0,c1), y)` |
| **F3** `cross_domain` | f applied through the String/List chain | `clamp(string_len(argmax_string_len(L)), c0, c1)` |
| **F4** `repeated` | f used twice | `add(clamp(x,c0,c1), clamp(y,c0,c1))` |
| **F5** `bool_head` | f under the terminal Bool ops | `gte_int(span(L), c0)` |

F5 matters disproportionately: `Bool` is a **terminal type** in your substrate (nothing consumes it), so F5 is the only family that exercises the Bool boundary at all.

### 5.3 The false-confidence mode is example-overfitting

Because BUILD grades candidates against TaskSpec examples, the system does not produce "confident wrong answers" in the usual sense — it produces **programs that satisfy the 4 training examples but implement the wrong function.** The 3 held-out fixtures exist precisely to catch this. A program passing TaskSpec and failing ≥1 fixture is a **false-confident execution**, and this is the FCER definition for this experiment. It is real, it is measurable, and it is the main way a synthesizer fools you.

---

## 6. Benchmark size and structure — as generated

Generated and verified:

| Primitive | Items | Families | Distinct structures | Fixtures |
|---|---|---|---|---|
| `clamp_int` (T1) | 44 | 5 | 10 | 132 |
| `abs_diff_string_len` (T2) | 44 | 5 | 11 | 132 |
| `span_string_len` (T3) | 44 | 5 | 11 | 132 |
| `mid_int` (NC1) | 26 | 5 | 6 | 78 |
| `mod_int` (NC2) | 26 | 5 | 6 | 78 |
| **Total** | **184** | — | **44** | **552** |

Meets every stated requirement: ≥40 per taught primitive, ≥25 per control, ≥4 families each, 3 fixtures per item with ≥2 distinct denotations.

**Statistical note, stated plainly:** 44 items gives a 95% Wilson half-width of about ±14 points near p=0.5. That is adequate for the large effects this design predicts (near-0 vs near-1 between conditions C1 and C2) and **inadequate for per-family claims** (n≈9, ±30 points). Report per-family numbers as descriptive only. Never headline them.

---

## 7. Novelty and leakage measurements

Computed and reported before any scored run; each is a number, not an assertion.

| Measurement | Definition | Gate |
|---|---|---|
| **Structure-hash disjointness** | lesson structures ∩ item structures | must be ∅ |
| **Compound divergence** | Chernoff divergence over (parent-op, arg-slot, child-op) triples between lesson corpus and item corpus | > 0.6 |
| **Atom divergence** | same, over operator unigrams | < 0.05 |
| **Example-value overlap** | fraction of scored items sharing any input value with the lesson examples | report; < 0.10 |
| **Cross-primitive template parity** | Jaccard over template skeletons between taught and control primitives | > 0.8 (controls must not be structurally easier or harder) |
| **k-NN ceiling** | nearest-neighbour over TaskSpec example-vectors, copying the neighbour's program | < 20% on taught items |
| **Fixture-denotation entropy** | distinct denotations per item | ≥2 by construction |
| **Constant leakage** | any constant appearing in both a lesson and a scored item | report; prefer 0 |

---

## 8. Experimental conditions

All conditions Teacher-OFF during scoring, with a hard assertion of **zero Teacher tokens** in the run log. All conditions share the identical preregistered per-task budget unless stated.

| ID | Condition | Purpose | Prediction |
|---|---|---|---|
| **C1** | Post-lesson EKG | The treatment | High solve rate on taught items |
| **C2** | Lesson-withheld EKG | Isolates the lesson | Near-0 on taught items. **If C2 > 15%, the items are not budget-irreducible and the run is void.** |
| **C3** | Base synthesis, budget raised to depth 5 | Separates knowledge from compute | Partial solve. The C1−C3 gap is the part of C1 not explainable by more search. |
| **C4** | Never-taught controls (NC1, NC2) under C1 conditions | Detects structure-matching and host leakage | At floor. **Any NC2 solve voids the run.** |
| **C5** | Threshold-calibrated k-NN memorization baseline | Detects caching | Sweep similarity threshold; report full risk–coverage curve, not a point |
| **C6** | **Primitive installed as opaque host atom, no lesson** | **Separates teaching from API injection** | If C6 ≈ C1 on solve rate, the lesson's Blueprint content added nothing beyond making the operation available. C6 should differ from C1 on knockout-recovery (§10.5) and cross-primitive transfer (§10.6). |
| **C7** | Order permutation: 5 lesson orderings × 3 runs | Path dependence | Report variance; a single ordering is n=1 |

**C6 is the condition I would most expect you to omit and most insist you run.** It is the direct test of whether "one-shot Teacher lesson" is doing anything a `pip install` would not.

---

## 9. Preregistered success / failure criteria

Written before results. Do not adjust after seeing them.

### 9.1 Validity gates (any failure voids the run)

| Gate | Threshold |
|---|---|
| C2 solve rate on taught items | < 15% |
| NC2 (`mod_int`) solve rate | = 0% |
| Teacher tokens during scoring | = 0 |
| Irreducibility re-verified against current library before each phase | Pass |
| Lesson/item structure-hash disjointness | ∅ |
| G-ACQ (one clean decomposable artifact per lesson) | Pass |
| Positive controls detected by irreducibility test (`min_int`@3, `sub_int`@2) | Pass |

### 9.2 Primary criteria — decomposition

| Metric | Success | Kill |
|---|---|---|
| **Synthesis-vs-retrieval mix** on taught items (§10.1) | BUILD/ADAPT ≥ 50% of solves after the first item in each family | RUN ≥ 80% ⇒ **cache confirmed, kill** |
| **Artifact utility singleton fraction** (§10.3) | < 0.35 | > 0.65 ⇒ cache |
| **Library growth** over 132 taught items | sublinear; ≤ 0.5 new entries per item after warm-up | ≈1 entry per item ⇒ cache |
| **Cross-family reuse** of each taught primitive | called from ≥4 of 5 families | ≤2 families ⇒ bundle |
| **Embedding-depth spread** of f in solving Blueprints (§10.4) | f appears at ≥2 distinct depths, root-fraction < 0.6 | root-fraction > 0.9 ⇒ f *is* the task |

### 9.3 Secondary criteria

| Metric | Success |
|---|---|
| Solve rate, C1 taught items, Teacher-OFF | ≥ 70% |
| C1 − C3 gap | ≥ 25 points (knowledge beyond raw budget) |
| **FCER** (passes TaskSpec, fails ≥1 fixture) | ≤ 5% |
| Search nodes per solved item, C1 vs C3 | ≥ 3× reduction |
| C1 vs C5 (calibrated k-NN) at matched coverage | ≥ 25 points |
| AURC across budget sweep | C1 dominates C5 frontier |
| pass^5 vs pass^1 | gap ≤ 10 points |
| Variance across 5 lesson orderings | non-overlapping CIs vs C2 |

### 9.4 Kill / pivot thresholds

**Kill the decomposition hypothesis if any of:**
- RUN accounts for ≥80% of taught-item solves after the first item per family.
- Library grows ≈1 entry per solved item.
- Singleton fraction of artifact utility >0.65.
- C6 ≈ C1 on *every* measure including knockout-recovery and cross-primitive transfer — i.e. the lesson is indistinguishable from installing a library.

**Void and rerun if:** C2 >15%, any NC2 solve, or non-zero Teacher tokens.

---

## 10. The decomposition test — mechanical discrimination

This is the core of the experiment. Six independent signals; report all six.

### 10.1 Controller-action distribution (cheapest and most diagnostic)

For every scored item, log which controller path produced the solution: RUN / ADAPT / BUILD / TEACH.

- **Library signature:** the first item in a family is BUILD; later items in the *same* family are also BUILD or ADAPT, because each has a genuinely different structure. The taught primitive is called *inside* each newly synthesized program.
- **Cache signature:** the first item in a family is BUILD, and items 2..n are **RUN** of that same stored program with different inputs. In that case your "44 items" were structurally 5 items with 39 re-runs.

Report the RUN/ADAPT/BUILD/TEACH breakdown per primitive and per family. **This single table would have caught the `intent-pattern:file-extreme-filename` result immediately.**

### 10.2 Program call graph

Build the directed graph: library entry → library entries it calls. For each taught primitive `f`:

- **fan-in** = number of distinct library entries whose Blueprint calls `f`
- **item-utility** = number of distinct *scored items* whose solution transitively calls `f`

Healthy: fan-in ≥ 15, item-utility ≈ 44 spread across all families.
Bundled: fan-in ≈ 1 with a single wrapper carrying everything, or fan-in ≈ 44 wrappers each used exactly once (see §10.3).

### 10.3 Artifact utility distribution

For every library entry, compute item-utility. Then report the **distribution shape**, not the mean:

- **singleton fraction** = fraction of entries used by exactly one scored item.
- Gini coefficient of the utility distribution.

A library has a fat head (a few high-utility abstractions) and a modest tail. A cache is almost all singletons. This is the same measurement that would have exposed the earlier pilot's "3.33 successes per artifact" as meaningless — the ratio was fine; the *distribution* was one artifact and 39 wrappers.

### 10.4 Embedding depth of the taught primitive

For each solving Blueprint, record the structural depth at which `f` appears.

- Healthy: a spread — depth 0 in F1, depth 1 in F2, depth 1–2 in F3/F4, depth 1 in F5. Root-fraction well below 1.
- Bundled: `f` is always at the root, meaning `f` is not a *component* of the solution, `f` **is** the solution and the surrounding structure was memorized with it.

### 10.5 Knockout — and the correct expectation for each target

Two distinct knockout targets with **different predicted signatures**. Conflating them is what made the earlier pilot's 1.0/1.0 uninformative.

**(a) Knock out the taught primitive `f`.**
Expected: **binary** loss on exactly the f-dependent items, zero collateral. Precision and recall near 1.0. This is *not* evidence of a library — a cache would score identically. It is only a specificity check confirming your attribution machinery works.

**(b) Knock out mined abstractions built above `f`.**
Expected: **graded** degradation — higher search cost, alternative Blueprints, some items still solved via ADAPT re-derivation. This is the library signature and it is the one that carries evidential weight.

**(c) Recovery test on `f` (Teacher OFF).** Because `f` was taught as a *decomposable depth-4 Blueprint*, ADAPT can in principle seed from its subexpressions and re-derive it. Measure: after removing `f`, with budget raised to `D_max + 1`, does the system reconstruct a denotationally-equivalent program? Report success, cost ratio, and whether the reconstruction is structurally identical (suspicious — check for a surviving copy) or different (strong evidence of genuine synthesis).

**This is the sharpest discriminator between C1 and C6:** the taught-Blueprint condition should be recoverable; the opaque-host-atom condition should not be. If they behave identically, the Blueprint content is inert.

### 10.6 Cross-primitive transfer (bonus, free)

T1 (`clamp`) and T2 (`abs_diff_string_len`) share the max-of-negations subexpression. Prediction: after teaching T1, search cost on T2's *witness derivation* should drop, and the abstraction miner should discover the shared subgraph — the same mechanism you already demonstrated on `3x`/`4x` → `2x` → `8x`.

Measure: nodes explored to derive T2's witness, with and without T1 in the library. A ≥2× reduction plus a mined shared abstraction is the strongest single piece of evidence this substrate can produce, because it replicates a mechanism you have already validated, on a non-trivial family, with a preregistered prediction.

---

## 11. Is the current substrate sufficient?

### 11.1 Verdict

**Sufficient for the decomposition/reuse question in §0.3. Not sufficient for a compositional-generalization claim.** Run the former; do not claim the latter.

### 11.2 Why not compositional generalization

Three structural limits, all verified against your capability list:

1. **`Bool` is a terminal type.** `core.eq_int` and `core.gte_int` produce `Bool`; **nothing consumes `Bool`.** There is no conditional composition anywhere in the language. An entire dimension of compositional structure is absent.
2. **`List<String>` is nearly inert.** It has exactly three consumers (`argmax_string_len`, `argmin_string_len`, `list_len_string`) and exactly one producer besides task inputs (`fs.list_filenames`). No construction, no `cons`, no `map`, no `filter`. The collection dimension of composition does not exist.
3. **Structural variety is thin.** With `Bool` terminal and lists inert, "novel structure" collapses to "different tree shape over `{add, mul, max}` plus three measure functions." The generator found 10–11 distinct structures per primitive, which is enough for a decomposition study and far short of what a compositional-generalization claim needs.

### 11.3 Minimal additions, if and only if you later want the stronger claim

Do **not** add these for this experiment. Listed so you can plan, and with their costs stated:

- **`core.if_int(Bool, Int, Int) -> Int`** — one operator, makes `Bool` non-terminal, unlocks conditional composition. **Serious hazard:** `if` + `eq_int` lets a deep-enough expression build a *lookup table* over any finite probe set, which can make a "provably irreducible" primitive reachable purely by table-encoding. If you add it, probe sets must be strictly larger than `D_max` can table-encode, and the irreducibility enumeration must be re-run from scratch.
- **`core.map_string_len(List<String>) -> List<Int>` + `core.max_list_int(List<Int>) -> Int`** — unlocks the collection dimension without introducing lambdas or recursion.
- Raising `D_max` — note this **invalidates every primitive in §1.2** (all are depth 4). If `D_max` rises to 4, you need depth-5 primitives and must redo §3 from scratch.

Each addition is a version bump that invalidates prior checkpoints and requires full re-verification. That is the price, and it is why I am not recommending any of them now.

---

## 12. Protocol and stopping gates

### Phase 0 — Instrumentation and calibration (no scored items)
1. Implement logging: controller action per task, library delta per task, call graph, per-item artifact provenance, search nodes, wall clock, Teacher token counter with a hard zero assertion.
2. **Measure `D_max`** on a calibration ladder. Preregister the value. **GATE: if `D_max ≥ 4`, STOP** — every primitive in §1.2 is disqualified; return to §3 with depth-5 candidates.
3. Run the irreducibility enumeration. **GATE:** `min_int` detected at depth 3 and `sub_int` at depth 2 (positive controls); `clamp_int`, `mid_int`, `mod_int` not detected.
4. Freeze and hash: capability list, `D_max`, constant pool, probe sets, lesson templates, item generator seed, prompt/config hashes.

### Phase 1 — Item generation and audit (no EKG contact)
5. Run the generator. Apply the §3.3 item-level irreducibility gate; report discards.
6. Run all §7 leakage measurements. **GATE:** every threshold met.
7. Freeze `bench_v04.json`; hash it; commit `PREREGISTRATION.md` with §9 thresholds verbatim.

### Phase 2 — Baselines first (deliberate ordering)
8. Run **C2** (lesson-withheld) on all taught items. **GATE: if solve rate ≥15%, STOP** — items are not budget-irreducible.
9. Run **C4** (never-taught controls). **GATE: if any NC2 item solves, STOP and void** — host leakage or grader error.
10. Run **C3** (raised budget) and **C5** (k-NN, threshold-swept).

Running baselines before the treatment is intentional: the two stopping gates that would void the experiment are both baseline gates, and discovering them after the treatment run invites rationalization.

### Phase 3 — Teaching
11. Deliver exactly one frozen lesson per taught primitive. Log the library delta.
12. **GATE G-ACQ:** one clean decomposable artifact per lesson, no baked-in constants. Any violation drops that primitive from the run.
13. Re-run the §3 irreducibility check against the **updated** library. **GATE:** taught primitives must still not be base-reachable at `D_max` via other library entries.

### Phase 4 — Scored evaluation
14. Run **C1** on all 184 items, Teacher OFF, zero-token assertion.
15. Run **C6** (opaque host atom, no lesson) on all taught items.
16. Repeat 11–15 across **5 lesson orderings × 3 runs** (C7).

### Phase 5 — Decomposition analysis
17. Compute all six §10 signals.
18. Knockout (a) taught primitives, (b) mined abstractions, (c) recovery under raised budget.
19. Cross-primitive transfer measurement (§10.6).

### Phase 6 — Adjudication
20. Evaluate against §9 thresholds **as written**. Report the full controller-action table, the artifact-utility distribution, and the library growth curve regardless of outcome.
21. If any §9.4 kill threshold fires, record the kill. Do not re-run with adjusted thresholds.

---

## 13. What this experiment can and cannot tell you

**Can:** whether the Teacher's decomposable abstraction becomes a shared semantic unit reused inside independently synthesized programs, or whether EKG accumulates one task-shaped program per task. Whether the taught Blueprint's *content* matters beyond making an operation available (C1 vs C6). Whether abstraction mining generalizes beyond the `2x`/`3x`/`4x` demonstration to a non-trivial family. Whether library growth is sublinear.

**Cannot:** support any claim about natural-language understanding (there is no NL in it), compositional generalization in the CFQ/COGS sense (§11.2), or transfer to the filesystem domain.

**Cost:** roughly two to three weeks with the generator and reference module provided, versus months to build a filesystem substrate first.

**If it fails:** you will know that this architecture caches rather than decomposes, on the substrate where it is most favourable to it, before spending a quarter on substrate expansion. That is the cheapest available route to a decisive negative, which is what you asked for.
