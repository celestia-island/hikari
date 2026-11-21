// The capability declaration the Mermaid component runs under, published from a
// SIDE-EFFECT module so it is in force before the wrapper's own module graph is
// evaluated: ES module imports are hoisted, so a statement in the consumer file
// can never run earlier than the imports below it.
//
// What this declaration is, precisely: the Mermaid artifact has **no glue
// interface** (its `interfaces/` are type declarations only) and gets WASI from
// its own direct `@bytecodealliance/preview2-shim/*` imports — not from the
// host. So the declaration is **inert for this component today**; it is here
// because the tairitsu host client's synchronous door requires a declaration to
// exist, and so that a future glue-bearing rewrite of this component inherits
// the right shape instead of silently defaulting to "everything granted".
import { publishCapabilities } from "@celestia-island/tairitsu-host-client";

export const MERMAID_CAPABILITIES = { interfaces: [] as string[], wasiModules: [] as string[] };

/**
 * The value the publish returned (the previous declaration). Exported and read
 * by the engine so this module cannot be dropped as dead code by a bundler that
 * honours `sideEffects`.
 */
export const MERMAID_DECLARATION_PUBLISHED = publishCapabilities(MERMAID_CAPABILITIES);