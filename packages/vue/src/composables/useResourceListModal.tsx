import { Search } from "lucide-vue-next";
import { computed, ref, shallowRef, watch } from "vue";
import { useI18n } from "../i18n/context";
// @ts-ignore JSX namespace


import { HEmptyState, HInput, HListTransition, HModal, HScrollContainer, HSpinner } from "../index";


interface ResourceItem {
  name: string;
  description: string;
  agent: string;
  [key: string]: unknown;
}

export function useResourceListModal<
  T extends ResourceItem,
>(opts: {
  props: { modelValue: boolean };
  emit: (event: "update:modelValue", value: boolean) => void;
  fetchFn: () => Promise<T[]>;
  i18nKey: string;
  width?: string;
  renderItem: (item: T, t: (key: string, fallback?: string) => string) => any;
}) {
  const { props, emit, fetchFn, i18nKey, width = "56rem", renderItem } = opts;
  const { t } = useI18n();

  // shallowRef so `items.value` keeps the caller's `T[]` type — a deep
  // `ref<T[]>` unwraps element types and turns `T` into the opaque
  // `UnwrapRefSimple<T>` (the composable only replaces the whole array,
  // never mutates elements, so depth is irrelevant at runtime).
  const items = shallowRef<T[]>([]);
  const loading = ref(false);
  const fetchError = ref<string | null>(null);
  const searchQuery = ref("");

  const filtered = computed(() => {
    const q = searchQuery.value.toLowerCase().trim();
    if (!q) return items.value;
    return items.value.filter(
      (item) =>
        (item.name || "").toLowerCase().includes(q) ||
        (item.description || "").toLowerCase().includes(q) ||
        (item.agent || "").toLowerCase().includes(q),
    );
  });

  const grouped = computed(() => {
    const groups: Record<string, T[]> = {};
    for (const item of filtered.value) {
      const agent = item.agent || "unknown";
      if (!groups[agent]) groups[agent] = [];
      groups[agent].push(item);
    }
    return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b));
  });

  async function fetchData() {
    loading.value = true;
    fetchError.value = null;
    try {
      items.value = await fetchFn();
    } catch (err) {
      fetchError.value = err instanceof Error ? err.message : String(err);
      items.value = [];
    } finally {
      loading.value = false;
    }
  }

  watch(
    () => props.modelValue,
    (open) => {
      if (open && items.value.length === 0) {
        fetchData();
      }
    },
  );

  function renderModal() {
    // i18n: skills.*, tools.*
    return (
      <HModal
        modelValue={props.modelValue}
        onUpdate:modelValue={(v: boolean) => emit("update:modelValue", v)}
        title={t(`${i18nKey}.title`)}
        width={width}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
          <HInput
            modelValue={searchQuery.value}
            onUpdate:modelValue={(v: string) => { searchQuery.value = v; }}
            placeholder={t(`${i18nKey}.search`)}
          >
            {{ prefixIcon: () => <Search size={14} /> }}
          </HInput>

          {loading.value ? (
            <HSpinner center size="md" text={t("common.actions.loading", "Loading…")} />
          ) : fetchError.value ? (
            <HEmptyState
              title={t("common.errors.loadFailed", "Failed to load")}
              description={fetchError.value}
            />
          ) : filtered.value.length === 0 ? (
            <HEmptyState
              title={t(`${i18nKey}.empty`)}
              description={
                searchQuery.value
                  ? t(`${i18nKey}.emptySearch`)
                  : t(`${i18nKey}.emptyDefault`)
              }
            />
          ) : (
            <HScrollContainer
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "0.5rem",
                maxHeight: "55vh",
              }}
            >
              {grouped.value.map(([agent, agentItems]) => (
                <HListTransition tag="div" key={agent} variant="grow">
                  <div class="text-[0.6875rem] font-semibold uppercase tracking-wider text-muted/70 py-2 pb-1">
                    {agent}
                    <span class="ml-1.5 opacity-60">({agentItems.length})</span>
                  </div>
                  {agentItems.map((item) => (
                    <div key={`${agent}::${item.name}`} class="mb-1.5">
                      {renderItem(item, t)}
                    </div>
                  ))}
                </HListTransition>
              ))}
            </HScrollContainer>
          )}
        </div>
      </HModal>
    );
    // i18n:end
  }

  return { renderModal, items, loading, fetchError, searchQuery };
}
