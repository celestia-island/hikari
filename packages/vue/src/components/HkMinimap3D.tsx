/**
 * HkMinimap3D — the stereoscopic minimap for HkBoard3D.
 *
 * Same chrome as the 2D HkMinimap (corner card + zoom bar), but the map
 * itself is a second, tiny 3D renderer onto the SAME scene:
 *
 *  - MAIN CAMERA is a first-class object in the map: a glyph cone at its
 *    position plus the view-plane frame (the "查看平面范围" — a quad at
 *    the orbit-target distance with edges back to the eye);
 *  - CONTENT shows up as small light dots / holographic cubes at each
 *    registered object's world position;
 *  - DRAG orbits the map eye on a SPHERE CENTRED ON THE MAIN CAMERA —
 *    the map always looks AT the camera-as-an-object, so dragging reads
 *    as walking around the operator's viewpoint (never pans the scene);
 *  - ZOOM is an auto-fit radius (content ∪ view plane) with a ± ladder
 *    on top: 100% = everything fits, higher = closer;
 *  - the helper layer never leaks into the main render (helpers sit on
 *    BOARD3D_HELPERS_LAYER, which only the minimap camera enables).
 */

import { Maximize2, ZoomIn, ZoomOut } from "lucide-vue-next";
import {
  computed,
  defineComponent,
  onBeforeUnmount,
  onMounted,
  ref,
  watch,
  type PropType,
} from "vue";

import * as THREE from "three";

import HSlider from "./HkSlider";
import { useI18n } from "../i18n/context";
import {
  BOARD3D_HELPERS_LAYER,
  clampMinimapZoom,
  fitDistance,
  MINIMAP_MAX_ZOOM_PERCENT,
  MINIMAP_MIN_ZOOM_PERCENT,
  MINIMAP_ZOOM_STEP_PERCENT,
  orbitDelta,
  planeCorners,
  sphericalPosition,
  viewPlaneHalfExtents,
  type Vec3,
} from "../utils/scene3d";
import type { Board3DEngine } from "./HkBoard3D";
import "./HkMinimap.scss";
import "./HkMinimap3D.scss";

const MAP_W = 160;
const MAP_H = 110;
/** Re-fit the auto radius at ~3 Hz — content orbits move objects every
 *  frame, but the fit only needs to track the envelope. */
const REFIT_MS = 300;

export default defineComponent({
  name: "HkMinimap3D",
  props: {
    engine: { type: Object as PropType<Board3DEngine>, required: true },
  },
  setup(props) {
    const { t } = useI18n();
    const rootRef = ref<HTMLElement | null>(null);
    const canvasRef = ref<HTMLCanvasElement | null>(null);
    const dragging = ref(false);
    const sliderOpen = ref(false);
    const zoomPercent = ref(100);

    let renderer: THREE.WebGLRenderer | null = null;
    let mapCamera: THREE.PerspectiveCamera | null = null;
    let removePostRender: (() => void) | null = null;
    let theta = 0;
    let phi = 1.1;
    let seeded = false;
    let fitRadius = 10;
    let lastRefit = 0;
    let dragStart: { x: number; y: number } | null = null;

    // Helper layer objects (main-camera glyph + view-plane frame).
    let glyph: THREE.Group | null = null;
    let planeFrame: THREE.LineSegments | null = null;
    const markerMeshes = new Map<string, THREE.Mesh>();

    const scene = computed(() => props.engine.scene);

    function buildHelpers(): void {
      const s = scene.value;
      if (!s) return;

      glyph = new THREE.Group();
      // Cone pointing forward (-Z, the camera's look direction): the
      // glyph reads as a little holographic camera/drone.
      const cone = new THREE.Mesh(
        new THREE.ConeGeometry(0.9, 2.2, 4, 1, true),
        new THREE.MeshBasicMaterial({
          color: 0x7ecbff,
          wireframe: true,
          transparent: true,
          opacity: 0.9,
          depthTest: false,
        }),
      );
      cone.rotation.x = -Math.PI / 2;
      cone.position.z = -1.4;
      glyph.add(cone);
      const body = new THREE.Mesh(
        new THREE.OctahedronGeometry(0.7),
        new THREE.MeshBasicMaterial({
          color: 0x7ecbff,
          transparent: true,
          opacity: 0.55,
          depthTest: false,
        }),
      );
      glyph.add(body);

      planeFrame = new THREE.LineSegments(
        new THREE.BufferGeometry(),
        new THREE.LineBasicMaterial({
          color: 0x7ecbff,
          transparent: true,
          opacity: 0.6,
          depthTest: false,
        }),
      );
      planeFrame.frustumCulled = false;

      for (const obj of [glyph, planeFrame]) {
        obj.layers.set(BOARD3D_HELPERS_LAYER);
        obj.traverse((c) => c.layers.set(BOARD3D_HELPERS_LAYER));
        obj.renderOrder = 999;
        s.add(obj);
      }
    }

    function markerFor(id: string, def: { marker?: "dot" | "cube" | "none"; markerColor?: string }): THREE.Mesh | null {
      if (def.marker === "none") return null;
      const color = new THREE.Color(def.markerColor ?? "#7ecbff");
      let mesh: THREE.Mesh;
      if (def.marker === "cube") {
        mesh = new THREE.Mesh(
          new THREE.BoxGeometry(1.6, 1.6, 1.6),
          new THREE.MeshBasicMaterial({
            color,
            wireframe: true,
            transparent: true,
            opacity: 0.85,
            depthTest: false,
          }),
        );
      } else {
        mesh = new THREE.Mesh(
          new THREE.SphereGeometry(0.9, 8, 6),
          new THREE.MeshBasicMaterial({
            color,
            transparent: true,
            opacity: 0.9,
            depthTest: false,
          }),
        );
      }
      mesh.layers.set(BOARD3D_HELPERS_LAYER);
      mesh.renderOrder = 999;
      mesh.userData.mm3dId = id;
      return mesh;
    }

    const tmpVec = new THREE.Vector3();

    function syncMarkers(): void {
      const s = scene.value;
      if (!s) return;
      const reg = props.engine.objects();
      for (const [id, mesh] of markerMeshes) {
        if (!reg.has(id)) {
          s.remove(mesh);
          mesh.geometry.dispose();
          (mesh.material as THREE.Material).dispose();
          markerMeshes.delete(id);
        }
      }
      for (const [id, def] of reg) {
        let mesh = markerMeshes.get(id);
        if (!mesh) {
          const made = markerFor(id, def);
          if (!made) continue;
          mesh = made;
          markerMeshes.set(id, mesh);
          s.add(mesh);
        }
        def.object.getWorldPosition(tmpVec);
        mesh.position.copy(tmpVec);
        // Marker size tracks the object's own bounding sphere (clamped):
        // a star reads bigger than a satellite in the map.
        const box = new THREE.Box3().setFromObject(def.object);
        const sphere = box.getBoundingSphere(new THREE.Sphere());
        const scale = Math.min(3, Math.max(0.6, sphere.radius * 0.25));
        mesh.scale.setScalar(scale);
      }
    }

    function refit(): void {
      const { camera, controls } = props.engine;
      const center = camera.position;
      let r = controls.target.distanceTo(center) * 1.05;
      for (const def of props.engine.objects().values()) {
        if (def.content === false) continue;
        def.object.getWorldPosition(tmpVec);
        const box = new THREE.Box3().setFromObject(def.object);
        const sphere = box.getBoundingSphere(new THREE.Sphere());
        r = Math.max(r, tmpVec.distanceTo(center) + sphere.radius);
      }
      fitRadius = Math.max(r, 1);
    }

    function updateHelpersAndCamera(): void {
      const { camera, controls } = props.engine;
      if (!mapCamera || !glyph || !planeFrame) return;

      // Camera glyph rides the main camera pose.
      glyph.position.copy(camera.position);
      glyph.quaternion.copy(camera.quaternion);

      // View-plane frame: quad at the orbit-target distance + edges back
      // to the eye (the minimap's "查看平面范围").
      const dist = Math.max(camera.position.distanceTo(controls.target), 0.001);
      const forward = tmpVec.set(0, 0, -1).applyQuaternion(camera.quaternion).clone();
      const up = new THREE.Vector3(0, 1, 0).applyQuaternion(camera.quaternion);
      const right = new THREE.Vector3().crossVectors(forward, up).normalize();
      const trueUp = new THREE.Vector3().crossVectors(right, forward).normalize();
      const planeCenter: Vec3 = [
        camera.position.x + forward.x * dist,
        camera.position.y + forward.y * dist,
        camera.position.z + forward.z * dist,
      ];
      const { halfW, halfH } = viewPlaneHalfExtents(camera.fov, camera.aspect, dist);
      const corners = planeCorners(
        planeCenter,
        [right.x, right.y, right.z],
        [trueUp.x, trueUp.y, trueUp.z],
        halfW,
        halfH,
      );
      const eye: Vec3 = [camera.position.x, camera.position.y, camera.position.z];
      const pts: number[] = [];
      for (const c of corners) pts.push(...eye, ...c); // 4 edges
      for (let i = 0; i < 4; i++) pts.push(...corners[i], ...corners[(i + 1) % 4]); // quad
      planeFrame.geometry.setAttribute("position", new THREE.Float32BufferAttribute(pts, 3));

      // Map eye on the sphere centred on the main camera.
      if (!seeded) {
        const off = camera.position.clone().sub(controls.target);
        theta = Math.atan2(off.x, off.z);
        phi = Math.min(
          Math.PI - 0.12,
          Math.max(0.12, Math.acos(Math.min(1, Math.max(-1, off.y / Math.max(off.length(), 1e-6))))),
        );
        seeded = true;
      }
      const center: Vec3 = [camera.position.x, camera.position.y, camera.position.z];
      const base = fitDistance(fitRadius, mapCamera.fov, mapCamera.aspect);
      const radius = Math.max(base * (100 / zoomPercent.value), 1);
      const eyePos = sphericalPosition(center, theta, phi, radius);
      mapCamera.position.set(...eyePos);
      mapCamera.up.set(0, 1, 0);
      mapCamera.lookAt(...center);
    }

    function onFrame(): void {
      if (!renderer || !mapCamera || !scene.value) return;
      const now = performance.now();
      if (now - lastRefit >= REFIT_MS) {
        lastRefit = now;
        refit();
      }
      syncMarkers();
      updateHelpersAndCamera();
      renderer.render(scene.value, mapCamera);
    }

    // ── gestures ────────────────────────────────────────────────────────
    function onDown(e: PointerEvent): void {
      const target = e.target as HTMLElement;
      if (target.closest(".hk-mm-zoom-bar") || target.closest(".hk-mm-zoom-pop")) return;
      sliderOpen.value = false;
      e.stopPropagation();
      e.preventDefault();
      dragging.value = true;
      dragStart = { x: e.clientX, y: e.clientY };
      rootRef.value?.setPointerCapture(e.pointerId);
    }
    function onMove(e: PointerEvent): void {
      if (!dragging.value || !dragStart) return;
      e.stopPropagation();
      const next = orbitDelta(theta, phi, e.clientX - dragStart.x, e.clientY - dragStart.y);
      theta = next.theta;
      phi = next.phi;
      dragStart = { x: e.clientX, y: e.clientY };
    }
    function onUp(e: PointerEvent): void {
      if (!dragging.value) return;
      e.stopPropagation();
      dragging.value = false;
      dragStart = null;
      rootRef.value?.releasePointerCapture(e.pointerId);
    }
    function onWheel(e: WheelEvent): void {
      e.stopPropagation();
      e.preventDefault();
      zoomPercent.value = clampMinimapZoom(
        zoomPercent.value + (e.deltaY < 0 ? MINIMAP_ZOOM_STEP_PERCENT : -MINIMAP_ZOOM_STEP_PERCENT),
      );
    }

    // ── zoom bar ────────────────────────────────────────────────────────
    const canStepIn = computed(() => zoomPercent.value < MINIMAP_MAX_ZOOM_PERCENT - 1e-9);
    const canStepOut = computed(() => zoomPercent.value > MINIMAP_MIN_ZOOM_PERCENT + 1e-9);
    function stepZoom(dir: number): void {
      zoomPercent.value = clampMinimapZoom(zoomPercent.value + dir * MINIMAP_ZOOM_STEP_PERCENT);
    }
    function resetView(): void {
      seeded = false;
      zoomPercent.value = 100;
      sliderOpen.value = false;
    }

    // Slider pop dismissal (same shield as the 2D minimap).
    function onDocPointerDown(e: PointerEvent): void {
      if (!rootRef.value?.contains(e.target as Node)) sliderOpen.value = false;
    }
    function onDocKeydown(e: KeyboardEvent): void {
      if (e.key === "Escape") sliderOpen.value = false;
    }
    watch(sliderOpen, (open) => {
      if (open) {
        document.addEventListener("pointerdown", onDocPointerDown, true);
        document.addEventListener("keydown", onDocKeydown, true);
      } else {
        document.removeEventListener("pointerdown", onDocPointerDown, true);
        document.removeEventListener("keydown", onDocKeydown, true);
      }
    });

    onMounted(() => {
      const canvas = canvasRef.value;
      const el = rootRef.value;
      if (!canvas || !el) return;
      try {
        renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
      } catch {
        renderer = null; // no WebGL: the map quietly stays empty
        return;
      }
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      renderer.setSize(MAP_W, MAP_H);
      renderer.setClearColor(0x000000, 0);

      mapCamera = new THREE.PerspectiveCamera(48, MAP_W / MAP_H, 0.1, 10000);
      mapCamera.layers.enable(BOARD3D_HELPERS_LAYER);

      buildHelpers();
      refit();
      removePostRender = props.engine.addPostRender(onFrame);

      el.addEventListener("pointerdown", onDown);
      el.addEventListener("pointermove", onMove);
      el.addEventListener("pointerup", onUp);
      el.addEventListener("pointercancel", onUp);
      el.addEventListener("wheel", onWheel, { passive: false });
    });

    onBeforeUnmount(() => {
      removePostRender?.();
      const el = rootRef.value;
      if (el) {
        el.removeEventListener("pointerdown", onDown);
        el.removeEventListener("pointermove", onMove);
        el.removeEventListener("pointerup", onUp);
        el.removeEventListener("pointercancel", onUp);
        el.removeEventListener("wheel", onWheel);
      }
      document.removeEventListener("pointerdown", onDocPointerDown, true);
      document.removeEventListener("keydown", onDocKeydown, true);
      const s = scene.value;
      if (s) {
        if (glyph) s.remove(glyph);
        if (planeFrame) {
          s.remove(planeFrame);
          planeFrame.geometry.dispose();
          (planeFrame.material as THREE.Material).dispose();
        }
        for (const mesh of markerMeshes.values()) {
          s.remove(mesh);
          mesh.geometry.dispose();
          (mesh.material as THREE.Material).dispose();
        }
      }
      markerMeshes.clear();
      renderer?.dispose();
    });

    return () => (
      <div
        ref={rootRef}
        class="hk-minimap hk-minimap3d"
        data-dragging={dragging.value ? "" : undefined}
      >
        <canvas ref={canvasRef} class="hk-minimap3d-canvas" width={MAP_W} height={MAP_H} />
        <div class="hk-mm-zoom-bar">
          <button
            class="hk-mm-zoom-btn"
            type="button"
            onClick={() => stepZoom(-1)}
            disabled={!canStepOut.value}
            aria-label={t("hikari::zoomToolbar.zoomOut", "Zoom out")}
            title={t("hikari::zoomToolbar.zoomOut", "Zoom out")}
          >
            <ZoomOut size={12} />
          </button>
          <button
            class="hk-mm-zoom-label"
            type="button"
            aria-haspopup="dialog"
            aria-expanded={sliderOpen.value ? "true" : "false"}
            onClick={() => {
              sliderOpen.value = !sliderOpen.value;
            }}
            title={t("hikari::zoomToolbar.zoomSlider", "Zoom level")}
          >
            {zoomPercent.value}%
          </button>
          <button
            class="hk-mm-zoom-btn"
            type="button"
            onClick={() => stepZoom(1)}
            disabled={!canStepIn.value}
            aria-label={t("hikari::zoomToolbar.zoomIn", "Zoom in")}
            title={t("hikari::zoomToolbar.zoomIn", "Zoom in")}
          >
            <ZoomIn size={12} />
          </button>
          <button
            class="hk-mm-zoom-btn hk-mm-zoom-reset-btn"
            type="button"
            onClick={resetView}
            aria-label={t("hikari::board3d.resetView", "Reset view")}
            title={t("hikari::board3d.resetView", "Reset view")}
          >
            <Maximize2 size={11} />
          </button>
        </div>
        {sliderOpen.value && (
          <div class="hk-mm-zoom-pop">
            <HSlider
              modelValue={zoomPercent.value}
              min={MINIMAP_MIN_ZOOM_PERCENT}
              max={MINIMAP_MAX_ZOOM_PERCENT}
              step={MINIMAP_ZOOM_STEP_PERCENT}
              size="sm"
              ariaLabel={t("hikari::zoomToolbar.zoomSlider", "Zoom level")}
              formatValue={(v: number) => `${v}%`}
              onUpdate:modelValue={(v: number) => {
                zoomPercent.value = clampMinimapZoom(v);
              }}
            />
            <div class="hk-mm-zoom-pop-scale" aria-hidden="true">
              <span>{MINIMAP_MIN_ZOOM_PERCENT}%</span>
              <span>{MINIMAP_MAX_ZOOM_PERCENT}%</span>
            </div>
          </div>
        )}
      </div>
    );
  },
});
