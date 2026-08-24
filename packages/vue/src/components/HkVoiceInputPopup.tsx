import { defineComponent, type PropType } from "vue";
import { HPopover, HSpinner } from "@celestia-island/hikari";
import type { PopupPlacement } from "@celestia-island/hikari";

import type { HVoicePopupMode } from "./HkChatTypes";
import { useI18n } from "../i18n/context";

import "./HkVoiceInputPopup.scss";

/**
 * HkVoiceInputPopup — shared, anchored voice-input popup.
 * (Upstreamed from shittim-chest's plana-legacy layer.)
 *
 * One component, three faces, driven by a `HVoiceState`:
 *
 *   - `notConfigured` — Whisper isn't set up; offers a deep link to the
 *     admin voice page so the user can install it.
 *   `listening`     — an animated CSS waveform so the user sees capture
 *     is live. Tap the mic again (handled by the caller) to stop.
 *   - `transcribing`  — a quiet spinner while the final window is recognized.
 *
 * The popup owns no state — the caller feeds `open` / `mode` and emits
 * `close` / `openSettings`. Every voice button (chat input, expanded
 * composer, keyword search) renders this popup anchored to its mic button.
 */
export const HkVoiceInputPopup = defineComponent({
  name: "HkVoiceInputPopup",
  props: {
    open: { type: Boolean, default: false },
    mode: {
      type: String as PropType<HVoicePopupMode>,
      default: "listening",
    },
    anchorRef: { type: Object as PropType<HTMLElement | null>, default: null },
    placement: {
      type: String as PropType<PopupPlacement>,
      default: "top",
    },
    offset: { type: Number, default: 8 },
  },
  emits: {
    close: () => true,
    openSettings: () => true,
  },
  setup(props, { emit }) {
    const { t } = useI18n();

    function openSettings() {
      emit("openSettings");
    }

    return () => (
      <HPopover
        modelValue={props.open}
        onUpdate:modelValue={(v: boolean) => { if (!v) emit("close"); }}
        placement={props.placement}
        offset={props.offset}
        anchorRef={props.anchorRef}
        closeOnBackdrop={false}
        closeOnEscape={true}
        class="s-voice-popup"
      >
        {props.mode === "notConfigured" ? (
          <div class="s-voice-popup-body" data-phase="install">
            <p class="s-voice-popup-text">
              {t("hikari::chat.voice_not_configured", "Voice input requires the Whisper service.")}
            </p>
            <button class="s-voice-popup-link" type="button" onClick={openSettings}>
              {t("hikari::chat.voice_go_settings", "Open Voice Settings →")}
            </button>
          </div>
        ) : (
          <div class="s-voice-popup-body" data-phase={props.mode}>
            {props.mode === "listening" ? (
              <div class="s-voice-wave" aria-hidden="true">
                <span class="s-voice-wave-bar" />
                <span class="s-voice-wave-bar" />
                <span class="s-voice-wave-bar" />
                <span class="s-voice-wave-bar" />
                <span class="s-voice-wave-bar" />
              </div>
            ) : (
              <span class="s-voice-popup-spinner">
                <HSpinner size="xs" />
              </span>
            )}
            <span class="s-voice-popup-hint">
              {props.mode === "listening"
                ? t("hikari::chat.listening", "Listening… tap to stop")
                : t("hikari::chat.transcribing", "Transcribing…")}
            </span>
          </div>
        )}
      </HPopover>
    );
  },
});
