import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { afterEach, describe, expect, it, vi } from "vitest";
import { nextTick } from "vue";

import { resetErrorReportingForTests } from "./index";
import {
  SERVER_ERROR_LANDING_ID,
  SERVER_ERROR_LANDING_VERSION,
  parseServerErrorLanding,
  serializeServerErrorLanding,
} from "./serverLanding";

// MUT:hk-error-landing-standalone-drift — re-deriving the artifact bytes
// here instead of calling the builder would let the guard and the
// generator disagree about what the committed file should be; the suite
// consumes the builder's own `--json` channel (a fresh child process —
// vite's sass importer breaks inside vitest worker threads), so the bytes
// it compares against are the generator's exact output.
import {
  DEV_SHA_PLACEHOLDER,
  IDENTITY_MODULES,
} from "../../scripts/build-error-landing.mjs";

import { bootErrorLandingPage } from "../errorLandingStandalone/boot";

const HERE = dirname(fileURLToPath(import.meta.url));
/** packages/vue */
const VUE_DIR = resolve(HERE, "../..");
const ENTRY_DIR = resolve(VUE_DIR, "src/errorLandingStandalone");
const ARTIFACT_PATH = resolve(ENTRY_DIR, "error-landing.html");
const BUILDER_PATH = resolve(VUE_DIR, "scripts/build-error-landing.mjs");
const PKG_VERSION = JSON.parse(readFileSync(resolve(VUE_DIR, "package.json"), "utf8")).version;

interface BuildResult {
  html: string;
  gzipBytes: number;
  recorded: string[];
}

/**
 * One build per suite run: the generator is a real vite build (~10s), so
 * every assertion that needs the in-memory result shares this spawn. The
 * `--json` mode writes NOTHING — the drift comparison stays read-only.
 */
let buildPromise: Promise<BuildResult> | null = null;
function getBuild(): Promise<BuildResult> {
  buildPromise ??= new Promise<BuildResult>((resolveBuild, rejectBuild) => {
    const run = spawnSync(process.execPath, [BUILDER_PATH, "--json"], {
      cwd: VUE_DIR,
      encoding: "utf8",
      maxBuffer: 64 * 1024 * 1024,
    });
    if (run.status !== 0) {
      rejectBuild(
        new Error(
          `error-landing build failed (rc=${run.status}):\n${run.stderr?.slice(0, 4000) ?? ""}`,
        ),
      );
      return;
    }
    resolveBuild(JSON.parse(run.stdout) as BuildResult);
  });
  return buildPromise;
}

/** The committed artifact — the file hosts vendor. */
const committed = () => readFileSync(ARTIFACT_PATH, "utf8");

/** Strip the inline payloads so assertions see only load-bearing markup. */
function shellMarkup(html: string): string {
  return html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/g, "<script></script>")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/g, "<style></style>");
}

function plantIsland(text: string): HTMLScriptElement {
  const island = document.createElement("script");
  island.id = SERVER_ERROR_LANDING_ID;
  island.type = "application/json";
  island.textContent = text;
  document.head.appendChild(island);
  return island;
}

/** The real copy a locale ships for a key, read from the locale sources. */
function localeString(locale: string, file: string, key: string): string {
  const domain = JSON.parse(readFileSync(resolve(VUE_DIR, `src/i18n/locales/${locale}/${file}`), "utf8"));
  const flat: Record<string, string> = {};
  for (const [k, v] of Object.entries(domain)) {
    if (typeof v === "string") flat[k] = v;
    else if (v !== null && typeof v === "object") Object.assign(flat, v as Record<string, string>);
  }
  return flat[key];
}

afterEach(() => {
  resetErrorReportingForTests();
  document.querySelectorAll("[data-hikari-error-reporting]").forEach((el) => el.remove());
  document.querySelectorAll(".hk-error-reporting-overlay").forEach((el) => el.remove());
  document.getElementById(SERVER_ERROR_LANDING_ID)?.remove();
  vi.restoreAllMocks();
});

describe("standalone error-landing artifact: rebuild contract", () => {
  it("keeps the committed artifact byte-identical to a fresh rebuild", async () => {
    const built = await getBuild();
    expect(committed()).toBe(built.html);
  }, 240_000);

  it("stamps the provenance marker with the island-contract version, package version and build sha", async () => {
    const built = await getBuild();
    const expected = `<meta name="hk-error-landing" content="v1 ${PKG_VERSION} ${DEV_SHA_PLACEHOLDER}">`;
    // The island-contract half of the marker must stay in step with the
    // reader's own constant: if serverLanding.ts ever moves to a second
    // island version, a v1 marker on a built page would lie about what it
    // parses — this pin is what forces that change through both files.
    expect(SERVER_ERROR_LANDING_VERSION).toBe(1);
    expect(built.html).toContain(expected);
    expect(committed()).toContain(expected);
  }, 240_000);

  it("makes zero external requests: no src/href attributes, links or remote URLs in the markup", async () => {
    const built = await getBuild();
    const markup = shellMarkup(built.html);
    expect(markup).not.toMatch(/\b(src|href)\s*=/i);
    expect(markup).not.toMatch(/<link\b/i);
    expect(markup).not.toMatch(/https?:\/\//);
    expect(markup).not.toMatch(/url\s*\(/i);
  }, 240_000);

  it("carries the island reader: the family id survives into the inline bundle", async () => {
    const { html } = await getBuild();
    // The id is a string constant of serverLanding.ts — its presence in
    // the minified bundle is the reader having been bundled, and its
    // absence is exactly what dropping the reader from the entry does.
    expect(html).toContain(SERVER_ERROR_LANDING_ID);
    expect(committed()).toContain(SERVER_ERROR_LANDING_ID);
  }, 240_000);

  it("ships the error copy of every catalog locale inside the bundle", async () => {
    const { html } = await getBuild();
    const { readdirSync } = await import("node:fs");
    const locales = readdirSync(resolve(VUE_DIR, "src/i18n/locales"), { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name);
    expect(locales.length).toBeGreaterThanOrEqual(11);
    for (const locale of locales) {
      const title = localeString(locale, "errors.json", "hikari::errors.defaultTitle");
      expect(title, `locale ${locale} ships its defaultTitle`).toBeTruthy();
      expect(html).toContain(title);
    }
  }, 240_000);

  it("keeps the gzipped artifact under the ceiling recorded in the PR", async () => {
    const { gzipBytes } = await getBuild();
    // The wave brief's target for this page was < 25 KiB gzipped; the
    // full-reuse contract (the family overlay, card and JSON tree are
    // imports, copies being banned) measures at ~66 KiB and the decision
    // which constraint bends is the PR's open question. This pin holds
    // the artifact at its recorded size so it cannot silently grow while
    // that decision is open — 70 KiB is the ceiling, not the target.
    expect(gzipBytes).toBeLessThan(70 * 1024);
    expect(gzipBytes).toBeGreaterThan(0);
  }, 240_000);
});

describe("standalone error-landing artifact: import identity", () => {
  it("builds from the real family modules — a copy cannot stand in", async () => {
    const { recorded } = await getBuild();
    // MUT:hk-error-landing-standalone-identity — these are the import
    // EDGES the build actually resolved. File presence in the graph is
    // not the pin: the card also reaches the bundle transitively through
    // the takeover, so only the entry's own edge proves the page renders
    // the real card (swapping boot.tsx's import for a hand-rolled copy
    // removes exactly this edge and the assertion goes red).
    const boot = resolve(ENTRY_DIR, "boot.tsx");
    const reportingIndex = resolve(VUE_DIR, "src/errorReporting/index.ts");
    expect(recorded, "boot reads the island through the real reader").toContain(
      `${boot} -> ${IDENTITY_MODULES.islandReader}`,
    );
    expect(recorded, "boot renders the real family card").toContain(
      `${boot} -> ${IDENTITY_MODULES.card}`,
    );
    expect(recorded, "the takeover mounts the real overlay component").toContain(
      `${reportingIndex} -> ${IDENTITY_MODULES.takeover}`,
    );
  }, 240_000);

  it("imports the family card and the island reader by specifier in the entry", () => {
    const boot = readFileSync(resolve(ENTRY_DIR, "boot.tsx"), "utf8");
    expect(boot).toContain('from "../components/HkErrorLanding"');
    expect(boot).toContain('from "../errorReporting/serverLanding"');
    expect(boot).toContain('readServerErrorLanding');
  });

  it("fails the build, naming the namespace, when a bundled source reads copy outside the subset", async () => {
    // MUT:hk-error-landing-ns-cross-check — the i18n subset is the page's
    // size-bearing wall: a component that starts reading a namespace the
    // subset does not carry renders English copy on every other locale,
    // silently. The build refuses that, naming the namespace. The probe
    // rides the builder's env seam (`HIKARI_ERROR_LANDING_NS_PROBE`, a
    // virtual module through the SAME scan as real sources) so this red
    // proof exercises the real build path without touching tracked files.
    // Negative control: the suite's drift test — the current tree, with
    // nothing outside the subset — builds green on every run.
    const run = spawnSync(process.execPath, [BUILDER_PATH, "--json"], {
      cwd: VUE_DIR,
      encoding: "utf8",
      env: {
        ...process.env,
        HIKARI_ERROR_LANDING_NS_PROBE: JSON.stringify({
          name: "virtual:hk-ns-probe",
          source: 'export const probeTitle = "hikari::probeNamespace.title";',
        }),
      },
    });
    expect(run.status, "the out-of-subset namespace fails the build").not.toBe(0);
    expect(run.stderr ?? "").toMatch(/probeNamespace/);
    expect(run.stderr ?? "").toMatch(/LOCALE_KEY_PREFIXES/);
  }, 240_000);
});

describe("standalone boot logic (the behavior the artifact ships)", () => {
  it("raises the family takeover from a valid island — status chip, code chip, details, copy action", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const island = plantIsland(
      serializeServerErrorLanding({
        status: 502,
        code: "identity_provider_unreachable",
        message: "identity provider unreachable",
        raw: { error: "identity provider unreachable" },
      }),
    );
    await bootErrorLandingPage(document);
    await nextTick();
    await nextTick();

    // The takeover mounted on the document body — the family overlay, not
    // a page-local imitation.
    const takeover = document.querySelector<HTMLElement>("[data-hikari-error-reporting]");
    expect(takeover).not.toBeNull();
    // MUT:hk-error-landing-standalone-reader — the status chip is the
    // island having been READ AND PARSED through the family reader; an
    // entry that stops calling readServerErrorLanding never reaches this
    // card shape (the neutral card has no chips), so this assertion is
    // the one that goes red.
    expect(takeover!.querySelector(".hk-error-landing__status")?.textContent).toBe("HTTP 502");
    expect(takeover!.querySelector(".hk-error-landing__code")?.textContent).toBe(
      "identity_provider_unreachable",
    );
    // The raw-details pane carries the server's payload.
    expect(takeover!.querySelector(".hk-error-landing__details")).not.toBeNull();
    // Actions: copy + home + retry, the family takeover's set.
    const actions = [...takeover!.querySelectorAll(".hk-error-landing__actions button")].map(
      (el) => el.textContent?.trim(),
    );
    expect(actions.some((text) => text?.includes("Back to home"))).toBe(true);
    expect(actions.some((text) => text?.includes("Retry"))).toBe(true);
    expect(actions.some((text) => text?.includes("Copy error details"))).toBe(true);
    // The island is consumed: a re-read (HMR, second install) sees nothing.
    expect(document.getElementById(SERVER_ERROR_LANDING_ID)).toBeNull();
  });

  it("renders the neutral family card when the island is missing — no chips, never blank", async () => {
    await bootErrorLandingPage(document);
    await nextTick();
    await nextTick();

    const host = document.querySelector<HTMLElement>(".hk-error-reporting-overlay");
    expect(host).not.toBeNull();
    const card = host!.querySelector(".hk-error-landing__card");
    expect(card).not.toBeNull();
    // Neutral: no status chip, no code chip — there is no server verdict
    // to show — but the family card shape with generic copy and actions.
    expect(host!.querySelector(".hk-error-landing__status")).toBeNull();
    expect(host!.querySelector(".hk-error-landing__code")).toBeNull();
    expect(host!.querySelector(".hk-error-landing__title")?.textContent).toBe(
      "Something went wrong",
    );
    const actions = [...host!.querySelectorAll(".hk-error-landing__actions button")].map(
      (el) => el.textContent?.trim(),
    );
    expect(actions).toHaveLength(2);
    expect(actions.some((text) => text?.includes("Back to home"))).toBe(true);
    expect(actions.some((text) => text?.includes("Retry"))).toBe(true);
  });

  it("renders the neutral family card when the island is malformed — still never blank", async () => {
    plantIsland("{not json");
    await bootErrorLandingPage(document);
    await nextTick();
    await nextTick();

    const host = document.querySelector<HTMLElement>(".hk-error-reporting-overlay");
    expect(host).not.toBeNull();
    expect(host!.querySelector(".hk-error-landing__card")).not.toBeNull();
    expect(host!.querySelector(".hk-error-landing__title")?.textContent).toBe(
      "Something went wrong",
    );
    expect(host!.querySelector(".hk-error-landing__status")).toBeNull();
    // The unusable island is consumed, not retried on every boot.
    expect(document.getElementById(SERVER_ERROR_LANDING_ID)).toBeNull();
  });

  it("rejects a future island version like the family reader does", async () => {
    plantIsland('{"v":2,"status":502,"message":"x"}');
    expect(parseServerErrorLanding('{"v":2,"status":502,"message":"x"}')).toBeNull();
    await bootErrorLandingPage(document);
    await nextTick();
    await nextTick();
    const host = document.querySelector<HTMLElement>(".hk-error-reporting-overlay");
    expect(host).not.toBeNull();
    expect(host!.querySelector(".hk-error-landing__status")).toBeNull();
  });

  it("resolves the card language from navigator.language alone", async () => {
    const jaRetry = localeString("ja", "components.json", "hikari::errorBoundary.retry");
    expect(jaRetry).toBeTruthy();
    const original = Object.getOwnPropertyDescriptor(Navigator.prototype, "language");
    Object.defineProperty(Navigator.prototype, "language", { value: "ja-JP", configurable: true });
    try {
      await bootErrorLandingPage(document);
      await nextTick();
      await nextTick();
      const host = document.querySelector<HTMLElement>(".hk-error-reporting-overlay");
      expect(host).not.toBeNull();
      const buttons = [...host!.querySelectorAll(".hk-error-landing__actions button")].map(
        (el) => el.textContent?.trim(),
      );
      expect(buttons.some((text) => text?.includes(jaRetry))).toBe(true);
      expect(document.documentElement.lang).toBe("ja");
    } finally {
      if (original) Object.defineProperty(Navigator.prototype, "language", original);
    }
  });
});
