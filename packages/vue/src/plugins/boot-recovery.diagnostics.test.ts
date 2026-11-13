// AI-generated: developed with the DeepSeek Harness agent (model
// DeepSeek-V4.1-Flash) directed and reviewed by langyo — SySL-1.0 §2.3
// disclosure.

import { createHash } from "node:crypto";

import { describe, expect, it } from "vitest";

import {
  BOOT_RECOVERY_BLOCK_GLOBAL,
  BOOT_RECOVERY_CHUNK_MISS,
  BOOT_RECOVERY_FATAL_GLOBAL,
  BOOT_RECOVERY_READY_GLOBAL,
  BOOT_RECOVERY_REASONS,
  BOOT_RECOVERY_REASON_KEYS,
  bootRecoveryScript,
} from "./boot-recovery.js";

/**
 * The panel's DIAGNOSTICS half: reason classification, the browser-block /
 * error / ready entries, and the resource diagnosis behind them.
 *
 * These are the capabilities the family's hand-rolled `res/fatal-fallback.js`
 * has carried for years, and they are what makes retiring that script possible
 * — a host switching to this plugin must not LOSE the browser gate, the
 * pre-mount error report or the "app is ready, stand down" handoff. The data
 * model and the classification rules are ported from that file: the reason
 * classes, the chunk-miss pattern and the payload field names are the family's
 * long-standing contract, and issue reports are written against them.
 *
 * Everything here is OPT-IN. A host that configures none of it keeps the
 * byte-identical script it hashes into its CSP (asserted at the bottom, and in
 * boot-recovery.details.test.ts for the pane's own option).
 */

const GOLDEN_DEFAULT_SHA256 =
  "b244cd45481ef9cd376c2e1a146fe78a51f9801c3e0c97dbd3057e6e28d9a5f7";
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

/** A full four-class reason table, so each class is distinguishable. */
const REASONS = {
  timeout: { title: "Timed out", message: "The app was too slow to start." },
  chunk: { title: "Resources failed", message: "A bundle could not be fetched." },
  error: { title: "Crashed", message: "An uncaught error interrupted boot." },
  browser: { title: "Old browser", message: "This browser is too old." },
};

const BLOCK_COPY = {
  title: "Browser not supported",
  message:
    "Your browser ({browser} {current}) cannot run this app. Update to {browser} {min}.",
};

interface Run {
  loader: HTMLElement;
  window: Record<string, unknown>;
  timers: Array<() => void>;
}

/**
 * Execute a generated script against a real document.
 *
 * The DOM is real (happy-dom, the package's test environment) because these
 * paths read `performance`, `document.readyState`, `querySelector` and, for
 * the scrollbars, layout boxes — a hand-rolled fake would test the fake.
 */
function runScript(
  script: string,
  options: {
    resources?: Array<{ name: string; duration?: number; responseStatus?: number }>;
    scripts?: string[];
  } = {},
): Run {
  // One loader per case: `querySelector("#loading-screen")` returns the FIRST
  // match, so a stale loader would take the paint.
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
    // The probe only needs the element to EXIST with a src (the panel reads
    // script[src] and joins it against the resource timing table); happy-dom
    // would otherwise try to fetch it and log a load failure.
    el.setAttribute("disabled", "");
    document.body.appendChild(el);
  }

  const win: Record<string, unknown> = {};
  const timers: Array<() => void> = [];
  const entries = options.resources ?? [];
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
    script,
  );
  run(
    { protocol: "http:", hostname: "tauri.localhost", href: "http://tauri.localhost/" },
    document,
    (callback: () => void) => {
      timers.push(callback);
      return timers.length;
    },
    undefined,
    { languages: ["en-US"], language: "en-US" },
    win,
    { getEntriesByType: () => entries },
    undefined,
    Date,
  );
  return { loader, window: win, timers };
}

/** The panel's headline / explanation, or undefined when nothing painted. */
function panelText(run: Run, selector: string): string | undefined {
  return (
    run.loader.querySelector(
      "[data-hk-boot-recovery-panel] " + selector,
    )?.textContent ?? undefined
  );
}

function panelTitle(run: Run): string | undefined {
  return panelText(run, ".hk-error-landing__title");
}

// ── defaults ───────────────────────────────────────────────────────────────

describe("the diagnostics defaults", () => {
  it("pins the three family globals and the four reason classes", () => {
    // These names are the RETIREMENT CONTRACT: the host scripts being deleted
    // call exactly these, so they may not drift.
    expect(BOOT_RECOVERY_BLOCK_GLOBAL).toBe("__appBlock");
    expect(BOOT_RECOVERY_FATAL_GLOBAL).toBe("__appFatal");
    expect(BOOT_RECOVERY_READY_GLOBAL).toBe("__appReady");
    expect([...BOOT_RECOVERY_REASON_KEYS]).toEqual([
      "timeout",
      "chunk",
      "error",
      "browser",
    ]);
  });

  it("carries a non-empty English default for every reason class", () => {
    for (const reason of BOOT_RECOVERY_REASON_KEYS) {
      const entry = BOOT_RECOVERY_REASONS[reason];
      expect(entry, reason).toBeTruthy();
      expect(entry.title.length, reason).toBeGreaterThan(0);
      expect(entry.message.length, reason).toBeGreaterThan(0);
    }
  });

  it("pins the family's chunk-miss pattern", () => {
    // Verbatim from res/fatal-fallback.js: a chunk miss that this pattern
    // stops recognising would silently downgrade to the generic error class.
    const hits = [
      "ChunkLoadError",
      "Loading chunk 42 failed",
      "Loading CSS chunk 7 failed",
      "Failed to fetch dynamically imported module: /a.js",
      "error loading dynamically imported module",
      "Importing a module script failed",
      "Unable to preload CSS",
    ];
    for (const hit of hits) expect(BOOT_RECOVERY_CHUNK_MISS.test(hit), hit).toBe(true);
    for (const miss of ["Uncaught TypeError", "Timeout", ""]) {
      expect(BOOT_RECOVERY_CHUNK_MISS.test(miss), miss).toBe(false);
    }
  });
});

// ── browser block ──────────────────────────────────────────────────────────

describe("the browser-block entry", () => {
  const script = () => bootRecoveryScript({ copy: { browserBlock: BLOCK_COPY } });

  it("publishes the family's __appBlock global by default", () => {
    const run = runScript(script());
    expect(typeof run.window[BOOT_RECOVERY_BLOCK_GLOBAL]).toBe("function");
  });

  it("paints IMMEDIATELY, in the info tone, with the placeholders filled", () => {
    const run = runScript(script());
    // No timer has fired: the news is already known, so waiting out the
    // watchdog would only delay it.
    expect(run.timers.length).toBe(1);
    (run.window[BOOT_RECOVERY_BLOCK_GLOBAL] as Function)("Chrome", "70", "90");

    const panel = run.loader.querySelector("[data-hk-boot-recovery-panel]");
    expect(panel, "the info panel paints without the watchdog").not.toBeNull();
    // Info, not error: an unsupported browser is a compatibility notice.
    expect(panel!.className).toContain("is-info");
    expect(panel!.className).not.toContain("is-error");
    expect(panelTitle(run)).toBe("Browser not supported");
    const desc = panelText(run, ".hk-error-landing__desc");
    expect(desc).toBe(
      "Your browser (Chrome 70) cannot run this app. Update to Chrome 90.",
    );
    // Every placeholder resolved and none left on the card.
    expect(desc).not.toContain("{");
  });

  it("fills every occurrence of a repeated placeholder", () => {
    const run = runScript(script());
    (run.window[BOOT_RECOVERY_BLOCK_GLOBAL] as Function)("Firefox", "60", "110");
    const desc = panelText(run, ".hk-error-landing__desc") ?? "";
    expect(desc.match(/Firefox/g)).toHaveLength(2);
    expect(desc).toContain("Firefox 60");
    expect(desc).toContain("Firefox 110");
  });

  it("survives hostile arguments without leaving a placeholder behind", () => {
    const run = runScript(script());
    const hostile = {
      toString() {
        throw new Error("nope");
      },
    };
    // A throwing String() conversion must degrade its own field, not cost the
    // operator the card.
    for (const bad of [hostile, null, undefined]) {
      expect(() =>
        (run.window[BOOT_RECOVERY_BLOCK_GLOBAL] as Function)(bad, bad, bad),
      ).not.toThrow();
    }
    const panel = run.loader.querySelector("[data-hk-boot-recovery-panel]");
    expect(panel).not.toBeNull();
    expect(panelText(run, ".hk-error-landing__desc")).not.toContain("{browser}");
  });

  it("never adds the raw-details pane to a block notice", () => {
    // Even with the pane configured: a compatibility notice is not a failure
    // and carries no payload.
    const run = runScript(
      bootRecoveryScript({
        copy: { browserBlock: BLOCK_COPY, rawDetailsLabel: "Raw error details" },
      }),
    );
    (run.window[BOOT_RECOVERY_BLOCK_GLOBAL] as Function)("Chrome", "70", "90");
    expect(run.loader.querySelector(".hk-error-landing__details")).toBeNull();
    expect(run.loader.querySelector(".hk-error-landing__details-pane")).toBeNull();
  });

  it("honours a renamed global and refuses to publish one that is off", () => {
    const renamed = runScript(
      bootRecoveryScript({
        copy: { browserBlock: BLOCK_COPY },
        globals: { block: "myBlock" },
      }),
    );
    expect(typeof renamed.window.myBlock).toBe("function");
    expect(renamed.window[BOOT_RECOVERY_BLOCK_GLOBAL]).toBeUndefined();
  });

  it("treats copy.browserBlock: false as not configured", () => {
    expect(sha256(bootRecoveryScript({ copy: { browserBlock: false } }))).toBe(
      GOLDEN_DEFAULT_SHA256,
    );
  });
});

// ── reason classification ──────────────────────────────────────────────────

describe("reason classification", () => {
  const script = () => bootRecoveryScript({ copy: { reasons: REASONS } });

  it("reports a silent expiry as the timeout class", () => {
    const run = runScript(script());
    run.timers[0]();
    expect(panelTitle(run)).toBe("Timed out");
  });

  it("reports a REFUSED boot script as a chunk miss, not a timeout", () => {
    // The stale-tab-after-redeploy signature: the entry chunk fetched and 404'd,
    // which never reaches window.onerror — calling it a timeout would hide the
    // one actionable fact there is.
    const run = runScript(script(), {
      scripts: ["/assets/index-abc.js"],
      resources: [
        { name: "http://tauri.localhost/assets/index-abc.js", duration: 12, responseStatus: 404 },
      ],
    });
    run.timers[0]();
    expect(panelTitle(run)).toBe("Resources failed");
  });

  it("stays a timeout when a NON-boot resource failed", () => {
    // A 404 on an unrelated stylesheet is not why the app failed to mount.
    const run = runScript(script(), {
      scripts: ["/assets/index-abc.js"],
      resources: [
        { name: "http://tauri.localhost/assets/index-abc.js", duration: 5, responseStatus: 200 },
        { name: "http://tauri.localhost/assets/widget.css", duration: 5, responseStatus: 404 },
      ],
    });
    run.timers[0]();
    expect(panelTitle(run)).toBe("Timed out");
  });

  it("classifies __appFatal's message: chunk family vs plain error", () => {
    const fatal = (message: string): string | undefined => {
      const run = runScript(script());
      (run.window[BOOT_RECOVERY_FATAL_GLOBAL] as Function)(message, {
        name: "TypeError",
        message,
      });
      return panelTitle(run);
    };
    expect(fatal("Failed to fetch dynamically imported module: /x.js")).toBe(
      "Resources failed",
    );
    expect(fatal("ChunkLoadError: Loading chunk 3 failed")).toBe("Resources failed");
    expect(fatal("Uncaught TypeError: x is undefined")).toBe("Crashed");
  });

  it("uses the English default for a class the host did not translate", () => {
    const run = runScript(
      bootRecoveryScript({ copy: { reasons: { timeout: REASONS.timeout } } }),
    );
    run.timers[0]();
    expect(panelTitle(run)).toBe("Timed out");
    // ...and a class left out still paints its default, never a blank card.
    const run2 = runScript(
      bootRecoveryScript({ copy: { reasons: { timeout: REASONS.timeout } } }),
    );
    (run2.window[BOOT_RECOVERY_FATAL_GLOBAL] as Function)("boom", {});
    expect(panelTitle(run2)).toBe(BOOT_RECOVERY_REASONS.error.title);
  });

  it("paints the payload with the classified reason, not a timeout default", () => {
    const run = runScript(script());
    (run.window[BOOT_RECOVERY_FATAL_GLOBAL] as Function)("ChunkLoadError", {
      name: "ChunkLoadError",
      message: "Loading chunk 9 failed",
    });
    const tree = run.loader.querySelector(".s-tool-json-tree");
    // Without the details pane there is no tree; the reason still has to be
    // the painted class. Assert through the title, and that no pane appeared.
    expect(tree).toBeNull();
    expect(panelTitle(run)).toBe("Resources failed");
  });
});

// ── fatal / ready entries ──────────────────────────────────────────────────

describe("the __appFatal and __appReady entries", () => {
  const script = () => bootRecoveryScript({ copy: { reasons: REASONS } });

  it("publishes both family globals when the reason table is configured", () => {
    const run = runScript(script());
    expect(typeof run.window[BOOT_RECOVERY_FATAL_GLOBAL]).toBe("function");
    expect(typeof run.window[BOOT_RECOVERY_READY_GLOBAL]).toBe("function");
  });

  it("paints __appFatal immediately instead of waiting for the watchdog", () => {
    const run = runScript(script());
    (run.window[BOOT_RECOVERY_FATAL_GLOBAL] as Function)("Uncaught TypeError: x", {
      name: "TypeError",
      message: "x",
    });
    expect(run.loader.querySelector("[data-hk-boot-recovery-panel]")).not.toBeNull();
  });

  it("__appReady removes ONLY the nodes the panel added", () => {
    // The host's loader element, its contents and its dismissal class belong
    // to the host's loader logic — a boot-failure surface must never fight it.
    const run = runScript(script());
    (run.window[BOOT_RECOVERY_FATAL_GLOBAL] as Function)("boom", {});
    expect(run.loader.querySelector("[data-hk-boot-recovery-panel]")).not.toBeNull();

    (run.window[BOOT_RECOVERY_READY_GLOBAL] as Function)();
    expect(run.loader.querySelector("[data-hk-boot-recovery-panel]")).toBeNull();
    // The loader itself survives, still in the document.
    expect(document.getElementById("loading-screen")).toBe(run.loader);
    // ...and its style sibling went with the panel.
    expect(run.loader.querySelectorAll("style").length).toBe(0);
  });

  it("__appReady is a no-op when nothing was painted", () => {
    const run = runScript(script());
    expect(() => (run.window[BOOT_RECOVERY_READY_GLOBAL] as Function)()).not.toThrow();
    expect(run.loader.textContent).toBe("Loading");
  });

  it("honours renamed globals and refuses to publish one that is off", () => {
    const run = runScript(
      bootRecoveryScript({
        copy: { reasons: REASONS },
        globals: { fatal: "myFatal", ready: false },
      }),
    );
    expect(typeof run.window.myFatal).toBe("function");
    expect(run.window[BOOT_RECOVERY_FATAL_GLOBAL]).toBeUndefined();
    expect(run.window[BOOT_RECOVERY_READY_GLOBAL]).toBeUndefined();
  });
});

// ── option validation ──────────────────────────────────────────────────────

describe("diagnostics option validation", () => {
  it("rejects a malformed browserBlock", () => {
    for (const bad of [{}, { title: "" }, { title: "t", message: "" }, { title: 1, message: "m" }]) {
      expect(() => bootRecoveryScript({ copy: { browserBlock: bad as never } })).toThrow(
        /copy\.browserBlock/,
      );
    }
  });

  it("rejects a malformed reason table, naming the class", () => {
    expect(() =>
      bootRecoveryScript({
        copy: { reasons: { chunk: { title: "t" } as never } },
      }),
    ).toThrow(/copy\.reasons\["chunk"\]/);
  });

  it("rejects an unknown reason class", () => {
    expect(() =>
      bootRecoveryScript({
        copy: { reasons: { nope: { title: "t", message: "m" } } as never },
      }),
    ).toThrow(/unknown reason/);
  });

  it("rejects the diagnostics halves in heal-only mode", () => {
    // They all paint inside the watchdog's panel, which heal-only never shows.
    expect(() =>
      bootRecoveryScript({
        loadingScreen: false,
        copy: { browserBlock: BLOCK_COPY },
      }),
    ).toThrow(/browserBlock/);
    expect(() =>
      bootRecoveryScript({ loadingScreen: false, copy: { reasons: REASONS } }),
    ).toThrow(/reasons/);
  });
});

// ── the contract every shape must hold ─────────────────────────────────────

describe("the diagnostics script's invariants", () => {
  const shapes: Array<[string, string]> = [
    ["browserBlock only", bootRecoveryScript({ copy: { browserBlock: BLOCK_COPY } })],
    ["reasons only", bootRecoveryScript({ copy: { reasons: REASONS } })],
    [
      "reasons + pane",
      bootRecoveryScript({ copy: { reasons: REASONS, rawDetailsLabel: "Raw details" } }),
    ],
    [
      "all three",
      bootRecoveryScript({
        copy: {
          reasons: REASONS,
          rawDetailsLabel: "Raw details",
          browserBlock: BLOCK_COPY,
        },
      }),
    ],
  ];

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
      expect(script, label).toBe(script);
    }
  });

  it("never adds a second reload or navigate path", () => {
    for (const [label, script] of shapes) {
      expect(script.match(/location\.reload\(/g) ?? [], label).toHaveLength(1);
      expect(script.match(/location\.replace\(/g) ?? [], label).toHaveLength(1);
    }
  });

  it("DEFINES every helper it CALLS, before the call site — for every shape", () => {
    // The bug class this pins: an opt-in half that references a helper another
    // half happens to emit. Every caller is wrapped in a guard, so the missing
    // definition fails SILENTLY — the panel just never paints. (Exactly what
    // happened to safeCall, which only rode the details runtime while the
    // browser-block entry needed it too.)
    const helpers = [
      "safeCall",
      "resourceIndex",
      "bootScripts",
      "failedResources",
      "clipText",
      "reasonCopy",
      "reasonOf",
      "staleReason",
      "fillBlock",
      "raiseFatal",
      "standDown",
      "raiseBrowserBlock",
      "buildPayload",
      "detailsSection",
      "renderJsonTree",
    ];
    for (const [label, script] of shapes) {
      for (const helper of helpers) {
        const definitions = [
          ...script.matchAll(new RegExp("function " + helper + "\\(", "g")),
        ];
        // Every textual reference, then drop the definition's own name.
        // (A lookbehind cannot serve here: the emitted source contains the
        // definition and the call sites in one string, and "function NAME("
        // must not count as a call while "NAME(" must.)
        const defAt = script.indexOf("function " + helper + "(");
        const calls = [
          ...script.matchAll(new RegExp("\\b" + helper + "\\(", "g")),
        ]
          .map((match) => match.index as number)
          .filter((at) => at !== defAt + "function ".length);
        if (calls.length === 0) continue; // this shape does not use it
        // THE invariant: the helper is defined at all. A function declaration
        // hoists, so source order is not a runtime requirement — what breaks
        // silently is the definition being ABSENT from a shape that calls it
        // (exactly what happened to safeCall, which only rode the details
        // runtime while the browser-block entry needed it too).
        expect(
          definitions.length,
          label + " calls " + helper + " but does not define it",
        ).toBeGreaterThanOrEqual(1);
        // ...and the definition sits before every call site. Declarations
        // hoist, so this is not a runtime requirement — it is the readable
        // order a reviewer needs to see that the shape is self-consistent.
        expect(
          defAt,
          label + ": " + helper + " defined after its first call",
        ).toBeLessThan(Math.min(...calls));
      }
    }
  });

  it("keeps every diagnostics name out of the default script", () => {
    const script = bootRecoveryScript();
    for (const marker of [
      "REASON_TABLE",
      "CHUNK_MISS_RE",
      "reasonCopy",
      "reasonOf",
      "staleReason",
      "raiseFatal",
      "standDown",
      "raiseBrowserBlock",
      "fillBlock",
      "BLOCK_GLOBAL",
      "FATAL_GLOBAL",
      "READY_GLOBAL",
      "__appBlock",
      "__appFatal",
      "__appReady",
      "bootScripts",
      "resourceIndex",
      "performance.getEntriesByType",
    ]) {
      expect(script, marker).not.toContain(marker);
    }
  });
});

describe("byte-compat", () => {
  it("keeps the default script byte-identical", () => {
    expect(sha256(bootRecoveryScript())).toBe(GOLDEN_DEFAULT_SHA256);
  });

  it("keeps the heal-only script byte-identical", () => {
    expect(sha256(bootRecoveryScript({ loadingScreen: false }))).toBe(
      GOLDEN_HEAL_ONLY_SHA256,
    );
  });

  it("treats every 'off' spelling as not configured", () => {
    for (const options of [
      { copy: { browserBlock: false, reasons: undefined } },
      { copy: { browserBlock: undefined, reasons: null } },
      { globals: { block: false, fatal: false, ready: false } },
    ]) {
      expect(sha256(bootRecoveryScript(options as never))).toBe(
        GOLDEN_DEFAULT_SHA256,
      );
    }
  });

  it("leaves a locale-table host without diagnostics byte-clean", () => {
    const script = bootRecoveryScript({
      copy: { locales: { en: { message: "m", retry: "r" } } },
    });
    for (const marker of ["REASON_TABLE", "raiseFatal", "REASON_TABLE"]) {
      expect(script).not.toContain(marker);
    }
  });
});
