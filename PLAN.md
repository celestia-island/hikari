# hikari — Maintenance Notes

> Created 2026-07-10 during a routine maintenance sweep.

## Documented decision: rustfmt.toml unstable options on a stable toolchain

`rustfmt.toml` declares two unstable options:

```toml
imports_granularity = "Module"
group_imports = "StdExternalCrate"
```

Both are **unstable** rustfmt options, but `rust-toolchain.toml` pins the
**stable** channel, so they are **silently ignored** and every `cargo fmt`
prints two "unstable features are only available in nightly channel" warnings.

### Resolution (2026-07-10)

Verified empirically that the options have **zero effect** on the current tree
(`cargo fmt --all -- --check` reports 0 diffs both with and without the config),
so the tree is already fmt-clean on stable regardless. Rather than delete the
options (which would lose the documented intent) or force a nightly toolchain
(which would burden all contributors/CI), the options are **kept and annotated**
with a comment in `rustfmt.toml` explaining they are nightly-only and have no
effect today. The original "8 fmt drift" diffs had already resolved themselves
by the time of this check.

If the project later wants the import grouping to actually apply, switch
`rust-toolchain.toml` to `channel = "nightly"` (the options will then take
effect and a one-time `cargo fmt --all` will group imports).

## Open issue: clippy warnings (24)

`cargo clippy --workspace` reports 24 warnings:

- 12 "this lint expectation is unfulfilled" — from `#[expect]` attributes in
  doctests; likely intentional (tests that document a lint *should* fire). Review
  case by case.
- 6 "this `if` statement can be collapsed" — mechanical `collapsible_if` fixes.
- 2 "this `impl` can be derived" — replace manual impls with `#[derive(..)]`.
- 1 "manual `rem_euclid`", 1 "manual `!Range::contains`", 1 "match could be
  replaced by its body" — small mechanical fixes.
- 1 "function `get_intensity_for_state` is never used" — false positive; the
  function *is* called (packages/components/src/feedback/glow.rs:305) but inside
  a cfg-gated block, so clippy on a non-wasm target does not see the use.

The mechanical fixes (collapsible_if, derive, rem_euclid, Range::contains) are
safe to apply; they are left for a maintainer pass because hikari is a
fast-moving shared dependency and a bulk clippy autofix can conflict with
in-flight work.

## Done during this sweep

- README: corrected the license declaration (was MIT/Apache, actually SySL) and
  fixed dead package/doc links (en-US→en, render-service/builder removal).
- guides/index.md: fixed broken CONTRIBUTING links across all 11 languages.
- Removed dead see-also links to unwritten design/classes docs.
- i18n: verified strings.toml key parity (75 keys × 9 locales, 100%).
