import { afterEach, describe, expect, it } from "vitest";
import { createApp, defineComponent, h, nextTick, ref } from "vue";

import HkModal from "./HkModal";
import { closeAll } from "../runtime/useOverlay";

const mounts: ReturnType<typeof createApp>[] = [];
const containers: HTMLElement[] = [];

afterEach(async () => {
  for (const app of mounts.splice(0)) app.unmount();
  for (const el of containers.splice(0)) el.remove();
});

describe("HkModal overlay integration", () => {
  it("closeAll() closes an open closable modal through its update:modelValue", async () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    containers.push(container);

    const open = ref(true);
    const emitted: boolean[] = [];
    const Wrapper = defineComponent({
      setup() {
        return () =>
          h(HkModal, {
            modelValue: open.value,
            closable: true,
            "onUpdate:modelValue": (v: boolean) => { emitted.push(v); open.value = v; },
          }, { default: () => h("div", "content") });
      },
    });
    const app = createApp(Wrapper);
    mounts.push(app);
    app.mount(container);
    await nextTick();

    closeAll();
    await nextTick();
    expect(emitted).toEqual([false]);
  });

  it("closeAll() leaves a non-closable modal alone", async () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    containers.push(container);

    const open = ref(true);
    const emitted: boolean[] = [];
    const Wrapper = defineComponent({
      setup() {
        return () =>
          h(HkModal, {
            modelValue: open.value,
            closable: false,
            "onUpdate:modelValue": (v: boolean) => { emitted.push(v); open.value = v; },
          }, { default: () => h("div", "content") });
      },
    });
    const app = createApp(Wrapper);
    mounts.push(app);
    app.mount(container);
    await nextTick();

    closeAll();
    await nextTick();
    expect(emitted).toEqual([]);
  });
});
