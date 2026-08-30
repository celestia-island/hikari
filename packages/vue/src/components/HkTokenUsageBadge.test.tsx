import { afterEach, describe, expect, it } from "vitest";
import { createApp, h } from "vue";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { HkTokenUsageBadge } from "./HkTokenUsageBadge";

const mounts: Array<{ app: ReturnType<typeof createApp>; container: HTMLElement }> = [];

/** Mount with a reactive render closure so controlled updates flow back. */
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

describe("HkTokenUsageBadge", () => {
  it("renders input and output stats in order with the direction arrows", () => {
    const c = mount(() => h(HkTokenUsageBadge, { input: 197200, output: 38900 }));
    const stats = c.querySelectorAll(".s-token-usage-stat");
    expect(stats.length).toBe(2);
    expect(stats[0]!.querySelector(".s-token-usage-arrow")?.getAttribute("data-direction")).toBe("in");
    expect(stats[1]!.querySelector(".s-token-usage-arrow")?.getAttribute("data-direction")).toBe("out");
    expect(c.querySelector(".s-token-usage")!.getAttribute("data-fixed")).toBeNull();
  });

  it("marks the stable-width variant via data-fixed", () => {
    const c = mount(() => h(HkTokenUsageBadge, { input: 1, output: 2, fixed: true }));
    expect(c.querySelector(".s-token-usage")!.hasAttribute("data-fixed")).toBe(true);
  });

  it("never caps the fixed variant below its content width", () => {
    // Source contract (the shittim-chest cruise lane defect): the fixed
    // variant is a 100px FLOOR with a max-content width, not a hard
    // 100px cap. A hard cap is narrower than two 6-character values
    // ("197.2k" / "38.9k" plus arrows and the inter-stat gap ≈ 112px);
    // the invisible spill extended every scrollable ancestor's
    // scrollWidth and grew a native horizontal scrollbar inside the
    // cruise lane label card.
    const here = dirname(fileURLToPath(import.meta.url));
    const scss = readFileSync(join(here, "HkTokenUsageBadge.scss"), "utf-8");
    const fixed = scss.match(/&\[data-fixed\]\s*{[^}]*}/)?.[0] ?? "";
    expect(fixed).not.toBe("");
    expect(fixed).toContain("min-width: 100px");
    expect(fixed).toContain("width: max-content");
    expect(fixed).not.toMatch(/(^|[^-])width:\s*100px/);
  });
});
