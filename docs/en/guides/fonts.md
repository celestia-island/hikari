# Font stacks

Hikari owns one font vocabulary. Every face decision an app makes should
resolve to one of three tokens — never a hand-rolled literal stack.

## The tokens

| Token | Constant (runtime) | Role |
|---|---|---|
| `--font-sans` | `HIKARI_FONT_SANS` | UI chrome, labels, all localized copy |
| `--font-reading` | `HIKARI_FONT_READING` | long-form reading surfaces |
| `--font-mono` | `HIKARI_FONT_MONO` | machine data only (see the rule below) |

The tokens are declared twice by design, and the copies must stay
byte-identical (`src/theme/fontStacks.contract.test.ts` pins this):

- **Static sheet** — `packages/vue/src/scale.scss` (vendored to
  `src/styles/theme/scale.scss` for npm installs): the pre-boot paint and
  any surface that does not mount the runtime context.
- **Runtime context** — `packages/vue/src/theme/fontContext.ts`: every
  webui calls `initFontContext()` at bootstrap, which re-declares the
  tokens as inline CSS vars on `<html>` (and honors stored user
  overrides).

Every Latin mono face is followed by CJK **UI sans** faces
(`PingFang SC`, `Microsoft YaHei`, `Noto Sans CJK SC`) before the generic
`monospace` catcher: Latin glyphs render mono, CJK glyphs render in the
UI sans. That ordering IS the CJK-safety contract — the generic catcher
is where platform fontconfig roulette lives, and a mono-stack CJK face
that misses it lands on an arbitrary system mono. Kai/serif faces are
banned from every stack.

## The rule: mono is for machine data

`--font-mono` is for **machine data**: identifiers, instance numbers,
model names, code, timestamps, wire literals — ASCII the user reads as
data.

It is **never** for localized or human-authored text. A `t()` result, a
report title, a status name — anything that can carry CJK (or any
non-Latin script) — renders in `--font-sans`. The mono stacks carry no
CJK glyphs; putting localized copy in mono drops every non-Latin glyph
onto a platform-dependent fallback that visibly mismatches the rest of
the UI (the 2026-11-07 topic-map incident: 「创建中」 rendered in a
random system mono on Linux).

One pill can carry both faces — render the identity in mono and the
localized status in sans (conditional class / two spans). Never a
blanket mono face over mixed content.

## Utility layers must alias the token

If a host app ships utility classes (UnoCSS / Tailwind themes), their
`font-mono` / `font-sans` entries must alias the tokens:

```ts
fontFamily: {
  sans: "var(--font-sans)",
  mono: "var(--font-mono)",
}
```

A literal stack in a utility bypasses both copies above — it will not
see the runtime context, it will not receive CJK-safety fixes, and it
will drift (this is exactly how a `JetBrains Mono, Fira Code, …, mono`
utility shipped downstream with zero CJK coverage). Literal stacks
belong in exactly two places: `fontContext.ts` and `scale.scss`.
