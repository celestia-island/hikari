import { afterEach, describe, expect, it } from "vitest";
import { createApp, defineComponent, h } from "vue";

import HkAlert from "./HkAlert";

/**
 * Component-level guard for the shared container-padding prop
 * (runtime/containerPad) on HkAlert: the `padding` prop lands the
 * `--hk-pad` custom property on the root element (inline — so it wins
 * the cascade over the base and per-size padding rules without any
 * specificity contest), and the unset prop lands nothing, leaving the
 * size's own padding in force.
 *
 * (Repo test convention: raw createApp + document queries, no
 * @vue/test-utils dependency.)
 */

const mounts: Array<{ app: ReturnType<typeof createApp>; container: HTMLElement }> = [];

function mountAlert(props: Record<string, unknown> = {}): HTMLElement {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const Wrapper = defineComponent({
    setup() {
      return () => h(HkAlert, { message: "mind the gap", ...props });
    },
  });
  const app = createApp(Wrapper);
  app.mount(container);
  mounts.push({ app, container });
  const el = container.querySelector<HTMLElement>(".hk-alert");
  expect(el, ".hk-alert renders").toBeTruthy();
  return el!;
}

afterEach(() => {
  for (const { app, container } of mounts) {
    app.unmount();
    container.remove();
  }
  mounts.length = 0;
});

describe("HkAlert padding prop", () => {
  it("unset prop lands no token — the size keeps its own padding", () => {
    const el = mountAlert({ size: "sm" });
    expect(el.style.getPropertyValue("--hk-pad")).toBe("");
  });

  it("a named step lands the token inline", () => {
    const el = mountAlert({ padding: "sm" });
    expect(el.style.getPropertyValue("--hk-pad")).toBe("var(--space-8, 0.5rem)");
  });

  it("none zeroes the padding explicitly", () => {
    const el = mountAlert({ padding: "none" });
    expect(el.style.getPropertyValue("--hk-pad")).toBe("0");
  });

  it("the token rides the ROOT, so the per-size rules all consume it", () => {
    // sm/lg carry their own padding rules; the inline token must sit
    // above them (root element), not on a nested node.
    const sm = mountAlert({ size: "sm", padding: "lg" });
    expect(sm.classList.contains("hk-alert-sm")).toBe(true);
    expect(sm.style.getPropertyValue("--hk-pad")).toBe("var(--space-16, 1rem)");
  });
});
