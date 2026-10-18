import { afterEach, describe, expect, it, vi } from "vitest";

import { installHkTapHighlight } from "./tapHighlight";

/**
 * installHkTapHighlight contract tests:
 * - default policy clears the UA overlay at the root
 * - a CSS colour keeps the mechanism and tints it
 * - "native" restores the browser default through the data attribute
 * - invalid colours fall back to transparent instead of the UA default
 * - the iOS :active enabler is a passive document touchstart, removable
 * - install is idempotent per document; uninstall restores prior inline
 *   state and disposes the registry entry
 */

const TOKEN = "--hk-tap-highlight-color";
const NATIVE_ATTR = "data-hk-tap-highlight";

const uninstalls: Array<() => void> = [];

function install(options?: Parameters<typeof installHkTapHighlight>[0]) {
  const uninstall = installHkTapHighlight(options);
  uninstalls.push(uninstall);
  return uninstall;
}

function root(): HTMLElement {
  return document.documentElement;
}

afterEach(() => {
  for (const uninstall of uninstalls.splice(0)) uninstall();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  root().removeAttribute("style");
  root().removeAttribute(NATIVE_ATTR);
});

describe("installHkTapHighlight", () => {
  it("clears the UA overlay at the root by default", () => {
    install();
    expect(root().style.getPropertyValue(TOKEN)).toBe("transparent");
    expect(root().hasAttribute(NATIVE_ATTR)).toBe(false);
  });

  it("keeps a themed tint when a colour is given", () => {
    install({ color: "rgb(47 111 237 / 12%)" });
    expect(root().style.getPropertyValue(TOKEN)).toBe(
      "rgb(47 111 237 / 12%)",
    );
  });

  it("restores the UA default through the native escape hatch", () => {
    install({ color: "native" });
    expect(root().getAttribute(NATIVE_ATTR)).toBe("native");
    expect(root().style.getPropertyValue(TOKEN)).toBe("");
  });

  it("falls back to transparent for an invalid colour", () => {
    vi.stubGlobal("CSS", { supports: () => false });
    install({ color: "not-a-colour" });
    expect(root().style.getPropertyValue(TOKEN)).toBe("transparent");
  });

  it("adds a passive touchstart enabler and removes it on uninstall", () => {
    const add = vi.spyOn(document, "addEventListener");
    const remove = vi.spyOn(document, "removeEventListener");
    const uninstall = install();
    expect(add).toHaveBeenCalledWith("touchstart", expect.any(Function), {
      passive: true,
    });
    uninstall();
    expect(remove).toHaveBeenCalledWith("touchstart", expect.any(Function));
  });

  it("can opt out of the active-state enabler", () => {
    const add = vi.spyOn(document, "addEventListener");
    install({ enableActiveState: false });
    expect(add).not.toHaveBeenCalledWith(
      "touchstart",
      expect.any(Function),
      expect.anything(),
    );
  });

  it("restores a pre-existing inline token and attribute on uninstall", () => {
    root().style.setProperty(TOKEN, "red");
    root().setAttribute(NATIVE_ATTR, "native");
    const uninstall = install({ color: "blue" });
    expect(root().style.getPropertyValue(TOKEN)).toBe("blue");
    expect(root().hasAttribute(NATIVE_ATTR)).toBe(false);
    uninstall();
    expect(root().style.getPropertyValue(TOKEN)).toBe("red");
    expect(root().getAttribute(NATIVE_ATTR)).toBe("native");
  });

  it("is idempotent per document (second install keeps the first policy)", () => {
    install({ color: "red" });
    install({ color: "blue" });
    expect(root().style.getPropertyValue(TOKEN)).toBe("red");
  });

  it("no-ops without a DOM", () => {
    vi.stubGlobal("document", undefined);
    const uninstall = installHkTapHighlight();
    expect(typeof uninstall).toBe("function");
    expect(() => uninstall()).not.toThrow();
  });
});
