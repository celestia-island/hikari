import { computed, defineComponent, onBeforeUnmount, onMounted, ref, watch } from "vue";

import "./HkSidebar.scss";
import { attachOverlayScrollbars, type OverlayScrollbarHandle } from "../composables/useOverlayScrollbar";
import { useSidebarRail } from "../composables/useSidebarRail";
import HkSidebarRailToggle from "./HkSidebarRailToggle";

export default defineComponent({
  name: "HkSidebar",
  props: {
    collapsed: { type: Boolean, default: false },
    mobile: { type: Boolean, default: false },
    width: { type: String, default: "280px" },
    /** OPT-IN rail capability (2026-10-30): mounts the hover-reveal
     *  circular toggle on the panel's content-facing edge and arms the
     *  hover-peek drawer while collapsed. `collapsed` then becomes a
     *  v-model channel (`update:collapsed`) driven by the toggle; a
     *  host that persists the flag may keep passing it back in. Without
     *  this prop the panel renders exactly as before — no toggle, no
     *  peek, `collapsed` stays the plain presentational 56px rail. */
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
    const rail = useSidebarRail({
      collapsed: railCollapsed,
      peekDelay: () => props.peekDelay,
      peekGrace: () => props.peekGrace,
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

    return () => (
      <aside
        class={railChrome.value ? "hk-sidebar hk-sidebar-rail-host" : "hk-sidebar"}
        data-mobile={props.mobile || undefined}
        // NOT during a peek: [data-collapsed] carries the rail density
        // (centered header, tight paddings) and the peek renders FULL
        // rows at full width — the collapsed dress would mis-style it.
        data-collapsed={layoutCollapsed.value && !peeking.value || undefined}
        data-peeking={peeking.value || undefined}
        style={props.mobile ? undefined : { width: hostWidth.value }}
        onPointerenter={railChrome.value ? rail.onPointerEnter : undefined}
        onPointerleave={railChrome.value ? rail.onPointerLeave : undefined}
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
