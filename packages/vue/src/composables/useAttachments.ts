import { onBeforeUnmount, ref } from "vue";

import { onFrame, type AnimationHandle } from "@celestia-island/hikari";
import { formatBytes } from "../utils/format";

/**
 * Attachment management composable — extracted from chest's ChatComposer.
 * (Upstreamed from shittim-chest's plana-legacy layer.)
 *
 * Provides the full attachment lifecycle:
 *   - Add via file picker, drag-and-drop, or clipboard paste
 *   - Media preview (image/video object-URL thumbnails)
 *   - Simulated upload progress
 *   - Remove with object-URL cleanup
 *
 * Used by chat-input kits so every HkRichInput consumer (chat bar,
 * composer, purpose inputs) shares the same attachment behavior.
 */

export interface HkUploadedFile {
  id: string;
  name: string;
  type: string;
  size: number;
  preview?: string;
  file?: File;
  /** 0–100; reaches 100 when the preview is ready. */
  progress: number;
}

export function useAttachments() {
  const attachments = ref<HkUploadedFile[]>([]);
  const isDragOver = ref(false);

  function addAttachmentFromFile(file: File) {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const uploaded: HkUploadedFile = {
      id,
      name: file.name || "pasted-file",
      type: file.type,
      size: file.size,
      progress: 0,
      file,
    };
    attachments.value.push(uploaded);

    const isPreviewable =
      (file.type.startsWith("image/") || file.type.startsWith("video/")) &&
      file.size < 25 * 1024 * 1024;
    if (isPreviewable) {
      uploaded.preview = URL.createObjectURL(file);
    }

    animateProgress(id);
  }

  function animateProgress(attId: string) {
    const duration = 400 + Math.random() * 200;
    const start = performance.now();
    // Drive the simulated ramp through the unified animation bus so the
    // shared rAF loop (and anything sampling it) stays alive for the ramp,
    // and this loop auto-stops with the bus's idle semantics. We disconnect
    // the handle ourselves once the ramp completes.
    let handle: AnimationHandle | null = onFrame(() => {
      const elapsed = performance.now() - start;
      const pct = Math.min(100, (elapsed / duration) * 100);
      const target = attachments.value.find((a) => a.id === attId);
      if (target) target.progress = pct;
      if (pct >= 100 && handle) {
        handle.disconnect();
        handle = null;
      }
    }, "sync");
  }

  function removeAttachment(att: HkUploadedFile) {
    if (att.preview) URL.revokeObjectURL(att.preview);
    attachments.value = attachments.value.filter((a) => a !== att);
  }

  function clear() {
    for (const a of attachments.value) {
      if (a.preview) URL.revokeObjectURL(a.preview);
    }
    attachments.value = [];
  }

  function handlePaste(e: ClipboardEvent) {
    const items = e.clipboardData?.items;
    if (!items) return;
    let hadFile = false;
    for (const item of Array.from(items)) {
      if (item.kind === "file") {
        const file = item.getAsFile();
        if (file) {
          addAttachmentFromFile(file);
          hadFile = true;
        }
      }
    }
    if (hadFile) e.preventDefault();
  }

  function handleDragOver(e: DragEvent) {
    if (!e.dataTransfer) return;
    const hasFile = Array.from(e.dataTransfer.types).includes("Files");
    if (!hasFile) return;
    e.preventDefault();
    isDragOver.value = true;
  }

  function handleDragLeave(e: DragEvent, container: HTMLElement | null) {
    const related = e.relatedTarget as Node | null;
    if (container && related && container.contains(related)) return;
    isDragOver.value = false;
  }

  function handleDrop(e: DragEvent) {
    e.preventDefault();
    isDragOver.value = false;
    const files = e.dataTransfer?.files;
    if (!files) return;
    for (const file of Array.from(files)) {
      addAttachmentFromFile(file);
    }
  }

  function handleFileSelect(e: Event) {
    const input = e.target as HTMLInputElement;
    if (!input.files) return;
    for (const file of Array.from(input.files)) {
      addAttachmentFromFile(file);
    }
    input.value = "";
  }

  onBeforeUnmount(() => {
    clear();
  });

  return {
    attachments,
    isDragOver,
    addAttachmentFromFile,
    removeAttachment,
    clear,
    handlePaste,
    handleDragOver,
    handleDragLeave,
    handleDrop,
    handleFileSelect,
    formatSize: formatBytes,
  };
}
