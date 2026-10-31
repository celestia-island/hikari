// @vitest-environment node
// AI-generated: developed with the DeepSeek Harness agent (model
// DeepSeek-Flash) and the ZCode agent (model GLM-5.3), directed and reviewed
// by langyo — SySL-1.0 §2.3 disclosure.

import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterAll, afterEach, describe, expect, it, vi } from "vitest";
import type { HtmlTagDescriptor } from "vite";
import { build } from "vite";

import {
  BOOT_RECOVERY_ATTR,
  BOOT_RECOVERY_CANONICAL_ORIGIN,
  BOOT_RECOVERY_DEADLINE_MS,
  BOOT_RECOVERY_DEFAULTS,
  BOOT_RECOVERY_DISMISSED_CLASS,
  BOOT_RECOVERY_LOADING_SELECTOR,
  BOOT_RECOVERY_MESSAGE,
  BOOT_RECOVERY_RETRY,
  bootRecoveryPlugin,
  bootRecoveryScript,
  isMangledOrigin,
} from "./boot-recovery.mjs";

/**
 * Boot recovery is hikari's last line of defence for the MAIN WINDOW.
 *
 * The 0.6.8 incident (reported against a host shell): WebView2's renderer died,
 * crash recovery reloaded the window on `http://tauri.localhostundefined/`, the
 * app bundle never loaded, the host's static loading screen stayed up forever
 * and the window could not even be closed. This file pins the two halves the
 * package ships:
 *
 *   1. `bootRecoveryScript` / `isMangledOrigin` — the pure predicate and the
 *      generated inline IIFE. The script is EXECUTED against a minimal fake
 *      page (the exact shipped string, no copied logic), so heal, refusal
 *      fall-through, watchdog paint, retry and the no-op paths are behaviour,
 *      not just string matches.
 *   2. `bootRecoveryPlugin` — the Vite injection face: `injectTo` default
 *      `head` (charset-prescan safe), classic inline script, multi-entry
 *      filter that warns once per skipped entry.
 *
 * Node environment on purpose: no DOM is needed — the script is an IIFE with no
 * imports whose only browser globals (location / document / setTimeout) are
 * parameters of the fake page below.
 */

const SCRIPT = bootRecoveryScript();

const temps: string[] = [];

afterEach(() => {
  vi.restoreAllMocks();
});

afterAll(() => {
  for (const dir of temps.splice(0)) {
    try {
      rmSync(dir, { recursive: true, force: true });
    } catch {
      /* a leftover temp dir must not fail the suite */
    }
  }
});

/** Invoke the plugin's transformIndexHtml hook with a fake file context. */
function tags(
  plugin: ReturnType<typeof bootRecoveryPlugin>,
  filename = "/app/index.html",
  context: { warn?: (message: string) => void } = {},
): HtmlTagDescriptor[] {
  const hook = plugin.transformIndexHtml as unknown as (
    html: string,
    ctx: { filename: string },
  ) => HtmlTagDescriptor[] | undefined;
  return hook.call(context, "<!doctype html><html><body></body></html>", { filename }) ?? [];
}

// ── fake page harness ──────────────────────────────────────────────────────
// The generated script only reaches for three globals. Passing fakes as
// Function parameters shadows Node's (absent) globals, so the REAL shipped
// script runs unmodified — no copied logic, no drift.

interface FakeNode {
  tag: string;
  className: string;
  textContent: string;
  type?: string;
  attributes: Record<string, string>;
  children: FakeNode[];
  listeners: Record<string, Array<() => void>>;
  classList: { contains: (name: string) => boolean };
  setAttribute: (name: string, value: string) => void;
  appendChild: (child: FakeNode) => void;
  addEventListener: (type: string, listener: () => void) => void;
}

function fakeNode(tag: string, classes: string[] = []): FakeNode {
  const node: FakeNode = {
    tag,
    className: "",
    textContent: "",
    attributes: {},
    children: [],
    listeners: {},
    classList: { contains: (name) => classes.indexOf(name) !== -1 },
    setAttribute(name, value) {
      node.attributes[name] = value;
    },
    appendChild(child) {
      node.children.push(child);
    },
    addEventListener(type, listener) {
      (node.listeners[type] ??= []).push(listener);
    },
  };
  return node;
}

function mustFind(nodes: FakeNode[], tag: string): FakeNode {
  const found = nodes.find((node) => node.tag === tag);
  if (!found) throw new Error("the failure panel has no <" + tag + ">");
  return found;
}

interface FakeLocation {
  protocol: string;
  hostname: string;
  replace: (url: string) => void;
  reload: () => void;
}

interface FakeDocument {
  querySelector: (selector: string) => FakeNode | null;
  createElement: (tag: string) => FakeNode;
}

type FakeSetTimeout = (callback: () => void, ms: number) => number;

interface RecoveryRun {
  replaced: string[];
  /** Live read: the counter is mutated by button clicks after the run. */
  readonly reloads: number;
  timers: Array<{ callback: () => void; ms: number }>;
  /** The fake loading element (null = absent, i.e. the host removed it). */
  loading: FakeNode | null;
  location: FakeLocation;
  /** Selectors the script asked the fake document for, in order. */
  queried: string[];
}

/** A page the generated script can run against. */
interface FakePage {
  protocol?: string;
  hostname?: string;
  /** `absent` = the app mounted and removed the loader. */
  loader?: "present" | "absent";
  /** Classes the loading element carries (e.g. the dismissal marker). */
  loaderClasses?: string[];
  /** Which selectors the fake document matches (default: just the shipped default). */
  matchesSelector?: (selector: string) => boolean;
  /** Simulate a refused navigation: location.replace records the attempt, then throws. */
  replaceThrows?: boolean;
  /** The script to execute (default: the shipped default script). */
  script?: string;
}

/**
 * Run a generated script once against a synthetic page.
 *
 * `bootRecoveryScript(options)` is called by the test (not by this helper) so
 * every option-driven case runs the exact bytes the plugin would inject.
 */
function runRecovery(page: FakePage = {}): RecoveryRun {
  const replaced: string[] = [];
  const queried: string[] = [];
  let reloads = 0;
  const timers: Array<{ callback: () => void; ms: number }> = [];

  const loading =
    page.loader === "absent" ? null : fakeNode("div", page.loaderClasses ?? []);
  if (loading) loading.textContent = "Loading…"; // the host's static placeholder

  const matches =
    page.matchesSelector ?? ((selector: string) => selector === BOOT_RECOVERY_LOADING_SELECTOR);

  const location: FakeLocation = {
    protocol: page.protocol ?? "http:",
    hostname: page.hostname ?? "tauri.localhost",
    replace: (url) => {
      replaced.push(url);
      if (page.replaceThrows) throw new Error("navigation refused");
    },
    reload: () => {
      reloads += 1;
    },
  };

  const fakeDocument: FakeDocument = {
    querySelector: (selector) => {
      queried.push(selector);
      return matches(selector) ? loading : null;
    },
    createElement: (tag) => fakeNode(tag),
  };

  const fakeSetTimeout: FakeSetTimeout = (callback, ms) => {
    timers.push({ callback, ms });
    return timers.length;
  };

  const script = page.script ?? SCRIPT;
  const run = new Function(
    "location",
    "document",
    "setTimeout",
    script,
  ) as (
    location: FakeLocation,
    document: FakeDocument,
    setTimeout: FakeSetTimeout,
  ) => void;
  run(location, fakeDocument, fakeSetTimeout);

  return {
    replaced,
    timers,
    loading,
    location,
    queried,
    get reloads() {
      return reloads;
    },
  };
}

/** The panel's button, if a panel was painted into the fake loader. */
function panelButton(run: RecoveryRun): FakeNode {
  const panel = mustFind(run.loading?.children ?? [], "div");
  return mustFind(panel.children, "button");
}

/** Click every listener the button carries (the generated script registers one). */
function clickButton(button: FakeNode): void {
  for (const listener of button.listeners.click ?? []) listener();
}

// ── defaults and the pure predicate ────────────────────────────────────────

describe("defaults", () => {
  it("pins the canonical origin, deadline and loading-screen defaults", () => {
    expect(BOOT_RECOVERY_CANONICAL_ORIGIN).toBe("http://tauri.localhost");
    expect(BOOT_RECOVERY_DEADLINE_MS).toBe(15000);
    expect(BOOT_RECOVERY_LOADING_SELECTOR).toBe("#loading-screen");
    expect(BOOT_RECOVERY_DISMISSED_CLASS).toBe("hidden");
    expect(BOOT_RECOVERY_ATTR).toBe("data-hk-boot-recovery");
  });

  it("exposes one frozen defaults snapshot", () => {
    expect(BOOT_RECOVERY_DEFAULTS).toMatchObject({
      canonicalOrigin: "http://tauri.localhost",
      deadlineMs: 15000,
      loadingScreen: { selector: "#loading-screen", dismissedClass: "hidden" },
      copy: { message: BOOT_RECOVERY_MESSAGE, retry: BOOT_RECOVERY_RETRY },
      injectTo: "head",
    });
    expect(Object.isFrozen(BOOT_RECOVERY_DEFAULTS)).toBe(true);
    expect(Object.isFrozen(BOOT_RECOVERY_DEFAULTS.loadingScreen)).toBe(true);
    expect(Object.isFrozen(BOOT_RECOVERY_DEFAULTS.copy)).toBe(true);
  });
});

describe("isMangledOrigin", () => {
  it("accepts the healthy http(s) app origin", () => {
    expect(isMangledOrigin("http:", "tauri.localhost")).toBe(false);
    expect(isMangledOrigin("https:", "tauri.localhost")).toBe(false);
  });

  it("catches the observed crash-recovery host and its suffix variants", () => {
    // The exact incident value: the embedded asset handler still serves it, but
    // every relative asset URL and the IPC channel resolve against the wrong
    // origin. Any host that merely STARTS WITH the app host is the same class
    // of recovery debris.
    expect(isMangledOrigin("http:", "tauri.localhostundefined")).toBe(true);
    expect(isMangledOrigin("https:", "tauri.localhostundefined")).toBe(true);
    expect(isMangledOrigin("http:", "tauri.localhost.")).toBe(true);
    expect(isMangledOrigin("http:", "tauri.localhostx")).toBe(true);
  });

  it("leaves every legitimate non-app origin alone", () => {
    const allowed: Array<[string, string]> = [
      // Vite dev server and plain browser tabs.
      ["http:", "127.0.0.1"],
      ["http:", "localhost"],
      ["http:", "example.com"],
      // The asset/media custom hosts Tauri webviews also talk to.
      ["http:", "asset.localhost"],
      ["http:", "media.localhost"],
      // A host that merely CONTAINS the app host is not recovery debris.
      ["http:", "not-tauri.localhost"],
    ];
    for (const [protocol, hostname] of allowed) {
      expect(isMangledOrigin(protocol, hostname), protocol + "//" + hostname).toBe(false);
    }
  });

  it("never redirects the tauri:// origins macOS/Linux use", () => {
    // Same hostname string, different URL space: an http redirect would throw
    // away the scheme the platform actually uses.
    expect(isMangledOrigin("tauri:", "localhost")).toBe(false);
    expect(isMangledOrigin("tauri:", "tauri.localhostundefined")).toBe(false);
    expect(isMangledOrigin("tauri:", "tauri.localhost")).toBe(false);
    // ...and no other scheme is an app origin either.
    expect(isMangledOrigin("file:", "tauri.localhostundefined")).toBe(false);
    expect(isMangledOrigin("chrome-extension:", "tauri.localhostundefined")).toBe(false);
  });

  it("supports a host-specific canonical origin (generic predicate)", () => {
    expect(isMangledOrigin("https:", "app.example", "https://app.example")).toBe(false);
    expect(isMangledOrigin("http:", "app.examplex", "https://app.example")).toBe(true);
    // The default host is NOT special-cased for a custom canonical origin.
    expect(isMangledOrigin("http:", "tauri.localhostundefined", "https://app.example")).toBe(false);
  });
});

// ── the generated script's content contract ────────────────────────────────

describe("the generated inline recovery script", () => {
  it("embeds the canonical origin, the heuristic hostname and the deadline", () => {
    expect(SCRIPT).toContain(JSON.stringify(BOOT_RECOVERY_CANONICAL_ORIGIN));
    expect(SCRIPT).toContain('"tauri.localhost"');
    expect(SCRIPT).toContain(String(BOOT_RECOVERY_DEADLINE_MS));
    // The heal target is the origin plus the app root path.
    expect(SCRIPT).toContain('CANONICAL_ORIGIN + "/"');
  });

  it("is a single classic IIFE: no imports, no inline HTML, no markup parsing", () => {
    expect(SCRIPT.startsWith("(function () {")).toBe(true);
    expect(SCRIPT.endsWith("})();")).toBe(true);
    // A classic inline script must survive HTML serialization: a literal
    // "</script" (case-insensitive) or "<!--" would end / comment out the tag.
    expect(SCRIPT.toLowerCase()).not.toContain("</script");
    expect(SCRIPT).not.toContain("<!--");
    expect(SCRIPT).not.toContain("import ");
    // The panel is assembled with DOM APIs and textContent only.
    expect(SCRIPT).not.toContain("innerHTML");
    expect(SCRIPT).not.toContain("outerHTML");
    // The option values are JSON-escaped into the builder; no template
    // placeholder may leak into the generated text.
    expect(SCRIPT).not.toContain(String.fromCharCode(36) + "{");
  });

  it("is ASCII-only (hosts may hash it as bytes; text/html may lack a charset)", () => {
    const foreign = [...SCRIPT].filter((char) => {
      const code = char.charCodeAt(0);
      return code !== 9 && code !== 10 && (code < 32 || code > 126);
    });
    expect(foreign).toEqual([]);
  });

  it("reads no page input beyond the protocol and hostname", () => {
    // No path/query/hash/URL is consumed, so a crafted link cannot steer the
    // heal target or the panel copy.
    expect(SCRIPT).not.toMatch(
      /location\.(?:pathname|search|hash|href|origin|port|username|password)/,
    );
    expect(SCRIPT).not.toMatch(/localStorage|sessionStorage|document\.cookie/);
    // The only URL literal in the whole script is the canonical origin.
    expect(SCRIPT.match(/https?:\/\/[^\s"']+/g) ?? []).toEqual([
      BOOT_RECOVERY_CANONICAL_ORIGIN,
    ]);
  });

  it("arms exactly one watchdog and navigates exactly once per path", () => {
    // The reload belongs to the panel button; the watchdog itself never
    // reloads, so a build that never mounts cannot enter a reload loop.
    expect(SCRIPT.match(/location\.reload\(/g) ?? []).toHaveLength(1);
    expect(SCRIPT.match(/location\.replace\(/g) ?? []).toHaveLength(1);
    expect(SCRIPT.match(/setTimeout\(/g) ?? []).toHaveLength(1);
  });

  it("is deterministic: same options, byte-identical text", () => {
    expect(bootRecoveryScript()).toBe(SCRIPT);
    expect(bootRecoveryScript({})).toBe(SCRIPT);
    const custom = { deadlineMs: 9000, copy: { message: "Try again", retry: "Retry" } };
    expect(bootRecoveryScript(custom)).toBe(bootRecoveryScript(custom));
  });

  it("keeps a heal-only script free of every timer and reload path", () => {
    const healOnly = bootRecoveryScript({ loadingScreen: false });
    expect(healOnly.includes("setTimeout(")).toBe(false);
    expect(healOnly.includes("location.reload(")).toBe(false);
    expect(healOnly.match(/location\.replace\(/g) ?? []).toHaveLength(1);
    expect(healOnly.includes("#loading-screen")).toBe(false);
  });

  it("embeds custom copy, deadline, selector and dismissed class", () => {
    const custom = bootRecoveryScript({
      deadlineMs: 9000,
      loadingScreen: { selector: ".boot-loader", dismissedClass: "is-gone" },
      copy: { message: "Boot failed", retry: "Retry boot" },
    });
    expect(custom).toContain("9000");
    expect(custom).toContain('".boot-loader"');
    expect(custom).toContain('"is-gone"');
    expect(custom).toContain('"Boot failed"');
    expect(custom).toContain('"Retry boot"');
    expect(custom).not.toContain("#loading-screen");
  });

  it("embeds a custom canonical origin and predicate source", () => {
    const custom = bootRecoveryScript({
      canonicalOrigin: "https://app.example",
      isMangledOrigin: (protocol, hostname) =>
        protocol === "https:" && hostname === "evil.example",
    });
    expect(custom).toContain('"https://app.example"');
    expect(custom).toContain('hostname === "evil.example"');
    // Custom canonical origin is the only URL literal.
    expect(custom.match(/https?:\/\/[^\s"']+/g) ?? []).toEqual(["https://app.example"]);
  });

  it("escapes non-ASCII and tag-breaking copy instead of breaking the contract", () => {
    const custom = bootRecoveryScript({
      copy: { message: "加载失败 — </script><b>x</b>", retry: "重试" },
    });
    // Still ASCII, still no literal tag terminator: every risky code unit is
    // \uXXXX-escaped by the builder.
    const foreign = [...custom].filter((char) => {
      const code = char.charCodeAt(0);
      return code !== 9 && code !== 10 && (code < 32 || code > 126);
    });
    expect(foreign).toEqual([]);
    expect(custom.toLowerCase()).not.toContain("</script");
    expect(custom).not.toContain("<b>");
    // ...and the text survives for the runtime (proven in the behaviour block).
    expect(custom).toContain("\\u52a0");
  });
});

// ── the generated script's behaviour, executed ────────────────────────────

describe("the recovery script's runtime behaviour (executed against a fake page)", () => {
  it("heals the mangled origin before anything else and arms no watchdog", () => {
    const run = runRecovery({ hostname: "tauri.localhostundefined" });
    expect(run.replaced).toEqual([BOOT_RECOVERY_CANONICAL_ORIGIN + "/"]);
    expect(run.timers).toHaveLength(0); // navigating away: no watchdog needed
    expect(run.loading?.textContent).toBe("Loading…");
  });

  it("falls through to the watchdog when the heal is refused before it starts", () => {
    // location.replace normally never throws; if it does, the healed document
    // never loads. The script must not strand that window on the static loader:
    // it falls through to the watchdog and the panel button retries the heal.
    const run = runRecovery({
      hostname: "tauri.localhostundefined",
      replaceThrows: true,
    });
    expect(run.replaced).toEqual([BOOT_RECOVERY_CANONICAL_ORIGIN + "/"]);
    expect(run.timers).toHaveLength(1);
    expect(run.timers[0].ms).toBe(BOOT_RECOVERY_DEADLINE_MS);

    run.timers[0].callback();
    clickButton(panelButton(run));
    // Retry re-attempts the canonical heal and never reload-loops in place.
    expect(run.replaced).toEqual([
      BOOT_RECOVERY_CANONICAL_ORIGIN + "/",
      BOOT_RECOVERY_CANONICAL_ORIGIN + "/",
    ]);
    expect(run.reloads).toBe(0);
  });

  it("agrees with isMangledOrigin across the whole matrix", () => {
    const matrix: Array<[string, string]> = [
      ["http:", "tauri.localhost"],
      ["https:", "tauri.localhost"],
      ["http:", "tauri.localhostundefined"],
      ["https:", "tauri.localhostundefined"],
      ["http:", "127.0.0.1"],
      ["http:", "example.com"],
      ["tauri:", "localhost"],
      ["tauri:", "tauri.localhostundefined"],
      ["file:", "tauri.localhostundefined"],
    ];
    for (const [protocol, hostname] of matrix) {
      const run = runRecovery({ protocol, hostname });
      expect(run.replaced.length > 0, protocol + "//" + hostname).toBe(
        isMangledOrigin(protocol, hostname),
      );
    }
  });

  it("arms exactly one watchdog for a healthy origin, at the advertised deadline", () => {
    const run = runRecovery();
    expect(run.replaced).toEqual([]);
    expect(run.reloads).toBe(0);
    expect(run.timers).toHaveLength(1);
    expect(run.timers[0].ms).toBe(BOOT_RECOVERY_DEADLINE_MS);
    expect(run.queried).toEqual([]); // the loader is only inspected at the deadline
  });

  it("paints the failure panel when the loader is still there at the deadline", () => {
    const run = runRecovery();
    run.timers[0].callback();

    // The static placeholder is REPLACED, not covered: contents cleared and
    // exactly the style + panel appended inside the existing element (which
    // still owns the host's full-page backdrop).
    expect(run.loading?.textContent).toBe("");
    expect(run.loading?.children.map((child) => child.tag)).toEqual(["style", "div"]);

    const style = mustFind(run.loading?.children ?? [], "style");
    // Colour-scheme aware and self-contained: the panel must not flip to light
    // colours on a dark desktop (or vice versa) before the app's theme loads.
    expect(style.textContent).toContain("prefers-color-scheme:dark");
    expect(style.textContent).toContain("#1e2837");
    expect(style.textContent).toContain("#cfe3ff");
    expect(style.textContent).toContain(".hk-boot-recovery");

    const panel = mustFind(run.loading?.children ?? [], "div");
    expect(panel.className).toBe("hk-boot-recovery");
    expect(panel.attributes.role).toBe("alert");

    const message = mustFind(panel.children, "p");
    expect(message.textContent).toBe(BOOT_RECOVERY_MESSAGE);

    // Manual recovery only: reaching the deadline never navigates.
    expect(run.reloads).toBe(0);
    expect(run.replaced).toEqual([]);

    const button = mustFind(panel.children, "button");
    expect(button.type).toBe("button");
    expect(button.textContent).toBe(BOOT_RECOVERY_RETRY);
    expect(button.className).toBe("hk-boot-recovery__retry");
    clickButton(button);
    expect(run.reloads).toBe(1); // the user chose to retry
  });

  it("does nothing once the app has mounted (loader removed, or dismissed)", () => {
    // Mounted and dismissed a while ago: the host removed the loader.
    const absent = runRecovery({ loader: "absent" });
    expect(absent.timers).toHaveLength(1);
    expect(() => absent.timers[0].callback()).not.toThrow();
    expect(absent.reloads).toBe(0);
    expect(absent.replaced).toEqual([]);

    // Mounted a moment ago: the host added the dismissal class and the removal
    // is in flight — painting a panel over a live app would be wrong.
    const dismissed = runRecovery({ loaderClasses: [BOOT_RECOVERY_DISMISSED_CLASS] });
    dismissed.timers[0].callback();
    expect(dismissed.loading?.textContent).toBe("Loading…");
    expect(dismissed.loading?.children).toHaveLength(0);
    expect(dismissed.reloads).toBe(0);
  });

  it("reloads a dev-server page in place instead of sending it to the app origin", () => {
    const run = runRecovery({ hostname: "127.0.0.1" });
    run.timers[0].callback();
    clickButton(panelButton(run));
    expect(run.reloads).toBe(1);
    expect(run.replaced).toEqual([]);
  });

  it("re-checks the origin on retry (late debris heals instead of reloading)", () => {
    // The panel was painted on a healthy first read; if recovery debris shows
    // up before the user clicks, the button must heal, not reload-loop.
    const run = runRecovery();
    run.timers[0].callback();
    run.location.hostname = "tauri.localhostundefined";
    clickButton(panelButton(run));
    expect(run.replaced).toEqual([BOOT_RECOVERY_CANONICAL_ORIGIN + "/"]);
    expect(run.reloads).toBe(0);
  });

  it("honours a custom loading selector", () => {
    const custom = bootRecoveryScript({ loadingScreen: { selector: ".boot-loader" } });

    // The default selector does not match the host's loader any more.
    const miss = runRecovery({ script: custom });
    miss.timers[0].callback();
    expect(miss.queried).toEqual([".boot-loader"]);
    expect(miss.loading?.children).toHaveLength(0);

    const hit = runRecovery({
      script: custom,
      matchesSelector: (selector) => selector === ".boot-loader",
    });
    hit.timers[0].callback();
    expect(hit.loading?.children).toHaveLength(2); // style + panel
  });

  it("honours a custom dismissed class (and an empty one disables the check)", () => {
    const custom = bootRecoveryScript({
      loadingScreen: { dismissedClass: "is-gone" },
    });
    // The custom marker suppresses the panel...
    const dismissed = runRecovery({
      script: custom,
      loaderClasses: ["is-gone"],
    });
    dismissed.timers[0].callback();
    expect(dismissed.loading?.children).toHaveLength(0);

    // ...while the default class is NOT consulted any more.
    const hiddenOnly = runRecovery({
      script: custom,
      loaderClasses: [BOOT_RECOVERY_DISMISSED_CLASS],
    });
    hiddenOnly.timers[0].callback();
    expect(hiddenOnly.loading?.children).toHaveLength(2);

    // Empty dismissedClass = "the host has no dismissal marker": always paint.
    const noMarker = bootRecoveryScript({ loadingScreen: { dismissedClass: "" } });
    const plain = runRecovery({ script: noMarker, loaderClasses: ["hidden"] });
    plain.timers[0].callback();
    expect(plain.loading?.children).toHaveLength(2);
  });

  it("uses the configured copy in the panel", () => {
    const custom = bootRecoveryScript({
      copy: { message: "Boot failed", retry: "Retry boot" },
    });
    const run = runRecovery({ script: custom });
    run.timers[0].callback();
    const panel = mustFind(run.loading?.children ?? [], "div");
    expect(mustFind(panel.children, "p").textContent).toBe("Boot failed");
    expect(mustFind(panel.children, "button").textContent).toBe("Retry boot");
  });

  it("uses the configured deadline", () => {
    const run = runRecovery({ script: bootRecoveryScript({ deadlineMs: 9000 }) });
    expect(run.timers).toHaveLength(1);
    expect(run.timers[0].ms).toBe(9000);
  });

  it("honours a custom isMangledOrigin predicate", () => {
    const custom = bootRecoveryScript({
      isMangledOrigin: (protocol, hostname) =>
        protocol === "http:" && hostname === "evil.example",
    });
    // The custom predicate decides: the incident host is NOT healed any more...
    const notMatched = runRecovery({ script: custom, hostname: "tauri.localhostundefined" });
    expect(notMatched.replaced).toEqual([]);
    expect(notMatched.timers).toHaveLength(1);
    // ...while a host it accepts is healed to the canonical origin.
    const matched = runRecovery({ script: custom, hostname: "evil.example" });
    expect(matched.replaced).toEqual([BOOT_RECOVERY_CANONICAL_ORIGIN + "/"]);
    expect(matched.timers).toHaveLength(0);
  });

  it("only heals on a strict boolean true from the predicate", () => {
    // Defensive: an async/truthy predicate must not navigate the window into a
    // stale origin by accident.
    const truthy = bootRecoveryScript({
      isMangledOrigin: (() => "yes") as unknown as (
        protocol: string,
        hostname: string,
      ) => boolean,
    });
    const run = runRecovery({ script: truthy, hostname: "tauri.localhostundefined" });
    expect(run.replaced).toEqual([]);
    expect(run.timers).toHaveLength(1);
  });

  it("heals but never arms the watchdog in heal-only mode", () => {
    const healOnly = bootRecoveryScript({ loadingScreen: false });
    const mangled = runRecovery({ script: healOnly, hostname: "tauri.localhostundefined" });
    expect(mangled.replaced).toEqual([BOOT_RECOVERY_CANONICAL_ORIGIN + "/"]);

    const healthy = runRecovery({ script: healOnly });
    expect(healthy.timers).toHaveLength(0);
    expect(healthy.loading?.children).toHaveLength(0);
  });

  it("survives non-ASCII and tag-breaking copy (escaped, still exact at runtime)", () => {
    const message = "加载失败 — </script><b>x</b>";
    const run = runRecovery({
      script: bootRecoveryScript({ copy: { message, retry: "重试" } }),
    });
    run.timers[0].callback();
    const panel = mustFind(run.loading?.children ?? [], "div");
    expect(mustFind(panel.children, "p").textContent).toBe(message);
    expect(mustFind(panel.children, "button").textContent).toBe("重试");
  });
});

// ── the plugin: injection face ────────────────────────────────────────────

describe("bootRecoveryPlugin injection", () => {
  it("is named hikari-boot-recovery and runs in dev as well as build", () => {
    const plugin = bootRecoveryPlugin();
    expect(plugin.name).toBe("hikari-boot-recovery");
    // No apply: 'build' — dev serves the same HTML through this hook, and a
    // dev page that never mounts deserves the same watchdog feedback.
    expect(plugin.apply).toBeUndefined();
  });

  it("injects exactly one inline classic <head> script into index.html only", () => {
    const plugin = bootRecoveryPlugin();
    for (const page of ["index.html", "overlay.html", "aimcard.html", "chat.html", "tray.html"]) {
      const injected = tags(plugin, "/app/" + page);
      if (page !== "index.html") {
        expect(injected, page + " is shell-managed — no boot recovery").toHaveLength(0);
        continue;
      }
      expect(injected).toHaveLength(1);
      expect(injected[0].tag).toBe("script");
      // Classic, not type=module: a classic inline script runs during parsing
      // while modules are deferred, so the heal lands before the bundle.
      expect(injected[0].attrs).not.toHaveProperty("type");
      // Inline, not src=: the mangled origin is exactly where a second request
      // could fail, and the tag must exist before the module graph.
      expect(injected[0].attrs).not.toHaveProperty("src");
      expect(injected[0].attrs).toMatchObject({ [BOOT_RECOVERY_ATTR]: "" });
      expect(injected[0].children).toBe(SCRIPT);
      // Default: end of <head> (after <meta charset>) — see the module doc.
      expect(injected[0].injectTo).toBe("head");
    }
  });

  it("treats an absent filename as the main entry (programmatic callers)", () => {
    const hook = bootRecoveryPlugin().transformIndexHtml as unknown as (
      html: string,
      ctx: unknown,
    ) => HtmlTagDescriptor[];
    expect(hook("<!doctype html><body></body>", {})).toHaveLength(1);
  });

  it("accepts an explicit entry list (basename or path suffix)", () => {
    const plugin = bootRecoveryPlugin({
      htmlFiles: ["index.html", "window-main.html", "pages/chat.html"],
    });
    expect(tags(plugin, "/repo/index.html")).toHaveLength(1);
    expect(tags(plugin, "/repo/window-main.html")).toHaveLength(1);
    expect(tags(plugin, "/repo/pages/chat.html")).toHaveLength(1);
    expect(tags(plugin, "/repo/overlay.html")).toHaveLength(0);
  });

  it("accepts a RegExp over the entry path", () => {
    const plugin = bootRecoveryPlugin({ htmlFiles: /app-[a-z]+\.html$/ });
    expect(tags(plugin, "/repo/app-main.html")).toHaveLength(1);
    expect(tags(plugin, "/repo/overlay-app.html")).toHaveLength(0);
  });

  it("warns once per skipped entry so forgetting htmlFiles is visible", () => {
    const warnings: string[] = [];
    const context = { warn: (message: string) => void warnings.push(message) };
    const plugin = bootRecoveryPlugin();
    tags(plugin, "/app/overlay.html", context);
    tags(plugin, "/app/overlay.html", context); // dev re-requests: no repeat
    tags(plugin, "/app/index.html", context); // instrumented: silent
    tags(plugin, "/app/settings.html", context);

    expect(warnings).toHaveLength(2);
    expect(warnings[0]).toContain("overlay.html");
    expect(warnings[0]).toContain("htmlFiles");
    expect(warnings[1]).toContain("settings.html");
  });

  it("honours injectTo: head-prepend (documented as charset-unsafe)", () => {
    const injected = tags(bootRecoveryPlugin({ injectTo: "head-prepend" }));
    expect(injected).toHaveLength(1);
    expect(injected[0].injectTo).toBe("head-prepend");
    // Nonsense falls back to the safe default.
    const bogus = tags(
      bootRecoveryPlugin({ injectTo: "body" as unknown as "head" }),
    );
    expect(bogus[0].injectTo).toBe("head");
  });

  it("lets the host override copy while keeping the other default", () => {
    const injected = tags(bootRecoveryPlugin({ copy: { retry: "Try again" } }));
    expect(injected[0].children).toContain('"Try again"');
    expect(injected[0].children).toContain(JSON.stringify(BOOT_RECOVERY_MESSAGE));
  });

  it("turns the watchdog off for loadingScreen: false", () => {
    const injected = tags(bootRecoveryPlugin({ loadingScreen: false }));
    expect(injected[0].children).not.toContain("setTimeout(");
  });
});

// ── the plugin: config-time validation ────────────────────────────────────

describe("bootRecoveryPlugin option validation", () => {
  it("rejects a relative or non-http(s) canonical origin, at plugin creation", () => {
    expect(() => bootRecoveryPlugin({ canonicalOrigin: "/app" })).toThrow(
      /absolute http\(s\) URL/,
    );
    // A relative origin is rejected by the URL parser.
    expect(() => bootRecoveryPlugin({ canonicalOrigin: "app.example" })).toThrow(
      /absolute http\(s\) URL/,
    );
    // tauri:// IS absolute but is not an http(s) origin to heal to.
    expect(() => bootRecoveryPlugin({ canonicalOrigin: "tauri://localhost" })).toThrow(
      /http: or https:/,
    );
    expect(() => bootRecoveryScript({ canonicalOrigin: "not a url" })).toThrow(
      /absolute http\(s\) URL/,
    );
  });

  it("rejects a predicate that cannot be serialised into the inline script", () => {
    // Method shorthand stringifies to a fragment that is not a valid expression.
    const holder = {
      isMangledOrigin(protocol: string, hostname: string) {
        return protocol === "http:" && hostname === "x";
      },
    };
    expect(() =>
      bootRecoveryScript({ isMangledOrigin: holder.isMangledOrigin }),
    ).toThrow(/self-contained function expression or arrow function/);

    // Native functions have no source text to inline.
    expect(() =>
      bootRecoveryScript({
        isMangledOrigin: Math.max as unknown as (
          protocol: string,
          hostname: string,
        ) => boolean,
      }),
    ).toThrow(/native or bound function/);

    // Non-ASCII source would break the ASCII-only contract.
    expect(() =>
      bootRecoveryScript({
        isMangledOrigin: () => {
          /* 漢字 */
          return false;
        },
      }),
    ).toThrow(/ASCII-only/);

    // A literal tag terminator inside the source would end the inline script.
    // (The predicate returns a string on purpose: this case is about the
    // SOURCE text; the runtime strict-boolean check is covered elsewhere.)
    // Built via new Function so the SOURCE TEXT literally contains the tag
    // terminator; a transpiled arrow would have it escaped/rewritten.
    const tagBreaker = new Function('return () => "</script>"')() as unknown as (
      protocol: string,
      hostname: string,
    ) => boolean;
    expect(() => bootRecoveryScript({ isMangledOrigin: tagBreaker })).toThrow(
      /must not contain/,
    );
  });

  it("ignores a non-function isMangledOrigin and keeps the default predicate", () => {
    const injected = tags(
      bootRecoveryPlugin({
        isMangledOrigin: "nope" as unknown as (
          protocol: string,
          hostname: string,
        ) => boolean,
      }),
    );
    expect(injected[0].children).toContain("APP_HOSTNAME");
  });

  it("falls back to the default deadline for nonsense values", () => {
    for (const deadlineMs of [0, -5, Number.NaN, Number.POSITIVE_INFINITY]) {
      const injected = tags(bootRecoveryPlugin({ deadlineMs }));
      expect(injected[0].children).toContain("var DEADLINE_MS = " + BOOT_RECOVERY_DEADLINE_MS + ";");
    }
    const rounded = tags(bootRecoveryPlugin({ deadlineMs: 9000.7 }));
    expect(rounded[0].children).toContain("var DEADLINE_MS = 9001;");
  });
});

// ── the plugin: real Vite builds ──────────────────────────────────────────

describe("bootRecoveryPlugin real Vite builds", () => {
  const INDEX_HTML =
    '<!doctype html><html><head><meta charset="UTF-8"><title>App</title></head>' +
    '<body><div id="loading-screen"><span>Loading…</span></div><div id="app"></div>' +
    '<script type="module" src="/main.js"></script></body></html>';
  const OVERLAY_HTML =
    '<!doctype html><html><head><meta charset="UTF-8"><title>Overlay</title></head>' +
    '<body><div id="overlay"></div><script type="module" src="/main.js"></script></body></html>';

  function project(files: Record<string, string>): string {
    const root = mkdtempSync(join(tmpdir(), "hikari-boot-recovery-build-"));
    temps.push(root);
    for (const [name, content] of Object.entries(files)) {
      writeFileSync(join(root, name), content);
    }
    return root;
  }

  async function runBuild(
    root: string,
    options: {
      pluginOptions?: Parameters<typeof bootRecoveryPlugin>[0];
      entries: string[];
    },
  ): Promise<(name: string) => string> {
    await build({
      root,
      configFile: false,
      logLevel: "silent",
      publicDir: false,
      base: "/",
      plugins: [bootRecoveryPlugin(options.pluginOptions)],
      build: {
        outDir: join(root, "dist"),
        emptyOutDir: true,
        rollupOptions: {
          input: Object.fromEntries(
            options.entries.map((entry) => [
              entry.replace(/\.html$/, ""),
              join(root, entry),
            ]),
          ),
        },
      },
    });
    return (name: string) => readFileSync(join(root, "dist", name), "utf8");
  }

  it("injects the inline script into the app window only, after the charset meta", async () => {
    const root = project({
      "index.html": INDEX_HTML,
      "overlay.html": OVERLAY_HTML,
      "main.js": 'document.getElementById("app");',
    });
    const dist = await runBuild(root, { entries: ["index.html", "overlay.html"] });

    const index = dist("index.html");
    expect(index).toContain(BOOT_RECOVERY_ATTR);
    expect(index).toContain("(function () {");
    expect(index).toContain('"http://tauri.localhost"');
    // Inline, not an external <script src>.
    expect(index).not.toMatch(/<script[^>]*data-hk-boot-recovery[^>]*\bsrc=/);
    // Charset-prescan contract: the few-KB script must stay AFTER the charset
    // declaration, so the prescan still finds it within the first 1024 bytes.
    const charset = index.indexOf("<meta charset");
    const injected = index.indexOf(BOOT_RECOVERY_ATTR);
    expect(charset).toBeGreaterThanOrEqual(0);
    expect(injected).toBeGreaterThan(charset);

    // The shell-managed window never gets the recovery.
    expect(dist("overlay.html")).not.toContain(BOOT_RECOVERY_ATTR);
  });

  it("head-prepend really moves the tag ahead of the charset declaration", async () => {
    // The documented trade-off, pinned so neither default can silently flip.
    const root = project({ "index.html": INDEX_HTML, "main.js": "1" });
    const dist = await runBuild(root, {
      pluginOptions: { injectTo: "head-prepend" },
      entries: ["index.html"],
    });
    const index = dist("index.html");
    expect(index).toContain(BOOT_RECOVERY_ATTR);
    expect(index.indexOf(BOOT_RECOVERY_ATTR)).toBeLessThan(index.indexOf("<meta charset"));
  });

  it("ships host copy overrides in the built HTML", async () => {
    const root = project({ "index.html": INDEX_HTML, "main.js": "1" });
    const dist = await runBuild(root, {
      pluginOptions: { copy: { message: "Please retry now", retry: "Again" } },
      entries: ["index.html"],
    });
    const index = dist("index.html");
    expect(index).toContain("Please retry now");
    expect(index).toContain('"Again"');
  });
});
