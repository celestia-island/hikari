import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { afterEach, describe, expect, it, vi } from "vitest";

/**
 * Behaviour suites for the three small pre-paint assets: `browser-check.js`,
 * `os-prefs.js` and `loader-dismiss.js`.
 *
 * These are the siblings of `theme-loader` (covered by
 * `themeLoaderBehaviour.test.ts`) and `tauri-titlebar` (covered by
 * `tauriTitlebarBehaviour.test.ts`). They are much smaller — 68, 62 and 11 lines
 * of authored source — but each makes ONE decision that a shape/parse floor
 * cannot see, and each decision is user-visible:
 *
 *   - `browser-check` decides whether the host blocks the app at all, and it
 *     silently does nothing without a `__appBlock` handler;
 *     MUT:hk-1565-safari-floor — lowering the Safari floor to 15.0 in the
 *     source makes the 15.3 case pass and the floor assertion goes red.
 *   - `os-prefs` decides whether the Tauri shell's OS locale/theme seed wins
 *     over what the user already stored;
 *   - `loader-dismiss` decides whether the loading screen ever goes away.
 *
 * All three are executed with `new Function` against a page built to order.
 */

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, "../../../..");
const read = (name: string): string => readFileSync(resolve(REPO_ROOT, "res", name), "utf8");

const BROWSER_CHECK = read("browser-check.js");
const OS_PREFS = read("os-prefs.js");
const LOADER_DISMISS = read("loader-dismiss.js");

/** Run a classic script with the globals it expects, returning nothing else. */
function execute(
  source: string,
  globals: Record<string, unknown>,
  paramNames: readonly string[],
): void {
  const run = new Function(...paramNames, source) as (...args: unknown[]) => void;
  run(...paramNames.map((name) => globals[name]));
}

describe("res/browser-check.js", () => {
  /** Drive `detect()` through a UA string and report what `__appBlock` saw. */
  function check(userAgent: string, extra: Record<string, unknown> = {}) {
    const block = vi.fn();
    const navigator = { userAgent, platform: "Linux x86_64", maxTouchPoints: 0, ...extra };
    const fakeWindow: Record<string, unknown> = { __appBlock: block };
    execute(BROWSER_CHECK, { navigator, window: fakeWindow }, ["navigator", "window"]);
    return block;
  }

  it("blocks a browser below the floor, naming it and both versions", () => {
    const block = check("Mozilla/5.0 Chrome/80.0.0.0 Safari/537.36");
    expect(block).toHaveBeenCalledTimes(1);
    expect(block).toHaveBeenCalledWith("Chrome", 80, 100);
  });

  it("lets a browser at the floor through", () => {
    expect(check("Mozilla/5.0 Chrome/100.0.0.0 Safari/537.36")).not.toHaveBeenCalled();
  });

  it("treats Safari's minor version as significant", () => {
    // Safari 15.3 is below the 15.4 floor while 15.4 is exactly at it; a
    // major-only comparison would wave the older one through.
    expect(check("Mozilla/5.0 Version/15.3 Safari/605.1.15")).toHaveBeenCalledWith(
      "Safari",
      15.3,
      15.4,
    );
    expect(check("Mozilla/5.0 Version/15.4 Safari/605.1.15")).not.toHaveBeenCalled();
  });

  it("identifies iOS from a desktop-class iPad", () => {
    // iPadOS reports a MacIntel platform with touch points instead of an iPad UA.
    const block = check("Mozilla/5.0 Version/15.0 Mobile/15E148 Safari/604.1", {
      platform: "MacIntel",
      maxTouchPoints: 5,
    });
    expect(block).toHaveBeenCalledWith("Safari (iOS)", 15, 15.4);
  });

  it("checks vendor prefixes before the generic engines", () => {
    // Edge's UA also contains "Chrome"; Samsung's contains "Chrome"; OPR's too.
    expect(check("Mozilla/5.0 Chrome/99 Edg/99")).toHaveBeenCalledWith("Edge", 99, 100);
    expect(check("Mozilla/5.0 Chrome/90 SamsungBrowser/16")).toHaveBeenCalledWith(
      "Samsung Internet",
      16,
      17,
    );
    expect(check("Mozilla/5.0 Chrome/90 OPR/85")).toHaveBeenCalledWith("Opera", 85, 86);
  });

  it("does nothing when the UA names no engine it knows", () => {
    const block = check("SomeCrawler/1.0");
    expect(block).not.toHaveBeenCalled();
  });

  it("does not throw when the host installed no __appBlock", () => {
    // The script calls `window.__appBlock` only if it is a function; a host that
    // forgot to wire the failure surface must still not get an exception.
    expect(() =>
      execute(
        BROWSER_CHECK,
        { navigator: { userAgent: "Chrome/50", platform: "Linux", maxTouchPoints: 0 }, window: {} },
        ["navigator", "window"],
      ),
    ).not.toThrow();
  });
});

describe("res/os-prefs.js", () => {
  /** Run the seed against a fresh store; report the store afterwards. */
  function seed(
    prefs: Record<string, unknown> | undefined,
    stored: Record<string, string> = {},
    native = true,
  ) {
    const store = new Map(Object.entries(stored));
    const storage = {
      getItem: (key: string) => (store.has(key) ? (store.get(key) as string) : null),
      setItem: (key: string, value: string) => void store.set(key, value),
      removeItem: (key: string) => void store.delete(key),
    };
    const fakeWindow: Record<string, unknown> = {};
    if (native) fakeWindow.__TAURI_INTERNALS__ = {};
    if (prefs) fakeWindow.__CELESTIA_OS_PREFS__ = prefs;
    execute(OS_PREFS, { window: fakeWindow, localStorage: storage }, [
      "window",
      "localStorage",
    ]);
    return store;
  }

  it("seeds the locale and theme mode from a Tauri shell", () => {
    const store = seed({ locale: "zh-CN", color_scheme: "dark" });
    expect(store.get("celestia-locale")).toBe("zh-Hans");
    expect(store.get("celestia-theme-mode")).toBe("dark");
  });

  it("maps traditional Chinese regions to zh-Hant", () => {
    for (const tag of ["zh-TW", "zh-HK", "zh-MO"]) {
      expect(seed({ locale: tag }).get("celestia-locale")).toBe("zh-Hant");
    }
    expect(seed({ locale: "zh-SG" }).get("celestia-locale")).toBe("zh-Hans");
  });

  it("ignores an unsupported OS locale instead of storing a guess", () => {
    const store = seed({ locale: "th-TH" });
    expect(store.has("celestia-locale")).toBe(false);
  });

  it("never overwrites a locale the user already chose", () => {
    const store = seed({ locale: "ja-JP" }, { "celestia-locale": "en" });
    expect(store.get("celestia-locale")).toBe("en");
  });

  it("replaces a stored 'system' theme mode with the OS scheme", () => {
    const store = seed({ color_scheme: "light" }, { "celestia-theme-mode": "system" });
    expect(store.get("celestia-theme-mode")).toBe("light");
  });

  it("respects an explicit stored dark mode over a light OS scheme", () => {
    const store = seed({ color_scheme: "light" }, { "celestia-theme-mode": "dark" });
    expect(store.get("celestia-theme-mode")).toBe("dark");
  });

  it("writes nothing in a plain browser", () => {
    // No `__TAURI_INTERNALS__` means no OS preferences exist to seed from.
    const store = seed({ locale: "ja-JP", color_scheme: "dark" }, {}, false);
    expect(store.size).toBe(0);
  });

  it("writes into the namespace an existing app already named", () => {
    const store = seed({ locale: "ko-KR" }, { "arona-locale": "en" });
    expect(store.get("arona-locale")).toBe("en");
  });

  it("does nothing when the shell published no preferences", () => {
    const store = seed(undefined);
    expect(store.size).toBe(0);
  });
});

describe("res/loader-dismiss.js", () => {
  afterEach(() => {
    document.body.innerHTML = "";
    vi.useRealTimers();
  });

  /** Run the script and return the global it installs. */
  function install(): (() => void) | undefined {
    const fakeWindow: Record<string, unknown> = {};
    execute(LOADER_DISMISS, { window: fakeWindow }, ["window"]);
    return fakeWindow.__loaderDismiss as (() => void) | undefined;
  }

  it("publishes the dismiss handle on window", () => {
    expect(typeof install()).toBe("function");
  });

  it("fades the loading screen out and then removes it", () => {
    vi.useFakeTimers();
    document.body.innerHTML = '<div id="loading-screen"></div>';
    const dismiss = install()!;
    const screen = document.getElementById("loading-screen")!;

    dismiss();
    expect(screen.classList.contains("fade-out")).toBe(true);
    // Still mounted during the fade; the consumer's CSS owns the animation.
    expect(document.getElementById("loading-screen")).not.toBeNull();

    vi.advanceTimersByTime(500);
    expect(document.getElementById("loading-screen")).toBeNull();
  });

  it("is a no-op when the page has no loading screen", () => {
    // Hosts with their own skeleton still load this file; it must not throw.
    const dismiss = install()!;
    expect(() => dismiss()).not.toThrow();
  });
});
