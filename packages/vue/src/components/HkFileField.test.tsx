import { afterEach, describe, expect, it, vi } from "vitest";
import { createApp, defineComponent, h, nextTick, ref } from "vue";

import HkFileField from "./HkFileField";

vi.mock("./HkFileBrowserDialog", () => {
  const emittedConfirms: { name: string; path: string; size?: number }[][] = [];
  let toggle: ((v: boolean) => void) | null = null;
  return {
    default: defineComponent({
      name: "HkFileBrowserDialogStub",
      props: { modelValue: { type: Boolean, default: false }, multiple: { type: Boolean, default: false } },
      emits: ["update:modelValue", "confirm"],
      setup(props, { emit }) {
        toggle = (v: boolean) => emit("update:modelValue", v);
        return () =>
          props.modelValue
            ? h(
                "div",
                { class: "file-dialog-stub" },
                h("button", {
                  class: "file-dialog-stub-confirm",
                  onClick: () => {
                    const files = props.multiple
                      ? [
                          { name: "remote-a.csv", path: "/data/remote-a.csv", size: 3 },
                          { name: "remote-b.csv", path: "/data/remote-b.csv", size: 4 },
                        ]
                      : [{ name: "remote-a.csv", path: "/data/remote-a.csv", size: 3 }];
                    emittedConfirms.push(files);
                    emit("confirm", files);
                    emit("update:modelValue", false);
                  },
                }),
              )
            : null;
      },
    }),
    // Exposed for the remote-mode test to drive the stub.
    __emittedConfirms: emittedConfirms,
    __setOpen: (fn: (v: boolean) => void | null) => { toggle = fn; },
  };
});

const mounts: ReturnType<typeof createApp>[] = [];
const containers: HTMLElement[] = [];

afterEach(async () => {
  for (const app of mounts.splice(0)) app.unmount();
  for (const el of containers.splice(0)) el.remove();
});

interface FieldHandle {
  trigger: HTMLButtonElement;
  clear: HTMLButtonElement | null;
  native: HTMLInputElement;
  text: string;
  /** Simulate the native picker resolving files. */
  resolveNative: (files: { name: string; size: number }[]) => void;
  model: { value: { name: string; path?: string; size?: number; file?: File }[] };
}

async function mountField(props: Record<string, unknown> = {}): Promise<FieldHandle> {
  const container = document.createElement("div");
  document.body.appendChild(container);
  containers.push(container);

  const model = ref<{ name: string; path?: string; size?: number; file?: File }[]>([]);
  const Wrapper = defineComponent({
    setup() {
      return () =>
        h(HkFileField, {
          modelValue: model.value,
          "onUpdate:modelValue": (v: { name: string }[]) => { model.value = v; },
          ...props,
        });
    },
  });
  const app = createApp(Wrapper);
  mounts.push(app);
  app.mount(container);
  await nextTick();

  const trigger = container.querySelector<HTMLButtonElement>(".hk-file-trigger")!;
  const native = container.querySelector<HTMLInputElement>(".hk-file-native")!;
  return {
    trigger,
    get clear(): HTMLButtonElement | null {
      return container.querySelector<HTMLButtonElement>(".hk-file-clear");
    },
    native,
    get text(): string {
      return (
        container.querySelector<HTMLElement>(".hk-file-trigger-text")?.textContent ?? ""
      );
    },
    resolveNative(files) {
      Object.defineProperty(native, "files", {
        value: files.map((f) => ({ name: f.name, size: f.size })),
        configurable: true,
      });
      native.dispatchEvent(new Event("change"));
    },
    model,
  };
}

describe("HkFileField local mode", () => {
  it("shows the placeholder affordance and opens the native picker on click", async () => {
    const field = await mountField({ label: "Attachment" });
    expect(field.text).toContain("Choose a file…");
    const click = vi.spyOn(field.native, "click").mockImplementation(() => {});
    await field.trigger.click();
    expect(click).toHaveBeenCalled();
    // Label association: label's for points at the trigger id.
    const label = container_labelFor(field.trigger.id);
    expect(label).toBeTruthy();
  });

  it("populates modelValue from the native change event (single replaces)", async () => {
    const field = await mountField();
    field.resolveNative([{ name: "a.csv", size: 10 }]);
    await nextTick();
    expect(field.model.value).toHaveLength(1);
    expect(field.model.value[0]!.name).toBe("a.csv");
    expect(field.text).toContain("a.csv");
    // Filled state shows the clear affordance, which empties the value.
    expect(field.clear).toBeTruthy();
    await field.clear!.click();
    await nextTick();
    expect(field.model.value).toHaveLength(0);
    expect(container_queryClear()).toBeNull();
  });

  it("keeps every file in multiple mode", async () => {
    const field = await mountField({ multiple: true });
    field.resolveNative([
      { name: "a.csv", size: 1 },
      { name: "b.csv", size: 2 },
      { name: "c.csv", size: 3 },
    ]);
    await nextTick();
    expect(field.model.value).toHaveLength(3);
    expect(field.text).toContain("a.csv +2");
  });

  it("renders error over hint when both are passed", async () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    containers.push(container);
    const app = createApp({
      setup: () => () => h(HkFileField, { error: "Required", hint: "Pick wisely" }),
    });
    mounts.push(app);
    app.mount(container);
    await nextTick();
    expect(container.querySelector(".hk-file-field-error")?.textContent).toBe("Required");
    expect(container.querySelector(".hk-file-field-hint")).toBeNull();
  });
});

describe("HkFileField remote mode", () => {
  it("opens the browser dialog on click and adopts the confirmed files", async () => {
    const adapter = { list: vi.fn(async (path: string) => ({ path, entries: [] })) };
    const container = document.createElement("div");
    document.body.appendChild(container);
    containers.push(container);

    const model = ref<{ name: string; path?: string; size?: number }[]>([]);
    const Wrapper = defineComponent({
      setup() {
        return () =>
          h(HkFileField, {
            modelValue: model.value,
            "onUpdate:modelValue": (v: { name: string }[]) => { model.value = v; },
            mode: "remote",
            adapter,
          });
      },
    });
    const app = createApp(Wrapper);
    mounts.push(app);
    app.mount(container);
    await nextTick();

    // No native input in remote mode — the plumbing only exists locally.
    expect(container.querySelector(".hk-file-native")).toBeNull();

    const trigger = container.querySelector<HTMLButtonElement>(".hk-file-trigger")!;
    await trigger.click();
    await nextTick();
    expect(container.querySelector(".file-dialog-stub")).toBeTruthy();

    const confirm = container.querySelector<HTMLButtonElement>(".file-dialog-stub-confirm")!;
    await confirm.click();
    await nextTick();
    expect(model.value).toHaveLength(1);
    expect(model.value[0]!.name).toBe("remote-a.csv");
    expect(model.value[0]!.path).toBe("/data/remote-a.csv");
    // Dialog closed after confirm.
    expect(container.querySelector(".file-dialog-stub")).toBeNull();
  });
});

/** Helpers: the label lives next to the box inside the same mount root. */
function container_labelFor(id: string): HTMLLabelElement | null {
  return document.querySelector<HTMLLabelElement>(`.hk-file-field-label[for="${id}"]`);
}
function container_queryClear(): HTMLButtonElement | null {
  return document.querySelector<HTMLButtonElement>(".hk-file-clear");
}
