import { computed, defineComponent, ref, watch } from "vue";
import "./HkExpansionPanel.scss";

/**
 * HkExpansionPanel — Material Design 3 expansion panel.
 *
 * A disclosure container following the MD3 spec: one full-width header row
 * (title + optional subtitle + trailing chevron, the whole row is one
 * button with `aria-expanded`), and a collapsible body that animates with
 * the `grid-template-rows: 0fr → 1fr` technique (smooth without measuring
 * content height — unlike a max-height hack it never clips mid-animation
 * and never dead-ends on `max-height: none`).
 *
 * Open state: pass `modelValue` for a controlled panel, or omit it and set
 * `defaultOpen` for an uncontrolled one. The `action` slot renders in the
 * header's trailing area before the chevron and swallows its own clicks,
 * so inline actions never toggle the panel.
 */
export default defineComponent({
  name: "HkExpansionPanel",
  props: {
    /** Controlled open state; omit for an uncontrolled panel. */
    modelValue: { type: Boolean, default: undefined },
    /** Uncontrolled initial state (used only when `modelValue` is omitted). */
    defaultOpen: { type: Boolean, default: false },
    /** Header title (plain string; callers resolve i18n themselves). */
    title: { type: String, default: "" },
    /** Optional secondary header line. */
    subtitle: { type: String, default: undefined },
    /** Disable the toggle (body stays in its current state). */
    disabled: { type: Boolean, default: false },
  },
  emits: {
    "update:modelValue": (_open: boolean) => true,
    toggle: (_open: boolean) => true,
  },
  setup(props, { emit, slots }) {
    const innerOpen = ref(props.defaultOpen);

    watch(
      () => props.modelValue,
      (value) => {
        if (typeof value === "boolean") innerOpen.value = value;
      },
      { immediate: true },
    );

    const isOpen = computed(() => innerOpen.value);

    function toggle() {
      if (props.disabled) return;
      innerOpen.value = !innerOpen.value;
      emit("update:modelValue", innerOpen.value);
      emit("toggle", innerOpen.value);
    }

    return () => (
      <div
        class="hk-expansion-panel"
        data-open={isOpen.value || undefined}
        data-disabled={props.disabled || undefined}
      >
        <button
          type="button"
          class="hk-expansion-panel-header"
          aria-expanded={isOpen.value ? "true" : "false"}
          aria-disabled={props.disabled ? "true" : undefined}
          disabled={props.disabled || undefined}
          onClick={toggle}
        >
          <div class="hk-expansion-panel-header-text">
            {slots.title
              ? slots.title()
              : props.title && <span class="hk-expansion-panel-title">{props.title}</span>}
            {slots.subtitle
              ? slots.subtitle()
              : props.subtitle && <span class="hk-expansion-panel-subtitle">{props.subtitle}</span>}
          </div>
          {slots.action && (
            <div
              class="hk-expansion-panel-action"
              // Inline actions must not toggle the panel; stop the click
              // before it bubbles into the header button's handler.
              onClick={(e: Event) => e.stopPropagation()}
            >
              {slots.action()}
            </div>
          )}
          <span class="hk-expansion-panel-chevron" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </span>
        </button>
        <div class="hk-expansion-panel-body">
          <div class="hk-expansion-panel-content">{slots.default?.()}</div>
        </div>
      </div>
    );
  },
});
