import { afterEach, describe, expect, it } from "vitest";
import { createApp, h, nextTick } from "vue";
import { FileText, History, Network } from "lucide-vue-next";

import HkAdaptiveTabs from "./HkAdaptiveTabs";
import type { TabItem } from "./HkTabs";

/**
 * HkAdaptiveTabs behavior tests (user direction 2026-11-15):
 * - desktop arm renders the HkTabs strip and forwards picks
 * - mobile arm (<768 via window.innerWidth + resize) collapses into a
 *   trigger showing the ACTIVE item; opening it surfaces the option
 *   rows in an HkSelectPanel surface; picking emits and closes
 * - the `icon-${key}` slot vocabulary renders in BOTH arms
 * - TabItem.badge anchors the row LABEL (not a floating mark)
 * (Repo test convention: raw createApp + document queries.)
 */

const TABS: TabItem[] = [
  { key: "reports", label: "报告审阅" },
  { key: "nodes", label: "节点概览" },
  { key: "history", label: "历史记录" },
];

const mounts: Array<{ app: ReturnType<typeof createApp>; container: HTMLElement }> = [];

interface Harness {
  values: string[];
  container: HTMLElement;
}

function mountTabs(opts: {
  tabs?: TabItem[];
  slots?: Record<string, () => unknown>;
  modelValue?: string;
} = {}): Harness {
  const values: string[] = [];
  const container = document.createElement("div");
  document.body.appendChild(container);
  let current = opts.modelValue ?? "reports";
  const app = createApp({
    render: () =>
      h(HkAdaptiveTabs, {
        modelValue: current,
        tabs: opts.tabs ?? TABS,
        ariaLabel: "面板",
        "onUpdate:modelValue": (v: string) => {
          current = v;
          values.push(v);
        },
      }, opts.slots as never),
  });
  mounts.push({ app, container });
  app.mount(container);
  return { values, container };
}

async function settle() {
  await nextTick();
  await new Promise((r) => setTimeout(r, 30));
  await nextTick();
}

function setMobile(mobile: boolean) {
  (window as unknown as { innerWidth: number }).innerWidth = mobile ? 500 : 1280;
  window.dispatchEvent(new Event("resize"));
}

function strip(): HTMLElement | null {
  return document.querySelector<HTMLElement>(".hk-tabs");
}

function trigger(): HTMLButtonElement {
  return document.querySelector<HTMLButtonElement>(".hk-adaptive-tabs .hk-btn")!;
}

function optionRows(): HTMLElement[] {
  return Array.from(document.querySelectorAll<HTMLElement>(".hk-adaptive-tabs-option"));
}

afterEach(() => {
  for (const { app, container } of mounts) {
    app.unmount();
    container.remove();
  }
  mounts.length = 0;
  document.body
    .querySelectorAll(".hk-select-sheet-scrim, .hk-select-panel, .hk-popover-panel")
    .forEach((el) => el.remove());
  setMobile(false);
});

describe("desktop arm", () => {
  it("renders the HkTabs strip and forwards picks", async () => {
    const { values } = mountTabs();
    await settle();
    expect(strip()).toBeTruthy();
    const history = Array.from(document.querySelectorAll<HTMLButtonElement>(".hk-tabs button"))
      .find((b) => b.textContent?.includes("历史记录"));
    history!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await settle();
    expect(values).toEqual(["history"]);
  });

  it("renders named icon slots in the strip", async () => {
    mountTabs({ slots: { "icon-reports": () => h(FileText, { size: 14 }) } });
    await settle();
    expect(strip()?.querySelector("svg")).toBeTruthy();
  });
});

describe("mobile arm", () => {
  it("collapses into a trigger showing the ACTIVE item's label", async () => {
    setMobile(true);
    mountTabs({ modelValue: "nodes" });
    await settle();
    expect(strip()).toBeFalsy();
    expect(trigger().textContent).toContain("节点概览");
  });

  it("opening the trigger surfaces the option rows; picking emits and closes", async () => {
    setMobile(true);
    const { values } = mountTabs();
    await settle();
    trigger().dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await settle();
    const rows = optionRows();
    expect(rows).toHaveLength(3);
    const checked = rows.find((r) => r.hasAttribute("data-checked"));
    expect(checked?.textContent).toContain("报告审阅");

    rows.find((r) => r.textContent?.includes("历史记录"))!
      .dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await settle();
    expect(values).toEqual(["history"]);
    // Picking closes the popup (the surface leaves the document).
    expect(document.querySelector(".hk-adaptive-tabs-option")).toBeFalsy();
  });

  it("renders named icon slots in the sheet rows", async () => {
    setMobile(true);
    mountTabs({
      slots: {
        "icon-reports": () => h(FileText, { size: 14 }),
        "icon-nodes": () => h(Network, { size: 14 }),
        "icon-history": () => h(History, { size: 14 }),
      },
    });
    await settle();
    trigger().dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await settle();
    expect(optionRows().filter((r) => r.querySelector("svg"))).toHaveLength(3);
  });

  it("a TabItem.badge anchors the row LABEL, not a floating mark", async () => {
    setMobile(true);
    mountTabs({
      tabs: [
        { key: "a", label: "甲", badge: { count: 3, max: 9, label: "3 条" } },
        { key: "b", label: "乙" },
      ],
    });
    await settle();
    trigger().dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await settle();
    const rowWithBadge = optionRows().find((r) => r.textContent?.includes("甲"))!;
    // The badge ANCHOR wrapper holds label + mark together (placement
    // "right" = beside the label, never covering it).
    const anchor = rowWithBadge.querySelector<HTMLElement>(".hk-corner-badge-anchor")!;
    expect(anchor.textContent).toContain("甲");
    expect(anchor.querySelector(".hk-corner-badge")?.textContent).toContain("3");
    expect(anchor.querySelector(".hk-corner-badge")?.textContent).not.toContain("甲");
  });
});
