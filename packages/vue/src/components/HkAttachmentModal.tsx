import { computed, defineComponent, ref, watch, type PropType } from "vue";
import { Film, File as FileIcon, Image as ImageIcon, Music } from "lucide-vue-next";
import {
  HBadge,
  HImageViewer,
  HMarkdownRenderer,
  HMediaPlayer,
  HModal,
  HScrollContainer,
} from "@celestia-island/hikari";

import { useI18n } from "../i18n/context";

import "./HkAttachmentModal.scss";

const CODE_LANGS: Record<string, string> = {
  ".ts": "typescript", ".tsx": "typescript", ".js": "javascript",
  ".jsx": "javascript", ".json": "json", ".rs": "rust", ".go": "go",
  ".py": "python", ".java": "java", ".c": "c", ".cpp": "cpp", ".h": "c",
  ".cs": "csharp", ".sh": "bash", ".bash": "bash", ".yaml": "yaml",
  ".yml": "yaml", ".toml": "toml", ".html": "html", ".css": "css",
  ".scss": "scss", ".sql": "sql", ".xml": "xml", ".ini": "ini",
};

function codeLanguage(name: string): string | undefined {
  const idx = name.lastIndexOf(".");
  if (idx < 0) return undefined;
  return CODE_LANGS[name.slice(idx).toLowerCase()];
}

const TEXT_EXTS = new Set([".md", ".markdown", ".txt", ".log", ".csv"]);
const CODE_EXTS = new Set(Object.keys(CODE_LANGS));

/** Attachment row in the HRichInput strip. Parent-owned upload state. */
export interface HAttachmentItem {
  id: string;
  name: string;
  type: string;
  size: number;
  preview?: string;
  /** Upload progress 0-100; omitted/100 = ready. */
  progress?: number;
  status?: "uploading" | "done" | "error";
}

/** Attachment payload for HAttachmentModal preview. */
export interface HAttachmentDetail {
  name: string;
  type: string;
  size: number;
  preview?: string;
  url?: string;
  /** Original File handle — used to read text/code content for preview. */
  file?: File;
}

/** Kind of rich preview to render; inferred from MIME unless hinted. */
export type HAttachmentPreviewType = "image" | "video" | "audio" | "other";

/** Resolve the preview kind: an explicit hint wins, MIME prefix otherwise. */
export function previewKindFor(
  att: Pick<HAttachmentDetail, "type"> | null | undefined,
  hint?: HAttachmentPreviewType,
): HAttachmentPreviewType {
  if (hint) return hint;
  const type = att?.type ?? "";
  if (type.startsWith("image/")) return "image";
  if (type.startsWith("video/")) return "video";
  if (type.startsWith("audio/")) return "audio";
  return "other";
}

function isTextFile(att: HAttachmentDetail): boolean {
  const ext = att.name.slice(att.name.lastIndexOf(".")).toLowerCase();
  return att.type.startsWith("text/") || TEXT_EXTS.has(ext) || CODE_EXTS.has(ext);
}

/** "512" -> "512B", "1536" -> "1.5KB", "2621440" -> "2.5MB". */
function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0B";
  if (bytes < 1024) return `${Math.floor(bytes)}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)}GB`;
}

/**
 * HkAttachmentModal — generic file-picker preview modal.
 * (Upstreamed from shittim-chest's plana-legacy layer.)
 *
 * Renders an attachment by preview kind: image (HImageViewer), video/audio
 * (HMediaPlayer), text/code (HMarkdownRenderer, with syntax fences for
 * known code extensions) or a generic file chip.
 *
 * URL handling is transport-agnostic: when the attachment carries no
 * `preview`/`url`, the consumer may pass `resolveUrl` (its own API client /
 * transport knows how to turn a backend file name into an authed URL).
 * The resolved URL is used for media previews, the text fetch and the
 * download action. Text content is read via the attachment's `file` handle
 * when provided.
 */
export const HkAttachmentModal = defineComponent({
  name: "HkAttachmentModal",
  props: {
    modelValue: { type: Boolean, default: false },
    attachment: { type: Object as PropType<HAttachmentDetail | null>, default: null },
    /** Transport-provided URL resolver; called with the file name when the
     *  attachment has neither `preview` nor `url`. */
    resolveUrl: { type: Function as PropType<(name: string) => Promise<string>>, default: undefined },
    /** Preview kind hint; inferred from the MIME type when omitted. */
    previewType: { type: String as PropType<HAttachmentPreviewType>, default: undefined },
  },
  emits: {
    "update:modelValue": (_v: boolean) => true,
  },
  setup(props, { emit }) {
    const { t } = useI18n();

    const kind = computed(() => previewKindFor(props.attachment, props.previewType));
    const isText = computed(() => (props.attachment ? isTextFile(props.attachment) : false));

    /* ── URL resolution ──────────────────────────────────────────── */
    const resolvedSrc = ref("");
    const srcLoading = ref(false);
    const srcError = ref<string | null>(null);

    async function resolveSrc() {
      const att = props.attachment;
      srcLoading.value = false;
      srcError.value = null;
      if (!att) {
        resolvedSrc.value = "";
        return;
      }
      if (att.preview || att.url) {
        resolvedSrc.value = att.preview || att.url || "";
        return;
      }
      if (props.resolveUrl) {
        srcLoading.value = true;
        try {
          resolvedSrc.value = await props.resolveUrl(att.name);
        } catch (e) {
          resolvedSrc.value = "";
          srcError.value = e instanceof Error ? e.message : String(e);
        } finally {
          srcLoading.value = false;
        }
        return;
      }
      resolvedSrc.value = "";
    }

    watch(
      () => [props.attachment, props.resolveUrl, props.previewType] as const,
      () => { void resolveSrc(); },
      { immediate: true },
    );

    /* ── Text / code preview ─────────────────────────────────────── */
    const textContent = ref("");
    const textPlain = ref(false);
    const textLoading = ref(false);
    const textError = ref<string | null>(null);

    async function loadText() {
      const att = props.attachment;
      if (!att) return;
      textLoading.value = true;
      textError.value = null;
      try {
        let raw: string;
        if (att.file) {
          raw = await att.file.text();
        } else if (resolvedSrc.value) {
          // The resolved URL comes from the consumer's transport (via
          // `resolveUrl`) or was already a usable preview/object URL.
          const res = await fetch(resolvedSrc.value);
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          raw = await res.text();
        } else {
          raw = "";
        }
        const lang = codeLanguage(att.name);
        const isMd = /\.(md|markdown)$/i.test(att.name);
        if (isMd) {
          textContent.value = raw;
          textPlain.value = false;
        } else if (lang) {
          textContent.value = "```" + lang + "\n" + raw + "\n```";
          textPlain.value = false;
        } else {
          textContent.value = raw;
          textPlain.value = true;
        }
      } catch (e) {
        textError.value = e instanceof Error ? e.message : String(e);
      } finally {
        textLoading.value = false;
      }
    }

    function startTextLoad() {
      if (!props.modelValue || !props.attachment) return;
      if (isText.value) void loadText();
    }

    watch(
      () => [props.modelValue, props.attachment] as const,
      () => startTextLoad(),
      { immediate: true },
    );

    // Re-fetch text once the transport URL lands (resolveUrl is async).
    watch(resolvedSrc, () => {
      if (!props.attachment?.file) startTextLoad();
    });

    function download() {
      if (!resolvedSrc.value) return;
      const a = document.createElement("a");
      a.href = resolvedSrc.value;
      a.download = props.attachment?.name || "download";
      a.click();
    }

    function fileIcon() {
      const att = props.attachment;
      if (!att) return <FileIcon size={40} />;
      if (att.type.startsWith("image/")) return <ImageIcon size={40} />;
      if (att.type.startsWith("video/")) return <Film size={40} />;
      if (att.type.startsWith("audio/")) return <Music size={40} />;
      return <FileIcon size={40} />;
    }

    return () => (
      <HModal
        modelValue={props.modelValue}
        onUpdate:modelValue={(v: boolean) => emit("update:modelValue", v)}
        title={props.attachment?.name}
        width="44rem"
        footerActions={[
          { label: t("hikari::attachment.download", "Download"), onClick: download, disabled: !resolvedSrc.value },
          { label: t("hikari::attachment.close", "Close"), variant: "secondary", onClick: () => emit("update:modelValue", false) },
        ]}
      >
        <div class="s-attachment-modal">
          {srcLoading.value && (
            <p class="s-attachment-modal-text-empty">{t("hikari::attachment.loading", "Loading…")}</p>
          )}

          {/* Image — zoomable viewer with minimap navigator */}
          {!srcLoading.value && kind.value === "image" && resolvedSrc.value && (
            <HImageViewer src={resolvedSrc.value} alt={props.attachment?.name ?? ""} />
          )}

          {/* Video — hikari media player with control bar */}
          {!srcLoading.value && kind.value === "video" && resolvedSrc.value && (
            <HMediaPlayer type="video" src={resolvedSrc.value} />
          )}

          {/* Audio — hikari media player with visualizer + control bar */}
          {!srcLoading.value && kind.value === "audio" && resolvedSrc.value && (
            <HMediaPlayer type="audio" src={resolvedSrc.value} />
          )}

          {/* Text / code — markdown + highlight.js via HMarkdownRenderer */}
          {isText.value && (
            <HScrollContainer class="s-attachment-modal-text">
              {props.attachment?.file || resolvedSrc.value ? (
                <HMarkdownRenderer
                  content={textContent.value}
                  loading={textLoading.value}
                  plain={textPlain.value}
                />
              ) : (
                <p class="s-attachment-modal-text-empty">
                  {srcError.value
                    ? srcError.value
                    : t("hikari::attachment.noPreview", "No preview available.")}
                </p>
              )}
              {textError.value && (
                <p class="s-attachment-modal-text-error">{textError.value}</p>
              )}
            </HScrollContainer>
          )}

          {/* Generic file */}
          {!srcLoading.value && kind.value === "other" && !isText.value && (
            <div class="s-attachment-modal-file">
              {fileIcon()}
              <p class="s-attachment-modal-file-name">{props.attachment?.name}</p>
            </div>
          )}

          {srcError.value && kind.value !== "other" && (
            <p class="s-attachment-modal-text-error">{srcError.value}</p>
          )}

          <div class="s-attachment-modal-meta">
            <HBadge variant="muted">{props.attachment?.type || "unknown"}</HBadge>
            <HBadge variant="muted">{formatBytes(props.attachment?.size ?? 0)}</HBadge>
          </div>
        </div>
      </HModal>
    );
  },
});
