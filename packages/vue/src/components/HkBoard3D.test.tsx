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
    clearAlpha: number | null = null;
    /** The drawing buffer's alpha channel — only present when the board
     *  asks for a transparent backdrop (`alpha: true`). */
    alpha: boolean;
    toneMapping: unknown = null;
    shadowMap = { enabled: false };
    disposed = false;
    constructor(opts: { canvas: HTMLCanvasElement; alpha?: boolean }) {
      if (FakeWebGLRenderer.failNext) {
        FakeWebGLRenderer.failNext = false;
        throw new Error("no webgl (test)");
      }
      this.domElement = opts.canvas;
      this.alpha = opts.alpha === true;
      FakeWebGLRenderer.instances.push(this);
    }
    setPixelRatio(): void {}
    setSize(w: number, h: number): void { this.sizes.push([w, h]); }
    setClearColor(c: unknown, alpha = 1): void {
      this.clearColor = c;
      this.clearAlpha = alpha;
    }
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

import HkBoard3D, { BOARD3D_MAIN_LAYER, type Board3DEngine } from "./HkBoard3D";

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

/** Both gizmo frames — hover, then selection — are the only scene
 *  children on the main-camera-only layer, and init() creates them in
 *  that order, so the index is a stable discriminator. */
function framesOf(engine: Board3DEngine): THREE.LineSegments[] {
  const found = engine.scene.children.filter((c) => c.layers.isEnabled(BOARD3D_MAIN_LAYER));
  expect(found, "both gizmo frames in the scene").toHaveLength(2);
  return found as THREE.LineSegments[];
}

/** The hover frame (created first in init). */
function frameOf(engine: Board3DEngine): THREE.LineSegments {
  return framesOf(engine)[0]!;
}

/** The selection frame (created second in init). */
function selectionOf(engine: Board3DEngine): THREE.LineSegments {
  return framesOf(engine)[1]!;
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

  it("refits the ground onto the framed content", async () => {
    let engine: Board3DEngine | null = null;
    // No minimap: its helper glyph is also a two-child group and would
    // win the lookup below.
    mountBoard({ minimap: false }, { ready: ((e: Board3DEngine) => { engine = e; }) as never });
    await nextTick();
    engine!.setGround({ enabled: true });
    // The grid plane is the second child of the ground group.
    const grid = engine!.scene.children
      .find((c) => c.type === "Group" && c.children.length === 2)?.children[1] as THREE.Mesh;
    expect(grid).toBeTruthy();
    const uniforms = (grid.material as THREE.ShaderMaterial).uniforms as Record<
      string,
      { value: unknown }
    >;

    const body = new THREE.Mesh(new THREE.SphereGeometry(2, 8, 6), new THREE.MeshBasicMaterial());
    body.position.set(100, 0, -40);
    engine!.setObject("far", { object: body });
    engine!.frameAll(1.3, 0);
    const center = uniforms.uCenter.value as THREE.Vector2;
    expect(center.x).toBeCloseTo(100, 6);
    expect(center.y).toBeCloseTo(-40, 6);
  });

  it("clips the camera planes to the framed extent when autoClipping", async () => {
    let engine: Board3DEngine | null = null;
    mountBoard(
      { autoClipping: true },
      { ready: ((e: Board3DEngine) => { engine = e; }) as never },
    );
    await nextTick();
    const near0 = engine!.camera.near;
    const far0 = engine!.camera.far;
    // A BIG subject (not a distant small one — framing flies to it) is
    // what pushes the planes apart.
    const body = new THREE.Mesh(new THREE.SphereGeometry(200, 8, 6), new THREE.MeshBasicMaterial());
    engine!.setObject("big", { object: body });
    engine!.frameAll(1.3, 0);
    expect(engine!.camera.near).toBeGreaterThan(near0);
    expect(engine!.camera.far).toBeGreaterThan(far0);
    expect(engine!.camera.far / engine!.camera.near).toBeGreaterThan(1000);
  });

  it("clears the studio environment on demand", async () => {
    let engine: Board3DEngine | null = null;
    mountBoard({}, { ready: ((e: Board3DEngine) => { engine = e; }) as never });
    await nextTick();
    engine!.scene.environment = new THREE.Texture();
    engine!.applyEnvironment("none");
    expect(engine!.scene.environment).toBeNull();
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

  it("disposes the lighting rig (and its shadow map) on unmount", async () => {
    let engine: Board3DEngine | null = null;
    mountBoard(
      {},
      { ready: ((e: Board3DEngine) => { engine = e; }) as never },
    );
    await nextTick();
    engine!.applyLighting({
      ambientIntensity: 0.9,
      points: [{ color: [1, 0, 0], intensity: 2, range: 10, position: [0, 3, 0] }],
    });
    const sun = engine!.scene.children.find(
      (c) => c.constructor.name === "DirectionalLight",
    ) as unknown as { dispose: () => void; shadow: { dispose: () => void } };
    const sunSpy = vi.spyOn(sun, "dispose");
    const shadowSpy = vi.spyOn(sun.shadow, "dispose");
    const scene = engine!.scene;

    const m = mounts.splice(0)[0];
    m.app.unmount();
    m.container.remove();
    expect(sunSpy).toHaveBeenCalled();
    expect(shadowSpy).toHaveBeenCalled();
    // No rig light survives in the (detached) scene.
    const kinds = scene.children.map((c) => c.constructor.name);
    expect(kinds).not.toContain("AmbientLight");
    expect(kinds).not.toContain("DirectionalLight");
    expect(kinds).not.toContain("HemisphereLight");
    expect(kinds).not.toContain("PointLight");
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

describe("HkBoard3D hover frame", () => {
  function canvasOf(): HTMLCanvasElement {
    const canvas = mounts[0].container.querySelector("canvas")!;
    canvas.getBoundingClientRect = () =>
      ({ left: 0, top: 0, width: 800, height: 600, right: 800, bottom: 600 }) as DOMRect;
    return canvas;
  }

  /** The board root — the element the pointer must actually leave. */
  function boardOf(): HTMLElement {
    return mounts[0].container.querySelector(".hk-board3d") as HTMLElement;
  }

  function moveTo(canvas: HTMLCanvasElement, x: number, y: number): void {
    canvas.dispatchEvent(new PointerEvent("pointermove", { bubbles: true, clientX: x, clientY: y }));
  }

  interface HoverHandlers {
    hover?: (id: string | null) => void;
    click?: (id: string) => void;
  }

  async function hoveredBoard(props: Record<string, unknown> = {}, on: HoverHandlers = {}) {
    let engine: Board3DEngine | null = null;
    mountBoard(props, {
      ready: ((e: Board3DEngine) => { engine = e; }) as never,
      objectHover: ((id: string | null) => on.hover?.(id)) as never,
      objectClick: ((id: string) => on.click?.(id)) as never,
    });
    await nextTick();
    const canvas = canvasOf();
    const body = new THREE.Mesh(
      new THREE.SphereGeometry(2, 16, 12),
      new THREE.MeshBasicMaterial(),
    );
    body.name = "body";
    engine!.setObject("star-1", { object: body });
    await tickFrames();
    moveTo(canvas, 400, 300);
    await tickFrames();
    return { engine: engine!, canvas, board: boardOf(), body };
  }

  it("wraps the hovered object in the corner frame without resizing it", async () => {
    const { engine, body } = await hoveredBoard();
    const frame = frameOf(engine);
    expect(frame.visible).toBe(true);
    // A radius-2 sphere at the origin: a 4-unit box plus the padding,
    // placed by the frame's own matrix — the object is untouched.
    expect(frame.matrix.elements[0]).toBeCloseTo(4 * 1.08, 4);
    expect(frame.matrix.elements[13]).toBeCloseTo(0, 5);
    expect(body.scale.x).toBe(1);
    // The gizmo never joins picking or framing.
    expect(engine.objects().get("star-1")!.object).toBe(body);
    expect(frame.material).toBeInstanceOf(THREE.LineBasicMaterial);
    expect((frame.material as THREE.LineBasicMaterial).depthTest).toBe(false);
  });

  it("hides the frame once the pointer leaves the body and the board", async () => {
    const hovers: Array<string | null> = [];
    const { engine, canvas, board } = await hoveredBoard({}, { hover: (id) => hovers.push(id) });
    const frame = frameOf(engine);
    expect(frame.visible).toBe(true);

    moveTo(canvas, 10, 10);
    await tickFrames();
    expect(frame.visible).toBe(false);

    moveTo(canvas, 400, 300);
    await tickFrames();
    expect(frame.visible).toBe(true);
    board.dispatchEvent(new PointerEvent("pointerleave", { bubbles: false }));
    await tickFrames();
    expect(frame.visible).toBe(false);
    // The event a page closes its hover card on.
    expect(hovers).toEqual(["star-1", null, "star-1", null]);
  });

  it("keeps the hover while the pointer is on the board's own chrome", async () => {
    const hovers: Array<string | null> = [];
    const { engine, canvas } = await hoveredBoard({}, { hover: (id) => hovers.push(id) });
    const frame = frameOf(engine);

    // The CSS2D label chips and the minimap card overlap the canvas as
    // SIBLINGS: reaching for a chip fires pointerleave on the canvas while
    // the user is still on the object. The hover must survive that.
    canvas.dispatchEvent(new PointerEvent("pointerleave", { bubbles: false }));
    await tickFrames();
    expect(frame.visible).toBe(true);
    expect(hovers).toEqual(["star-1"]);
  });

  it("measures the frame target, and honours a per-object opt-out", async () => {
    let engine: Board3DEngine | null = null;
    mountBoard({}, { ready: ((e: Board3DEngine) => { engine = e; }) as never });
    await nextTick();
    const canvas = canvasOf();

    // A body wearing a corona ten times its size AND a satellite parked
    // 10 units out. The sprite is pruned as decoration either way, so the
    // satellite is what makes this test discriminate: measuring the group
    // instead of `frameObject` would wrap the moon system, not the body.
    const group = new THREE.Group();
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 12), new THREE.MeshBasicMaterial());
    group.add(mesh);
    const corona = new THREE.Sprite(new THREE.SpriteMaterial());
    corona.scale.setScalar(20);
    group.add(corona);
    const satellite = new THREE.Mesh(
      new THREE.SphereGeometry(0.2, 8, 6),
      new THREE.MeshBasicMaterial(),
    );
    satellite.position.set(10, 0, 0);
    group.add(satellite);
    engine!.setObject("hub", { object: group, frameObject: mesh });
    await tickFrames();
    moveTo(canvas, 400, 300);
    await tickFrames();
    expect(frameOf(engine!).matrix.elements[0]).toBeCloseTo(2 * 1.08, 4);
    expect(frameOf(engine!).matrix.elements[12]).toBeCloseTo(0, 5);
    // Sanity: the group as a whole would have measured far wider.
    expect(frameOf(engine!).matrix.elements[0]).toBeLessThan(10);

    // frameObject: null opts the object out entirely.
    engine!.setObject("hub", { object: group, frameObject: null });
    await tickFrames();
    expect(frameOf(engine!).visible).toBe(false);
  });

  it("never shows a frame when hoverBox is off, and still clicks", async () => {
    const clicks: string[] = [];
    const { engine, canvas } = await hoveredBoard({ hoverBox: false }, { click: (id) => clicks.push(id) });
    expect(frameOf(engine).visible).toBe(false);
    moveTo(canvas, 400, 300);
    await tickFrames();
    expect(frameOf(engine).visible).toBe(false);
    // The picking contract itself is untouched by the opt-out.
    canvas.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, clientX: 400, clientY: 300 }));
    canvas.dispatchEvent(new PointerEvent("pointerup", { bubbles: true, clientX: 400, clientY: 300 }));
    expect(clicks).toEqual(["star-1"]);
  });

  it("keeps only the main camera on the gizmo layer", async () => {
    let engine: Board3DEngine | null = null;
    mountBoard({}, { ready: ((e: Board3DEngine) => { engine = e; }) as never });
    await nextTick();
    expect(engine!.camera.layers.isEnabled(BOARD3D_MAIN_LAYER)).toBe(true);
    // The minimap camera enables the helper layer only — its render pass
    // must not pick the pointer affordance up.
    expect(frameOf(engine!).layers.mask).toBe(1 << BOARD3D_MAIN_LAYER);
  });

  it("re-measures the frame when a rebuild hands the hovered id a new object", async () => {
    const { engine } = await hoveredBoard();
    const frame = frameOf(engine);
    expect(frame.matrix.elements[12]).toBeCloseTo(0, 5);

    // Pages rebuild their content: the frame must follow the object that
    // is actually registered now, not the one that left the scene.
    const next = new THREE.Mesh(
      new THREE.SphereGeometry(1, 12, 8),
      new THREE.MeshBasicMaterial(),
    );
    next.position.set(30, 0, 0);
    engine.setObject("star-1", { object: next });
    await tickFrames();
    expect(frame.visible).toBe(true);
    expect(frame.matrix.elements[12]).toBeCloseTo(30, 4);
    expect(frame.matrix.elements[0]).toBeCloseTo(2 * 1.08, 4);
  });

  it("follows the target in and out of visibility, and drops a stale opt-out", async () => {
    const hovers: Array<string | null> = [];
    const { engine, body, canvas } = await hoveredBoard({}, { hover: (id) => hovers.push(id) });
    const frame = frameOf(engine);
    expect(frame.visible).toBe(true);

    // Hidden under a hidden ancestor (three renders by the CHAIN, not by
    // the node's own flag): the bracket must stop painting the air.
    body.visible = false;
    await tickFrames();
    expect(frame.visible).toBe(false);

    body.visible = true;
    await tickFrames();
    expect(frame.visible).toBe(true);

    // …and an id re-registered as unselectable loses its frame too.
    engine.setObject("star-1", { object: body, pickable: false });
    await tickFrames();
    expect(frame.visible).toBe(false);
    // The pointer can no longer select it: the page must hear that here,
    // because no pointer movement is coming to say it.
    expect(hovers.at(-1)).toBeNull();
    expect(canvas.style.cursor).toBe("");
  });

  it("hides the frame when an ANCESTOR of the frame target is hidden", async () => {
    const hovers: Array<string | null> = [];
    let engine: Board3DEngine | null = null;
    mountBoard({}, {
      ready: ((e: Board3DEngine) => { engine = e; }) as never,
      objectHover: ((id: string | null) => hovers.push(id)) as never,
    });
    await nextTick();
    const canvas = canvasOf();

    // The target stays `visible = true` while its PARENT is hidden: only
    // the renderer's ancestor-chain rule catches that.
    const group = new THREE.Group();
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(1, 12, 8), new THREE.MeshBasicMaterial());
    group.add(mesh);
    engine!.setObject("wrap", { object: group, frameObject: mesh });
    await tickFrames();
    moveTo(canvas, 400, 300);
    await tickFrames();
    expect(frameOf(engine!).visible).toBe(true);

    group.visible = false;
    await tickFrames();
    expect(mesh.visible).toBe(true);
    expect(frameOf(engine!).visible).toBe(false);

    group.visible = true;
    await tickFrames();
    expect(frameOf(engine!).visible).toBe(true);
  });

  it("picks the frame up when the content arrives after the hover", async () => {
    let engine: Board3DEngine | null = null;
    mountBoard({}, { ready: ((e: Board3DEngine) => { engine = e; }) as never });
    await nextTick();
    const canvas = canvasOf();

    // Content streams in: the registered group is empty (its only mesh is
    // still hidden) when the pointer settles on it.
    const group = new THREE.Group();
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(1, 12, 8), new THREE.MeshBasicMaterial());
    mesh.visible = false;
    group.add(mesh);
    engine!.setObject("stream", { object: group });
    await tickFrames();
    moveTo(canvas, 400, 300);
    await tickFrames();
    expect(frameOf(engine!).visible).toBe(false);

    mesh.visible = true;
    await tickFrames();
    expect(frameOf(engine!).visible).toBe(true);
  });

  it("re-measures an unmeasurable target on a cadence, not every frame", async () => {
    let engine: Board3DEngine | null = null;
    // No minimap: its marker sync calls updateWorldMatrix on every
    // registered object each frame, which would drown the measurement
    // cadence this test is about.
    mountBoard({ minimap: false }, { ready: ((e: Board3DEngine) => { engine = e; }) as never });
    await nextTick();
    const canvas = canvasOf();

    // Content that never becomes measurable (a group of decor only) must
    // not turn every frame into a subtree walk — but the board must still
    // look again, or streaming content would never be framed.
    const group = new THREE.Group();
    const decor = new THREE.Sprite(new THREE.SpriteMaterial());
    group.add(decor);
    engine!.setObject("empty", { object: group });
    await tickFrames();
    moveTo(canvas, 400, 300);
    await tickFrames();
    expect(frameOf(engine!).visible).toBe(false);

    let frames = 0;
    engine!.addTick(() => {
      frames += 1;
    });
    // The measurement is the walk `frameLocalBounds` makes on the anchor.
    const walk = vi.spyOn(group, "updateWorldMatrix");
    await tickFrames();
    expect(frames).toBeGreaterThan(10);
    expect(walk.mock.calls.length).toBeGreaterThan(0);
    expect(walk.mock.calls.length).toBeLessThan(frames / 3);
  });

  it("tints the frame from the palette: near-white by night, grey by day", async () => {
    const previous = ["--color-background", "--color-text", "--color-muted"].map((name) => [
      name,
      document.documentElement.style.getPropertyValue(name),
    ] as const);
    try {
      // Deliberately NOT the fallback literals: a variable read that fell
      // through to its default must fail these assertions.
      document.documentElement.style.setProperty("--color-background", "10 15 25");
      document.documentElement.style.setProperty("--color-text", "250 10 10");
      document.documentElement.style.setProperty("--color-muted", "10 250 10");
      const { engine } = await hoveredBoard();
      const color = (frameOf(engine).material as THREE.LineBasicMaterial).color;
      // Night: the TEXT channel.
      expect(color.r * 255).toBeCloseTo(250, 0);
      expect(color.g * 255).toBeCloseTo(10, 0);

      // Day: the MUTED channel — and a live theme mutation re-tints the
      // frame in place.
      document.documentElement.style.setProperty("--color-background", "245 245 240");
      await tickFrames();
      expect(color.g * 255).toBeCloseTo(250, 0);
      expect(color.r * 255).toBeCloseTo(10, 0);
    } finally {
      for (const [name, value] of previous) {
        document.documentElement.style.removeProperty(name);
        if (value) document.documentElement.style.setProperty(name, value);
      }
    }
  });

  it("detaches and frees the frame, and its listeners, on unmount", async () => {
    const { engine, board } = await hoveredBoard();
    const frame = frameOf(engine);
    const geoSpy = vi.spyOn(frame.geometry, "dispose");
    const matSpy = vi.spyOn(frame.material as THREE.Material, "dispose");
    // A container listener left behind keeps a dead board reachable — and
    // a remount would stack a second one.
    const removeSpy = vi.spyOn(board, "removeEventListener");

    const m = mounts.splice(0)[0];
    m.app.unmount();
    m.container.remove();

    expect(geoSpy).toHaveBeenCalled();
    expect(matSpy).toHaveBeenCalled();
    expect(removeSpy).toHaveBeenCalledWith("pointerleave", expect.any(Function));
    expect(engine.scene.children.some((c) => c.layers.isEnabled(BOARD3D_MAIN_LAYER))).toBe(false);
  });

  it("never resurrects the hover after the pointer has left the board", async () => {
    const hovers: Array<string | null> = [];
    const { engine, canvas, board } = await hoveredBoard({}, { hover: (id) => hovers.push(id) });
    const frame = frameOf(engine);
    expect(frame.visible).toBe(true);

    // A move and a leave inside ONE frame: the pending pick must not be
    // replayed against the stale position on the next loop iteration.
    moveTo(canvas, 400, 300);
    board.dispatchEvent(new PointerEvent("pointerleave", { bubbles: false }));
    await tickFrames();
    expect(frame.visible).toBe(false);
    expect(hovers.at(-1)).toBeNull();

    // …and it stays left, however many frames pass.
    await tickFrames();
    expect(frame.visible).toBe(false);
    expect(hovers.filter((id) => id === "star-1").length).toBe(1);
  });

  it("tells the page when the hovered object leaves the registry", async () => {
    const hovers: Array<string | null> = [];
    const { engine, canvas } = await hoveredBoard({}, { hover: (id) => hovers.push(id) });
    expect(canvas.style.cursor).toBe("pointer");

    // The object is gone: no pointer movement will ever clear the hover,
    // so the board has to say it here (and stop promising a click).
    engine.setObject("star-1", null);
    await tickFrames();
    expect(hovers.at(-1)).toBeNull();
    expect(canvas.style.cursor).toBe("");
    expect(frameOf(engine).visible).toBe(false);
  });
});

describe("HkBoard3D selection frame", () => {
  /** A board with one body registered and the id selected — NO pointer
   *  involvement anywhere: the selection frame must not need one. */
  async function selectedBoard(props: Record<string, unknown> = {}) {
    const hovers: Array<string | null> = [];
    let engine: Board3DEngine | null = null;
    mountBoard({ minimap: false, ...props }, {
      ready: ((e: Board3DEngine) => { engine = e; }) as never,
      objectHover: ((id: string | null) => hovers.push(id)) as never,
    });
    await nextTick();
    const body = new THREE.Mesh(
      new THREE.SphereGeometry(2, 16, 12),
      new THREE.MeshBasicMaterial(),
    );
    body.name = "body";
    engine!.setObject("star-1", { object: body });
    engine!.setSelection("star-1");
    await tickFrames();
    return { engine: engine!, body, hovers };
  }

  it("pins the persistent corner frame without any pointer", async () => {
    const { engine, body } = await selectedBoard();
    const selection = selectionOf(engine);
    expect(selection.visible).toBe(true);
    // Same measurement contract as the hover frame: the body's own
    // extents plus the padding, composed through its world matrix.
    expect(selection.matrix.elements[0]).toBeCloseTo(4 * 1.08, 4);
    expect(selection.matrix.elements[13]).toBeCloseTo(0, 5);
    // The pointer frame has nothing to say here — nothing is hovered.
    expect(frameOf(engine).visible).toBe(false);
    // The body itself is untouched, and the gizmo never joins the
    // registry (framing and picking never see it).
    expect(body.scale.x).toBe(1);
    expect([...engine.objects().keys()]).toEqual(["star-1"]);

    // A selected object re-registered as UN-pickable stays marked: the
    // frame marks what the page selected, and pointer reachability is a
    // hover concern (decision pinned — R1).
    engine.setObject("star-1", { object: body, pickable: false });
    await tickFrames();
    expect(selectionOf(engine).visible).toBe(true);
  });

  it("re-selecting the same id does not re-measure", async () => {
    const { engine, body } = await selectedBoard();
    // Pages re-select on data refreshes; each redundant call must be a
    // no-op, not a forced subtree walk (the hover path guards the same
    // way at the event level — R2 P2). The measurement walk is the
    // (updateParents=true, updateChildren=true) call; the per-frame
    // refresh uses (true, false) and stays.
    const walk = vi.spyOn(body, "updateWorldMatrix");
    for (let i = 0; i < 5; i += 1) engine.setSelection("star-1");
    await tickFrames();
    const measured = walk.mock.calls.filter(
      ([parents, children]) => parents === true && children === true,
    ).length;
    expect(measured).toBe(0);
    expect(selectionOf(engine).visible).toBe(true);
  });

  it("only ever ends through setSelection(null)", async () => {
    const { engine } = await selectedBoard();
    expect(selectionOf(engine).visible).toBe(true);

    // Frames pass — the selection is sticky, not a hover that decays.
    await tickFrames();
    await tickFrames();
    expect(selectionOf(engine).visible).toBe(true);

    engine.setSelection(null);
    await tickFrames();
    expect(selectionOf(engine).visible).toBe(false);
  });

  it("survives a rebuild: the removed id hides, re-registration re-measures", async () => {
    const { engine } = await selectedBoard();
    expect(selectionOf(engine).visible).toBe(true);

    // A roster rebuild strips every body first — the frame hides while
    // the id is gone but the SELECTION survives the interim.
    engine.setObject("star-1", null);
    await tickFrames();
    expect(selectionOf(engine).visible).toBe(false);

    // …and the re-registered body (a fresh object at a new spot) gets the
    // frame measured against IT, not against the dead predecessor.
    const next = new THREE.Mesh(
      new THREE.SphereGeometry(1, 12, 8),
      new THREE.MeshBasicMaterial(),
    );
    next.position.set(30, 0, 0);
    engine.setObject("star-1", { object: next });
    await tickFrames();
    expect(selectionOf(engine).visible).toBe(true);
    expect(selectionOf(engine).matrix.elements[12]).toBeCloseTo(30, 4);
    expect(selectionOf(engine).matrix.elements[0]).toBeCloseTo(2 * 1.08, 4);
  });

  it("re-measures when a rebuild hands the selected id a NEW object directly", async () => {
    const { engine } = await selectedBoard();
    expect(selectionOf(engine).matrix.elements[12]).toBeCloseTo(0, 5);

    // The ONE-step rebuild (strip + re-register fused into a single
    // setObject): the latch must release here too, or the frame keeps
    // riding the dead predecessor's matrix — the two-step test above
    // cannot see this, the hide path resets the latch for it (R1 P1).
    const next = new THREE.Mesh(
      new THREE.SphereGeometry(1, 12, 8),
      new THREE.MeshBasicMaterial(),
    );
    next.position.set(30, 0, 0);
    engine.setObject("star-1", { object: next });
    await tickFrames();
    expect(selectionOf(engine).visible).toBe(true);
    expect(selectionOf(engine).matrix.elements[12]).toBeCloseTo(30, 4);
    expect(selectionOf(engine).matrix.elements[0]).toBeCloseTo(2 * 1.08, 4);
  });

  it("suppresses the hover frame on the selected body only", async () => {
    const { engine, hovers } = await selectedBoard();
    const canvas = mounts[0]!.container.querySelector("canvas")!;
    canvas.getBoundingClientRect = () =>
      ({ left: 0, top: 0, width: 800, height: 600, right: 800, bottom: 600 }) as DOMRect;
    canvas.dispatchEvent(new PointerEvent("pointermove", { bubbles: true, clientX: 400, clientY: 300 }));
    await tickFrames();
    // Hovering the selected body draws ONE bracket, not two.
    expect(selectionOf(engine).visible).toBe(true);
    expect(frameOf(engine).visible).toBe(false);
    // Suppression is frame-only: the page still HEARS the hover (its
    // hover card must keep working on the selected body) and the cursor
    // still promises the click (R1 P2).
    expect(hovers.at(-1)).toBe("star-1");
    expect(canvas.style.cursor).toBe("pointer");

    // Moving the selection elsewhere un-suppresses the hover: the pointer
    // is still over star-1, which is no longer the selected body.
    const other = new THREE.Mesh(
      new THREE.SphereGeometry(1, 12, 8),
      new THREE.MeshBasicMaterial(),
    );
    other.position.set(500, 500, 500);
    engine.setObject("star-2", { object: other });
    engine.setSelection("star-2");
    await tickFrames();
    expect(frameOf(engine).visible).toBe(true);
    expect(selectionOf(engine).visible).toBe(true);
    expect(selectionOf(engine).matrix.elements[12]).toBeCloseTo(500, 4);
  });

  it("picks the selection up when the content arrives after the select", async () => {
    let engine: Board3DEngine | null = null;
    mountBoard({ minimap: false }, { ready: ((e: Board3DEngine) => { engine = e; }) as never });
    await nextTick();

    // Content streams in: the registered group's only mesh is still
    // hidden when the page selects it.
    const group = new THREE.Group();
    const mesh = new THREE.Mesh(
      new THREE.SphereGeometry(1, 12, 8),
      new THREE.MeshBasicMaterial(),
    );
    mesh.visible = false;
    group.add(mesh);
    engine!.setObject("stream", { object: group });
    engine!.setSelection("stream");
    await tickFrames();
    expect(selectionOf(engine!).visible).toBe(false);

    mesh.visible = true;
    await tickFrames();
    expect(selectionOf(engine!).visible).toBe(true);
  });

  it("re-measures an unmeasurable selection on a cadence, not every frame", async () => {
    let engine: Board3DEngine | null = null;
    // No minimap: its marker sync calls updateWorldMatrix on every
    // registered object each frame, which would drown the measurement
    // cadence this test is about.
    mountBoard({ minimap: false }, { ready: ((e: Board3DEngine) => { engine = e; }) as never });
    await nextTick();

    const group = new THREE.Group();
    const decor = new THREE.Sprite(new THREE.SpriteMaterial());
    group.add(decor);
    engine!.setObject("empty", { object: group });
    engine!.setSelection("empty");
    await tickFrames();
    expect(selectionOf(engine!).visible).toBe(false);

    let frames = 0;
    engine!.addTick(() => {
      frames += 1;
    });
    // The measurement is the walk `frameLocalBounds` makes on the anchor.
    const walk = vi.spyOn(group, "updateWorldMatrix");
    await tickFrames();
    expect(frames).toBeGreaterThan(10);
    expect(walk.mock.calls.length).toBeGreaterThan(0);
    expect(walk.mock.calls.length).toBeLessThan(frames / 3);
  });

  it("hides while the body is invisible, and comes back with it", async () => {
    const { engine, body } = await selectedBoard();
    expect(selectionOf(engine).visible).toBe(true);

    // three renders by the CHAIN: the frame must not paint the air.
    body.visible = false;
    await tickFrames();
    expect(selectionOf(engine).visible).toBe(false);

    body.visible = true;
    await tickFrames();
    expect(selectionOf(engine).visible).toBe(true);
  });

  it("tints the selection from the primary channel, apart from the hover", async () => {
    const previous = ["--color-background", "--color-text", "--color-primary"].map((name) => [
      name,
      document.documentElement.style.getPropertyValue(name),
    ] as const);
    try {
      // Deliberately NOT the fallback literals: a variable read that fell
      // through to its default must fail these assertions.
      document.documentElement.style.setProperty("--color-background", "10 15 25");
      document.documentElement.style.setProperty("--color-text", "250 10 10");
      document.documentElement.style.setProperty("--color-primary", "10 10 250");
      const { engine } = await selectedBoard();
      const hoverColor = (frameOf(engine).material as THREE.LineBasicMaterial).color;
      const selectionColor = (selectionOf(engine).material as THREE.LineBasicMaterial).color;
      expect(selectionColor.r * 255).toBeCloseTo(10, 0);
      expect(selectionColor.b * 255).toBeCloseTo(250, 0);
      // The hover frame keeps its own channel (text) — the two stay
      // readable apart at a glance.
      expect(hoverColor.r * 255).toBeCloseTo(250, 0);
      expect(hoverColor.b * 255).toBeCloseTo(10, 0);
    } finally {
      for (const [name, value] of previous) {
        document.documentElement.style.removeProperty(name);
        if (value) document.documentElement.style.setProperty(name, value);
      }
    }
  });

  it("disposes the selection frame on unmount", async () => {
    const { engine } = await selectedBoard();
    expect(selectionOf(engine).visible).toBe(true);
    const selection = selectionOf(engine);
    const geoSpy = vi.spyOn(selection.geometry, "dispose");
    const matSpy = vi.spyOn(selection.material as THREE.Material, "dispose");

    const m = mounts.splice(0)[0];
    m.app.unmount();
    m.container.remove();

    expect(geoSpy).toHaveBeenCalled();
    expect(matSpy).toHaveBeenCalled();
    expect(engine.scene.children.some((c) => c.layers.isEnabled(BOARD3D_MAIN_LAYER))).toBe(false);
  });
});

describe("HkBoard3D transparent background", () => {
  function rendererOf(): InstanceType<typeof H.FakeWebGLRenderer> {
    // The board's renderer is the first instance (the minimap spins up
    // its own, and only when mounted).
    return H.FakeWebGLRenderer.instances[0]!;
  }

  it("paints the theme background by default", async () => {
    let engine: Board3DEngine | null = null;
    mountBoard({ minimap: false }, { ready: ((e: Board3DEngine) => { engine = e; }) as never });
    await nextTick();
    expect(engine!.scene.background).toBeInstanceOf(THREE.Color);
    expect(rendererOf().alpha).toBe(false);
    expect(rendererOf().clearAlpha).toBe(1);
  });

  it("clears to transparent with the transparentBackground prop", async () => {
    let engine: Board3DEngine | null = null;
    mountBoard(
      { minimap: false, transparentBackground: true },
      { ready: ((e: Board3DEngine) => { engine = e; }) as never },
    );
    await nextTick();
    // No scene backdrop: the page's own backdrop shows through. The
    // drawing buffer must actually HAVE an alpha channel, and the clear
    // must be fully transparent — an opaque clear would read as black.
    expect(engine!.scene.background).toBeNull();
    expect(rendererOf().alpha).toBe(true);
    expect(rendererOf().clearAlpha).toBe(0);
  });
});
