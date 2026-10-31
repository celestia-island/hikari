import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createApp, h, nextTick, reactive, type App } from "vue";

import type { StarSystemBodyInput } from "../scene3d/holographicFleetSpec";
import HkStarSystem from "./HkStarSystem";

const mocks = vi.hoisted(() => ({
  engine: {},
  ready: undefined as undefined | (() => void),
  build: vi.fn(),
  handle: {
    update: vi.fn(),
    setSelected: vi.fn(),
    focusBody: vi.fn(),
    frameFleet: vi.fn(() => true),
    dispose: vi.fn(),
  },
}));

vi.mock("../scene3d/holographicFleetScene", () => ({
  buildFleetScene: mocks.build.mockImplementation(() => mocks.handle),
}));

vi.mock("./HkBoard3D", async () => {
  const { defineComponent, h: vueH, onMounted } = await import("vue");
  return {
    default: defineComponent({
      name: "HkBoard3D",
      emits: ["ready", "objectClick"],
      setup(_props, { emit, slots }) {
        mocks.ready = () => emit("ready", mocks.engine);
        onMounted(() => mocks.ready?.());
        return () => vueH("div", { class: "board-stub" }, slots.default?.());
      },
    }),
  };
});

const BODIES: readonly StarSystemBodyInput[] = [
  {
    id: "hub-a", label: "Hub A", role: "star", status: "Online",
    online: true, endpointCount: 2, detail: "2 endpoints",
  },
  {
    id: "node-1", label: "Node One", role: "planet", status: "Offline",
    online: false, endpointCount: 0,
  },
];

const mounts: Array<{ app: App; container: HTMLElement }> = [];

async function settle(): Promise<void> {
  await nextTick();
  await new Promise((resolve) => setTimeout(resolve, 0));
  await nextTick();
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.engine = {};
  mocks.ready = undefined;
});

afterEach(() => {
  for (const { app, container } of mounts.splice(0)) {
    app.unmount();
    container.remove();
  }
});

function mountSystem(initialSelection: string | null = "node-1") {
  const state = reactive({
    selectedId: initialSelection as string | null,
    bodies: [...BODIES],
  });
  const emitted: Array<string | null> = [];
  const container = document.createElement("div");
  document.body.appendChild(container);
  const app = createApp({
    render: () => h(HkStarSystem, {
      bodies: state.bodies,
      selectedId: state.selectedId,
      "onUpdate:selectedId": (id: string | null) => emitted.push(id),
    }),
  });
  app.mount(container);
  mounts.push({ app, container });
  return { state, emitted };
}

describe("HkStarSystem controlled scene lifecycle", () => {
  it("passes real body data and restores selection without flying", async () => {
    mountSystem("node-1");
    await settle();

    expect(mocks.handle.update).toHaveBeenCalled();
    const [spec, offline] = mocks.handle.update.mock.calls[0]!;
    expect(spec.stars[0]).toMatchObject({
      id: "hub-a", label: "Hub A", status: "Online", detail: "2 endpoints",
    });
    expect(spec.planets[0]).toMatchObject({
      id: "node-1", label: "Node One", status: "Offline", online: false,
    });
    expect(offline).toEqual({ "hub-a": false, "node-1": true });
    expect(mocks.handle.setSelected).toHaveBeenCalledWith("node-1");
    expect(mocks.handle.focusBody).not.toHaveBeenCalled();
  });

  it("focuses an explicit controlled selection change", async () => {
    const { state } = mountSystem("node-1");
    await settle();
    state.selectedId = "hub-a";
    await settle();
    expect(mocks.handle.focusBody).toHaveBeenCalledWith("hub-a");

    state.selectedId = null;
    await settle();
    expect(mocks.handle.setSelected).toHaveBeenCalledWith(null);
    expect(mocks.handle.frameFleet).toHaveBeenCalledWith(600);
  });

  it("updates before clearing a selection whose body disappeared", async () => {
    const { state, emitted } = mountSystem("hub-a");
    await settle();
    mocks.handle.update.mockClear();
    mocks.handle.setSelected.mockClear();

    state.bodies = state.bodies.filter((body) => body.id !== "hub-a");
    await settle();
    expect(mocks.handle.update).toHaveBeenCalledTimes(1);
    expect(mocks.handle.setSelected).toHaveBeenCalledWith(null);
    expect(emitted).toContain(null);
    expect(mocks.handle.update.mock.invocationCallOrder[0])
      .toBeLessThan(mocks.handle.setSelected.mock.invocationCallOrder[0]!);
  });

  it("disposes engine A before restoring the selection on engine B", async () => {
    mountSystem("node-1");
    await settle();
    mocks.build.mockClear();
    mocks.handle.dispose.mockClear();
    mocks.handle.focusBody.mockClear();

    mocks.engine = {};
    mocks.ready?.();
    await settle();
    expect(mocks.handle.dispose).toHaveBeenCalledTimes(1);
    expect(mocks.build).toHaveBeenCalledTimes(1);
    expect(mocks.handle.dispose.mock.invocationCallOrder[0])
      .toBeLessThan(mocks.build.mock.invocationCallOrder[0]!);
    expect(mocks.handle.setSelected).toHaveBeenCalledWith("node-1");
    expect(mocks.handle.focusBody).not.toHaveBeenCalled();
  });

  it("disposes the builder on unmount", async () => {
    mountSystem();
    await settle();
    const [{ app }] = mounts;
    app.unmount();
    mounts.splice(0, 1);
    expect(mocks.handle.dispose).toHaveBeenCalledTimes(1);
  });
});
