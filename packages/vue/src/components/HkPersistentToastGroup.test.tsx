import { afterEach, describe, expect, it } from "vitest";
import { createApp, defineComponent, h } from "vue";

import HkPersistentToast from "./HkPersistentToast";
import HkPersistentToastGroup from "./HkPersistentToastGroup";

/**
 * HkPersistentToastGroup contract tests:
 * - renders the first maxVisible children and collapses the rest into
 *   the "+N" counter
 * - comment placeholders (v-if=false children) do not count
 * - hidden children are unmounted, so their own DOM never reaches the
 *   document
 *
 * House style: raw createApp mounts torn down afterEach.
 */

const mounts: Array<{ app: ReturnType<typeof createApp>; container: HTMLElement }> = [];

function mountRow(count: number, maxVisible: number) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const host = defineComponent({
    setup() {
      return () =>
        h(
          HkPersistentToastGroup,
          { maxVisible } as never,
          {
            default: () =>
              Array.from({ length: count }, (_, i) =>
                h(HkPersistentToast, { key: i, tone: "loading", label: `task ${i}` }),
              ),
          },
        );
    },
  });
  const app = createApp(host);
  app.mount(container);
  mounts.push({ app, container });
  return { app, container };
}

afterEach(() => {
  for (const { app, container } of mounts.splice(0)) {
    app.unmount();
    container.remove();
  }
});

function chips(c: HTMLElement) {
  return c.querySelectorAll(".hk-persistent-toast");
}

describe("HkPersistentToastGroup", () => {
  it("renders up to maxVisible chips and collapses the rest into +N", () => {
    const { container } = mountRow(4, 1);
    expect(chips(container).length).toBe(1);
    expect(chips(container)[0]!.textContent).toContain("task 0");
    const extra = container.querySelector<HTMLElement>(".hk-persistent-toast-group__extra")!;
    expect(extra.textContent).toBe("+3");
  });

  it("renders everything when count fits and skips the counter", () => {
    const { container } = mountRow(2, 3);
    expect(chips(container).length).toBe(2);
    expect(container.querySelector(".hk-persistent-toast-group__extra")).toBeNull();
  });

  it("unmounts hidden chips entirely (no stray DOM)", () => {
    const { container } = mountRow(3, 1);
    expect(document.body.textContent).not.toContain("task 1");
    expect(document.body.textContent).not.toContain("task 2");
    expect(chips(container).length).toBe(1);
  });

  it("renders an empty group without noise", () => {
    const { container } = mountRow(0, 1);
    expect(chips(container).length).toBe(0);
    expect(container.querySelector(".hk-persistent-toast-group__extra")).toBeNull();
  });
});
