import { afterEach, describe, expect, it } from "vitest";
import { createApp, h, nextTick, reactive } from "vue";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { compile } from "sass";

import HkPillToggleGroup from "./HkPillToggleGroup";

const mounts: Array<{ app: ReturnType<typeof createApp>; container: HTMLElement }> = [];

function mount(node: ReturnType<typeof h>) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const app = createApp({ render: () => node });
  app.mount(container);
  mounts.push({ app, container });
  return container;
}

afterEach(() => {
  for (const { app, container } of mounts.splice(0)) {
    app.unmount();
    container.remove();
  }
});

const OPTIONS = [
  { value: "deepseek", label: "DeepSeek" },
  { value: "openai", label: "OpenAI" },
  { value: "anthropic", label: "Anthropic" },
];

describe("HkPillToggleGroup", () => {
  it("renders one pill per option plus the all-pill, active state from the selected set", () => {
    const c = mount(
      h(HkPillToggleGroup, {
        label: "Providers",
        options: OPTIONS,
        selected: new Set(["openai"]),
        allLabel: "All",
      }),
    );
    const pills = [...c.querySelectorAll<HTMLButtonElement>(".hk-pill-group-pill")];
    expect(pills.map((p) => p.textContent?.trim())).toEqual(["All", "DeepSeek", "OpenAI", "Anthropic"]);
    // Active tint rides data-active (the segmented grammar — no aria-only state).
    expect(pills[0].hasAttribute("data-active")).toBe(false);
    expect(pills[2].hasAttribute("data-active")).toBe(true);
    // Every pill is a pressed-state toggle button (screen readers hear the set).
    expect(pills[2].getAttribute("aria-pressed")).toBe("true");
    expect(pills[1].getAttribute("aria-pressed")).toBe("false");
    expect(c.querySelector(".hk-pill-group")!.getAttribute("role")).toBe("group");
  });

  it("marks the all-pill active when nothing is picked, and hides it without allLabel", () => {
    const withAll = mount(
      h(HkPillToggleGroup, { label: "P", options: OPTIONS, selected: new Set<string>(), allLabel: "All" }),
    );
    expect(withAll.querySelectorAll(".hk-pill-group-pill")[0].hasAttribute("data-active")).toBe(true);

    const bare = mount(h(HkPillToggleGroup, { label: "P", options: OPTIONS, selected: new Set<string>() }));
    expect(bare.querySelectorAll(".hk-pill-group-pill").length).toBe(OPTIONS.length);
  });

  it("reports toggle(value) and all() — the set itself is never mutated here", async () => {
    const seen: string[] = [];
    const allClicks: number[] = [];
    const selected = new Set<string>(["deepseek"]);
    const c = mount(
      h(HkPillToggleGroup, {
        label: "P",
        options: OPTIONS,
        selected,
        allLabel: "All",
        onToggle: (v: string) => seen.push(v),
        onAll: () => allClicks.push(1),
      }),
    );
    const pills = [...c.querySelectorAll<HTMLButtonElement>(".hk-pill-group-pill")];
    pills[2].dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await Promise.resolve();
    expect(seen).toEqual(["openai"]);
    // The host-owned set is untouched — the component only reports.
    expect([...selected]).toEqual(["deepseek"]);

    pills[0].dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await Promise.resolve();
    expect(allClicks.length).toBe(1);
    expect(seen).toEqual(["openai"]);
  });

  it("normalizes option icons: components render, junk renders nothing, nothing stringifies", async () => {
    const { h } = await import("vue");
    const { Zap } = await import("lucide-vue-next");
    const c = mount(
      h(HkPillToggleGroup, {
        label: "P",
        selected: new Set<string>(),
        options: [
          { value: "fn", label: "Fn", icon: Zap },
          { value: "vnode", label: "Vn", icon: h(Zap) },
          { value: "junk", label: "Jk", icon: 42 },
        ],
      }),
    );
    await Promise.resolve();
    const pills = [...c.querySelectorAll<HTMLButtonElement>(".hk-pill-group-pill")];
    // A raw lucide component FUNCTION must render as its <svg> — the R1
    // landmine: unnormalized it stringifies into source text.
    expect(pills[0].querySelector("svg"), "function icon renders").toBeTruthy();
    expect(pills[0].textContent).not.toContain("h(");
    // A prebuilt vnode passes through identically.
    expect(pills[1].querySelector("svg"), "vnode icon renders").toBeTruthy();
    // Junk (a number) renders nothing — and never its digits.
    expect(pills[2].querySelector(".hk-pill-group-icon")).toBeNull();
    expect(pills[2].textContent?.trim()).toBe("Jk");
  });

  it("strip wiring: a drag pans and swallows its trailing click — a plain click still toggles", async () => {
    const toggled: string[] = [];
    const c = mount(
      h(HkPillToggleGroup, {
        label: "P",
        options: OPTIONS,
        selected: new Set<string>(),
        onToggle: (v: string) => toggled.push(v),
      }),
    );
    const group = c.querySelector(".hk-pill-group")!;
    const pill = c.querySelectorAll<HTMLButtonElement>(".hk-pill-group-pill")[0];

    // Press on a pill, stray past the 5px threshold, release: the strip
    // flags the pan and the trailing click is swallowed exactly once.
    pill.dispatchEvent(
      new PointerEvent("pointerdown", { bubbles: true, pointerType: "mouse", button: 0, clientX: 100, clientY: 50 }),
    );
    window.dispatchEvent(
      new PointerEvent("pointermove", { pointerType: "mouse", clientX: 120, clientY: 52 }),
    );
    await Promise.resolve();
    expect(group.hasAttribute("data-panning")).toBe(true);
    window.dispatchEvent(new PointerEvent("pointerup", { pointerType: "mouse" }));
    await Promise.resolve();
    expect(group.hasAttribute("data-panning")).toBe(false);
    pill.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await Promise.resolve();
    expect(toggled, "the pan's trailing click must not toggle").toEqual([]);

    // The NEXT plain click toggles normally — the swallow is one-shot.
    pill.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await Promise.resolve();
    expect(toggled).toEqual([OPTIONS[0].value]);
  });

  it("strip wiring: a sub-threshold press never pans and its click toggles", async () => {
    const toggled: string[] = [];
    const c = mount(
      h(HkPillToggleGroup, {
        label: "P",
        options: OPTIONS,
        selected: new Set<string>(),
        onToggle: (v: string) => toggled.push(v),
      }),
    );
    const group = c.querySelector(".hk-pill-group")!;
    const pill = c.querySelectorAll<HTMLButtonElement>(".hk-pill-group-pill")[1];

    pill.dispatchEvent(
      new PointerEvent("pointerdown", { bubbles: true, pointerType: "mouse", button: 0, clientX: 100, clientY: 50 }),
    );
    window.dispatchEvent(
      new PointerEvent("pointermove", { pointerType: "mouse", clientX: 103, clientY: 51 }),
    );
    await Promise.resolve();
    expect(group.hasAttribute("data-panning"), "3px stays a click").toBe(false);
    window.dispatchEvent(new PointerEvent("pointerup", { pointerType: "mouse" }));
    pill.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await Promise.resolve();
    expect(toggled).toEqual([OPTIONS[1].value]);
  });
});

// ── Tone channel ─────────────────────────────────────────────────────────
describe("HkPillToggleGroup tone channel", () => {
  const TONED_OPTIONS = [
    { value: "input", label: "Input", tone: "success" },
    { value: "text", label: "Text", tone: "secondary" },
    { value: "tool", label: "Tool", tone: "warning" },
    { value: "plain", label: "Plain" },
    { value: "primary", label: "Primary", tone: "primary" },
  ] as const;

  it("carries data-tone for non-primary tones and omits it for default/primary", () => {
    const c = mount(
      h(HkPillToggleGroup, { label: "Kinds", options: [...TONED_OPTIONS], selected: new Set<string>() }),
    );
    const pills = [...c.querySelectorAll<HTMLButtonElement>(".hk-pill-group-pill")];
    expect(pills[0].getAttribute("data-tone")).toBe("success");
    expect(pills[1].getAttribute("data-tone")).toBe("secondary");
    expect(pills[2].getAttribute("data-tone")).toBe("warning");
    expect(pills[3].hasAttribute("data-tone"), "no tone → no attribute").toBe(false);
    expect(pills[4].hasAttribute("data-tone"), "primary is the default → no attribute").toBe(false);
  });

  it("renders the option label alongside the tone attribute", () => {
    const c = mount(
      h(HkPillToggleGroup, {
        label: "Kinds",
        options: [{ value: "tool", label: "Tool", tone: "warning" }],
        selected: new Set<string>(["tool"]),
      }),
    );
    const pill = c.querySelector<HTMLButtonElement>(".hk-pill-group-pill")!;
    expect(pill.textContent?.trim()).toBe("Tool");
    expect(pill.hasAttribute("data-active")).toBe(true);
    // Without this the whole channel could be reverted and the test stays green.
    expect(pill.getAttribute("data-tone")).toBe("warning");
  });

  it("stylesheet contract: every tone re-tints the ACTIVE state only, after the plain rule", () => {
    const here = dirname(fileURLToPath(import.meta.url));
    const css = compile(join(here, "HkPillToggleGroup.scss"), { style: "expanded" }).css;
    const tones = ["success", "secondary", "warning", "error", "muted"] as const;
    // Same triplets styles/theme/channels.scss defines (light base) — the
    // semantic trio is the shared canonical family now.
    const FALLBACKS: Record<(typeof tones)[number], string> = {
      success: "31 101 48",
      secondary: "81 154 115",
      warning: "137 72 0",
      error: "166 41 55",
      muted: "108 108 108",
    };
    const plainActive = css.indexOf(".hk-pill-group-pill[data-active]");
    expect(plainActive, "the plain active rule exists").toBeGreaterThan(-1);
    for (const tone of tones) {
      // Sass drops quotes around attribute values when expanding
      // (`[data-status=pending]` — the HkRangeRibbon sheet contract hits
      // the same formatting), so match the compiled shape.
      const selector = `.hk-pill-group-pill[data-tone=${tone}][data-active]`;
      const at = css.indexOf(selector);
      expect(at, `${selector} compiles`).toBeGreaterThan(-1);
      // Every tone rule must come AFTER the plain rule: the attribute pair
      // outranks it, and the source order keeps that dominance explicit.
      expect(at, `${tone} rule rides after the plain active rule`).toBeGreaterThan(plainActive);
      // Tone must never repaint an INACTIVE pill: every tone selector has to
      // carry the attribute pair. A bare `[data-tone=…]` rule would pass the
      // assertions above while quietly tinting muted pills.
      expect(css, "no tone rule without [data-active]").not.toMatch(
        new RegExp(`\\[data-tone=${tone}\\]\\s*\\{`),
      );
      const body = css.slice(at, css.indexOf("}", at));
      expect(body, `${tone} re-tints the ink`).toContain("color:");
      expect(body, `${tone} re-tints the fill`).toContain("background:");
      expect(body, `${tone} tint uses its theme token`).toContain(`var(--color-${tone}`);
      // Presence alone is not enough: the token appears twice (ink + fill),
      // so swapping one for another hue kept this green (R3 M9/M9b). Pin the
      // ink and the fill to their own channels — muted is the documented
      // exception (text ink, muted wash).
      // The ink may be the raw fill channel or the fg variant (both valid).
      // Muted and secondary are brand/muted slots — no fg variant exists.
      // The error tone maps to the danger-fg token (danger→error channel).
      const inkPat = ["muted", "secondary"].includes(tone)
        ? `color: rgb(var(--color-${tone === "muted" ? "text" : tone}`
        : `color: var(--hi-color-${tone === "error" ? "danger" : tone}-fg`;
      expect(body, `${tone} INK uses its own channel`).toContain(inkPat);
      expect(body, `${tone} FILL uses its own channel`).toContain(
        `background: rgb(var(--color-${tone}`,
      );
      // The canonical fallback is what keeps the Rust-side mirror rendering
      // the same hue without the theme layer — pin the exact triplet.
      expect(body, `${tone} carries its canonical fallback`).toContain(FALLBACKS[tone]);
      // Sass's expanded output drops the space before the alpha slash:
      // `rgb(var(--color-x, t t t)/16%)`.
      expect(body, `${tone} keeps the house alpha`).toMatch(
        tone === "muted" ? /\/\s*18%/ : /\/\s*16%/,
      );
    }
  });
});

// ── Track geometry: hug, don't stretch ───────────────────────────────────
// 2026-11-19 report (shittim-chest GrantListEditor): the 授予/拒绝 state
// pills in a ~148px table cell sat left-aligned inside a full-width
// bordered track, so the chrome framed an EMPTY BOX after the last pill
// ("部分按钮组有莫名其妙的内边距"). The track must size to its pills while
// keeping the one-line pannable strip intact — happy-dom does no layout, so
// the contract is pinned over the sheet source (the nativeScrollbar /
// HkAffixPicker house pattern), never a computed width.
const scssSource = readFileSync(join(dirname(fileURLToPath(import.meta.url)), "HkPillToggleGroup.scss"), "utf-8");

/** Extract ONE balanced `{...}` declaration block following the given
 *  selector — `[^}]*` would stop at the first nested `}` and let
 *  properties appended after a future nested block evade the pin. */
function cssBlock(src: string, selector: string): string {
  const at = src.indexOf(selector);
  expect(at, `${selector} block exists`).toBeGreaterThanOrEqual(0);
  const open = src.indexOf("{", at);
  let depth = 0;
  for (let i = open; i < src.length; i++) {
    if (src[i] === "{") depth++;
    else if (src[i] === "}") {
      depth--;
      if (depth === 0) return src.slice(open, i + 1);
    }
  }
  return "";
}

/** Declarations only: a comment that happens to quote a property must not
 *  satisfy a pin (mutating the rule away would otherwise stay green). */
function stripSassComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^[ \t]*\/\/.*$/gm, "");
}

/** The block's TOP-LEVEL declarations: the slice before the first nested
 *  rule (every nested rule in this sheet opens with `&`), then split on
 *  `;` — a terminator is a separator, never the next match's anchor, so
 *  consecutive declarations are all seen. Values trimmed and lowercased
 *  (CSS keywords are ASCII-case-insensitive, so `FLEX` and `flex` are
 *  the same declaration). Grouped per property so a LATER duplicate
 *  declaration cannot hide behind a passing first one — the pins below
 *  assert the FULL value set, not mere presence. */
function declarations(block: string): Map<string, string[]> {
  const body = block.replace(/^[^{]*\{/, "").replace(/\}[^}]*$/, "");
  const nestedAt = body.search(/(?:^|\n)\s*&/);
  const top = nestedAt === -1 ? body : body.slice(0, nestedAt);
  const out = new Map<string, string[]>();
  for (const fragment of top.split(";")) {
    const m = fragment.match(/^\s*([-a-z]+)\s*:\s*(.+?)\s*$/);
    if (!m) continue;
    const prop = m[1].toLowerCase();
    const value = m[2].toLowerCase();
    out.set(prop, [...(out.get(prop) ?? []), value]);
  }
  return out;
}

describe("HkPillToggleGroup track geometry contract", () => {
  const track = stripSassComments(cssBlock(scssSource, ".hk-pill-group {"));
  const trackDecls = declarations(track);

  it("the track hugs its pills instead of filling the lane", () => {
    // The FULL value sets, not presence: a later `width: 100%` in the same
    // block would cancel the hug while a presence pin stayed green.
    expect(trackDecls.get("display")).toEqual(["inline-flex"]);
    expect(trackDecls.get("width")).toEqual(["fit-content"]);
    expect(trackDecls.get("max-width")).toEqual(["100%"]);
    // The pair is NOT redundant: a flex item is display-blockified
    // (inline-flex → flex), so only a definite width stops a column flex
    // parent's align-items: stretch from re-filling the lane (HkFilterChip's
    // .hk-filter-chip-body column and the hosts' `flex flex-col` form-field
    // slots are exactly such parents — HkTimePicker centers itself with
    // align-self).
    // No !important games: an override ladder inside the block must not be
    // able to resurrect the stretch behind the pins above.
    expect(track, "no important override inside the track block").not.toContain("!important");
  });

  it("the clamp keeps the one-line pannable strip alive when pills overflow", () => {
    // fit-content + the clamp = shrink-to-fit capped at the lane: the pill
    // set that genuinely overflows still scrolls, and useOptionStrip's
    // scrollWidth-vs-clientWidth fade sensing still sees it. (The clamp
    // value set is asserted above; the scroll machinery is asserted here.)
    expect(track).toMatch(/overflow-x:\s*auto;/);
    expect(track, "nowrap: one pannable line, not a wrap").toMatch(/flex-wrap:\s*nowrap;/);
    // The native-scrollbar suppression pair rides inside this rule block
    // (nativeScrollbar.contract.test.ts group 1 also enforces it).
    expect(track).toMatch(/scrollbar-width:\s*none;/);
    expect(track).toMatch(/&::-webkit-scrollbar\s*\{[^}]*display:\s*none/);
    // Edge-fade masks are keyed off data-h-overflow — the sensing contract
    // they share with HkScrollContainer must survive the hug.
    for (const side of ["start", "end", "both"]) {
      expect(track, `data-h-overflow=${side} fade`).toContain(`&[data-h-overflow="${side}"]`);
    }
  });

  it("phones still relax the hugging track back into a wrapping group", () => {
    const phone = stripSassComments(
      cssBlock(scssSource.slice(scssSource.indexOf("@media (max-width: 767px)")), ".hk-pill-group {"),
    );
    const phoneDecls = declarations(phone);
    expect(phoneDecls.get("flex-wrap")).toEqual(["wrap"]);
    expect(phoneDecls.get("overflow")).toEqual(["visible"]);
    // The media query relaxes ONLY wrap/overflow/touch/cursor: it must not
    // re-declare display or width (that would restore the stretched track
    // on phones behind the desktop pins).
    expect(phoneDecls.has("display"), "no display in the phone block").toBe(false);
    expect(phoneDecls.has("width"), "no width in the phone block").toBe(false);
    expect(phoneDecls.has("max-width"), "no max-width in the phone block").toBe(false);
  });
});

// ── Fade re-sensing on content mutations (the 2026-11-24 report): the
// option set collapsing from several pills to one must retire the edge
// fade the wide layout earned, without a scroll and without the strip's
// own box resizing. The strip's MutationObserver funnels the mutations
// that can move scrollWidth into sense(). happy-dom performs no layout,
// so the stubbed strip geometry IS the new layout — the DOM mutation
// only has to TRIGGER the re-sense, which is the contract under test.
describe("HkPillToggleGroup fade re-sensing", () => {
  // Mutation matrix (PR #1534 independent review rounds; ids match that run
  // ledger): MUT:strip-childlist-only — reverting the strip observer to
  // childList-only reds the characterData test below while the collapse test
  // keeps its green (that path is childList, which the mutation isolates
  // rather than breaks); MUT:strip-callback-neutered — a no-op observer
  // callback reds both tests, so sensing runs through the observer and never
  // through an accident of the stubbed geometry.
  /** Drain the mutation microtask: the strip callback is `sense` directly
   *  (no rAF hop), so the macrotask tick alone delivers it — the trailing
   *  frames only keep the flush shape uniform with the scroller's
   *  rAF-coalesced pass. */
  async function flushSensing(): Promise<void> {
    await new Promise<void>((r) => setTimeout(r, 0));
    await new Promise<void>((r) => requestAnimationFrame(() => r()));
    await new Promise<void>((r) => requestAnimationFrame(() => r()));
  }

  function stubStripGeometry(strip: HTMLElement, scrollWidth: number, clientWidth: number): void {
    Object.defineProperty(strip, "scrollWidth", { configurable: true, get: () => scrollWidth });
    Object.defineProperty(strip, "clientWidth", { configurable: true, get: () => clientWidth });
    Object.defineProperty(strip, "scrollLeft", { configurable: true, get: () => 0 });
  }

  it("retires the end fade when the option set collapses to one pill", async () => {
    const options = reactive([
      { value: "chat", label: "Chat" },
      { value: "draw", label: "Draw" },
    ]);
    const c = mount(h(HkPillToggleGroup, { label: "P", options, selected: new Set<string>() }));
    // The composable wires scroll/wheel/MO sensors in a watch on the
    // strip ref — flush the mount queue so the wiring has run before any
    // stubbed geometry or dispatched event.
    await nextTick();
    const strip = c.querySelector<HTMLElement>(".hk-pill-group")!;
    stubStripGeometry(strip, 400, 120);
    strip.dispatchEvent(new Event("scroll"));
    expect(strip.getAttribute("data-h-overflow")).toBe("end");

    // The surviving layout fits (the stub IS that layout); the childList
    // mutation from the patch is the only trigger the new state arrives
    // through.
    stubStripGeometry(strip, 80, 120);
    options.splice(1);
    await nextTick();
    await flushSensing();
    expect(strip.hasAttribute("data-h-overflow")).toBe(false);
  });

  it("lights the fade when a label is rewritten in place (characterData only)", async () => {
    const options = reactive([{ value: "chat", label: "Chat" }]);
    const c = mount(h(HkPillToggleGroup, { label: "P", options, selected: new Set<string>() }));
    // Same wiring flush as above: the sensors must already be attached
    // when the mutation lands, or the test exercises nothing.
    await nextTick();
    const strip = c.querySelector<HTMLElement>(".hk-pill-group")!;
    stubStripGeometry(strip, 80, 120);
    strip.dispatchEvent(new Event("scroll"));
    expect(strip.hasAttribute("data-h-overflow")).toBe(false);

    stubStripGeometry(strip, 400, 120);
    // A relabeled pill adds no child and removes none — the text node
    // mutation alone must re-sense.
    const pill = strip.querySelectorAll<HTMLButtonElement>(".hk-pill-group-pill")[0]!;
    (pill.firstChild as Text).data = "Conversation with a much longer title";
    await flushSensing();
    expect(strip.getAttribute("data-h-overflow")).toBe("end");
  });
});
