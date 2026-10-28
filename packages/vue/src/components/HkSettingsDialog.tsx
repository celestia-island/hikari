import {
  defineComponent,
  h,
  nextTick,
  ref,
  watch,
  type Component,
  type PropType,
} from "vue";

import HkTransitionContainer from "./HkTransitionContainer";
import HkScrollContainer from "./HkScrollContainer";
import HTabs from "./HkTabs";
import { useBreakpoint } from "../runtime/useBreakpoint";
import HModal from "./HkModal";
import "./HkSettingsDialog.scss";

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
 * page the host manages its own layout.
 *
 * Phone anatomy (2026-10-28 user direction): under the family's mobile
 * breakpoint the left rail moves to the TOP of the window as the shared
 * pill strip (HTabs) — horizontally scrollable with edge fades, so every
 * section fits no matter how many entries a host offers — one notch
 * larger than the regular strips, with a small gap before the pane.
 * Desktop keeps the rail exactly as it was; the flip is live on resize
 * and shared by every consumer of this shell (page-embedded bodies
 * included).
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
    const internal = ref(props.sections[0]?.key ?? "");
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
        : (props.sections[0]?.key ?? "");

    // The pane is an HkScrollContainer; only its consumed ref slice is
    // typed here — the scroll reset needs the live viewport element and
    // nothing else.
    const paneRef = ref<{ getScrollElement(): HTMLElement | undefined } | null>(null);
    // Section switches restart the pane from the top. Written through the
    // public ref slice (the viewport element) rather than scrollTo so the
    // reset stays synchronous and testable in no-layout environments.
    watch(active, () => {
      void nextTick(() => {
        const viewport = paneRef.value?.getScrollElement();
        if (viewport) viewport.scrollTop = 0;
      });
    });

    function pick(key: string) {
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
      <div class="hk-settings" data-phone={isMobile.value || undefined}>
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
          <HkScrollContainer as="nav" class="hk-settings__rail" aria-label={props.navLabel}>
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
          <HkTransitionContainer swapKey={active()} axis="height">
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
