# Contextual language and word senses

EKG does not assume a word has one permanent meaning. A lexical form may retain multiple durable senses. Context selects among them; it does not overwrite the alternatives.

The current design intentionally borrows three established ideas:

- **WordNet:** separate word forms from specific senses and connect senses with explicit semantic relations.
- **FrameNet:** attach a sense to a semantic frame/situation so nearby roles and cues can change which meaning is appropriate.
- **Graph-based WSD (e.g. Babelfy):** prefer interpretations that are coherent with surrounding semantic knowledge rather than resolving each token independently.

A small neural encoder may later contribute context-sensitive candidate scores, but it is advisory. Graph evidence, type constraints, executable grounding, and observed outcomes retain veto power.

## Durable contextual learning

Teacher corrections can add contextual evidence to an existing sense. This evidence is stored in the graph and survives the lesson. Learning that `boost` means addition around the cue `amount` does not delete the scaling sense of `boost`; it makes future disambiguation better.

Current path:

`lexeme -> candidate senses -> contextual cues/frame/graph coherence -> semantic relation -> concept -> typed capability -> execution`

Ambiguity is allowed. If context does not distinguish senses strongly enough, EKG should ask rather than silently collapse them.

## Attribution / inspiration

- Princeton WordNet: https://wordnet.princeton.edu/
- Berkeley FrameNet / ICSI: https://icsi.berkeley.edu/projects/framenet-project/
- Moro, Raganato & Navigli (2014), *Entity Linking meets Word Sense Disambiguation: a Unified Approach* (Babelfy): https://aclanthology.org/Q14-1019/
- Wiedemann et al. (2019), *Does BERT Make Any Sense? Interpretable Word Sense Disambiguation with Contextualized Embeddings*: https://arxiv.org/abs/1909.10430
