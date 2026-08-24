import { ref } from "vue";

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
        document.execCommand("copy");
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
 */
export function useClipboardWithToast(
  toast: { success: (msg: string) => void; error: (msg: string) => void },
  defaultSuccessMessage?: () => string,
  defaultErrorMessage?: () => string,
) {
  const { copy: baseCopy, copied } = useClipboard();

  async function copy(text: string, successMessage?: string) {
    const ok = await baseCopy(text);
    if (ok) {
      toast.success(successMessage ?? defaultSuccessMessage?.() ?? "Copied");
    } else {
      toast.error(defaultErrorMessage?.() ?? "Copy failed");
    }
  }

  return { copy, copied };
}
