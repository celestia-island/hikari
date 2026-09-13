import { afterEach, describe, expect, it } from "vitest";

import { installHkImageFallback } from "./imageFallback";

/**
 * installHkImageFallback contract tests:
 * - a broken <img> (capture-phase error) gains `.hk-img-broken` and its
 *   src swaps to the bundled inline-SVG placeholder, exactly once
 *   (data flag — a failing fallback can never loop)
 * - a load of REAL content after a breakage clears the state; the load
 *   OF the placeholder keeps it
 * - escape hatches: [data-hk-img-native], selector/exclude options
 * - custom fallbackSrc override; `""` marks without swapping
 * - idempotent install; uninstall stops further marking
 */

const uninstalls: Array<() => void> = [];

function install(options?: Parameters<typeof installHkImageFallback>[0]) {
  const uninstall = installHkImageFallback(options);
  uninstalls.push(uninstall);
  return uninstall;
}

function img(src = "https://example.invalid/pic.png"): HTMLImageElement {
  const el = document.createElement("img");
  el.src = src;
  document.body.appendChild(el);
  return el;
}

function fail(el: HTMLImageElement) {
  el.dispatchEvent(new Event("error"));
}

function load(el: HTMLImageElement) {
  el.dispatchEvent(new Event("load"));
}

afterEach(() => {
  for (const u of uninstalls.splice(0)) u();
});

describe("installHkImageFallback", () => {
  it("marks a broken image and swaps in the placeholder once", () => {
    install();
    const el = img();
    fail(el);
    expect(el.classList.contains("hk-img-broken")).toBe(true);
    expect(el.dataset.hkImgFallback).toBe("1");
    expect(el.getAttribute("src")?.startsWith("data:image/svg+xml,")).toBe(true);
    const swapped = el.getAttribute("src")!;
    // The placeholder's own failure must not loop.
    fail(el);
    expect(el.getAttribute("src")).toBe(swapped);
    expect(el.classList.contains("hk-img-broken")).toBe(true);
  });

  it("clears the broken state when real content loads later", () => {
    install();
    const el = img();
    fail(el);
    expect(el.classList.contains("hk-img-broken")).toBe(true);
    // A repaired src loads: recovery clears class AND the one-shot flag.
    el.setAttribute("src", "https://example.invalid/fixed.png");
    load(el);
    expect(el.classList.contains("hk-img-broken")).toBe(false);
    expect(el.dataset.hkImgFallback).toBeUndefined();
    // So a SECOND breakage marks again.
    fail(el);
    expect(el.classList.contains("hk-img-broken")).toBe(true);
  });

  it("keeps the treatment when the placeholder itself loads", () => {
    install();
    const el = img();
    fail(el);
    const placeholder = el.getAttribute("src")!;
    load(el);
    expect(el.getAttribute("src")).toBe(placeholder);
    expect(el.classList.contains("hk-img-broken")).toBe(true);
  });

  it("leaves native-escape-hatch images alone", () => {
    install();
    const el = img();
    el.setAttribute("data-hk-img-native", "");
    fail(el);
    expect(el.classList.contains("hk-img-broken")).toBe(false);
    expect(el.getAttribute("src")).toBe("https://example.invalid/pic.png");
  });

  it("honors selector and exclude options", () => {
    install({ selector: "img.content", exclude: ".keep" });
    const wrong = img();
    fail(wrong);
    expect(wrong.classList.contains("hk-img-broken")).toBe(false);
    const kept = img();
    kept.className = "content keep";
    fail(kept);
    expect(kept.classList.contains("hk-img-broken")).toBe(false);
    const covered = img();
    covered.className = "content";
    fail(covered);
    expect(covered.classList.contains("hk-img-broken")).toBe(true);
  });

  it("supports a custom fallbackSrc override", () => {
    install({ fallbackSrc: "data:image/svg+xml,custom" });
    const custom = img();
    fail(custom);
    expect(custom.getAttribute("src")).toBe("data:image/svg+xml,custom");
  });

  it("supports an empty fallbackSrc that marks without swapping", () => {
    install({ fallbackSrc: "" });
    const marked = img();
    fail(marked);
    expect(marked.classList.contains("hk-img-broken")).toBe(true);
    expect(marked.getAttribute("src")).toBe("https://example.invalid/pic.png");
  });

  it("keeps the one-shot marker across repeat errors even without a src swap", () => {
    // Mark-only mode: no src to dedupe against, so the dataset flag is the
    // only once-guard — pin it (repeat errors must stay marked, and the
    // flag must exist for the recovery path to clear).
    install({ fallbackSrc: "" });
    const el = img();
    fail(el);
    expect(el.classList.contains("hk-img-broken")).toBe(true);
    expect(el.dataset.hkImgFallback).toBe("1");
    fail(el);
    fail(el);
    expect(el.dataset.hkImgFallback).toBe("1");
    expect(el.classList.contains("hk-img-broken")).toBe(true);
  });

  it("is idempotent per document and uninstallable", () => {
    install();
    install(); // duplicate: silently reuses the first bridge
    const el = img();
    fail(el);
    expect(el.dataset.hkImgFallback).toBe("1");
    uninstalls.splice(0)[0]!();
    const after = img();
    fail(after);
    expect(after.classList.contains("hk-img-broken")).toBe(false);
  });
});
