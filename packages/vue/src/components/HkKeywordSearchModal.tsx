import { computed, defineComponent, ref, watch, type PropType } from "vue";

import "./HkKeywordSearchModal.scss";
import HkModal from "./HkModal";
import { scheduleCronAfter, type CronHandle } from "../runtime/cronBus";

interface FuzzyMatch {
  matched: boolean;
  score: number;
}

function fuzzyScore(query: string, haystack: string): FuzzyMatch {
  if (!query) return { matched: true, score: 0 };
  const q = query.toLowerCase();
  const h = haystack.toLowerCase();
  if (!h) return { matched: false, score: 0 };

  const subIdx = h.indexOf(q);
  if (subIdx >= 0) {
    const boundary = subIdx === 0 || /[\s_\-/.:]/.test(h[subIdx - 1] ?? " ");
    return { matched: true, score: 1000 + q.length * 10 + (boundary ? 50 : 0) };
  }

  let qi = 0;
  let score = 0;
  let run = 0;
  let prevMatchedIdx = -2;
  for (let hi = 0; hi < h.length && qi < q.length; hi++) {
    if (h[hi] === q[qi]) {
      run = hi === prevMatchedIdx + 1 ? run + 1 : 1;
      score += 10 + run * 4;
      const prev = hi > 0 ? h[hi - 1] : " ";
      if (/[\s_\-/.:,()]/.test(prev)) score += 15;
      prevMatchedIdx = hi;
      qi++;
    }
  }
  return { matched: qi === q.length, score: qi === q.length ? score : 0 };
}

function fuzzyScoreFields(
  query: string,
  fields: { text: string; weight?: number }[],
): { matched: boolean; score: number; fieldIndex: number } {
  let best = { matched: false, score: 0, fieldIndex: -1 };
  for (let i = 0; i < fields.length; i++) {
    const { text, weight = 1 } = fields[i];
    const res = fuzzyScore(query, text);
    if (!res.matched) continue;
    const weighted = res.score * weight;
    if (weighted > best.score) {
      best = { matched: true, score: weighted, fieldIndex: i };
    }
  }
  return best;
}

function fuzzySearch<T>(
  query: string,
  records: T[],
  fieldsOf: (rec: T) => { text: string; weight?: number }[],
): { record: T; score: number }[] {
  const terms = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (terms.length === 0) {
    return records.map((record) => ({ record, score: 0 }));
  }
  const out: { record: T; score: number }[] = [];
  for (const record of records) {
    const fields = fieldsOf(record);
    let total = 0;
    let allMatched = true;
    for (const term of terms) {
      const res = fuzzyScoreFields(term, fields);
      if (!res.matched) { allMatched = false; break; }
      total += res.score;
    }
    if (allMatched) out.push({ record, score: total });
  }
  out.sort((a, b) => b.score - a.score);
  return out;
}

export interface SemanticSearchItem {
  key: string;
  title?: string;
  snippet: string;
  score?: number;
  source?: string;
  raw: unknown;
}

export default defineComponent({
  name: "HkKeywordSearchModal",
  props: {
    modelValue: { type: Boolean, required: true },
    title: { type: String, default: undefined },
    placeholder: { type: String, default: undefined },
    records: { type: Array as PropType<unknown[]>, default: () => [] },
    fieldsOf: {
      type: Function as PropType<(rec: unknown) => { text: string; weight?: number }[]>,
      default: () => [],
    },
    keyOf: { type: Function as PropType<(rec: unknown) => string>, default: () => "0" },
    emptyText: { type: String, default: undefined },
    semanticSearch: {
      type: [Function, null] as unknown as PropType<
        ((query: string) => Promise<SemanticSearchItem[]>) | undefined
      >,
      default: undefined,
    },
    searchingText: { type: String, default: undefined },
  },
  emits: {
    "update:modelValue": (_v: boolean) => true,
    select: (_rec: unknown) => true,
  },
  setup(props, { slots, emit }) {
    const query = ref("");
    let debounceTimer: CronHandle | null = null;
    const debouncedQuery = ref("");

    function scheduleDebounce() {
      debounceTimer?.disconnect();
      debounceTimer = scheduleCronAfter(() => {
        debouncedQuery.value = query.value;
      }, 120);
    }

    watch(query, scheduleDebounce);

    const semanticActive = computed(() => typeof props.semanticSearch === "function");
    const semanticLoading = ref(false);
    const semanticResults = ref<SemanticSearchItem[]>([]);
    let semanticToken = 0;

    async function runSemantic(q: string) {
      if (!props.semanticSearch) {
        semanticResults.value = [];
        return;
      }
      const trimmed = q.trim();
      if (!trimmed) {
        semanticResults.value = [];
        semanticLoading.value = false;
        return;
      }
      const token = ++semanticToken;
      semanticLoading.value = true;
      try {
        const items = await props.semanticSearch(trimmed);
        if (token === semanticToken) semanticResults.value = items ?? [];
      } catch {
        if (token === semanticToken) semanticResults.value = [];
      } finally {
        if (token === semanticToken) semanticLoading.value = false;
      }
    }

    watch(debouncedQuery, (q) => {
      if (semanticActive.value) void runSemantic(q);
    });

    const results = computed(() => {
      const q = debouncedQuery.value;
      return fuzzySearch(q, props.records as unknown[], props.fieldsOf).map((r) => ({
        key: props.keyOf(r.record),
        record: r.record,
        score: r.score,
      }));
    });

    watch(
      () => props.modelValue,
      (open) => {
        if (open) {
          query.value = "";
          debouncedQuery.value = "";
          semanticResults.value = [];
          semanticLoading.value = false;
        }
      },
    );

    function pick(rec: unknown) {
      emit("select", rec);
      emit("update:modelValue", false);
    }

    return () => (
      <HkModal
        modelValue={props.modelValue}
        onUpdate:modelValue={(v: boolean) => emit("update:modelValue", v)}
        title={props.title ?? "Search"}
        width="40rem"
      >
        <div class="hk-kw-search">
          <div class="hk-kw-search-box">
            <svg
              class="hk-kw-search-icon"
              width="15"
              height="15"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
            >
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              class="hk-kw-search-input"
              type="text"
              value={query.value}
              placeholder={props.placeholder ?? "Search…"}
              onInput={(e: Event) => { query.value = (e.target as HTMLInputElement).value; }}
              autofocus
            />
            {query.value && (
              <button
                class="hk-kw-search-clear"
                type="button"
                aria-label="Clear"
                onClick={() => {
                  query.value = "";
                  debouncedQuery.value = "";
                  semanticResults.value = [];
                }}
              >
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                >
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            )}
          </div>

          <div class="hk-kw-search-results">
            {semanticActive.value ? (
              semanticLoading.value && semanticResults.value.length === 0 ? (
                <div class="hk-kw-search-empty">
                  {props.searchingText ?? "Searching…"}
                </div>
              ) : semanticResults.value.length === 0 ? (
                <div class="hk-kw-search-empty">
                  {debouncedQuery.value
                    ? (props.emptyText ?? "No matches")
                    : (props.placeholder ?? "Search…")}
                </div>
              ) : (
                semanticResults.value.map((r) => (
                  <button
                    key={r.key}
                    class="hk-kw-search-result hk-kw-search-result-semantic"
                    type="button"
                    onClick={() => pick(r.raw)}
                  >
                    {slots.semanticResult?.({ item: r }) ?? (
                      <span class="hk-kw-search-semantic">
                        <span class="hk-kw-search-semantic-head">
                          {r.title && (
                            <span class="hk-kw-search-semantic-title">{r.title}</span>
                          )}
                          {typeof r.score === "number" && (
                            <span class="hk-kw-search-semantic-score">
                              {(r.score * 100).toFixed(0)}%
                            </span>
                          )}
                        </span>
                        <span class="hk-kw-search-semantic-snippet">{r.snippet}</span>
                        {r.source && (
                          <span class="hk-kw-search-semantic-source">{r.source}</span>
                        )}
                      </span>
                    )}
                  </button>
                ))
              )
            ) : results.value.length === 0 ? (
              <div class="hk-kw-search-empty">
                {props.emptyText ?? "No matches"}
              </div>
            ) : (
              results.value.map((r) => (
                <button
                  key={r.key}
                  class="hk-kw-search-result"
                  type="button"
                  onClick={() => pick(r.record)}
                >
                  {slots.result?.({ record: r.record })}
                </button>
              ))
            )}
          </div>
        </div>
      </HkModal>
    );
  },
});
