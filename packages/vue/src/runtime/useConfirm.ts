import { onUnmounted, ref } from "vue";
import { useI18n } from "../i18n/context";

export function useConfirm() {
  const { t } = useI18n();
  const resolveRef = ref<((value: boolean) => void) | null>(null);
  const open = ref(false);
  const message = ref("");
  const title = ref(t("hikari::confirmDialog.confirm", "Confirm"));
  const confirmText = ref(t("hikari::confirmDialog.confirm", "Confirm"));
  const cancelText = ref(t("hikari::confirmDialog.cancel", "Cancel"));

  function confirm(text: string, opts?: { title?: string; confirmText?: string; cancelText?: string }): Promise<boolean> {
    return new Promise<boolean>((resolve) => {
      resolveRef.value = resolve;
      message.value = text;
      title.value = opts?.title ?? t("hikari::confirmDialog.confirm", "Confirm");
      confirmText.value = opts?.confirmText ?? t("hikari::confirmDialog.confirm", "Confirm");
      cancelText.value = opts?.cancelText ?? t("hikari::confirmDialog.cancel", "Cancel");
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

  onUnmounted(() => {
    resolveRef.value?.(false);
    resolveRef.value = null;
    open.value = false;
  });

  return { open, title, message, confirmText, cancelText, confirm, onConfirm, onCancel };
}
