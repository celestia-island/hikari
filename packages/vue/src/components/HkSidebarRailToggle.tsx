import { computed, defineComponent } from "vue";
import { ChevronsLeftRight, ChevronsRightLeft } from "lucide-vue-next";

import HkIconButton from "./HkIconButton";
import { useI18n } from "../i18n/context";
import "./HkSidebarRail.scss";

/** Selector of the toggle's positioning/reveal wrapper — the element
 *  whose box `isPointerOverRailToggle` tests. One spelling, two hosts. */
export const RAIL_TOGGLE_SELECTOR = ".hk-sidebar-rail-toggle";

/** Slack (px) added around the circle when testing "the pointer rests on
 *  the toggle": a resting pointer sits within a pixel or two of the edge
 *  after the panel's width transition nudges the rect, and a razor-thin
 *  boundary would re-arm the dwell and twitch the drawer. */
export const RAIL_TOGGLE_SUPPRESS_PAD = 2;

/**
 * Whether the viewport point (x, y) lies over the rail toggle inside
 * `host`. The suppression wiring in HkSidebar/HkFaceShell needs GEOMETRY,
 * not `event.target`: before the region is engaged the toggle is
 * `opacity: 0; pointer-events: none`, so a pointer resting on it targets
 * the element underneath and `contains(target)` would report "not on the
 * toggle" — re-arming the dwell under the resting cursor, which is the
 * reported twitch. The element still has a box while invisible, so its
 * rect is the honest answer.
 *
 * Returns false when the host (or the toggle inside it) is not mounted —
 * mobile drawers and the legacy non-rail sidebar keep the plain behavior.
 * Exported for its unit test: happy-dom cannot lay these boxes out.
 */
export function isPointerOverRailToggle(
  host: HTMLElement | null | undefined,
  x: number,
  y: number,
): boolean {
  const el = host?.querySelector<HTMLElement>(RAIL_TOGGLE_SELECTOR);
  if (!el) return false;
  const rect = el.getBoundingClientRect();
  const pad = RAIL_TOGGLE_SUPPRESS_PAD;
  return x >= rect.left - pad && x <= rect.right + pad && y >= rect.top - pad && y <= rect.bottom + pad;
}

/**
 * HkSidebarRailToggle — the circular hover-reveal toggle of the sidebar
 * rail capability (2026-10-30).
 *
 * A small round button carrying a SHAFT-LESS chevron pair (lucide
 * ChevronsLeftRight / ChevronsRightLeft — ‹ › and › ‹, never → ←),
 * STRADDLING the sidebar's content-facing border: its center rides the
 * border line, so half the circle sits inside the panel and half hangs
 * over the content (the user-confirmed direction; the geometry is
 * HkSidebarRail.scss's negative `inset-inline-end`, not this markup). It
 * is invisible (opacity 0, no pointer events) until the sidebar REGION is
 * hovered or focused within — the reveal lives in HkSidebarRail.scss on
 * `.hk-sidebar-rail-host:hover/:focus-within .hk-sidebar-rail-toggle`,
 * so the button itself stays markup-simple.
 *
 * Because the circle sits ON the rail's hover surface, a pointer parked
 * on it would otherwise arm the peek dwell and jump when the drawer opens
 * under it. Hosts therefore feed `isPointerOverRailToggle` (above) into
 * useSidebarRail's `setPeekSuppressed` — hover-reveal + suppression
 * together are what make the control safe to rest on.
 *
 * Icon direction (documented decision): EXPANDED state carries › ‹
 * (ChevronsRightLeft — converging, "squeeze the sidebar in"); COLLAPSED
 * state carries ‹ › (ChevronsLeftRight — diverging, "let it back out").
 * The pair is mirror-symmetric, so RTL needs no glyph flip.
 *
 * `aria-expanded` + a localized accessible name ride the real <button>
 * (HkIconButton's attr fallthrough), so the control is fully keyboard
 * operable: Tab reaches it (revealing it via :focus-within), Enter/Space
 * clicks it, Escape inside the host region closes a peek (the composable).
 */
export const HkSidebarRailToggle = defineComponent({
  name: "HkSidebarRailToggle",
  props: {
    /** True while the sidebar is at FULL width (clicking will collapse).
     *  False while it is an icon rail (clicking will expand). */
    expanded: { type: Boolean, default: true },
  },
  emits: {
    toggle: () => true,
  },
  setup(props, { emit }) {
    const { t } = useI18n();

    const label = computed(() =>
      props.expanded
        ? t("hikari::sidebar.collapse", "Collapse sidebar")
        : t("hikari::sidebar.expand", "Expand sidebar"),
    );

    return () => (
      <div class="hk-sidebar-rail-toggle" data-expanded={props.expanded || undefined}>
        <HkIconButton
          variant="ghost"
          size={24}
          aria-expanded={String(props.expanded)}
          aria-label={label.value}
          onClick={() => emit("toggle")}
        >
          {/* Shaft-less chevron pair — the direction flips with state; see
              the component doc above. */}
          {props.expanded ? <ChevronsRightLeft size={14} /> : <ChevronsLeftRight size={14} />}
        </HkIconButton>
      </div>
    );
  },
});

export default HkSidebarRailToggle;
