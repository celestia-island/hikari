export { default as HActionBar } from "./components/HkActionBar";
export { default as HAlert } from "./components/HkAlert";
export { default as HAvatar } from "./components/HkAvatar";
export { default as HBadge } from "./components/HkBadge";
export { default as HBreadcrumb } from "./components/HkBreadcrumb";
export { default as HButton } from "./components/HkButton";
export { default as HCard } from "./components/HkCard";
export { default as HCheckbox } from "./components/HkCheckbox";
export { default as HCollapse } from "./components/HkCollapse";
export { default as HColorPicker } from "./components/HkColorPicker";
export { default as HConfirmDialog } from "./components/HkConfirmDialog";
export { default as HDivider } from "./components/HkDivider";
export { default as HDrawer } from "./components/HkDrawer";
export { default as HEmptyState } from "./components/HkEmptyState";
export { default as HIcon } from "./components/HkIcon";
export { default as HIconButton } from "./components/HkIconButton";
export { default as HInput } from "./components/HkInput";
export { default as HKbd } from "./components/HkKbd";
export { default as HListTransition } from "./components/HkListTransition";
export { default as HMarkdownRenderer } from "./components/HkMarkdownRenderer";
export { default as HModal } from "./components/HkModal";
export { default as HMorphingTabs } from "./components/HkMorphingTabs";
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
export { default as HPopupSelect, isAnyPopupOpen, closeAllPopups, type HkPopupSelectOption } from "./components/HkPopupSelect";
export { default as HProgressBar } from "./components/HkProgressBar";
export { default as HProgressDialog } from "./components/HkProgressDialog";
export { default as HRadio } from "./components/HkRadio";
export { default as HScrollContainer } from "./components/HkScrollContainer";
export { default as HSearchInput } from "./components/HkSearchInput";
export { default as HSplash } from "./components/HkSplash";
export { default as HSelect } from "./components/HkSelect";
export { default as HSidebar } from "./components/HkSidebar";
export { default as HSkeleton } from "./components/HkSkeleton";
export { default as HSkeletonList } from "./components/HkSkeletonList";
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
export { default as HTimeline } from "./components/HkTimeline";

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
  startLuminanceSampler, stopLuminanceSampler, sampleLuminanceNow, invalidateLuminanceCache,
  getTimePeriod, getGeolocation, solarAltitude, DEFAULT_GEO_LOCATION,
  type ThemeTokenRGB, type ThemeSchemeTokens, type ThemePreset, type ThemeMode,
  type ThemeId, type ThemeTokens, type CustomThemePreset, type TimePeriod,
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
  reportTransition,
  setReducedMotion,
  notifyScrollStart,
  useOverlay,
  usePopupManager,
  useToast,
  useBreakpoint,
  useClipboard,
  closeAll,
  isOverlayOpen,
  TOAST_DURATION,
  type AnimationHandle,
  useReportedTransition,
  type ReportedTransition,
  type ReportedTransitionTrack,
  type CronHandle,
  type FrameContext,
  type OverlayHandle,
  type PopupHandle,
  type PopupKind,
  type ToastItem,
  type ToastMessage,
  type ToastType,
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
export { probeOrigin, probeOriginWithBody } from "./utils/connectivity";
export type { OriginProbe } from "./utils/connectivity";

export { highlight, useHighlight } from "./composables/useHighlight";
export { LANGUAGE_LOADERS } from "./composables/highlightLanguages";
export { iconByName } from "./composables/iconRegistry";
export { useMessaging, registerTransport, registerNativeBridge } from "./composables/messaging";
export type { MessagePayload, MessageSeverity, MessageTransport, NotifyOptions, TransportName } from "./composables/messaging";

export { useResourceListModal } from "./composables/useResourceListModal";

export { downloadBlob, downloadTextAsFile } from "./utils/download";
