# Hikari Examples

The in-repo Rust demo applications (`examples/website`, `examples/table-demo`, ...) were
retired together with the Rust E2E crate. Hikari is consumed as a library now, both as the
`hikari-*` crates (under the tairitsu framework) and as `@celestia-island/hikari` (Vue 3).

Where to look instead:

- **Rendered component gallery** — the tairitsu website example mounts `hikari-components`:
  <https://github.com/celestia-island/tairitsu/tree/master/examples/website>.
- **Visual verification** — `scripts/e2e` captures routes, compares them against
  `tests/visual/baseline` and writes a report. Start with `just e2e-health`, then
  `just e2e-batch`; it talks to a tairitsu-debug server over HTTP and needs no browser driver.
- **One component at a time** — `just e2e-inspect` prints the layout/console report for a
  single route.

The `examples/*` entry stays in the workspace `exclude` list so a future example crate does
not silently join the published workspace.
