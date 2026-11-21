import { defineComponent, type PropType } from "vue";

import "./HkAuthScreen.scss";

/** One compliance footer line entry (an ICP filing number, a public-
 *  security filing, …). Deployments source the values from their own
 *  configuration; hikari only renders what it is given. */
export interface HkAuthScreenBeianEntry {
  /** Display text, e.g. "京ICP备XXXXXXXX号-1". */
  title: string;
  /** Optional link target (government registry sites open in a new
   *  tab with `noopener`). */
  url?: string;
}

/**
 * HkAuthScreen — the screen-level shell of every Celestia auth page
 * (login, register, OAuth authorize): a header strip, a BOTH-AXES
 * centered stage for the auth card, and a footer that carries the
 * compliance lines (ICP filing, …).
 *
 * Why a shell at all: the centering contract had drifted per app —
 * erp's user shell pinned the card to the top with a `2rem auto 0`
 * margin, chest derives a `min-height: calc(100dvh - footer - strip)`
 * formula from its own chrome — so the family-wide geometry moves into
 * hikari (2026-11 user direction). The shell is three stacked flex rows
 * and the stage is the flexible middle one, which makes true vertical
 * centering structural instead of a subtraction: whatever the header
 * and footer grow to, the card sits in the middle of what remains.
 *
 * The stage never caps its children's width — cards carry their own
 * `--hk-auth-card-max-width` contract (see HkLoginFlow). `header` and
 * `footer` are plain strips: hosts put their brand row / legal links
 * there; `beian` renders as the footer's own muted line of small
 * links below any footer slot content.
 *
 * ```tsx
 * <HkAuthScreen beian={[{ title: "京ICP备…号", url: "https://beian.miit.gov.cn/" }]}>
 *   {{ header: () => <MyBrandStrip />, default: () => <HkLoginFlow … /> }}
 * </HkAuthScreen>
 * ```
 */
export const HkAuthScreen = defineComponent({
  name: "HkAuthScreen",
  props: {
    /** Compliance lines rendered at the very bottom (muted, small,
     *  centered). Empty renders nothing — no empty footer padding. */
    beian: {
      type: Array as PropType<HkAuthScreenBeianEntry[]>,
      default: () => [],
    },
    /** Accessible name for the compliance nav landmark. The landmark
     *  stays unlabeled when unset (a nav of filing links is self-
     *  describing enough for screen readers); hosts with a localized
     *  name pass it explicitly. */
    beianAriaLabel: { type: String, default: undefined },
  },
  setup(props, { slots }) {
    return () => (
      <div class="hk-auth-screen">
        {slots.header && <header class="hk-auth-screen-header">{slots.header()}</header>}
        <main class="hk-auth-screen-stage">{slots.default?.()}</main>
        {(slots.footer || props.beian.length > 0) && (
          <footer class="hk-auth-screen-footer">
            {slots.footer?.()}
            {props.beian.length > 0 && (
              <nav
                class="hk-auth-screen-beian"
                aria-label={props.beianAriaLabel || undefined}
              >
                {props.beian.map((entry, index) =>
                  entry.url ? (
                    <a
                      key={`${entry.title}-${index}`}
                      class="hk-auth-screen-beian-link"
                      href={entry.url}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {entry.title}
                    </a>
                  ) : (
                    <span key={`${entry.title}-${index}`} class="hk-auth-screen-beian-item">
                      {entry.title}
                    </span>
                  ),
                )}
              </nav>
            )}
          </footer>
        )}
      </div>
    );
  },
});

export default HkAuthScreen;
