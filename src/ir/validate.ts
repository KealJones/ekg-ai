import type { Expr, ProgramBlueprint, Value } from './blueprint.js';
import type { Type } from './types.js';
import { typeEquals } from './types.js';
import type { CapabilityRegistry } from '../runtime/capabilities.js';
import type { ProgramLibrary } from '../program-library.js';

export function valueMatchesType(value: Value, type: Type): boolean {
  switch (type.kind) {
    case 'bool': return typeof value === 'boolean';
    case 'int': return typeof value === 'number' && Number.isInteger(value);
    case 'string': return typeof value === 'string';
    case 'list': return Array.isArray(value) && value.every(v => valueMatchesType(v, type.item));
  }
}

export function assertValueMatchesType(value: Value, type: Type, label: string): void {
  if (!valueMatchesType(value, type)) throw new Error(`${label} type mismatch: expected ${JSON.stringify(type)}, got ${JSON.stringify(value)}`);
}

export function inferExprType(expr: Expr, programInputs: Type[], caps: CapabilityRegistry, programs?: ProgramLibrary, seen: string[] = []): Type {
  switch (expr.kind) {
    case 'const':
      assertValueMatchesType(expr.value, expr.type, 'Constant');
      return expr.type;
    case 'input': {
      const expected = programInputs[expr.index];
      if (!expected) throw new Error(`Input index out of range: ${expr.index}`);
      if (!typeEquals(expr.type, expected)) throw new Error(`Input ${expr.index} declared type does not match program signature`);
      return expected;
    }
    case 'call': {
      const cap = caps.get(expr.capabilityId);
      if (expr.args.length !== cap.inputs.length) throw new Error(`Capability ${cap.id} arity mismatch`);
      expr.args.forEach((arg, i) => {
        const actual = inferExprType(arg, programInputs, caps, programs, seen);
        if (!typeEquals(actual, cap.inputs[i]!)) throw new Error(`Capability ${cap.id} argument ${i} type mismatch`);
      });
      if (!typeEquals(expr.type, cap.output)) throw new Error(`Capability ${cap.id} declared output type mismatch`);
      return cap.output;
    }
    case 'program_call': {
      if (!programs) throw new Error(`Program call ${expr.programId} requires a ProgramLibrary`);
      const target = programs.get(expr.programId);
      if (!target) throw new Error(`Unknown learned program: ${expr.programId}`);
      if (expr.args.length !== target.inputs.length) throw new Error(`Program ${expr.programId} arity mismatch`);
      expr.args.forEach((arg, i) => {
        const actual = inferExprType(arg, programInputs, caps, programs, seen);
        if (!typeEquals(actual, target.inputs[i]!)) throw new Error(`Program ${expr.programId} argument ${i} type mismatch`);
      });
      if (!typeEquals(expr.type, target.output)) throw new Error(`Program ${expr.programId} declared output type mismatch`);
      return target.output;
    }
  }
}

export function validateProgram(program: ProgramBlueprint, caps: CapabilityRegistry, programs?: ProgramLibrary): void {
  const bodyType = inferExprType(program.body, program.inputs, caps, programs, [program.id]);
  if (!typeEquals(bodyType, program.output)) throw new Error(`Program ${program.id} body/output type mismatch`);
}
