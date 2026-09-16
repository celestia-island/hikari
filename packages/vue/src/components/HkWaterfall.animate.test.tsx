import { describe, expect, it, vi } from "vitest";
import { createApp, defineComponent, h, nextTick, ref } from "vue";

/**
 * `animate` is a pass-through: the waterfall hands it to the list
 * transition as `disabled`. The main suite cannot see that — the transition
 * only names its classes during an enter frame — so this file stubs the
 * transition and asserts the flag it receives, which is what a host that
 * suppresses animation during a bulk hydration actually depends on.
 */
const received: boolean[] = [];

vi.mock("./HkListTransition", () => ({
  default: defineComponent({
    name: "HkListTransition",
    props: { disabled: { type: Boolean, default: false } },
    setup(props, { slots }) {
      return () => {
        received.push(props.disabled);
        return h("div", { class: "stub-list" }, slots.default?.());
      };
    },
  }),
}));

import HkWaterfall from "./HkWaterfall";

async function mountWith(animate: boolean) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const Root = defineComponent({
    setup() {
      return () =>
        h(
          HkWaterfall,
          { items: ["a1"], animate },
          { card: ({ item }: { item: unknown }) => h("div", { class: "card" }, String(item)) },
        );
    },
  });
  const app = createApp(Root);
  app.mount(container);
  await nextTick();
  return { app, container };
}

describe("HkWaterfall animate", () => {
  it("leaves the transition enabled by default", async () => {
    received.length = 0;
    const mounted = await mountWith(true);
    expect(received.length).toBeGreaterThan(0);
    expect(received.every((disabled) => disabled === false)).toBe(true);
    mounted.app.unmount();
  });

  it("disables the transition when animate is false", async () => {
    received.length = 0;
    const mounted = await mountWith(false);
    expect(received.length).toBeGreaterThan(0);
    expect(received.every((disabled) => disabled === true)).toBe(true);
    mounted.app.unmount();
  });
});
