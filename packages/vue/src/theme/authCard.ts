/**
 * Auth card sizing contract (hikari ↔ host shells).
 *
 * The login / register / setup cards are `width: 100%` with a shared maximum
 * width, so a host can drop them into a centered flex column without the card
 * collapsing to its intrinsic content width. That width is published here and
 * resolved by the sheets as a custom property, because TWO surfaces need it:
 *
 *  - the card and its measuring wrapper (`.s-auth-card` /
 *    `.s-auth-card-height` in `styles/admin-tokens.scss`), which resolve
 *    `HK_AUTH_CARD_MAX_WIDTH_VAR` with the same literal this constant carries
 *    as the fallback — SCSS cannot read a TS constant, so
 *    `styles/authCardWidth.test.ts` is what keeps the two equal;
 *  - host shells that cap their OWN layout slot to the card — e.g.
 *    shittim-chest's auth crossfade hosts set `maxWidth` inline, because a
 *    crossfade item is `width: 100%` by design and a wider slot renders a
 *    max-width card flush left (shittim-chest#891). Such a host either caps
 *    with `HK_AUTH_CARD_MAX_WIDTH` or — better — sets
 *    `HK_AUTH_CARD_MAX_WIDTH_VAR` on the shell and caps with `var(…)`, which
 *    keeps the slot and the card on ONE number by construction.
 *
 * Both directions are load-bearing: a host slot wider than the card leaves the
 * card pinned to one side, and a host slot narrower than the card silently
 * clamps it. Changing this number means re-checking every consumer — the
 * sheets are guarded by `styles/authCardWidth.test.ts`; consumers are not, so
 * the guard here can only keep hikari's own half honest.
 *
 * Consume the constant from the package entry (`@celestia-island/hikari`):
 * the `./theme/*` subpaths resolve for bundlers but carry no explicit type
 * entry, so a TS consumer importing `hikari/theme/authCard` gets TS2307.
 */
export const HK_AUTH_CARD_MAX_WIDTH = "28rem";

/**
 * The custom property the auth card sheets resolve for their maximum width.
 * Hosts that would rather override than consume can set it on any ancestor.
 */
export const HK_AUTH_CARD_MAX_WIDTH_VAR = "--hk-auth-card-max-width";
