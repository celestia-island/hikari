import { defineComponent, h, type PropType } from "vue";
import { HkFaceShell } from "./HkFaceShell";
import { provideActionBar } from "../composables/useActionBar";

// The padding-scan utilities moved INTO HkFaceShell with the content
// host that applies them (2026-10-29 extraction). Re-exported here
// because HkAdminShell.padding.test.ts and any external importer know
// this module as their home — the extraction must not move the public
// surface, only the implementation.
export {
  scanPaddingSides,
  splitPaddingSides,
  mobileSideGutterFree,
} from "./HkFaceShell";
export type { PaddingSidesScan } from "./HkFaceShell";

/**
 * HkAdminShell — the ADMIN face of the generalized shell
 * (2026-10-29 extraction): HkFaceShell in document mode, plus the
 * legacy action-bar channel. Everything structural — the frame, the
 * optional sidebar and its mobile drawer, the scroll-viewport content
 * host with `contentPadding` / `contentKey` / `contentBleedOnMobile`,
 * the fixed footer band and its height reservation, the overlays slot —
 * lives in HkFaceShell now; this component is a thin, behavior-identical
 * wrapper kept for every existing consumer (props, slots and rendered
 * classes are unchanged).
 *
 * The one thing the wrapper ADDS is its own action-bar provide: hosts
 * of the pre-extraction contract read the registered actions through
 * the header slot's `actions` param (the bar this shell provides
 * itself). Faces that own their action bar — or their whole content
 * lifecycle, like a canvas stage — consume HkFaceShell directly and
 * provide whatever they want, closest to their pages.
 */
export const HkAdminShell = defineComponent({
  name: "HkAdminShell",
  props: {
    sidebarCollapsed: { type: Boolean, default: false },
    sidebarWidth: { type: String, default: "224px" },
    /** Desktop icon-rail capability, forwarded to HkFaceShell (see its
     *  prop doc): opt in here and the admin sidebar gains the circular
     *  hover-reveal toggle STRADDLING the sidebar's content-facing border,
     *  the one-icon rail and the overlay peek drawer (with the peek
     *  suppressed while the pointer rests on the toggle, and a pinned
     *  panel on expand). Declared on the wrapper on purpose — the same
     *  honest-forwarding rule as contentMode (a stray attr must not
     *  reach the inner shell's declared prop through fallthrough). */
    sidebarCollapsible: { type: Boolean, default: false },
    /** Layout width of the icon rail (default 56px), forwarded. */
    sidebarCollapsedWidth: { type: String, default: "56px" },
    /** Rail state channel, `v-model:sidebar-rail-style` ("expanded" |
     *  "rail"), forwarded — session-only unless the host persists it. */
    sidebarRailStyle: {
      type: String as PropType<"expanded" | "rail">,
      default: "expanded",
    },
    /** Hover dwell before the peek opens, ms, forwarded. */
    sidebarPeekDelay: { type: Number, default: 400 },
    /** Grace after pointerleave before the peek closes, ms, forwarded. */
    sidebarPeekGrace: { type: Number, default: 150 },
    /** Viewport width at which the desktop layout takes over (below it
     *  the nav collapses into the mobile drawer). Defaults to the shared
     *  1024px "lg" breakpoint; lower it (e.g. 768) for tablet-friendly
     *  admins that keep the sidebar at md widths. */
    mobileBreakpoint: { type: Number, default: 1024 },
    /** Height reserved under the scroll body for a fixed status-bar
     *  band. INJECTION-DRIVEN (2026-10-24): the reservation tracks
     *  whether the shell actually renders a status bar — a filled
     *  `footer` slot (the shell's own fixed `.s-status-bar`) reserves
     *  `var(--s-footer-height)` by default, and with NO footer slot
     *  nothing is reserved (`0px`). Hosts that pin their OWN fixed bar
     *  outside the shell opt back in by passing an explicit value
     *  (e.g. `"var(--s-footer-height)"`). */
    footerHeight: { type: String, default: undefined },
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
    /** Identity of the content page on stage (task-4, 2026-10-24):
     *  pass the current view/route key and the content area swaps pages
     *  through the family crossfade — the library owns the page-slot
     *  mechanism instead of every host hand-wrapping it. Omitted (or
     *  null) renders the slot bare: canvas-like hosts that mount one
     *  persistent stage opt out. */
    contentKey: { type: [String, Number] as PropType<string | number | null>, default: null },
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
     *  lone CSS-wide keyword, or a value this scanner cannot trust: one
     *  carrying a CSS comment or a backslash escape, one ending in a
     *  `!important` annotation, or one whose functions/quotes never
     *  close) falls back to the verbatim value — see
     *  `mobileSideGutterFree`; the page then keeps its gutters instead
     *  of risking a declaration a browser would drop whole.
     *  Default false: the padding reads the same at every width. */
    contentBleedOnMobile: { type: Boolean, default: false },
    /** The content host mode, forwarded to HkFaceShell. DECLARED on
     *  this wrapper on purpose (R2 S2, 2026-10-29): an undeclared input
     *  would fall through `$attrs` onto the inner shell, where it IS a
     *  declared prop — and fallthrough attrs override explicit props,
     *  so a stray `content-mode="stage"` from a template or a
     *  `v-bind="$attrs"` relay would silently flip the admin shell into
     *  the stage host. Declared here, the input is a real prop of this
     *  component and forwards honestly; the default stays `document`,
     *  which is what the admin face is. */
    contentMode: { type: String as PropType<"document" | "stage">, default: "document" },
  },
  setup(props, { slots }) {
    const actionBar = provideActionBar();

    return () =>
      h(HkFaceShell, {
        sidebarCollapsed: props.sidebarCollapsed,
        sidebarWidth: props.sidebarWidth,
        sidebarCollapsible: props.sidebarCollapsible,
        sidebarCollapsedWidth: props.sidebarCollapsedWidth,
        sidebarRailStyle: props.sidebarRailStyle,
        sidebarPeekDelay: props.sidebarPeekDelay,
        sidebarPeekGrace: props.sidebarPeekGrace,
        // The v-model channel rides the inner shell's event straight
        // through this wrapper's listeners (attrs fallthrough carries
        // onUpdate:sidebarRailStyle to HkFaceShell — inheritAttrs stays
        // on, the default), so the host binding is one wire end-to-end.
        mobileBreakpoint: props.mobileBreakpoint,
        footerHeight: props.footerHeight,
        navTitle: props.navTitle,
        drawerPanelClass: props.drawerPanelClass,
        // The admin face IS the document mode by default — stage faces
        // normally consume HkFaceShell directly; the forward keeps an
        // explicit opt-in honest (and the declared prop above keeps a
        // stray attr from ever reaching the inner shell on its own).
        contentMode: props.contentMode,
        contentPadding: props.contentPadding,
        contentKey: props.contentKey,
        contentBleedOnMobile: props.contentBleedOnMobile,
      }, {
        header: slots.header
          ? (shellParams: Record<string, unknown>) =>
              slots.header!({
                ...shellParams,
                // The legacy channel this wrapper exists to keep: the
                // actions of the bar provided above, handed to the header
                // slot exactly as before the extraction.
                actions: actionBar.actions.value ? actionBar.actions.value() : [],
              })
          : undefined,
        sidebar: slots.sidebar,
        userPanel: slots.userPanel,
        content: slots.content,
        footer: slots.footer,
        overlays: slots.overlays,
      });
  },
});
