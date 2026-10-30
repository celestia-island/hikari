import { computed, defineComponent, ref, watch, type PropType } from "vue";
import { HkCrossfade, HDrawer, HScrollContainer, useBreakpoint } from "@celestia-island/hikari";
import { useI18n } from "../i18n/context";
import { useSidebarRail } from "../composables/useSidebarRail";
import HkSidebarRailToggle, { isPointerOverRailToggle } from "./HkSidebarRailToggle";

/** CSS-wide keywords. A shorthand rebuilt from one of them is NOT a
 * padding (`inherit 0 inherit` is rejected by every engine, measured in
 * Chromium), so the declaration would be dropped WHOLE and the page
 * would lose the vertical clearance too — worse than not bleeding. */
const CSS_WIDE_KEYWORDS = new Set(["inherit", "initial", "unset", "revert", "revert-layer"]);

/**
 * A scanned padding shorthand: the top-level `sides` plus whether the
 * value ENDED with every function closed and every quote terminated.
 * `balanced: false` means the scan cannot know where the value ends —
 * CSS closes an open function at EOF, so the authored declaration can
 * still be valid while a rewrite of it cannot be.
 */
export interface PaddingSidesScan {
  sides: string[];
  balanced: boolean;
}

/**
 * Scan a CSS padding shorthand into its top-level tracks: split on
 * TOP-LEVEL whitespace, quote- and function-aware, so whitespace inside
 * a function belongs to that value — `calc(1rem + 2px)`,
 * `var(--pad, 1rem)` and a quoted argument are ONE track. A plain
 * `split(/\s+/)` shreds them (`["calc(1rem", "+", "2px)"]`), and the
 * rebuilt shorthand is invalid CSS — a browser drops the whole
 * declaration, taking with it the vertical clearance
 * `contentBleedOnMobile` promises to keep (rounds 2 and 3 of this change
 * hit exactly that; rounds 4 and 5 the escape and EOF variants). The
 * depth counter balances parentheses, so nested functions
 * (`clamp(1rem, min(2vw, 3px), 3px)`) survive; a stray `)` never drives
 * the depth negative. Tabs and newlines are valid CSS separators and
 * split like spaces, and the whitespace around a shorthand yields no
 * empty tracks.
 *
 * Exported for its own unit test: happy-dom cannot round-trip
 * `var()`/`clamp()` values or the hostile inputs below, so the
 * component-level suite cannot observe them.
 */
export function scanPaddingSides(value: string): PaddingSidesScan {
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
  return { sides, balanced: depth === 0 && quote === "" };
}

/** The tracks of {@link scanPaddingSides} — for callers that only need
 * the split, and for the unit test that pins the splitting rules. */
export function splitPaddingSides(value: string): string[] {
  return scanPaddingSides(value).sides;
}

/**
 * The side-gutter-free form of a padding shorthand: the vertical tracks
 * survive, the horizontal ones become zero (`"1rem 2rem"` -> `"1rem 0
 * 1rem"`). The value is returned VERBATIM — the page keeps its padding
 * and simply does not bleed — whenever the shorthand cannot be rewritten
 * safely. That fallback IS the contract: emitting a declaration a browser
 * drops costs the page ALL FOUR sides, including the vertical clearance
 * this prop exists to keep.
 *
 * Verbatim cases:
 *
 * - an empty / whitespace-only value has nothing to strip;
 * - a LONE CSS-wide keyword cannot be combined per side (`inherit 0
 *   inherit` is not a padding — every engine rejects it);
 * - the value contains a CSS comment, whose text would land in the
 *   rebuilt declaration as a garbage track (`1rem 0 x`, measured in
 *   Chromium: dropped, all four sides lost);
 * - the value contains a backslash: this scanner does not decode CSS
 *   escapes, and an escape can hide a quote, a parenthesis or a whole
 *   keyword (`\69 nherit` IS `inherit` to an engine) — the literal text
 *   is not the value, so no rewrite of it is trustworthy (round 5);
 * - the value ends with a `!important` annotation: the annotation
 *   belongs to the DECLARATION, so a per-side rewrite would either
 *   silently lose the priority (`2rem !important`) or rebuild the
 *   `inherit 0 inherit` every engine rejects (`inherit !important`,
 *   measured in Chromium, round 5);
 * - the scan ends inside an open function or an unterminated quote: CSS
 *   auto-closes a function at EOF, so `"calc(1rem + 2px"` IS a real
 *   padding (measured: all four sides) while its rewrite is not; an
 *   unterminated quote is invalid at both ends, and bailing keeps the
 *   two paths identical (round 5).
 *
 * Known residual (documented, not fixable at string level): a `var()`
 * whose custom property resolves to MORE than one track cannot keep its
 * vertical half — `padding: var(--multi) 0 var(--multi)` is valid at
 * parse time and invalid at computed-value time, and all four sides
 * collapse. No consumer passes a multi-track custom property today.
 */
export function mobileSideGutterFree(value: string): string {
  if (value.includes("/*") || value.includes("\\")) return value;
  // `!important` is an annotation on the DECLARATION, not a track — it
  // cannot ride a per-side rewrite: `2rem !important` would silently lose
  // its priority, and `inherit !important` would rebuild into the
  // `inherit 0 inherit` every engine drops (measured in Chromium, round
  // 5). Bail out and let the authored padding stand.
  if (/!\s*important\s*$/i.test(value)) return value;
  const { sides, balanced } = scanPaddingSides(value);
  if (!balanced) return value;
  if (sides.length === 0) return value;
  if (sides.length === 1 && CSS_WIDE_KEYWORDS.has(sides[0].toLowerCase())) return value;
  const [top, , bottom] = sides;
  return `${top} 0 ${bottom ?? top}`;
}

/**
 * HkFaceShell — the generalized face shell (2026-10-29, extracted from
 * HkAdminShell): the ONE frame every app face hangs its chrome on —
 * an optional header row, an optional sidebar with its mobile drawer,
 * the content host, the fixed status-bar band, and the overlays slot.
 *
 * HkAdminShell is this shell's ADMIN face: it composes HkFaceShell in
 * document mode and adds its own action-bar provide (the legacy channel
 * some hosts still read through the header slot's `actions` param).
 * Hosts that own their action bar — or their whole content lifecycle —
 * consume HkFaceShell directly, so the shell carries NO action-bar
 * provider of its own: whoever provides, provides closest to the pages.
 *
 * The content host has TWO modes (`contentMode`):
 *
 * - `document` (default) — the console shape HkAdminShell has always
 *   rendered: one persistent `HScrollContainer` viewport, the
 *   `contentPadding` inner wrapper (box-shadows never clipped), the
 *   `contentKey` crossfade, and the `contentBleedOnMobile` phone-gutter
 *   drop. `contentPadding` / `contentBleedOnMobile` apply ONLY here.
 *
 * - `stage` — the canvas shape: NO scroll container and NO padding
 *   wrapper; the content slot renders directly under the shell's main
 *   region and owns its scrolling, its canvases and its floating
 *   layers (the chat face's desktop surfaces, industrial boards, 3D
 *   scenes). A stage face must not be wrapped in the document viewport
 *   — that is the whole reason the mode exists. `contentKey` remains
 *   honored for faces that want the library's keyed crossfade anyway.
 *
 * Everything else — the header slot's scoped params (minus the admin
 * `actions` param), the sidebar + drawer split, the `userPanel` drawer
 * footer, the fixed footer band and its injection-driven height
 * reservation, the overlays slot — behaves identically in both modes.
 */
export const HkFaceShell = defineComponent({
  name: "HkFaceShell",
  props: {
    sidebarCollapsed: { type: Boolean, default: false },
    sidebarWidth: { type: String, default: "224px" },
    /** OPT-IN icon-rail capability for the desktop sidebar (2026-10-30):
     *  mounts the hover-reveal circular chevron toggle STRADDLING the
     *  sidebar's content-facing border (its center on the border line,
     *  half the circle over the content), lets a click collapse the
     *  sidebar to a one-icon rail, and — while collapsed — opens a
     *  hover-peek drawer that slides the full sidebar OVER the content as
     *  an overlay (the layout keeps the rail width; the content area never
     *  shifts).
     *
     *  Two behaviors ride the same opt-in: a pointer resting on the toggle
     *  SUPPRESSES the peek dwell (it sits on the rail's hover surface and
     *  would otherwise open the drawer out from under the cursor), and a
     *  rail -> expanded flip PINNS the panel at its final width for the
     *  transition window, so only the content area animates instead of the
     *  sidebar re-sliding. Timing lives in useSidebarRail (dwell, grace,
     *  suppression, Escape, pinning); geometry in HkSidebarRail.scss
     *  (.hk-sidebar-rail-host/-panel/-clip/-toggle).
     *  False (default) renders the sidebar exactly as before. Below
     *  mobileBreakpoint nothing changes — the mobile drawer stays the
     *  only nav surface. */
    sidebarCollapsible: { type: Boolean, default: false },
    /** Layout width of the icon rail (the one-icon column). Default 56px,
     *  the rail width HkSidebar's collapsed mode has always used. */
    sidebarCollapsedWidth: { type: String, default: "56px" },
    /** Rail state channel, `v-model:sidebar-rail-style`: "expanded" (the
     *  default) or "rail". The library itself NEVER persists this — the
     *  collapse is session-only by design; a host that wants persistence
     *  (or a shared store) binds the channel and stores the value
     *  itself. */
    sidebarRailStyle: {
      type: String as PropType<"expanded" | "rail">,
      default: "expanded",
    },
    /** Hover dwell on the rail before the peek drawer opens, ms. */
    sidebarPeekDelay: { type: Number, default: 400 },
    /** Grace after pointerleave before the peek drawer closes, ms — a
     *  diagonal pointer move within the window does not flicker it shut. */
    sidebarPeekGrace: { type: Number, default: 150 },
    /** Viewport width at which the desktop layout takes over (below it
     *  the nav collapses into the mobile drawer). Defaults to the shared
     *  1024px "lg" breakpoint; lower it (e.g. 768) for tablet-friendly
     *  faces that keep the sidebar at md widths. */
    mobileBreakpoint: { type: Number, default: 1024 },
    /** Height reserved under the scroll body for a fixed status-bar
     *  band. INJECTION-DRIVEN (2026-10-24): the reservation tracks
     *  whether the shell actually renders a status bar — a filled
     *  `footer` slot (the shell's own fixed `.s-status-bar`) reserves
     *  `var(--s-footer-height)` by default, and with NO footer slot
     *  nothing is reserved (`0px`). The old unconditional default
     *  reserved the band on every host, leaving a dead 3rem blank under
     *  faces that never mount a status bar. Hosts that pin their OWN
     *  fixed bar outside the shell opt back in by passing an explicit
     *  value (e.g. `"var(--s-footer-height)"`). */
    footerHeight: { type: String, default: undefined },
    navTitle: { type: String, default: undefined },
    /** Extra class for the mobile nav drawer's panel — lets consumers zero
     *  nested paddings so drawer nav rows and a `userPanel` footer share
     *  one left edge. */
    drawerPanelClass: { type: String, default: undefined },
    /** Content host mode (see the component doc): `document` wraps the
     *  content in the shell's scroll viewport + padding wrapper;
     *  `stage` renders the content bare — the face owns scrolling,
     *  canvases and floating layers. */
    contentMode: { type: String as PropType<"document" | "stage">, default: "document" },
    /** Content-area padding (inside the scroll viewport). Document mode
     *  only — a stage face owns its own geometry. Padding is applied to
     *  an inner wrapper rather than the scroll container so card
     *  box-shadows are never clipped at the viewport edges. Applied
     *  verbatim at every width unless the page opts into
     *  `contentBleedOnMobile`. */
    contentPadding: { type: String, default: "1.5rem" },
    /** Identity of the content page on stage (task-4, 2026-10-24):
     *  pass the current view/route key and the content area swaps pages
     *  through the family crossfade — the library owns the page-slot
     *  mechanism instead of every host hand-wrapping it. Omitted (or
     *  null) renders the slot bare: canvas-like hosts that mount one
     *  persistent stage opt out. Honored in BOTH content modes. */
    contentKey: { type: [String, Number] as PropType<string | number | null>, default: null },
    /** Whether the content on screen is a CANVAS — a 2D board or the 3D
     *  scene — that must span the full phone width. Document mode only
     *  (a stage face IS the canvas; there is no gutter to drop).
     *  OPT-IN, declared by the page that renders the canvas
     *  (2026-10-04 user direction: the side-gutter drop is a PER-PAGE
     *  declaration, never a shell-wide rule — an ordinary page keeps
     *  its side gutters on phones).
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
  },
  emits: {
    "update:sidebarRailStyle": (v: string) => true,
  },
  setup(props, { slots, emit }) {
    const { t } = useI18n();
    const { width: viewportWidth } = useBreakpoint();
    const isDesktop = computed(() => viewportWidth.value >= props.mobileBreakpoint);
    const sidebarOpen = ref(false);

    // ── desktop icon rail + hover peek (sidebarCollapsible) ──────────
    // SEMI-CONTROLLED rail state: a local session-only ref is the live
    // state, so the toggle works with NO channel bound at all (the
    // session-only default); a host that binds v-model:sidebar-rail-style
    // hears every flip through update:sidebarRailStyle and its prop then
    // wins on the way back in (the watch below). Same shape as
    // HkSidebar's collapsed handling.
    const railCollapsedLocal = ref(props.sidebarRailStyle === "rail");
    watch(
      () => props.sidebarRailStyle,
      (v) => {
        railCollapsedLocal.value = v === "rail";
      },
    );
    const railCollapsed = computed({
      get: () => railCollapsedLocal.value,
      set: (v: boolean) => {
        railCollapsedLocal.value = v;
        emit("update:sidebarRailStyle", v ? "rail" : "expanded");
      },
    });
    // The host REGION element (the rail <aside>) — the machine uses it to
    // tell a real pointerleave from DOM churn during the peek/width
    // transitions.
    const railHostRef = ref<HTMLElement>();
    const rail = useSidebarRail({
      collapsed: railCollapsed,
      peekDelay: () => props.sidebarPeekDelay,
      peekGrace: () => props.sidebarPeekGrace,
      host: () => railHostRef.value,
    });
    const railActive = computed(() => props.sidebarCollapsible && railCollapsed.value);
    // The LAYOUT width — the core contract of the peek: rail width while
    // collapsed OR peeking (the peek overlays; it never reflows content),
    // full width while expanded.
    const hostSidebarWidth = computed(() =>
      railActive.value ? props.sidebarCollapsedWidth : props.sidebarWidth,
    );
    // The PANEL width — full while expanded or peeking (the slide-out
    // lever), rail width otherwise.
    const peekPanelWidth = computed(() =>
      railActive.value && !rail.peeking.value ? props.sidebarCollapsedWidth : props.sidebarWidth,
    );
    // Crossing under the breakpoint unmounts the desktop sidebar — the
    // peek must not survive into the mobile drawer era (or reappear when
    // the viewport grows back).
    watch(isDesktop, (desktop) => {
      if (!desktop) rail.closePeek();
    });

    /** Nav rows close the mobile drawer (their existing onNavigate
     *  contract) AND an open peek — mirroring the drawer's
     *  navigate-and-dismiss behavior on desktop hover. */
    const onSidebarNavigate = () => {
      rail.closePeek();
      closeSidebar();
    };

    const onSidebarHostKeydown = (e: KeyboardEvent) => {
      if (rail.onKeydown(e)) e.stopPropagation();
    };

    /** A pointer parked on the toggle must NOT arm the peek dwell — the
     *  toggle straddles the rail's hover surface, so the drawer would open
     *  under the resting cursor and jump the button away from it (the
     *  reported twitch). Containment is GEOMETRIC: before the reveal the
     *  toggle is opacity:0 / pointer-events:none, so event.target cannot
     *  report it.
     *
     *  ENTER evaluates it too, and BEFORE the arm: a pointer that crosses
     *  the boundary and stops exactly on the toggle (or a synthetic enter
     *  with no following move) must not arm the dwell. */
    const onSidebarHostPointerEnter = (e: PointerEvent) => {
      rail.setPeekSuppressed(isPointerOverRailToggle(railHostRef.value, e.clientX, e.clientY));
      rail.onPointerEnter();
    };
    const onSidebarHostPointerMove = (e: PointerEvent) => {
      rail.setPeekSuppressed(isPointerOverRailToggle(railHostRef.value, e.clientX, e.clientY));
    };

    /** The pin window ends with the HOST's own width transition; child
     *  transitionend events (the panel, a nested HkSidebar) bubble here
     *  too, so filter to this element's width. */
    const onSidebarHostTransitionEnd = (e: TransitionEvent) => {
      if (e.target !== e.currentTarget) return;
      if (e.propertyName !== "width") return;
      rail.endPinning();
    };

    const contentStyle = computed(() => ({
      padding: isDesktop.value || !props.contentBleedOnMobile
        ? props.contentPadding
        : mobileSideGutterFree(props.contentPadding),
    }));

    // The status-bar band exists only when the shell renders one (the
    // footer slot) or the host pins its own bar and says so via the prop
    // — an unreserved shell carries no dead clearance (2026-10-24: the
    // unconditional default used to blank 3rem under every console that
    //  never mounted a status bar). Computed INSIDE the render (not a
    // `computed()`): slot PRESENCE is what it reads, and a cached
    // computed is not reliably invalidated by a slot appearing or
    // disappearing, while every re-render re-evaluates this line.
    function footerPad(): string {
      if (props.footerHeight !== undefined) return props.footerHeight;
      return slots.footer ? "var(--s-footer-height)" : "0px";
    }

    const toggleHamburger = () => {
      sidebarOpen.value = !sidebarOpen.value;
    };

    const openSidebar = () => {
      sidebarOpen.value = true;
    };

    const closeSidebar = () => {
      sidebarOpen.value = false;
    };

    /** The content stage: the keyed crossfade when a face opts in, the
     *  bare slot otherwise — identical in both content modes; what the
     *  mode selects is the HOST around it (scroll viewport + padding in
     *  document mode, nothing in stage mode). */
    function renderContentStage() {
      return props.contentKey != null ? (
        <HkCrossfade swapKey={props.contentKey} class="s-admin-shell-swap">
          {slots.content?.()}
        </HkCrossfade>
      ) : (
        slots.content?.()
      );
    }

    return () => (
      <div class="s-admin-shell">
        {slots.header && (
          <div style={{ flexShrink: 0 }}>
            {slots.header({
              isDesktop: isDesktop.value,
              showHamburger: !isDesktop.value,
              compact: !isDesktop.value,
              onHamburger: toggleHamburger,
              // Lets a header trigger (e.g. the avatar in "drawer" action
              // mode) open the mobile nav drawer directly.
              onOpenDrawer: openSidebar,
            })}
          </div>
        )}

        <div class="s-admin-shell-body" style={{ paddingBottom: footerPad() }}>
          {isDesktop.value && !props.sidebarCollapsed && slots.sidebar && (
            props.sidebarCollapsible ? (
              <aside
                ref={railHostRef}
                class="hk-sidebar-rail-host"
                data-rail={railActive.value || undefined}
                data-peeking={rail.peeking.value || undefined}
                // Transient rail -> expanded window (useSidebarRail.pinning):
                // the panel and any nested sidebar snap to their final width
                // while THIS host's width transition plays — expanding must
                // not replay the sidebar slide.
                data-pinning={rail.pinning.value || undefined}
                style={{ width: hostSidebarWidth.value, flexShrink: 0 }}
                onPointerenter={onSidebarHostPointerEnter}
                onPointerleave={rail.onPointerLeave}
                onPointermove={onSidebarHostPointerMove}
                onTransitionend={onSidebarHostTransitionEnd}
                onKeydown={onSidebarHostKeydown}
              >
                {/* The visual panel — absolutely positioned over the host
                    (HkSidebarRail.scss). Its width is the peek's slide-out
                    lever; the host width above is the layout footprint and
                    NEVER grows during a peek, so the <main> sibling keeps
                    its exact width while the drawer covers it. */}
                <div
                  class="hk-sidebar-rail-panel"
                  style={{
                    width: peekPanelWidth.value,
                    borderInlineEnd: "1px solid var(--border-faint, rgb(var(--color-border) / 10%))",
                    background: "rgb(var(--color-surface))",
                  }}
                >
                  {/* The panel no longer clips (the toggle straddles its
                      border), so the slot's content clips inside this
                      wrapper — full rows stay inside rail width while the
                      panel width animates. The toggle stays a DIRECT child
                      of the panel: it must never be clipped. */}
                  <div class="hk-sidebar-rail-clip">
                    {slots.sidebar({
                      collapsed: railActive.value && !rail.peeking.value,
                      onNavigate: onSidebarNavigate,
                      peeking: rail.peeking.value,
                    })}
                  </div>
                  <HkSidebarRailToggle expanded={!railActive.value} onToggle={rail.toggle} />
                </div>
              </aside>
            ) : (
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
            )
          )}
          <main class="s-admin-shell-main" data-content-mode={props.contentMode}>
            {props.contentMode === "stage" ? (
              renderContentStage()
            ) : (
              <HScrollContainer class="s-admin-shell-scroll">
                {/* Padding lives INSIDE the scroll viewport (an inner
                    wrapper) so card box-shadows are not clipped at the
                    viewport edges. */}
                <div style={contentStyle.value}>{renderContentStage()}</div>
              </HScrollContainer>
            )}
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
            zIndex: "var(--hk-z-toolbar)" }}>
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
