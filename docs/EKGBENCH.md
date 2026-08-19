# EKGBench: developmental report card

EKGBench is intentionally allowed to contain expected failures. It is not a CI pass/fail gate for the whole project.

## bAbI-inspired families

We preserve the 20-task prerequisite taxonomy from Weston et al. (2015), but the checked-in probe sentences are original EKG examples rather than copied benchmark examples:

1. single supporting fact
2. two supporting facts
3. three supporting facts
4. two-argument relations
5. three-argument relations
6. yes/no questions
7. counting
8. lists/sets
9. simple negation
10. indefinite knowledge
11. basic coreference
12. conjunction
13. compound coreference
14. time reasoning
15. basic deduction
16. basic induction
17. positional reasoning
18. size reasoning
19. path finding
20. agents/motivations

Source taxonomy: Weston et al., *Towards AI-Complete Question Answering: A Set of Prerequisite Toy Tasks* (2015), arXiv:1502.05698.

## Personal object/program ladder

- `OBJECT-001-single-property`: object + key -> value. This should be easy once recursive JSON/object values exist.
- `OBJECT-PATH-001-dot-nested`: `{foo:{bar:"baz"}} + "foo.bar" -> "baz"`.
- `OBJECT-PATH-002-variable-depth`: generalize the same idea across path depths, including one, two, and three components.

The dot-path solution is intentionally **not** provided as a task-specific primitive. EKG has object access, string splitting, and list operations; it should eventually learn/write the reusable procedure.

## Use

`npm run benchmark:ekg`

The report is observational. Expected-red probes do not make `npm test` red.
