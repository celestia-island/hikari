import { afterEach, describe, expect, it } from "vitest";
import { createApp, h, nextTick, ref } from "vue";

import HkPasswordInput from "./HkPasswordInput";

interface Mounted {
  model: ReturnType<typeof ref<string>>;
  app: ReturnType<typeof createApp>;
  container: HTMLElement;
  input: HTMLInputElement;
}

const mounts: Mounted[] = [];

function mountPasswordInput(initial = ""): Mounted {
  const model = ref(initial);
  const container = document.createElement("div");
  document.body.appendChild(container);
  const app = createApp({
    render() {
      return h(HkPasswordInput, {
        modelValue: model.value,
        placeholder: "Enter password",
        "onUpdate:modelValue": (v: string) => {
          model.value = v;
        },
      });
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
      "Entered, click to clear the existing password",
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
});
