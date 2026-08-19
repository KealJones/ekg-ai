import test from 'node:test';
import assert from 'node:assert/strict';
import {
  MemoryGraphStore,ekgCapabilities,seedPortableSubstrateKnowledge,teachStarterEnglishLexicon,
  teachSynonym,storeLexicalSense,lexicalSensesForText,interpretIntent,planIntent,runProgram,
  LanguageController
} from '../dist/index.js';

test('portable capability semantics live in graph and English can be explicitly taught over them',()=>{
  const graph=new MemoryGraphStore(); const caps=ekgCapabilities();
  seedPortableSubstrateKnowledge(graph,caps);
  assert.equal(graph.outgoing('relation:subtract','denotes_concept')[0].to,'concept:semantic:math.subtract');
  assert.equal(graph.outgoing('concept:semantic:math.subtract','implemented_by')[0].to,'capability:core.sub_int');
  const taught=teachStarterEnglishLexicon(graph);
  assert.ok(taught>40);
  const senses=lexicalSensesForText(graph,'please deduct six');
  assert.equal(senses[0].relation,'Subtract');
});

test('before education deduct is unknown; after education graph grounding executes subtraction',()=>{
  const graph=new MemoryGraphStore(); const caps=ekgCapabilities();
  seedPortableSubstrateKnowledge(graph,caps);
  assert.equal(interpretIntent('deduct six from this number',graph).status,'teacher');
  teachStarterEnglishLexicon(graph);
  const r=interpretIntent('deduct six from this number',graph);
  assert.equal(r.status,'resolved');
  assert.equal(r.intent.constraints[0].relation,'Subtract');
  const plan=planIntent(r.intent,caps,graph);
  assert.equal(plan.status,'planned');
  assert.equal(plan.program.body.capabilityId,'core.sub_int');
  assert.equal(runProgram(plan.program,[20],caps),14);
});

test('a new synonym becomes durable lexical knowledge and needs no hard-coded planner change',()=>{
  const graph=new MemoryGraphStore(); const caps=ekgCapabilities();
  seedPortableSubstrateKnowledge(graph,caps); teachStarterEnglishLexicon(graph);
  assert.equal(interpretIntent('dock six from this number',graph).status,'teacher');
  teachSynonym(graph,{form:'dock',knownForm:'subtract',provenance:['teacher:test']});
  const r=new LanguageController(graph,caps).handle('dock six from this number',[20]);
  assert.equal(r.status,'executed');
  assert.equal(r.output,14);
  assert.equal(graph.outgoing('lexeme:en:dock','synonym_of')[0].to,'lexeme:en:subtract');
});

test('polysemous lexical form retains multiple senses and asks rather than silently choosing',()=>{
  const graph=new MemoryGraphStore();
  storeLexicalSense(graph,{form:'boost',senseId:'boost-add',relation:'Add',definition:'increase by amount',confidence:.8,provenance:['teacher:test']});
  storeLexicalSense(graph,{form:'boost',senseId:'boost-mul',relation:'Multiply',definition:'scale by factor',confidence:.8,provenance:['teacher:test']});
  const r=interpretIntent('boost this number by six',graph);
  assert.equal(r.status,'clarify');
  assert.match(r.question,/multiple requested actions/i);
});

test('semantic graph records explicit antonymy for opposed learned concepts',()=>{
  const graph=new MemoryGraphStore(); const caps=ekgCapabilities();
  seedPortableSubstrateKnowledge(graph,caps);
  assert.equal(graph.outgoing('relation:subtract','antonym_of')[0].to,'relation:add');
  assert.equal(graph.outgoing('relation:minimum','antonym_of')[0].to,'relation:maximum');
});
