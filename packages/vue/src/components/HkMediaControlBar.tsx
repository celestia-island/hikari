import { Maximize, Minimize, Pause, Play, Volume2, VolumeX } from "lucide-vue-next";
import { defineComponent } from "vue";







import HButton from "./HkButton";
import { useI18n } from "../i18n/context";
import HMediaSlider from "./HkMediaSlider";
import "./HkMediaControlBar.scss";


/**
 * Shared transport controls for any media controller — the same bar is used
 * under the audio and video players. Purely presentational: it reflects
 * controller state via props and forwards intents via events. `HMediaSlider`
 * backs both the seek track and the volume track.
 */
export function formatMediaTime(sec: number): string {
  if (!Number.isFinite(sec) || sec < 0) sec = 0;
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export default defineComponent({
  name: "HkMediaControlBar",
  props: {
    playing: { type: Boolean, default: false },
    current: { type: Number, default: 0 },
    duration: { type: Number, default: 0 },
    progress: { type: Number, default: 0 },
    bufferedPct: { type: Number, default: 0 },
    volume: { type: Number, default: 1 },
    muted: { type: Boolean, default: false },
    rate: { type: Number, default: 1 },
    isFullscreen: { type: Boolean, default: false },
    showFullscreen: { type: Boolean, default: false },
    disabled: { type: Boolean, default: false },
  },
  emits: {
    togglePlay: () => true,
    seek: (_ratio: number) => true,
    setVolume: (_v: number) => true,
    toggleMute: () => true,
    cycleRate: () => true,
    toggleFullscreen: () => true,
  },
  setup(props, { emit }) {
    const { t } = useI18n();
    return () => (
      <div class="hk-media-controls">
        <HButton
          variant="ghost"
          size="sm"
          class="hk-media-btn hk-media-play"
          ariaLabel={props.playing ? t("hikari::mediaPlayer.pause", "Pause") : t("hikari::mediaPlayer.play", "Play")}
          onClick={() => emit("togglePlay")}
        >
          {props.playing ? <Pause size={16} /> : <Play size={16} />}
        </HButton>

        <HMediaSlider
          class="hk-media-controls-seek"
          ratio={props.progress / 100}
          buffered={props.bufferedPct / 100}
          disabled={props.disabled || props.duration <= 0}
          ariaLabel={t("hikari::mediaPlayer.seek", "Seek")}
          onUpdate:ratio={(r) => emit("seek", r)}
        />

        <span class="hk-media-time">
          {formatMediaTime(props.current)} / {formatMediaTime(props.duration)}
        </span>

        <div class="hk-media-volume">
          <HButton
            variant="ghost"
            size="sm"
            class="hk-media-btn"
            ariaLabel={props.muted ? t("hikari::mediaPlayer.unmute", "Unmute") : t("hikari::mediaPlayer.mute", "Mute")}
            onClick={() => emit("toggleMute")}
          >
            {props.muted || props.volume === 0 ? <VolumeX size={15} /> : <Volume2 size={15} />}
          </HButton>
          <HMediaSlider
            class="hk-media-controls-vol"
            size="sm"
            ratio={props.muted ? 0 : props.volume}
            ariaLabel={t("hikari::mediaPlayer.volume", "Volume")}
            onUpdate:ratio={(v) => emit("setVolume", v)}
          />
        </div>

        <HButton
          variant="ghost"
          size="sm"
          class="hk-media-btn hk-media-rate"
          ariaLabel={t("hikari::mediaPlayer.speed", "Playback speed")}
          onClick={() => emit("cycleRate")}
        >
          {props.rate}x
        </HButton>

        {props.showFullscreen && (
          <HButton
            variant="ghost"
            size="sm"
            class="hk-media-btn"
            ariaLabel={props.isFullscreen ? t("hikari::mediaPlayer.exitFullscreen", "Exit fullscreen") : t("hikari::mediaPlayer.fullscreen", "Fullscreen")}
            onClick={() => emit("toggleFullscreen")}
          >
            {props.isFullscreen ? <Minimize size={15} /> : <Maximize size={15} />}
          </HButton>
        )}
      </div>
    );
  },
});
