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

  it("renders the body slot instead of the table card when provided", () => {
    const c = mount(
      h(HkAdminTablePage, {
        title: "T", rows: [{ name: "a" }], columns: COLS,
      }, {
        body: () => h("div", { class: "probe-roster" }, "card-list rows"),
      }),
    );
    expect(c.querySelector(".hk-admin-table-page-body .probe-roster")?.textContent).toBe("card-list rows");
    // the default table path is fully replaced
    expect(c.querySelector("table")).toBeNull();
    // header/empty scaffolding still applies around the body
    expect(c.querySelector(".hk-page-header-title-text")?.textContent).toBe("T");
  });

  it("suppresses the stale banner when a hard error replaces the body", () => {
    const c = mount(
      h(HkAdminTablePage, {
        title: "T", staleError: "stale", error: "hard", rows: [], columns: COLS,
      }),
    );
    expect(c.textContent).toContain("hard");
    expect(c.textContent).not.toContain("stale");
  });

  it("shows the spinner while loading with no rows yet", () => {
    const c = mount(
      h(HkAdminTablePage, { title: "T", loading: true, rows: [], columns: COLS }),
    );
    expect(c.querySelector(".hk-spinner-wrapper")).toBeTruthy();
    expect(c.querySelector("table")).toBeNull();
  });

  it("manageable renders the ⋯ column and forwards manage(row, opener)", () => {
    const got: Array<[Record<string, unknown>, HTMLElement]> = [];
    const rows = [{ id: "r1", name: "alpha" }];
    const c = mount(
      h(HkAdminTablePage, {
        title: "T",
        rows,
        columns: COLS,
        rowKey: "id",
        manageable: true,
        onManage: (row: Record<string, unknown>, opener: HTMLElement) =>
          got.push([row, opener]),
      }),
    );
    expect(c.querySelectorAll("thead th")).toHaveLength(COLS.length + 1);
    const btn = c.querySelector(".hk-table-manage-cell button") as HTMLButtonElement;
    expect(btn).not.toBeNull();
    btn.click();
    expect(got).toHaveLength(1);
    expect(got[0]![0]).toBe(rows[0]);
    expect(got[0]![1]).toBe(btn);
  });

  it("renders the count readout in the header, preferring the declared total", () => {
    // User direction 2026-11-08: every standard list names its size —
    // the scaffold owns the "N in total" wording so pages stop
    // hand-rolling their own count spans.
    const c = mount(
      h(HkAdminTablePage, {
        title: "T",
        rows: Array.from({ length: 12 }, (_, i) => ({ name: `r${i}` })),
        columns: COLS,
        total: 500,
      }),
    );
    const readout = c.querySelector('[data-testid="hk-admin-table-page-count"]');
    expect(readout).not.toBeNull();
    expect(readout!.textContent).toBe("500 in total");
  });

  it("falls back to the delivered row count when no total is declared", () => {
    const c = mount(
      h(HkAdminTablePage, { title: "T", rows: [{ name: "a" }, { name: "b" }], columns: COLS }),
    );
    expect(c.querySelector('[data-testid="hk-admin-table-page-count"]')!.textContent).toBe("2 in total");
  });

  it("hides the readout on an empty list and honors countReadout:false", () => {
    const empty = mount(h(HkAdminTablePage, { title: "T", rows: [], columns: COLS }));
    expect(empty.querySelector('[data-testid="hk-admin-table-page-count"]')).toBeNull();
    const optedOut = mount(
      h(HkAdminTablePage, { title: "T", rows: [{ name: "a" }], columns: COLS, countReadout: false }),
    );
    expect(optedOut.querySelector('[data-testid="hk-admin-table-page-count"]')).toBeNull();
  });

  it("renders the readout beside page actions, rightmost", () => {
    const slots = { actions: () => h("button", { class: "page-action" }, "Do") };
    const c = mount(
      h(HkAdminTablePage, { title: "T", rows: [{ name: "a" }], columns: COLS }, slots),
    );
    const header = c.querySelector(".hk-page-header")!;
    expect(header.querySelector("button.page-action")).not.toBeNull();
    // The count span trails the page's own actions inside the header row.
    const actions = header.querySelector(".hk-page-header-actions") ?? header;
    expect(actions.textContent).toContain("1 in total");
  });

  it("keeps the headerless actions band for a bare readout", () => {
    // No title: the band is the readout's only host — one slim right
    // aligned row, never a second stacked header (安全扫描 report,
    // 2026-11-08).
    const c = mount(
      h(HkAdminTablePage, { rows: [{ name: "a" }], columns: COLS }),
    );
    const readout = c.querySelector('[data-testid="hk-admin-table-page-count"]');
    expect(readout).not.toBeNull();
    expect(readout!.textContent).toBe("1 in total");
  });
});
