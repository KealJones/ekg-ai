import { T } from "../ir/types.js";
import type { PropertySpec, TaskSpec } from "../task.js";

const eqInput = (cases: number[][]): PropertySpec => ({
  id: "output-equals-input",
  cases,
  assertion: {kind:"call",capabilityId:"core.eq_int",args:[{kind:"output"},{kind:"input",index:0}]},
});

export interface FrozenBenchmarkSuite {
  version: string;
  train: TaskSpec[];
  test: TaskSpec[];
}

/**
 * Tiny frozen v0 suite. It is intentionally too small to establish intelligence;
 * its job is to keep early architectural comparisons honest and reproducible.
 */
export const frozenV0Suite: FrozenBenchmarkSuite = {
  version: "v0.1",
  train: [
    {
      id:"train.identity", family:"unary-int", split:"train",
      inputs:[T.int], output:T.int,
      examples:[{inputs:[6],output:6}],
      properties:[eqInput([[-5],[0],[1],[9],[42]])],
    },
    {
      id:"train.double", family:"unary-int", split:"train",
      inputs:[T.int], output:T.int,
      examples:[{inputs:[2],output:4},{inputs:[7],output:14},{inputs:[11],output:22}],
    },
    {
      id:"train.square", family:"unary-int", split:"train",
      inputs:[T.int], output:T.int,
      examples:[{inputs:[2],output:4},{inputs:[3],output:9},{inputs:[6],output:36}],
    },
    {
      id:"train.max2", family:"binary-int", split:"train",
      inputs:[T.int,T.int], output:T.int,
      examples:[{inputs:[2,9],output:9},{inputs:[10,3],output:10},{inputs:[-4,-2],output:-2}],
    },
    {
      id:"train.string-length", family:"string", split:"train",
      inputs:[T.string], output:T.int,
      examples:[{inputs:["a"],output:1},{inputs:["hello"],output:5},{inputs:[""],output:0}],
    },
  ],
  test: [
    {
      id:"test.triple", family:"unary-int", split:"test",
      inputs:[T.int], output:T.int,
      examples:[{inputs:[2],output:6},{inputs:[5],output:15},{inputs:[9],output:27}],
    },
    {
      id:"test.quadruple", family:"unary-int", split:"test",
      inputs:[T.int], output:T.int,
      examples:[{inputs:[2],output:8},{inputs:[4],output:16},{inputs:[7],output:28}],
    },
    {
      id:"test.max2-new-cases", family:"binary-int", split:"test",
      inputs:[T.int,T.int], output:T.int,
      examples:[{inputs:[100,99],output:100},{inputs:[-9,8],output:8},{inputs:[0,0],output:0}],
    },
    {
      id:"test.string-length-new-cases", family:"string", split:"test",
      inputs:[T.string], output:T.int,
      examples:[{inputs:["abcd"],output:4},{inputs:["knowledge"],output:9}],
    },
    {
      id:"test.reverse-string-gap", family:"string", split:"test",
      inputs:[T.string], output:T.string,
      examples:[{inputs:["abc"],output:"cba"},{inputs:["rust"],output:"tsur"}],
    },
  ],
};
