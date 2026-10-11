import { describe, expect, it, vi } from "vitest";
import { createApp, defineComponent, h, nextTick, reactive } from "vue";

import { useInfinitePages, type HkPageResultLike } from "./useInfinitePages";

/** Drive a composable from a component scope (watchers + scope dispose
 * only exist inside one). The render is inert — the test talks to the
 * handle the setup returned via a capture ref. */
function withHandle<T>(setup: () => T): { handle: T; unmount: () => void } {
  let captured!: T;
  const App = defineComponent({
    setup() {
      captured = setup();
      return () => h("div");
    },
  });
  const el = document.createElement("div");
  const app = createApp(App);
  app.mount(el);
  return { handle: captured, unmount: () => app.unmount() };
}

type Row = { id: string };

function page(rows: Row[], total: number, has_more: boolean): HkPageResultLike<Row> {
  return { items: rows, total, has_more };
}

function deferred<T>(): { promise: Promise<T>; resolve: (v: T) => void; reject: (e: unknown) => void } {
  let resolve!: (v: T) => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe("useInfinitePages", () => {
  it("fetches page one on mount and lands items/total", async () => {
    const fetcher = vi.fn(async (): Promise<HkPageResultLike<Row>> =>
      page([{ id: "a" }, { id: "b" }], 12, true));
    const { handle } = withHandle(() =>
      useInfinitePages<Row>({ fetcher, pageSize: 2, immediate: true }),
    );
    await vi.waitFor(() => expect(handle.loading.value).toBe(false));
    expect(handle.items.value.map((r) => r.id)).toEqual(["a", "b"]);
    expect(handle.total.value).toBe(12);
    expect(handle.exhausted.value).toBe(false);
    expect(fetcher).toHaveBeenCalledWith(expect.objectContaining({ page: 1, page_size: 2 }));
  });

  it("loadMore appends the next page; server has_more=false exhausts", async () => {
    const fetcher = vi
      .fn(async (q: { page?: number }) => page([{ id: `p${q.page}` }], 2, q?.page === 1))
      .mockImplementationOnce(async () => page([{ id: "a" }], 2, true))
      .mockImplementationOnce(async () => page([{ id: "b" }], 2, false));
    const { handle } = withHandle(() => useInfinitePages<Row>({ fetcher, pageSize: 1 }));
    await vi.waitFor(() => expect(handle.loading.value).toBe(false));
    await handle.loadMore();
    expect(handle.items.value.map((r) => r.id)).toEqual(["a", "b"]);
    expect(handle.exhausted.value).toBe(true);
    // Exhausted: further loadMores never fetch.
    await handle.loadMore();
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it("loadMore while busy is a no-op (single-flight)", async () => {
    const first = deferred<HkPageResultLike<Row>>();
    const fetcher = vi.fn(async () => first.promise);
    const { handle } = withHandle(() => useInfinitePages<Row>({ fetcher, pageSize: 5 }));
    // Page one still in flight.
    await handle.loadMore();
    expect(fetcher).toHaveBeenCalledTimes(1);
    first.resolve(page([{ id: "a" }], 1, false));
    await vi.waitFor(() => expect(handle.loading.value).toBe(false));
  });

  it("dedupes rows whose key was already delivered (shifted page race)", async () => {
    const fetcher = vi
      .fn(async (): Promise<HkPageResultLike<Row>> => page([], 0, false))
      .mockImplementationOnce(async () => page([{ id: "a" }, { id: "b" }], 4, true))
      // A fresh insert shifted the ledger: page two replays "b".
      .mockImplementationOnce(async () => page([{ id: "b" }, { id: "c" }], 4, false));
    const { handle } = withHandle(() =>
      useInfinitePages<Row>({ fetcher, pageSize: 2, key: (r) => r.id }),
    );
    await vi.waitFor(() => expect(handle.loading.value).toBe(false));
    await handle.loadMore();
    expect(handle.items.value.map((r) => r.id)).toEqual(["a", "b", "c"]);
  });

  it("absent has_more falls back to the count heuristic (legacy windows)", async () => {
    // total=5, delivered=2 → not exhausted even though has_more was absent.
    const fetcher = vi
      .fn(async (): Promise<HkPageResultLike<Row>> => ({ items: [], total: 0 }))
      .mockImplementationOnce(async () => ({ items: [{ id: "a" }, { id: "b" }], total: 5 }))
      .mockImplementationOnce(async () => ({ items: [{ id: "c" }, { id: "d" }, { id: "e" }], total: 5 }));
    const { handle } = withHandle(() => useInfinitePages<Row>({ fetcher, pageSize: 3 }));
    await vi.waitFor(() => expect(handle.loading.value).toBe(false));
    expect(handle.exhausted.value).toBe(false);
    await handle.loadMore();
    expect(handle.items.value).toHaveLength(5);
    expect(handle.exhausted.value).toBe(true);
  });

  it("absent has_more and absent total falls back to the short-page heuristic", async () => {
    const fetcher = vi.fn(async (q: Record<string, unknown>) => ({
      items: [{ id: String(q.page) }],
    }));
    const { handle } = withHandle(() => useInfinitePages<Row>({ fetcher, pageSize: 2 }));
    await vi.waitFor(() => expect(handle.loading.value).toBe(false));
    // One row for a two-row window: dry.
    expect(handle.exhausted.value).toBe(true);
  });

  it("a failed later page keeps the delivered rows and retries in place", async () => {
    const fetcher = vi
      .fn(async (): Promise<HkPageResultLike<Row>> => page([], 0, false))
      .mockImplementationOnce(async () => page([{ id: "a" }], 3, true))
      .mockImplementationOnce(async () => {
        throw new Error("boom");
      })
      .mockImplementationOnce(async () => page([{ id: "b" }, { id: "c" }], 3, false));
    const { handle } = withHandle(() => useInfinitePages<Row>({ fetcher, pageSize: 1 }));
    await vi.waitFor(() => expect(handle.loading.value).toBe(false));
    await handle.loadMore();
    expect(handle.error.value).toBe("boom");
    expect(handle.items.value.map((r) => r.id)).toEqual(["a"]);
    // The tail failure is retriable without a full reload.
    await handle.loadMore();
    expect(handle.error.value).toBeNull();
    expect(handle.items.value.map((r) => r.id)).toEqual(["a", "b", "c"]);
  });

  it("a param change triggers a debounced reload from page one", async () => {
    vi.useFakeTimers();
    try {
      const fetcher = vi
      .fn(async (q: { filter?: string; page?: number }) => page([{ id: `${q.filter}-${q.page}` }], 1, false));
      const params = reactive({ filter: "x" });
      const { handle } = withHandle(() =>
        useInfinitePages<Row, { filter: string }>({ fetcher, params: () => params, reloadDebounce: 50 }),
      );
      await vi.advanceTimersByTimeAsync(10);
      await vi.waitFor(() => expect(handle.loading.value).toBe(false));
      expect(handle.items.value.map((r) => r.id)).toEqual(["x-1"]);
      params.filter = "y";
      await vi.advanceTimersByTimeAsync(80);
      await vi.waitFor(() => expect(handle.items.value.map((r) => r.id)).toEqual(["y-1"]));
      // Exactly one fetch per settled query (the debounce coalesced the
      // deep-watch burst).
      expect(fetcher).toHaveBeenCalledTimes(2);
    } finally {
      vi.useRealTimers();
    }
  });

  it("a straggler from a superseded reload is dropped (no out-of-order rows)", async () => {
    const slow = deferred<HkPageResultLike<Row>>();
    const fetcher = vi
      .fn(async (): Promise<HkPageResultLike<Row>> => page([], 0, false))
      .mockImplementationOnce(async () => slow.promise)
      .mockImplementation(async () => page([{ id: "fast" }], 1, false));
    const { handle } = withHandle(() => useInfinitePages<Row>({ fetcher, pageSize: 5 }));
    await nextTick();
    // A second reload overtakes the first.
    void handle.reload();
    await vi.waitFor(() => expect(handle.items.value.map((r) => r.id)).toEqual(["fast"]));
    // The straggler resolves last — it must not land.
    slow.resolve(page([{ id: "slow" }], 1, false));
    await nextTick();
    await nextTick();
    expect(handle.items.value.map((r) => r.id)).toEqual(["fast"]);
  });

  it("a REJECTED straggler from a superseded reload cannot clobber error", async () => {
    const slow = deferred<HkPageResultLike<Row>>();
    const fetcher = vi
      .fn(async (): Promise<HkPageResultLike<Row>> => page([], 0, false))
      .mockImplementationOnce(async () => slow.promise)
      .mockImplementation(async () => page([{ id: "fast" }], 1, false));
    const { handle } = withHandle(() => useInfinitePages<Row>({ fetcher, pageSize: 5 }));
    await nextTick();
    void handle.reload();
    await vi.waitFor(() =>
      expect(handle.items.value.map((r) => r.id)).toEqual(["fast"]),
    );
    expect(handle.error.value).toBeNull();
    // The superseded attempt REJECTS after the newer one succeeded —
    // its failure belongs to a dead query and must not surface (or
    // wrongly block the next loadMore behind a phantom error).
    slow.reject(new Error("stale boom"));
    await nextTick();
    await nextTick();
    expect(handle.error.value).toBeNull();
    expect(handle.items.value.map((r) => r.id)).toEqual(["fast"]);
  });

  it("an overstated total with empty pages still exhausts (no spin loop)", async () => {
    // has_more absent, total claims 99, but the server has nothing
    // behind page one — the empty page must end the walk.
    const fetcher = vi.fn(async (): Promise<HkPageResultLike<Row>> => ({
      items: [],
      total: 99,
    }));
    const { handle } = withHandle(() => useInfinitePages<Row>({ fetcher, pageSize: 10 }));
    await vi.waitFor(() => expect(handle.loading.value).toBe(false));
    expect(handle.exhausted.value).toBe(true);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("a superseded reload's finally never clears the newer reload's loading", async () => {
    const first = deferred<HkPageResultLike<Row>>();
    const second = deferred<HkPageResultLike<Row>>();
    const fetcher = vi
      .fn(async (): Promise<HkPageResultLike<Row>> => page([], 0, false))
      .mockImplementationOnce(async () => first.promise)
      .mockImplementationOnce(async () => second.promise);
    const { handle } = withHandle(() => useInfinitePages<Row>({ fetcher, pageSize: 5 }));
    // Reload #2 overtakes #1; #1 settles FIRST (still superseded).
    void handle.reload();
    // Drain the microtask chain for REAL (an async-mocked fn adds
    // several promise-adoption hops before the superseded finally runs;
    // a couple of nextTicks asserts before it fires and pins nothing).
    const drain = () => new Promise((r) => setTimeout(r, 0));
    first.resolve(page([{ id: "stale" }], 1, false));
    await drain();
    await drain();
    await drain();
    expect(handle.loading.value).toBe(true);
    // #2 lands → only now does the spinner drop (and its rows win).
    second.resolve(page([{ id: "fresh" }], 1, false));
    await vi.waitFor(() => {
      expect(handle.loading.value).toBe(false);
      expect(handle.items.value.map((r) => r.id)).toEqual(["fresh"]);
    });
  });

  it("a loadMore superseded by a reload still clears loadingMore (list stays alive)", async () => {
    const tail = deferred<HkPageResultLike<Row>>();
    const freshPage1 = deferred<HkPageResultLike<Row>>();
    // Page one lands with more behind it.
    const fetcher = vi
      .fn(async (): Promise<HkPageResultLike<Row>> => page([], 0, false))
      .mockImplementationOnce(async () => page([{ id: "a" }], 30, true))
      .mockImplementationOnce(async () => tail.promise)
      .mockImplementationOnce(async () => freshPage1.promise)
      // The post-supersession loadMore (the assertion's point).
      .mockImplementationOnce(async () => page([{ id: "b" }, { id: "c" }], 30, false));
    const { handle } = withHandle(() => useInfinitePages<Row>({ fetcher, pageSize: 1 }));
    await vi.waitFor(() => expect(handle.loading.value).toBe(false));
    // Tail page in flight; a reload (search commit) overtakes it.
    const more = handle.loadMore();
    void handle.reload();
    const drain = () => new Promise((r) => setTimeout(r, 0));
    tail.resolve(page([{ id: "t" }], 30, true));
    freshPage1.resolve(page([{ id: "fresh" }], 30, true));
    await more;
    await drain();
    await drain();
    // loadingMore MUST be back to false — a stranded true would no-op
    // every future loadMore at the single-flight guard and kill the list.
    expect(handle.loadingMore.value).toBe(false);
    expect(handle.items.value.map((r) => r.id)).toEqual(["fresh"]);
    // And the next loadMore really fetches (the page the reload left).
    await handle.loadMore();
    expect(handle.items.value.map((r) => r.id)).toEqual(["fresh", "b", "c"]);
    expect(fetcher).toHaveBeenCalledTimes(4);
  });
});
