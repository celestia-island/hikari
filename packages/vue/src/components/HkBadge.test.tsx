import { afterEach, describe, expect, it } from "vitest";
import { createApp, h } from "vue";
import { readFileSync } from "node:fs";
import { compile } from "sass";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import HkBadge from "./HkBadge";

const mounts: Array<{ app: ReturnType<typeof createApp>; container: HTMLElement }> = [];

function mount(renderNode: () => ReturnType<typeof h>) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const app = createApp({ render: renderNode });
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

// Vitest stubs CSS, so the runtime suite can never catch a lost rule —
// the pulse animation contract is additionally pinned by the compiled
// stylesheet guard at the bottom of this file (HkCornerBadge pattern).
describe("HkBadge pulse", () => {
  it("renders the dot and data-pulse only when both dot and pulse are set", () => {
    const container = mount(() => h(HkBadge, { dot: true, pulse: true }, () => "Creating"));
    expect(container.querySelector(".hk-badge [data-el='dot']")).toBeTruthy();
    expect(container.querySelector(".hk-badge[data-pulse]")).toBeTruthy();
  });

  it("never sets data-pulse without a dot — a pulsing pill with no dot is meaningless", () => {
    const container = mount(() => h(HkBadge, { pulse: true }, () => "Creating"));
    expect(container.querySelector(".hk-badge")).toBeTruthy();
    expect(container.querySelector("[data-pulse]")).toBeNull();
    expect(container.querySelector("[data-el='dot']")).toBeNull();
  });

  it("keeps the static dot the default — pulse is opt-in per call site", () => {
    const container = mount(() => h(HkBadge, { dot: true }, () => "Idle"));
    expect(container.querySelector(".hk-badge [data-el='dot']")).toBeTruthy();
    expect(container.querySelector("[data-pulse]")).toBeNull();
  });
});

describe("HkBadge pulse stylesheet contract", () => {
  const here = dirname(fileURLToPath(import.meta.url));
  const css = compile(resolve(here, "HkBadge.scss"), { style: "expanded" }).css;

  it("drives the pulse through the data-pulse selector on the dot only", () => {
    // Sass compiles quoted attribute selectors unquoted ([data-el=dot]).
    expect(css).toContain(".hk-badge[data-pulse] [data-el=dot]");
    // The animation must never ride the pill itself — layout stays frozen.
    expect(css.match(/\.hk-badge\s*\{[^}]*animation/)).toBeNull();
  });

  it("names the keyframes and runs them infinitely", () => {
    expect(css).toContain("@keyframes hk-badge-dot-pulse");
    expect(/\.hk-badge\[data-pulse\] \[data-el=dot\]\s*\{[^}]*animation:\s*hk-badge-dot-pulse[^;]*infinite/.test(css)).toBe(true);
  });

  it("switches the pulse off under prefers-reduced-motion", () => {
    expect(css).toMatch(/@media \(prefers-reduced-motion: reduce\)\s*\{[^@]*\.hk-badge\[data-pulse\] \[data-el=dot\]\s*\{[^}]*animation:\s*none/);
  });
});
