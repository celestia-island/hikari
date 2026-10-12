import { computed, getCurrentScope, onScopeDispose, ref, watch, type ComputedRef, type Ref } from "vue";

/**
 * The family's unified page contract for paginated list RPCs (the wire
 * half lives server-side; both sides spell these exact keys).
 *
 * Requests ride `page`/`page_size` (1-based index, items per page) as
 * OPTIONAL fields on the RPC's existing params object — the scaffold
 * never asks a host to change a method name or wrap its payload.
 *
 * Responses answer with the envelope below. `has_more` is
 * server-authoritative (the handler fetched its window and KNOWS
 * whether another one exists); `total` is the match count for progress
 * readouts ("23 / 812") and may be omitted when the backend cannot
 * count cheaply — `has_more` alone still drives the tail.
 */
export interface HkPageQuery {
  /** 1-based page index. */
  page: number;
  /** Items per page; the server clamps to its own ceiling. */
  page_size: number;
}

/** The loose response every fetcher may answer with; the machine
 * normalizes it into the strict shape (see {@link HkPageResult}). */
export type HkPageResultLike<T> =
  | HkPageResult<T>
  | {
      items: T[];
      total?: number | null;
      has_more?: boolean;
      [extra: string]: unknown;
    };

/** The strict envelope the machine keeps internally. `has_more` is
 * `undefined` when the server said nothing (legacy offset windows) —
 * the machine then falls back to the count/short-page heuristics. */
export interface HkPageResult<T> {
  items: T[];
  /** Match count when the server counted; null when unknown. */
  total: number | null;
  /** True/false when the server said so; undefined when it did not. */
  has_more?: boolean;
}

export interface InfinitePagesOptions<T, P extends Record<string, unknown>> {
  /** Fetch one page. Receives the page window merged with the current
   * extra params. Rejections land in `error` (rows already delivered
   * stay on screen — the stale-error dialect). */
  fetcher: (query: P & HkPageQuery) => Promise<HkPageResultLike<T>>;
  /** Extra request params, read live before every fetch (filters,
   * search keyword, …). A deep change triggers a debounced reload. */
  params?: () => P;
  /** Items per page (default 50). */
  pageSize?: number;
  /** Row identity for cross-page dedupe. Rows whose key was already
   * delivered are dropped (earlier pages win), which is what keeps an
   * append-heavy ledger from duplicating a row when a fresh insert
   * shifts later pages down. Default: no dedupe (append verbatim). */
  key?: (row: T) => string | number;
  /** Fetch the first page on mount (default true). */
  immediate?: boolean;
  /** Debounce for param-change reloads in ms (default 200). */
  reloadDebounce?: number;
  /** Keep the delivered rows on screen while a reload is in flight
   * (default false — a changed query's old rows clear immediately so
   * the table never shows rows that contradict the active filters). */
  keepDuringReload?: boolean;
}

export interface InfinitePagesHandle<T> {
  /** Delivered rows, oldest page first, deduped by `key` when given. */
  items: Ref<T[]>;
  /** Match count when the server counted, else the delivered count. */
  total: ComputedRef<number>;
  /** True while the FIRST page (or a reload) is in flight. */
  loading: Ref<boolean>;
  /** True while a later page is in flight. */
  loadingMore: Ref<boolean>;
  /** True once the last page landed (no further loads will fire). */
  exhausted: ComputedRef<boolean>;
  /** The raw failure of the latest attempt; delivered rows stay. */
  error: Ref<string | null>;
  /** One-based index of the next page to fetch. */
  nextPage: Ref<number>;
  /** Fetch the next page (guarded: no-op while busy, exhausted, or
   * after ANY failure — `reload` is the retry verb for both the
   * first-page and the tail-page error dialects). */
  loadMore: () => Promise<void>;
  /** Reset to page one and fetch (also the error-clearing retry). */
  reload: () => Promise<void>;
}

/**
 * The page-state machine behind every infinite list: owns the window
 * cursor, merges rows across pages (deduped), races reloads against
 * stragglers, and paces `loadMore` with its own busy/exhausted/error
 * guards. The DOM half (sentinel + skeleton tail) is
 * {@link ../components/HkInfiniteTail | HkInfiniteTail}; hosts glue the
 * two together and never hand-roll the loop again.
 *
 * Error dialect: a failed page keeps everything already delivered (the
 * consumer renders it as a stale banner — one failed fetch must never
 * hide rows the user was reading) and terminalizes the walk; `reload`
 * is the retry verb for every failure. Auto-retrying a tail failure is
 * deliberately NOT done: the tail's sentinel would re-fire on a fixed
 * geometry with no backoff, turning one flaky page into an RPC storm
 * that locks a shared rate budget.
 */
export function useInfinitePages<T, P extends Record<string, unknown> = Record<string, unknown>>(
  options: InfinitePagesOptions<T, P>,
): InfinitePagesHandle<T> {
  const pageSize = options.pageSize ?? 50;
  const reloadDebounce = options.reloadDebounce ?? 200;

  const items = ref([]) as Ref<T[]>;
  const totalKnown = ref<number | null>(null);
  const loading = ref(options.immediate !== false);
  const loadingMore = ref(false);
  const error = ref<string | null>(null);
  const exhausted = ref(false);
  const nextPage = ref(1);

  /** Monotonic fetch sequence: a straggler from an earlier reload (or a
   * param change that raced its own reload) lands here and is dropped,
   * so rows can never arrive out of order. */
  let seq = 0;
  let reloadTimer: ReturnType<typeof setTimeout> | null = null;
  let disposed = false;

  function normalize(result: HkPageResultLike<T>): HkPageResult<T> {
    const loose = result as {
      items?: T[];
      total?: number | null;
      has_more?: boolean;
    };
    return {
      items: loose.items ?? [],
      total: typeof loose.total === "number" ? loose.total : null,
      has_more: typeof loose.has_more === "boolean" ? loose.has_more : undefined,
    };
  }

  /** Append with optional dedupe: earlier pages win, so a row that
   * shifted into an already-delivered page (fresh insert above the
   * cursor) is dropped instead of duplicated. */
  function append(rows: T[]): void {
    if (!options.key) {
      items.value = [...items.value, ...rows];
      return;
    }
    const keyOf = options.key;
    const seen = new Set(items.value.map((r) => keyOf(r)));
    const fresh: T[] = [];
    for (const row of rows) {
      const k = keyOf(row);
      if (seen.has(k)) continue;
      seen.add(k);
      fresh.push(row);
    }
    items.value = [...items.value, ...fresh];
  }

  async function fetchPage(page: number, mine: number): Promise<void> {
    const extra = options.params?.() ?? ({} as P);
    try {
      const result = normalize(await options.fetcher({ ...extra, page, page_size: pageSize }));
      if (disposed || mine !== seq) return;
      error.value = null;
      if (page === 1) {
        items.value = [];
        totalKnown.value = null;
      }
      append(result.items);
      totalKnown.value = result.total;
      // Exhaustion: the server's `has_more` is authoritative when it
      // spoke; otherwise fall back to the window heuristics — the
      // delivered count reaching a known total, or a short page (a
      // window that came back under-full has nothing behind it). An
      // EMPTY page always exhausts: a server whose `total` overstates
      // (or heavy dedupe shrinking the delivered count) would otherwise
      // spin loadMore on pages that can never fill the gap.
      if (typeof result.has_more === "boolean") {
        exhausted.value = !result.has_more;
      } else if (result.items.length === 0) {
        exhausted.value = true;
      } else if (result.total != null) {
        exhausted.value = items.value.length >= result.total;
      } else {
        exhausted.value = result.items.length < pageSize;
      }
      nextPage.value = page + 1;
    } catch (e) {
      if (disposed || mine !== seq) return;
      error.value = e instanceof Error ? e.message : String(e);
    }
  }

  async function loadMore(): Promise<void> {
    // ANY failure terminalizes the walk until `reload()` — including a
    // tail-page failure. The in-place retry this used to allow read
    // fine in isolation but stormed in the field: a failed tail leaves
    // the state machine "idle", the tail's sentinel stays in view, and
    // its idle-entry re-check fires loadMore again with no geometry
    // change — one RPC per round trip, no backoff, forever. On a shared
    // per-user rate budget that loop locks the bucket and denies every
    // OTHER paged page, so the retry verb is `reload()` (the delivered
    // rows stay on screen under the stale banner; the header refresh is
    // the user's affordance).
    if (loading.value || loadingMore.value || exhausted.value) return;
    if (error.value) return;
    if (nextPage.value > 1 && items.value.length === 0) return;
    loadingMore.value = true;
    const mine = ++seq;
    try {
      await fetchPage(nextPage.value, mine);
    } finally {
      // UNCONDITIONAL clear — loadMore is single-flight (the guard
      // above), so no OTHER loadMore can own this flag; the only writer
      // that can supersede this attempt is reload(), which never raises
      // loadingMore. A guarded clear here would strand the flag true
      // forever exactly when a reload overtakes a tail fetch (search
      // commit while a page is in flight), killing every later loadMore
      // at the single-flight guard.
      loadingMore.value = false;
    }
  }

  async function reload(): Promise<void> {
    if (reloadTimer) {
      clearTimeout(reloadTimer);
      reloadTimer = null;
    }
    loading.value = true;
    error.value = null;
    if (!options.keepDuringReload) {
      // Invalidate the cursor BEFORE the fetch so a straggler from the
      // previous query cannot append into the new result (the seq race
      // guard would drop it anyway; clearing here keeps `items` honest
      // for the spinner branch that renders while page one is away).
      items.value = [];
      totalKnown.value = null;
      exhausted.value = false;
    }
    const mine = ++seq;
    try {
      await fetchPage(1, mine);
    } finally {
      // Same ownership rule as loadMore: with overlapping reloads
      // (debounced param change racing a manual one), only the newest
      // clears `loading` — the superseded one must leave the spinner
      // up for the attempt still in flight.
      if (mine === seq) loading.value = false;
    }
  }

  if (options.params) {
    watch(
      options.params,
      () => {
        if (disposed) return;
        if (reloadTimer) clearTimeout(reloadTimer);
        reloadTimer = setTimeout(() => {
          reloadTimer = null;
          void reload();
        }, reloadDebounce);
      },
      { deep: true },
    );
  }

  if (options.immediate !== false) {
    void reload();
  }

  if (getCurrentScope()) {
    onScopeDispose(() => {
      disposed = true;
      if (reloadTimer) clearTimeout(reloadTimer);
    });
  }

  const total = computed(() => totalKnown.value ?? items.value.length);

  return {
    items,
    total,
    loading,
    loadingMore,
    exhausted: computed(() => exhausted.value),
    error,
    nextPage,
    loadMore,
    reload,
  };
}
