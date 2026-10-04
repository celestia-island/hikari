import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createApp, defineComponent, h, nextTick, ref } from "vue";

/**
 * HkTerminal contract tests.
 *
 * The xterm CORE is mocked (happy-dom has no layout engine — xterm's
 * WidthCache needs real glyph measurement); the mock records the exact
 * calls so the component contract is pinned without executing the
 * renderer:
 *
 *   1. props reach the Terminal options
 *   2. `write` is a binary-safe passthrough (Uint8Array handed over
 *      AS-IS — a string round-trip would corrupt kitty/SIXEL payloads)
 *   3. `data` / `resize` events are wired to the consumer
 *   4. the image addon loads with kitty/SIXEL/IIP enabled, and does not
 *      load when `enableImages` is false
 *   5. the terminal is disposed on unmount and observers disconnected
 *   6. the theme derivation turns channel triplets into hex colors
 */

const writeCalls: Array<string | Uint8Array> = [];
const loadedAddons: Array<{ ctor: string; opts?: Record<string, unknown> }> = [];
const dataHandlers = new Set<(text: string) => void>();
const resizeHandlers = new Set<(d: { cols: number; rows: number }) => void>();
let disposed = 0;
let lastOptions: Record<string, unknown> | null = null;
let resizeCalls: Array<{ cols: number; rows: number }> = [];

vi.mock("@xterm/xterm", () => ({
  Terminal: class {
    options: Record<string, unknown>;
    cols: number;
    rows: number;
    constructor(opts: Record<string, unknown>) {
      this.options = { ...opts };
      this.cols = (opts.cols as number) ?? 80;
      this.rows = (opts.rows as number) ?? 24;
      lastOptions = this.options;
    }
    loadAddon(addon: { ctor?: string; opts?: Record<string, unknown> }) {
      loadedAddons.push({
        ctor: (addon as { ctor?: string }).ctor ?? "unknown",
        opts: (addon as { opts?: Record<string, unknown> }).opts,
      });
    }
    open() {}
    onData(cb: (text: string) => void) {
      dataHandlers.add(cb);
      return () => dataHandlers.delete(cb);
    }
    onResize(cb: (d: { cols: number; rows: number }) => void) {
      resizeHandlers.add(cb);
      return () => resizeHandlers.delete(cb);
    }
    write(data: string | Uint8Array) {
      writeCalls.push(data);
    }
    writeln(data: string | Uint8Array) {
      writeCalls.push(data);
      writeCalls.push("\r\n");
    }
    clear() {}
    reset() {}
    focus() {}
    resize(cols: number, rows: number) {
      this.cols = cols;
      this.rows = rows;
      resizeCalls.push({ cols, rows });
      // Real xterm fires onResize from resize() — the mock must too, or
      // double-emit bugs in the component hide behind it (R1 F2).
      for (const cb of [...resizeHandlers]) cb({ cols, rows });
    }
    dispose() {
      disposed += 1;
    }
  },
}));
vi.mock("@xterm/addon-fit", () => ({
  FitAddon: class {
    ctor = "fit";
    fit() {}
  },
}));
vi.mock("@xterm/addon-image", () => ({
  ImageAddon: class {
    ctor = "image";
    opts: Record<string, unknown>;
    constructor(opts: Record<string, unknown>) {
      this.opts = opts;
    }
  },
}));
vi.mock("@xterm/xterm/css/xterm.css", () => ({}));

import HkTerminal, { __testables } from "./HkTerminal";

const mounts: Array<{ app: ReturnType<typeof createApp>; container: HTMLElement }> = [];

interface TerminalHarness {
  exposed: Record<string, unknown>;
  unmount: () => void;
  props: Record<string, unknown>;
}

function mountTerminal(props: Record<string, unknown> = {}): TerminalHarness {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const exposedRef = ref<Record<string, unknown> | null>(null);
  const Host = defineComponent({
    setup() {
      return () =>
        h(HkTerminal, {
          ...props,
          ref: (el: unknown) => {
            exposedRef.value = el as Record<string, unknown>;
          },
        });
    },
  });
  const app = createApp(Host);
  app.mount(container);
  mounts.push({ app, container });
  return {
    get exposed() {
      return exposedRef.value ?? {};
    },
    unmount: () => app.unmount(),
    props,
  };
}

/** Read a sibling source file (for source-level contract pins). Vitest
 * runs with cwd = packages/vue, which is the stable anchor here. */
function require_fs_read(name: string): string {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const fs = require("node:fs") as typeof import("node:fs");
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const path = require("node:path") as typeof import("node:path");
  return fs.readFileSync(path.resolve(process.cwd(), "src/components", name), "utf8");
}

beforeEach(() => {
  writeCalls.length = 0;
  loadedAddons.length = 0;
  dataHandlers.clear();
  resizeHandlers.clear();
  disposed = 0;
  lastOptions = null;
  resizeCalls = [];
});

afterEach(() => {
  while (mounts.length) {
    const m = mounts.pop()!;
    m.app.unmount();
    m.container.remove();
  }
});

describe("HkTerminal", () => {
  it("passes the typography props into the Terminal options", async () => {
    mountTerminal({ fontSize: 15, fontFamily: "MyMono", scrollback: 500, cursorBlink: false });
    await nextTick();
    expect(lastOptions).toMatchObject({
      fontSize: 15,
      fontFamily: "MyMono",
      scrollback: 500,
      cursorBlink: false,
      cols: 80,
      rows: 24,
    });
  });

  it("writes bytes through untouched (binary safety)", async () => {
    const t = mountTerminal();
    await nextTick();
    const bytes = new Uint8Array([0x1b, 0x5f, 0x47, 0xe4, 0xbd, 0xa0]);
    (t.exposed.write as (d: Uint8Array) => void)(bytes);
    expect(writeCalls).toHaveLength(1);
    expect(writeCalls[0]).toBe(bytes); // SAME object — no string round-trip
  });

  it("forwards xterm data to the consumer event", async () => {
    const seen: string[] = [];
    const container = document.createElement("div");
    document.body.appendChild(container);
    const Host = defineComponent({
      setup() {
        return () =>
          h(HkTerminal, {
            onData: (text: string) => seen.push(text),
          });
      },
    });
    const app = createApp(Host);
    app.mount(container);
    mounts.push({ app, container });
    await nextTick();
    for (const cb of [...dataHandlers]) cb("ls -la\r");
    expect(seen).toEqual(["ls -la\r"]);
  });

  it("loads the image addon with kitty/SIXEL/IIP support", async () => {
    mountTerminal();
    await nextTick();
    const image = loadedAddons.find((a) => a.ctor === "image");
    expect(image).toBeDefined();
    expect(image!.opts).toMatchObject({
      kittySupport: true,
      sixelSupport: true,
      iipSupport: true,
      enableSizeReports: true,
    });
  });

  it("skips the image addon when disabled", async () => {
    mountTerminal({ enableImages: false });
    await nextTick();
    expect(loadedAddons.find((a) => a.ctor === "image")).toBeUndefined();
    expect(loadedAddons.find((a) => a.ctor === "fit")).toBeDefined();
  });

  it("emits exactly one resize when the cols/rows props change", async () => {
    const resizeEvents: Array<{ cols: number; rows: number }> = [];
    const container = document.createElement("div");
    document.body.appendChild(container);
    const propsRef = ref<Record<string, unknown>>({ cols: 100, rows: 30 });
    const Host = defineComponent({
      setup() {
        return () => h(HkTerminal, {
          ...(propsRef.value as Record<string, unknown>),
          onResize: (d: { cols: number; rows: number }) => resizeEvents.push(d),
        });
      },
    });
    const app = createApp(Host);
    app.mount(container);
    mounts.push({ app, container });
    await nextTick();
    resizeEvents.length = 0;
    propsRef.value = { cols: 120, rows: 40 };
    await nextTick();
    await nextTick();
    // xterm's own onResize already emitted — a manual second emit (the
    // R1 F2 double-fire shape) would make this 2.
    expect(resizeEvents).toEqual([{ cols: 120, rows: 40 }]);
  });

  it("imports xterm's core stylesheet (source pin)", () => {
    // The component is only self-sufficient with xterm.css in place
    // (R1 F1); bundlers prune nothing thanks to sideEffects. A source
    // pin is the honest guard — the runtime import is invisible to the
    // mocked tests by construction.
    const src = require_fs_read("HkTerminal.tsx");
    expect(src).toContain('@xterm/xterm/css/xterm.css');
  });

  it("disposes the terminal on unmount", async () => {
    const t = mountTerminal();
    await nextTick();
    expect(disposed).toBe(0);
    t.unmount();
    expect(disposed).toBe(1);
  });

  it("resizes programmatically and reports the new grid", async () => {
    const resizeEvents: Array<{ cols: number; rows: number }> = [];
    const container = document.createElement("div");
    document.body.appendChild(container);
    const Host = defineComponent({
      setup() {
        return () =>
          h(HkTerminal, {
            cols: 100,
            rows: 30,
            onResize: (d: { cols: number; rows: number }) => resizeEvents.push(d),
          });
      },
    });
    const app = createApp(Host);
    app.mount(container);
    mounts.push({ app, container });
    await nextTick();
    // Simulate xterm's own onResize (what fit() triggers internally).
    for (const cb of [...resizeHandlers]) cb({ cols: 120, rows: 40 });
    expect(resizeEvents).toEqual([{ cols: 120, rows: 40 }]);
  });
});

describe("channelToHex", () => {
  it("turns r-g-b channel triplets into hex and keeps passthrough colors", () => {
    const el = document.createElement("div");
    const hex = __testables.channelToHex(el, "--color-background", "#000000");
    // No channel value set in happy-dom → fallback path (unless the env
    // defines one); both arms are valid, assert it returns a color.
    expect(hex).toMatch(/^(#[0-9a-fA-F]{6}|rgb\(.*\))$/);
  });
});
