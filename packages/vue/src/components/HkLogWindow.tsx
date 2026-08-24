import { computed, defineComponent, nextTick, ref, watch, type PropType } from "vue";
import { Copy, Eraser, Pause, Play, ScrollText } from "lucide-vue-next";
import { HModal, HScrollContainer, useClipboard } from "@celestia-island/hikari";

import { useI18n } from "../i18n/context";

import "./HkLogWindow.scss";

export interface HLogTab {
  key: string;
  title: string;
  lines: string[];
}

/** Public surface HScrollContainer exposes via setup expose() —
 *  InstanceType does not carry expose() members, so type it structurally. */
interface ScrollContainerPublic {
  getScrollElement: () => HTMLElement | undefined;
}

function levelOf(line: string): "error" | "warn" | "debug" | "info" {
  const upper = line.toUpperCase();
  if (upper.includes("ERROR")) return "error";
  if (upper.includes("WARN")) return "warn";
  if (upper.includes("DEBUG") || upper.includes("TRACE")) return "debug";
  return "info";
}

/**
 * HkLogWindow — tabbed service log viewer.
 * (Upstreamed from shittim-chest's plana-legacy layer.)
 *
 * Displays caller-provided `tabs` (each an ordered list of log lines) with
 * pause, autoscroll, copy and clear controls. Line arrays are props: the
 * caller keeps appending; `clearTab(key)` tells the caller to reset that
 * tab's buffer. Pause is optional-controlled (`paused` + `update:paused`).
 * Autoscroll delegates to HScrollContainer's `autoFollow` (pins to
 * bottom while the user stays near the end, pauses when paused).
 */
export const HkLogWindow = defineComponent({
  name: "HkLogWindow",
  props: {
    modelValue: { type: Boolean, default: false },
    tabs: { type: Array as PropType<HLogTab[]>, required: true },
    /** Controlled pause state; when undefined the toggle is internal. */
    paused: { type: Boolean, default: false },
    /** Height of the log body (CSS length, e.g. "55vh"). */
    height: { type: String, default: "55vh" },
    title: { type: String, default: undefined },
    width: { type: String, default: "60rem" },
  },
  emits: {
    "update:modelValue": (_v: boolean) => true,
    "update:paused": (_v: boolean) => true,
    clearTab: (_key: string) => true,
  },
  setup(props, { emit }) {
    const { t } = useI18n();
    const clipboard = useClipboard();

    const activeTab = ref<string>("");
    const autoscroll = ref(true);
    const paused = ref(props.paused);

    watch(
      () => props.paused,
      (v) => { paused.value = v; },
    );

    watch(
      () => props.tabs,
      (tabs) => {
        if (tabs.length === 0) {
          activeTab.value = "";
        } else if (!tabs.some((tab) => tab.key === activeTab.value)) {
          activeTab.value = tabs[0].key;
        }
      },
      { immediate: true },
    );

    const scrollRef = ref<ScrollContainerPublic | null>(null);

    // Log viewers follow the newest-line convention: switching tabs
    // tail-jumps to the bottom of the new tab's lines (nextTick so
    // the swapped body has rendered before measuring scrollHeight;
    // landing at the bottom also re-arms autoFollow's pinned zone).
    watch(activeTab, () => {
      void nextTick(() => {
        const el = scrollRef.value?.getScrollElement();
        if (el) el.scrollTop = el.scrollHeight;
      });
    });

    const currentTab = computed(() => props.tabs.find((tab) => tab.key === activeTab.value) ?? null);
    const currentLines = computed(() => currentTab.value?.lines ?? []);

    function togglePause() {
      paused.value = !paused.value;
      emit("update:paused", paused.value);
    }

    function handleClear() {
      if (!currentTab.value) return;
      emit("clearTab", currentTab.value.key);
    }

    function handleCopy() {
      if (currentLines.value.length === 0) return;
      void clipboard.copy(currentLines.value.join("\n"));
    }

    const copied = computed(() => clipboard.copied.value);

    return () => (
      <HModal
        modelValue={props.modelValue}
        onUpdate:modelValue={(v: boolean) => emit("update:modelValue", v)}
        title={props.title ?? t("hikari::log.title", "Logs")}
        width={props.width}
      >
        <div class="s-log-viewer" style={{ height: props.height }}>
          <div class="s-log-toolbar">
            <div class="s-log-tabs">
              {props.tabs.map((tab) => (
                <button
                  key={tab.key}
                  type="button"
                  class="s-log-tab"
                  data-active={tab.key === activeTab.value || undefined}
                  onClick={() => { activeTab.value = tab.key; }}
                >
                  {tab.title}
                </button>
              ))}
            </div>
            <div class="s-log-controls">
              <button
                type="button"
                class="s-log-btn"
                data-active={paused.value || undefined}
                onClick={togglePause}
                title={paused.value ? t("hikari::log.resume", "Resume") : t("hikari::log.pause", "Pause")}
              >
                {paused.value ? <Play size={12} /> : <Pause size={12} />}
              </button>
              <button
                type="button"
                class="s-log-btn"
                data-active={autoscroll.value || undefined}
                onClick={() => { autoscroll.value = !autoscroll.value; }}
                title={t("hikari::log.autoscroll", "Autoscroll")}
              >
                <ScrollText size={12} />
              </button>
              <button
                type="button"
                class="s-log-btn"
                disabled={currentLines.value.length === 0}
                onClick={handleCopy}
                title={copied.value ? t("hikari::log.copied", "Copied") : t("hikari::log.copy", "Copy")}
              >
                <Copy size={12} />
              </button>
              <button
                type="button"
                class="s-log-btn"
                disabled={currentLines.value.length === 0}
                onClick={handleClear}
                title={t("hikari::log.clear", "Clear")}
              >
                <Eraser size={12} />
              </button>
            </div>
          </div>
          <HScrollContainer
            class="s-log-viewer-scroll"
            autoFollow={autoscroll.value && !paused.value}
            ref={scrollRef}
          >
            {currentLines.value.length === 0 ? (
              <div class="s-log-empty">{t("hikari::log.empty", "No log lines yet.")}</div>
            ) : (
              currentLines.value.map((line, i) => (
                <div key={i} class={["s-log-entry", `s-log-entry-${levelOf(line)}`]}>
                  {line}
                </div>
              ))
            )}
          </HScrollContainer>
        </div>
      </HModal>
    );
  },
});
