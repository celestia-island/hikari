import { afterEach, describe, expect, it } from "vitest";
import { createApp, h } from "vue";

import { HkAdminTablePage } from "./HkAdminTablePage";

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

const COLS = [{ key: "name", title: "Name" }];

describe("HkAdminTablePage", () => {
  it("forwards title/subtitle/dense to the page header", () => {
    const c = mount(
      h(HkAdminTablePage, {
        title: "Webhooks", subtitle: "Inbound endpoints", dense: true,
        rows: [{ name: "a" }], columns: COLS,
      }),
    );
    expect(c.querySelector(".hk-page-header-title-text")?.textContent).toBe("Webhooks");
    expect(c.querySelector(".hk-page-header-subtitle")?.textContent).toBe("Inbound endpoints");
    expect((c.querySelector(".hk-page-header") as HTMLElement).className).toContain("hk-page-header-dense");
    expect(c.querySelector("table")).toBeTruthy();
  });

  it("renders the filter slot between header and table", () => {
    const c = mount(
      h(HkAdminTablePage, {
        title: "T", rows: [{ name: "a" }], columns: COLS,
      }, {
        filter: () => h("div", { class: "probe-filter" }, "filter-chrome"),
      }),
    );
    const filter = c.querySelector(".hk-admin-table-page-filter .probe-filter");
    expect(filter).toBeTruthy();
    // filter sits above the table card, not inside it
    expect(c.querySelector(".hk-card")?.contains(filter as Node)).toBe(false);
  });

  it("staleError renders a banner while rows stay on screen", () => {
    const c = mount(
      h(HkAdminTablePage, {
        title: "T", staleError: "refresh failed", rows: [{ name: "a" }], columns: COLS,
      }),
    );
    expect(c.textContent).toContain("refresh failed");
    expect(c.querySelector("table")).toBeTruthy();
  });

  it("hard error still replaces the table", () => {
    const c = mount(
      h(HkAdminTablePage, {
        title: "T", error: "boom", rows: [], columns: COLS,
      }),
    );
    expect(c.textContent).toContain("boom");
    expect(c.querySelector("table")).toBeNull();
  });

  it("empty state carries the empty-action slot", () => {
    const c = mount(
      h(HkAdminTablePage, {
        title: "T", rows: [], columns: COLS, emptyTitle: "Nothing here",
      }, {
        "empty-action": () => h("button", { class: "probe-retry" }, "Retry"),
      }),
    );
    expect(c.querySelector(".hk-empty-state")).toBeTruthy();
    expect(c.querySelector(".probe-retry")).toBeTruthy();
  });

  it("shows the spinner while loading with no rows yet", () => {
    const c = mount(
      h(HkAdminTablePage, { title: "T", loading: true, rows: [], columns: COLS }),
    );
    expect(c.querySelector(".hk-spinner-wrapper")).toBeTruthy();
    expect(c.querySelector("table")).toBeNull();
  });
});
