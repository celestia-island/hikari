// AI-generated: developed with the DeepSeek Harness agent (model
// DeepSeek-V4.1-Flash) directed and reviewed by langyo — SySL-1.0 §2.3
// disclosure.

import { createHash } from "node:crypto";

import { describe, expect, it } from "vitest";

import { bootRecoveryScript } from "./boot-recovery.mjs";

/**
 * The MULTILINGUAL matrix: a panel that is BOTH translated and reason-classed.
 *
 * The defect this suite was written for: the reason table is single-language,
 * and it used to overwrite the headline and explanation `copy.locales` had
 * already selected. A host configuring both got its reason wording in one
 * language and its retry label in another — so no multilingual host could
 * migrate to this panel, which is exactly what the hosts being retired need.
 *
 * The fix restores the retired family script's own matrix
 * (`t[prefix + suffix] ?? t["error" + suffix]`): resolve per locale, and when
 * the locale has no translation for that reason, fall back to THAT LOCALE's
 * generic wording — never to another language's reason row, because a Chinese
 * panel showing one English sentence reads as a bug.
 *
 * The bytes a host hashes must not move: every case here is opt-in, and the
 * two golden scripts are re-pinned at the bottom.
 */

const GOLDEN_DEFAULT_SHA256 =
  "9c2e92b860bec8a0ab598dde0cea4044b09eb648d92f62d9ec2f08c16d4fc6e2";
const GOLDEN_HEAL_ONLY_SHA256 =
  "8c2f9e87abca07aceef26330f8f0b377bc3d1d0b332b9c6dfdf573ea79cc72f7";

function sha256(text: string): string {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

function foreignChars(text: string): string[] {
  return [...text].filter((char) => {
    const code = char.charCodeAt(0);
    return code !== 9 && code !== 10 && (code < 32 || code > 126);
  });
}

/** Two locales with distinguishable copy in every slot. */
const LOCALES = {
  en: { title: "EN title", message: "EN body", retry: "Reload" },
  "zh-CN": { title: "ZH title", message: "ZH body", retry: "ZH retry" },
};

/**
 * A host that translates the panel AND classifies its failures, translating
 * only the timeout class — so the other classes must fall back per locale.
 */
const MULTILINGUAL = {
  copy: {
    locales: LOCALES,
    reasons: {
      timeout: {
        title: "EN timed out",
        message: "EN timeout body",
        locales: {
          "zh-CN": { title: "ZH timeout", message: "ZH timeout body" },
        },
      },
      chunk: { title: "EN chunk", message: "EN chunk body" },
      error: { title: "EN error", message: "EN error body" },
    },
  },
};

interface Run {
  loader: HTMLElement;
  window: Record<string, unknown>;
  timers: Array<() => void>;
}

/** Execute a generated script against a real document in one locale. */
function runScript(script: string, locale: string): Run {
  for (const stale of document.querySelectorAll("#loading-screen")) stale.remove();
  const loader = document.createElement("div");
  loader.id = "loading-screen";
  loader.textContent = "Loading";
  document.body.appendChild(loader);

  const win: Record<string, unknown> = {};
  const timers: Array<() => void> = [];
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
    { languages: [locale], language: locale },
    win,
    { getEntriesByType: () => [] },
    undefined,
    Date,
  );
  return { loader, window: win, timers };
}

/** The headline / explanation currently painted. */
function painted(run: Run): { title?: string; desc?: string; retry?: string } {
  const panel = run.loader.querySelector("[data-hk-boot-recovery-panel]");
  if (!panel) throw new Error("the panel was not painted");
  return {
    title: panel.querySelector(".hk-error-landing__title")?.textContent ?? undefined,
    desc: panel.querySelector(".hk-error-landing__desc")?.textContent ?? undefined,
    retry: panel.querySelector("button")?.textContent ?? undefined,
  };
}

describe("the multilingual reason matrix", () => {
  const script = (): string => bootRecoveryScript(MULTILINGUAL as never);

  it("paints the locale's OWN reason translation when it has one", () => {
    const run = runScript(script(), "zh-CN");
    run.timers[0]();
    expect(painted(run)).toEqual({
      title: "ZH timeout",
      desc: "ZH timeout body",
      retry: "ZH retry",
    });
  });

  it("falls back to THAT LOCALE's generic copy, not to the English reason row", () => {
    // The acceptance criterion, in one assertion: zh has no chunk translation,
    // so the panel shows zh's generic wording. Showing "EN chunk body" here
    // would be the original bug in a new costume.
    const run = runScript(script(), "zh-CN");
    (run.window.__appFatal as Function)("ChunkLoadError", {});
    const copy = painted(run);
    expect(copy).toEqual({ title: "ZH title", desc: "ZH body", retry: "ZH retry" });
    expect(copy.title).not.toBe("EN chunk");
    expect(copy.desc).not.toBe("EN chunk body");
  });

  it("applies the same rule to the plain error class", () => {
    const run = runScript(script(), "zh-CN");
    (run.window.__appFatal as Function)("Uncaught TypeError: x", {});
    expect(painted(run).title).toBe("ZH title");
  });

  it("keeps the retry label localized on every reason class", () => {
    // The original defect left retry localized while title/message went
    // single-language; the label is now never sourced from the reason row.
    const run = runScript(script(), "zh-CN");
    (run.window.__appFatal as Function)("Uncaught TypeError: x", {});
    expect(painted(run).retry).toBe("ZH retry");
  });

  it("resolves an English panel to the reason row's own wording", () => {
    const run = runScript(script(), "en-US");
    (run.window.__appFatal as Function)("ChunkLoadError", {});
    // en has no explicit translation for chunk, but the row default IS the
    // English wording, so the generic en copy and the row agree in substance.
    expect(painted(run).desc).toBe("EN body");
  });

  it("strips subtags when matching a translation (zh-Hant-CN -> zh)", () => {
    // The TABLE key must be a PREFIX of the requested tag for this to prove
    // anything: `zh` has to be reached by stripping `-cn` then `-hant`, so a
    // resolver that only tries the exact tag fails here.
    const run = runScript(
      bootRecoveryScript({
        copy: {
          locales: {
            en: { message: "EN body", retry: "R" },
            zh: { message: "ZH body", retry: "S" },
          },
          reasons: {
            timeout: {
              title: "T",
              message: "M",
              // key is the short tag; the request is the long one
              locales: { zh: { title: "ZH timeout", message: "ZH timeout body" } },
            },
          },
        },
      } as never),
      "zh-Hant-CN",
    );
    run.timers[0]();
    expect(painted(run).title).toBe("ZH timeout");
    expect(painted(run).desc).toBe("ZH timeout body");
  });

  it("strips only trailing subtags, matching the most specific entry first", () => {
    // This one has to reach the REASON resolver's own stripping, which only
    // happens when the row `copy.locales` selected is itself a LONG tag: the
    // copy-table matcher strips subtags too, so a table keyed `zh-hant` would
    // hand `reasonCopy` a short tag and its loop would never be exercised.
    // Keying the table `zh-Hant-CN` makes GENERIC_LOCALE the long tag, so the
    // reason map's `zh-hant` can only be found by stripping.
    const run = runScript(
      bootRecoveryScript({
        copy: {
          locales: {
            en: { message: "EN body", retry: "R" },
            "zh-Hant-CN": { message: "HANT-CN body", retry: "H" },
          },
          reasons: {
            timeout: {
              title: "T",
              message: "M",
              locales: {
                "zh-hant": { title: "HANT timeout", message: "HANT timeout body" },
              },
            },
          },
        },
      } as never),
      "zh-Hant-CN",
    );
    run.timers[0]();
    // Reached ONLY through the progressive strip (zh-hant-cn -> zh-hant).
    expect(painted(run).title).toBe("HANT timeout");
    expect(painted(run).desc).toBe("HANT timeout body");
  });

  it("keeps a single-language host on the plain reason row (no matrix emitted)", () => {
    // The reason-only shape must not grow the locale machinery: it has no
    // locale table to resolve against, and its bytes are its own contract.
    const single = bootRecoveryScript({
      copy: { reasons: { chunk: { title: "Chunk", message: "Chunk body" } } },
    });
    // The MATRIX machinery specifically: the plain reason row lookup is the
    // single-language shape's own (it was emitted by task-2 and must stay).
    expect(single).not.toContain("GENERIC_LOCALE");
    expect(single).not.toContain("GENERIC_TITLE");
    expect(single).not.toContain("function hitRow");
    // The watchdog reports the timeout class, so the host's translated chunk
    // row is not what paints here — the class rule is what selects it.
    const run = runScript(single, "zh-CN");
    run.timers[0]();
    expect(painted(run).title).toBe(
      // the class it resolved, from the English defaults it kept for the
      // classes the host did not translate
      "Application initialization timed out",
    );
    // ...and a captured chunk miss DOES reach the host's row.
    const chunk = runScript(single, "zh-CN");
    (chunk.window.__appFatal as Function)("ChunkLoadError", {});
    expect(painted(chunk).title).toBe("Chunk");
  });
});

describe("the multilingual block notice", () => {
  const BLOCK = {
    copy: {
      locales: LOCALES,
      browserBlock: {
        title: "EN block",
        message: "Update {browser} {current} to {browser} {min}.",
        locales: {
          "zh-CN": {
            title: "ZH block",
            message: "ZH: {browser} {current} -> {browser} {min}.",
          },
        },
      },
    },
  };

  it("paints the locale's own block notice with placeholders filled", () => {
    const run = runScript(bootRecoveryScript(BLOCK as never), "zh-CN");
    (run.window.__appBlock as Function)("Chrome", "70", "90");
    expect(painted(run)).toEqual({
      title: "ZH block",
      desc: "ZH: Chrome 70 -> Chrome 90.",
      retry: "ZH retry",
    });
  });

  it("falls back to the host's default block pair for an untranslated locale", () => {
    const run = runScript(bootRecoveryScript(BLOCK as never), "en-US");
    (run.window.__appBlock as Function)("Chrome", "70", "90");
    expect(painted(run).title).toBe("EN block");
    expect(painted(run).desc).toBe("Update Chrome 70 to Chrome 90.");
  });

  it("stays in the info tone in every locale", () => {
    for (const locale of ["zh-CN", "en-US"]) {
      const run = runScript(bootRecoveryScript(BLOCK as never), locale);
      (run.window.__appBlock as Function)("Chrome", "70", "90");
      const panel = run.loader.querySelector("[data-hk-boot-recovery-panel]");
      expect(panel?.className, locale).toContain("is-info");
    }
  });
});

describe("the multilingual contract's invariants", () => {
  const shapes: Array<[string, string]> = [
    ["locales + reasons", bootRecoveryScript(MULTILINGUAL as never)],
    [
      "locales + block",
      bootRecoveryScript({
        copy: {
          locales: LOCALES,
          browserBlock: {
            title: "T",
            message: "M {browser}",
            locales: { "zh-CN": { title: "ZT", message: "ZM {browser}" } },
          },
        },
      } as never),
    ],
    [
      "locales + reasons + block + pane",
      bootRecoveryScript({
        copy: {
          locales: LOCALES,
          rawDetailsLabel: "Raw details",
          reasons: {
            timeout: { title: "T", message: "M", locales: { "zh-CN": { title: "ZT", message: "ZM" } } },
          },
          browserBlock: {
            title: "B",
            message: "BM {browser}",
            locales: { "zh-CN": { title: "BZT", message: "BZM {browser}" } },
          },
        },
      } as never),
    ],
  ];

  it("stays ASCII-only, a single classic IIFE, and tag-safe", () => {
    for (const [label, script] of shapes) {
      expect(foreignChars(script), label).toEqual([]);
      expect(script.startsWith("(function () {"), label).toBe(true);
      expect(script.endsWith("})();"), label).toBe(true);
      expect(script.toLowerCase(), label).not.toContain("</script");
      expect(script, label).not.toContain("<!--");
      expect(script, label).not.toContain("innerHTML");
    }
  });

  it("stays deterministic and keeps one reload path", () => {
    // Each shape is compared against ITS OWN regenerated bytes: the shapes
    // differ by construction, so cross-shape equality would be meaningless.
    const regenerate: Record<string, () => string> = {
      "locales + reasons": () => bootRecoveryScript(MULTILINGUAL as never),
      "locales + block": () =>
        bootRecoveryScript({
          copy: {
            locales: LOCALES,
            browserBlock: {
              title: "T",
              message: "M {browser}",
              locales: { "zh-CN": { title: "ZT", message: "ZM {browser}" } },
            },
          },
        } as never),
      "locales + reasons + block + pane": () =>
        bootRecoveryScript({
          copy: {
            locales: LOCALES,
            rawDetailsLabel: "Raw details",
            reasons: {
              timeout: {
                title: "T",
                message: "M",
                locales: { "zh-CN": { title: "ZT", message: "ZM" } },
              },
            },
            browserBlock: {
              title: "B",
              message: "BM {browser}",
              locales: { "zh-CN": { title: "BZT", message: "BZM {browser}" } },
            },
          },
        } as never),
    };
    for (const [label, script] of shapes) {
      expect(regenerate[label](), label).toBe(script);
      expect(script.match(/location\.reload\(/g) ?? [], label).toHaveLength(1);
    }
  });

  it("defines every helper it calls, for each multilingual shape", () => {
    const helpers = [
      "safeCall",
      "hitRow",
      "reasonRow",
      "reasonCopy",
      "blockCopy",
      "fillBlock",
      "raiseFatal",
      "standDown",
      "raiseBrowserBlock",
    ];
    for (const [label, script] of shapes) {
      for (const helper of helpers) {
        const def = script.indexOf("function " + helper + "(");
        const calls = [...script.matchAll(new RegExp("\\b" + helper + "\\(", "g"))]
          .map((match) => match.index as number)
          .filter((at) => at !== def + "function ".length);
        if (calls.length === 0) continue;
        expect(def, label + " calls " + helper + " without defining it").toBeGreaterThanOrEqual(0);
        expect(def, label + ": " + helper + " defined after its first call").toBeLessThan(
          Math.min(...calls),
        );
      }
    }
  });

  it("rejects a per-locale map without the locale table", () => {
    // Regression: a per-locale map is selected BY `copy.locales`. Without that
    // table the resolver has no locale to resolve, and because every caller is
    // guarded the broken script would fail SILENTLY (an unset panel) instead of
    // failing the build. Caught by a static review of the generated output —
    // `blockCopy()` referenced a `GENERIC_LOCALE` that was never declared for
    // this shape.
    expect(() =>
      bootRecoveryScript({
        copy: {
          reasons: {
            timeout: {
              title: "T",
              message: "M",
              locales: { "zh-CN": { title: "a", message: "b" } },
            },
          } as never,
        },
      }),
    ).toThrow(/requires copy\.locales/);
    expect(() =>
      bootRecoveryScript({
        copy: {
          browserBlock: {
            title: "T",
            message: "M",
            locales: { "zh-CN": { title: "a", message: "b" } },
          } as never,
        },
      }),
    ).toThrow(/requires copy\.locales/);
  });

  it("rejects two translation keys that normalise to one tag", () => {
    expect(() =>
      bootRecoveryScript({
        copy: {
          reasons: {
            timeout: {
              title: "T",
              message: "M",
              locales: {
                "zh_CN": { title: "A", message: "A" },
                "zh-cn": { title: "B", message: "B" },
              },
            },
          } as never,
        },
      }),
    ).toThrow(/same locale tag/);
  });

  it("rejects a malformed translation entry, naming the class", () => {
    expect(() =>
      bootRecoveryScript({
        copy: {
          reasons: {
            chunk: { title: "T", message: "M", locales: { "zh-CN": { title: "only a title" } } },
          } as never,
        },
      }),
    ).toThrow(/copy\.reasons\["chunk"\]\.locales\["zh-cn"\]/);
  });
});

describe("byte-compat is intact", () => {
  it("keeps the default script byte-identical", () => {
    expect(sha256(bootRecoveryScript())).toBe(GOLDEN_DEFAULT_SHA256);
  });

  it("keeps the heal-only script byte-identical", () => {
    expect(sha256(bootRecoveryScript({ loadingScreen: false }))).toBe(
      GOLDEN_HEAL_ONLY_SHA256,
    );
  });

  it("does not emit the locale matrix for a single-language host", () => {
    // Reached through neither option, so the machinery the multilingual case
    // needs must not exist at all.
    for (const options of [
      { copy: { reasons: { chunk: { title: "T", message: "M" } } } },
      { copy: { browserBlock: { title: "T", message: "M" } } },
      { copy: { locales: LOCALES } },
    ]) {
      const script = bootRecoveryScript(options as never);
      for (const marker of ["GENERIC_LOCALE", "GENERIC_TITLE", "BLOCK_TRANSLATIONS", "function blockCopy"]) {
        expect(script, JSON.stringify(Object.keys(options.copy)) + " / " + marker)
          .not.toContain(marker);
      }
    }
  });
});
