import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import sass from "sass";

import { afterEach, describe, expect, it } from "vitest";
import { createApp, defineComponent, h, nextTick, ref, type App } from "vue";

import HkPaneHolder from "./HkPaneHolder";

const here = dirname(fileURLToPath(import.meta.url));

const containers: HTMLElement[] = [];

function mountHolder(active: boolean): {
  app: App;
  root: HTMLElement;
  child: HTMLElement;
  setActive: (v: boolean) => void;
} {
  const container = document.createElement("div");
  document.body.appendChild(container);
  containers.push(container);
  const isActive = ref(active);
  const Child = defineComponent({
    setup() {
      // The point of the holder: the pane's instance state SURVIVES
      // deactivation. A counter proves the component never unmounted.
      const mounts = ref(0);
      const tick = () => { mounts.value += 1; };
      return () => h("button", { type: "button", onClick: tick, "data-mounts": String(mounts.value) }, "pane");
    },
  });
  const Wrapper = defineComponent({
    render: () =>
      h(HkPaneHolder, { active: isActive.value }, { default: () => h(Child) }),
  });
  const app = createApp(Wrapper);
  app.mount(container);
  const root = container.firstElementChild as HTMLElement;
  const child = root.firstElementChild as HTMLElement;
  return { app, root, child, setActive: (v: boolean) => { isActive.value = v; } };
}

afterEach(() => {
  for (const c of containers.splice(0)) c.remove();
});

describe("HkPaneHolder — DOM contract", () => {
  it("renders the holder class and the data-active attribute only when active", async () => {
    const t = mountHolder(false);
    expect(t.root.classList.contains("hk-pane-holder")).toBe(true);
    expect(t.root.hasAttribute("data-active")).toBe(false);
    expect(t.child).toBeDefined(); // mounted, not unmounted
    t.setActive(true);
    await nextTick();
    expect(t.root.hasAttribute("data-active")).toBe(true);
    t.app.unmount();
  });

  it("keeps component state across deactivate/reactivate (the entire point)", async () => {
    const t = mountHolder(true);
    (t.child as HTMLButtonElement).click();
    (t.child as HTMLButtonElement).click();
    await new Promise((r) => setTimeout(r, 0));
    expect(t.child.getAttribute("data-mounts")).toBe("2");
    t.setActive(false);
    await new Promise((r) => setTimeout(r, 0));
    t.setActive(true);
    await new Promise((r) => setTimeout(r, 0));
    const childAfter = t.root.firstElementChild as HTMLElement;
    // Same instance: the counter did not reset to 0.
    expect(childAfter.getAttribute("data-mounts")).toBe("2");
    t.app.unmount();
  });
});

describe("HkPaneHolder — stylesheet contract", () => {
  const css = sass.compile(join(here, "HkPaneHolder.scss")).css;
  const scss = readFileSync(join(here, "HkPaneHolder.scss"), "utf-8");

  it("hides the base holder and reveals on [data-active]", () => {
    expect(css).toMatch(/\.hk-pane-holder\s*\{[^}]*display:\s*none/s);
    expect(css).toMatch(/\.hk-pane-holder\[data-active\]\s*\{[^}]*display:\s*block/s);
  });

  it("reveals with opacity only — no transform, ever", () => {
    const keyframe = /@keyframes\s+hk-pane-holder-in\s*\{([^}]*)\}/s.exec(css);
    expect(keyframe).not.toBeNull();
    expect(keyframe![1]).toContain("opacity");
    expect(keyframe![1]).not.toContain("transform");
    expect(keyframe![1]).not.toContain("translate");
  });

  it("obeys the global animation switch and reduced motion", () => {
    expect(css).toMatch(/html\[data-css-animations="0"\][^{]*\{[^}]*animation:\s*none/s);
    expect(css).toMatch(/prefers-reduced-motion[^{]*\{[^}]*animation-duration/s);
  });
});
