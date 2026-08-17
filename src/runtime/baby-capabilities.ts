import { defaultCapabilities, CapabilityRegistry } from "./capabilities.js";
import { mergeCapabilities } from "./filesystem-capabilities.js";
import { portableCoreCapabilities, portableStringLengthCapability } from "./portable-capabilities.js";
import { nodePortableHost, portableHostCapabilities, type PortableHost } from "./portable-host-capabilities.js";

/**
 * The practical "baby knows the boring universal stuff" capability surface.
 * Experimental checkpoints can keep using defaultCapabilities(); interactive
 * development should prefer this pack.
 */
export function babyCapabilities(host:PortableHost=nodePortableHost()):CapabilityRegistry {
  const base=defaultCapabilities();
  // Override legacy UTF-16 JS string length with portable Unicode-code-point semantics.
  base.register(portableStringLengthCapability());
  return mergeCapabilities(base,portableCoreCapabilities(),portableHostCapabilities(host));
}
