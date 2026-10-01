/**
 * ground — the holographic ground plane: a shadow-catching plane plus an
 * anti-aliased shader grid (lines with distance fade, dots at 2×2
 * intersections bounded to the content).
 *
 * Ported from shittim-chest's private three pipeline so every 3D
 * surface shares one ground; the visual constants live here, the policy
 * (where the ground sits, whether it shows) stays with the consumer.
 */

import * as THREE from "three";

export interface Board3DGroundConfig {
  /** Show the ground at all. */
  enabled: boolean;
  /** World Y of the ground plane. */
  y?: number;
  /** Grid cell size in world units. */
  gridCellSize?: number;
  /** Grid line colour (CSS string or hex). */
  lineColor?: string | number;
  /** Grid intersection-dot colour. */
  dotColor?: string | number;
  /** Shadow catcher opacity 0..1 (0 disables the catcher). */
  shadowOpacity?: number;
}

// ── Visual tuning (linear-RGB; tuned for a dark background, naturally
//    quieter on a light one) ───────────────────────────────────────────
const LINE_COLOR_DEFAULT = 0x808594;
const DOT_COLOR_DEFAULT = 0xe6ebf5;
/** Max opacity multiplier for grid lines. */
const LINE_OPACITY = 0.25;
/** Max opacity multiplier for grid dots. */
const DOT_OPACITY = 0.75;
/** Blend ratio (0 = full line colour, 1 = full dot colour) at dots. */
const DOT_COLOR_MIX = 0.6;
const GRID_CELL_DEFAULT = 2.0;
const PLANE_SIZE = 2000;

const gridVertex = /* glsl */ `
varying vec2 vWorldXZ;
void main() {
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vWorldXZ = wp.xz;
  gl_Position = projectionMatrix * viewMatrix * wp;
}
`;

const gridFragment = /* glsl */ `
varying vec2 vWorldXZ;
uniform vec2 uCenter;
uniform float uCellSize;
uniform float uFadeStart;
uniform float uFadeEnd;
uniform vec3 uLineColor;
uniform vec3 uDotColor;
uniform vec2 uDotMin;
uniform vec2 uDotMax;

void main() {
  vec2 rel = vWorldXZ - uCenter;
  float dist = length(rel);

  // Rapid distance decay.
  float halfFade = uFadeStart + (uFadeEnd - uFadeStart) * 0.35;
  float fade = 1.0 - smoothstep(uFadeStart, halfFade, dist);
  if (fade < 0.002) discard;

  vec2 coord = rel / uCellSize;
  vec2 fw = fwidth(coord);

  // Anti-aliased grid: normalized distance to the nearest line.
  vec2 grid = abs(fract(coord - 0.5) - 0.5) / fw;

  // Per-axis visibility: fade when cells become sub-pixel.
  vec2 vis = 1.0 - smoothstep(0.25, 0.4, fw);

  float vline = (1.0 - min(grid.x, 1.0)) * vis.x;
  float hline = (1.0 - min(grid.y, 1.0)) * vis.y;
  float gridLine = max(vline, hline);

  // Dots at every 2x2 intersection.
  float maxFW = max(fw.x, fw.y);
  vec2 sf = abs(fract(coord * 0.5) - 0.5);
  float dotD = length(sf - vec2(0.5)) / maxFW;
  float dot = 1.0 - min(dotD, 1.0);
  dot *= vis.x * vis.y;

  // Dots only within the content bounds.
  vec2 inB = step(uDotMin, vWorldXZ) * step(vWorldXZ, uDotMax);
  dot *= inB.x * inB.y;

  float lineA = gridLine * ${LINE_OPACITY.toFixed(2)} * fade;
  float dotA  = dot * ${DOT_OPACITY.toFixed(2)} * fade;
  float alpha = max(lineA, dotA);

  vec3 c = mix(uLineColor, uDotColor, dot * ${DOT_COLOR_MIX.toFixed(2)});
  gl_FragColor = vec4(c, alpha);
}
`;

export interface GroundHandle {
  /** Show/hide both planes (the config's gridVisible flag in one call). */
  setVisible(v: boolean): void;
  /** Retarget the grid's fade + dot bounds onto content. */
  fit(box: THREE.Box3): void;
  /** The grid's render roots, for consumers that decorate them. */
  readonly object: THREE.Group;
  dispose(): void;
}

/** Build (or rebuild) the ground. Returns a disposed-when-done handle. */
export function createGround(scene: THREE.Scene, cfg: Board3DGroundConfig): GroundHandle {
  if (!cfg.enabled) {
    // Disabled: nothing touches the scene at all.
    const empty = new THREE.Group();
    return {
      setVisible: () => undefined,
      fit: () => undefined,
      object: empty,
      dispose: () => undefined,
    };
  }
  const group = new THREE.Group();
  scene.add(group);

  const y = cfg.y ?? 0;
  const shadowOpacity = cfg.shadowOpacity ?? 0.35;
  const created: Array<{ geometry: THREE.BufferGeometry; material: THREE.Material }> = [];

  // Shadow-catching plane: fully transparent except where shadows fall.
  if (shadowOpacity > 0) {
    const geo = new THREE.PlaneGeometry(PLANE_SIZE, PLANE_SIZE);
    const mat = new THREE.ShadowMaterial({ opacity: shadowOpacity });
    const shadow = new THREE.Mesh(geo, mat);
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.y = y;
    shadow.receiveShadow = true;
    group.add(shadow);
    created.push({ geometry: geo, material: mat });
  }

  // Grid plane: transparent face, only lines + dots visible.
  const uniforms: Record<string, { value: unknown }> = {
    uCenter: { value: new THREE.Vector2(0, 0) },
    uCellSize: { value: cfg.gridCellSize ?? GRID_CELL_DEFAULT },
    uFadeStart: { value: 30 },
    uFadeEnd: { value: 200 },
    uLineColor: { value: new THREE.Color(cfg.lineColor ?? LINE_COLOR_DEFAULT) },
    uDotColor: { value: new THREE.Color(cfg.dotColor ?? DOT_COLOR_DEFAULT) },
    uDotMin: { value: new THREE.Vector2(-100, -100) },
    uDotMax: { value: new THREE.Vector2(100, 100) },
  };
  const gridGeo = new THREE.PlaneGeometry(PLANE_SIZE, PLANE_SIZE);
  const gridMat = new THREE.ShaderMaterial({
    vertexShader: gridVertex,
    fragmentShader: gridFragment,
    uniforms,
    transparent: true,
    depthWrite: false,
  });
  const grid = new THREE.Mesh(gridGeo, gridMat);
  grid.rotation.x = -Math.PI / 2;
  grid.position.y = y + 0.01;
  grid.frustumCulled = false;
  group.add(grid);
  created.push({ geometry: gridGeo, material: gridMat });

  return {
    setVisible(v: boolean) {
      group.visible = v;
    },
    fit(box: THREE.Box3) {
      let cx = 0;
      let cz = 0;
      let extent = 40;
      if (!box.isEmpty()) {
        cx = (box.min.x + box.max.x) / 2;
        cz = (box.min.z + box.max.z) / 2;
        extent = Math.max(box.max.x - box.min.x, box.max.z - box.min.z);
        const pad = 2;
        (uniforms.uDotMin.value as THREE.Vector2).set(box.min.x - pad, box.min.z - pad);
        (uniforms.uDotMax.value as THREE.Vector2).set(box.max.x + pad, box.max.z + pad);
      }
      (uniforms.uCenter.value as THREE.Vector2).set(cx, cz);
      uniforms.uFadeStart.value = extent * 0.5 + 10;
      uniforms.uFadeEnd.value = extent * 2.0 + 120;
    },
    object: group,
    dispose() {
      scene.remove(group);
      for (const { geometry, material } of created) {
        geometry.dispose();
        material.dispose();
      }
    },
  };
}
