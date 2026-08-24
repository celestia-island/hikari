import { computed, defineComponent, ref, watch, type PropType } from "vue";
import { Mic, MicOff, Paperclip, Play, Send, X } from "lucide-vue-next";
import {
  HButton,
  HInput,
  HProgressRing,
  HScrollContainer,
} from "@celestia-island/hikari";

import type { HAttachmentItem, HVoiceState } from "./HkChatTypes";
import { HkVoiceInputPopup } from "./HkVoiceInputPopup";
import { formatBytes } from "../utils/format";
import { useI18n } from "../i18n/context";

import "./HkRichInput.scss";

function isMediaFile(type: string): boolean {
  return type.startsWith("image/") || type.startsWith("video/");
}

function isVideoFile(type: string): boolean {
  return type.startsWith("video/");
}

/**
 * HkRichInput — the canonical chat composer.
 * (Upstreamed from shittim-chest's plana-legacy layer.)
 *
 * Auto-grow textarea + Enter-to-send (Shift+Enter for newline) + send
 * button + optional left-side attachment strip and optional right-side
 * voice button. Pure presentation: the parent owns upload/voice state and
 * feeds it back via `attachments` / `voice` props.
 *
 * ## Slots
 *
 * - `above` — context-specific UI above the input row (mention menus,
 *   option chips, error banners, etc.). Parent-owned.
 * - `voice` — full replacement for the mic button.
 * - `send`  — full replacement for the send button (parent handles submit).
 */
export const HkRichInput = defineComponent({
  name: "HkRichInput",
  props: {
    modelValue: { type: String, default: "" },
    placeholder: { type: String, default: "" },
    loading: { type: Boolean, default: false },
    disabled: { type: Boolean, default: false },
    /** Number of textarea rows (default 1 for inline, 5 for expanded). */
    rows: { type: Number, default: 1 },
    /** Enable auto-grow for the textarea. */
    autoGrow: { type: Boolean, default: false },
    /** Override the "empty input ⇒ disabled" gate. */
    canSubmit: {
      type: [Boolean, null] as unknown as PropType<boolean | null>,
      default: null,
    },
    /** Send button text label (if omitted, icon-only). */
    sendLabel: { type: String, default: undefined },
    /** Keyboard shortcut hint shown on the send button (e.g. "Enter"). */
    sendShortcutLabel: { type: String, default: undefined },
    /** Enter sends the message. Shift+Enter always inserts a newline. */
    sendOnEnter: { type: Boolean, default: true },
    /** Hide the send button entirely — the parent handles submit. */
    hideSend: { type: Boolean, default: false },
    /** Hide the attachment button + attachment strip. */
    hideAttachments: { type: Boolean, default: false },
    /** Hide the mic button. */
    hideMic: { type: Boolean, default: false },
    /** Mic button aria-label override. */
    micLabel: { type: String, default: undefined },
    /**
     * Voice state fed by the parent (e.g. from a voice-input
     * composable). When null the mic button emits `voiceToggle` but no
     * popup is rendered.
     */
    voice: { type: Object as PropType<HVoiceState | null>, default: null },
    /** Attachment strip rows — parent-owned upload state. */
    attachments: {
      type: Array as PropType<HAttachmentItem[]>,
      default: () => [],
    },
    /** Accept drag-and-drop, emitting `dropFiles`. */
    draggable: { type: Boolean, default: true },
  },
  emits: {
    "update:modelValue": (_v: string) => true,
    submit: (_text: string, _attachments?: HAttachmentItem[]) => true,
    keydown: (_e: KeyboardEvent) => true,
    pickAttachment: () => true,
    removeAttachment: (_id: string) => true,
    previewAttachment: (_item: HAttachmentItem) => true,
    dropFiles: (_files: File[]) => true,
    voiceToggle: () => true,
    voiceClose: () => true,
    voiceOpenSettings: () => true,
  },
  setup(props, { emit, slots }) {
    const { t } = useI18n();
    const micBtnRef = ref<HTMLElement | null>(null);
    const bodyRef = ref<HTMLElement | null>(null);
    const dragOver = ref(false);

    const attachmentsEnabled = computed(() => !props.hideAttachments);
    const voiceEnabled = computed(() => !props.hideMic);
    const recording = computed(() => props.voice?.mode === "listening");
    const transcribing = computed(() => !!props.voice?.transcribing);

    const submitAllowed = computed(() => {
      if (props.loading) return false;
      if (props.disabled) return false;
      if (props.canSubmit !== null) return props.canSubmit;
      return props.modelValue.trim().length > 0;
    });

    function handleSubmit() {
      if (!submitAllowed.value) return;
      emit("submit", props.modelValue.trim(), props.attachments.length ? props.attachments : undefined);
    }

    function handleKeydown(e: KeyboardEvent) {
      emit("keydown", e);
      if (e.defaultPrevented) return;
      if (e.key === "Enter" && !e.shiftKey && props.sendOnEnter) {
        e.preventDefault();
        handleSubmit();
      }
    }

    function handleDragOver(e: DragEvent) {
      if (!props.draggable || !attachmentsEnabled.value) return;
      e.preventDefault();
      dragOver.value = true;
    }

    function handleDragLeave(e: DragEvent) {
      const el = bodyRef.value;
      if (!props.draggable || !attachmentsEnabled.value) return;
      if (!el || (e.relatedTarget && el.contains(e.relatedTarget as Node))) return;
      dragOver.value = false;
    }

    function handleDrop(e: DragEvent) {
      if (!props.draggable || !attachmentsEnabled.value) return;
      e.preventDefault();
      dragOver.value = false;
      const files = Array.from(e.dataTransfer?.files ?? []);
      if (files.length) emit("dropFiles", files);
    }

    // Register paste listener on the body element via native addEventListener
    // (Vue JSX onPaste can miss events depending on focus path).
    watch(bodyRef, (el, _, onCleanup) => {
      if (!el || !attachmentsEnabled.value) return;
      const onPaste = (e: Event) => {
        const files = Array.from((e as ClipboardEvent).clipboardData?.files ?? []);
        if (files.length) emit("dropFiles", files);
      };
      el.addEventListener("paste", onPaste);
      onCleanup(() => el.removeEventListener("paste", onPaste));
    });

    return () => (
      <div class="s-rich-input">
        {slots.above?.()}

        {/* Attachment strip */}
        {attachmentsEnabled.value && props.attachments.length > 0 && (
          <div class="s-rich-input-attachments-wrap">
            <HScrollContainer axis="horizontal" class="s-rich-input-attachments-scroll">
              <div class="s-rich-input-attachments">
                {props.attachments
                  .filter((a) => isMediaFile(a.type) && !!a.preview)
                  .map((a) => {
                    const ready = (a.progress ?? 100) >= 100;
                    const video = isVideoFile(a.type);
                    return (
                      <div key={a.id} class="s-rich-input-attachment" data-variant="media"
                        onClick={() => ready && emit("previewAttachment", a)}>
                        <div class="s-rich-input-attachment-thumb">
                          {video ? (
                            <>
                              <video src={a.preview} muted playsinline preload="metadata" />
                              <span class="s-rich-input-attachment-play"><Play size={16} /></span>
                            </>
                          ) : (
                            <img src={a.preview} alt={a.name} />
                          )}
                          {!ready && (
                            <div class="s-rich-input-attachment-progress">
                              <HProgressRing pct={a.progress ?? 0} size={20} strokeWidth={2} />
                            </div>
                          )}
                        </div>
                        <HButton variant="ghost" size="sm" class="s-rich-input-attachment-remove"
                          ariaLabel={t("hikari::chat.removeAttachment", "Delete")}
                          onClick={(e: MouseEvent) => { e.stopPropagation(); emit("removeAttachment", a.id); }}>
                          <X size={12} />
                        </HButton>
                      </div>
                    );
                  })}
                {props.attachments
                  .filter((a) => !(isMediaFile(a.type) && !!a.preview))
                  .map((a) => {
                    const ready = (a.progress ?? 100) >= 100;
                    return (
                      <div key={a.id} class="s-rich-input-attachment" data-variant="file"
                        onClick={() => ready && emit("previewAttachment", a)}>
                        <div class="s-rich-input-attachment-chip">
                          {!ready && (
                            <HProgressRing pct={a.progress ?? 0} size={14} strokeWidth={1.5} />
                          )}
                          <span class="s-rich-input-attachment-chip-name" title={a.name}>{a.name}</span>
                          <span class="s-rich-input-attachment-chip-size">{formatBytes(a.size)}</span>
                        </div>
                        <HButton variant="ghost" size="sm" class="s-rich-input-attachment-remove"
                          ariaLabel={t("hikari::chat.removeAttachment", "Delete")}
                          onClick={(e: MouseEvent) => { e.stopPropagation(); emit("removeAttachment", a.id); }}>
                          <X size={10} />
                        </HButton>
                      </div>
                    );
                  })}
              </div>
            </HScrollContainer>
          </div>
        )}

        {/* Drag overlay */}
        {attachmentsEnabled.value && dragOver.value && (
          <div class="s-rich-input-drag-overlay">
            <Paperclip size={32} />
            <span>{t("hikari::chat.dropFilesHere", "Drop files here to attach")}</span>
          </div>
        )}

        {/* Textarea */}
        <div
          ref={bodyRef}
          class={[
            "s-rich-input-body",
            dragOver.value ? "is-drag-over" : "",
          ].filter(Boolean).join(" ")}
          onDragover={handleDragOver}
          onDragleave={handleDragLeave}
          onDrop={handleDrop}
        >
          <HInput
            class="s-rich-input-textarea"
            modelValue={props.modelValue}
            onUpdate:modelValue={(v: string) => emit("update:modelValue", v)}
            type="textarea"
            rows={props.rows}
            autoGrow={props.autoGrow}
            placeholder={props.placeholder}
            disabled={props.disabled}
            onKeydown={handleKeydown}
          />
        </div>

        {/* Tools row */}
        <div class="s-rich-input-tools">
          {/* Paperclip */}
          {attachmentsEnabled.value && (
            <HButton
              variant="ghost"
              size="sm"
              class="s-rich-input-tool-btn"
              ariaLabel={t("hikari::chat.attachFile", "Attach file")}
              onClick={() => emit("pickAttachment")}
              disabled={props.disabled}
            >
              <Paperclip size={16} />
            </HButton>
          )}

          <div class="s-rich-input-spacer" />

          {/* Mic */}
          {voiceEnabled.value && (
            slots.voice ? (
              slots.voice({ recording: recording.value, transcribing: transcribing.value })
            ) : (
              <span ref={micBtnRef} class="s-rich-input-mic-anchor">
                <HButton
                  variant="ghost"
                  size="sm"
                  class={[
                    "s-rich-input-tool-btn",
                    "s-rich-input-mic",
                    recording.value ? "is-recording" : "",
                  ].filter(Boolean).join(" ")}
                  ariaLabel={props.micLabel ?? t("hikari::chat.voiceInput", "Voice input")}
                  onClick={() => emit("voiceToggle")}
                  disabled={transcribing.value || props.disabled}
                >
                  {recording.value ? <MicOff size={16} /> : <Mic size={16} />}
                </HButton>
                {props.voice && (
                  <HkVoiceInputPopup
                    open={props.voice.open}
                    mode={props.voice.mode}
                    anchorRef={micBtnRef.value}
                    onClose={() => emit("voiceClose")}
                    onOpenSettings={() => emit("voiceOpenSettings")}
                  />
                )}
              </span>
            )
          )}

          {/* Send */}
          {!props.hideSend && (
            slots.send ? (
              slots.send({ canSubmit: submitAllowed.value, submit: handleSubmit })
            ) : (
              <HButton
                variant="primary"
                size="sm"
                loading={props.loading}
                disabled={!submitAllowed.value}
                onClick={handleSubmit}
                shortcut={props.sendShortcutLabel}
                aria-label={props.sendLabel ?? t("hikari::chat.send", "Send")}
              >
                <Send size={14} />
                {props.sendLabel && <span>{props.sendLabel}</span>}
              </HButton>
            )
          )}
        </div>
      </div>
    );
  },
});
