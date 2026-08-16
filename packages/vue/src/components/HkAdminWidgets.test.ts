import { afterEach, describe, expect, it } from "vitest";
import { createApp, h } from "vue";

import { HkStatCard } from "./HkStatCard";
import { HkStatusPill } from "./HkStatusPill";
import { HkShareBar } from "./HkShareBar";

const mounts: Array<{ app: ReturnType<typeof createApp>; container: HTMLElement }> = [];

function mount(node: ReturnType<typeof h>) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const app = createApp({ render: () => node });
  app.mount(container);
  mounts.push({ app, container });
  return container;
}

afterEach(() => {
  for (const { app, container } of mounts.splice(0)) {
    app.unmount();
    container.remove();
  }
});

describe("HkStatCard", () => {
  it("renders label, value, hint and a tone dot", () => {
    const c = mount(h(HkStatCard, { label: "Hub health", value: "2/2", tone: "success", hint: "hubs" }));
    expect(c.querySelector(".hk-stat-card-label")?.textContent).toBe("Hub health");
    expect(c.querySelector(".hk-stat-card-value")?.textContent).toBe("2/2");
    expect(c.querySelector(".hk-stat-card-hint")?.textContent).toBe("hubs");
    expect(c.querySelector(".hk-stat-card-dot-success")).toBeTruthy();
    expect(c.querySelector(".hk-stat-card-clickable")).toBeNull();
  });

  it("marks clickable cards and emits role=button", () => {
    const c = mount(h(HkStatCard, { label: "L", value: 1, clickable: true }));
    const el = c.querySelector(".hk-stat-card") as HTMLElement;
    expect(el.getAttribute("role")).toBe("button");
    expect(el.className).toContain("hk-stat-card-clickable");
  });

  it("omits the hint node when absent", () => {
    const c = mount(h(HkStatCard, { label: "L", value: 1 }));
    expect(c.querySelector(".hk-stat-card-hint")).toBeNull();
  });
});

describe("HkStatusPill", () => {
  it("renders state dot with label, latency and version", () => {
    const c = mount(h(HkStatusPill, { state: "ok", label: "online", latencyMs: 34, version: "0.2.0" }));
    expect(c.querySelector(".hk-status-pill-ok")).toBeTruthy();
    expect(c.querySelector(".hk-status-pill-label")?.textContent).toBe("online");
    expect(c.querySelector(".hk-status-pill-latency")?.textContent).toBe("34 ms");
    expect(c.querySelector(".hk-status-pill-version")?.textContent).toBe("0.2.0");
  });

  it("defaults to unknown state with no extras", () => {
    const c = mount(h(HkStatusPill));
    expect(c.querySelector(".hk-status-pill-unknown")).toBeTruthy();
    expect(c.querySelector(".hk-status-pill-latency")).toBeNull();
    expect(c.querySelector(".hk-status-pill-version")).toBeNull();
  });
});

describe("HkShareBar", () => {
  it("computes percent from value/total and clamps to 100", () => {
    const c = mount(h(HkShareBar, { label: "a", value: 25, total: 100 }));
    const fill = c.querySelector(".hk-share-bar-fill") as HTMLElement;
    expect(fill.style.width).toBe("25%");

    const over = mount(h(HkShareBar, { label: "b", value: 300, total: 100 }));
    const fill2 = over.querySelector(".hk-share-bar-fill") as HTMLElement;
    expect(fill2.style.width).toBe("100%");
  });

  it("renders zero-width for zero totals and honors captions", () => {
    const c = mount(h(HkShareBar, { label: "a", value: 5, total: 0, caption: "5 tok" }));
    const fill = c.querySelector(".hk-share-bar-fill") as HTMLElement;
    expect(fill.style.width).toBe("0%");
    expect(c.querySelector(".hk-share-bar-caption")?.textContent).toBe("5 tok");
  });

  it("applies the percent override", () => {
    const c = mount(h(HkShareBar, { label: "a", value: 1, total: 100, percentOverride: 60 }));
    const fill = c.querySelector(".hk-share-bar-fill") as HTMLElement;
    expect(fill.style.width).toBe("60%");
  });
});
