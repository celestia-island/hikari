import { computed, defineComponent, ref } from "vue";

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
      const el = trackRef.value;
      if (!el) return props.value;
      const rect = el.getBoundingClientRect();
      const pct = clamp((clientX - rect.left) / rect.width, 0, 1);
      return Math.round(pct * 255);
    }

    function onPointerDown(e: PointerEvent) {
      dragging = true;
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      emit("change", getValueFromX(e.clientX));
    }

    function onPointerMove(e: PointerEvent) {
      if (!dragging) return;
      emit("change", getValueFromX(e.clientX));
    }

    function onPointerUp() {
      dragging = false;
    }

    const pct = computed(() => (props.value / 255) * 100);

    return () => (
      <div
        class="hk-color-picker-channel-slider"
        onPointerdown={onPointerDown}
        onPointermove={onPointerMove}
        onPointerup={onPointerUp}
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
  },
  emits: {
    change: (_rgb: { r: number; g: number; b: number }) => true,
  },
  setup(props, { emit }) {
    const isOpen = ref(false);
    const triggerRef = ref<HTMLElement>();

    const hex = computed(() => rgbToHex(props.r, props.g, props.b));
    const hexDisplay = computed(() => hex.value.replace(/^#/, ""));

    function updateChannel(ch: Channel, value: number) {
      const next = { r: props.r, g: props.g, b: props.b };
      next[ch] = clamp(value);
      emit("change", next);
    }

    function onHexInput(v: string) {
      if (/^[0-9a-fA-F]{0,6}$/.test(v) && v.length === 6) {
        emit("change", {
          r: parseInt(v.slice(0, 2), 16),
          g: parseInt(v.slice(2, 4), 16),
          b: parseInt(v.slice(4, 6), 16),
        });
      }
    }

    return () => (
      <div class="hk-color-picker">
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
            </div>
          </div>
        </HPopover>
      </div>
    );
  },
});
