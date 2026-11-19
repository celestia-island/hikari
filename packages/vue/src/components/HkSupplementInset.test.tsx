import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createApp, defineComponent, h, nextTick, ref } from "vue";

import HkSupplementInset from "./HkSupplementInset";

const here = dirname(fileURLToPath(import.meta.url));

const mounts: Array<{ app: ReturnType<typeof createApp>; container: HTMLElement }> = [];

function mountInset(props: Record<string, unknown> = {}, slots?: Record<string, () => unknown>) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const Host = defineComponent({
    name: "InsetHost",
    setup() {
      return () =>
        h(
          HkSupplementInset,
          { ...props },
          slots ?? {
            default: () => h("span", { class: "probe-main" }, "main content"),
            supplement: () => h("span", { class: "probe-supplement" }, "extra"),
          },
        );
    },
  });
  const app = createApp(Host);
  app.mount(container);
  mounts.push({ app, container });
  return { container, app };
}

afterEach(() => {
  for (const { app } of mounts.splice(0)) app.unmount();
});

describe("HkSupplementInset", () => {
  it("renders main and supplement regions as siblings of one surface", () => {
    const { container } = mountInset();
    expect(container.querySelector(".hk-supplement-inset-main .probe-main")).toBeTruthy();
    expect(container.querySelector(".hk-supplement-inset-supplement-inner .probe-supplement")).toBeTruthy();
  });

  it("the controlled `revealed` prop drives data-revealed", async () => {
    const open = ref(false);
    const Host = defineComponent({
      setup() {
        return () => h(HkSupplementInset, { revealed: open.value });
      },
    });
    const container = document.createElement("div");
    document.body.appendChild(container);
    const app = createApp(Host);
    app.mount(container);
    const inset = container.querySelector<HTMLElement>(".hk-supplement-inset")!;
    expect(inset.hasAttribute("data-revealed")).toBe(false);
    open.value = true;
    await nextTick();
    expect(inset.hasAttribute("data-revealed")).toBe(true);
    app.unmount();
  });

  it("measures the supplement content into the animation width var", () => {
    const { container } = mountInset();
    const inset = container.querySelector<HTMLElement>(".hk-supplement-inset")!;
    // happy-dom measures layout as 0, so assert the var EXISTS and is a px
    // value (the ResizeObserver keeps it fresh in real browsers).
    expect(inset.style.getPropertyValue("--hk-supplement-w")).toMatch(/px$/);
  });

  it("the `closed` prop forces the supplement shut even while hovered", () => {
    // Render with BOTH data-closed and data-hover-reveal (the press-off
    // state on a surface the pointer is still over): the closed attr wins
    // in CSS — assert the attribute wiring carries it.
    const { container } = mountInset({ closed: true, revealOnHover: true });
    const inset = container.querySelector<HTMLElement>(".hk-supplement-inset")!;
    expect(inset.hasAttribute("data-closed")).toBe(true);
    expect(inset.hasAttribute("data-hover-reveal")).toBe(true);
  });

  it("omits the supplement region entirely when the slot is absent", () => {
    const { container } = mountInset({}, { default: () => h("span", "main only") });
    expect(container.querySelector(".hk-supplement-inset-supplement")).toBeNull();
  });

  it("pins the reveal grammar in the stylesheet", () => {
    const scss = readFileSync(join(here, "HkSupplementInset.scss"), "utf8");
    // At rest: no space, hidden (untabbable, out of the a11y tree).
    expect(scss).toMatch(
      /\.hk-supplement-inset-supplement\s*{[^}]*max-width:\s*0px/,
    );
    expect(scss).toMatch(
      /\.hk-supplement-inset-supplement\s*{[^}]*visibility:\s*hidden/,
    );
    // Reveal: the controlled prop, hover, and focus-within all flip it —
    // visibility flips immediately, width/opacity animate.
    expect(scss).toMatch(
      /\.hk-supplement-inset\[data-revealed\] \.hk-supplement-inset-supplement,/,
    );
    expect(scss).toMatch(
      /\.hk-supplement-inset\[data-hover-reveal\]:not\(\[data-closed\]\):hover \.hk-supplement-inset-supplement,/,
    );
    expect(scss).toMatch(
      /\.hk-supplement-inset\[data-hover-reveal\]:not\(\[data-closed\]\):focus-within \.hk-supplement-inset-supplement\s*{[^}]*visibility:\s*visible/,
    );
    // The press-off state: forced closed even under hover/focus (a touch
    // tap leaves sticky hover behind — without this the toggle-off is
    // unobservable).
    expect(scss).toMatch(
      /\.hk-supplement-inset\[data-closed\] \.hk-supplement-inset-supplement\s*{[^}]*visibility:\s*hidden/,
    );
    // The measured width: the inner must NOT be a shrinkable flex item (it
    // would measure at min-content and clamp the reveal forever).
    expect(scss).toMatch(
      /\.hk-supplement-inset-supplement-inner\s*{[^}]*\n\s*flex:\s*none;/,
    );
    expect(scss).toMatch(
      /max-width:\s*var\(--hk-supplement-w,\s*32px\)/,
    );
    // The push: the main region takes the remaining space (so it is pushed
    // left while the supplement opens).
    expect(scss).toMatch(
      /\.hk-supplement-inset-main\s*{[^}]*flex:\s*1 1 auto/,
    );
    // Animation-context control: tokens + reduced-motion instant states.
    expect(scss).toMatch(
      /transition:\s*max-width\s+var\(--duration-normal\)\s+var\(--ease-standard\)/,
    );
    expect(scss).toMatch(
      /@media \(prefers-reduced-motion: reduce\)\s*{[^}]*\.hk-supplement-inset-supplement\s*{[^}]*transition:\s*none/s,
    );
  });
});
