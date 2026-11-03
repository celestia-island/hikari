import { afterEach, describe, expect, it } from "vitest";
import { createApp, h, nextTick, type Component } from "vue";

import { HkCardList, HkListRow, hkListRowMenuItems, type HkListRowAction } from "./HkCardList";

/**
 * HkListRow's option-control array contract (pointer-client half):
 *
 * - persistent mode keeps the lane in the flow, one aria-labelled icon
 *   button per action;
 * - overlay mode (the default) parks the lane out of the flow and only
 *   the touch reveal flips [data-revealed] (pointer devices reveal via
 *   CSS :hover/:focus-within, which happy-dom cannot exercise);
 * - every action's NAME is its accessible identity — the aria-label and
 *   the menu model label (desktop tooltip / touch menu row);
 * - the menu model maps the declared actions one-to-one.
 *
 * (Repo test convention: raw createApp + document queries; happy-dom
 * has no layout engine.)
 */

const mounts: Array<{ app: ReturnType<typeof createApp>; container: HTMLElement }> = [];

afterEach(() => {
  while (mounts.length) {
    const { app, container } = mounts.pop()!;
    app.unmount();
    container.remove();
  }
});

function mount(render: () => ReturnType<typeof h>): HTMLElement {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const app = createApp({ render });
  mounts.push({ app, container });
  app.mount(container);
  return container;
}

function actionsOf(selects: Array<() => void>, over: Partial<HkListRowAction> = {}): HkListRowAction[] {
  return selects.map((onSelect, i) => ({ name: "action " + (i + 1), onSelect, ...over }));
}

/** pointerType cannot ride the Event constructor in every engine —
 *  inject it on a plain bubbling event. */
function pointerDown(target: EventTarget, pointerType: string): void {
  const ev = new Event("pointerdown", { bubbles: true, cancelable: true });
  Object.defineProperty(ev, "pointerType", { value: pointerType });
  target.dispatchEvent(ev);
}

function mountRow(props: Record<string, unknown>, trailing?: () => unknown): HTMLElement {
  return mount(() =>
    h(HkCardList, null, {
      default: () => [
        h(HkListRow, { title: "row", ...props }, trailing ? { trailing } : undefined),
      ],
    }),
  );
}

describe("HkListRow actions — persistent mode", () => {
  it("renders one named button per action and reports selection", () => {
    const picks: string[] = [];
    const container = mountRow({
      actions: [
        { name: "reinstall", onSelect: () => picks.push("reinstall"), icon: { render: () => null } as Component },
        { name: "uninstall", onSelect: () => picks.push("uninstall"), danger: true },
        { name: "disabled one", onSelect: () => picks.push("no"), disabled: true },
      ],
      actionsMode: "persistent",
      actionsLabel: "row actions",
    });
    const lane = container.querySelector(".hk-list-row-actions") as HTMLElement;
    expect(lane).toBeTruthy();
    expect(lane.classList.contains("hk-list-row-actions--persistent")).toBe(true);
    expect(lane.getAttribute("role")).toBe("toolbar");
    expect(lane.getAttribute("aria-label")).toBe("row actions");
    const buttons = Array.from(lane.querySelectorAll<HTMLButtonElement>(".hk-list-row-actions__btn"));
    expect(buttons.map((b) => b.getAttribute("aria-label"))).toEqual([
      "reinstall",
      "uninstall",
      "disabled one",
    ]);
    expect(buttons[1].hasAttribute("data-danger")).toBe(true);
    expect(buttons[2].disabled).toBe(true);
    buttons[0].click();
    buttons[1].click();
    buttons[2].click();
    expect(picks).toEqual(["reinstall", "uninstall"]);
  });
});

describe("HkListRow actions — overlay mode", () => {
  it("parks the lane out of the flow until a non-mouse pointer engages it", async () => {
    const container = mountRow({
      actions: actionsOf([() => {}]),
      actionsMode: "overlay",
    });
    const lane = () => container.querySelector(".hk-list-row-actions") as HTMLElement;
    expect(lane().classList.contains("hk-list-row-actions--overlay")).toBe(true);
    expect(lane().getAttribute("data-revealed")).toBeNull();
    const row = container.querySelector(".hk-list-row") as HTMLElement;

    // Mouse presses never reveal — pointer devices reveal through CSS
    // :hover/:focus-within, so the JS path stays silent for them.
    pointerDown(row, "mouse");
    await nextTick();
    expect(lane().getAttribute("data-revealed")).toBeNull();

    // A touch tap inside the row reveals the lane…
    pointerDown(row, "touch");
    await nextTick();
    expect(lane().getAttribute("data-revealed")).not.toBeNull();

    // …and a tap anywhere else dismisses it again.
    pointerDown(document.body, "touch");
    await nextTick();
    expect(lane().getAttribute("data-revealed")).toBeNull();
  });

  it("keeps the overlay lane focusable for keyboard users", () => {
    // Hiding is opacity/pointer-events only: visibility:hidden would
    // drop the buttons out of the tab order and strand keyboard users.
    const container = mountRow({
      actions: actionsOf([() => {}]),
      actionsMode: "overlay",
    });
    const btn = container.querySelector(".hk-list-row-actions__btn") as HTMLButtonElement;
    expect(btn).toBeTruthy();
    expect(btn.disabled).toBe(false);
  });
});

describe("hkListRowMenuItems", () => {
  it("maps every declared action onto its menu row, keyed by name", () => {
    const icon = { render: () => null } as Component;
    const items = hkListRowMenuItems([
      { name: "reinstall", onSelect: () => {}, icon },
      { name: "uninstall", onSelect: () => {}, danger: true, disabled: true },
    ]);
    expect(items).toEqual([
      { key: "reinstall", label: "reinstall", icon, danger: undefined, disabled: undefined },
      { key: "uninstall", label: "uninstall", icon: undefined, danger: true, disabled: true },
    ]);
  });
});
