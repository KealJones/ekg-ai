# Real Teacher Episode 001 — Exact Handoff Record

This is the first non-mocked outer-loop Teacher episode using the conversational GPT-5.6 Sol instance as Teacher.

Nothing below is a hypothetical transcript. The JSON artifacts in `real-teacher-run/` are the exact app/teacher handoffs used in this run.

## Handoff 1 — App -> Teacher

Artifact: `real-teacher-run/01-app-teacher-request.json`

The app:
- retrieved `abstract.double` with retrieval score 150;
- had no contextual utility history;
- had no trustworthy pre-search primitive-depth estimate;
- abstained to primitive-only with reason `insufficient-evidence`;
- emitted the impasse asking how to decide activation without running both complete search arms every time.

## Handoff 2 — Teacher -> App

Artifact: `real-teacher-run/02-teacher-response.json`

The conversational GPT-5.6 Sol Teacher proposed:
- reject retrieval score as sufficient;
- test a bounded symmetric shallow probe of primitive-only vs learned-first search;
- extract provisional criterion `activation.unknown-prior-probe`;
- extract reusable teacher strategy `teacher.seek-cheap-discriminator`.

This was a proposal, not committed truth.

## Handoff 3 — App validates Teacher proposal

Artifacts:
- `real-teacher-run/03a-app-validation-result-BUGGY.json`
- `real-teacher-run/03-app-validation-result.json`

The first app validation run exposed an implementation bug in the validation harness: it read the wrong full-search candidate-count field and mislabeled the eventual better arm. The buggy result was preserved rather than overwritten.

After fixing that plumbing bug, the corrected experiment showed:

Easy triple:
- depth 1: primitive 4 unsolved; learned 5 unsolved
- depth 2: primitive 5 solved; learned 10 solved
- eventual better: primitive
- shallow probe correctly chose primitive

Hard sextuple:
- depth 1: primitive 4 unsolved; learned 5 unsolved
- depth 2: primitive 49 unsolved; learned 81 unsolved
- full: primitive 99 solved; learned 86 solved
- eventual better: learned
- shallow probe had no decisive signal

App decision:
- `activation.unknown-prior-probe` **REJECTED**
- reason: shallow bounded probing did not reliably predict the eventual better search arm across contrasting cases.

This is important: the app rejected the actual Teacher's first cognitive proposal.

## Handoff 4 — Rejection -> Teacher

Artifact: `real-teacher-run/04-teacher-response-after-rejection.json`

Teacher received the measured rejection and revised its hypothesis.

Teacher explicitly rejected:
- simply increasing probe depth, because it degenerates toward running both full arms;
- early candidate-count advantage, because the hard case looked worse for learned-first at depth 2 even though learned-first eventually won.

Teacher proposed:
`activation.explore-then-exploit`

Rule:
When contextual utility is unknown and no cheap validated discriminator exists:
1. spend a bounded number of representative episodes measuring both arms;
2. store contextual utility evidence;
3. derive a prior;
4. stop dual-arm measurement and exploit the prior on later similar episodes.

Teacher also extracted:
`teacher.convert-uncertainty-to-exploration`

Question strategy:
When no reliable feature predicts the better action, ask whether bounded exploration can gather reusable evidence and amortize uncertainty over future decisions.

## Handoff 5 — App validates revised Teacher proposal

Artifact: `real-teacher-run/05-app-second-validation-result.json`

The app executed real searches.

Easy-scale context:
Exploration 1:
- primitive: 5 candidates, solved
- learned: 10 candidates, solved

Exploration 2:
- primitive: 5
- learned: 10

Graph-derived prior after two observations:
- observations: 2
- mean savings: -5
- learned wins: 0
- primitive wins: 2

Third task:
- app chose `primitive-only`
- measured only the chosen arm
- solved in 5 candidates

Hard-scale context:
Exploration 1:
- primitive: 99 candidates
- learned: 86 candidates

Exploration 2:
- primitive: 99
- learned: 86

Graph-derived prior:
- observations: 2
- mean savings: +13
- learned wins: 2
- primitive wins: 0

Third task:
- app chose `learned-first`
- measured only the chosen arm
- solved in 86 candidates

App decision:
- `activation.explore-then-exploit` **ACCEPTED**

## What was Teacher vs App?

Teacher:
- interpreted the impasse;
- proposed hypotheses;
- proposed discriminating experiments;
- proposed provisional reusable criteria;
- revised its proposal after rejection;
- extracted question-selection strategies.

App:
- created the impasse;
- constructed the Teacher request;
- schema-validated Teacher output;
- materialized the trace into graph-native structures;
- ran the actual searches;
- caught/revealed a validation harness bug;
- rejected the first Teacher proposal;
- returned measured rejection evidence;
- executed the second experiment;
- derived utility priors from graph evidence;
- accepted the second criterion only after measured validation.

## Teacher intervention count

This episode required two real conversational Teacher interventions:
1. shallow-probe proposal — rejected;
2. explore-then-exploit proposal — accepted.

The accepted strategy's purpose is specifically to reduce future comparison/teacher cost by converting cold uncertainty into reusable contextual evidence.

## Next unresolved Teacher question

From the accepted trace:

> What contextual key is specific enough for utility priors to transfer without overfitting or mixing easy and hard regimes?

That should become the next impasse rather than being silently answered in host code.
