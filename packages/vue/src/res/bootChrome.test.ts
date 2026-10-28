import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { WINDOW_IPC } from "../runtime/windowChrome";

/**
 * `res/boot-chrome.js` contract tests.
 *
 * The file under test is a CLASSIC script: no exports, no bundler, executed by
 * the browser during parse. It is exercised the only way a browser would:
 * reading the source and evaluating it against a fresh happy-dom document,
 * with `document.currentScript` stubbed so the `<script data-hk-*>` config path
 * is covered too.
 *
 * Every assertion here maps to a failure that was reported in the field: a bar
 * that never appears (non-Tauri gate), buttons that silently do nothing (the
 * two wiring paths + the retry/degrade ladder), a bar that outlives the app
 * (claim handoff) or traps the user in a dead window (hang watchdog).
 */

const SOURCE = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), "boot-chrome.js"),
  "utf8",
);

const BAR = "#hk-boot-chrome";

type Global = Record<string, unknown>;

function globalScope(): Global {
  return window as unknown as Global;
}

function setGlobal(name: string, value: unknown): void {
  globalScope()[name] = value;
}

function clearGlobal(name: string): void {
  delete globalScope()[name];
}

function bootChromeHandle(): {
  setStatus(text: string): void;
  dismiss(): void;
  isActive(): boolean;
  ready: Promise<boolean>;
} {
  return globalScope().HkBootChrome as ReturnType<typeof bootChromeHandle>;
}

interface FakeWindowApi {
  minimize: ReturnType<typeof vi.fn>;
  toggleMaximize: ReturnType<typeof vi.fn>;
  isMaximized: ReturnType<typeof vi.fn>;
  close: ReturnType<typeof vi.fn>;
}

function fakeWindowApi(maximized = false): FakeWindowApi {
  return {
    minimize: vi.fn(() => Promise.resolve()),
    toggleMaximize: vi.fn(() => Promise.resolve()),
    isMaximized: vi.fn(() => Promise.resolve(maximized)),
    close: vi.fn(() => Promise.resolve()),
  };
}

function useWindowApi(win: FakeWindowApi): void {
  setGlobal("__TAURI__", { window: { getCurrentWindow: () => win } });
}

/** Evaluate the script the way the browser does for a `<script src>` tag. */
function runBootChrome(config?: {
  title?: string;
  height?: number | string;
  hangMs?: number | string;
}): void {
  const tag = document.createElement("script");
  tag.id = "hk-boot-chrome-tag";
  if (config?.title !== undefined) tag.dataset.hkTitle = String(config.title);
  if (config?.height !== undefined) tag.dataset.hkHeight = String(config.height);
  if (config?.hangMs !== undefined) tag.dataset.hkHangMs = String(config.hangMs);
  Object.defineProperty(document, "currentScript", {
    configurable: true,
    get: () => tag,
  });
  new Function(SOURCE)();
}

/** Let promise callbacks (driver probes, `isMaximized`, the fade timer) run. */
async function flush(times = 6): Promise<void> {
  for (let i = 0; i < times; i += 1) await Promise.resolve();
}

function bar(): HTMLElement | null {
  return document.querySelector<HTMLElement>(BAR);
}

function control(act: "minimize" | "maximize" | "close" | "reload"): HTMLButtonElement {
  const el = document.querySelector<HTMLButtonElement>(`button[data-act="${act}"]`);
  if (!el) throw new Error(`boot chrome is missing the ${act} button`);
  return el;
}

function controls(): HTMLButtonElement[] {
  return Array.from(document.querySelectorAll<HTMLButtonElement>("button[data-act]"));
}

function statusText(): string {
  return document.getElementById("hk-boot-chrome-status")?.textContent ?? "";
}

function styleSheet(): string {
  return document.getElementById("hk-boot-chrome-style")?.textContent ?? "";
}

beforeEach(() => {
  vi.useFakeTimers();
  document.body.innerHTML = "";
  document.head.innerHTML = "";
  document.documentElement.removeAttribute("data-mode");
  document.documentElement.removeAttribute("data-hk-boot-chrome");
  document.documentElement.style.removeProperty("--hk-boot-chrome-h");
  clearGlobal("HkBootChrome");
  clearGlobal("__TAURI__");
  clearGlobal("__TAURI_INTERNALS__");
  localStorage.clear();
});

afterEach(() => {
  vi.clearAllTimers();
  vi.useRealTimers();
  vi.restoreAllMocks();
  Object.defineProperty(document, "currentScript", {
    configurable: true,
    get: () => null,
  });
});

describe("boot-chrome.js host gates", () => {
  it("renders nothing at all in a plain (non-Tauri) browser", () => {
    runBootChrome();

    expect(bar()).toBeNull();
    expect(document.getElementById("hk-boot-chrome-style")).toBeNull();
    expect(globalScope().HkBootChrome).toBeUndefined();
    expect(
      document.documentElement.hasAttribute("data-hk-boot-chrome"),
    ).toBe(false);
  });

  it("is idempotent when the tag is included twice", () => {
    useWindowApi(fakeWindowApi());
    setGlobal("__TAURI_INTERNALS__", { invoke: vi.fn() });
    runBootChrome();
    runBootChrome();

    expect(document.querySelectorAll(BAR)).toHaveLength(1);
    expect(document.querySelectorAll("#hk-boot-chrome-style")).toHaveLength(1);
  });
});

describe("boot-chrome.js bar surface", () => {
  it("draws a draggable banner with the three caption buttons", () => {
    useWindowApi(fakeWindowApi());
    setGlobal("__TAURI_INTERNALS__", { invoke: vi.fn() });
    runBootChrome({ title: "Shittim Chest" });

    const el = bar();
    expect(el).not.toBeNull();
    expect(el!.getAttribute("role")).toBe("banner");
    expect(el!.getAttribute("aria-label")).toBe("Window");
    // Tauri's own drag handler keys off this exact attribute.
    expect(el!.hasAttribute("data-tauri-drag-region")).toBe(true);
    expect(
      document
        .getElementById("hk-boot-chrome-title")!
        .hasAttribute("data-tauri-drag-region"),
    ).toBe(true);
    expect(document.getElementById("hk-boot-chrome-app")!.textContent).toBe(
      "Shittim Chest",
    );
    expect(statusText()).toBe("Loading\u2026");

    expect(controls().map((b) => b.getAttribute("data-act"))).toEqual([
      "minimize",
      "maximize",
      "close",
    ]);
    for (const button of controls()) {
      expect(button.disabled).toBe(false);
      expect(button.getAttribute("title")).toBeTruthy();
      expect(button.getAttribute("aria-label")).toBeTruthy();
      // Interactive children must NOT be drag regions, or the buttons would
      // start a window drag instead of activating.
      expect(button.hasAttribute("data-tauri-drag-region")).toBe(false);
    }

    // The bar publishes its own height and lifecycle, and never depends on the
    // hikari stylesheet (which has not loaded yet).
    expect(
      document.documentElement.style.getPropertyValue("--hk-boot-chrome-h"),
    ).toBe("32px");
    expect(
      document.documentElement.getAttribute("data-hk-boot-chrome"),
    ).toBe("active");
    const css = styleSheet();
    expect(css).toContain("z-index:100001");
    expect(css).toContain("position:fixed");
    expect(css).toContain("--loader-card-bg");
    expect(css).toContain("[data-mode='light']");
    expect(css).toContain(":focus-visible");
    expect(css).toContain("-webkit-app-region:drag");
  });

  it("reads title, height and watchdog delay from the script tag (CSP win)", () => {
    setGlobal("__TAURI_INTERNALS__", { invoke: vi.fn(() => Promise.resolve(false)) });
    runBootChrome({ title: "Arona", height: 36, hangMs: 1200 });

    expect(document.getElementById("hk-boot-chrome-app")!.textContent).toBe("Arona");
    expect(
      document.documentElement.style.getPropertyValue("--hk-boot-chrome-h"),
    ).toBe("36px");
    expect(styleSheet()).toContain("height:36px");

    vi.advanceTimersByTime(1199);
    expect(document.querySelector('button[data-act="reload"]')).toBeNull();
    vi.advanceTimersByTime(1);
    expect(document.querySelector('button[data-act="reload"]')).not.toBeNull();
  });

  it("falls back to document.title when the tag carries no title", () => {
    document.title = "Shittim Chest";
    setGlobal("__TAURI_INTERNALS__", { invoke: vi.fn() });
    runBootChrome();

    expect(document.getElementById("hk-boot-chrome-app")!.textContent).toBe(
      "Shittim Chest",
    );
  });

  it("follows the declared theme mode and reacts to later switches", async () => {
    document.documentElement.setAttribute("data-mode", "light");
    setGlobal("__TAURI_INTERNALS__", { invoke: vi.fn() });
    runBootChrome();
    expect(bar()!.getAttribute("data-mode")).toBe("light");

    document.documentElement.setAttribute("data-mode", "dark");
    await flush();
    vi.advanceTimersByTime(0);
    await flush();
    expect(bar()!.getAttribute("data-mode")).toBe("dark");
  });
});

describe("boot-chrome.js window wiring", () => {
  it("drives the documented __TAURI__ window API when it exists", async () => {
    const win = fakeWindowApi(true);
    useWindowApi(win);
    setGlobal("__TAURI_INTERNALS__", { invoke: vi.fn() });
    runBootChrome();

    expect(bar()!.getAttribute("data-hk-driver")).toBe("window");
    expect(bar()!.getAttribute("data-hk-available")).toBe("1");

    // The maximize button mirrors the shell state, not a local guess.
    await flush();
    expect(control("maximize").getAttribute("aria-label")).toBe("Restore");

    control("minimize").click();
    expect(win.minimize).toHaveBeenCalledTimes(1);

    control("maximize").click();
    expect(win.toggleMaximize).toHaveBeenCalledTimes(1);
    await flush();
    expect(win.isMaximized).toHaveBeenCalled();

    control("close").click();
    expect(win.close).toHaveBeenCalledTimes(1);
  });

  it("falls back to __TAURI_INTERNALS__.invoke with the Tauri 2.12 command names", async () => {
    const invoke = vi.fn(() => Promise.resolve(false));
    setGlobal("__TAURI_INTERNALS__", { invoke });
    runBootChrome();

    expect(bar()!.getAttribute("data-hk-driver")).toBe("invoke");
    expect(control("minimize").disabled).toBe(false);

    control("minimize").click();
    expect(invoke).toHaveBeenCalledWith(WINDOW_IPC.minimize, {});

    control("maximize").click();
    expect(invoke).toHaveBeenCalledWith(WINDOW_IPC.toggleMaximize, {});
    await flush();
    expect(invoke).toHaveBeenCalledWith(WINDOW_IPC.isMaximized, {});

    control("close").click();
    expect(invoke).toHaveBeenCalledWith(WINDOW_IPC.close, {});
  });

  it("maps each caption button to its WINDOW_IPC entry, one to one", () => {
    const invoke = vi.fn((_command: string) => Promise.resolve(false));
    setGlobal("__TAURI_INTERNALS__", { invoke });
    runBootChrome();
    invoke.mockClear();

    const expected: Array<[act: "minimize" | "maximize" | "close", command: string]> = [
      ["minimize", WINDOW_IPC.minimize],
      ["maximize", WINDOW_IPC.toggleMaximize],
      ["close", WINDOW_IPC.close],
    ];
    for (const [act, command] of expected) {
      invoke.mockClear();
      control(act).click();
      const sent = invoke.mock.calls.map((call) => call[0]);
      expect(sent, `${act} must send ${command}`).toContain(command);
      // No cross-wiring: the button sends its own command (plus the read-only
      // state probe that follows a maximize toggle).
      expect(sent.filter((name) => name !== WINDOW_IPC.isMaximized)).toEqual([command]);
    }
  });

  it("retries for up to 5s before wiring a late shell API", () => {
    const internals: { invoke?: ReturnType<typeof vi.fn> } = {};
    setGlobal("__TAURI_INTERNALS__", internals);
    runBootChrome();

    expect(control("minimize").disabled).toBe(true);
    expect(bar()!.getAttribute("data-hk-available")).toBe("0");

    internals.invoke = vi.fn(() => Promise.resolve(false));
    vi.advanceTimersByTime(150);

    expect(bar()!.getAttribute("data-hk-driver")).toBe("invoke");
    expect(control("minimize").disabled).toBe(false);
    expect(control("close").disabled).toBe(false);
  });

  it("degrades VISIBLY when the shell API never shows up", async () => {
    // The bar renders (this IS a Tauri webview) but nothing can be wired.
    setGlobal("__TAURI_INTERNALS__", {});
    runBootChrome();

    expect(control("minimize").disabled).toBe(true);
    expect(control("close").disabled).toBe(true);

    vi.advanceTimersByTime(5000);

    expect(bar()!.getAttribute("data-hk-driver")).toBe("none");
    expect(control("minimize").disabled).toBe(true);
    expect(control("maximize").disabled).toBe(true);
    expect(control("close").disabled).toBe(true);
    // Silence is the bug: the failure must be readable on the bar.
    expect(statusText()).toBe("Window controls unavailable");
    await expect(bootChromeHandle().ready).resolves.toBe(false);
  });
});

describe("boot-chrome.js handoff and watchdog", () => {
  it("hands the window over on hk:chrome-claim and removes itself", () => {
    useWindowApi(fakeWindowApi());
    setGlobal("__TAURI_INTERNALS__", { invoke: vi.fn() });
    runBootChrome();

    expect(bootChromeHandle().isActive()).toBe(true);
    window.dispatchEvent(
      new CustomEvent("hk:chrome-claim", { detail: { by: "HkTitleBar" } }),
    );

    expect(
      document.documentElement.getAttribute("data-hk-boot-chrome"),
    ).toBe("claimed");
    expect(bar()!.style.opacity).toBe("0");
    expect(bar()!.style.pointerEvents).toBe("none");

    vi.advanceTimersByTime(200);
    expect(bar()).toBeNull();
    expect(
      document.documentElement.style.getPropertyValue("--hk-boot-chrome-h"),
    ).toBe("");
    // The injected stylesheet leaves with the bar (no orphan <style> in <head>).
    expect(document.getElementById("hk-boot-chrome-style")).toBeNull();
    expect(bootChromeHandle().isActive()).toBe(false);
  });

  it("keeps the bar (and its close button) when nothing ever claims", () => {
    useWindowApi(fakeWindowApi());
    setGlobal("__TAURI_INTERNALS__", { invoke: vi.fn() });
    runBootChrome({ hangMs: 60000 });

    vi.advanceTimersByTime(30000);
    expect(bar()).not.toBeNull();
    expect(control("close").disabled).toBe(false);
  });

  it("says so and offers reload after the hang watchdog fires", () => {
    useWindowApi(fakeWindowApi());
    setGlobal("__TAURI_INTERNALS__", { invoke: vi.fn() });
    const reload = vi.spyOn(window.location, "reload").mockImplementation(() => undefined);
    runBootChrome({ hangMs: 1200 });

    vi.advanceTimersByTime(1200);

    expect(
      document.documentElement.getAttribute("data-hk-boot-chrome"),
    ).toBe("hung");
    expect(statusText()).toBe("Still loading\u2026");
    expect(control("reload")).toBeTruthy();
    expect(control("reload").textContent).toContain("Reload");
    // Closing must stay possible, always.
    expect(control("close").disabled).toBe(false);

    control("reload").click();
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it("exposes setStatus / dismiss / ready on window.HkBootChrome", async () => {
    useWindowApi(fakeWindowApi());
    setGlobal("__TAURI_INTERNALS__", { invoke: vi.fn() });
    runBootChrome();

    await expect(bootChromeHandle().ready).resolves.toBe(true);
    bootChromeHandle().setStatus("connecting\u2026");
    expect(statusText()).toBe("connecting\u2026");

    bootChromeHandle().dismiss();
    vi.advanceTimersByTime(200);
    expect(bar()).toBeNull();
    expect(bootChromeHandle().isActive()).toBe(false);
    // A late claim after the handoff is a no-op, not a crash.
    expect(() =>
      window.dispatchEvent(new CustomEvent("hk:chrome-claim")),
    ).not.toThrow();
  });

  it("localizes its copy through the stored/app locale", () => {
    localStorage.setItem("shittim-locale", "zh-Hans");
    setGlobal("__TAURI_INTERNALS__", {});
    runBootChrome();

    expect(statusText()).toBe("\u6b63\u5728\u52a0\u8f7d\u2026");
    vi.advanceTimersByTime(5000);
    expect(statusText()).toBe("\u7a97\u53e3\u63a7\u5236\u4e0d\u53ef\u7528");
    expect(control("minimize").getAttribute("aria-label")).toBe("\u6700\u5c0f\u5316");
    expect(control("close").getAttribute("aria-label")).toBe("\u5173\u95ed");
  });
});

describe("boot-chrome.js shell failures (S2-5)", () => {
  it("degrades visibly when the shell refuses minimize (missing ACL grant)", async () => {
    const invoke = vi.fn((command: string) =>
      command === WINDOW_IPC.isMaximized
        ? Promise.resolve(false)
        : Promise.reject(
            new Error(
              "window.minimize not allowed. Permissions associated with this command: core:window:allow-minimize",
            ),
          ),
    );
    setGlobal("__TAURI_INTERNALS__", { invoke });
    runBootChrome();

    expect(bar()!.getAttribute("data-hk-available")).toBe("1");
    control("minimize").click();
    await flush();

    // The button must not keep pretending to work.
    expect(bar()!.getAttribute("data-hk-available")).toBe("0");
    expect(bar()!.getAttribute("data-hk-degraded")).toBe("1");
    expect(statusText()).toBe("Window controls unavailable");
    expect(control("minimize").disabled).toBe(true);
    expect(control("maximize").disabled).toBe(true);
    // ...while closing stays possible: it is the way out and the retry.
    expect(control("close").disabled).toBe(false);

    const handle = bootChromeHandle() as { lastError?: string | null };
    expect(String(handle.lastError)).toContain("minimize");
    expect(String(handle.lastError)).toContain("allow-minimize");
  });

  it("degrades when maximize is refused (separate handler branch)", async () => {
    const invoke = vi.fn((command: string) =>
      command === WINDOW_IPC.isMaximized
        ? Promise.resolve(false)
        : Promise.reject(new Error("window.toggle_maximize denied")),
    );
    setGlobal("__TAURI_INTERNALS__", { invoke });
    runBootChrome();

    control("maximize").click();
    await flush();

    expect(bar()!.getAttribute("data-hk-available")).toBe("0");
    expect(control("maximize").disabled).toBe(true);
    expect(control("close").disabled).toBe(false);
    expect(statusText()).toBe("Window controls unavailable");
    const handle = bootChromeHandle() as { lastError?: string | null };
    expect(String(handle.lastError)).toContain("maximize");
  });

  it("keeps close usable even when close itself is refused", async () => {
    const invoke = vi.fn((command: string) =>
      command === WINDOW_IPC.isMaximized
        ? Promise.resolve(false)
        : Promise.reject(new Error("denied")),
    );
    setGlobal("__TAURI_INTERNALS__", { invoke });
    runBootChrome();

    control("close").click();
    await flush();

    expect(bar()!.getAttribute("data-hk-available")).toBe("0");
    expect(control("close").disabled).toBe(false);
    expect(statusText()).toBe("Window controls unavailable");
    const handle = bootChromeHandle() as { lastError?: string | null };
    expect(String(handle.lastError)).toContain("close");
  });

  it("does not let the boot watchdog mask the controls failure (S3-2)", () => {
    // No driver at all: the retry budget expires and the bar says so.
    setGlobal("__TAURI_INTERNALS__", {});
    runBootChrome({ hangMs: 6000 });

    vi.advanceTimersByTime(5000);
    expect(statusText()).toBe("Window controls unavailable");

    vi.advanceTimersByTime(1000);
    // The reload affordance still appears, but the actionable copy stays.
    expect(control("reload")).not.toBeNull();
    expect(statusText()).toBe("Window controls unavailable");
  });

  it("keeps the degraded copy when a refused command precedes the watchdog", async () => {
    const invoke = vi.fn((command: string) =>
      command === WINDOW_IPC.isMaximized
        ? Promise.resolve(false)
        : Promise.reject(new Error("denied")),
    );
    setGlobal("__TAURI_INTERNALS__", { invoke });
    runBootChrome({ hangMs: 1000 });

    control("minimize").click();
    await flush();
    vi.advanceTimersByTime(1000);

    expect(document.querySelector('button[data-act="reload"]')).not.toBeNull();
    expect(statusText()).toBe("Window controls unavailable");
  });
});

describe("boot-chrome.js teardown (S3-1)", () => {
  it("dismiss() marks the handoff and drops the injected stylesheet", () => {
    useWindowApi(fakeWindowApi());
    setGlobal("__TAURI_INTERNALS__", { invoke: vi.fn() });
    runBootChrome();

    expect(document.getElementById("hk-boot-chrome-style")).not.toBeNull();
    bootChromeHandle().dismiss();

    expect(
      document.documentElement.getAttribute("data-hk-boot-chrome"),
    ).toBe("claimed");

    vi.advanceTimersByTime(200);
    expect(bar()).toBeNull();
    expect(document.getElementById("hk-boot-chrome-style")).toBeNull();
  });
});

describe("boot-chrome.js ↔ runtime/windowChrome parity", () => {
  // The boot bar (classic script) and the Vue components (TS) must wire the
  // SAME shell commands in the SAME order. The components import WINDOW_IPC;
  // the script hard-codes the strings, so this test is the anti-drift gate.
  it("carries every IPC command name the shared resolver uses", () => {
    for (const command of Object.values(WINDOW_IPC)) {
      expect(SOURCE, `boot-chrome.js must carry ${command}`).toContain(command);
    }
  });

  it("probes the documented __TAURI__ API before the IPC fallback", () => {
    const driver = SOURCE.slice(SOURCE.indexOf("function buildDriver"));
    expect(driver).not.toBe("");
    expect(driver.indexOf("currentWindowApi()")).toBeGreaterThanOrEqual(0);
    expect(driver.indexOf("invokeApi()")).toBeGreaterThanOrEqual(0);
    expect(driver.indexOf("currentWindowApi()")).toBeLessThan(
      driver.indexOf("invokeApi()"),
    );
  });

  it("pins the Tauri 2.12 command names on the TS side too", () => {
    // Guards a rename on the TS side: the containment loop above would happily
    // follow a typo'd WINDOW_IPC constant if it leaked into the script.
    expect(WINDOW_IPC.minimize).toBe("plugin:window|minimize");
    expect(WINDOW_IPC.toggleMaximize).toBe("plugin:window|toggle_maximize");
    expect(WINDOW_IPC.close).toBe("plugin:window|close");
    expect(WINDOW_IPC.isMaximized).toBe("plugin:window|is_maximized");
  });
});
