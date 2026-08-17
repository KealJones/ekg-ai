import type { Type } from "../ir/types.js";
import { T } from "../ir/types.js";
import type { Value } from "../ir/blueprint.js";

export interface Capability {
  id: string;
  inputs: Type[];
  output: Type;
  pure: boolean;
  deterministic: boolean;
  /** Safe for speculative program search. Defaults to pure && deterministic when omitted. */
  searchSafe?: boolean;
  reference: (...args: Value[]) => Value;
  tsEmit: (args: string[]) => string;
  rustEmit: (args: string[]) => string;
}

export class CapabilityRegistry {
  private readonly byId = new Map<string, Capability>();
  register(capability: Capability): void { this.byId.set(capability.id, capability); }
  get(id: string): Capability {
    const value = this.byId.get(id);
    if (!value) throw new Error(`Unknown capability: ${id}`);
    return value;
  }
  all(): Capability[] { return [...this.byId.values()]; }
}

export function defaultCapabilities(): CapabilityRegistry {
  const r = new CapabilityRegistry();
  r.register({
    id: "core.add_int", inputs: [T.int, T.int], output: T.int, pure: true, deterministic: true,
    reference: (a,b) => Number(a)+Number(b), tsEmit: a => `(${a[0]} + ${a[1]})`, rustEmit: a => `(${a[0]} + ${a[1]})`
  });
  r.register({
    id: "core.mul_int", inputs: [T.int, T.int], output: T.int, pure: true, deterministic: true,
    reference: (a,b) => Number(a)*Number(b), tsEmit: a => `(${a[0]} * ${a[1]})`, rustEmit: a => `(${a[0]} * ${a[1]})`
  });
  r.register({
    id: "core.max_int", inputs: [T.int, T.int], output: T.int, pure: true, deterministic: true,
    reference: (a,b) => Math.max(Number(a),Number(b)), tsEmit: a => `Math.max(${a[0]}, ${a[1]})`, rustEmit: a => `std::cmp::max(${a[0]}, ${a[1]})`
  });

  r.register({
    id: "core.eq_int", inputs: [T.int, T.int], output: T.bool, pure: true, deterministic: true,
    reference: (a,b) => Number(a) === Number(b), tsEmit: a => `(${a[0]} === ${a[1]})`, rustEmit: a => `(${a[0]} == ${a[1]})`
  });
  r.register({
    id: "core.gte_int", inputs: [T.int, T.int], output: T.bool, pure: true, deterministic: true,
    reference: (a,b) => Number(a) >= Number(b), tsEmit: a => `(${a[0]} >= ${a[1]})`, rustEmit: a => `(${a[0]} >= ${a[1]})`
  });
  r.register({
    id: "core.string_len", inputs: [T.string], output: T.int, pure: true, deterministic: true,
    reference: a => String(a).length, tsEmit: a => `${a[0]}.length`, rustEmit: a => `${a[0]}.chars().count() as i64`
  });

  r.register({
    id: "core.argmax_string_len", inputs: [T.list(T.string)], output: T.string, pure: true, deterministic: true,
    reference: a => {
      const xs=(a as Value[]).map(String);
      if(xs.length===0) return "";
      return xs.reduce((best,x)=>x.length>best.length?x:best,xs[0]!);
    },
    tsEmit: a => `(${a[0]}.length===0?"":${a[0]}.reduce((best:string,x:string)=>x.length>best.length?x:best,${a[0]}[0]))`,
    rustEmit: a => `${a[0]}.iter().max_by_key(|x| x.chars().count()).cloned().unwrap_or_default()`
  });
  r.register({
    id: "core.argmin_string_len", inputs: [T.list(T.string)], output: T.string, pure: true, deterministic: true,
    reference: a => {
      const xs=(a as Value[]).map(String);
      if(xs.length===0) return "";
      return xs.reduce((best,x)=>x.length<best.length?x:best,xs[0]!);
    },
    tsEmit: a => `(${a[0]}.length===0?"":${a[0]}.reduce((best:string,x:string)=>x.length<best.length?x:best,${a[0]}[0]))`,
    rustEmit: a => `${a[0]}.iter().min_by_key(|x| x.chars().count()).cloned().unwrap_or_default()`
  });
  r.register({
    id: "core.list_len_string", inputs: [T.list(T.string)], output: T.int, pure: true, deterministic: true,
    reference: a => (a as Value[]).length,
    tsEmit: a => `${a[0]}.length`,
    rustEmit: a => `${a[0]}.len() as i64`
  });
  return r;
}
