import {
  computed,
  defineComponent,
  onMounted,
  ref,
  watch,
  type PropType,
} from "vue";

import { useI18n } from "../i18n/context";
import {
  qrMatrix,
  qrReady,
  QrNotReadyError,
  type QrErrorCorrectionLevel,
} from "../utils/qr/qrEncoder";
import "./HkQrCode.scss";

/**
 * HkQrCode — render a scannable QR code from an arbitrary string value
 * (typically an `otpauth://` URI).
 *
 * The QR is always rendered as dark modules on a white card (independent of
 * the app theme) so it stays scannable in dark mode, matching the pattern of
 * authenticator apps. Rendering goes to a `<canvas>` (crisp at any scale and
 * device-pixel-ratio). Re-encodes whenever `value` changes.
 *
 * Contract:
 *   - `value` is the payload (e.g. an otpauth URI); empty/whitespace renders
 *     nothing.
 *   - `size` is the rendered CSS size in px; the canvas backing store is
 *     scaled by the device pixel ratio so module edges stay sharp.
 *   - `inverse` swaps dark/light (advanced use; the default light card is the
 *     high-contrast, always-scannable choice).
 */
export const HkQrCode = defineComponent({
  name: "HkQrCode",
  props: {
    /** Payload to encode. Render nothing when empty. */
    value: { type: String, default: "" },
    /** Rendered CSS size in px (square). Default 168. */
    size: { type: Number, default: 168 },
    /** Quiet-zone width in modules. Default 2. */
    margin: { type: Number, default: 2 },
    /** Error-correction level. Default "M". */
    level: { type: String as PropType<QrErrorCorrectionLevel>, default: "M" },
    colorDark: { type: String, default: "#000000" },
    colorLight: { type: String, default: "#ffffff" },
    /** Swap dark/light (use with a dark card only). Default false. */
    inverse: { type: Boolean, default: false },
    /** Optional caption shown under the QR. */
    label: { type: String, default: "" },
    disabled: { type: Boolean, default: false },
  },
  setup(props) {
    const { t } = useI18n();
    const canvasRef = ref<HTMLCanvasElement | null>(null);

    // At most ONE ready-retry per component. Cleared only by a successful draw,
    // so a `qrReady` that has already settled plus a `qrMatrix` that keeps
    // refusing cannot schedule itself again — measured without this bound: the
    // redraw chain never ends and the page dies of OOM before a test can report.
    let retriedAfterReady = false;

    const dark = computed(() => (props.inverse ? props.colorLight : props.colorDark));
    const light = computed(() => (props.inverse ? props.colorDark : props.colorLight));
    const hasValue = computed(() => props.value.trim().length > 0);

    function draw() {
      if (!canvasRef.value || !hasValue.value) return;
      if (typeof document === "undefined") return; // SSR guard
      const canvas = canvasRef.value;
      let matrix: boolean[][];
      try {
        matrix = qrMatrix(props.value, {
          errorCorrectionLevel: props.level,
        });
      } catch (error) {
        if (error instanceof QrNotReadyError) {
          // Surfaced, not swallowed: a component that fails to load must not
          // leave a silently blank canvas — but it may only ask once.
          if (retriedAfterReady) {
            console.error("[hikari] QR component still not usable after it reported ready");
            return;
          }
          retriedAfterReady = true;
          void qrReady
            .then(() => draw())
            .catch((readyError) => {
              console.error("[hikari] QR component failed to load", readyError);
            });
          return;
        }
        throw error;
      }
      retriedAfterReady = false; // a real matrix means the surface works again
      const count = matrix.length;
      const totalModules = count + props.margin * 2;
      const dpr = (typeof window !== "undefined" && window.devicePixelRatio) || 1;
      const cssSize = props.size;
      const backing = Math.round(cssSize * dpr);
      canvas.width = backing;
      canvas.height = backing;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      // Fill the quiet-zone / background.
      ctx.fillStyle = light.value;
      ctx.fillRect(0, 0, backing, backing);
      const cell = backing / totalModules;
      // Draw each dark module (quiet zone = margin offset).
      for (let row = 0; row < count; row++) {
        for (let col = 0; col < count; col++) {
          if (matrix[row][col]) {
            ctx.fillStyle = dark.value;
            ctx.fillRect(
              (props.margin + col) * cell,
              (props.margin + row) * cell,
              cell + 0.5, // slight overlap avoids hairline seams on scaled canvases
              cell + 0.5,
            );
          }
        }
      }
    }

    onMounted(draw);
    watch(
      () => [props.value, props.size, props.margin, props.level, props.colorDark, props.colorLight, props.inverse],
      draw,
    );

    const ariaLabel = computed(
      () => props.label || t("hikari::qrCode.alt", "QR code"),
    );

    return () => (
      <div class="hk-qr-card" data-empty={hasValue.value ? undefined : true}>
        {hasValue.value ? (
          <canvas
            ref={canvasRef}
            class="hk-qr-canvas"
            role="img"
            aria-label={ariaLabel.value}
            style={{ width: `${props.size}px`, height: `${props.size}px` }}
          />
        ) : null}
        {props.label ? <div class="hk-qr-label">{props.label}</div> : null}
      </div>
    );
  },
});

export default HkQrCode;
