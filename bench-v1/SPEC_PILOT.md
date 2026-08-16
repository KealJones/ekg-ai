# Falsification Pilot v0.1

This pilot implements the subset of the external review that is meaningful before authoring a full benchmark.

Implemented:
- external benchmark semantic DAG separate from learner Intent/Blueprint internals;
- deterministic canonicalization / structural hashing;
- three-fixture denotation grading for answer items;
- Teacher-OFF test evaluation;
- test-time learning disabled;
- exact cache baseline;
- token-Jaccard nearest-neighbor semantic-frame cache baseline;
- checkpoint-0 comparison;
- structural-vs-lexical stratification;
- learned-artifact knockout;
- dependency precision/recall;
- artifact reuse depth;
- false-answer count and explicit escalation;
- leakage/audit report.

Not implemented / impossible to establish internally in this chat:
- independent human annotation / inter-annotator agreement;
- independent model adjudication of the actual pilot items;
- ~600–990 item statistical power;
- sealed offline split;
- pretrained RAG and fine-tuned seq2seq baselines;
- 5 curriculum orders × 3 stochastic seeds (current pilot path is essentially deterministic and too small);
- publication-grade MCD/DBCA optimization.

The pilot must not be cited as evidence of general natural-language understanding.
