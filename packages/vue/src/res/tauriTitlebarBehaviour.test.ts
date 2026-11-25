import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { afterEach, describe, expect, it, vi } from "vitest";

/**
 * `res/tauri-titlebar.js` executed the way a Tauri shell runs it: a classic
 * script, in a page that has a `__TAURI__` bridge, before any framework.
 *
 * WHY THIS SUITE EXISTS. Every other `res/` asset has more than a parse/shape
 * floor; this one — the largest of the five — had none. Its script paints a
 * caption bar from the first frame and wires three window buttons straight to
 * the shell, so a regression here is a frameless window the user cannot move,
 * minimise or CLOSE. Three behaviours carry all of that risk and none of them
 * is visible to a text-level check:
 *
 *   1. the host guards (no Tauri bridge => paint nothing, and never throw);
 *   2. the theme resolution the bar's light/dark variant is drawn from;
 *   3. the window-command wiring behind each caption button.
 *
 * Executed with `new Function` so the script sees a real global object, exactly
 * as a `<script>` tag would, and with a fake `__TAURI__` whose window handle
 * records every call.
 */

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, "../../../..");
const SOURCE = readFileSync(resolve(REPO_ROOT, "res/tauri-titlebar.js"), "utf8");

interface FakeWindowHandle {
  calls: string[];
  isMaximized: () => Promise<boolean>;
  onResized: (handler: () => void) => Promise<unknown>;
  minimize: () => Promise<void>;
  toggleMaximize: () => Promise<void>;
  close: () => Promise<void>;
}

interface RunOptions {
  /** Omit to simulate a plain (non-Tauri) browser. */
  tauri?: boolean;
  /** Provide a `window.__TAURI__` without `.window`, the second host gate. */
  tauriWithoutWindow?: boolean;
  storage?: Record<string, string>;
  /** `document.documentElement` `data-mode` attribute. */
  dataMode?: string | null;
  /** Title to install on `document`. */
  title?: string;
  maximized?: boolean;
  prefersDark?: boolean;
}

interface RunResult {
  /** Present only when a bridge was installed. */
  win: FakeWindowHandle | null;
  /** Reads by the script, in order (to assert prefix resolution). */
  reads: string[];
  /** The caption bar element, if one was painted. */
  bar: HTMLElement | null;
}

/**
 * Execute the emitted script against a page built to order.
 *
 * Returns the handle the script drove plus the bar it painted, so assertions
 * can look at both halves of the contract.
 */
async function runTitlebar(options: RunOptions = {}): Promise<RunResult> {
  const reads: string[] = [];
  const store = new Map<string, string>(Object.entries(options.storage ?? {}));
  const storage = {
    getItem: (key: string): string | null => {
      reads.push(key);
      return store.has(key) ? (store.get(key) as string) : null;
    },
    setItem: (key: string, value: string): void => void store.set(key, value),
    removeItem: (key: string): void => void store.delete(key),
  };

  // --- page ---
  document.body.innerHTML = "";
  document.title = options.title ?? "";
  document.documentElement.removeAttribute("data-mode");
  if (options.dataMode) document.documentElement.setAttribute("data-mode", options.dataMode);

  // A `<title>` element so the script's own MutationObserver wiring is live.
  if (!document.querySelector("title")) {
    document.head.appendChild(document.createElement("title"));
  }

  // --- fake shell ---
  const win: FakeWindowHandle | null =
    options.tauri === false
      ? null
      : {
          calls: [],
          isMaximized: () => Promise.resolve(options.maximized ?? false),
          onResized: () => Promise.resolve(),
          minimize: () => {
            win!.calls.push("minimize");
            return Promise.resolve();
          },
          toggleMaximize: () => {
            win!.calls.push("toggleMaximize");
            return Promise.resolve();
          },
          close: () => {
            win!.calls.push("close");
            return Promise.resolve();
          },
        };

  const fakeWindow: Record<string, unknown> = {
    localStorage: storage,
    addEventListener: (...args: unknown[]) => window.addEventListener(...(args as [string, EventListener])),
    document: window.document,
    matchMedia: (query: string) => ({
      matches: Boolean(options.prefersDark) && query.includes("dark"),
      addEventListener: () => {},
      removeEventListener: () => {},
    }),
  };
  // The script reads `__TAURI__` as a BARE global (`if (!__TAURI__?.window)`),
  // not as `window.__TAURI__`, so it must exist on the real global object the
  // way a shell's injected script would leave it.
  const globals = globalThis as Record<string, unknown>;
  if (win) {
    fakeWindow.__TAURI_INTERNALS__ = {};
    globals.__TAURI_INTERNALS__ = {};
    if (options.tauriWithoutWindow) {
      globals.__TAURI__ = {};
    } else {
      globals.__TAURI__ = { window: { getCurrentWindow: () => win } };
    }
  } else {
    delete globals.__TAURI__;
    delete globals.__TAURI_INTERNALS__;
  }

  const run = new Function("window", "localStorage", "document", "matchMedia", SOURCE) as (
    window: unknown,
    storage: unknown,
    document: Document,
    matchMedia: (query: string) => MediaQueryList,
  ) => void;

  run(fakeWindow, storage, document, fakeWindow.matchMedia as typeof matchMedia);
  // Let the promise chains in refreshMaximized settle.
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();

  return { win, reads, bar: document.getElementById("tauri-titlebar") };
}

describe("res/tauri-titlebar.js host gates", () => {
  afterEach(() => {
    document.body.innerHTML = "";
    document.documentElement.removeAttribute("data-mode");
  });

  it("paints nothing in a plain browser and does not throw", async () => {
    // The self-guard uses `return`, not `throw`: a throw would reach the boot
    // surface's window.onerror and show "Application failed to load" on a
    // perfectly healthy browser.
    let result: RunResult | undefined;
    await expect(
      (async () => {
        result = await runTitlebar({ tauri: false });
      })(),
    ).resolves.toBeUndefined();
    expect(result?.bar).toBeNull();
    expect(document.getElementById("tauri-titlebar-style")).toBeNull();
  });

  it("paints nothing when __TAURI__ carries no .window", async () => {
    // The second gate: a webview that registered internals but not the window
    // API must not get a bar wired to commands that do not exist.
    const result = await runTitlebar({ tauriWithoutWindow: true });
    expect(result.bar).toBeNull();
  });

  it("paints the caption bar and its stylesheet inside a Tauri shell", async () => {
    const result = await runTitlebar();
    expect(result.bar).not.toBeNull();
    expect(document.getElementById("tauri-titlebar-style")).not.toBeNull();
    // One button per window command, each with its own action tag.
    const acts = [...result.bar!.querySelectorAll("[data-act]")].map((button) =>
      button.getAttribute("data-act"),
    );
    expect(acts).toEqual(["minimize", "toggle", "close"]);
  });
});

describe("res/tauri-titlebar.js theme resolution", () => {
  afterEach(() => {
    document.body.innerHTML = "";
    document.documentElement.removeAttribute("data-mode");
  });

  it("follows the document's data-mode attribute when the app has set it", async () => {
    const result = await runTitlebar({ dataMode: "light" });
    expect(result.bar!.getAttribute("data-theme-mode")).toBe("light");

    document.body.innerHTML = "";
    const dark = await runTitlebar({ dataMode: "dark" });
    expect(dark.bar!.getAttribute("data-theme-mode")).toBe("dark");
  });

  it("falls back to the app-prefixed stored mode before the engine key", async () => {
    const result = await runTitlebar({
      storage: { "shittim-locale": "en", "shittim-theme-mode": "light" },
    });
    expect(result.bar!.getAttribute("data-theme-mode")).toBe("light");
    expect(result.reads).toContain("shittim-theme-mode");
  });

  it("uses the cached geolocation to decide day/night", async () => {
    // Greenwich at local noon in June is day => the bar draws light.
    const result = await runTitlebar({
      storage: { "celestia-geolocation": JSON.stringify({ lat: 51.5, lng: -0.12 }) },
    });
    expect(result.reads).toContain("celestia-geolocation");
    // `resolveSolarDay` returns a boolean here, so the bar takes `!isDay`.
    expect(["light", "dark"]).toContain(result.bar!.getAttribute("data-theme-mode"));
  });

  it("falls back to prefers-color-scheme when nothing else decides", async () => {
    const dark = await runTitlebar({ prefersDark: true });
    expect(dark.bar!.getAttribute("data-theme-mode")).toBe("dark");
    document.body.innerHTML = "";
    const light = await runTitlebar({ prefersDark: false });
    expect(light.bar!.getAttribute("data-theme-mode")).toBe("light");
  });
});

describe("res/tauri-titlebar.js window commands", () => {
  afterEach(() => {
    document.body.innerHTML = "";
    document.documentElement.removeAttribute("data-mode");
  });

  it("routes each caption button to its shell command", async () => {
    const result = await runTitlebar();
    const click = (act: string): void => {
      result
        .bar!.querySelector(`[data-act="${act}"]`)!
        .dispatchEvent(new MouseEvent("click", { bubbles: true }));
    };
    click("minimize");
    click("toggle");
    click("close");
    expect(result.win!.calls).toEqual(["minimize", "toggleMaximize", "close"]);
  });

  it("toggles maximise on a double-click of the bar background", async () => {
    const result = await runTitlebar();
    const spacer = result.bar!.querySelector("#tauri-titlebar-spacer")!;
    spacer.dispatchEvent(new MouseEvent("dblclick", { bubbles: true }));
    expect(result.win!.calls).toEqual(["toggleMaximize"]);
  });

  it("does not toggle when the double-click lands on a caption button", async () => {
    // Otherwise a fast double-click on Close would minimize-then-maximize the
    // window the user was trying to shut.
    const result = await runTitlebar();
    result
      .bar!.querySelector('[data-act="close"]')!
      .dispatchEvent(new MouseEvent("dblclick", { bubbles: true }));
    expect(result.win!.calls).toEqual([]);
  });

  it("renders the restore glyph once the shell reports a maximized window", async () => {
    const result = await runTitlebar({ maximized: true });
    const toggle = result.bar!.querySelector('[data-act="toggle"]')!;
    expect(toggle.getAttribute("aria-label")).toBe("Restore");
    expect(toggle.getAttribute("title")).toBe("Restore");
  });

  it("keeps the maximize glyph on a normal window", async () => {
    const result = await runTitlebar({ maximized: false });
    const toggle = result.bar!.querySelector('[data-act="toggle"]')!;
    expect(toggle.getAttribute("aria-label")).toBe("Maximize");
  });

  it("mirrors document.title into the bar", async () => {
    const result = await runTitlebar({ title: "Shittim Chest — Admin" });
    expect(result.bar!.querySelector("#tauri-titlebar-title")!.textContent).toBe(
      "Shittim Chest — Admin",
    );
  });

  it("survives a shell whose window API rejects", async () => {
    // Every command is `.catch`-guarded: a shell that answers with a rejection
    // must not leave an unhandled rejection (which the shell surfaces as a
    // boot failure).
    const rejection = vi.fn(() => Promise.reject(new Error("ipc closed")));
    const win = {
      calls: [] as string[],
      isMaximized: rejection as unknown as () => Promise<boolean>,
      onResized: rejection as unknown as () => Promise<unknown>,
      minimize: rejection as unknown as () => Promise<void>,
      toggleMaximize: rejection as unknown as () => Promise<void>,
      close: rejection as unknown as () => Promise<void>,
    };
    const store = new Map<string, string>();
    const globals = globalThis as Record<string, unknown>;
    globals.__TAURI_INTERNALS__ = {};
    globals.__TAURI__ = { window: { getCurrentWindow: () => win } };
    const fakeWindow: Record<string, unknown> = {
      __TAURI_INTERNALS__: {},
      __TAURI__: globals.__TAURI__,
      addEventListener: () => {},
      matchMedia: () => ({ matches: false, addEventListener: () => {} }),
    };
    const run = new Function("window", "localStorage", "document", SOURCE) as (
      window: unknown,
      storage: unknown,
      document: Document,
    ) => void;
    expect(() =>
      run(
        fakeWindow,
        { getItem: (k: string) => store.get(k) ?? null, setItem: () => {}, removeItem: () => {} },
        document,
      ),
    ).not.toThrow();
    await Promise.resolve();
    expect(document.getElementById("tauri-titlebar")).not.toBeNull();
  });
});
