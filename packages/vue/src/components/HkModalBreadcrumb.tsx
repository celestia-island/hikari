import {
  computed,
  defineComponent,
  nextTick,
  onBeforeUnmount,
  onMounted,
  ref,
  Teleport,
  watch,
} from "vue";
import { usePopupManager, type PopupEntry } from "../runtime/usePopupManager";
import { useI18n } from "../i18n/context";
import { useReportedTransition } from "../composables/useReportedTransition";
import { scheduleEvery } from "../runtime/animationBus";
import { ancestorZoom } from "../runtime/cssZoom";
import { viewportGutterPx } from "../runtime/viewportGutter";
import { clampToDisplayWidth, displayWidthUnits, ELLIPSIS } from "../runtime/displayWidth";
import HkPopover from "./HkPopover";
import HkMenuPanel from "./HkMenuPanel";
import HkMenuActionItem from "./HkMenuActionItem";
import "./HkModalBreadcrumb.scss";

/** Window kinds always participate in the stack: modals and drawers block
 *  the page on every form factor, desktop and mobile alike. */
const WINDOW_KINDS: ReadonlySet<string> = new Set(["modal", "drawer"]);

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
     * hidden-layers menu.
     */
    maxLabelUnits: { type: Number, default: 10 },
  },
  setup(props) {
    const manager = usePopupManager();
    const { t } = useI18n();

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

    // ── Hidden-layers menu ────────────────────────────────────────────
    // The trigger lists the layers it folded away, in stack order, with
    // their FULL names — the strip's clamp never reaches this menu.
    // HkPopover owns the form-factor rules (anchored under the trigger on
    // desktop, bottom-up sheet on mobile) and registers the surface with
    // the popup manager, so the menu is a first-class layer of the very
    // stack it lists.
    const menuOpen = ref(false);
    const menuItems = ref<{ id: string; label: string }[]>([]);
    const menuLabel = computed(() => t("hikari::modal.hiddenLayers", "Hidden layers"));

    /** The trigger must stay mounted while its menu is open (the popover
     *  anchors to it); a stack change that unfolds everything mid-menu
     *  would otherwise pull the anchor out from under the open surface. */
    const triggerShown = computed(() => folded.value || menuOpen.value);

    function openMenu(): void {
      if (!hidden.value.length) return;
      menuItems.value = hidden.value.map(({ id, label }) => ({ id, label }));
      menuOpen.value = true;
    }

    /** Jump back to a folded layer: the menu closes and everything stacked
     *  ABOVE the chosen level is asked to close, top-down. The close rides
     *  the popup manager's per-entry close channel, so a layer whose owner
     *  registered none simply stays — the strip never guesses at foreign
     *  state. */
    function selectLayer(id: string): void {
      menuOpen.value = false;
      manager.closeAbove(id);
    }

    // Unfolding everything while the menu is open leaves nothing to list:
    // drop the menu rather than keep a stale snapshot on screen.
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
      if (!crumbEls.has(crumb.id)) return;
      menuOpen.value = false;
      // The anchor must be on the surface BEFORE it opens: HkPopover reads
      // the prop when its open edge runs, and the click's own render has
      // not landed yet.
      revealAnchor.value = crumbEls.get(crumb.id) ?? null;
      void nextTick(() => {
        revealed.value = { id: crumb.id, label: crumb.label };
      });
    }

    // The revealed crumb can fold away under a narrower budget: its anchor
    // goes with it, so the surface must too.
    watch(tail, (visibleTail) => {
      const open = revealed.value;
      if (open && !visibleTail.some((crumb) => crumb.id === open.id)) {
        revealed.value = null;
      }
    });

    const topPx = ref(24);
    function resyncTop() {
      const app = document.getElementById(props.appRootId);
      if (!app) return;
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
      topPx.value = appTop + headerH / 2;
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

    const ENTER_ANIM_MS = 150;
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
      // enough to spill before folding.
      measureStrip();
      observeClone();
    });

    onBeforeUnmount(() => {
      if (handle) handle.disconnect();
      window.removeEventListener("resize", onViewportChange);
      releaseClone();
    });

    const itemClass = (crumb: Crumb) =>
      ["hk-modal-breadcrumb-item", crumb.current ? "hk-modal-breadcrumb-item-current" : ""]
        .filter(Boolean)
        .join(" ");

    const separator = () => (
      <svg
        class="hk-modal-breadcrumb-sep"
        width="12"
        height="12"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
      >
        <polyline points="9 18 15 12 9 6" />
      </svg>
    );

    return () =>
      visible.value ? (
        <Teleport to="body">
          <nav
            ref={navRef}
            class="hk-modal-breadcrumb"
            aria-label={t("hikari::modal.stackLabel", "Window layers")}
            aria-live="polite"
            style={{
              top: `${topPx.value}px`,
              maxWidth: maxWidthPx.value == null ? undefined : `${maxWidthPx.value}px`,
            }}
          >
            {/* Measurement clone: every layer, always, out of flow and out
                of the a11y tree. It is the strip's own ruler — the visible
                crumbs below are a fold of the very list laid out here. */}
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

            {triggerShown.value && (
              <span class="hk-modal-breadcrumb-crumb">
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
          </nav>
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
          >
            <HkMenuPanel label={menuLabel.value}>
              {menuItems.value.map((item) => (
                <HkMenuActionItem
                  key={item.id}
                  label={item.label}
                  onClick={() => selectLayer(item.id)}
                />
              ))}
            </HkMenuPanel>
          </HkPopover>
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
        </Teleport>
      ) : null;
  },
});
