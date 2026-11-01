#!/usr/bin/env python3
"""Sync the Rust-side vendored mirrors of the canonical Vue component sheets.

The Hikari design system ships two forms of the same components: the Vue 3
library (`packages/vue`, canonical) and the Rust/WASM crate
(`packages/components`, built on tairitsu). Both must render from the SAME
stylesheet source, so the Rust crate carries byte-identical vendored copies
of the Vue sheets under `packages/components/src/styles/vue-mirror/`:

    packages/vue/src/tokens.scss
        -> packages/components/src/styles/vue-mirror/tokens.scss
    packages/vue/src/styles/polyfill.scss
        -> packages/components/src/styles/vue-mirror/styles/_polyfill.scss
    packages/vue/src/components/<Sheet>.scss
        -> packages/components/src/styles/vue-mirror/components/<Sheet>.scss

Each mirror keeps one provenance header (everything up to and including the
"do not hand-edit here." marker line); the body must match the upstream
byte-for-byte. Edit the UPSTREAM Vue sheet, then run this script — never
hand-edit a mirror.

Compile constraint: a mirrored sheet must stay parseable by the grass
compiler (the Rust form compiles this very file). Modern CSS the parser lacks
therefore cannot live in a mirrored sheet — use an equivalent literally
compilable value in the canonical sheet and note it in the PR. Known blockers:
  * `calc(infinity * 1s)`            → a finite step-end duration;
  * relative `oklch(from ... min/max(l, ...) c h)` - an oklab mix toward
    black/white instead (an APPROXIMATE lightness cap/floor; exact channel
    clamping needs syntax grass lacks);
  * CSS relative colour `rgb(from C r g b / a)`
                                     → `color-mix(in srgb, C <a*100>%, transparent)`
                                       (identical in srgb);
  * `calc-size(auto, size * 0.8)`    → a plain percentage/px value (grass has no
                                       calc-size; HkListTransition uses `80%`).

Guards:
  * Rust:  packages/components/tests/vue_mirror_drift_tests.rs (cargo test)
  * this script's --check mode exits 1 on any drift (CI-friendly)

Usage:
  python3 scripts/sync-vue-mirror.py            # refresh/create mirrors
  python3 scripts/sync-vue-mirror.py --check    # exit 1 if any drift
"""

import sys
from pathlib import Path

root = Path(__file__).resolve().parent.parent
vue_src = root / "packages" / "vue" / "src"
mirror_root = root / "packages" / "components" / "src" / "styles" / "vue-mirror"

# (mirror path relative to vue-mirror/, upstream path relative to vue/src/)
# Partials first: the sibling @use targets every mirrored family sheet
# resolves against (`./scrim-fade`, `./menu-item`, `./hikari-vars`) plus the
# shared polyfill partial (`../styles/polyfill`) and the token fallbacks.
SHARED_PARTIALS: list[tuple[str, str]] = [
    # The `s-*` layout sheet: the shell mirrors (AdminShell / AdminHeader /
    # AdminTablePage / FaceShell / StatusBar) carry NO sheet of their own and
    # this table is their entire geometry.
    ("styles/admin-tokens.scss", "styles/admin-tokens.scss"),
    ("tokens.scss", "tokens.scss"),
    ("scale.scss", "scale.scss"),
    ("styles/_polyfill.scss", "styles/polyfill.scss"),
    ("components/_scrim-fade.scss", "components/_scrim-fade.scss"),
    ("components/_menu-item.scss", "components/_menu-item.scss"),
    ("components/_hikari-vars.scss", "components/_hikari-vars.scss"),
]

# The feedback family sheets mirrored by the wasm-mirror-feedback wave
# (2026-11). Append later families here as their mirrors land; the drift
# test walks this table, so an upstream rename fails loudly here.
# Chrome sheets the mirrored family surfaces render from but do not define:
# the window close affordance (`.hk-window-close`) and the button voice
# (`.hk-btn*`, used by BlockingToast / footer actions). Mirrored so both
# forms ship the same chrome instead of falling back to unstyled buttons.
CHROME_SHEETS: list[str] = [
    "window-close.scss",
    "HkButton.scss",
]

# W2a — basic-form family (button / form controls / identity atoms) plus the
# partial sheets they @use (HkIconButtonVars, HkPlaceholderMarquee).
BASIC_SHEETS: list[str] = [
    "HkIconButton.scss",
    "HkIconButtonVars.scss",
    "HkIconButtonGroup.scss",
    "HkIconChip.scss",
    "HkInput.scss",
    "HkPlaceholderMarquee.scss",
    "HkTextarea.scss",
    "HkSelect.scss",
    "HkCheckbox.scss",
    "HkRadio.scss",
    "HkSwitch.scss",
    "HkSlider.scss",
    "HkLabel.scss",
    "HkBadge.scss",
    "HkAvatar.scss",
    "HkCard.scss",
    # The dot tones HkIconButton references (vue: hk-corner-badge-<tone>).
    "HkCornerBadge.scss",
]

# W2b — advanced inputs (numeric, chip/token, date/time, file, colour, FAB)
# plus the shared picker-pane partial they @use.
ADVANCED_SHEETS: list[str] = [
    "HkNumberInput.scss",
    "HkNumberSteppers.scss",
    "HkOtpInput.scss",
    "HkPhoneInput.scss",
    "HkTag.scss",
    "HkTagInput.scss",
    "HkTemplateField.scss",
    "HkTokenInput.scss",
    "HkColorPicker.scss",
    "HkDatePicker.scss",
    "HkDateTimePicker.scss",
    "HkPickerPane.scss",
    "HkDateTag.scss",
    "HkSliderField.scss",
    "HkSearchInput.scss",
    "HkFileField.scss",
    "HkFilePickerField.scss",
    "HkFileBrowserDialog.scss",
    "HkRollingNumber.scss",
    "HkFab.scss",
    "HkTimeZoneGlobe.scss",
]

# W3 — data-viz + data-table family. HkTrendChart and HkFilterOperatorIcon
# have no sheet of their own (they compose chart/filter sheets already vendored
# or imported by their parents).
DATA_SHEETS: list[str] = [
    "HkBarChart.scss",
    "HkDonutChart.scss",
    "HkTreemap.scss",
    "HkTreemapStage.scss",
    "HkCalendarHeatmap.scss",
    "HkStatCard.scss",
    "HkGaugeRing.scss",
    "HkWaterfall.scss",
    "HkTable.scss",
    "HkTree.scss",
    "HkFilterBar.scss",
    "HkFilterChip.scss",
    "HkFilterPanel.scss",
    "HkFilterTrigger.scss",
    "HkPillToggleGroup.scss",
    "HkSelectionGrid.scss",
    "HkSelectionWaterfall.scss",
    "HkCardList.scss",
]

# W4 — display + media family. HkCountdownDigit has no sheet of its own.
DISPLAY_SHEETS: list[str] = [
    "HkEmptyState.scss",
    "HkQrCode.scss",
    "HkSkeleton.scss",
    "HkTimeline.scss",
    "HkInfiniteTail.scss",
    "HkLoadMore.scss",
    "HkCrossfade.scss",
    "HkListTransition.scss",
    "HkTransitionContainer.scss",
    "HkHoverRevealAction.scss",
    "HkMediaPlayer.scss",
    "HkMediaSlider.scss",
    "HkMediaControlBar.scss",
    "HkMediaVisualizer.scss",
    "HkImageLightbox.scss",
    "HkImagePreview.scss",
    "HkImageViewer.scss",
    "HkTerminal.scss",
    "HkLogWindow.scss",
    "HkJsonTree.scss",
    "HkMarkdownRenderer.scss",
    "HkDiffViewer.scss",
]

# W5 — layout + nav family. The shell compositions (AdminShell/AdminHeader/
# AdminTablePage/FaceShell/StatusBar/LocalePickerPopup/NavSidebar) ship NO hikari
# sheet upstream: they are host-utility layouts, so their mirrors document an empty
# styles() table instead of inventing CSS.
LAYOUT_SHEETS: list[str] = [
    "HkPageHeader.scss",
    "HkTitleBar.scss",
    "HkWindowControls.scss",
    "HkStatusRow.scss",
    "HkStatusPill.scss",
    "HkDockBar.scss",
    "HkShareBar.scss",
    "HkStepFlow.scss",
    "HkPaneHolder.scss",
    "HkSidebarRail.scss",
    "HkAffixPicker.scss",
    "HkHeaderPicker.scss",
    "HkLocalePicker.scss",
    "HkNavItem.scss",
    "HkMenu.scss",
]

# W6 — overlay + auth family. `HkSelectPanel` and `HkContextMenuProvider` ship no
# sheet of their own (the panel composes HkSelect's surface; the provider renders
# nothing), and the auth cards' geometry rides `admin-tokens.scss` (vendored).
OVERLAY_SHEETS: list[str] = [
    "HkAdaptiveDialog.scss",
    "HkPopupSelect.scss",
    "HkFloatingLayer.scss",
    "HkAltSignIn.scss",
    "HkMfaVerifyCard.scss",
    "HkThirdPartySignInCard.scss",
    "HkAuthMethodList.scss",
    "HkAuthSubmitButton.scss",
    "HkPasswordSurface.scss",
    "HkCaptchaModal.scss",
    "HkCaptchaWidget.scss",
    "HkProtocolModal.scss",
    "HkCookieConsent.scss",
]

# W7 — scene3d family (boards, canvases, drag grids, minimaps).
SCENE_SHEETS: list[str] = [
    "HkBoard.scss",
    "HkBoard3D.scss",
    "HkNodeCanvas.scss",
    "HkKanban.scss",
    "HkDraggableGrid.scss",
    "HkDraggableList.scss",
    "HkMinimap.scss",
    "HkMinimap3D.scss",
    "HkZoomToolbar.scss",
    "HkWindowedItem.scss",
    "HkStarSystem.scss",
    "HkBlankCanvas.scss",
]

# W8 — theme + misc family. `HkThemeDecor`/`HkThemePanelContent`/
# `HkColorSchemeEditor`/`HkActionBar`/`HkConnectionStatus`/`HkErrorBoundary`/
# `HkAvatarButton` ship no sheet of their own (they borrow a parent's or emit
# host-utility classes only).
MISC_SHEETS: list[str] = [
    "HkWallpaperBackdrop.scss",
    "HkThemeToggle.scss",
    "HkColorSchemeDialog.scss",
    "HkSplash.scss",
    "HkLogo.scss",
    "HkAboutModal.scss",
    "HkCopyBadge.scss",
    "HkCornerBadge.scss",
    "HkErrorLanding.scss",
    "HkSettingsDialog.scss",
    "HkSecretRevealModal.scss",
    "HkDivider.scss",
]

FAMILY_SHEETS: list[str] = [
    "HkAlert.scss",
    "HkBlockingToast.scss",
    "HkConfirmDialog.scss",
    "HkDrawer.scss",
    "HkLoadingVeil.scss",
    "HkMessageBox.scss",
    "HkModal.scss",
    "HkPersistentToast.scss",
    "HkPersistentToastGroup.scss",
    "HkPhaseTransition.scss",
    "HkPopover.scss",
    "HkProgressBar.scss",
    "HkProgressDialog.scss",
    "HkProgressRing.scss",
    "HkSpinner.scss",
    "HkToast.scss",
    "HkTooltip.scss",
]

HEADER_LINES = [
    "// VENDORED MIRROR — byte-identical re-copy of the canonical Vue sheet",
    "// under packages/vue/src (the Vue library is the design-system source of",
    "// truth; the Rust crate compiles this copy so both forms ship the same",
    "// CSS, and so the crates.io sdist — which cannot reach ../vue — stays",
    "// self-contained).",
    "//",
    "// Edit the upstream sheet, then: python3 scripts/sync-vue-mirror.py",
    "// Drift guard: packages/components/tests/vue_mirror_drift_tests.rs",
    "// VENDORED MIRROR — do not hand-edit here.",
]

MARKER = "do not hand-edit here."

# Written on every sync so the Rust drift test walks the same table without
# duplicating it (tests/vue_mirror_drift_tests.rs). Committed alongside the
# mirrors; the test also fails on any mirror file absent from the manifest.
MANIFEST_NAME = "manifest.tsv"


def build_pairs() -> list[tuple[Path, Path]]:
    pairs: list[tuple[Path, Path]] = []
    for mirror_rel, upstream_rel in SHARED_PARTIALS:
        pairs.append((mirror_root / mirror_rel, vue_src / upstream_rel))
    for sheet in FAMILY_SHEETS + CHROME_SHEETS + BASIC_SHEETS + ADVANCED_SHEETS + DATA_SHEETS + DISPLAY_SHEETS + LAYOUT_SHEETS + OVERLAY_SHEETS + SCENE_SHEETS + MISC_SHEETS:
        pairs.append((mirror_root / "components" / sheet, vue_src / "components" / sheet))
    return pairs


def manifest_text() -> str:
    lines = ["# mirror-path\tupstream-path (relative to packages/vue/src)"]
    for mirror_rel, upstream_rel in SHARED_PARTIALS:
        lines.append(f"{mirror_rel}\t{upstream_rel}")
    for sheet in FAMILY_SHEETS + CHROME_SHEETS + BASIC_SHEETS + ADVANCED_SHEETS + DATA_SHEETS + DISPLAY_SHEETS + LAYOUT_SHEETS + OVERLAY_SHEETS + SCENE_SHEETS + MISC_SHEETS:
        lines.append(f"components/{sheet}\tcomponents/{sheet}")
    return "\n".join(lines) + "\n"


def expected_bytes(upstream: Path) -> bytes:
    header = ("\n".join(HEADER_LINES) + "\n\n").encode("utf-8")
    return header + upstream.read_bytes()


def sync(vendored: Path, upstream: Path, check_only: bool) -> str:
    if not upstream.is_file():
        print(f"upstream file missing: {upstream}", file=sys.stderr)
        sys.exit(1)

    want = expected_bytes(upstream)
    if not vendored.is_file():
        if check_only:
            return f"MISSING {vendored.relative_to(root)}"
        vendored.parent.mkdir(parents=True, exist_ok=True)
        vendored.write_bytes(want)
        return f"created {vendored.relative_to(root)}"
    if vendored.read_bytes() == want:
        return ""
    if check_only:
        return f"DRIFT   {vendored.relative_to(root)}"
    vendored.write_bytes(want)
    return f"synced  {vendored.relative_to(root)}"


def main() -> int:
    check_only = "--check" in sys.argv[1:]
    mutating = not check_only
    mirror_root.mkdir(parents=True, exist_ok=True)
    expected_manifest = manifest_text()
    if mutating:
        (mirror_root / MANIFEST_NAME).write_text(expected_manifest, encoding="utf-8")
    problems = 0
    for vendored, upstream in build_pairs():
        result = sync(vendored, upstream, check_only)
        if result:
            print(result)
            if result.startswith(("DRIFT", "MISSING")):
                problems += 1
    if check_only:
        manifest_path = mirror_root / MANIFEST_NAME
        actual = manifest_path.read_text(encoding="utf-8") if manifest_path.is_file() else ""
        if actual != expected_manifest:
            print(f"DRIFT   {MANIFEST_NAME} does not match the sync table", file=sys.stderr)
            problems += 1
        if problems:
            print(f"{problems} mirror file(s) out of sync — run scripts/sync-vue-mirror.py",
                  file=sys.stderr)
            return 1
        print("vue-mirror stylesheets are in sync")
        return 0
    print("vue-mirror stylesheets are in sync")
    return 0


if __name__ == "__main__":
    sys.exit(main())
