import { afterEach, describe, expect, it, vi } from "vitest";
import { createApp, h, nextTick, ref } from "vue";

import { HkConnectionStatus, HK_CONNECTION_PROBE } from "./HkConnectionStatus";

/** The shell contract: WITHOUT injections the component never touches
 * the network — the fetch-poll was demoted with the chat kit (the M1
 * mutation guard: a fetch in the fallback path must go red here). */
const mounts: Array<{ app: ReturnType<typeof createApp>; container: HTMLElement }> = [];
afterEach(() => {
  for (const { app, container } of mounts.splice(0)) {
    app.unmount();
    container.remove();
  }
});

describe("HkConnectionStatus (shell)", () => {
  it("renders an inert unknown state with zero network calls", () => {
    const fetchSpy = vi.fn();
    const holder = globalThis.fetch;
    globalThis.fetch = fetchSpy;
    try {
      const container = document.createElement("div");
      document.body.appendChild(container);
      const app = createApp({ render: () => h(HkConnectionStatus, { standalone: true }) });
      app.mount(container);
      mounts.push({ app, container });
      expect(fetchSpy).not.toHaveBeenCalled();
      expect(container.textContent ?? "").not.toBeNull();
    } finally {
      globalThis.fetch = holder;
    }
  });

  it("idle pins the light to the resting gray even when the probe reports a fault", () => {
    // 2026-10-17 user direction: sessionless auth surfaces pin the light
    // to idle — "not yet logged in" is not a fault — through THIS one
    // wiring, not a hand-rolled HkStatusBar fork (the fork was what left
    // the auth popover stuck on its fetching placeholder with no
    // versions). The probe underneath reports red; the override wins.
    const probe = {
      result: ref({
        connected: false,
        state: "disconnected" as const,
        transportTier: "poll",
        tier: "poll",
        latencyMs: null,
        attemptNumber: 1,
        retryCount: 1,
        retryTotal: 3,
        countdown: 0,
      }),
      retryNow: vi.fn(),
    };
    const container = document.createElement("div");
    document.body.appendChild(container);
    const app = createApp({
      render: () =>
        h(HkConnectionStatus, { standalone: true, version: "1.2.3", idle: true, compact: true }),
    });
    app.provide(HK_CONNECTION_PROBE, probe);
    app.mount(container);
    mounts.push({ app, container });
    const dot = container.querySelector<HTMLElement>(".s-status-bar-dot")!;
    expect(dot, "light renders").toBeTruthy();
    // happy-dom drops inline styles whose value carries var() fallbacks,
    // so the gray pin rides the compact aria contract: the idle override
    // turns a faulting probe into "Ready", never "Disconnected".
    expect(container.querySelector<HTMLElement>(".s-status-bar-tag")!.getAttribute("aria-label"))
      .toBe("Ready · 1.2.3");
    // Idle is a settled resting state — clicking the gray light must not
    // fire a silent probe retry (R3 catch).
    container.querySelector<HTMLElement>(".s-status-bar-tag")!.click();
    expect(probe.retryNow).not.toHaveBeenCalled();
  });

  it("the inert shell shows a definite status with versions but no probe rows", async () => {
    // No injection: INERT_PROBE's sentinel transportTier is "unknown" —
    // it must not leak a bare "Protocol unknown" row (which has no
    // locale key in ANY language) into the popover (R3 catch). The card
    // keeps the definite status heading + the known versions only.
    const container = document.createElement("div");
    document.body.appendChild(container);
    const app = createApp({
      render: () => h(HkConnectionStatus, { standalone: false, version: "1.2.3" }),
    });
    app.mount(container);
    mounts.push({ app, container });
    await nextTick();
    container
      .querySelector<HTMLElement>(".s-status-bar-tag")!
      .dispatchEvent(new MouseEvent("mouseenter"));
    await nextTick();
    const panel = document.body.querySelector<HTMLElement>(".hk-popover-panel")!;
    expect(panel.textContent).toContain("Disconnected");
    expect(panel.textContent).toContain("1.2.3");
    expect(panel.textContent).not.toContain("Protocol");
    expect(panel.textContent).not.toContain("unknown");
  });
});
