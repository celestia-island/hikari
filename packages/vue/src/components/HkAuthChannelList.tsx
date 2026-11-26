import { defineComponent } from "vue";

import "./HkAuthChannelList.scss";

/** One sign-in destination row: the provider's mark on the left, the
 *  channel's name on the right. */
export interface HkAuthChannelListEntry {
  key: string;
  /** The channel name rendered as the row's label (e.g. 「飞书登录」). */
  label: string;
  /** Prebuilt icon vnode (brand SVG, <img>, …) rendered at the row's
   *  left. Loose-typed like every auth icon: hosts materialize hikari
   *  against their own vue store. A missing icon leaves the slot empty
   *  (the label carries the row). */
  icon?: unknown;
  disabled?: boolean;
  /** Navigation target. When set the row is a real link (`<a href>`), so
   *  middle-click, ctrl-click and crawlers work; `select(key)` STILL fires
   *  first (the host arms state) and the default navigation is NOT
   *  prevented. Default undefined — the row stays a `<button type="button">`
   *  and the host navigates itself, as before. */
  href?: string;
}

/**
 * HkAuthChannelList — the standard sign-in destination list (2026-11-22
 * user direction): one FULL-WIDTH ROW per channel, the mark on the left
 * and the channel's NAME in plain sight on the right.
 *
 * This replaced the small square icon tiles as the form for login-flow
 * destination buttons — on every Celestia auth surface (the tile
 * component retired with the 2026-11-26 divider removal). A tile hides
 * the channel's name behind a hover tooltip; a list row states it. The row is a plain bordered button (token-driven,
 * dark-mode automatic) — no square framing, no hover reveal.
 *
 * Control contract: the list never talks to a backend; the host injects
 * `methods` and handles `select(key)`, or gives a row a `href` so the row
 * itself navigates.
 *
 * ```tsx
 * <HkAuthChannelList
 *   methods={[{ key: "feishu", label: "飞书登录", icon: <FeishuMark /> }]}
 *   onSelect={(key) => startLogin(key)}
 * />
 * ```
 */
export const HkAuthChannelList = defineComponent({
  name: "HkAuthChannelList",
  props: {
    /** Channel rows, in render order. */
    methods: {
      type: Array as () => HkAuthChannelListEntry[],
      required: true,
    },
  },
  emits: {
    /** A channel row was activated. */
    select: (_key: string) => true,
  },
  setup(props, { emit }) {
    return () => (
      <div class="hk-auth-channel-list">
        <div class="hk-auth-channel-rows">
          {props.methods.map((method) => {
            // A disabled link carries no `href` at all (an anchor cannot be
            // natively disabled); `aria-disabled` keeps the state announced.
            const isLink = Boolean(method.href);
            const active = !method.disabled;
            const body = (
              <>
                <span class="hk-auth-channel-icon" aria-hidden="true">
                  {method.icon ?? null}
                </span>
                <span class="hk-auth-channel-name">{method.label}</span>
              </>
            );
            const onClick = () => {
              // Synchronous, BEFORE the browser follows the link.
              if (active) emit("select", method.key);
            };
            return isLink ? (
              <a
                key={method.key}
                class="hk-auth-channel-row"
                data-key={method.key}
                href={active ? method.href : undefined}
                aria-disabled={active ? undefined : "true"}
                aria-label={method.label}
                onClick={onClick}
              >
                {body}
              </a>
            ) : (
              <button
                key={method.key}
                type="button"
                class="hk-auth-channel-row"
                data-key={method.key}
                disabled={method.disabled}
                aria-label={method.label}
                onClick={onClick}
              >
                {body}
              </button>
            );
          })}
        </div>
      </div>
    );
  },
});

export default HkAuthChannelList;
