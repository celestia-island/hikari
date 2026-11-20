import { afterEach, describe, expect, it, vi } from "vitest";
import { createApp, h, nextTick } from "vue";

/**
 * The overlay-scrollbar ATTACH TARGET (2026-11-20 review, mutation M5).
 *
 * The bell owns the desktop flyout's overlay scrollbar because the list
 * keeps native overflow MECHANICS while painting no native bar
 * (`scrollbar-width: none`) — without the engine the list scrolls
 * invisibly (user report 2026-11-19). The engine binds a `scroll`
 * listener and reads/writes `scrollTop` on the element it is given, so
 * attaching to anything but the SCROLLER (the `ul`) yields a thumb bound
 * to a dead target: opening the panel still passes the other test (the
 * tracks render inside the wrap either way), yet tall lists scroll
 * invisibly again.
 *
 * That regression survived the whole behaviour suite, so this file pins
 * the argument itself: the first attach call must receive the list
 * element, with the wrap still riding as the track host.
 *
 * (Repo test convention: raw createApp + document queries, no
 * @vue/test-utils dependency.)
 */

const attachSpy = vi.fn();

vi.mock("../composables/useOverlayScrollbar", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../composables/useOverlayScrollbar")>();
  return {
    ...actual,
    attachOverlayScrollbars: (el: HTMLElement, opts?: { axis?: string; host?: HTMLElement }) => {
      attachSpy(el, opts);
      return actual.attachOverlayScrollbars(el, opts as never);
    },
  };
});

const { default: HkNotificationBell } = await import("./HkNotificationBell");
const { recordNotification, resetNotifications } = await import("../runtime/notificationCenter");
const { setLocale } = await import("../i18n/context");

const mounts: Array<{ app: ReturnType<typeof createApp>; container: HTMLElement }> = [];

function mountBell() {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const app = createApp({ render: () => h(HkNotificationBell) });
  mounts.push({ app, container });
  app.mount(container);
  return container;
}

async function settle() {
  await nextTick();
  await new Promise((r) => setTimeout(r, 80));
  await nextTick();
}

afterEach(() => {
  for (const { app, container } of mounts.splice(0)) {
    app.unmount();
    container.remove();
  }
  document.body
    .querySelectorAll(".hk-popover-scrim, .hk-popover-panel")
    .forEach((el) => el.remove());
  resetNotifications();
  attachSpy.mockClear();
});

describe("bell overlay scrollbar wiring", () => {
  it("attaches to the scrolling list, with the wrap as the track host", async () => {
    await setLocale("en");
    for (let i = 0; i < 12; i++) {
      recordNotification({ id: `t:${i}`, kind: "toast", tone: "error", title: `row ${i}` });
    }
    mountBell();
    await settle();
    document
      .querySelector<HTMLButtonElement>(".hk-notification-bell .hk-icon-button")!
      .dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await settle();

    expect(attachSpy, "the engine was attached").toHaveBeenCalled();
    const [target, opts] = attachSpy.mock.calls[0];
    // The SCROLLER, not the wrapper: the wrapper merely wraps the viewport
    // and never scrolls — binding the thumb there is the invisible-scroll
    // regression this pin exists for.
    const list = document.querySelector(".hk-notification-center__list")!;
    const wrap = document.querySelector(".hk-notification-center__list-wrap")!;
    expect(target).toBe(list);
    expect((target as HTMLElement).classList.contains("hk-notification-center__list")).toBe(true);
    expect(target).not.toBe(wrap);
    expect(opts?.host ?? null).toBe(wrap);
  });

  it("keeps ONE engine handle across journal changes on the open panel", async () => {
    // The list stays mounted now (the entry/exit choreography needs it), so
    // the engine must be armed once per open and UPDATED as content moves —
    // a second attach per record would leak a listener set per row.
    await setLocale("en");
    mountBell();
    await settle();
    const bell = () =>
      document.querySelector<HTMLButtonElement>(".hk-notification-bell .hk-icon-button")!;
    bell().dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await settle();
    expect(attachSpy, "the open panel arms the engine even when row-less").toHaveBeenCalledTimes(1);
    const list = document.querySelector(".hk-notification-center__list");
    expect(attachSpy.mock.calls[0][0]).toBe(list);

    recordNotification({ id: "late", kind: "toast", tone: "error", title: "late arrival" });
    await settle();
    expect(attachSpy, "content changes update the handle, never re-arm it").toHaveBeenCalledTimes(1);
    expect(attachSpy.mock.calls[0][0]).toBe(document.querySelector(".hk-notification-center__list"));

    // A close/open cycle re-arms against the CURRENT element.
    bell().dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await settle();
    bell().dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await settle();
    expect(attachSpy).toHaveBeenCalledTimes(2);
    expect(attachSpy.mock.calls[1][0]).toBe(
      document.querySelector(".hk-notification-center__list"),
    );
  });
});
