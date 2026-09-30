import { describe, expect, it } from "vitest";

import * as barrel from "./index";

/**
 * The public surface of the 3D board, pinned.
 *
 * hikari ships SOURCE (package main = src/index.ts), so a consumer's
 * `vue-tsc` compiles this barrel and everything it re-exports. Two
 * halves matter and only one of them is testable at runtime:
 *
 *  - runtime names (components, constants, utils) — asserted below;
 *  - TYPE-only names (the engine handle, the object definition, the vec
 *    type) — a runtime assertion can never see them, so they are
 *    imported and used in this file instead: `vue-tsc --noEmit` covers
 *    every test file, which makes dropping a type export a gate failure
 *    rather than a silent break for consumers.
 */

type Engine = barrel.Board3DEngine;
type Def = barrel.Board3DObjectDef;
type Vec = barrel.Vec3;

// Type-only probes: these lines exist so the checker resolves the three
// exported types through the barrel itself.
const engineProbe: Engine | null = null;
const defProbe: Def | null = null;
const vecProbe: Vec = [0, 0, 0];
void engineProbe;
void defProbe;
void vecProbe;

describe("hikari barrel — 3D board surface", () => {
  it("exports both 3D components", () => {
    expect(barrel.HkBoard3D).toBeTruthy();
    expect(barrel.HkMinimap3D).toBeTruthy();
  });

  it("exports the helper-layer constant consumers need for own decoration", () => {
    expect(barrel.BOARD3D_HELPERS_LAYER).toBe(1);
  });

  it("exports the scene3d utilities (palette, orbit, fit, zoom)", () => {
    const fns = [
      "hashIdToUnit",
      "lerpPalette",
      "paletteColorForId",
      "orbitDelta",
      "sphericalPosition",
      "fitDistance",
      "viewPlaneHalfExtents",
      "planeCorners",
      "clampMinimapZoom",
    ] as const;
    for (const name of fns) {
      expect(typeof (barrel as Record<string, unknown>)[name], name).toBe("function");
    }
  });

  it("exports the minimap governance constants, drag sensitivity included", () => {
    // A consumer writing its own drag control needs the same sensitivity
    // the built-in one uses — it must not stay module-private.
    for (const name of [
      "MINIMAP_MIN_POLAR",
      "MINIMAP_MAX_POLAR",
      "MINIMAP_DRAG_RADIANS_PER_PX",
      "MINIMAP_ZOOM_STEP_PERCENT",
      "MINIMAP_MIN_ZOOM_PERCENT",
      "MINIMAP_MAX_ZOOM_PERCENT",
    ] as const) {
      expect(typeof (barrel as Record<string, unknown>)[name], name).toBe("number");
    }
  });
});
