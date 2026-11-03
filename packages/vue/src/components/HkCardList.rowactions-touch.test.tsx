import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { createApp, h, nextTick } from "vue";

import { HkCardList, HkListRow } from "./HkCardList";

/**
 * Touch-first clients never get hover tooltips, so the option-control
 * array swaps its inline icon lane for ONE trigger that opens the same
 * actions as a named menu. The media query is stubbed here (this file
 * runs in its own module graph — vitest isolates test files — so the
 * shared useMediaQuery registry sees the touch-first answer).
 */

beforeAll(() => {
  vi.spyOn(window, "matchMedia").mockImplementation(
    (query: string): MediaQueryList => ({
      matches: query.includes("hover: none") || query.includes("pointer: coarse"),
      media: query,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    }),
  );
});

const mounts: Array<{ app: ReturnType<typeof createApp>; container: HTMLElement }> = [];

afterEach(() => {
  while (mounts.length) {
    const { app, container } = mounts.pop()!;
    app.unmount();
    container.remove();
  }
});

const icon = { render: () => null };

it("swaps the inline lane for a named upward menu trigger", async () => {
  const picks: string[] = [];
  const container = document.createElement("div");
  document.body.appendChild(container);
  const app = createApp({
    render: () =>
      h(HkCardList, null, {
        default: () => [
          h(HkListRow, {
            title: "row",
            actionsLabel: "row actions",
            actionsMenuLabel: "more actions",
            actions: [
              { name: "reinstall", icon, onSelect: () => picks.push("reinstall") },
              { name: "uninstall", danger: true, onSelect: () => picks.push("uninstall") },
            ],
          }),
        ],
      }),
  });
  mounts.push({ app, container });
  app.mount(container);

  const lane = container.querySelector(".hk-list-row-actions") as HTMLElement;
  expect(lane.classList.contains("hk-list-row-actions--touch")).toBe(true);
  // No inline icon buttons — the names live in the menu on this client.
  expect(lane.querySelector(".hk-list-row-actions__btn")).toBeNull();
  const trigger = lane.querySelector(".hk-list-row-actions__trigger") as HTMLButtonElement;
  expect(trigger).toBeTruthy();
  expect(trigger.getAttribute("aria-haspopup")).toBe("menu");
  expect(trigger.getAttribute("aria-label")).toBe("more actions");
  expect(trigger.getAttribute("aria-expanded")).toBe("false");

  trigger.click();
  await nextTick();
  expect(trigger.getAttribute("aria-expanded")).toBe("true");
});
