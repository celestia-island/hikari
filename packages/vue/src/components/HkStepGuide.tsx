import { defineComponent, h, type Component, type PropType } from "vue";

import "./HkStepGuide.scss";

/**
 * One step of an illustrated how-to guide.
 *
 * Each step renders as a CARD — the step's OWN artwork (an SVG component,
 * a lucide icon, or a bitmap URL) drawn large on the card face, with the
 * ordinal pinned to the card's outer corner and the caption beneath it.
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
 * HkStepGuide — the big-artwork illustrated step cards.
 *
 * The "what do I physically do now?" surface for hardware-adjacent flows
 * (upstreamed from the flasher's 等待上线 step and wowsp's install
 * walkthrough, user direction 2026-09-25): every step is a rounded card —
 * large artwork on the face, a short title and a one-line description
 * under it, the ordinal badge pinned to the card's outer top corner.
 *
 * Orientation follows the AVAILABLE WIDTH, not the viewport: the guide is
 * its own container query root, so wide hosts lay the cards side by side
 * with a chevron bridging consecutive steps, and only stack them
 * vertically once the width runs out. `layout="grid"` instead wraps the
 * cards as an auto-fill grid.
 *
 * The artwork slots are deliberately permissive: pass a Vue component
 * (`icon: MySvg`) for crisp theme-aware SVGs, or `image: url` for
 * photos/screenshots the docs pipeline produces. Steps may be marked
 * `data-done` through the `doneIds` prop (the check replaces the ordinal,
 * the card picks up a success edge) so the guide doubles as a checklist
 * while the flow progresses.
 */
export default defineComponent({
  name: "HkStepGuide",
  props: {
    items: { type: Array as PropType<StepGuideItem[]>, required: true },
    /** Steps whose ids appear here render as completed (check, success edge). */
    doneIds: { type: Array as PropType<string[]>, default: () => [] },
    /** Width-responsive flow cards (default) or an auto-fill card grid. */
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
