import { afterEach, describe, expect, it } from "vitest";
import { createApp, h } from "vue";
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
    // Same triplets styles/theme/channels.scss defines (light base).
    const FALLBACKS: Record<(typeof tones)[number], string> = {
      success: "14 184 64",
      secondary: "81 154 115",
      warning: "238 214 119",
      error: "247 118 142",
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
      expect(body, `${tone} INK uses its own channel`).toContain(
        `color: rgb(var(--color-${tone === "muted" ? "text" : tone}`,
      );
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
