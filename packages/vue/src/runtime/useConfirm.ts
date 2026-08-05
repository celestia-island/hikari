import { ref } from "vue";

export function useConfirm() {
  const resolveRef = ref<((value: boolean) => void) | null>(null);
  const open = ref(false);
  const message = ref("");
  const title = ref("Confirm");
  const confirmText = ref("Confirm");
  const cancelText = ref("Cancel");

  function confirm(text: string, opts?: { title?: string; confirmText?: string; cancelText?: string }): Promise<boolean> {
    return new Promise<boolean>((resolve) => {
      resolveRef.value = resolve;
      message.value = text;
      title.value = opts?.title ?? "Confirm";
      confirmText.value = opts?.confirmText ?? "Confirm";
      cancelText.value = opts?.cancelText ?? "Cancel";
      open.value = true;
    });
  }

  function onConfirm() {
    open.value = false;
    resolveRef.value?.(true);
    resolveRef.value = null;
  }

  function onCancel() {
    open.value = false;
    resolveRef.value?.(false);
    resolveRef.value = null;
  }

  return { open, title, message, confirmText, cancelText, confirm, onConfirm, onCancel };
}
