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

  it("disposes its renderer and strips helpers on unmount", async () => {
    const { engine, scene } = fakeEngine();
    mountMap(engine);
    await nextTick();
    const helpersMask = 1 << BOARD3D_HELPERS_LAYER;
    expect(scene.children.some((c) => (c.layers.mask & helpersMask) !== 0)).toBe(true);

    const m = mounts.splice(0)[0];
    m.app.unmount();
    m.container.remove();
    expect(H.FakeWebGLRenderer.instances[0].disposed).toBe(true);
    expect(scene.children.some((c) => (c.layers.mask & helpersMask) !== 0)).toBe(false);
  });
});
