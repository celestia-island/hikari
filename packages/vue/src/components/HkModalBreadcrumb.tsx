import { ChevronRight } from "lucide-vue-next";

import {
  computed,
  defineComponent,
  nextTick,
  onBeforeUnmount,
  onMounted,
  ref,
  Teleport,
  Transition,
  watch,
} from "vue";
import { usePopupManager, type PopupEntry } from "../runtime/usePopupManager";
import { useI18n } from "../i18n/context";
import { useReportedTransition } from "../composables/useReportedTransition";
import { scheduleEvery } from "../runtime/animationBus";
import { ancestorZoom } from "../runtime/cssZoom";
import { viewportGutterPx } from "../runtime/viewportGutter";
import { useBreakpoint } from "../runtime/useBreakpoint";
import { clampToDisplayWidth, displayWidthUnits, ELLIPSIS } from "../runtime/displayWidth";
import HkPopover from "./HkPopover";
import HkMenuPanel from "./HkMenuPanel";
import HkMenuActionItem from "./HkMenuActionItem";
import HkListTransition from "./HkListTransition";
import "./HkModalBreadcrumb.scss";
import { ensureOverlayRoot } from "../overlay/overlayRoot";

/** Window kinds always participate in the stack: modals and drawers block
 *  the page on every form factor, desktop and mobile alike. */
const WINDOW_KINDS: ReadonlySet<string> = new Set(["modal", "drawer"]);

/** TransitionGroup key of the fold trigger ("…"). Popup ids are UUIDs /
 *  random base36, so this literal can never collide with a real layer. */
const MORE_KEY = "hk-modal-breadcrumb-more";

/* Layout fallbacks for the overflow budget — the numbers this component's
 * own stylesheet declares (12px label type, 12px chevron, 8px gaps, 2rem
 * side padding, 1px border, 24px trigger). A DOM that reports no boxes
 * (unit tests, SSR) can only be judged with them; a real browser measures
 * the off-screen clone and never reads these. */
const LABEL_FONT_PX = 12;
const SEPARATOR_PX = 12;
const GAP_PX = 8;
const SIDE_PADDING_PX = 32;
const BORDER_PX = 1;
const MORE_PX = 24;
/** The strip's own height for the moments no box can be measured (first
 *  resync, unit DOM): the stylesheet declares 12px vertical padding, a
 *  ~17px label line and a 1px border — 12·2 + 17 + 1·2 ≈ 43. Models the
 *  UNFOLDED strip; a folded one is ~50px (the 24px trigger line) — the
 *  fallback only serves boxless DOMs, a real browser measures the live
 *  nav and the slow tick re-derives from it. */
const STRIP_HEIGHT_PX = 43;

interface Crumb {
  /** Popup-registry id this crumb can navigate back to. */
  id: string;
  /** Full layer name, never cut — the menu and assistive tech read this. */
  label: string;
  /** What the strip renders, cut to the label budget. */
  text: string;
  truncated: boolean;
  current: boolean;
}

export default defineComponent({
  name: "HkModalBreadcrumb",
  props: {
    appRootId: { type: String, default: "app" },
    headerSelector: { type: String, default: ".hk-glass-header" },
    headerFallbackHeight: { type: Number, default: 48 },
    /**
     * Longest a layer label may render, in full-width glyph units (one CJK
     * ideograph = 1, one Latin glyph = 0.5 — see runtime/displayWidth). A
     * window title is free text — "【e2e-w0-002310】自动化测试流水线冒烟：请巡
     * 检…" is an ordinary chest modal name — and the strip is a fixed overlay
     * across the app header, so an uncapped label pushed the whole strip past
     * both viewport edges (2026-09-16 report). The ellipsis counts inside the
     * budget: a 10-unit cap renders ten ideographs, or nine plus the
     * ellipsis. Full names stay in the DOM for assistive tech and in the
     * all-layers menu.
     */
    maxLabelUnits: { type: Number, default: 10 },
    /**
     * Least daylight, in px, between the app's top edge and the strip's own
     * top edge. The strip is centred on the app header, and on the standard
     * short header that centre line sits ~24px from the top — less than the
     * strip's half height, so its upper half used to kiss the very top edge
     * (2026-10-05 user report). The top is now the lower of "centred on the
     * header" and "this clearance"; a header whose centre already sits at
     * least this far down keeps the strip centred on it. Authored in the
     * strip's LOCAL px like every length here — a host root zoom scales it
     * at paint, so it can only over-deliver daylight. Below 10 the
     * entrance's own 10px rise (the window choreography this strip rides)
     * transiently pokes back above the app top; the default 12 keeps a
     * 2px margin mid-flight.
     */
    topGap: { type: Number, default: 12 },
  },
  setup(props) {
    const manager = usePopupManager();
    const { t } = useI18n();
    const { isMobile } = useBreakpoint();

    /** Sanitized once: a host passing NaN would otherwise poison both the
     *  pre-resync ref and every resync (Math.max(x, NaN) is NaN, and the
     *  browser drops `top: NaNpx`, parking the strip at its static
     *  position). A NEGATIVE gap stays the host's choice: it lowers the
     *  clearance candidate below the centre line, which then wins — i.e.
     *  "I don't care about daylight". */
    const topGapPx = computed(() => (Number.isFinite(props.topGap) ? props.topGap : 12));

    /** Which entries the strip navigates. Windows (modal/drawer) always;
     *  dropdown-kind surfaces only while they BLOCK like a window — the
     *  mobile bottom sheet a menu/popover becomes when viewport space
     *  forces it bottom-up. An anchored desktop popover/menu is a
     *  non-blocking hidden level: it never appears here, because it is
     *  not a window the user moves between, just a temporary attachment
     *  to the surface below. */
    const stackEntries = computed<PopupEntry[]>(() => {
      const entries: PopupEntry[] = [];
      for (const [, entry] of manager.registry.value) {
        if (WINDOW_KINDS.has(entry.kind) || entry.blocking) {
          entries.push(entry);
        }
      }
      return entries.sort((a, b) => a.zIndex - b.zIndex);
    });

    const visible = computed(() => stackEntries.value.length > 1);

    /** Every layer must carry a real, i18n-resolved name — the popup
     *  manager dev-warns on untitled registrations. The generic labels
     *  below are localized last resorts for production, never a bare
     *  "Layer N": an unnamed window reads as a window, an unnamed sheet
     *  reads as a menu. */
    const crumbs = computed<Crumb[]>(() => {
      const entries = stackEntries.value;
      return entries.map((entry, i) => {
        const label =
          entry.title ||
          (entry.kind === "dropdown"
            ? t("hikari::modal.unnamedSheet", "Menu")
            : t("hikari::modal.unnamedWindow", "Window"));
        const text = clampToDisplayWidth(label, props.maxLabelUnits);
        return {
          id: entry.id,
          label,
          text,
          truncated: text !== label,
          current: i === entries.length - 1,
        };
      });
    });

    // ── Overflow collapse ─────────────────────────────────────────────
    // The strip is centred on the app header and lives outside the page
    // flow, so an over-long stack spilled past BOTH screen edges (the
    // 2026-09-16 report: one long modal title clipped left and right at
    // once). Leading layers now fold into a "…" trigger followed by the
    // usual chevron, and the tail keeps rendering normally. Which prefix
    // folds is decided from measured widths, never from a per-item
    // character count: the tail's labels are already capped, so how many
    // layers fit is a function of the viewport, the host's theme type scale
    // and the actual glyphs.
    const hiddenCount = ref(0);
    const navRef = ref<HTMLElement>();
    const measureHostRef = ref<HTMLElement>();
    const moreRef = ref<HTMLElement | null>(null);

    /** Off-screen clone elements, keyed by popup id: the clone lays out
     *  EVERY layer at all times, so the collapse decision never depends on
     *  what the collapsed strip currently renders (measuring the live
     *  crumbs would shrink the sample the moment they fold away). */
    const cloneEls = new Map<string, HTMLElement>();
    let triggerClone: HTMLElement | null = null;

    function setCloneEl(id: string, el: Element | null): void {
      if (el) cloneEls.set(id, el as HTMLElement);
      else cloneEls.delete(id);
    }

    function readPx(value: string | null | undefined, fallback: number): number {
      const n = Number.parseFloat(value ?? "");
      return Number.isFinite(n) ? n : fallback;
    }

    /** The shared viewport gutter in the VISUAL px the crumb rects and
     *  `innerWidth` come back in. The token itself is a length inside the
     *  strip's (possibly zoomed) subtree, so it scales at paint like the
     *  strip's own padding — runtime/viewportGutter leaves the correction to
     *  its callers, and this is a caller that mixes it with gBCR numbers. */
    function visualGutter(z: number): number {
      return viewportGutterPx() * z;
    }

    /** Content-box budget of the strip, in the visual px the crumb rects
     *  come back in: the viewport minus the shared gutter, the strip's own
     *  side padding and its border. Every term but the viewport is authored
     *  in the strip's LOCAL px (a host root zoom scales them at paint), so
     *  they are converted once — the instrument HkPopover's positioning uses
     *  for the same reason. */
    function contentBudget(): number {
      const nav = navRef.value;
      const vw = typeof window === "undefined" ? 0 : window.innerWidth;
      if (!nav || !(vw > 0)) return Number.POSITIVE_INFINITY;
      const z = currentZoom();
      const cs = window.getComputedStyle(nav);
      const pad =
        (readPx(cs.paddingLeft, SIDE_PADDING_PX) +
          readPx(cs.paddingRight, SIDE_PADDING_PX)) *
        z;
      const border =
        (readPx(cs.borderLeftWidth, BORDER_PX) + readPx(cs.borderRightWidth, BORDER_PX)) * z;
      return vw - visualGutter(z) * 2 - pad - border;
    }

    /** The strip's inter-crumb gap (local px → visual px). */
    function navGap(): number {
      const nav = navRef.value;
      if (!nav) return GAP_PX;
      const cs = window.getComputedStyle(nav);
      const gap = cs.columnGap && cs.columnGap !== "normal" ? cs.columnGap : cs.gap;
      return readPx(gap, GAP_PX) * currentZoom();
    }

    /** The zoom between the strip and the viewport root, read at the strip
     *  itself (it may be teleported into a host's zoomed subtree). */
    function currentZoom(): number {
      return ancestorZoom(navRef.value ?? document.body);
    }

    function measuredWidth(el: HTMLElement | null | undefined): number {
      const w = el?.getBoundingClientRect().width ?? 0;
      return Number.isFinite(w) && w > 0 ? w : 0;
    }

    /** One crumb's footprint: its label, plus the chevron it carries when
     *  it follows another crumb (index > 0) — exactly how the clone lays
     *  them out. A non-first crumb is [chevron][its own 8px gap][label]: both
     *  halves live INSIDE the crumb, while the strip's inter-crumb gap is
     *  added by measureStrip — the two gaps are different boxes and must not
     *  be collapsed into one. A DOM without boxes falls back to the
     *  type-size estimate: those constants are the strip's own local px, so
     *  they scale with the host's root zoom exactly like measured rects do,
     *  and the (already visual) gaps ride on top. */
    function crumbFootprint(crumb: Crumb, index: number, gap: number, z: number): number {
      const measured = measuredWidth(cloneEls.get(crumb.id));
      if (measured > 0) return measured;
      // The measured branch is the contract: a crumb's own box is
      // [chevron][inner gap][label] — never the strip's inter-crumb gap,
      // which measureStrip adds across the list. Adding it here too would
      // count every gap after the first twice (the error the second review
      // round found in the other direction).
      const inner = index > 0 ? SEPARATOR_PX + gap / z : 0;
      return (displayWidthUnits(crumb.text) * LABEL_FONT_PX + inner) * z;
    }

    function measureStrip(): void {
      const list = crumbs.value;
      const n = list.length;
      if (n <= 1) {
        hiddenCount.value = 0;
        return;
      }
      const budget = contentBudget();
      if (!Number.isFinite(budget)) {
        hiddenCount.value = 0;
        return;
      }
      const z = currentZoom();
      const gap = navGap();
      const widths = list.map((crumb, i) => crumbFootprint(crumb, i, gap, z));
      const full = widths.reduce((sum, w) => sum + w, 0) + gap * (n - 1);
      if (full <= budget) {
        hiddenCount.value = 0;
        return;
      }
      const more = measuredWidth(triggerClone) || MORE_PX * z;
      // Longest visible tail wins: leading layers fold one at a time until
      // trigger + tail fits. The last layer is never folded away — if even
      // the current layer alone overflows, it keeps the strip and its own
      // CSS ellipsis does the rest.
      for (let h = 1; h < n; h++) {
        let cost = more;
        for (let i = h; i < n; i++) cost += gap + widths[i];
        if (cost <= budget) {
          hiddenCount.value = h;
          return;
        }
      }
      hiddenCount.value = n - 1;
    }

    const hidden = computed(() => crumbs.value.slice(0, hiddenCount.value));
    const tail = computed(() => crumbs.value.slice(hiddenCount.value));
    const folded = computed(() => hidden.value.length > 0);

    // ── All-layers menu ──────────────────────────────────────────────
    // The trigger lists EVERY layer of the stack, topmost first, with
    // their FULL names — the strip's clamp never reaches this menu. The
    // layer the user is currently on is marked with the menu row's own
    // selected face (HkMenuActionItem `active` → the unified menu-item
    // grammar's [data-active] box). HkPopover owns the form-factor rules
    // (anchored under the trigger on desktop, bottom-up sheet on mobile)
    // and registers the surface with the popup manager, so the menu is a
    // first-class layer of the very stack it lists — and must not list
    // ITSELF: the popover's `registered` handle tells this strip which
    // layer to drop from the rows.
    const menuOpen = ref(false);
    const menuSheetId = ref<string | null>(null);
    const menuLabel = computed(() => t("hikari::modal.allLayers", "All layers"));

    /** Live rows: every stack layer but the menu's own surface, topmost
     *  first (reverse stack order — the current layer leads the list).
     *  Live, not a snapshot, so an anchored desktop menu keeps agreeing
     *  with a stack that changed underneath it. */
    const menuItems = computed<{ id: string; label: string; current: boolean }[]>(() => {
      const layers = stackEntries.value.filter((entry) => entry.id !== menuSheetId.value);
      return layers
        .slice()
        .reverse()
        .map((entry, i) => ({
          id: entry.id,
          label:
            entry.title ||
            (entry.kind === "dropdown"
              ? t("hikari::modal.unnamedSheet", "Menu")
              : t("hikari::modal.unnamedWindow", "Window")),
          current: i === 0,
        }));
    });

    /** The trigger must stay mounted while its menu is open (the popover
     *  anchors to it); a stack change that unfolds everything mid-menu
     *  would otherwise pull the anchor out from under the open surface. */
    const triggerShown = computed(() => folded.value || menuOpen.value);

    function openMenu(): void {
      if (!crumbs.value.length) return;
      // A strip mid-LEAVE is still in the DOM (its Transition holds the
      // last node) with its trigger still tappable — but its surfaces are
      // unmounted and a set ref here would spring open on a later remount.
      if (!visible.value) return;
      // The two surfaces are never open together — and the symmetric close
      // matters on a phone: the strip paints above the sheet's scrim, so
      // its trigger stays tappable while a reveal is docked (review round
      // two), and a menu opening underneath it would leave the pair
      // fighting over one Escape.
      revealed.value = null;
      menuOpen.value = true;
    }

    /** Jump to a listed layer: the menu closes and everything stacked
     *  ABOVE the chosen level is asked to close, top-down. The close rides
     *  the popup manager's per-entry close channel, so a layer whose owner
     *  registered none simply stays — the strip never guesses at foreign
     *  state. The CURRENT layer sits on top with nothing above it, so
     *  picking it just dismisses the menu. */
    function selectLayer(id: string): void {
      menuOpen.value = false;
      manager.closeAbove(id);
    }

    // The menu's own sheet id is only meaningful while that surface lives;
    // drop it when the surface goes so a FUTURE popover registration is
    // never mistaken for "the menu".
    function onMenuClosed(): void {
      menuSheetId.value = null;
    }

    // Unfolding everything while the menu is open dissolves the trigger's
    // reason to exist — the strip itself now shows every layer, so the
    // anchored pair steps aside instead of duplicating it.
    watch(folded, (stillFolded) => {
      if (!stillFolded) menuOpen.value = false;
    });

    // ── Truncated-name reveal ─────────────────────────────────────────
    // A cut label travels whole to assistive tech, and the folded layers
    // get the menu above — but a layer that is VISIBLE and still cut had no
    // way to read it. Tapping such a crumb opens the same popover family
    // (anchored under the crumb on desktop, bottom-up sheet on mobile) with
    // the whole name, because the strip's own bar is not a place long text
    // can be read from.
    const revealed = ref<{ id: string; label: string } | null>(null);
    const revealAnchor = ref<HTMLElement | null>(null);
    const crumbEls = new Map<string, HTMLElement>();

    function setCrumbEl(id: string, el: Element | null): void {
      if (el) crumbEls.set(id, el as HTMLElement);
      else crumbEls.delete(id);
    }

    function toggleReveal(crumb: Crumb): void {
      if (revealed.value?.id === crumb.id) {
        revealed.value = null;
        return;
      }
      // Same mid-leave guard as openMenu: a frozen crumb must not anchor
      // a new surface to a strip that is already dissolving.
      if (!visible.value) return;
      if (!crumbEls.has(crumb.id)) return;
      menuOpen.value = false;
      revealAnchor.value = crumbEls.get(crumb.id) ?? null;
      revealed.value = { id: crumb.id, label: crumb.label };
    }

    // What keeps the reveal alive is the LAYER, never the fold: opening it
    // on a phone docks a blocking sheet, which joins the stack the strip
    // lists and re-decides the tail underneath — a fold that carried the
    // tapped crumb behind the trigger used to close the surface in the same
    // frame it opened (2026-09-16 review). It goes away when the layer
    // itself does, and when the layer stops being cut in the first place
    // (a retitle makes its crumb plain text again — an open panel would
    // then be anchored to nothing while showing a name that no longer
    // exists); a retitle that keeps cutting follows the live name.
    watch([crumbs, tail], ([list, visibleTail]) => {
      const open = revealed.value;
      if (!open) return;
      const crumb = list.find((entry) => entry.id === open.id);
      if (!crumb || !crumb.truncated) {
        revealed.value = null;
        return;
      }
      // An ANCHORED panel whose crumb folded behind the trigger would keep
      // a detached element as its anchor, and the next reposition (a
      // resize, a panel resize) would measure a 0×0 rect and fly the panel
      // into the viewport corner (review round two). The mobile sheet
      // needs no anchor and keeps showing the name.
      if (!isMobile.value && !visibleTail.some((entry) => entry.id === open.id)) {
        revealed.value = null;
        return;
      }
      if (crumb.label !== open.label) {
        revealed.value = { id: crumb.id, label: crumb.label };
      }
    });

    // Escape closes whichever strip surface is open. HkPopover owns Escape
    // for its SHEET form (the panel takes focus there); the anchored form
    // has no focusable panel, so a document listener covers both.
    function onSurfaceKeydown(e: KeyboardEvent) {
      if (e.key !== "Escape") return;
      if (revealed.value) revealed.value = null;
      else if (menuOpen.value) menuOpen.value = false;
    }
    const surfaceOpen = computed(() => revealed.value !== null || menuOpen.value);
    watch(surfaceOpen, (open) => {
      if (open) document.addEventListener("keydown", onSurfaceKeydown);
      else document.removeEventListener("keydown", onSurfaceKeydown);
    });
    onBeforeUnmount(() => document.removeEventListener("keydown", onSurfaceKeydown));

    /** Pre-resync paint position: the clearance rule evaluated on the two
     *  layout fallbacks (48px header, 43px strip). The first nextTick
     *  resync replaces it with measured numbers. */
    const topPx = ref(topGapPx.value + STRIP_HEIGHT_PX / 2);

    /** Publish the sheet top band: while the strip is up, mobile bottom
     *  sheets must stop BELOW the strip's bottom edge plus one more gap —
     *  "the strip's own height, with one gap above and one below". The
     *  sheet family consumes this exact custom property as its mobile
     *  max-height inset (--hk-sheet-top-inset), so publishing it here
     *  turns every host's static guess into the strip's live geometry.
     *  Written on <body> inline (beats a host's :root token while up;
     *  removed when the strip goes away so the host token rules again),
     *  in the strip's LOCAL px — the sheets teleport into the same zoomed
     *  subtree, so one px space is shared. */
    function publishBand(bandPx: number | null): void {
      if (typeof document === "undefined") return;
      if (bandPx == null) document.body.style.removeProperty("--hk-sheet-top-inset");
      else document.body.style.setProperty("--hk-sheet-top-inset", `${bandPx}px`);
    }

    function resyncTop() {
      const app = document.getElementById(props.appRootId);
      if (!app) {
        // No app root to measure: the strip still paints on the fallback
        // geometry (the init ref), so keep the band promise on those same
        // fallbacks instead of going quiet while the sheets are watching.
        publishBand(topPx.value + STRIP_HEIGHT_PX / 2 + topGapPx.value);
        return;
      }
      // The strip teleports to <body> — inside any root CSS zoom subtree
      // — so its inline top is LOCAL px. Keep every term in that local
      // space: the app root's computed top is already local, while the
      // header's gBCR height reports the root VISUAL space (standardized
      // zoom applies ancestor zoom), so it comes back divided by the
      // cumulative zoom. Without the conversion the strip drifts
      // (zoom-1)·headerHeight/2 down its window (chest's root-level
      // manual DPI scale). The fallback height is a layout constant and
      // stays local.
      const appTop = parseFloat(getComputedStyle(app).top) || 0;
      const header = app.querySelector(props.headerSelector) as HTMLElement | null;
      // Measure the zoom AT the header (not just the root): the header's
      // gBCR carries the zoom of every ancestor between it and the root,
      // so the conversion factor is read from the same chain.
      const z = ancestorZoom(header ?? document.body);
      const headerH = header
        ? header.getBoundingClientRect().height / z
        : props.headerFallbackHeight;
      // The strip's own height comes back in the same VISUAL px the
      // header's rect does (it teleports into the same zoomed subtree), so
      // it divides by the zoom read at the strip itself. No box (first
      // resync, unit DOM) falls back to the stylesheet-declared height.
      let stripH = STRIP_HEIGHT_PX;
      if (navRef.value) {
        const navH = navRef.value.getBoundingClientRect().height;
        if (navH > 0) stripH = navH / ancestorZoom(navRef.value);
      }
      // Centre on the header, but keep the promised daylight: whichever
      // candidate parks the strip LOWER wins, so a centre line near the
      // viewport top can no longer push the strip's upper half against
      // (or past) the top edge.
      topPx.value = appTop + Math.max(headerH / 2, topGapPx.value + stripH / 2);
      // The band: strip bottom edge plus one more gap — the lowest line a
      // bottom sheet may reach while the strip is up.
      publishBand(topPx.value + stripH / 2 + topGapPx.value);
    }

    /** Viewport fence, in the strip's OWN px. The stylesheet cap is
     *  authored in vw units, which a host root zoom multiplies at paint
     *  (chest's manual DPI scale): taken literally it would license a strip
     *  zoom× wider than the screen. The fence is therefore re-derived here
     *  from the live viewport and written as local px — the same conversion
     *  the strip's own `top` already needs. */
    const maxWidthPx = ref<number | null>(null);
    function resyncBox() {
      resyncTop();
      const vw = typeof window === "undefined" ? 0 : window.innerWidth;
      if (!(vw > 0)) {
        maxWidthPx.value = null;
        return;
      }
      const z = ancestorZoom(navRef.value ?? document.body);
      maxWidthPx.value = (vw - visualGutter(z) * 2) / z;
    }

    /** Viewport changed: the header may have moved AND the tail that fits
     *  almost certainly changed. */
    function onViewportChange() {
      resyncBox();
      measureStrip();
    }

    /** The strip's slow tick (the header resync): a host theme swap can
     *  move the strip's own padding — a budget change the clone's box
     *  never reports — so the fold is re-decided here too. */
    function onSlowTick() {
      resyncBox();
      measureStrip();
    }

    /** Late layout shifts move the clone's own box (a webfont swap, a host
     *  type scale) — re-decide from the new measurements. Measuring never
     *  writes to the clone, so this cannot feed itself. */
    let cloneRO: ResizeObserver | null = null;
    function observeClone() {
      if (typeof ResizeObserver === "undefined") return;
      const host = measureHostRef.value;
      if (!host || cloneRO) return;
      cloneRO = new ResizeObserver(() => measureStrip());
      cloneRO.observe(host);
    }
    function releaseClone() {
      cloneRO?.disconnect();
      cloneRO = null;
      cloneEls.clear();
      triggerClone = null;
    }

    /** The strip's whole-surface entrance runs the window choreography at
     *  its own chrome pace (the enter transition is 300ms — see the
     *  sheet); the bus report must outlive it so JS choreography that
     *  depends on the strip's presence (sheet banding) is not cut short. */
    const ENTER_ANIM_MS = 300;
    const enterAnim = useReportedTransition(ENTER_ANIM_MS);
    let handle: ReturnType<typeof scheduleEvery> | null = null;
    watch(
      visible,
      (v) => {
        if (v) {
          resyncBox();
          enterAnim.run();
          if (!handle) handle = scheduleEvery(onSlowTick, 1000);
          window.addEventListener("resize", onViewportChange);
          void nextTick(() => {
            // The strip's own box exists only now: re-derive the top with
            // a measured height (the pre-mount resync ran on fallbacks).
            resyncBox();
            measureStrip();
            observeClone();
          });
        } else {
          enterAnim.cancel();
          if (handle) {
            handle.disconnect();
            handle = null;
          }
          window.removeEventListener("resize", onViewportChange);
          releaseClone();
          menuOpen.value = false;
          revealed.value = null;
          hiddenCount.value = 0;
          // The band is NOT withdrawn here: the strip now plays a ~150ms
          // leave (the Transition below holds the frozen DOM), and during
          // that window the strip still paints above every sheet — the
          // band must keep promising the FROZEN strip's real bottom edge,
          // not the host's static guess. The withdrawal moved to the
          // Transition's after-leave, the moment the strip actually goes
          // away. (Unmount keeps its own synchronous clear below.)
        }
      },
      { immediate: true },
    );

    // Layer set / label change: the fold is re-decided from the fresh
    // labels once the clone carries them.
    watch(
      () => crumbs.value.map((c) => `${c.id}\u0000${c.text}`).join("\u0001"),
      () => {
        void nextTick(measureStrip);
      },
    );

    onMounted(() => {
      if (!visible.value) return;
      // Synchronous first measure: the collapsed shape is committed in the
      // same task as the mount, so the strip never paints one frame wide
      // enough to spill before folding. The top is re-derived with the
      // strip's now-measurable height for the same reason.
      resyncBox();
      measureStrip();
      observeClone();
    });

    onBeforeUnmount(() => {
      if (handle) handle.disconnect();
      window.removeEventListener("resize", onViewportChange);
      releaseClone();
      // A mounted-but-gone strip must not leave its band behind: the host's
      // static token rules again (same contract as the visible flip).
      publishBand(null);
    });

    const itemClass = (crumb: Crumb) =>
      ["hk-modal-breadcrumb-item", crumb.current ? "hk-modal-breadcrumb-item-current" : ""]
        .filter(Boolean)
        .join(" ");

    const separator = () => (
      <ChevronRight class="hk-modal-breadcrumb-sep" size={12} />
    );

    return () => (
      <Teleport to={ensureOverlayRoot()}>
        {/* Whole-surface enter/leave on the strip itself: the window
            choreography at chrome pace (rise + settle + fade in, the
            reverse out — classes in the sheet, user direction
            2026-11-07). The leave KEEPS the last live DOM: Vue freezes
            the node mid-transition, so the strip fades out in the exact
            shape the stack had when its last-but-one layer closed. The
            Teleport itself stays mounted even while `visible` is false —
            a leave can only play under a parent that survives it. */}
        {/* No `mode`: a re-open inside the 150ms leave deliberately
            crossfades the frozen strip with the fresh one (near-identical
            chrome, continuous motion) instead of paying out-in's dead
            150ms before the next window's strip appears — quick
            open→close→open cycling is the common flow and must not lag. */}
        <Transition
          name="hk-modal-breadcrumb"
          appear
          onAfterLeave={() => {
            // Only the LAST strip out withdraws the band: a reopen inside
            // the leave window mounts a successor whose own resync has
            // already re-published the band — nulling it here would blind
            // the sheets until the next slow tick (2026-11-07 review).
            if (!visible.value) publishBand(null);
          }}
        >
          {visible.value ? (
            <nav
              // Function ref that ignores null: with no Transition mode,
              // a reopen inside the leave window lets the FROZEN strip
              // finish its leave AFTER the successor mounted — Vue's
              // teardown would null a plain object ref at that moment and
              // blind the live strip's geometry source (fold budget falls
              // back to Infinity, top to the 43px estimate) until some
              // later patch re-bound it (2026-11-07 review). A stale
              // element is safe here: every consumer runs only while the
              // strip is engaged, and the next mount overwrites.
              ref={(el) => {
                if (el) navRef.value = el as HTMLElement;
              }}
              class="hk-modal-breadcrumb"
              aria-label={t("hikari::modal.stackLabel", "Window layers")}
              aria-live="polite"
              style={{
                top: `${topPx.value}px`,
                maxWidth: maxWidthPx.value == null ? undefined : `${maxWidthPx.value}px`,
              }}
            >
              {/* Measurement clone: every layer, always, out of flow and
                  out of the a11y tree. It is the strip's own ruler — the
                  visible crumbs below are a fold of the very list laid
                  out here. */}
              <div class="hk-modal-breadcrumb-measure" aria-hidden="true" ref={measureHostRef}>
                {crumbs.value.map((crumb, i) => (
                  <span
                    key={crumb.id}
                    class="hk-modal-breadcrumb-crumb"
                    ref={(el) => setCloneEl(crumb.id, el as Element | null)}
                  >
                    {i > 0 && separator()}
                    <span class={itemClass(crumb)}>{crumb.text}</span>
                  </span>
                ))}
                <span class="hk-modal-breadcrumb-crumb">
                  <span
                    class="hk-modal-breadcrumb-more"
                    ref={(el) => (triggerClone = el as HTMLElement | null)}
                  >
                    {ELLIPSIS}
                  </span>
                </span>
              </div>

              {/* Trigger + visible tail ride the library's keyed-list
                  container (surface variant): a layer joining the stack
                  arrives the way its window does (rise + settle + fade),
                  a layer leaving sinks back while its neighbours glide
                  into the freed space (FLIP move) — and the fold trigger
                  gets the same treatment when the fold appears or
                  dissolves. display:contents keeps the strip's own flex
                  row as the sole layout owner (see the sheet). */}
              <HkListTransition
                tag="span"
                class="hk-modal-breadcrumb-levels"
                variant="surface"
                move
              >
                {triggerShown.value && (
                  <span key={MORE_KEY} class="hk-modal-breadcrumb-crumb">
                    <button
                      ref={moreRef}
                      type="button"
                      class="hk-modal-breadcrumb-more"
                      aria-haspopup="dialog"
                      aria-expanded={menuOpen.value}
                      aria-label={menuLabel.value}
                      onClick={openMenu}
                    >
                      {ELLIPSIS}
                    </button>
                  </span>
                )}

                {tail.value.map((crumb, i) => (
                  <span key={crumb.id} class="hk-modal-breadcrumb-crumb">
                    {/* A chevron separates two items — the FIRST rendered item
                        carries none, whether or not the trigger precedes it. */}
                    {(triggerShown.value || i > 0) && separator()}
                    {crumb.truncated ? (
                      // Cut label: tappable, and the full name is the button's
                      // accessible name (a cut string is not a name).
                      <button
                        type="button"
                        ref={(el) => setCrumbEl(crumb.id, el as Element | null)}
                        class={`${itemClass(crumb)} hk-modal-breadcrumb-item-reveal`}
                        aria-haspopup="dialog"
                        aria-expanded={revealed.value?.id === crumb.id}
                        aria-label={crumb.label}
                        onClick={() => toggleReveal(crumb)}
                      >
                        {crumb.text}
                      </button>
                    ) : (
                      <span class={itemClass(crumb)}>{crumb.text}</span>
                    )}
                  </span>
                ))}
              </HkListTransition>
            </nav>
            ) : null}
          </Transition>
          {visible.value && (
            <HkPopover
              modelValue={menuOpen.value}
              onUpdate:modelValue={(v: boolean) => {
                menuOpen.value = v;
              }}
              anchorRef={moreRef.value}
              placement="bottom-start"
              // The strip paints ABOVE the anchored band on purpose (z 2500 vs
              // the dropdown band's 2000), and the trigger sits inside its
              // padding box — a 4px offset would tuck the menu's first pixels
              // under the strip's own bar. 16px clears the 12px padding plus
              // the 1px border.
              offset={16}
              sheetOnMobile
              title={menuLabel.value}
              class="hk-modal-breadcrumb-menu"
              // The menu's own registry handle: while the sheet form blocks,
              // it is a layer of the very stack this menu lists — the rows
              // must skip it (selecting "the menu" is not a place to go).
              onRegistered={(handle: { id: string }) => {
                menuSheetId.value = handle.id;
              }}
              onClosed={onMenuClosed}
            >
              <HkMenuPanel label={menuLabel.value}>
                {menuItems.value.map((item) => (
                  <HkMenuActionItem
                    key={item.id}
                    label={item.label}
                    active={item.current}
                    onClick={() => selectLayer(item.id)}
                  />
                ))}
              </HkMenuPanel>
            </HkPopover>
          )}
          {visible.value && (
            <HkPopover
              modelValue={revealed.value !== null}
              onUpdate:modelValue={(v: boolean) => {
                if (!v) revealed.value = null;
              }}
              anchorRef={revealAnchor.value}
              placement="bottom-start"
              // Same clearance as the menu: the crumb sits inside the strip's
              // own padding box, which paints above the anchored band.
              offset={16}
              sheetOnMobile
              // The name is the surface's reason to exist, so it names it.
              // The sheet heading ellipsises (it is chrome) — the panel body
              // below carries the whole name and wraps.
              title={revealed.value?.label ?? ""}
            >
              {revealed.value && (
                <p class="hk-modal-breadcrumb-reveal">{revealed.value.label}</p>
              )}
            </HkPopover>
          )}
        </Teleport>
      );
  },
});
