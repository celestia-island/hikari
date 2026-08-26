import {
  defineComponent,
  onBeforeUnmount,
  ref,
  type PropType,
} from "vue";

import { iconByName } from "../composables/iconRegistry";
import "./HkFab.scss";

/** One entry of the HkFab speed dial. */
export interface HFabAction {
  key: string;
  label?: string;
  icon?: string;
  onClick?: () => void;
}

type FabPositioning = "absolute" | "fixed";
type FabCorner = "bottom-right" | "bottom-left" | "top-right" | "top-left";
type FabSize = "sm" | "md" | "lg";
type FabVariant = "primary" | "glass";
type FabExpandDirection = "up" | "down" | "left" | "right";

/**
 * Material-design-style floating action button with an optional
 * speed dial. Anchored via `positioning` + `corner` (CSS only), sized
 * through a fixed map, and styled in the library's glass/primary
 * variants. Without `actions` it is a plain round icon button; with
 * `actions` the main button toggles a staggered mini-button stack.
 */
export default defineComponent({
  name: "HkFab",
  props: {
    /** Registry name of the icon; falls back to an inline chevron-down
     *  when empty. The "icon" slot overrides everything. */
    icon: { type: String, default: "" },
    /** Always pass from consumers — warn-free default only. */
    ariaLabel: { type: String, default: "" },
    positioning: { type: String as PropType<FabPositioning>, default: "absolute" },
    corner: { type: String as PropType<FabCorner>, default: "bottom-right" },
    offsetX: { type: String, default: undefined },
    offsetY: { type: String, default: undefined },
    size: { type: String as PropType<FabSize>, default: "md" },
    variant: { type: String as PropType<FabVariant>, default: "glass" },
    disabled: { type: Boolean, default: false },
    actions: { type: Array as PropType<HFabAction[]>, default: undefined },
    expandDirection: { type: String as PropType<FabExpandDirection>, default: "up" },
  },
  emits: {
    click: (_e: MouseEvent) => true,
    toggle: (_open: boolean) => true,
  },
  setup(props, { emit, slots, expose }) {
    const isOpen = ref(false);
    const rootRef = ref<HTMLElement>();

    let unmounted = false;

    function setOpen(next: boolean) {
      if (isOpen.value === next || unmounted) return;
      isOpen.value = next;
      if (next) {
        document.addEventListener("keydown", onDocKeydown, true);
        document.addEventListener("pointerdown", onDocPointerdown, true);
      } else {
        unbindDismiss();
      }
      emit("toggle", next);
    }

    function unbindDismiss() {
      document.removeEventListener("keydown", onDocKeydown, true);
      document.removeEventListener("pointerdown", onDocPointerdown, true);
    }

    // Capture phase so the speed dial collapses BEFORE ancestor keydown
    // handlers see Escape (e.g. HkModal would otherwise close entirely).
    function onDocKeydown(e: KeyboardEvent) {
      if (e.key !== "Escape") return;
      e.preventDefault();
      e.stopPropagation();
      setOpen(false);
    }

    function onDocPointerdown(e: PointerEvent) {
      const root = rootRef.value;
      if (!root) return;
      const target = e.target instanceof Node ? e.target : null;
      if (target && root.contains(target)) return;
      setOpen(false);
    }

    onBeforeUnmount(() => {
      unmounted = true;
      unbindDismiss();
    });

    expose({
      open: () => setOpen(true),
      close: () => setOpen(false),
      toggle: () => setOpen(!isOpen.value),
    });

    function onMainClick(e: MouseEvent) {
      if (props.disabled) return;
      emit("click", e);
      if (props.actions && props.actions.length > 0) {
        setOpen(!isOpen.value);
      }
    }

    function onActionClick(action: HFabAction) {
      action.onClick?.();
      setOpen(false);
    }

    return () => {
      // Icon precedence: slot > registry > inline chevron-down fallback.
      // `as any` matches HkIcon — the registry returns a loose Component.
      const RegistryIcon = props.icon ? (iconByName(props.icon) as any) : null;

      const mainIcon = (
        <span class="hk-fab-icon">
          {slots.icon
            ? slots.icon()
            : RegistryIcon
              ? <RegistryIcon />
              : (
                // Inline chevron-down fallback (kept local to avoid
                // pulling the lucide symbol through a non-registry path).
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  aria-hidden="true"
                >
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              )}
        </span>
      );

      return (
        <div
          ref={rootRef}
          class="hk-fab"
          data-positioning={props.positioning}
          data-corner={props.corner}
          data-size={props.size}
          data-variant={props.variant}
          data-expand={props.expandDirection}
          data-expanded={isOpen.value ? "true" : undefined}
          style={{
            "--hk-fab-offset-x": props.offsetX,
            "--hk-fab-offset-y": props.offsetY,
          }}
        >
          {(props.actions?.length ?? 0) > 0 && (
            <div
              class="hk-fab-actions"
              aria-hidden={isOpen.value ? "false" : "true"}
            >
              {props.actions!.map((action) => (
                <button
                  key={action.key}
                  type="button"
                  class="hk-fab-mini"
                  tabindex={isOpen.value ? 0 : -1}
                  aria-hidden={isOpen.value ? "false" : "true"}
                  disabled={props.disabled}
                  title={action.label}
                  aria-label={action.label ?? action.key}
                  onClick={() => onActionClick(action)}
                >
                  {action.icon ? <RegistryGlyph name={action.icon} /> : null}
                  {action.label ? <span class="hk-fab-mini-label">{action.label}</span> : null}
                </button>
              ))}
            </div>
          )}
          <button
            type="button"
            class="hk-fab-button"
            aria-label={props.ariaLabel}
            aria-expanded={(props.actions?.length ?? 0) > 0
              ? (isOpen.value ? "true" : "false")
              : undefined}
            disabled={props.disabled}
            onClick={onMainClick}
          >
            {mainIcon}
          </button>
        </div>
      );
    };
  },
});

/** Tiny internal helper resolving a speed-dial action icon through the
 *  shared registry (same tree-shaking rationale as HkIcon). */
const RegistryGlyph = defineComponent({
  name: "HkFabGlyph",
  props: { name: { type: String, required: true } },
  setup(props) {
    return () => {
      const Comp = iconByName(props.name) as any;
      return <span class="hk-fab-mini-icon"><Comp /></span>;
    };
  },
});
