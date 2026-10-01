/* The board's camera interplay with the REAL OrbitControls (r185) — the
 * main suite mocks controls wholesale, which hides exactly the behaviours
 * an externally-driven consumer (the holographic panel) depends on:
 * external pose writes surviving the per-frame controls.update(), the
 * orbit distance window clamping such poses, and the window being
 * relaxed when the board is not interactive. Only the WebGLRenderer and
 * the CSS2D renderer stay faked (no GL in happy-dom). */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createApp, defineComponent, h, nextTick } from "vue";
import * as THREE from "three";

const H = vi.hoisted(() => {
  class FakeWebGLRenderer {
    static instances: FakeWebGLRenderer[] = [];
    domElement: HTMLCanvasElement;
    shadowMap = { enabled: false };
    disposed = false;
    constructor(opts: { canvas: HTMLCanvasElement }) {
      this.domElement = opts.canvas;
      FakeWebGLRenderer.instances.push(this);
    }
    setPixelRatio(): void {}
    setSize(): void {}
    setClearColor(): void {}
    render(): void {}
    dispose(): void {
      this.disposed = true;
    }
    forceContextLoss(): void {}
  }
  return { FakeWebGLRenderer };
});

vi.mock("three", async (importOriginal) => {
  const actual = await importOriginal<typeof import("three")>();
  return { ...actual, WebGLRenderer: H.FakeWebGLRenderer };
});

vi.mock("three/examples/jsm/renderers/CSS2DRenderer.js", () => {
  class FakeCSS2DRenderer {
    domElement: HTMLElement = document.createElement("div");
    setSize(): void {}
    render(): void {}
  }
  return { CSS2DRenderer: FakeCSS2DRenderer };
});

import HkBoard3D, { type Board3DEngine } from "./HkBoard3D";

const mounts: Array<{ app: ReturnType<typeof createApp>; container: HTMLElement }> = [];

function mountBoard(
  props: Record<string, unknown>,
  onReady: (engine: Board3DEngine) => void,
) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const app = createApp(
    defineComponent({
      setup() {
        return () => h(HkBoard3D, { ...props, onReady: onReady as never });
      },
    }),
  );
  app.mount(container);
  mounts.push({ app, container });
}

async function tickFrames(): Promise<void> {
  await new Promise((r) => setTimeout(r, 60));
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

describe("HkBoard3D × real OrbitControls", () => {
  it("lets an externally driven camera pose survive the frame loop", async () => {
    let engine: Board3DEngine | null = null;
    mountBoard({ interactive: false }, (e) => (engine = e));
    await nextTick();
    await tickFrames();

    // The panel's pattern: write position+target per animation tick.
    engine!.camera.position.set(300, 120, 400);
    engine!.controls.target.set(10, 0, 5);
    engine!.controls.update();
    await tickFrames();
    expect(engine!.camera.position.x).toBeCloseTo(300, 3);
    expect(engine!.controls.target.x).toBeCloseTo(10, 3);
  });

  it("clamps an external pose into the orbit window when interactive", async () => {
    let engine: Board3DEngine | null = null;
    mountBoard({ interactive: true, minDistance: 2, maxDistance: 600 }, (e) => (engine = e));
    await nextTick();
    await tickFrames();

    engine!.camera.position.set(3000, 0, 0);
    engine!.controls.target.set(0, 0, 0);
    await tickFrames();
    expect(engine!.camera.position.length()).toBeLessThanOrEqual(601);
  });

  it("relaxes the distance window when the board is not interactive", async () => {
    let engine: Board3DEngine | null = null;
    mountBoard({ interactive: false, minDistance: 2, maxDistance: 600 }, (e) => (engine = e));
    await nextTick();
    await tickFrames();

    expect(engine!.controls.minDistance).toBe(0);
    expect(engine!.controls.maxDistance).toBe(Infinity);
    // A far pose is left alone — nothing fights the external driver.
    engine!.camera.position.set(5000, 0, 0);
    engine!.controls.target.set(0, 0, 0);
    await tickFrames();
    expect(engine!.camera.position.length()).toBeGreaterThan(4000);
  });

  it("applies a camera-configured distance window", async () => {
    let engine: Board3DEngine | null = null;
    mountBoard({ interactive: true }, (e) => (engine = e));
    await nextTick();
    engine!.applyCameraConfig({ minDistance: 10, maxDistance: 50 });
    expect(engine!.controls.minDistance).toBe(10);
    expect(engine!.controls.maxDistance).toBe(50);
    // A reversed window normalises.
    engine!.applyCameraConfig({ minDistance: 80, maxDistance: 20 });
    expect(engine!.controls.minDistance).toBe(20);
    expect(engine!.controls.maxDistance).toBe(80);
  });
});
