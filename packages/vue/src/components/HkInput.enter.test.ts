import { afterEach, describe, expect, it } from "vitest";
import { createApp, h } from "vue";

import HkInput from "./HkInput";

const mounts: Array<{ app: ReturnType<typeof createApp>; container: HTMLElement }> = [];

function mountInput(props: Record<string, unknown> = {}) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const app = createApp({ render: () => h(HkInput, props) });
  app.mount(container);
  mounts.push({ app, container });
  return container;
}

function pressEnter(target: Element, mods: { shift?: boolean; ctrl?: boolean } = {}): boolean {
  const event = new KeyboardEvent("keydown", {
    key: "Enter",
    bubbles: true,
    cancelable: true,
    shiftKey: mods.shift ?? false,
    ctrlKey: mods.ctrl ?? false,
  });
  target.dispatchEvent(event);
  return event.defaultPrevented;
}

afterEach(() => {
  for (const { app, container } of mounts.splice(0)) {
    app.unmount();
    container.remove();
  }
  document.body.innerHTML = "";
});

describe("HkInput textarea Enter handling", () => {
  it("keeps the native newline when no submit intent is wired", () => {
    const container = mountInput({ type: "textarea", modelValue: "" });
    const ta = container.querySelector("textarea")!;
    expect(ta).toBeTruthy();
    // Plain Enter must fall through so the browser inserts the line
    // break — the old unconditional preventDefault swallowed it, which
    // made multi-line chat inputs unable to ever break a line.
    expect(pressEnter(ta)).toBe(false);
  });

  it("submits and blocks the newline when submitOnEnter is wired", () => {
    let submitted = 0;
    const container = mountInput({
      type: "textarea",
      modelValue: "",
      submitOnEnter: () => {
        submitted++;
      },
    });
    const ta = container.querySelector("textarea")!;
    expect(pressEnter(ta)).toBe(true);
    expect(submitted).toBe(1);
  });

  it("leaves shift+enter alone even with a submit intent", () => {
    let submitted = 0;
    const container = mountInput({
      type: "textarea",
      modelValue: "",
      submitOnEnter: () => {
        submitted++;
      },
    });
    const ta = container.querySelector("textarea")!;
    expect(pressEnter(ta, { shift: true })).toBe(false);
    expect(submitted).toBe(0);
  });

  it("keeps intercepting plain Enter on single-line inputs", () => {
    let submitted = 0;
    const container = mountInput({
      modelValue: "",
      submitOnEnter: () => {
        submitted++;
      },
    });
    const input = container.querySelector("input")!;
    expect(pressEnter(input)).toBe(true);
    expect(submitted).toBe(1);
  });
});
