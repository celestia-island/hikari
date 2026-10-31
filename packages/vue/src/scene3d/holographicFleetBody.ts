/**
 * holographicFleetBody — one node's hologram: a spherical shell built from
 * six overlapping face dials plus a fat-centre ring spindle, with ONE
 * detailed camera-facing dial at the front carrying the real-data ticker.
 *
 * User direction (2026-10-31): the body must read as a ball of circles
 * from every side — no polyhedron, no solid sphere, no shared wireframe,
 * and no visible cube edges. Main cores (role "star") are larger with
 * denser dial content; node cores (role "planet") are sparser; satellites
 * get a miniature crossed-dial shell with no text. Every decorative line
 * stays out of raycast picking; the invisible centre proxy remains the
 * node's pointer target.
 */

import * as THREE from "three";

import type { FleetBodySpec } from "./holographicFleetSpec";

export type FleetHologramInput = Pick<
  FleetBodySpec,
  "id" | "label" | "status" | "detail" | "role" | "radius"
>;

export interface FleetHologram {
  group: THREE.Group;
  /** Invisible centre proxy; the node's pointer target (never rendered). */
  mesh: THREE.Mesh;
  /** Six faint overlapping face dials: the spherical shell. */
  shell: THREE.Group;
  /** The detailed camera-facing dial that carries the real-data ticker. */
  frontDial: THREE.Group;
  /** Sweeping layer inside the front dial (ticks and arcs rotate here). */
  frontSpinner: THREE.Group;
  /** Circular focus mark, shown while the body is selected. */
  selectionRing: THREE.Group;
  /** The real-data ticker plane at the front dial's centre. */
  hudPanel: THREE.Mesh | null;
  /** Null only when the host cannot create a 2D canvas (SSR/test DOM). */
  hudTexture: THREE.CanvasTexture | null;
}

/** The single source of truth for the dial ticker's content. */
export function hologramHudText(input: FleetHologramInput): string {
  return [input.label, input.status, input.detail]
    .map((part) => part.trim())
    .filter((part) => part.length > 0)
    .join("  ·  ") || input.id;
}

/** Decorative geometry must not become a broad, invisible pointer target. */
function unpickable<T extends THREE.Object3D>(object: T): T {
  object.raycast = () => undefined;
  return object;
}

function xyCircleGeometry(radius: number, segments: number): THREE.BufferGeometry {
  const points: number[] = [];
  for (let i = 0; i < segments; i += 1) {
    const angle = (i / segments) * Math.PI * 2;
    points.push(Math.cos(angle) * radius, Math.sin(angle) * radius, 0);
  }
  return new THREE.BufferGeometry().setAttribute(
    "position",
    new THREE.Float32BufferAttribute(points, 3),
  );
}

function xyArcGeometry(
  radius: number,
  start: number,
  span: number,
  segments = 48,
): THREE.BufferGeometry {
  const points: number[] = [];
  for (let i = 0; i <= segments; i += 1) {
    const angle = start + (i / segments) * span;
    points.push(Math.cos(angle) * radius, Math.sin(angle) * radius, 0);
  }
  return new THREE.BufferGeometry().setAttribute(
    "position",
    new THREE.Float32BufferAttribute(points, 3),
  );
}

function lineMaterial(color: THREE.Color, opacity: number): THREE.LineBasicMaterial {
  return new THREE.LineBasicMaterial({
    color,
    transparent: true,
    opacity,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
}

/** How much content a dial tier draws (user direction: main cores carry
 *  MORE content than node cores — rings, ticks, arcs — never identical). */
interface DialTier {
  rings: ReadonlyArray<{ scale: number; opacity: number }>;
  tickCount: number;
  arcs: ReadonlyArray<{ scale: number; start: number; span: number; opacity: number }>;
  core: boolean;
}

const FOCUS_STAR: DialTier = {
  rings: [
    { scale: 1, opacity: 0.72 },
    { scale: 0.64, opacity: 0.3 },
    { scale: 0.38, opacity: 0.22 },
  ],
  tickCount: 48,
  arcs: [
    { scale: 1, start: -0.25, span: Math.PI * 0.62, opacity: 0.94 },
    { scale: 0.64, start: Math.PI * 0.85, span: Math.PI * 0.2, opacity: 0.62 },
  ],
  core: true,
};

const FOCUS_PLANET: DialTier = {
  rings: [
    { scale: 1, opacity: 0.66 },
    { scale: 0.52, opacity: 0.26 },
  ],
  tickCount: 28,
  arcs: [
    { scale: 1, start: -0.25, span: Math.PI * 0.5, opacity: 0.9 },
  ],
  core: true,
};

/** The five non-facing shell faces: an outline and a faint arc only, so
 *  the sphere stays legible without competing with the front dial. */
const SUPPORT: DialTier = {
  rings: [{ scale: 1, opacity: 0.28 }],
  tickCount: 0,
  arcs: [{ scale: 1, start: -0.25, span: Math.PI * 0.62, opacity: 0.34 }],
  core: false,
};

function focusTierFor(role: "star" | "planet"): DialTier {
  return role === "star" ? FOCUS_STAR : FOCUS_PLANET;
}

/** One circular dial in the XY plane, drawn to a content tier. */
function makeFaceDial(
  radius: number,
  color: THREE.Color,
  offline: boolean,
  tier: DialTier,
): THREE.Group {
  const dial = new THREE.Group();
  dial.name = "fleet-hologram-face-dial";

  for (const ring of tier.rings) {
    const line = unpickable(new THREE.LineLoop(
      xyCircleGeometry(radius * ring.scale, 160),
      lineMaterial(color, offline ? ring.opacity * 0.24 : ring.opacity),
    ));
    line.name = "fleet-hologram-face-dial-ring";
    dial.add(line);
  }

  if (tier.tickCount > 0) {
    const ticks: number[] = [];
    for (let i = 0; i < tier.tickCount; i += 1) {
      const angle = (i / tier.tickCount) * Math.PI * 2;
      const major = i % 4 === 0;
      const inner = radius - radius * (major ? 0.13 : 0.06);
      const outer = radius + radius * (major ? 0.05 : 0.025);
      ticks.push(Math.cos(angle) * inner, Math.sin(angle) * inner, 0);
      ticks.push(Math.cos(angle) * outer, Math.sin(angle) * outer, 0);
    }
    const tickMarks = unpickable(new THREE.LineSegments(
      new THREE.BufferGeometry().setAttribute(
        "position",
        new THREE.Float32BufferAttribute(ticks, 3),
      ),
      lineMaterial(color, offline ? 0.12 : 0.58),
    ));
    tickMarks.name = "fleet-hologram-face-dial-ticks";
    dial.add(tickMarks);
  }

  for (const arc of tier.arcs) {
    const line = unpickable(new THREE.Line(
      xyArcGeometry(radius * arc.scale, arc.start, arc.span),
      lineMaterial(color, offline ? arc.opacity * 0.22 : arc.opacity),
    ));
    line.name = "fleet-hologram-face-dial-arc";
    dial.add(line);
  }

  if (tier.core) {
    const core = unpickable(new THREE.Mesh(
      new THREE.CircleGeometry(radius * 0.16, 32),
      new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity: offline ? 0.08 : 0.26,
        side: THREE.DoubleSide,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    ));
    core.name = "fleet-hologram-face-dial-core";
    dial.add(core);
  }
  return dial;
}

/** Six overlapping support dials on the cube's face axes. Their rims
 *  merge into one rounded envelope — the box itself must stay invisible
 *  (user direction 2026-10-31: fusing the two structures is not allowed
 *  to leave a readable cube behind). */
function makeDiscShell(
  bodyRadius: number,
  color: THREE.Color,
  offline: boolean,
): THREE.Group {
  const shell = new THREE.Group();
  shell.name = "fleet-hologram-disc-shell";
  const faceOffset = bodyRadius * 0.4;
  const dialRadius = bodyRadius * 0.8;
  const faces: Array<{ position: [number, number, number]; rotation: [number, number, number] }> = [
    { position: [0, 0, faceOffset], rotation: [0, 0, 0] },
    { position: [0, 0, -faceOffset], rotation: [0, Math.PI, 0] },
    { position: [faceOffset, 0, 0], rotation: [0, Math.PI / 2, 0] },
    { position: [-faceOffset, 0, 0], rotation: [0, -Math.PI / 2, 0] },
    { position: [0, faceOffset, 0], rotation: [-Math.PI / 2, 0, 0] },
    { position: [0, -faceOffset, 0], rotation: [Math.PI / 2, 0, 0] },
  ];
  for (const face of faces) {
    const dial = makeFaceDial(dialRadius, color, offline, SUPPORT);
    dial.position.set(...face.position);
    dial.rotation.set(...face.rotation);
    shell.add(dial);
  }
  return shell;
}

/** A stack of concentric circles along the Z axis: fat at the equator,
 *  tapering to thin rings at the poles (user direction 2026-10-31 — this
 *  is the second of the two fused structures; it rounds the shell into a
 *  ball and keeps every side view a set of nested circles). */
function makeRingSpindle(
  bodyRadius: number,
  color: THREE.Color,
  offline: boolean,
  count: number,
): THREE.Group {
  const spindle = new THREE.Group();
  spindle.name = "fleet-hologram-ring-spindle";
  for (let i = 0; i < count; i += 1) {
    const t = count === 1 ? 0 : -0.97 + (1.94 * i) / (count - 1);
    const radius = bodyRadius * Math.sqrt(Math.max(0, 1 - t * t)) * 0.98;
    const loop = unpickable(new THREE.LineLoop(
      xyCircleGeometry(radius, 160),
      lineMaterial(color, offline ? 0.04 : 0.08 + (1 - Math.abs(t)) * 0.12),
    ));
    loop.name = "fleet-hologram-ring-spindle-circle";
    loop.position.z = bodyRadius * t;
    spindle.add(loop);
  }
  return spindle;
}

function makeHudTexture(input: FleetHologramInput): THREE.CanvasTexture | null {
  const canvas = document.createElement("canvas");
  canvas.width = 1024;
  canvas.height = 96;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  const line = hologramHudText(input);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.font = "600 34px ui-monospace, SFMono-Regular, Consolas, monospace";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "#ffffff";

  // A clipped horizontal ticker for the dial's centre (user direction
  // 2026-10-31: the text belongs to the disc's middle, not a wrapping
  // ribbon). Long host labels are condensed by canvas rather than
  // replaced with fabricated data.
  const maxItemWidth = 610;
  const measured = ctx.measureText(line).width;
  const itemWidth = Math.min(maxItemWidth, Math.max(360, measured + 64));
  for (let x = 24; x < canvas.width; x += itemWidth) {
    ctx.fillText(line, x, canvas.height / 2, maxItemWidth - 48);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.name = "fleet-hologram-hud-texture";
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  return texture;
}

/** The real-data ticker plane, pinned to the front dial's centre. */
function makeTickerPlane(
  bodyRadius: number,
  color: THREE.Color,
  offline: boolean,
  texture: THREE.CanvasTexture,
): THREE.Mesh {
  const mesh = unpickable(new THREE.Mesh(
    new THREE.PlaneGeometry(bodyRadius * 1.14, bodyRadius * 0.3),
    new THREE.MeshBasicMaterial({
      map: texture,
      color,
      transparent: true,
      opacity: offline ? 0.18 : 0.86,
      side: THREE.DoubleSide,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    }),
  ));
  mesh.name = "fleet-hologram-hud-panel";
  return mesh;
}

/** The circular focus mark that replaces the board's cube cursor while a
 *  body is selected (straight corners would fight the ring silhouette). */
function makeSelectionRing(
  bodyRadius: number,
  color: THREE.Color,
  offline: boolean,
): THREE.Group {
  const ring = new THREE.Group();
  ring.name = "fleet-hologram-selection-ring";
  ring.visible = false;
  for (const [scale, opacity] of [[1.02, 0.8], [1.08, 0.24]] as const) {
    const line = unpickable(new THREE.LineLoop(
      xyCircleGeometry(bodyRadius * scale, 160),
      lineMaterial(color, offline ? opacity * 0.2 : opacity),
    ));
    line.name = "fleet-hologram-selection-ring-line";
    ring.add(line);
  }
  return ring;
}

export function makeFleetHologram(
  input: FleetHologramInput,
  baseColor: THREE.Color,
  offline: boolean,
): FleetHologram {
  const group = new THREE.Group();
  group.name = "fleet-hologram";
  const color = baseColor.clone().lerp(new THREE.Color(0xffffff), 0.18);
  if (offline) color.multiplyScalar(0.3);

  // The visible object is the disc shell plus its spindle; this invisible
  // proxy is only the pointer target the board measures for picking.
  const mesh = new THREE.Mesh(
    new THREE.IcosahedronGeometry(input.radius * 0.55, 1),
    new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0,
      depthWrite: false,
    }),
  );
  mesh.name = "fleet-hologram-core";

  const shell = makeDiscShell(input.radius, color, offline);
  shell.add(makeRingSpindle(
    input.radius,
    color,
    offline,
    input.role === "star" ? 9 : 6,
  ));
  group.add(shell);

  const frontDial = new THREE.Group();
  frontDial.name = "fleet-hologram-front-dial";
  const frontSpinner = new THREE.Group();
  frontSpinner.name = "fleet-hologram-front-spinner";
  frontSpinner.add(makeFaceDial(input.radius * 0.8, color, offline, focusTierFor(input.role)));
  frontDial.add(frontSpinner);

  const hudTexture = makeHudTexture(input);
  let hudPanel: THREE.Mesh | null = null;
  if (hudTexture) {
    hudPanel = makeTickerPlane(input.radius, color, offline, hudTexture);
    hudPanel.position.z = input.radius * 0.02;
    frontDial.add(hudPanel);
  }
  group.add(frontDial);

  const selectionRing = makeSelectionRing(input.radius, color, offline);
  group.add(selectionRing);
  group.add(mesh);

  group.userData.fleetOwnedTextures = hudTexture ? [hudTexture] : [];

  return {
    group,
    mesh,
    shell,
    frontDial,
    frontSpinner,
    selectionRing,
    hudPanel,
    hudTexture,
  };
}

/** A satellite's miniature hologram: three crossed support dials and a
 *  three-ring spindle — the same visual language as its gateway, at
 *  endpoint scale and with no text (user direction 2026-10-31: EVERY
 *  solid sphere in the scene is replaced, hierarchy carried by size and
 *  content density). */
export function makeSatelliteHologram(
  radius: number,
  baseColor: THREE.Color,
  offline: boolean,
): THREE.Group {
  const group = new THREE.Group();
  group.name = "fleet-hologram-satellite";
  const color = baseColor.clone().lerp(new THREE.Color(0xffffff), 0.18);
  if (offline) color.multiplyScalar(0.3);
  const orientations: Array<[number, number, number]> = [
    [0, 0, 0],
    [0, Math.PI / 3, Math.PI / 4],
    [Math.PI / 3, 0, -Math.PI / 5],
  ];
  for (const [rx, ry, rz] of orientations) {
    const dial = makeFaceDial(radius, color, offline, SUPPORT);
    dial.rotation.set(rx, ry, rz);
    group.add(dial);
  }
  group.add(makeRingSpindle(radius, color, offline, 3));
  return group;
}

/** Independent motion: the shell turns slowly, the front dial and the
 *  selection ring face the camera, the dial's ticks sweep, and the
 *  real-data ticker scrolls across the disc's centre. */
export function poseFleetHologram(
  hologram: FleetHologram,
  elapsed: number,
  spinPeriodSec: number,
  cameraQuaternion?: THREE.Quaternion,
): void {
  hologram.shell.rotation.y = (elapsed / spinPeriodSec) * Math.PI * 2;
  hologram.shell.rotation.x = Math.sin(elapsed * 0.08) * 0.06;
  hologram.frontSpinner.rotation.z = elapsed * 0.11;
  if (cameraQuaternion) {
    hologram.frontDial.quaternion.copy(cameraQuaternion);
    hologram.selectionRing.quaternion.copy(cameraQuaternion);
  }
  if (hologram.hudTexture) {
    hologram.hudTexture.offset.x = (elapsed * 0.018) % 1;
  }
}
