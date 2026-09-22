import { afterEach, describe, expect, it } from "vitest";
import { createApp, defineComponent, h, nextTick, ref } from "vue";

import HkLoadingVeil from "./HkLoadingVeil";

/**
 * HkLoadingVeil contract tests:
 * - nothing renders while inactive (zero DOM footprint)
 * - active paints the veil root, the spinner, and the label
 * - no label prop → no label node (spinner-only)
 * - reactive: active toggles appearance/disappearance
 * - the root carries role=status / aria-live=polite / the label as
 *   aria-label (screen readers announce the blocking state)
 *
 * (Repo test convention: raw createApp + document queries, no
 * @vue/test-utils dependency.)
 */

const mounts: Array<() => void> = [];

function mountVeil(props: Record<string, unknown> = {}) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const active = ref(props.active ?? false);
  const app = createApp({
    setup() {
      return () =>
        h(HkLoadingVeil, {
          active: active.value,
          label: props.label ?? "",
        });
    },
  });
  app.mount(container);
  mounts.push(() => {
    app.unmount();
    container.remove();
  });
  return { active, container };
}

afterEach(() => {
  while (mounts.length) mounts.pop()?.();
});

describe("HkLoadingVeil", () => {
  it("renders nothing while inactive", async () => {
    const { container } = mountVeil({ active: false });
    await nextTick();
    expect(container.querySelector(".hk-loading-veil")).toBeNull();
  });

  it("renders the veil, spinner and label while active", async () => {
    const { container } = mountVeil({ active: true, label: "Opening…" });
    await nextTick();
    expect(container.querySelector(".hk-loading-veil")).not.toBeNull();
    expect(container.querySelector(".hk-loading-veil-spinner")).not.toBeNull();
    const label = container.querySelector(".hk-loading-veil-label");
    expect(label?.textContent).toBe("Opening…");
  });

  it("omits the label node when no label is given", async () => {
    const { container } = mountVeil({ active: true });
    await nextTick();
    expect(container.querySelector(".hk-loading-veil-spinner")).not.toBeNull();
    expect(container.querySelector(".hk-loading-veil-label")).toBeNull();
  });

  it("appears and disappears reactively with the active prop", async () => {
    const { active, container } = mountVeil({ active: false });
    await nextTick();
    expect(container.querySelector(".hk-loading-veil")).toBeNull();
    active.value = true;
    await nextTick();
    expect(container.querySelector(".hk-loading-veil")).not.toBeNull();
    active.value = false;
    await nextTick();
    expect(container.querySelector(".hk-loading-veil")).toBeNull();
  });

  it("carries role=status and the label as aria-label", async () => {
    const { container } = mountVeil({ active: true, label: "Loading backend" });
    await nextTick();
    const root = container.querySelector(".hk-loading-veil");
    expect(root?.getAttribute("role")).toBe("status");
    expect(root?.getAttribute("aria-label")).toBe("Loading backend");
    expect(root?.getAttribute("aria-live")).toBe("polite");
  });
});
