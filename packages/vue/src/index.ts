export { default as HActionBar } from "./components/HkActionBar";
export { default as HAdaptiveDialog } from "./components/HkAdaptiveDialog";
export { default as HAlert } from "./components/HkAlert";
export { default as HAltSignIn } from "./components/HkAltSignIn";
export { default as HAvatar } from "./components/HkAvatar";
export { default as HBadge } from "./components/HkBadge";
export { default as HBoard } from "./components/HkBoard";
export { default as HBlockingToast } from "./components/HkBlockingToast";
export { default as HBreadcrumb } from "./components/HkBreadcrumb";
export { default as HButton } from "./components/HkButton";
export { default as HCard } from "./components/HkCard";
export { default as HCheckbox } from "./components/HkCheckbox";
// HCollapse was removed (v0.5.0): its tree-node-grade styling and
// broken max-height animation never met the MD3 bar. Use HExpansionPanel.
export { default as HColorPicker } from "./components/HkColorPicker";
export { HColorSchemeDialog, type HCustomTheme } from "./components/HkColorSchemeDialog";
export { HkColorSchemeEditor } from "./components/HkColorSchemeEditor";
export { default as HConfirmDialog } from "./components/HkConfirmDialog";
export { default as HCrossfade } from "./components/HkCrossfade";
export { default as HDivider } from "./components/HkDivider";
export {
  default as HDockBar,
  type HkDockBarAnchor as HDockBarAnchor,
  type HkDockBarSurface as HDockBarSurface,
} from "./components/HkDockBar";
export { default as HDrawer } from "./components/HkDrawer";
export { default as HEmptyState } from "./components/HkEmptyState";
export { default as HExpansionPanel } from "./components/HkExpansionPanel";
export { default as HFab, type HFabAction } from "./components/HkFab";
export { default as HIcon } from "./components/HkIcon";
export { default as HIconButton } from "./components/HkIconButton";
export { default as HIconButtonGroup, type HkIconButtonGroupOption } from "./components/HkIconButtonGroup";
export { default as HImageLightbox } from "./components/HkImageLightbox";
export { default as HImagePreview, type ImagePreviewObjectFit } from "./components/HkImagePreview";
export { default as HInput } from "./components/HkInput";
export { default as HPlaceholderMarquee, type PlaceholderVariant } from "./components/HkPlaceholderMarquee";
export { default as HKbd } from "./components/HkKbd";
export { default as HLabel } from "./components/HkLabel";
export { default as HListTransition } from "./components/HkListTransition";
export { default as HLoadMore } from "./components/HkLoadMore";
export { default as HMarkdownRenderer } from "./components/HkMarkdownRenderer";
export { default as HModal } from "./components/HkModal";
export { default as HNavItem } from "./components/HkNavItem";
export { default as HNumberInput } from "./components/HkNumberInput";
export { default as HPhoneInput } from "./components/HkPhoneInput";
export { HkOtpInput as HOtpInput } from "./components/HkOtpInput";
export { default as HAffixPicker, type HkAffixOption } from "./components/HkAffixPicker";
export { default as HPhaseTransition } from "./components/HkPhaseTransition";
export { default as HGaugeRing } from "./components/HkGaugeRing";
export { default as HProgressRing } from "./components/HkProgressRing";
export { default as HQrCode } from "./components/HkQrCode";
export { default as HRollingNumber } from "./components/HkRollingNumber";
export { default as HLocalePickerPopup } from "./components/HkLocalePickerPopup";
export { default as HHoverRevealAction } from "./components/HkHoverRevealAction";
export { default as HKeywordSearchModal } from "./components/HkKeywordSearchModal";
export { default as HModalBreadcrumb } from "./components/HkModalBreadcrumb";
export { default as HPopover, type PopupPlacement } from "./components/HkPopover";
export { default as HMenu, type HkMenuItem } from "./components/HkMenu";
export { default as HContextMenuProvider } from "./components/HkContextMenuProvider";
export {
  useContextMenu,
  useContextMenuTrigger,
  bindContextMenu,
  CONTEXT_MENU_KEY,
  CONTEXT_HOLD_MS,
  CONTEXT_HOLD_SLOP,
  type ContextMenuApi,
  type ContextMenuRequest,
  type ContextTriggerPoint,
} from "./composables/useContextMenu";
export { default as HMessageBox, HkMessageBox, type HkMessageBoxOptions, type HkMessageBoxPrompt } from "./components/HkMessageBox";
export { HkLocalizedInput as HLocalizedInput, type HkLocaleOption } from "./components/HkLocalizedInput";
export { default as HMenuPanel } from "./components/HkMenuPanel";
export { default as HMenuActionItem } from "./components/HkMenuActionItem";
export { default as HMenuIdentityItem } from "./components/HkMenuIdentityItem";
export { default as HPopupSelect, isAnyPopupOpen, closeAllPopups, type HkPopupSelectOption } from "./components/HkPopupSelect";
export { default as HProgressBar } from "./components/HkProgressBar";
export { default as HProgressDialog } from "./components/HkProgressDialog";
export { default as HRadio } from "./components/HkRadio";
export { default as HScrollContainer } from "./components/HkScrollContainer";
export { default as HSearchInput } from "./components/HkSearchInput";
export { default as HSplash } from "./components/HkSplash";
export { default as HkLoadingVeil } from "./components/HkLoadingVeil";
export { default as HSelect } from "./components/HkSelect";
export { default as HSelectPanel, type SelectPanelPlacement } from "./components/HkSelectPanel";
export { default as HSidebar } from "./components/HkSidebar";
export { default as HSkeleton } from "./components/HkSkeleton";
export { default as HSkeletonList } from "./components/HkSkeletonList";
export { default as HSlider } from "./components/HkSlider";
export { default as HSpinner } from "./components/HkSpinner";
export { default as HSwitch } from "./components/HkSwitch";
export { default as HTable } from "./components/HkTable";
export { default as HTabs } from "./components/HkTabs";
export { default as HTag } from "./components/HkTag";
export { HkTagInput as HTagInput, type HkTagOption } from "./components/HkTagInput";
export { default as HTextarea } from "./components/HkTextarea";
export { default as HFileField } from "./components/HkFileField";
export { default as HFileBrowserDialog } from "./components/HkFileBrowserDialog";
export { default as HFilePickerField } from "./components/HkFilePickerField";
export {
  type RemoteFileEntry,
  type RemoteDirListing,
  type RemoteFsAdapter,
  type FileQuickLink,
  type PickedFile,
  type FilePickerBackend,
  type FilePickerHook,
  acceptExtensions,
} from "./components/filePicker";
export { default as HToast } from "./components/HkToast";
export { default as HTooltip } from "./components/HkTooltip";
export { default as HTree } from "./components/HkTree";
export { default as HWindowedItem } from "./components/HkWindowedItem";
export { default as HWaterfall } from "./components/HkWaterfall";
export { default as HBlankCanvas } from "./components/HkBlankCanvas";
export type { BlankCanvasSize } from "./components/HkBlankCanvas";
export { default as HKanban } from "./components/HkKanban";
export type {
  KanbanAxis,
  KanbanCardSlotProps,
  KanbanHeaderSlotProps,
  KanbanMove,
} from "./components/HkKanban";
export { default as HNodeCanvas, NODE_CANVAS_DEFAULTS } from "./components/HkNodeCanvas";
export type {
  NodeCanvasCamera,
  NodeCanvasBounds,
  NodeCanvasSlotProps,
  MinimapPlacement,
  NodeCanvasEdge,
  EdgeRouting,
  EdgeSide,
  EdgeSubpath,
  EdgePointerEvent,
} from "./components/HkNodeCanvas";
export type {
  WaterfallBucket,
  WaterfallCardSlotProps,
  WaterfallHeaderSlotProps,
  WaterfallRailSlotProps,
} from "./components/HkWaterfall";
export { default as HDateTimePicker } from "./components/HkDateTimePicker";
export { default as HDatePicker } from "./components/HkDatePicker";
export { default as HTimeline } from "./components/HkTimeline";
export { default as HTitleBar } from "./components/HkTitleBar";
export { default as HStepFlow } from "./components/HkStepFlow";
export type { StepFlowSlotProps } from "./components/HkStepFlow";
export { default as HScrollPin, SCROLL_HOST_CLASS } from "./components/HkScrollPin";
export type { ScrollPinSide, ScrollPinStrategy } from "./components/HkScrollPin";

// Media player kit
export { default as HMediaPlayer, MEDIA_RATES } from "./components/HkMediaPlayer";
export { default as HMediaControlBar, formatMediaTime } from "./components/HkMediaControlBar";
export { default as HMediaSlider } from "./components/HkMediaSlider";
export { default as HMediaVisualizer } from "./components/HkMediaVisualizer";

// Image viewer kit
export { default as HImageViewer } from "./components/HkImageViewer";
export { default as HZoomToolbar } from "./components/HkZoomToolbar";
export { default as HMinimap } from "./components/HkMinimap";

// Charts
export { default as HTrendChart } from "./components/HkTrendChart";

export { default as HErrorBoundary } from "./components/HkErrorBoundary";
export {
  HkErrorLanding as HErrorLanding,
  type HErrorTone,
  type HErrorLandingVariant,
} from "./components/HkErrorLanding";
export { HkErrorReportingOverlay as HErrorReportingOverlay } from "./errorReporting";
export {
  createErrorReporting,
  reportGlobalError,
  clearGlobalError,
  type HkErrorReportingOptions,
  type HkErrorSource,
  type HkReportedError,
} from "./errorReporting";
export { default as HDraggableList } from "./components/HkDraggableList";
export { default as HDraggableGrid } from "./components/HkDraggableGrid";
export { default as HSelectionGrid } from "./components/HkSelectionGrid";
export { default as HSelectionWaterfall } from "./components/HkSelectionWaterfall";

export { default as HLogo } from "./components/HkLogo";

// Component types
export { type BadgeVariant } from "./components/HkBadge";
export { type BoardNodeInput, type BoardEdgeInput } from "./components/HkBoard";
export { type BoardAnchorMode, type BoardEdgeStyle, type BoardPoint } from "./utils/boardEdges";
export { type BoardCamera, type BoardRect, type BoardViewport } from "./utils/boardCamera";
export { type ModalAction } from "./components/HkModal";
export {
  type ModalWidth,
  type ModalWidthPreset,
  resolveModalWidth,
} from "./components/HkModal";
export { type TreeNode, type TreeSize, type TreeRowScope } from "./components/HkTree";
export { type DragListItem } from "./components/HkDraggableList";
export { type GridItem } from "./components/HkDraggableGrid";
export { type MinimapBox, type MinimapRect } from "./components/HkMinimap";
export { type TrendPen, type TrendPoint, type AlarmThresholds } from "./components/HkTrendChart";

// ── Theme decor (theme-provided decorative widgets, host-placed) ──────────
export { default as HkThemeDecor, type HkThemeDecorSize } from "./components/HkThemeDecor";
export { default as HkStatusTray, type HkStatusTraySize } from "./components/HkStatusTray";

// Theme system
export {
  initTheme, useTheme, themePresets, tokensToCSSVars, getThemeTokens,
  loadCustomThemes, saveCustomThemes, addCustomTheme, removeCustomTheme,
  registerTokenGroup, getTokenGroups, resolveGroupTokens, clampToSlot,
  clampRgbToBands, clampHue, hueDelta, wrapHue, groupTokensToCSSVars, rgbToHsl, hslToRgb,
  tokenGroupsVersion, tokenGroupSlotKind, tokenGroupSlotCssVar,
  isColorSlot, isNumberSlot, isEnumSlot,
  registerStandardThemeGroups, STANDARD_SHAPE_GROUP_ID,
  registerStandardThemeDecor, STANDARD_THEME_DECOR_SLOTS,
  registerThemeDecor, registerThemeDecorBuiltin, getThemeDecor, themeDecorSlots,
  themeDecorVersion, isThemeDecorSlot, THEME_DECOR_SLOT_PATTERN, THEME_DECOR_WILDCARD,
  allGroupSlots, resolveLocalizedText, parseTokenGroupConfig, registerTokenGroupConfig,
  startLuminanceSampler, stopLuminanceSampler, sampleLuminanceNow, invalidateLuminanceCache,
  registerWallpaperSurfaceSources, resolveWallpaperSurfaceElement,
  retainLuminanceSampler, releaseLuminanceSampler, luminanceSamplerRefCount,
  type WallpaperSurfaceKind, type WallpaperSurfaceSources,
  getTimePeriod, getGeolocation, solarAltitude, DEFAULT_GEO_LOCATION,
  timezoneFallback, setGeolocationProvider, refreshThemeClock, stopThemeClock,
  initFontContext, applyFontContext, resetFontContext, useFontContext,
  HIKARI_FONT_SANS, HIKARI_FONT_MONO, HIKARI_FONT_READING,
  type ThemeTokenRGB, type ThemeSchemeTokens, type ThemePreset, type ThemeMode,
  type ThemeId, type ThemeTokens, type CustomThemePreset, type TimePeriod,
  type GeoLocation, type GeoLocationProvider,
  type ThemeTokenGroupValues, type ThemeTokenGroupModes, type ThemeTokenValue,
  type TokenGroupDefinition, type TokenGroupSlot, type TokenGroupSection, type HueClamp,
  type TokenGroupSlotKind, type TokenColorSlot, type TokenNumberSlot, type TokenEnumSlot,
  type ResolvedGroupTokens, type ColorHSL,
  type LocalizedText, type ParseTokenGroupResult,
  type ThemeDecorSlot, type ThemeDecorRegistration, type ThemeDecorBuiltinRegistration,
  type FontContextOverrides,
} from "./theme";

// Wallpaper logic layer (ported from shittim-chest). The pack, the brand map
// and the pipeline registry arrive as host registrations.
export {
  FALLBACK_WALLPAPER_ID, DEFAULT_WALLPAPER_ID, DEFAULT_PRESETS, DEFAULT_DISPLAY_SETTINGS,
  DEFAULT_WALLPAPER_STORAGE_PREFIX, registerWallpaperPack, configureWallpaperStorage,
  wallpaperStorageKey, isWallpaperSource, isTimeAware,
  loadActiveWallpaperId, hasStoredWallpaperId, saveActiveWallpaperId,
  loadCustomWallpapers, saveCustomWallpapers, addCustomWallpaper, removeCustomWallpaper,
  updateCustomWallpaper, loadCachedGeolocation, saveCachedGeolocation,
  loadDisplaySettings, saveDisplaySettings, getDisplaySettings, setDisplaySettings,
  buildWallpaperFilter, initWallpaper, destroyWallpaper, useWallpaper, ensureWallpaperState,
  configureWallpaper, registerWallpaperBrandDefaults, registerServerThemeWallpaper,
  brandDefaultWallpaperFor, resolveThemeFollowSwitch, setWallpaperPipelineLookup,
  geo, currentPeriod,
  hasStorage, readStorageItem, writeStorageItem, removeStorageItem,
  type WallpaperType, type SolidSource, type ImageSource, type VideoSource,
  type PipelineSource, type WallpaperSource, type TimeAwareWallpaper, type WallpaperPreset,
  type WallpaperPackEntry, type CustomWallpaper, type WallpaperPosition, type WallpaperScale,
  type WallpaperEffect, type WallpaperDisplaySettings, type WallpaperStorageSlot,
  type WallpaperStorageConfig, type WallpaperInitConfig, type WallpaperPipelineLookup,
  type WallpaperPipelinePreset,
} from "./theme";

// Wallpaper shader layer: the shared WebGL2 pipeline renderer + the host
// preset registry. hikari ships the mechanism, never the GLSL — hosts
// register their generated fragments through registerShaderPresets and
// hand createWallpaperShaderSurface to HkWallpaperBackdrop's props bag.
export {
  registerShaderPresets, getShaderPreset, listShaderPresetIds,
  SHADER_VERTEX, WallpaperShaderPipeline, createWallpaperShaderSurface,
  type WallpaperShaderPreset, type WallpaperShaderPresetInput,
  type WallpaperShaderScaleConfig, type WallpaperShaderScaleInput,
  type WallpaperShaderOverlayConfig,
} from "./theme";

// The wallpaper stack's SURFACE component. hikari does NOT put it on the
// `backdrop` decor floor (that floor has no unregister — a library-owned
// page-covering layer would be a decision the host cannot take back). The
// host registers it, and passes its pipeline driver (if it has one) through
// the registration's props bag:
//   registerThemeDecor({
//     themeId: "*", slot: "backdrop", component: HkWallpaperBackdrop,
//     props: { createSurface: mySurfaceFactory },
//   })
export {
  default as HkWallpaperBackdrop,
  WALLPAPER_REDUCED_MOTION_QUERY,
  type HkWallpaperBackdropMode,
  type HkWallpaperSurface,
  type HkWallpaperSurfaceContext,
  type HkWallpaperSurfaceFactory,
} from "./components/HkWallpaperBackdrop";

// Runtime systems
export {
  onFrame,
  onceFrame,
  scheduleFrame,
  scheduleEvery,
  scheduleAfter,
  scheduleCron,
  scheduleCronAfter,
  scheduleInterval,
  scheduleIntervalAfter,
  reportTransition,
  setReducedMotion,
  notifyScrollStart,
  useOverlay,
  usePopupManager,
  POPUP_Z_BANDS,
  POPUP_Z_STEP,
  useToast,
  useConfirm,
  useBlockingToast,
  showBlockingToast,
  resolveBlockingToast,
  clearBlockingToasts,
  type BlockingToastItem,
  type BlockingToastOptions,
  type BlockingToastVariant,
  useBreakpoint,
  useClipboard,
  useClipboardWithToast,
  useMediaQuery,
  releaseMediaQuery,
  usePageLifecycle,
  onPageLifecycle,
  pageLifecycleState,
  useSafeArea,
  applyViewportPolicy,
  parseViewportContent,
  type ApplyViewportPolicyOptions,
  type ViewportPolicyResult,
  closeAll,
  isOverlayOpen,
  TOAST_DURATION,
  createBackGuard,
  BACK_GUARD_MARKER,
  BACK_GUARD_DEPTH,
  type AnimationHandle,
  useReportedTransition,
  type ReportedTransition,
  type ReportedTransitionTrack,
  type CronHandle,
  type IntervalHandle,
  type FrameContext,
  type OverlayHandle,
  type PopupHandle,
  type PopupKind,
  type ToastItem,
  type ToastMessage,
  type ToastType,
  type PageLifecycleState,
  type PageLifecycleListener,
  type SafeAreaInsets,
  type BackGuard,
  type BackGuardOptions,
  installHkTooltipBridge,
  type HkTooltipBridgeOptions,
  installHkImageFallback,
  type HkImageFallbackOptions,
  reportHkRuntime,
  getHkRuntimeEntry,
  listHkRuntime,
  readHkRuntime,
  writeHkRuntime,
  hkRuntimeSnapshot,
  useHkRegistry,
  type HkRuntimeKind,
  type HkRuntimeStatus,
  type HkRuntimeMeta,
  type HkRuntimeEntryState,
  type HkRuntimeReport,
  type HkRuntimeHandle,
  type HkRuntimeWriteOp,
  type HkRuntimeSnapshot,
  type HkRuntimeSnapshotEntry,
} from "./runtime";

// i18n
export {
  useI18n,
  setLocale,
  activeLocale,
  mergeMessages,
} from "./i18n/context";

// ── Generic utils ───────────────────────────────────────────────
export { fuzzyScore, fuzzyScoreFields, fuzzySearch } from "./utils/fuzzy";
export type { FuzzyMatch } from "./utils/fuzzy";
export { validatePassword, passwordLevel } from "./utils/password";
export type { PasswordValidationResult, PasswordLevel, PasswordStrengthEvaluator } from "./utils/password";
export { FOCUSABLE_SELECTOR, getFocusableElements, focusFirst, trapFocus, scrollToElement } from "./utils/dom";
export { useApproachEnd } from "./composables/useApproachEnd";
export type { ApproachEndOptions, ApproachEndHandle } from "./composables/useApproachEnd";
export { useDeferredTransition } from "./composables/useDeferredTransition";
export { useSurfaceTransition } from "./composables/useSurfaceTransition";
export type {
  SurfaceTransition,
  SurfaceTransitionHooks,
} from "./composables/useSurfaceTransition";
export { useSizeMorph } from "./composables/useSizeMorph";
export type { SizeMorph } from "./composables/useSizeMorph";
export { useImage } from "./composables/useImage";
export type { ImageStatus, UseImageReturn } from "./composables/useImage";

export { useZoomPan } from "./composables/useZoomPan";
export type { ZoomPanOptions, ZoomPanState } from "./composables/useZoomPan";
export { extOf, isImageFile, isAudioFile, codeLanguage, isCodeFile, isArchiveFile, isTextFile, fileIcon, mediaKindOf } from "./utils/fileType";

export { useReducedMotion } from "./composables/useReducedMotion";
export {
  drawnScale,
  frameMetrics,
  frameScale,
  laidOffsetWithin,
  laidSize,
  layoutOffset,
  layoutRect,
  nearestLaidAncestor,
  placePoint,
} from "./composables/layoutGeometry";
export type {
  FrameMetrics,
  LayoutOffset,
  LayoutRect,
} from "./composables/layoutGeometry";
export { useMeasuredHighlight } from "./composables/useMeasuredHighlight";
export type { UseMeasuredHighlightOptions, MeasuredHighlight } from "./composables/useMeasuredHighlight";
export {
  registerCssAnimation,
  listCssAnimations,
  setCssAnimationsEnabled,
  isCssAnimationsEnabled,
} from "./animation/registerAnimations";
export type { CssAnimationOptions, RegisteredCssAnimation } from "./animation/registerAnimations";
export { probeOrigin, probeOriginWithBody } from "./utils/connectivity";
export type { OriginProbe } from "./utils/connectivity";
export { probeHealthEndpoint } from "./utils/healthProbe";
export type { HealthProbeBody, HealthProbeResult } from "./utils/healthProbe";

export { highlight, useHighlight } from "./composables/useHighlight";
export { LANGUAGE_LOADERS } from "./composables/highlightLanguages";
export {
  iconByName,
  registerFunctionalIconPack,
  functionalIconSvg,
  sanitizeSvg,
} from "./composables/iconRegistry";
export { useMessaging, registerTransport, registerNativeBridge } from "./composables/messaging";
export type { MessagePayload, MessageSeverity, MessageTransport, NotifyOptions, TransportName } from "./composables/messaging";

export { useResourceListModal } from "./composables/useResourceListModal";

export { downloadBlob, downloadTextAsFile } from "./utils/download";
export { bytesToBase64, utf8ToBase64, base64ToBytes, blobToBase64 } from "./utils/base64";

export { THEME_MODE_STORAGE_KEY } from "./theme/useTheme";
export { HK_AUTH_CARD_MAX_WIDTH, HK_AUTH_CARD_MAX_WIDTH_VAR } from "./theme/authCard";

export { isTauri } from "./runtime/env";

export { deepMerge, isPlainObject, getPath, setPath, delPath } from "./utils/objectPath";

// ── Admin panel pieces (ported from plana-ui) ────────────────────────────
export { HkAdminShell as HAdminShell } from "./components/HkAdminShell";
export { HkAdminHeader as HAdminHeader } from "./components/HkAdminHeader";
export { HkNavSidebar as HNavSidebar } from "./components/HkNavSidebar";
export { HkThemeToggle as HThemeToggle, type ThemeItemScope } from "./components/HkThemeToggle";
export { HkAuthCard as HAuthCard } from "./components/HkAuthCard";
export { default as HAuthMethodList } from "./components/HkAuthMethodList";
export { HkSignInCard as HSignInCard } from "./components/HkSignInCard";
export { default as HAuthSubmitButton } from "./components/HkAuthSubmitButton";
export {
  HkMfaVerifyCard as HMfaVerifyCard,
  hkIsMfaFactor as isMfaFactor,
  hkPreferredMfaFactor as preferredMfaFactor,
  type HkMfaFactor as MfaFactor,
} from "./components/HkMfaVerifyCard";
export { usePageTitle, useRouteTitle } from "./composables/usePageTitle";
export { provideActionBar, useActionBar } from "./composables/useActionBar";
export type { ActionBarRenderer } from "./composables/useActionBar";
export { setProbeEndpoint, useConnectionProbe } from "./composables/useConnectionProbe";
export type { ProbeResult } from "./composables/useConnectionProbe";
export { useEngineHealth } from "./composables/useEngineHealth";
export type { EngineHealth, EngineNetworkInfo } from "./composables/useEngineHealth";
export { leadingZeroBits, sha256, solvePow, solvePowSync, verifyPow } from "./utils/pow";
export type { PowChallenge, PowSolution } from "./utils/pow";
export { HkLocalePicker as HLocalePicker } from "./components/HkLocalePicker";
export { fetchChallenge, negotiateNonce } from "./utils/powNonce";
export type { ChallengeDescriptor } from "./utils/powNonce";
export { HkAdminTablePage as HAdminTablePage } from "./components/HkAdminTablePage";
export type { HTableColumn } from "./components/HkAdminTablePage";
export { HkPageHeader as HPageHeader } from "./components/HkPageHeader";
export { HkStatCard as HStatCard, type StatTone } from "./components/HkStatCard";
export { HkStatusPill as HStatusPill, type PillState } from "./components/HkStatusPill";
export { HkShareBar as HShareBar } from "./components/HkShareBar";
export { HkSecretRevealModal as HSecretRevealModal } from "./components/HkSecretRevealModal";
export { HkCaptchaWidget as HCaptchaWidget, type HkCaptchaProvider } from "./components/HkCaptchaWidget";
export { HkCaptchaModal as HCaptchaModal } from "./components/HkCaptchaModal";
export { HkProtocolModal as HProtocolModal } from "./components/HkProtocolModal";
export {
  HkAboutModal as HAboutModal,
  type HAboutComponentVersion,
  type HAboutCredit,
  type HAboutLink,
  type HAboutLinkFace,
  type HAboutLinkIcon,
} from "./components/HkAboutModal";
export { HkLogWindow as HLogWindow, type HLogTab } from "./components/HkLogWindow";
export {
  HkSettingsBody as HSettingsBody,
  HkSettingsDialog as HSettingsDialog,
  HkSettingsGroup as HSettingsGroup,
  HkSettingsSub as HSettingsSub,
  HkSettingsHint as HSettingsHint,
  type HkSettingsSection,
} from "./components/HkSettingsDialog";

export { HkCookieConsent as HCookieConsent } from "./components/HkCookieConsent";
export {
  HkAttachmentModal as HAttachmentModal,
  previewKindFor,
  type HAttachmentDetail,
  type HAttachmentItem,
  type HAttachmentPreviewType,
} from "./components/HkAttachmentModal";
export { HkStatusBar as HStatusBar } from "./components/HkStatusBar";
export { useConnectionInfo } from "./components/HkConnectionInfo";
export type { ConnectionStateInput, HkConnectionInfo } from "./components/HkConnectionInfo";
export { HkCountdownDigit as HCountdownDigit } from "./components/HkCountdownDigit";
export {
  HkConnectionStatus as HConnectionStatus,
  HK_CONNECTION_PROBE,
  type HkBackendStatus,
  type HkConnectionProbeSource,
} from "./components/HkConnectionStatus";

// ── Chat kit (upstreamed from shittim-chest's plana-legacy layer) ──────────
export { HkRichInput as HRichInput } from "./components/HkRichInput";
export { HkVoiceInputPopup as HVoiceInputPopup } from "./components/HkVoiceInputPopup";
export {
  HkToolBlock as HToolBlock,
  parseToolCallText,
  extractExecCode,
  buildHighlightedLines,
  type HParsedToolCall,
  type HToolBlockVariant,
  type HHighlightedLine,
} from "./components/HkToolBlock";
export {
  HkJsonTree as HJsonTree,
  buildJsonTree,
  type HJsonNode,
} from "./components/HkJsonTree";
export { HkTokenUsageBadge as HTokenUsageBadge } from "./components/HkTokenUsageBadge";
export { HkTokenUsagePanel as HTokenUsagePanel } from "./components/HkTokenUsagePanel";
export { HkModelTag as HModelTag } from "./components/HkModelTag";
export { HkContextRing as HContextRing, HkContextRing, type HkContextSegment } from "./components/HkContextRing";
export {
  getModelMeta,
  registerModelCatalog,
  splitModelId,
  type HModelPricing,
  type HModelMeta,
  type HModelCatalog,
} from "./components/HkModelCatalog";
export type {
  HChatRole,
  HToolCall,
  HToolCallStatus,
  HVoicePopupMode,
  HVoiceState,
  HModelUsageEntry,
  HModelCosts,
} from "./components/HkChatTypes";
// Canonical Hk* names for the directly-exported types above (2026-09-24
// unification follow-up, second batch — caught by the third-scan reverse
// validation). These types are defined with their H* names at the source.
export type {
  HChatRole as HkChatRole,
  HToolCall as HkToolCall,
  HToolCallStatus as HkToolCallStatus,
  HVoicePopupMode as HkVoicePopupMode,
  HVoiceState as HkVoiceState,
  HModelUsageEntry as HkModelUsageEntry,
  HModelCosts as HkModelCosts,
} from "./components/HkChatTypes";
export { useSendShortcut } from "./composables/useSendShortcut";
export type { SendShortcutMode } from "./composables/useSendShortcut";
export { useAttachments } from "./composables/useAttachments";
export type { HkUploadedFile } from "./composables/useAttachments";

export {
  formatTokenCount,
  formatNumber,
  formatBytes,
  formatPriceUsd,
  formatRelativeTime,
  formatDateTime,
  formatDate,
  formatTime,
  formatMs,
  type RelativeTimeT,
} from "./utils/format";

export {
  DIAL_CODES,
  flagEmoji,
  dialCodeName,
  formatE164,
  parseE164,
  normalizeDial,
  normalizeNational,
  type DialCodeEntry,
  type ParsedE164,
} from "./data/dialCodes";

// ── Canonical Hk* names (2026-09-24 unification) ─────────────────────
// Every public name now exists in both spellings: the historical H*
// aliases above (deprecated — migrate to the Hk* forms) and the Hk*
// canonical names below, which match the source file names. Consumers
// migrate at their own pace; the H* aliases are removed only after the
// last consumer stops using them. Components export under the name of
// their source file; named exports whose source identifier was already
// Hk-prefixed now export that identifier unaliased.

export { default as HkActionBar } from "./components/HkActionBar";
export { default as HkAdaptiveDialog } from "./components/HkAdaptiveDialog";
export { default as HkAlert } from "./components/HkAlert";
export { default as HkAltSignIn } from "./components/HkAltSignIn";
export { default as HkAvatar } from "./components/HkAvatar";
export { default as HkBadge } from "./components/HkBadge";
export { default as HkBoard } from "./components/HkBoard";
export { default as HkBlockingToast } from "./components/HkBlockingToast";
export { default as HkBreadcrumb } from "./components/HkBreadcrumb";
export { default as HkButton } from "./components/HkButton";
export { default as HkCard } from "./components/HkCard";
export { default as HkCheckbox } from "./components/HkCheckbox";
export { default as HkColorPicker } from "./components/HkColorPicker";
export { default as HkConfirmDialog } from "./components/HkConfirmDialog";
export { default as HkCrossfade } from "./components/HkCrossfade";
export { default as HkDivider } from "./components/HkDivider";
export { default as HkDockBar } from "./components/HkDockBar";
export { default as HkDrawer } from "./components/HkDrawer";
export { default as HkEmptyState } from "./components/HkEmptyState";
export { default as HkExpansionPanel } from "./components/HkExpansionPanel";
export { default as HkFab } from "./components/HkFab";
export { default as HkIcon } from "./components/HkIcon";
export { default as HkIconButton } from "./components/HkIconButton";
export { default as HkIconButtonGroup } from "./components/HkIconButtonGroup";
export { default as HkImageLightbox } from "./components/HkImageLightbox";
export { default as HkImagePreview } from "./components/HkImagePreview";
export { default as HkInput } from "./components/HkInput";
export { default as HkPlaceholderMarquee } from "./components/HkPlaceholderMarquee";
export { default as HkKbd } from "./components/HkKbd";
export { default as HkLabel } from "./components/HkLabel";
export { default as HkListTransition } from "./components/HkListTransition";
export { default as HkLoadMore } from "./components/HkLoadMore";
export { default as HkMarkdownRenderer } from "./components/HkMarkdownRenderer";
export { default as HkModal } from "./components/HkModal";
export { default as HkNavItem } from "./components/HkNavItem";
export { default as HkNumberInput } from "./components/HkNumberInput";
export { default as HkPhoneInput } from "./components/HkPhoneInput";
export { default as HkAffixPicker } from "./components/HkAffixPicker";
export { default as HkPhaseTransition } from "./components/HkPhaseTransition";
export { default as HkGaugeRing } from "./components/HkGaugeRing";
export { default as HkProgressRing } from "./components/HkProgressRing";
export { default as HkQrCode } from "./components/HkQrCode";
export { default as HkRollingNumber } from "./components/HkRollingNumber";
export { default as HkLocalePickerPopup } from "./components/HkLocalePickerPopup";
export { default as HkHoverRevealAction } from "./components/HkHoverRevealAction";
export { default as HkKeywordSearchModal } from "./components/HkKeywordSearchModal";
export { default as HkModalBreadcrumb } from "./components/HkModalBreadcrumb";
export { default as HkPopover } from "./components/HkPopover";
export { default as HkMenu } from "./components/HkMenu";
export { default as HkContextMenuProvider } from "./components/HkContextMenuProvider";
export { default as HkMenuPanel } from "./components/HkMenuPanel";
export { default as HkMenuActionItem } from "./components/HkMenuActionItem";
export { default as HkMenuIdentityItem } from "./components/HkMenuIdentityItem";
export { default as HkPopupSelect } from "./components/HkPopupSelect";
export { default as HkProgressBar } from "./components/HkProgressBar";
export { default as HkProgressDialog } from "./components/HkProgressDialog";
export { default as HkRadio } from "./components/HkRadio";
export { default as HkScrollContainer } from "./components/HkScrollContainer";
export { default as HkSearchInput } from "./components/HkSearchInput";
export { default as HkSplash } from "./components/HkSplash";
export { default as HkSelect } from "./components/HkSelect";
export { default as HkSelectPanel } from "./components/HkSelectPanel";
export { default as HkSidebar } from "./components/HkSidebar";
export { default as HkSkeleton } from "./components/HkSkeleton";
export { default as HkSkeletonList } from "./components/HkSkeletonList";
export { default as HkSlider } from "./components/HkSlider";
export { default as HkSpinner } from "./components/HkSpinner";
export { default as HkSwitch } from "./components/HkSwitch";
export { default as HkTable } from "./components/HkTable";
export { default as HkTabs } from "./components/HkTabs";
export { default as HkTag } from "./components/HkTag";
export { default as HkTextarea } from "./components/HkTextarea";
export { default as HkFileField } from "./components/HkFileField";
export { default as HkFileBrowserDialog } from "./components/HkFileBrowserDialog";
export { default as HkFilePickerField } from "./components/HkFilePickerField";
export { default as HkToast } from "./components/HkToast";
export { default as HkTooltip } from "./components/HkTooltip";
export { default as HkTree } from "./components/HkTree";
export { default as HkWindowedItem } from "./components/HkWindowedItem";
export { default as HkWaterfall } from "./components/HkWaterfall";
export { default as HkBlankCanvas } from "./components/HkBlankCanvas";
export { default as HkKanban } from "./components/HkKanban";
export { default as HkNodeCanvas } from "./components/HkNodeCanvas";
export { default as HkDateTimePicker } from "./components/HkDateTimePicker";
export { default as HkDatePicker } from "./components/HkDatePicker";
export { default as HkTimeline } from "./components/HkTimeline";
export { default as HkTitleBar } from "./components/HkTitleBar";
export { default as HkStepFlow } from "./components/HkStepFlow";
export { default as HkScrollPin } from "./components/HkScrollPin";
export { default as HkMediaPlayer } from "./components/HkMediaPlayer";
export { default as HkMediaControlBar } from "./components/HkMediaControlBar";
export { default as HkMediaSlider } from "./components/HkMediaSlider";
export { default as HkMediaVisualizer } from "./components/HkMediaVisualizer";
export { default as HkImageViewer } from "./components/HkImageViewer";
export { default as HkZoomToolbar } from "./components/HkZoomToolbar";
export { default as HkMinimap } from "./components/HkMinimap";
export { default as HkTrendChart } from "./components/HkTrendChart";
export { default as HkErrorBoundary } from "./components/HkErrorBoundary";
export { default as HkDraggableList } from "./components/HkDraggableList";
export { default as HkDraggableGrid } from "./components/HkDraggableGrid";
export { default as HkSelectionGrid } from "./components/HkSelectionGrid";
export { default as HkSelectionWaterfall } from "./components/HkSelectionWaterfall";
export { default as HkLogo } from "./components/HkLogo";
export { default as HkAuthMethodList } from "./components/HkAuthMethodList";
export { default as HkAuthSubmitButton } from "./components/HkAuthSubmitButton";
export { type HkDockBarAnchor as HkDockBarAnchor } from "./components/HkDockBar";
export { type HkDockBarSurface as HkDockBarSurface } from "./components/HkDockBar";
export { HkOtpInput as HkOtpInput } from "./components/HkOtpInput";
export { HkLocalizedInput as HkLocalizedInput } from "./components/HkLocalizedInput";
export { HkTagInput as HkTagInput } from "./components/HkTagInput";
export { HkErrorLanding as HkErrorLanding } from "./components/HkErrorLanding";
export { HkErrorReportingOverlay as HkErrorReportingOverlay } from "./errorReporting";
export { HkAdminShell as HkAdminShell } from "./components/HkAdminShell";
export { HkAdminHeader as HkAdminHeader } from "./components/HkAdminHeader";
export { HkNavSidebar as HkNavSidebar } from "./components/HkNavSidebar";
export { HkThemeToggle as HkThemeToggle } from "./components/HkThemeToggle";
export { HkAuthCard as HkAuthCard } from "./components/HkAuthCard";
export { HkSignInCard as HkSignInCard } from "./components/HkSignInCard";
export { HkMfaVerifyCard as HkMfaVerifyCard } from "./components/HkMfaVerifyCard";
export { type HkMfaFactor as HkMfaFactor } from "./components/HkMfaVerifyCard";
export { HkLocalePicker as HkLocalePicker } from "./components/HkLocalePicker";
export { HkAdminTablePage as HkAdminTablePage } from "./components/HkAdminTablePage";
export { HkPageHeader as HkPageHeader } from "./components/HkPageHeader";
export { HkStatCard as HkStatCard } from "./components/HkStatCard";
export { HkStatusPill as HkStatusPill } from "./components/HkStatusPill";
export { HkShareBar as HkShareBar } from "./components/HkShareBar";
export { HkSecretRevealModal as HkSecretRevealModal } from "./components/HkSecretRevealModal";
export { HkCaptchaWidget as HkCaptchaWidget } from "./components/HkCaptchaWidget";
export { HkCaptchaModal as HkCaptchaModal } from "./components/HkCaptchaModal";
export { HkProtocolModal as HkProtocolModal } from "./components/HkProtocolModal";
export { HkAboutModal as HkAboutModal } from "./components/HkAboutModal";
export { HkLogWindow as HkLogWindow } from "./components/HkLogWindow";
export { HkSettingsBody as HkSettingsBody } from "./components/HkSettingsDialog";
export { HkSettingsDialog as HkSettingsDialog } from "./components/HkSettingsDialog";
export { HkSettingsGroup as HkSettingsGroup } from "./components/HkSettingsDialog";
export { HkSettingsSub as HkSettingsSub } from "./components/HkSettingsDialog";
export { HkSettingsHint as HkSettingsHint } from "./components/HkSettingsDialog";
export { HkCookieConsent as HkCookieConsent } from "./components/HkCookieConsent";
export { HkAttachmentModal as HkAttachmentModal } from "./components/HkAttachmentModal";
export { HkStatusBar as HkStatusBar } from "./components/HkStatusBar";
export { HkCountdownDigit as HkCountdownDigit } from "./components/HkCountdownDigit";
export { HkConnectionStatus as HkConnectionStatus } from "./components/HkConnectionStatus";
export { HkRichInput as HkRichInput } from "./components/HkRichInput";
export { HkVoiceInputPopup as HkVoiceInputPopup } from "./components/HkVoiceInputPopup";
export { HkToolBlock as HkToolBlock } from "./components/HkToolBlock";
export { HkJsonTree as HkJsonTree } from "./components/HkJsonTree";
export { HkTokenUsageBadge as HkTokenUsageBadge } from "./components/HkTokenUsageBadge";
export { HkTokenUsagePanel as HkTokenUsagePanel } from "./components/HkTokenUsagePanel";
export { HkModelTag as HkModelTag } from "./components/HkModelTag";

// Canonical Hk* names for directly-exported types (2026-09-24
// unification follow-up). These types were defined with their H*
// names at the source and exported directly — not aliased from an Hk*
// identifier — so the canonical Hk* form is an alias export here.
export { type HAttachmentItem as HkAttachmentItem } from "./components/HkAttachmentModal";
export { type HAttachmentDetail as HkAttachmentDetail } from "./components/HkAttachmentModal";
export { type HModelMeta as HkModelMeta } from "./components/HkModelCatalog";
export { type HModelPricing as HkModelPricing } from "./components/HkModelCatalog";
export { type HAboutCredit as HkAboutCredit } from "./components/HkAboutModal";
export { type HAboutLink as HkAboutLink } from "./components/HkAboutModal";
export { type HAboutLinkFace as HkAboutLinkFace } from "./components/HkAboutModal";
export { type HAboutLinkIcon as HkAboutLinkIcon } from "./components/HkAboutModal";
export { type HAboutComponentVersion as HkAboutComponentVersion } from "./components/HkAboutModal";
export { type HCustomTheme as HkCustomTheme } from "./components/HkColorSchemeDialog";
