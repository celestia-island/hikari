# 系统架构概览

Hikari 框架采用模块化设计，基于 Tairitsu 运行时构建，由 6 个独立包组成。

## 包概览

| 包 | 说明 |
|---|---|
| hikari-palette | 中国传统色彩系统（500+ 颜色），主题色板管理 |
| hikari-animation | 声明式动画系统，缓动函数、插值、时间线控制 |
| hikari-icons | Material Design Icons（7000+）集成，SVG 生成 |
| hikari-theme | 主题上下文、CSS 变量生成、主题切换 |
| hikari-components | 核心 UI 组件库（40+ 组件） |
| hikari-extra-components | 高级组件（节点编辑器、富文本等） |

## 分层架构

```
┌─────────────────────────────────────┐
│      应用层 (examples/)              │
├─────────────────────────────────────┤
│   组件层 (components, extra)         │
├─────────────────────────────────────┤
│  系统层 (theme, animation, icons)    │
├─────────────────────────────────────┤
│   基础层 (palette)                   │
└─────────────────────────────────────┘
```

## 包依赖关系

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

## 外部依赖

所有包基于 **Tairitsu** 框架（tairitsu-vdom、tairitsu-hooks、tairitsu-style、tairitsu-web）作为响应式 UI / WASM 运行时。
