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
 * on the exposed ref). Everything the engine hands out stays live —
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
import { CSS2DObject, CSS2DRenderer } from "three/examples/jsm/renderers/CSS2DRenderer.js";

import { useI18n } from "../i18n/context";
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
  /** Read-only view of the registered content (the minimap's marker set). */
  objects(): ReadonlyMap<string, Board3DObjectDef>;
  /** Animated camera flight; a user grab cancels it. */
  flyTo(
    position: [number, number, number],
    target: [number, number, number],
    durationMs?: number,
  ): void;
  /** Fit the camera onto all content objects (whole scene when none). */
  frameAll(padding?: number, durationMs?: number): void;
  /** World → canvas CSS pixels; `visible` = inside the frustum. */
  projectToScreen(p: [number, number, number]): { x: number; y: number; visible: boolean };
  /** Re-tone hook fired on theme mutations (and once immediately). */
  onTheme(cb: (bg: string, primary: string) => void): void;
}

const CLICK_SLOP_PX = 4;

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
    fov: { type: Number, default: 45 },
    initialPosition: {
      type: Array as unknown as PropType<[number, number, number]>,
      default: () => [22, 16, 26],
    },
    initialTarget: {
      type: Array as unknown as PropType<[number, number, number]>,
      default: () => [0, 0, 0],
    },
    minDistance: { type: Number, default: 2 },
    maxDistance: { type: Number, default: 600 },
    enablePan: { type: Boolean, default: true },
    /** Freeze the frame loop (content keeps its last pose). */
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
    const clock = new THREE.Timer();

    // ── picking state ─────────────────────────────────────────────────
    const raycaster = new THREE.Raycaster();
    const ndc = new THREE.Vector2();
    let hoverDirty = false;
    let lastHover: string | null = null;
    let pressAt: { x: number; y: number } | null = null;

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
          if (id && registry.has(id)) return id;
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
      pressAt = { x: e.clientX, y: e.clientY };
      tween = null; // a grab cancels any in-flight camera animation
    }

    function onPointerUp(e: PointerEvent): void {
      const p = pressAt;
      pressAt = null;
      if (!p) return;
      if (Math.abs(e.clientX - p.x) + Math.abs(e.clientY - p.y) > CLICK_SLOP_PX) return;
      const id = pickAt(e.clientX, e.clientY);
      if (id) emit("objectClick", id);
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
      camera = new THREE.PerspectiveCamera(props.fov, 1, 0.1, 4000);
      camera.position.set(...props.initialPosition);
      camera.lookAt(...props.initialTarget);

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
      controls.minDistance = props.minDistance;
      controls.maxDistance = props.maxDistance;
      controls.enablePan = props.enablePan;
      controls.target.set(...props.initialTarget);
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
            scene?.remove(prev.object);
            registry.delete(id);
          }
          if (!def) return;
          def.object.userData.board3dId = id;
          if (def.label) {
            def.label.classList.add("hk-board3d-label");
            const tag = new CSS2DObject(def.label);
            const off = def.labelOffset ?? [0, 0, 0];
            tag.position.set(off[0], off[1], off[2]);
            def.object.add(tag);
          }
          registry.set(id, def);
          scene?.add(def.object);
        },
        objects: () => registry,
        flyTo(position, target, durationMs = 600) {
          if (!camera || !controls) return;
          if (durationMs <= 0) {
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
            box.expandByObject(def.object);
            any = true;
          }
          if (!any && scene) box.setFromObject(scene);
          if (box.isEmpty()) return;
          const sphere = box.getBoundingSphere(new THREE.Sphere());
          const dist = fitDistance(sphere.radius, camera.fov, camera.aspect) * padding;
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
      }
      controls?.dispose();
      if (labelRenderer?.domElement.parentNode) {
        labelRenderer.domElement.parentNode.removeChild(labelRenderer.domElement);
      }
      renderer?.dispose();
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
