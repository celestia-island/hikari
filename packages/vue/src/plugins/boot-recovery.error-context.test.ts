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
  "4def6c962105be9f762c9a1b435e070b36babf7bb74749045a0fc1501bb5b960";
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
    /** Use THIS object as the console the script sees (hostile accessors,
     *  shims with return values). Default: a fresh per-level fake whose calls
     *  are recorded into `calls`. */
    consoleObject?: Record<string, unknown>;
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
  const scriptConsole = (options.consoleObject ??
    fakeConsole) as Run["console"];
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
  const FakeDate = {
    now: options.now ?? (() => 1_700_000_000_000),
    prototype: Date.prototype,
  };
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
    scriptConsole,
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
    // shape, which is NOT the golden default (it embeds the details sheet,
    // and this build's pane shapes also carry the escaped-JSON credential
    // mask -- master's pane-only shape was 922e8c74…, this build's differs)
    // -- so its `false` spelling must equal the pane-only bytes themselves,
    // asserted by self-consistency rather than a number that drifts with
    // every mask widening. The runtime also honours a bare null as "off"
    // (the typings, like browserBlock's, expose only the boolean spelling).
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
    ).toBe(sha256(bootRecoveryScript({ copy: { rawDetailsLabel: "Raw" } })));
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

  it("stops recording after __appReady -- observable through a later repaint", async () => {
    // The ring is closure-private and the panel is down after ready(), so the
    // observable route is a SECOND paint: __appFatal repaints on demand and
    // builds a FRESH payload from the live ring. A reverted freeze guard
    // (either of them) would put the post-mount lines into that payload.
    const run = runScript(bootRecoveryScript(CTX_REASONS_OPTION), {
      withClipboard: true,
    });
    run.console.error("during boot");
    paintedCard(run);
    const ready = run.window[BOOT_RECOVERY_READY_GLOBAL] as () => void;
    ready();
    // THREE post-mount signals, one per guard layer: the console wrapper's
    // own freeze check, captureEntry's (the rejection listeners bypass the
    // wrapper), and captureFatal's (the error-event listener's fatal record).
    // Each guard's removal is caught by exactly this one assertion -- they
    // are not interchangeable defence in depth.
    run.console.error("after mount");
    // The rejection is CHUNK-SHAPED on purpose: it is the one post-mount
    // signal that would clear the rejection path's chunk-upgrade write into
    // lastError -- a lazy-route rejection after a healthy mount must not
    // hand the panel a lastError with no ring entry to back it.
    run.window.dispatch("unhandledrejection", {
      reason: new Error("Failed to fetch dynamically imported module: /assets/LazyRoute-abc.js"),
    });
    run.window.dispatch("error", { message: "Uncaught TypeError: late" });
    const fatal = run.window[BOOT_RECOVERY_FATAL_GLOBAL] as (
      message?: string,
      detail?: Record<string, unknown>,
    ) => void;
    fatal("host report after mount", { name: "HostError" });
    await clickCopy(run);
    const payload = pastedPayload(run);
    const log = payload.console as Array<{ level: string; text: string }>;
    expect(log.map((entry) => entry.text)).toEqual(["during boot"]);
    // The post-ready error event is not the fatal either.
    expect(payload.lastError).toBeUndefined();
    // Pass-through continued for the post-mount console call.
    expect(run.calls.map((call) => call.args[0])).toEqual([
      "during boot",
      "after mount",
    ]);
  });

  it("keeps the pass-through after the freeze", () => {
    // A healthy mount leaves the wrappers installed (unwinding could clobber
    // a later wrapper in a chained console); the freeze only stops RECORDING.
    const run = runScript(bootRecoveryScript(CTX_REASONS_OPTION));
    run.console.error("during boot");
    paintedCard(run);
    const ready = run.window[BOOT_RECOVERY_READY_GLOBAL] as () => void;
    ready();
    expect(() => run.console.error("after mount")).not.toThrow();
    expect(run.calls.map((call) => call.args[0])).toEqual([
      "during boot",
      "after mount",
    ]);
  });

  it("publishes the freeze handoff for a capture-only host (no reason table)", () => {
    // Without `reasons` there is no classified headline and no __appFatal,
    // but __appReady still exists: the freeze rides the ready handoff.
    const run = runScript(bootRecoveryScript(CTX_OPTION));
    const ready = run.window[BOOT_RECOVERY_READY_GLOBAL] as () => void;
    expect(typeof ready).toBe("function");
    expect(() => ready()).not.toThrow();
  });

  it("reports the captured fatal's class in the payload without a reason table", async () => {
    // No reasons: the HEADLINE is the host's generic copy, but a paste that
    // says reason:"timeout" beside lastError:"it threw" would contradict
    // itself -- the payload reason follows the capture.
    const run = runScript(bootRecoveryScript(CTX_OPTION), { withClipboard: true });
    run.window.dispatch("error", {
      message: "Failed to fetch dynamically imported module: /x.js",
    });
    paintedCard(run);
    await clickCopy(run);
    const payload = pastedPayload(run);
    expect(payload.reason).toBe("chunk");
    expect((payload.lastError as Record<string, unknown>).message).toContain(
      "Failed to fetch dynamically imported module",
    );
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
    // ONE ring entry, labelled as the rejection it is: the fatal record rides
    // the same entry instead of appending a second, mislabelled "uncaught".
    const log = payload.console as Array<{ level: string; text: string }>;
    expect(log).toHaveLength(1);
    expect(log[0].level).toBe("rejection");
  });

  it("masks credentials inside double-serialized console JSON", async () => {
    // THE DOMINANT console shape: a printed JSON body reaches the ring as a
    // STRING, so the quotes arrive backslash-escaped and the plain key mask
    // cannot see them. The copy text is what an operator pastes into an
    // issue, so the escaped form is masked with the same three discs.
    const run = runScript(bootRecoveryScript(CTX_OPTION), { withClipboard: true });
    run.console.log('login body sent: {"username":"bob","password":"hunter2"}');
    run.console.error('{"nested":{"token":"abc123"}}');
    paintedCard(run);
    await clickCopy(run);
    const text = run.written[0];
    expect(text).not.toContain("hunter2");
    expect(text).not.toContain("abc123");
    expect(text).toContain("password\\\":\\\"\u25CF\u25CF\u25CF");
    expect(text).toContain("token\\\":\\\"\u25CF\u25CF\u25CF");
    // The username is NOT a credential key: it must survive untouched.
    expect(text).toContain("bob");
  });

  it("masks credentials in PRETTY-PRINTED console JSON", async () => {
    // JSON.stringify(v, null, 2) is the most common way boot code logs an
    // object: the quotes are still escaped in the string, but whitespace
    // now surrounds the colon. A pattern that only matched the compact
    // form leaked exactly this shape (R6 S1).
    const run = runScript(bootRecoveryScript(CTX_OPTION), { withClipboard: true });
    run.console.error("boot failed", JSON.stringify({ user: "u", password: "hunter2" }, null, 2));
    paintedCard(run);
    await clickCopy(run);
    const text = run.written[0];
    expect(text).not.toContain("hunter2");
    // The username survives UNMASKED — in the payload's serialized form the
    // console line's own quote arrives as backslash + quote (and a quote
    // inside a secret value arrives with three — every stringify round
    // doubles the run and adds one).
    expect(text).toContain('\\"user\\": \\"u\\"');
  });

  it("masks a secret that itself contains a quote, whole", async () => {
    // The lazy value of the older pattern stopped at the secret's OWN
    // embedded quote and leaked the tail (R7 S1). The value now tolerates
    // backslash-runs of 2+ (the embedded-quote sequences in the paste) and
    // closes at the structural quote (exactly one backslash + quote), so the
    // embedded quote is INSIDE the mask.
    const run = runScript(bootRecoveryScript(CTX_OPTION), { withClipboard: true });
    run.console.error(JSON.stringify({ password: 'p"ssword', user: "bob" }));
    paintedCard(run);
    await clickCopy(run);
    const text = run.written[0];
    // NOTHING of the secret's tail survives: the DISTINCTIVE paste form of
    // the value is p + a 3-backslash run + quote + ssword (every stringify
    // round turns N backslashes into 2N+1) -- the mask must cover it whole.
    // (The bare `ssword` needle is unusable: the logged JSON's own key
    // `password` legitimately contains it.)
    const BS = String.fromCharCode(92);
    const DQ = String.fromCharCode(34);
    expect(text).not.toMatch(new RegExp("p" + BS.repeat(3) + '"'));
    expect(text).not.toContain("hunter2");
    // The width-matched close (R10 pin): the mask covers the WHOLE value,
    // the value's own structural close (one backslash + quote at this depth)
    // survives, and the escaped sibling pair follows it.
    // The WRITTEN text is the payload's SERIALIZED form: the entry's own
    // bare quotes arrive with 1 backslash in the paste, doubled to 2 plus
    // the quote-escape backslash = 3 backslashes per structural position
    // (2N+1 per stringify round).
    expect(text).toContain(
      "password" + BS + DQ + ":" + BS + DQ + "●●●" + BS + DQ + "," + BS + DQ + "user",
    );
    // ...and no secret tail sits directly beside the mask (the close-width
    // mutants put `●●● + close + ssword` there instead).
    expect(text).not.toMatch(/●●●.{0,4}?ssword/);
  });

  it("masks a header line AND an escaped body on the same entry (scanner-first)", async () => {
    // THE R9 S0 pin: HEADER/QUERY's value classes accept backslashes -- run
    // them BEFORE the scanner and they eat the escaping backslash of the
    // following escaped credential head, leaving hunter2/tok-LEAKME in
    // cleartext. The scanner must run FIRST, on the pristine serialized text.
    const run = runScript(bootRecoveryScript(CTX_OPTION), { withClipboard: true });
    run.console.error(
      "Authorization: Bearer abc123, " +
        JSON.stringify({ password: "hunter2" }),
    );
    paintedCard(run);
    await clickCopy(run);
    const text = run.written[0];
    expect(text).not.toContain("hunter2");
    expect(text).not.toContain("abc123");
    const BS2 = String.fromCharCode(92);
    expect(text).toContain("Authorization" + ": " + "\u25cf\u25cf\u25cf");
    expect(text).toContain('"password' + BS2 + '":' + BS2 + '"' + "\u25cf\u25cf\u25cf");
  });

  it("keeps an escaped EMPTY value empty (the family maskSecret rule)", async () => {
    // maskSecret("") stays "": an escaped empty token must not become three
    // discs just because its shape reached the scanner (R10/M3 pin).
    const run = runScript(bootRecoveryScript(CTX_OPTION), { withClipboard: true });
    const BS2 = String.fromCharCode(92);
    const DQ2 = String.fromCharCode(34);
    run.console.error("t1 " + BS2 + DQ2 + "token" + BS2 + DQ2 + ":" + BS2 + DQ2 + BS2 + DQ2);
    paintedCard(run);
    await clickCopy(run);
    const text = run.written[0];
    // The entry's own backslash doubles in the payload serialization: the
    // escaped-empty pair arrives as THREE backslashes per quote (2N+1).
    expect(text).toContain("token" + BS2 + BS2 + BS2 + DQ2 + ":" + BS2 + BS2 + BS2 + DQ2);
    expect(text).not.toContain("token" + BS2 + BS2 + BS2 + DQ2 + ":" + BS2 + BS2 + BS2 + DQ2 + "●●●");
  });

  it("masks credentials through three stringify levels (7-backslash runs)", async () => {
    // Raw 2 backslashes in the entry arrive as 7 in the paste (2N+1 per
    // round) — the unbounded run is what covers this; a bounded {1,3} leaked.
    const run = runScript(bootRecoveryScript(CTX_OPTION), { withClipboard: true });
    const inner = JSON.stringify({ password: "hunter2" });
    const mid = JSON.stringify({ payload: inner });
    run.console.error("wrapped:", JSON.stringify({ body: mid }));
    paintedCard(run);
    await clickCopy(run);
    expect(run.written[0]).not.toContain("hunter2");
  });

  it("masks credentials in a two-level nested JSON string", async () => {
    // An API error body that itself carries a JSON string: the inner quotes
    // arrive with two backslashes before them.
    const run = runScript(bootRecoveryScript(CTX_OPTION), { withClipboard: true });
    run.console.error(
      "response:",
      JSON.stringify({ detail: JSON.stringify({ password: "hunter2" }) }),
    );
    paintedCard(run);
    await clickCopy(run);
    expect(run.written[0]).not.toContain("hunter2");
  });

  it("forwards this and the original's return value through the wrapper", async () => {
    // The wrapper is a transparent middleman: a shim installed BEFORE the
    // script runs keeps its return value AND its this-binding through the
    // wrap (a page logging through a detached alias must not change either).
    let seenThis: unknown = "untouched";
    const shim = function (this: unknown) {
      seenThis = this;
      return "RET";
    };
    const consoleObject: Record<string, unknown> = {
      error: shim,
      warn: () => {},
      log: () => {},
      info: () => {},
    };
    const run = runScript(bootRecoveryScript(CTX_OPTION), {
      consoleObject,
      withClipboard: true,
    });
    const returned = (consoleObject.error as (...args: unknown[]) => unknown)(
      "through the wrapper",
    );
    expect(returned).toBe("RET");
    expect(seenThis).toBe(consoleObject);
    // ...and the capture still recorded the call.
    paintedCard(run);
    await clickCopy(run);
    const log = pastedPayload(run).console as Array<{ text: string }>;
    expect(log.map((entry) => entry.text)).toEqual(["through the wrapper"]);
  });

  it("keeps wrapping the other levels when one accessor is hostile", () => {
    // A throwing getter on console.error must not stop warn/log/info from
    // being wrapped -- exactly what a single guard around the loop would do.
    const warnShim = (...args: unknown[]) => {
      void args;
    };
    const consoleObject: Record<string, unknown> = {
      warn: warnShim,
      log: () => {},
      info: () => {},
    };
    Object.defineProperty(consoleObject, "error", {
      get() {
        throw new Error("hostile accessor");
      },
      configurable: true,
    });
    const run = runScript(bootRecoveryScript(CTX_OPTION), { consoleObject });
    // The install survived the hostile accessor -- and warn was WRAPPED: the
    // property no longer holds the raw spy (this identity check is the
    // mutation killer; the spy alone fills whether or not the wrap ran).
    const warn = consoleObject.warn as unknown;
    expect(warn).not.toBe(warnShim);
    expect(typeof warn).toBe("function");
    expect(() =>
      (warn as (...args: unknown[]) => void)("still here"),
    ).not.toThrow();
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
    // The dispatched fatal upgrades the pane-only shape's payload reason too
    // (no reason table needed for the FIELD to tell the truth).
    expect(payload.reason).toBe("error");
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
    const originalCreate = document.createElement;
    const originalExec = document.execCommand;
    let seenValue = "";
    let command: string | null = null;
    document.createElement = ((tag: string) => {
      const el = originalCreate.call(document, tag);
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
    document.execCommand = (cmd: string) => {
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
      document.createElement = originalCreate;
      document.execCommand = originalExec;
    }
  });

  it("reports the failed label when every path refuses", async () => {
    const run = runScript(bootRecoveryScript(CTX_OPTION), {});
    paintedCard(run);
    const originalExec = document.execCommand;
    document.execCommand = () => false;
    try {
      await clickCopy(run);
      expect(copyButtonOf(run).textContent).toBe(BOOT_RECOVERY_COPY_FAILED);
    } finally {
      document.execCommand = originalExec;
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

  it("resolves a translated label through subtag stripping", () => {
    // A compound request with only a bare-tag entry: zh-Hant-TW strips to
    // zh-hant (absent), then to the primary zh (present) -- the same
    // subtag-stripping matrix the reason/block copy resolves through. A
    // mutation in that stripping loop makes this exact case fail.
    const run = runScript(
      bootRecoveryScript({
        copy: {
          locales: {
            en: { message: "m", retry: "r" },
            "zh-cn": { message: "m", retry: "r" },
            zh: { message: "m", retry: "r" },
          },
          rawDetailsLabel: "Raw",
          errorContext: { locales: { zh: { copy: "複製" } } },
        },
      }),
      { navigator: { languages: ["zh-Hant-TW"], language: "zh-Hant-TW" } },
    );
    paintedCard(run);
    expect(actionLabels(run)).toContain("複製");
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
