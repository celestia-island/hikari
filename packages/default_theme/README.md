# @celestia-island/default-theme (build-time built-in)

The reference **build-time standard theme plugin** for hikari hosts —
and the working example for anyone building a custom theme plugin:

1. Ship your compiled CSS + JS in the plugin package.
2. Call hikari's `registerThemeDecor` for each decor slot you fill.
3. The HOST compiles you in at build time (or the theme config
   auto-mounts you when selected).

This plugin fills the `status.tray` slot with hikari's former brand
tray (the four-glyph clock decor), registered on the `"*"` wildcard so
any theme can still override it.

## Distribution model (deliberate)

This package **follows the akivili plugin conventions and is compiled
into the host at build time — it is `private` and is never published
to npm.** Hosts that want the default look either vendor the module
(the ~3-file surface) or compile the monorepo workspace in. It is a
standard *built-in*, not a dependency.
