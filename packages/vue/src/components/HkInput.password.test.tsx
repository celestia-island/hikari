import { afterEach, describe, expect, it, vi } from "vitest";
import { Comment, createApp, createVNode, h, nextTick, ref, type Slot } from "vue";

import HkInput from "./HkInput";
import { passwordLevel } from "../utils/password";

/**
 * HkInput variant="password" contract tests (the unified password field —
 * HkPasswordInput was deleted; its surface lives behind this variant):
 * - the hikari password visual identity survives: canvas dot matrix,
 *   centered breathing placeholder with focus states, blur "entered"
 *   hint, caps-lock / full-width hints, pending-clear refocus semantics
 * - right-edge affordance (passwordTrailing): eye hold-to-reveal
 *   (default) / strength traffic light / none
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

describe("HkInput password hold-to-reveal eye", () => {
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
    // The reveal pass re-randomizes glyphs EVERY frame; reading
    // computed styles at that rate is layout thrash. The cache warms
    // at reveal start (or lazily on the first draw) and every
    // subsequent frame must hit it — a wholesale cache removal would
    // silently pass the suite without this count.
    const ctxStub = {
      canvas: {},
      clearRect: () => {},
      save: () => {}, restore: () => {}, translate: () => {}, rotate: () => {},
      beginPath: () => {}, arc: () => {}, fill: () => {},
      measureText: () => ({ width: 10 }),
      fillText: () => {},
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

  it("draws the password on the canvas with per-frame jitter (anti-OCR)", async () => {
    // Recording canvas context: happy-dom's getContext is null, so the
    // drawing path never runs there — stub it and drive the jitter
    // deterministically by pinning Math.random per frame.
    const calls: Array<{ font: string; fillStyle: string; text: string }> = [];
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
      fillText: (text: string) => {
        calls.push({
          font: String(ctxStub.font),
          fillStyle: String(ctxStub.fillStyle),
          text,
        });
      },
      font: "",
      fillStyle: "",
      textAlign: "",
      textBaseline: "",
    };
    const originalGetContext = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = (() =>
      ctxStub) as unknown as typeof HTMLCanvasElement.prototype.getContext;
    const randomSpy = vi.spyOn(Math, "random").mockReturnValue(0.5);
    try {
      const { container, input } = mountPasswordInput("abc");
      const eye = container.querySelector<HTMLElement>("button.hk-pwd-eye")!;

      // Frame 1 (hold): every glyph drawn exactly once, mid-jitter.
      eye.dispatchEvent(
        new PointerEvent("pointerdown", { pointerType: "mouse", bubbles: true }),
      );
      await nextTick();
      expect(calls.map((c) => c.text)).toEqual(["a", "b", "c"]);
      expect(input.type).toBe("password");
      const frame1Fonts = calls.map((c) => c.font);
      const frame1Colors = calls.map((c) => c.fillStyle);
      const frame1 = frame1Fonts.map((f, i) => `${f}|${frame1Colors[i]}`);

      // Frame 2 (a second hold with a different random stream): the
      // SAME value must render with DIFFERENT font sizes AND colors —
      // each dimension is asserted SEPARATELY so a regression that
      // freezes only one of them (e.g. size→constant, color still
      // jittering) still fails this test.
      document.dispatchEvent(new PointerEvent("pointerup", { bubbles: true }));
      await nextTick();
      calls.length = 0;
      randomSpy.mockReturnValue(0.9);
      eye.dispatchEvent(
        new PointerEvent("pointerdown", { pointerType: "mouse", bubbles: true }),
      );
      await nextTick();
      const frame2 = calls.map((c) => `${c.font}|${c.fillStyle}`);
      expect(calls.map((c) => c.text)).toEqual(["a", "b", "c"]);
      expect(frame1.join(";")).not.toBe(frame2.join(";"));
      expect(
        calls.map((c) => c.font),
        "glyph SIZE jitter must vary across frames",
      ).not.toEqual(frame1Fonts);
      expect(
        calls.map((c) => c.fillStyle),
        "glyph COLOR jitter must vary across frames",
      ).not.toEqual(frame1Colors);

      // Release: the reveal pass must stop — no more glyph draws.
      calls.length = 0;
      document.dispatchEvent(new PointerEvent("pointerup", { bubbles: true }));
      await nextTick();
      expect(calls.length).toBe(0);
    } finally {
      randomSpy.mockRestore();
      HTMLCanvasElement.prototype.getContext = originalGetContext;
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
