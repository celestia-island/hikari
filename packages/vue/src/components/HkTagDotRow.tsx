import { defineComponent, type PropType } from "vue";

import "./HkTagDotRow.scss";

/** One toggleable tag of a HkTagDotRow. */
export interface HkTagDot {
  /** Stable identity emitted by `toggle`. */
  key: string;
  /** Dot color — any CSS color (hex, rgb(), a var() reference…). */
  color: string;
  /** Caption under the dot; the host i18n's it. */
  label?: string;
  /** Whether the tag is currently applied (the row's selected face). */
  active?: boolean;
  /** Inert: rendered dimmed, clicks never toggle it. */
  disabled?: boolean;
}

/**
 * HkTagDotRow — a horizontal strip of toggleable colored dots, the
 * macOS Finder tag-editor pattern: one dot per tag, the caption
 * beneath it, one click toggles. Tags are domain-free {key, color,
 * label} triples — the host owns the vocabulary (and its i18n), the
 * row owns only the geometry and states.
 *
 * Speaks the unified menu-item spec (see ./_menu-item.scss), so it
 * drops straight into menu surfaces — HkMenu's header/footer slots,
 * HkMenuPanel, a popover — and keeps menu rhythm there, growing with
 * the sheet tokens inside mobile sheets; it works anywhere else a
 * compact tag picker belongs (settings rows, card footers). Clicking
 * a dot never closes a surrounding menu: it emits `toggle` only, and
 * the host decides what to do (menus stay open across toggles so
 * several tags can be flipped in one visit).
 */
export default defineComponent({
  name: "HkTagDotRow",
  props: {
    tags: { type: Array as PropType<HkTagDot[]>, required: true },
    /** Accessible name for the whole group (aria-label). */
    label: { type: String, default: undefined },
  },
  emits: ["toggle"],
  setup(props, { emit }) {
    return () => (
      <div class="hk-tag-dot-row" role="group" aria-label={props.label}>
        {props.tags.map((tag) => (
          <button
            key={tag.key}
            type="button"
            class="hk-tag-dot"
            data-active={tag.active || undefined}
            disabled={tag.disabled}
            aria-pressed={tag.active ? "true" : "false"}
            aria-label={tag.label ?? tag.key}
            title={tag.label}
            onClick={() => emit("toggle", tag.key)}
          >
            <span class="hk-tag-dot__dot" style={{ "--hk-tag-color": tag.color }} />
            {tag.label ? <span class="hk-tag-dot__label">{tag.label}</span> : null}
          </button>
        ))}
      </div>
    );
  },
});
