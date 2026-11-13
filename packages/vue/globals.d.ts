// Build-time defines this package's own sources reference but do not own.
//
// Deliberately OUTSIDE `src/`: the published tarball ships `src/` only, so a
// consuming app keeps sole ownership of these globals (chest and erp both
// declare `__APP_VERSION__` in their own env.d.ts — shipping a second
// declaration would collide with theirs). This file exists purely so hikari
// can type-check its own sources.
declare const __APP_VERSION__: string;
