import { afterEach, describe, expect, it, vi } from "vitest";
import { createApp, defineComponent, h, nextTick, ref } from "vue";

import {
  clipboardContextMenuDefault,
  contextMenuDefaultsFor,
  registerContextMenuDefault,
} from "./defaultContextMenu";
import HkContextMenuProvider from "../components/HkContextMenuProvider";
import type { ContextTriggerPoint } from "./useContextMenu";

function point(target: EventTarget | null, x = 10, y = 10): ContextTriggerPoint {
  return { x, y, kind: "pointer", target, defaultPrevented: false };
}

afterEach(() => {
  document.body.innerHTML = "";
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("default menu registry", () => {
  it("runs contributions in order (lowest first) and stops at the first claim", () => {
    const first = registerContextMenuDefault({
      id: "test.late",
      order: 50,
      build: () => ({ x: 0, y: 0, items: [{ key: "late", label: "Late" }] }),
    });
    const second = registerContextMenuDefault({
      id: "test.early",
      order: 10,
      build: () => ({ x: 0, y: 0, items: [{ key: "early", label: "Early" }] }),
    });
    try {
      const request = contextMenuDefaultsFor(point(document.body));
      expect(request?.items[0]?.key).toBe("early");
    } finally {
      first();
      second();
    }
  });

  it("a null build defers to later contributors", () => {
    const passing = registerContextMenuDefault({
      id: "test.pass",
      order: 10,
      build: () => null,
    });
    try {
      // The built-in clipboard contributor follows and does not claim a
      // non-editable target → null overall.
      expect(contextMenuDefaultsFor(point(document.body))).toBeNull();
    } finally {
      passing();
    }
  });

  it("re-registering an id replaces the entry and the unregister is idempotent", () => {
    const a = registerContextMenuDefault({
      id: "test.dup",
      order: 99,
      build: () => ({ x: 0, y: 0, items: [{ key: "a", label: "A" }] }),
    });
    const b = registerContextMenuDefault({
      id: "test.dup",
      order: 99,
      build: () => ({ x: 0, y: 0, items: [{ key: "b", label: "B" }] }),
    });
    try {
      const request = contextMenuDefaultsFor(point(document.body));
      // Order 99 puts it last; the built-in clipboard menu (order 0)
      // declines a plain body target, so the replacement answers.
      expect(request?.items[0]?.key).toBe("b");
      a(); // stale handle of the REPLACED entry must not remove the new one
      expect(contextMenuDefaultsFor(point(document.body))?.items[0]?.key).toBe("b");
    } finally {
      b();
      a();
    }
  });

  it("the built-in clipboard contributor ships registered at module scope", () => {
    const input = document.createElement("input");
    input.value = "hello";
    document.body.appendChild(input);
    // No explicit install needed — the module-scope registration answers.
    expect(contextMenuDefaultsFor(point(input))?.items.some((i) => i.key === "copy")).toBe(true);
  });
});

describe("clipboard contributor", () => {
  function editableMenu(target: HTMLElement) {
    document.body.appendChild(target);
    return clipboardContextMenuDefault.build(point(target))!;
  }

  it("claims editable targets with the localized clipboard menu", () => {
    const input = document.createElement("input");
    input.value = "hello world";
    input.setSelectionRange(0, 5);
    const request = editableMenu(input);
    expect(request.items.map((i) => i.key)).toEqual(["copy", "cut", "paste", "selectAll"]);
    const byKey = Object.fromEntries(request.items.map((i) => [i.key, i]));
    expect(byKey.copy!.disabled).toBe(false);
    expect(byKey.cut!.disabled).toBe(false);
    expect(byKey.paste!.disabled).toBe(false);
    // selectAll carries no disabled field at all (always available).
    expect(byKey.selectAll!.disabled).toBeFalsy();
    expect(request.title).toBeTruthy();
  });

  it("disables copy/cut without a selection and cut/paste on readonly", () => {
    // Paste availability is a capability fact — pin it so the assertions
    // below measure the readonly rule, not the environment.
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText: vi.fn(), readText: vi.fn() },
      configurable: true,
    });
    const plain = editableMenu(Object.assign(document.createElement("input"), { value: "" }));
    const byKey = Object.fromEntries(plain.items.map((i) => [i.key, i]));
    expect(byKey.copy!.disabled).toBe(true);
    expect(byKey.cut!.disabled).toBe(true);
    expect(byKey.paste!.disabled).toBe(false);

    const readonlyInput = document.createElement("input") as HTMLInputElement;
    readonlyInput.value = "abc";
    readonlyInput.readOnly = true;
    readonlyInput.setSelectionRange(0, 3);
    const readonly = editableMenu(readonlyInput);
    const ro = Object.fromEntries(readonly.items.map((i) => [i.key, i]));
    expect(ro.copy!.disabled).toBe(false);
    expect(ro.cut!.disabled).toBe(true);
    expect(ro.paste!.disabled).toBe(true);
  });

  it("disables paste where the clipboard read API does not exist (no dead key)", () => {
    // A plain-HTTP LAN deployment has no navigator.clipboard: an ENABLED
    // paste row that silently does nothing is a dead key, so the row
    // reports the capability instead.
    Object.defineProperty(navigator, "clipboard", { value: undefined, configurable: true });
    const request = editableMenu(Object.assign(document.createElement("input"), { value: "abc" }));
    const paste = request.items.find((i) => i.key === "paste")!;
    expect(paste.disabled).toBe(true);
    // The rest of the menu stays usable.
    expect(request.items.find((i) => i.key === "selectAll")!.disabled).toBeFalsy();
  });

  it("declines non-editable targets", () => {
    expect(clipboardContextMenuDefault.build(point(document.createElement("div")))).toBeNull();
    expect(clipboardContextMenuDefault.build(point(null))).toBeNull();
  });

  it("copy writes the snapshotted selection to the clipboard", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { value: { writeText, readText: vi.fn() }, configurable: true });
    const input = document.createElement("input");
    input.value = "hello world";
    input.setSelectionRange(6, 11);
    const request = editableMenu(input);
    request.onSelect!("copy", request.items[0]!);
    await vi.waitFor(() => expect(writeText).toHaveBeenCalledWith("world"));
  });

  it("paste inserts at the caret and moves it after the text", async () => {
    const readText = vi.fn().mockResolvedValue("inserted");
    Object.defineProperty(navigator, "clipboard", { value: { writeText: vi.fn(), readText }, configurable: true });
    const input = document.createElement("input");
    input.value = "hello world";
    input.setSelectionRange(5, 5);
    const request = editableMenu(input);
    let inputEvent = false;
    input.addEventListener("input", () => { inputEvent = true; });
    request.onSelect!("paste", request.items[2]!);
    await vi.waitFor(() => {
      expect(input.value).toBe("helloinserted world");
      expect(input.selectionStart).toBe(13);
      expect(inputEvent).toBe(true);
    });
  });

  it("select all covers the whole field", () => {
    const input = document.createElement("input");
    input.value = "hello world";
    input.setSelectionRange(2, 3);
    const request = editableMenu(input);
    request.onSelect!("selectAll", request.items[3]!);
    expect(input.selectionStart).toBe(0);
    expect(input.selectionEnd).toBe(11);
  });

  it("resolves labels through the hikari i18n context (zh-Hans relabels)", async () => {
    const { setLocale } = await import("../i18n/context");
    const input = document.createElement("input");
    input.value = "x";
    const en = editableMenu(input);
    expect(en.items.find((i) => i.key === "copy")!.label).toBe("Copy");
    await setLocale("zh-Hans");
    const zh = editableMenu(input);
    expect(zh.items.find((i) => i.key === "copy")!.label).toBe("复制");
    expect(zh.items.find((i) => i.key === "selectAll")!.label).toBe("全选");
    await setLocale("en");
  });
});

describe("provider defaults regime", () => {
  /** Mount a provider (defaults on) around a live element — the child is
   *  created INSIDE the render (a raw DOM element passed as a vnode child
   *  never lands in the tree, and a detached target's events do not
   *  bubble to the window listener). */
  function mountDefaults(tag: "input" | "div") {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const Wrapper = defineComponent({
      name: "DefaultsHost",
      setup() {
        return () =>
          h(HkContextMenuProvider, { defaults: true }, {
            default: () =>
              h("div", [
                tag === "input"
                  ? h("input", { class: "probe-input", value: "abc" })
                  : h("div", { class: "probe-div" }),
              ]),
          });
      },
    });
    const app = createApp(Wrapper);
    app.mount(container);
    const target = container.querySelector(tag === "input" ? ".probe-input" : ".probe-div")!;
    return { app, container, target };
  }

  it("an editable right-click opens the clipboard menu and suppresses the platform menu", async () => {
    const { app, target } = mountDefaults("input");
    await nextTick();
    const event = new MouseEvent("contextmenu", { bubbles: true, cancelable: true, clientX: 8, clientY: 8 });
    target.dispatchEvent(event);
    await nextTick();
    expect(event.defaultPrevented).toBe(true); // the platform menu is gone
    const row = Array.from(document.querySelectorAll<HTMLElement>(".hk-menu-row"))
      .find((r) => r.textContent?.includes("Copy"));
    expect(row).toBeTruthy();
    app.unmount();
  });

  it("a non-editable right-click is silently suppressed (no menu, no platform menu)", async () => {
    const { app, target } = mountDefaults("div");
    await nextTick();
    const event = new MouseEvent("contextmenu", { bubbles: true, cancelable: true, clientX: 8, clientY: 8 });
    target.dispatchEvent(event);
    await nextTick();
    expect(event.defaultPrevented).toBe(true);
    expect(document.querySelector(".hk-select-popout")).toBeNull();
    app.unmount();
  });

  it("yields to an element-level binding that already preventDefaulted", async () => {
    const { app, target } = mountDefaults("div");
    await nextTick();
    // Simulate a bound menu: an element listener claims the event first.
    target.addEventListener("contextmenu", (e) => e.preventDefault(), { once: true });
    const event = new MouseEvent("contextmenu", { bubbles: true, cancelable: true, clientX: 8, clientY: 8 });
    target.dispatchEvent(event);
    await nextTick();
    expect(document.querySelector(".hk-select-popout")).toBeNull();
    app.unmount();
  });

  it("follows a runtime flip of the defaults prop (on installs, off un-claims)", async () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const on = ref(false);
    const Wrapper = defineComponent({
      setup() {
        return () =>
          h(HkContextMenuProvider, { defaults: on.value }, {
            default: () => h("div", [h("div", { class: "flip-probe" })]),
          });
      },
    });
    const app = createApp(Wrapper);
    app.mount(container);
    await nextTick();
    const target = container.querySelector(".flip-probe")!;

    const fire = () => {
      const event = new MouseEvent("contextmenu", { bubbles: true, cancelable: true, clientX: 5, clientY: 5 });
      target.dispatchEvent(event);
      return event;
    };

    // Initially off: the event is untouched.
    expect(fire().defaultPrevented).toBe(false);

    // Flipped on after mount: the regime claims the right-click.
    on.value = true;
    await nextTick();
    expect(fire().defaultPrevented).toBe(true);

    // Flipped back off: claiming stops.
    on.value = false;
    await nextTick();
    expect(fire().defaultPrevented).toBe(false);

    app.unmount();
  });

  it("isolates a throwing contributor (the platform menu still never appears)", async () => {
    const unregister = registerContextMenuDefault({
      id: "test.thrower",
      order: -1,
      build: () => {
        throw new Error("boom");
      },
    });
    try {
      const { app, target } = mountDefaults("div");
      await nextTick();
      const event = new MouseEvent("contextmenu", { bubbles: true, cancelable: true, clientX: 5, clientY: 5 });
      target.dispatchEvent(event);
      await nextTick();
      // preventDefault runs FIRST — a broken contributor cannot hand the
      // event back to the browser.
      expect(event.defaultPrevented).toBe(true);
      expect(document.querySelector(".hk-select-popout")).toBeNull();
      app.unmount();
    } finally {
      unregister();
    }
  });

  it("without the defaults prop the window listener is not installed", async () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const Wrapper = defineComponent({
      setup() {
        return () =>
          h(HkContextMenuProvider, null, {
            default: () => h("div", [h("div", { class: "probe-div" })]),
          });
      },
    });
    const app = createApp(Wrapper);
    app.mount(container);
    await nextTick();
    const target = container.querySelector(".probe-div")!;
    const event = new MouseEvent("contextmenu", { bubbles: true, cancelable: true, clientX: 8, clientY: 8 });
    target.dispatchEvent(event);
    await nextTick();
    // Untouched: no suppression, no menu.
    expect(event.defaultPrevented).toBe(false);
    expect(document.querySelector(".hk-select-popout")).toBeNull();
    app.unmount();
  });
});
