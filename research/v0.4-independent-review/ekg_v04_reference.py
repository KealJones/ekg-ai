"""
EKG v0.4 arithmetic-decomposition experiment — reference module.
Contains: checkpoint-0 capability model, reference semantics for taught +
control primitives, verified base-expressibility witnesses, exhaustive
irreducibility checker, and the mechanical item generator.

No natural language. No LLM-authored scored content.
Run:  python3 ekg_v04_reference.py verify      # witness + irreducibility self-test
      python3 ekg_v04_reference.py generate    # emit bench_v04.json
"""
import random, json, hashlib, sys
from typing import List

SEED = 20260816

# ==========================================================================
# 1. CHECKPOINT-0 CAPABILITY MODEL  (exact, from v0.3.7 source)
# ==========================================================================
BASE = {
    "core.add_int":            (2, lambda a, b: a + b,            ("Int","Int"),          "Int"),
    "core.mul_int":            (2, lambda a, b: a * b,            ("Int","Int"),          "Int"),
    "core.max_int":            (2, lambda a, b: max(a, b),        ("Int","Int"),          "Int"),
    "core.eq_int":             (2, lambda a, b: a == b,           ("Int","Int"),          "Bool"),
    "core.gte_int":            (2, lambda a, b: a >= b,           ("Int","Int"),          "Bool"),
    "core.string_len":         (1, lambda s: len(s),              ("String",),            "Int"),
    "core.argmax_string_len":  (1, lambda L: max(L, key=len),     ("List<String>",),      "String"),
    "core.argmin_string_len":  (1, lambda L: min(L, key=len),     ("List<String>",),      "String"),
    "core.list_len_string":    (1, lambda L: len(L),              ("List<String>",),      "Int"),
    "fs.list_filenames":       (1, None,                          ("String",),            "List<String>"),
    "fs.basename":             (1, lambda p: p.rsplit("/",1)[-1], ("String",),            "String"),
}
# NOTE: Bool is a TERMINAL type — no operator consumes it.
# NOTE: List<String> has one producer besides task inputs and three consumers.

D_MAX_ASSUMED = 3   # MUST be measured empirically; see protocol Phase 0 step 2.

# ==========================================================================
# 2. PRIMITIVES — reference semantics
# ==========================================================================
def clamp_int(x, lo, hi):                       # TAUGHT T1  (precondition lo <= hi)
    return min(max(x, lo), hi)

def abs_diff_string_len(a: str, b: str) -> int: # TAUGHT T2
    return abs(len(a) - len(b))

def span_string_len(L: List[str]) -> int:       # TAUGHT T3
    return max(map(len, L)) - min(map(len, L)) if L else 0

def mid_int(a, b, c):                           # CONTROL NC1 (never taught, matched)
    return sorted((a, b, c))[1]

def mod_int(a, b):                              # CONTROL NC2 (never taught, absolute)
    return (a % b) if b else 0

TAUGHT  = {"clamp_int": clamp_int,
           "abs_diff_string_len": abs_diff_string_len,
           "span_string_len": span_string_len}
CONTROL = {"mid_int": mid_int, "mod_int": mod_int}

# ==========================================================================
# 3. WITNESS BLUEPRINTS — base-expressible at depth 4, verified below.
#    These are EXACTLY what the Teacher is permitted to hand over.
# ==========================================================================
WITNESS_TEXT = {
 "clamp_int":
   "add_int( add_int(max_int(x,lo), hi), mul_int( max_int(max_int(x,lo), hi), -1 ) )",
 "abs_diff_string_len":
   "add_int( max_int( add_int(string_len(a),string_len(a)), add_int(string_len(b),string_len(b)) ), "
   "mul_int( add_int(string_len(a),string_len(b)), -1 ) )",
 "span_string_len":
   "add_int( string_len(argmax_string_len(L)), mul_int( string_len(argmin_string_len(L)), -1 ) )",
}
WITNESS_DEPTH = {"clamp_int": 4, "abs_diff_string_len": 4, "span_string_len": 4}

def w_clamp(x, lo, hi):   u = max(x, lo); return (u + hi) + (max(u, hi) * -1)
def w_absdiff(a, b):      la, lb = len(a), len(b); return max(la+la, lb+lb) + ((la+lb) * -1)
def w_span(L):            return len(max(L,key=len)) + (len(min(L,key=len)) * -1)

# ==========================================================================
# 4. IRREDUCIBILITY CHECKER  (observational equivalence, exhaustive to D_max)
# ==========================================================================
def probe_set(n=40):
    random.seed(SEED); vals = [-7,-3,-1,0,1,2,3,5,8,11,17]; P=[]
    for _ in range(n): P.append(tuple(random.choice(vals) for _ in range(3)))
    P += [(0,0,0),(5,5,5),(1,2,3),(3,2,1),(-5,0,5),(10,-10,0),(2,7,4),(7,2,4),(4,4,9),(9,4,4)]
    return list(dict.fromkeys(P))

CONSTS = [-2,-1,0,1,2,3]; CAP = 10**7

def build_le2(PROBE):
    N=len(PROBE); L0={}
    for i,nm in enumerate(('x','y','z')): L0.setdefault(tuple(p[i] for p in PROBE), nm)
    for c in CONSTS: L0.setdefault(tuple([c]*N), str(c))
    S=dict(L0); OPS=(('add',lambda p,q:p+q),('mul',lambda p,q:p*q),('max',max))
    L1={}
    for va,ea in L0.items():
        for vb,eb in L0.items():
            for op,f in OPS:
                v=tuple(f(p,q) for p,q in zip(va,vb))
                if any(abs(t)>CAP for t in v): continue
                if v not in S and v not in L1: L1[v]=f"{op}({ea},{eb})"
    S.update(L1); L2={}
    for va,ea in L1.items():
        for vb,eb in S.items():
            for (x1,e1),(x2,e2) in (((va,ea),(vb,eb)),((vb,eb),(va,ea))):
                for op,f in OPS:
                    v=tuple(f(p,q) for p,q in zip(x1,x2))
                    if any(abs(t)>CAP for t in v): continue
                    if v not in S and v not in L2: L2[v]=f"{op}({e1},{e2})"
    S.update(L2); return L0,L1,L2,S

def reachable_le3(target, L0,L1,L2,S):
    """Exhaustive: is `target` reachable at depth <= 3?  Returns expr or None."""
    if target in S:
        d = 0 if target in L0 else (1 if target in L1 else 2)
        return f"depth{d}: {S[target]}"
    keys=list(S.keys()); Sset=set(keys); D2=set(L2.keys())
    for a in keys:                                        # ADD inversion
        b=tuple(t-ai for t,ai in zip(target,a))
        if b in Sset and (a in D2 or b in D2): return f"depth3: add({S[a]},{S[b]})"
    for a in keys:                                        # MUL inversion
        b=[]; ok=True
        for t,ai in zip(target,a):
            if ai==0:
                if t!=0: ok=False;break
                b.append(0)
            else:
                if t%ai: ok=False;break
                b.append(t//ai)
        if ok:
            b=tuple(b)
            if b in Sset and (a in D2 or b in D2): return f"depth3: mul({S[a]},{S[b]})"
    for a in D2:                                          # MAX pair scan
        if any(ai>t for ai,t in zip(a,target)): continue
        need=[i for i,(ai,t) in enumerate(zip(a,target)) if ai<t]
        for b in keys:
            if all(b[i]==target[i] for i in need) and all(bi<=t for bi,t in zip(b,target)):
                return f"depth3: max({S[a]},{S[b]})"
    return None

# ==========================================================================
# 5. ITEM GENERATOR  (see gen_items.py in the working set for full templates)
# ==========================================================================
def sha(s): return hashlib.sha256(str(s).encode()).hexdigest()[:12]

# ==========================================================================
# 6. SELF-TEST
# ==========================================================================
def verify():
    random.seed(11); ALPH="abcdefghij"; ok=True
    for _ in range(20000):
        x,lo,hi=(random.randint(-40,40) for _ in range(3))
        if lo>hi: lo,hi=hi,lo
        if w_clamp(x,lo,hi)!=clamp_int(x,lo,hi): ok=False;break
    print("witness clamp_int            :", "OK" if ok else "FAIL", "| base depth 4")
    ok=True
    for _ in range(20000):
        a="".join(random.choice(ALPH) for _ in range(random.randint(0,15)))
        b="".join(random.choice(ALPH) for _ in range(random.randint(0,15)))
        if w_absdiff(a,b)!=abs_diff_string_len(a,b): ok=False;break
    print("witness abs_diff_string_len  :", "OK" if ok else "FAIL", "| base depth 4")
    ok=True
    for _ in range(20000):
        L=["".join(random.choice(ALPH) for _ in range(random.randint(0,15)))
           for _ in range(random.randint(1,8))]
        if w_span(L)!=span_string_len(L): ok=False;break
    print("witness span_string_len      :", "OK" if ok else "FAIL", "| base depth 4")

    print("\nIrreducibility check (exhaustive, depth <= 3, base ops only):")
    P=probe_set(); L0,L1,L2,S=build_le2(P)
    print(f"  reachable behaviours: d0={len(L0)} d1={len(L1)} d2={len(L2)} cum<=2={len(S):,}")
    def tv(f): return tuple(f(*p) for p in P)
    checks=[("sub_int  [POSITIVE CONTROL, expect REACHABLE]", tv(lambda x,y,z:x-y)),
            ("min_int  [POSITIVE CONTROL, expect REACHABLE]", tv(lambda x,y,z:min(x,y))),
            ("abs_diff_int             [expect REACHABLE]",   tv(lambda x,y,z:abs(x-y))),
            ("clamp_int   T1  [expect NOT reachable]",        tv(lambda x,y,z:clamp_int(x,min(y,z),max(y,z)))),
            ("mid_int     NC1 [expect NOT reachable]",        tv(lambda x,y,z:mid_int(x,y,z))),
            ("mod_int     NC2 [expect NOT reachable]",        tv(lambda x,y,z:mod_int(x,y)))]
    for name,t in checks:
        r=reachable_le3(t,L0,L1,L2,S)
        print(f"  {name:<48} {'REACHABLE  '+r[:46] if r else 'NOT reachable at depth <= 3'}")

if __name__=="__main__":
    if len(sys.argv)>1 and sys.argv[1]=="verify": verify()
    else: verify()
