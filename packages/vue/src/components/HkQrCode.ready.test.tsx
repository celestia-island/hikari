// Stage-3 wiring: when the synchronous facade throws `QrNotReadyError` (the
// component is not usable yet), HkQrCode draws again once `qrReady` resolves.
// Without that, the first paint is refused and the canvas stays blank.
//
// (Run from `packages/vue` — that is where vite.config.ts registers the vue /
// vueJsx plugins; from the repo root vite leaves JSX untransformed.)
import { afterEach, describe, expect, it, vi } from "vitest";
import { createApp, h, nextTick } from "vue";

const state = { calls: 0, refused: false };

vi.mock("../utils/qr/qrEncoder", async () => {
  const actual = await vi.importActual<typeof import("../utils/qr/qrEncoder")>(
    "../utils/qr/qrEncoder",
  );
  // The real module throws `actual.QrNotReadyError` when the surface is not
  // usable (its construction failed). Rebuild exactly that: a first call with
  // the real error class, then the real matrix once "ready".
  // Resolve on a macrotask so the first paint (mount) is definitely refused.
  const ready = new Promise<void>((resolve) => setTimeout(resolve, 0));
  return {
    ...actual,
    qrReady: ready,
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

afterEach(() => {
  while (mounts.length > 0) {
    const { app, container } = mounts.pop()!;
    app.unmount();
    container.remove();
  }
});

describe("HkQrCode ready re-render", () => {
  it("draws again after a refused first paint", async () => {
    state.calls = 0;
    state.refused = false;
    const container = mountQr({ value: OTPAUTH });
    await nextTick();
    const canvas = container.querySelector("canvas.hk-qr-canvas") as HTMLCanvasElement;
    expect(canvas).toBeTruthy();
    expect(state.refused).toBe(true); // the first paint really was refused
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(state.calls).toBeGreaterThanOrEqual(2); // …and the ready path ran again
    expect(canvas.width).toBeGreaterThan(0); // the re-render drew it
  });
});
