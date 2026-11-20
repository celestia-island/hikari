// ------
// Shared avatar image state
// ------
//
// ONE failed-load latch for every avatar primitive in the library. An
// `<img>` that 404s renders the browser's broken-picture glyph — the exact
// "missing image" look 2026-11-20 user report called out for the workspace
// roster (demiurge's `/static/avatars/…` blob had gone stale; the component
// kept the broken image instead of its own letter chip). A stored avatar URL
// can always 404 (deleted upload, external provider unreachable, mirror cache
// cold), so "the URL exists" is not "there is an avatar": every face must
// degrade to the SAME letter fallback it renders when the URL is absent.
//
// The latch is per-URL: a new `src` (account switch, avatar re-upload) gets a
// fresh attempt, or one broken URL would poison the chip for the rest of the
// component's life. Same contract as HkAvatarButton's hand-rolled latch
// (2026-10-29), now shared so the three primitives cannot drift.

import { computed, ref, watch, type ComputedRef } from "vue";

/** `src` getter — pass the component prop, e.g. `() => props.src`. */
export interface AvatarImageState {
  /** The URL to render, or "" when the letter fallback must show instead. */
  src: ComputedRef<string>;
  /** Wire to the `<img @error>` binding. */
  onError: () => void;
}

/** Failed-load latch shared by HkAvatar / HkAvatarButton / HkMenuIdentityItem. */
export function useAvatarImage(source: () => string | undefined): AvatarImageState {
  const failed = ref(false);
  // A new URL deserves a fresh attempt: reset on every source change. The
  // getter makes this work for prop-driven updates on the same instance
  // (a remount would restart unlatched anyway and prove nothing).
  watch(source, () => {
    failed.value = false;
  });
  const src = computed(() => {
    const url = (source() ?? "").trim();
    return url && !failed.value ? url : "";
  });
  return {
    src,
    onError: () => {
      failed.value = true;
    },
  };
}
