import { afterEach, describe, expect, it } from "vitest";
import { createApp, h } from "vue";

import { HkAdminTablePage, HkTable, type HkTableSection, type HkTableRow } from "../index";

/**
 * The L38 row-typing contract. The old `rows: Record<string, unknown>[]`
 * forced every interface-typed row array through a downstream assertion
 * bridge (chest: 43 `tableRows(...)` sites); `rows: readonly HkTableRow[]`
 * (object) accepts interfaces structurally. These pins hold both halves:
 *
 * - TYPE level (enforced by `pnpm build`, which typechecks this file): an
 *   interface row array — the exact shape that needed a bridge before —
 *   assigns to `rows` and to `HkTableSection.rows` with NO cast anywhere in
 *   this file; a `Record<string, unknown>[]` (the legacy bridge output)
 *   still assigns (existing call sites keep compiling).
 * - RUNTIME level: interface rows render their column values through the
 *   internal `as Record` confinement casts (two, one per pipeline entry),
 *   and the row objects reaching cell slots are the consumer's own
 *   instances (reference identity — what chest's downstream
 *   `tableRows(arr) === arr` pin protects) is preserved by a copy-per-sort
 *   pipeline that never clones on input.
 *
 * (Repo test convention: raw createApp + document queries, no
 * @vue/test-utils.)
 */

/** The bridge-needing shape: an interface (NO implicit index signature). */
interface PanelRow {
  id: string;
  label: string;
  count: number;
}

const PANEL_COLUMNS = [
  { key: "label", title: "Label" },
  { key: "count", title: "Count" },
];

const mounts: Array<{ app: ReturnType<typeof createApp>; container: HTMLElement }> = [];

afterEach(() => {
  while (mounts.length) {
    const { app, container } = mounts.pop()!;
    app.unmount();
    container.remove();
  }
});

function mountRows(rows: readonly HkTableRow[], sections?: HkTableSection[]): HTMLElement {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const app = createApp({
    render: () => h(HkTable, { columns: PANEL_COLUMNS, rows, sections }),
  });
  app.mount(container);
  mounts.push({ app, container });
  return container;
}

describe("HkTable row typing (L38)", () => {
  it("accepts interface-typed rows without any bridge (type level pinned by vue-tsc on this file)", () => {
    // No cast: this exact array needed `tableRows(rows)` before L38.
    const rows: PanelRow[] = [
      { id: "a", label: "Alpha", count: 2 },
      { id: "b", label: "Beta", count: 5 },
    ];
    const container = mountRows(rows);
    expect(container.textContent).toContain("Alpha");
    expect(container.textContent).toContain("Beta");
    expect(container.textContent).toContain("5");
  });

  it("accepts interface-typed sections the same way (R3 M2 pin: the rows must be interface-typed ARRAYS, not inline literals)", () => {
    // Inline section-row literals carry implicit index signatures and stay
    // assignable to the OLD Record type too — this pin routes declared
    // `PanelRow[]` consts through `sections` so reverting the widening in
    // HkTableSection fails THIS file's compile (R3 mutation M2 survived
    // the first version of this test for exactly that reason).
    const oneRows: PanelRow[] = [{ id: "a", label: "Alpha", count: 1 }];
    const twoRows: PanelRow[] = [{ id: "b", label: "Beta", count: 7 }];
    const sections: HkTableSection[] = [
      { key: "one", label: "One", rows: oneRows },
      { key: "two", label: "Two", rows: twoRows },
    ];
    const container = mountRows([], sections);
    expect(container.textContent).toContain("One");
    expect(container.textContent).toContain("Two");
    expect(container.textContent).toContain("Alpha");
    expect(container.textContent).toContain("7");
  });

  it("keeps accepting legacy Record-typed rows (existing bridge outputs stay assignable)", () => {
    const legacy: Record<string, unknown>[] = [{ id: "x", label: "Legacy", count: 9 }];
    const container = mountRows(legacy);
    expect(container.textContent).toContain("Legacy");
    expect(container.textContent).toContain("9");
  });

  it("HkTableRow is the object family root (interfaces and Records both count)", () => {
    const rows: HkTableRow[] = [
      { id: "i", label: "Interface", count: 0 } satisfies PanelRow,
      { id: "r", label: "Record", count: 0 } as Record<string, unknown>,
    ];
    expect(rows.length).toBe(2);
  });

  it("cell slots receive the consumer's own row instances (reference identity through the confinement casts)", () => {
    // The slot fn's param is CONSUMER-annotated (chest's AvatarSourcesCard
    // pattern); HkTable deliberately declares no slots type, so the
    // annotation faces no contravariance constraint. The row objects ride
    // the pipeline's copy-per-sort arrays BY REFERENCE — sorting copies the
    // array, never the rows.
    const seen: PanelRow[] = [];
    const rows: PanelRow[] = [{ id: "a", label: "Alpha", count: 3 }];
    const container = document.createElement("div");
    document.body.appendChild(container);
    const app = createApp({
      render: () =>
        h(
          HkTable,
          { columns: PANEL_COLUMNS, rows },
          {
            "cell-count": ({ row, index }: { row: PanelRow; value: unknown; index: number }) => {
              seen.push(row);
              return h("span", {}, `${row.count}x@${index}`);
            },
          },
        ),
    });
    app.mount(container);
    mounts.push({ app, container });
    expect(container.textContent).toContain("Alpha");
    expect(container.textContent).toContain("3x@0");
    expect(seen[0]).toBe(rows[0]);
  });

  it("HkAdminTablePage accepts interface rows too (R5 S2 pin — it forwards rows verbatim to HkTable)", () => {
    // HkAdminTablePage only reads `.length` and forwards `rows={props.rows}`
    // to the widened HkTable, so its own prop must be the SAME family or
    // every chest site routed through it keeps needing the bridge
    // (MyTasksView-style: `interface UserTask` rows). Declared const, not
    // an inline literal, so reverting THIS prop to Record fails the compile.
    const pageRows: PanelRow[] = [
      { id: "a", label: "PageAlpha", count: 4 },
      { id: "b", label: "PageBeta", count: 6 },
    ];
    const container = document.createElement("div");
    document.body.appendChild(container);
    const app = createApp({
      render: () =>
        h(HkAdminTablePage, {
          title: "Panels",
          columns: PANEL_COLUMNS,
          rows: pageRows,
          rowKey: "id",
        }),
    });
    app.mount(container);
    mounts.push({ app, container });
    expect(container.textContent).toContain("PageAlpha");
    expect(container.textContent).toContain("6");
  });
});
