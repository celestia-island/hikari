// Internal path, not the package name: importing the barrel from inside
// the package would make this module part of a cycle (barrel -> shared
// -> barrel). Both are leaves that read the same runtime module.
import { useConfirm as useConfirmHikari } from "./useConfirm";

/**
 * Confirmation-dialog state machine (thin wrapper over hikari's).
 *
 * `confirm(title, message)` returns a promise that resolves with the user's
 * choice; the view renders its own dialog from `visible/title/message` (or
 * drives an `HkConfirmDialog`). The promise is settled with `false` when the
 * owning scope unmounts, so awaiting callers never hang — hikari's
 * implementation handles that.
 */
export function useConfirm() {
  const core = useConfirmHikari();

  function confirm(titleText: string, messageText: string): Promise<boolean> {
    return core.confirm(messageText, { title: titleText });
  }

  return {
    visible: core.open,
    title: core.title,
    message: core.message,
    confirm,
    accept: core.onConfirm,
    cancel: core.onCancel,
  };
}
