// wasmFleetSpec.ts — the wasm-backed fleet scene spec builder, loaded through
// the tairitsu host client (stage 3).
//
// Bridges hikari-wasm-scene3d (the Rust component that computes the
// deterministic solar-system layout) into the TS FleetSceneSpec shape the
// three.js renderer consumes. The TS buildFleetSceneSpec stays as the
// reference implementation and test oracle; this bridge routes production
// traffic through the wasm component.
//
// The facade is SYNCHRONOUS (user ruling: callers do not change). The host
// client's synchronous door (`createSurface`) is what makes that possible. The
// wrapper is loaded with a DYNAMIC import so a broken artifact degrades this
// builder instead of aborting the module graph that hosts it: a static import
// is evaluated before this file's body runs, so no `try` here could ever catch
// its failure and the whole page went blank (#1498).
import { SCENE3D_CAPABILITIES, SCENE3D_DECLARATION_PUBLISHED } from "./declare-caps";
import {
  createSurface,
  HostClientError,
  type HostComponent,
} from "@celestia-island/tairitsu-host-client";

import type { FleetBodySpec, FleetRowLike, FleetSceneSpec } from "./holographicFleetSpec";
import type { Vec3 } from "../utils/scene3d";

/** The component's `celestia:hikari-scene3d/types` shape, as the wrapper returns it. */
interface WasmFleetBodySpec {
  id: string;
  label: string;
  status: string;
  online: boolean;
  detail: string;
  role: string;
  color: readonly [number, number, number];
  radius: number;
  orbitCenter: readonly [number, number, number];
  orbitRadius: number;
  orbitPeriodSec: number;
  orbitPhase: number;
  orbitTilt: number;
  spinPeriodSec: number;
  satellites: number;
  satelliteTotal: number;
}

interface WasmFleetSceneSpec {
  stars: WasmFleetBodySpec[];
  planets: WasmFleetBodySpec[];
  hasRegistryCore: boolean;
}

/** Thrown when the spec builder is called before the component is usable. */
export class Scene3dNotReadyError extends Error {
  constructor(cause?: unknown) {
    super(
      "the scene3d component is not loaded; await scene3dReady (or render again once it resolves)",
      { cause },
    );
    this.name = "Scene3dNotReadyError";
  }
}

let surface: HostComponent | undefined;
let loadFailure: Scene3dNotReadyError | undefined;
let loadPromise: Promise<void> | undefined;

/** Start loading; cached so every caller shares one attempt. */
function ensureLoadedOnce(): Promise<void> {
  if (!loadPromise) {
    loadPromise = import("../wasm/scene3d/hikari_wasm_scene3d.js")
      .then((wrapper) =>
        createSurface(
          wrapper as unknown as Record<string, unknown>,
          // Hand the declaration to the door, don't just publish it: with the
          // parameter omitted it defaults to `{}`, so the door's own refusal
          // (`sync-door-cannot-provide`) can never fire and a wrong declaration
          // would pass unnoticed. Passing it makes the declaration checkable.
          SCENE3D_CAPABILITIES,
        ),
      )
      .then((built) => {
        surface = built;
      })
      .catch((error: unknown) => {
        // Kept as the component's own error type so a caller can recognise it,
        // and re-thrown so the ready promise REJECTS: resolving here would tell
        // a waiting host the component is usable when it is not (measured — the
        // facade stayed silent and every later call returned nothing).
        loadFailure = new Scene3dNotReadyError(error);
        // Clear the cached attempt so the next call retries, matching
        // `useHighlight`: a transient failure (a 404, a dropped connection)
        // otherwise degrades this component for the rest of the session.
        loadPromise = undefined;
        throw loadFailure;
      });
  }
  return loadPromise;
}

/** Resolves once the component is usable; rejects if it could not be built. */
export function whenScene3dReady(): Promise<void> {
  return ensureLoadedOnce().then(() => {
    if (!surface) throw loadFailure ?? new Scene3dNotReadyError();
  });
}

/** Snapshot of the first attempt, kept for callers that only want a value. */
export const scene3dReady: Promise<void> = whenScene3dReady();

/** Keeps the declaration module live for bundlers that honour `sideEffects`. */
export const scene3dCapabilities = SCENE3D_CAPABILITIES;
void SCENE3D_DECLARATION_PUBLISHED;

scene3dReady.catch(() => {
  // Consumed by callers that care; a rejected module-level promise nobody
  // handles would be an unhandled rejection.
});

/** WIT tuple → TS Vec3 (both are 3-element arrays at runtime). */
const toVec3 = (t: readonly [number, number, number]): Vec3 => [t[0], t[1], t[2]];

/** Adapt the wasm component's FleetBodySpec to the TS shape. */
function adaptBody(b: WasmFleetBodySpec): FleetBodySpec {
  return {
    id: b.id,
    label: b.label,
    status: b.status,
    online: b.online,
    detail: b.detail,
    role: b.role === "star" ? "star" : "planet",
    color: toVec3(b.color),
    radius: b.radius,
    orbitCenter: toVec3(b.orbitCenter),
    orbitRadius: b.orbitRadius,
    orbitPeriodSec: b.orbitPeriodSec,
    orbitPhase: b.orbitPhase,
    orbitTilt: b.orbitTilt,
    spinPeriodSec: b.spinPeriodSec,
    satellites: b.satellites,
    satelliteTotal: b.satelliteTotal,
  };
}

/** Build the fleet scene spec through the wasm component. */
export function buildFleetSceneSpecWasm(rows: readonly FleetRowLike[]): FleetSceneSpec {
  if (!surface) throw loadFailure ?? new Scene3dNotReadyError();
  const wasmRows = rows.map((r) => ({
    nodeId: r.node_id,
    tier: r.tier,
    stationCount: r.station_count,
    label: r.label,
    status: r.status,
    online: r.online,
    detail: r.detail,
  }));
  // The wrapper's export is `buildFleetScene`, not the WIT func name
  // (`build-fleet-scene`): jco names JS exports in camelCase and the host
  // client's `pickExport` looks up an exact own property, so the call must use
  // the JS name. (The QR/Mermaid cuts export bare identifiers, which is why
  // this only shows up here.)
  const result = surface.call<WasmFleetSceneSpec>("buildFleetScene", wasmRows);
  return {
    stars: result.stars.map(adaptBody),
    planets: result.planets.map(adaptBody),
    hasRegistryCore: result.hasRegistryCore,
  };
}

export { HostClientError };
