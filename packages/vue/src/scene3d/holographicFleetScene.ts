/**
 * holographicFleetScene — builds and animates HkStarSystem inside a
 * HkBoard3D engine.
 *
 * The spec (holographicFleetSpec.ts) is pure; this module is the three.js
 * side: holographic polyhedra, data-bound HUD bands, moons, lights, orbit
 * rings, label chips and the per-frame motion/camera tick. The selection mark is
 * NOT built here: the board's own 8-corner cube cursor is pinned onto the
 * selected body through `engine.setSelection` (user direction
 * 2026-10-01).
 *
 * Ownership: everything the builder creates is disposed through its
 * handle — geometries, materials, the glow texture and every registered
 * engine object. A spec update is a full rebuild (fleets are small, the
 * spec is deterministic, so a rebuild is visually seamless).
 */

import * as THREE from "three";
import type { Board3DEngine } from "../components/HkBoard3D";
import { fitDistance, lerpPalette } from "../utils/scene3d";

import {
  makeFleetHologram,
  poseFleetHologram,
  type FleetHologram,
} from "./holographicFleetBody";
import {
  bodyPositionAt,
  fleetEnclosure,
  hologramOuterRadius,
  MOON_RADIUS,
  satelliteOrbit,
  SATELLITE_PALETTE,
  type FleetBodySpec,
  type FleetSceneSpec,
} from "./holographicFleetSpec";

export interface FleetSceneCallbacks {
  /** Build the HTML chip that floats next to a body (name, badges). */
  makeLabel(body: FleetBodySpec): HTMLElement;
  /** The registry-core marker's chip (shown when the fleet has no hub). */
  registryCoreLabel(): HTMLElement;
}

export interface FleetSceneHandle {
  /** Rebuild the sky from a fresh spec. `offline` maps node_id → offline
   *  (offline bodies render dimmed). */
  update(spec: FleetSceneSpec, offline?: Record<string, boolean>): void;
  setSelected(id: string | null): void;
  /** Fly the camera to a body and KEEP FOLLOWING it: bodies revolve, so
   *  the follow cam rides the selected body until the selection is
   *  dropped (user direction 2026-10-01 — a one-shot flight left the
   *  selection drifting out of frame moments after the click). */
  focusBody(id: string): void;
  /** Frame the whole fleet; false when there is nothing to frame. The
   *  camera lands on the sphere the user specified — the fleet's mass
   *  centroid as the centre, the minimal enclosing radius around it
   *  EXTENDED BY 10% — along the CURRENT viewing direction (the opening
   *  pose looks up from under the plane, and framing must not whip that
   *  away). */
  frameFleet(durationMs?: number): boolean;
  dispose(): void;
}

/** Palette stops are linear-space rgb in [0,1] (hikari lerpPalette). */
function toColor(rgb: [number, number, number]): THREE.Color {
  return new THREE.Color(rgb[0], rgb[1], rgb[2]);
}

// ── Glow sprite texture (one owned texture per scene builder) ──────────

function createGlowTexture(): THREE.Texture {
  const size = 128;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    // No 2D canvas available (SSR / DOM-less test runners): fall back to
    // a plain white dot — the sprite still renders, just without the
    // soft radial falloff.
    const tex = new THREE.DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1);
    tex.needsUpdate = true;
    return tex;
  }
  const grad = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  grad.addColorStop(0, "rgba(255,255,255,0.9)");
  grad.addColorStop(0.25, "rgba(255,255,255,0.45)");
  grad.addColorStop(0.6, "rgba(255,255,255,0.12)");
  grad.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);
  return new THREE.CanvasTexture(canvas);
}

interface BodyEntry {
  spec: FleetBodySpec;
  group: THREE.Group;
  mesh: THREE.Mesh;
  hologram: FleetHologram;
  glow: THREE.Sprite | null;
  satellites: THREE.Group[];
}

export function buildFleetScene(
  engine: Board3DEngine,
  callbacks: FleetSceneCallbacks,
): FleetSceneHandle {
  const bodies = new Map<string, BodyEntry>();
  /** Non-registered decoration (lights, orbit rings, the core marker) —
   *  tracked separately so dispose() can strip them from the scene. */
  const decor: THREE.Object3D[] = [];
  /** The spec the current sky was built from (framing reads it). */
  let lastSpec: FleetSceneSpec | null = null;
  /** The board's own distance ceiling, before any framing widened it. */
  const baseMaxDistance =
    (engine.controls as { maxDistance?: number } | undefined)?.maxDistance ?? Infinity;
  let removeTick: (() => void) | null = null;
  let disposed = false;
  const glowTexture = createGlowTexture();

  // Lights live for the builder's lifetime (never rebuilt with the spec).
  const ambient = new THREE.AmbientLight(0xffffff, 0.5);
  const key = new THREE.DirectionalLight(0xf2f5ff, 0.7);
  key.position.set(30, 50, 20);
  decor.push(ambient, key);
  engine.scene.add(ambient, key);

  // The selection mark is the BOARD's cube cursor (user direction
  // 2026-10-01: no ring — the 8-corner frame, pinned for as long as the
  // selection lasts). `setSelected` below hands the id straight to
  // `engine.setSelection`; the board measures the frame once against the
  // body (the same `frameObject` rule the hover frame uses, so coronas
  // and moons stay outside the box), rides the body through its orbit,
  // and re-measures on its own when a roster rebuild swaps the object.

  function disposeObject(root: THREE.Object3D): void {
    root.traverse((obj) => {
      const ownedTextures: unknown = obj.userData.fleetOwnedTextures;
      if (Array.isArray(ownedTextures)) {
        for (const texture of ownedTextures) {
          if (texture instanceof THREE.Texture) texture.dispose();
        }
      }
      // THREE.Sprite shares ONE module-level BufferGeometry across every
      // sprite instance in the process — disposing it here would take the
      // star glows (and any other sprite, including ones created later)
      // down with it. A sprite owns only its material.
      if (obj instanceof THREE.Sprite) {
        obj.material.dispose();
        return;
      }
      // Everything else this builder puts in the scene that owns GPU
      // resources is a Mesh, a Line (orbit rings) or Points (star
      // glows) — all three carry `geometry` + `material`.
      if (
        obj instanceof THREE.Mesh ||
        obj instanceof THREE.Line ||
        obj instanceof THREE.Points
      ) {
        obj.geometry.dispose();
        const mat = obj.material;
        if (Array.isArray(mat)) mat.forEach((m) => m.dispose());
        else mat.dispose();
      }
    });
  }

  function makeOrbitRing(spec: FleetBodySpec): THREE.LineLoop {
    const segments = 96;
    const pts: number[] = [];
    for (let i = 0; i < segments; i++) {
      const a = (i / segments) * Math.PI * 2;
      pts.push(Math.cos(a) * spec.orbitRadius, 0, Math.sin(a) * spec.orbitRadius);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute(pts, 3));
    const ring = new THREE.LineLoop(
      geo,
      new THREE.LineBasicMaterial({
        color: 0x8fa8d8,
        transparent: true,
        opacity: 0.16,
        depthWrite: false,
      }),
    );
    ring.position.set(...spec.orbitCenter);
    ring.rotation.x = spec.orbitTilt;
    return ring;
  }

  function makeStar(spec: FleetBodySpec, offline: boolean): BodyEntry {
    const group = new THREE.Group();
    group.position.set(...spec.orbitCenter);

    // A hub can be offline too — an unlit sun that keeps burning at full
    // brightness while its own chip reads "Offline" would be the one lie
    // the picture tells, so an offline star dims like an offline planet
    // and pulls its corona and light down with it.
    const base = toColor(spec.color);
    const color = offline ? base.clone().multiplyScalar(0.3) : base;
    const hologram = makeFleetHologram(spec, base, offline);
    const mesh = hologram.mesh;
    group.add(hologram.group);

    const glow = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: glowTexture,
        color,
        transparent: true,
        opacity: offline ? 0.16 : 0.34,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    );
    glow.scale.setScalar(spec.radius * 6);
    glow.raycast = () => undefined;
    group.add(glow);

    // The star lights its own system (an offline hub barely lights it).
    const light = new THREE.PointLight(color, offline ? 25 : 70, 0, 1.8);
    group.add(light);

    return { spec, group, mesh, hologram, glow, satellites: [] };
  }

  function makePlanet(spec: FleetBodySpec, offline: boolean): BodyEntry {
    const group = new THREE.Group();
    const base = toColor(spec.color);
    const hologram = makeFleetHologram(spec, base, offline);
    const mesh = hologram.mesh;
    group.add(hologram.group);
    return { spec, group, mesh, hologram, glow: null, satellites: [] };
  }

  function addSatellites(entry: BodyEntry, parentRadius: number, offline: boolean): void {
    for (let j = 0; j < entry.spec.satellites; j++) {
      const h = lerpPalette([...SATELLITE_PALETTE], (j + 1) / (entry.spec.satellites + 1));
      // A moon rides its gateway: an offline gateway with bright moons is
      // the same lie as an offline star burning at full brightness — the
      // whole body dims, not just the sphere in the middle.
      const color = toColor(h);
      if (offline) color.multiplyScalar(0.3);
      const moon = new THREE.Mesh(
        new THREE.SphereGeometry(MOON_RADIUS, 10, 8),
        new THREE.MeshStandardMaterial({ color, roughness: 0.9, metalness: 0.15 }),
      );
      moon.raycast = () => undefined;
      const pivot = new THREE.Group();
      pivot.add(moon);
      const orbit = satelliteOrbit(parentRadius, j);
      moon.position.set(orbit.radius, 0, 0);
      pivot.rotation.x = orbit.tilt;
      pivot.userData.orbit = orbit;
      entry.group.add(pivot);
      entry.satellites.push(pivot);
    }
  }

  function makeRegistryCore(): void {
    const group = new THREE.Group();
    const label = callbacks.registryCoreLabel();
    const coreSpec = {
      id: "__star-system-core__",
      label: label.textContent?.trim() || "Core",
      status: "",
      detail: "",
      role: "star" as const,
      radius: 1.4,
    };
    const hologram = makeFleetHologram(coreSpec, new THREE.Color(0xfff3d6), false);
    group.add(hologram.group);
    const glow = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: glowTexture,
        color: 0xffe9b8,
        transparent: true,
        opacity: 0.38,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    );
    glow.scale.setScalar(7);
    glow.raycast = () => undefined;
    group.add(glow);
    const light = new THREE.PointLight(0xffe9b8, 80, 0, 1.8);
    group.add(light);
    engine.setObject("__star-system-core__", {
      object: group,
      pickable: false,
      content: false,
      marker: "none",
      label,
      labelOffset: [0, hologramOuterRadius(coreSpec) + 0.55, 0],
    });
    // The engine unregisters and detaches consumer objects but never
    // disposes them (it does not own them) — track the core so a rebuild
    // or unmount can free its geometry/materials and HUD texture.
    coreGroup = group;
    coreHologram = hologram;
  }

  /** Drop the registry-core marker and free everything it owns. */
  function dropRegistryCore(): void {
    engine.setObject("__star-system-core__", null);
    if (coreGroup) {
      disposeObject(coreGroup);
      coreGroup = null;
      coreHologram = null;
    }
  }

  /** Margin over the fleet's minimal enclosing radius (user direction:
   *  the movement sphere's radius is that radius + 10%). */
  const FLEET_FRAME_MARGIN = 1.1;

  function frameFleet(durationMs = 0): boolean {
    const enclosure = lastSpec ? fleetEnclosure(lastSpec) : null;
    if (!enclosure) return false;
    const cam = engine.camera;
    const dist = fitDistance(
      enclosure.radius * FLEET_FRAME_MARGIN,
      cam.fov,
      cam.aspect,
    );
    const center = new THREE.Vector3(...enclosure.center);
    // Keep the current viewing direction — framing reframes, it never
    // whips the user (or the opening pose) around to a canonical side.
    const dir = cam.position.clone().sub(engine.controls.target);
    if (dir.lengthSq() < 1e-8) dir.set(0.45, -0.32, 0.83);
    dir.normalize().multiplyScalar(dist);
    const pos = center.clone().add(dir);

    // Two limits have to move before the flight:
    //
    // 1. OrbitControls clamps the radius to [minDistance, maxDistance] on
    //    EVERY update, so a fit beyond the board's static window is pulled
    //    straight back in (the fleet then overflows with no way to zoom
    //    out). This must happen BEFORE `flyTo`, which clamps synchronously.
    //    The ceiling is recomputed from the board's OWN value each time, so
    //    a big fleet widens it and a later small one gives the slack back.
    // 2. The far plane is fixed at 4000 world units and is applied when the
    //    camera projects — order does not matter here, only the value. A
    //    huge single-brood fleet fits beyond it and renders nothing at all
    //    (the CSS2D chips are frustum-tested too, so not even a name is
    //    left behind).
    const controls = engine.controls as { maxDistance?: number } | undefined;
    if (controls && Number.isFinite(baseMaxDistance)) {
      controls.maxDistance = Math.max(baseMaxDistance, dist * 1.25);
    }
    if (cam.far < dist * 4) {
      cam.far = dist * 4;
      cam.updateProjectionMatrix();
    }
    // Note: neither limit follows a later RESIZE. Narrowing the panel after
    // the framing (aspect < ~0.73 for a big fleet) shows the fleet wider
    // than the frustum until something reframes — the board's own
    // min/maxDistance behaved the same way, and clearing the selection
    // reframes.
    engine.flyTo([pos.x, pos.y, pos.z], [center.x, center.y, center.z], durationMs);
    return true;
  }

  function rebuild(spec: FleetSceneSpec): void {
    lastSpec = spec;
    // Strip the previous generation.
    for (const id of [...bodies.keys()]) engine.setObject(id, null);
    for (const entry of bodies.values()) disposeObject(entry.group);
    bodies.clear();
    dropRegistryCore();
    for (let i = decor.length - 1; i >= 0; i--) {
      const obj = decor[i];
      if (obj === ambient || obj === key) continue;
      engine.scene.remove(obj);
      disposeObject(obj);
      decor.splice(i, 1);
    }

    if (spec.hasRegistryCore) makeRegistryCore();

    for (const star of spec.stars) {
      const starOffline = offlineMap[star.id] === true;
      const entry = makeStar(star, starOffline);
      addSatellites(entry, star.radius, starOffline);
      bodies.set(star.id, entry);
      engine.setObject(star.id, {
        object: entry.group,
        // The hover frame wraps the SUN itself, not the system it lights:
        // the registered group also carries the moons (and the board
        // prunes the corona sprite as decoration, but the pivots are real
        // geometry and would widen the bracket to the moon system).
        frameObject: entry.mesh,
        label: callbacks.makeLabel(star),
        labelOffset: [0, hologramOuterRadius(star) + 0.65, 0],
        marker: "dot",
        markerColor: rgbCss(star.color),
      });
    }

    for (const planet of spec.planets) {
      const offline = offlineMap[planet.id] === true;
      const entry = makePlanet(planet, offline);
      addSatellites(entry, planet.radius, offline);
      bodies.set(planet.id, entry);
      const ring = makeOrbitRing(planet);
      decor.push(ring);
      engine.scene.add(ring);
      engine.setObject(planet.id, {
        object: entry.group,
        // Same rule as the stars: the body, never its moon system.
        frameObject: entry.mesh,
        label: callbacks.makeLabel(planet),
        labelOffset: [0, hologramOuterRadius(planet) + 0.55, 0],
        marker: "dot",
        markerColor: rgbCss(planet.color),
      });
    }

    // Pose the bodies at the CURRENT time before framing — a rebuild in
    // the middle of a session must reframe the sky the user is looking at,
    // not the t=0 parking spot.
    poseBodies(lastElapsed);

    // First build frames the whole system; later refreshes hold the
    // user's camera. The latch is only spent by a framing that actually
    // happened — an empty first spec must not burn it.
    if (!framedOnce && frameFleet(0)) framedOnce = true;
  }

  function rgbCss(rgb: [number, number, number]): string {
    return `rgb(${Math.round(rgb[0] * 255)}, ${Math.round(rgb[1] * 255)}, ${Math.round(rgb[2] * 255)})`;
  }

  /** Time of the most recent tick (0 until the first frame).
   *  A rebuild poses the new generation at this instant. */
  let lastElapsed = 0;

  /** The registry-core marker's group (null unless the fleet has no hub). */
  let coreGroup: THREE.Group | null = null;
  let coreHologram: FleetHologram | null = null;

  // The offline map arrives with each update (the roster rows own it).
  let offlineMap: Record<string, boolean> = {};

  let framedOnce = false;

  // ── follow cam (user direction 2026-10-01) ───────────────────────────
  // Bodies revolve; a one-shot focus flight lands where the body WAS and
  // the selection drifts out of frame moments later. While a follow is
  // active, every tick translates the eye AND the orbit pivot by the
  // followed body's motion since the previous frame: the world slides
  // under the camera, while the user's orbit direction, distance and any
  // manual pan survive untouched. Cleared by deselecting, by the followed
  // body leaving the fleet, and by dispose.
  let followId: string | null = null;
  const followLast = new THREE.Vector3();

  // ── focus flight ─────────────────────────────────────────────────────
  // The flight CANNOT be the board's tween. The board applies its tween
  // ABSOLUTELY — every frame it lerps the eye and the pivot between the
  // two poses captured when flyTo was called — and it runs BEFORE this
  // tick, so a follow delta written here is overwritten on the very next
  // frame. Measured on the shipped version: the body walks ~1.67 units
  // during the 650 ms flight, the camera stops ~1.63 units off it and
  // then HOLDS that offset (the follow preserves whatever error it
  // inherits) — the selection reads as "left behind" for its whole life.
  // So the flight lives in this tick and aims at the body's LIVE pose
  // every frame: it comes to rest dead-centre on a moving target, and
  // the delta-follow takes over from a centred state.
  let flight: {
    id: string;
    /** Unit vector pivot→eye, frozen at the click: the flight reframes,
     *  it never whips the user's viewing direction around. */
    dir: THREE.Vector3;
    dist: number;
    fromPos: THREE.Vector3;
    fromTarget: THREE.Vector3;
    /** Seconds of flight elapsed (tick-driven, so tests drive it too). */
    age: number;
    duration: number;
  } | null = null;

  /** A user grab owns the camera: the flight stops where it stands and
   *  the follow (which preserves relative geometry) takes over. */
  function cancelFlight(): void {
    flight = null;
  }
  // OrbitControls fires 'start' on a user grab — that cancels the flight.
  engine.controls.addEventListener("start", cancelFlight);

  /** Re-anchor the follow cam to the CURRENT pose of its body (a rebuild
   *  recreates every group; poses are taken at the same instant, so this
   *  is numerically seamless) — or drop the follow if the body is gone. */
  function reanchorFollow(): void {
    if (!followId) return;
    const entry = bodies.get(followId);
    if (entry) followLast.copy(entry.group.position);
    else followId = null;
  }

  // ── per-frame tick ────────────────────────────────────────────────────
  /** Place every body for time `elapsed`. Called by the tick AND at the
   *  end of a rebuild: framing before the first tick would otherwise fit
   *  the scene with every planet still parked at the origin (the camera
   *  ended up several times too close and never re-framed). */
  function poseBodies(elapsed: number): void {
    for (const entry of bodies.values()) {
      const { spec } = entry;
      if (spec.orbitRadius > 0) {
        entry.group.position.set(...bodyPositionAt(spec, elapsed));
      }
      poseFleetHologram(entry.hologram, elapsed, spec.spinPeriodSec);
      for (const pivot of entry.satellites) {
        const orbit = pivot.userData.orbit as { periodSec: number; phase: number };
        pivot.rotation.y = orbit.phase + (elapsed / orbit.periodSec) * Math.PI * 2;
      }
      if (entry.glow) {
        // A star breathes: slow 6% glow swell keyed off its phase.
        const base = spec.radius * 6;
        entry.glow.scale.setScalar(base * (1 + 0.06 * Math.sin(elapsed * 0.8 + spec.radius)));
      }
    }
    if (coreHologram) poseFleetHologram(coreHologram, elapsed, 80);
  }

  removeTick = engine.addTick((dt, elapsed) => {
    if (disposed) return;
    lastElapsed = elapsed;
    poseBodies(elapsed);

    if (flight) {
      // Focus flight: aim at the body's pose THIS frame, so a moving
      // target is centred at rest. Absolute on purpose — the delta-follow
      // below would stack on top of the interpolation.
      const entry = bodies.get(flight.id);
      if (!entry) {
        cancelFlight();
      } else {
        flight.age += dt;
        const t = Math.min(1, flight.age / flight.duration);
        const k = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
        const destTarget = entry.group.position;
        const destPos = destTarget.clone().addScaledVector(flight.dir, flight.dist);
        engine.camera.position.lerpVectors(flight.fromPos, destPos, k);
        engine.controls.target.lerpVectors(flight.fromTarget, destTarget, k);
        // The follow resumes from wherever the flight has the body now,
        // centred — not from the pose it held at the click.
        followLast.copy(destTarget);
        if (t >= 1) cancelFlight();
      }
    }

    // Follow cam: slide the eye and the orbit pivot by the followed
    // body's motion since the previous frame. Both move by the SAME
    // delta, so the view vector (orbit angle, distance, pan) the user
    // dialed in is preserved exactly — only the world translates.
    const followed = !flight && followId ? bodies.get(followId) : null;
    if (followed) {
      const p = followed.group.position;
      const dx = p.x - followLast.x;
      const dy = p.y - followLast.y;
      const dz = p.z - followLast.z;
      // A non-finite pose must never poison the camera (every later
      // projection would come back NaN).
      if (Number.isFinite(dx) && Number.isFinite(dy) && Number.isFinite(dz)) {
        engine.camera.position.x += dx;
        engine.camera.position.y += dy;
        engine.camera.position.z += dz;
        engine.controls.target.x += dx;
        engine.controls.target.y += dy;
        engine.controls.target.z += dz;
      }
      followLast.set(p.x, p.y, p.z);
    }

    // (The selection mark needs nothing here: the board's cube cursor
    // rides the selected body's own world matrix every frame.)

    // Hover is the BOARD's business now: it wraps whatever the pointer is
    // over in its corner frame without resizing it (the old hover lift
    // scaled the target the user was aiming at). The frame is measured
    // from `frameObject` below — the body mesh, so a hub's corona and a
    // gateway's moons stay outside the box.
  });

  return {
    update(spec: FleetSceneSpec, offline?: Record<string, boolean>) {
      offlineMap = offline ?? {};
      rebuild(spec);
      // rebuild() recreated every group; carry the follow over to the new
      // generation (or drop it when the followed body left the fleet).
      reanchorFollow();
    },
    setSelected(id: string | null) {
      // The cube cursor is the board's: hand the id over and the board
      // measures, rides and re-measures the frame itself. Deselect ends
      // the follow — the reframe owns the camera again. A re-selection
      // WITHOUT a focus (the scene↔list restore path) leaves the camera
      // alone; following resumes on an explicit focusBody.
      engine.setSelection(id);
      if (id === null) {
        followId = null;
        cancelFlight();
      }
    },
    frameFleet,
    focusBody(id: string) {
      const entry = bodies.get(id);
      if (!entry) return;
      followId = id;
      followLast.copy(entry.group.position);
      const cam = engine.camera.position;
      const target = engine.controls.target;
      const dir = new THREE.Vector3(cam.x - target.x, cam.y - target.y, cam.z - target.z);
      if (dir.lengthSq() < 1e-8) dir.set(0.5, 0.4, 1);
      dir.normalize();
      // The scene flies this one itself (see the flight block above). Kill
      // any board tween first — an animated frameFleet still in flight
      // would keep overwriting the eye absolutely, out from under us. An
      // instant flight to the CURRENT pose is a no-op on the camera and
      // cancels the tween (the board's own documented semantics).
      engine.flyTo([cam.x, cam.y, cam.z], [target.x, target.y, target.z], 0);
      flight = {
        id,
        dir,
        dist: Math.max(entry.spec.radius * 7, 4.5),
        fromPos: cam.clone(),
        fromTarget: target.clone(),
        age: 0,
        duration: 0.65,
      };
    },
    dispose() {
      disposed = true;
      removeTick?.();
      engine.setSelection(null);
      flight = null;
      engine.controls.removeEventListener("start", cancelFlight);
      for (const id of [...bodies.keys()]) engine.setObject(id, null);
      for (const entry of bodies.values()) disposeObject(entry.group);
      bodies.clear();
      dropRegistryCore();
      for (const obj of decor) {
        engine.scene.remove(obj);
        disposeObject(obj);
      }
      decor.length = 0;
      glowTexture.dispose();
    },
  };
}
