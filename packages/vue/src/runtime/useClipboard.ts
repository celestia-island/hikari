import { ref } from "vue";

import { useI18n } from "../i18n/context";

export function useClipboard() {
  const copied = ref(false);

  async function copy(text: string): Promise<boolean> {
    try {
      await navigator.clipboard.writeText(text);
      copied.value = true;
      setTimeout(() => {
        copied.value = false;
      }, 2000);
      return true;
    } catch {
      const textarea = document.createElement("textarea");
      textarea.value = text;
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      document.body.appendChild(textarea);
      textarea.select();
      try {
        // execCommand reports failure by RETURNING false (it only throws
        // on unsupported commands) — treating that as success surfaced
        // "Copied" toasts for writes that never landed.
        if (!document.execCommand("copy")) return false;
        copied.value = true;
        setTimeout(() => {
          copied.value = false;
        }, 2000);
        return true;
      } catch {
        return false;
      } finally {
        document.body.removeChild(textarea);
      }
    }
  }

  return { copied, copy };
}

/**
 * Clipboard copy with a toast on success/failure.
 * (Upstreamed from shittim-chest's plana-legacy layer.)
 *
 * Wraps the base `useClipboard` above (which already falls back to
 * `execCommand` outside secure contexts) and adds toast feedback;
 * `copied` reflects the 2s copied state. The `toast` argument matches
 * hikari's `useToast()` surface (`success` / `error` message pushers).
 *
 * Default toast messages come from hikari's own i18n
 * (`hikari::clipboard.copied` / `hikari::clipboard.copyFailed`) so a
 * bare `useClipboardWithToast(useToast())` is already localized; pass
 * thunks to override per call site. `copy` resolves to whether the
 * clipboard write succeeded.
 */
export function useClipboardWithToast(
  toast: { success: (msg: string) => void; error: (msg: string) => void },
  defaultSuccessMessage?: () => string,
  defaultErrorMessage?: () => string,
) {
  const { t } = useI18n();
  const { copy: baseCopy, copied } = useClipboard();

  async function copy(text: string, successMessage?: string): Promise<boolean> {
    const ok = await baseCopy(text);
    if (ok) {
      toast.success(
        successMessage ?? defaultSuccessMessage?.() ?? t("hikari::clipboard.copied", "Copied"),
      );
    } else {
      toast.error(defaultErrorMessage?.() ?? t("hikari::clipboard.copyFailed", "Copy failed"));
    }
    return ok;
  }

  return { copy, copied };
}
