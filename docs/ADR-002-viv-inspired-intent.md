# ADR-002 — Viv-inspired Intent as the language/learner boundary

## Status
Accepted for v0 experimentation.

## Problem
Until v0.0.13, retrieval experiments often received hand-authored semantic metadata (`family`, `labels`). That tests retrieval but does not test task interpretation and leaks Teacher knowledge into the learner.

## Decision
Introduce a first-class `Intent` representation between raw language and executable reasoning:

- **signals**: supplied/bound values and concepts;
- **goal**: desired output concept/type;
- **constraints**: grounded relations expressed by the utterance;
- confidence/provenance.

A small interpreter grounds known phrases into candidate Intents. A typed planner connects grounded signals to goals through known host capabilities. Intent-native retrieval may surface semantically adjacent learned Blueprints.

Unknown language returns Teacher fallback. Ambiguous language requests clarification. Teacher-proposed phrase groundings are validated on examples before entering durable graph knowledge.

## Why Viv
Viv Labs' published Natural Language Intent Interpreter / Concept Action Network architecture is prior art and explicit inspiration: natural language is converted to a typed, unambiguous intent representation suitable for planner composition rather than a single flat intent class.

## Long-term direction
The hand-built interpreter is scaffolding. Successful/corrected interpretation episodes create structured supervision so learned graph knowledge can progressively replace seed mappings and eventually much of the interpreter itself. A frontier LLM survives as Teacher/fallback for genuinely novel language while its intervention rate should fall.

## Metrics
- Teacher-free intent grounding rate.
- Correct executable-plan rate from raw utterance.
- Clarification correctness / non-guessing rate.
- Teacher interventions per novel language task.
- Fraction of resolved utterances using learned rather than seed phrase groundings.
