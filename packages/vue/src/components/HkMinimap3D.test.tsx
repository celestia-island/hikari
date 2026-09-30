/* HkMinimap3D behaviour: the fake WebGL surface captures which camera the
 * map renders with; three's real scene/camera math sits underneath, so a
 * drag must MOVE the map eye around the main camera and the zoom bar must
 * scale the fit radius. */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createApp, defineComponent, h, nextTick } from "vue";
import * as THREE from "three";

const H = vi.hoisted(() => {
  class FakeWebGLRenderer {
    static instances: FakeWebGLRenderer[] = [];
    renders: Array<{ scene: unknown; camera: THREE.PerspectiveCamera }> = [];
    disposed = false;
    constructor(_opts: { canvas: HTMLCanvasElement }) {
      FakeWebGLRenderer.instances.push(this);
    }
    setPixelRatio(): void {}
    setSize(): void {}
    setClearColor(): void {}
    render(scene: unknown, camera: THREE.PerspectiveCamera): void {
      // A real renderer maintains world matrices every pass.
      (scene as THREE.Scene).updateMatrixWorld(true);
      camera.updateMatrixWorld();
      this.renders.push({ scene, camera });
    }
    dispose(): void { this.disposed = true; }
  }
  return { FakeWebGLRenderer };
});

vi.mock("three", async (importOriginal) => {
  const actual = await importOriginal<typeof import("three")>();
  return { ...actual, WebGLRenderer: H.FakeWebGLRenderer };
});

import HkMinimap3D from "./HkMinimap3D";
import { BOARD3D_HELPERS_LAYER, type Board3DEngine } from "./HkBoard3D";
import { orbitDelta, sphericalPosition } from "../utils/scene3d";

const mounts: Array<{ app: ReturnType<typeof createApp>; container: HTMLElement }> = [];

interface FakeEngineOpts {
  objects?: Map<string, { object: THREE.Object3D; content?: boolean }>;
}

function fakeEngine(opts: FakeEngineOpts = {}): {
  engine: Board3DEngine;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  firePostRender: () => void;
} {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(45, 16 / 9, 0.1, 4000);
  camera.position.set(20, 12, 24);
  camera.lookAt(0, 0, 0);
  const target = new THREE.Vector3(0, 0, 0);
  let postRender: (() => void) | null = null;
  const engine = {
    scene,
    camera,
    controls: { target } as unknown as Board3DEngine["controls"],
    renderer: {} as Board3DEngine["renderer"],
    addTick: () => () => {},
    addPostRender: (fn: () => void) => {
      postRender = fn;
      return () => { postRender = null; };
    },
    setObject: () => {},
    objects: () => (opts.objects ?? new Map()) as never,
    flyTo: () => {},
    frameAll: () => {},
    projectToScreen: () => ({ x: 0, y: 0, visible: true }),
    onTheme: () => {},
  };
  return {
    engine: engine as Board3DEngine,
    scene,
    camera,
    firePostRender: () => postRender?.(),
  };
}

function mountMap(engine: Board3DEngine) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const app = createApp(
    defineComponent({
      setup() {
        return () => h(HkMinimap3D, { engine });
      },
    }),
  );
  app.mount(container);
  mounts.push({ app, container });
  return { app, container };
}

beforeEach(() => {
  H.FakeWebGLRenderer.instances = [];
});

afterEach(() => {
  for (const m of mounts.splice(0)) {
    m.app.unmount();
    m.container.remove();
  }
});

describe("HkMinimap3D", () => {
  it("renders the same scene from its own camera, with helpers on the helpers layer", async () => {
    const { engine, scene, firePostRender } = fakeEngine();
    mountMap(engine);
    await nextTick();
    firePostRender();

    const renderer = H.FakeWebGLRenderer.instances[0];
    expect(renderer.renders.length).toBe(1);
    expect(renderer.renders[0].scene).toBe(scene);
    const mapCam = renderer.renders[0].camera;
    expect(mapCam).not.toBe(engine.camera);
    // The map camera sees the helper layer; the main camera does not.
    expect(mapCam.layers.test(new THREE.Layers())).toBe(true);
    const helpersMask = 1 << BOARD3D_HELPERS_LAYER;
    expect(mapCam.layers.mask & helpersMask).toBe(helpersMask);
    expect(engine.camera.layers.mask & helpersMask).toBe(0);
    // Helpers actually joined the scene (glyph group + view-plane frame).
    const helperChildren = scene.children.filter(
      (c) => (c.layers.mask & helpersMask) !== 0,
    );
    expect(helperChildren.length).toBeGreaterThanOrEqual(2);
  });

  it("spawns markers for registered content and follows their world positions", async () => {
    const body = new THREE.Mesh(new THREE.SphereGeometry(2, 8, 6), new THREE.MeshBasicMaterial());
    body.position.set(7, 0, -4);
    const objects = new Map([["node-1", { object: body }]]);
    const { engine, scene, firePostRender } = fakeEngine({ objects: objects as never });
    mountMap(engine);
    await nextTick();
    firePostRender();

    const marker = scene.children.find((c) => c.userData.mm3dId === "node-1");
    expect(marker).toBeDefined();
    expect(marker!.position.x).toBeCloseTo(7, 5);
    expect(marker!.position.z).toBeCloseTo(-4, 5);

    body.position.set(-3, 1, 9);
    firePostRender();
    expect(marker!.position.x).toBeCloseTo(-3, 5);
    expect(marker!.position.z).toBeCloseTo(9, 5);
  });

  it("dragging orbits the map eye on the sphere centred on the main camera", async () => {
    const { engine, camera, firePostRender } = fakeEngine();
    const { container } = mountMap(engine);
    await nextTick();
    firePostRender();
    const renderer = H.FakeWebGLRenderer.instances[0];
    const mapCam = renderer.renders[0].camera;
    const before = mapCam.position.clone();

    const root = container.querySelector(".hk-minimap3d")!;
    root.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, clientX: 80, clientY: 55 }));
    root.dispatchEvent(new PointerEvent("pointermove", { bubbles: true, clientX: 120, clientY: 40 }));
    firePostRender();

    const after = mapCam.position.clone();
    expect(after.equals(before)).toBe(false);
    // Still on the sphere: distance to the main camera is the fit radius.
    const dBefore = before.distanceTo(camera.position);
    const dAfter = after.distanceTo(camera.position);
    expect(dAfter).toBeCloseTo(dBefore, 3);

    // And the eye keeps LOOKING AT the main camera: its forward axis
    // points straight at it.
    const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(mapCam.quaternion);
    const toCam = camera.position.clone().sub(after).normalize();
    expect(forward.dot(toCam)).toBeGreaterThan(0.999);

    root.dispatchEvent(new PointerEvent("pointerup", { bubbles: true, clientX: 120, clientY: 40 }));
  });

  it("drag deltas follow the shared spherical math", async () => {
    const { engine, camera, firePostRender } = fakeEngine();
    const { container } = mountMap(engine);
    await nextTick();
    firePostRender();
    const mapCam = H.FakeWebGLRenderer.instances[0].renders[0].camera;

    const root = container.querySelector(".hk-minimap3d")!;
    root.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, clientX: 80, clientY: 55 }));
    root.dispatchEvent(new PointerEvent("pointermove", { bubbles: true, clientX: 96, clientY: 55 }));
    firePostRender();

    // Recompute the expected pose: seed from the first render, drag +16px.
    const radius = mapCam.position.distanceTo(camera.position);
    // theta0 comes from the camera azimuth; the drag adds orbitDelta.
    const off = camera.position.clone().sub(new THREE.Vector3(0, 0, 0));
    const theta0 = Math.atan2(off.x, off.z);
    const phi0 = Math.acos(Math.min(1, Math.max(-1, off.y / off.length())));
    const next = orbitDelta(theta0, phi0, 16, 0);
    const expected = sphericalPosition(
      [camera.position.x, camera.position.y, camera.position.z],
      next.theta,
      next.phi,
      radius,
    );
    expect(mapCam.position.x).toBeCloseTo(expected[0], 3);
    expect(mapCam.position.y).toBeCloseTo(expected[1], 3);
    expect(mapCam.position.z).toBeCloseTo(expected[2], 3);
    root.dispatchEvent(new PointerEvent("pointerup", { bubbles: true, clientX: 96, clientY: 55 }));
  });

  it("the zoom bar steps 15% rungs clamped to [50, 250], reset reseeds to 100%", async () => {
    const { engine } = fakeEngine();
    const { container } = mountMap(engine);
    await nextTick();

    const label = () => container.querySelector(".hk-mm-zoom-label")!.textContent;
    const btns = container.querySelectorAll<HTMLButtonElement>(".hk-mm-zoom-btn");
    const [minus, plus] = [btns[0], btns[1]];
    const reset = container.querySelector<HTMLButtonElement>(".hk-mm-zoom-reset-btn")!;

    expect(label()).toBe("100%");
    plus.click();
    await nextTick();
    expect(label()).toBe("115%");
    minus.click();
    minus.click();
    await nextTick();
    expect(label()).toBe("85%");
    for (let i = 0; i < 20; i++) minus.click();
    await nextTick();
    expect(label()).toBe("50%");
    expect(minus.disabled).toBe(true);
    reset.click();
    await nextTick();
    expect(label()).toBe("100%");
  });

  it("wheel over the map steps the zoom too", async () => {
    const { engine } = fakeEngine();
    const { container } = mountMap(engine);
    await nextTick();
    const label = () => container.querySelector(".hk-mm-zoom-label")!.textContent;
    const canvas = container.querySelector("canvas")!;
    canvas.dispatchEvent(new WheelEvent("wheel", { bubbles: true, cancelable: true, deltaY: -100 }));
    await nextTick();
    expect(label()).toBe("115%");
    canvas.dispatchEvent(new WheelEvent("wheel", { bubbles: true, cancelable: true, deltaY: 100 }));
    await nextTick();
    expect(label()).toBe("100%");
  });

  it("a higher zoom pulls the map eye closer to the main camera", async () => {
    const { engine, camera, firePostRender } = fakeEngine();
    const { container } = mountMap(engine);
    await nextTick();
    firePostRender();
    const mapCam = H.FakeWebGLRenderer.instances[0].renders[0].camera;
    const d100 = mapCam.position.distanceTo(camera.position);

    const btns = container.querySelectorAll<HTMLButtonElement>(".hk-mm-zoom-btn");
    btns[1].click(); // 115%
    await nextTick();
    firePostRender();
    const d115 = mapCam.position.distanceTo(camera.position);
    expect(d115).toBeLessThan(d100);
    expect(d115 / d100).toBeCloseTo(100 / 115, 2);
  });

  it("throttles its auto-refit to the 300 ms window", async () => {
    const { engine, camera, firePostRender } = fakeEngine();
    mountMap(engine);
    await nextTick();
    // First frame refits (the window is open from mount).
    firePostRender();
    const mapCam = H.FakeWebGLRenderer.instances[0].renders[0].camera;
    const r0 = mapCam.position.distanceTo(camera.position);

    // Move the main camera OUT and fire again well inside the window:
    // the map eye radius (a function of the fit radius while throttled)
    // must not follow yet.
    camera.position.set(400, 300, 500);
    firePostRender();
    expect(mapCam.position.distanceTo(camera.position)).toBeCloseTo(r0, 6);

    // Past the window it does follow.
    const realNow = performance.now();
    const spy = vi.spyOn(performance, "now").mockReturnValue(realNow + 400);
    try {
      firePostRender();
    } finally {
      spy.mockRestore();
    }
    expect(mapCam.position.distanceTo(camera.position)).not.toBeCloseTo(r0, 6);
  });

  it("disposes its renderer and strips helpers on unmount", async () => {
    // Registered content matters here: the marker meshes are a separate
    // branch of the teardown and only exist once objects() is non-empty.
    const objects = new Map([
      ["a", { object: new THREE.Mesh(new THREE.SphereGeometry(1, 8, 6), new THREE.MeshBasicMaterial()) }],
      ["b", { object: new THREE.Mesh(new THREE.SphereGeometry(1, 8, 6), new THREE.MeshBasicMaterial()) }],
    ]);
    const { engine, scene, firePostRender } = fakeEngine({ objects: objects as never });
    mountMap(engine);
    await nextTick();
    // Markers are spawned during the post-render pass — fire it so the
    // teardown actually has marker meshes to strip.
    firePostRender();
    expect(scene.children.length).toBeGreaterThan(0);
    const helpersMask = 1 << BOARD3D_HELPERS_LAYER;
    expect(scene.children.some((c) => (c.layers.mask & helpersMask) !== 0)).toBe(true);

    const m = mounts.splice(0)[0];
    m.app.unmount();
    m.container.remove();
    expect(H.FakeWebGLRenderer.instances[0].disposed).toBe(true);
    expect(scene.children.some((c) => (c.layers.mask & helpersMask) !== 0)).toBe(false);
    // No marker survivors: the map must leave the scene exactly as it
    // found it (this is what a hide/show toggle would leak otherwise).
    expect(scene.children.length).toBe(0);
  });

  it("disposes the camera glyph's own geometries and materials on unmount", async () => {
    const { engine } = fakeEngine();
    mountMap(engine);
    await nextTick();
    // The glyph is a group (cone + octahedron); count what the map built
    // on the helpers layer and assert every one of them is disposed.
    const helpersMask = 1 << BOARD3D_HELPERS_LAYER;
    const built: Array<{ dispose: () => void }> = [];
    const builtMats: Array<{ dispose: () => void }> = [];
    const seenGeo = new Set<unknown>();
    const seenMat = new Set<unknown>();
    for (const child of engine.scene.children) {
      if ((child.layers.mask & helpersMask) === 0) continue;
      child.traverse((obj: THREE.Object3D) => {
        const mesh = obj as THREE.Mesh;
        if (mesh.geometry && !seenGeo.has(mesh.geometry)) {
          seenGeo.add(mesh.geometry);
          built.push(mesh.geometry as unknown as { dispose: () => void });
        }
        const mat = (mesh as unknown as { material?: { dispose: () => void } }).material;
        if (mat && !seenMat.has(mat)) {
          seenMat.add(mat);
          builtMats.push(mat);
        }
      });
    }
    expect(built.length).toBeGreaterThan(1); // cone + octahedron + frame
    const spies = [...built, ...builtMats].map((r) => vi.spyOn(r, "dispose"));

    const m = mounts.splice(0)[0];
    m.app.unmount();
    m.container.remove();
    for (const spy of spies) expect(spy).toHaveBeenCalled();
  });
});
