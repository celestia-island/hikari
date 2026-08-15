import { afterEach, describe, expect, it } from "vitest";
import { createApp, h } from "vue";

import { HkPageHeader } from "./HkPageHeader";

const mounts: Array<{ app: ReturnType<typeof createApp>; container: HTMLElement }> = [];

function mountHeader(
  props: { title: string; subtitle?: string; dense?: boolean },
  slots?: Record<string, () => ReturnType<typeof h>>,
) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const app = createApp({
    render: () => h(HkPageHeader, props, slots),
  });
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

describe("HkPageHeader", () => {
  it("renders the title and the actions slot on opposite sides", () => {
    const c = mountHeader(
      { title: "Channels" },
      { actions: () => h("button", { class: "tool-mock" }, "TOOL") },
    );
    expect(c.querySelector(".hk-page-header-title-text")?.textContent).toBe("Channels");
    const actions = c.querySelector(".hk-page-header-actions");
    expect(actions).toBeTruthy();
    expect(actions?.querySelector(".tool-mock")).toBeTruthy();
    // The title block precedes the actions row as siblings.
    expect(c.querySelector(".hk-page-header-main")?.nextElementSibling)
      .toBe(actions);
  });

  it("renders an optional subtitle under the title", () => {
    const c = mountHeader({ title: "Agents", subtitle: "Manage agent runtimes" });
    expect(c.querySelector(".hk-page-header-subtitle")?.textContent).toBe(
      "Manage agent runtimes",
    );
  });

  it("omits the subtitle node and the actions row when not provided", () => {
    const c = mountHeader({ title: "System" });
    expect(c.querySelector(".hk-page-header-subtitle")).toBeNull();
    expect(c.querySelector(".hk-page-header-actions")).toBeNull();
  });

  it("carries the dense variant class only when dense is set", () => {
    const plain = mountHeader({ title: "A" });
    const dense = mountHeader({ title: "A", dense: true });
    expect(plain.querySelector(".hk-page-header")?.className).not.toContain(
      "hk-page-header-dense",
    );
    expect(dense.querySelector(".hk-page-header")?.className).toContain(
      "hk-page-header-dense",
    );
  });
});
