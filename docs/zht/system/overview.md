# 系統架構概覽

Hikari 框架採用模組化設計，基於 Tairitsu 執行時期構建，由 6 個獨立套件組成。

## 套件概覽

| 套件 | 說明 |
|---|---|
| hikari-palette | 中國傳統色彩系統（500+ 顏色），主題色板管理 |
| hikari-animation | 宣告式動畫系統，緩動函數、插值、時間線控制 |
| hikari-icons | Material Design Icons（7000+）整合，SVG 生成 |
| hikari-theme | 主題上下文、CSS 變數生成、主題切換 |
| hikari-components | 核心 UI 元件庫（40+ 元件） |
| hikari-extra-components | 進階元件（節點編輯器、富文本等） |

## 分層架構

```
┌─────────────────────────────────────┐
│      應用層 (examples/)              │
├─────────────────────────────────────┤
│   元件層 (components, extra)         │
├─────────────────────────────────────┤
│  系統層 (theme, animation, icons)    │
├─────────────────────────────────────┤
│   基礎層 (palette)                   │
└─────────────────────────────────────┘
```

## 套件依賴關係

```
hikari-palette ◄──── hikari-animation
      ▲                    │
      │                    ▼
      ├──────────── hikari-icons
      │
      ├─── hikari-theme
      │
      ├─── hikari-components ◄── hikari-theme, hikari-icons
      │
      └─── hikari-extra-components ◄── hikari-theme, hikari-icons
```

## 外部依賴

所有套件基於 **Tairitsu** 框架（tairitsu-vdom、tairitsu-hooks、tairitsu-style、tairitsu-web）作為響應式 UI / WASM 執行時期。
