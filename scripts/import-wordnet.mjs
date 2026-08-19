import WordNet from 'wordnet';
import fs from 'node:fs';
import path from 'node:path';

const POINTER_SYMBOLS = {
  '@': 'hypernym', '~': 'hyponym', '#m': 'member_of', '#p': 'part_of',
  '%m': 'has_member', '%p': 'has_part', '!': 'antonym', '&': 'similar_to',
  '+': 'derivationally_related', '\\': 'pertainym', '=': 'attribute',
};

const POS_MAP = { noun: 'noun', verb: 'verb', adjective: 'adjective', adverb: 'adverb', adj: 'adjective', adv: 'adverb' };

const HIGH_FREQ_WORDS = [
  // Common verbs
  'go','come','take','give','make','get','put','see','look','find','know','think','say','tell',
  'ask','use','try','need','want','like','love','hate','feel','hear','show','turn','move','run',
  'walk','sit','stand','fall','hold','keep','let','begin','start','stop','open','close','read',
  'write','learn','teach','play','work','eat','drink','sleep','wake','buy','sell','pay','send',
  'bring','carry','pick','drop','push','pull','cut','break','build','grow','change','follow',
  'leave','enter','wait','help','call','speak','talk','listen','watch','remember','forget',
  // Common nouns
  'person','people','man','woman','child','boy','girl','baby','family','friend','name',
  'home','house','room','door','window','table','chair','bed','floor','wall',
  'water','food','bread','milk','apple','animal','dog','cat','bird','fish','tree','flower',
  'car','road','street','city','town','country','world','place','school','book','paper',
  'hand','head','eye','face','body','heart','mind','life','death','time','day','night',
  'morning','year','month','week','hour','sun','moon','star','sky','rain','wind','fire',
  'earth','sea','river','mountain','color','red','blue','green','white','black','yellow',
  'big','small','long','short','old','new','young','good','bad','happy','sad',
  'hot','cold','fast','slow','hard','soft','light','dark','high','low','left','right',
  'first','last','next','same','different','other','every','each','some','any','many','few',
  // Common adjectives/adverbs
  'beautiful','strong','weak','rich','poor','clean','dirty','quiet','loud',
  'always','never','often','sometimes','usually','already','still','just','very','really',
  'also','too','enough','almost','again','together','alone','away','back','here','there',
  'now','today','tomorrow','yesterday',
  // Spatial/relational
  'above','below','behind','between','inside','outside','near','far',
  'north','south','east','west','up','down','front',
  // Question/social
  'hello','goodbye','please','sorry','welcome',
];

async function main() {
  await WordNet.init();
  const entries = [];
  const seen = new Set();
  let skipped = 0;

  for (const word of HIGH_FREQ_WORDS) {
    if (seen.has(word)) continue;
    seen.add(word);

    let defs;
    try { defs = await WordNet.lookup(word); } catch { skipped++; continue; }
    if (!defs || defs.length === 0) { skipped++; continue; }

    for (const def of defs.slice(0, 3)) { // max 3 senses per word
      const synsetType = POS_MAP[def.meta.synsetType] ?? def.meta.synsetType;
      const glossary = def.glossary?.split(';')[0]?.trim() ?? '';
      const synsetWords = (def.meta.words ?? []).map(w => w.word.replace(/_/g, ' '));
      const synsetOffset = def.meta.synsetOffset;

      // Extract key relations
      const relations = [];
      for (const p of (def.meta.pointers ?? []).slice(0, 5)) {
        const relName = POINTER_SYMBOLS[p.pointerSymbol];
        if (!relName) continue;
        const targetWord = p.data?.meta?.words?.[0]?.word?.replace(/_/g, ' ');
        if (targetWord) relations.push({ kind: relName, target: targetWord });
      }

      entries.push({
        word,
        pos: synsetType,
        synsetOffset,
        gloss: glossary.slice(0, 120),
        synonyms: synsetWords.filter(w => w !== word).slice(0, 5),
        relations: relations.slice(0, 5),
      });
    }
  }

  const output = {
    source: 'WordNet 3.1 via npm:wordnet',
    license: 'WordNet License (Princeton)',
    exportedAt: new Date().toISOString(),
    wordCount: seen.size,
    entryCount: entries.length,
    skipped,
    entries,
  };

  const outPath = path.join(process.cwd(), 'ekg-data', 'wordnet-curated.json');
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(output, null, 2));
  console.log(`Exported ${entries.length} entries for ${seen.size} words to ${outPath}`);
  console.log(`Skipped ${skipped} words not found in WordNet`);

  // Stats
  const byPos = {};
  for (const e of entries) byPos[e.pos] = (byPos[e.pos] ?? 0) + 1;
  console.log('By POS:', byPos);
}

main().catch(console.error);
