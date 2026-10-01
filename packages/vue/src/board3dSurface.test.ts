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
type ModelOpts = barrel.Board3DModelOptions;
type CameraCfg = barrel.Board3DCameraConfig;
type FocusOpts = barrel.Board3DFocusOptions;
type ViewModeT = barrel.Board3DViewMode;

// Type-only probes: these lines exist so the checker resolves the three
// exported types through the barrel itself.
const engineProbe: Engine | null = null;
const defProbe: Def | null = null;
const vecProbe: Vec = [0, 0, 0];
const modelProbe: ModelOpts | null = null;
const cameraProbe: CameraCfg = { fov: 45 };
const focusProbe: FocusOpts = { padding: 1.6, lateralBias: 0 };
const viewModeProbe: ViewModeT = "orbit";
void engineProbe;
void defProbe;
void vecProbe;
void modelProbe;
void cameraProbe;
void focusProbe;
void viewModeProbe;

describe("hikari barrel — 3D board surface", () => {
  it("exports both 3D components", () => {
    expect(barrel.HkBoard3D).toBeTruthy();
    expect(barrel.HkMinimap3D).toBeTruthy();
  });

  it("exports the helper-layer constant consumers need for own decoration", () => {
    expect(barrel.BOARD3D_HELPERS_LAYER).toBe(1);
  });

  it("exports the main-camera gizmo layer and the hover-frame geometry", () => {
    // Consumers drawing their own main-camera-only affordance (and the
    // tests pinning that the minimap never sees one) need the layer; the
    // corner-bracket maths is shared so a bespoke frame matches the
    // built-in one.
    expect(barrel.BOARD3D_MAIN_LAYER).toBe(2);
    expect(typeof barrel.hoverBoxSegments).toBe("function");
    expect(barrel.hoverBoxSegments([1, 1, 1])).toHaveLength(48 * 3);
    for (const name of [
      "HOVER_BOX_ARM_RATIO",
      "HOVER_BOX_PADDING",
      "HOVER_BOX_MIN_EXTENT_RATIO",
    ] as const) {
      expect(typeof (barrel as Record<string, unknown>)[name], name).toBe("number");
    }
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

  it("exports the GLB model layer", () => {
    expect(typeof barrel.ModelLayer).toBe("function");
    // The engine's model surface is part of that contract.
    const engineMethods = [
      "loadModel",
      "setModelOpacity",
      "highlightModel",
      "clearHighlights",
      "modelObject",
      "modelWorldPosition",
      "removeModel",
    ] as const;
    const engine = null as Engine | null;
    void engine;
    // Type-level: the methods exist on Board3DEngine (vue-tsc covers this
    // file, so a rename breaks the gate rather than a consumer).
    type HasModelSurface = Engine extends Record<(typeof engineMethods)[number], unknown>
      ? true
      : false;
    const has: HasModelSurface = true;
    expect(has).toBe(true);
  });

  it("pins the engine's selection surface", () => {
    // `setSelection` is how a page keeps the 8-corner frame on its
    // selected object (the fleet sky's cube cursor). Type-level probe:
    // vue-tsc covers this file, so dropping the method breaks the gate
    // rather than the consumer's build.
    const engine = null as Engine | null;
    void engine;
    type HasSelection = Engine extends { setSelection(id: string | null): void }
      ? true
      : false;
    const has: HasSelection = true;
    expect(has).toBe(true);
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
