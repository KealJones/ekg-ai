# Verdict after Claude-style falsification pilot

## Verdict

# IN YOUR FUCKING FACE — PILOT EDITION

The project did **not** collapse under the first controls that should kill a glorified cache.

That is not the same as saying the architecture is proven.

### What survived

Teacher-OFF held-out pilot (13 test items, 3 denotation fixtures for every answer):

| System | Accuracy | Wrong answers |
|---|---:|---:|
| EKG learner after curriculum | **13/13 (100%)** | **0** |
| checkpoint-0 learner | 7/13 (53.8%) | 0 |
| exact memorization/cache | 2/13 (15.4%) | 0 |
| token-Jaccard nearest-neighbor cache | 8/13 (61.5%) | 5 |

The curriculum contained one Teacher intervention for the filesystem Intent pattern. Test-time Teacher calls were hard zero and test-time learning was disabled.

The learned filesystem knowledge is causally load-bearing in this pilot:
- Remove `intent-pattern:file-extreme-filename`: accuracy drops 13/13 -> 7/13.
- All six file held-outs fail after that knockout.
- No unrelated test item is broken by the knockout.
- Dependency precision = 1.0, recall = 1.0 on the predicted file-dependent set.
- Remove the two learned file programs: the same six tasks stop being answerable.

Reuse depth:
- one learned Intent pattern supports 6 held-out tasks;
- longest program supports 3 held-out tasks;
- shortest program supports 3 held-out tasks.

This is not the `100 successes / 95 procedures` failure shape. In this small family, learned artifacts are reused.

Two semantic-frame-disjoint structural composition items:
- EKG: 2/2
- token k-NN: 0/2

Again: **n=2 is evidence of plumbing, not statistical evidence.**

### What did NOT survive Claude's benchmark-quality standards

The pilot is not publication-grade.

- Gold semantic frames were authored in this same development session, not by independent annotators.
- Only 21 total items exist (8 curriculum + 13 test).
- The lexical-near test intentionally contains train/test semantic-frame overlap and five cross-split 4-gram-overlap pairs.
- Therefore its 100% lexical-near result cannot be described as compositional generalization.
- The learner has substantial hand-built seed parsing/native capabilities, so current baselines are not yet matched for all prior information/supervision.
- There are only two true structural-compound pilot items.
- No independent LLM/human has yet adjudicated the pilot gold.
- No 5-order × 3-seed learning experiment exists yet.
- No sealed split exists.
- We have not beaten RAG/fine-tuning baselines.
- We have not run a large enough artifact knockout matrix to establish that the graph, rather than scaffolding, explains most successes.

### What the pilot actually establishes

It establishes that the central mechanism is **not immediately falsified** by:
- Teacher-OFF evaluation;
- multi-fixture denotation;
- exact-cache control;
- lexical k-NN cache control;
- learned-artifact knockout;
- dependency-specificity checking;
- false-execution accounting.

The system is doing something more useful than exact memorization on this toy domain, and its learned filesystem artifacts are demonstrably load-bearing.

The scientifically interesting claim remains open.

## What would make the next letter decisive

Build a genuinely independent, leakage-audited compositional pilot with enough structural items, then require:

1. Teacher-OFF improvement from checkpoint 0.
2. Beat k-NN/RAG/fine-tune at matched supervision.
3. Zero or non-increasing false confident execution.
4. Semantic compounds disjoint from curriculum.
5. Learned artifacts causally explain a substantial fraction of gains.
6. A reuse distribution where a small set of artifacts supports many novel tasks.
7. Multiple curriculum orders/seeds.
8. Independent annotation/adjudication.

If that experiment fails, write the "you were right, this project is an elaborate cache" letter without excuses.

If it passes, upgrade this document from PILOT EDITION.
