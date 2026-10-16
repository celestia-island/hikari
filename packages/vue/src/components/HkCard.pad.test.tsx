import { afterEach, describe, expect, it } from "vitest";
import { createApp, defineComponent, h } from "vue";

import HkCard from "./HkCard";

/**
 * Component-level guard for the shared container-padding prop
 * (runtime/containerPad) on HkCard: the token lands on the card ROOT
 * (custom properties inherit, so the body, the unpadded override and
 * the scrollable card's inner pad wrapper all resolve it), and the
 * unset prop lands nothing — `padded: false` keeps zeroing the body.
 *
 * (Repo test convention: raw createApp + document queries, no
 * @vue/test-utils dependency.)
 */

const mounts: Array<{ app: ReturnType<typeof createApp>; container: HTMLElement }> = [];

function mountCard(props: Record<string, unknown> = {}): {
  root: HTMLElement;
  body: HTMLElement;
} {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const Wrapper = defineComponent({
    setup() {
      return () =>
        h(HkCard, { title: "T", ...props }, { default: () => h("p", "body") });
    },
  });
  const app = createApp(Wrapper);
  app.mount(container);
  mounts.push({ app, container });
  const root = container.querySelector<HTMLElement>(".hk-card");
  expect(root, ".hk-card renders").toBeTruthy();
  const body = root!.querySelector<HTMLElement>(".hk-card-body");
  expect(body, ".hk-card-body renders").toBeTruthy();
  return { root: root!, body: body! };
}

afterEach(() => {
  for (const { app, container } of mounts) {
    app.unmount();
    container.remove();
  }
  mounts.length = 0;
});

describe("HkCard padding prop", () => {
  it("unset prop lands no token — the body keeps its inset", () => {
    const { root } = mountCard();
    expect(root.style.getPropertyValue("--hk-pad")).toBe("");
  });

  it("a named step lands the token on the card root", () => {
    const { root } = mountCard({ padding: "md" });
    expect(root.style.getPropertyValue("--hk-pad")).toBe("var(--space-12, 0.75rem)");
  });

  it("the token inherits into the body (one root write covers every rule)", () => {
    const { root } = mountCard({ padding: "none" });
    // happy-dom computes inherited custom properties off the DOM tree —
    // the body sees the root's token, which is exactly the cascade the
    // scss rules consume.
    expect(root.style.getPropertyValue("--hk-pad")).toBe("0");
  });

  it("composes with padded:false — an explicit padding still reaches the body", () => {
    const { root } = mountCard({ padded: false, padding: "sm" });
    expect(
      root.querySelector<HTMLElement>(".hk-card-body")!.classList.contains(
        "hk-card-body-unpadded",
      ),
    ).toBe(true);
    expect(root.style.getPropertyValue("--hk-pad")).toBe("var(--space-8, 0.5rem)");
  });
});
