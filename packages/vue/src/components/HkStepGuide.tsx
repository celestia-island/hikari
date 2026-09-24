import { defineComponent, h, type Component, type PropType } from "vue";

import "./HkStepGuide.scss";

/**
 * One step of an illustrated how-to guide.
 *
 * The visual is the step's OWN artwork — an SVG component, a lucide icon,
 * or a bitmap URL — rendered large in a soft circular bed, with the
 * ordinal pinned to the bed's corner and the caption beneath/beside it.
 * Hosts that only have an icon get the same grammar scaled down.
 */
export interface StepGuideItem {
  /** Stable key (also the list rendering key). */
  id: string;
  /** Short imperative title ("插入 SD 卡"). */
  title: string;
  /** One-line elaboration under the title. */
  description?: string;
  /** SVG/lucide component rendered as the artwork. */
  icon?: Component;
  /** Bitmap/photo URL for the artwork (`icon` wins when both given). */
  image?: string;
  /** Accessible name when the artwork is decorative-only. Defaults to the title. */
  alt?: string;
}

/**
 * HkStepGuide — the big-icon illustrated step list.
 *
 * The "what do I physically do now?" surface for hardware-adjacent flows
 * (upstreamed from the flasher's 等待上线 step and wowsp's install
 * walkthrough, user direction 2026-09-25): numbered steps, each with a
 * large artwork — inline SVG, an icon component, or a bitmap — a short
 * title and a one-line description.
 *
 * Orientation follows the AVAILABLE WIDTH, not the viewport: the guide is
 * its own container query root, so wide hosts lay the steps side by side
 * (art on top, caption below, a connector bridging the beds) and only
 * stack them vertically once the width runs out. `layout="grid"` instead
 * wraps the steps as equal cards.
 *
 * The artwork slots are deliberately permissive: pass a Vue component
 * (`icon: MySvg`) for crisp theme-aware SVGs, or `image: url` for
 * photos/screenshots the docs pipeline produces. Steps may be marked
 * `data-done` through the `doneIds` prop (the check replaces the ordinal)
 * so the guide doubles as a checklist while the flow progresses.
 */
export default defineComponent({
  name: "HkStepGuide",
  props: {
    items: { type: Array as PropType<StepGuideItem[]>, required: true },
    /** Steps whose ids appear here render as completed (check, dim). */
    doneIds: { type: Array as PropType<string[]>, default: () => [] },
    /** Width-responsive flow steps (default) or equal cards. */
    layout: { type: String as PropType<"list" | "grid">, default: "list" },
    /** Section heading above the steps. */
    title: { type: String, default: undefined },
  },
  setup(props) {
    return () => {
      if (!props.items.length) return null;
      const done = new Set(props.doneIds);
      return (
        <div class="hk-step-guide" data-layout={props.layout}>
          {props.title && <h4 class="hk-step-guide-title">{props.title}</h4>}
          <ol class="hk-step-guide-list">
            {props.items.map((item, idx) => {
              const isDone = done.has(item.id);
              const Art = item.icon;
              const alt = item.alt ?? item.title;
              return (
                <li
                  key={item.id}
                  class="hk-step-guide-item"
                  data-done={isDone || undefined}
                >
                  <span class="hk-step-guide-figure">
                    <span
                      class="hk-step-guide-art"
                      aria-hidden={Art || item.image ? undefined : true}
                    >
                      {Art ? (
                        h(Art, { class: "hk-step-guide-art-svg" })
                      ) : item.image ? (
                        <img
                          class="hk-step-guide-art-img"
                          src={item.image}
                          alt={alt}
                          draggable={false}
                        />
                      ) : null}
                    </span>
                    <span class="hk-step-guide-ordinal">
                      {isDone ? (
                        <svg
                          class="hk-step-guide-check"
                          viewBox="0 0 24 24"
                          aria-hidden="true"
                        >
                          <path
                            d="M20 6L9 17l-5-5"
                            fill="none"
                            stroke="currentColor"
                            stroke-width="3"
                            stroke-linecap="round"
                            stroke-linejoin="round"
                          />
                        </svg>
                      ) : (
                        idx + 1
                      )}
                    </span>
                  </span>
                  <span class="hk-step-guide-body">
                    <span class="hk-step-guide-item-title">{item.title}</span>
                    {item.description && (
                      <span class="hk-step-guide-item-desc">
                        {item.description}
                      </span>
                    )}
                  </span>
                </li>
              );
            })}
          </ol>
        </div>
      );
    };
  },
});
