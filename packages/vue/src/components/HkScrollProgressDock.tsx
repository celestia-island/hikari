// Scroll-progress dock: the standalone, default-on dock component that
// floats the visible-row-band pill over a scrolling list (user direction
// 2026-11-09: "做成默认开启但可以禁用注入的 dock 组件，它本身应该首先
// 独立，然后被列表大组件使用").
//
// This module owns four things:
// 1. the provide/inject vocabulary — the registration key
//    (`HK_SCROLL_PROGRESS_REGISTRAR`) a list uses to find the registrar
//    of the NEAREST enclosing enabled dock (provide/inject scoping is
//    what makes a list registered against an inner dock never leak to an
//    outer one), plus the wiring keys HkScrollContainer provides
//    unconditionally (`HK_SCROLL_PROGRESS_VIEWPORT` / `HK_SCROLL_PROGRESS_HOST`,
//    the container's single direction of dependency on this module — no
//    cycle) and the two gate keys (`HK_SCROLL_PROGRESS_ALLOWED`,
//    `HK_SCROLL_PROGRESS_DOCK_ACTIVE`);
// 2. the registration types (`HkScrollProgressHandle`,
//    `HkScrollProgressRegistrar`) — unchanged vocabulary, so HkTable /
//    HkCardList keep their self-registration untouched;
// 3. the sensing engine, moved here VERBATIM from HkScrollContainer
//    (2026-11-09 componentization): the visible band calculation, the
//    stale-total guard, the idle timer and the `progressLastTop` baseline
//    that keeps the mount-time first pass from counting as a scroll. The
//    dock now owns its own sensors (viewport scroll listener, passive +
//    rAF-coalesced, and ResizeObservers on the viewport and every
//    registered list root) — the container is back to pure scroll
//    plumbing;
// 4. the pill itself: head + arrow + tail (the lucide `ArrowRight`
//    glyph replaces the old tilde/hyphen between the two halves — the
//    breadcrumb separator precedent — with an RTL scaleX flip) and the
//    single-row sentence rendered whole with NO icon.
//
// Laziness contract: when the dock cannot or may not run (the `disabled`
// prop, a shell that closed `HK_SCROLL_PROGRESS_ALLOWED`, a nested dock
// inside an active one, or no viewport anywhere above), it renders its
// default slot as a bare fragment, provides NOTHING and installs NO
// listener — the only footprint is the slot content itself.

import { ArrowRight } from "lucide-vue-next";

import {
  computed,
  defineComponent,
  inject,
  onBeforeUnmount,
  provide,
  ref,
  Teleport,
  watch,
  type InjectionKey,
  type PropType,
  type Ref,
} from "vue";

import { scheduleFrame, type AnimationHandle } from "../runtime/animationBus";
import { useI18n } from "../i18n/context";
import "./HkScrollProgressDock.scss";

/** What a list hands to the registrar so the pill can describe it:
 *  the list's root element (the box that scrolls inside the dock's
 *  viewport) and the authoritative row total when the list knows one
 *  (undefined = the pill falls back to counting DOM rows). */
export interface HkScrollProgressHandle {
  getRoot(): HTMLElement | null;
  getTotal(): number | undefined;
  /** The list's own row elements in display order — wins over the
   *  dock's `selector` when present. This is for a list whose DOM rows
   *  are not all data rows (HkTable's section bands are `<tr>`s in the
   *  body, but they are not rows). Return `undefined` to fall back to
   *  the dock's selector. */
  getRows?(): readonly Element[] | undefined;
}

/** Provided by every enabled HkScrollProgressDock, and never by a lazy
 *  one. Lists inject it (null fallback) and register on mounted /
 *  unregister on unmounted. */
export interface HkScrollProgressRegistrar {
  register(handle: HkScrollProgressHandle): void;
  unregister(handle: HkScrollProgressHandle): void;
}

export const HK_SCROLL_PROGRESS_REGISTRAR: InjectionKey<HkScrollProgressRegistrar> =
  Symbol("hk-scroll-progress-registrar");

/** The scroll viewport the dock senses, provided UNCONDITIONALLY by
 *  every HkScrollContainer (its own template ref, null until mounted —
 *  the shared `Ref<HTMLElement | null>` contract). A dock inside a
 *  container injects its viewport; a standalone dock must be handed the
 *  `viewport` prop explicitly or it stays lazy. */
export const HK_SCROLL_PROGRESS_VIEWPORT: InjectionKey<Ref<HTMLElement | null>> =
  Symbol("hk-scroll-progress-viewport");

/** The element the pill TELEPORTS to (the container host —
 *  position: relative), provided unconditionally beside the viewport
 *  key. Null (or absent) = the pill renders in place inside the dock's
 *  own scope, which a standalone consumer must position. */
export const HK_SCROLL_PROGRESS_HOST: InjectionKey<Ref<HTMLElement | null>> =
  Symbol("hk-scroll-progress-host");

/** The shell MASTER SWITCH, provided by HkFaceShell from its
 *  `scrollProgress` prop: the on/off lever for every dock in the face.
 *  Absent = allowed (any standalone usage runs by default). */
export const HK_SCROLL_PROGRESS_ALLOWED: InjectionKey<boolean> =
  Symbol("hk-scroll-progress-allowed");

/** Provided `true` by every ENABLED dock over its own subtree: a nested
 *  dock injecting it stands down (static resolution, at setup — hosts
 *  pass these gates as static props, the HkScrollContainer prop
 *  precedent). Statically resolvable anti-double-pill: of a chain of
 *  docks the topmost enabled one serves the subtree, every deeper dock
 *  goes inert and provides nothing, so lists fall through to the top
 *  dock's registrar and exactly ONE pill can ever exist. (An ancestor
 *  cannot see a descendant, so the reverse priority is not expressible
 *  with static inject — and behaviorally irrelevant: competing docks
 *  resolve the same injected viewport and host, so either owner paints
 *  the same pill in the same place.) */
export const HK_SCROLL_PROGRESS_DOCK_ACTIVE: InjectionKey<boolean> =
  Symbol("hk-scroll-progress-dock-active");

/** The pill renderer. Three states, mirrored on `data-state` so the SCSS
 *  owns the paint:
 *  - "hidden"  — a precondition fails (no registration, no overflow, no
 *    rows): `display: none`, never just transparent;
 *  - "active"  — the scroll offset is changing: opaque;
 *  - "idle"    — scrolling stopped: opacity 0 over the ~200ms fade.
 *  A11y honesty: `aria-hidden` throughout — the pill is DECORATIVE chrome
 *  and nothing announces the row position (HkInfiniteTail's role=status
 *  announces load / end-of-list events only, never a scroll position);
 *  this component adds no announce channel of its own. */
const HkScrollProgressDockPill = defineComponent({
  name: "HkScrollProgressDockPill",
  props: {
    shown: { type: Boolean, default: false },
    active: { type: Boolean, default: false },
    /** First visible row (1-based). */
    from: { type: Number, default: 0 },
    /** Last visible row (1-based, inclusive) — at the bottom of the
     *  list this equals the row count, so the range reads as an end. */
    to: { type: Number, default: 0 },
    /** Authoritative total (the pill's "共 N 条" / "of N"). */
    total: { type: Number, default: 0 },
  },
  setup(props) {
    const { t } = useI18n();
    return () => {
      // One visible row collapses the range to the single-row sentence
      // (rendered whole, NO icon); a degenerate band (0 rows) renders no
      // text with the pill itself (its precondition path hides it).
      const degenerate = props.total < 1 || props.from < 1 || props.to < props.from;
      const single = !degenerate && props.from === props.to;
      // Each half interpolates whatever placeholders its locale uses
      // (ja's head carries {total}; ko's tail is bare) — the missing
      // ones are no-ops.
      const fill = (s: string) =>
        s
          .replace("{from}", String(props.from))
          .replace("{to}", String(props.to))
          .replace("{total}", String(props.total));
      const head = single || degenerate
        ? ""
        : fill(t("hikari::scrollProgress.rangeHead", "Rows {from}"));
      const tail = single || degenerate
        ? ""
        : fill(t("hikari::scrollProgress.rangeTail", "{to} of {total}"));
      const sentence = single
        ? fill(t("hikari::scrollProgress.single", "Row {from} of {total}"))
        : "";
      return (
        <span
          class="hk-scroll-progress-dock"
          aria-hidden="true"
          data-state={!props.shown ? "hidden" : props.active ? "active" : "idle"}
        >
          {single ? (
            <span class="hk-scroll-progress-dock-text">{sentence}</span>
          ) : !degenerate ? (
            <>
              <span class="hk-scroll-progress-dock-text">{head}</span>
              <ArrowRight class="hk-scroll-progress-dock-arrow" />
              <span class="hk-scroll-progress-dock-text">{tail}</span>
            </>
          ) : null}
        </span>
      );
    };
  },
});

/**
 * HkScrollProgressDock — the standalone scroll-progress dock. Wrap any
 * content (a list large-component, a bare table, a page body): while a
 * registered list under the dock scrolls its viewport, the pill floats
 * over the viewport host naming the visible row band. Default ON —
 * `disabled` is the opt-OUT lever, layered under the shell's
 * `HK_SCROLL_PROGRESS_ALLOWED` master switch.
 *
 * ```tsx
 * <HkScrollProgressDock>
 *   <HkAdminTablePage … />
 * </HkScrollProgressDock>
 * ```
 *
 * Standalone (outside any HkScrollContainer) needs the `viewport` prop
 * to sense anything; without it the dock is lazy by design.
 */
export const HkScrollProgressDock = defineComponent({
  name: "HkScrollProgressDock",
  props: {
    /** Opt OUT (the dock is default-on). Layering: the shell master
     *  switch (`HK_SCROLL_PROGRESS_ALLOWED`) > this prop > a nested dock
     *  standing down. GATES ARE RESOLVED ONCE, at setup: every host
     *  passes them statically (the HkScrollContainer prop precedent), so
     *  a runtime flip needs a remount and is not sensed. */
    disabled: { type: Boolean, default: false },
    /** The element to sense when the dock is used STANDALONE. Wins over
     *  the injected `HK_SCROLL_PROGRESS_VIEWPORT` (HkScrollContainer
     *  provides it unconditionally). Omitted inside a container = the
     *  container's viewport; omitted with no container = lazy. */
    viewport: { type: Object as PropType<HTMLElement | null>, default: undefined },
    /** Idle window (ms) after the last scroll-offset change before the
     *  pill fades out. Read live; clamped to 300..3000. */
    idle: { type: Number, default: 900 },
    /** Which descendants count as "rows" for the pill's visible band
     *  (from/to) and its total fallback. The default matches the table
     *  grammar every admin list ships — BODY rows only: a `tr` default
     *  would count the header row as row one and skew every index. A
     *  non-table list (a card roster) overrides with its own row
     *  spelling via the handle's `getRows`; a bare non-table slot can
     *  also override the prop. A runtime change re-senses on the next
     *  pass. */
    selector: { type: String, default: "tbody tr" },
  },
  setup(props, { slots }) {
    // ── Gate resolution (static, at setup — see the `disabled` doc) ──
    const shellAllowed = inject(HK_SCROLL_PROGRESS_ALLOWED, true);
    const nestedDockActive = inject(HK_SCROLL_PROGRESS_DOCK_ACTIVE, false);
    const viewportSource = inject(HK_SCROLL_PROGRESS_VIEWPORT, null);
    const hostSource = inject(HK_SCROLL_PROGRESS_HOST, null);
    const enabled = !props.disabled && shellAllowed && !nestedDockActive;

    // Standalone with NOTHING to sense (no `viewport` prop, no container
    // above providing the key): fully lazy. Providing a registrar here
    // would shadow an outer dock's and swallow its lists' registration,
    // so a viewportless dock leaves the vocabulary untouched.
    const viewportless = props.viewport == null && viewportSource === null;
    if (!enabled || viewportless) {
      // Fully lazy: no provide, no listener, no pill — the slot is the
      // whole footprint (the fragment keeps no wrapper element in the
      // DOM either).
      return () => <>{slots.default?.()}</>;
    }

    // ── Enabled: publish the vocabulary over this subtree ────────────
    const registrations = new Set<HkScrollProgressHandle>();
    provide(HK_SCROLL_PROGRESS_REGISTRAR, {
      register: registerProgress,
      unregister: unregisterProgress,
    } satisfies HkScrollProgressRegistrar);
    provide(HK_SCROLL_PROGRESS_DOCK_ACTIVE, true);

    // The prop wins over the container-provided viewport (a standalone
    // dock hands its own box; an embedded one may re-point the sensor).
    const resolvedViewport = computed(
      () => props.viewport ?? viewportSource?.value ?? null,
    );

    // ── Pill state (the engine moved verbatim from HkScrollContainer) ─
    const progressShown = ref(false);
    const progressActive = ref(false);
    const progressFrom = ref(0);
    const progressTo = ref(0);
    const progressDenominator = ref(0);
    let progressIdleTimer: ReturnType<typeof setTimeout> | null = null;
    // The offset the last sensing pass saw; null = not baselined yet, so
    // the mount-time pass never counts as "scrolling" (the pill appears
    // on the first real offset change, not on mount).
    let progressLastTop: number | null = null;

    function clampProgressIdle(): number {
      return Math.min(3000, Math.max(300, props.idle));
    }

    function disarmProgressIdle() {
      if (progressIdleTimer !== null) {
        clearTimeout(progressIdleTimer);
        progressIdleTimer = null;
      }
    }

    function armProgressIdle() {
      disarmProgressIdle();
      progressIdleTimer = setTimeout(() => {
        progressIdleTimer = null;
        progressActive.value = false;
      }, clampProgressIdle());
    }

    /** Drop every pill precondition at once. `progressLastTop` resets so
     *  the next appearance re-baselines — a pass that only re-armed the
     *  preconditions (content grew back) must not read as a scroll. */
    function setProgressHidden() {
      progressShown.value = false;
      progressActive.value = false;
      disarmProgressIdle();
      progressLastTop = null;
      progressFrom.value = 0;
      progressTo.value = 0;
      progressDenominator.value = 0;
    }

    /** The ACTIVE registration: the first registered list whose root
     *  intersects the viewport (registration order — the Set preserves
     *  insertion); when none intersects, the one whose root top is
     *  nearest ABOVE the viewport top (the list the user just scrolled
     *  out of). Deterministic in both tiers. */
    function pickActiveProgressRoot(band: DOMRect): { handle: HkScrollProgressHandle; root: HTMLElement } | null {
      let firstIntersecting: { handle: HkScrollProgressHandle; root: HTMLElement } | null = null;
      let nearestAbove: { handle: HkScrollProgressHandle; root: HTMLElement; top: number } | null = null;
      for (const handle of registrations) {
        const root = handle.getRoot();
        if (!root || !root.isConnected) continue;
        const rect = root.getBoundingClientRect();
        if (rect.bottom > band.top && rect.top < band.bottom) {
          if (!firstIntersecting) firstIntersecting = { handle, root };
          continue;
        }
        if (rect.top <= band.top && (!nearestAbove || rect.top > nearestAbove.top)) {
          nearestAbove = { handle, root, top: rect.top };
        }
      }
      return firstIntersecting ?? (nearestAbove ? { handle: nearestAbove.handle, root: nearestAbove.root } : null);
    }

    /** Pill sensing. Preconditions: a registration, vertical overflow,
     *  and an active list with at least one row; failing any hides the
     *  pill outright. While they hold, the band is the VISIBLE ROW
     *  RANGE — `from` is the first row whose bottom edge is still below
     *  the viewport top and `to` the last row whose top edge is still
     *  above the viewport bottom (both 1-based, partial rows counted) —
     *  and the denominator is the registered total — unless it is
     *  missing, non-finite, sub-1, or STALE (smaller than the live row
     *  count, a page that loaded more rows than it declared), in which
     *  case the DOM count wins so the band can never exceed the total
     *  (user direction 2026-11-08: the old single first-row numerator
     *  made a fully-scrolled list read "16 / 30" instead of an end). */
    function senseProgress(vp: HTMLElement) {
      if (registrations.size === 0) {
        setProgressHidden();
        return;
      }
      syncRootObservers();
      const band = vp.getBoundingClientRect();
      const active = pickActiveProgressRoot(band);
      // A list may own the row grammar (HkTable's section bands are body
      // `<tr>`s that are not data rows); its `getRows` wins over the
      // dock selector. No `getRows` (or an undefined return) keeps the
      // selector path byte-for-byte.
      const rows = active
        ? active.handle.getRows?.() ?? active.root.querySelectorAll(props.selector)
        : [];
      if (!active || rows.length === 0 || vp.scrollHeight <= vp.clientHeight + 1) {
        setProgressHidden();
        return;
      }
      let first = rows.length;
      for (let i = 0; i < rows.length; i++) {
        if ((rows[i] as HTMLElement).getBoundingClientRect().bottom > band.top) {
          first = i + 1;
          break;
        }
      }
      let last = first;
      for (let i = rows.length - 1; i >= 0; i--) {
        if ((rows[i] as HTMLElement).getBoundingClientRect().top < band.bottom) {
          last = i + 1;
          break;
        }
      }
      const declared = active.handle.getTotal();
      const denominator =
        typeof declared === "number" && Number.isFinite(declared) && declared >= 1
          ? Math.max(declared, rows.length)
          : rows.length;
      progressFrom.value = Math.min(first, denominator);
      progressTo.value = Math.min(Math.max(last, progressFrom.value), denominator);
      progressDenominator.value = denominator;
      progressShown.value = true;
      // Scroll-active: only a changed offset counts (the pass also runs
      // for resizes and content mutations). The idle fade re-arms on
      // every moving pass, so continuous scrolling never snaps off.
      if (progressLastTop !== null && vp.scrollTop !== progressLastTop) {
        progressActive.value = true;
        armProgressIdle();
      }
      progressLastTop = vp.scrollTop;
    }

    // ── Sensors: viewport scroll (passive, rAF-coalesced) + ROs ──────
    let currentViewport: HTMLElement | null = null;
    let contentRO: ResizeObserver | null = null;
    let scheduled: AnimationHandle | null = null;
    // Per-registration root cache for the content observers — roots can
    // appear AFTER register (a list mounts its box in its own mounted
    // hook), so the sense pass re-syncs the observed set each time.
    const observedRoots = new Map<HkScrollProgressHandle, HTMLElement>();

    function onViewportScroll() {
      scheduleSense();
    }

    function scheduleSense() {
      scheduled?.disconnect();
      scheduled = scheduleFrame(() => {
        scheduled = null;
        if (currentViewport) senseProgress(currentViewport);
      });
    }

    /** Keep the content RO pointed at every registered list's CURRENT
     *  root (handles may hand a new element after a slot re-render; a
     *  null root is simply not observed until it exists). */
    function syncRootObservers() {
      if (!contentRO) return;
      for (const handle of registrations) {
        const root = handle.getRoot();
        const prev = observedRoots.get(handle);
        if (root && root !== prev) {
          if (prev) contentRO.unobserve(prev);
          contentRO.observe(root);
          observedRoots.set(handle, root);
        } else if (!root && prev) {
          contentRO.unobserve(prev);
          observedRoots.delete(handle);
        }
      }
    }

    function attachViewport(vp: HTMLElement) {
      if (currentViewport === vp) return;
      detachSensors();
      currentViewport = vp;
      vp.addEventListener("scroll", onViewportScroll, { passive: true });
      contentRO = new ResizeObserver(scheduleSense);
      contentRO.observe(vp);
      // Baseline pass: preconditions hold → the pill starts hidden (not
      // active); `progressLastTop` baselines here (see its doc).
      senseProgress(vp);
    }

    /** Detach every sensor AND drop the pill state — a stale pill or a
     *  pending timer must not outlive the viewport it sensed. */
    function detachSensors() {
      if (currentViewport) {
        currentViewport.removeEventListener("scroll", onViewportScroll);
        currentViewport = null;
      }
      contentRO?.disconnect();
      contentRO = null;
      observedRoots.clear();
      scheduled?.disconnect();
      scheduled = null;
      disarmProgressIdle();
      setProgressHidden();
    }

    // Viewport resolution is reactive: the container's template ref
    // fills AFTER this component mounts (child mounted hooks run before
    // parent ref assignment), so the attach waits for the ref — a
    // standalone `viewport` prop lands on the same watcher.
    watch(resolvedViewport, (vp) => {
      if (vp) attachViewport(vp);
      else detachSensors();
    }, { immediate: true, flush: "post" });

    onBeforeUnmount(detachSensors);

    function registerProgress(handle: HkScrollProgressHandle) {
      registrations.add(handle);
      // Immediate re-sense (the dock owns registration now): a list
      // mounting into an overflowing viewport must not wait for a
      // scroll to become describable.
      if (currentViewport) senseProgress(currentViewport);
    }

    function unregisterProgress(handle: HkScrollProgressHandle) {
      registrations.delete(handle);
      const prev = observedRoots.get(handle);
      if (prev && contentRO) {
        contentRO.unobserve(prev);
        observedRoots.delete(handle);
      }
      if (currentViewport) senseProgress(currentViewport);
    }

    return () => {
      const pill = (
        <HkScrollProgressDockPill
          shown={progressShown.value}
          active={progressActive.value}
          from={progressFrom.value}
          to={progressTo.value}
          total={progressDenominator.value}
        />
      );
      // The pill TELEPORTS to the container host (the element that is
      // position: relative) so it paints exactly where the old
      // container-attached pill did: absolute bottom-center of the
      // container, never scrolling away with the content. No host
      // (standalone) = render in place inside the scope, which the
      // consumer must position (the scope itself is display: contents
      // and provides no box).
      const host = hostSource?.value ?? null;
      return (
        <div class="hk-scroll-progress-dock-scope">
          {slots.default?.()}
          {host ? <Teleport to={host}>{pill}</Teleport> : pill}
        </div>
      );
    };
  },
});

export default HkScrollProgressDock;
