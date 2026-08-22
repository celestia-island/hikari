import { afterEach, describe, expect, it, vi } from "vitest";
import { createApp, h, nextTick, ref } from "vue";

import HkRollingNumber from "./HkRollingNumber";

interface Mounted {
  model: ReturnType<typeof ref<string>>;
  app: ReturnType<typeof createApp>;
  container: HTMLElement;
}

const mounts: Mounted[] = [];

function mountRollingNumber(initial: string): Mounted {
  const model = ref(initial);
  const container = document.createElement("div");
  document.body.appendChild(container);
  const app = createApp({
    render() {
      return h(HkRollingNumber, { value: model.value });
    },
  });
  app.mount(container);
  const mounted = { model, app, container };
  mounts.push(mounted);
  return mounted;
}

afterEach(() => {
  vi.useRealTimers();
  for (const { app, container } of mounts.splice(0)) {
    app.unmount();
    container.remove();
  }
});

describe("HkRollingNumber roll fallback", () => {
  it("renders the value as plain chars when not animating", async () => {
    const { container } = mountRollingNumber("42");
    await nextTick();
    expect(container.querySelector('[data-el="roll"]')).toBeNull();
    expect(container.textContent).toBe("42");
  });

  it("commits the final digit via the fallback when animationend never fires", async () => {
    vi.useFakeTimers();
    const { container, model } = mountRollingNumber("5");
    await nextTick();

    model.value = "7";
    await nextTick();

    // Rolling: the slot shows both the old and the new digit.
    const roll = container.querySelector('[data-el="roll"]');
    expect(roll).not.toBeNull();
    expect(container.querySelector('[data-el="digit"][data-variant="old"]')?.textContent).toBe("5");
    expect(container.querySelector('[data-el="digit"][data-variant="new"]')?.textContent).toBe("7");

    // Under the global animation switch the CSS roll is paused at 0% and
    // animationend never fires — the ~350ms cronBus fallback commits.
    vi.advanceTimersByTime(400);
    await nextTick();

    expect(container.querySelector('[data-el="roll"]')).toBeNull();
    expect(container.textContent).toBe("7");
  });

  it("cancels the fallback when animationend does fire", async () => {
    vi.useFakeTimers();
    const { container, model } = mountRollingNumber("5");
    await nextTick();

    model.value = "7";
    await nextTick();

    const roll = container.querySelector('[data-el="roll"]') as HTMLElement | null;
    expect(roll).not.toBeNull();
    roll!.dispatchEvent(new AnimationEvent("animationend"));
    await nextTick();

    // Committed immediately by the event — the pending fallback must not
    // double-commit (no error, state already final).
    expect(container.querySelector('[data-el="roll"]')).toBeNull();
    expect(container.textContent).toBe("7");

    vi.advanceTimersByTime(400);
    await nextTick();
    expect(container.textContent).toBe("7");
  });
});
