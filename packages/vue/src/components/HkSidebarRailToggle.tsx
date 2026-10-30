import { computed, defineComponent } from "vue";
import { ChevronsLeftRight, ChevronsRightLeft } from "lucide-vue-next";

import HkIconButton from "./HkIconButton";
import { useI18n } from "../i18n/context";
import "./HkSidebarRail.scss";

/**
 * HkSidebarRailToggle — the circular hover-reveal toggle of the sidebar
 * rail capability (2026-10-30).
 *
 * A small round button carrying a SHAFT-LESS chevron pair (lucide
 * ChevronsLeftRight / ChevronsRightLeft — ‹ › and › ‹, never → ←),
 * vertically centered on the sidebar's content-facing edge. It is
 * invisible (opacity 0, no pointer events) until the sidebar REGION is
 * hovered or focused within — the reveal lives in HkSidebarRail.scss on
 * `.hk-sidebar-rail-host:hover/:focus-within .hk-sidebar-rail-toggle`,
 * so the button itself stays markup-simple.
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
