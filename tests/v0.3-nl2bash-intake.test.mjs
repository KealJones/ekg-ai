import test from "node:test"; import assert from "node:assert/strict";
import {parseNl2BashPairs,discoverPrimitiveCandidates,auditCandidateSupply} from "../dist/index.js";
const nl=["files between dates","files containing foo","files not named tmp"].join("\n");
const cm=["find . -newermt 2020-01-01 ! -newermt 2020-02-01","find . -name '*foo*'","find . -type f ! -name '*.tmp'"].join("\n");
test("paired corpus parsing preserves external line identity",()=>{const r=parseNl2BashPairs(nl,cm);assert.equal(r.length,3);assert.equal(r[0].line,1);});
test("candidate discovery is command-derived and covers all frozen primitives",()=>{const h=discoverPrimitiveCandidates(parseNl2BashPairs(nl,cm));assert.ok(h.some(x=>x.primitiveId==="predicate.within_closed_int_window"));assert.ok(h.some(x=>x.primitiveId==="predicate.string_contains"));assert.ok(h.some(x=>x.primitiveId==="logic.negate_predicate"));});
test("supply audit fails closed below preregistered 40-per-primitive floor",()=>{const a=auditCandidateSupply(discoverPrimitiveCandidates(parseNl2BashPairs(nl,cm)));assert.equal(a["predicate.string_contains"].passesSupplyGate,false);});
test("misaligned external corpus is rejected",()=>assert.throws(()=>parseNl2BashPairs("a\nb","x"),/alignment mismatch/));

test("closed-window discovery rejects angle-bracket/redirection false positives",()=>{
  const rows=parseNl2BashPairs(
    'Always answer no to any prompt\nAppend html to every line\nArchive source to destination\n',
    'yes no | <command>\necho x | sed "s/x/<br>/"\nrsync -av <SOURCE_DIR> <DEST_DIR>\n'
  );
  const hits=discoverPrimitiveCandidates(rows).filter(x=>x.primitiveId==="predicate.within_closed_int_window");
  assert.equal(hits.length,0);
});
