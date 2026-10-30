import { computed, defineComponent, onBeforeUnmount, onMounted, ref, watch } from "vue";

import "./HkSidebar.scss";
import { attachOverlayScrollbars, type OverlayScrollbarHandle } from "../composables/useOverlayScrollbar";
import { useSidebarRail } from "../composables/useSidebarRail";
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

    // Persistent layout surface — attach the overlay scrollbar (shared
    // chrome) once and detach on unmount.
    const bodyRef = ref<HTMLElement>();
    // Positioned wrapper containing ONLY the body — the rail host (the
    // panel also contains the header/footer bands).
    const bodyWrapRef = ref<HTMLElement>();
    let bodyScrollbar: OverlayScrollbarHandle | null = null;

    onMounted(() => {
      if (!bodyRef.value) return;
      bodyScrollbar = attachOverlayScrollbars(bodyRef.value, {
        axis: "vertical",
        host: bodyWrapRef.value,
      });
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

    /** The panel's inner bands. In rail mode they live inside
     *  .hk-sidebar-rail-clip — the rail panel no longer clips (the toggle
     *  straddles its content-facing border), so the wrapper is what keeps
     *  full-width rows inside the 56px footprint while widths animate.
     *  Without rail chrome they stay direct children of the panel, exactly
     *  as before (and the toggle is a direct child of the panel in both
     *  cases where it exists, so it can never be clipped). */
    const renderBands = () => (
      <>
        {slots.header ? (
          <header class="hk-sidebar-header">{slots.header()}</header>
        ) : null}
        <div ref={bodyWrapRef} class="hk-sidebar-body-wrap">
          <div ref={bodyRef} class="hk-sidebar-body">
            {/* Scoped params (ignored by plain slots): the LIVE rail
                state so a host renders icon-only rows while collapsed
                and full rows during a peek, plus the peek closer — a
                nav row click should dismiss the peek like the shell's
                onNavigate does. */}
            {slots.default?.({
              collapsed: layoutCollapsed.value && !peeking.value,
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
        // NOT during a peek: [data-collapsed] carries the rail density
        // (centered header, tight paddings) and the peek renders FULL
        // rows at full width — the collapsed dress would mis-style it.
        data-collapsed={layoutCollapsed.value && !peeking.value || undefined}
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
            <div class="hk-sidebar-rail-clip">{renderBands()}</div>
          ) : (
            renderBands()
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
