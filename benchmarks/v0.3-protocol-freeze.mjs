import {
  MemoryProgramLibrary, defaultCapabilities, V03_PRIMITIVE_CANDIDATES,
  freezePrimitiveSelection, freezePrimitiveExperimentProtocol
} from "../dist/index.js";
const selection=freezePrimitiveSelection(V03_PRIMITIVE_CANDIDATES,defaultCapabilities(),new MemoryProgramLibrary());
const protocol=freezePrimitiveExperimentProtocol(selection);
console.log(JSON.stringify({
  status:"PROTOCOL_FROZEN_NO_SCORED_ITEMS_IMPORTED",
  selectionHash:selection.selectionHash,
  primitives:selection.primitives.map(x=>x.id),
  protocol
},null,2));
