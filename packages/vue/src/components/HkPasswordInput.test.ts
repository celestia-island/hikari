import { afterEach, describe, expect, it, vi } from "vitest";
import { createApp, h, nextTick, ref, type Slot } from "vue";

import HkPasswordInput from "./HkPasswordInput";

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
        HkPasswordInput,
        {
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
  return container.querySelector(".hk-pwd-placeholder")?.textContent ?? null;
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

describe("HkPasswordInput refocus", () => {
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

describe("HkPasswordInput variants and icons", () => {
  it("defaults to the password variant with the lock icon and i18n placeholder", () => {
    const { container } = mountPasswordInput("");
    expect(placeholderText(container)).toBe("Enter your password");
    expect(
      container.querySelector(".hk-pwd-lock")?.getAttribute("data-icon"),
    ).toBe("password");
    expect(
      container
        .querySelector(".hk-pwd-lock")
        ?.classList.contains("hk-pwd-lock-empty"),
    ).toBe(true);
  });

  it("renders the confirm icon and confirm placeholder for the confirm variant", () => {
    const { container } = mountPasswordInput("", { variant: "confirm" });
    expect(placeholderText(container)).toBe("Confirm your password");
    expect(
      container.querySelector(".hk-pwd-lock")?.getAttribute("data-icon"),
    ).toBe("confirm");
    // The built-in lock icon must not render for the confirm variant.
    expect(container.querySelector(".hk-pwd-lock rect")).toBeNull();
  });

  it("renders the icon slot for the custom icon instead of a built-in svg", () => {
    const { container } = mountPasswordInput(
      "",
      { icon: "custom" },
      {
        icon: () => [h("span", { class: "custom-icon" }, "custom-mark")],
      },
    );
    expect(
      container.querySelector(".hk-pwd-lock")?.getAttribute("data-icon"),
    ).toBe("custom");
    expect(container.querySelector(".custom-icon")?.textContent).toBe(
      "custom-mark",
    );
    expect(container.querySelector(".hk-pwd-lock svg")).toBeNull();
  });

  it("lets an explicit placeholder override the variant default", () => {
    const { container } = mountPasswordInput("", {
      variant: "confirm",
      placeholder: "Confirm password (custom)",
    });
    expect(placeholderText(container)).toBe("Confirm password (custom)");
  });
});

describe("HkPasswordInput placeholder layers on Tab focus", () => {
  it("shows exactly one placeholder text on focus of an empty field", async () => {
    const { container, input } = mountPasswordInput("", {});
    expect(placeholderText(container)).toBeTruthy();
    const before = placeholderText(container);
    input.focus();
    await nextTick();
    await nextTick();
    // Exactly one .hk-pwd-placeholder node, holding ONE of the valid texts.
    const nodes = container.querySelectorAll(".hk-pwd-placeholder");
    expect(nodes.length).toBe(1);
    const txt = nodes[0].textContent ?? "";
    expect([before, "已聚焦，请输入密码", "Focused, enter your password"]).toContain(txt);
    // No hint/blur overlays doubled on top.
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
    // Both layers must carry the SAME resolved text (the focused prompt)
    // so their visibility handshake never shows two different strings.
    expect(staticText).toBeTruthy();
    expect(marqueeText).toBe(staticText);
  });

/** happy-dom's own ResizeObserver never fires (no layout engine): this one
 *  keeps the callbacks so a test can run the measurement deterministically. */
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

describe("HkPasswordInput strength dots in a scaled root", () => {
  it("sizes the dot canvas in the box's own units", () => {
    const original = globalThis.ResizeObserver;
    FakeResizeObserver.instances = [];
    globalThis.ResizeObserver = FakeResizeObserver as unknown as typeof ResizeObserver;
    try {
    // The canvas is CSS-sized to its box (`inset: 0`) while its backing store
    // is drawn from the box's DRAWN size: in a scaled or zoomed root the grid
    // came out k times denser and every dot k times smaller.
    const m = mountPasswordInput("hunter2", { showStrengthDots: true });
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
    // Re-run the measurement the box's observer would run.
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

});
