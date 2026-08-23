import { computed, defineComponent, onBeforeUnmount, ref, watch, type PropType } from "vue";

import { clampRgbToBands, hueDelta, rgbToHsl, wrapHue, type HueClamp } from "../theme/tokenGroups";
import { useOverlay } from "../runtime/useOverlay";
import HInput from "./HkInput";
import HPopover from "./HkPopover";
import "./HkColorPicker.scss";

const CHANNELS = [
  { key: "r", label: "R" },
  { key: "g", label: "G" },
  { key: "b", label: "B" },
] as const;

type Channel = "r" | "g" | "b";

function clamp(v: number, min = 0, max = 255): number {
  return Math.max(min, Math.min(max, v));
}

function rgbToHex(r: number, g: number, b: number): string {
  return (
    "#" +
    [r, g, b]
      .map((v) => clamp(v).toString(16).padStart(2, "0"))
      .join("")
  );
}

function channelGradient(r: number, g: number, b: number, ch: Channel): string {
  const from: Record<Channel, string> = {
    r: rgbToHex(0, g, b),
    g: rgbToHex(r, 0, b),
    b: rgbToHex(r, g, 0),
  };
  const to: Record<Channel, string> = {
    r: rgbToHex(255, g, b),
    g: rgbToHex(r, 255, b),
    b: rgbToHex(r, g, 255),
  };
  return `linear-gradient(to right, ${from[ch]}, ${to[ch]})`;
}

const ColorSlider = defineComponent({
  name: "HkColorSlider",
  props: {
    value: { type: Number, required: true },
    r: { type: Number, required: true },
    g: { type: Number, required: true },
    b: { type: Number, required: true },
    channel: { type: String as () => Channel, required: true },
  },
  emits: {
    change: (_value: number) => true,
  },
  setup(props, { emit }) {
    const trackRef = ref<HTMLElement>();
    let dragging = false;

    function getValueFromX(clientX: number): number {
      // Live rect per event: the panel is position:fixed and the slider
      // carries touch-action:none, so reads are cheap and stay correct even
      // if a desktop window resize repositions the popover mid-drag.
      const rect = trackRef.value?.getBoundingClientRect();
      if (!rect || rect.width === 0) return props.value;
      const pct = clamp((clientX - rect.left) / rect.width, 0, 1);
      return Math.round(pct * 255);
    }

    // Move/up listeners live on the WINDOW (added on down, removed on
    // up/cancel). setPointerCapture alone should route every move to the
    // slider, but mobile Safari has long-standing capture quirks under
    // compositing; window-level listeners make the drag track the finger
    // regardless. pointercancel (browser reclaims the gesture) must reset
    // dragging or the slider sticks to the next stray move.
    function onWindowPointerMove(e: PointerEvent) {
      if (!dragging) return;
      e.preventDefault();
      emit("change", getValueFromX(e.clientX));
    }

    function endDrag() {
      dragging = false;
      window.removeEventListener("pointermove", onWindowPointerMove);
      window.removeEventListener("pointerup", endDrag);
      window.removeEventListener("pointercancel", endDrag);
    }

    // A drag in flight must never leak listeners past unmount (e.g. the
    // sheet closing mid-drag tears the panel down).
    onBeforeUnmount(endDrag);

    function onPointerDown(e: PointerEvent) {
      dragging = true;
      try {
        (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      } catch {
        // Capture is best-effort; the window listeners carry the drag.
      }
      window.addEventListener("pointermove", onWindowPointerMove, { passive: false });
      window.addEventListener("pointerup", endDrag);
      window.addEventListener("pointercancel", endDrag);
      emit("change", getValueFromX(e.clientX));
    }

    const pct = computed(() => (props.value / 255) * 100);

    return () => (
      <div
        class="hk-color-picker-channel-slider"
        onPointerdown={onPointerDown}
        onPointerup={endDrag}
        onPointercancel={endDrag}
      >
        <div
          ref={trackRef}
          class="hk-color-picker-slider-track"
          style={{ background: channelGradient(props.r, props.g, props.b, props.channel) }}
        />
        <div
          class="hk-color-picker-slider-thumb"
          style={{ left: `${pct.value}%` }}
        />
      </div>
    );
  },
});

export default defineComponent({
  name: "HkColorPicker",
  props: {
    r: { type: Number, required: true },
    g: { type: Number, required: true },
    b: { type: Number, required: true },
    label: { type: String, default: "" },
    /**
     * Trigger layout: "stack" (swatch above label — dialogs with few
     * colors) or "row" (swatch left, single-line label right with
     * ellipsis — dense grids that must show full color names).
     */
    layout: { type: String as PropType<"stack" | "row">, default: "stack" },
    /** Optional physical-color clamp: hue locked to center±range (degrees, circular). */
    hueClamp: { type: Object as PropType<HueClamp>, default: undefined },
    /** Optional saturation safe band, 0–1. */
    sRange: { type: Array as unknown as PropType<[number, number]>, default: undefined },
    /** Optional lightness safe band, 0–1. */
    lRange: { type: Array as unknown as PropType<[number, number]>, default: undefined },
  },
  emits: {
    change: (_rgb: { r: number; g: number; b: number }) => true,
  },
  setup(props, { emit }) {
    const isOpen = ref(false);
    const triggerRef = ref<HTMLElement>();

    // Registered with the overlay registry so closeAll()/isOverlayOpen()
    // see the open popout; the popover inside handles z-stacking via the
    // popup manager. The onCloseRequested hook makes a global closeAll()
    // flip this component's own open ref, which tears the popover down.
    const overlay = useOverlay({
      name: "hk-color-picker",
      onCloseRequested: () => { isOpen.value = false; },
    });

    watch(isOpen, (open) => {
      if (open) overlay.open();
      else overlay.close();
    });

    onBeforeUnmount(() => {
      overlay.close();
    });

    const hex = computed(() => rgbToHex(props.r, props.g, props.b));
    const hexDisplay = computed(() => hex.value.replace(/^#/, ""));

    // Defense in depth: every emitted value passes through the same band
    // clamping the host applies on save.
    function clampRGB(rgb: { r: number; g: number; b: number }) {
      return clampRgbToBands(rgb, props.hueClamp, props.sRange, props.lRange);
    }

    function updateChannel(ch: Channel, value: number) {
      const next = { r: props.r, g: props.g, b: props.b };
      next[ch] = clamp(value);
      emit("change", clampRGB(next));
    }

    function onHexInput(v: string) {
      if (/^[0-9a-fA-F]{0,6}$/.test(v) && v.length === 6) {
        emit("change", clampRGB({
          r: parseInt(v.slice(0, 2), 16),
          g: parseInt(v.slice(2, 4), 16),
          b: parseInt(v.slice(4, 6), 16),
        }));
      }
    }

    // Visual affordance for the allowed hue band: a swatch strip of the
    // permitted arc with the current color sitting at its position.
    const hueBand = computed(() => {
      const hc = props.hueClamp;
      if (!hc || hc.range <= 0) return null;
      const center = wrapHue(hc.center);
      const from = center - hc.range;
      const to = center + hc.range;
      const gradient = `linear-gradient(to right, hsl(${from}, 70%, 50%), hsl(${center}, 70%, 50%), hsl(${to}, 70%, 50%))`;
      const delta = Math.max(-hc.range, Math.min(hc.range, hueDelta(rgbToHsl({ r: props.r, g: props.g, b: props.b }).h, center)));
      const pct = ((delta + hc.range) / (2 * hc.range)) * 100;
      return { gradient, pct: Math.max(0, Math.min(100, pct)) };
    });

    const bandCaption = computed(() => {
      const parts: string[] = [];
      if (props.sRange) parts.push(`S ${Math.round(props.sRange[0] * 100)}–${Math.round(props.sRange[1] * 100)}%`);
      if (props.lRange) parts.push(`L ${Math.round(props.lRange[0] * 100)}–${Math.round(props.lRange[1] * 100)}%`);
      return parts.length > 0 ? parts.join(" · ") : null;
    });

    return () => (
      <div class="hk-color-picker" data-layout={props.layout}>
        <button
          ref={triggerRef}
          type="button"
          class="hk-color-picker-swatch-btn"
          onClick={() => { isOpen.value = !isOpen.value; }}
        >
          <div
            class="hk-color-picker-swatch"
            style={{ background: hex.value }}
          />
          {props.label && (
            <span class="hk-color-picker-label">{props.label}</span>
          )}
        </button>
        <HPopover
          modelValue={isOpen.value}
          onUpdate:modelValue={(v: boolean) => { isOpen.value = v; }}
          anchorRef={triggerRef.value ?? null}
          placement="bottom-start"
          offset={6}
          backdrop={false}
          sheetOnMobile
          class="hk-color-picker-panel"
        >
          <div class="hk-color-picker-body">
            <div class="hk-color-picker-controls">
              <div class="hk-color-picker-sliders">
                {CHANNELS.map((def) => (
                  <div key={def.key} class="hk-color-picker-slider-row">
                    <span class="hk-color-picker-slider-label">
                      {def.label}
                    </span>
                    <ColorSlider
                      value={props[def.key]}
                      r={props.r}
                      g={props.g}
                      b={props.b}
                      channel={def.key}
                      onChange={(v: number) => updateChannel(def.key, v)}
                    />
                    <span class="hk-color-picker-slider-value">
                      {props[def.key]}
                    </span>
                  </div>
                ))}
              </div>

              <div class="hk-color-picker-hex-row">
                <HInput
                  modelValue={hexDisplay.value}
                  onUpdate:modelValue={onHexInput}
                >
                  {{
                    prefixIcon: () => (
                      <span class="hk-color-picker-hex-hash">#</span>
                    ),
                  }}
                </HInput>
              </div>

              {hueBand.value && (
                <div class="hk-color-picker-band">
                  <div
                    class="hk-color-picker-hue-band"
                    style={{ background: hueBand.value.gradient }}
                  >
                    <div
                      class="hk-color-picker-hue-band-thumb"
                      style={{ left: `${hueBand.value.pct}%`, background: hex.value }}
                    />
                  </div>
                  {bandCaption.value && (
                    <div class="hk-color-picker-band-caption">
                      {bandCaption.value}
                    </div>
                  )}
                </div>
              )}
              {!hueBand.value && bandCaption.value && (
                <div class="hk-color-picker-band-caption">
                  {bandCaption.value}
                </div>
              )}
            </div>
          </div>
        </HPopover>
      </div>
    );
  },
});
