import { afterEach, describe, expect, it, vi } from "vitest";

const positionSpy = vi.hoisted(() => vi.fn());

vi.mock("./tooltipPosition", () => ({
  applyTooltipPosition: positionSpy,
}));

import { installHkTooltipBridge, type HkTooltipBridgeOptions } from "./tooltipBridge";
import { usePopupManager } from "./usePopupManager";
import { CHROME_OWNER_ATTR } from "./windowChrome";

/**
 * installHkTooltipBridge contract tests:
 * - engage: hovering/focusing a [title] element REMOVES the attribute
 *   (native tooltip cannot appear), stashes it in data-hk-title, and
 *   shows the shared `.hk-tooltip-popup` after the delay with the text
 *   + aria-describedby on the trigger
 * - disengage: the title attribute is restored exactly when WE removed
 *   it; fresher writers (host re-set, HkPopover's `title=""` blanking,
 *   Vue undefined-removal) always win
 * - escape hatches: empty titles, [data-hk-tooltip-native], elements
 *   inside an HkTooltip wrapper — never engage; a pointerover with
 *   pointerType "touch" never engages either (the touch hint bar in
 *   runtime/touchHint.ts owns touch pointers)
 * - pointerdown hides but stays engaged; scroll/resize and Esc disengage
 * - the popup mounts inside #hk-overlay-root (same home as the component
 *   tooltip's teleported popup) — at body level its in-root ordinal z
 *   would land under the root's document-space elevation and every
 *   overlay-hosted surface (the filter panel popover) clipped it
 * - idempotent install per document; uninstall tears everything down
 */

const manager = usePopupManager();

function install(options: HkTooltipBridgeOptions = {}) {
  const uninstall = installHkTooltipBridge(options);
  uninstalls.push(uninstall);
  return uninstall;
}

const uninstalls: Array<() => void> = [];

function trigger(title: string): HTMLElement {
  const el = document.createElement("button");
  el.setAttribute("title", title);
  el.textContent = "probe";
  document.body.appendChild(el);
  return el;
}

function hover(el: Element) {
  el.dispatchEvent(new MouseEvent("pointerover", { bubbles: true }));
}

function unhover(el: Element) {
  el.dispatchEvent(new MouseEvent("pointerout", { bubbles: true }));
}

function bridgePopup(): HTMLElement | null {
  return document.querySelector<HTMLElement>(".hk-tooltip-popup.hk-tooltip-bridge");
}

afterEach(() => {
  vi.useRealTimers();
  document.documentElement.removeAttribute(CHROME_OWNER_ATTR);
  document.documentElement.style.removeProperty("--hk-chrome-band-inset");
  vi.restoreAllMocks();
  positionSpy.mockClear();
  for (const u of uninstalls.splice(0)) u();
  for (const entry of [...manager.registry.value.values()]) {
    manager.unregister(entry.id);
  }
  document.querySelectorAll(".hk-tooltip-popup").forEach((el) => el.remove());
  document.querySelectorAll<HTMLElement>("[data-hk-title]").forEach((el) => {
    delete el.dataset.hkTitle;
  });
});

describe("installHkTooltipBridge", () => {
  it("engages on hover: removes the title, shows the popup after the delay", () => {
    vi.useFakeTimers();
    install({ delay: 300 });
    const el = trigger("Hello world");
    hover(el);
    expect(el.hasAttribute("title")).toBe(false);
    expect(el.dataset.hkTitle).toBe("Hello world");
    expect(bridgePopup()?.classList.contains("hk-tooltip-visible")).toBe(false);
    vi.advanceTimersByTime(300);
    const popup = bridgePopup()!;
    expect(popup.classList.contains("hk-tooltip-visible")).toBe(true);
    expect(popup.querySelector(".hk-tooltip-content")?.textContent).toBe("Hello world");
    expect(el.getAttribute("aria-describedby")).toBe(popup.id);
  });

  it("restores the title and hides the popup on leave", () => {
    vi.useFakeTimers();
    install();
    const el = trigger("Back soon");
    hover(el);
    vi.advanceTimersByTime(300);
    unhover(el);
    expect(el.getAttribute("title")).toBe("Back soon");
    expect(el.hasAttribute("aria-describedby")).toBe(false);
    expect(el.dataset.hkTitle).toBeUndefined();
    expect(bridgePopup()?.classList.contains("hk-tooltip-visible")).toBe(false);
  });

  it("cancels a pending show when the pointer leaves before the delay", () => {
    vi.useFakeTimers();
    install();
    const el = trigger("Never shown");
    hover(el);
    unhover(el);
    vi.advanceTimersByTime(1000);
    expect(bridgePopup()?.classList.contains("hk-tooltip-visible")).toBe(false);
    expect(el.getAttribute("title")).toBe("Never shown");
  });

  it("engages on keyboard focus too and disengages on blur", () => {
    vi.useFakeTimers();
    install();
    const el = trigger("Focused");
    el.dispatchEvent(new FocusEvent("focusin", { bubbles: true }));
    vi.advanceTimersByTime(300);
    expect(bridgePopup()?.classList.contains("hk-tooltip-visible")).toBe(true);
    el.dispatchEvent(new FocusEvent("focusout", { bubbles: true }));
    expect(el.getAttribute("title")).toBe("Focused");
    expect(bridgePopup()?.classList.contains("hk-tooltip-visible")).toBe(false);
  });

  it("never engages on empty titles, native escape hatches or HkTooltip-managed triggers", () => {
    vi.useFakeTimers();
    install();
    const blank = trigger("");
    hover(blank);
    expect(blank.hasAttribute("title")).toBe(true);
    const native = trigger("Native");
    native.setAttribute("data-hk-tooltip-native", "");
    hover(native);
    expect(native.getAttribute("title")).toBe("Native");
    const wrapped = trigger("Managed");
    const wrapper = document.createElement("span");
    wrapper.className = "hk-tooltip-wrapper";
    wrapper.appendChild(wrapped);
    document.body.appendChild(wrapper);
    hover(wrapped);
    expect(wrapped.getAttribute("title")).toBe("Managed");
    vi.advanceTimersByTime(1000);
    expect(bridgePopup()?.classList.contains("hk-tooltip-visible")).toBe(false);
  });

  it("never engages a touch pointerover (the touch hint bar owns touch)", () => {
    vi.useFakeTimers();
    install();
    const el = trigger("Touch owned");
    el.dispatchEvent(
      new PointerEvent("pointerover", { pointerType: "touch", bubbles: true }),
    );
    // Title untouched: engaging here would strip the attribute for an
    // anchored popup the touch mode never shows, and break the touch
    // bar's own title/data-hk-title fallback chain.
    expect(el.hasAttribute("title")).toBe(true);
    vi.advanceTimersByTime(1000);
    expect(bridgePopup()?.classList.contains("hk-tooltip-visible")).toBe(false);
  });

  it("honors the exclude option", () => {
    vi.useFakeTimers();
    install({ exclude: ".quiet" });
    const el = trigger("Excluded");
    el.className = "quiet";
    hover(el);
    expect(el.getAttribute("title")).toBe("Excluded");
  });

  it("never restores over a fresher writer while engaged", () => {
    vi.useFakeTimers();
    install();
    const el = trigger("Old");
    hover(el);
    // The host (or a Vue binding) re-set the title mid-hover.
    el.setAttribute("title", "New");
    unhover(el);
    expect(el.getAttribute("title")).toBe("New");
  });

  it("leaves a blanked title alone (HkPopover open-state suppression)", () => {
    vi.useFakeTimers();
    install();
    const el = trigger("Suppressed");
    hover(el);
    // HkPopover blanks titles via `title=""` while a popover is open.
    el.setAttribute("title", "");
    unhover(el);
    expect(el.getAttribute("title")).toBe("");
  });

  it("hides on pointerdown but stays engaged until the pointer leaves", () => {
    vi.useFakeTimers();
    install();
    const el = trigger("Stays");
    hover(el);
    vi.advanceTimersByTime(300);
    el.dispatchEvent(new MouseEvent("pointerdown", { bubbles: true }));
    expect(bridgePopup()?.classList.contains("hk-tooltip-visible")).toBe(false);
    expect(el.hasAttribute("title")).toBe(false); // still engaged — no native flash
    unhover(el);
    expect(el.getAttribute("title")).toBe("Stays");
  });

  it("disengages on Escape", () => {
    vi.useFakeTimers();
    install();
    const el = trigger("Escaped");
    hover(el);
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    expect(el.getAttribute("title")).toBe("Escaped");
  });

  it("disengages on scroll and resize (restores the title, drops the hold)", () => {
    vi.useFakeTimers();
    install();
    const el = trigger("Scrolled");
    hover(el);
    document.dispatchEvent(new Event("scroll"));
    expect(el.getAttribute("title")).toBe("Scrolled");
    expect(bridgePopup()?.classList.contains("hk-tooltip-visible")).toBe(false);
    hover(el);
    window.dispatchEvent(new Event("resize"));
    expect(el.getAttribute("title")).toBe("Scrolled");
  });

  it("mounts the popup inside the overlay root", () => {
    install();
    const root = document.querySelector("#hk-overlay-root");
    expect(root).not.toBeNull();
    expect(bridgePopup()?.parentElement).toBe(root);
  });

  it("is idempotent per document and uninstallable", () => {
    vi.useFakeTimers();
    install();
    const second = installHkTooltipBridge();
    // The duplicate install reuses the first bridge: still one popup.
    expect(document.querySelectorAll(".hk-tooltip-bridge").length).toBe(1);
    second();
    const el = trigger("After uninstall");
    hover(el);
    expect(el.getAttribute("title")).toBe("After uninstall");
  });
});


/**
 * The caption-band avoidance (2026-11-12 user direction): a bridge
 * tooltip never pins over the host caption strip by default — the popup
 * frame floors at band + 4px (popupBounds), so a caption-hugging trigger
 * flips below the strip instead. The EXEMPTION is explicit: the
 * data-hk-tooltip-band-overlap marker on the trigger (HkTitleBar's own
 * buttons) or the install-level allowBandOverlap option puts the bubble
 * back over the strip.
 */

describe("tooltipBridge caption-band avoidance", () => {
  function bandTrigger(title: string, marker?: string): HTMLElement {
    const el = trigger(title);
    if (marker !== undefined) el.setAttribute("data-hk-tooltip-band-overlap", marker);
    return el;
  }

  function claimBand(): void {
    document.documentElement.setAttribute(CHROME_OWNER_ATTR, "app");
    document.documentElement.style.setProperty("--hk-chrome-band-inset", "48px");
    vi.spyOn(window, "getComputedStyle").mockReturnValue({
      getPropertyValue: (name: string) =>
        name === "--hk-chrome-band-inset" ? "48px" : "",
    } as unknown as CSSStyleDeclaration);
  }

  it("places an unmarked trigger with the band-overlap avoidance default", () => {
    vi.useFakeTimers();
    claimBand();
    install({ delay: 0 });
    const el = bandTrigger("Band test");
    hover(el);
    vi.advanceTimersByTime(0);
    // The placement pass ran with NO exemption: the frame is the
    // chrome-band-floored viewport (band + 4px, popupBounds) and the
    // bubble lands below the strip.
    expect(positionSpy).toHaveBeenCalledTimes(1);
    expect(positionSpy.mock.calls[0]?.[3]).toBeUndefined();
    expect(positionSpy.mock.calls[0]?.[4]).toEqual({ allowBandOverlap: false });
  });

  it("lets a marked trigger pin over the strip (the explicit exemption)", () => {
    vi.useFakeTimers();
    claimBand();
    install({ delay: 0 });
    const el = bandTrigger("Band test", "true");
    hover(el);
    vi.advanceTimersByTime(0);
    // The marker opts the trigger IN: the placement pass drops to the
    // raw-window frame and may cover the strip.
    expect(positionSpy.mock.calls[0]?.[4]).toEqual({ allowBandOverlap: true });
  });

  it("honors an explicit marker false over an overlap-by-default install", () => {
    vi.useFakeTimers();
    claimBand();
    install({ delay: 0, allowBandOverlap: true });
    const el = bandTrigger("Band test", "false");
    hover(el);
    vi.advanceTimersByTime(0);
    // The per-trigger marker wins BOTH ways: an explicit "false" keeps
    // the avoidance even on an overlap-by-default install.
    expect(positionSpy.mock.calls[0]?.[4]).toEqual({ allowBandOverlap: false });
  });

  it("carries the install-level exemption to unmarked triggers", () => {
    vi.useFakeTimers();
    claimBand();
    install({ delay: 0, allowBandOverlap: true });
    const el = bandTrigger("Band test");
    hover(el);
    vi.advanceTimersByTime(0);
    expect(positionSpy.mock.calls[0]?.[4]).toEqual({ allowBandOverlap: true });
  });
});
