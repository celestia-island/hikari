import { computed, defineComponent, onBeforeUnmount, onMounted, ref, watch, type PropType } from "vue";

import HMediaControlBar from "./HkMediaControlBar";
import HMediaVisualizer from "./HkMediaVisualizer";
import "./HkMediaPlayer.scss";

type MediaKind = "video" | "audio";

/** Playback rate presets cycled by the control bar's rate button. */
export const MEDIA_RATES = [0.5, 1, 1.25, 1.5, 2] as const;

/**
 * Thin media player orchestrator. Owns the `<video>` / `<audio>` element,
 * wires the raw media element events into reactive playback state, and
 * composes the pluggable pieces: `HMediaVisualizer` (audio only) + the
 * shared `HMediaControlBar`. Everything interactive lives in the control
 * bar / slider, so this stays a small shell that's easy to swap or embed.
 */
export default defineComponent({
  name: "HkMediaPlayer",
  props: {
    src: { type: String, required: true },
    type: { type: String as PropType<MediaKind>, required: true },
    poster: { type: String, default: undefined },
  },
  setup(props) {
    const rootRef = ref<HTMLElement | null>(null);
    const mediaRef = ref<HTMLMediaElement | null>(null);

    const playing = ref(false);
    const current = ref(0);
    const duration = ref(0);
    const buffered = ref(0);
    const volume = ref(1);
    const muted = ref(false);
    const rateIdx = ref(1);
    const isFullscreen = ref(false);

    const rate = computed(() => MEDIA_RATES[rateIdx.value]);
    const progress = computed(() =>
      duration.value > 0 ? (current.value / duration.value) * 100 : 0,
    );
    const bufferedPct = computed(() =>
      duration.value > 0 ? (buffered.value / duration.value) * 100 : 0,
    );

    function applyVolume() {
      const m = mediaRef.value;
      if (m) {
        m.volume = volume.value;
        m.muted = muted.value;
      }
    }
    function applyRate() {
      const m = mediaRef.value;
      if (m) m.playbackRate = rate.value;
    }

    function onTimeUpdate() {
      const m = mediaRef.value;
      if (!m) return;
      current.value = m.currentTime;
      if (m.buffered.length) buffered.value = m.buffered.end(m.buffered.length - 1);
    }
    function onDurationChange() {
      const m = mediaRef.value;
      if (m) duration.value = m.duration || 0;
    }
    function onLoadedMetadata() {
      const m = mediaRef.value;
      if (!m) return;
      duration.value = m.duration || 0;
      volume.value = m.volume;
      muted.value = m.muted;
      applyRate();
    }
    function onVolumeChange() {
      const m = mediaRef.value;
      if (!m) return;
      volume.value = m.volume;
      muted.value = m.muted;
    }
    function onPlay() {
      playing.value = true;
    }
    function onPause() {
      playing.value = false;
    }
    function onEnded() {
      playing.value = false;
    }

    let cleanupMedia: (() => void) | null = null;
    function attachMedia(media: HTMLMediaElement | null) {
      cleanupMedia?.();
      cleanupMedia = null;
      if (!media) return;
      media.addEventListener("timeupdate", onTimeUpdate);
      media.addEventListener("durationchange", onDurationChange);
      media.addEventListener("loadedmetadata", onLoadedMetadata);
      media.addEventListener("volumechange", onVolumeChange);
      media.addEventListener("play", onPlay);
      media.addEventListener("pause", onPause);
      media.addEventListener("ended", onEnded);
      cleanupMedia = () => {
        media.removeEventListener("timeupdate", onTimeUpdate);
        media.removeEventListener("durationchange", onDurationChange);
        media.removeEventListener("loadedmetadata", onLoadedMetadata);
        media.removeEventListener("volumechange", onVolumeChange);
        media.removeEventListener("play", onPlay);
        media.removeEventListener("pause", onPause);
        media.removeEventListener("ended", onEnded);
      };
    }

    function onFullscreenChange() {
      isFullscreen.value = !!document.fullscreenElement;
    }

    onMounted(() => {
      document.addEventListener("fullscreenchange", onFullscreenChange);
    });

    onBeforeUnmount(() => {
      cleanupMedia?.();
      document.removeEventListener("fullscreenchange", onFullscreenChange);
    });

    watch(mediaRef, attachMedia, { flush: "post" });

    function togglePlay() {
      const m = mediaRef.value;
      if (!m) return;
      if (m.paused) void m.play();
      else m.pause();
    }
    function seekToRatio(ratio: number) {
      const m = mediaRef.value;
      if (!m || !duration.value) return;
      const r = Math.max(0, Math.min(1, ratio));
      m.currentTime = r * duration.value;
      current.value = m.currentTime;
    }
    function setVolume(v: number) {
      const val = Math.max(0, Math.min(1, v));
      volume.value = val;
      muted.value = val === 0;
      applyVolume();
    }
    function toggleMute() {
      muted.value = !muted.value;
      applyVolume();
    }
    function cycleRate() {
      rateIdx.value = (rateIdx.value + 1) % MEDIA_RATES.length;
      applyRate();
    }
    function toggleFullscreen() {
      const el = rootRef.value;
      if (!el) return;
      if (document.fullscreenElement) void document.exitFullscreen();
      else void el.requestFullscreen?.();
    }

    return () => (
      <div
        ref={rootRef}
        class={[
          "hk-media-player",
          `hk-media-player--${props.type}`,
          isFullscreen.value && "is-fullscreen",
        ].filter(Boolean).join(" ")}
      >
        {props.type === "audio" ? (
          <>
            <HMediaVisualizer mediaRef={mediaRef} />
            <audio ref={mediaRef} src={props.src} />
          </>
        ) : (
          <video
            ref={mediaRef}
            src={props.src}
            poster={props.poster}
            class="hk-media-player-video"
            onClick={togglePlay}
          />
        )}

        <HMediaControlBar
          playing={playing.value}
          current={current.value}
          duration={duration.value}
          progress={progress.value}
          bufferedPct={bufferedPct.value}
          volume={volume.value}
          muted={muted.value}
          rate={rate.value}
          isFullscreen={isFullscreen.value}
          showFullscreen={props.type === "video"}
          onTogglePlay={togglePlay}
          onSeek={seekToRatio}
          onSetVolume={setVolume}
          onToggleMute={toggleMute}
          onCycleRate={cycleRate}
          onToggleFullscreen={toggleFullscreen}
        />
      </div>
    );
  },
});
