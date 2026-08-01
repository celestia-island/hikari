import { defineComponent, onBeforeUnmount, ref, watch, type PropType, type Ref } from "vue";

import { onFrame, type AnimationHandle } from "../runtime/animationBus";
import "./HkMediaVisualizer.scss";

/**
 * Pluggable audio spectrum visualiser. Point it at any media element ref and
 * it draws an analyser-driven frequency bar chart while that element plays
 * (and stops otherwise). Self-contained WebAudio wiring — the
 * `MediaElementAudioSourceNode` is created lazily and only once per element.
 *
 * The draw loop registers with the unified animation bus via `onFrame`
 * (sync priority) rather than a private rAF, so it shares the same loop
 * lifecycle as every other per-frame consumer and the bus's
 * idle-auto-shutdown applies to it too.
 */
export default defineComponent({
  name: "HkMediaVisualizer",
  props: {
    mediaRef: {
      type: Object as PropType<Ref<HTMLMediaElement | null>>,
      required: true,
    },
  },
  setup(props) {
    const canvasRef = ref<HTMLCanvasElement | null>(null);
    let audioCtx: AudioContext | null = null;
    let analyser: AnalyserNode | null = null;
    let source: MediaElementAudioSourceNode | null = null;
    let frameHandle: AnimationHandle | null = null;

    function start() {
      const media = props.mediaRef.value;
      const canvas = canvasRef.value;
      if (!media || !canvas) return;
      try {
        if (!audioCtx) {
          audioCtx = new (window.AudioContext ||
            (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
          analyser = audioCtx.createAnalyser();
          analyser.fftSize = 128;
          source = audioCtx.createMediaElementSource(media);
          source.connect(analyser);
          analyser.connect(audioCtx.destination);
        }
        if (audioCtx.state === "suspended") void audioCtx.resume();
      } catch {
        return;
      }
      const ctx2d = canvas.getContext("2d");
      if (!ctx2d || !analyser) return;
      canvas.width = canvas.clientWidth * 2;
      canvas.height = canvas.clientHeight * 2;
      const data = new Uint8Array(analyser.frequencyBinCount);

      function draw() {
        if (!analyser || !ctx2d || !canvas) return;
        analyser.getByteFrequencyData(data);
        const w = canvas.width;
        const h = canvas.height;
        ctx2d.clearRect(0, 0, w, h);
        const n = data.length;
        const bw = w / n;
        for (let i = 0; i < n; i++) {
          const v = data[i] / 255;
          const bh = v * h * 0.85;
          const hue = 200 + (i / n) * 80;
          ctx2d.fillStyle = `hsl(${hue}, 70%, 55%)`;
          ctx2d.fillRect(i * bw, h - bh, bw - 1, bh);
        }
        // No self-reschedule — onFrame keeps firing until disconnect().
      }

      // Drop any prior handle (e.g. a replay after pause) before subscribing.
      if (frameHandle) {
        frameHandle.disconnect();
        frameHandle = null;
      }
      frameHandle = onFrame(draw, "sync");
    }

    function stop() {
      if (frameHandle) {
        frameHandle.disconnect();
        frameHandle = null;
      }
    }

    let cleanupListeners: (() => void) | null = null;
    function attach(media: HTMLMediaElement | null) {
      cleanupListeners?.();
      cleanupListeners = null;
      if (!media) return;
      media.addEventListener("play", start);
      media.addEventListener("pause", stop);
      media.addEventListener("ended", stop);
      cleanupListeners = () => {
        media.removeEventListener("play", start);
        media.removeEventListener("pause", stop);
        media.removeEventListener("ended", stop);
      };
    }

    watch(() => props.mediaRef.value, attach, { immediate: true });

    onBeforeUnmount(() => {
      stop();
      cleanupListeners?.();
      source?.disconnect();
      analyser?.disconnect();
      audioCtx?.close().catch(() => {});
      audioCtx = null;
      analyser = null;
      source = null;
    });

    return () => <canvas ref={canvasRef} class="hk-media-visualizer" />;
  },
});
