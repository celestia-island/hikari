// The capability declaration the QR component runs under, published from a
// SIDE-EFFECT module so it is in force before the wrapper's own module graph is
// evaluated: ES module imports are hoisted, so a statement in the consumer file
// can never run earlier than the imports below it.
//
// What this declaration is, precisely: the QR artifact has **no glue interface**
// (its `interfaces/` are type declarations only) and gets WASI from its own direct
// `@bytecodealliance/preview2-shim/*` imports — not from the host. Nothing in this
// component, or in its artifact, reads the published realm value at all
// (`__TAIRITSU_CAPABILITIES__`: zero hits under `src/wasm/qr/**`). So the publish
// is **inert for this component today**.
//
// What actually guards anything is the **argument**: `qrEncoder` passes this same
// object to `createSurface(module, capabilities)`, and the door refuses a
// non-empty declaration. The publish and that argument are two independent facts
// — publishing a value does not put it in front of the door — so a future
// glue-bearing rewrite must keep passing the object it declares here. That
// hand-off is what `qrHostSurface.test.ts` pins; the publish alone guards nothing.
import { publishCapabilities } from "@celestia-island/tairitsu-host-client";

export const QR_CAPABILITIES = { interfaces: [] as string[], wasiModules: [] as string[] };

/**
 * The value the publish returned (the previous declaration). Exported and read
 * by the encoder so this module cannot be dropped as dead code by a bundler that
 * honours `sideEffects`.
 */
export const QR_DECLARATION_PUBLISHED = publishCapabilities(QR_CAPABILITIES);
