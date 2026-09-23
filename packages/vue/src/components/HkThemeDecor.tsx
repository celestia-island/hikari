import { computed, defineComponent, h, type Component, type PropType } from "vue";

import { getThemeDecor, themeDecorVersion, type ThemeDecorSlot } from "../theme/themeDecor";
import { useTheme } from "../theme/useTheme";

/**
 * HkThemeDecor — resolve a decor slot against the ambient theme and render
 * whatever that theme (or the `"*"` fallback, or hikari's built-in floor)
 * registered for it. Nothing more.
 *
 *   <HkThemeDecor slot="status.tray" size="md" />
 *
 * The component's whole contract is "content, never placement":
 *
 *  - it renders NO wrapper element — the resolved component's root IS the
 *    node the host's layout sees, so a slot inside a footer stays a child
 *    of that footer;
 *  - it never sets `position` of its own: a decor that needs placement is a
 *    host layout decision, not a library default.
 *    `themeDecorLayout.contract.test.ts` guards the decor TSX/sheet sources
 *    against literal `position:` declarations. Know that guard's edges:
 *    `inset` / `top` / `z-index` are NOT detected, only the decor files are
 *    scanned, and the four pre-existing built-in implementations
 *    (Splash / Skeleton / EmptyState / Divider) are outside its list — so
 *    e.g. HkEmptyState.scss legitimately carries a `position: absolute`
 *    sr-only utility today;
 *  - `size` is forwarded to the decor component only when that component
 *    declares a `size` prop — no layout inference, and no stray `size="md"`
 *    attribute leaking onto a DOM node of a component that has no such
 *    prop;
 *  - an unregistered slot renders nothing at all (empty, no placeholder
 *    node, no throw) — "this theme has no tray" is a legitimate state.
 *
 * Resolution is reactive on BOTH axes: `useTheme().currentTheme` (switching
 * themes re-resolves IN PLACE — the element is remounted only when the new
 * theme resolves to a DIFFERENT component, which is Vue's vnode-type rule
 * rather than anything this component adds) and `themeDecorVersion` (a
 * registration that lands after first render re-resolves too).
 *
 * Precondition: the built-in floor exists only once `initTheme()` has run,
 * since that is what calls `registerStandardThemeDecor()`. A host that reads
 * the theme without initializing it gets an empty slot and NO warning — the
 * slot renders nothing, which is a legitimate state but a silent one.
 */

/**
 * Size knob of the decor contract. STRING-ONLY on purpose: no shipped decor
 * consumes a numeric size, and passing one trips Vue's prop type check (and,
 * for the built-in tray, silently drops every `--hk-tray-*` var). A decor
 * that wants numeric sizing declares its own prop and receives it through
 * `decorProps`.
 *
 * The ladder is the CONTRACT's, not any one decor's: `HkStatusTray`
 * implements `sm | md | lg` only, so asking it for `xs` publishes no
 * `--hk-tray-*` var at all and the sheet's `var(--hk-tray-glyph, 9px)`
 * fallbacks render the shipped (md) geometry. That degradation is pinned by
 * a test rather than left implicit. A decor that implements all four is free
 * to do so.
 */
export type HkThemeDecorSize = "xs" | "sm" | "md" | "lg";

/** Does the component declare a `size` prop (object form or array form)? */
function declaresSize(component: Component): boolean {
  const declared = (component as { props?: unknown }).props;
  if (Array.isArray(declared)) return declared.includes("size");
  return (
    declared !== null &&
    typeof declared === "object" &&
    Object.prototype.hasOwnProperty.call(declared, "size")
  );
}

export default defineComponent({
  name: "HkThemeDecor",
  props: {
    /** Decor slot to resolve, e.g. `status.tray` / `placeholder.section`. */
    slot: { type: String as PropType<ThemeDecorSlot>, required: true },
    /** Forwarded to the decor component when it declares a `size` prop. */
    size: {
      type: String as PropType<HkThemeDecorSize | undefined>,
      default: undefined,
    },
    /**
     * Host overrides for the decor's props; beats the registered defaults.
     * Precedence with `size` depends on the TARGET: when the decor declares a
     * `size` prop the explicit `size` wins and `decorProps.size` is ignored;
     * when it does not, the explicit `size` is dropped and `decorProps` is
     * forwarded verbatim — so a `size` key inside it lands on the target's DOM
     * node through Vue's attribute fallthrough, unlike the `size` prop.
     */
    decorProps: {
      type: Object as PropType<Record<string, unknown> | undefined>,
      default: undefined,
    },
  },
  setup(props) {
    const { currentTheme } = useTheme();

    const resolved = computed(() => {
      // Track late registrations: a theme may register its decor after this
      // component has already rendered.
      void themeDecorVersion.value;
      return getThemeDecor(props.slot, currentTheme.value);
    });

    return () => {
      const registration = resolved.value;
      if (!registration) return null;

      const forwarded: Record<string, unknown> = {
        ...registration.props,
        ...props.decorProps,
      };
      if (props.size !== undefined && declaresSize(registration.component)) {
        forwarded.size = props.size;
      }
      return h(registration.component, forwarded);
    };
  },
});
