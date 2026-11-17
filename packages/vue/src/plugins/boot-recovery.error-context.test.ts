// AI-generated: developed with the DeepSeek Harness agent (model
// DeepSeek-Flash) and the ZCode agent (model GLM-5.3), directed and reviewed
// by langyo — SySL-1.0 §2.3 disclosure.

import { createHash } from "node:crypto";

import { describe, expect, it } from "vitest";

import {
  BOOT_RECOVERY_BLOCK_GLOBAL,
  BOOT_RECOVERY_COPY_ACTION,
  BOOT_RECOVERY_COPIED,
  BOOT_RECOVERY_COPY_FAILED,
  BOOT_RECOVERY_FATAL_GLOBAL,
  BOOT_RECOVERY_READY_GLOBAL,
  bootRecoveryScript,
} from "./boot-recovery.js";

/**
 * The ERROR-CONTEXT half (`copy.errorContext`): the captured boot log, the
 * `lastError` fatal record, the watchdog's classification upgrade, and the
 * copy action — everything the TIMEOUT panel never had, because nothing was
 * listening while the app failed to mount.
 *
 * Two properties drive the suite, the same two the details pane's suite
 * protects:
 *
 *   1. BYTE-COMPAT. The capture installs listeners and wraps console methods
 *      at script execution time on every page that ships it, so it must ride
 *      its own option and nothing else: a host that does not configure
 *      `copy.errorContext` keeps the byte-identical inert script it hashed
 *      (asserted against the shared golden hashes at the bottom).
 *   2. ONE SHELL. The captured log and the copy action ride the raw-details
 *      pane's existing payload/tree and the landing's existing action row —
 *      asserted through the real DOM contract (`.s-tool-json-tree`,
 *      `.hk-error-landing__actions`), and through the copy button's actual
 *      write, which must equal the pane's redacted payload text.
 *
 * The DOM is real (happy-dom) with two deliberate fakes: `console` is passed
 * INTO the script as a parameter (the IIFE reads it as a free variable, so a
 * fresh fake per run is the only way to observe the wrap without mutating the
 * runner's own console), and `window` is a fresh listener registry per run —
 * the capture attaches capture-phase listeners at script execution, so a
 * shared window would both leak handlers across cases and let one case's
 * dispatched events bleed into the next. The family globals (`__appFatal`,
 * `__appReady`, `__appBlock`) publish onto that same fake window object,
 * which is how the interplay cases drive them.
 */

const GOLDEN_DEFAULT_SHA256 =
  "bc5d894de22ad8d5a262e5c5a222613bfcc5075807170ccd0027e11a8e8e556d";
const GOLDEN_HEAL_ONLY_SHA256 =
  "bee06d4652e55708d8b130fec11ff8ede54d4eafb944ef0d18f7be5a76b3dca6";

function sha256(text: string): string {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

function foreignChars(text: string): string[] {
  return [...text].filter((char) => {
    const code = char.charCodeAt(0);
    return code !== 9 && code !== 10 && (code < 32 || code > 126);
  });
}

const REASONS = {
  timeout: { title: "Timed out", message: "The app was too slow to start." },
  chunk: { title: "Resources failed", message: "A bundle could not be fetched." },
  error: { title: "Crashed", message: "An uncaught error interrupted boot." },
  browser: { title: "Old browser", message: "This browser is too old." },
};

/** A pane host with the capture on (English defaults, no translations). */
const CTX_OPTION = {
  copy: { rawDetailsLabel: "Raw error details", errorContext: true as const },
};

/** A pane host with capture AND the reason table (classification visible). */
const CTX_REASONS_OPTION = {
  copy: { rawDetailsLabel: "Raw error details", errorContext: true, reasons: REASONS },
};

/** A fresh fake window: a listener registry the test dispatches into. */
function fakeWindow() {
  const listeners = new Map<string, Array<(event: unknown) => void>>();
  const win = {
    addEventListener(type: string, handler: (event: unknown) => void) {
      const row = listeners.get(type) ?? [];
      row.push(handler);
      listeners.set(type, row);
    },
    dispatch(type: string, event: unknown) {
      for (const handler of [...(listeners.get(type) ?? [])]) handler(event);
    },
  };
  return win as typeof win & Record<string, unknown>;
}

interface Run {
  loader: HTMLElement;
  window: ReturnType<typeof fakeWindow>;
  timers: Array<() => void>;
  console: Record<string, (...args: unknown[]) => void>;
  calls: Array<{ level: string; args: unknown[] }>;
  /** What the copy action handed to `navigator.clipboard.writeText`. */
  written: Array<string>;
}

/**
 * Execute a generated script against a real document, with the capture's
 * collaborators under the test's control.
 */
function runScript(
  script: string,
  options: {
    now?: () => number;
    resources?: Array<{ name: string; duration?: number; responseStatus?: number }>;
    scripts?: string[];
    navigator?: Record<string, unknown>;
    /** Seed `navigator.clipboard.writeText` with a recorder. */
    withClipboard?: boolean;
  } = {},
): Run {
  for (const stale of document.querySelectorAll("#loading-screen")) stale.remove();
  const loader = document.createElement("div");
  loader.id = "loading-screen";
  loader.textContent = "Loading";
  document.body.appendChild(loader);

  for (const stale of document.querySelectorAll("script[data-probe-src]")) stale.remove();
  for (const src of options.scripts ?? []) {
    const el = document.createElement("script");
    el.setAttribute("src", src);
    el.setAttribute("data-probe-src", "");
    el.setAttribute("disabled", "");
    document.body.appendChild(el);
  }

  const win = fakeWindow();
  const timers: Array<() => void> = [];
  const calls: Array<{ level: string; args: unknown[] }> = [];
  const written: Array<string> = [];
  const fakeConsole: Run["console"] = {};
  for (const level of ["error", "warn", "log", "info"]) {
    fakeConsole[level] = (...args: unknown[]) => {
      calls.push({ level, args });
    };
  }
  const navigatorOptions = options.navigator ?? {
    languages: ["en-US"],
    language: "en-US",
  };
  const nav = options.withClipboard
    ? {
        ...navigatorOptions,
        clipboard: {
          writeText: (text: string) => {
            written.push(text);
            return Promise.resolve();
          },
        },
      }
    : navigatorOptions;
  const run = new Function(
    "location",
    "document",
    "setTimeout",
    "localStorage",
    "navigator",
    "window",
    "performance",
    "ResizeObserver",
    "Date",
    "console",
    script,
  );
  const FakeDate = { now: options.now ?? (() => 1_700_000_000_000) };
  (FakeDate as unknown as { prototype: unknown }).prototype = Date.prototype;
  run(
    { protocol: "http:", hostname: "tauri.localhost", href: "http://tauri.localhost/" },
    document,
    (callback: () => void) => {
      timers.push(callback);
      return timers.length;
    },
    undefined,
    nav,
    win,
    { getEntriesByType: () => options.resources ?? [] },
    undefined,
    FakeDate,
    fakeConsole,
  );
  return { loader, window: win, timers, console: fakeConsole, calls, written };
}

/** Fire the watchdog so the panel paints, then hand back the card. */
function paintedCard(run: Run): HTMLElement {
  for (const timer of run.timers) timer();
  const card = run.loader.querySelector(".hk-error-landing__card");
  if (!card) throw new Error("the panel was not painted");
  return card as HTMLElement;
}

/** The action-row buttons in DOM order (label text). */
function actionLabels(run: Run): string[] {
  return [...run.loader.querySelectorAll(".hk-error-landing__actions button")].map(
    (button) => button.textContent ?? "",
  );
}

function copyButtonOf(run: Run): HTMLButtonElement {
  const button = run.loader.querySelector(
    ".hk-error-landing__actions button.hk-btn-secondary",
  );
  if (!button) throw new Error("the copy action was not painted");
  return button as HTMLButtonElement;
}

/** Click the copy button; resolve after the async write settles. */
async function clickCopy(run: Run): Promise<void> {
  copyButtonOf(run).click();
  await new Promise((resolve) => setTimeout(resolve, 0));
}

/** The payload exactly as an operator would paste it from the copy action. */
function pastedPayload(run: Run): Record<string, unknown> {
  if (run.written.length === 0) throw new Error("the copy action wrote nothing");
  return JSON.parse(run.written[run.written.length - 1]) as Record<string, unknown>;
}

function panelTitle(run: Run): string | undefined {
  return (
    run.loader.querySelector(
      "[data-hk-boot-recovery-panel] .hk-error-landing__title",
    )?.textContent ?? undefined
  );
}

describe("config surface", () => {
  it("exposes the retired family script's English labels as the defaults", () => {
    // chest's copy table has carried translations for exactly these three
    // strings since the hand-rolled fallback; the defaults are not new words.
    expect(BOOT_RECOVERY_COPY_ACTION).toBe("Copy details");
    expect(BOOT_RECOVERY_COPIED).toBe("Copied");
    expect(BOOT_RECOVERY_COPY_FAILED).toBe("Copy failed");
  });

  it("requires the raw-details pane (the capture reports through it)", () => {
    expect(() => bootRecoveryScript({ copy: { errorContext: true } })).toThrow(
      /errorContext/,
    );
    expect(() =>
      bootRecoveryScript({ copy: { errorContext: { copy: "Copy" } } }),
    ).toThrow(/errorContext/);
  });

  it("rejects a translation map without a locale table", () => {
    expect(() =>
      bootRecoveryScript({
        copy: {
          rawDetailsLabel: "Raw",
          errorContext: { locales: { "zh-cn": { copy: "复制" } } },
        },
      }),
    ).toThrow(/errorContext\.locales/);
  });

  it("rejects present-but-blank labels and malformed entries", () => {
    for (const bad of [
      { copy: "" },
      { copied: "   " },
      { copyFailed: 7 },
      { locales: { en: { copy: "" } } },
      { locales: { "": { copy: "x" } } },
      { locales: { zh_CN: { copy: "a" }, "zh-cn": { copy: "b" } } },
      "yes",
    ]) {
      expect(
        () =>
          bootRecoveryScript({
            copy: { rawDetailsLabel: "Raw", errorContext: bad as never },
          }),
        JSON.stringify(bad),
      ).toThrow();
    }
  });

  it("accepts true, an object, and every off spelling", () => {
    const on = bootRecoveryScript({
      copy: { rawDetailsLabel: "Raw", errorContext: true },
    });
    const object = bootRecoveryScript({
      copy: { rawDetailsLabel: "Raw", errorContext: { copy: "Copy" } },
    });
    expect(on).toContain("CTX_COPY_LABEL");
    expect(object).toContain('"Copy"');
    for (const off of [false, undefined, null]) {
      const script = bootRecoveryScript({
        copy: { rawDetailsLabel: "Raw", errorContext: off as never },
      });
      expect(script).not.toContain("CTX_COPY_LABEL");
      expect(script).not.toContain("installContextCapture");
    }
  });

  it("stays rejected in heal-only mode (the pane is required first)", () => {
    expect(() =>
      bootRecoveryScript({
        loadingScreen: false,
        copy: { rawDetailsLabel: "Raw", errorContext: true },
      }),
    ).toThrow(/rawDetailsLabel/);
  });
});

describe("byte-compat", () => {
  it("keeps the default and heal-only scripts byte-identical", () => {
    expect(sha256(bootRecoveryScript())).toBe(GOLDEN_DEFAULT_SHA256);
    expect(sha256(bootRecoveryScript({}))).toBe(GOLDEN_DEFAULT_SHA256);
    expect(sha256(bootRecoveryScript({ loadingScreen: false }))).toBe(
      GOLDEN_HEAL_ONLY_SHA256,
    );
  });

  it("keeps every off spelling on the bytes it already had", () => {
    // The first two shapes are the golden default; the third is the pane-only
    // shape, which is NOT the golden default (it embeds the details sheet) --
    // it is its own 922e… bytes, and those are what `false` must keep. The
    // runtime also honours a bare null as "off" (the typings, like
    // browserBlock's, expose only the boolean spelling).
    expect(
      sha256(bootRecoveryScript({ copy: { errorContext: false } })),
    ).toBe(GOLDEN_DEFAULT_SHA256);
    expect(
      sha256(bootRecoveryScript({ copy: { errorContext: null as never } })),
    ).toBe(GOLDEN_DEFAULT_SHA256);
    expect(
      sha256(
        bootRecoveryScript({
          copy: { rawDetailsLabel: "Raw", errorContext: false },
        }),
      ),
    ).toBe("922e8c74ade0250de9c05a6d36279dd67a76541e73315c5616cbadf3873d196b");
  });

  it("keeps the capture's names out of scripts that do not configure it", () => {
    // The pane-only host (rawDetailsLabel without errorContext) must not
    // inherit the listeners either — its bytes are its own contract.
    const shapes = [
      bootRecoveryScript({}),
      bootRecoveryScript({ copy: { rawDetailsLabel: "Raw" } }),
      bootRecoveryScript({ copy: { reasons: REASONS } }),
      bootRecoveryScript({
        copy: { browserBlock: { title: "Old browser", message: "Too old." } },
      }),
    ];
    for (const marker of [
      "installContextCapture",
      "bootLog",
      "bootFatal",
      "captureFatal",
      "captureEntry",
      "wrapConsoleMethod",
      "copyPayload",
      "contextCopy",
      "CTX_COPY_LABEL",
      "CONTEXT_TRANSLATIONS",
    ]) {
      for (const script of shapes) {
        expect(script, marker).not.toContain(marker);
      }
    }
  });

  it("emits the chunk-miss pattern exactly once when reasons and capture meet", () => {
    const script = bootRecoveryScript(CTX_REASONS_OPTION);
    expect(script.match(/CHUNK_MISS_RE =/g)).toHaveLength(1);
  });
});

describe("the capture (real listeners, real console wrap)", () => {
  it("installs at script execution time, not at paint time", async () => {
    const run = runScript(bootRecoveryScript(CTX_OPTION), { withClipboard: true });
    // Nothing has fired yet — the watchdog timer is still pending — and a
    // console call made NOW is already recorded.
    run.console.error("before the deadline");
    paintedCard(run);
    await clickCopy(run);
    const log = pastedPayload(run).console as Array<{ text: string }>;
    expect(log.map((entry) => entry.text)).toEqual(["before the deadline"]);
  });

  it("passes console calls through AND records them", async () => {
    const run = runScript(bootRecoveryScript(CTX_OPTION), { withClipboard: true });
    run.console.error("boot failed", { code: 7 });
    run.console.warn("slow fetch");
    run.console.log("step 3 done");
    // Pass-through: the page's own console behaviour is unchanged, args intact.
    expect(run.calls.map((call) => call.level)).toEqual(["error", "warn", "log"]);
    expect(run.calls[0].args).toEqual(["boot failed", { code: 7 }]);

    paintedCard(run);
    await clickCopy(run);
    const log = pastedPayload(run).console as Array<{
      t: number;
      level: string;
      text: string;
    }>;
    expect(log).toHaveLength(3);
    expect(log.map((entry) => entry.level)).toEqual(["error", "warn", "log"]);
    expect(log[0].text).toContain("boot failed");
    expect(log[0].text).toContain("7");
    expect(log[1].text).toBe("slow fetch");
    expect(log[2].text).toBe("step 3 done");
    // `t` is a PAGE-RUNTIME offset from boot start, like elapsedMs.
    expect(typeof log[0].t).toBe("number");
  });

  it("timestamps entries at capture time against boot start", async () => {
    let call = 0;
    const now = () => (call++ === 0 ? 0 : 1234);
    // call 0 is bootStartedAt (install time); every later read is the same
    // fake instant, so the entry's offset is exactly 1234 - 0.
    const run = runScript(bootRecoveryScript(CTX_OPTION), {
      withClipboard: true,
      now,
    });
    run.console.error("timed entry");
    paintedCard(run);
    await clickCopy(run);
    const log = pastedPayload(run).console as Array<{ t: number }>;
    expect(log[0].t).toBe(1234);
  });

  it("formats a thrown Error the way devtools do, not as {}", async () => {
    const run = runScript(bootRecoveryScript(CTX_OPTION), { withClipboard: true });
    run.console.error(new TypeError("x is undefined"));
    paintedCard(run);
    await clickCopy(run);
    const log = pastedPayload(run).console as Array<{ text: string }>;
    expect(log[0].text).toBe("TypeError: x is undefined");
  });

  it("keeps the ring's newest entries of a flooded boot", async () => {
    const run = runScript(bootRecoveryScript(CTX_OPTION), { withClipboard: true });
    for (let i = 0; i < 70; i++) run.console.log("line " + i);
    paintedCard(run);
    await clickCopy(run);
    const log = pastedPayload(run).console as Array<{ text: string }>;
    expect(log).toHaveLength(60);
    // The OLDEST lines fell off: the first survivor is line 10, the last is
    // line 69 — the ones nearest the hang are the diagnosis.
    expect(log[0].text).toBe("line 10");
    expect(log[59].text).toBe("line 69");
  });

  it("records an uncaught error event as the fatal with its location", async () => {
    const run = runScript(bootRecoveryScript(CTX_OPTION), { withClipboard: true });
    run.window.dispatch("error", {
      message: "Uncaught TypeError: x is undefined",
      filename: "/assets/app.js",
      lineno: 3,
      colno: 7,
      error: { stack: "TypeError: x is undefined\n    at app.js:3:7" },
    });
    paintedCard(run);
    await clickCopy(run);
    const payload = pastedPayload(run);
    const lastError = payload.lastError as Record<string, unknown>;
    expect(lastError.message).toBe("Uncaught TypeError: x is undefined");
    expect(lastError.source).toBe("/assets/app.js");
    expect(lastError.line).toBe(3);
    expect(lastError.column).toBe(7);
    expect(lastError.stack).toContain("at app.js:3:7");
    const log = payload.console as Array<{ level: string }>;
    expect(log.some((entry) => entry.level === "uncaught")).toBe(true);
  });

  it("keeps the FIRST fatal as lastError, later ones as log lines", async () => {
    const run = runScript(bootRecoveryScript(CTX_OPTION), { withClipboard: true });
    run.window.dispatch("error", { message: "first root cause" });
    run.window.dispatch("error", { message: "second cascade" });
    paintedCard(run);
    await clickCopy(run);
    const payload = pastedPayload(run);
    expect((payload.lastError as Record<string, unknown>).message).toBe(
      "first root cause",
    );
    const log = payload.console as Array<{ text: string }>;
    expect(log.map((entry) => entry.text)).toEqual([
      "first root cause",
      "second cascade",
    ]);
  });

  it("logs a failed resource event but never promotes it to the fatal", async () => {
    const run = runScript(bootRecoveryScript(CTX_REASONS_OPTION), {
      withClipboard: true,
    });
    run.window.dispatch("error", { target: { src: "/assets/missing.js" } });
    run.timers[0]();
    expect(panelTitle(run)).toBe(REASONS.timeout.title);
    await clickCopy(run);
    const payload = pastedPayload(run);
    expect(payload.lastError).toBeUndefined();
    const log = payload.console as Array<{ level: string; text: string }>;
    expect(log).toHaveLength(1);
    expect(log[0].level).toBe("error");
    expect(log[0].text).toContain("/assets/missing.js");
  });

  it("records an innocuous rejection as a log line, not the fatal", async () => {
    const run = runScript(bootRecoveryScript(CTX_REASONS_OPTION), {
      withClipboard: true,
    });
    run.window.dispatch("unhandledrejection", { reason: "user navigated away" });
    run.timers[0]();
    expect(panelTitle(run)).toBe(REASONS.timeout.title);
    await clickCopy(run);
    const payload = pastedPayload(run);
    expect(payload.lastError).toBeUndefined();
    const log = payload.console as Array<{ level: string; text: string }>;
    expect(log[0].level).toBe("rejection");
    expect(log[0].text).toContain("user navigated away");
  });

  it("does not cross-contaminate the console between runs", () => {
    // A fresh fake per run: the wrap assigns onto the console object the
    // script was GIVEN, so a host page's console is wrapped exactly once.
    const first = runScript(bootRecoveryScript(CTX_OPTION));
    const second = runScript(bootRecoveryScript(CTX_OPTION));
    first.console.error("one");
    second.console.error("two");
    expect(first.calls.map((call) => call.args[0])).toEqual(["one"]);
    expect(second.calls.map((call) => call.args[0])).toEqual(["two"]);
  });

  it("__appReady still stands the panel down with the capture on", () => {
    const run = runScript(bootRecoveryScript(CTX_REASONS_OPTION));
    run.console.error("late noise");
    run.window.dispatch("error", { message: "Uncaught TypeError: x" });
    paintedCard(run);
    const ready = run.window[BOOT_RECOVERY_READY_GLOBAL] as () => void;
    expect(typeof ready).toBe("function");
    ready();
    expect(
      run.loader.querySelector("[data-hk-boot-recovery-panel]"),
    ).toBeNull();
    // The loader itself survives; only the script's own nodes went away --
    // BOTH sheets (the landing sheet and the details sheet), not just the
    // one adjacent to the panel.
    expect(document.getElementById("loading-screen")).toBe(run.loader);
    expect(run.loader.querySelectorAll("style").length).toBe(0);
  });

  it("stops recording after __appReady, but keeps the pass-through", () => {
    // A healthy mount leaves the wrappers installed (unwinding could clobber
    // a later wrapper in a chained console), but every call after the ready
    // handoff costs one boolean check -- no format, no append.
    const run = runScript(bootRecoveryScript(CTX_REASONS_OPTION));
    run.console.error("during boot");
    paintedCard(run);
    const ready = run.window[BOOT_RECOVERY_READY_GLOBAL] as () => void;
    ready();
    run.console.error("after mount");
    run.window.dispatch("error", { message: "Uncaught TypeError: late" });
    // Pass-through continues: the page's console behaviour is unchanged.
    expect(run.calls.map((call) => call.args[0])).toEqual([
      "during boot",
      "after mount",
    ]);
    // The panel is down, so the ring is not observable here -- but a fatal
    // after ready would not have set bootFatal: repaint through a second
    // panel is impossible, so assert the only observable surface instead:
    // the loaders' styles are gone and no error was thrown.
    expect(run.loader.querySelectorAll("style").length).toBe(0);
  });
});

describe("the classification upgrade (watchdog + capture)", () => {
  it("classifies a captured fatal as the error class, not a timeout", () => {
    const run = runScript(bootRecoveryScript(CTX_REASONS_OPTION));
    run.window.dispatch("error", {
      message: "Uncaught TypeError: x is undefined",
    });
    run.timers[0]();
    expect(panelTitle(run)).toBe(REASONS.error.title);
  });

  it("classifies a chunk-shaped fatal as the chunk class", () => {
    const run = runScript(bootRecoveryScript(CTX_REASONS_OPTION));
    run.window.dispatch("error", {
      message: "Failed to fetch dynamically imported module: /assets/app.js",
    });
    run.timers[0]();
    expect(panelTitle(run)).toBe(REASONS.chunk.title);
  });

  it("classifies a chunk-shaped REJECTION as the chunk class", async () => {
    // Dynamic import failures surface as unhandled rejections on several
    // browsers — the pattern match is what separates them from innocuous ones.
    const run = runScript(bootRecoveryScript(CTX_REASONS_OPTION), {
      withClipboard: true,
    });
    run.window.dispatch("unhandledrejection", {
      reason: new Error("Failed to fetch dynamically imported module: /x.js"),
    });
    run.timers[0]();
    expect(panelTitle(run)).toBe(REASONS.chunk.title);
    await clickCopy(run);
    const payload = pastedPayload(run);
    expect((payload.lastError as Record<string, unknown>).message).toContain(
      "Failed to fetch dynamically imported module",
    );
  });

  it("keeps the resource-timing chunk signal ahead of the fatal", () => {
    // A refused boot script is the strongest signal; the captured fatal is
    // the fallback, not a rival.
    const run = runScript(bootRecoveryScript(CTX_REASONS_OPTION), {
      scripts: ["/assets/index-abc.js"],
      resources: [
        {
          name: "http://tauri.localhost/assets/index-abc.js",
          duration: 12,
          responseStatus: 404,
        },
      ],
    });
    run.window.dispatch("error", { message: "Uncaught TypeError: later noise" });
    run.timers[0]();
    expect(panelTitle(run)).toBe(REASONS.chunk.title);
  });

  it("keeps __appFatal's payload.error beside the captured lastError", async () => {
    const run = runScript(bootRecoveryScript(CTX_REASONS_OPTION), {
      withClipboard: true,
    });
    run.window.dispatch("error", { message: "Uncaught TypeError: captured" });
    const fatal = run.window[BOOT_RECOVERY_FATAL_GLOBAL] as (
      message?: string,
      detail?: Record<string, unknown>,
    ) => void;
    expect(typeof fatal).toBe("function");
    fatal("boom from host", { name: "HostError", message: "boom from host" });
    // __appFatal paints IMMEDIATELY — no watchdog wait.
    await clickCopy(run);
    const payload = pastedPayload(run);
    expect((payload.error as Record<string, unknown>).name).toBe("HostError");
    expect((payload.lastError as Record<string, unknown>).message).toContain(
      "captured",
    );
  });

  it("stays silent about console/lastError when nothing was captured", async () => {
    const run = runScript(bootRecoveryScript(CTX_OPTION), { withClipboard: true });
    paintedCard(run);
    await clickCopy(run);
    const payload = pastedPayload(run);
    expect(payload.console).toBeUndefined();
    expect(payload.lastError).toBeUndefined();
    // A quiet boot reports neither field — that absence IS the signal that
    // nothing was captured, so a paste never implies missing evidence.
  });
});

describe("the copy action", () => {
  it("paints the secondary button BEFORE reload in the action row", () => {
    const run = runScript(bootRecoveryScript(CTX_OPTION));
    paintedCard(run);
    expect(actionLabels(run)).toEqual([BOOT_RECOVERY_COPY_ACTION, "Reload"]);
    const button = copyButtonOf(run);
    expect(button.className).toContain("hk-btn-sm");
    expect(button.getAttribute("type")).toBe("button");
  });

  it("absents itself from a browser-block notice", () => {
    const run = runScript(
      bootRecoveryScript({
        copy: {
          rawDetailsLabel: "Raw",
          errorContext: true,
          browserBlock: { title: "Old browser", message: "Too old." },
        },
      }),
    );
    const block = run.window[BOOT_RECOVERY_BLOCK_GLOBAL] as (
      browser?: string,
      current?: string,
      min?: string,
    ) => void;
    block("Chrome", "70", "90");
    // The info panel paints immediately; it carries no payload, so no copy.
    expect(
      run.loader.querySelector("[data-hk-boot-recovery-panel]"),
    ).not.toBeNull();
    expect(actionLabels(run)).toEqual(["Reload"]);
    expect(run.loader.querySelector(".hk-error-landing__details")).toBeNull();
  });

  it("hands the operator the redacted payload text over the Clipboard API", async () => {
    const run = runScript(bootRecoveryScript(CTX_OPTION), { withClipboard: true });
    run.console.error("GET https://x/api?token=SECRETVALUE 500");
    run.window.dispatch("error", { message: "Uncaught TypeError: died" });
    paintedCard(run);
    await clickCopy(run);
    expect(run.written).toHaveLength(1);
    const text = run.written[0];
    expect(text).not.toContain("SECRETVALUE");
    expect(text).toContain("token=\u25CF\u25CF\u25CF");
    const payload = pastedPayload(run);
    expect(payload.reason).toBe("timeout");
    expect(Array.isArray(payload.console)).toBe(true);
    // The capture's fields are the payload's LAST keys, after the pane's own
    // contract fields — key order is part of the paste's shape.
    const keys = Object.keys(payload);
    expect(keys.indexOf("console")).toBeGreaterThan(keys.indexOf("bootScripts"));
    expect(keys.indexOf("lastError")).toBeGreaterThan(keys.indexOf("bootScripts"));
  });

  it("flips to the copied label and back after a successful write", async () => {
    const run = runScript(bootRecoveryScript(CTX_OPTION), { withClipboard: true });
    paintedCard(run);
    const button = copyButtonOf(run);
    button.click();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(button.textContent).toBe(BOOT_RECOVERY_COPIED);
    // The revert timer the script scheduled (timer 0 was the watchdog):
    for (const timer of run.timers.slice(1)) timer();
    expect(button.textContent).toBe(BOOT_RECOVERY_COPY_ACTION);
  });

  it("falls back to execCommand when the Clipboard API is absent", async () => {
    const run = runScript(bootRecoveryScript(CTX_OPTION), {});
    paintedCard(run);
    const doc = document as unknown as Record<string, unknown>;
    const originalCreate = doc.createElement;
    const originalExec = doc.execCommand;
    let seenValue = "";
    let command: string | null = null;
    doc.createElement = ((tag: string) => {
      const el = (
        originalCreate as typeof document.createElement
      ).call(document, tag);
      if (tag === "textarea") {
        let value = "";
        Object.defineProperty(el, "value", {
          get: () => value,
          set: (next: string) => {
            value = next;
            seenValue = next;
          },
          configurable: true,
        });
      }
      return el;
    }) as typeof document.createElement;
    doc.execCommand = (cmd: string) => {
      command = cmd;
      return true;
    };
    try {
      await clickCopy(run);
      expect(run.written).toHaveLength(0);
      expect(command).toBe("copy");
      expect(seenValue).toContain('"reason"');
      expect(copyButtonOf(run).textContent).toBe(BOOT_RECOVERY_COPIED);
    } finally {
      doc.createElement = originalCreate;
      doc.execCommand = originalExec;
    }
  });

  it("reports the failed label when every path refuses", async () => {
    const run = runScript(bootRecoveryScript(CTX_OPTION), {});
    paintedCard(run);
    const doc = document as unknown as Record<string, unknown>;
    const originalExec = doc.execCommand;
    doc.execCommand = () => false;
    try {
      await clickCopy(run);
      expect(copyButtonOf(run).textContent).toBe(BOOT_RECOVERY_COPY_FAILED);
    } finally {
      doc.execCommand = originalExec;
    }
  });

  it("resolves translated labels through the locale matrix", async () => {
    const run = runScript(
      bootRecoveryScript({
        copy: {
          title: "Failed",
          message: "The app did not load.",
          retry: "Reload",
          storageKey: "ui-locale",
          locales: {
            en: { title: "Failed", message: "The app did not load.", retry: "Reload" },
            "zh-cn": { title: "加载失败", message: "应用没有加载完成。", retry: "刷新" },
          },
          rawDetailsLabel: "Raw error details",
          errorContext: {
            locales: {
              "zh-cn": { copy: "复制错误", copied: "已复制", copyFailed: "复制失败" },
            },
          },
        },
      }),
      { withClipboard: true, navigator: { languages: ["zh-CN"], language: "zh-CN" } },
    );
    paintedCard(run);
    expect(actionLabels(run)).toEqual(["复制错误", "刷新"]);
    await clickCopy(run);
    expect(copyButtonOf(run).textContent).toBe("已复制");
  });

  it("keeps the English default for a partial translation", () => {
    const run = runScript(
      bootRecoveryScript({
        copy: {
          locales: {
            en: { message: "m", retry: "r" },
            "zh-cn": { message: "m", retry: "r" },
          },
          rawDetailsLabel: "Raw",
          errorContext: { locales: { "zh-cn": { copy: "复制" } } },
        },
      }),
      { navigator: { languages: ["zh-CN"], language: "zh-CN" } },
    );
    paintedCard(run);
    // The partial zh row translated only the button label; the copied/failed
    // feedback keeps the English defaults, and the retry label is the row's.
    expect(actionLabels(run)).toEqual(["复制", "r"]);
  });

  it("keeps the pane working when the copy machinery is never touched", () => {
    // The button exists but a click that throws must cost nothing else: the
    // whole path is guarded, so even a payload that turns hostile mid-click
    // cannot take the card down.
    const run = runScript(bootRecoveryScript(CTX_OPTION), {});
    const card = paintedCard(run);
    expect(card.querySelector(".hk-error-landing__details")).not.toBeNull();
    expect(() => copyButtonOf(run).click()).not.toThrow();
  });
});

describe("the error-context shapes' invariants", () => {
  const shapeOptions = [
    ["pane + capture", CTX_OPTION],
    ["pane + capture + reasons", CTX_REASONS_OPTION],
    [
      "capture + translations",
      {
        copy: {
          locales: {
            en: { message: "m", retry: "r" },
            "zh-cn": { message: "m", retry: "r" },
          },
          rawDetailsLabel: "Raw",
          errorContext: { locales: { "zh-cn": { copy: "复制" } } },
        },
      },
    ],
    [
      "all halves",
      {
        copy: {
          rawDetailsLabel: "Raw",
          errorContext: true,
          reasons: REASONS,
          browserBlock: { title: "Old browser", message: "Too old." },
        },
      },
    ],
  ] as Array<[string, Record<string, unknown>]>;

  const shapes: Array<[string, string]> = shapeOptions.map(([label, options]) => [
    label,
    bootRecoveryScript(options as never),
  ]);

  it("keeps every shape a single classic IIFE with no markup parsing", () => {
    for (const [label, script] of shapes) {
      expect(script.startsWith("(function () {"), label).toBe(true);
      expect(script.endsWith("})();"), label).toBe(true);
      expect(script.toLowerCase(), label).not.toContain("</script");
      expect(script, label).not.toContain("<!--");
      expect(script, label).not.toContain("innerHTML");
      expect(script, label).not.toContain("outerHTML");
      expect(script, label).not.toContain("import ");
    }
  });

  it("keeps every shape ASCII-only and deterministic", () => {
    for (const [label, script] of shapes) {
      expect(foreignChars(script), label).toEqual([]);
      const options = shapeOptions.find(([name]) => name === label)![1];
      expect(bootRecoveryScript(options as never), label).toBe(script);
    }
  });

  it("never adds a second reload or navigate path", () => {
    for (const [label, script] of shapes) {
      expect(script.match(/location\.reload\(/g) ?? [], label).toHaveLength(1);
      expect(script.match(/location\.replace\(/g) ?? [], label).toHaveLength(1);
    }
  });

  it("DEFINES every capture helper it CALLS, before the call site", () => {
    const helpers = [
      "installContextCapture",
      "captureEntry",
      "captureFatal",
      "wrapConsoleMethod",
      "formatLogValue",
      "contextCopy",
      "copyViaCommand",
      "copyPayload",
    ];
    for (const [label, script] of shapes) {
      for (const helper of helpers) {
        const defAt = script.indexOf("function " + helper + "(");
        const calls = [
          ...script.matchAll(new RegExp("\\b" + helper + "\\(", "g")),
        ]
          .map((match) => match.index as number)
          .filter((at) => at !== defAt + "function ".length);
        if (calls.length === 0) continue;
        expect(
          defAt,
          label + " calls " + helper + " but does not define it",
        ).toBeGreaterThanOrEqual(0);
        expect(
          defAt,
          label + ": " + helper + " defined after its first call",
        ).toBeLessThan(Math.min(...calls));
      }
    }
  });

  it("installs the capture AFTER every definition it needs (emitted order)", () => {
    // The install call executes immediately; the clipText/TEXT_LIMIT pair it
    // (indirectly) needs must already be assigned, so the install line comes
    // after the DETAILS_RUNTIME block that assigns them.
    for (const [label, script] of shapes) {
      const install = script.indexOf("installContextCapture();");
      const textLimit = script.indexOf("var TEXT_LIMIT =");
      expect(install, label).toBeGreaterThan(-1);
      expect(textLimit, label).toBeGreaterThan(-1);
      expect(
        textLimit,
        label + ": install before TEXT_LIMIT assignment",
      ).toBeLessThan(install);
    }
  });

  it("keeps the capture runtime out of the browser-block-only shape", () => {
    // Regressed-shape guard: a browserBlock host without the pane keeps the
    // script it hashed even though CHUNK_MISS_RE now has a second consumer.
    const script = bootRecoveryScript({
      copy: { browserBlock: { title: "Old browser", message: "Too old." } },
    });
    expect(script).not.toContain("CHUNK_MISS_RE");
    expect(script).not.toContain("installContextCapture");
  });
});

describe("byte-compat (shared goldens)", () => {
  it("keeps the default script byte-identical", () => {
    expect(sha256(bootRecoveryScript())).toBe(GOLDEN_DEFAULT_SHA256);
  });

  it("keeps the heal-only script byte-identical", () => {
    expect(sha256(bootRecoveryScript({ loadingScreen: false }))).toBe(
      GOLDEN_HEAL_ONLY_SHA256,
    );
  });
});
