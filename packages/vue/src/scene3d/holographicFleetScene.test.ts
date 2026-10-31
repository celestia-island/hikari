import { describe, expect, it, vi } from "vitest";
import * as THREE from "three";

import type { Board3DEngine } from "../components/HkBoard3D";
import { fitDistance } from "../utils/scene3d";

import { fakeAs } from "../test-utils/fakes";
import { buildFleetScene } from "./holographicFleetScene";
import {
  bodyReach,
  buildFleetSceneSpec,
  fleetEnclosure,
  MOON_RADIUS,
  satelliteOrbit,
} from "./holographicFleetSpec";

/**
 * fleetScene owns everything it puts into the board: meshes, lights,
 * orbit rings and the label chips. These tests run the REAL three.js
 * scene graph against a minimal engine stub and pin the teardown
 * contract — the class of bug that leaks GPU memory or corrupts shared
 * three.js resources across rebuilds.
 */

interface StubEngine extends Board3DEngine {
  /** Every camera flight the builder issued (the framing is one). */
  flyToCalls: unknown[][];
  registered: Map<
    string,
    { object: THREE.Object3D; frameObject?: THREE.Object3D | null }
  >;
  /** The builder's per-frame tick, so tests can drive the real loop. */
  ticks: Array<(dt: number, elapsed: number) => void>;
  /** Every `setSelection` id the builder handed the board, in order —
   *  the cube cursor is the board's, so this IS the builder's whole
   *  selection story. */
  selections: Array<string | null>;
}

/** The disposable GPU resources one object tree owns. Sprites are skipped:
 *  THREE shares ONE module-level BufferGeometry across every sprite in the
 *  process, so only their material belongs to the tree (the teardown
 *  contract this file pins). */
function collectDisposables(root: THREE.Object3D): {
  geos: Array<{ dispose: () => void }>;
  mats: Array<{ dispose: () => void }>;
} {
  const geos: Array<{ dispose: () => void }> = [];
  const mats: Array<{ dispose: () => void }> = [];
  root.traverse((obj) => {
    if (obj instanceof THREE.Sprite) {
      mats.push(obj.material);
      return;
    }
    if (
      obj instanceof THREE.Mesh ||
      obj instanceof THREE.Line ||
      obj instanceof THREE.Points
    ) {
      geos.push(obj.geometry);
      const material = obj.material;
      if (Array.isArray(material)) mats.push(...material);
      else mats.push(material);
    }
  });
  return { geos, mats };
}

/** Every material this scene builds (the basic/standard Mesh, Line and
 *  Sprite materials) carries a `color`. */
function hasColor(
  material: THREE.Material,
): material is THREE.Material & { color: THREE.Color } {
  return "color" in material;
}

function stubEngine(): StubEngine {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 4000);
  // The board seeds the eye from `initialPosition` before it emits ready.
  camera.position.set(22, -19, 34);
  const registered = new Map<
    string,
    { object: THREE.Object3D; frameObject?: THREE.Object3D | null }
  >();
  const ticks: Array<(dt: number, elapsed: number) => void> = [];
  const selections: Array<string | null> = [];
  const flyToCalls: unknown[][] = [];
  // A real EventDispatcher under the controls shape: OrbitControls fires
  // 'start' when the user grabs the camera, and the flight must yield to it
  // (tests dispatch it by hand). OrbitControls is a large class, so the
  // stub is a documented partial double of it.
  const controls = fakeAs<Board3DEngine["controls"]>(
    Object.assign(new THREE.EventDispatcher(), {
      target: new THREE.Vector3(),
      minDistance: 3,
      maxDistance: 420,
    }),
  );
  // The builder touches eight members of the board's surface; the rest of
  // Board3DEngine is deliberately absent (a partial double, not a 40-member
  // reimplementation).
  return fakeAs<StubEngine>({
    scene,
    camera,
    controls,
    setSelection: (id: string | null) => {
      selections.push(id);
    },
    addTick: (fn: (dt: number, elapsed: number) => void) => {
      ticks.push(fn);
      return () => {
        const i = ticks.indexOf(fn);
        if (i >= 0) ticks.splice(i, 1);
      };
    },
    addPostRender: () => () => undefined,
    setObject(
      id: string,
      def: { object: THREE.Object3D; frameObject?: THREE.Object3D | null } | null,
    ) {
      if (!def) {
        const prev = registered.get(id);
        if (prev) {
          scene.remove(prev.object);
          registered.delete(id);
        }
        return;
      }
      registered.set(id, def);
      scene.add(def.object);
    },
    objects: () => registered,
    flyTo: (
      position: [number, number, number],
      target: [number, number, number],
      durationMs?: number,
    ) => {
      // Mirror the real board: OrbitControls re-applies the distance
      // window on every update, so a ceiling that was widened AFTER the
      // flight would pull the pose back in. Recording the CLAMPED pose is
      // what makes the ordering load-bearing under test.
      const dir = new THREE.Vector3(
        position[0] - target[0],
        position[1] - target[1],
        position[2] - target[2],
      );
      const len = dir.length();
      const max = controls.maxDistance;
      const min = controls.minDistance;
      if (Number.isFinite(max) || min > 0) dir.setLength(Math.min(Math.max(len, min), max));
      flyToCalls.push([
        [target[0] + dir.x, target[1] + dir.y, target[2] + dir.z],
        target,
        durationMs,
      ]);
    },
    frameAll: () => undefined,
    projectToScreen: () => ({ x: 0, y: 0, visible: false }),
    onTheme: () => () => undefined,
    flyToCalls,
    registered,
    ticks,
    selections,
  });
}

function callbacks() {
  return {
    makeLabel: () => document.createElement("div"),
    registryCoreLabel: () => document.createElement("div"),
    onSelect: () => undefined,
  };
}

const ROWS = [
  { node_id: "hub-a", tier: 3, station_count: 4 },
  { node_id: "edge-1", tier: 2, station_count: 3 },
  { node_id: "edge-2", tier: 2, station_count: 0 },
];

describe("buildFleetScene follow cam", () => {
  /** Drive every registered tick from `from` (exclusive) to `to` in 0.5s
   *  steps — the same shape the board's frame loop feeds the builder. */
  function runTicks(engine: StubEngine, from: number, to: number): void {
    for (let t = from + 0.5; t <= to + 1e-9; t += 0.5) {
      for (const tick of engine.ticks) tick(0.5, t);
    }
  }

  const target = (engine: StubEngine) => engine.controls.target;

  /** Drive the ticks at frame cadence for `seconds` (the flight is
   *  tick-timed, so realistic stepping is what exercises it). */
  function runFrames(engine: StubEngine, from: number, seconds: number): void {
    const step = 1 / 60;
    for (let t = from + step; t <= from + seconds + 1e-9; t += step) {
      for (const tick of engine.ticks) tick(step, t);
    }
  }

  it("keeps the camera centred on the focused body while it revolves", () => {
    const engine = stubEngine();
    const handle = buildFleetScene(engine, callbacks());
    handle.update(buildFleetSceneSpec(ROWS), {});
    runTicks(engine, 0, 5); // settle into the motion

    handle.focusBody("edge-1");
    const body = engine.registered.get("edge-1")!.object;
    // The viewing geometry the click asked for: keep the direction, come
    // to the focus distance.
    const dir0 = engine.camera.position.clone().sub(target(engine)).normalize();
    const spec = buildFleetSceneSpec(ROWS).planets.find((p) => p.id === "edge-1")!;
    const dist = Math.max(spec.radius * 7, 4.5);
    const eyeAtFocus = engine.camera.position.clone();

    runFrames(engine, 5, 1.5); // through the 0.65 s flight…
    // …centred ON the body: the pivot sits exactly on it, the eye holds
    // the click's direction at the focus distance. The shipped version
    // stopped ~1.63 units off (the board's tween flew to where the body
    // STOOD at the click) and held that offset forever.
    expect(target(engine).distanceTo(body.position)).toBeLessThan(1e-9);
    const offset = engine.camera.position.clone().sub(body.position);
    expect(offset.length()).toBeCloseTo(dist, 6);
    expect(offset.clone().normalize().dot(dir0)).toBeCloseTo(1, 6);

    runTicks(engine, 6.5, 30); // …then half an orbit and more underneath
    expect(target(engine).distanceTo(body.position)).toBeLessThan(1e-9);
    const offset1 = engine.camera.position.clone().sub(body.position);
    expect(offset1.length()).toBeCloseTo(dist, 6);
    expect(offset1.clone().normalize().dot(dir0)).toBeCloseTo(1, 6);
    // …and the follow is REAL translation, not a frozen scene: the body
    // covered serious ground, so the camera must have too.
    expect(engine.camera.position.distanceTo(eyeAtFocus)).toBeGreaterThan(1);
    handle.dispose();
  });

  it("ends the flight dead-centre even when the body moves through it", () => {
    const engine = stubEngine();
    const handle = buildFleetScene(engine, callbacks());
    handle.update(buildFleetSceneSpec(ROWS), {});
    runTicks(engine, 0, 5);

    // The regression this file exists for, at frame cadence: during the
    // 0.65 s flight the body covers real ground, and the camera must
    // still come to rest ON it — not on the spot it occupied at the
    // click (the board-tween version left a frozen ~1.6 unit miss).
    handle.focusBody("edge-1");
    const body = engine.registered.get("edge-1")!.object;
    const atClick = body.position.clone();
    runFrames(engine, 5, 0.75);
    expect(body.position.distanceTo(atClick)).toBeGreaterThan(0.5);
    expect(target(engine).distanceTo(body.position)).toBeLessThan(1e-9);
    handle.dispose();
  });

  it("hands the camera back once the flight has landed", () => {
    const engine = stubEngine();
    const handle = buildFleetScene(engine, callbacks());
    handle.update(buildFleetSceneSpec(ROWS), {});
    runTicks(engine, 0, 5);

    handle.focusBody("edge-1");
    runFrames(engine, 5, 1.5); // the flight has landed
    // The user nudges the camera by hand: once the flight is done it must
    // not keep forcing the pose, or every manual orbit/zoom would be
    // silently undone on the next frame.
    const body = engine.registered.get("edge-1")!.object;
    engine.camera.position.add(new THREE.Vector3(0.7, -0.3, 1.1));
    const offset = engine.camera.position.clone().sub(body.position);
    runFrames(engine, 6.5, 2);
    const offsetAfter = engine.camera.position.clone().sub(body.position);
    expect(offsetAfter.distanceTo(offset)).toBeLessThan(1e-6);
    handle.dispose();
  });

  it("flies a continuous path, not a snap at the end", () => {
    const engine = stubEngine();
    const handle = buildFleetScene(engine, callbacks());
    handle.update(buildFleetSceneSpec(ROWS), {});
    runTicks(engine, 0, 5);

    handle.focusBody("edge-1");
    const body = engine.registered.get("edge-1")!.object;
    const fromTarget = target(engine).clone();
    // Half the flight: the pivot must be EN ROUTE — part-way toward the
    // body, neither still at the departure nor already snapped onto it.
    // (The end-state alone cannot tell a flight from a final-frame jump;
    // this is what pins the interpolation itself.)
    runFrames(engine, 5, 0.325);
    const halfway = target(engine).clone().sub(fromTarget).length();
    const total = body.position.clone().sub(fromTarget).length();
    expect(halfway).toBeGreaterThan(total * 0.2);
    expect(halfway).toBeLessThan(total * 0.8);
    // …and symmetrically, the REMAINING distance to the (moving) body is
    // also mid-band — a snap would leave ~0 or ~everything.
    const remaining = target(engine).distanceTo(body.position);
    expect(remaining).toBeGreaterThan(total * 0.2);
    expect(remaining).toBeLessThan(total * 0.8);
    handle.dispose();
  });

  it("flies the eased curve, not a straight line", () => {
    const engine = stubEngine();
    const handle = buildFleetScene(engine, callbacks());
    handle.update(buildFleetSceneSpec(ROWS), {});
    runTicks(engine, 0, 5);

    handle.focusBody("edge-1");
    const body = engine.registered.get("edge-1")!.object;
    const from = target(engine).clone();
    // The flight aims at the body's LIVE pose, so at any instant the
    // covered fraction of the CURRENT vector is exactly the ease's k —
    // measurable against a moving target, and it pins the curve's shape:
    // a quarter of the way through the DURATION, easeInOutCubic has
    // covered only ~6% of the distance, where a straight line would
    // already be at 25% (and a snap at 0% or 100%).
    // A quarter of the way through the DURATION, easeInOutCubic has
    // covered only ~6% of the distance, where a straight line would
    // already be at 25% (and a snap at 0% or 100%).
    runFrames(engine, 5, 0.1625);
    const early =
      target(engine).clone().sub(from).length() /
      body.position.clone().sub(from).length();
    expect(early).toBeGreaterThan(0.03);
    expect(early).toBeLessThan(0.12);

    // …and by THREE QUARTERS of the duration (0.325 s more on top of the
    // quarter already driven) it must be nearly there (easeInOutCubic ≈
    // 0.93), where a quadratic-out ease would still be at ~0.56 and a
    // straight line at 0.75.
    runFrames(engine, 5.1667, 0.3208);
    const covered =
      target(engine).clone().sub(from).length() /
      body.position.clone().sub(from).length();
    expect(covered).toBeGreaterThan(0.85);
    expect(covered).toBeLessThan(0.99);
    handle.dispose();
  });

  it("hands the flight over to the follow without a jump-cut", () => {
    const engine = stubEngine();
    const handle = buildFleetScene(engine, callbacks());
    handle.update(buildFleetSceneSpec(ROWS), {});
    runTicks(engine, 0, 5);

    handle.focusBody("edge-1");
    // Through the landing and past it: the pivot must move SMOOTHLY the
    // whole way. A flight that aimed at a stale pose self-heals at the
    // handoff with a one-frame lurch (~1.6 units measured) — the camera
    // jump-cuts onto the body. Normal per-frame motion here is the body's
    // own (~0.05 units at frame cadence), so the bound has 4× headroom
    // while sitting 8× below the lurch.
    // The flight itself moves the pivot fast (that is its job); what must
    // not happen is a NEW spike AFTER it lands. Split the window at the
    // landing: the follow phase's worst frame must not exceed the flight
    // phase's worst frame — a stale-destination flight self-heals at the
    // handoff with a ~1.6-unit frame that dwarfs the flight's own peak.
    let worstInFlight = 0;
    let worstAfter = 0;
    let prev = target(engine).clone();
    const step = 1 / 60;
    for (let t = 5 + step; t <= 5 + 1.2 + 1e-9; t += step) {
      for (const tick of engine.ticks) tick(step, t);
      const now = target(engine);
      const move = now.distanceTo(prev);
      if (t <= 5 + 0.65) worstInFlight = Math.max(worstInFlight, move);
      else worstAfter = Math.max(worstAfter, move);
      prev = now.clone();
    }
    expect(worstAfter).toBeLessThanOrEqual(worstInFlight);
    handle.dispose();
  });

  it("yields the flight to a user grab", () => {
    const engine = stubEngine();
    const handle = buildFleetScene(engine, callbacks());
    handle.update(buildFleetSceneSpec(ROWS), {});
    runTicks(engine, 0, 5);

    handle.focusBody("edge-1");
    runFrames(engine, 5, 0.2); // mid-flight
    const body = engine.registered.get("edge-1")!.object;
    // The user grabs the camera (OrbitControls fires 'start'): the flight
    // stops dead and the follow carries the CURRENT geometry, whatever it
    // was at the grab.
    engine.controls.dispatchEvent(
      { type: "start" },
    );
    const grabbed = engine.camera.position.clone().sub(body.position);
    runFrames(engine, 5.2, 2);
    const after = engine.camera.position.clone().sub(body.position);
    expect(after.distanceTo(grabbed)).toBeLessThan(1e-6);
    handle.dispose();
  });

  it("stops the flight when the selection is dropped mid-flight", () => {
    const engine = stubEngine();
    const handle = buildFleetScene(engine, callbacks());
    handle.update(buildFleetSceneSpec(ROWS), {});
    runTicks(engine, 0, 5);

    handle.focusBody("edge-1");
    runFrames(engine, 5, 0.2); // mid-flight
    handle.setSelected(null);
    const cam0 = engine.camera.position.clone();
    const tgt0 = target(engine).clone();
    runFrames(engine, 5.2, 2);
    // Deselected: the reframe owns the camera; nothing writes it further.
    expect(engine.camera.position.distanceTo(cam0)).toBe(0);
    expect(target(engine).distanceTo(tgt0)).toBe(0);
    handle.dispose();
  });

  it("does not move the camera before a focus", () => {
    const engine = stubEngine();
    const handle = buildFleetScene(engine, callbacks());
    handle.update(buildFleetSceneSpec(ROWS), {});
    runTicks(engine, 0, 3);
    const cam0 = engine.camera.position.clone();
    const tgt0 = target(engine).clone();
    runTicks(engine, 3, 8);
    // No selection → no follow: the sky moves, the camera does not.
    expect(engine.camera.position.distanceTo(cam0)).toBe(0);
    expect(target(engine).distanceTo(tgt0)).toBe(0);
    handle.dispose();
  });

  it("stops following when the selection is dropped", () => {
    const engine = stubEngine();
    const handle = buildFleetScene(engine, callbacks());
    handle.update(buildFleetSceneSpec(ROWS), {});
    handle.focusBody("edge-1");
    runTicks(engine, 0, 6);
    handle.setSelected(null);
    const cam0 = engine.camera.position.clone();
    const tgt0 = target(engine).clone();
    runTicks(engine, 6, 16);
    // The reframe (frameFleet in the view) owns the camera again; the
    // bodies keep orbiting underneath.
    expect(engine.camera.position.distanceTo(cam0)).toBe(0);
    expect(target(engine).distanceTo(tgt0)).toBe(0);
    handle.dispose();
  });

  it("carries the follow across a rebuild without a jump", () => {
    const engine = stubEngine();
    const handle = buildFleetScene(engine, callbacks());
    const spec = buildFleetSceneSpec(ROWS);
    handle.update(spec, {});
    handle.focusBody("edge-1");
    runTicks(engine, 0, 10);
    const body = () => engine.registered.get("edge-1")!.object;
    const eyeOffset0 = engine.camera.position.clone().sub(body().position);

    // A refresh rebuilds every group; the follow must re-anchor to the
    // new generation (same instants → same poses) silently.
    handle.update(spec, {});
    runTicks(engine, 10, 20);
    const eyeOffset1 = engine.camera.position.clone().sub(body().position);
    expect(eyeOffset0.distanceTo(eyeOffset1)).toBeLessThan(1e-6);
    handle.dispose();
  });

  it("ends the follow when the followed body leaves the fleet", () => {
    const engine = stubEngine();
    const handle = buildFleetScene(engine, callbacks());
    handle.update(buildFleetSceneSpec(ROWS), {});
    handle.focusBody("edge-1");
    runTicks(engine, 0, 6);
    handle.setSelected("edge-1"); // re-mark (view does this), follow lives
    handle.update(
      buildFleetSceneSpec([{ node_id: "hub-a", tier: 3, station_count: 4 }]),
      {},
    );
    const cam0 = engine.camera.position.clone();
    runTicks(engine, 6, 16);
    // The body is gone; the camera must freeze rather than chase a ghost.
    expect(engine.camera.position.distanceTo(cam0)).toBe(0);
    handle.dispose();
  });
});

describe("buildFleetScene teardown", () => {
  it("disposes its own geometries and materials on dispose", () => {
    const engine = stubEngine();
    const handle = buildFleetScene(engine, callbacks());
    handle.update(buildFleetSceneSpec(ROWS), {});

    const geos: Array<{ dispose: () => void }> = [];
    const mats: Array<{ dispose: () => void }> = [];
    for (const { object } of engine.registered.values()) {
      const collected = collectDisposables(object);
      geos.push(...collected.geos);
      mats.push(...collected.mats);
    }
    expect(geos.length).toBeGreaterThan(0);
    expect(mats.length).toBeGreaterThan(0);
    const spies = [...geos, ...mats].map((r) => vi.spyOn(r, "dispose"));

    handle.dispose();
    for (const spy of spies) expect(spy).toHaveBeenCalled();
    expect(engine.registered.size).toBe(0);
  });

  it("never disposes THREE's process-wide sprite geometry", () => {
    const engine = stubEngine();
    const handle = buildFleetScene(engine, callbacks());
    handle.update(buildFleetSceneSpec(ROWS), {});

    // Every Sprite in the process shares this one geometry.
    const shared = new THREE.Sprite().geometry;
    const spy = vi.spyOn(shared, "dispose");

    handle.dispose();
    expect(spy).not.toHaveBeenCalled();
    // …and a sprite built afterwards still owns a live geometry.
    const fresh = new THREE.Sprite();
    expect(fresh.geometry).toBe(shared);
    expect(shared.attributes.position).toBeTruthy();
  });

  it("owns and disposes one glow texture per builder, not one per rebuild", () => {
    const engine = stubEngine();
    const handle = buildFleetScene(engine, callbacks());
    const spec = buildFleetSceneSpec(ROWS);
    handle.update(spec, {});

    const textures = new Set<THREE.Texture>();
    for (const { object } of engine.registered.values()) {
      object.traverse((node) => {
        if (!(node instanceof THREE.Sprite)) return;
        const map = node.material.map;
        if (map) textures.add(map);
      });
    }
    expect(textures.size).toBe(1);
    const texture = [...textures][0]!;
    const spy = vi.spyOn(texture, "dispose");

    // Sprite materials turn over with a rebuild; the builder-owned map
    // lives until the whole scene is torn down.
    handle.update(spec, {});
    expect(spy).not.toHaveBeenCalled();
    handle.dispose();
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it("frees real HUD textures when a body generation is replaced", () => {
    const gradient = fakeAs<CanvasGradient>({ addColorStop: vi.fn() });
    const context = fakeAs<CanvasRenderingContext2D>({
      clearRect: vi.fn(),
      fillRect: vi.fn(),
      fillText: vi.fn(),
      measureText: (text: string) => fakeAs<TextMetrics>({ width: text.length * 12 }),
      createRadialGradient: () => gradient,
    });
    const canvasSpy = vi.spyOn(HTMLCanvasElement.prototype, "getContext")
      .mockReturnValue(context);
    const engine = stubEngine();
    const handle = buildFleetScene(engine, callbacks());
    const spec = buildFleetSceneSpec(ROWS);
    try {
      handle.update(spec, {});
      const retired = engine.registered.get("edge-1")!.object;
      const textures: THREE.Texture[] = [];
      retired.traverse((node) => {
        const owned: unknown = node.userData.fleetOwnedTextures;
        if (!Array.isArray(owned)) return;
        for (const texture of owned) {
          if (texture instanceof THREE.Texture) textures.push(texture);
        }
      });
      expect(textures.length).toBeGreaterThan(0);
      const spies = textures.map((texture) => vi.spyOn(texture, "dispose"));
      handle.update(spec, {});
      for (const spy of spies) expect(spy).toHaveBeenCalledTimes(1);
    } finally {
      handle.dispose();
      canvasSpy.mockRestore();
    }
  });

  it("frees the registry-core marker on rebuild and on dispose", () => {
    const engine = stubEngine();
    const handle = buildFleetScene(engine, callbacks());
    // No hubs → the registry core marker exists.
    const coreSpec = buildFleetSceneSpec([
      { node_id: "edge-1", tier: 2, station_count: 1 },
    ]);
    handle.update(coreSpec, {});
    const core = engine.registered.get("__star-system-core__")!;
    expect(core).toBeTruthy();
    const coreGeos = collectDisposables(core.object).geos;
    expect(coreGeos.length).toBeGreaterThan(0);
    const spies = coreGeos.map((g) => vi.spyOn(g, "dispose"));

    // A rebuild (fleet gained a hub → no core) must free the old marker.
    handle.update(buildFleetSceneSpec(ROWS), {});
    expect(engine.registered.has("__star-system-core__")).toBe(false);
    for (const spy of spies) expect(spy).toHaveBeenCalled();
  });

  it("frees the registry-core marker on dispose too", () => {
    const engine = stubEngine();
    const handle = buildFleetScene(engine, callbacks());
    handle.update(
      buildFleetSceneSpec([{ node_id: "edge-1", tier: 2, station_count: 1 }]),
      {},
    );
    const core = engine.registered.get("__star-system-core__")!;
    expect(core).toBeTruthy();
    const { geos, mats } = collectDisposables(core.object);
    expect(geos.length).toBeGreaterThan(0);
    expect(mats.length).toBeGreaterThan(0);
    const spies = [...geos, ...mats].map((r) => vi.spyOn(r, "dispose"));

    handle.dispose();
    for (const spy of spies) expect(spy).toHaveBeenCalled();
    expect(engine.registered.has("__star-system-core__")).toBe(false);
  });

  it("dims offline hubs as well as offline nodes", () => {
    const engine = stubEngine();
    const handle = buildFleetScene(engine, callbacks());
    const spec = buildFleetSceneSpec([
      { node_id: "hub-live", tier: 3, station_count: 0 },
      { node_id: "hub-dark", tier: 3, station_count: 0 },
    ]);
    handle.update(spec, { "hub-dark": true });

    const colorOf = (id: string) => {
      let r = -1;
      engine.registered.get(id)!.object.traverse((o) => {
        if (r >= 0 || !(o instanceof THREE.Mesh)) return;
        const material = Array.isArray(o.material) ? o.material[0] : o.material;
        if (hasColor(material)) r = material.color.r;
      });
      return r;
    };
    const live = spec.stars.find((s) => s.id === "hub-live")!;
    const dark = spec.stars.find((s) => s.id === "hub-dark")!;
    expect(colorOf("hub-live")).toBeCloseTo(live.color[0], 5);
    expect(colorOf("hub-dark")).toBeCloseTo(dark.color[0] * 0.3, 5);
  });
});

describe("buildFleetScene body dressing", () => {
  /** The registered group's centre polyhedron (never a ring or HUD band). */
  function bodyMesh(engine: StubEngine, id: string): THREE.Mesh {
    const group = engine.registered.get(id)!.object;
    const mesh = group.getObjectByName("fleet-hologram-polyhedron");
    expect(mesh, `${id} body mesh`).toBeDefined();
    return mesh as THREE.Mesh;
  }

  it("builds coarse polyhedra with role-specific holographic rings", () => {
    const engine = stubEngine();
    const handle = buildFleetScene(engine, callbacks());
    handle.update(buildFleetSceneSpec(ROWS), {});

    expect(bodyMesh(engine, "hub-a").geometry).toBeInstanceOf(THREE.IcosahedronGeometry);
    expect(bodyMesh(engine, "edge-1").geometry).toBeInstanceOf(THREE.DodecahedronGeometry);
    for (const [id, ringCount] of [["hub-a", 3], ["edge-1", 2]] as const) {
      const root = engine.registered.get(id)!.object;
      const rings = root.getObjectsByProperty("name", "fleet-hologram-ring");
      expect(rings, `${id} holographic ring count`).toHaveLength(ringCount);
      for (const ring of rings) {
        expect(ring.getObjectByName("fleet-hologram-ring-base")).toBeDefined();
        expect(ring.getObjectByName("fleet-hologram-ring-arc")).toBeDefined();
      }
      const faceRings = root.getObjectsByProperty("name", "fleet-hologram-face-ring");
      expect(faceRings, `${id} detached face-ring count`).toHaveLength(
        id === "hub-a" ? 20 : 12,
      );
      for (const faceRing of faceRings) {
        expect(faceRing).toBeInstanceOf(THREE.LineLoop);
        expect(faceRing).not.toBeInstanceOf(THREE.LineSegments);
      }
      expect(
        root.getObjectsByProperty("name", "fleet-hologram-polyhedron-edges"),
        "the shared wireframe cage is gone",
      ).toHaveLength(0);
    }
    handle.dispose();
  });

  it("frees a superseded hologram on rebuild, not just on dispose", () => {
    const engine = stubEngine();
    const handle = buildFleetScene(engine, callbacks());
    const spec = buildFleetSceneSpec(ROWS);
    handle.update(spec, {});

    const retired = engine.registered.get("edge-1")!.object;
    const { geos, mats } = collectDisposables(retired);
    expect(geos.length).toBeGreaterThan(0);
    expect(mats.length).toBeGreaterThan(0);
    const spies = [...geos, ...mats].map((resource) => vi.spyOn(resource, "dispose"));

    // A refresh rebuilds every body: the previous generation's polyhedron,
    // rings, band geometry and materials must not survive as GPU garbage.
    handle.update(spec, {});
    for (const spy of spies) expect(spy).toHaveBeenCalledTimes(1);
    expect(engine.registered.get("edge-1")!.object).not.toBe(retired);
    handle.dispose();
  });

  it("keeps coronas and moons out of recursive picking while the centre stays clickable", () => {
    const starEngine = stubEngine();
    const starHandle = buildFleetScene(starEngine, callbacks());
    const starSpec = buildFleetSceneSpec([{ node_id: "hub-a", tier: 3, station_count: 0 }]);
    starHandle.update(starSpec, {});
    const starGroup = starEngine.registered.get("hub-a")!.object;
    const radius = starSpec.stars[0]!.radius;
    const glowRay = new THREE.Raycaster(
      new THREE.Vector3(radius * 1.6, 0, 10),
      new THREE.Vector3(0, 0, -1),
    );
    expect(glowRay.intersectObject(starGroup, true)).toHaveLength(0);

    const centreHits = new THREE.Raycaster(
      new THREE.Vector3(0, 0, 10),
      new THREE.Vector3(0, 0, -1),
    ).intersectObject(starGroup, true);
    expect(centreHits.length).toBeGreaterThan(0);
    expect(centreHits[0]!.object).toBe(bodyMesh(starEngine, "hub-a"));
    starHandle.dispose();

    const engine = stubEngine();
    const handle = buildFleetScene(engine, callbacks());
    handle.update(buildFleetSceneSpec(ROWS), {});
    const group = engine.registered.get("edge-1")!.object;
    let moon: THREE.Mesh | null = null;
    group.traverse((node) => {
      if (!(node instanceof THREE.Mesh) || !(node.geometry instanceof THREE.SphereGeometry)) return;
      if (node.geometry.parameters.radius === MOON_RADIUS) moon = node;
    });
    expect(moon).not.toBeNull();
    const at = moon!.getWorldPosition(new THREE.Vector3());
    const moonRay = new THREE.Raycaster(
      at.clone().add(new THREE.Vector3(0, 0, 10)),
      new THREE.Vector3(0, 0, -1),
    );
    expect(moonRay.intersectObject(group, true)).toHaveLength(0);
    handle.dispose();
  });

  it("never resizes a body — the board's frame marks it instead", () => {
    const engine = stubEngine();
    const handle = buildFleetScene(engine, callbacks());
    handle.update(buildFleetSceneSpec(ROWS), {});

    // The old hover affordance scaled the body the pointer was aiming at
    // (1.18×, lerped per frame). Nothing may write that scale any more —
    // the hover mark belongs to hikari's corner frame.
    for (const id of ["hub-a", "edge-1"]) {
      expect(bodyMesh(engine, id).scale.x).toBe(1);
    }
    for (let i = 0; i < 5; i += 1) for (const tick of engine.ticks) tick(0.5, i);
    for (const id of ROWS.map((r) => r.node_id)) {
      const mesh = bodyMesh(engine, id);
      expect([mesh.scale.x, mesh.scale.y, mesh.scale.z], `${id} scale`).toEqual([1, 1, 1]);
    }
    handle.dispose();
  });

  it("dims a gateway's moons with the gateway itself", () => {
    const online = stubEngine();
    buildFleetScene(online, callbacks()).update(buildFleetSceneSpec(ROWS), {});
    const offline = stubEngine();
    // BOTH a star (hub-a, tier 3) and a gateway (edge-1, tier 2) go dark:
    // the planet path is a separate call site from the star path, and the
    // regression this guards is per-path.
    buildFleetScene(offline, callbacks()).update(buildFleetSceneSpec(ROWS), {
      "hub-a": true,
      "edge-1": true,
    });

    /** Every body- and moon-mesh colour under a registered group. */
    const colors = (engine: StubEngine, id: string) => {
      const out: number[] = [];
      engine.registered.get(id)!.object.traverse((o) => {
        const mesh = o as THREE.Mesh;
        if (mesh.isMesh && mesh.material) {
          out.push((mesh.material as THREE.MeshStandardMaterial).color.r);
        }
      });
      return out;
    };
    for (const id of ["hub-a", "edge-1"]) {
      const live = colors(online, id);
      const dark = colors(offline, id);
      expect(live.length, `${id} body + moons`).toBeGreaterThan(1);
      for (let i = 0; i < live.length; i += 1) {
        expect(dark[i], `${id} body/moon ${i} dimmed`).toBeCloseTo(live[i] * 0.3, 5);
      }
    }
  });

  it("pins the board's cube cursor on the selected body — and nothing else", () => {
    const engine = stubEngine();
    const handle = buildFleetScene(engine, callbacks());
    handle.update(buildFleetSceneSpec(ROWS), {});

    // The selection mark is the BOARD's persistent cube cursor, addressed
    // by id — the builder's whole story is the ids it hands over: select,
    // re-select, clear.
    handle.setSelected("edge-1");
    expect(engine.selections).toEqual(["edge-1"]);
    handle.setSelected("hub-a");
    expect(engine.selections.at(-1)).toBe("hub-a");
    handle.setSelected(null);
    expect(engine.selections.at(-1)).toBe(null);

    // No scene-owned mark of any kind: the ring is GONE. Every MESH the
    // builder put in the scene lives under a registered body; the only
    // scene-root children it owns are the two lights and the orbit lines.
    const roots = new Set([...engine.registered.values()].map((d) => d.object));
    for (const child of engine.scene.children) {
      if ((child as THREE.Light).isLight || !(child as THREE.Mesh).isMesh) continue;
      let node: THREE.Object3D | null = child;
      while (node && !roots.has(node)) node = node.parent;
      expect(node, "scene mesh belongs to a registered body").not.toBeNull();
    }

    handle.dispose();
    // Dispose never leaves the cursor pinned on a dead scene.
    expect(engine.selections.at(-1)).toBe(null);
  });

  it("hands the hover frame the body mesh, never the whole system", () => {
    const engine = stubEngine();
    const handle = buildFleetScene(engine, callbacks());
    handle.update(buildFleetSceneSpec(ROWS), {});

    // A hub's own subtree carries a corona sprite; a gateway's carries its
    // moon pivots. The frame measures `frameObject`, so it must be the
    // body mesh in both cases.
    for (const id of ["hub-a", "edge-1"]) {
      const def = engine.registered.get(id)!;
      expect(def.frameObject, `${id} frame target`).toBe(bodyMesh(engine, id));
    }
    handle.dispose();
  });
});

describe("buildFleetScene framing", () => {
  it("frames the fleet on its own sphere: centroid + 10% of the enclosing radius", () => {
    const engine = stubEngine();
    // A real aspect, so the fit maths is exercised rather than a 1:1 stub.
    engine.camera.aspect = 16 / 9;
    engine.camera.position.set(22, -19, 34);
    const handle = buildFleetScene(engine, callbacks());
    const spec = buildFleetSceneSpec(ROWS);
    handle.update(spec, {});

    // The first build frames the fleet exactly once — and it is a FLIGHT
    // to the computed pose, not a generic object-bounds fit.
    expect(engine.flyToCalls).toHaveLength(1);
    const [eye, target] = engine.flyToCalls[0] as [number[], number[]];

    const enclosure = fleetEnclosure(spec)!;
    // Centred on the MASS centroid of the drawn bodies…
    expect(target[0]).toBeCloseTo(enclosure.center[0], 5);
    expect(target[1]).toBeCloseTo(enclosure.center[1], 5);
    expect(target[2]).toBeCloseTo(enclosure.center[2], 5);

    // …at the distance that shows the enclosure grown by 10%…
    const dist = Math.hypot(eye[0] - target[0], eye[1] - target[1], eye[2] - target[2]);
    const expected = fitDistance(
      enclosure.radius * 1.1,
      engine.camera.fov,
      engine.camera.aspect,
    );
    expect(dist).toBeCloseTo(expected, 4);

    // …along the direction the page handed in (the opening 仰望 pose:
    // below the plane, looking up at it).
    expect(eye[1] - target[1]).toBeLessThan(0);
    const dir = [eye[0] - target[0], eye[1] - target[1], eye[2] - target[2]].map((v) => v / dist);
    const seed = [22, -19, 34];
    const seedLen = Math.hypot(...seed);
    for (let axis = 0; axis < 3; axis += 1) {
      expect(dir[axis]).toBeCloseTo(seed[axis] / seedLen, 5);
    }
    handle.dispose();
  });

  it("keeps every orbiting body inside the frame, at every phase", () => {
    const engine = stubEngine();
    engine.camera.aspect = 16 / 9;
    engine.camera.position.set(22, -19, 34);
    const handle = buildFleetScene(engine, callbacks());
    handle.update(buildFleetSceneSpec(ROWS), {});

    // Replay the framing flight through a REAL camera: this is the check
    // the sphere exists for. It is phase-sensitive on purpose — a planet
    // is only at its spec's `orbitCenter` for one instant, so an
    // enclosure that forgets the swept orbit throws bodies out of frame
    // the moment they swing wide (measured: ndc up to ±1.35 before the
    // orbit radius went in).
    const [eye, target] = engine.flyToCalls[0] as [number[], number[]];
    const camera = new THREE.PerspectiveCamera(45, 16 / 9, 0.1, 4000);
    camera.position.set(eye[0], eye[1], eye[2]);
    camera.lookAt(new THREE.Vector3(target[0], target[1], target[2]));
    camera.updateMatrixWorld(true);
    camera.updateProjectionMatrix();

    // The board's OrbitControls clamp the radius every frame, so the test
    // has to apply the same window the engine ended up with — the framing
    // may have widened it, but it must never be defeated by it.
    const controls = engine.controls;
    const want = camera.position.distanceTo(new THREE.Vector3(target[0], target[1], target[2]));
    expect(controls.maxDistance).toBeGreaterThanOrEqual(want);
    camera.position
      .sub(new THREE.Vector3(target[0], target[1], target[2]))
      .setLength(Math.min(want, controls.maxDistance))
      .add(new THREE.Vector3(target[0], target[1], target[2]));

    const ids = [...engine.registered.keys()].filter((id) => id !== "__star-system-core__");
    expect(ids.length).toBeGreaterThan(1);
    for (const t of [0, 4.5, 11, 22, 33.3, 47]) {
      for (const tick of engine.ticks) tick(0.1, t);
      for (const id of ids) {
        const at = engine.registered.get(id)!.object.position.clone().project(camera);
        expect(Math.abs(at.x), `${id} @${t}s x`).toBeLessThanOrEqual(1);
        expect(Math.abs(at.y), `${id} @${t}s y`).toBeLessThanOrEqual(1);
        expect(at.z, `${id} @${t}s in front`).toBeLessThan(1);
      }
    }
    handle.dispose();
  });

  it("frames nothing when there is nothing, and still frames later", () => {
    const engine = stubEngine();
    const handle = buildFleetScene(engine, callbacks());
    // An empty first spec (a fleet that emptied between the mount and the
    // first refresh) must not burn the one-shot framing latch.
    handle.update(buildFleetSceneSpec([]), {});
    expect(engine.flyToCalls).toHaveLength(0);

    handle.update(buildFleetSceneSpec(ROWS), {});
    expect(engine.flyToCalls).toHaveLength(1);
    handle.dispose();
  });

  it("builds its moons at the radius the enclosure measures", () => {
    const engine = stubEngine();
    const handle = buildFleetScene(engine, callbacks());
    const spec = buildFleetSceneSpec(ROWS);
    handle.update(spec, {});

    // One constant, two consumers: the drawn sphere and `bodyReach`. Two
    // literals would let the enclosure under-measure what it frames.
    const withMoons = spec.planets.find((p) => p.satellites > 0)!;
    const group = engine.registered.get(withMoons.id)!.object;
    const moons: THREE.Mesh[] = [];
    group.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (mesh.isMesh && mesh.geometry?.type === "SphereGeometry") {
        const params = (mesh.geometry as THREE.SphereGeometry).parameters;
        if (params.radius === MOON_RADIUS) moons.push(mesh);
      }
    });
    expect(moons.length).toBe(withMoons.satellites);
    // …and the reach really accounts for them: the outermost moon's orbit
    // plus its own radius is what the enclosure has to cover.
    const outer = satelliteOrbit(withMoons.radius, withMoons.satellites - 1);
    expect(bodyReach(withMoons)).toBeGreaterThanOrEqual(outer.radius + MOON_RADIUS);
    handle.dispose();
  });

  it("widens the board's distance ceiling for a fleet that does not fit", () => {
    const engine = stubEngine();
    const handle = buildFleetScene(engine, callbacks());
    // A large fleet: the fit needs to sit far outside the board's static
    // 420 window, and OrbitControls would pull it back in every frame.
    // Big enough that the fit lands beyond BOTH the distance window and
    // the far plane the REAL board carries (4000, mirrored by the stub
    // below) — a fleet that only cleared a smaller stub plane would prove
    // the mechanism without exercising the production threshold.
    const big = buildFleetSceneSpec(
      Array.from({ length: 240 }, (_, i) => ({
        node_id: `edge-${String(i).padStart(3, "0")}`,
        tier: 2,
        station_count: i % 3,
      })),
    );
    handle.update(big, {});

    const [, target] = engine.flyToCalls[0] as [number[], number[]];
    const [eye] = engine.flyToCalls[0] as [number[], number[]];
    const dist = Math.hypot(eye[0] - target[0], eye[1] - target[1], eye[2] - target[2]);
    const controls = engine.controls;
    expect(dist).toBeGreaterThan(420);
    expect(controls.maxDistance).toBeGreaterThanOrEqual(dist);
    expect(dist).toBeGreaterThan(4000);

    // The board's far plane is fixed; a fit beyond it renders an empty
    // board, so the framing has to buy the room it needs.
    const cam = engine.camera as THREE.PerspectiveCamera;
    expect(cam.far).toBeGreaterThan(dist);

    // And the framed pose really does hold every body at that distance.
    const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 4000);
    camera.position.set(eye[0], eye[1], eye[2]);
    camera.lookAt(new THREE.Vector3(target[0], target[1], target[2]));
    camera.updateMatrixWorld(true);
    camera.updateProjectionMatrix();
    for (const t of [0, 7, 19, 41]) {
      for (const tick of engine.ticks) tick(0.1, t);
      for (const id of engine.registered.keys()) {
        const at = engine.registered.get(id)!.object.position.clone().project(camera);
        expect(Math.abs(at.x), `${id} @${t}s x`).toBeLessThanOrEqual(1);
        expect(Math.abs(at.y), `${id} @${t}s y`).toBeLessThanOrEqual(1);
      }
    }
    // A later, smaller fleet takes the slack back: the ceiling is derived
    // from the board's own window, not accumulated.
    const small = buildFleetSceneSpec(ROWS);
    handle.update(small, {});
    handle.frameFleet();
    const smallEnc = fleetEnclosure(small)!;
    const smallDist = fitDistance(
      smallEnc.radius * 1.1,
      engine.camera.fov,
      engine.camera.aspect,
    );
    expect(controls.maxDistance).toBeLessThan(dist);
    expect(controls.maxDistance).toBeGreaterThanOrEqual(smallDist);
    handle.dispose();
  });

  it("frames from the CURRENT roster, not from the sky it first built", () => {
    const engine = stubEngine();
    const handle = buildFleetScene(engine, callbacks());
    handle.update(buildFleetSceneSpec(ROWS), {});
    engine.flyToCalls.length = 0;

    // A refresh brings a fleet whose shape is nothing like the first one,
    // then the user clears the selection: the reframe must land on the
    // NEW fleet's centre.
    const grown = buildFleetSceneSpec([
      ...ROWS,
      { node_id: "hub-c", tier: 3, station_count: 1 },
      { node_id: "edge-9", tier: 2, station_count: 6 },
    ]);
    handle.update(grown, {});
    handle.frameFleet();
    const [, target] = engine.flyToCalls.at(-1) as [number[], number[]];
    const enclosure = fleetEnclosure(grown)!;
    for (let axis = 0; axis < 3; axis += 1) {
      expect(target[axis], `axis ${axis}`).toBeCloseTo(enclosure.center[axis], 5);
    }
    // …and it is NOT the first spec's centre.
    const first = fleetEnclosure(buildFleetSceneSpec(ROWS))!;
    const moved = [0, 1, 2].some(
      (axis) => Math.abs(target[axis] - first.center[axis]) > 1e-3,
    );
    expect(moved, "the two rosters frame differently").toBe(true);
    handle.dispose();
  });

  it("reframes a rebuilt sky without losing the user's direction", () => {
    const engine = stubEngine();
    const handle = buildFleetScene(engine, callbacks());
    handle.update(buildFleetSceneSpec(ROWS), {});
    engine.flyToCalls.length = 0;

    // A later refresh holds the camera…
    handle.update(buildFleetSceneSpec(ROWS), {});
    expect(engine.flyToCalls).toHaveLength(0);

    // …and an explicit reframe (clearing the selection) is one flight.
    handle.frameFleet(600);
    expect(engine.flyToCalls).toHaveLength(1);
    expect((engine.flyToCalls[0] as unknown[])[2]).toBe(600);
    // …along the direction the camera was left in (seeded below the
    // plane), not a canonical side.
    const [eye, target] = engine.flyToCalls[0] as [number[], number[]];
    expect(eye[1]).toBeLessThan(target[1]);
    handle.dispose();
  });
});
