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
}

/**
 * HkAuthChannelList — the standard sign-in destination list (2026-11-22
 * user direction): one FULL-WIDTH ROW per channel, the mark on the left
 * and the channel's NAME in plain sight on the right.
 *
 * This replaces the small square icon tiles (`HkAuthMethodList`) as the
 * form for login-flow destination buttons — on every Celestia auth
 * surface. A tile hides the channel's name behind a hover tooltip; a
 * list row states it. The row is a plain bordered button (token-driven,
 * dark-mode automatic) — no square framing, no hover reveal.
 *
 * Control contract: the list never talks to a backend; the host injects
 * `methods` and handles `select(key)`.
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
    /** Optional divider text rendered above the list (consumer copy). */
    divider: { type: String, default: "" },
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
        {props.divider && (
          <div class="hk-auth-channel-divider">
            <span>{props.divider}</span>
          </div>
        )}
        <div class="hk-auth-channel-rows">
          {props.methods.map((method) => (
            <button
              key={method.key}
              type="button"
              class="hk-auth-channel-row"
              data-key={method.key}
              disabled={method.disabled}
              aria-label={method.label}
              onClick={() => {
                if (!method.disabled) emit("select", method.key);
              }}
            >
              <span class="hk-auth-channel-icon" aria-hidden="true">
                {method.icon ?? null}
              </span>
              <span class="hk-auth-channel-name">{method.label}</span>
            </button>
          ))}
        </div>
      </div>
    );
  },
});

export default HkAuthChannelList;
