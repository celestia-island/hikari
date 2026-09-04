import { afterEach, describe, expect, it } from "vitest";
import { createApp, defineComponent, h, nextTick, ref } from "vue";

import HkInput from "./HkInput";

const mounts: ReturnType<typeof createApp>[] = [];
const containers: HTMLElement[] = [];

afterEach(async () => {
  for (const app of mounts.splice(0)) app.unmount();
  for (const el of containers.splice(0)) el.remove();
});

interface FieldHandle {
  wrapper: HTMLElement;
  label: HTMLLabelElement | null;
  field: HTMLInputElement | HTMLTextAreaElement;
}

/** Mount HkInput with the given props and grab label + field element. */
async function mountField(
  props: Record<string, unknown>,
  textarea = false,
): Promise<FieldHandle> {
  const container = document.createElement("div");
  document.body.appendChild(container);
  containers.push(container);

  const model = ref("");
  const Wrapper = defineComponent({
    setup() {
      return () =>
        h(HkInput, {
          modelValue: model.value,
          "onUpdate:modelValue": (v: string) => { model.value = v; },
          ...props,
        });
    },
  });
  const app = createApp(Wrapper);
  mounts.push(app);
  app.mount(container);
  await nextTick();

  const wrapper = container.querySelector<HTMLElement>(".hk-input-wrapper")!;
  const field = (textarea
    ? wrapper.querySelector("textarea")
    : wrapper.querySelector("input")) as
    HTMLInputElement | HTMLTextAreaElement;
  return { wrapper, label: wrapper.querySelector("label"), field };
}

describe("HkInput label association", () => {
  it("binds the rendered label to the field without caller effort", async () => {
    const { label, field } = await mountField({ label: "Workspace name" });
    expect(label).toBeTruthy();
    expect(label!.getAttribute("for")).toBe(field.id);
    expect(field.id).not.toBe("");
  });

  it("generates unique ids to sibling fields in the same app", async () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    containers.push(container);

    const Wrapper = defineComponent({
      setup() {
        return () => [
          h(HkInput, { modelValue: "", label: "One" }),
          h(HkInput, { modelValue: "", label: "Two" }),
        ];
      },
    });
    const app = createApp(Wrapper);
    mounts.push(app);
    app.mount(container);
    await nextTick();

    const fields = container.querySelectorAll<HTMLInputElement>(".hk-input-element");
    expect(fields).toHaveLength(2);
    expect(fields[0]!.id).not.toBe("");
    expect(fields[0]!.id).not.toBe(fields[1]!.id);
    const labels = container.querySelectorAll<HTMLLabelElement>(".hk-input-label");
    expect(labels[0]!.getAttribute("for")).toBe(fields[0]!.id);
    expect(labels[1]!.getAttribute("for")).toBe(fields[1]!.id);
  });

  it("honors an explicit id prop over the generated one", async () => {
    const { label, field } = await mountField({ label: "Name", id: "given-id" });
    expect(field.id).toBe("given-id");
    expect(label!.getAttribute("for")).toBe("given-id");
  });

  it("associates textarea fields the same way", async () => {
    const { label, field } = await mountField(
      { label: "Comment", type: "textarea" },
      true,
    );
    expect(field.tagName).toBe("TEXTAREA");
    expect(label!.getAttribute("for")).toBe(field.id);
  });

  it("omits spellcheck entirely when the prop is undefined", async () => {
    const { field } = await mountField({ label: "Default" });
    expect(field.hasAttribute("spellcheck")).toBe(false);
  });

  it("renders spellcheck={false} as an explicit attribute", async () => {
    const { field } = await mountField({ label: "Literal", spellcheck: false });
    expect(field.getAttribute("spellcheck")).toBe("false");
  });
});
