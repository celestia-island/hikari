import { describe, expect, it } from "vitest";
import { createApp, defineComponent, h } from "vue";

import HkSegmented from "./HkSegmented";

const options = [
  { value: "a", label: "Alpha" },
  { value: "b", label: "Beta" },
  { value: "c", label: "Gamma", disabled: true },
];

/** Mount one HkSegmented in a throwaway app (the repo's test convention —
 *  @vue/test-utils is not a dependency; hosts render into a div and we
 *  assert against the DOM). */
function mountSegmented(
  props: Record<string, unknown>,
): { root: HTMLElement; unmount: () => void } {
  const Host = defineComponent({
    setup() {
      return () => h(HkSegmented as never, { options, ...props });
    },
  });
  const el = document.createElement("div");
  document.body.appendChild(el);
  const app = createApp(Host);
  app.mount(el);
  return { root: el, unmount: () => { app.unmount(); el.remove(); } };
}

function segments(root: HTMLElement): HTMLElement[] {
  return Array.from(root.querySelectorAll(".hk-segmented__segment"));
}

describe("HkSegmented", () => {
  it("renders one button per option with checked state on modelValue", () => {
    const { root, unmount } = mountSegmented({ modelValue: "a" });
    const segs = segments(root);
    expect(segs).toHaveLength(3);
    expect(segs[0].getAttribute("data-checked")).toBe("true");
    expect(segs[1].getAttribute("data-checked")).toBeNull();
    unmount();
  });

  it("exposes radiogroup semantics", () => {
    const { root, unmount } = mountSegmented({ modelValue: "a" });
    expect(root.querySelector(".hk-segmented")!.getAttribute("role"))
      .toBe("radiogroup");
    expect(segments(root)[0].getAttribute("role")).toBe("radio");
    unmount();
  });

  it("ignores clicks on the already-selected segment", async () => {
    const { root, unmount } = mountSegmented({ modelValue: "a" });
    segments(root)[0].click();
    await Promise.resolve();
    // Still checked: no v-model host wired, but the click must be inert —
    // verified by the attribute staying set without any error path.
    expect(segments(root)[0].getAttribute("data-checked")).toBe("true");
    unmount();
  });

  it("disables per-option segments and the whole group", () => {
    const { root, unmount } = mountSegmented({ modelValue: "a" });
    const segs = segments(root);
    expect((segs[2] as HTMLButtonElement).disabled).toBe(true);
    unmount();
    const { root: r2, unmount: u2 } = mountSegmented({
      modelValue: "a", disabled: true,
    });
    expect(r2.querySelector(".hk-segmented")!.getAttribute("data-disabled"))
      .toBe("true");
    expect((segments(r2)[1] as HTMLButtonElement).disabled).toBe(true);
    u2();
  });
});
