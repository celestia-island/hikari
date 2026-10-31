import { computed, defineComponent, onBeforeUnmount, onMounted, ref, watch, nextTick } from "vue";

import "./HkSidebar.scss";
import { attachOverlayScrollbars, type OverlayScrollbarHandle } from "../composables/useOverlayScrollbar";
import { useSidebarRail } from "../composables/useSidebarRail";
import { provideMenuGroupState, useMenuGroupState } from "../composables/useMenuGroupState";
import HkSidebarRailSwap from "./HkSidebarRailSwap";
import HkSidebarRailToggle, { isPointerOverRailToggle } from "./HkSidebarRailToggle";

export default defineComponent({
  name: "HkSidebar",
  props: {
    collapsed: { type: Boolean, default: false },
    mobile: { type: Boolean, default: false },
    width: { type: String, default: "280px" },
    /** OPT-IN rail capability (2026-10-30): mounts the hover-reveal
     *  circular toggle STRADDLING the panel's content-facing border (its
     *  center on the border line, half the circle over the content) and
     *  arms the hover-peek drawer while collapsed. `collapsed` then
     *  becomes a v-model channel (`update:collapsed`) driven by the
     *  toggle; a host that persists the flag may keep passing it back in.
     *
     *  A pointer resting on the toggle SUPPRESSES the peek dwell (the
     *  circle sits on the rail's hover surface), and a rail -> expanded
     *  flip PINNS the panel at full width for the transition window — the
     *  sidebar appears instantly while only the host width animates.
     *  Timing lives in useSidebarRail; geometry in HkSidebarRail.scss.
     *  Without this prop the panel renders exactly as before — no toggle,
     *  no peek, `collapsed` stays the plain presentational 56px rail. */
    collapsible: { type: Boolean, default: false },
    /** Layout width of the icon rail (the one-icon column). Mirrors the
     *  56px this component always used for its collapsed mode. */
    collapsedWidth: { type: String, default: "56px" },
    /** Hover dwell on the rail before the peek drawer opens, ms. */
    peekDelay: { type: Number, default: 400 },
    /** Grace after pointerleave before the peek drawer closes, ms. */
    peekGrace: { type: Number, default: 150 },
  },
  emits: {
    close: () => true,
    "update:collapsed": (v: boolean) => true,
  },
  setup(props, { emit, slots }) {
    // ── menu GROUP fold, stable across THIS sidebar's own rail swap ───
    // The rail chrome can be held by a SHELL (HkFaceShell provides the
    // shared fold store above its swap) or by this component itself
    // (standalone `HkSidebar collapsible`). Both assemble the same swap,
    // and the swap mounts each density as a FRESH generation — so an
    // instance-local fold inside a grouped HkMenu would be lost on every
    // flip here too (known-live-issues #43). Inheriting when a shell is
    // above keeps ONE fold for the one nav (a sidebar nested in a shell is
    // the same nav in another frame); providing otherwise gives the
    // standalone sidebar the same guarantee without any host change.
    // inject-then-provide is legal: we read the ancestor's value, and
    // descendants resolve ours.
    if (useMenuGroupState() === null) provideMenuGroupState();

    // ── rail state (collapsible only; see useSidebarRail for the
    //    timing semantics — dwell, grace, Escape, session-only default) ──
    // Semi-controlled `collapsed`: the composable holds a local ref the
    // prop keeps in sync (external change wins), and every internal flip
    // (the toggle) emits update:collapsed for a v-model host.
    const railCollapsed = ref(props.collapsed);
    watch(
      () => props.collapsed,
      (v) => {
        railCollapsed.value = v;
      },
    );
    // The host REGION element (the aside) — the machine uses it to tell a
    // real pointerleave from DOM churn during the peek/width transitions.
    const hostRef = ref<HTMLElement>();
    const rail = useSidebarRail({
      collapsed: railCollapsed,
      peekDelay: () => props.peekDelay,
      peekGrace: () => props.peekGrace,
      host: () => hostRef.value,
    });
    watch(rail.collapsed, (v) => {
      if (v !== props.collapsed) emit("update:collapsed", v);
    });

    // Collapsed-for-LAYOUT: the toggle's state when collapsible, the
    // plain prop otherwise (the legacy presentational 56px rail mode
    // renders exactly as before). Mobile never lays out collapsed — the
    // drawer overlay is the mobile shape.
    const layoutCollapsed = computed(() =>
      props.mobile
        ? false
        : props.collapsible
          ? rail.collapsed.value
          : props.collapsed,
    );
    const peeking = computed(() => props.collapsible && !props.mobile && rail.peeking.value);
    // The rail DENSITY (icon-only dress): collapsed layout, not peeking.
    // In rail mode this is the swap key — the density rides the swapped
    // GENERATION (frozen on the leaving copy for the dissolve), never the
    // host root, so nothing re-lays-out at the panel's transient width.
    const railDensity = computed(() => layoutCollapsed.value && !peeking.value);
    // The host's inline width IS the layout footprint — rail width while
    // collapsed OR peeking (the peek is an overlay; the layout must not
    // shift), full width while expanded.
    const hostWidth = computed(() =>
      props.mobile ? undefined : layoutCollapsed.value ? props.collapsedWidth : props.width,
    );
    // The panel's inline width: full while expanded OR peeking, rail
    // width otherwise — this is the lever that slides the peek out.
    const panelWidth = computed(() =>
      props.mobile ? undefined : layoutCollapsed.value && !peeking.value ? props.collapsedWidth : props.width,
    );

    // Persistent layout surface — the overlay scrollbar (shared chrome)
    // attaches to the scrolling body band. The rail swap mounts each
    // generation's body FRESH (the leaving copy is frozen and unmounts
    // with the dissolve), so the attach is a re-attach. Mechanism
    // notes (probed against Vue 3.5): a flip patches the refs
    // old -> null -> new in sequence — the unmount of the leaving copy
    // nulls the shared ref before the entering copy's mount re-points
    // it — so the guard below swallows the transient null and the FINAL
    // state always lands on the entering body. The element tracker keeps
    // a same-element watcher fire a no-op (no track churn on plain
    // re-renders); a flip hands the single handle to the new body, which
    // leaves the fading copy without a track for the dissolve — it is
    // pointer-dead and dissolving, so that is cosmetic.
    const bodyRef = ref<HTMLElement>();
    // Positioned wrapper containing ONLY the body — the rail host (the
    // panel also contains the header/footer bands).
    const bodyWrapRef = ref<HTMLElement>();
    let bodyScrollbar: OverlayScrollbarHandle | null = null;
    let bodyScrollbarEl: HTMLElement | null = null;

    const attachBodyScrollbar = () => {
      if (!bodyRef.value) return;
      if (bodyScrollbar && bodyScrollbarEl === bodyRef.value) return;
      bodyScrollbar?.detach();
      bodyScrollbarEl = bodyRef.value;
      bodyScrollbar = attachOverlayScrollbars(bodyRef.value, {
        axis: "vertical",
        host: bodyWrapRef.value,
      });
    };

    onMounted(attachBodyScrollbar);
    watch([bodyRef, bodyWrapRef], attachBodyScrollbar);

    // Density flips remount the body band (the rail swap renders each
    // generation's body FRESH), which used to snap the scroll back to the
    // top on every flip — including each hover-peek open/close, because
    // the shell keys the swap on `railActive && !peeking` (the #44 P3
    // audit finding; probed: scrollTop 120 -> peek -> 0 -> back -> 0).
    // The sidebar's own instance SURVIVES the flip (the swap lives inside
    // it), so the position only needs to cross the remount. A flip patches
    // the shared ref old -> null -> new: the null step still sees the
    // LEAVING element as the old value (its DOM is alive for the
    // dissolve), which is where the position is read from — an event-only
    // save would miss programmatic scrolls (no `scroll` event fires for
    // them), so the read happens on the ref hand-off itself and the
    // onScroll below merely keeps the value fresh between flips. Raw
    // scrollTop is an approximation across dresses (rail rows and full
    // rows have different heights) — an exact restore would need an
    // item-keyed anchor, not worth it for a nav list; the browser clamps
    // any overshoot.
    const savedScrollTop = ref(0);
    const onBodyScroll = (e: Event): void => {
      savedScrollTop.value = (e.currentTarget as HTMLElement).scrollTop;
    };
    watch(bodyRef, async (body, leaving) => {
      if (leaving) savedScrollTop.value = leaving.scrollTop;
      if (!body) return;
      await nextTick();
      body.scrollTop = savedScrollTop.value;
    });

    onBeforeUnmount(() => {
      bodyScrollbar?.detach();
      bodyScrollbar = null;
    });

    // Reactive (a setup-time snapshot would strand the toggle/handlers
    // on the mobile drawer after a runtime mobile/collapsible flip).
    const railChrome = computed(() => props.collapsible && !props.mobile);

    // ── host-region pointer wiring (rail chrome only) ─────────────────
    // A pointer parked on the toggle must NOT arm the peek dwell: the
    // toggle straddles the host's hover surface, so the drawer would
    // open under the resting cursor and jump the button away from it
    // (the reported twitch). Containment is GEOMETRIC — the toggle is
    // opacity:0 / pointer-events:none before the reveal, so event.target
    // cannot tell us it is under the pointer.
    //
    // ENTER is evaluated too, and BEFORE the arm: a pointer that crosses
    // the boundary and stops exactly on the toggle (or a synthetic enter
    // with no following move) would otherwise arm the dwell and open the
    // drawer under the cursor with no pointermove ever correcting it.
    const onHostPointerEnter = (e: PointerEvent) => {
      rail.setPeekSuppressed(isPointerOverRailToggle(hostRef.value, e.clientX, e.clientY));
      rail.onPointerEnter();
    };
    const onHostPointerMove = (e: PointerEvent) => {
      rail.setPeekSuppressed(isPointerOverRailToggle(hostRef.value, e.clientX, e.clientY));
    };

    // The pin window ends with the host's OWN width transition. Child
    // transitionend events bubble here too (the panel's width, a nested
    // sidebar), so filter to this element's width.
    const onHostTransitionEnd = (e: TransitionEvent) => {
      if (e.target !== e.currentTarget) return;
      if (e.propertyName !== "width") return;
      rail.endPinning();
    };

    /** The panel's inner bands, parameterized by the density so the
     *  rail swap can render each generation at its OWN dress: the swap
     *  invokes this with the entering generation's flag while the leaving
     *  copy stays frozen at its last render (per-generation density by
     *  construction). In rail mode the bands live inside the swap, which
     *  lives inside .hk-sidebar-rail-clip — the rail panel no longer
     *  clips (the toggle straddles its content-facing border), so the
     *  wrapper is what keeps full-width rows inside the 56px footprint
     *  while widths animate. Without rail chrome they stay direct
     *  children of the panel, exactly as before (and the toggle is a
     *  direct child of the panel in both cases where it exists, so it
     *  can never be clipped). */
    const renderBands = (collapsed: boolean) => (
      <>
        {slots.header ? (
          <header class="hk-sidebar-header">{slots.header()}</header>
        ) : null}
        <div ref={bodyWrapRef} class="hk-sidebar-body-wrap">
          <div ref={bodyRef} class="hk-sidebar-body" onScroll={onBodyScroll}>
            {/* Scoped params (ignored by plain slots): the density that
                owns THIS generation so a host renders icon-only rows
                while collapsed and full rows during a peek, plus the
                peek closer — a nav row click should dismiss the peek
                like the shell's onNavigate does. */}
            {slots.default?.({
              collapsed,
              peeking: peeking.value,
              closePeek: rail.closePeek,
            })}
          </div>
        </div>
        {slots.footer ? (
          <footer class="hk-sidebar-footer">{slots.footer()}</footer>
        ) : null}
      </>
    );

    return () => (
      <aside
        ref={hostRef}
        class={railChrome.value ? "hk-sidebar hk-sidebar-rail-host" : "hk-sidebar"}
        data-mobile={props.mobile || undefined}
        // LEGACY density carrier only (no rail chrome): [data-collapsed]
        // styles the presentational 56px rail exactly as before. In rail
        // mode the density moves onto the swap's GENERATION — a root-level
        // attribute flips with the state and would restyle the frozen
        // leaving generation mid-dissolve (the squeeze this wave fixes),
        // and a peek renders full rows at full width anyway.
        data-collapsed={!railChrome.value && railDensity.value || undefined}
        data-peeking={peeking.value || undefined}
        // Transient rail -> expanded window (useSidebarRail.pinning): the
        // panel and the panel's inner widths snap while THIS host's width
        // transition plays — expanding must not replay the sidebar slide.
        data-pinning={rail.pinning.value || undefined}
        style={props.mobile ? undefined : { width: hostWidth.value }}
        onPointerenter={railChrome.value ? onHostPointerEnter : undefined}
        onPointerleave={railChrome.value ? rail.onPointerLeave : undefined}
        onPointermove={railChrome.value ? onHostPointerMove : undefined}
        onTransitionend={railChrome.value ? onHostTransitionEnd : undefined}
        onKeydown={
          railChrome.value
            ? (e: KeyboardEvent) => {
                if (rail.onKeydown(e)) e.stopPropagation();
              }
            : undefined
        }
        onClick={(e) => {
          if (e.target === e.currentTarget && props.mobile) {
            emit("close");
          }
        }}
      >
        <nav
          class={railChrome.value ? "hk-sidebar-panel hk-sidebar-rail-panel" : "hk-sidebar-panel"}
          style={{ width: props.mobile ? undefined : panelWidth.value }}
        >
          {railChrome.value ? (
            /* The crossfade handoff (HkSidebarRailSwap): each generation
             * renders the bands at its OWN dress and width while the clip
             * windows the panel's animating width — no reflow, no wrap,
             * a pure opacity exchange (the tab-panel dissolve). */
            <div class="hk-sidebar-rail-clip">
              <HkSidebarRailSwap
                rail={railDensity.value}
                railWidth={props.collapsedWidth}
                expandedWidth={props.width}
              >
                {/* NOT `rail` — the scoped param would shadow the
                    useSidebarRail handle the outer bindings read. */}
                {({ rail: density }: { rail: boolean }) => renderBands(density)}
              </HkSidebarRailSwap>
            </div>
          ) : (
            renderBands(railDensity.value)
          )}
          {railChrome.value && (
            <HkSidebarRailToggle
              expanded={!layoutCollapsed.value}
              onToggle={rail.toggle}
            />
          )}
        </nav>
      </aside>
    );
  },
});
