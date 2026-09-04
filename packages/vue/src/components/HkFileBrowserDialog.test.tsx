import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createApp, defineComponent, h, nextTick, ref } from "vue";

import HkFileBrowserDialog from "./HkFileBrowserDialog";
import type { RemoteDirListing, RemoteFsAdapter } from "./filePicker";

/**
 * HkFileBrowserDialog — remote file-browser picker. All behavior is
 * driven through a fake RemoteFsAdapter (vi.fn()); assertions follow the
 * HkModal/HkSelect test conventions: createApp + h() mounts, queries
 * against document.body (HModal teleports there), and a microtask flush
 * between interaction and assertion.
 */

const mounts: ReturnType<typeof createApp>[] = [];

afterEach(() => {
  for (const app of mounts.splice(0)) app.unmount();
  document.body.innerHTML = "";
});

beforeEach(() => {
  // Deterministic clipboard: useClipboard writes via navigator.clipboard
  // and only falls back to execCommand when that throws.
  const writeText = vi.fn(async (_text: string) => {});
  Object.defineProperty(navigator, "clipboard", {
    configurable: true,
    value: { writeText },
  });
});

/** nextTick → macrotask → nextTick: lets adapter promises settle and the
 *  resulting state re-render (the established repo pattern). */
async function flush(): Promise<void> {
  await nextTick();
  await new Promise((resolve) => setTimeout(resolve, 0));
  await nextTick();
}

/** Fake adapter: "/" holds two dirs + two files; every other path one file.
 *  The return keeps `list` as its Mock type so tests can read mock.calls. */
function makeAdapter(
  overrides: Omit<Partial<RemoteFsAdapter>, "list"> = {},
): RemoteFsAdapter & { list: ReturnType<typeof makeListMock> } {
  const list = makeListMock();
  return { list, ...overrides };
}

function makeListMock() {
  return vi.fn(async (path: string): Promise<RemoteDirListing> => ({
    path,
    entries:
      path === "/"
        ? [
            { name: "reports", kind: "dir" as const },
            { name: "alpha", kind: "dir" as const },
            {
              name: "data.csv",
              kind: "file" as const,
              size: 2048,
              modifiedAt: 1700000000000,
            },
            { name: "notes.txt", kind: "file" as const, size: 12 },
          ]
        : [{ name: "inner.csv", kind: "file" as const, size: 5 }],
  }));
}

interface MountOptions {
  accept?: string;
  multiple?: boolean;
  quickLinks?: Array<{ label: string; path: string }>;
  initialPath?: string;
}

function mountDialog(adapter: RemoteFsAdapter, opts: MountOptions = {}) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const open = ref(true);
  const confirmed: Array<
    Array<{ name: string; path: string; size?: number }>
  > = [];
  const openEvents: boolean[] = [];
  const Wrapper = defineComponent({
    setup() {
      return () =>
        h(HkFileBrowserDialog, {
          modelValue: open.value,
          adapter,
          accept: opts.accept,
          multiple: opts.multiple ?? false,
          quickLinks: opts.quickLinks ?? [],
          initialPath: opts.initialPath ?? "/",
          "onUpdate:modelValue": (v: boolean) => {
            openEvents.push(v);
            open.value = v;
          },
          onConfirm: (files: Array<{ name: string; path: string; size?: number }>) => {
            confirmed.push(files);
          },
        });
    },
  });
  const app = createApp(Wrapper);
  app.mount(container);
  mounts.push(app);
  return { open, confirmed, openEvents, adapter };
}

function q<T extends Element = Element>(selector: string): T {
  const el = document.body.querySelector<T>(selector);
  expect(el, `${selector} renders`).toBeTruthy();
  return el!;
}

function qa<T extends Element = Element>(selector: string): T[] {
  return [...document.body.querySelectorAll<T>(selector)];
}

function rowNames(): string[] {
  return qa(".hk-file-browser-row .hk-file-browser-col-name").map(
    (el) => el.textContent ?? "",
  );
}

function tool(op: string): HTMLButtonElement {
  return q<HTMLButtonElement>(`.hk-file-browser-tool[data-op="${op}"]`);
}

async function clickRow(name: string): Promise<void> {
  const row = qa<HTMLButtonElement>(".hk-file-browser-row").find(
    (r) => r.querySelector(".hk-file-browser-col-name")?.textContent === name,
  );
  expect(row, `row ${name} renders`).toBeTruthy();
  row!.click();
  await flush();
}

async function chooseFilter(label: string): Promise<void> {
  q<HTMLButtonElement>(".hk-select-trigger").click();
  await flush();
  const option = qa<HTMLElement>(".hk-select-option").find(
    (o) => o.textContent?.trim() === label,
  );
  expect(option, `filter option ${label} renders`).toBeTruthy();
  option!.click();
  await flush();
}

describe("HkFileBrowserDialog listing", () => {
  it("lists the initial path on open with folders-first ordering", async () => {
    const adapter = makeAdapter();
    mountDialog(adapter);
    await flush();

    expect(adapter.list).toHaveBeenCalledTimes(1);
    expect(adapter.list).toHaveBeenCalledWith("/");
    // Dirs first (name asc), then files (name asc).
    expect(rowNames()).toEqual(["alpha", "reports", "data.csv", "notes.txt"]);
    // Human-readable size cell for the 2048-byte file.
    const csvRow = qa<HTMLButtonElement>(".hk-file-browser-row").find(
      (r) => r.querySelector(".hk-file-browser-col-name")?.textContent === "data.csv",
    );
    expect(
      csvRow?.querySelector(".hk-file-browser-col-size")?.textContent,
    ).toContain("2.0 KB");
  });
});

describe("HkFileBrowserDialog path bar", () => {
  it("navigates through breadcrumb segments and copies the current path", async () => {
    const adapter = makeAdapter();
    mountDialog(adapter);
    await flush();

    // Enter "reports": breadcrumb now shows / + reports (current).
    await clickRow("reports");
    expect(adapter.list).toHaveBeenCalledWith("/reports");

    // Clicking the root segment jumps back and re-lists "/".
    const rootCrumb = qa<HTMLButtonElement>(
      ".hk-file-browser-crumbs button.hk-file-browser-crumb",
    ).find((el) => el.textContent?.trim() === "/");
    expect(rootCrumb, "root breadcrumb renders").toBeTruthy();
    rootCrumb!.click();
    await flush();
    expect(adapter.list).toHaveBeenLastCalledWith("/");

    // Copy-path pushes the CURRENT path through navigator.clipboard.
    await clickRow("reports");
    q<HTMLButtonElement>(".hk-file-browser-copy-path").click();
    await flush();
    const writeText = (navigator.clipboard as unknown as {
      writeText: ReturnType<typeof vi.fn>;
    }).writeText;
    expect(writeText).toHaveBeenCalledWith("/reports");
  });
});

describe("HkFileBrowserDialog selection and confirm", () => {
  it("disables confirm until a file is selected, then emits mapped files and closes", async () => {
    const adapter = makeAdapter();
    const state = mountDialog(adapter);
    await flush();

    const confirmBtn = q<HTMLButtonElement>(".hk-file-browser-confirm");
    expect(confirmBtn.disabled).toBe(true);

    // Dir clicks navigate (never select)…
    await clickRow("reports");
    expect(adapter.list).toHaveBeenCalledWith("/reports");
    expect(state.confirmed).toEqual([]);

    // …file clicks select.
    await clickRow("inner.csv");
    const row = qa<HTMLButtonElement>(".hk-file-browser-row").find(
      (r) => r.querySelector(".hk-file-browser-col-name")?.textContent === "inner.csv",
    );
    expect(row?.hasAttribute("data-selected")).toBe(true);
    expect(confirmBtn.disabled).toBe(false);

    confirmBtn.click();
    await flush();
    expect(state.confirmed).toEqual([
      [{ name: "inner.csv", path: "/reports/inner.csv", size: 5 }],
    ]);
    expect(state.openEvents).toEqual([false]);
    expect(state.open.value).toBe(false);
  });

  it("prunes vanished selections when the listing refreshes", async () => {
    const entries: Array<{ name: string; kind: "file"; size: number }> = [
      { name: "data.csv", kind: "file", size: 10 },
    ];
    const adapter: RemoteFsAdapter = {
      list: vi.fn(async (path: string) => ({ path, entries: [...entries] })),
    };
    const state = mountDialog(adapter);
    await flush();

    await clickRow("data.csv");
    const confirmBtn = q<HTMLButtonElement>(".hk-file-browser-confirm");
    expect(confirmBtn.disabled).toBe(false);

    // The file vanishes server-side; the next refresh must drop the dead
    // selection instead of leaving confirm armed over nothing.
    entries.length = 0;
    q<HTMLButtonElement>('button[aria-label="Refresh"]').click();
    await flush();
    expect(rowNames()).toEqual([]);
    expect(confirmBtn.disabled).toBe(true);
  });

  it("drops hidden selections when the type filter changes", async () => {
    const adapter = makeAdapter();
    const state = mountDialog(adapter, { accept: ".csv,.txt", multiple: true });
    await flush();

    await clickRow("data.csv");
    await clickRow("notes.txt");
    await chooseFilter(".csv");
    // notes.txt is hidden by the filter and must not ride along invisibly.
    const confirmBtn = q<HTMLButtonElement>(".hk-file-browser-confirm");
    confirmBtn.click();
    await flush();
    expect(state.confirmed).toEqual([
      [{ name: "data.csv", path: "/data.csv", size: 2048 }],
    ]);
  });

  it("confirms immediately on file double-click", async () => {
    const adapter = makeAdapter();
    const state = mountDialog(adapter);
    await flush();

    const row = qa<HTMLButtonElement>(".hk-file-browser-row").find(
      (r) => r.querySelector(".hk-file-browser-col-name")?.textContent === "data.csv",
    );
    row!.dispatchEvent(new MouseEvent("dblclick", { bubbles: true }));
    await flush();

    expect(state.confirmed).toEqual([
      [{ name: "data.csv", path: "/data.csv", size: 2048 }],
    ]);
  });
});

describe("HkFileBrowserDialog type filter", () => {
  it("filters files by the accept extensions and restores with All", async () => {
    const adapter = makeAdapter();
    mountDialog(adapter, { accept: ".csv,.json" });
    await flush();

    // Default "All": everything visible.
    expect(rowNames()).toContain("notes.txt");
    expect(rowNames()).toContain("data.csv");

    await chooseFilter(".csv");
    expect(rowNames()).toEqual(["alpha", "reports", "data.csv"]);

    await chooseFilter("All files");
    expect(rowNames()).toEqual(["alpha", "reports", "data.csv", "notes.txt"]);
  });
});

describe("HkFileBrowserDialog toolbar", () => {
  it("gates cut/copy/rename on selection and runs copy→paste through adapter.copy", async () => {
    const copy = vi.fn(async (_fromPath: string, _toDir: string) => {});
    const move = vi.fn(async (_fromPath: string, _toDir: string) => {});
    const rename = vi.fn(
      async (_path: string, _from: string, _toName: string) => {},
    );
    const adapter = makeAdapter({ copy, move, rename });
    mountDialog(adapter);
    await flush();

    // Nothing selected: ops locked (refresh is always live).
    expect(tool("cut").disabled).toBe(true);
    expect(tool("copy").disabled).toBe(true);
    expect(tool("paste").disabled).toBe(true);
    expect(tool("rename").disabled).toBe(true);
    expect(tool("refresh").disabled).toBe(false);

    await clickRow("data.csv");
    expect(tool("cut").disabled).toBe(false);
    expect(tool("copy").disabled).toBe(false);
    expect(tool("rename").disabled).toBe(false);

    // Stage a copy, move into "reports", paste there.
    tool("copy").click();
    await flush();
    expect(tool("paste").disabled).toBe(false);

    await clickRow("reports");
    expect(adapter.list).toHaveBeenCalledWith("/reports");
    const listsBefore = adapter.list.mock.calls.length;

    tool("paste").click();
    await flush();
    expect(copy).toHaveBeenCalledTimes(1);
    expect(copy).toHaveBeenCalledWith("/data.csv", "/reports");
    // Paste re-lists the current directory.
    expect(adapter.list).toHaveBeenCalledTimes(listsBefore + 1);
    expect(adapter.list).toHaveBeenLastCalledWith("/reports");
  });

  it("renames through the inline prompt and re-lists", async () => {
    const rename = vi.fn(
      async (_path: string, _from: string, _toName: string) => {},
    );
    const adapter = makeAdapter({ rename });
    mountDialog(adapter);
    await flush();

    await clickRow("reports"); // → /reports
    await clickRow("inner.csv");
    tool("rename").click();
    await flush();

    const input = q<HTMLInputElement>(".hk-file-browser-rename-input");
    expect(input.value).toBe("inner.csv");

    // Empty name is rejected inline, adapter untouched.
    input.value = "   ";
    input.dispatchEvent(new Event("input", { bubbles: true }));
    await flush();
    q<HTMLButtonElement>(".hk-file-browser-rename-confirm").click();
    await flush();
    expect(rename).not.toHaveBeenCalled();
    expect(
      document.body.querySelector(".hk-file-browser-rename-error"),
    ).toBeTruthy();

    // A real name calls rename(path, fullPath, toName) and re-lists.
    input.value = "renamed.csv";
    input.dispatchEvent(new Event("input", { bubbles: true }));
    await flush();
    q<HTMLButtonElement>(".hk-file-browser-rename-confirm").click();
    await flush();
    expect(rename).toHaveBeenCalledTimes(1);
    expect(rename).toHaveBeenCalledWith(
      "/reports",
      "/reports/inner.csv",
      "renamed.csv",
    );
    expect(adapter.list).toHaveBeenLastCalledWith("/reports");
    expect(
      document.body.querySelector(".hk-file-browser-rename-input"),
    ).toBeNull();
  });
});

describe("HkFileBrowserDialog layout toggle", () => {
  it("flips the entries area between list and grid", async () => {
    const adapter = makeAdapter();
    mountDialog(adapter);
    await flush();

    const entries = q<HTMLElement>(".hk-file-browser-entries");
    expect(entries.dataset.layout).toBe("list");

    q<HTMLButtonElement>('.hk-file-browser-layout-btn[data-layout="grid"]').click();
    await flush();
    expect(q<HTMLElement>(".hk-file-browser-entries").dataset.layout).toBe("grid");
    expect(
      document.body.querySelector(".hk-file-browser-grid"),
    ).toBeTruthy();

    q<HTMLButtonElement>('.hk-file-browser-layout-btn[data-layout="list"]').click();
    await flush();
    expect(q<HTMLElement>(".hk-file-browser-entries").dataset.layout).toBe("list");
  });
});

describe("HkFileBrowserDialog load states", () => {
  it("shows the empty hint for a bare directory", async () => {
    const adapter: RemoteFsAdapter = {
      list: vi.fn(async (path: string) => ({ path, entries: [] })),
    };
    mountDialog(adapter, { initialPath: "/empty" });
    await flush();
    expect(document.body.querySelector(".hk-file-browser-empty")).toBeTruthy();
    expect(qa(".hk-file-browser-row")).toEqual([]);
  });

  it("surfaces lister errors as an inline band and retries", async () => {
    const adapter = makeAdapter();
    adapter.list = vi
      .fn<RemoteFsAdapter["list"]>()
      .mockRejectedValueOnce(new Error("boom"))
      .mockResolvedValue({
        path: "/",
        entries: [{ name: "ok.txt", kind: "file" as const, size: 1 }],
      });
    mountDialog(adapter);
    await flush();

    const band = document.body.querySelector(".hk-file-browser-error");
    expect(band).toBeTruthy();
    expect(band?.textContent).toContain("boom");
    expect(document.body.querySelector(".hk-file-browser-empty")).toBeNull();

    q<HTMLButtonElement>(".hk-file-browser-retry").click();
    await flush();
    expect(document.body.querySelector(".hk-file-browser-error")).toBeNull();
    expect(rowNames()).toEqual(["ok.txt"]);
  });
});
