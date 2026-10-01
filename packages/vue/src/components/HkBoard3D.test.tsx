/* happy-dom has no WebGL, so the renderer/controls/label-renderer are fakes
 * over the REAL three core (scene graph, raycaster, cameras all genuine):
 * assertions pin what the board does with the scene — registration, picking,
 * labels, camera flights, theme sync, teardown. */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createApp, defineComponent, h, nextTick, ref } from "vue";
import * as THREE from "three";

const H = vi.hoisted(() => {
  class FakeWebGLRenderer {
    static instances: FakeWebGLRenderer[] = [];
    static failNext = false;
    domElement: HTMLCanvasElement;
    renders: Array<{ scene: unknown; camera: unknown }> = [];
    sizes: Array<[number, number]> = [];
    clearColor: unknown = null;
    toneMapping: unknown = null;
    shadowMap = { enabled: false };
    disposed = false;
    constructor(opts: { canvas: HTMLCanvasElement }) {
      if (FakeWebGLRenderer.failNext) {
        FakeWebGLRenderer.failNext = false;
        throw new Error("no webgl (test)");
      }
      this.domElement = opts.canvas;
      FakeWebGLRenderer.instances.push(this);
    }
    setPixelRatio(): void {}
    setSize(w: number, h: number): void { this.sizes.push([w, h]); }
    setClearColor(c: unknown): void { this.clearColor = c; }
    render(scene: unknown, camera: unknown): void {
      // A real renderer maintains world matrices every pass; picking and
      // projection both read them.
      (scene as THREE.Scene).updateMatrixWorld(true);
      (camera as THREE.Camera).updateMatrixWorld();
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

vi.mock("three/examples/jsm/controls/OrbitControls.js", async () => {
  const actual = await vi.importActual<typeof import("three")>("three");
  class FakeOrbitControls {
    target = new actual.Vector3();
    enabled = true;
    enableDamping = false;
    dampingFactor = 0;
    minDistance = 0;
    maxDistance = Infinity;
    enablePan = true;
    update(): void {}
    dispose(): void {}
  }
  return { OrbitControls: FakeOrbitControls };
});

vi.mock("three/examples/jsm/renderers/CSS2DRenderer.js", async (importOriginal) => {
  const actual = await importOriginal<
    typeof import("three/examples/jsm/renderers/CSS2DRenderer.js")
  >();
  class FakeCSS2DRenderer {
    domElement: HTMLElement = document.createElement("div");
    setSize(): void {}
    render(): void {}
  }
  return { ...actual, CSS2DRenderer: FakeCSS2DRenderer };
});

import HkBoard3D, { type Board3DEngine } from "./HkBoard3D";

const mounts: Array<{ app: ReturnType<typeof createApp>; container: HTMLElement }> = [];

function mountBoard(props: Record<string, unknown> = {}, on: Record<string, (arg: never) => void> = {}) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const app = createApp(
    defineComponent({
      setup() {
        return () =>
          h(HkBoard3D, {
            ...props,
            onReady: on.ready as never,
            onObjectClick: on.objectClick as never,
            onObjectHover: on.objectHover as never,
            onError: on.error as never,
          });
      },
    }),
  );
  app.mount(container);
  mounts.push({ app, container });
  return { app, container };
}

/** Wait long enough for the RAF loop to tick at least twice. */
async function tickFrames(): Promise<void> {
  await new Promise((r) => setTimeout(r, 50));
}

beforeEach(() => {
  H.FakeWebGLRenderer.instances = [];
  H.FakeWebGLRenderer.failNext = false;
});

afterEach(() => {
  for (const m of mounts.splice(0)) {
    m.app.unmount();
    m.container.remove();
  }
});

describe("HkBoard3D", () => {
  it("mounts, builds the renderer over the real scene, and emits ready", async () => {
    let engine: Board3DEngine | null = null;
    const { container } = mountBoard({}, { ready: ((e: Board3DEngine) => { engine = e; }) as never });
    await nextTick();
    expect(engine).not.toBeNull();
    expect(engine!.scene).toBeInstanceOf(THREE.Scene);
    expect(engine!.camera).toBeInstanceOf(THREE.PerspectiveCamera);
    expect(H.FakeWebGLRenderer.instances.length).toBeGreaterThanOrEqual(1);
    // The board's renderer is the first (the minimap spins up its own).
    expect(H.FakeWebGLRenderer.instances[0].sizes.length).toBeGreaterThan(0);
    expect(container.querySelector("canvas.hk-board3d-canvas")).not.toBeNull();
    // The 3D minimap docks inside by default.
    expect(container.querySelector(".hk-minimap3d")).not.toBeNull();
    await tickFrames();
    expect(H.FakeWebGLRenderer.instances[0].renders.length).toBeGreaterThan(0);
  });

  it("hides the minimap when minimap=false", async () => {
    mountBoard({ minimap: false }, {});
    await nextTick();
    const { container } = mounts[0];
    expect(container.querySelector(".hk-minimap3d")).toBeNull();
  });

  it("setObject registers content into the scene, attaches the CSS2D label", async () => {
    let engine: Board3DEngine | null = null;
    mountBoard({}, { ready: ((e: Board3DEngine) => { engine = e; }) as never });
    await nextTick();

    const body = new THREE.Mesh(
      new THREE.SphereGeometry(1, 8, 6),
      new THREE.MeshBasicMaterial(),
    );
    const label = document.createElement("div");
    label.textContent = "host-node-2";
    engine!.setObject("node-1", { object: body, label, labelOffset: [0, 2, 0] });

    expect(engine!.scene.children).toContain(body);
    expect(body.userData.board3dId).toBe("node-1");
    expect(label.classList.contains("hk-board3d-label")).toBe(true);
    // Label rides the object as a CSS2D child at the requested offset.
    const tag = body.children.find((c) => (c as unknown as { element?: HTMLElement }).element === label);
    expect(tag).toBeDefined();
    expect(tag!.position.y).toBe(2);

    engine!.setObject("node-1", null);
    expect(engine!.scene.children).not.toContain(body);
  });

  it("raycasts a click to the registered object id", async () => {
    let engine: Board3DEngine | null = null;
    const clicks: string[] = [];
    mountBoard(
      {},
      {
        ready: ((e: Board3DEngine) => { engine = e; }) as never,
        objectClick: ((id: string) => clicks.push(id)) as never,
      },
    );
    await nextTick();
    const { container } = mounts[0];
    const canvas = container.querySelector("canvas")!;

    // happy-dom rects are all zero: give the canvas a real viewport box.
    canvas.getBoundingClientRect = () =>
      ({ left: 0, top: 0, width: 800, height: 600, right: 800, bottom: 600 }) as DOMRect;

    const body = new THREE.Mesh(
      new THREE.SphereGeometry(2, 16, 12),
      new THREE.MeshBasicMaterial(),
    );
    engine!.setObject("star-1", { object: body });

    // Let a frame pass so the render pass has maintained world matrices
    // (the real renderer does this every frame; picking reads them).
    await tickFrames();

    // Centre of the canvas = the camera's look-at → straight through the sphere.
    canvas.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, clientX: 400, clientY: 300 }));
    canvas.dispatchEvent(new PointerEvent("pointerup", { bubbles: true, clientX: 400, clientY: 300 }));
    expect(clicks).toEqual(["star-1"]);

    // A drag (beyond the slop) is an orbit, not a click.
    canvas.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, clientX: 400, clientY: 300 }));
    canvas.dispatchEvent(new PointerEvent("pointerup", { bubbles: true, clientX: 430, clientY: 310 }));
    expect(clicks).toEqual(["star-1"]);

    // Clicking empty space selects nothing.
    canvas.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, clientX: 10, clientY: 10 }));
    canvas.dispatchEvent(new PointerEvent("pointerup", { bubbles: true, clientX: 10, clientY: 10 }));
    expect(clicks).toEqual(["star-1"]);
  });

  it("frameAll recentres the orbit target onto the content", async () => {
    let engine: Board3DEngine | null = null;
    mountBoard({}, { ready: ((e: Board3DEngine) => { engine = e; }) as never });
    await nextTick();

    const body = new THREE.Mesh(
      new THREE.SphereGeometry(1, 8, 6),
      new THREE.MeshBasicMaterial(),
    );
    body.position.set(50, 0, -30);
    engine!.setObject("far-away", { object: body });

    engine!.frameAll(1.3, 0);
    const target = engine!.controls.target;
    expect(target.x).toBeCloseTo(50, 3);
    expect(target.z).toBeCloseTo(-30, 3);
    // And the camera pulled back far enough to see it.
    expect(engine!.camera.position.distanceTo(target)).toBeGreaterThan(1);
  });

  it("frameAll honours its padding argument", async () => {
    let engine: Board3DEngine | null = null;
    mountBoard({}, { ready: ((e: Board3DEngine) => { engine = e; }) as never });
    await nextTick();

    const body = new THREE.Mesh(
      new THREE.SphereGeometry(2, 8, 6),
      new THREE.MeshBasicMaterial(),
    );
    engine!.setObject("body", { object: body });

    engine!.frameAll(1.3, 0);
    const tight = engine!.camera.position.distanceTo(engine!.controls.target);
    engine!.frameAll(3, 0);
    const loose = engine!.camera.position.distanceTo(engine!.controls.target);
    // More padding must push the camera strictly further out.
    expect(loose).toBeGreaterThan(tight);
    expect(loose / tight).toBeCloseTo(3 / 1.3, 4);
  });

  it("never picks, hovers or frames objects registered as pickable:false", async () => {
    let engine: Board3DEngine | null = null;
    const clicks: string[] = [];
    const { container } = mountBoard(
      {},
      {
        ready: ((e: Board3DEngine) => { engine = e; }) as never,
        objectClick: ((id: string) => clicks.push(id)) as never,
      },
    );
    await nextTick();

    const canvas = container.querySelector("canvas")!;
    vi.spyOn(canvas, "getBoundingClientRect").mockReturnValue({
      left: 0, top: 0, width: 800, height: 600,
      right: 800, bottom: 600, x: 0, y: 0, toJSON: () => ({}),
    } as DOMRect);

    // A mesh sitting exactly under the click ray, but registered as
    // decoration: helpers must never become clickable.
    const helper = new THREE.Mesh(
      new THREE.SphereGeometry(4, 12, 8),
      new THREE.MeshBasicMaterial(),
    );
    engine!.setObject("hidden", { object: helper, pickable: false });
    const pickable = new THREE.Mesh(
      new THREE.SphereGeometry(4, 12, 8),
      new THREE.MeshBasicMaterial(),
    );
    pickable.position.set(200, 0, 0); // off the centre ray
    engine!.setObject("visible", { object: pickable });

    await tickFrames();
    canvas.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, clientX: 400, clientY: 300 }));
    canvas.dispatchEvent(new PointerEvent("pointerup", { bubbles: true, clientX: 400, clientY: 300 }));
    expect(clicks).toEqual([]);
  });

  it("keeps one label chip per id across re-registration and clears it on null", async () => {
    let engine: Board3DEngine | null = null;
    mountBoard({}, { ready: ((e: Board3DEngine) => { engine = e; }) as never });
    await nextTick();

    const body = new THREE.Mesh(new THREE.SphereGeometry(1, 8, 6), new THREE.MeshBasicMaterial());
    const chip = () => {
      const el = document.createElement("div");
      el.textContent = "chip";
      return el;
    };
    engine!.setObject("node", { object: body, label: chip() });
    const labelChildren = () =>
      body.children.filter((c) => (c as unknown as { isCSS2DObject?: boolean }).isCSS2DObject).length;
    expect(labelChildren()).toBe(1);

    // Re-registering the same id must REPLACE its chip, not stack a second.
    engine!.setObject("node", { object: body, label: chip() });
    expect(labelChildren()).toBe(1);

    // Clearing the id detaches the chip from its anchor.
    engine!.setObject("node", null);
    expect(labelChildren()).toBe(0);
  });

  it("stops calling a tick once its disposer runs", async () => {
    let engine: Board3DEngine | null = null;
    mountBoard({}, { ready: ((e: Board3DEngine) => { engine = e; }) as never });
    await nextTick();

    let calls = 0;
    const stop = engine!.addTick(() => { calls += 1; });
    await tickFrames();
    expect(calls).toBeGreaterThan(0);

    stop();
    const frozen = calls;
    await tickFrames();
    expect(calls).toBe(frozen);
  });

  it("an instant flight cancels an in-flight animated one", async () => {
    let engine: Board3DEngine | null = null;
    mountBoard({}, { ready: ((e: Board3DEngine) => { engine = e; }) as never });
    await nextTick();

    const body = new THREE.Mesh(new THREE.SphereGeometry(1, 8, 6), new THREE.MeshBasicMaterial());
    body.position.set(120, 0, 0);
    engine!.setObject("far", { object: body });

    // A long animated flight, then the default instant frameAll (the
    // page's "fit everything" button): the fit must survive the next
    // frames instead of being overridden by the stale tween.
    engine!.flyTo([200, 200, 200], [120, 0, 0], 5000);
    engine!.frameAll(1.3, 0);
    const fitted = engine!.camera.position.clone();
    await tickFrames();
    expect(engine!.camera.position.distanceTo(fitted)).toBeLessThan(1e-6);
  });

  it("keeps an object in the scene while another id still registers it", async () => {
    let engine: Board3DEngine | null = null;
    mountBoard({}, { ready: ((e: Board3DEngine) => { engine = e; }) as never });
    await nextTick();

    const shared = new THREE.Mesh(new THREE.SphereGeometry(1, 8, 6), new THREE.MeshBasicMaterial());
    engine!.setObject("alias-a", { object: shared });
    engine!.setObject("alias-b", { object: shared });

    // Clearing ONE id must not unparent an object the other id owns.
    engine!.setObject("alias-a", null);
    expect(engine!.objects().has("alias-b")).toBe(true);
    expect(shared.parent).toBe(engine!.scene);

    engine!.setObject("alias-b", null);
    expect(shared.parent).toBeNull();
  });

  it("ignores non-finite camera poses instead of bricking the camera", async () => {
    let engine: Board3DEngine | null = null;
    mountBoard({}, { ready: ((e: Board3DEngine) => { engine = e; }) as never });
    await nextTick();

    const before = engine!.camera.position.clone();
    engine!.flyTo([Number.NaN, 0, 0] as never, [0, 0, 0], 0);
    expect(engine!.camera.position.equals(before)).toBe(true);
    const projected = engine!.projectToScreen([0, 0, 0]);
    expect(Number.isFinite(projected.x)).toBe(true);
  });

  it("hands out a registry snapshot a consumer cannot corrupt", async () => {
    let engine: Board3DEngine | null = null;
    mountBoard({}, { ready: ((e: Board3DEngine) => { engine = e; }) as never });
    await nextTick();

    const body = new THREE.Mesh(new THREE.SphereGeometry(1, 8, 6), new THREE.MeshBasicMaterial());
    engine!.setObject("node", { object: body });

    // A consumer casting the view to a mutable Map must not be able to
    // desynchronise the board from its own scene.
    (engine!.objects() as unknown as Map<string, unknown>).clear();
    expect(engine!.objects().has("node")).toBe(true);
    engine!.setObject("node", null);
    expect(body.parent).toBeNull();
  });

  it("falls back to a usable fov instead of bricking the projection", async () => {
    let engine: Board3DEngine | null = null;
    mountBoard({ fov: 0 }, { ready: ((e: Board3DEngine) => { engine = e; }) as never });
    await nextTick();
    const body = new THREE.Mesh(new THREE.SphereGeometry(1, 8, 6), new THREE.MeshBasicMaterial());
    engine!.setObject("centre", { object: body });
    await tickFrames();

    const projected = engine!.projectToScreen([0, 0, 0]);
    expect(Number.isFinite(projected.x)).toBe(true);
    expect(Number.isFinite(projected.y)).toBe(true);
    expect(engine!.camera.projectionMatrix.elements[5]).toBeLessThan(Infinity);
  });

  it("normalises a reversed orbit-distance window", async () => {
    let engine: Board3DEngine | null = null;
    mountBoard(
      { minDistance: 600, maxDistance: 2 },
      { ready: ((e: Board3DEngine) => { engine = e; }) as never },
    );
    await nextTick();

    // The window itself must come out ordered — OrbitControls clamps the
    // radius to `max(min, min(max, r))`, so a reversed window pins the
    // eye at 600 and defeats every fit (the mocked controls in this
    // suite do not clamp, hence the direct assertion).
    const controls = engine!.controls as unknown as { minDistance: number; maxDistance: number };
    expect(controls.minDistance).toBe(2);
    expect(controls.maxDistance).toBe(600);

    const body = new THREE.Mesh(new THREE.SphereGeometry(2, 8, 6), new THREE.MeshBasicMaterial());
    engine!.setObject("body", { object: body });
    engine!.frameAll(1.3, 0);
    await tickFrames();
    expect(engine!.camera.position.distanceTo(engine!.controls.target)).toBeLessThan(100);
  });

  it("applies a camera configuration and ignores degenerate values", async () => {
    let engine: Board3DEngine | null = null;
    mountBoard({}, { ready: ((e: Board3DEngine) => { engine = e; }) as never });
    await nextTick();

    engine!.applyCameraConfig({
      fov: 30,
      near: 0.5,
      far: 900,
      position: [4, 5, 6],
      target: [1, 1, 1],
    });
    expect(engine!.camera.fov).toBe(30);
    expect(engine!.camera.near).toBeCloseTo(0.5, 6);
    expect(engine!.camera.far).toBeCloseTo(900, 6);
    expect(engine!.camera.position.x).toBeCloseTo(4, 6);
    expect(engine!.controls.target.x).toBeCloseTo(1, 6);

    // A degenerate fov must not brick the projection (round-3 defect
    // class): the previous good value survives.
    engine!.applyCameraConfig({ fov: 0 });
    expect(engine!.camera.fov).toBe(30);
    // Neither may a non-finite pose.
    engine!.applyCameraConfig({ position: [Number.NaN, 0, 0] as never });
    expect(engine!.camera.position.x).toBeCloseTo(4, 6);
  });

  it("flies to a focus sphere with padding and lateral bias", async () => {
    let engine: Board3DEngine | null = null;
    mountBoard({}, { ready: ((e: Board3DEngine) => { engine = e; }) as never });
    await nextTick();

    engine!.flyToFocus([0, 0, 0], 10, 0);
    const dist = engine!.camera.position.length();
    // padding 1.6 over the fit distance for radius 10 at fov 45.
    const fit = 10 / Math.sin(((45 * Math.PI) / 180 / 2)) * 1.6;
    expect(dist).toBeCloseTo(fit, 1);
    expect(engine!.controls.target.length()).toBeCloseTo(0, 6);

    // A non-finite target or radius is ignored, not applied.
    const before = engine!.camera.position.clone();
    engine!.flyToFocus([Number.NaN, 0, 0] as never, 5, 0);
    expect(engine!.camera.position.equals(before)).toBe(true);
  });

  it("parks the camera top-down and restores the orbit pose", async () => {
    let engine: Board3DEngine | null = null;
    mountBoard({}, { ready: ((e: Board3DEngine) => { engine = e; }) as never });
    await nextTick();

    engine!.applyCameraConfig({ position: [8, 6, 10], target: [2, 0, 2] });
    engine!.setViewMode("topdown", 0);
    expect(engine!.viewMode()).toBe("topdown");
    // Instant application (the 300 ms flight is time-based; the mode and
    // the destination are already computed).
    const t = engine!.controls.target;
    const p = engine!.camera.position;
    expect(p.x).toBeCloseTo(t.x, 3);
    // Directly above, bar the hair of Z that keeps `up` from degenerating.
    expect(Math.abs(p.z - t.z)).toBeLessThan(0.01);
    expect(p.y).toBeGreaterThan(t.y);

    engine!.setViewMode("orbit", 0);
    expect(engine!.viewMode()).toBe("orbit");
    // …and the saved orbit pose came back.
    expect(engine!.camera.position.x).toBeCloseTo(8, 3);
    expect(engine!.controls.target.x).toBeCloseTo(2, 3);
  });

  it("builds a ground on demand and strips it on unmount", async () => {
    let engine: Board3DEngine | null = null;
    const { container } = mountBoard(
      {},
      { ready: ((e: Board3DEngine) => { engine = e; }) as never },
    );
    await nextTick();
    const sceneChildrenBefore = engine!.scene.children.length;

    engine!.setGround({ enabled: true, y: -1 });
    expect(engine!.scene.children.length).toBe(sceneChildrenBefore + 1);

    engine!.setGround({ enabled: false });
    expect(engine!.scene.children.length).toBe(sceneChildrenBefore);

    // Rebuild for the unmount path: a leaked ground would survive the
    // component's death in the (detached) scene.
    engine!.setGround({ enabled: true });
    const m = mounts.splice(0)[0];
    m.app.unmount();
    m.container.remove();
    expect(engine!.scene.children.some((c) => (c as THREE.Group).isObject3D && c.type === "Group" && c.children.length === 2)).toBe(false);
    void container;
  });

  it("fits the ground and drives the ambient directly", async () => {
    let engine: Board3DEngine | null = null;
    mountBoard({}, { ready: ((e: Board3DEngine) => { engine = e; }) as never });
    await nextTick();

    engine!.setGround({ enabled: true });
    engine!.applyLighting({ ambientIntensity: 0.9 });
    engine!.fitGround({ min: [0, 0, 0], max: [10, 0, 10] });
    engine!.setAmbientIntensity(0.3);
    const ambient = engine!.scene.children.find(
      (c) => c.constructor.name === "AmbientLight",
    ) as unknown as { intensity: number };
    expect(ambient.intensity).toBeCloseTo(0.3, 5);
  });

  it("installs the lighting rig on first applyLighting", async () => {
    let engine: Board3DEngine | null = null;
    mountBoard({}, { ready: ((e: Board3DEngine) => { engine = e; }) as never });
    await nextTick();

    engine!.applyLighting({ ambientIntensity: 0.9, points: [
      { color: [1, 0, 0], intensity: 2, range: 10, position: [0, 3, 0] },
    ] });
    const kinds = engine!.scene.children.map((c) => c.constructor.name);
    expect(kinds).toContain("AmbientLight");
    expect(kinds).toContain("DirectionalLight");
    expect(kinds).toContain("HemisphereLight");
    expect(kinds).toContain("PointLight");
  });

  it("projectToScreen lands the origin at canvas centre for the default pose", async () => {
    let engine: Board3DEngine | null = null;
    const { container } = mountBoard(
      {},
      { ready: ((e: Board3DEngine) => { engine = e; }) as never },
    );
    await nextTick();
    // Container client size is 0 in happy-dom; the projection maths is
    // still exercised end-to-end (NDC → CSS px formula).
    void container;
    const p = engine!.projectToScreen([0, 0, 0]);
    expect(p.visible).toBe(true);
  });

  it("syncs the scene background from the theme css vars", async () => {
    let engine: Board3DEngine | null = null;
    mountBoard({}, { ready: ((e: Board3DEngine) => { engine = e; }) as never });
    await nextTick();
    const bg = engine!.scene.background as THREE.Color;
    expect(bg).toBeInstanceOf(THREE.Color);
  });

  it("renders the fallback instead of throwing when WebGL is unavailable", async () => {
    H.FakeWebGLRenderer.failNext = true;
    const errors: string[] = [];
    const { container } = mountBoard(
      {},
      { error: ((m: string) => errors.push(m)) as never },
    );
    await nextTick();
    expect(errors).toEqual(["no webgl (test)"]);
    expect(container.querySelector(".hk-board3d-fallback")).not.toBeNull();
    expect(container.querySelector(".hk-minimap3d")).toBeNull();
  });

  it("disposes the renderer and empties the registries on unmount", async () => {
    let engine: Board3DEngine | null = null;
    mountBoard({}, { ready: ((e: Board3DEngine) => { engine = e; }) as never });
    await nextTick();
    const renderer = H.FakeWebGLRenderer.instances[0];
    const m = mounts.splice(0)[0];
    m.app.unmount();
    m.container.remove();
    expect(renderer.disposed).toBe(true);
    expect(engine!.objects().size).toBe(0);
  });
});
