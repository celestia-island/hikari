import {
  defineComponent,
  h,
  nextTick,
  onBeforeUnmount,
  ref,
  watch,
  type Component,
  type PropType,
} from "vue";

import HkTransitionContainer from "./HkTransitionContainer";
import { STEPFLOW_SWAP_EVENT } from "./HkStepFlow";
import HkScrollContainer from "./HkScrollContainer";
import HTabs from "./HkTabs";
import { useBreakpoint } from "../runtime/useBreakpoint";
import HModal from "./HkModal";
import "./HkSettingsDialog.scss";

/** The family's sheet-morph window (HkStepFlow announces the same beat):
 *  the pane container reports its WHOLE choreography (enter delay + morph),
 *  but the sheet's own resize must not inherit that doubling. */
export const SHEET_MORPH_MS = 300;

/** Morph duration to hand the modal for a settled swap. */
export function sheetMorphMs(choreographyMs: number): number {
  if (!(choreographyMs > 0)) return 0;
  return Math.min(choreographyMs, SHEET_MORPH_MS);
}

/** One rail entry of the settings dialog. */
export interface HkSettingsSection {
  /** Identity of the section — also the name of the slot that renders its
   *  content pane (`{ [key]: () => … }`). */
  key: string;
  /** Rail label. */
  label: string;
  /** Leading rail icon (a lucide-style component; rendered at 16px). */
  icon?: Component;
  /** A disabled entry renders but cannot be activated. */
  disabled?: boolean;
}

/**
 * HkSettingsBody — the sectioned settings shell: a left rail of icon+label
 * nav entries and a right scrollable pane rendering the active section's
 * slot. Extracted from the pattern wowsp, the flasher and the admin
 * consoles each hand-rolled (the "classic settings window" anatomy).
 *
 * Standalone by design: the BODY can be embedded in a page (the phone
 * surface pattern — wowsp renders it inside its own /settings route) or
 * inside {@link HSettingsDialog}, which wraps it in an HModal window.
 * Section identity is a `v-model:section` so openers can land on a
 * specific section; leaving it unbound keeps the state internal
 * (first section active).
 *
 * Scroll ownership: the pane is the only scroller — switching sections
 * restarts it from the top (arriving on a half-scrolled pane reads as a
 * broken page). Both scrollers are HkScrollContainers (2026-10-27: the
 * wowsp-proven contract upstreamed here — the native thin bars are gone
 * and the shared auto-hiding overlay chrome draws instead; wowsp used to
 * re-anchor this from outside through paired-class rules in its own
 * SettingsShell.scss). Inside the dialog the modal body's own scroller is
 * made mathematically idle by the host height rule (see the SCSS); on a
 * page the host manages its own layout. The rail additionally opts into
 * the container's selectionHint: an active section scrolled out of the
 * rail's band lights a feathered primary gradient at the offending edge
 * (phone's strip keeps the active tab scrolled into view instead — the
 * hint is rail-only by design).
 *
 * Phone anatomy (2026-10-28 user direction): under the family's mobile
 * breakpoint the left rail moves to the TOP of the window as the shared
 * pill strip (HTabs) — horizontally scrollable with edge fades, so every
 * section fits no matter how many entries a host offers — one notch
 * larger than the regular strips, with a small gap before the pane.
 * Desktop keeps the rail exactly as it was; the flip is live on resize
 * and shared by every consumer of this shell (page-embedded bodies
 * included).
 *
 * Docked-sheet height hand-off (2026-11-04 chest report): inside a phone
 * sheet the modal sizes the window from this shell's content, but it
 * measures the frame through `.hk-modal-body-inner` — which the host
 * rule pins at `height: 100%` (unscoped, so it pins the phone sheet too),
 * so the observed box never changes on a section swap and the sheet froze
 * at whichever section it OPENED with (the 470px About card inside a 24px
 * pane; the freeze survives hikari #1041's phone fill). Every settled
 * swap of the pane's morph container is therefore forwarded as the
 * family's sheet protocol event (`hk-stepflow-swap`, detail
 * `{phase: "morph", durationMs}`, where the duration is capped to the
 * family's own sheet morph beat — the container reports its whole
 * choreography, enter delay included — or `{phase: "instant"}` when the
 * swap settled with no animation), which HkModal already turns into a
 * frame re-measure. Page-embedded bodies (no modal ancestor) simply
 * bubble it nowhere.
 */
export const HkSettingsBody = defineComponent({
  name: "HkSettingsBody",
  props: {
    /** Rail entries, in rail order. */
    sections: { type: Array as PropType<HkSettingsSection[]>, required: true },
    /** Active section key (v-model:section). Unbound = internal state. */
    section: { type: String, default: undefined },
    /** Accessible name for the rail navigation. */
    navLabel: { type: String, default: undefined },
  },
  emits: {
    "update:section": (key: string) => typeof key === "string",
  },
  setup(props, { emit, slots }) {
    // The landing default is the FIRST USABLE section, never a disabled
    // one: a disabled entry "renders but cannot be activated", so it must
    // not win the default (R2 2026-10-28 — the old first-entry fallback
    // let a disabled-first host open on a dead section, and the phone
    // strip went further and FRAMED it as selected).
    const firstUsable = () =>
      props.sections.find((s) => !s.disabled)?.key ?? "";
    const internal = ref(firstUsable());
    // Controlled while a section prop is bound: external changes flow in,
    // clicks flow out. Unbound: the internal ref alone decides. Immediate
    // so an opener that mounts ALREADY on a deep-linked section
    // (section="network" from the first render) wins over the first-entry
    // default — a non-immediate watch would never fire for it.
    watch(
      () => props.section,
      (key) => {
        if (key == null) return;
        // A disabled (or unknown) key never activates — a host that
        // deep-links to one keeps the first usable section instead
        // (R1 gap: the locked pane used to render with its rail entry
        // greyed out, contradicting "renders but cannot be activated").
        if (props.sections.some((sec) => sec.key === key && !sec.disabled)) {
          internal.value = key;
        }
      },
      { immediate: true },
    );
    const active = () =>
      props.sections.some((s) => s.key === internal.value)
        ? internal.value
        : firstUsable();

    // The pane is an HkScrollContainer; only its consumed ref slice is
    // typed here — the scroll reset needs the live viewport element and
    // nothing else.
    const paneRef = ref<{ getScrollElement(): HTMLElement | undefined } | null>(null);
    const shellRef = ref<HTMLElement | null>(null);
    const morphRef = ref<{ $el?: HTMLElement } | null>(null);
    let stageBeforeSwap = 0;
    // One instant-wait loop at a time: a new section change (or unmount)
    // retires the previous epoch so a stale poll can never announce against
    // the next swap's half-settled geometry.
    let instantEpoch = 0;
    let instantPoll: number | null = null;
    const scheduleFrame = (cb: () => void): number =>
      typeof requestAnimationFrame === "function"
        ? requestAnimationFrame(cb)
        : window.setTimeout(cb, 16);
    const cancelFrame = (id: number): void => {
      if (typeof cancelAnimationFrame === "function") cancelAnimationFrame(id);
      else clearTimeout(id);
    };
    const cancelInstantPoll = (): void => {
      if (instantPoll !== null) {
        cancelFrame(instantPoll);
        instantPoll = null;
      }
    };
    onBeforeUnmount(() => {
      instantEpoch += 1;
      cancelInstantPoll();
    });
    // Section switches restart the pane from the top. Written through the
    // public ref slice (the viewport element) rather than scrollTo so the
    // reset stays synchronous and testable in no-layout environments.
    watch(active, () => {
      // The instant settle below needs the height the pane had BEFORE the
      // swap; watchers run before the component patches, so this is still
      // the outgoing stage.
      instantEpoch += 1;
      cancelInstantPoll();
      stageBeforeSwap = morphRef.value?.$el?.offsetHeight ?? 0;
      void nextTick(() => {
        const viewport = paneRef.value?.getScrollElement();
        if (viewport) viewport.scrollTop = 0;
      });
    });

    // ── docked-sheet height hand-off ──────────────────────────────────
    // A phone sheet is sized from this shell's content, but HkModal
    // observes `.hk-modal-body-inner`, which the host rule pins at
    // `height: 100%` (see the SCSS): the box never changes on a section
    // swap, so the sheet would keep the section it OPENED with — about
    // 24px of pane for a 470px 「About」 card (2026-11-04 chest report;
    // the same freeze survives hikari #1041). The pane's own morph
    // container already knows when a swap settles; forward that beat
    // through the family's sheet protocol (`hk-stepflow-swap`, the one
    // HkModal listens for) so the modal re-measures the frame.
    //
    // `durationMs` 0 = the swap settled instantly (reduced motion / the
    // global animation switch) — the protocol's `instant` phase snaps the
    // sheet instead of animating. That snap must not be announced from the
    // settle beat itself: with no choreography the settle lands while the
    // pane's crossfade still holds the LEAVING generation in the flow, so
    // the modal would measure the outgoing (taller) height and a shrink
    // would no-op — the sheet stayed 621px over a 251px section in the
    // round-1 probe. Wait (bounded) for the stage to actually change, then
    // hand the beat over; a growing swap has already changed by then and
    // dispatches on the first frame.
    function dispatchSheetSwap(durationMs: number): void {
      const el = shellRef.value;
      if (!el) return;
      el.dispatchEvent(
        new CustomEvent(STEPFLOW_SWAP_EVENT, {
          bubbles: true,
          detail:
            durationMs > 0
              ? { phase: "morph", durationMs }
              : { phase: "instant" },
        }),
      );
    }

    function announceSheetSwap(payload: { durationMs: number }): void {
      if (!shellRef.value) return;
      if (payload.durationMs > 0) {
        dispatchSheetSwap(sheetMorphMs(payload.durationMs));
        return;
      }
      cancelInstantPoll();
      const epoch = instantEpoch;
      const stage = (): number => morphRef.value?.$el?.offsetHeight ?? 0;
      const before = stageBeforeSwap;
      const deadline = Date.now() + 400;
      const tick = (): void => {
        if (epoch !== instantEpoch) {
          instantPoll = null;
          return;
        }
        if (stage() !== before || Date.now() >= deadline) {
          instantPoll = null;
          dispatchSheetSwap(0);
          return;
        }
        instantPoll = scheduleFrame(tick);
      };
      instantPoll = scheduleFrame(tick);
    }

    function pick(key: string) {
      // Belt-and-braces: every caller already refuses disabled entries
      // upstream (rail: natively disabled buttons; strip: HTabs' disabled
      // triggers + its keyboard guard; deep links: the section watch), so
      // deleting this guard is provably behavior-neutral today (R3
      // mutation M6, 2026-10-28). It stays so a future caller cannot
      // bypass the contract by accident.
      const entry = props.sections.find((s) => s.key === key);
      if (!entry || entry.disabled) return;
      internal.value = key;
      emit("update:section", key);
    }

    // Phone flips the nav to the top strip; desktop keeps the rail. One
    // breakpoint source (useBreakpoint) drives BOTH the DOM branch and
    // the data-phone attribute the SCSS keys the column layout on, so
    // the two halves cannot drift (see the SCSS block for the layout).
    const { isMobile } = useBreakpoint();

    return () => (
      <div class="hk-settings" data-phone={isMobile.value || undefined} ref={shellRef}>
        {/* Scroll ownership (see the docblock): both scrollers are
            HkScrollContainers — the overlay chrome replaces the native
            bars, and the paired-class rules in the SCSS carry each
            region's padding/gap vocabulary into its viewport. */}
        {isMobile.value ? (
          <div class="hk-settings__topnav">
            {/* The shared pill strip IS the button-group primitive: it
                scrolls horizontally with edge fades, keeps the active
                tab scrolled into view, and carries the tablist
                semantics the rail had as a nav landmark. Panels stay
                with the shell's own pane (renderPanels off). Icons ride
                one notch up with the strip (18px vs the rail's 16). */}
            <HTabs
              modelValue={active()}
              tabs={props.sections.map((s) => {
                const Icon = s.icon;
                return {
                  key: s.key,
                  label: s.label,
                  // Same functional-component guard the rail applies —
                  // Component covers object-form components too, which
                  // JSX cannot invoke directly.
                  icon: typeof Icon === "function" ? <Icon size={18} /> : undefined,
                  disabled: s.disabled,
                };
              })}
              renderPanels={false}
              ariaLabel={props.navLabel}
              onUpdate:modelValue={(key: string) => pick(key)}
            />
          </div>
        ) : (
          /* The rail opts into the selection edge hint: an active
             section scrolled out of the rail's band lights a primary
             gradient at the offending edge, so a long section list
             never hides "where did the selection go". Phone flips to
             the strip above, which keeps the active tab scrolled into
             view instead — the hint is rail-only by design. */
          <HkScrollContainer
            as="nav"
            class="hk-settings__rail"
            selectionHint
            aria-label={props.navLabel}
          >
            {props.sections.map((s) => {
              const Icon = s.icon;
              const on = active() === s.key && !s.disabled;
              return (
                <button
                  key={s.key}
                  type="button"
                  class={["hk-settings__rail-item", on ? "is-active" : ""]}
                  aria-current={on ? "true" : undefined}
                  aria-disabled={s.disabled || undefined}
                  disabled={s.disabled}
                  onClick={() => pick(s.key)}
                >
                  {typeof Icon === "function" ? (
                    <span class="hk-settings__rail-icon" aria-hidden="true">
                      <Icon size={16} />
                    </span>
                  ) : null}
                  <span class="hk-settings__rail-label">{s.label}</span>
                </button>
              );
            })}
          </HkScrollContainer>
        )}
        <HkScrollContainer class="hk-settings__pane" ref={paneRef}>
          {/* The section swap runs through the family's standard morph
              container (audit 2026-10-23): the pane's frame follows the
              incoming section's height and the contents dissolve, the
              same mechanism HkTabs panels use. A settings pane is a page
              slot — it must not hard-cut. */}
          <HkTransitionContainer
            ref={morphRef}
            swapKey={active()}
            axis="height"
            onSwap={(payload: { durationMs: number }) => announceSheetSwap(payload)}
          >
            {slots[active()]?.()}
          </HkTransitionContainer>
        </HkScrollContainer>
      </div>
    );
  },
});

/**
 * HkSettingsDialog — the settings window: an HModal carrying the
 * {@link HSettingsBody} shell with a stable frame height, so the modal
 * body's floating scrollbar stays idle and the pane's own overlay
 * scrollbar (an HkScrollContainer) is the only scrollbar (the
 * wowsp-proven contract, upstreamed 2026-10-27). Width defaults to the
 * settings-standard 58rem; `height` styles the shell (the 70vh default
 * fits a modal with title and paddings).
 *
 * Like every HkModal composite it bottom-sheets under 768px; hosts that
 * want a phone page instead render HSettingsBody in their own route and
 * simply never mount this dialog there.
 */
export const HkSettingsDialog = defineComponent({
  name: "HkSettingsDialog",
  props: {
    modelValue: { type: Boolean, default: false },
    title: { type: String, default: "" },
    /** Modal max-width (CSS value or HkModal preset). */
    width: { type: String, default: "58rem" },
    /** Rail entries — passed through to the body. */
    sections: { type: Array as PropType<HkSettingsSection[]>, required: true },
    /** Active section key (v-model:section). */
    section: { type: String, default: undefined },
    /** Accessible name for the rail navigation. */
    navLabel: { type: String, default: undefined },
    /** Shell height — the stable frame the pane scrolls inside. */
    height: { type: String, default: "calc(70vh - 6.5rem)" },
  },
  emits: {
    "update:modelValue": (v: boolean) => typeof v === "boolean",
    "update:section": (key: string) => typeof key === "string",
  },
  setup(props, { emit, slots }) {
    return () => (
      <HModal
        modelValue={props.modelValue}
        onUpdate:modelValue={(v: boolean) => emit("update:modelValue", v)}
        title={props.title}
        width={props.width}
        contentClass="hk-settings-host"
      >
        {/* The per-section slots flow through h()'s third argument — the
            canonical slots channel. JSX children would wrap the slots
            object into a vnode child and the keys would never reach the
            body (caught by the dialog mount test). */}
        {h(
          HkSettingsBody,
          {
            sections: props.sections,
            section: props.section,
            navLabel: props.navLabel,
            "onUpdate:section": (key: string) => emit("update:section", key),
            style: { "--hk-settings-height": props.height },
          },
          slots,
        )}
      </HModal>
    );
  },
});

/**
 * HSettingsGroup — one titled card in the content pane: the standard
 * container of a section's controls. Slightly translucent so cards sit
 * quietly on image wallpapers.
 */
export const HkSettingsGroup = defineComponent({
  name: "HkSettingsGroup",
  props: {
    title: { type: String, default: undefined },
  },
  setup(props, { slots }) {
    return () => (
      <section class="hk-settings-group">
        {props.title ? <h3 class="hk-settings-group-title">{props.title}</h3> : null}
        {slots.default?.()}
      </section>
    );
  },
});

/** HSettingsSub — a titled sub-block inside a group. */
export const HkSettingsSub = defineComponent({
  name: "HkSettingsSub",
  props: {
    title: { type: String, default: undefined },
  },
  setup(props, { slots }) {
    return () => (
      <div class="hk-settings-sub">
        {props.title ? <h4 class="hk-settings-sub-title">{props.title}</h4> : null}
        {slots.default?.()}
      </div>
    );
  },
});

/** HSettingsHint — the small muted explanation line under a control. */
export const HkSettingsHint = defineComponent({
  name: "HkSettingsHint",
  setup(_props, { slots }) {
    return () => <p class="hk-settings-hint">{slots.default?.()}</p>;
  },
});
