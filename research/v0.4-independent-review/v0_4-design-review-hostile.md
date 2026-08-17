# Hostile Review: v0.4 Experimental Design

**Posture:** adversarial. I am trying to find the way this design fails, not to make it feel achievable.

**Headline:** the 0/120 audit is the most important result this project has produced, and you have not yet drawn its main implication. Before evaluating v0.4, read §1. It changes what the v0.4 experiment would even be testing.

**Verdict on v0.4 as proposed:** the causal *structure* is correct. The *content* has three defects that would make a successful run uninterpretable — reducible held-out primitives (§4), an unconstrained "teach the base vocabulary" step (§5), and a base-vocabulary derivation that is circular with the test set (§3). All three are fixable. Whether they are worth fixing is a separate question I address in §12.

---

## 1. What 0/120 actually tells you

You reported it as a logistics finding: EKG lacks the substrate the corpus assumes. That is true and it is not the interesting part.

The interesting part is retrospective. In the earlier pilot, **one Teacher intervention** produced an artifact called `intent-pattern:file-extreme-filename` that made six held-out filesystem items succeed. You now know that at checkpoint 0 the system possessed **none** of `fs.enumerate`, `fs.recursive`, `file.type`, `file.mtime`, `file.path`, `file.content`, or `fs.root_binding`.

So that single artifact must have carried enumeration, recursion, type discrimination, name extraction, and the selection operator — as a bundle. It was not a primitive composed with known structure. It was a task-family-shaped package.

That is the cache hypothesis, confirmed by your own instrumentation, from a direction nobody was looking. In my prior review I wrote that the durable artifact was "cache-shaped" and that the test would be whether intent-patterns grow linearly with task families. The 0/120 audit answers that question early and in the direction that hurts: at checkpoint 0 there is no decomposed substrate for patterns to compose *over*, so every new task family necessarily requires a new bundle.

**Two consequences you should absorb before designing anything:**

1. The earlier pilot's 13/13 and its knockout result should be formally downgraded in your records. Not merely "uninterpretable due to coupling" — actively explained by a mechanism inconsistent with the architectural hypothesis. Write that down.

2. v0.4 as proposed does not test the architecture as it currently exists. It tests the architecture *after you build it a semantic substrate*. That is a legitimate experiment, but it is a different one, on a different system, and it should be described that way rather than as a continuation.

---

## 2. Is this the correct causal design? (Q1)

The skeleton is right: freeze a proven base vocabulary → select held-out primitives disjoint from it → constrain items to base + exactly one held-out primitive → teach once → evaluate Teacher-OFF against calibrated baselines. That is the standard primitive-holdout design and it is what the claim requires.

Four structural gaps:

**(a) Novel primitive is necessary but not sufficient — the *composition* must also be novel.** An item using one new primitive inside a structure isomorphic to something seen during base-vocabulary teaching tests substitution, not composition. You need compound-divergence measurement *over the base vocabulary* between the base-teaching corpus and the held-out test items, reported as a number, exactly as in the original review. Without it, "novel composition" is an assertion.

**(b) No negative control primitive.** Designate one primitive that is held out and **never taught**. Its items must fail. If they succeed, something is leaking — search is deriving the primitive, seed machinery contains it, or the base vocabulary is more powerful than you think. This is the cheapest high-value addition to the design and it is absent. Budget ~25 items for it.

**(c) Checkpoint 0 is no longer naive and must be characterized as a treatment condition.** After teaching ~15 base primitives, the system's durable state is large. The held-out lesson lands in a rich context. You must report base-state size, composition, and the growth curve from the base-teaching phase itself — otherwise "one lesson did this" hides "one lesson plus fifteen prior lessons did this."

**(d) The design has no falsification threshold for the base phase.** If base-vocabulary teaching itself requires many lessons per primitive, extensive Teacher tokens, or produces bundled rather than decomposed artifacts, the held-out experiment is already answered negatively and you should stop before running it. Preregister that stopping rule. See §5.

---

## 3. Is the base-vocabulary idea too broad, and will it bake in the held-out concepts? (Q2, Q3)

Your step 2 lists candidate base semantics including "generic filtering over collections, simple glob/regex/string predicates, environment/time binding." Step 3 says to derive the vocabulary from an external corpus "rather than from the 120 v0.3 items alone."

Both steps contain the same circularity, and step 3's hedge does not remove it.

**The circularity:** if the base vocabulary is defined as "whatever the corpus requires minus the held-out primitive," then you have guaranteed by construction that every test item is solvable given base + one primitive. The experiment can then only measure whether EKG *finds* the composition, not whether the composition represents transferable knowledge. That is a search-efficiency experiment wearing a generalization experiment's clothes.

**The fix is corpus partitioning, not corpus choice.** Split your source corpus into three slices by a mechanical, content-blind rule (e.g., record-index modulo 3, or disjoint index ranges), fixed and hashed before anything else:

| Slice | Use | Constraint |
|---|---|---|
| **S1** | Derive the base vocabulary. Inspect freely. | Never supplies test items. |
| **S2** | Base-capability verification tests (§6). | Never supplies test items. |
| **S3** | Held-out item selection. **Never inspected during vocabulary design.** | Sealed until step 6. |

The base vocabulary is then derived from S1 only. Whether it happens to cover S3's needs is an empirical question with an answer you don't control — which is exactly what makes it a test. If S3 items turn out to require semantics outside the base vocabulary, those items are **discarded before selection** by a mechanical rule, and you report the discard rate. A high discard rate is itself informative: it means your base vocabulary is under-general.

The v0.3 120 items must be in none of these slices. They are burned.

**On breadth:** the vocabulary is not "too broad" in the abstract. The failure mode is specific: **a base vocabulary that can express the held-out primitive is not a base vocabulary, it is a solution.** Which brings us to the design's most serious defect.

---

## 4. Your held-out primitives are probably not primitives (Q3, continued)

Take the three from v0.3 and ask whether each is derivable from a reasonable base vocabulary:

- `predicate.within_closed_int_window` ≡ `and(gt(x, lo), lt(x, hi))`. If base includes comparison and conjunction — and it must, for the corpus to be tractable — this primitive is a **depth-2 composition of base operations**. A system with any search at all can derive it without learning anything.
- `logic.negate_predicate` ≡ boolean `not`. If base includes any boolean algebra, this is *in* the base. If base excludes boolean negation, the base vocabulary cannot express most filesystem tasks.
- `predicate.string_contains` is the only one with a plausible claim to irreducibility, and even that depends on whether base includes substring/regex operations — which your own candidate list explicitly includes ("simple glob/regex/string predicates").

**This means a successful v0.4 run using these primitives would prove nothing.** Success would be equally well explained by "search found a two-node composition." Failure would be equally well explained by "search budget too small." The primitive-holdout design only has teeth when the held-out primitive is *not reachable* from the base vocabulary within the search budget.

### The irreducibility gate

Add a mandatory, mechanical pre-selection check for every candidate held-out primitive X:

> Enumerate all compositions of base-vocabulary operations up to depth *k* (where *k* is the preregistered per-item search budget, or higher). If any composition reproduces X's denotation on a battery of probe fixtures, **X is not eligible as a held-out primitive.**

Report, for each accepted primitive, the depth at which the enumeration was run and the fact that it found nothing. If enumeration to depth *k* is intractable, use random sampling and report coverage — but a primitive you cannot prove irreducible should be treated as reducible.

**What survives this gate?** Not conjunctions of comparisons. Candidates with genuine irreducibility relative to a filter/map/compare base:

- **Calendar/temporal resolution** — day-of-week from a timestamp, "last business day," week-number. Not derivable from arithmetic on epoch seconds without embedding the calendar algorithm.
- **Canonicalization relations** — path normalization, case-folding equivalence classes, unicode normalization.
- **Non-obvious aggregations** — median, mode, n-th percentile, top-k-with-tie-policy. Derivable in principle but at depths well beyond typical budgets; report the depth.
- **Domain relations with external semantics** — MIME-type-from-content, symlink-target-resolution, permission-bit-to-capability mapping.
- **Structure-sensitive predicates** — "is a prefix of," "is an ancestor path of," "is the same inode as."

These are also better tests because they are *semantically* new, not merely syntactically new. Composing "day-of-week" with known filtering is a real compositional demand. Composing "and(gt, lt)" with known filtering is not.

---

## 5. Step 4 — "teach/build those base semantics into EKG" — is where the experiment dies quietly

This is one line in your plan and it is the highest-risk step in the entire design. It admits two radically different implementations, and the plan does not say which:

**(a) Hand-engineer the base vocabulary into seed machinery.** Then the base vocabulary is a new, large, undocumented location where capability lives — precisely the hidden-seed-machinery confound the whole design is meant to eliminate. You would have replaced "hidden seed machinery" with "explicit but hand-built seed machinery," which is better for interpretation but leaves the scientific claim very narrow: *given a hand-built substrate, one lesson composes*. That is a claim about a compiler, not about learning.

**(b) Teach the base vocabulary through the same Teacher-lesson mechanism used for held-out primitives.** Then base acquisition is itself governed by the architectural hypothesis, and it becomes measurable.

**Take (b), and recognize that it is the better experiment.**

Under (b), the base-vocabulary phase gives you **~15 one-shot acquisition events instead of 3**. Every one of them is an instance of the phenomenon you care about. You get:

- A learning curve over 15 primitives instead of 3 data points.
- 15 opportunities to measure whether artifacts come out **decomposed or bundled** — which, per §1, is the actual open question about this architecture.
- Durable-state growth measured across 15 acquisitions: does artifact count grow ~1 per primitive (library) or ~1 per task family (cache)?
- A cross-primitive reuse matrix: does `file.mtime` get referenced by items that also use `fs.recursive`, or does each primitive live in its own silo?

**This reframes the project.** The base-vocabulary construction stops being a three-month prerequisite and becomes the main experiment. If base acquisition shows decomposed, reusable, cross-referenced artifacts, the held-out experiment is worth running and will probably succeed. If base acquisition produces 15 bundles, you have your answer months earlier and at a fraction of the cost.

**Preregister the stopping rule now:**

> After teaching the base vocabulary, if (i) mean lessons-per-primitive > 2, or (ii) cross-primitive artifact reuse rate < 30%, or (iii) durable artifact count grows superlinearly in primitives taught, then the architecture has not demonstrated decomposed acquisition and the held-out experiment is not run.

If you implement (a) instead of (b), say so explicitly in the writeup, and narrow the claim accordingly. Mixing them — hand-building some primitives and teaching others without recording which — would be the worst outcome, and it is the default outcome if this step stays one line long.

---

## 6. Low-level operations only, or higher-level procedures? (Q4)

**Low-level only, with one carve-out.**

The rule: a base operation is admissible if it is **atomic relative to the ontology** — it cannot be expressed as a composition of other base operations. Anything expressible as a composition of base operations must *not* be in the base, because including it pre-solves compositional work and inflates results.

Concretely admissible: `enumerate(dir)`, `recurse(collection)`, `get_attr(entity, field)`, `filter(collection, predicate)`, `map(collection, fn)`, `compare(a, b, op)`, `and/or/not`, `bind_root(path)`, `bind_now()`, `match_glob(str, pat)`, `match_regex(str, pat)`.

Not admissible: `find_files_matching(dir, pattern)` (= recurse ∘ enumerate ∘ filter ∘ match_glob), `list_recent_files(dir, n)`, anything named after a task.

**The carve-out:** operations that are atomic *in the world* even though they look composite, because their semantics come from outside the ontology — `parse_timestamp`, `read_file_content`, `stat`. These are I/O boundaries, not compositions. Admit them, list them separately in the frozen inventory as "grounding operations," and make sure none of them secretly performs filtering or selection.

**The test to apply to each candidate:** *Is this operation named after a task, or after a semantic relation?* Task-named operations are bundles. This is the same test that would have caught `intent-pattern:file-extreme-filename` in the earlier pilot.

**One consequence worth stating plainly:** a strictly atomic base vocabulary makes the benchmark *harder*, and your held-out success rates will be lower than they would be with a permissive vocabulary. That is correct and you should resist the pressure to loosen it when the numbers come in. Preregister the vocabulary and its atomicity justification per operation, hash it, and treat any later addition as a version bump that invalidates prior checkpoints.

---

## 7. Verifying checkpoint-0 possession of each base semantic (Q5)

Your step 5 says "verify each base semantic at checkpoint 0 on independent non-benchmark tests." Correct instinct, insufficient specification. What "possession" means is the whole game, and a weak definition here silently reintroduces the 0/120 problem in reverse — you'll certify capabilities the system has only fragilely.

**Possession of base operation *o* is established iff all of the following hold:**

1. **Multi-instance.** ≥10 probe tasks per operation, drawn from slice S2, each exercising *o* in a different argument configuration and a different surrounding structure.
2. **Multi-fixture.** Each probe evaluated on ≥3 fixtures with differing denotations (same standard as the benchmark).
3. **Compositional, not isolated.** At least half the probes must use *o* **inside a composition** with other base operations, not standalone. An operation that works alone but not in composition is not possessed — and given §1, this is the failure mode you should most expect.
4. **Reliability.** pass^5 ≥ 0.9 (solved on all 5 independent runs), not pass^1. A stochastically-succeeding operation is not a foundation.
5. **Teacher-OFF**, verified zero Teacher tokens.
6. **Budget-bounded.** Succeeds within the same per-item search budget that the held-out experiment will use. An operation reachable only with 10× budget is not available at the budget where it matters.
7. **Ablation-confirmed.** Removing *o*'s artifact breaks precisely the probes that use *o*. This reuses your existing knockout machinery and catches the case where a probe succeeds via some other route.

An operation failing any criterion is **not in the frozen inventory**, and every item requiring it is discarded from the held-out pool before selection.

**Also record, for each operation, the *bundling profile*:** how many distinct artifacts implement it, and whether those artifacts are shared with other operations. This is your direct measurement of the §1 concern, taken at the moment it is cheapest to take.

**And verify the inventory itself independently.** The inventory is an artifact built by the same process that built EKG — the coupling problem from the previous review applies to it. At minimum: the probe tasks come from S2 (never inspected during base teaching), the probe authoring is done before base teaching, and the pass/fail determination is mechanical against reference denotations.

---

## 8. Reuse the NL2Bash pool, or source fresh? (Q6)

**Reuse NL2Bash as a corpus; do not reuse the v0.3 pool as items.**

The 120 v0.3 items are burned, for three independent reasons: they were adjudicated with the three primitives in view; I authored fixtures knowing the primitives; and they have been discussed in detail with the project owner. Even unobserved by EKG, they are contaminated as *design* inputs.

The wider adjudicated pool (the 137 accepted items from the earlier round) is contaminated in the same way and for the same reasons. Do not draw from it.

The remaining ~12,000 NL2Bash records are fine, **provided you partition first** (§3) and hold S3 sealed. NL2Bash's advantages remain: externally authored utterances, real user phrasing, and — critically — denotations derivable by executing reference implementations rather than by authoring, which is the single strongest anti-coupling property available to you.

**One caution:** NL2Bash is public and pre-dates every current model's training cutoff. Your Teacher has almost certainly seen it. That does not invalidate held-out testing of EKG (EKG is not the Teacher), but it does mean the Teacher's lessons may be unusually good for this corpus, and it means any LLM baseline you run is partially contaminated. Report this. If you can afford it, hold a small confirmation set from a corpus that post-dates the Teacher's cutoff or is private.

**If NL2Bash's base-vocabulary demands prove too heavy** — and the 0/120 result suggests they might — consider a corpus with a shallower substrate requirement. See §12.

---

## 9. Preregistered gates before any scored run (Q7)

Nothing scored runs until every gate below passes. Each is mechanical and each produces a number that goes in the writeup.

### Vocabulary gates
| Gate | Threshold |
|---|---|
| Base vocabulary derived from S1 only, hashed, with per-operation atomicity justification | Documented |
| No base operation is expressible as a composition of other base operations | Verified by enumeration to depth 3 |
| Base operations named after semantic relations, not tasks | Manual audit, documented |
| Grounding operations listed separately; none performs filtering or selection | Documented |

### Possession gates (per base operation)
| Gate | Threshold |
|---|---|
| Probe tasks from S2, authored before base teaching | ≥10 per operation |
| Compositional probes | ≥50% of probes |
| Multi-fixture, differing denotations | 3 per probe |
| Reliability | pass^5 ≥ 0.90 |
| Teacher tokens during verification | 0 |
| Within held-out search budget | Yes |
| Knockout specificity | ≥0.90 |
| Bundling profile recorded | Documented |

### Base-acquisition gates (the §5 stopping rule)
| Gate | Threshold |
|---|---|
| Mean lessons per base primitive | ≤2 |
| Cross-primitive artifact reuse rate | ≥30% |
| Durable artifact growth in primitives taught | Sublinear or linear, not superlinear |

### Held-out primitive gates (per primitive)
| Gate | Threshold |
|---|---|
| **Irreducibility**: not reproducible by base composition | Verified to depth ≥ search budget |
| Not present in frozen base inventory | Verified |
| Not exercised by any base-teaching lesson | Audited against frozen lesson transcripts |

### Item gates (per primitive)
| Gate | Threshold |
|---|---|
| Items drawn from sealed S3 | Yes |
| Every item = exactly 1 held-out primitive + base-only otherwise | Mechanical check against referenceSpec |
| Item count | ≥40 |
| Semantic families | ≥4 |
| Compound divergence (base-teaching corpus ‖ test items) | >0.6 |
| Atom divergence | <0.05 |
| Max 4-gram overlap with any base-teaching lesson or probe | 0 items above threshold |
| Bag-of-words k-NN ceiling on test items | <20% |
| 3 fixtures per item, ≥2 distinct denotations | Yes |
| Denotations derived by reference execution, not authored | Yes |

### Control gates
| Gate | Threshold |
|---|---|
| Untaught negative-control primitive included | ≥25 items |
| Degenerate-policy floors computed | Documented |
| Baselines with swept abstention thresholds implemented | B0–B4 minimum |
| Prompts, configs, budgets frozen and hashed | Documented |

### Analysis gates
| Gate | Threshold |
|---|---|
| Seeds | ≥5 orderings × ≥3 runs |
| Test evaluations budgeted | ≤3, logged |
| Success criteria written and committed before run | Yes |

---

## 10. New leakage and coupling risks from teaching base first (Q8)

Six, in rough order of how likely they are to bite you.

**(a) Base lessons anticipating held-out structure.** A base lesson for `filter` that happens to demonstrate filtering-within-a-range hands over most of a range-window primitive. *Mitigation:* freeze all base-lesson transcripts, hash them, and audit them against the held-out items **after selection** — as a reported audit, never as a filter. Report max n-gram and structural overlap.

**(b) Teacher-carried compositional scaffolding.** The same Teacher teaches base and held-out primitives. Its framing of base operations may implicitly encode how they compose, so the "novel composition" was partly supplied. *Mitigation:* constrain base lessons to single-operation demonstrations with no multi-operation examples; audit and report violations. If the Teacher cannot teach an operation without composing it, record that — it is a finding.

**(c) Base-teaching order effects.** Fifteen sequential acquisitions are heavily path-dependent. *Mitigation:* ≥5 base-teaching orderings, carried through to the held-out phase. This multiplies your run cost and is not optional.

**(d) Inventory over-certification.** A capability certified as possessed but fragile makes held-out failures look like composition failures when they are substrate failures. *Mitigation:* the pass^5 and compositional-probe requirements in §7. This is the direct inverse of the 0/120 problem and equally fatal.

**(e) Vocabulary tuned to the corpus.** Iterating on the base vocabulary until S1 coverage is good, then finding S3 conveniently covered too. *Mitigation:* S1/S3 partition fixed and hashed before vocabulary work; S3 sealed; discard rate on S3 reported honestly as an outcome.

**(f) Enriched checkpoint 0 masquerading as naive.** After base teaching the system is substantially more capable, and "one lesson produced this" is true only against a heavily prepared background. *Mitigation:* report base-state size, artifact count, and the base-phase growth curve alongside every held-out result. Never present the held-out delta without the base-phase context.

---

## 11. What would now convince me, revised

Given §1, my bar has moved. The decomposition question is now upstream of the composition question, so:

1. **Base acquisition is decomposed.** ~15 primitives taught in ~15 lessons produce ~15 artifacts, not ~15 bundles, with cross-primitive reuse ≥30% and knockout specificity ≥0.9. **This is now the primary result.** Without it, nothing downstream matters.
2. **Irreducible held-out primitive composes.** ≥50% denotation accuracy on ≥40 items using an irreducibility-gated primitive, Teacher-OFF, ≥5 orderings, beating threshold-calibrated k-NN by ≥15 points.
3. **Negative control fails.** The never-taught primitive scores at or near the degenerate floor. If it doesn't, everything else is void.
4. **Durable state grows sublinearly** in task families solved, with the curve visibly diverging from the cache's Θ(N).
5. **Knockout shows graded degradation**, not binary loss — higher search cost, alternative plans, partial success — which is the library signature and is what the earlier pilot's perfect 1.0/1.0 did *not* show.
6. **Sealed-set agreement** within 3 points of the pre-registered prediction.

Results 1 and 3 are cheap relative to the rest and should be sequenced first.

---

## 12. The thing you may still be missing

Your plan is: **build a semantic substrate to fit the corpus.** The alternative is: **pick a corpus that fits the substrate you already have.**

The 0/120 result says EKG's substrate and NL2Bash's demands are mismatched by a wide margin. Closing that gap is months of engineering whose output is a *prerequisite*, not a result. And per §1, the honest reading of the audit is that this architecture has not yet demonstrated decomposed acquisition of anything — which is a question you can ask in any domain, including ones where the substrate already exists.

The earlier pilot mentioned working demonstrations in numeric operations, learned lexical mappings, and multi-step composition. **If checkpoint-0 EKG has a proven substrate in arithmetic or structured-data transformation, run the primitive-holdout experiment there instead.** Same design, same gates, same claim — "one lesson, novel composition, Teacher-OFF, beats calibrated k-NN" — at a fraction of the cost, and available in weeks rather than months.

An irreducible primitive over an arithmetic/data substrate is easy to construct: modular arithmetic, a specific rounding convention, a percentile with a tie policy, a base conversion, a checksum relation. External item sources exist for structured-data transformation. Denotations are computable by reference implementation, so the anti-coupling property that made NL2Bash attractive is preserved.

**Recommended sequencing:**

1. **Now (weeks):** primitive-holdout in the domain where EKG already has substrate. Include the untaught negative control. This answers the central question at current cost.
2. **Conditional on (1) succeeding:** build the filesystem base vocabulary via the Teacher mechanism, instrumented per §5, treating base acquisition as the experiment.
3. **Conditional on (2) showing decomposed acquisition:** run v0.4 filesystem held-out as specified above.

If (1) fails, you have saved a quarter. If (1) succeeds, (2) and (3) are worth doing and you will run them with a much better-founded expectation.

Building the substrate first inverts this: it commits the most expensive work to a prerequisite before the cheap decisive test has been run. That ordering is what I would push back on hardest.

---

## 13. Answers in brief

1. **Correct causal design?** Structure yes; content no. Missing: novel-composition measurement over the base vocabulary, an untaught negative control, characterization of the enriched checkpoint 0, and a falsification threshold for the base phase itself.
2. **Base vocabulary too broad / bakes in held-out concepts?** As specified, yes — it is derived from what the corpus needs, which guarantees solvability. Fix by corpus partitioning (S1/S2/S3) with S3 sealed.
3. **How to define it?** Atomic relative to the ontology; named after semantic relations not tasks; derived from S1 only; grounding operations listed separately; frozen and hashed with per-operation atomicity justification.
4. **Low-level or higher-level?** Low-level only, plus a documented carve-out for I/O grounding operations. Anything expressible as a base composition must not be in the base.
5. **How to verify possession?** ≥10 probes per operation from S2, ≥50% compositional, 3 fixtures each, pass^5 ≥ 0.9, Teacher-OFF, within budget, knockout-confirmed, bundling profile recorded.
6. **Reuse the pool?** Reuse NL2Bash the corpus; burn the v0.3 120 and the wider adjudicated pool. Partition first, seal S3. Note Teacher contamination on this public corpus and report it.
7. **Gates?** §9 — vocabulary, possession, base-acquisition, held-out-primitive irreducibility, item, control, and analysis gates.
8. **New leakage risks?** Six, in §10. The two most dangerous are base lessons anticipating held-out structure and inventory over-certification.

**And the one you didn't ask:** your three v0.3 primitives are almost certainly reducible to base compositions (§4). Even a perfectly executed v0.4 using them would be uninterpretable. Fix the primitive selection before anything else in this plan — it is cheap, it is upstream of everything, and it is currently the design's most load-bearing error.
