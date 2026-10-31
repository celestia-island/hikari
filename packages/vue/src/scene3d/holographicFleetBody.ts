/**
 * holographicFleetBody — one node's polyhedron, holographic rings and
 * data-bound cylindrical HUD band.
 *
 * The visual language is deliberately restrained: a coarse translucent
 * polyhedron whose FACES each carry an independent in-plane ring (no shared
 * wireframe edges), two orbit rings for a standard node (three for a hub),
 * one bright arc per orbit ring, and a slow ticker made ONLY from real
 * caller-supplied fields. Decorative lines and the band never join raycast
 * picking; the centre mesh remains the node's pointer and selection target.
 */

import * as THREE from "three";

import type { FleetBodySpec } from "./holographicFleetSpec";

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
  /** Invisible centre sphere; the pointer/frame target, not a visible body. */
  mesh: THREE.Mesh;
  /** Nested circles at many orientations: the ring-ball shell itself. */
  ringBall: THREE.Group;
  rings: FleetHologramRing[];
  /** Inner circular interface retained as a stable extension point. */
  innerScreen: THREE.Group;
  innerScreenSpinner: THREE.Group;
  /** The real-data ticker panel at the centre of the front-facing dial. */
  hudPanel: THREE.Mesh | null;
  /** Circular focus mark; replaces the board's cube cursor for these discs. */
  selectionRing: THREE.Group;
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

/** One face dial: a large circular readout centred on a cube face. */
function makeFaceDial(
  radius: number,
  color: THREE.Color,
  offline: boolean,
  detailed = true,
): THREE.Group {
  const dial = new THREE.Group();
  dial.name = "fleet-hologram-face-dial";
  const ring = (r: number, opacity: number, name: string): void => {
    const line = unpickable(new THREE.LineLoop(
      xyCircleGeometry(r, 160),
      new THREE.LineBasicMaterial({
        color,
        transparent: true,
        opacity: offline ? opacity * 0.24 : opacity,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    ));
    line.name = name;
    dial.add(line);
  };
  ring(radius, detailed ? 0.72 : 0.28, "fleet-hologram-face-dial-outer");
  if (detailed) {
    ring(radius * 0.64, 0.3, "fleet-hologram-face-dial-middle");
    ring(radius * 0.38, 0.22, "fleet-hologram-face-dial-inner");
  }

  if (detailed) {
    const ticks: number[] = [];
    const tickCount = 36;
    for (let i = 0; i < tickCount; i += 1) {
      const angle = (i / tickCount) * Math.PI * 2;
      const major = i % 4 === 0;
      const a = radius - radius * (major ? 0.13 : 0.06);
      const b = radius + radius * (major ? 0.05 : 0.025);
      ticks.push(Math.cos(angle) * a, Math.sin(angle) * a, 0);
      ticks.push(Math.cos(angle) * b, Math.sin(angle) * b, 0);
    }
    const tickMarks = unpickable(new THREE.LineSegments(
      new THREE.BufferGeometry().setAttribute(
        "position",
        new THREE.Float32BufferAttribute(ticks, 3),
      ),
      new THREE.LineBasicMaterial({
        color,
        transparent: true,
        opacity: offline ? 0.12 : 0.58,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    ));
    tickMarks.name = "fleet-hologram-face-dial-ticks";
    dial.add(tickMarks);
  }

  const arc = unpickable(new THREE.Line(
    xyArcGeometry(radius, -0.25, Math.PI * 0.62),
    new THREE.LineBasicMaterial({
      color,
      transparent: true,
      opacity: offline ? 0.16 : detailed ? 0.94 : 0.34,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    }),
  ));
  arc.name = "fleet-hologram-face-dial-arc";
  dial.add(arc);

  if (detailed) {
    const core = unpickable(new THREE.Mesh(
      new THREE.CircleGeometry(radius * 0.16, 32),
      new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity: offline ? 0.1 : 0.3,
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

/** Six large dials on the cube's six faces. Each principal viewing
 *  direction is answered by a disc that faces it directly. */
function makeDiscCube(
  bodyRadius: number,
  color: THREE.Color,
  offline: boolean,
): THREE.Group {
  const cube = new THREE.Group();
  cube.name = "fleet-hologram-disc-shell";
  // Overlap the six faces so their rims merge into one rounded envelope
  // instead of reading as the edges of a box.
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
    const dial = makeFaceDial(dialRadius, color, offline, false);
    dial.position.set(...face.position);
    dial.rotation.set(...face.rotation);
    cube.add(dial);
  }
  return cube;
}

/** A barrel of concentric rings on the Z axis: fat at the equator and
 *  tapering to thin rings at the poles. Side-on it rounds the six-face
 *  cube into a ball; down the Z axis it reads as nested circles. */
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
    const z = bodyRadius * t;
    const loop = unpickable(new THREE.LineLoop(
      xyCircleGeometry(radius, 160),
      new THREE.LineBasicMaterial({
        color,
        transparent: true,
        opacity: offline ? 0.04 : 0.08 + (1 - Math.abs(t)) * 0.12,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    ));
    loop.name = "fleet-hologram-ring-spindle-circle";
    loop.position.z = z;
    spindle.add(loop);
  }
  return spindle;
}

/** One flat polygon face recovered from the polyhedron's triangles.
 *  Exported for the geometry contract test; not part of the public barrel. */
export interface HologramFace {
  center: THREE.Vector3;
  normal: THREE.Vector3;
  vertices: THREE.Vector3[];
}

/** Recover the polyhedron's true faces (a dodecahedron face is three
 *  coplanar triangles; a pentagon must become ONE ring, not three). Group by
 *  normal direction with a dot threshold: Three.js' projected pentagon
 *  fragments are nearly coplanar, while adjacent dodecahedron faces differ
 *  by tens of degrees. */
export function extractHologramFaces(geometry: THREE.BufferGeometry): HologramFace[] {
  const position = geometry.getAttribute("position");
  const groups: Array<{ normal: THREE.Vector3; vertices: Map<string, THREE.Vector3> }> = [];
  for (let i = 0; i < position.count; i += 3) {
    const a = new THREE.Vector3(position.getX(i), position.getY(i), position.getZ(i));
    const b = new THREE.Vector3(position.getX(i + 1), position.getY(i + 1), position.getZ(i + 1));
    const c = new THREE.Vector3(position.getX(i + 2), position.getY(i + 2), position.getZ(i + 2));
    const normal = b.clone().sub(a).cross(c.clone().sub(a)).normalize();
    const triangleCenter = a.clone().add(b).add(c).multiplyScalar(1 / 3);
    if (normal.dot(triangleCenter) < 0) normal.negate();
    let group = groups.find((candidate) => candidate.normal.dot(normal) > 0.999);
    if (!group) {
      group = { normal, vertices: new Map() };
      groups.push(group);
    }
    for (const vertex of [a, b, c]) {
      const vertexKey = [vertex.x, vertex.y, vertex.z]
        .map((value) => value.toFixed(5))
        .join(":");
      group.vertices.set(vertexKey, vertex);
    }
  }

  return groups.map((group) => {
    const vertices = [...group.vertices.values()];
    const center = vertices
      .reduce((sum, vertex) => sum.add(vertex), new THREE.Vector3())
      .multiplyScalar(1 / vertices.length);
    return {
      center,
      normal: group.normal.clone().dot(center) < 0
        ? group.normal.clone().negate()
        : group.normal.clone(),
      vertices,
    };
  });
}

/** Inradius of the face polygon — the largest inset circle that still
 *  leaves a visible gap between neighbouring face rings. Exported for the
 *  geometry contract test; not part of the public barrel. */
export function faceInradius(face: HologramFace): number {
  const u = face.vertices[0]!.clone().sub(face.center).normalize();
  const v = face.normal.clone().cross(u).normalize();
  const ordered = [...face.vertices].sort((a, b) => {
    const angle = (point: THREE.Vector3): number => Math.atan2(
      point.clone().sub(face.center).dot(v),
      point.clone().sub(face.center).dot(u),
    );
    return angle(a) - angle(b);
  });
  let inradius = Number.POSITIVE_INFINITY;
  for (let i = 0; i < ordered.length; i += 1) {
    const a = ordered[i]!;
    const b = ordered[(i + 1) % ordered.length]!;
    const edge = b.clone().sub(a);
    const area2 = edge.clone().cross(face.center.clone().sub(a)).length();
    if (edge.lengthSq() > 1e-10) inradius = Math.min(inradius, area2 / edge.length());
  }
  return Number.isFinite(inradius) ? inradius : 0;
}

/** Each face gets its own detached ring. No shared edges, no connected
 *  wireframe cage — adjacent rings visibly stop short of every face border. */
function makeFaceRings(
  geometry: THREE.BufferGeometry,
  bodyRadius: number,
  color: THREE.Color,
  offline: boolean,
): THREE.LineLoop[] {
  const lift = bodyRadius * 0.01;
  const segments = 32;
  const rings: THREE.LineLoop[] = [];
  for (const face of extractHologramFaces(geometry)) {
    const radius = Math.max(0.012, faceInradius(face) * 0.62);
    const u = face.vertices[0]!.clone().sub(face.center).normalize();
    const v = face.normal.clone().cross(u).normalize();
    const points: number[] = [];
    for (let i = 0; i < segments; i += 1) {
      const angle = (i / segments) * Math.PI * 2;
      const point = face.center
        .clone()
        .addScaledVector(face.normal, lift)
        .addScaledVector(u, Math.cos(angle) * radius)
        .addScaledVector(v, Math.sin(angle) * radius);
      points.push(point.x, point.y, point.z);
    }
    const ring = unpickable(new THREE.LineLoop(
      new THREE.BufferGeometry().setAttribute(
        "position",
        new THREE.Float32BufferAttribute(points, 3),
      ),
      new THREE.LineBasicMaterial({
        color,
        transparent: true,
        opacity: offline ? 0.16 : 0.62,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    ));
    ring.name = "fleet-hologram-face-ring";
    rings.push(ring);
  }
  return rings;
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
  canvas.height = 96;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  const line = hologramHudText(input);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.font = "600 34px ui-monospace, SFMono-Regular, Consolas, monospace";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "#ffffff";

  // A clipped horizontal ticker for the centre of the dial. Long host
  // labels are condensed by canvas rather than replaced with fabricated data.
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

function makeTickerPlane(
  bodyRadius: number,
  color: THREE.Color,
  offline: boolean,
  texture: THREE.CanvasTexture,
): THREE.Mesh {
  const material = new THREE.MeshBasicMaterial({
    map: texture,
    color,
    transparent: true,
    opacity: offline ? 0.18 : 0.86,
    side: THREE.DoubleSide,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const mesh = unpickable(new THREE.Mesh(
    new THREE.PlaneGeometry(bodyRadius * 1.14, bodyRadius * 0.3),
    material,
  ));
  mesh.name = "fleet-hologram-hud-panel";
  return mesh;
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

  // The visible object is the ring ball; this invisible sphere is only the
  // pointer target and the frameObject the board measures for selection.
  const mesh = new THREE.Mesh(
    new THREE.SphereGeometry(input.radius * 0.55, 16, 12),
    new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0,
      depthWrite: false,
    }),
  );
  mesh.name = "fleet-hologram-core";

  const hudTexture = makeHudTexture(input);
  const shell = new THREE.Group();
  shell.name = "fleet-hologram-shell";
  shell.add(makeDiscCube(input.radius, edgeColor, offline));
  shell.add(makeRingSpindle(
    input.radius,
    edgeColor,
    offline,
    input.role === "star" ? 9 : 6,
  ));
  group.add(shell);
  group.add(mesh);

  // The six-face dial cube plus ring spindle replace the former orbit rings;
  // only the scene's wide orbital paths remain as spatial context.
  const rings: FleetHologramRing[] = [];
  const innerScreen = new THREE.Group();
  innerScreen.name = "fleet-hologram-inner-screen";
  const spinner = new THREE.Group();
  spinner.name = "fleet-hologram-inner-screen-spinner";
  // One detailed camera-facing disc carries the hierarchy: full rings,
  // ticks and centre ticker. The other five faces stay as faint support.
  innerScreen.add(makeFaceDial(input.radius * 0.8, edgeColor, offline, true));

  const hudPanel = hudTexture
    ? makeTickerPlane(input.radius, edgeColor, offline, hudTexture)
    : null;
  if (hudPanel) {
    hudPanel.position.z = input.radius * 0.02;
    innerScreen.add(hudPanel);
  }
  group.add(innerScreen);

  const selectionRing = new THREE.Group();
  selectionRing.name = "fleet-hologram-selection-ring";
  selectionRing.visible = false;
  for (const [scale, opacity] of [[1.02, 0.8], [1.08, 0.24]] as const) {
    const line = unpickable(new THREE.LineLoop(
      xyCircleGeometry(input.radius * scale, 160),
      new THREE.LineBasicMaterial({
        color: edgeColor,
        transparent: true,
        opacity: offline ? opacity * 0.2 : opacity,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    ));
    line.name = "fleet-hologram-selection-ring-line";
    selectionRing.add(line);
  }
  group.add(selectionRing);

  group.userData.fleetOwnedTextures = hudTexture ? [hudTexture] : [];

  return {
    group,
    mesh,
    ringBall: shell,
    rings,
    innerScreen,
    innerScreenSpinner: spinner,
    hudPanel,
    selectionRing,
    hudTexture,
  };
}

/** Independent motion: the polyhedron spins, ring arcs precess, and the
 * real-data banner scrolls around the outer surface by UV offset. */
export function poseFleetHologram(
  hologram: FleetHologram,
  elapsed: number,
  spinPeriodSec: number,
  cameraQuaternion?: THREE.Quaternion,
): void {
  hologram.mesh.rotation.y = (elapsed / spinPeriodSec) * Math.PI * 2;
  hologram.ringBall.rotation.y = elapsed * 0.05;
  hologram.ringBall.rotation.x = Math.sin(elapsed * 0.08) * 0.06;
  if (cameraQuaternion) {
    hologram.innerScreen.quaternion.copy(cameraQuaternion);
    hologram.selectionRing.quaternion.copy(cameraQuaternion);
  }
  hologram.innerScreenSpinner.rotation.z = elapsed * 0.11;
  for (const ring of hologram.rings) {
    ring.pivot.rotation.y = ring.baseY + elapsed * ring.speed;
  }
  if (hologram.hudTexture) {
    hologram.hudTexture.offset.x = (elapsed * 0.018) % 1;
  }
}
