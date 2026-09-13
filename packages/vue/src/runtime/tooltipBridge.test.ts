import { afterEach, describe, expect, it, vi } from "vitest";

import { installHkTooltipBridge, type HkTooltipBridgeOptions } from "./tooltipBridge";
import { usePopupManager } from "./usePopupManager";

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
 *   inside an HkTooltip wrapper — never engage
 * - pointerdown hides but stays engaged; scroll/resize and Esc disengage
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
