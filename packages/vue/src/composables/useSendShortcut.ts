import { computed, type ComputedRef } from "vue";

export type SendShortcutMode = "ctrl-enter" | "enter";

/**
 * Resolve the active send-shortcut mode for chat inputs.
 * (Upstreamed from shittim-chest's plana-legacy layer; preference store
 * decoupled — the caller feeds the mode getter.)
 *
 * Default "ctrl-enter": Enter inserts a newline, Ctrl/Cmd+Enter submits.
 * "enter": Enter submits, Shift+Enter forces a newline.
 */
export function useSendShortcut(getMode?: () => SendShortcutMode) {
  const mode: ComputedRef<SendShortcutMode> = computed(() => {
    const v = getMode?.();
    return v === "enter" ? "enter" : "ctrl-enter";
  });

  function isSendEvent(e: KeyboardEvent): boolean {
    if (e.key !== "Enter") return false;
    if (mode.value === "enter") {
      return !e.shiftKey && !e.ctrlKey && !e.metaKey;
    }
    return e.ctrlKey || e.metaKey;
  }

  function isNewlineEvent(e: KeyboardEvent): boolean {
    if (e.key !== "Enter") return false;
    return !isSendEvent(e);
  }

  const shortcutLabel = computed(() => (mode.value === "enter" ? "enter" : "ctrl+enter"));

  return { mode, shortcutLabel, isSendEvent, isNewlineEvent };
}
