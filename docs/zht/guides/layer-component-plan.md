# Layer 分層組件計畫：三層次組件體系

## 概述

Hikari 採用三層次組件體系，從基礎到複雜逐步構建。Layer 1 提供原子級組件，Layer 2 組合 Layer 1 構建複合組件，Layer 3 基於 Layer 2 實現生產級複雜功能。

## 設計理念

### 核心原則

1. **漸進式增強** - 從簡單到複雜
2. **可復用性** - 高層組件可復用低層組件
3. **單一職責** - 每個組件只做一件事
4. **組合優於繼承** - 通過組合構建複雜功能

### 職責劃分

| Layer | 職責 | 複雜度 | 狀態管理 |
|-------|------|--------|---------|
| **Layer 1** | 原子級 UI 元素 | 低 | 局部狀態 |
| **Layer 2** | 複合 UI 模式 | 中 | 局部狀態 + Context |
| **Layer 3** | 完整業務功能 | 高 | 全局狀態 + 複雜邏輯 |

## Layer 1: 基礎組件

**定義**：不可再分的原子級 UI 元素

**特點**：單一職責、無複雜狀態管理、高度可復用

### 已完成的組件

| 組件 | 路徑 | 狀態 |
|------|------|------|
| Button | `basic/button.rs` | ✅ |
| Input | `basic/input.rs` | ✅ |
| Card | `basic/card.rs` | ✅ |
| Badge | `basic/badge.rs` | ✅ |
| Alert | `feedback/alert.rs` | ✅ |
| Toast | `feedback/toast.rs` | ✅ |
| Tooltip | `feedback/tooltip.rs` | ✅ |
| Select | `basic/select.rs` | ✅ |
| Checkbox | `basic/checkbox.rs` | ✅ |
| Radio | `basic/radio_group.rs` | ✅ |
| Switch | `basic/switch.rs` | ✅ |
| Avatar | `basic/avatar.rs` | ✅ |
| Image | `basic/image.rs` | ✅ |
| Slider | `basic/slider.rs` | ✅ |
| Progress | `feedback/progress.rs` | ✅ |
| Spin | `feedback/spin.rs` | ✅ |
| FormField | `basic/form_field.rs` | ✅ |

### 待開發

| 組件 | 優先級 | 功能描述 |
|------|--------|---------|
| **Divider** | 低 | 分割線 |
| **Skeleton** | 低 | 骨架屏 |

## Layer 2: 複合組件

**定義**：由多個 Layer 1 組件組合而成的複合組件

**特點**：組合基礎組件、有一定的狀態管理、提供常見 UI 模式、支持 Context 共享狀態

### 已完成的組件

| 組件 | 路徑 | 依賴的 Layer 1 | 狀態 |
|------|------|---------------|------|
| Menu | `navigation/menu.rs` | Button, Card | ✅ |
| Tabs | `navigation/tabs.rs` | Button | ✅ |
| Breadcrumb | `navigation/breadcrumb.rs` | Button | ✅ |
| Table | `data/table.rs` | Button, Card, Input | ✅ |
| Tree | `data/tree.rs` | Button | ✅ |
| Pagination | `data/pagination.rs` | Button | ✅ |
| Dropdown | `feedback/dropdown.rs` | Button, Menu | ✅ |
| Modal | `feedback/modal.rs` | Card, Button | ✅ |
| Drawer | `feedback/drawer.rs` | Card, Button | ✅ |
| Steps | `navigation/steps.rs` | Button, Badge | ✅ |
| Form | `utils/form.rs` | Input, Select, Checkbox, Radio | ✅ |

### 待開發

| 組件 | 優先級 | 功能描述 | 依賴的 Layer 1 |
|------|--------|---------|---------------|
| **Collapse** | 中 | 可折疊面板 | Button, Card |
| **Upload** | 中 | 文件上傳 | Button, Progress |
| **Calendar** | 中 | 日曆選擇器 | Button, Input |
| **Carousel** | 低 | 輪播圖 | Button, Card |
| **Timeline** | 低 | 時間軸 | Card, Badge |

## Layer 3: 生產級組件

**定義**：完整的業務功能，基於 Layer 2 構建

**特點**：複雜狀態管理、完整業務邏輯、高性能優化、生產環境驗證

### 計畫中的組件

| 組件 | 優先級 | 功能描述 | 依賴的 Layer 2 | 複雜度 |
|------|--------|---------|---------------|--------|
| **影片/音訊播放器** | 高 | 播放控制、字幕、播放列表 | Card, Button, Form, Menu | 高 |
| **富文本編輯器** | 高 | 富文本編輯、Markdown、插件 | Form, Dropdown, Modal, Toolbar | 高 |
| **代碼高亮設施** | 高 | 語法高亮、行號、主題切換 | Card, Tabs, Form | 中 |
| **時間軸** | 中 | 事件時間軸、里程碑 | Card, Badge, Collapse | 中 |
| **用戶引導組件** | 中 | 新手引導、功能介紹、步驟提示 | Modal, Button, Badge | 中 |
| **數據可視化** | 低 | 圖表、儀表盤、報表 | Card, Tabs, Form | 高 |

## 開發優先級

| 階段 | 目標 | 預計時間 |
|------|------|---------|
| 階段 1 | 完善 Layer 1（Divider、Skeleton） | 1 週 |
| 階段 2 | 完善 Layer 2（Collapse、Upload、Calendar 等） | 2-3 週 |
| 階段 3 | 實現 Layer 3（代碼高亮、播放器、編輯器等） | 4-6 週 |
| 階段 4 | 性能優化、文檔完善、測試覆蓋 | 2-3 週 |

## 技術說明

- **圖標系統**：使用 Material Design Icons (MDI)，7000+ 圖標
- **路由系統**：使用 Tairitsu 的 Routable derive 宏
- **構建命令**：`just build`（Release）/ `just build-dev`（Debug）/ `just dev`（開發伺服器）
