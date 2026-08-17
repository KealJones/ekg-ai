"""
Mechanical item generator. No natural language, no LLM authoring.
Each item: a TaskSpec (input/output examples) + 3 held-out fixtures.
Gold computed by reference implementation.
"""
import random, json, hashlib, itertools, sys

random.seed(int(sys.argv[1]) if len(sys.argv)>1 else 20260816)
ALPH="abcdefghijklmnop"

def rs(lo=0,hi=14): return "".join(random.choice(ALPH) for _ in range(random.randint(lo,hi)))
def rl(n=None): return [rs() for _ in range(n or random.randint(2,7))]
def ri(lo=-30,hi=30): return random.randint(lo,hi)

# ---------- reference primitives ----------
def clamp_int(x,lo,hi): return min(max(x,lo),hi)              # precondition lo<=hi
def abs_diff_string_len(a,b): return abs(len(a)-len(b))
def span_string_len(L): return max(map(len,L))-min(map(len,L)) if L else 0
def mid_int(a,b,c): return sorted((a,b,c))[1]
def mod_int(a,b): return (a%b) if b else 0
PRIM={"clamp_int":clamp_int,"abs_diff_string_len":abs_diff_string_len,
      "span_string_len":span_string_len,"mid_int":mid_int,"mod_int":mod_int}

# ---------- composition templates, per primitive, per family ----------
# each template: (family, arity-signature of task inputs, fn(inputs, consts)->out,
#                 structure string, n_consts, input sampler)
def T(fam, sig, fn, struct, nc, samp): return dict(family=fam,sig=sig,fn=fn,struct=struct,nc=nc,samp=samp)

def samp_int3(): return [ri(),ri(-20,0),ri(1,20)]
def samp_int2(): return [ri(),ri()]
def samp_int1(): return [ri()]
def samp_ss():   return [rs(),rs()]
def samp_L():    return [rl()]
def samp_Lp():   return [rl(), "/x/y/"+rs(1,12)]
def samp_p2():   return ["/a/b/"+rs(1,12), "/c/"+rs(1,12)]

TEMPLATES = {
"clamp_int":[
 T("F1_arg_composed", ["Int","Int"], lambda I,C: clamp_int(I[0]+I[1], C[0], C[1]),
   "clamp(add(x,y),c0,c1)", 2, samp_int2),
 T("F1_arg_composed", ["Int","Int"], lambda I,C: clamp_int(I[0]*C[0], I[1], I[1]+C[1]),
   "clamp(mul(x,c0),y,add(y,c1))", 2, samp_int2),
 T("F2_under_base",   ["Int","Int"], lambda I,C: clamp_int(I[0],C[0],C[1]) + I[1],
   "add(clamp(x,c0,c1),y)", 2, samp_int2),
 T("F2_under_base",   ["Int","Int"], lambda I,C: max(clamp_int(I[0],C[0],C[1]), I[1]),
   "max(clamp(x,c0,c1),y)", 2, samp_int2),
 T("F2_under_base",   ["Int"],       lambda I,C: clamp_int(I[0],C[0],C[1]) * C[2],
   "mul(clamp(x,c0,c1),c2)", 3, samp_int1),
 T("F3_cross_domain", ["List<String>"], lambda I,C: clamp_int(len(I[0]),C[0],C[1]),
   "clamp(list_len_string(L),c0,c1)", 2, samp_L),
 T("F3_cross_domain", ["List<String>"], lambda I,C: clamp_int(len(max(I[0],key=len)),C[0],C[1]),
   "clamp(string_len(argmax_string_len(L)),c0,c1)", 2, samp_L),
 T("F4_repeated",     ["Int","Int"], lambda I,C: clamp_int(I[0],C[0],C[1]) + clamp_int(I[1],C[0],C[1]),
   "add(clamp(x,c0,c1),clamp(y,c0,c1))", 2, samp_int2),
 T("F4_repeated",     ["Int"],       lambda I,C: clamp_int(clamp_int(I[0],C[0],C[1]),C[2],C[3]),
   "clamp(clamp(x,c0,c1),c2,c3)", 4, samp_int1),
 T("F5_bool_head",    ["Int","Int"], lambda I,C: clamp_int(I[0],C[0],C[1]) >= I[1],
   "gte_int(clamp(x,c0,c1),y)", 2, samp_int2),
 T("F5_bool_head",    ["Int"],       lambda I,C: clamp_int(I[0],C[0],C[1]) == C[2],
   "eq_int(clamp(x,c0,c1),c2)", 3, samp_int1),
],
"abs_diff_string_len":[
 T("F1_arg_composed", ["String","String"], lambda I,C: abs_diff_string_len(I[0].rsplit("/",1)[-1], I[1]),
   "absdiff(basename(p),s)", 0, lambda:["/a/b/"+rs(1,12), rs()]),
 T("F1_arg_composed", ["List<String>","String"], lambda I,C: abs_diff_string_len(max(I[0],key=len), I[1]),
   "absdiff(argmax_string_len(L),s)", 0, lambda:[rl(), rs()]),
 T("F2_under_base",   ["String","String"], lambda I,C: abs_diff_string_len(I[0],I[1]) + C[0],
   "add(absdiff(a,b),c0)", 1, samp_ss),
 T("F2_under_base",   ["String","String"], lambda I,C: abs_diff_string_len(I[0],I[1]) * C[0],
   "mul(absdiff(a,b),c0)", 1, samp_ss),
 T("F2_under_base",   ["String","String"], lambda I,C: max(abs_diff_string_len(I[0],I[1]), C[0]),
   "max(absdiff(a,b),c0)", 1, samp_ss),
 T("F3_cross_domain", ["List<String>"], lambda I,C: abs_diff_string_len(max(I[0],key=len), min(I[0],key=len)),
   "absdiff(argmax_string_len(L),argmin_string_len(L))", 0, samp_L),
 T("F3_cross_domain", ["List<String>","String"], lambda I,C: abs_diff_string_len(min(I[0],key=len), I[1].rsplit("/",1)[-1]),
   "absdiff(argmin_string_len(L),basename(p))", 0, samp_Lp),
 T("F4_repeated",     ["String","String","String"], lambda I,C: abs_diff_string_len(I[0],I[1]) + abs_diff_string_len(I[1],I[2]),
   "add(absdiff(a,b),absdiff(b,c))", 0, lambda:[rs(),rs(),rs()]),
 T("F4_repeated",     ["String","String","String"], lambda I,C: max(abs_diff_string_len(I[0],I[1]), abs_diff_string_len(I[0],I[2])),
   "max(absdiff(a,b),absdiff(a,c))", 0, lambda:[rs(),rs(),rs()]),
 T("F5_bool_head",    ["String","String"], lambda I,C: abs_diff_string_len(I[0],I[1]) >= C[0],
   "gte_int(absdiff(a,b),c0)", 1, samp_ss),
 T("F5_bool_head",    ["String","String"], lambda I,C: abs_diff_string_len(I[0],I[1]) == C[0],
   "eq_int(absdiff(a,b),c0)", 1, samp_ss),
],
"span_string_len":[
 T("F1_arg_composed", ["String"], lambda I,C: span_string_len(I[0].split(",")),
   "span(split-free: L from input)", 0, lambda:[",".join(rl())]),
 T("F2_under_base",   ["List<String>"], lambda I,C: span_string_len(I[0]) + C[0],
   "add(span(L),c0)", 1, samp_L),
 T("F2_under_base",   ["List<String>"], lambda I,C: span_string_len(I[0]) * C[0],
   "mul(span(L),c0)", 1, samp_L),
 T("F2_under_base",   ["List<String>"], lambda I,C: max(span_string_len(I[0]), C[0]),
   "max(span(L),c0)", 1, samp_L),
 T("F3_cross_domain", ["List<String>"], lambda I,C: span_string_len(I[0]) + len(I[0]),
   "add(span(L),list_len_string(L))", 0, samp_L),
 T("F3_cross_domain", ["List<String>","String"], lambda I,C: span_string_len(I[0]) + len(I[1].rsplit("/",1)[-1]),
   "add(span(L),string_len(basename(p)))", 0, samp_Lp),
 T("F3_cross_domain", ["List<String>"], lambda I,C: max(span_string_len(I[0]), len(max(I[0],key=len))),
   "max(span(L),string_len(argmax_string_len(L)))", 0, samp_L),
 T("F4_repeated",     ["List<String>","List<String>"], lambda I,C: span_string_len(I[0]) + span_string_len(I[1]),
   "add(span(L1),span(L2))", 0, lambda:[rl(),rl()]),
 T("F4_repeated",     ["List<String>","List<String>"], lambda I,C: max(span_string_len(I[0]), span_string_len(I[1])),
   "max(span(L1),span(L2))", 0, lambda:[rl(),rl()]),
 T("F5_bool_head",    ["List<String>"], lambda I,C: span_string_len(I[0]) >= C[0],
   "gte_int(span(L),c0)", 1, samp_L),
 T("F5_bool_head",    ["List<String>","List<String>"], lambda I,C: span_string_len(I[0]) == span_string_len(I[1]),
   "eq_int(span(L1),span(L2))", 0, lambda:[rl(),rl()]),
],
}
# negative controls reuse the SAME structural templates, primitive swapped
TEMPLATES["mid_int"]=[
 T("F1_arg_composed",["Int","Int","Int"],lambda I,C: mid_int(I[0]+C[0],I[1],I[2]),"mid(add(x,c0),y,z)",1,lambda:[ri(),ri(),ri()]),
 T("F2_under_base",  ["Int","Int","Int"],lambda I,C: mid_int(I[0],I[1],I[2])+C[0],"add(mid(x,y,z),c0)",1,lambda:[ri(),ri(),ri()]),
 T("F2_under_base",  ["Int","Int","Int"],lambda I,C: max(mid_int(I[0],I[1],I[2]),C[0]),"max(mid(x,y,z),c0)",1,lambda:[ri(),ri(),ri()]),
 T("F3_cross_domain",["List<String>","Int","Int"],lambda I,C: mid_int(len(I[0]),I[1],I[2]),"mid(list_len_string(L),y,z)",0,lambda:[rl(),ri(),ri()]),
 T("F4_repeated",    ["Int","Int","Int"],lambda I,C: mid_int(I[0],I[1],I[2])+mid_int(I[1],I[2],C[0]),"add(mid(x,y,z),mid(y,z,c0))",1,lambda:[ri(),ri(),ri()]),
 T("F5_bool_head",   ["Int","Int","Int"],lambda I,C: mid_int(I[0],I[1],I[2])>=C[0],"gte_int(mid(x,y,z),c0)",1,lambda:[ri(),ri(),ri()]),
]
TEMPLATES["mod_int"]=[
 T("F1_arg_composed",["Int","Int"],lambda I,C: mod_int(I[0]+I[1],C[0]),"mod(add(x,y),c0)",1,lambda:[ri(0,60),ri(0,60)]),
 T("F2_under_base",  ["Int"],      lambda I,C: mod_int(I[0],C[0])+C[1],"add(mod(x,c0),c1)",2,lambda:[ri(0,60)]),
 T("F2_under_base",  ["Int"],      lambda I,C: max(mod_int(I[0],C[0]),C[1]),"max(mod(x,c0),c1)",2,lambda:[ri(0,60)]),
 T("F3_cross_domain",["List<String>"],lambda I,C: mod_int(len(max(I[0],key=len)),C[0]),"mod(string_len(argmax_string_len(L)),c0)",1,samp_L),
 T("F4_repeated",    ["Int","Int"],lambda I,C: mod_int(I[0],C[0])+mod_int(I[1],C[0]),"add(mod(x,c0),mod(y,c0))",1,lambda:[ri(0,60),ri(0,60)]),
 T("F5_bool_head",   ["Int"],      lambda I,C: mod_int(I[0],C[0])==0,"eq_int(mod(x,c0),0)",1,lambda:[ri(0,60)]),
]

def gen_consts(n, prim):
    if prim=="clamp_int":
        lo=ri(-15,5); hi=lo+random.randint(1,20)
        base=[lo,hi]
        while len(base)<n:
            lo2=ri(-10,5); base+= [lo2, lo2+random.randint(1,15)]
        return base[:n] if n<=len(base) else base
    if prim=="mod_int": return [random.choice([3,4,5,7,9,11]) for _ in range(n)]
    return [ri(-8,12) for _ in range(n)]

def make_item(prim, tmpl, idx, n_train=4, n_fix=4):
    consts = gen_consts(max(tmpl["nc"],4), prim)
    def block(k):
        rows=[]
        for _ in range(k):
            I = tmpl["samp"]()
            try: o = tmpl["fn"](I, consts)
            except Exception: return None
            rows.append({"in":I,"out":o})
        return rows
    train = block(n_train)
    fixtures=[]
    for fi in range(3):
        b = block(n_fix)
        if b is None: return None
        fixtures.append({"id":f"fx{fi}","examples":b,
                         "denotation":[r["out"] for r in b]})
    if train is None: return None
    ds = [json.dumps(f["denotation"]) for f in fixtures]
    if len(set(ds))<2: return None                       # denotation-variation gate
    return {
      "itemId": f"{prim}:{tmpl['family']}:{idx:03d}",
      "primitive": prim,
      "family": tmpl["family"],
      "structure": tmpl["struct"],
      "structureHash": hashlib.sha256(tmpl["struct"].encode()).hexdigest()[:12],
      "inputTypes": tmpl["sig"],
      "constants": consts[:max(tmpl["nc"],0)],
      "taskSpec": {"examples": train},
      "fixtures": fixtures,
    }

def build(prim, target_n):
    out=[]; i=0; tries=0
    tmpls=TEMPLATES[prim]
    while len(out)<target_n and tries<target_n*40:
        tries+=1
        t=tmpls[i%len(tmpls)]; i+=1
        it=make_item(prim,t,len(out))
        if it: out.append(it)
    return out

if __name__=="__main__":
    bench={"benchmarkVersion":"v0.4-arith-decomp","seed":20260816,"items":{}}
    plan={"clamp_int":44,"abs_diff_string_len":44,"span_string_len":44,"mid_int":26,"mod_int":26}
    for prim,n in plan.items():
        items=build(prim,n); bench["items"][prim]=items
        from collections import Counter
        fams=Counter(x["family"] for x in items)
        structs=len(set(x["structureHash"] for x in items))
        print(f"{prim:<22} items={len(items):>3}  families={len(fams)}  distinct-structures={structs}  {dict(fams)}")
    json.dump(bench, open("bench_v04_draft.json","w"), indent=1)
    tot=sum(len(v) for v in bench["items"].values())
    print(f"\nTOTAL items={tot}   fixtures={tot*3}")
