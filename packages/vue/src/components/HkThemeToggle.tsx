import { defineComponent, onUnmounted, ref, watch, type PropType } from "vue";
import { Palette } from "lucide-vue-next";
import { HPopover, useI18n, type PopupPlacement } from "@celestia-island/hikari";

import HkIconButton from "./HkIconButton";
import { HkThemePanelContent } from "./HkThemePanelContent";
import type { HCustomTheme } from "./HkColorSchemeDialog";
import "./HkThemeToggle.scss";

export { type ThemeItemScope } from "./HkThemePanelContent";

/**
 * HkThemeToggle — light/dark/auto theme control over hikari's theme engine.
 *
 * Composes the shared HkThemePanelContent (the panel body both this
 * popover and host settings surfaces render); it does NOT reimplement the
 * theme engine. ONE trigger —
 * a standard HkIconButton ghost/28 with a palette glyph, chrome-identical
 * to the functional buttons hosts place beside it — opens the popover,
 * which offers the color-mode group and preset/custom theme selection
 * (custom themes are removable) and opens HColorSchemeDialog to create a
 * new custom scheme. The retired main/arrow button pair cycled light/dark
 * straight from the header; that press lives on only as the menu's
 * altitude-strip resolution (auto) and the segmented group (manual).
 *
 * Theme rows are host-customizable through three scoped slots (all render
 * in the popover AND the mobile bottom sheet — same DOM):
 *  · `item-leading` — renders for
 *    every row in the fixed icon cell so names align regardless of the
 *    active row. Scope: `ThemeItemScope` (id/name/isCustom/preset).
 *  · `item-name-suffix` — an inline cell rendered INSIDE the row button,
 *    immediately after the (catalog-resolved) name, so a host mark reads
 *    as part of the name rather than as an affordance. Renders only when
 *    the host provides the slot; the cell is `aria-hidden`-free and
 *    layout-neutral (does not grow, never pushes the trailing column).
 *  · `item-trailing` — reserves a trailing column on every row and owns
 *    it entirely; the built-in custom-delete overlay is suppressed, so
 *    the host renders delete/edit itself where it wants them.
 *
 * `mode-extra` — a host strip rendered directly under the color-mode
 * group (before the divider). Mode-adjacent host chrome that is NOT a
 * theme-editor concern lives here (e.g. display-scale control).
 *
 * `closeMenu()` (setup expose) — programmatic close for host content
 * living INSIDE the menu (row slot affordances). A host that opens a
 * delegated second-level window from a row (e.g. a per-theme editor)
 * calls it to dismiss the menu; the menu is ONE state in both its forms
 * (desktop popover, mobile bottom sheet), so this closes whichever is
 * showing — a mobile-aware host decides whether to call it at all, no
 * automatic close fires from here. InstanceType does not carry
 * expose() members — type the ref structurally at the consumer.
 *
 * Color-mode group: the unified HTabs strip in segmented (radiogroup)
 * working mode (Auto | Light | Dark) — same pill chrome as every other
 * group. In AUTO mode the Light/Dark halves merge into the strip's
 * merged cell (`mergeKeys` + `#merged`): a passive-looking
 * solar-altitude strip in the strip's own trigger typography — pressing
 * it drops to manual on whichever side auto currently resolves to (day
 * → light, night → dark), so no separate resolve step is ever needed.
 * The cell is NAKED like every unselected option (no border/surface of
 * its own) and joins the group's animation context (swap transitions +
 * the sliding indicator).
 */
export const HkThemeToggle = defineComponent({
  name: "HkThemeToggle",
  props: {
    /** Popover placement. */
    popoverPlacement: { type: String as PropType<PopupPlacement>, default: "bottom-end" },
    /**
     * When true, the "Customize" button emits `open-customize` and closes
     * the popover instead of opening the built-in HColorSchemeDialog — the
     * host app then owns the customization surface (e.g. its own tabs
     * dialog). The internal dialog is not rendered in this mode.
     */
    externalCustomize: { type: Boolean, default: false },
  },
  emits: {
    "update:scheme": (_theme: HCustomTheme) => true,
    "open-customize": () => true,
  },
  setup(props, { emit, slots, expose }) {
    const { t } = useI18n();
    const menuOpen = ref(false);
    const triggerRef = ref<HTMLElement | null>(null);

    /** Programmatic close for host content inside the menu (row slot
     *  affordances): a host opening a delegated second-level window from a
     *  theme row calls this to dismiss the menu. The menu is ONE state in
     *  both its forms — desktop popover and mobile bottom sheet — so
     *  this closes whichever is showing, with no breakpoint branching
     *  here; a mobile-aware host decides whether to call it at all. */
    function closeMenu() {
      menuOpen.value = false;
    }
    expose({ closeMenu });

    return () => (
      <div class="s-theme-toggle" ref={triggerRef}>
        {/* ONE trigger (user direction 2026-09-30): a STANDARD HkIconButton
         * ghost/28 with a palette glyph — identical chrome to the functional
         * buttons it sits beside. It only opens the menu; mode switching
         * lives in the menu's color-mode strip. The `s-theme-toggle-btn`
         * class stays as a stable consumer/test hook; it carries NO css of
         * its own. */}
        <HkIconButton
          class="s-theme-toggle-btn"
          size={28}
          variant="ghost"
          aria-haspopup="menu"
          aria-expanded={menuOpen.value ? "true" : "false"}
          aria-label={t("hikari::theme.themes")}
          {...{ title: t("hikari::theme.themes") }}
          onClick={() => { menuOpen.value = !menuOpen.value; }}
        >
          {{ icon: () => <Palette size={16} /> }}
        </HkIconButton>

        <HPopover
          modelValue={menuOpen.value}
          onUpdate:modelValue={(v: boolean) => { menuOpen.value = v; }}
          placement={props.popoverPlacement}
          anchorRef={triggerRef.value ?? null}
          sheetOnMobile
          title={t("hikari::theme.themes")}
        >
          {/* The panel content is the SHARED HkThemePanelContent (2026-10-15
           * extraction): hosts embed the same component in their own
           * settings surfaces, so the popover and any inline host render
           * one implementation. Slots and events pass straight through. */}
          <HkThemePanelContent
            externalCustomize={props.externalCustomize}
            onRequest-close={closeMenu}
            onOpen-customize={() => emit("open-customize")}
            onUpdate:scheme={(theme: HCustomTheme) => emit("update:scheme", theme)}
          >
            {{
              ...(slots["mode-extra"] ? { "mode-extra": slots["mode-extra"] } : {}),
              ...(slots["item-leading"] ? { "item-leading": slots["item-leading"] } : {}),
              ...(slots["item-name-suffix"] ? { "item-name-suffix": slots["item-name-suffix"] } : {}),
              ...(slots["item-trailing"] ? { "item-trailing": slots["item-trailing"] } : {}),
              ...(slots["menu-extra"] ? { "menu-extra": slots["menu-extra"] } : {}),
            }}
          </HkThemePanelContent>
        </HPopover>
      </div>
    );
  },
});
