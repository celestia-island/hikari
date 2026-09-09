import { afterEach, describe, expect, it, vi } from "vitest";
import { createApp, defineComponent, h, nextTick, ref } from "vue";

import HkFilePickerField from "./HkFilePickerField";

vi.mock("./HkFileBrowserDialog", () => {
  return {
    default: defineComponent({
      name: "HkFileBrowserDialogStub",
      props: {
        modelValue: { type: Boolean, default: false },
        pickDirectory: { type: Boolean, default: false },
      },
      emits: ["update:modelValue", "confirm"],
      setup(props, { emit }) {
        return () =>
          props.modelValue
            ? h(
                "div",
                { class: "picker-dialog-stub" },
                h("button", {
                  class: "picker-dialog-stub-confirm",
                  onClick: () => {
                    // Directory mode hands back the listed folder itself.
                    emit(
                      "confirm",
                      props.pickDirectory
                        ? [{ name: "data", path: "/srv/data" }]
                        : [{ name: "a.csv", path: "/srv/data/a.csv" }],
                    );
                    emit("update:modelValue", false);
                  },
                }),
              )
            : null;
      },
    }),
  };
});

const mounts: ReturnType<typeof createApp>[] = [];
const containers: HTMLElement[] = [];

afterEach(() => {
  for (const app of mounts.splice(0)) app.unmount();
  for (const el of containers.splice(0)) el.remove();
});

interface FieldHandle {
  input: HTMLInputElement;
  browse: HTMLButtonElement;
  model: { value: string };
}

async function mountField(props: Record<string, unknown> = {}): Promise<FieldHandle> {
  const container = document.createElement("div");
  document.body.appendChild(container);
  containers.push(container);

  const model = ref("");
  // An initial value seeds the ref; the wrapper keeps driving the prop.
  if (typeof props.modelValue === "string") {
    model.value = props.modelValue;
    delete props.modelValue;
  }
  const Wrapper = defineComponent({
    setup() {
      return () =>
        h(HkFilePickerField, {
          modelValue: model.value,
          "onUpdate:modelValue": (v: string) => {
            model.value = v;
          },
          ...props,
        });
    },
  });
  const app = createApp(Wrapper);
  mounts.push(app);
  app.mount(container);
  await nextTick();

  return {
    input: container.querySelector<HTMLInputElement>(".hk-file-picker-input")!,
    browse: container.querySelector<HTMLButtonElement>(".hk-file-picker-browse")!,
    model,
  };
}

describe("HkFilePickerField hook backend", () => {
  it("adopts the hook-resolved path and leaves dismissals untouched", async () => {
    const pick = vi.fn(async () => "/opt/shun/target");
    const field = await mountField({ pick });
    expect(field.input.placeholder).toContain("folder");
    await field.browse.click();
    await nextTick();
    expect(pick).toHaveBeenCalledTimes(1);
    expect(field.model.value).toBe("/opt/shun/target");
    expect(field.input.value).toBe("/opt/shun/target");

    // A dismissed picker (null) keeps the current value.
    const dismissed = vi.fn(async () => null);
    const field2 = await mountField({ pick: dismissed, modelValue: "/keep" });
    await field2.browse.click();
    await nextTick();
    expect(field2.model.value).toBe("/keep");
  });

  it("disables the browse button when the hook backend has no hook", async () => {
    const field = await mountField({ backend: "hook" });
    expect(field.browse.disabled).toBe(true);
  });

  it("does not offer browsing at all when disabled", async () => {
    const pick = vi.fn(async () => "/x");
    const field = await mountField({ pick, disabled: true });
    expect(field.browse.disabled).toBe(true);
    field.browse.click();
    expect(pick).not.toHaveBeenCalled();
  });
});

describe("HkFilePickerField remote backend", () => {
  it("auto-selects remote from the adapter and adopts the confirmed folder", async () => {
    const adapter = { list: vi.fn(async (path: string) => ({ path, entries: [] })) };
    const field = await mountField({ adapter });
    // The dialog renders inside the field's mount, not the stub's body.
    await field.browse.click();
    await nextTick();
    const confirm = field.browse
      .closest(".hk-file-picker-field")!
      .querySelector<HTMLButtonElement>(".picker-dialog-stub-confirm")!;
    expect(confirm).toBeTruthy();
    await confirm.click();
    await nextTick();
    expect(field.model.value).toBe("/srv/data");
    expect(
      field.browse
        .closest(".hk-file-picker-field")!
        .querySelector(".picker-dialog-stub"),
    ).toBeNull();
  });
});

describe("HkFilePickerField native backend", () => {
  it("resolves the leaf name through the FS Access directory picker", async () => {
    const showDirectoryPicker = vi.fn(async () => ({ name: "chosen-dir" }));
    Object.defineProperty(window, "showDirectoryPicker", {
      configurable: true,
      value: showDirectoryPicker,
    });
    const field = await mountField({ backend: "native" });
    await field.browse.click();
    await nextTick();
    expect(field.model.value).toBe("chosen-dir");
    Object.defineProperty(window, "showDirectoryPicker", {
      configurable: true,
      value: undefined,
    });
  });

  it("swallows a cancelled native picker without touching the value", async () => {
    const showDirectoryPicker = vi.fn(async () => {
      throw new DOMException("cancel", "AbortError");
    });
    Object.defineProperty(window, "showDirectoryPicker", {
      configurable: true,
      value: showDirectoryPicker,
    });
    const field = await mountField({ backend: "native", modelValue: "/keep" });
    await field.browse.click();
    await nextTick();
    expect(field.model.value).toBe("/keep");
    Object.defineProperty(window, "showDirectoryPicker", {
      configurable: true,
      value: undefined,
    });
  });
});

describe("HkFilePickerField typing", () => {
  it("emits update:modelValue on input", async () => {
    const field = await mountField();
    field.input.value = "D:\\Games\\Demo";
    field.input.dispatchEvent(new Event("input"));
    await nextTick();
    expect(field.model.value).toBe("D:\\Games\\Demo");
  });

  it("shows the file placeholder when directory is off", async () => {
    const field = await mountField({ directory: false });
    expect(field.input.placeholder).toContain("file");
  });
});
