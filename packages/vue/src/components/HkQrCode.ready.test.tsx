// Stage-3 wiring: when the synchronous facade throws `QrNotReadyError` (the
// component is not usable yet), HkQrCode draws again once `qrReady` resolves.
// Without that, the first paint is refused and the canvas stays blank.
//
// MUT:ready-retry-bound — this file used to spin: its mock resolved `qrReady`
// immediately while the real `qrMatrix` kept throwing (the surface had not
// loaded), so every scheduled redraw refused again and scheduled another. It
// ended in a V8 OOM that killed the worker before a single test was reported.
// Two independent fixes: the component now allows exactly one ready-retry, and
// this file waits for the real `qrReady` instead of substituting a promise that
// resolves before the surface exists.
//
// (Run from `packages/vue` — that is where vite.config.ts registers the vue /
// vueJsx plugins; from the repo root vite leaves JSX untransformed.)
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createApp, h, nextTick } from "vue";

/** An untouched canvas reports 300x150; a successful draw sets its own size. */
const UNTOUCHED_CANVAS_WIDTH = 300;

const state = { calls: 0, refused: false };

vi.mock("../utils/qr/qrEncoder", async () => {
  const actual = await vi.importActual<typeof import("../utils/qr/qrEncoder")>(
    "../utils/qr/qrEncoder",
  );
  return {
    ...actual,
    // Refuse exactly one paint with the component's own error class, then defer
    // to the real encoder — which only succeeds once the real `qrReady` has
    // settled, so the case awaits it below rather than faking readiness.
    qrMatrix: (text: string, opts?: Parameters<typeof actual.qrMatrix>[1]) => {
      state.calls += 1;
      if (state.calls === 1) {
        state.refused = true;
        throw new actual.QrNotReadyError(new Error("surface unavailable"));
      }
      return actual.qrMatrix(text, opts);
    },
  };
});

const { HkQrCode } = await import("./HkQrCode");
const { qrReady } = await import("../utils/qr/qrEncoder");

const OTPAUTH =
  "otpauth://totp/Example:langyo%40example.com?secret=JBSWY3DPEHPK3PXP&issuer=Example";

const mounts: Array<{ app: ReturnType<typeof createApp>; container: HTMLElement }> = [];

function mountQr(props: Record<string, unknown> = {}) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const app = createApp({ render: () => h(HkQrCode, props) });
  app.mount(container);
  mounts.push({ app, container });
  return container;
}

beforeEach(() => {
  state.calls = 0;
  state.refused = false;
});

afterEach(() => {
  while (mounts.length > 0) {
    const { app, container } = mounts.pop()!;
    app.unmount();
    container.remove();
  }
});

describe("HkQrCode ready re-render", () => {
  it("draws again after a refused first paint", async () => {
    // The component's retry only produces colour once the real surface exists.
    await qrReady;

    const container = mountQr({ value: OTPAUTH });
    await nextTick();
    const canvas = container.querySelector("canvas.hk-qr-canvas") as HTMLCanvasElement;
    expect(canvas).toBeTruthy();
    expect(state.refused).toBe(true); // the first paint really was refused

    // The retry is scheduled on a microtask after the refusal; give the redraw
    // room to run, bounded so a regression cannot hang the worker.
    for (let i = 0; i < 40 && canvas.width === UNTOUCHED_CANVAS_WIDTH; i++) {
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
    // MUT:canvas-size — the canvas size is the evidence that a matrix really was
    // drawn: it is the only thing a successful draw sets. Counting calls would
    // also be satisfied by two refusals (a mock that refuses twice leaves the
    // canvas at its default 300x150 and still reaches call 2).
    expect(state.calls).toBeGreaterThanOrEqual(2); // …the ready path ran again
    // …and the draw really happened: a canvas nobody drew on keeps its default.
    expect(canvas.width).not.toBe(UNTOUCHED_CANVAS_WIDTH);
    expect(canvas.width).toBe(168); // props.size (168) × dpr (1)
  });

  it("stops asking after one retry when the surface keeps refusing", async () => {
    // MUT:ready-retry-bound — without the bound this never settles: the settled
    // `qrReady` resolves immediately, the next draw refuses, and the chain
    // schedules itself forever (measured: the worker dies of OOM).
    await qrReady;

    // Every encode refuses, including the one after `qrReady` resolves.
    const actual = await vi.importActual<typeof import("../utils/qr/qrEncoder")>(
      "../utils/qr/qrEncoder",
    );
    const stub = vi
      .spyOn(actual as unknown as { qrMatrix: () => unknown }, "qrMatrix")
      .mockImplementation(() => {
        state.calls += 1;
        throw new actual.QrNotReadyError(new Error("still unavailable"));
      });
    try {
      const container = mountQr({ value: OTPAUTH });
      await nextTick();
      // Give the redraw chain ample opportunity to run away.
      for (let i = 0; i < 20; i++) await Promise.resolve();
      await new Promise((resolve) => setTimeout(resolve, 60));
      // Two attempts: the first paint, plus the single retry it was allowed.
      expect(state.calls).toBeLessThanOrEqual(3);
      expect(container.querySelector("canvas.hk-qr-canvas")).toBeTruthy();
    } finally {
      stub.mockRestore();
    }
  });
});
