import { afterEach, describe, expect, it } from "vitest";
import { createApp, defineComponent, h } from "vue";

import HkEmptyState from "./HkEmptyState";

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

/* Functional icon stub rendering a node with a distinguishing class so the
   tests can assert the icon prop component actually mounted. */
const StubIcon = defineComponent({
  name: "StubIcon",
  setup() {
    return () => h("i", { class: "stub-empty-icon", "data-stub-icon": "true" });
  },
});

describe("HkEmptyState", () => {
  it("renders title and description", () => {
    const c = mount(
      h(HkEmptyState, { title: "No items", description: "Nothing here yet." }),
    );
    expect((c.querySelector(".hk-empty-title") as HTMLElement).textContent).toBe(
      "No items",
    );
    expect((c.querySelector(".hk-empty-desc") as HTMLElement).textContent).toBe(
      "Nothing here yet.",
    );
  });

  it("renders action slot content inside .hk-empty-action", () => {
    const c = mount(
      h(
        HkEmptyState,
        { title: "No items" },
        { action: () => h("button", { class: "stub-action" }, "Retry") },
      ),
    );
    const btn = c.querySelector(".hk-empty-action .stub-action") as HTMLElement;
    expect(btn).not.toBeNull();
    expect(btn.textContent).toBe("Retry");
  });

  it("renders the icon prop component in the icon well", () => {
    const c = mount(h(HkEmptyState, { title: "No items", icon: StubIcon }));
    expect(c.querySelector(".hk-empty-icon .stub-empty-icon")).not.toBeNull();
    // The prop icon replaces the default inline inbox svg.
    expect(c.querySelector(".hk-empty-icon svg polyline")).toBeNull();
  });

  it("prefers the icon slot over the icon prop", () => {
    const c = mount(
      h(
        HkEmptyState,
        { title: "No items", icon: StubIcon },
        { icon: () => h("b", { class: "slot-icon" }) },
      ),
    );
    expect(c.querySelector(".hk-empty-icon .slot-icon")).not.toBeNull();
    expect(c.querySelector(".stub-empty-icon")).toBeNull();
  });

  it("renders the default inline svg when no icon prop and no slot", () => {
    const c = mount(h(HkEmptyState, { title: "No items" }));
    expect(c.querySelector(".hk-empty-icon svg polyline")).not.toBeNull();
  });

  it("loading variant renders only a spinner with status semantics", () => {
    const c = mount(
      h(
        HkEmptyState,
        { title: "No items", description: "desc", loading: true },
        { action: () => h("button", "x") },
      ),
    );
    const root = c.querySelector(".hk-empty-state") as HTMLElement;
    expect(root.className).toContain("hk-empty-state--loading");
    expect(root.getAttribute("role")).toBe("status");
    expect(root.getAttribute("aria-busy")).toBe("true");
    expect(c.querySelector(".hk-spinner")).not.toBeNull();
    expect(c.querySelector(".hk-empty-title")).toBeNull();
    expect(c.querySelector(".hk-empty-desc")).toBeNull();
    expect(c.querySelector(".hk-empty-action")).toBeNull();
  });

  it("defaults to the page fit modifier", () => {
    const c = mount(h(HkEmptyState, { title: "x" }));
    const cls = (c.querySelector(".hk-empty-state") as HTMLElement).className;
    expect(cls).toContain("hk-empty-state--page");
    expect(cls).not.toContain("hk-empty-state--fill");
  });

  it("maps fit=fill to the fill modifier", () => {
    const c = mount(h(HkEmptyState, { title: "x", fit: "fill" }));
    const cls = (c.querySelector(".hk-empty-state") as HTMLElement).className;
    expect(cls).toContain("hk-empty-state--fill");
    expect(cls).not.toContain("hk-empty-state--page");
  });
});
