import {
  labelActivationOutcome, chooseActivation
} from "../dist/index.js";

const observations=[
  {
    id:"easy-triple",
    primitive:{solved:true,candidates:5},
    learned:{solved:true,candidates:10},
    features:{primitiveDepthHint:2,retrievedScore:150,librarySize:13,retrievedCount:1},
  },
  {
    id:"hard-octuple",
    primitive:{solved:true,candidates:434},
    learned:{solved:true,candidates:82},
    features:{primitiveDepthHint:4,retrievedScore:150,librarySize:13,retrievedCount:1},
  }
];

const labeled=observations.map(x=>({...x,oracle:labelActivationOutcome({primitive:x.primitive,learned:x.learned}),policy:chooseActivation(x.features)}));

// Simulate repeated evidence becoming available for the easy and hard regimes.
const learnedPolicy=[
  {
    id:"easy-triple-after-history",
    decision:chooseActivation({...observations[0].features,priorMeanSavings:-5,priorObservations:3}),
  },
  {
    id:"hard-octuple-after-history",
    decision:chooseActivation({...observations[1].features,priorMeanSavings:352,priorObservations:3}),
  }
];

console.log(JSON.stringify({version:"activation-v0.1",labeled,learnedPolicy},null,2));
