// The capability declaration the QR component runs under, published from a
// SIDE-EFFECT module so it is in force before the wrapper's own module graph is
// evaluated: ES module imports are hoisted, so a statement in the consumer file
// can never run earlier than the imports below it.
//
// The component is compute-only: no glue interface, no WASI module. The tairitsu
// host client's synchronous door (`createSurface`) serves exactly this shape —
// a statically imported wrapper cannot be handed capabilities it did not bind.
import { publishCapabilities } from "@celestia-island/tairitsu-host-client";

export const QR_CAPABILITIES = { interfaces: [] as string[], wasiModules: [] as string[] };

/**
 * The value the publish returned (the previous declaration). Exported and read
 * by the encoder so this module cannot be dropped as dead code by a bundler that
 * honours `sideEffects`.
 */
export const QR_DECLARATION_PUBLISHED = publishCapabilities(QR_CAPABILITIES);
