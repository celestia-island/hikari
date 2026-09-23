import { afterEach, describe, expect, it } from "vitest";
import { createApp, defineComponent, h, nextTick, type Component } from "vue";

import { registerThemeDecor, registerThemeDecorBuiltin } from "../theme/themeDecor";
import { registerStandardThemeDecor } from "../theme/standardDecor";
import { useTheme } from "../theme/useTheme";
import HkThemeDecor from "./HkThemeDecor";

/**
 * HkThemeDecor — "resolve the slot for the ambient theme and render it".
 *
 * The two axes that must be reactive are both pinned here (a theme switch
 * re-resolves — it remounts only when the new theme resolves to a different
 * component — and a registration landing after first render), as are
 * the three boundaries: nothing is rendered for an unregistered slot, the
 * resolved component's root is the only node (no wrapper), and `size` only
 * travels to components that actually declare it.
 */

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
  // The theme ref is module-level state: leave it where the rest of the
  // suite (and any later file sharing this graph) expects it.
  useTheme().setTheme("default");
});

/** A decor stub that records the props it was handed. `variant`/`kept` are
 *  declared so the registry's `props` bag travels as PROPS (undeclared keys
 *  would land in attrs and never reach `setup`'s props object). */
function decorStub(tag: string, seen: Record<string, unknown>[] = []): Component {
  return defineComponent({
    name: `DecorStub-${tag}`,
    props: {
      size: { type: [String, Number], default: undefined },
      variant: { type: String, default: undefined },
      kept: { type: Number, default: undefined },
    },
    setup(props) {
      seen.push({ ...props });
      return () => h("i", { "data-decor": tag });
    },
  });
}

describe("HkThemeDecor", () => {
  it("renders the registered implementation for the current theme, reactively across switches", async () => {
    const { setTheme } = useTheme();
    registerThemeDecor({
      themeId: "decor-a",
      slot: "status.tray",
      component: decorStub("a"),
    });
    registerThemeDecorBuiltin({ slot: "status.tray", component: decorStub("builtin") });

    setTheme("decor-a");
    const container = mount(h(HkThemeDecor, { slot: "status.tray" }));
    await nextTick();
    expect(container.querySelector('[data-decor="a"]')).not.toBeNull();

    // Theme B has no entry: the built-in floor answers.
    setTheme("decor-b");
    await nextTick();
    expect(container.querySelector('[data-decor="a"]')).toBeNull();
    expect(container.querySelector('[data-decor="builtin"]')).not.toBeNull();

    // …and switching back re-resolves (a switch that lands on a different
    // component remounts by vnode type; the assertions below pin the rendered
    // result, not instance identity).
    setTheme("decor-a");
    await nextTick();
    expect(container.querySelector('[data-decor="a"]')).not.toBeNull();
    expect(container.querySelector('[data-decor="builtin"]')).toBeNull();
  });

  it("re-resolves when a registration lands after the first render", async () => {
    const { setTheme } = useTheme();
    setTheme("decor-late");
    const container = mount(h(HkThemeDecor, { slot: "status.late" }));
    await nextTick();
    expect(container.querySelector('[data-decor="late"]')).toBeNull();

    registerThemeDecor({
      themeId: "decor-late",
      slot: "status.late",
      component: decorStub("late"),
    });
    await nextTick();
    expect(container.querySelector('[data-decor="late"]')).not.toBeNull();
  });

  it("renders nothing at all for an unregistered slot", async () => {
    const container = mount(h(HkThemeDecor, { slot: "status.nobody.home" }));
    await nextTick();
    // No element, no text, no placeholder element — only Vue's empty-render
    // comment may remain.
    expect(container.querySelector("*")).toBeNull();
    expect(container.children).toHaveLength(0);
    expect(container.textContent).toBe("");
    expect(container.innerHTML.replace(/<!--[\s\S]*?-->/g, "")).toBe("");
  });

  it("renders nothing (and does not throw) for a malformed slot name", async () => {
    // Registration rejects a bad slot name loudly; LOOKUP degrades to empty,
    // because a host typo must not take the page down.
    const container = mount(h(HkThemeDecor, { slot: "Not_A_Slot" }));
    await nextTick();
    expect(container.querySelector("*")).toBeNull();
  });

  it("renders the decor's root as the only node (no wrapper element)", async () => {
    registerThemeDecor({
      themeId: "decor-flat",
      slot: "status.flat",
      component: decorStub("flat"),
    });
    useTheme().setTheme("decor-flat");
    const container = mount(h(HkThemeDecor, { slot: "status.flat" }));
    await nextTick();
    expect(container.children).toHaveLength(1);
    expect(container.firstElementChild!.tagName).toBe("I");
  });

  it("forwards size to a decor component that declares a size prop", async () => {
    const seen: Record<string, unknown>[] = [];
    registerThemeDecor({
      themeId: "decor-size",
      slot: "status.sized",
      component: decorStub("sized", seen),
    });
    useTheme().setTheme("decor-size");
    mount(h(HkThemeDecor, { slot: "status.sized", size: "lg" }));
    await nextTick();
    expect(seen.at(-1)?.size).toBe("lg");
  });

  it("does not forward size to a component without a size prop (no stray attribute)", async () => {
    const plain = defineComponent({
      name: "PlainDecor",
      setup: () => () => h("i", { "data-decor": "plain" }),
    });
    registerThemeDecor({ themeId: "decor-plain", slot: "status.plain", component: plain });
    useTheme().setTheme("decor-plain");
    const container = mount(h(HkThemeDecor, { slot: "status.plain", size: "lg" }));
    await nextTick();
    // Without a declared `size` prop the value would fall through as a DOM
    // attribute — its absence is the proof it was not passed.
    expect(container.querySelector('[data-decor="plain"]')!.getAttribute("size")).toBeNull();
  });

  it("lets decorProps beat the props recorded at registration", async () => {
    const seen: Record<string, unknown>[] = [];
    registerThemeDecor({
      themeId: "decor-props",
      slot: "status.props",
      component: decorStub("props", seen),
      props: { variant: "registered", kept: 1 },
    });
    useTheme().setTheme("decor-props");
    mount(h(HkThemeDecor, { slot: "status.props", decorProps: { variant: "host" } }));
    await nextTick();
    expect(seen.at(-1)).toMatchObject({ variant: "host", kept: 1 });
  });

  it("lets a theme replace the built-in tray end to end (the TRAY_DECORS replacement path)", async () => {
    // The per-theme decoration table chest kept inside its tray component is
    // gone: a theme ships its own tray by registering a component for this
    // slot under its own id, and hikari's built-in tray answers for every
    // other theme.
    registerStandardThemeDecor();
    const { setTheme } = useTheme();
    const themedTray = defineComponent({
      name: "ThemedTray",
      setup: () => () => h("i", { "data-decor": "themed-tray" }),
    });
    registerThemeDecor({ themeId: "endfield", slot: "status.tray", component: themedTray });

    const container = mount(h(HkThemeDecor, { slot: "status.tray" }));

    setTheme("endfield");
    await nextTick();
    expect(container.querySelector('[data-decor="themed-tray"]')).not.toBeNull();
    expect(container.querySelector(".s-status-bar-system-tray")).toBeNull();

    setTheme("default");
    await nextTick();
    expect(container.querySelector('[data-decor="themed-tray"]')).toBeNull();
    expect(container.querySelector(".s-status-bar-system-tray")).not.toBeNull();
  });
});
