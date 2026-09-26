import { afterEach, describe, expect, it, vi } from "vitest";
import { createApp, defineComponent, h } from "vue";

import { HkIconChip } from "./HkIconChip";
import { HkPageHeader } from "./HkPageHeader";
import { HkSectionHeader } from "./HkSectionHeader";
import { HkStatCard } from "./HkStatCard";

const mounts: Array<{ app: ReturnType<typeof createApp>; container: HTMLElement }> = [];

function mount(node: ReturnType<typeof h>) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const app = createApp({ render: () => node });
  app.mount(container);
  mounts.push({ app, container });
  return container;
}

afterEach(() => {
  for (const { app, container } of mounts.splice(0)) {
    app.unmount();
    container.remove();
  }
});

/** A lucide-vue-next style icon: a plain functional component. */
const FnIcon = (_props: { size?: number }, _ctx: unknown) =>
  h("svg", { "data-fn-icon": "" });

const FnIconComponent = defineComponent({
  name: "FnIcon",
  setup: () => () => h("svg", { "data-fn-icon": "" }),
});

describe("icon props accept functional components", () => {
  it("renders lucide-style functional icons without the Invalid-prop warning", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    mount(h(HkIconChip, { icon: FnIconComponent as never }));
    mount(h(HkStatCard, { variant: "chip", value: 1, label: "L", icon: FnIconComponent as never }));
    mount(h(HkPageHeader, { title: "T", icon: FnIconComponent as never }));
    mount(h(HkSectionHeader, { title: "T", icon: FnIconComponent as never }));
    const invalid = warn.mock.calls.filter((c) => String(c[0]).includes("Invalid prop"));
    expect(invalid).toEqual([]);
    expect(document.querySelectorAll("[data-fn-icon]")).toBeTruthy();
    warn.mockRestore();
  });
});
