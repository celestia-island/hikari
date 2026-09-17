import { afterEach, describe, expect, it, vi } from "vitest";
import { Comment, createApp, createVNode, h, nextTick, ref, type Slot } from "vue";

import HkInput from "./HkInput";
import HkPasswordSurface from "./HkPasswordSurface";
import { NOISE_TILE_H, NOISE_TILE_W } from "./revealKinematogram";
import { passwordLevel } from "../utils/password";
import { setReducedMotion } from "../runtime/animationBus";

/**
 * HkInput variant="password" contract tests (the unified password field —
 * HkPasswordInput was deleted; its surface lives behind this variant):
 * - the hikari password visual identity survives: canvas dot matrix,
 *   centered breathing placeholder with focus states, blur "entered"
 *   hint, caps-lock / full-width hints, pending-clear refocus semantics
 * - right-edge affordance (passwordTrailing): eye reveal (default) /
 *   strength traffic light / none
 * - reveal strategy (revealStrategy): "filter" dual counter-drifting
 *   spatter layers (default) vs "sweep" readable window vs "noise"
 *   boiling kinematogram (screenshot-safe) vs "plain" readable text
 * - reveal trigger (revealTrigger): press-and-hold (default) vs
 *   click-to-toggle with auto-hide (revealAutoHideMs)
 * - the strength dot classifies through the shared passwordLevel util
 *   unless strengthEvaluator overrides it, and carries a localized
 *   tooltip that opens on hover AND on touch tap
 * - the native input stays type="password" at all times — the reveal
 *   pass draws on the canvas, so the value is never DOM text
 */

interface Mounted {
  model: ReturnType<typeof ref<string>>;
  app: ReturnType<typeof createApp>;
  container: HTMLElement;
  input: HTMLInputElement;
}

const mounts: Mounted[] = [];

function mountPasswordInput(
  initial = "",
  props: Record<string, unknown> = {},
  slots: Record<string, Slot> = {},
): Mounted {
  const model = ref(initial);
  const container = document.createElement("div");
  document.body.appendChild(container);
  const app = createApp({
    render() {
      return h(
        HkInput,
        {
          variant: "password",
          ...props,
          modelValue: model.value,
          "onUpdate:modelValue": (v: string) => {
            model.value = v;
          },
        },
        slots,
      );
    },
  });
  app.mount(container);
  const input = container.querySelector(".hk-pwd-input") as HTMLInputElement;
  const mounted = { model, app, container, input };
  mounts.push(mounted);
  return mounted;
}

function placeholderText(container: HTMLElement): string | null {
  // The static layer is the inner text node — when the marquee variant
  // is active the outer span also carries the scrolling copies.
  const el =
    container.querySelector(".hk-pwd-placeholder-text") ??
    container.querySelector(".hk-pwd-placeholder");
  return el?.textContent ?? null;
}

function blurHintText(container: HTMLElement): string | null {
  return container.querySelector(".hk-pwd-blur-hint")?.textContent ?? null;
}

function fireInput(input: HTMLInputElement, value: string) {
  input.value = value;
  input.dispatchEvent(new Event("input", { bubbles: true }));
}

function fireBeforeinput(input: HTMLInputElement, inputType: string) {
  const event = new InputEvent("beforeinput", {
    inputType,
    bubbles: true,
    cancelable: true,
  });
  input.dispatchEvent(event);
  return event;
}

afterEach(() => {
  for (const { app, container } of mounts.splice(0)) {
    app.unmount();
    container.remove();
  }
});

describe("HkInput password surface identity", () => {
  it("renders the dot-matrix surface with the default lock icon and i18n placeholder", () => {
    const { container } = mountPasswordInput("");
    expect(container.querySelector(".hk-pwd-box")).toBeTruthy();
    expect(container.querySelector("canvas.hk-pwd-dots")).toBeTruthy();
    expect(placeholderText(container)).toBe("Enter your password");
    expect(
      container.querySelector(".hk-pwd-lock svg rect"),
    ).not.toBeNull();
  });

  it("keeps the native input type=password (the reveal pass is canvas-only)", () => {
    const { input } = mountPasswordInput("secret");
    expect(input.type).toBe("password");
  });

  it("lets an explicit placeholder override the i18n default", () => {
    const { container } = mountPasswordInput("", { placeholder: "API token" });
    expect(placeholderText(container)).toBe("API token");
  });

  it("replaces the default lock through the prefixIcon slot", () => {
    const { container } = mountPasswordInput(
      "",
      {},
      { prefixIcon: () => [h("span", { class: "custom-shield" }, "shield")] },
    );
    expect(container.querySelector(".hk-pwd-lock .custom-shield")).not.toBeNull();
    expect(container.querySelector(".hk-pwd-lock svg")).toBeNull();
  });

  it("lifts caller prefix content to the interactive plane (affix parity)", () => {
    // The default lock is decorative (click-through); a caller icon or
    // prefix must carry the interactive lift so buttons/tooltip triggers
    // inside the slot work above the invisible full-bleed input.
    const withIcon = mountPasswordInput(
      "",
      {},
      { prefixIcon: () => [h("span", { class: "custom-shield" }, "s")] },
    );
    expect(
      withIcon.container
        .querySelector(".hk-pwd-lock")
        ?.classList.contains("hk-pwd-lock-custom"),
    ).toBe(true);

    const withPrefix = mountPasswordInput(
      "",
      {},
      { prefix: () => [h("span", { class: "full-prefix" }, "p")] },
    );
    expect(
      withPrefix.container
        .querySelector(".hk-pwd-lock")
        ?.classList.contains("hk-pwd-lock-custom"),
    ).toBe(true);

    const byDefault = mountPasswordInput("");
    expect(
      byDefault.container
        .querySelector(".hk-pwd-lock")
        ?.classList.contains("hk-pwd-lock-custom"),
    ).toBe(false);

    // A v-if'd-out (comment-only) slot must NOT claim the lift either.
    const commentOnly = () => [createVNode(Comment as never, null, "v-if out")];
    const withEmpty = mountPasswordInput("", {}, { prefixIcon: commentOnly });
    expect(
      withEmpty.container
        .querySelector(".hk-pwd-lock")
        ?.classList.contains("hk-pwd-lock-custom"),
    ).toBe(false);
  });

  it("lets the prefix slot win over prefixIcon (text-variant precedence)", () => {
    const { container } = mountPasswordInput(
      "",
      {},
      {
        prefix: () => [h("span", { class: "full-prefix" }, "p")],
        prefixIcon: () => [h("span", { class: "icon-only" }, "i")],
      },
    );
    expect(container.querySelector(".hk-pwd-lock .full-prefix")).not.toBeNull();
    expect(container.querySelector(".hk-pwd-lock .icon-only")).toBeNull();
  });

  it("treats a v-if'd-out (comment-only) slot as absent and keeps the default lock", () => {
    // A conditional SFC slot template compiles to [Comment] when its
    // condition is false — that must not hide the default lock or
    // stand the built-in eye down.
    const commentOnly = () => [createVNode(Comment as never, null, "v-if out")];
    const { container } = mountPasswordInput(
      "x",
      {},
      { prefix: commentOnly, suffix: commentOnly },
    );
    expect(container.querySelector(".hk-pwd-lock svg")).not.toBeNull();
    expect(container.querySelector("button.hk-pwd-eye")).not.toBeNull();
    expect(container.querySelector(".hk-pwd-suffix")).toBeNull();
  });

  it("suppresses the built-in eye when a suffix slot is provided", () => {
    const { container } = mountPasswordInput(
      "",
      {},
      { suffix: () => [h("span", { class: "my-suffix" }, "s")] },
    );
    expect(container.querySelector("button.hk-pwd-eye")).toBeNull();
    expect(container.querySelector(".hk-pwd-suffix .my-suffix")).not.toBeNull();
  });

  it("suppresses the strength dot when a suffixIcon slot is provided", () => {
    const { container } = mountPasswordInput(
      "hunter2",
      { passwordTrailing: "strength" },
      { suffixIcon: () => [h("span", { class: "my-suffix-icon" }, "i")] },
    );
    expect(container.querySelector(".hk-pwd-strength")).toBeNull();
    expect(container.querySelector(".hk-pwd-suffix .my-suffix-icon")).not.toBeNull();
  });

  it("keeps the eye on readonly fields and reveals the stored value", async () => {
    const { container } = mountPasswordInput("stored", { readonly: true });
    const eye = container.querySelector<HTMLElement>("button.hk-pwd-eye")!;
    expect(eye).toBeTruthy();
    eye.dispatchEvent(
      new PointerEvent("pointerdown", { pointerType: "mouse", bubbles: true }),
    );
    await nextTick();
    expect(eye.hasAttribute("data-revealing")).toBe(true);
    document.dispatchEvent(new PointerEvent("pointerup", { bubbles: true }));
  });

  it("falls back to passwordLevel when a strengthEvaluator throws", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    try {
      const { container } = mountPasswordInput("Password1", {
        passwordTrailing: "strength",
        strengthEvaluator: () => {
          throw new Error("consumer bug");
        },
      });
      // The field must mount (a render-fn throw would take the whole
      // subtree down) and degrade to the built-in classifier.
      expect(container.querySelector(".hk-pwd-box")).toBeTruthy();
      expect(
        container.querySelector(".hk-pwd-strength")?.getAttribute("data-level"),
      ).toBe("fair");
      expect(warn).toHaveBeenCalled();
    } finally {
      warn.mockRestore();
    }
  });

  it("draws astral-plane glyphs whole instead of lone surrogates", async () => {
    const calls: string[] = [];
    const ctxStub = {
      canvas: {},
      clearRect: () => {},
      save: () => {},
      restore: () => {},
      translate: () => {},
      rotate: () => {},
      beginPath: () => {},
      arc: () => {},
      fill: () => {},
      measureText: () => ({ width: 10 }),
      fillText: (text: string) => calls.push(text),
      font: "",
      fillStyle: "",
      textAlign: "",
      textBaseline: "",
    };
    const originalGetContext = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = (() =>
      ctxStub) as unknown as typeof HTMLCanvasElement.prototype.getContext;
    try {
      const { container } = mountPasswordInput("😀ab");
      const eye = container.querySelector<HTMLElement>("button.hk-pwd-eye")!;
      eye.dispatchEvent(
        new PointerEvent("pointerdown", { pointerType: "mouse", bubbles: true }),
      );
      await nextTick();
      // ONE fillText per code point, astral glyph intact — the old
      // code-unit indexing drew lone surrogates and NaN-positioned
      // everything after the pair.
      expect(calls).toEqual(["😀", "a", "b"]);
      document.dispatchEvent(new PointerEvent("pointerup", { bubbles: true }));
    } finally {
      HTMLCanvasElement.prototype.getContext = originalGetContext;
    }
  });

  it("associates the rendered label with the field id", () => {
    const { container, input } = mountPasswordInput("", { label: "Password" });
    const label = container.querySelector("label.hk-input-label");
    expect(label?.getAttribute("for")).toBe(input.id);
  });

  it("stamps the error state on the box and renders the message below", () => {
    const { container } = mountPasswordInput("x", { error: "Too short" });
    expect(
      container.querySelector(".hk-pwd-box")?.hasAttribute("data-error"),
    ).toBe(true);
    expect(container.querySelector(".hk-input-error-msg")?.textContent).toBe(
      "Too short",
    );
  });
});

describe("HkInput password refocus", () => {
  it("keeps the entered password and shows the refocus placeholder on focus", async () => {
    const { container, input, model } = mountPasswordInput("secret");
    expect(placeholderText(container)).toBeNull();

    input.dispatchEvent(new FocusEvent("focus"));
    await nextTick();

    expect(model.value).toBe("secret");
    expect(placeholderText(container)).toBe(
      "Focused, typing will clear the current password",
    );
    expect(blurHintText(container)).toBeNull();
  });

  it("restores the blur hint when the field loses focus again", async () => {
    const { container, input } = mountPasswordInput("secret");
    input.dispatchEvent(new FocusEvent("focus"));
    input.dispatchEvent(new FocusEvent("blur"));
    await nextTick();

    expect(placeholderText(container)).toBeNull();
    expect(blurHintText(container)).toBe(
      "Entered, click to focus and clear the existing password",
    );
  });

  it("starts the next input from an empty field after beforeinput", async () => {
    const { input, model } = mountPasswordInput("secret");
    input.dispatchEvent(new FocusEvent("focus"));
    await nextTick();

    fireBeforeinput(input, "insertText");
    fireInput(input, "x");
    await nextTick();

    expect(model.value).toBe("x");
  });

  it("clears the whole field on delete instead of nibbling the old value", async () => {
    const { container, input, model } = mountPasswordInput("secret");
    input.dispatchEvent(new FocusEvent("focus"));
    await nextTick();

    const event = fireBeforeinput(input, "deleteContentBackward");
    await nextTick();

    expect(event.defaultPrevented).toBe(true);
    expect(model.value).toBe("");
    expect(input.value).toBe("");
    expect(placeholderText(container)).toBe("Focused, enter your password");
  });

  it("keeps only the newly typed tail when beforeinput is unavailable", async () => {
    const { input, model } = mountPasswordInput("secret");
    input.dispatchEvent(new FocusEvent("focus"));
    await nextTick();

    fireInput(input, "secretx");
    await nextTick();

    expect(model.value).toBe("x");
  });

  it("starts over when an edit lands mid-value without beforeinput", async () => {
    const { input, model } = mountPasswordInput("secret");
    input.dispatchEvent(new FocusEvent("focus"));
    await nextTick();

    fireInput(input, "secxret");
    await nextTick();

    expect(model.value).toBe("");
  });

  it("shows the waiting placeholder again on refocus after clearing", async () => {
    const { container, input } = mountPasswordInput("secret");
    input.dispatchEvent(new FocusEvent("focus"));
    await nextTick();

    fireBeforeinput(input, "deleteContentBackward");
    await nextTick();

    input.dispatchEvent(new FocusEvent("blur"));
    await nextTick();
    expect(blurHintText(container)).toBeNull();

    input.dispatchEvent(new FocusEvent("focus"));
    await nextTick();
    expect(placeholderText(container)).toBe("Focused, enter your password");
  });

  it("reclaims focus on a stray blur right after input", async () => {
    const { input } = mountPasswordInput("");
    fireInput(input, "a");
    const focusSpy = vi.spyOn(input, "focus");

    input.dispatchEvent(new FocusEvent("blur", { relatedTarget: null }));
    await new Promise((r) => setTimeout(r, 10));

    expect(focusSpy).toHaveBeenCalled();
  });

  it("lets Tab navigation hand focus to another element", async () => {
    const { input } = mountPasswordInput("");
    const next = document.createElement("input");
    document.body.appendChild(next);

    fireInput(input, "a");
    const focusSpy = vi.spyOn(input, "focus");

    input.dispatchEvent(new FocusEvent("blur", { relatedTarget: next }));
    await new Promise((r) => setTimeout(r, 10));

    expect(focusSpy).not.toHaveBeenCalled();
    next.remove();
  });
});

describe("HkInput password placeholder layers on Tab focus", () => {
  it("shows exactly one placeholder text on focus of an empty field", async () => {
    const { container, input } = mountPasswordInput("", {});
    expect(placeholderText(container)).toBeTruthy();
    const before = placeholderText(container);
    input.focus();
    await nextTick();
    await nextTick();
    const nodes = container.querySelectorAll(".hk-pwd-placeholder");
    expect(nodes.length).toBe(1);
    const txt = nodes[0].querySelector(".hk-pwd-placeholder-text")?.textContent ?? "";
    expect([before, "已聚焦，请输入密码", "Focused, enter your password"]).toContain(txt);
    expect(container.querySelectorAll(".hk-pwd-blur-hint").length).toBe(0);
    expect(container.querySelectorAll(".hk-pwd-select-hint").length).toBe(0);
  });

  it("keeps the marquee overlay text in lockstep with the static layer on focus", async () => {
    const { container, input } = mountPasswordInput("", {
      placeholder: "输入密码",
      placeholderVariant: "marquee",
    });
    input.focus();
    await nextTick();
    await new Promise((r) => requestAnimationFrame(() => r(null)));
    await nextTick();
    const staticText = container.querySelector(".hk-pwd-placeholder-text")
      ?.textContent;
    const marqueeText = container
      .querySelector(".hk-placeholder-marquee__copy")
      ?.textContent;
    expect(staticText).toBeTruthy();
    expect(marqueeText).toBe(staticText);
  });
});

describe("HkInput password strength traffic light", () => {
  it("does not render the dot for the default eye affordance or an empty value", () => {
    const eye = mountPasswordInput("hunter2");
    expect(eye.container.querySelector(".hk-pwd-strength")).toBeNull();

    const empty = mountPasswordInput("", { passwordTrailing: "strength" });
    expect(empty.container.querySelector(".hk-pwd-strength")).toBeNull();
  });

  it("classifies through the shared passwordLevel util by default", async () => {
    const weak = mountPasswordInput("hunter2", { passwordTrailing: "strength" });
    expect(
      weak.container.querySelector(".hk-pwd-strength")?.getAttribute("data-level"),
    ).toBe("weak");

    const fair = mountPasswordInput("Password1", { passwordTrailing: "strength" });
    expect(
      fair.container.querySelector(".hk-pwd-strength")?.getAttribute("data-level"),
    ).toBe("fair");

    const strong = mountPasswordInput("Str0ng!Passw0rd", {
      passwordTrailing: "strength",
    });
    expect(
      strong.container.querySelector(".hk-pwd-strength")?.getAttribute("data-level"),
    ).toBe("strong");
  });

  it("honors a strengthEvaluator override", () => {
    const m = mountPasswordInput("short", {
      passwordTrailing: "strength",
      strengthEvaluator: () => "strong",
    });
    expect(
      m.container.querySelector(".hk-pwd-strength")?.getAttribute("data-level"),
    ).toBe("strong");
  });

  it("re-evaluates as the value changes", async () => {
    const { container, model } = mountPasswordInput("hunter2", {
      passwordTrailing: "strength",
    });
    expect(
      container.querySelector(".hk-pwd-strength")?.getAttribute("data-level"),
    ).toBe("weak");

    model.value = "Str0ng!Passw0rd";
    await nextTick();
    expect(
      container.querySelector(".hk-pwd-strength")?.getAttribute("data-level"),
    ).toBe("strong");
  });

  it("matches the exported default classifier contract", () => {
    // The surface must consume the PUBLIC util so consumers replicating
    // the levels server-side stay in lockstep with the indicator.
    expect(passwordLevel("")).toBeNull();
    expect(passwordLevel("hunter2")).toBe("weak");
    expect(passwordLevel("Password1")).toBe("fair");
    expect(passwordLevel("Str0ng!Passw0rd")).toBe("strong");
  });

  it("opens the localized tooltip on hover", async () => {
    const { container } = mountPasswordInput("hunter2", {
      passwordTrailing: "strength",
    });
    const wrapper = container.querySelector<HTMLElement>(".hk-tooltip-wrapper")!;
    expect(wrapper).toBeTruthy();

    wrapper.dispatchEvent(new MouseEvent("mouseenter", { bubbles: false }));
    await new Promise((r) => setTimeout(r, 250));

    const popup = document.querySelector<HTMLElement>(".hk-tooltip-popup");
    expect(popup?.classList.contains("hk-tooltip-visible")).toBe(true);
    expect(popup?.textContent).toContain("Password strength");
    expect(popup?.textContent).toContain("Weak");

    wrapper.dispatchEvent(new MouseEvent("mouseleave", { bubbles: false }));
    await nextTick();
    expect(
      document
        .querySelector(".hk-tooltip-popup")
        ?.classList.contains("hk-tooltip-visible"),
    ).toBe(false);
  });

  it("opens the tooltip immediately on a touch tap and closes on an outside tap", async () => {
    const { container } = mountPasswordInput("Password1", {
      passwordTrailing: "strength",
    });
    const wrapper = container.querySelector<HTMLElement>(".hk-tooltip-wrapper")!;

    wrapper.dispatchEvent(
      new PointerEvent("pointerdown", { pointerType: "touch", bubbles: true }),
    );
    await nextTick();

    let popup = document.querySelector<HTMLElement>(".hk-tooltip-popup");
    expect(popup?.classList.contains("hk-tooltip-visible")).toBe(true);
    expect(popup?.textContent).toContain("Fair");

    // Tap somewhere else: the capture-phase document listener hides it.
    const outside = document.createElement("div");
    document.body.appendChild(outside);
    outside.dispatchEvent(
      new PointerEvent("pointerdown", { pointerType: "touch", bubbles: true }),
    );
    await nextTick();

    popup = document.querySelector<HTMLElement>(".hk-tooltip-popup");
    expect(popup?.classList.contains("hk-tooltip-visible")).toBe(false);
    outside.remove();
  });
});

describe("HkInput password reveal eye", () => {
  it("renders the eye by default and hides it for none", () => {
    const def = mountPasswordInput("");
    expect(def.container.querySelector("button.hk-pwd-eye")).toBeTruthy();

    const none = mountPasswordInput("", { passwordTrailing: "none" });
    expect(none.container.querySelector("button.hk-pwd-eye")).toBeNull();
    expect(none.container.querySelector(".hk-pwd-strength")).toBeNull();
  });

  it("does not render the eye while disabled", () => {
    const { container } = mountPasswordInput("", { disabled: true });
    expect(container.querySelector("button.hk-pwd-eye")).toBeNull();
  });

  it("reveals while the pointer is held and restores on release", async () => {
    const { container, input } = mountPasswordInput("secret");
    const eye = container.querySelector<HTMLElement>("button.hk-pwd-eye")!;

    eye.dispatchEvent(
      new PointerEvent("pointerdown", { pointerType: "mouse", bubbles: true }),
    );
    await nextTick();
    expect(eye.hasAttribute("data-revealing")).toBe(true);
    // The DOM value must never flip to a text input.
    expect(input.type).toBe("password");

    document.dispatchEvent(new PointerEvent("pointerup", { bubbles: true }));
    await nextTick();
    expect(eye.hasAttribute("data-revealing")).toBe(false);
  });

  it("ignores an empty field (nothing to reveal)", async () => {
    const { container } = mountPasswordInput("");
    const eye = container.querySelector<HTMLElement>("button.hk-pwd-eye")!;
    eye.dispatchEvent(
      new PointerEvent("pointerdown", { pointerType: "mouse", bubbles: true }),
    );
    await nextTick();
    expect(eye.hasAttribute("data-revealing")).toBe(false);
  });

  it("supports keyboard hold through Space", async () => {
    const { container } = mountPasswordInput("secret");
    const eye = container.querySelector<HTMLElement>("button.hk-pwd-eye")!;

    eye.dispatchEvent(
      new KeyboardEvent("keydown", { key: " ", bubbles: true, cancelable: true }),
    );
    await nextTick();
    expect(eye.hasAttribute("data-revealing")).toBe(true);

    eye.dispatchEvent(
      new KeyboardEvent("keyup", { key: " ", bubbles: true, cancelable: true }),
    );
    await nextTick();
    expect(eye.hasAttribute("data-revealing")).toBe(false);
  });

  it("reads the mono font stack once per reveal, never per frame", async () => {
    // The reveal pass rebuilds the glyph mask / layout per hold and
    // drifts the noise EVERY frame; reading computed styles at that
    // rate is layout thrash. The cache warms at reveal start (or
    // lazily on the first draw) and every subsequent frame must hit it
    // — a wholesale cache removal would silently pass the suite
    // without this count.
    const ctxStub = {
      canvas: {},
      clearRect: () => {},
      save: () => {}, restore: () => {}, translate: () => {}, rotate: () => {},
      beginPath: () => {}, arc: () => {}, fill: () => {},
      rect: () => {}, clip: () => {},
      measureText: () => ({ width: 10 }),
      fillText: () => {},
      fillRect: () => {},
      drawImage: () => {},
      createPattern: () => ({}) as CanvasPattern,
      createImageData: (w: number, h: number) => ({
        data: new Uint8ClampedArray(w * h * 4),
      }),
      putImageData: () => {},
      imageSmoothingEnabled: false,
      globalCompositeOperation: "source-over",
      font: "", fillStyle: "", textAlign: "", textBaseline: "",
    };
    const originalGetContext = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = (() =>
      ctxStub) as unknown as typeof HTMLCanvasElement.prototype.getContext;
    const originalGCS = window.getComputedStyle;
    let monoReads = 0;
    window.getComputedStyle = ((el: Element, ...rest: unknown[]) => {
      const real = originalGCS.call(window, el, ...(rest as []));
      return {
        getPropertyValue: (key: string) => {
          if (key === "--font-mono") monoReads++;
          return real.getPropertyValue(key);
        },
      } as CSSStyleDeclaration;
    }) as typeof window.getComputedStyle;
    try {
      const { container } = mountPasswordInput("abcdef");
      const eye = container.querySelector<HTMLElement>("button.hk-pwd-eye")!;
      eye.dispatchEvent(
        new PointerEvent("pointerdown", { pointerType: "mouse", bubbles: true }),
      );
      await nextTick();
      // Let the animation bus render a few real frames while held.
      for (let i = 0; i < 3; i++) {
        await new Promise((r) => requestAnimationFrame(() => r(null)));
      }
      expect(monoReads, "exactly one warm read (eager or lazy), frames hit the cache").toBe(1);
      document.dispatchEvent(new PointerEvent("pointerup", { bubbles: true }));
      await nextTick();
      // A second hold re-syncs (theme may have changed between holds):
      // one more read, still not per-frame.
      eye.dispatchEvent(
        new PointerEvent("pointerdown", { pointerType: "mouse", bubbles: true }),
      );
      await nextTick();
      for (let i = 0; i < 3; i++) {
        await new Promise((r) => requestAnimationFrame(() => r(null)));
      }
      expect(monoReads).toBe(2);
      document.dispatchEvent(new PointerEvent("pointerup", { bubbles: true }));
    } finally {
      window.getComputedStyle = originalGCS;
      HTMLCanvasElement.prototype.getContext = originalGetContext;
    }
  });

  it("reveals via the boiling-noise kinematogram — no glyph ever lands on the visible canvas", async () => {
    // Recording canvas contexts, one per canvas element: happy-dom's
    // getContext is null, so the drawing path never runs there. The
    // per-canvas recorder can tell the VISIBLE dot canvas apart from
    // the painter's offscreen tile/mask canvases, which is exactly
    // what the screenshot-safety contract needs: the visible canvas
    // may only ever receive noise fills and a noise-composited stamp,
    // never glyph geometry.
    interface CanvasRec {
      canvas: HTMLCanvasElement;
      texts: string[];
      translateXs: number[];
      patternFills: number;
      drawImages: number;
    }
    const byCanvas = new Map<HTMLCanvasElement, CanvasRec>();
    const originalGetContext = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = (function (
      this: HTMLCanvasElement,
    ): CanvasRenderingContext2D {
      let rec = byCanvas.get(this);
      if (!rec) {
        rec = { canvas: this, texts: [], translateXs: [], patternFills: 0, drawImages: 0 };
        byCanvas.set(this, rec);
      }
      const r = rec;
      return {
        canvas: this,
        clearRect: () => {},
        save: () => {},
        restore: () => {},
        translate: (x: number) => r.translateXs.push(x),
        rotate: () => {},
        beginPath: () => {},
        arc: () => {},
        fill: () => {},
        measureText: () => ({ width: 10 }),
        fillText: (text: string) => r.texts.push(String(text)),
        fillRect: () => {},
        drawImage: () => r.drawImages++,
        createPattern: () => {
          r.patternFills++;
          return {} as CanvasPattern;
        },
        createImageData: (w: number, h: number) => ({
          data: new Uint8ClampedArray(w * h * 4),
        }),
        putImageData: () => {},
        imageSmoothingEnabled: false,
        globalCompositeOperation: "source-over",
        font: "",
        fillStyle: "",
        textAlign: "",
        textBaseline: "",
      } as unknown as CanvasRenderingContext2D;
    }) as unknown as typeof HTMLCanvasElement.prototype.getContext;
    try {
      const { container, input } = mountPasswordInput("abc", {
        revealStrategy: "noise",
      });
      const eye = container.querySelector<HTMLElement>("button.hk-pwd-eye")!;

      eye.dispatchEvent(
        new PointerEvent("pointerdown", { pointerType: "mouse", bubbles: true }),
      );
      await nextTick();
      // Let the animation bus render a few real frames while held. The
      // bus's "normal" tier fires on a 33ms budget, so mix in real
      // timeouts — rAF alone can fire back-to-back with no elapsed
      // time, which would never cross the tier budget.
      for (let i = 0; i < 12; i++) {
        await new Promise((r) => setTimeout(r, 15));
        await new Promise((r) => requestAnimationFrame(() => r(null)));
      }

      const visible = container.querySelector<HTMLCanvasElement>(".hk-pwd-dots")!;
      const vis = byCanvas.get(visible);
      expect(vis).toBeTruthy();

      // ── Screenshot safety (the point of the change) ──
      // Any single frame of the visible canvas is pure noise: no glyph
      // text may ever be drawn on it. A regression back to the jitter
      // reveal (or any direct fillText on the visible surface) fails
      // here — this is the "break it and it goes red" guard.
      expect(vis!.texts).toEqual([]);
      // The visible surface only carries noise pattern fills and the
      // noise-through-mask stamp.
      expect(vis!.patternFills).toBeGreaterThan(0);
      expect(vis!.drawImages).toBeGreaterThan(0);

      // ── Motion ──
      // The noise translation must differ across frames: a frozen
      // offset would leave the field as unreadable pure noise forever.
      expect(new Set(vis!.translateXs).size).toBeGreaterThan(1);

      // ── Glyphs live only OFFSCREEN ──
      // The password raster exists only on a mask canvas that is never
      // the visible element, and is fully re-composited with noise.
      const maskRecs = [...byCanvas.values()].filter((r) => r.texts.length > 0);
      expect(maskRecs.length).toBeGreaterThan(0);
      expect(maskRecs.every((r) => r.canvas !== visible)).toBe(true);
      expect(maskRecs.some((r) => r.texts.join("") === "abc")).toBe(true);

      // The noise tile backing store must be the full tile size: a
      // fresh canvas defaults to 300×150 and would silently clip the
      // 512×128 tile (real period 300, transparent rows below 128,
      // drift wrap desynced) — the R3 P1, pinned structurally here.
      const tileCanvas = [...byCanvas.keys()].find(
        (c) => c !== visible && c.width === NOISE_TILE_W && c.height === NOISE_TILE_H,
      );
      expect(tileCanvas, "an offscreen canvas sized to the noise tile exists").toBeTruthy();

      // The DOM value still never flips to a text input.
      expect(input.type).toBe("password");

      // Release: the reveal pass stops — no further glyph draws.
      const textsBefore = [...byCanvas.values()].reduce((s, r) => s + r.texts.length, 0);
      const patternsBefore = vis!.patternFills;
      document.dispatchEvent(new PointerEvent("pointerup", { bubbles: true }));
      await nextTick();
      for (let i = 0; i < 3; i++) {
        await new Promise((r) => requestAnimationFrame(() => r(null)));
      }
      const textsAfter = [...byCanvas.values()].reduce((s, r) => s + r.texts.length, 0);
      expect(textsAfter).toBe(textsBefore);
      expect(vis!.patternFills).toBe(patternsBefore);
    } finally {
      HTMLCanvasElement.prototype.getContext = originalGetContext;
    }
  });

  it("degrades to static jittered glyphs when the animation bus is parked (reduced motion)", async () => {
    // Parked bus (reduced motion): the kinematogram would freeze into
    // unreadable noise, so a bare-timer watchdog must flip the reveal
    // to the legacy static per-glyph jitter — the feature stays usable
    // and motion-sensitive users keep their preference.
    setReducedMotion(true);
    const originalGetContext = HTMLCanvasElement.prototype.getContext;
    const textsByCanvas = new Map<HTMLCanvasElement, string[]>();
    HTMLCanvasElement.prototype.getContext = (function (
      this: HTMLCanvasElement,
    ): CanvasRenderingContext2D {
      let texts = textsByCanvas.get(this);
      if (!texts) {
        texts = [];
        textsByCanvas.set(this, texts);
      }
      const t = texts;
      return {
        canvas: this,
        clearRect: () => {},
        save: () => {},
        restore: () => {},
        translate: () => {},
        rotate: () => {},
        beginPath: () => {},
        arc: () => {},
        fill: () => {},
        measureText: () => ({ width: 10 }),
        fillText: (text: string) => t.push(String(text)),
        fillRect: () => {},
        drawImage: () => {},
        createPattern: () => ({}) as CanvasPattern,
        createImageData: (w: number, h: number) => ({
          data: new Uint8ClampedArray(w * h * 4),
        }),
        putImageData: () => {},
        imageSmoothingEnabled: false,
        globalCompositeOperation: "source-over",
        font: "",
        fillStyle: "",
        textAlign: "",
        textBaseline: "",
      } as unknown as CanvasRenderingContext2D;
    }) as unknown as typeof HTMLCanvasElement.prototype.getContext;
    try {
      const { container } = mountPasswordInput("abc", {
        revealStrategy: "noise",
      });
      const eye = container.querySelector<HTMLElement>("button.hk-pwd-eye")!;
      eye.dispatchEvent(
        new PointerEvent("pointerdown", { pointerType: "mouse", bubbles: true }),
      );
      await nextTick();
      const visible = container.querySelector<HTMLCanvasElement>(".hk-pwd-dots")!;
      // Parked bus ⇒ the degrade is IMMEDIATE (isAnimationParked, no
      // 160ms of unreadable noise first): the static jitter renders the
      // glyphs on the very first synchronous frame.
      expect(textsByCanvas.get(visible)).toEqual(["a", "b", "c"]);
      // And it stays stable: no bus frames, and the watchdog must not
      // re-draw over the fallback.
      await new Promise((r) => setTimeout(r, 260));
      expect(textsByCanvas.get(visible)).toEqual(["a", "b", "c"]);
      document.dispatchEvent(new PointerEvent("pointerup", { bubbles: true }));
      await nextTick();
    } finally {
      HTMLCanvasElement.prototype.getContext = originalGetContext;
      setReducedMotion(false);
    }
  });

  it("falls back through the watchdog when no bus frames arrive although the bus is not parked", async () => {
    // Hidden document / extreme jank: rAF never fires, so the animation
    // bus delivers no frames, but the bus is NOT parked — exactly the
    // scenario the recurring cronBus watchdog covers (the instant
    // isAnimationParked branch cannot). Neutering the watchdog must
    // leave this test red, or the guard has no teeth.
    const textsByCanvas = new Map<HTMLCanvasElement, string[]>();
    const originalGetContext = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = (function (
      this: HTMLCanvasElement,
    ): CanvasRenderingContext2D {
      let texts = textsByCanvas.get(this);
      if (!texts) {
        texts = [];
        textsByCanvas.set(this, texts);
      }
      const t = texts;
      return {
        canvas: this,
        clearRect: () => {},
        save: () => {},
        restore: () => {},
        translate: () => {},
        rotate: () => {},
        beginPath: () => {},
        arc: () => {},
        fill: () => {},
        fillRect: () => {},
        measureText: () => ({ width: 10 }),
        fillText: (text: string) => t.push(String(text)),
        drawImage: () => {},
        createPattern: () => ({}) as CanvasPattern,
        createImageData: (w: number, h: number) => ({
          data: new Uint8ClampedArray(w * h * 4),
        }),
        putImageData: () => {},
        imageSmoothingEnabled: false,
        globalCompositeOperation: "source-over",
        font: "",
        fillStyle: "",
        textAlign: "",
        textBaseline: "",
      } as unknown as CanvasRenderingContext2D;
    }) as unknown as typeof HTMLCanvasElement.prototype.getContext;
    // Freeze the frame bus without parking it: rAF callbacks never run.
    vi.stubGlobal("requestAnimationFrame", () => 0);
    vi.stubGlobal("cancelAnimationFrame", () => {});
    try {
      const { container } = mountPasswordInput("abc", {
        revealStrategy: "noise",
      });
      const eye = container.querySelector<HTMLElement>("button.hk-pwd-eye")!;
      eye.dispatchEvent(
        new PointerEvent("pointerdown", { pointerType: "mouse", bubbles: true }),
      );
      await nextTick();
      const visible = container.querySelector<HTMLCanvasElement>(".hk-pwd-dots")!;
      // Bus not parked ⇒ the first synchronous frame is the noise pass.
      expect(textsByCanvas.get(visible)).toEqual([]);
      // The recurring watchdog flips to the static fallback on a bare
      // timer even though no bus frame ever arrived.
      await new Promise((r) => setTimeout(r, 260));
      expect(textsByCanvas.get(visible)).toEqual(["a", "b", "c"]);
      // Latched: later ticks must not re-draw over the fallback.
      await new Promise((r) => setTimeout(r, 220));
      expect(textsByCanvas.get(visible)).toEqual(["a", "b", "c"]);
      document.dispatchEvent(new PointerEvent("pointerup", { bubbles: true }));
      await nextTick();
    } finally {
      vi.unstubAllGlobals();
      HTMLCanvasElement.prototype.getContext = originalGetContext;
    }
  });

  it("degrades to the legacy jitter when canvas patterns are unavailable", async () => {
    // Engines where createPattern yields null: the painter must hand
    // the frame back (paint() → false) so the surface falls to the
    // legacy jitter on the VISIBLE canvas. Pinning the guard matters:
    // without it, paint() would keep "succeeding" and stamp the mask
    // with whatever fillStyle was left on it (#fff from the raster) —
    // clean white glyphs, i.e. exactly the leak this PR exists to kill.
    const seen: Array<{ canvas: HTMLCanvasElement; texts: string[]; drawImages: number }> = [];
    const originalGetContext = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = (function (
      this: HTMLCanvasElement,
    ): CanvasRenderingContext2D {
      let rec = seen.find((r) => r.canvas === this);
      if (!rec) {
        rec = { canvas: this, texts: [], drawImages: 0 };
        seen.push(rec);
      }
      const r = rec;
      return {
        canvas: this,
        clearRect: () => {},
        save: () => {},
        restore: () => {},
        translate: () => {},
        rotate: () => {},
        beginPath: () => {},
        arc: () => {},
        fill: () => {},
        fillRect: () => {},
        measureText: () => ({ width: 10 }),
        fillText: (text: string) => r.texts.push(String(text)),
        drawImage: () => r.drawImages++,
        // ASYMMETRIC pattern failure: only the OFFSCREEN mask canvas
        // (and the never-patterned tile) sees a null pattern; the
        // VISIBLE canvas gets a working one. The glyph-pattern guard
        // in paint() is then the only thing standing between the null
        // and a white-stamped mask — deleting that guard (and only
        // it) must send this test red, which a both-null mock cannot
        // express (the background guard would absorb the mutation).
        createPattern: () =>
          r.canvas === document.querySelector(".hk-pwd-dots")
            ? ({} as CanvasPattern)
            : null,
        createImageData: (w: number, h: number) => ({
          data: new Uint8ClampedArray(w * h * 4),
        }),
        putImageData: () => {},
        imageSmoothingEnabled: false,
        globalCompositeOperation: "source-over",
        font: "",
        fillStyle: "",
        textAlign: "",
        textBaseline: "",
      } as unknown as CanvasRenderingContext2D;
    }) as unknown as typeof HTMLCanvasElement.prototype.getContext;
    try {
      const { container, input } = mountPasswordInput("abc", {
        revealStrategy: "noise",
      });
      const eye = container.querySelector<HTMLElement>("button.hk-pwd-eye")!;
      eye.dispatchEvent(
        new PointerEvent("pointerdown", { pointerType: "mouse", bubbles: true }),
      );
      await nextTick();
      const visible = container.querySelector<HTMLCanvasElement>(".hk-pwd-dots")!;
      const vis = seen.find((r) => r.canvas === visible)!;
      // The fallback engaged: glyphs (deliberately) on the visible
      // canvas, and the noise-composite stamp never happened.
      expect(vis.texts).toEqual(["a", "b", "c"]);
      expect(vis.drawImages).toBe(0);
      expect(input.type).toBe("password");
      document.dispatchEvent(new PointerEvent("pointerup", { bubbles: true }));
      await nextTick();
    } finally {
      HTMLCanvasElement.prototype.getContext = originalGetContext;
    }
  });

  it("degrades to the legacy jitter when only the visible canvas lacks patterns", async () => {
    // The mirrored asymmetry: the VISIBLE canvas's createPattern yields
    // null while the offscreen mask's works. Now the BACKGROUND guard
    // in paint() is the only decision point — deleting it alone must
    // redden this test (the frame would keep "succeeding" with the
    // visible fill falling back to a stale fillStyle, stamping
    // noise-through-glyphs over a flat wash — structure a screenshot
    // could pick up). Together with the offscreen-null test, each
    // pattern guard is now pinned alone.
    const seen: Array<{ canvas: HTMLCanvasElement; texts: string[]; drawImages: number }> = [];
    const originalGetContext = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = (function (
      this: HTMLCanvasElement,
    ): CanvasRenderingContext2D {
      let rec = seen.find((r) => r.canvas === this);
      if (!rec) {
        rec = { canvas: this, texts: [], drawImages: 0 };
        seen.push(rec);
      }
      const r = rec;
      return {
        canvas: this,
        clearRect: () => {},
        save: () => {},
        restore: () => {},
        translate: () => {},
        rotate: () => {},
        beginPath: () => {},
        arc: () => {},
        fill: () => {},
        fillRect: () => {},
        measureText: () => ({ width: 10 }),
        fillText: (text: string) => r.texts.push(String(text)),
        drawImage: () => r.drawImages++,
        createPattern: () =>
          r.canvas === document.querySelector(".hk-pwd-dots")
            ? null
            : ({} as CanvasPattern),
        createImageData: (w: number, h: number) => ({
          data: new Uint8ClampedArray(w * h * 4),
        }),
        putImageData: () => {},
        imageSmoothingEnabled: false,
        globalCompositeOperation: "source-over",
        font: "",
        fillStyle: "",
        textAlign: "",
        textBaseline: "",
      } as unknown as CanvasRenderingContext2D;
    }) as unknown as typeof HTMLCanvasElement.prototype.getContext;
    try {
      const { container } = mountPasswordInput("abc", {
        revealStrategy: "noise",
      });
      const eye = container.querySelector<HTMLElement>("button.hk-pwd-eye")!;
      eye.dispatchEvent(
        new PointerEvent("pointerdown", { pointerType: "mouse", bubbles: true }),
      );
      await nextTick();
      const visible = container.querySelector<HTMLCanvasElement>(".hk-pwd-dots")!;
      const vis = seen.find((r) => r.canvas === visible)!;
      expect(vis.texts).toEqual(["a", "b", "c"]);
      expect(vis.drawImages).toBe(0);
      document.dispatchEvent(new PointerEvent("pointerup", { bubbles: true }));
      await nextTick();
    } finally {
      HTMLCanvasElement.prototype.getContext = originalGetContext;
    }
  });

  it("degrades within the hold when reduced motion is switched on mid-hold", async () => {
    // Frames already arrived (bus live), then the host parks the bus:
    // the recurring watchdog must flip the hold to the static fallback
    // even though revealFrames > 0 at the 160ms tick — the mid-hold
    // branch of isAnimationParked() coverage.
    const textsByCanvas = new Map<HTMLCanvasElement, string[]>();
    const originalGetContext = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = (function (
      this: HTMLCanvasElement,
    ): CanvasRenderingContext2D {
      let texts = textsByCanvas.get(this);
      if (!texts) {
        texts = [];
        textsByCanvas.set(this, texts);
      }
      const t = texts;
      return {
        canvas: this,
        clearRect: () => {},
        save: () => {},
        restore: () => {},
        translate: () => {},
        rotate: () => {},
        beginPath: () => {},
        arc: () => {},
        fill: () => {},
        fillRect: () => {},
        measureText: () => ({ width: 10 }),
        fillText: (text: string) => t.push(String(text)),
        drawImage: () => {},
        createPattern: () => ({}) as CanvasPattern,
        createImageData: (w: number, h: number) => ({
          data: new Uint8ClampedArray(w * h * 4),
        }),
        putImageData: () => {},
        imageSmoothingEnabled: false,
        globalCompositeOperation: "source-over",
        font: "",
        fillStyle: "",
        textAlign: "",
        textBaseline: "",
      } as unknown as CanvasRenderingContext2D;
    }) as unknown as typeof HTMLCanvasElement.prototype.getContext;
    try {
      const { container } = mountPasswordInput("abc", {
        revealStrategy: "noise",
      });
      const eye = container.querySelector<HTMLElement>("button.hk-pwd-eye")!;
      eye.dispatchEvent(
        new PointerEvent("pointerdown", { pointerType: "mouse", bubbles: true }),
      );
      await nextTick();
      const visible = container.querySelector<HTMLCanvasElement>(".hk-pwd-dots")!;
      // Let real bus frames flow first: past the 160ms tick the hold
      // must STILL be on the noise path (frames arrived ⇒ no flip).
      // This is what separates the mid-hold branch from the
      // no-frames branch the other test pins.
      await new Promise((r) => setTimeout(r, 260));
      expect(textsByCanvas.get(visible)).toEqual([]);
      // Park the bus MID-HOLD (this is the branch no other test hits).
      setReducedMotion(true);
      await new Promise((r) => setTimeout(r, 600));
      expect(textsByCanvas.get(visible)).toEqual(["a", "b", "c"]);
      // Latched: no re-draws on later ticks.
      await new Promise((r) => setTimeout(r, 220));
      expect(textsByCanvas.get(visible)).toEqual(["a", "b", "c"]);
      document.dispatchEvent(new PointerEvent("pointerup", { bubbles: true }));
      await nextTick();
    } finally {
      HTMLCanvasElement.prototype.getContext = originalGetContext;
      setReducedMotion(false);
    }
  });

  it("boils the glyph noise: a fresh random tile phase per frame, not an accumulating drift", async () => {
    // Boiling is the readability mechanism: the glyph region must
    // RE-SAMPLE the noise tile at a random phase every frame while the
    // background slides smoothly. A regression back to an accumulated
    // glyph drift (the old counter-drift design nobody could read) must
    // go red here. The painter consumes exactly ONE Math.random per
    // frame (the glyph phase), so a cycling mock makes the expected
    // mask translations fully deterministic — a drift accumulator would
    // ignore the mock entirely and produce monotone offsets instead.
    interface CanvasRec {
      canvas: HTMLCanvasElement;
      texts: string[];
      translateXs: number[];
    }
    const byCanvas = new Map<HTMLCanvasElement, CanvasRec>();
    const originalGetContext = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = (function (
      this: HTMLCanvasElement,
    ): CanvasRenderingContext2D {
      let rec = byCanvas.get(this);
      if (!rec) {
        rec = { canvas: this, texts: [], translateXs: [] };
        byCanvas.set(this, rec);
      }
      const r = rec;
      return {
        canvas: this,
        clearRect: () => {},
        save: () => {},
        restore: () => {},
        translate: (x: number) => r.translateXs.push(x),
        rotate: () => {},
        beginPath: () => {},
        arc: () => {},
        fill: () => {},
        fillRect: () => {},
        measureText: () => ({ width: 10 }),
        fillText: (text: string) => r.texts.push(String(text)),
        drawImage: () => {},
        createPattern: () => ({}) as CanvasPattern,
        createImageData: (w: number, h: number) => ({
          data: new Uint8ClampedArray(w * h * 4),
        }),
        putImageData: () => {},
        imageSmoothingEnabled: false,
        globalCompositeOperation: "source-over",
        font: "",
        fillStyle: "",
        textAlign: "",
        textBaseline: "",
      } as unknown as CanvasRenderingContext2D;
    }) as unknown as typeof HTMLCanvasElement.prototype.getContext;
    try {
      const { container } = mountPasswordInput("abc", {
        revealStrategy: "noise",
      });
      const eye = container.querySelector<HTMLElement>("button.hk-pwd-eye")!;
      eye.dispatchEvent(
        new PointerEvent("pointerdown", { pointerType: "mouse", bubbles: true }),
      );
      await nextTick();
      const maskRec = [...byCanvas.values()].find((r) => r.texts.length > 0);
      expect(maskRec, "the offscreen glyph mask exists").toBeTruthy();
      // Install the cycling mock AFTER the synchronous first frame: that
      // frame consumed its glyph phase from real randomness, and
      // beginHold's tile build is done consuming randomness too. From
      // here each painted frame draws exactly one mock value.
      const cycle = [0.5, 0.25, 0.75];
      let calls = 0;
      const rand = vi
        .spyOn(Math, "random")
        .mockImplementation(() => cycle[calls++ % cycle.length]!);
      const before = maskRec!.translateXs.length;
      try {
        // A few bus frames (the "normal" tier needs ~33ms between
        // deliveries — mix real timeouts with rAF like the other
        // reveal tests).
        for (let i = 0; i < 3; i++) {
          await new Promise((r) => setTimeout(r, 45));
          await new Promise((r) => requestAnimationFrame(() => r(null)));
        }
      } finally {
        rand.mockRestore();
      }
      const fresh = maskRec!.translateXs.slice(before);
      expect(fresh.length, "frames painted while the mock was live").toBeGreaterThanOrEqual(2);
      // Frame i consumes cycle[i % 3]: the expected mask translation
      // sequence is the cycle repeated, truncated to the frame count.
      const mapped = cycle.map((v) => -Math.floor(v * NOISE_TILE_W));
      const expected = fresh.map((_, i) => mapped[i % mapped.length]!);
      expect(
        fresh,
        "each frame re-samples the glyph phase from the mock cycle",
      ).toEqual(expected);
      document.dispatchEvent(new PointerEvent("pointerup", { bubbles: true }));
      await nextTick();
    } finally {
      HTMLCanvasElement.prototype.getContext = originalGetContext;
    }
  });
});

/** Installs a per-canvas recording getContext stub (happy-dom has no
 * real 2d): every canvas element gets its own recorder so a test can
 * tell the visible dot canvas apart from offscreen painter canvases. */
function stubRecordingContexts(opts: { linearGradients?: boolean } = {}) {
  // linearGradients: false simulates a pattern-ful but gradient-less
  // engine (the filter painter must hand the frame back BEFORE any
  // visible drawing so the component can latch the plain fallback).
  const { linearGradients = true } = opts;
  interface CanvasRec {
    canvas: HTMLCanvasElement;
    texts: string[];
    patternFills: number;
    drawImages: number;
    putImageDatas: number;
    gradients: number;
    fillStyles: string[];
    clips: Array<{ x: number; y: number; w: number; h: number }>;
    translates: number[];
  }
  const byCanvas = new Map<HTMLCanvasElement, CanvasRec>();
  const original = HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.getContext = (function (
    this: HTMLCanvasElement,
  ): CanvasRenderingContext2D {
    let rec = byCanvas.get(this);
    if (!rec) {
      rec = {
        canvas: this,
        texts: [],
        patternFills: 0,
        drawImages: 0,
        putImageDatas: 0,
        gradients: 0,
        fillStyles: [],
        clips: [],
        translates: [],
      };
      byCanvas.set(this, rec);
    }
    const r = rec;
    let fillStyleBox: string | CanvasGradient | CanvasPattern = "";
    const stub: Record<string, unknown> = {
      canvas: this,
      clearRect: () => {},
      save: () => {},
      restore: () => {},
      translate: (x: number) => r.translates.push(x),
      rotate: () => {},
      beginPath: () => {},
      arc: () => {},
      fill: () => {},
      fillRect: () => {},
      measureText: () => ({ width: 10 }),
      fillText: (text: string) => r.texts.push(String(text)),
      drawImage: () => r.drawImages++,
      createPattern: () => {
        r.patternFills++;
        return {} as CanvasPattern;
      },
      createLinearGradient: () => {
        r.gradients++;
        return { addColorStop: () => {} } as unknown as CanvasGradient;
      },
      createImageData: (w: number, h: number) => ({
        data: new Uint8ClampedArray(w * h * 4),
      }),
      putImageData: () => r.putImageDatas++,
      rect: (x: number, y: number, w: number, h: number) =>
        r.clips.push({ x, y, w, h }),
      clip: () => {},
      imageSmoothingEnabled: false,
      globalCompositeOperation: "source-over",
      font: "",
      get fillStyle() {
        return fillStyleBox;
      },
      set fillStyle(v: string | CanvasGradient | CanvasPattern) {
        fillStyleBox = v;
        if (typeof v === "string") r.fillStyles.push(v);
      },
      textAlign: "",
      textBaseline: "",
    };
    if (!linearGradients) delete stub.createLinearGradient;
    return stub as unknown as CanvasRenderingContext2D;
  }) as unknown as typeof HTMLCanvasElement.prototype.getContext;
  return {
    byCanvas,
    restore() {
      HTMLCanvasElement.prototype.getContext = original;
    },
  };
}

describe("HkInput password reveal strategies", () => {
  it("sweep draws readable text inside a moving window over the noise field", async () => {
    // The opt-in readable band: real high-contrast text clipped to a band
    // that sweeps across the row (sweepWindow), on top of the boiling
    // noise field. A single frame leaks only the band's characters.
    const rec = stubRecordingContexts();
    try {
      const { container, input } = mountPasswordInput("abc", {
        revealStrategy: "sweep",
      });
      const eye = container.querySelector<HTMLElement>("button.hk-pwd-eye")!;
      eye.dispatchEvent(
        new PointerEvent("pointerdown", { pointerType: "mouse", bubbles: true }),
      );
      await nextTick();
      const visible = container.querySelector<HTMLCanvasElement>(".hk-pwd-dots")!;
      const vis = rec.byCanvas.get(visible)!;
      // The sync first frame already carries text + noise base.
      expect(vis.texts).toEqual(["a", "b", "c"]);
      expect(vis.patternFills).toBeGreaterThan(0);
      expect(vis.clips.length).toBeGreaterThanOrEqual(1);
      expect(vis.clips[0]!.w).toBeGreaterThan(0);
      // The DOM input still never flips.
      expect(input.type).toBe("password");
      // Frames move the window: clip x changes across the sweep.
      for (let i = 0; i < 3; i++) {
        await new Promise((r) => setTimeout(r, 45));
        await new Promise((r) => requestAnimationFrame(() => r(null)));
      }
      expect(vis.clips.length).toBeGreaterThanOrEqual(2);
      const xs = new Set(vis.clips.map((c) => c.x));
      expect(xs.size, "the window travels across the row").toBeGreaterThan(1);
      // The band must traverse (essentially) the WHOLE row, not stop
      // mid-row: on the degenerate 0-width happy-dom canvas the layout
      // scale floors at 0.5, giving advance 6 and an 18px row for
      // "abc" — the clip centers must span ≥ 12px of that travel
      // (center = clip.x + w/2; the sweep spans first-glyph left edge
      // to the row's right edge).
      const centers = vis.clips.map((c) => c.x + c.w / 2);
      expect(
        Math.max(...centers) - Math.min(...centers),
        "the sweep reaches the row tail",
      ).toBeGreaterThanOrEqual(12);
      document.dispatchEvent(new PointerEvent("pointerup", { bubbles: true }));
      await nextTick();
    } finally {
      rec.restore();
    }
  });

  it("restarts the sweep from the row head on the second hold", async () => {
    // sweepT resets per reveal: hold-release-hold must show the window
    // at the row START again, not resume from wherever the last hold
    // left it (R2 mutation M23 — the sweepT reset had no pin).
    const rec = stubRecordingContexts();
    try {
      const { container } = mountPasswordInput("abc", {
        revealStrategy: "sweep",
      });
      const eye = container.querySelector<HTMLElement>("button.hk-pwd-eye")!;
      eye.dispatchEvent(
        new PointerEvent("pointerdown", { pointerType: "mouse", bubbles: true }),
      );
      await nextTick();
      const visible = container.querySelector<HTMLCanvasElement>(".hk-pwd-dots")!;
      const vis = rec.byCanvas.get(visible)!;
      const firstHoldFirstClip = vis.clips[0]!;
      // Drive real bus frames DURING the first hold so sweepT actually
      // advances past the row before release — without this, both
      // holds' first frames draw at sweepT = 0 and the reset pin below
      // passes vacuously. The self-check makes a frameless environment
      // fail loudly instead of slipping through.
      for (let i = 0; i < 3; i++) {
        await new Promise((r) => setTimeout(r, 45));
        await new Promise((r) => requestAnimationFrame(() => r(null)));
      }
      expect(
        vis.clips.length,
        "bus frames advanced the sweep during hold 1",
      ).toBeGreaterThanOrEqual(2);
      document.dispatchEvent(new PointerEvent("pointerup", { bubbles: true }));
      await nextTick();
      // Second hold: the very first frame's window must sit at the row
      // head again (same clip as the first hold's first frame).
      eye.dispatchEvent(
        new PointerEvent("pointerdown", { pointerType: "mouse", bubbles: true }),
      );
      await nextTick();
      const secondHoldFirstClip = vis.clips[vis.clips.length - 1]!;
      expect(secondHoldFirstClip.x).toBe(firstHoldFirstClip.x);
      expect(secondHoldFirstClip.w).toBe(firstHoldFirstClip.w);
      document.dispatchEvent(new PointerEvent("pointerup", { bubbles: true }));
      await nextTick();
    } finally {
      rec.restore();
    }
  });

  it("sweep degrades to static plain text when the animation bus is parked (reduced motion)", async () => {
    // A parked bus cannot move the window, so the sweep falls back to
    // the fully readable static plain text — never to frozen noise.
    setReducedMotion(true);
    const rec = stubRecordingContexts();
    try {
      const { container } = mountPasswordInput("abc", {
        revealStrategy: "sweep",
      });
      const eye = container.querySelector<HTMLElement>("button.hk-pwd-eye")!;
      eye.dispatchEvent(
        new PointerEvent("pointerdown", { pointerType: "mouse", bubbles: true }),
      );
      await nextTick();
      const visible = container.querySelector<HTMLCanvasElement>(".hk-pwd-dots")!;
      const vis = rec.byCanvas.get(visible)!;
      expect(vis.texts).toEqual(["a", "b", "c"]);
      // No noise machinery on the visible canvas in the degraded state.
      expect(vis.patternFills).toBe(0);
      // And the degrade target is PLAIN text, not the legacy jitter:
      // the plain pass never translates per glyph (the jitter does).
      expect(vis.translates.length, "static plain, not jitter").toBe(0);
      // And it stays put — the static frame is the whole reveal.
      await new Promise((r) => setTimeout(r, 260));
      expect(vis.texts).toEqual(["a", "b", "c"]);
      document.dispatchEvent(new PointerEvent("pointerup", { bubbles: true }));
      await nextTick();
    } finally {
      rec.restore();
      setReducedMotion(false);
    }
  });

  it("filter (default) keeps glyphs off the visible canvas: counter-drifting spatter, pedestal, halo", async () => {
    // The default reveal: STATIC glyph apertures filled with one
    // spatter texture, over a statistically matched spatter field
    // drifting the opposite way; the glyphs lifted by a small lightness
    // pedestal with a halo band around the row. Glyph geometry must
    // NEVER reach the visible canvas (mask → source-in stamp only) —
    // that is the screenshot contract. Math.random is pinned at 0.5 so
    // the dot lightness equals the exact layer base (deterministic
    // pedestal comparison).
    const rand = vi.spyOn(Math, "random").mockReturnValue(0.5);
    const rec = stubRecordingContexts();
    try {
      const { container, input } = mountPasswordInput("abc");
      const eye = container.querySelector<HTMLElement>("button.hk-pwd-eye")!;
      eye.dispatchEvent(
        new PointerEvent("pointerdown", { pointerType: "mouse", bubbles: true }),
      );
      await nextTick();
      const visible = container.querySelector<HTMLCanvasElement>(".hk-pwd-dots")!;
      const vis = rec.byCanvas.get(visible)!;
      // No glyph on the visible canvas — the screenshot sees spatter,
      // halo and a noise-composited stamp, never letterforms…
      expect(vis.texts).toEqual([]);
      // …while the offscreen mask rasterized the row exactly once.
      const allRecs = Array.from(rec.byCanvas.values());
      const mask = allRecs.find((r) => r.texts.length > 0);
      expect(mask, "offscreen glyph mask").toBeTruthy();
      expect(mask!.texts).toEqual(["a", "b", "c"]);
      // The first frame already carries background spatter (pattern),
      // the halo ramp (gradient) and the mask stamp (drawImage).
      expect(vis.patternFills).toBeGreaterThan(0);
      expect(vis.gradients, "halo band drawn").toBeGreaterThan(0);
      expect(vis.drawImages).toBeGreaterThan(0);
      // The two spatter tiles: bg first, ink second (deterministic
      // draw order), each with hundreds of solid-color dot fills. The
      // ink tile's mean color must sit ABOVE the bg tile's — the
      // lightness pedestal the human pop-out cue (and the only signal
      // a single frame leaks).
      const tiles = allRecs.filter(
        (r) => r.fillStyles.filter((s) => s.startsWith("rgb(")).length > 100,
      );
      expect(tiles.length, "exactly two spatter tiles").toBe(2);
      const meanOf = (r: (typeof tiles)[number]) => {
        const samples = r.fillStyles.filter((s) => s.startsWith("rgb("));
        let sum = 0;
        for (const s of samples) {
          const [r8, g8, b8] = s.slice(4, -1).split(",").map(Number);
          sum += (r8! + g8! + b8!) / 3;
        }
        return sum / samples.length;
      };
      const bgMean = meanOf(tiles[0]!);
      const inkMean = meanOf(tiles[1]!);
      expect(
        inkMean - bgMean,
        `glyph layer carries the lightness pedestal (bg ${bgMean.toFixed(1)} vs ink ${inkMean.toFixed(1)})`,
      ).toBeGreaterThan(8);
      // The DOM input still never flips.
      expect(input.type).toBe("password");
      // Bus frames advance BOTH layer drifts (fresh pattern phases on
      // the visible ctx for the background, on the mask ctx for the
      // glyph layer).
      const visTranslates = vis.translates.length;
      const maskTranslates = mask!.translates.length;
      const visPatterns = vis.patternFills;
      for (let i = 0; i < 3; i++) {
        await new Promise((r) => setTimeout(r, 45));
        await new Promise((r) => requestAnimationFrame(() => r(null)));
      }
      expect(vis.patternFills, "background layer keeps drifting").toBeGreaterThan(visPatterns);
      expect(vis.translates.length, "background pattern phase advances").toBeGreaterThan(visTranslates);
      expect(mask!.translates.length, "glyph layer counter-drifts").toBeGreaterThan(maskTranslates);
      // Still no glyph on the visible canvas after all those frames.
      expect(vis.texts).toEqual([]);
      document.dispatchEvent(new PointerEvent("pointerup", { bubbles: true }));
      await nextTick();
    } finally {
      rec.restore();
      rand.mockRestore();
    }
  });

  it("filter regenerates both spatter tiles on every hold", async () => {
    // Fresh noise per hold is an anti-replay contract: two holds of the
    // same password must never replay the same frame sequence. Pin: the
    // tile canvases receive a full redraw (ground + every dot) per hold.
    const rec = stubRecordingContexts();
    try {
      const { container } = mountPasswordInput("abc");
      const eye = container.querySelector<HTMLElement>("button.hk-pwd-eye")!;
      const hold = async () => {
        eye.dispatchEvent(
          new PointerEvent("pointerdown", { pointerType: "mouse", bubbles: true }),
        );
        await nextTick();
        document.dispatchEvent(new PointerEvent("pointerup", { bubbles: true }));
        await nextTick();
      };
      await hold();
      const tiles = Array.from(rec.byCanvas.values()).filter(
        (r) => r.fillStyles.filter((s) => s.startsWith("rgb(")).length > 100,
      );
      expect(tiles.length).toBe(2);
      const counts1 = tiles.map((r) => r.fillStyles.length);
      expect(counts1[0]!, "ground + dots on hold 1").toBeGreaterThan(1000);
      await hold();
      const counts2 = tiles.map((r) => r.fillStyles.length);
      expect(counts2[0]).toBe(counts1[0]! * 2);
      expect(counts2[1]).toBe(counts1[1]! * 2);
    } finally {
      rec.restore();
    }
  });

  it("filter degrades to static plain text when the animation bus is parked (reduced motion)", async () => {
    // Filter's static frame is camouflaged noise BY DESIGN — exactly
    // what a reduced-motion user cannot trade on. The degrade target is
    // therefore the fully readable plain text, like the sweep's.
    setReducedMotion(true);
    const rec = stubRecordingContexts();
    try {
      const { container } = mountPasswordInput("abc");
      const eye = container.querySelector<HTMLElement>("button.hk-pwd-eye")!;
      eye.dispatchEvent(
        new PointerEvent("pointerdown", { pointerType: "mouse", bubbles: true }),
      );
      await nextTick();
      const visible = container.querySelector<HTMLCanvasElement>(".hk-pwd-dots")!;
      const vis = rec.byCanvas.get(visible)!;
      expect(vis.texts).toEqual(["a", "b", "c"]);
      // No filter machinery on the visible canvas in the degraded state…
      expect(vis.patternFills).toBe(0);
      expect(vis.gradients).toBe(0);
      // …and the degrade target is PLAIN text, not the legacy jitter
      // (the jitter translates per glyph, plain never does).
      expect(vis.translates.length, "static plain, not jitter").toBe(0);
      await new Promise((r) => setTimeout(r, 260));
      expect(vis.texts).toEqual(["a", "b", "c"]);
      document.dispatchEvent(new PointerEvent("pointerup", { bubbles: true }));
      await nextTick();
    } finally {
      rec.restore();
      setReducedMotion(false);
    }
  });

  it("filter hands the frame back untouched on a gradient-less engine, then latches the plain fallback", async () => {
    // A pattern-ful but gradient-less engine: the painter's pre-check
    // must bail BEFORE any visible drawing (no partial spatter frame),
    // and the component then shows the readable plain fallback — the
    // pin for the capability guard (R1 weak pin C2).
    const rec = stubRecordingContexts({ linearGradients: false });
    try {
      const { container } = mountPasswordInput("abc");
      const eye = container.querySelector<HTMLElement>("button.hk-pwd-eye")!;
      eye.dispatchEvent(
        new PointerEvent("pointerdown", { pointerType: "mouse", bubbles: true }),
      );
      await nextTick();
      const visible = container.querySelector<HTMLCanvasElement>(".hk-pwd-dots")!;
      const vis = rec.byCanvas.get(visible)!;
      // The painter handed the frame back WITHOUT drawing anything…
      expect(vis.patternFills, "no partial spatter frame").toBe(0);
      expect(vis.drawImages).toBe(0);
      // …and the fallback that engaged is the readable plain text.
      expect(vis.texts).toEqual(["a", "b", "c"]);
      document.dispatchEvent(new PointerEvent("pointerup", { bubbles: true }));
      await nextTick();
    } finally {
      rec.restore();
    }
  });

  it("filter is the surface-level default too (direct HkPasswordSurface mount)", async () => {
    // HkInput declares and forwards its own default, which is where the
    // user-facing pin lives — but the surface ALSO declares a default,
    // and the two must not silently drift apart (R1 weak pin M7). The
    // surface is internal (never exported), so mount it directly.
    const rec = stubRecordingContexts();
    const model = ref("abc");
    const container = document.createElement("div");
    document.body.appendChild(container);
    const app = createApp({
      render() {
        return h(HkPasswordSurface, {
          modelValue: model.value,
          "onUpdate:modelValue": (v: string) => {
            model.value = v;
          },
        });
      },
    });
    app.mount(container);
    try {
      const eye = container.querySelector<HTMLElement>("button.hk-pwd-eye")!;
      eye.dispatchEvent(
        new PointerEvent("pointerdown", { pointerType: "mouse", bubbles: true }),
      );
      await nextTick();
      const visible = container.querySelector<HTMLCanvasElement>(".hk-pwd-dots")!;
      const vis = rec.byCanvas.get(visible)!;
      // Filter signature: glyphs only on the offscreen mask, two
      // spatter tiles, halo gradient — with NO revealStrategy prop.
      expect(vis.texts).toEqual([]);
      const tiles = Array.from(rec.byCanvas.values()).filter(
        (r) => r.fillStyles.filter((s) => s.startsWith("rgb(")).length > 100,
      );
      expect(tiles.length, "two spatter tiles = filter, not sweep/noise").toBe(2);
      expect(vis.gradients).toBeGreaterThan(0);
      document.dispatchEvent(new PointerEvent("pointerup", { bubbles: true }));
      await nextTick();
    } finally {
      app.unmount();
      container.remove();
      rec.restore();
    }
  });

  it("plain strategy draws readable text on the VISIBLE canvas — and nothing else", async () => {
    // The opt-in readable reveal (revealStrategy="plain"): glyphs ARE
    // the visible frame — no noise fills, no mask stamp — while the DOM
    // input still never flips to type="text".
    const rec = stubRecordingContexts();
    try {
      const { container, input } = mountPasswordInput("abc", {
        revealStrategy: "plain",
      });
      const eye = container.querySelector<HTMLElement>("button.hk-pwd-eye")!;
      eye.dispatchEvent(
        new PointerEvent("pointerdown", { pointerType: "mouse", bubbles: true }),
      );
      await nextTick();
      const visible = container.querySelector<HTMLCanvasElement>(".hk-pwd-dots")!;
      const vis = rec.byCanvas.get(visible)!;
      expect(vis, "visible canvas recorder").toBeTruthy();
      expect(vis.texts).toEqual(["a", "b", "c"]);
      expect(vis.patternFills).toBe(0);
      expect(vis.drawImages).toBe(0);
      // No offscreen mask/tile canvases at all in plain mode.
      expect(rec.byCanvas.size).toBe(1);
      expect(input.type).toBe("password");
      document.dispatchEvent(new PointerEvent("pointerup", { bubbles: true }));
      await nextTick();
      // After release the reveal pass stops: no further text draws.
      const drawn = vis.texts.length;
      for (let i = 0; i < 2; i++) {
        await new Promise((r) => requestAnimationFrame(() => r(null)));
      }
      expect(vis.texts.length).toBe(drawn);
    } finally {
      rec.restore();
    }
  });

  it("plain strategy stays readable under reduced motion (no motion to lose)", async () => {
    // The a11y win of the plain strategy: a parked animation bus cannot
    // freeze it into noise — the static text IS the reveal.
    setReducedMotion(true);
    const rec = stubRecordingContexts();
    try {
      const { container } = mountPasswordInput("abc", {
        revealStrategy: "plain",
      });
      const eye = container.querySelector<HTMLElement>("button.hk-pwd-eye")!;
      eye.dispatchEvent(
        new PointerEvent("pointerdown", { pointerType: "mouse", bubbles: true }),
      );
      await nextTick();
      const visible = container.querySelector<HTMLCanvasElement>(".hk-pwd-dots")!;
      expect(rec.byCanvas.get(visible)!.texts).toEqual(["a", "b", "c"]);
      // And it stays put — no watchdog flips, no redraws.
      await new Promise((r) => setTimeout(r, 260));
      expect(rec.byCanvas.get(visible)!.texts).toEqual(["a", "b", "c"]);
      document.dispatchEvent(new PointerEvent("pointerup", { bubbles: true }));
      await nextTick();
    } finally {
      rec.restore();
      setReducedMotion(false);
    }
  });

  it("plain strategy repaints when the value changes mid-reveal", async () => {
    setReducedMotion(true); // parked bus: only explicit repaints draw
    const rec = stubRecordingContexts();
    try {
      const { container, model } = mountPasswordInput("abc", {
        revealStrategy: "plain",
        revealTrigger: "toggle",
      });
      const eye = container.querySelector<HTMLElement>("button.hk-pwd-eye")!;
      eye.dispatchEvent(
        new PointerEvent("pointerdown", { pointerType: "mouse", bubbles: true }),
      );
      await nextTick();
      const visible = container.querySelector<HTMLCanvasElement>(".hk-pwd-dots")!;
      expect(rec.byCanvas.get(visible)!.texts).toEqual(["a", "b", "c"]);
      // Typing while revealed: the static frame must follow the value
      // even though no bus frame will ever arrive.
      model.value = "abcz";
      await nextTick();
      expect(rec.byCanvas.get(visible)!.texts).toEqual(["a", "b", "c", "a", "b", "c", "z"]);
      document.dispatchEvent(new PointerEvent("pointerup", { bubbles: true }));
      await nextTick();
    } finally {
      rec.restore();
      setReducedMotion(false);
    }
  });

  it("clearing the value mid-reveal ends the reveal", async () => {
    const rec = stubRecordingContexts();
    try {
      const { container, model } = mountPasswordInput("abc", {
        revealStrategy: "plain",
        revealTrigger: "toggle",
      });
      const eye = container.querySelector<HTMLElement>("button.hk-pwd-eye")!;
      eye.dispatchEvent(
        new PointerEvent("pointerdown", { pointerType: "mouse", bubbles: true }),
      );
      await nextTick();
      expect(eye.hasAttribute("data-revealing")).toBe(true);
      model.value = "";
      await nextTick();
      expect(eye.hasAttribute("data-revealing")).toBe(false);
    } finally {
      rec.restore();
    }
  });

  it("repaints the latched jitter fallback when the value changes mid-reveal (parked bus)", async () => {
    // Reduced motion + noise strategy: the reveal is a STATIC jitter
    // frame that no bus frame will ever refresh — a mid-reveal value
    // change must repaint it, or the field would keep showing the OLD
    // password until release.
    setReducedMotion(true);
    const rec = stubRecordingContexts();
    try {
      const { container, model } = mountPasswordInput("abc", {
        revealStrategy: "noise",
        revealTrigger: "toggle",
      });
      const eye = container.querySelector<HTMLElement>("button.hk-pwd-eye")!;
      eye.dispatchEvent(
        new PointerEvent("pointerdown", { pointerType: "mouse", bubbles: true }),
      );
      await nextTick();
      const visible = container.querySelector<HTMLCanvasElement>(".hk-pwd-dots")!;
      expect(rec.byCanvas.get(visible)!.texts).toEqual(["a", "b", "c"]);
      model.value = "abcz";
      await nextTick();
      expect(rec.byCanvas.get(visible)!.texts).toEqual(["a", "b", "c", "a", "b", "c", "z"]);
    } finally {
      rec.restore();
      setReducedMotion(false);
    }
  });

  it("ends the reveal when the field is disabled mid-reveal", async () => {
    // showEye gates on disabled, so the eye unmounts — but the reveal
    // must not linger on a disabled field (above all a toggle with the
    // auto-hide timer off).
    const rec = stubRecordingContexts();
    const dis = ref(false);
    const model = ref("secret");
    const container = document.createElement("div");
    document.body.appendChild(container);
    const app = createApp({
      render() {
        return h(HkInput, {
          variant: "password",
          revealStrategy: "plain",
          revealTrigger: "toggle",
          revealAutoHideMs: 0,
          disabled: dis.value,
          modelValue: model.value,
          "onUpdate:modelValue": (v: string) => {
            model.value = v;
          },
        });
      },
    });
    app.mount(container);
    try {
      const eye = container.querySelector<HTMLElement>("button.hk-pwd-eye")!;
      eye.dispatchEvent(
        new PointerEvent("pointerdown", { pointerType: "mouse", bubbles: true }),
      );
      await nextTick();
      const visible = container.querySelector<HTMLCanvasElement>(".hk-pwd-dots")!;
      const vis = rec.byCanvas.get(visible)!;
      expect(vis.texts).toEqual(["s", "e", "c", "r", "e", "t"]);
      dis.value = true;
      await nextTick();
      // The eye is gone and the reveal pass ended: the dot-matrix
      // repaint after endReveal adds no further text draws.
      expect(container.querySelector("button.hk-pwd-eye")).toBeNull();
      for (let i = 0; i < 2; i++) {
        await new Promise((r) => requestAnimationFrame(() => r(null)));
      }
      expect(vis.texts).toEqual(["s", "e", "c", "r", "e", "t"]);
    } finally {
      app.unmount();
      container.remove();
      rec.restore();
    }
  });

  it("ends the reveal when the reveal props flip mid-reveal", async () => {
    // strategy/trigger are read once at reveal start (painter setup,
    // watchdog, trigger listeners all branch on them) — a mid-reveal
    // flip reconciles by ending the reveal, never by stranding a
    // half-old/half-new hold.
    const rec = stubRecordingContexts();
    const strategy = ref<"noise" | "plain">("plain");
    const model = ref("secret");
    const container = document.createElement("div");
    document.body.appendChild(container);
    const app = createApp({
      render() {
        return h(HkInput, {
          variant: "password",
          revealStrategy: strategy.value,
          revealTrigger: "toggle",
          modelValue: model.value,
          "onUpdate:modelValue": (v: string) => {
            model.value = v;
          },
        });
      },
    });
    app.mount(container);
    try {
      const eye = container.querySelector<HTMLElement>("button.hk-pwd-eye")!;
      eye.dispatchEvent(
        new PointerEvent("pointerdown", { pointerType: "mouse", bubbles: true }),
      );
      await nextTick();
      expect(eye.hasAttribute("data-revealing")).toBe(true);
      strategy.value = "noise";
      await nextTick();
      expect(eye.hasAttribute("data-revealing")).toBe(false);
      // And the noise strategy works fine on the NEXT reveal.
      const visible = container.querySelector<HTMLCanvasElement>(".hk-pwd-dots")!;
      const textsBeforeNoise = rec.byCanvas.get(visible)!.texts.length;
      eye.dispatchEvent(
        new PointerEvent("pointerdown", { pointerType: "mouse", bubbles: true }),
      );
      await nextTick();
      expect(eye.hasAttribute("data-revealing")).toBe(true);
      for (let i = 0; i < 2; i++) {
        await new Promise((r) => setTimeout(r, 45));
        await new Promise((r) => requestAnimationFrame(() => r(null)));
      }
      // Noise mode: glyphs stay off the visible canvas — the plain
      // reveal's earlier text draws are the last ones it ever saw.
      expect(rec.byCanvas.get(visible)!.texts.length).toBe(textsBeforeNoise);
      eye.dispatchEvent(
        new PointerEvent("pointerdown", { pointerType: "mouse", bubbles: true }),
      );
      await nextTick();
    } finally {
      app.unmount();
      container.remove();
      rec.restore();
    }
  });
});

describe("HkInput password reveal trigger", () => {
  it("toggle mode reveals on click, survives release, hides on the next click", async () => {
    const { container } = mountPasswordInput("secret", {
      revealTrigger: "toggle",
    });
    const eye = container.querySelector<HTMLElement>("button.hk-pwd-eye")!;

    eye.dispatchEvent(
      new PointerEvent("pointerdown", { pointerType: "mouse", bubbles: true }),
    );
    await nextTick();
    expect(eye.hasAttribute("data-revealing")).toBe(true);

    // Releasing the pointer must NOT end a toggled reveal.
    document.dispatchEvent(new PointerEvent("pointerup", { bubbles: true }));
    await nextTick();
    expect(eye.hasAttribute("data-revealing")).toBe(true);

    eye.dispatchEvent(
      new PointerEvent("pointerdown", { pointerType: "mouse", bubbles: true }),
    );
    await nextTick();
    expect(eye.hasAttribute("data-revealing")).toBe(false);
  });

  it("toggle mode hides automatically after revealAutoHideMs", async () => {
    const { container } = mountPasswordInput("secret", {
      revealTrigger: "toggle",
      revealAutoHideMs: 120,
    });
    const eye = container.querySelector<HTMLElement>("button.hk-pwd-eye")!;
    eye.dispatchEvent(
      new PointerEvent("pointerdown", { pointerType: "mouse", bubbles: true }),
    );
    await nextTick();
    expect(eye.hasAttribute("data-revealing")).toBe(true);
    await new Promise((r) => setTimeout(r, 260));
    expect(eye.hasAttribute("data-revealing")).toBe(false);
  });

  it("revealAutoHideMs=0 disables the toggle auto-hide", async () => {
    const { container } = mountPasswordInput("secret", {
      revealTrigger: "toggle",
      revealAutoHideMs: 0,
    });
    const eye = container.querySelector<HTMLElement>("button.hk-pwd-eye")!;
    eye.dispatchEvent(
      new PointerEvent("pointerdown", { pointerType: "mouse", bubbles: true }),
    );
    await nextTick();
    await new Promise((r) => setTimeout(r, 260));
    expect(eye.hasAttribute("data-revealing")).toBe(true);
    eye.dispatchEvent(
      new PointerEvent("pointerdown", { pointerType: "mouse", bubbles: true }),
    );
    await nextTick();
    expect(eye.hasAttribute("data-revealing")).toBe(false);
  });

  it("toggle mode keyboard: Space toggles, keyup does not hide, auto-repeat does not flap", async () => {
    const { container } = mountPasswordInput("secret", {
      revealTrigger: "toggle",
    });
    const eye = container.querySelector<HTMLElement>("button.hk-pwd-eye")!;

    eye.dispatchEvent(
      new KeyboardEvent("keydown", { key: " ", bubbles: true, cancelable: true }),
    );
    await nextTick();
    expect(eye.hasAttribute("data-revealing")).toBe(true);

    // keyup is a no-op in toggle mode (hold semantics would hide here).
    eye.dispatchEvent(
      new KeyboardEvent("keyup", { key: " ", bubbles: true, cancelable: true }),
    );
    await nextTick();
    expect(eye.hasAttribute("data-revealing")).toBe(true);

    // Held-key auto-repeat must not flap the toggle.
    eye.dispatchEvent(
      new KeyboardEvent("keydown", { key: " ", bubbles: true, cancelable: true, repeat: true }),
    );
    await nextTick();
    expect(eye.hasAttribute("data-revealing")).toBe(true);

    eye.dispatchEvent(
      new KeyboardEvent("keydown", { key: " ", bubbles: true, cancelable: true }),
    );
    await nextTick();
    expect(eye.hasAttribute("data-revealing")).toBe(false);
  });

  it("switches the eye aria-label between show and hide in toggle mode", async () => {
    const { container } = mountPasswordInput("secret", {
      revealTrigger: "toggle",
    });
    const eye = container.querySelector<HTMLElement>("button.hk-pwd-eye")!;
    expect(eye.getAttribute("aria-label")).toBe("Show password");
    eye.dispatchEvent(
      new PointerEvent("pointerdown", { pointerType: "mouse", bubbles: true }),
    );
    await nextTick();
    expect(eye.getAttribute("aria-label")).toBe("Hide password");
    eye.dispatchEvent(
      new PointerEvent("pointerdown", { pointerType: "mouse", bubbles: true }),
    );
    await nextTick();
    expect(eye.getAttribute("aria-label")).toBe("Show password");
  });

  it("hold mode keeps the hold-to-reveal aria-label and semantics", async () => {
    const { container } = mountPasswordInput("secret");
    const eye = container.querySelector<HTMLElement>("button.hk-pwd-eye")!;
    expect(eye.getAttribute("aria-label")).toBe("Hold to show password");
    eye.dispatchEvent(
      new PointerEvent("pointerdown", { pointerType: "mouse", bubbles: true }),
    );
    await nextTick();
    expect(eye.hasAttribute("data-revealing")).toBe(true);
    document.dispatchEvent(new PointerEvent("pointerup", { bubbles: true }));
    await nextTick();
    expect(eye.hasAttribute("data-revealing")).toBe(false);
  });

  it("ignores a second press without release (one painter seed per reveal)", async () => {
    // The startReveal double-start guard: two pointerdowns without an
    // intervening release must not re-seed the painter mid-hold (fresh
    // noise + phase reset would visibly flash the field). Observable
    // pin: beginHold retiles the noise canvas — exactly ONE
    // putImageData per reveal (the NOISE painter's signature; the
    // filter painter retiles with vector fills instead).
    const rec = stubRecordingContexts();
    try {
      const { container } = mountPasswordInput("abc", {
        revealStrategy: "noise",
      });
      const eye = container.querySelector<HTMLElement>("button.hk-pwd-eye")!;
      eye.dispatchEvent(
        new PointerEvent("pointerdown", { pointerType: "mouse", bubbles: true }),
      );
      await nextTick();
      eye.dispatchEvent(
        new PointerEvent("pointerdown", { pointerType: "mouse", bubbles: true }),
      );
      await nextTick();
      const tilePuts = [...rec.byCanvas.values()].reduce(
        (s, r) => s + r.putImageDatas,
        0,
      );
      expect(tilePuts).toBe(1);
      document.dispatchEvent(new PointerEvent("pointerup", { bubbles: true }));
      await nextTick();
    } finally {
      rec.restore();
    }
  });
});

/** happy-dom's own ResizeObserver never fires (no layout engine): this one
 * keeps the callbacks so a test can run the measurement deterministically. */
class FakeResizeObserver {
  static instances: FakeResizeObserver[] = [];
  callback: () => void;
  constructor(callback: () => void) {
    this.callback = callback;
    FakeResizeObserver.instances.push(this);
  }
  observe(): void {}
  disconnect(): void {}
}

describe("HkInput password canvas sizing in a scaled root", () => {
  it("sizes the dot canvas in the box's own units", () => {
    const original = globalThis.ResizeObserver;
    FakeResizeObserver.instances = [];
    globalThis.ResizeObserver = FakeResizeObserver as unknown as typeof ResizeObserver;
    try {
      const m = mountPasswordInput("hunter2");
      const box = m.container.querySelector<HTMLElement>(".hk-pwd-box")!;
      const canvas = m.container.querySelector<HTMLCanvasElement>(".hk-pwd-dots")!;
      expect(box && canvas).toBeTruthy();
      // The box is drawn twice the size it is laid out at.
      Object.defineProperty(box, "getBoundingClientRect", {
        configurable: true,
        value: () => ({ left: 0, top: 0, right: 800, bottom: 200, width: 800, height: 200, x: 0, y: 0 }) as DOMRect,
      });
      Object.defineProperty(box, "offsetWidth", { configurable: true, get: () => 400 });
      Object.defineProperty(box, "offsetHeight", { configurable: true, get: () => 100 });
      const dpr = window.devicePixelRatio || 1;
      const observers = FakeResizeObserver.instances.filter((o) => o.callback);
      expect(observers.length, "the box is observed").toBeGreaterThan(0);
      observers.forEach((o) => o.callback());
      expect(canvas.width, "400 of the box's own pixels, not the drawn 800").toBe(
        Math.round(400 * dpr),
      );
    } finally {
      globalThis.ResizeObserver = original;
    }
  });
});
