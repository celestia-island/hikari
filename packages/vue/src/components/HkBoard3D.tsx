/**
 * HkBoard3D — the shared 3D scene surface.
 *
 * The 3D counterpart of HkBoard: ONE world-camera canvas that every
 * scene-like page builds on (fleet star systems, holographic device
 * twins, demo facility corridors). The board owns the renderer, the
 * camera, the frame loop, picking, CSS2D labels, theme sync and the
 * stereoscopic minimap; the page owns the content:
 *
 *  - CAMERA: perspective + OrbitControls (damped orbit / wheel zoom /
 *    right-or-two-finger pan), distance clamps, `frameAll` fit and
 *    animated `flyTo`;
 *  - CONTENT: `engine.setObject(id, def)` registers an Object3D as
 *    addressable content — it joins framing, minimap markers and (when
 *    `pickable`) raycast picking; `label` attaches a CSS2D chip that
 *    follows the object through orbits;
 *  - PICKING: click (press-release inside a 4 px slop) and hover both
 *    raycast the pickable set and surface the REGISTERED id (children
 *    walk up to the registered root via userData);
 *  - LABELS: a CSS2DRenderer overlay — HTML chips that track world
 *    anchors, pointer-events opt-in per chip so drags still orbit;
 *  - MINIMAP: HkMinimap3D pinned bottom-right — a second, stereoscopic
 *    renderer onto the SAME scene with the main camera glyph, its view
 *    plane and content markers layered in;
 *  - THEME: scene background follows --color-background, re-read on
 *    data-mode / data-theme / style mutations; `engine.onTheme` lets the
 *    page re-tone its materials on the same signal;
 *  - FALLBACK: no WebGL → the `fallback` slot (or a localized note) and
 *    an `error` event; nothing throws out of mount.
 *
 * The engine handle arrives through the `ready` event (and is mirrored
 * on the exposed ref) — EXACTLY once per mount, and only on success:
 * when WebGL is unavailable the board renders the `fallback` slot and
 * emits `error` instead, so a consumer registers its content from the
 * ready handler and treats `error` as the inert path.
 *
 * OWNERSHIP: `setObject` hands the Object3D to the board, which adds it
 * to the engine scene — an object that already had a parent is detached
 * from it (three's `Object3D.add` semantics) and that parent is NOT
 * restored when the id is cleared. The board also assumes one id per
 * Object3D: registering the same object under a second id is allowed,
 * but picking always resolves the LAST id, so alias registrations are
 * best avoided. The board never disposes consumer objects — whoever
 * created them disposes them.
 *
 * Everything the engine hands out stays live —
 * scene, camera, controls — so pages with deeper needs (the holographic
 * twin's lighting/world/assets stack) build directly on them.
 */

import {
  defineComponent,
  onBeforeUnmount,
  onMounted,
  ref,
  shallowRef,
  watch,
  type PropType,
} from "vue";

import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { CSS2DObject, CSS2DRenderer } from "three/examples/jsm/renderers/CSS2DRenderer.js";

import { useI18n } from "../i18n/context";
import { ModelLayer, type Board3DModelOptions } from "../scene3d/modelLayer";
import { createGround, type Board3DGroundConfig, type GroundHandle } from "../scene3d/ground";
import {
  LightingRig,
  type Board3DLightingDescriptor,
  type LightingRigOptions,
} from "../scene3d/lighting";
import { BOARD3D_HELPERS_LAYER, fitDistance } from "../utils/scene3d";
import HkMinimap3D from "./HkMinimap3D";
import "./HkBoard3D.scss";

export { BOARD3D_HELPERS_LAYER };

export interface Board3DObjectDef {
  /** The scene-graph root for this content item. The board adds/removes
   *  it from the scene; the page keeps animating it in place. */
  object: THREE.Object3D;
  /** Join the raycast picking set (default true). */
  pickable?: boolean;
  /** Count toward frameAll / minimap auto-fit bounds (default true). */
  content?: boolean;
  /** HTML chip rendered through the CSS2D overlay, attached as a child of
   *  `object` so it follows every animation for free. */
  label?: HTMLElement;
  /** Local offset of the label anchor (default [0, 0, 0]). */
  labelOffset?: [number, number, number];
  /** Minimap marker shape (default "dot"); "none" hides it there. */
  marker?: "dot" | "cube" | "none";
  /** Minimap marker colour (any CSS colour; default theme primary). */
  markerColor?: string;
}

export interface Board3DEngine {
  readonly scene: THREE.Scene;
  readonly camera: THREE.PerspectiveCamera;
  readonly controls: OrbitControls;
  readonly renderer: THREE.WebGLRenderer;
  /** Pre-render hook (page animations); returns the disposer. */
  addTick(fn: (dt: number, elapsed: number) => void): () => void;
  /** Post-render hook (the minimap lives here); returns the disposer. */
  addPostRender(fn: () => void): () => void;
  setObject(id: string, def: Board3DObjectDef | null): void;
  /** Snapshot of the registered content (the minimap's marker set).
   *  Mutating it does not touch the board — register through
   *  `setObject` instead. */
  objects(): ReadonlyMap<string, Board3DObjectDef>;
  /** Animated camera flight; a user grab cancels it. */
  flyTo(
    position: [number, number, number],
    target: [number, number, number],
    durationMs?: number,
  ): void;
  /** Fit the camera onto every visible content object; a no-op
   *  while nothing frameable is registered. */
  frameAll(padding?: number, durationMs?: number): void;
  /** World → canvas CSS pixels; `visible` = inside the frustum. */
  projectToScreen(p: [number, number, number]): { x: number; y: number; visible: boolean };
  /** Re-tone hook fired on theme mutations (and once immediately);
   *  the returned disposer detaches it. */
  onTheme(cb: (bg: string, primary: string) => void): () => void;

  // ── Models (GLB) ─────────────────────────────────────────────────────
  /** Load (or replace) a GLB under `id`; resolves to its root, or null
   *  when the parse failed or a newer load superseded it. Registration
   *  with the board (framing, picking, minimap) is the caller's job via
   *  `setObject(id, { object })`. */
  loadModel(id: string, opts: Board3DModelOptions): Promise<THREE.Group | null>;
  /** Opacity 0..1 for a loaded model. */
  setModelOpacity(id: string, opacity: number): void;
  /** Emissive highlight; `clearHighlights()` restores every model. */
  highlightModel(id: string, color?: number): void;
  clearHighlights(): void;
  /** Loaded model root (null when absent). */
  modelObject(id: string): THREE.Object3D | null;
  /** World-space position of a loaded model. */
  modelWorldPosition(id: string): [number, number, number] | null;
  /** Remove and dispose a loaded model. */
  removeModel(id: string): void;

  // ── Camera policy ────────────────────────────────────────────────────
  /** Apply a camera configuration (fov/near/far/pose); non-finite
   *  values are ignored and a degenerate fov falls back to the default. */
  applyCameraConfig(cfg: Board3DCameraConfig): void;
  /** Fly the camera so a sphere of `radius` at `target` fills the view
   *  from the framing angle; `opts` carries the policy knobs (padding,
   *  lateral bias along the view's right axis). */
  flyToFocus(
    target: [number, number, number],
    radius: number,
    durationMs?: number,
    opts?: Board3DFocusOptions,
  ): void;
  /** Preset flights: `topdown` parks the camera above the current
   *  target; `orbit` returns to the pose saved when topdown began.
   *  Pass durationMs 0 to snap. */
  setViewMode(mode: Board3DViewMode, durationMs?: number): void;
  /** The last preset (a free orbit does not clear `orbit`). */
  viewMode(): Board3DViewMode;

  // ── World ────────────────────────────────────────────────────────────
  /** Build (or rebuild) the ground: a shadow catcher plus the shader
   *  grid. `frameAll` refits it to the framed content. */
  setGround(cfg: Board3DGroundConfig): void;
  setGroundVisible(v: boolean): void;
  /** Retarget the grid's fade/dot bounds onto a box (min/max corners). */
  fitGround(box: { min: [number, number, number]; max: [number, number, number] }): void;

  // ── Lighting ─────────────────────────────────────────────────────────
  /** Apply a lighting descriptor (ambient / directional / points). The
   *  rig is created on first use with the `lighting` prop's options. */
  applyLighting(desc: Board3DLightingDescriptor): void;
  /** Direct ambient control (overrides the descriptor's intensity). */
  setAmbientIntensity(v: number): void;
  /** Policy-driven sun (e.g. a wall-clock arc). */
  setSunState(
    pos: [number, number, number],
    color: [number, number, number],
    intensity: number,
  ): void;
  setNightFill(night: boolean): void;
  /** Resize the shadow frustum onto the scene extent. */
  setShadowBounds(extent: number, targetX?: number, targetZ?: number): void;

  // ── Environment ──────────────────────────────────────────────────────
  /** `studio` sets a procedural PBR environment (PMREM RoomEnvironment)
   *  so standard materials catch reflections; `none` clears it. */
  applyEnvironment(preset: "studio" | "none"): void;
}

export interface Board3DCameraConfig {
  fov?: number;
  near?: number;
  far?: number;
  position?: [number, number, number];
  target?: [number, number, number];
}

export interface Board3DFocusOptions {
  /** Distance multiplier (default 1.6 — generous, avoids claustrophobia). */
  padding?: number;
  /** Camera shift along the view's right axis, world units. */
  lateralBias?: number;
}

export type Board3DViewMode = "orbit" | "topdown";

const CLICK_SLOP_PX = 4;

/** Procedural PBR environment so standard materials catch reflections. */
function studioEnvironment(renderer: THREE.WebGLRenderer): THREE.Texture {
  const pmrem = new THREE.PMREMGenerator(renderer);
  const room = new RoomEnvironment();
  const tex = pmrem.fromScene(room, 0.04).texture;
  pmrem.dispose();
  room.dispose?.();
  return tex;
}

/** A pose component is usable only if all three numbers are finite. */
function isFiniteVec3(v: readonly number[] | undefined): v is readonly [number, number, number] {
  return (
    Array.isArray(v) &&
    v.length >= 3 &&
    Number.isFinite(v[0]) &&
    Number.isFinite(v[1]) &&
    Number.isFinite(v[2])
  );
}

function readCssColor(varName: string, fallback: string): string {
  const raw = getComputedStyle(document.documentElement).getPropertyValue(varName).trim();
  return raw || fallback;
}

function cssRgbToColor(raw: string): THREE.Color {
  const parts = raw.split(/[\s,]+/).map(Number).filter((n) => Number.isFinite(n));
  return new THREE.Color(
    (parts[0] ?? 10) / 255,
    (parts[1] ?? 15) / 255,
    (parts[2] ?? 25) / 255,
  );
}

export default defineComponent({
  name: "HkBoard3D",
  props: {
    /** Wire orbit / zoom / pan gestures (picking always works). */
    interactive: { type: Boolean, default: true },
    /** Pin the stereoscopic minimap bottom-right. */
    minimap: { type: Boolean, default: true },
    /** Vertical field of view in degrees. STATIC after mount (the
     *  camera is built in init; remount to change it). */
    fov: { type: Number, default: 45 },
    /** Starting eye / orbit target. STATIC after mount (a non-finite
     *  or short array falls back to the defaults). */
    initialPosition: {
      type: Array as unknown as PropType<[number, number, number]>,
      default: () => [22, 16, 26],
    },
    initialTarget: {
      type: Array as unknown as PropType<[number, number, number]>,
      default: () => [0, 0, 0],
    },
    /** Orbit distance window. STATIC after mount (applied to the
     *  controls once; a reversed window is normalised). */
    minDistance: { type: Number, default: 2 },
    maxDistance: { type: Number, default: 600 },
    /** Wire two-finger / right-drag panning. STATIC after mount. */
    enablePan: { type: Boolean, default: true },
    /** Options for the lighting rig created on first `applyLighting`
     *  (ambient floor, shadow map size). */
    lighting: {
      type: Object as PropType<LightingRigOptions>,
      default: () => ({}),
    },
    /** Keep the camera's near/far planes clipped to the framed extent
     *  (large scenes lose depth precision without it). */
    autoClipping: { type: Boolean, default: false },
    /** Freeze the frame loop (content keeps its last pose). An animated
     *  flight issued while paused lands in a single jump on resume: the
     *  tween is evaluated against wall-clock time. */
    paused: { type: Boolean, default: false },
  },
  emits: {
    ready: (_engine: Board3DEngine) => true,
    objectClick: (_id: string) => true,
    objectHover: (_id: string | null) => true,
    error: (_message: string) => true,
  },
  setup(props, { emit, expose, slots }) {
    const { t } = useI18n();
    const containerRef = ref<HTMLElement | null>(null);
    const canvasRef = ref<HTMLCanvasElement | null>(null);
    const failed = ref(false);
    const engineRef = shallowRef<Board3DEngine | null>(null);

    let renderer: THREE.WebGLRenderer | null = null;
    let labelRenderer: CSS2DRenderer | null = null;
    let scene: THREE.Scene | null = null;
    let camera: THREE.PerspectiveCamera | null = null;
    let controls: OrbitControls | null = null;
    let resizeObs: ResizeObserver | null = null;
    let themeObs: MutationObserver | null = null;
    let rafId = 0;
    let disposed = false;

    const tickHooks = new Set<(dt: number, elapsed: number) => void>();
    const postHooks = new Set<() => void>();
    const themeHooks = new Set<(bg: string, primary: string) => void>();
    const registry = new Map<string, Board3DObjectDef>();
    /** GLB mechanics (load/place/opacity/highlight) — created in init(). */
    let modelLayer: ModelLayer | null = null;
    let groundHandle: GroundHandle | null = null;
    let lightingRig: LightingRig | null = null;
    let envTexture: THREE.Texture | null = null;
    /** The pose to restore when leaving topdown. */
    let orbitPose: { pos: THREE.Vector3; target: THREE.Vector3 } | null = null;
    let mode: "orbit" | "topdown" = "orbit";
    /** The CSS2D chip attached for a registered id — tracked so a
     *  re-register or a clear detaches it instead of stacking chips. */
    const labelTags = new Map<string, CSS2DObject>();
    const clock = new THREE.Timer();

    // ── picking state ─────────────────────────────────────────────────
    const raycaster = new THREE.Raycaster();
    const ndc = new THREE.Vector2();
    let hoverDirty = false;
    let lastHover: string | null = null;
    let pressAt: { pointerId: number; x: number; y: number } | null = null;

    // ── camera tween ──────────────────────────────────────────────────
    let tween: {
      fromPos: THREE.Vector3;
      toPos: THREE.Vector3;
      fromTarget: THREE.Vector3;
      toTarget: THREE.Vector3;
      start: number;
      duration: number;
    } | null = null;

    function applyTheme(): void {
      const bgRaw = readCssColor("--color-background", "10 15 25");
      const primaryRaw = readCssColor("--color-primary", "21 101 192");
      const bg = cssRgbToColor(bgRaw);
      if (scene) scene.background = bg;
      if (renderer) renderer.setClearColor(bg, 1);
      for (const cb of themeHooks) cb(bgRaw, primaryRaw);
    }

    function refreshSize(): void {
      const el = containerRef.value;
      if (!el || !camera || !renderer) return;
      const w = Math.max(el.clientWidth, 1);
      const h = Math.max(el.clientHeight, 1);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
      labelRenderer?.setSize(w, h);
    }

    function pickAt(clientX: number, clientY: number): string | null {
      const el = canvasRef.value;
      if (!el || !camera || !scene) return null;
      // getBoundingClientRect is DRAWN pixels — correct even under a
      // scaled root (the 2D board's pxScale equivalent for raycasts).
      const rect = el.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return null;
      ndc.set(
        ((clientX - rect.left) / rect.width) * 2 - 1,
        -((clientY - rect.top) / rect.height) * 2 + 1,
      );
      raycaster.setFromCamera(ndc, camera);
      const pickables: THREE.Object3D[] = [];
      for (const [id, def] of registry) {
        if (def.pickable === false) continue;
        if (!def.object.userData.board3dId) def.object.userData.board3dId = id;
        pickables.push(def.object);
      }
      const hits = raycaster.intersectObjects(pickables, true);
      for (const hit of hits) {
        let node: THREE.Object3D | null = hit.object;
        while (node) {
          const id = node.userData?.board3dId as string | undefined;
          // `id !== undefined`, not truthiness: "" is a legal id.
          if (id !== undefined && registry.has(id)) return id;
          node = node.parent;
        }
      }
      return null;
    }

    const lastPointer = { x: 0, y: 0 };

    function onPointerMove(e: PointerEvent): void {
      hoverDirty = true;
      lastPointer.x = e.clientX;
      lastPointer.y = e.clientY;
    }

    function onPointerDown(e: PointerEvent): void {
      pressAt = { pointerId: e.pointerId, x: e.clientX, y: e.clientY };
      // Capture every press: up/cancel are only guaranteed while capture
      // holds, and without it a pointer released off-canvas would leave a
      // stale press to synthesize a phantom click (HkBoard's convention).
      canvasRef.value?.setPointerCapture?.(e.pointerId);
      tween = null; // a grab cancels any in-flight camera animation
    }

    function onPointerUp(e: PointerEvent): void {
      const p = pressAt;
      pressAt = null;
      if (!p) return;
      // Only the pressing pointer's release clicks; the slop stays the
      // Manhattan metric HkBoard uses (|dx| + |dy|).
      if (p.pointerId !== e.pointerId) return;
      if (Math.abs(e.clientX - p.x) + Math.abs(e.clientY - p.y) > CLICK_SLOP_PX) return;
      const id = pickAt(e.clientX, e.clientY);
      if (id) emit("objectClick", id);
    }

    function onPointerCancel(): void {
      // An aborted gesture must never synthesize a click: prune only.
      pressAt = null;
    }

    /** Capture-loss backstop: up/cancel are only guaranteed while pointer
     *  capture holds, so a pointer released without an up is pruned here
     *  (fires on the capture target and does not bubble → capture phase;
     *  a no-op after a normal up). */
    function onLostPointerCapture(): void {
      pressAt = null;
    }

    function easeInOutCubic(x: number): number {
      return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
    }

    function frame(): void {
      if (disposed) return;
      rafId = requestAnimationFrame(frame);
      if (props.paused || !renderer || !scene || !camera) return;
      clock.update();
      const dt = Math.min(clock.getDelta(), 0.1);
      const elapsed = clock.getElapsed();

      if (tween) {
        const t = Math.min(1, (performance.now() - tween.start) / tween.duration);
        const k = easeInOutCubic(t);
        camera.position.lerpVectors(tween.fromPos, tween.toPos, k);
        controls?.target.lerpVectors(tween.fromTarget, tween.toTarget, k);
        if (t >= 1) tween = null;
      }

      for (const fn of tickHooks) fn(dt, elapsed);
      controls?.update();

      if (hoverDirty) {
        hoverDirty = false;
        const id = pickAt(lastPointer.x, lastPointer.y);
        if (id !== lastHover) {
          lastHover = id;
          if (canvasRef.value) {
            canvasRef.value.style.cursor = id ? "pointer" : "";
          }
          emit("objectHover", id);
        }
      }

      renderer.render(scene, camera);
      labelRenderer?.render(scene, camera);
      for (const fn of postHooks) fn();
    }

    function init(): void {
      const canvas = canvasRef.value;
      const container = containerRef.value;
      if (!canvas || !container) return;

      scene = new THREE.Scene();
      // A degenerate fov (≤ 0 or ≥ 180) silently bricks the projection —
      // projectionMatrix[5] becomes Infinity/negative, projection and
      // picking return NaN, and nothing throws. Fall back to the default.
      const fov = Number.isFinite(props.fov) && props.fov > 0 && props.fov < 180 ? props.fov : 45;
      camera = new THREE.PerspectiveCamera(fov, 1, 0.1, 4000);
      // Guard the initial pose too: a non-finite component (an untyped
      // caller passing a short/garbage array) would poison every
      // projection for the board's whole lifetime.
      const initPos = isFiniteVec3(props.initialPosition) ? props.initialPosition : [22, 16, 26];
      const initTarget = isFiniteVec3(props.initialTarget) ? props.initialTarget : [0, 0, 0];
      camera.position.set(initPos[0], initPos[1], initPos[2]);
      camera.lookAt(initTarget[0], initTarget[1], initTarget[2]);

      renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.15;
      renderer.shadowMap.enabled = true;

      labelRenderer = new CSS2DRenderer();
      labelRenderer.domElement.style.position = "absolute";
      labelRenderer.domElement.style.inset = "0";
      labelRenderer.domElement.style.pointerEvents = "none";
      container.appendChild(labelRenderer.domElement);

      controls = new OrbitControls(camera, canvas);
      controls.enableDamping = true;
      controls.dampingFactor = 0.08;
      // A reversed window (min > max) is not rejected by OrbitControls —
      // it clamps the radius to `max(min, min(max, r))`, pinning the eye
      // at min forever and defeating every frameAll. Normalise instead.
      controls.minDistance = Math.min(props.minDistance, props.maxDistance);
      controls.maxDistance = Math.max(props.minDistance, props.maxDistance);
      controls.enablePan = props.enablePan;
      controls.target.set(initTarget[0], initTarget[1], initTarget[2]);
      controls.enabled = props.interactive;
      controls.update();

      applyTheme();
      themeObs = new MutationObserver(applyTheme);
      themeObs.observe(document.documentElement, {
        attributes: true,
        attributeFilter: ["data-mode", "data-theme", "style", "class"],
      });

      refreshSize();
      resizeObs = new ResizeObserver(refreshSize);
      resizeObs.observe(container);

      canvas.addEventListener("pointermove", onPointerMove);
      canvas.addEventListener("pointerdown", onPointerDown);
      canvas.addEventListener("pointerup", onPointerUp);
      canvas.addEventListener("pointercancel", onPointerCancel);
      canvas.addEventListener("lostpointercapture", onLostPointerCapture, true);

      /** Depth planes from a subject distance (large scenes need it). */
      function applyClipping(dist: number): void {
        if (!camera) return;
        camera.near = Math.max(0.1, dist / 200);
        camera.far = Math.max(dist * 200, camera.near + 1);
        camera.updateProjectionMatrix();
      }

      modelLayer = new ModelLayer(scene);

      const engine: Board3DEngine = {
        scene,
        camera,
        controls,
        renderer,
        addTick(fn) {
          tickHooks.add(fn);
          return () => tickHooks.delete(fn);
        },
        addPostRender(fn) {
          postHooks.add(fn);
          return () => postHooks.delete(fn);
        },
        setObject(id, def) {
          const prev = registry.get(id);
          if (prev) {
            // One Object3D can be registered under several ids; only
            // detach it from the scene when no other id still owns it.
            const stillOwned = [...registry.entries()].some(
              ([other, otherDef]) => other !== id && otherDef.object === prev.object,
            );
            if (!stillOwned) scene?.remove(prev.object);
            registry.delete(id);
          }
          // The label tag is owned per id: re-registering (or clearing) an
          // id must not stack a second chip on the same anchor.
          const prevTag = labelTags.get(id);
          if (prevTag) {
            prevTag.removeFromParent();
            labelTags.delete(id);
          }
          if (!def) return;
          def.object.userData.board3dId = id;
          if (def.label) {
            def.label.classList.add("hk-board3d-label");
            const tag = new CSS2DObject(def.label);
            const off = def.labelOffset ?? [0, 0, 0];
            tag.position.set(off[0], off[1], off[2]);
            def.object.add(tag);
            labelTags.set(id, tag);
          }
          registry.set(id, def);
          scene?.add(def.object);
        },
        // A snapshot: a consumer that casts it to Map and clears it must
        // not be able to desynchronise the board from its scene.
        objects: () => new Map(registry),
        flyTo(position, target, durationMs = 600) {
          if (!camera || !controls) return;
          // A non-finite pose would brick the camera silently (every later
          // projection returns NaN) — ignore the call instead.
          if (!isFiniteVec3(position) || !isFiniteVec3(target)) return;
          if (durationMs <= 0) {
            // An instant flight must ALSO cancel any in-flight tween —
            // otherwise the next frame re-applies the old animation and
            // undoes this pose (frameAll's default duration is 0).
            tween = null;
            camera.position.set(...position);
            controls.target.set(...target);
            controls.update();
            return;
          }
          tween = {
            fromPos: camera.position.clone(),
            toPos: new THREE.Vector3(...position),
            fromTarget: controls.target.clone(),
            toTarget: new THREE.Vector3(...target),
            start: performance.now(),
            duration: durationMs,
          };
        },
        frameAll(padding = 1.3, durationMs = 0) {
          if (!camera || !controls) return;
          const box = new THREE.Box3();
          let any = false;
          for (const def of registry.values()) {
            if (def.content === false) continue;
            // Skip what the MAIN camera cannot see (the minimap's helpers
            // live on their own layer): framing must never chase them.
            if (!def.object.layers.test(camera.layers)) continue;
            box.expandByObject(def.object);
            any = true;
          }
          // Nothing frameable registered yet (an async page calling
          // frameAll before its content arrives): stay put rather than
          // framing whatever happens to be in the scene.
          if (!any || box.isEmpty()) return;
          groundHandle?.fit(box);
          const sphere = box.getBoundingSphere(new THREE.Sphere());
          const dist = fitDistance(sphere.radius, camera.fov, camera.aspect) * padding;
          if (props.autoClipping) applyClipping(dist);
          // Keep the current viewing direction — a fit reframes, it
          // never whips the user around to a canonical side.
          const dir = camera.position.clone().sub(controls.target);
          if (dir.lengthSq() < 1e-8) dir.set(0.6, 0.45, 1);
          dir.normalize().multiplyScalar(dist);
          const pos = sphere.center.clone().add(dir);
          engine.flyTo(
            [pos.x, pos.y, pos.z],
            [sphere.center.x, sphere.center.y, sphere.center.z],
            durationMs,
          );
        },
        projectToScreen(p) {
          const el = containerRef.value;
          if (!el || !camera) return { x: 0, y: 0, visible: false };
          // Correct even before the first frame: the renderer normally
          // owns matrix maintenance, a direct query must not depend on it.
          camera.updateMatrixWorld();
          const v = new THREE.Vector3(p[0], p[1], p[2]).project(camera);
          return {
            x: ((v.x + 1) / 2) * el.clientWidth,
            y: ((1 - v.y) / 2) * el.clientHeight,
            visible: v.z < 1 && v.x >= -1 && v.x <= 1 && v.y >= -1 && v.y <= 1,
          };
        },
        onTheme(cb) {
          themeHooks.add(cb);
          const bgRaw = readCssColor("--color-background", "10 15 25");
          const primaryRaw = readCssColor("--color-primary", "21 101 192");
          cb(bgRaw, primaryRaw);
          return () => themeHooks.delete(cb);
        },
        loadModel: (id, opts) => modelLayer!.loadModel(id, opts),
        setModelOpacity: (id, opacity) => modelLayer?.setOpacity(id, opacity),
        highlightModel: (id, color) => modelLayer?.highlight(id, color),
        clearHighlights: () => modelLayer?.clearHighlights(),
        modelObject: (id) => modelLayer?.objectOf(id) ?? null,
        modelWorldPosition: (id) => modelLayer?.worldPosition(id) ?? null,
        removeModel: (id) => modelLayer?.removeModel(id),
        applyCameraConfig(cfg) {
          if (!camera || !controls) return;
          const fov = Number.isFinite(cfg.fov) && cfg.fov! > 0 && cfg.fov! < 180 ? cfg.fov! : camera.fov;
          camera.fov = fov;
          if (Number.isFinite(cfg.near) && cfg.near! > 0) camera.near = cfg.near!;
          if (Number.isFinite(cfg.far) && cfg.far! > camera.near) camera.far = cfg.far!;
          camera.updateProjectionMatrix();
          if (isFiniteVec3(cfg.position)) camera.position.set(...cfg.position);
          if (isFiniteVec3(cfg.target)) controls.target.set(...cfg.target);
          controls.update();
        },
        flyToFocus(target, radius, durationMs = 600, opts) {
          if (!camera || !controls) return;
          if (!isFiniteVec3(target) || !Number.isFinite(radius) || radius <= 0) return;
          // The framing angle: slightly elevated, pulled back along -Z.
          const dir = new THREE.Vector3(-0.03, 0.3, -1).normalize();
          const dist = fitDistance(radius, camera.fov, camera.aspect) * (opts?.padding ?? 1.6);
          const pos = new THREE.Vector3(...target).add(dir.multiplyScalar(dist));
          const bias = opts?.lateralBias ?? 0;
          if (bias !== 0) {
            const right = new THREE.Vector3().crossVectors(dir, new THREE.Vector3(0, 1, 0)).normalize();
            pos.add(right.multiplyScalar(bias));
          }
          engine.flyTo([pos.x, pos.y, pos.z], target, durationMs);
          if (props.autoClipping) applyClipping(dist);
        },
        setViewMode(next, durationMs = 300) {
          if (!camera || !controls || next === mode) return;
          if (next === "topdown") {
            orbitPose = { pos: camera.position.clone(), target: controls.target.clone() };
            const ct = controls.target;
            const dist = Math.max(camera.position.distanceTo(ct), 1);
            // A hair of Z keeps the up axis from degenerating.
            engine.flyTo([ct.x, ct.y + dist, ct.z + 0.001], [ct.x, ct.y, ct.z], durationMs);
          } else if (orbitPose) {
            engine.flyTo(
              [orbitPose.pos.x, orbitPose.pos.y, orbitPose.pos.z],
              [orbitPose.target.x, orbitPose.target.y, orbitPose.target.z],
              durationMs,
            );
          }
          mode = next;
        },
        viewMode: () => mode,
        setGround(cfg) {
          groundHandle?.dispose();
          groundHandle = createGround(scene!, cfg);
        },
        setGroundVisible: (v) => groundHandle?.setVisible(v),
        fitGround: (box) =>
          groundHandle?.fit(
            new THREE.Box3(
              new THREE.Vector3(...box.min),
              new THREE.Vector3(...box.max),
            ),
          ),
        applyLighting(desc) {
          lightingRig ??= new LightingRig(scene!, props.lighting);
          lightingRig.apply(desc);
        },
        setSunState(pos, color, intensity) {
          lightingRig ??= new LightingRig(scene!, props.lighting);
          lightingRig.setSun(pos, color, intensity);
        },
        setAmbientIntensity: (v) => lightingRig?.setAmbientIntensity(v),
        setNightFill: (night) => lightingRig?.setNightFill(night),
        setShadowBounds: (extent, tx = 0, tz = 0) => lightingRig?.setShadowBounds(extent, tx, tz),
        applyEnvironment(preset) {
          if (preset === "none") {
            if (scene) scene.environment = null;
            return;
          }
          envTexture ??= studioEnvironment(renderer!);
          if (scene) scene.environment = envTexture;
        },
      };

      engineRef.value = engine;
      rafId = requestAnimationFrame(frame);
      emit("ready", engine);
    }

    watch(
      () => props.interactive,
      (v) => {
        if (controls) controls.enabled = v;
      },
    );

    onMounted(() => {
      try {
        init();
      } catch (err) {
        // No WebGL (old device, headless test DOM): the page keeps its
        // HTML fallback instead of dying mid-mount.
        failed.value = true;
        emit("error", err instanceof Error ? err.message : String(err));
      }
    });

    onBeforeUnmount(() => {
      disposed = true;
      cancelAnimationFrame(rafId);
      resizeObs?.disconnect();
      themeObs?.disconnect();
      const canvas = canvasRef.value;
      if (canvas) {
        canvas.removeEventListener("pointermove", onPointerMove);
        canvas.removeEventListener("pointerdown", onPointerDown);
        canvas.removeEventListener("pointerup", onPointerUp);
        canvas.removeEventListener("pointercancel", onPointerCancel);
        canvas.removeEventListener("lostpointercapture", onLostPointerCapture, true);
      }
      controls?.dispose();
      if (labelRenderer?.domElement.parentNode) {
        labelRenderer.domElement.parentNode.removeChild(labelRenderer.domElement);
      }
      modelLayer?.dispose();
      modelLayer = null;
      groundHandle?.dispose();
      groundHandle = null;
      lightingRig?.dispose();
      lightingRig = null;
      if (envTexture) {
        envTexture.dispose();
        envTexture = null;
      }
      for (const tag of labelTags.values()) tag.removeFromParent();
      labelTags.clear();
      renderer?.dispose();
      // Free the GL context eagerly: a SPA that remounts the board can
      // otherwise brush the browser's live-context cap.
      renderer?.forceContextLoss?.();
      registry.clear();
      tickHooks.clear();
      postHooks.clear();
      themeHooks.clear();
      engineRef.value = null;
    });

    expose({
      /** Null until the `ready` event — prefer the event. */
      engine: engineRef,
    });

    return () => (
      <div class="hk-board3d" ref={containerRef}>
        <canvas ref={canvasRef} class="hk-board3d-canvas" />
        {failed.value ? (
          slots.fallback ? (
            slots.fallback()
          ) : (
            <div class="hk-board3d-fallback">
              {t("hikari::board3d.unavailable", "3D is unavailable on this device")}
            </div>
          )
        ) : null}
        {props.minimap && engineRef.value && !failed.value ? (
          <HkMinimap3D engine={engineRef.value} />
        ) : null}
        {slots.default ? <div class="hk-board3d-overlay">{slots.default()}</div> : null}
      </div>
    );
  },
});
