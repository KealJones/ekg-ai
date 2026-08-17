import fs from 'node:fs';

const benchmarkPath=new URL('./data/v0.3.7-benchmark-with-fixtures.json',import.meta.url);
const benchmark=JSON.parse(fs.readFileSync(benchmarkPath,'utf8'));

// Frozen before this audit result is used for any EKG scored evaluation.
// A non-held-out semantic is a confound iff the fixture denotation cannot be
// derived without it. Output/effect tails that merely consume the selected
// denotation are intentionally ignored.
const FROZEN_RULE_VERSION='denotation-data-dependency-v1';

// Actual checkpoint-0 reusable semantic surface, stated conservatively.
// EKG has fs.list_filenames and fs.basename, but no generic higher-order map/
// filter over filesystem objects, recursive traversal, metadata access,
// content access, path predicates, permissions, ownership, etc. Consequently
// "fs.enumerate" below means generic enumeration usable by the benchmark's
// semantic plan, not merely one host call returning a string list.
const KNOWN=new Set(['file.name','eq']);

function deps(spec){
  const out=new Set();
  if(spec.type==='filesystem_query'){
    out.add('fs.enumerate');
    if(spec.recursive) out.add('fs.recursive');
    if(spec.root!=='.' && spec.root!=null) out.add('fs.root_binding');
    for(const f of spec.filters??[]){
      const {field,op}=f;
      if(field==='type') out.add('file.type');
      else if(field==='name'){
        out.add('file.name');
        if(op==='glob') out.add('string.glob');
        else if(op==='egrep') out.add('string.regex');
        else if(op==='eq') out.add('string.eq');
      } else if(['ctime','mtime','atime'].includes(field)){
        out.add(`file.${field}`); out.add(`numeric/time.${op}`);
      } else out.add(`${field}.${op}`);
    }
    if(spec.time_filter){
      out.add(`file.${spec.time_filter.field}`);
      out.add('HELDOUT:within_closed_int_window');
      if(['lower','upper'].some(k=>String(spec.time_filter[k]??'').startsWith('NOW'))) out.add('time.now');
      if(['lower','upper'].some(k=>String(spec.time_filter[k]??'').startsWith('$'))) out.add('env.binding');
    }
    if(spec.string_predicate){
      out.add(`file.${spec.string_predicate.field}`);
      out.add('HELDOUT:string_contains');
      if(spec.string_predicate.case_insensitive) out.add('string.casefold');
    }
    if(spec.negated_predicate){
      out.add('HELDOUT:negate_predicate');
      const ps=['compound','compound_pipe'].includes(spec.negated_predicate.type)
        ? spec.negated_predicate.predicates??[] : [spec.negated_predicate];
      for(const p of ps){
        const {field,op}=p;
        if(field==='name') out.add('file.name');
        else if(field==='path') out.add('file.path');
        else if(field==='owner') out.add('file.owner');
        else if(field==='perm') out.add('file.perm');
        else if(field==='size') out.add('file.size');
        else if(field==='target_exists') out.add('symlink.target_exists');
        if(op==='eq') out.add('eq');
        else if(op==='glob') out.add('string.glob');
        else if(['contains','startswith','endswith','regex_match','egrep'].includes(op)) out.add(`string.${op}`);
        else if(op==='in_file') out.add('file.read_list');
        else if(op==='has_all') out.add('perm.has_all');
      }
    }
    for(const f of spec.extra_filters??[]){
      out.add(`file.${f.field}`);
      if(f.op==='glob') out.add('string.glob');
      else if(f.op==='eq') out.add('eq');
      else out.add(`${f.field}.${f.op}`);
    }
    if(spec.select==='count' || spec.action==='count') out.add('collection.count');
    if(typeof spec.action==='string' && spec.action.startsWith('grep_content:')){
      out.add('file.content'); out.add('HELDOUT:string_contains');
    }
    if(spec.action==='count_nonblank_lines'){
      out.add('file.content'); out.add('text.nonblank_count');
    }
    if(typeof spec.action==='string' && spec.action.startsWith('gunzip_grep:')){
      out.add('file.content'); out.add('archive.gunzip'); out.add('HELDOUT:string_contains');
    }
  } else if(spec.type==='filter_lines'){
    out.add('lines.input');
    if(spec.predicate?.op==='contains') out.add('HELDOUT:string_contains');
    else out.add(`line.${spec.predicate?.op}`);
  } else if(spec.type==='text_processing'){
    out.add('text.input');
    for(const step of spec.steps??[]){
      if(step.op==='grep_exclude') { out.add('HELDOUT:negate_predicate'); out.add('string.regex'); }
      else out.add(`text.${step.op}`);
    }
  } else out.add(`type:${spec.type}`);
  return out;
}

const rows=benchmark.items.map(item=>{
  const spec=JSON.parse(item.referenceSpec);
  const all=[...deps(spec)].sort();
  const held=all.filter(x=>x.startsWith('HELDOUT:'));
  const missing=all.filter(x=>!x.startsWith('HELDOUT:') && !KNOWN.has(x));
  return {recordId:item.recordId,primitiveId:item.primitiveId,familyId:item.familyId,heldout:held,missingBaseSemantics:missing,clean:missing.length===0};
});
const ids=[...new Set(rows.map(x=>x.primitiveId))];
const byPrimitive=Object.fromEntries(ids.map(id=>{
  const xs=rows.filter(x=>x.primitiveId===id), clean=xs.filter(x=>x.clean);
  return [id,{n:xs.length,clean:clean.length,cleanFamilies:new Set(clean.map(x=>x.familyId)).size}];
}));
const missingCounts={};
for(const row of rows) for(const x of row.missingBaseSemantics) missingCounts[x]=(missingCounts[x]??0)+1;
const report={
  status:'PREFLIGHT_FAILURE_NO_SCORED_EKG_RUN_PERFORMED',
  ruleVersion:FROZEN_RULE_VERSION,
  benchmarkItems:rows.length,
  cleanItems:rows.filter(x=>x.clean).length,
  byPrimitive,
  mostCommonMissingBaseSemantics:Object.entries(missingCounts).sort((a,b)=>b[1]-a[1]).slice(0,25),
  rows
};
console.log(JSON.stringify(report,null,2));
if(report.cleanItems!==0) process.exitCode=2;
