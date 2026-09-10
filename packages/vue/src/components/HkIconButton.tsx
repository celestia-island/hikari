import { computed, defineComponent, type PropType } from "vue";
import "./HkIconButton.scss";
import "./HkIconButtonVars.scss";
import HIcon from "./HkIcon";

export default defineComponent({
  name: "HkIconButton",
  inheritAttrs: false,
  props: {
    icon: { type: String, default: "" },
    variant: { type: String as PropType<"ghost" | "primary" | "secondary" | "danger" | "success">, default: "ghost" },
    size: { type: Number as PropType<16 | 24 | 32 | 36 | 40>, default: 32 },
    disabled: { type: Boolean, default: false },
  },
  emits: {
    click: (_e: MouseEvent) => true,
  },
  setup(props, { emit, slots, attrs }) {
    const cls = computed(() => [
      "hk-icon-button",
      `hk-icon-button-${props.size}`,
      `hk-icon-button-${props.variant}`,
    ]);

    // Named-icon contract (2026-09-10 user direction): the icon prop is a
    // first-class way to draw the glyph — it resolves through HIcon so
    // functional keys ("close", "back") keep riding the host material-pack
    // family exactly like the slot composition does. The rendered size is
    // pinned by --hi-icon-button-icon-size; the HIcon size prop only picks
    // the matching box class. Slot content still wins over the prop.
    const glyphSize = computed(() => (props.size >= 32 ? 20 : 16));

    return () => (
      <button
        class={cls.value}
        disabled={props.disabled}
        onClick={(e: MouseEvent) => emit("click", e)}
        {...attrs}
      >
        <span class="hk-icon-button-icon">
          {slots.icon
            ? slots.icon()
            : slots.default
              ? // Natural children usage: <HIconButton><HIcon .../></HIconButton>
                // renders the child as the icon (unified window-close wave).
                slots.default()
              : props.icon
                ? (
                  <HIcon name={props.icon} size={glyphSize.value} />
                )
                : (
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <circle cx="12" cy="12" r="10" />
                  </svg>
                )}
        </span>
      </button>
    );
  },
});
