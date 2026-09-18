/**
 * Standard image loading-state hook.
 *
 * Tracks the lifecycle of a single <img> source so callers can render
 * graceful placeholders instead of the browser's broken-image glyph.
 * The hook itself is presentation-free: bind `src`/`key` and the
 * `onLoad`/`onError` handlers onto the element, drive placeholder UI
 * from `status`, and call `retry()` after the environment changes
 * (e.g. a resource pack finished installing).
 *
 * Design contract: a string-union status ref, a flat return object and
 * a MaybeRefOrGetter source. Kept Vue-only so any hikari host (desktop
 * shell, marketing site, WASI entry) can consume it without extra deps.
 */
import { computed, ref, toValue, watch } from "vue";
import type { MaybeRefOrGetter, Ref } from "vue";

/** Lifecycle of the tracked image source. */
export type ImageStatus = "empty" | "loading" | "loaded" | "error";

/** Return shape of {@link useImage}. */
export interface UseImageReturn {
  /** Resolved source; empty string when there is nothing to load. */
  readonly src: Readonly<Ref<string>>;
  /** Load lifecycle; resets to "loading" whenever the source changes. */
  readonly status: Readonly<Ref<ImageStatus>>;
  /** Element key — changes on retry so a re-mounted <img> re-requests. */
  readonly key: Readonly<Ref<string>>;
  /** Bind to the <img> load event. */
  onLoad: () => void;
  /** Bind to the <img> error event. */
  onError: () => void;
  /** Force a fresh request of the current source. */
  retry: () => void;
}

export function useImage(
  source: MaybeRefOrGetter<string | null | undefined>,
): UseImageReturn {
  const src = ref("");
  const status = ref<ImageStatus>("empty");
  const attempt = ref(0);

  watch(
    () => toValue(source),
    (next) => {
      src.value = next ?? "";
      attempt.value = 0;
      status.value = src.value ? "loading" : "empty";
    },
    { immediate: true },
  );

  const key = computed(() => `${src.value || "empty"}#${attempt.value}`);

  function onLoad(): void {
    // Symmetric with onError: only a request we are actually waiting on
    // may resolve the status.
    if (status.value === "loading") status.value = "loaded";
  }

  function onError(): void {
    // Superseded requests may still emit an error — only trust one while loading.
    if (status.value === "loading") status.value = "error";
  }

  function retry(): void {
    if (!src.value) return;
    attempt.value += 1;
    status.value = "loading";
  }

  return { src, status, key, onLoad, onError, retry };
}
