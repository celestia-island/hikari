export { default as HActionBar } from "./components/HkActionBar";
export { default as HAdaptiveDialog } from "./components/HkAdaptiveDialog";
export { default as HAlert } from "./components/HkAlert";
export { default as HAltSignIn } from "./components/HkAltSignIn";
export { default as HAvatar } from "./components/HkAvatar";
export { default as HBadge } from "./components/HkBadge";
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
export { default as HDivider } from "./components/HkDivider";
export { default as HDrawer } from "./components/HkDrawer";
export { default as HEmptyState } from "./components/HkEmptyState";
export { default as HExpansionPanel } from "./components/HkExpansionPanel";
export { default as HFab, type HFabAction } from "./components/HkFab";
export { default as HIcon } from "./components/HkIcon";
export { default as HIconButton } from "./components/HkIconButton";
export { default as HInput } from "./components/HkInput";
export { default as HPlaceholderMarquee, type PlaceholderVariant } from "./components/HkPlaceholderMarquee";
export { default as HKbd } from "./components/HkKbd";
export { default as HLabel } from "./components/HkLabel";
export { default as HListTransition } from "./components/HkListTransition";
export { default as HMarkdownRenderer } from "./components/HkMarkdownRenderer";
export { default as HModal } from "./components/HkModal";
export { default as HNavItem } from "./components/HkNavItem";
export { default as HNumberInput } from "./components/HkNumberInput";
export { default as HPasswordInput } from "./components/HkPasswordInput";
export { default as HPhaseTransition } from "./components/HkPhaseTransition";
export { default as HGaugeRing } from "./components/HkGaugeRing";
export { default as HProgressRing } from "./components/HkProgressRing";
export { default as HRollingNumber } from "./components/HkRollingNumber";
export { default as HLocalePickerPopup } from "./components/HkLocalePickerPopup";
export { default as HHoverRevealAction } from "./components/HkHoverRevealAction";
export { default as HKeywordSearchModal } from "./components/HkKeywordSearchModal";
export { default as HModalBreadcrumb } from "./components/HkModalBreadcrumb";
export { default as HPopover, type PopupPlacement } from "./components/HkPopover";
export { default as HMenu, type HkMenuItem } from "./components/HkMenu";
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
export { default as HTextarea } from "./components/HkTextarea";
export { default as HToast } from "./components/HkToast";
export { default as HTooltip } from "./components/HkTooltip";
export { default as HTree } from "./components/HkTree";
export { default as HWindowedItem } from "./components/HkWindowedItem";
export { default as HDateTimePicker } from "./components/HkDateTimePicker";
export { default as HDatePicker } from "./components/HkDatePicker";
export { default as HTimeline } from "./components/HkTimeline";
export { default as HStepFlow } from "./components/HkStepFlow";
export type { StepFlowSlotProps } from "./components/HkStepFlow";

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
export { default as HDraggableList } from "./components/HkDraggableList";
export { default as HDraggableGrid } from "./components/HkDraggableGrid";
export { default as HSelectionGrid } from "./components/HkSelectionGrid";
export { default as HSelectionWaterfall } from "./components/HkSelectionWaterfall";

export { default as HLogo } from "./components/HkLogo";

// Component types
export { type BadgeVariant } from "./components/HkBadge";
export { type ModalAction } from "./components/HkModal";
export { type TreeNode, type TreeSize, type TreeRowScope } from "./components/HkTree";
export { type DragListItem } from "./components/HkDraggableList";
export { type GridItem } from "./components/HkDraggableGrid";
export { type MinimapBox, type MinimapRect } from "./components/HkMinimap";
export { type TrendPen, type TrendPoint, type AlarmThresholds } from "./components/HkTrendChart";

// Theme system
export {
  initTheme, useTheme, themePresets, tokensToCSSVars, getThemeTokens,
  loadCustomThemes, saveCustomThemes, addCustomTheme, removeCustomTheme,
  registerTokenGroup, getTokenGroups, resolveGroupTokens, clampToSlot,
  clampRgbToBands, clampHue, hueDelta, wrapHue, groupTokensToCSSVars, rgbToHsl, hslToRgb,
  tokenGroupsVersion,
  allGroupSlots, resolveLocalizedText, parseTokenGroupConfig, registerTokenGroupConfig,
  startLuminanceSampler, stopLuminanceSampler, sampleLuminanceNow, invalidateLuminanceCache,
  getTimePeriod, getGeolocation, solarAltitude, DEFAULT_GEO_LOCATION,
  timezoneFallback, setGeolocationProvider, refreshThemeClock, stopThemeClock,
  initFontContext, applyFontContext, resetFontContext, useFontContext,
  HIKARI_FONT_SANS, HIKARI_FONT_MONO, HIKARI_FONT_READING,
  type ThemeTokenRGB, type ThemeSchemeTokens, type ThemePreset, type ThemeMode,
  type ThemeId, type ThemeTokens, type CustomThemePreset, type TimePeriod,
  type GeoLocation, type GeoLocationProvider,
  type ThemeTokenGroupValues, type ThemeTokenGroupModes,
  type TokenGroupDefinition, type TokenGroupSlot, type TokenGroupSection, type HueClamp,
  type ResolvedGroupTokens, type ColorHSL,
  type LocalizedText, type ParseTokenGroupResult,
  type FontContextOverrides,
} from "./theme";

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
} from "./runtime";

// i18n
export {
  useI18n,
  setLocale,
  mergeMessages,
} from "./i18n/context";

// ── Generic utils ───────────────────────────────────────────────
export { fuzzyScore, fuzzyScoreFields, fuzzySearch } from "./utils/fuzzy";
export type { FuzzyMatch } from "./utils/fuzzy";
export { validatePassword, passwordLevel } from "./utils/password";
export type { PasswordValidationResult, PasswordLevel } from "./utils/password";

export { FOCUSABLE_SELECTOR, getFocusableElements, focusFirst, trapFocus, scrollToElement } from "./utils/dom";
export { useDeferredTransition } from "./composables/useDeferredTransition";

export { useZoomPan } from "./composables/useZoomPan";
export type { ZoomPanOptions, ZoomPanState } from "./composables/useZoomPan";
export { extOf, isImageFile, isAudioFile, codeLanguage, isCodeFile, isArchiveFile, isTextFile, fileIcon, mediaKindOf } from "./utils/fileType";

export { useReducedMotion } from "./composables/useReducedMotion";
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
export { iconByName } from "./composables/iconRegistry";
export { useMessaging, registerTransport, registerNativeBridge } from "./composables/messaging";
export type { MessagePayload, MessageSeverity, MessageTransport, NotifyOptions, TransportName } from "./composables/messaging";

export { useResourceListModal } from "./composables/useResourceListModal";

export { downloadBlob, downloadTextAsFile } from "./utils/download";
export { bytesToBase64, base64ToBytes, blobToBase64 } from "./utils/base64";

export { THEME_MODE_STORAGE_KEY } from "./theme/useTheme";

export { isTauri } from "./runtime/env";

export { deepMerge, isPlainObject, getPath, setPath, delPath } from "./utils/objectPath";

// ── Admin panel pieces (ported from plana-ui) ────────────────────────────
export { HkAdminShell as HAdminShell } from "./components/HkAdminShell";
export { HkAdminHeader as HAdminHeader } from "./components/HkAdminHeader";
export { HkNavSidebar as HNavSidebar } from "./components/HkNavSidebar";
export { HkThemeToggle as HThemeToggle } from "./components/HkThemeToggle";
export { HkAuthCard as HAuthCard } from "./components/HkAuthCard";
export { HkSignInCard as HSignInCard } from "./components/HkSignInCard";
export { default as HAuthSubmitButton } from "./components/HkAuthSubmitButton";
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
export { HkAboutModal as HAboutModal, type HAboutLink } from "./components/HkAboutModal";
export { HkLogWindow as HLogWindow, type HLogTab } from "./components/HkLogWindow";
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
  buildJsonTree,
  type HParsedToolCall,
  type HToolBlockVariant,
  type HHighlightedLine,
  type HJsonNode,
} from "./components/HkToolBlock";
export { HkTokenUsageBadge as HTokenUsageBadge } from "./components/HkTokenUsageBadge";
export { HkTokenUsagePanel as HTokenUsagePanel } from "./components/HkTokenUsagePanel";
export { HkModelTag as HModelTag } from "./components/HkModelTag";
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
  formatMs,
  type RelativeTimeT,
} from "./utils/format";
