# Language as Executable Semantics: Blueprint Research Direction

Status: architectural research note / working hypothesis

## Core hypothesis

EKG may not need a permanently separate semantic representation between language and execution if its Blueprint representation can grow into a sufficiently expressive typed semantic/executable IR.

A useful target loop is:

`English -> Blueprint -> reasoning / retrieval / execution -> Blueprint -> English`

The important claim is not that there must be exactly one layer. The claim is:

> **Reuse the same representation wherever it remains semantically clean; introduce another layer only when it earns its keep.**

Blueprints already look increasingly semantic: the Teacher breaks down a goal, EKG grounds concepts against prior knowledge, derives typed steps, composes reusable capabilities/programs, and produces a new structure whose parts have explicit meaning. That is close to semantic parsing already; the missing step is teaching EKG to perform more of those transformations itself.

## Blueprints can have multiple jobs

A Blueprint should not be limited to "a sequence of actions." It may become a typed graph/IR capable of representing several kinds of meaning:

- executable operations and dataflow;
- facts and relations;
- questions / unknown slots;
- assertions and requests;
- semantic roles;
- negation;
- uncertainty and confidence;
- alternatives / ambiguity;
- conditionals and hypotheticals;
- reference/coreference;
- temporal and modal qualifiers;
- communicative goals;
- provenance and validation constraints.

Some Blueprint nodes may execute. Others may assert, query, qualify, constrain, or describe. Executability is a powerful property of the representation, not a requirement that every piece of meaning be an imperative action.

This makes a Blueprint closer to an **executable semantic IR** than a conventional workflow.

## Language comprehension as learned graph/program transformation

The Teacher currently supplies much of the transformation from an utterance into structured intent/meaning. EKG should progressively acquire reusable procedures that perform that transformation itself.

Example:

`"boost X by a factor of Y"`

may teach or activate a reusable construction roughly equivalent to:

- identify the `boost` sense appropriate to the local context;
- bind `X` as the operand;
- recognize `factor of Y` as a multiplicative role/cue;
- construct `Multiply(X, Y)` / the corresponding typed Blueprint fragment;
- validate the interpretation through type and execution constraints when possible.

This is **semantic parsing learned as graph/program rewriting**.

The learned object does not need to be a hard-coded parser rule forever. It can be a durable learned procedure/capability with provenance, examples, confidence, competing senses, and correction history.

## Language generation may be the same machinery in reverse

If EKG's internal result is already structured meaning, natural-language generation can also be learned as reusable transformations.

For example:

`located_in(apple, kitchen)`

may support learned realizations such as:

- `"The apple is in the kitchen."`
- `"It's in the kitchen."`
- `"The apple is located in the kitchen."`

A response pipeline might be:

`result Blueprint -> communicative-goal Blueprint -> realization procedure -> surface text`

The same general machinery that learns procedures can therefore potentially learn both:

- **comprehension procedures:** language -> Blueprint;
- **realization procedures:** Blueprint -> language.

This is especially attractive because EKG already has the ability to create, validate, reuse, revise, supersede, and repair learned procedures.

## Self-created capabilities may become grammar

The capability-learning mechanism may itself become part of the language-learning mechanism.

Repeated Teacher demonstrations can produce candidate reusable abilities such as:

- recognize a grammatical/construction pattern;
- bind semantic roles;
- resolve a pronoun from discourse context;
- interpret a temporal phrase;
- distinguish a literal from contextual word sense;
- turn a question form into a typed query;
- choose a concise realization for a known proposition;
- combine clauses;
- preserve negation or uncertainty in output.

When a transformation generalizes across examples and survives validation, it may graduate into durable competence just like any other learned procedure.

Do **not** promote every sentence-specific parse or wording as a permanent capability. Prefer reusable transformations/constructions whose utility extends across many utterances.

## Teacher interactions can supervise both directions

One Teacher interaction can teach two mappings.

Example:

User: `"Where's the apple?"`

Teacher interpretation:

`query located_in(apple, ?place)`

EKG result:

`located_in(apple, kitchen)`

Teacher response:

`"The apple is in the kitchen."`

This supplies evidence for both:

1. **comprehension:** `"Where's X?" -> query located_in(X, ?place)`;
2. **production:** `located_in(X, Y) -> one valid English realization`.

Corrections, competing parses, execution outcomes, and later usage should remain durable evidence. Over time Teacher dependence should fall as these transformations become reusable learned procedures.

## Why a shared representation may be efficient

Using Blueprint as both semantic and executable IR could reduce several costs:

- fewer translations between duplicate semantic representations;
- one ontology/type system for language reasoning and execution;
- executable validation can directly disambiguate language interpretations;
- learned procedures can be used both in reasoning and language transformation;
- provenance/history attach to the same structures used during action;
- search, retrieval, repair, and language understanding can share prior experience;
- new learned capabilities immediately become expressible in the same semantic universe.

This does **not** prove one representation is always optimal. It is a hypothesis worth testing.

## When another layer earns its keep

A second language/semantic layer is absolutely allowed if it solves a real representational problem more cleanly.

Potential reasons include:

- preserving several ambiguous parses before selecting one;
- representing discourse/pragmatics that should not contaminate executable plans;
- storing surface syntax or morphology useful for generation but irrelevant to reasoning;
- representing incomplete/non-executable meanings before grounding is possible;
- providing a compact normalized representation substantially cheaper to search than full Blueprints;
- supporting multiple human languages that map onto one semantic core;
- keeping communicative intent distinct from world/action semantics when the distinction proves useful.

A plausible future architecture may therefore contain several **compatible IRs** or Blueprint subtypes, much like a compiler uses multiple intermediate representations. The requirement is not minimal layer count; it is avoiding unnecessary duplicated meaning and lossy translation.

## Architectural experiment to run

A meaningful Teacher-OFF milestone is:

1. Teach a small family of reusable language constructions using Teacher demonstrations.
2. Give EKG a novel sentence composed from known words/constructions.
3. EKG independently constructs the same typed semantic/executable Blueprint that the Teacher would have supplied.
4. EKG reasons or executes using that Blueprint.
5. EKG independently constructs a communicative result representation.
6. EKG realizes that result as a grammatical natural-language response using learned production procedures.
7. Teacher validates/corrects but does not provide the initial parse or wording.
8. Store all success/failure/correction traces for continued learning.

The benchmark should test **composition**, not memorized sentence templates.

## Research precedents worth mining

These are not claims that another project has already solved EKG's whole problem. They are sources of mechanisms and failure lessons.

### OpenCog / AtomSpace / Atomese

Relevant because its graph representation can contain knowledge, rules, and executable procedures. Historical OpenCog NLP work attempted sentence parsing -> logical/semantic AtomSpace structures -> reasoning -> natural-language generation. Its structural-learning work is especially relevant to learning graph structure rather than hand-authoring all rules.

Questions to steal from:

- how executable symbolic structures are represented;
- how language structures were grounded into the graph;
- where hand-authored rules failed to scale;
- how structural learning was intended to replace manually supplied grammar/ontology.

### Abstract Meaning Representation (AMR)

Strong evidence that `text <-> semantic graph` is a practical bidirectional research problem. AMR itself is not executable enough for EKG, but its separation of surface wording from normalized semantic roles is useful.

Questions to steal from:

- graph parsing and graph-to-text generation;
- reentrancy/coreference;
- normalization vs information loss;
- evaluation of semantic equivalence when wording differs.

### Fluid Construction Grammar / construction grammar systems

Relevant because a construction explicitly links **form and meaning** and the same inventory can support both comprehension and production.

Questions to steal from:

- bidirectional form/meaning mappings;
- compositional construction selection;
- learning new constructions from interaction;
- handling competing constructions/context.

### Executable semantic parsing

A broad research family maps natural language to logical forms/programs that can execute against a knowledge base or environment. This is directly relevant because EKG can use denotation/execution as a validation signal for proposed parses.

Questions to steal from:

- learning from denotation rather than exact structural gold;
- ambiguity when several programs produce the same answer;
- type-directed parsing;
- compositional generalization.

### Graph-to-text / text-to-graph learning

WebNLG and related work show that structured graph meaning can be converted to and from natural language. EKG should reuse evaluation ideas while keeping its executable semantics richer than ordinary RDF-style triples.

## Working thesis

> **The graph is the semantic universe; a Blueprint may be a temporary or durable executable expression inside that universe. Language understanding can become the learned construction of those expressions, and language generation can become learned realization from them. The same self-growing procedure machinery used for tools may eventually learn grammar itself.**

Do not canonize either "one layer" or "two layers" prematurely. Let experiments determine where representation boundaries are actually useful.
