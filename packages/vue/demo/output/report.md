# Hikari Vue Component Verification Report

Generated: 2026-07-20T15:52:13.335Z

| # | Component | Status | DOM Preview |
|---|-----------|--------|-------------|
| 1 | HkButton | OK | `<button type="button" class="hikari-btn hikari-btn--primary hikari-btn--md" style="">Click Me</button>` |
| 2 | HkButton-loading | OK | `<button type="button" disabled class="hikari-btn hikari-btn--danger hikari-btn--lg hikari-btn--loading" style="" aria-busy="true"><div class="hk-spinner-wrapper"><div class="hk-spinner hk-spinner-xs h` |
| 3 | HkButton-block | OK | `<button type="button" class="hikari-btn hikari-btn--outline hikari-btn--md hikari-btn--block hikari-btn--has-shortcut" style="">Search<kbd class="hk-kbd hk-kbd--sm" aria-hidden="true"><span><span clas` |
| 4 | HkInput | OK | `<div class="hk-input-wrapper"><label class="hk-input-label">Username</label><div class="hk-input-box hk-input-box--md"><input type="text" value placeholder="Enter text" autocomplete="off" data-1p-igno` |
| 5 | HkInput-error | OK | `<div class="hk-input-wrapper"><label class="hk-input-label">Email</label><div class="hk-input-box hk-input-box--md hk-input-box--error"><input type="text" value placeholder="Email" autocomplete="off" ` |
| 6 | HkBadge | OK | `<span class="hk-badge hk-badge-primary" data-size="md" style="">New</span>` |
| 7 | HkBadge-dot | OK | `<span class="hk-badge hk-badge-error" data-size="md" data-dot-only="true" style=""><span data-el="dot"></span></span>` |
| 8 | HkCard | OK | `<div class="hk-card hk-card--hoverable"><div class="hk-card-header"><h3 class="hk-card-title">Card Title</h3></div><div class="hk-card-body">Content</div><div class="hk-card-footer">Footer</div></div>` |
| 9 | HkAlert | OK | `<div class="hk-alert hk-alert--error hk-alert--md"><span class="hk-alert__icon">[SVG]</span><div class="hk-alert__body"><p class="hk-alert__title">Error</p><p class="hk-alert__text">Something went wro` |
| 10 | HkAlert-warning | OK | `<div class="hk-alert hk-alert--warning hk-alert--md hk-alert--no-title"><span class="hk-alert__icon">[SVG]</span><div class="hk-alert__body"><p class="hk-alert__text">Proceed with caution</p></div></d` |
| 11 | HkCheckbox | OK | `<label class="hk-checkbox hk-checkbox--md" data-type="checkbox"><span class="hk-checkbox-box" data-checked><input class="hk-checkbox-input" type="checkbox" checked>[SVG]</span><span class="hk-checkbox` |
| 12 | HkCheckbox-unchecked | OK | `<label class="hk-checkbox hk-checkbox--md" data-type="checkbox"><span class="hk-checkbox-box"><input class="hk-checkbox-input" type="checkbox"></span><span class="hk-checkbox-label-text">Subscribe</sp` |
| 13 | HkRadio | OK | `<div class="hk-radio-group hk-radio-group--horizontal hk-radio-group--md"><label class="hk-radio" data-size="md"><span class="hk-radio-box" data-checked><input class="hk-radio-input" type="radio" valu` |
| 14 | HkSwitch | OK | `<label class="hk-switch hk-switch--md hk-switch--primary" data-checked><input class="hk-switch-input" type="checkbox" checked><span class="hk-switch-track"><span class="hk-switch-thumb"></span><span c` |
| 15 | HkTag | OK | `<span class="hk-tag hk-tag-primary hk-tag-md">Tag</span>` |
| 16 | HkTag-closable | OK | `<span class="hk-tag hk-tag-danger hk-tag-md">Remove<button type="button" class="hk-tag-close">[SVG]</button></span>` |
| 17 | HkSpinner | OK | `<div class="hk-spinner-wrapper"><div class="hk-spinner hk-spinner-md" style=""></div><span class="hk-spinner-text">Loading...</span></div>` |
| 18 | HkSpinner-center | OK | `<div class="hk-spinner-wrapper hk-spinner-centered"><div class="hk-spinner hk-spinner-lg" style=""></div></div>` |
| 19 | HkSkeleton | OK | `<div class="hk-skeleton" data-tone="primary" data-animated="true" style="width:200px;height:20px;border-radius:var(--hk-radius-sm, 4px);" aria-hidden="true"></div>` |
| 20 | HkProgressBar | OK | `<div class="hk-progress-bar" data-size="sm"><span class="hk-progress-bar-label">60%</span><div class="hk-progress-bar-track"><div class="hk-progress-bar-fill hk-progress-bar-fill--loading" style="widt` |
| 21 | HkProgressBar-indeterminate | OK | `<div class="hk-progress-bar" data-size="sm"><div class="hk-progress-bar-track"><div class="hk-progress-bar-indeterminate hk-progress-bar-indeterminate--loading"></div></div></div>` |
| 22 | HkProgressRing | OK | `<div class="hk-progress-ring" style="width:80px;height:80px;" role="progressbar" aria-valuenow="75" aria-valuemin="0" aria-valuemax="100">[SVG]<span class="hk-progress-ring-label" style="font-size:16p` |
| 23 | HkKbd | OK | `<kbd class="hk-kbd hk-kbd--md" aria-hidden="true"><span><span class="hk-kbd__key">Ctrl</span></span><span><span class="hk-kbd__sep">+</span><span class="hk-kbd__key">Shift</span></span><span><span cla` |
| 24 | HkDivider | OK | `<div class="hk-divider" aria-hidden="true" text="or"></div>` |
| 25 | HkTooltip | OK | `<span class="hk-tooltip-wrapper" data-position="top"><span class="hk-tooltip-trigger">Hover me</span></span>` |
| 26 | HkSelect | OK | `<div class="hk-select-wrapper"><button type="button" class="hk-select-trigger" data-state="closed"><span class="hk-select-value">Choose...</span>[SVG]</button></div>` |
| 27 | HkTabs | OK | `<div class="hk-tabs" data-variant="underline"><div class="hk-tabs-list" role="tablist"><button type="button" role="tab" aria-selected="true" class="hk-tabs-trigger" data-active="true"><span>Tab 1</spa` |
| 28 | HkTable | OK | `<div class="hk-table-wrapper"><table class="hk-table hk-table--md"><thead><tr class="hk-table-header-row"><th class="hk-table-header-cell" style=""><span class="hk-table-header-label">Name</span></th>` |
| 29 | HkTree | OK | `<div class="hk-tree" data-size="sm"><div class="hk-tree-node"><div class="hk-tree-row"><span class="hk-tree-toggle" data-parent="true">[SVG]</span><span class="hk-tree-label">Root</span></div></div></` |
| 30 | HkTimeline | OK | `<div class="hk-timeline" data-orientation="horizontal"><div class="hk-timeline-step" data-status="active"><span data-el="indicator" aria-hidden="true"><span data-el="num">1</span></span><span data-el=` |
| 31 | HkEmptyState | OK | `<div class="hk-empty-state"><div class="hk-empty-icon">[SVG]</div><p class="hk-empty-title">Nothing here</p><p class="hk-empty-desc">Add some data</p><div class="hk-empty-action"></div></div>` |
| 32 | HkSidebar | OK | `<aside class="hk-sidebar" style="width:280px;"><nav class="hk-sidebar-panel" style="width:280px;"><div class="hk-sidebar-body">Nav items</div></nav></aside>` |
| 33 | HkLogo | OK | `<div class="hk-logo" style="line-height:0;"><div class="hk-logo__placeholder" style="width:2rem;height:2rem;" role="img" aria-label="MyApp"><span class="hk-logo__initial">M</span></div></div>` |
| 34 | HkStatusBar | OK | `<footer class="hk-status-bar"><div class="hk-status-bar__left"><span class="hk-status-bar__version">v1.0.0</span></div><div class="hk-status-bar__right"></div></footer>` |
| 35 | HkGaugeRing | OK | `<div class="hk-gauge-ring" style="width:140px;height:140px;">[SVG]<div class="absolute inset-0 flex flex-col items-center justify-center pointer-events-none"><div class="text-lg font-bold text-text le` |
| 36 | HkSelectionGrid | OK | `<div class="hk-selection-grid"><div class="hk-selection-grid__grid" data-cols="2"><div role="button" tabindex="0" class="hk-selection-grid__item" data-selected="true" aria-selected="true"><div class="` |
| 37 | HkAdminShell | OK | `<div class="hk-admin-shell"><div class="hk-admin-shell__header">Header</div><div class="hk-admin-shell__body"><aside class="hk-admin-shell__sidebar" style="width:240px;"><div class="hk-admin-shell__si` |
| 38 | HkAdminHeader | OK | `<header class="hk-admin-header"><div class="hk-admin-header__left"><span class="hk-admin-header__title">Admin</span></div><div class="hk-admin-header__right"><button type="button" class="hikari-btn hi` |
| 39 | HkNavItem | OK | `<button type="button" class="hk-nav-item hk-nav-item--button hk-nav-item--active" data-active><span class="hk-nav-item__icon">📊</span><span class="hk-nav-item__label">Dashboard</span></button>` |
| 40 | HkNumberInput | OK | `<div class="hk-number-input hk-number-input--md"><div class="hk-number-input__inner"><input type="number" class="hk-number-input__field" value="42" step="1"><div class="hk-number-input__steppers"><but` |
| 41 | HkSearchInput | OK | `<div class="hk-search-input hk-search-input--md"><span class="hk-search-input__icon">[SVG]</span><input type="search" class="hk-search-input__field" value placeholder="Search..."></div>` |
| 42 | HkTextarea | OK | `<div class="hk-textarea"><textarea class="hk-textarea__field" placeholder="Enter text" rows="3"></textarea></div>` |
| 43 | HkSkeletonList | OK | `<div class="hk-skeleton-list" style="gap:8px;" aria-hidden="true"><div class="hk-skeleton" data-tone="primary" data-animated="true" style="width:100%;height:40px;border-radius:var(--hk-radius-sm, 4px)` |
| 44 | HkHoverRevealAction | OK | `<span class="hk-hover-reveal" data-placement="right"><span class="hk-hover-reveal__main">Trigger</span><span class="hk-hover-reveal__extension">Action</span></span>` |
| 45 | HkSelectionWaterfall | OK | `<div class="hk-selection-waterfall"><div class="hk-selection-waterfall__flow"><div role="button" tabindex="0" class="hk-selection-waterfall__item" aria-selected="false"><span class="hk-selection-water` |

## Summary

- **Passed**: 45
- **Failed**: 0
- **Total**: 45
