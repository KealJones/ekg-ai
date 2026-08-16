# 30-Step Rip — Intent / Language Autonomy Run

This run started from v0.0.14 and executed thirty concrete milestones without changing the frozen legacy benchmarks.

1. Added ranked Intent candidates rather than requiring one lexical winner.
2. Added planner feasibility as a ranking signal.
3. Added score-margin resolution: close executable meanings clarify instead of guessing.
4. Clarification answers can select a relation (`Add` vs `Multiply`).
5. Clarification answers can supply missing numeric arguments.
6. Irrelevant clarification answers escalate to Teacher instead of looping.
7. Added explicit `then` language composition.
8. Extended the typed planner to execute sequential Intent constraints.
9. Composed language refuses to skip an unknown intermediate action.
10. Learned phrase grounding can carry implied numeric values (`sixfold -> ×6`).
11. Phrase semantics now have graph-native `phrase -> expresses -> relation` edges.
12. Added validated learning from user/execution corrections.
13. Added success/failure telemetry for phrase groundings.
14. Repeated failures can lower confidence enough to suppress a grounding.
15. Conflicting phrase semantics cannot silently overwrite durable knowledge.
16. Added behavioral inference of numeric language grounding from I/O examples.
17. Behavioral inference rejects patternless examples.
18. Behavioral inference refuses ambiguous examples.
19. A unique behavioral pattern can commit durable phrase knowledge without Teacher semantics.
20. Unknown/ambiguous language can automatically package a structured Teacher impasse.
21. Added a raw-language controller that interprets -> plans -> executes or escalates.
22. Froze `language-curriculum-v0.1` rather than hand-picking only success demos.
23. Added explicit language metrics: status correctness, executable correctness, Teacher-required count, Teacher-free rate, false executions.
24. Added an autonomous behavioral-learning curriculum for unknown numeric phrases.
25. Measured Teacher-required reduction before/after autonomous language learning.
26. Persisted provenance showing which phrase knowledge was learned from behavior rather than seeded.
27. Added a zero-tolerance false-execution metric to the frozen language report.
28. Added a stateful clarification session instead of treating clarification as a dead-end response.
29. Clarification can continue through multiple turns and then execute.
30. Bad clarification answers terminate in Teacher fallback rather than an infinite ambiguity loop.

## Primary result

Frozen 13-case language curriculum:

Before autonomous behavioral learning:
- Teacher required: 5 cases.
- Known executable/clarification behavior remained correct.

After learning three previously unknown phrases from behavioral evidence:
- Teacher required: 2 cases.
- Teacher-free rate: 11/13 = 84.6%.
- Executable correctness: 9/9.
- False executions: 0.

Autonomously learned:
- `sixfold -> Multiply ×6`
- `quadruple -> Multiply ×4`
- `decuple -> Multiply ×10`

The remaining Teacher cases are intentionally unsupported:
- `reverse this number`
- `address this number by six` (substring/adversarial case)

This is not a general-NLP result. It is evidence that the language boundary can acquire reusable grounded semantics from validated behavior and reduce Teacher dependency without adding those phrases to the seed interpreter.
