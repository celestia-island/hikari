import { afterEach, describe, expect, it, vi } from "vitest";
import { createApp, defineComponent, h, nextTick, ref } from "vue";

import HkModal, { MODAL_WIDTH_PRESETS, resolveModalWidth } from "./HkModal";

const mounts: ReturnType<typeof createApp>[] = [];
const containers: HTMLElement[] = [];

afterEach(async () => {
  for (const app of mounts.splice(0)) app.unmount();
  for (const el of containers.splice(0)) el.remove();
  vi.restoreAllMocks();
});

describe("resolveModalWidth", () => {
  it("maps every named preset to its CSS max-width value", () => {
    for (const [name, css] of Object.entries(MODAL_WIDTH_PRESETS)) {
      expect(resolveModalWidth(name)).toBe(css);
    }
  });

  it("keeps the default-sized presets bounded and ordered", () => {
    // Sanity on the scale itself: xs < sm(default) < md < lg < xl.
    expect(MODAL_WIDTH_PRESETS.xs).toBe("20rem");
    expect(MODAL_WIDTH_PRESETS.sm).toBe("32rem");
    expect(MODAL_WIDTH_PRESETS.md).toBe("40rem");
    expect(MODAL_WIDTH_PRESETS.lg).toBe("56rem");
    expect(MODAL_WIDTH_PRESETS.xl).toBe("72rem");
  });

  it("passes arbitrary CSS max-width values through untouched", () => {
    expect(resolveModalWidth("32rem")).toBe("32rem");
    expect(resolveModalWidth("560px")).toBe("560px");
    expect(resolveModalWidth("50%")).toBe("50%");
    expect(resolveModalWidth("min(90vw, 48rem)")).toBe("min(90vw, 48rem)");
  });

  it("passes digit-free max-width keywords through without warning", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    for (const keyword of ["auto", "none", "min-content", "max-content", "fit-content"]) {
      expect(resolveModalWidth(keyword)).toBe(keyword);
    }
    expect(warn).not.toHaveBeenCalled();
  });

  it("coerces a numeric width from JS consumers instead of throwing", () => {
    expect(resolveModalWidth(560 as unknown as string)).toBe("560");
  });

  it("does not inherit Object.prototype members as presets", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    // A bare index lookup would resolve "constructor"/"toString" to
    // inherited functions and early-return them past the warn — the
    // guard must treat them as unknown values instead.
    for (const hostile of ["constructor", "toString", "valueOf"]) {
      expect(resolveModalWidth(hostile)).toBe(hostile);
    }
    expect(warn).toHaveBeenCalledTimes(3);
  });

  it("trims surrounding whitespace before the preset lookup", () => {
    expect(resolveModalWidth(" sm ")).toBe("32rem");
    expect(resolveModalWidth(" 560px ")).toBe(" 560px ");
  });

  it("warns once in dev for a value that is neither a preset nor a length", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    // A unique digit-free token per run: the warn-once set is module
    // state, and any digit would classify the value as a length.
    const stray = `wide-${Math.random().toString(36).slice(2).replace(/\d/g, "") || "wide"}`;
    expect(resolveModalWidth(stray)).toBe(stray);
    expect(resolveModalWidth(stray)).toBe(stray);
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0]?.[0]).toContain(stray);
  });
});

describe("HkModal width rendering", () => {
  async function mountModal(width: string): Promise<HTMLElement> {
    const container = document.createElement("div");
    document.body.appendChild(container);
    containers.push(container);

    const open = ref(true);
    const Wrapper = defineComponent({
      setup() {
        return () =>
          h(HkModal, {
            modelValue: open.value,
            width,
          }, { default: () => h("div", "content") });
      },
    });
    const app = createApp(Wrapper);
    mounts.push(app);
    app.mount(container);
    await nextTick();

    // HkModal Teleports to document.body — the mount container stays empty.
    const content = document.body.querySelector<HTMLElement>(".hk-modal-content");
    expect(content).toBeTruthy();
    return content!;
  }

  it("renders a named preset as the frame's max-width", async () => {
    const content = await mountModal("sm");
    expect(content.style.maxWidth).toBe("32rem");
  });

  it("renders an arbitrary CSS length as the frame's max-width", async () => {
    const content = await mountModal("560px");
    expect(content.style.maxWidth).toBe("560px");
  });
});
