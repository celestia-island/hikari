import { afterEach, describe, expect, it, vi } from "vitest";
import { createApp, h, nextTick, ref } from "vue";

import { HkStatusBar } from "./HkStatusBar";
import type { HkConnectionInfo } from "./HkConnectionInfo";

const mounts: Array<{ app: ReturnType<typeof createApp>; container: HTMLElement }> = [];

function mountBar(props: Record<string, unknown> = {}) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const app = createApp({ render: () => h(HkStatusBar, props) });
  app.mount(container);
  mounts.push({ app, container });
  return container;
}

/** Mount with a reactive connectionStatus the test can drive through
 *  state transitions (the fixed-props mountBar cannot re-render). */
type BarStatus = "connected" | "disconnected" | "connecting" | "reconnecting";

function mountReactiveStatus(initial: BarStatus) {
  const status = ref(initial);
  const container = document.createElement("div");
  document.body.appendChild(container);
  const app = createApp({
    render: () =>
      h(HkStatusBar, {
        version: "1.2.3",
        connectionStatus: status.value,
        connectionInfo: INFO,
      }),
  });
  app.mount(container);
  mounts.push({ app, container });
  return { container, status };
}

function tagOf(container: HTMLElement) {
  return container.querySelector<HTMLElement>(".s-status-bar-tag")!;
}

const INFO: HkConnectionInfo = {
  state: "connected",
  tier: "poll",
  quality: "good",
  latencyMs: 42,
  isLocalhost: false,
  region: "US",
  retryCount: 0,
  maxRetries: 3,
  asn: null,
  attemptNumber: 1,
  countdown: 0,
};

afterEach(() => {
  for (const { app, container } of mounts.splice(0)) {
    app.unmount();
    container.remove();
  }
  document.body.innerHTML = "";
});

describe("HkStatusBar", () => {
  it("renders extraDetails rows capped at 400px with an ellipsized, title-backed value", async () => {
    const container = mountBar({
      version: "1.2.3",
      connectionStatus: "connected",
      connectionInfo: INFO,
      extraDetails: [
        { key: "gateway", label: "Gateway", value: "gateway.celestia.world" },
      ],
    });
    await nextTick();
    // Popover content teleports to <body> and only renders once the tag
    // is hovered open (same grammar as the protocol/network rows).
    const tag = container.querySelector<HTMLElement>(".s-status-bar-tag")!;
    tag.dispatchEvent(new MouseEvent("mouseenter"));
    await nextTick();
    const panel = document.body.querySelector<HTMLElement>(".hk-popover-panel");
    expect(panel, "popover opens on hover").toBeTruthy();
    const row = panel!.querySelector('[data-extra-detail="gateway"]');
    expect(row).not.toBeNull();
    expect((row as HTMLElement).style.maxWidth).toBe("400px");
    const value = panel!.querySelector("span[title]") as HTMLElement;
    expect(value.textContent).toBe("gateway.celestia.world");
    expect(value.title).toBe("gateway.celestia.world");
    expect(value.style.textOverflow).toBe("ellipsis");
    // The label column keeps a minimum width — a long value must not
    // squeeze it (the row space-between-aligns instead).
    const label = row!.querySelector("span[style*='min-width'], span:nth-child(2)") as HTMLElement;
    expect(label.style.minWidth).toBe("72px");
    expect(label.style.flexShrink).toBe("0");
  });

  it("renders no extraDetails rows when the prop is absent", async () => {
    const container = mountBar({
      version: "1.2.3",
      connectionStatus: "connected",
      connectionInfo: INFO,
    });
    await nextTick();
    container
      .querySelector<HTMLElement>(".s-status-bar-tag")!
      .dispatchEvent(new MouseEvent("mouseenter"));
    await nextTick();
    const panel = document.body.querySelector(".hk-popover-panel");
    expect(panel?.querySelector("[data-extra-detail]")).toBeNull();
  });

  it("mounts with the traffic light and version rows inline, protocol row on hover-open", async () => {
    const container = mountBar({
      version: "1.2.3",
      engineVersion: "9.8.7",
      connectionStatus: "connected",
      connectionInfo: INFO,
      transportTier: "poll",
    });
    await nextTick();

    const tag = container.querySelector<HTMLElement>(".s-status-bar-tag")!;
    expect(tag, "status tag renders").toBeTruthy();
    expect(container.querySelector(".s-status-bar-dot"), "traffic-light dot renders").toBeTruthy();
    // Full mode: the panel/engine version rows ride inline in the tag.
    expect(container.querySelectorAll(".s-status-bar-version").length).toBe(2);
    expect(tag.textContent).toContain("1.2.3");
    expect(tag.textContent).toContain("9.8.7");
    expect(tag.hasAttribute("data-compact")).toBe(false);

    // Hover the tag open: the protocol row lives in the popover content,
    // teleported to <body> inside the HPopover panel.
    tag.dispatchEvent(new MouseEvent("mouseenter"));
    await nextTick();
    const panel = document.body.querySelector<HTMLElement>(".hk-popover-panel");
    expect(panel, "popover opens on hover").toBeTruthy();
    expect(panel!.textContent).toContain("Protocol");
    expect(panel!.textContent).toContain("HTTP poll");
  });

  it("compact mode collapses the tag to the bare dot with no inline status text", async () => {
    const container = mountBar({
      version: "1.2.3",
      engineVersion: "9.8.7",
      connectionStatus: "connected",
      connectionInfo: INFO,
      compact: true,
    });
    await nextTick();

    const tag = container.querySelector<HTMLElement>(".s-status-bar-tag")!;
    expect(tag.getAttribute("data-compact")).toBe("true");
    // Standing user directive: mobile shows ONLY the traffic light — no
    // translated connection state ("Connected"/"已连接"/…) renders next to
    // the dot in compact mode. The state rides the aria-label, and the
    // full status stays reachable through the tap popover.
    const inlineLabel = tag.querySelector<HTMLElement>(".s-status-bar-tag-label");
    // The only tag-label left in the tag is the CSS-hidden "Panel" row of
    // the version block — its text must NOT be a connection state.
    expect(inlineLabel?.textContent).not.toMatch(/connected|connecting|disconnected/i);
    // The dot itself renders.
    expect(tag.querySelector(".s-status-bar-dot"), "traffic-light dot renders").toBeTruthy();
    // The version rows leave the visible pill: they are hidden inline by
    // the [data-compact] CSS (styles/admin-tokens.scss) and the versions
    // ride the aria-label for assistive tech instead.
    expect(tag.getAttribute("aria-label")).toBe("Connected · 1.2.3 · 9.8.7");
  });

  it("a touch tap on a disconnected light fires onRetry exactly once and opens the popover", async () => {
    const onRetry = vi.fn();
    const container = mountBar({
      version: "1.2.3",
      connectionStatus: "disconnected",
      connectionInfo: INFO,
      compact: true,
      onRetry,
    });
    await nextTick();
    const tag = container.querySelector<HTMLElement>(".s-status-bar-tag")!;

    // Simulated one-finger tap without any synthesized mouse events —
    // the degenerate case this fix exists for (browsers dropping the
    // click half of the synthesis around mid-gesture DOM mutations).
    const touch = { clientX: 12, clientY: 700 } as Touch;
    const tap = () => {
      tag.dispatchEvent(Object.assign(new Event("touchstart", { bubbles: true, cancelable: true }), {
        touches: [touch],
      }));
      return Object.assign(new Event("touchend", { bubbles: true, cancelable: true }), {
        touches: [],
        changedTouches: [touch],
      });
    };
    const endEvent = tap();
    const preventDefault = vi.spyOn(endEvent, "preventDefault");
    tag.dispatchEvent(endEvent);
    await nextTick();

    expect(onRetry, "tap retriggers the reconnect").toHaveBeenCalledTimes(1);
    expect(preventDefault, "synthesized mouse chain is suppressed").toHaveBeenCalled();
    // The popover opens so the tap gets visible feedback instead of a
    // seemingly dead dot; touch-opened popovers dismiss outside.
    const panel = document.body.querySelector<HTMLElement>(".hk-popover-panel");
    expect(panel, "popover opens for feedback").toBeTruthy();
    expect(panel!.textContent).toContain("Protocol");

    // A late synthetic click slipping through the suppression must not
    // double-fire within the dedup window.
    tag.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(onRetry).toHaveBeenCalledTimes(1);

    // A second tap toggles the popover closed WITHOUT another retry.
    tag.dispatchEvent(tap());
    await nextTick();
    expect(onRetry).toHaveBeenCalledTimes(1);
    // Machine era: in no-transition environments (happy-dom's computed
    // durations read 0) the close settles on the microtask queue — the
    // rAF-era lingering leave window is gone. Assert the dismissal
    // completed: the panel unmounted, exactly one retry ever fired.
    await new Promise((resolve) => setTimeout(resolve, 0));
    await nextTick();
    expect(document.body.querySelector(".hk-popover-panel")).toBeNull();
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it("a scroll-like touch ending over the tag does not retry", async () => {
    const onRetry = vi.fn();
    const container = mountBar({
      version: "1.2.3",
      connectionStatus: "disconnected",
      connectionInfo: INFO,
      compact: true,
      onRetry,
    });
    await nextTick();
    const tag = container.querySelector<HTMLElement>(".s-status-bar-tag")!;
    const start = { clientX: 12, clientY: 400 } as Touch;
    tag.dispatchEvent(Object.assign(new Event("touchstart", { bubbles: true, cancelable: true }), {
      touches: [start],
    }));
    tag.dispatchEvent(Object.assign(new Event("touchend", { bubbles: true, cancelable: true }), {
      touches: [],
      changedTouches: [{ clientX: 14, clientY: 610 } as Touch],
    }));
    await nextTick();
    expect(onRetry, "flick is not a tap").not.toHaveBeenCalled();
    expect(document.body.querySelector(".hk-popover-panel")).toBeNull();
  });

  it("stays quiet on the first connect: no recovery class on open", async () => {
    vi.useFakeTimers();
    try {
      // The page-open sequence: connecting → connected for the first
      // time in this component's life. No flash — the pill goes green
      // without announcing itself (hosts used to toast here).
      const { container, status } = mountReactiveStatus("connecting");
      await nextTick();
      expect(tagOf(container).className).toContain("s-status-bar-tag-reconnecting");
      status.value = "connected";
      await nextTick();
      expect(tagOf(container).className).not.toContain("s-status-bar-tag-recovered");
      vi.advanceTimersByTime(1500);
      await nextTick();
      expect(tagOf(container).className).not.toContain("s-status-bar-tag-recovered");
    } finally {
      vi.useRealTimers();
    }
  });

  it("flashes the background once when a dropped connection recovers", async () => {
    vi.useFakeTimers();
    try {
      // Mounted while connected (established), drops, then recovers:
      // the recovering class rides the pill for the flash window and
      // is gone after it.
      const { container, status } = mountReactiveStatus("connected");
      await nextTick();
      status.value = "reconnecting";
      await nextTick();
      expect(tagOf(container).className).toContain("s-status-bar-tag-reconnecting");
      status.value = "connected";
      await nextTick();
      expect(tagOf(container).className).toContain("s-status-bar-tag-recovered");
      // Mid-window (t=600ms): the class must still ride the pill — the JS
      // window (1200ms) has to outlive the 1.1s CSS animation, or the class
      // would truncate the decay's tail and snap to the resting color.
      vi.advanceTimersByTime(600);
      await nextTick();
      expect(tagOf(container).className).toContain("s-status-bar-tag-recovered");
      vi.advanceTimersByTime(700);
      await nextTick();
      expect(tagOf(container).className).not.toContain("s-status-bar-tag-recovered");
    } finally {
      vi.useRealTimers();
    }
  });

  it("re-arms the flash on a later drop/recover cycle after the window closes", async () => {
    vi.useFakeTimers();
    try {
      const { container, status } = mountReactiveStatus("connected");
      await nextTick();
      status.value = "disconnected";
      await nextTick();
      status.value = "connected";
      await nextTick();
      expect(tagOf(container).className).toContain("s-status-bar-tag-recovered");
      vi.advanceTimersByTime(1300);
      await nextTick();
      expect(tagOf(container).className).not.toContain("s-status-bar-tag-recovered");
      // Second cycle AFTER the window closed: the class must come back —
      // a one-shot sticky flag or a dead timer would leave it dark.
      status.value = "reconnecting";
      await nextTick();
      status.value = "connected";
      await nextTick();
      expect(tagOf(container).className).toContain("s-status-bar-tag-recovered");
      vi.advanceTimersByTime(1300);
      await nextTick();
      expect(tagOf(container).className).not.toContain("s-status-bar-tag-recovered");
    } finally {
      vi.useRealTimers();
    }
  });
});
