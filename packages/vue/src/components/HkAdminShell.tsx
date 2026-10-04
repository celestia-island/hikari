import { computed, defineComponent, ref } from "vue";
import { HDrawer, HScrollContainer, useBreakpoint } from "@celestia-island/hikari";
import { provideActionBar } from "../composables/useActionBar";
import { useI18n } from "../i18n/context";

/** CSS-wide keywords. A shorthand rebuilt from one of them is NOT a
 *  padding (`inherit 0 inherit` is rejected by every engine, measured in
 *  Chromium), so the declaration would be dropped WHOLE and the page
 *  would lose the vertical clearance too — worse than not bleeding. */
const CSS_WIDE_KEYWORDS = new Set(["inherit", "initial", "unset", "revert", "revert-layer"]);

/**
 * Split a CSS padding shorthand on TOP-LEVEL whitespace, quote- and
 * function-aware. Whitespace inside a function belongs to that value:
 * `calc(1rem + 2px)`, `var(--pad, 1rem)` and a quoted argument are ONE
 * track. A plain `split(/\s+/)` shreds them
 * (`["calc(1rem", "+", "2px)"]`), and the rebuilt shorthand is invalid
 * CSS — a browser drops the whole declaration, taking with it the
 * vertical clearance `contentBleedOnMobile` promises to keep (rounds 2
 * and 3 of this change hit exactly that). The depth counter balances
 * parentheses, so nested functions
 * (`clamp(1rem, min(2vw, 3px), 4rem)`) survive; a stray `)` never drives
 * the depth negative. Tabs and newlines are valid CSS separators and
 * split like spaces, and the whitespace around a shorthand yields no
 * empty tracks. Exported for its own unit test: happy-dom cannot
 * round-trip `var()`/`clamp()` values, so the component-level suite
 * cannot observe these cases.
 */
export function splitPaddingSides(value: string): string[] {
  const sides: string[] = [];
  let current = "";
  let depth = 0;
  let quote = "";
  for (const ch of value) {
    if (quote) {
      current += ch;
      if (ch === quote) quote = "";
      continue;
    }
    if (ch === "\"" || ch === "'") {
      quote = ch;
      current += ch;
      continue;
    }
    if (ch === "(") depth += 1;
    else if (ch === ")") depth = Math.max(0, depth - 1);
    if (depth === 0 && /\s/.test(ch)) {
      if (current) sides.push(current);
      current = "";
      continue;
    }
    current += ch;
  }
  if (current) sides.push(current);
  return sides;
}

/**
 * The side-gutter-free form of a padding shorthand: the vertical tracks
 * survive, the horizontal ones become zero (`"1rem 2rem"` -> `"1rem 0
 * 1rem"`). The value is returned VERBATIM — the page keeps its padding
 * and simply does not bleed — whenever the shorthand cannot express that
 * rewrite safely:
 *
 * - an empty / whitespace-only value has nothing to strip;
 * - a single CSS-wide keyword cannot be combined per side (see above);
 * - a value carrying a CSS comment is not tokenizable at this level: the
 *   comment's text would land in the rebuilt declaration as a garbage
 *   track, which a browser rejects (measured in Chromium: the authored
 *   value renders, the rebuilt one is dropped and the content loses all
 *   four sides).
 *
 * Known residual (documented, not fixable at string level): a `var()`
 * whose custom property resolves to MORE than one track cannot keep its
 * vertical half — `padding: var(--multi) 0 var(--multi)` is valid at
 * parse time and invalid at computed-value time. No consumer passes a
 * multi-track custom property today.
 */
export function mobileSideGutterFree(value: string): string {
  if (value.includes("/*")) return value;
  const sides = splitPaddingSides(value);
  if (sides.length === 0) return value;
  if (sides.length === 1 && CSS_WIDE_KEYWORDS.has(sides[0].toLowerCase())) return value;
  const [top, , bottom] = sides;
  return `${top} 0 ${bottom ?? top}`;
}

export const HkAdminShell = defineComponent({
  name: "HkAdminShell",
  props: {
    sidebarCollapsed: { type: Boolean, default: false },
    sidebarWidth: { type: String, default: "224px" },
    /** Viewport width at which the desktop layout takes over (below it
     *  the nav collapses into the mobile drawer). Defaults to the shared
     *  1024px "lg" breakpoint; lower it (e.g. 768) for tablet-friendly
     *  admins that keep the sidebar at md widths. */
    mobileBreakpoint: { type: Number, default: 1024 },
    footerHeight: { type: String, default: "var(--s-footer-height)" },
    navTitle: { type: String, default: undefined },
    /** Extra class for the mobile nav drawer's panel — lets consumers zero
     *  nested paddings so drawer nav rows and a `userPanel` footer share
     *  one left edge. */
    drawerPanelClass: { type: String, default: undefined },
    /** Content-area padding (inside the scroll viewport). Padding is
     *  applied to an inner wrapper rather than the scroll container so
     *  card box-shadows are never clipped at the viewport edges. Applied
     *  verbatim at every width unless the page opts into
     *  `contentBleedOnMobile`. */
    contentPadding: { type: String, default: "1.5rem" },
    /** Whether the content on screen is a CANVAS — a 2D board or the 3D
     *  scene — that must span the full phone width. OPT-IN, declared by
     *  the page that renders the canvas (2026-10-04 user direction: the
     *  side-gutter drop is a PER-PAGE declaration, never a shell-wide
     *  rule — an ordinary page keeps its side gutters on phones).
     *
     *  When true, below `mobileBreakpoint` the horizontal half of
     *  `contentPadding` is dropped while the vertical clearance
     *  survives; desktop is never affected and the verbatim padding is
     *  restored when the viewport crosses back above the breakpoint.
     *  A `contentPadding` that cannot be rewritten per side (empty, a
     *  CSS-wide keyword, a value carrying a CSS comment) falls back to
     *  the verbatim value — see `mobileSideGutterFree`; the page then
     *  keeps its gutters instead of risking a declaration a browser
     *  would drop whole.
     *  Default false: the padding reads the same at every width. */
    contentBleedOnMobile: { type: Boolean, default: false },
  },
  setup(props, { slots }) {
    const { t } = useI18n();
    const { width: viewportWidth } = useBreakpoint();
    const isDesktop = computed(() => viewportWidth.value >= props.mobileBreakpoint);
    const sidebarOpen = ref(false);

    const contentStyle = computed(() => ({
      padding: isDesktop.value || !props.contentBleedOnMobile
        ? props.contentPadding
        : mobileSideGutterFree(props.contentPadding),
    }));

    const actionBar = provideActionBar();

    const toggleHamburger = () => {
      sidebarOpen.value = !sidebarOpen.value;
    };

    const openSidebar = () => {
      sidebarOpen.value = true;
    };

    const closeSidebar = () => {
      sidebarOpen.value = false;
    };

    return () => (
      <div class="s-admin-shell">
        {slots.header && (
          <div style={{ flexShrink: 0 }}>
            {slots.header({
              isDesktop: isDesktop.value,
              showHamburger: !isDesktop.value,
              compact: !isDesktop.value,
              actions: actionBar.actions.value ? actionBar.actions.value() : [],
              onHamburger: toggleHamburger,
              // Lets a header trigger (e.g. the avatar in "drawer" action
              // mode) open the mobile nav drawer directly.
              onOpenDrawer: openSidebar,
            })}
          </div>
        )}

        <div class="s-admin-shell-body" style={{ paddingBottom: props.footerHeight }}>
          {isDesktop.value && !props.sidebarCollapsed && slots.sidebar && (
            <aside
              style={{
                width: props.sidebarWidth,
                flexShrink: 0,
                borderRight: "1px solid var(--border-faint, rgb(var(--color-border) / 10%))",
                background: "rgb(var(--color-surface))",
                overflow: "hidden",
              }}
            >
              {slots.sidebar({ collapsed: false, onNavigate: closeSidebar })}
            </aside>
          )}
          <main class="s-admin-shell-main">
            <HScrollContainer class="s-admin-shell-scroll">
              {/* Padding lives INSIDE the scroll viewport (an inner
                  wrapper) so card box-shadows are not clipped at the
                  viewport edges. */}
              <div style={contentStyle.value}>{slots.content?.()}</div>
            </HScrollContainer>
          </main>

          {!isDesktop.value && (
            <HDrawer
              modelValue={sidebarOpen.value}
              onUpdate:modelValue={(v: boolean) => (sidebarOpen.value = v)}
              side="left"
              size="280px"
              title={props.navTitle ?? t("hikari::adminShell.navTitle", "Navigation")}
              panelClass={props.drawerPanelClass}
            >
              {/* The drawer body carries the nav; a `userPanel` slot rides
                  the drawer footer (identity + account actions) so mobile
                  gets the same content the desktop user menu exposes.
                  `inDrawer` lets the sidebar slot fill the drawer width.
                  The userPanel receives `onNavigate` (closes the drawer)
                  so its action rows — e.g. "go to frontend", which swaps
                  the whole layout underneath — can dismiss the drawer
                  instead of leaving it hovering over the new page. */}
              {{
                default: () =>
                  slots.sidebar?.({ collapsed: false, onNavigate: closeSidebar, inDrawer: true }),
                footer: slots.userPanel
                  ? () => slots.userPanel!({ onNavigate: closeSidebar })
                  : undefined,
              }}
            </HDrawer>
          )}
        </div>

        {slots.footer && (
          <footer class="s-status-bar" style={{ position: "fixed", bottom: 0, left: 0, right: 0, // Footer band (was a bare 40 — the pre-band chrome value).
            zIndex: "var(--z-footer, 110)" }}>
            {slots.footer()}
          </footer>
        )}

        {/* Scoped slots are functions — rendering the slot itself instead of
            calling it would stringify the compiled withCtx source into a text
            node (normalizeVNode String()s non-vnode children). */}
        {slots.overlays?.()}
      </div>
    );
  },
});
