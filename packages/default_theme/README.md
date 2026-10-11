# @celestia-island/default-theme

The reference **precompiled theme package** for hikari hosts — and the
working example for anyone building a custom theme:

1. Ship your compiled CSS + JS in the package.
2. Call hikari's `registerThemeDecor` for each decor slot you fill.
3. The host mounts you with a single import (or the theme config
   auto-mounts you when selected).

This package fills the `status.tray` slot with hikari's former brand
tray (the four-glyph clock decor), registered on the `"*"` wildcard so
any theme can still override it.
