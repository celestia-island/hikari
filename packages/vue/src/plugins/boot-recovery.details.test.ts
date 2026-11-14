// AI-generated: developed with the DeepSeek Harness agent (model
// DeepSeek-V4.1-Flash) directed and reviewed by langyo — SySL-1.0 §2.3
// disclosure.

import { createHash } from "node:crypto";

import { describe, expect, it } from "vitest";

import { bootRecoveryScript } from "./boot-recovery.js";
import { BOOT_LANDING_CSS } from "./bootLandingCss.js";
import { BOOT_LANDING_DETAILS_CSS } from "./bootLandingDetailsCss.js";

/**
 * The OPT-IN raw-details pane (task: boot panel details contract).
 *
 * The panel's default shape is the bare HkErrorLanding card — the robot the
 * module has always generated. The details pane is a second, optional half:
 * a diagnostic payload rendered as an HkJsonTree, scrolling inside
 * HkErrorLanding's own standing frame under hikari's overlay-scrollbar chrome.
 *
 * Two properties this suite exists to protect, both easy to break silently:
 *
 *   1. BYTE-COMPAT. `PANEL_CSS` is embedded verbatim into the generated
 *      script, so a single selector added to `boot-landing.scss` would change
 *      the bytes of EVERY host's script — and any host that hashes that script
 *      into its CSP would break on a dependency bump that "only touched an
 *      optional feature". The details chrome therefore compiles into its own
 *      module and the default script carries none of it.
 *   2. The SAME DOM CONTRACT as the in-app components. The boot panel cannot
 *      mount Vue, so its tree is a framework-free renderer — but it must emit
 *      the classes HkJsonTree emits, or the compiled `s-jt-*` sheet would not
 *      apply and the boot pane would drift into a second design.
 *
 * The DOM is real (happy-dom, the package's test environment): the payload
 * builder reads `performance`, `document.readyState` and `location.href`,
 * and the scrollbar sync reads layout boxes, so a hand-rolled fake node would
 * test the fake instead of the shipped script.
 */

/** The default script's bytes, pinned so an accidental default change fails. */
const DEFAULT_SCRIPT_SHA256 =
  "070e2d6320eaaafeb9138ec390189fde61522d831a1eb78c46be1358f3be6d97";
/** The heal-only script's bytes (the other shape a host may hash). */
const HEAL_ONLY_SCRIPT_SHA256 =
  "bee06d4652e55708d8b130fec11ff8ede54d4eafb944ef0d18f7be5a76b3dca6";

function sha256(text: string): string {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

/** Every non-ASCII code unit, so the ASCII guards read the same way. */
function foreignChars(text: string): string[] {
  return [...text].filter((char) => {
    const code = char.charCodeAt(0);
    return code !== 9 && code !== 10 && (code < 32 || code > 126);
  });
}

const DETAILS_OPTION = { copy: { rawDetailsLabel: "Raw error details" } };

/**
 * Run a generated script against a real document.
 *
 * `Date` is passed in shadowed so a payload test can assert a deterministic
 * `capturedAt` without stubbing a global the whole suite shares.
 */
function runScript(
  script: string,
  options: { now?: () => number; href?: string } = {},
): { loader: HTMLElement; timers: Array<() => void> } {
  // ONE loader per test: `document.querySelector("#loading-screen")` returns
  // the first match, so a loader left behind by an earlier case would take
  // the paint and this case's assertions would read an empty element.
  for (const stale of document.querySelectorAll("#loading-screen")) {
    stale.remove();
  }
  const loader = document.createElement("div");
  loader.id = "loading-screen";
  loader.textContent = "Loading";
  document.body.appendChild(loader);

  const timers: Array<() => void> = [];
  const FakeDate = { now: options.now ?? (() => 1_700_000_000_000) };
  (FakeDate as unknown as { prototype: unknown }).prototype = Date.prototype;

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
    // The real location object is read-only in happy-dom; the script only
    // reads protocol/hostname/href from it, and href must be a plain string.
    {
      protocol: "http:",
      hostname: "tauri.localhost",
      href: options.href ?? "http://tauri.localhost/",
    },
    document,
    (callback: () => void) => {
      timers.push(callback);
      return timers.length;
    },
    undefined,
    { languages: ["en-US"], language: "en-US" },
    { __PANEL_BUILD_HASH__: "abc123" },
    { getEntriesByType: () => [] },
    undefined,
    FakeDate,
  );
  return { loader, timers };
}

/** Paint the panel and return its landing card. */
function paintedCard(script = bootRecoveryScript(DETAILS_OPTION)): HTMLElement {
  const { loader, timers } = runScript(script);
  for (const timer of timers) timer();
  const card = loader.querySelector(".hk-error-landing__card");
  if (!card) throw new Error("the panel was not painted");
  return card as HTMLElement;
}

describe("the default script keeps its exact bytes (BYTE-COMPAT)", () => {
  it("generates the same default script as before the details pane existed", () => {
    // A host hashes this string into its CSP. Changing it is allowed — but
    // only on purpose, in a change that says so, never as a side effect of
    // adding an option the host does not use.
    expect(sha256(bootRecoveryScript())).toBe(DEFAULT_SCRIPT_SHA256);
    expect(sha256(bootRecoveryScript({}))).toBe(DEFAULT_SCRIPT_SHA256);
  });

  it("generates the same heal-only script as before", () => {
    expect(sha256(bootRecoveryScript({ loadingScreen: false }))).toBe(
      HEAL_ONLY_SCRIPT_SHA256,
    );
  });

  it("keeps the details pane's CODE out of the default script", () => {
    // Gate the DOM construction and the payload machinery — NOT class-name
    // strings. The landing sheet legitimately mentions
    // `.hk-error-landing__details*` and `.s-tool-json-tree` already (its own
    // chrome and the nested-tree reset rule), so asserting those strings
    // absent would fail on a correct build.
    const script = bootRecoveryScript();
    for (const marker of [
      // The generator's own option plumbing and the emitted sheet constant.
      "DETAILS_CSS",
      "RAW_DETAILS_LABEL",
      // Payload builder + its helpers.
      "buildPayload",
      "resourceIndex",
      "bootScripts",
      "failedResources",
      "errorDetail",
      "payloadText",
      // Tree renderer.
      "renderJsonTree",
      "renderJsonNode",
      "jsonNode",
      // Scrollbar sync.
      "attachPanelScrollbars",
      "hk-scrollbar-track",
      "hk-scrollbar-thumb",
      // Redaction and the page reads only the diagnostics need.
      "CREDENTIAL_QUERY",
      "CREDENTIAL_KEY",
      "CREDENTIAL_HEADER",
      "performance.getEntriesByType",
      "location.href",
      "__PANEL_BUILD_HASH__",
    ]) {
      expect(script, marker).not.toContain(marker);
    }
    // The details chrome the DEFAULT script does carry comes from the landing
    // sheet alone, and is inert without the DOM to match.
    expect(script).toContain("hk-error-landing__details");
  });

  it("keeps a locale-table host without the pane byte-free of the diagnostics", () => {
    // The other pre-existing opt-in shape: a host with translations but no
    // details pane must not inherit the payload machinery either.
    const script = bootRecoveryScript({
      copy: { locales: { en: { message: "m", retry: "r" } } },
    });
    expect(script).not.toContain("buildPayload");
    expect(script).not.toContain("DETAILS_CSS");
    expect(script).toContain("COPY_TABLE");
    // ...and it still carries the four-member rows it always had.
    expect(script).toContain('["en","","m","r"]');
  });

  it("still emits something different once the pane is on", () => {
    expect(bootRecoveryScript(DETAILS_OPTION)).not.toBe(bootRecoveryScript());
  });
});

describe("the details pane's stylesheet", () => {
  it("is the compiled boot-landing-details.scss", async () => {
    const sass = await import("sass");
    const { resolve } = await import("node:path");
    const compiled = sass.compile(
      resolve(__dirname, "boot-landing-details.scss"),
      {
        loadPaths: [
          resolve(__dirname, ".."),
          resolve(__dirname, "..", "styles"),
          resolve(__dirname, "..", "styles", "theme"),
        ],
        style: "compressed",
        silenceDeprecations: ["import", "global-builtin", "legacy-js-api"],
      },
    );
    const expected = compiled.css.replace(/^@charset "UTF-8";/, "").trim();
    expect(BOOT_LANDING_DETAILS_CSS).toBe(expected);
  });

  it("ships HkJsonTree's own classes, not a bespoke tree", () => {
    for (const selector of [
      ".s-tool-json-tree{",
      ".s-jt-row{",
      ".s-jt-toggle{",
      ".s-jt-group{",
      ".s-jt-children{",
      ".s-jt-preview",
      ".s-jt-key",
      ".s-jv-str",
      ".s-jv-num",
      ".s-jv-bool",
      ".s-jv-null",
      ".s-jt-type",
    ]) {
      expect(BOOT_LANDING_DETAILS_CSS, selector).toContain(selector);
    }
  });

  it("ships hikari's overlay-scrollbar chrome", () => {
    expect(BOOT_LANDING_DETAILS_CSS).toContain(".hk-scrollbar-track");
    expect(BOOT_LANDING_DETAILS_CSS).toContain(".hk-scrollbar-thumb");
    // Sass compresses the attribute selector to its unquoted form.
    expect(BOOT_LANDING_DETAILS_CSS).toContain("[data-axis=horizontal]");
    expect(BOOT_LANDING_DETAILS_CSS).toContain(".is-scrolling");
    expect(BOOT_LANDING_DETAILS_CSS).toContain(".is-hovering");
  });

  it("is ASCII-only and cannot terminate the inline <script> tag", () => {
    expect(foreignChars(BOOT_LANDING_DETAILS_CSS)).toEqual([]);
    expect(BOOT_LANDING_DETAILS_CSS.toLowerCase()).not.toContain("</script");
    expect(BOOT_LANDING_DETAILS_CSS).not.toContain("<!--");
  });
});

describe("the landing sheet still owns the details frame", () => {
  const detailsRules = (css: string): string[] =>
    css.match(/\.hk-error-landing__details[^{]*\{[^}]*\}/g) ?? [];

  it("keeps the details region, label, pane and body rules in the landing sheet", () => {
    // These are panel CHROME, not tree styling: they must ride the landing
    // sheet every script carries, or the opt-out host would lose the frame
    // the reset rule below belongs to.
    for (const selector of [
      ".hk-error-landing__details{",
      ".hk-error-landing__details-label{",
      ".hk-error-landing__details-pane{",
      ".hk-error-landing__details-body{",
    ]) {
      expect(BOOT_LANDING_CSS, selector).toContain(selector);
    }
    expect(detailsRules(BOOT_LANDING_CSS).length).toBeGreaterThan(0);
  });

  it("hides the native scrollbar on BOTH axes of the details body", () => {
    // The overlay chrome is the only bar the pane may show. If the native one
    // came back the pane would paint two bars over each other.
    const bodyRules = detailsRules(BOOT_LANDING_CSS).filter((rule) =>
      rule.includes(".hk-error-landing__details-body"),
    );
    const joined = bodyRules.join("");
    expect(joined).toContain("scrollbar-width:none");
    expect(joined).toContain("::-webkit-scrollbar{display:none}");
  });

  it("resets the nested tree with a higher-specificity rule than the base one", () => {
    // The details sheet brings HkJsonTree's BASE `.s-tool-json-tree` rule
    // (320px cap, own frame/border/background). The landing's standing frame
    // must win: three class components (0,3,0) against one (0,1,0), so the
    // append order of the two <style> tags can never matter.
    const guard = BOOT_LANDING_CSS.slice(
      BOOT_LANDING_CSS.indexOf(
        ".hk-error-landing .hk-error-landing__details-body .s-tool-json-tree",
      ),
    );
    expect(guard.length).toBeGreaterThan(0);
    const guardRule = guard.slice(0, guard.indexOf("}") + 1);
    for (const declaration of [
      "max-height:none",
      "height:auto",
      "overflow:visible",
      "border:none",
      "background:",
    ]) {
      expect(guardRule, declaration).toContain(declaration);
    }
    // The base rule the reset outranks really is in the other sheet.
    expect(BOOT_LANDING_DETAILS_CSS).toContain(".s-tool-json-tree{");
  });
});

describe("the painted details pane (real DOM)", () => {
  it("renders HkErrorLanding's details contract inside the card", () => {
    const card = paintedCard();
    const details = card.querySelector(".hk-error-landing__details");
    expect(details).not.toBeNull();
    // Order: explanation, then details, then actions — the component's own.
    const order = [...card.children].map((child) => child.className);
    const idx = (name: string): number =>
      order.findIndex((className) => className.split(" ").includes(name));
    expect(idx("hk-error-landing__desc")).toBeLessThan(
      idx("hk-error-landing__details"),
    );
    expect(idx("hk-error-landing__details")).toBeLessThan(
      idx("hk-error-landing__actions"),
    );

    const label = details!.querySelector(".hk-error-landing__details-label");
    expect(label).not.toBeNull();
    expect(label!.getAttribute("aria-hidden")).toBe("true");
    // The Braces glyph is SVG DOM, and the label text is textContent.
    expect(label!.querySelector("svg")).not.toBeNull();
    expect(label!.textContent).toContain("Raw error details");

    const pane = details!.querySelector(".hk-error-landing__details-pane");
    expect(pane).not.toBeNull();
    const body = pane!.querySelector(".hk-error-landing__details-body");
    expect(body).not.toBeNull();
    expect(body!.querySelector(".s-tool-json-tree")).not.toBeNull();
  });

  it("builds the tree with HkJsonTree's DOM shape and no markup parsing", () => {
    const tree = paintedCard().querySelector(".s-tool-json-tree")!;
    expect(tree.getAttribute("role")).toBe("tree");
    const rows = tree.querySelectorAll(".s-jt-row");
    expect(rows.length).toBeGreaterThan(0);
    // Root group holds a parent row with the chevron toggle.
    const group = tree.querySelector(".s-jt-group");
    expect(group).not.toBeNull();
    const parentRow = group!.querySelector(".s-jt-row[data-parent]");
    expect(parentRow).not.toBeNull();
    expect(parentRow!.querySelector(".s-jt-toggle[data-parent] svg.s-jt-chevron")).not.toBeNull();
    expect(group!.querySelector(".s-jt-children")).not.toBeNull();
  });

  it("carries the payload's fields under their contract names", () => {
    const text = paintedCard().querySelector(".s-tool-json-tree")!.textContent ?? "";
    // The tree only renders the top two levels expanded, but every root key is
    // painted as a row either way (collapsed ones keep their key).
    for (const key of [
      "reason",
      "message",
      "capturedAt",
      "elapsedMs",
      "timeoutMs",
      "readyState",
      "appMounted",
      "locale",
      "buildHash",
      "href",
      "bootScripts",
    ]) {
      expect(text, key).toContain(key);
    }
  });

  it("computes elapsedMs at PAGE runtime, not generation time", () => {
    // The generator must never bake a duration or a timestamp in: the paste
    // describes the failure, not the build machine.
    const script = bootRecoveryScript(DETAILS_OPTION);
    expect(script).not.toMatch(/elapsedMs:\s*\d/);
    expect(script).not.toMatch(/capturedAt:\s*"/);
    // Run the SAME script with two different boot durations: the reported
    // elapsedMs follows the page, which a baked-in constant could not do.
    const elapsedOf = (bootMs: number): number => {
      let call = 0;
      const now = () => (call++ === 0 ? 0 : bootMs);
      const { loader, timers } = runScript(script, { now });
      for (const timer of timers) timer();
      const text = loader.querySelector(".s-tool-json-tree")!.textContent ?? "";
      const match = /elapsedMs: (\d+)/.exec(text);
      if (!match) throw new Error("the payload carries no elapsedMs row");
      return Number(match[1]);
    };
    expect(elapsedOf(1234)).toBe(1234);
    expect(elapsedOf(5678)).toBe(5678);
  });

  it("folds a node on click and re-opens it", () => {
    const tree = paintedCard().querySelector(".s-tool-json-tree")!;
    const parentRow = tree.querySelector(".s-jt-row[data-parent]")!;
    const group = parentRow.parentElement!;
    const children = group.querySelector(".s-jt-children") as HTMLElement;
    expect(group.hasAttribute("data-open")).toBe(true);
    expect(children.style.display).not.toBe("none");

    parentRow.dispatchEvent(new Event("click", { bubbles: true }));
    expect(group.hasAttribute("data-open")).toBe(false);
    expect(children.style.display).toBe("none");
    // The collapsed row swaps the badge for the one-line preview summary.
    const badge = parentRow.querySelector(".s-jt-badge") as HTMLElement;
    expect(badge.style.display).toBe("none");
    const summarySpans = [...parentRow.querySelectorAll("span")].filter(
      (span) => span.style.display !== "none" && span.className.includes("s-jt"),
    );
    expect(summarySpans.length).toBeGreaterThan(0);

    parentRow.dispatchEvent(new Event("click", { bubbles: true }));
    expect(group.hasAttribute("data-open")).toBe(true);
    expect(children.style.display).not.toBe("none");
  });

  it("attaches hikari's overlay scrollbar chrome on BOTH axes", () => {
    const pane = paintedCard().querySelector(
      ".hk-error-landing__details-pane",
    )! as HTMLElement;
    const tracks = pane.querySelectorAll(":scope > .hk-scrollbar-track");
    expect(tracks).toHaveLength(2);
    const vertical = [...tracks].find(
      (track) => track.getAttribute("data-axis") !== "horizontal",
    );
    const horizontal = [...tracks].find(
      (track) => track.getAttribute("data-axis") === "horizontal",
    );
    expect(vertical, "vertical rail").toBeTruthy();
    expect(horizontal, "horizontal rail").toBeTruthy();
    for (const track of [vertical!, horizontal!]) {
      expect(track.querySelector(".hk-scrollbar-thumb")).not.toBeNull();
    }
  });

  it("flashes the rail while the pane scrolls", () => {
    const pane = paintedCard().querySelector(
      ".hk-error-landing__details-pane",
    )!;
    const body = pane.querySelector(".hk-error-landing__details-body")!;
    const track = pane.querySelector(".hk-scrollbar-track")!;
    body.dispatchEvent(new Event("scroll"));
    expect(track.classList.contains("is-scrolling")).toBe(true);
  });

  it("redacts credential-shaped text in the payload", () => {
    // The payload is what the operator pastes into an issue, so the shared
    // family's three shapes are masked with its three-disc mask. Asserted as
    // BEHAVIOUR: the redact() function is lifted out of the shipped script and
    // driven with the same inputs the family contract pins.
    const script = bootRecoveryScript(DETAILS_OPTION);
    // Lift the three credential patterns AND redact() out of the shipped
    // script, so the assertions run the real expressions rather than a copy.
    const patterns = script.slice(
      script.indexOf("var CREDENTIAL_QUERY"),
      script.indexOf("var detailsRefresh"),
    );
    expect(patterns).toContain("CREDENTIAL_QUERY");
    const maskStart = script.indexOf("function maskSecret(value) {");
    expect(maskStart, "the shipped script carries maskSecret()").toBeGreaterThan(0);
    const maskEnd = script.indexOf("\n  }", maskStart);
    const start = script.indexOf("function redact(text) {");
    expect(start, "the shipped script carries redact()").toBeGreaterThan(0);
    // The function ends at the first line that closes it at column 2.
    const end = script.indexOf("\n  }", start);
    const source =
      script.slice(maskStart, maskEnd + 4) + script.slice(start, end + 4);
    const mask = "\u25CF\u25CF\u25CF";
    const redact = new Function(
      patterns + source + "\n  return redact;",
    )() as (text: string) => string;

    // 1. query string (`token=` / `api_key=`, case-insensitive, value to the
    //    next delimiter)
    expect(redact("https://x/api?token=abc123&page=2")).toBe(
      "https://x/api?token=" + mask + "&page=2",
    );
    expect(redact("https://x/api?API_KEY=secret")).toBe(
      "https://x/api?API_KEY=" + mask,
    );
    // 2. serialized-JSON key/value shapes
    expect(redact('{"password":"hunter2"}')).toBe('{"password":"' + mask + '"}');
    expect(redact('{"access_token":"abc"}')).toBe('{"access_token":"' + mask + '"}');
    expect(redact('{"cookie":"sid=1"}')).toBe('{"cookie":"' + mask + '"}');
    // 3. header text inside a message
    expect(redact("Authorization: Bearer abc")).toBe(
      "Authorization: " + mask,
    );
    expect(redact("Cookie: sid=1; theme=dark")).toBe("Cookie: " + mask);

    // An EMPTY credential stays empty: masking it would invent a secret where
    // there is none.
    expect(redact('{"token":""}')).toBe('{"token":""}');
    // Idempotent: re-redacting a masked text changes nothing.
    expect(redact('{"password":"x"}')).toBe(redact(redact('{"password":"x"}')));
    // And the mask itself is the family's three solid discs, not asterisks.
    expect(mask).toBe("\u25CF\u25CF\u25CF");
  });

  it("paints redacted values when the payload carries credentials", () => {
    // End to end: a payload field with a credential shape must reach the pane
    // masked. The panel builds its own payload, so the shape is injected
    // through the one field an operator cannot avoid — the page URL.
    const { loader, timers } = runScript(bootRecoveryScript(DETAILS_OPTION), {
      href: "http://tauri.localhost/app?token=TOPSECRETVALUE&page=2",
    });
    for (const timer of timers) timer();
    const text = loader.querySelector(".s-tool-json-tree")!.textContent ?? "";
    expect(text).not.toContain("TOPSECRETVALUE");
    // ...and the mask really replaced it rather than the field vanishing.
    expect(text).toContain("token=");
  });
});

describe("the details pane's invariants", () => {
  const script = bootRecoveryScript(DETAILS_OPTION);

  it("stays a single classic IIFE with no markup parsing", () => {
    expect(script.startsWith("(function () {")).toBe(true);
    expect(script.endsWith("})();")).toBe(true);
    expect(script.toLowerCase()).not.toContain("</script");
    expect(script).not.toContain("<!--");
    expect(script).not.toContain("innerHTML");
    expect(script).not.toContain("outerHTML");
    expect(script).not.toContain("import ");
    expect(script).not.toContain(String.fromCharCode(36) + "{");
  });

  it("stays ASCII-only", () => {
    expect(foreignChars(script)).toEqual([]);
  });

  it("stays deterministic", () => {
    expect(bootRecoveryScript(DETAILS_OPTION)).toBe(script);
  });

  it("never auto-reloads and never throws", () => {
    // The reload belongs to the retry button alone; the payload and the tree
    // must not add a second path.
    expect(script.match(/location\.reload\(/g) ?? []).toHaveLength(1);
    expect(script.match(/location\.replace\(/g) ?? []).toHaveLength(1);
    // The details runtime's own guards: the panel is painted even when every
    // diagnostic read throws.
    expect(script).toContain("safeCall");
  });

  it("survives a page whose diagnostics all throw", () => {
    // performance / getEntriesByType / querySelectorAll all raising is exactly
    // the state a half-dead page can be in; the card must still paint.
    const loader = document.createElement("div");
    loader.id = "loading-screen";
    document.body.appendChild(loader);
    const hostile = {
      querySelectorAll: () => {
        throw new Error("nope");
      },
    };
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
      { querySelector: () => loader, createElement: (t: string) => document.createElement(t), createElementNS: (ns: string, t: string) => document.createElementNS(ns, t) },
      (cb: () => void) => {
        timers.push(cb);
        return 1;
      },
      undefined,
      undefined,
      undefined,
      {
        getEntriesByType: () => {
          throw new Error("nope");
        },
      },
      undefined,
      Date,
    );
    expect(() => {
      for (const timer of timers) timer();
    }).not.toThrow();
    expect(
      loader.querySelector(".hk-error-landing__card"),
      "the card still paints",
    ).not.toBeNull();
  });

  it("rejects the details pane in heal-only mode at config time", () => {
    // The pane lives inside the watchdog's panel; heal-only mode never paints
    // one, so configuring the label there is a build error, not a no-op.
    expect(() =>
      bootRecoveryScript({ loadingScreen: false, copy: { rawDetailsLabel: "x" } }),
    ).toThrow(/rawDetailsLabel/);
  });

  it("treats a blank label as not configured (byte-compat by default)", () => {
    for (const value of [undefined, "", "   "]) {
      expect(
        sha256(bootRecoveryScript({ copy: { rawDetailsLabel: value } })),
      ).toBe(DEFAULT_SCRIPT_SHA256);
    }
  });
});
