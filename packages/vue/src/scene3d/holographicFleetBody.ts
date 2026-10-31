/**
 * holographicFleetBody — one node's polyhedron, holographic rings and
 * data-bound cylindrical HUD band.
 *
 * The visual language is deliberately restrained: a coarse translucent
 * polyhedron, two rings for a standard node (three for a hub), one bright
 * arc per ring, and a slow ticker made ONLY from real caller-supplied
 * fields. Decorative lines and the band never join raycast picking; the
 * centre mesh remains the node's pointer and selection target.
 */

import * as THREE from "three";

import {
  HOLOGRAM_RING_SCALES,
  type FleetBodySpec,
} from "./holographicFleetSpec";

export type FleetHologramInput = Pick<
  FleetBodySpec,
  "id" | "label" | "status" | "detail" | "role" | "radius"
>;

export interface FleetHologramRing {
  pivot: THREE.Group;
  baseY: number;
  speed: number;
}

export interface FleetHologram {
  group: THREE.Group;
  mesh: THREE.Mesh;
  rings: FleetHologramRing[];
  /** Null only when the host cannot create a 2D canvas (SSR/test DOM). */
  hudTexture: THREE.CanvasTexture | null;
}

/** The single source of truth for the outer-surface ticker's content. */
export function hologramHudText(input: FleetHologramInput): string {
  return [input.label, input.status, input.detail]
    .map((part) => part.trim())
    .filter((part) => part.length > 0)
    .join("  ·  ") || input.id;
}

function circleGeometry(radius: number, segments: number): THREE.BufferGeometry {
  const points: number[] = [];
  for (let i = 0; i < segments; i += 1) {
    const angle = (i / segments) * Math.PI * 2;
    points.push(Math.cos(angle) * radius, 0, Math.sin(angle) * radius);
  }
  return new THREE.BufferGeometry().setAttribute(
    "position",
    new THREE.Float32BufferAttribute(points, 3),
  );
}

function arcGeometry(radius: number): THREE.BufferGeometry {
  const points: number[] = [];
  const segments = 32;
  const start = -0.22;
  const span = Math.PI * 0.48;
  for (let i = 0; i <= segments; i += 1) {
    const angle = start + (i / segments) * span;
    points.push(Math.cos(angle) * radius, 0, Math.sin(angle) * radius);
  }
  return new THREE.BufferGeometry().setAttribute(
    "position",
    new THREE.Float32BufferAttribute(points, 3),
  );
}

/** Decorative geometry must not become a broad, invisible pointer target. */
function unpickable<T extends THREE.Object3D>(object: T): T {
  object.raycast = () => undefined;
  return object;
}

function makeRing(
  radius: number,
  index: number,
  color: THREE.Color,
  offline: boolean,
): FleetHologramRing {
  const pivot = new THREE.Group();
  pivot.name = "fleet-hologram-ring";
  const tilts = [0.48, -0.62, 0.86];
  const rolls = [0.18, 0.72, -0.36];
  pivot.rotation.x = tilts[index] ?? 0.4;
  pivot.rotation.z = rolls[index] ?? 0;

  const base = unpickable(new THREE.LineLoop(
    circleGeometry(radius, 128),
    new THREE.LineBasicMaterial({
      color,
      transparent: true,
      opacity: offline ? 0.1 : 0.3,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    }),
  ));
  base.name = "fleet-hologram-ring-base";
  pivot.add(base);

  // One bright arc makes the ring's slow rotation visible without filling
  // the scene with dashed lines, random glyphs or particle noise.
  const arc = unpickable(new THREE.Line(
    arcGeometry(radius),
    new THREE.LineBasicMaterial({
      color,
      transparent: true,
      opacity: offline ? 0.2 : 0.86,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    }),
  ));
  arc.name = "fleet-hologram-ring-arc";
  pivot.add(arc);

  const baseY = index * 0.74;
  pivot.rotation.y = baseY;
  return {
    pivot,
    baseY,
    speed: (index % 2 === 0 ? 1 : -1) * (0.07 + index * 0.025),
  };
}

function makeHudTexture(input: FleetHologramInput): THREE.CanvasTexture | null {
  const canvas = document.createElement("canvas");
  canvas.width = 1024;
  canvas.height = 64;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  const line = hologramHudText(input);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.font = "600 28px ui-monospace, SFMono-Regular, Consolas, monospace";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "#ffffff";

  // Repeat a real sentence around the cylinder. Long host labels are
  // condensed by canvas rather than replaced with a fabricated identifier.
  const maxItemWidth = 460;
  const measured = ctx.measureText(line).width;
  const itemWidth = Math.min(maxItemWidth, Math.max(220, measured + 48));
  for (let x = 24; x < canvas.width; x += itemWidth) {
    ctx.fillText(line, x, canvas.height / 2, maxItemWidth - 48);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.name = "fleet-hologram-hud-texture";
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  return texture;
}

function makeHudBand(
  input: FleetHologramInput,
  color: THREE.Color,
  offline: boolean,
): { mesh: THREE.Mesh; texture: THREE.CanvasTexture } | null {
  const texture = makeHudTexture(input);
  if (!texture) return null;
  const radius = input.radius * 1.05;
  const height = Math.max(0.18, input.radius * 0.23);
  const material = new THREE.MeshBasicMaterial({
    map: texture,
    color,
    transparent: true,
    opacity: offline ? 0.2 : 0.68,
    side: THREE.DoubleSide,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const mesh = unpickable(new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius, height, 96, 1, true),
    material,
  ));
  mesh.name = "fleet-hologram-hud-band";
  return { mesh, texture };
}

export function makeFleetHologram(
  input: FleetHologramInput,
  baseColor: THREE.Color,
  offline: boolean,
): FleetHologram {
  const group = new THREE.Group();
  group.name = "fleet-hologram";
  const color = baseColor.clone();
  const edgeColor = baseColor.clone().lerp(new THREE.Color(0xffffff), 0.18);
  if (offline) {
    color.multiplyScalar(0.3);
    edgeColor.multiplyScalar(0.3);
  }

  const geometry = input.role === "star"
    ? new THREE.IcosahedronGeometry(input.radius * 0.82, 0)
    : new THREE.DodecahedronGeometry(input.radius * 0.82, 0);
  const mesh = new THREE.Mesh(
    geometry,
    new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: offline ? 0.025 : 0.06,
      side: THREE.DoubleSide,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    }),
  );
  mesh.name = "fleet-hologram-polyhedron";
  mesh.rotation.set(0.2, 0, 0.1);

  const edges = unpickable(new THREE.LineSegments(
    new THREE.EdgesGeometry(geometry, 1),
    new THREE.LineBasicMaterial({
      color: edgeColor,
      transparent: true,
      opacity: offline ? 0.26 : 0.78,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    }),
  ));
  edges.name = "fleet-hologram-polyhedron-edges";
  mesh.add(edges);
  group.add(mesh);

  const rings = HOLOGRAM_RING_SCALES[input.role].map((scale, index) => {
    const ring = makeRing(input.radius * scale, index, edgeColor, offline);
    group.add(ring.pivot);
    return ring;
  });

  const hud = makeHudBand(input, edgeColor, offline);
  if (hud) group.add(hud.mesh);
  group.userData.fleetOwnedTextures = hud ? [hud.texture] : [];

  return { group, mesh, rings, hudTexture: hud?.texture ?? null };
}

/** Independent motion: the polyhedron spins, ring arcs precess, and the
 * real-data banner scrolls around the outer surface by UV offset. */
export function poseFleetHologram(
  hologram: FleetHologram,
  elapsed: number,
  spinPeriodSec: number,
): void {
  hologram.mesh.rotation.y = (elapsed / spinPeriodSec) * Math.PI * 2;
  for (const ring of hologram.rings) {
    ring.pivot.rotation.y = ring.baseY + elapsed * ring.speed;
  }
  if (hologram.hudTexture) {
    hologram.hudTexture.offset.x = (elapsed * 0.018) % 1;
  }
}
