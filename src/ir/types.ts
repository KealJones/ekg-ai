export type Type =
  | { kind: "null" }
  | { kind: "bool" }
  | { kind: "int" }
  | { kind: "string" }
  | { kind: "json" }
  | { kind: "list"; item: Type };

export const T = {
  null: { kind: "null" } as const,
  bool: { kind: "bool" } as const,
  int: { kind: "int" } as const,
  string: { kind: "string" } as const,
  /** Recursive JSON/object/record value. Portable across backends via adapters. */
  json: { kind: "json" } as const,
  list: (item: Type): Type => ({ kind: "list", item }),
};

export function typeEquals(a: Type, b: Type): boolean {
  if (a.kind !== b.kind) return false;
  return a.kind === "list" && b.kind === "list" ? typeEquals(a.item, b.item) : true;
}
