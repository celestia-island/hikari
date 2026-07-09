# hikari — Maintenance Notes

> Created 2026-07-10 during a routine maintenance sweep.

## Open issue: rustfmt.toml uses unstable options on a stable toolchain

`rustfmt.toml` declares:

```toml
imports_granularity = "Module"
group_imports = "StdExternalCrate"
```

Both are **unstable** rustfmt options, but `rust-toolchain.toml` pins the
**stable** channel. As a result every `cargo fmt` invocation prints:

```
Warning: can't set `group_imports = StdExternalCrate`, unstable features are only available in nightly channel.
Warning: can't set `imports_granularity = Module`, unstable features are only available in nightly channel.
```

and the two options have **no effect** — imports are not being grouped as the
config intends. This also explains the 8 `cargo fmt --check` diffs: contributors
on nightly produce grouped imports, the stable toolchain on CI/locally does not,
so the tree drifts.

### Suggested resolution (pick one)

1. **Mean what the config says**: switch `rust-toolchain.toml` to
   `channel = "nightly"` so the unstable options take effect, then run
   `cargo fmt --all` once to re-group imports.
2. **Drop the unstable options**: remove the two lines from `rustfmt.toml`,
   accept stable rustfmt's default (no import grouping), and run
   `cargo fmt --all` to normalize the tree. CI will then be self-consistent.

Either way a one-time `cargo fmt --all` pass is needed to clear the drift.

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
