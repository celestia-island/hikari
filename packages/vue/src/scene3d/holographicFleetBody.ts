/**
 * holographicFleetBody — one node's hologram: a spherical shell built from
 * six overlapping face dials plus a fat-centre ring spindle, with ONE
 * detailed camera-facing dial at the front carrying the real-data HUD line.
 *
 * User direction (2026-10-31): the body must read as a ball of circles
 * from every side — no polyhedron, no solid sphere, no shared wireframe,
 * and no visible cube edges. Main cores (role "star") are larger with
 * denser dial content; node cores (role "planet") are sparser; satellites
 * get a miniature crossed-dial shell with no text. Every decorative line
 * stays out of raycast picking; the invisible centre proxy remains the
 * node's pointer target.
 *
 * User direction (2026-11-05): the HUD line inside the ball is set in the
 * host's sans UI stack at natural glyph advances — never condensed by
 * canvas — and carries descriptive data only (no liveness wording such as
 * "Online"; that stays on the chip and the selection card). The band is
 * measured from the line and sits still, so nothing is sliced at a wrap
 * seam either.
 */

import * as THREE from "three";

import { HIKARI_FONT_SANS } from "../theme/fontContext";
import type { FleetBodySpec } from "./holographicFleetSpec";

export type FleetHologramInput = Pick<
  FleetBodySpec,
  "id" | "label" | "detail" | "role" | "radius"
>;

export interface FleetHologram {
  group: THREE.Group;
  /** Invisible centre proxy; the node's pointer target (never rendered). */
  mesh: THREE.Mesh;
  /** Six faint overlapping face dials: the spherical shell. */
  shell: THREE.Group;
  /** The detailed camera-facing dial that carries the real-data HUD line. */
  frontDial: THREE.Group;
  /** Sweeping layer inside the front dial (ticks and arcs rotate here). */
  frontSpinner: THREE.Group;
  /** Circular focus mark, shown while the body is selected. */
  selectionRing: THREE.Group;
  /** The real-data HUD plane at the front dial's centre. */
  hudPanel: THREE.Mesh | null;
  /** Null only when the host cannot create a 2D canvas (SSR/test DOM). */
  hudTexture: THREE.CanvasTexture | null;
}

/** The single source of truth for the dial HUD line's content.
 *  Liveness (`status`) is deliberately absent (user direction 2026-11-05):
 *  the ball carries the node's descriptive data, while liveness already
 *  has a home on the chip and the selection card. */
export function hologramHudText(input: FleetHologramInput): string {
  return [input.label, input.detail]
    .map((part) => part.trim())
    .filter((part) => part.length > 0)
    .join("  ·  ") || input.id;
}

/** HUD tile geometry. The width is measured from the live line: a long
 *  label widens the strip instead of condensing the glyphs. */
const HUD_TILE_HEIGHT = 96;
/** The plane's scale reference: a 1024px tile maps to a 1.14×radius band,
 *  so the glyph height on the ball stays constant as the tile grows. */
const HUD_REFERENCE_WIDTH = 1024;
const HUD_MIN_TILE_WIDTH = 640;
const HUD_MAX_TILE_WIDTH = 1600;
const HUD_FONT_MAX_PX = 64;
const HUD_FONT_MIN_PX = 40;
const HUD_FONT_STEP_PX = 2;
const HUD_ITEM_GAP_PX = 96;

/** The host applies the canonical UI stack as `--font-sans` during
 *  bootstrap; reading it keeps canvas text in the same family as the DOM
 *  around it (and honours a host font override). The exported stack is
 *  only the fallback for SSR / test DOMs without computed styles. */
function hudFontFamily(): string {
  if (typeof document !== "undefined") {
    try {
      const declared = getComputedStyle(document.documentElement)
        .getPropertyValue("--font-sans")
        .trim();
      if (declared && !/[;{}]/.test(declared) && !/var\(/i.test(declared)) return declared;
    } catch {
      // No computed-style implementation: fall through to the canonical stack.
    }
  }
  return HIKARI_FONT_SANS;
}

function hudFont(fontPx: number, family: string): string {
  return `600 ${fontPx}px ${family}`;
}

/** Cut the line at a code-point boundary when even the smallest HUD size
 *  cannot hold it, so an emoji or astral character is never split into a
 *  lone surrogate. Never pass the result to a `maxWidth` argument: this
 *  function shortens the text, it does not scale glyphs horizontally. */
function ellipsizeHudText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
): string {
  if (ctx.measureText(text).width <= maxWidth) return text;
  const characters = Array.from(text);
  let low = 0;
  let high = characters.length;
  while (low < high) {
    const mid = Math.ceil((low + high) / 2);
    const candidate = `${characters.slice(0, mid).join("")}…`;
    if (ctx.measureText(candidate).width <= maxWidth) low = mid;
    else high = mid - 1;
  }
  return `${characters.slice(0, low).join("").trimEnd()}…`;
}

interface HudTextLayout {
  fontPx: number;
  text: string;
  width: number;
}

/** Choose the largest uniform font size that fits the tile, then fall back
 *  to a code-point-boundary ellipsis. Uniform scaling preserves every
 *  glyph's aspect; only the horizontal `maxWidth` squeeze is banned. */
function layoutHudText(
  ctx: CanvasRenderingContext2D,
  line: string,
  family: string,
): HudTextLayout {
  const maxTextWidth = HUD_MAX_TILE_WIDTH - HUD_ITEM_GAP_PX;
  for (let px = HUD_FONT_MAX_PX; px >= HUD_FONT_MIN_PX; px -= HUD_FONT_STEP_PX) {
    ctx.font = hudFont(px, family);
    const width = ctx.measureText(line).width;
    if (width <= maxTextWidth) return { fontPx: px, text: line, width };
  }
  ctx.font = hudFont(HUD_FONT_MIN_PX, family);
  const text = ellipsizeHudText(ctx, line, maxTextWidth);
  return {
    fontPx: HUD_FONT_MIN_PX,
    text,
    width: ctx.measureText(text).width,
  };
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
 *  MORE content than node cores — rings, ticks, arcs — never identical;
 *  2026-10-31 follow-up: they are also BRIGHTER, not just denser). */
interface DialTier {
  rings: ReadonlyArray<{ scale: number; opacity: number }>;
  tickCount: number;
  tickOpacity: number;
  arcs: ReadonlyArray<{ scale: number; start: number; span: number; opacity: number }>;
  core: boolean;
  coreOpacity: number;
}

const FOCUS_STAR: DialTier = {
  rings: [
    { scale: 1, opacity: 0.95 },
    { scale: 0.64, opacity: 0.45 },
    { scale: 0.38, opacity: 0.32 },
  ],
  tickCount: 48,
  tickOpacity: 0.78,
  arcs: [
    { scale: 1, start: -0.25, span: Math.PI * 0.62, opacity: 1 },
    { scale: 0.64, start: Math.PI * 0.85, span: Math.PI * 0.2, opacity: 0.82 },
  ],
  core: true,
  coreOpacity: 0.42,
};

const FOCUS_PLANET: DialTier = {
  rings: [
    { scale: 1, opacity: 0.66 },
    { scale: 0.52, opacity: 0.26 },
  ],
  tickCount: 28,
  tickOpacity: 0.58,
  arcs: [
    { scale: 1, start: -0.25, span: Math.PI * 0.5, opacity: 0.9 },
  ],
  core: true,
  coreOpacity: 0.26,
};

/** The five non-facing shell faces: an outline and a faint arc only, so
 *  the sphere stays legible without competing with the front dial. */
const SUPPORT: DialTier = {
  rings: [{ scale: 1, opacity: 0.28 }],
  tickCount: 0,
  tickOpacity: 0,
  arcs: [{ scale: 1, start: -0.25, span: Math.PI * 0.62, opacity: 0.34 }],
  core: false,
  coreOpacity: 0,
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
      lineMaterial(color, offline ? tier.tickOpacity * 0.2 : tier.tickOpacity),
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
        opacity: offline ? tier.coreOpacity * 0.3 : tier.coreOpacity,
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
 *  ball and keeps every side view a set of nested circles). `brightness`
 *  scales the ring opacities so a main core's ball burns brighter than a
 *  node's without adding clutter (2026-10-31 follow-up). */
function makeRingSpindle(
  bodyRadius: number,
  color: THREE.Color,
  offline: boolean,
  count: number,
  brightness = 1,
): THREE.Group {
  const spindle = new THREE.Group();
  spindle.name = "fleet-hologram-ring-spindle";
  for (let i = 0; i < count; i += 1) {
    const t = count === 1 ? 0 : -0.97 + (1.94 * i) / (count - 1);
    const radius = bodyRadius * Math.sqrt(Math.max(0, 1 - t * t)) * 0.98;
    const lit = Math.min(1, (0.08 + (1 - Math.abs(t)) * 0.12) * brightness);
    const loop = unpickable(new THREE.LineLoop(
      xyCircleGeometry(radius, 160),
      lineMaterial(color, offline ? lit * 0.2 : lit),
    ));
    loop.name = "fleet-hologram-ring-spindle-circle";
    loop.position.z = bodyRadius * t;
    spindle.add(loop);
  }
  return spindle;
}

function makeHudTexture(input: FleetHologramInput): THREE.CanvasTexture | null {
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  const family = hudFontFamily();
  const line = hologramHudText(input);
  const layout = layoutHudText(ctx, line, family);
  const tileWidth = Math.min(
    HUD_MAX_TILE_WIDTH,
    Math.max(HUD_MIN_TILE_WIDTH, Math.ceil(layout.width + HUD_ITEM_GAP_PX)),
  );

  // Setting the canvas dimensions resets every 2D context state, so the
  // font and paint state go on AFTER the final size is known.
  canvas.width = tileWidth;
  canvas.height = HUD_TILE_HEIGHT;
  ctx.font = hudFont(layout.fontPx, family);
  ctx.textBaseline = "middle";
  ctx.textAlign = "left";
  ctx.fillStyle = "#ffffff";

  // One natural-width line, centred in a tile that is exactly the band's
  // width. The band sits still (no offset scroll), so the line is never
  // sliced at a texture seam. There is deliberately NO `maxWidth`
  // argument — that is the canvas feature which condensed long labels
  // and made glyph advances unequal (user direction 2026-11-05).
  ctx.fillText(
    layout.text,
    Math.max(0, (tileWidth - layout.width) / 2),
    HUD_TILE_HEIGHT / 2,
  );

  const texture = new THREE.CanvasTexture(canvas);
  texture.name = "fleet-hologram-hud-texture";
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

/** The real-data HUD plane, pinned to the front dial's centre. The
 *  plane's aspect is locked to the texture tile's own aspect — the tile
 *  width is measured from the live label, so the band grows with long
 *  names and glyphs are never compressed horizontally. */
function makeHudPlane(
  bodyRadius: number,
  color: THREE.Color,
  offline: boolean,
  texture: THREE.CanvasTexture,
): THREE.Mesh {
  const image = texture.image as HTMLCanvasElement | undefined;
  const tileWidth = image?.width ?? HUD_REFERENCE_WIDTH;
  const tileHeight = image?.height ?? HUD_TILE_HEIGHT;
  const width = bodyRadius * 1.14 * (tileWidth / HUD_REFERENCE_WIDTH);
  const height = width * (tileHeight / tileWidth);
  const mesh = unpickable(new THREE.Mesh(
    new THREE.PlaneGeometry(width, height),
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
  // proxy is only the pointer target the board measures for picking. It
  // reaches 82% of the body radius — the old polyhedron's pick reach —
  // so most of the visible silhouette still answers a click.
  const mesh = new THREE.Mesh(
    new THREE.IcosahedronGeometry(input.radius * 0.82, 1),
    new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0,
      depthWrite: false,
    }),
  );
  mesh.name = "fleet-hologram-core";

  const shell = makeDiscShell(input.radius, color, offline);
  // A main core's ball BURNS brighter as well as denser (2026-10-31
  // follow-up): 1.5× spindle brightness on top of the richer dial tier.
  shell.add(makeRingSpindle(
    input.radius,
    color,
    offline,
    input.role === "star" ? 9 : 6,
    input.role === "star" ? 1.5 : 1,
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
    hudPanel = makeHudPlane(input.radius, color, offline, hudTexture);
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
 *  selection ring face the camera, and the dial's ticks sweep. The HUD
 *  line itself sits still at the disc's centre: its band is measured from
 *  the label, so a scroll would only slice it at the texture seam. */
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
}
