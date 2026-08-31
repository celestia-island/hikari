import {
  computed,
  defineComponent,
  nextTick,
  onBeforeUnmount,
  ref,
  Teleport,
  Transition,
  watch,
  type PropType,
} from "vue";

import { usePopupManager, type PopupHandle } from "../runtime/usePopupManager";
import { useOverlay } from "../runtime/useOverlay";
import { useBreakpoint } from "../runtime/useBreakpoint";
import { createBackGuard } from "../runtime/backStack";
import { attachOverlayScrollbars, type OverlayScrollbarHandle } from "../composables/useOverlayScrollbar";
import "./HkSelect.scss";

/**
 * The dropdown panel of HkSelect, detached from the select's trigger so it
 * can be invoked in custom form.
 *
 * A dropdown's opened surface — the desktop popout geometry, the mobile
 * bottom sheet (scrim + grabber + title), popup-manager z-stacking, the
 * overlay registry entry, outside-click and Escape closing — is useful far
 * beyond `<HkSelect>`: filter popovers anchored to icon buttons, checkbox
 * list popovers, anything that should LOOK like a dropdown panel without
 * BEING a dropdown. This component is that surface: give it an anchor
 * element and arbitrary row content, and it behaves exactly like the panel
 * a select would open.
 *
 * The panel is one WINDOW layer for the back gesture (the shared
 * window-first back priority — HkModal/HkMenu convention): opening pushes
 * one marked history entry, so the first browser/system back closes the
 * panel instead of navigating the page; any ordinary close (row click,
 * Escape, outside click, scrim) rewinds the entry so no dead back remains.
 *
 * HkSelect itself delegates here (bottom-start + matched trigger width), so
 * the two can never drift apart. Content is a plain default slot; keyboard
 * events on the panel surface are forwarded (`keydown`) so owners that own
 * an option model (like HkSelect) can run their own arrow/enter navigation.
 *
 * Mobile sheets also run a duplicate-title filter: content that opens with
 * a non-interactive heading exactly repeating the panel `title` is hidden
 * (`.hk-sheet-dup-title`) — the sheet header already names the sheet, and
 * composition-slot consumers (HkMenu pickers) often carry a section label
 * with the same word. Desktop popouts draw no header and keep the heading.
 */

export type SelectPanelPlacement =
  | "bottom-start"
  | "bottom-end"
  | "top-start"
  | "top-end";

const VIEWPORT_PAD = 8;

export default defineComponent({
  name: "HkSelectPanel",
  props: {
    /** Panel visibility — v-model:open. */
    open: { type: Boolean, required: true },
    /** Anchor element for the desktop popout (usually the custom trigger). */
    anchorRef: { type: Object as PropType<HTMLElement | null>, default: null },
    /** Sheet header on mobile / a11y name for the panel. */
    title: { type: String, default: "" },
    /** Base placement of the popout relative to the anchor (auto-flips). */
    placement: {
      type: String as PropType<SelectPanelPlacement>,
      default: "bottom-start",
    },
    /** Gap between anchor and popout, in px. */
    offset: { type: Number, default: 4 },
    /** Popout min-width follows the anchor width (select parity). */
    matchAnchorWidth: { type: Boolean, default: true },
    /** Dock as a bottom sheet on phone-width viewports. */
    sheetOnMobile: { type: Boolean, default: true },
  },
  emits: {
    "update:open": (_v: boolean) => true,
    /** Raw keydown from the panel surface (arrows/enter for option owners). */
    keydown: (_e: KeyboardEvent) => true,
  },
  setup(props, { emit, slots, expose }) {
    const manager = usePopupManager();
    const handle = ref<PopupHandle | null>(null);
    const popoutZ = computed(() => (handle.value?.zIndex ?? 0) + 1);

    // Overlay registry entry so closeAll()/isOverlayOpen() see the open
    // panel; the onCloseRequested hook makes a global close flip the open
    // prop, which is what actually tears the panel down.
    const overlay = useOverlay({
      name: "hk-select-panel",
      onCloseRequested: () => { emit("update:open", false); },
    });

    const { isMobile } = useBreakpoint();
    const sheetMode = computed(() => props.sheetOnMobile && isMobile.value);

    // Window-first back priority (HkModal convention): while this panel is
    // the topmost window, the back gesture closes it instead of navigating
    // the page. The service owns all history bookkeeping — push on open,
    // rewind on close — so the panel is exactly one back layer wherever it
    // is opened (real dropdown or custom invocation, popout or sheet).
    const backGuard = createBackGuard({
      onBack: () => { close(); },
    });

    // Crossing the mobile/desktop breakpoint mid-flight would leave a sheet
    // hung between two form factors — close and let the user reopen in the
    // shape the viewport now calls for (HkSelect's historic behavior).
    watch(isMobile, () => {
      if (props.open) emit("update:open", false);
    });

    // A retitled open sheet must re-judge its duplicate heading — the
    // exact-text match lives against the CURRENT title, so the filter
    // restores a heading that stopped matching (and re-hides one that
    // started, via the observer's characterData window below).
    watch(
      () => props.title,
      () => {
        if (props.open && sheetMode.value) syncDupTitle();
      },
    );
    // Flipping OUT of sheet mode while open (consumer prop, not the
    // breakpoint flip — that closes the panel) swaps the render branch
    // and detaches the sheet list; drop the observer promptly instead
    // of letting it guard a detached subtree.
    watch(sheetMode, (mode) => {
      if (!mode) stopDupTitleSync();
    });

    const panelRef = ref<HTMLElement>();
    const sheetListRef = ref<HTMLElement>();
    // Fixed positioning wrapper around the desktop popout — the overlay
    // scrollbar's track host (the popout itself teleports to body, whose
    // box is no positioning context for the tracks).
    const popoutHostRef = ref<HTMLElement>();
    // Mobile sheet: positioned wrapper around ONLY the scrolling list —
    // the sheet panel also carries the grabber + title bands.
    const sheetBodyRef = ref<HTMLElement>();
    const coords = ref<{ top?: string; left?: string; minWidth?: string }>({});

    // ── overlay scrollbar (shared chrome) ─────────────────────────
    // Attached per open on whichever surface scrolls — the desktop
    // popout or the mobile sheet list — and detached on close/unmount
    // so nothing leaks across the panel's lifetime (the sheet Teleport
    // stays mounted through its leave transition).
    let panelScrollbar: OverlayScrollbarHandle | null = null;

    function detachPanelScrollbar(): void {
      panelScrollbar?.detach();
      panelScrollbar = null;
    }

    function attachPanelScrollbar(): void {
      detachPanelScrollbar();
      const viewport = sheetMode.value ? sheetListRef.value : panelRef.value;
      if (!viewport) return;
      panelScrollbar = attachOverlayScrollbars(viewport, {
        axis: "vertical",
        // Both surfaces get an exact host: the popout host (panel + tracks)
        // and the sheet body wrapper (list only — the sheet panel also
        // carries the grabber/title bands, which rails must not span).
        host: sheetMode.value ? sheetBodyRef.value : popoutHostRef.value,
      });
    }

    // ── sheet duplicate-title filter ───────────────────────────────
    // Composition-slot consumers often open a sheet whose content
    // starts with a heading repeating the panel title (a workspace
    // picker renders its own "Workspaces" section label under a sheet
    // header that already says "Workspaces"). The desktop popout draws
    // no header, so that in-content heading is the only one there; on
    // the mobile sheet it doubles the header and reads as a rendering
    // bug. While a sheet is open, hide the first non-interactive text
    // element whose EXACT text equals the title — never interactive
    // rows (buttons, select options, menu items), which legitimately
    // may say the same word. A MutationObserver re-syncs while open so
    // async-loaded content can neither miss a late duplicate nor keep
    // hiding a node that stopped matching.
    let hiddenDupTitle: HTMLElement | null = null;
    let dupTitleObserver: MutationObserver | null = null;

    /** Elements that make a candidate "real content": the candidate
     *  itself matching one of these, OR containing one in its subtree,
     *  disqualifies it — otherwise a wrapper div around a single row
     *  labeled like the title would hide the whole sheet body. */
    const DUP_TITLE_CONTENT =
      'button,a,input,select,textarea,[role="option"],[role="menuitem"],.hk-select-option,.hk-menu-row';

    function findDupTitle(): HTMLElement | null {
      const title = props.title.trim();
      const list = sheetListRef.value;
      if (!title || !list) return null;
      for (const el of list.querySelectorAll<HTMLElement>(
        "h1,h2,h3,h4,h5,h6,p,div,span,strong",
      )) {
        if ((el.textContent ?? "").trim() !== title) continue;
        if (el.matches(DUP_TITLE_CONTENT)) continue;
        if (el.closest(DUP_TITLE_CONTENT)) continue;
        if (el.querySelector(DUP_TITLE_CONTENT)) continue;
        return el;
      }
      return null;
    }

    function syncDupTitle(): void {
      const dup = findDupTitle();
      if (hiddenDupTitle && hiddenDupTitle !== dup) {
        hiddenDupTitle.classList.remove("hk-sheet-dup-title");
        hiddenDupTitle = null;
      }
      if (dup && dup !== hiddenDupTitle) {
        dup.classList.add("hk-sheet-dup-title");
        hiddenDupTitle = dup;
      }
    }

    function stopDupTitleSync(): void {
      dupTitleObserver?.disconnect();
      dupTitleObserver = null;
      // Deliberately NOT restoring the class here: close keeps the panel
      // mounted through its slide-down leave, and un-hiding mid-leave
      // would flash the duplicate heading back in. The element dies with
      // the panel right after the transition; live restores happen via
      // the title watcher while the sheet is open.
      hiddenDupTitle = null;
    }

    function close(): void {
      emit("update:open", false);
    }

    function onDocumentClick(e: MouseEvent): void {
      if (!props.open || sheetMode.value) return;
      const target = e.target as Node;
      if (props.anchorRef?.contains(target)) return;
      // The host wraps BOTH the panel and the overlay scrollbar tracks —
      // scrolling a long menu through its custom bar must not dismiss it.
      if (popoutHostRef.value?.contains(target)) return;
      if (panelRef.value?.contains(target)) return;
      close();
    }

    // Escape is handled surface-attached (the panel's own onKeydown and,
    // via forwarding, the owner) — NOT via a document-capture listener,
    // which would close the panel on Escape pressed in unrelated inputs
    // and run ahead of every other Escape handler on the page. This
    // matches the library convention (HkPopover / HkModal surfaces).
    function onSurfaceEscape(e: KeyboardEvent): void {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        close();
      }
    }

    function forwardKeydown(e: KeyboardEvent): void {
      if (e.key === "Escape") {
        onSurfaceEscape(e);
        return;
      }
      emit("keydown", e);
    }

    watch(
      () => props.open,
      (open) => {
        if (open) {
          // Register with the panel title so the modal breadcrumb can
          // label this layer ("User menu / Account security / …") instead
          // of a generic "Layer N".
          handle.value = manager.register("dropdown", false, props.title);
          overlay.open();
          // Release-then-push (the HkMenu normalizer form): a same-tick
          // close→reopen must not leave the reopened panel unguarded —
          // release() keeps its rewind claim (desired snaps to 0) and the
          // following push() re-advances desired by one, so the pending
          // flush rewinds exactly to the fresh entry instead of past it.
          if (backGuard.entries > 0) backGuard.release();
          backGuard.push();
          // The scrolling surface mounts on this very render (popout
          // subtree or sheet body) — attach the overlay scrollbar once
          // the DOM has landed. A same-tick open→close must not arm it
          // on the leaving panel.
          void nextTick(() => {
            if (!props.open) return;
            attachPanelScrollbar();
          });
          if (!sheetMode.value) {
            document.addEventListener("click", onDocumentClick, true);
          } else {
            // The sheet body mounts on this very render — run the
            // duplicate-title filter once it has landed, then keep
            // re-syncing while open (async slot content swaps).
            void nextTick(() => {
              // A same-tick open→close must not arm the observer on the
              // leaving panel (the close branch already ran).
              if (!props.open || !sheetMode.value) return;
              syncDupTitle();
              if (sheetListRef.value && !dupTitleObserver) {
                dupTitleObserver = new MutationObserver(syncDupTitle);
                dupTitleObserver.observe(sheetListRef.value, {
                  childList: true,
                  characterData: true,
                  subtree: true,
                  // A consumer re-render patching className can wipe
                  // hk-sheet-dup-title mid-open — class mutations
                  // re-sync it (adding an existing class mutates
                  // nothing, so the loop converges).
                  attributes: true,
                  attributeFilter: ["class"],
                });
              }
            });
          }
          window.addEventListener("resize", onResize);
        } else {
          document.removeEventListener("click", onDocumentClick, true);
          window.removeEventListener("resize", onResize);
          detachPanelScrollbar();
          stopDupTitleSync();
          backGuard.release();
          if (handle.value) {
            manager.unregister(handle.value.id);
            handle.value = null;
          }
          overlay.close();
        }
      },
      // immediate: mounting with open=true must register with the popup
      // manager (z band) and overlay registry right away — the HkPopover /
      // HkModal convention.
      { immediate: true },
    );

    onBeforeUnmount(() => {
      document.removeEventListener("click", onDocumentClick, true);
      window.removeEventListener("resize", onResize);
      detachPanelScrollbar();
      stopDupTitleSync();
      overlay.close();
      backGuard.destroy();
      if (handle.value) {
        manager.unregister(handle.value.id);
        handle.value = null;
      }
    });

    // ── desktop popout geometry ────────────────────────────────────
    // Computed twice per opening: immediately from the anchor rect (with a
    // height fallback so top placements land sensibly before measure) and
    // again after the DOM settles, when the panel's real box is known and
    // flip/clamp decisions can use actual numbers.
    function positionPanel(): void {
      const anchor = props.anchorRef;
      if (!anchor) return;
      const r = anchor.getBoundingClientRect();
      // 0 (unstyled/test environments) counts as unmeasured — fall back.
      const pw = panelRef.value?.offsetWidth || Math.max(r.width, 180);
      const ph = panelRef.value?.offsetHeight || 200;
      let side: "top" | "bottom" = props.placement.startsWith("top-") ? "top" : "bottom";
      let top =
        side === "top"
          ? r.top - props.offset - ph
          : r.bottom + props.offset;
      // Auto-flip when the chosen side cannot host the panel.
      if (side === "bottom" && top + ph > window.innerHeight - VIEWPORT_PAD) {
        side = "top";
        top = r.top - props.offset - ph;
      } else if (side === "top" && top < VIEWPORT_PAD) {
        side = "bottom";
        top = r.bottom + props.offset;
      }
      // One flip never re-checks: taller menu panels (the viewport-relative
      // CSS cap) made this band reachable — a mid-viewport anchor flips
      // bottom→top into a negative top that was applied verbatim. Clamp so
      // the whole panel stays on-screen; when content exceeds the CSS cap
      // the panel's own internal scroll takes over.
      const maxTop = Math.max(VIEWPORT_PAD, window.innerHeight - VIEWPORT_PAD - ph);
      top = Math.min(Math.max(top, VIEWPORT_PAD), maxTop);
      let left = props.placement.endsWith("-end") ? r.right - pw : r.left;
      const maxLeft = Math.max(VIEWPORT_PAD, window.innerWidth - VIEWPORT_PAD - pw);
      left = Math.min(Math.max(left, VIEWPORT_PAD), maxLeft);
      coords.value = {
        top: `${Math.round(top)}px`,
        left: `${Math.round(left)}px`,
        ...(props.matchAnchorWidth ? { minWidth: `${Math.round(r.width)}px` } : {}),
      };
    }

    function onResize(): void {
      if (props.open && !sheetMode.value) positionPanel();
    }

    watch(
      () => [props.open, props.anchorRef, props.placement] as const,
      () => {
        if (!props.open) return;
        positionPanel();
        void nextTick(positionPanel);
      },
      { immediate: true },
    );

    /** The live panel root element — sheet or popout, or null while closed.
     * Lets option-owning consumers (HkSelect) scope row queries to THEIR
     * panel instead of the whole document, where another open panel's
     * rows (or HkPopupSelect's) could match first.
     * On the desktop popout this returns the fixed HOST — the box that
     * contains the panel AND the overlay scrollbar tracks — so dismissal
     * containment (HkMenu's deepestPanelAt) treats scrollbar interaction
     * as inside the panel, exactly like the native bar it replaces. The
     * host holds no option rows of its own, so row queries are unaffected. */
    expose({
      panelEl: () =>
        (sheetMode.value ? panelRef.value : popoutHostRef.value ?? panelRef.value) ?? null,
      /**
       * Cancel this panel's pending back-guard rewind. Menu-like hosts
       * (HkMenu) call it when a row selection ITSELF starts an in-page
       * action — opening a modal or an async router navigation: the
       * rewind would otherwise win the race (its flush runs before an
       * async navigation commits) and yank the page back onto the
       * panel's marker entry, discarding that navigation. Plain
       * select/close flows keep the default release() rewind.
       */
      abandonBackGuard: () => backGuard.abandon(),
    });

    return () => {
      // Sheet mode keeps its Teleport mounted across the close so the
      // leave transition (slide-down) actually runs — unmounting the
      // subtree on close would snap the sheet shut instead (the same
      // reason HkPopover keeps its Teleport alive through the leave).
      if (sheetMode.value) {
        return (
          <Teleport to="body">
            <Transition name="hk-select-sheet" appear>
              {props.open ? (
                <div
                  class="hk-select-sheet-scrim"
                  style={{ zIndex: popoutZ.value - 1 }}
                  onClick={close}
                />
              ) : null}
            </Transition>
            <Transition name="hk-select-sheet" appear>
              {props.open ? (
                <div
                  ref={panelRef}
                  class="hk-select-sheet-panel"
                  style={{ zIndex: popoutZ.value }}
                  role="dialog"
                  aria-modal="true"
                  aria-label={props.title || undefined}
                  tabindex="-1"
                  onKeydown={forwardKeydown}
                >
                  <div
                    class="hk-select-sheet-grabber"
                    aria-hidden="true"
                    onClick={close}
                  />
                  {props.title ? (
                    <div class="hk-select-sheet-title">{props.title}</div>
                  ) : null}
                  <div class="hk-select-sheet-body" ref={sheetBodyRef}>
                    <div class="hk-select-sheet-list" ref={sheetListRef}>{slots.default?.()}</div>
                  </div>
                </div>
              ) : null}
            </Transition>
          </Teleport>
        );
      }

      // Desktop popout: no enter/leave transition on master either —
      // mount on open, unmount on close. The fixed host carries the
      // inline coords + popup-manager z-index and anchors the overlay
      // scrollbar tracks; the popout inside keeps every visual rule.
      if (!props.open) return null;
      return (
        <Teleport to="body">
          <div ref={popoutHostRef} class="hk-select-popout-host" style={{ ...coords.value, zIndex: popoutZ.value }}>
            <div
              ref={panelRef}
              class="hk-select-popout"
              aria-label={props.title || undefined}
              onKeydown={forwardKeydown}
            >
              {slots.default?.()}
            </div>
          </div>
        </Teleport>
      );
    };
  },
});
