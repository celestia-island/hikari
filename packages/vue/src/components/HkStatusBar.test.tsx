import { afterEach, describe, expect, it, vi } from "vitest";
import { createApp, h, nextTick, ref } from "vue";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { HkStatusBar, hkMergeVersionDisplay, hkParseIdentity } from "./HkStatusBar";
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
  vi.restoreAllMocks();
  for (const { app, container } of mounts.splice(0)) {
    app.unmount();
    container.remove();
  }
  document.body.innerHTML = "";
});

describe("HkStatusBar", () => {
  it("suppresses a build hash the version line already shows, keeps drift visible", async () => {
    // Display-layer dedup, set-based since 2026-10-11: the version line
    // and the build stamp are two INDEPENDENT facts, and the merge keys
    // every token by its commit (separator- and case-agnostic) through a
    // set — a token whose key is already shown cannot render again, BY
    // CONSTRUCTION, in either separator generation. A DIFFERENT commit
    // stays visible: that IS the drift signal. The last case is the
    // live 2026-10-11 production pair (single-colon health line against
    // the legacy `::` webui stamp) that printed the panel identity
    // twice on demo.dev.cw.
    const cases: Array<{ version: string; hash: string; expect: string }> = [
      { version: "0.1.0 master:d423747", hash: "d423747", expect: "0.1.0 master:d423747" },
      { version: "0.1.0 master:d423747", hash: "master:d423747", expect: "0.1.0 master:d423747" },
      { version: "0.1.0 master:d423747", hash: "master::d423747", expect: "0.1.0 master:d423747" },
      { version: "0.1 master::d423747", hash: "d423747", expect: "0.1 master::d423747" },
      { version: "0.1 master::d423747", hash: "master::d423747", expect: "0.1 master::d423747" },
      { version: "0.1 master::d423747", hash: "master:d423747", expect: "0.1 master::d423747" },
      { version: "0.1 master::d423747", hash: "badd902", expect: "0.1 master::d423747 badd902" },
      { version: "0.1 master::d423747", hash: "feat/x::badd902", expect: "0.1 master::d423747 feat/x::badd902" },
      { version: "0.1.0 master:d423747", hash: "master:badd902", expect: "0.1.0 master:d423747 master:badd902" },
      { version: "0.1.284", hash: "d423747", expect: "0.1.284 d423747" },
      { version: "0.1.52", hash: "EDW62Q", expect: "0.1.52 EDW62Q" },
      {
        version: "0.1.0 feat/model-usage-selfhosted:770f625",
        hash: "feat/model-usage-selfhosted::770f625",
        expect: "0.1.0 feat/model-usage-selfhosted:770f625",
      },
    ];
    for (const { version, hash, expect: expected } of cases) {
      const container = document.createElement("div");
      document.body.appendChild(container);
      const app = createApp({
        render: () =>
          h(HkStatusBar, {
            version,
            panelBuildHash: hash,
            connectionStatus: "connected",
            connectionInfo: INFO,
          }),
      });
      app.mount(container);
      await nextTick();
      // The static layer carries the merged text exactly once; the
      // marquee overlay copies are the scrolling mechanism, not content.
      const row = container.querySelector<HTMLElement>(".s-status-bar-version__static")!;
      expect(row.textContent, `${version} + ${hash}`).toBe(expected);
      app.unmount();
      container.remove();
    }
  });

  it("merges version identities duplicate-free by construction (hkMergeVersionDisplay)", () => {
    // The set guarantee, exercised at the unit level: whatever the
    // inputs look like — repeated tokens inside one line, mixed
    // separators, case drift — a key already seen never renders again.
    expect(hkMergeVersionDisplay("0.1.0 master:abc1234", undefined)).toBe("0.1.0 master:abc1234");
    expect(hkMergeVersionDisplay("0.1.0", "master:abc1234")).toBe("0.1.0 master:abc1234");
    // The same commit twice inside ONE line (defensive: a chatty server
    // concatenating its own stamp).
    expect(hkMergeVersionDisplay("0.1.0 master:abc1234 master:abc1234", undefined))
      .toBe("0.1.0 master:abc1234");
    // Cross-separator + case-folded: same commit, either generation.
    expect(hkMergeVersionDisplay("0.1.0 a:1b2c3d4", "a::1B2C3D4")).toBe("0.1.0 a:1b2c3d4");
    // Same commit under a different branch label: the commit IS the
    // identity — the second label names the same atom and adds nothing.
    expect(hkMergeVersionDisplay("0.1.0 feat/x:1b2c3d4", "master::1b2c3d4"))
      .toBe("0.1.0 feat/x:1b2c3d4");
    // Non-git tokens key by raw text and still cannot duplicate.
    expect(hkMergeVersionDisplay("0.1.52 EDW62Q", "EDW62Q")).toBe("0.1.52 EDW62Q");
    expect(hkMergeVersionDisplay("0.1.52", "EDW62Q")).toBe("0.1.52 EDW62Q");
    // Drift stays visible (the stale-embed signal).
    expect(hkMergeVersionDisplay("0.1.0 master:1b2c3d4", "badd902"))
      .toBe("0.1.0 master:1b2c3d4 badd902");
    // Blank stamps never append a phantom token.
    expect(hkMergeVersionDisplay("0.1.0", "  ")).toBe("0.1.0");
    expect(hkMergeVersionDisplay(" 0.1.0 ", "")).toBe("0.1.0");
  });

  it("parses identity atoms in either separator generation (hkParseIdentity)", () => {
    expect(hkParseIdentity("feat/x:770f625")).toEqual({ branch: "feat/x", commit: "770f625" });
    expect(hkParseIdentity("feat/x::770f625")).toEqual({ branch: "feat/x", commit: "770f625" });
    expect(hkParseIdentity("770F625")).toEqual({ commit: "770f625" });
    expect(hkParseIdentity("0.1.0")).toBeUndefined();
    expect(hkParseIdentity("EDW62Q")).toBeUndefined();
    expect(hkParseIdentity(undefined)).toBeUndefined();
  });

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
    // The card's DEFAULT width is a deliberate 300px (2026-10-11 user
    // direction: the version/protocol rows read cramped at the old 220px
    // floor), clamped to the popover viewport budget on narrow phones.
    // Hooked via data-status-bar-card — firstElementChild would couple
    // the test to HkPopover's internal panel structure.
    const card = panel!.querySelector<HTMLElement>("[data-status-bar-card]")!;
    expect(card.style.minWidth).toBe(
      "min(300px, calc(100vw - 2 * var(--viewport-gutter, 16px)))",
    );
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

  it("shows a working reconnect button in the popover while disconnected (hint text retired)", async () => {
    const onRetry = vi.fn();
    const container = mountBar({
      version: "1.2.3",
      connectionStatus: "disconnected",
      connectionInfo: INFO,
      onRetry,
    });
    await nextTick();
    container
      .querySelector<HTMLElement>(".s-status-bar-tag")!
      .dispatchEvent(new MouseEvent("mouseenter"));
    await nextTick();
    const panel = document.body.querySelector<HTMLElement>(".hk-popover-panel")!;
    // The popover body teleports to <body>: the old italic "click to
    // retry" hint pointed at an element whose clicks never reached the
    // tag handler. The actions row carries a REAL button instead, and
    // the misleading hint is gone whenever a retry is wired.
    const row = panel.querySelector<HTMLElement>("[data-status-actions]")!;
    expect(row, "actions row renders").toBeTruthy();
    const button = row.querySelector<HTMLButtonElement>("button")!;
    expect(button.textContent).toContain("Reconnect now");
    // 2026-10-02 user direction: small buttons with a leading glyph.
    expect(button.className).toContain("hk-btn-xs");
    expect(button.querySelector(".hk-btn-icon svg"), "leading glyph renders").toBeTruthy();
    expect(panel.textContent).not.toContain("Click to retry");
    button.click();
    expect(onRetry, "popover button click retries").toHaveBeenCalledTimes(1);
  });

  it("keeps the fallback hint when no onRetry is wired", async () => {
    const container = mountBar({
      version: "1.2.3",
      connectionStatus: "disconnected",
      connectionInfo: INFO,
    });
    await nextTick();
    container
      .querySelector<HTMLElement>(".s-status-bar-tag")!
      .dispatchEvent(new MouseEvent("mouseenter"));
    await nextTick();
    const panel = document.body.querySelector<HTMLElement>(".hk-popover-panel")!;
    expect(panel.querySelector("[data-status-actions]")).toBeNull();
    expect(panel.textContent).toContain("Click to retry");
  });

  it("renders host actions through the actions slot, connected or not", async () => {
    for (const connectionStatus of ["connected", "disconnected"] as const) {
      document.body.innerHTML = "";
      const onRefresh = vi.fn();
      const container = document.createElement("div");
      document.body.appendChild(container);
      const app = createApp({
        render: () =>
          h(HkStatusBar, {
            version: "1.2.3",
            connectionStatus,
            connectionInfo: INFO,
            onRetry: () => {},
          }, {
            actions: () => h("button", { class: "host-refresh", onClick: onRefresh }, "Refresh page"),
          }),
      });
      app.mount(container);
      mounts.push({ app, container });
      await nextTick();
      container
        .querySelector<HTMLElement>(".s-status-bar-tag")!
        .dispatchEvent(new MouseEvent("mouseenter"));
      await nextTick();
      const panel = document.body.querySelector<HTMLElement>(".hk-popover-panel")!;
      const host = panel.querySelector<HTMLButtonElement>(".host-refresh")!;
      expect(host, `host action renders (${connectionStatus})`).toBeTruthy();
      expect(panel.querySelector("[data-status-actions]")).toBeTruthy();
      host.click();
      expect(onRefresh).toHaveBeenCalledTimes(1);
    }
  });

  it("no actions row when connected without host actions", async () => {
    const container = mountBar({
      version: "1.2.3",
      connectionStatus: "connected",
      connectionInfo: INFO,
      onRetry: () => {},
    });
    await nextTick();
    container
      .querySelector<HTMLElement>(".s-status-bar-tag")!
      .dispatchEvent(new MouseEvent("mouseenter"));
    await nextTick();
    const panel = document.body.querySelector<HTMLElement>(".hk-popover-panel");
    expect(panel!.querySelector("[data-status-actions]")).toBeNull();
  });

  it("keeps the actions row available while connection info is still fetching", async () => {
    const onRetry = vi.fn();
    const container = mountBar({
      version: "1.2.3",
      connectionStatus: "disconnected",
      connectionInfo: null,
      onRetry,
    });
    await nextTick();
    container
      .querySelector<HTMLElement>(".s-status-bar-tag")!
      .dispatchEvent(new MouseEvent("mouseenter"));
    await nextTick();
    const panel = document.body.querySelector<HTMLElement>(".hk-popover-panel")!;
    // The row must live OUTSIDE the info/fetching ternary: an outage that
    // drops connectionInfo to null is exactly when the retry button is
    // most needed.
    const button = panel.querySelector<HTMLButtonElement>("[data-status-actions] button");
    expect(button, "retry button renders without info").toBeTruthy();
    button!.click();
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it("no actions row when the slot renders nothing (wrapper forwards an empty slot)", async () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const app = createApp({
      render: () =>
        h(HkStatusBar, {
          version: "1.2.3",
          connectionStatus: "connected",
          connectionInfo: INFO,
        }, {
          // HkConnectionStatus forwards `actions` unconditionally; an
          // empty render must not paint a hairline-only row.
          actions: () => [],
        }),
    });
    app.mount(container);
    mounts.push({ app, container });
    await nextTick();
    container
      .querySelector<HTMLElement>(".s-status-bar-tag")!
      .dispatchEvent(new MouseEvent("mouseenter"));
    await nextTick();
    const panel = document.body.querySelector<HTMLElement>(".hk-popover-panel");
    expect(panel!.querySelector("[data-status-actions]")).toBeNull();
  });

  it("version value cells scroll like a marquee only when the identity overflows", async () => {
    // 2026-10-11 user direction: long branch identities must not wrap or
    // stretch the footer — the two version positions become marquee
    // windows riding the SHARED HkPlaceholderMarquee (the input
    // placeholder's overflow strategy, consumed as-is). Static layer
    // while the text fits; ghost + scrolling strip once it overflows.
    const LONG = "0.1.0 feat/model-usage-selfhosted:770f625";
    const container = mountBar({
      version: LONG,
      engineVersion: "9.8.7",
      connectionStatus: "connected",
      connectionInfo: INFO,
    });
    await nextTick();
    // Fitting state (jsdom lays out nothing): the static layer shows the
    // merged text, the marquee stays a hidden single-copy probe, no
    // overflow flag, and the title keeps the hover copy.
    const cell = container.querySelector<HTMLElement>(".s-status-bar-version")!;
    expect(cell.querySelector(".s-status-bar-version__static")!.textContent).toBe(LONG);
    expect(cell.querySelector(".hk-placeholder-marquee--hidden"), "hidden probe").toBeTruthy();
    expect(cell.hasAttribute("data-overflowing")).toBe(false);
    expect(cell.title).toBe(LONG);

    // Overflow: the copy (500px) outgrows the window (200px) — the cell
    // flips to the marquee: overflow flag on, strip scrolls with the
    // measured loop geometry, three copies for the seamless wrap.
    const host = cell.querySelector<HTMLElement>(".hk-placeholder-marquee")!;
    const copy = cell.querySelector<HTMLElement>(".hk-placeholder-marquee__copy")!;
    Object.defineProperty(host, "clientWidth", { configurable: true, get: () => 200 });
    vi.spyOn(copy, "getBoundingClientRect").mockReturnValue({ width: 500 } as DOMRect);
    (host as HTMLElement & {
      __vueParentComponent?: { exposed?: { measure?(): void } };
    }).__vueParentComponent?.exposed?.measure?.();
    await nextTick();
    expect(cell.hasAttribute("data-overflowing")).toBe(true);
    const strip = cell.querySelector<HTMLElement>(".hk-placeholder-marquee__strip")!;
    expect(strip.className).toContain("hk-placeholder-marquee__strip--scroll");
    expect(strip.style.getPropertyValue("--hk-marquee-shift")).toBe("-500px");
    expect(cell.querySelectorAll(".hk-placeholder-marquee__copy").length).toBe(3);

    // Fit again (a shorter identity arrives from the server): the cell
    // flips back — overflow flag off, probe hidden again.
    vi.spyOn(copy, "getBoundingClientRect").mockReturnValue({ width: 100 } as DOMRect);
    (host as HTMLElement & {
      __vueParentComponent?: { exposed?: { measure?(): void } };
    }).__vueParentComponent?.exposed?.measure?.();
    await nextTick();
    expect(cell.hasAttribute("data-overflowing")).toBe(false);
    expect(cell.querySelector(".hk-placeholder-marquee--hidden")).toBeTruthy();
  });

  it("compact popover version rows are bounded marquee cells with merged-once text", async () => {
    const container = mountBar({
      version: "0.1.0 feat/model-usage-selfhosted:770f625",
      panelBuildHash: "feat/model-usage-selfhosted::770f625",
      engineVersion: "0.1.0 feat/model-usage-selfhosted:770f625",
      connectionStatus: "connected",
      connectionInfo: INFO,
      compact: true,
    });
    await nextTick();
    container
      .querySelector<HTMLElement>(".s-status-bar-tag")!
      .dispatchEvent(new MouseEvent("mouseenter"));
    await nextTick();
    const panel = document.body.querySelector<HTMLElement>(".hk-popover-panel")!;
    // Both the panel and the engine row ride the bounded popover value
    // cell; the panel pair is the live duplicate fixture — the merged
    // text renders the identity exactly once in each row.
    const cells = panel.querySelectorAll<HTMLElement>(".s-status-bar-popover-value .s-status-bar-version");
    expect(cells.length).toBe(2);
    for (const c of cells) {
      expect(c.querySelector(".s-status-bar-version__static")!.textContent)
        .toBe("0.1.0 feat/model-usage-selfhosted:770f625");
      expect(c.querySelector(".hk-placeholder-marquee"), "marquee overlay wired").toBeTruthy();
    }
  });

  it("pins the status-bar marquee window contract in admin-tokens.scss", () => {
    // Extraction self-check: the selector list form
    // (`.s-status-bar-version, .s-status-bar-version-sep {`) must NOT be
    // the match — the rule asserted here is the dedicated block.
    const scss = readFileSync(resolve(__dirname, "../styles/admin-tokens.scss"), "utf8");
    const versionRule = /\.s-status-bar-version\s*\{[^}]*\}/.exec(scss)?.[0] ?? "";
    expect(versionRule, "dedicated .s-status-bar-version rule exists").toContain("max-width: min(40vw, 24rem)");
    // inline-flex keeps a text baseline for the grid's align-items:
    // baseline — an overflow:hidden block would sink the row.
    expect(versionRule).toContain("display: inline-flex");
    expect(versionRule).toContain("overflow: hidden");
    // Ghost handover: the static layer keeps layout + a11y, only the
    // paint moves to the scrolling overlay.
    expect(scss).toContain(".s-status-bar-version[data-overflowing] .s-status-bar-version__static");
    expect(scss).toMatch(/\.s-status-bar-version\[data-overflowing\][^{]*\{[^}]*opacity:\s*0/s);
    // Measurement parity: the overlay must draw in the cell's own
    // typography, or the overflow flip fires at the wrong width.
    expect(scss).toContain(".s-status-bar-version .hk-placeholder-marquee");
    expect(scss).toMatch(/\.s-status-bar-version \.hk-placeholder-marquee\s*\{[^}]*font-size:\s*inherit/s);
    // Popover bound: a long identity scrolls inside the ~300px card
    // instead of stretching it.
    const popoverRule = /\.s-status-bar-popover-value\s*\{[^}]*\}/.exec(scss)?.[0] ?? "";
    expect(popoverRule, "popover value cell bound exists").toContain("max-width: min(16rem, 60vw)");
    expect(scss).toMatch(/\.s-status-bar-popover-value \.s-status-bar-version\s*\{[^}]*max-width:\s*100%/s);
    // Dead-overlay guard: if the marquee's measurement never fires, a
    // capped cell degrades to an ellipsis cut, never a silent hard clip.
    expect(scss).toMatch(
      /\.s-status-bar-version__static\s*\{[^}]*text-overflow:\s*ellipsis/s,
    );
    // The stale combined selector list (`.s-status-bar-version,
    // .s-status-bar-version-sep { nowrap }`) is gone — the dedicated
    // block owns the version cell's rules (2026-10-11 R1 cleanup).
    expect(scss).not.toMatch(/\.s-status-bar-version,\s*\n\s*\.s-status-bar-version-sep\s*\{/);
  });
});
