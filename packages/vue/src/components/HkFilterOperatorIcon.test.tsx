import { afterEach, describe, expect, it } from "vitest";
import { createApp, h } from "vue";

import HkFilterOperatorIcon from "./HkFilterOperatorIcon";

const mounts: Array<{ app: ReturnType<typeof createApp>; container: HTMLElement }> = [];

function mount(op: string) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const app = createApp({ render: () => h(HkFilterOperatorIcon, { op: op as never }) });
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

/** The custom glyphs are hikari-authored SVG in lucide's stroke grammar.
 *  Pin the exact path data: the ordered four's underlines ride y=19 — the
 *  SAME optical center as lucide's Equal / EqualNot (ink y5..19). The
 *  first cut drew them at y=20 and the ≥/≤ glyphs sat visibly low against
 *  the equals family inside the 28px operator toggles (user report
 *  2026-11-08); this pin makes a revert to y=20 RED (mutation-verified:
 *  reverting both underlines failed this suite 2/2). */
describe("HkFilterOperatorIcon custom glyph geometry", () => {
  it("draws lt/gt chevrons without an underline", () => {
    const ds = (op: string) =>
      [...mount(op).querySelectorAll("svg path")].map((p) => p.getAttribute("d"));
    expect(ds("lt")).toEqual(["m19 6-11 6 11 6"]);
    expect(ds("gt")).toEqual(["m5 6 11 6-11 6"]);
  });

  it("draws the lte/gte underlines at y=19 (optically centered on y=12)", () => {
    const ds = (op: string) =>
      [...mount(op).querySelectorAll("svg path")].map((p) => p.getAttribute("d"));
    expect(ds("lte")).toEqual(["m19 5-11 6 11 6", "M8 19h11"]);
    expect(ds("gte")).toEqual(["m5 5 11 6-11 6", "M5 19h11"]);
    // Belt against the exact regression: no underline path may reach
    // y=20 — the ink band must stay y5..19 like the lucide equals pair.
    for (const d of [...ds("lte"), ...ds("gte")]) {
      expect(d).not.toMatch(/20/);
    }
  });

  it("composes napprox from the lucide wave pair + EqualNot slash", () => {
    const ds = [...mount("napprox").querySelectorAll("svg path")].map((p) =>
      p.getAttribute("d"),
    );
    expect(ds).toEqual([
      "M5 15a6.5 6.5 0 0 1 7 0 6.5 6.5 0 0 0 7 0",
      "M5 9a6.5 6.5 0 0 1 7 0 6.5 6.5 0 0 0 7 0",
      "m5 19 14-14",
    ]);
  });
});
