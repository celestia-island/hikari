# Number Input 数字输入框

Number Input 组件用于数字输入，支持步进器。

## 基础用法

```hikari
rsx! {
    div { style: "padding:1rem;",
        div { style: "display:inline-flex;border:1px solid #d9d9d9;border-radius:6px;overflow:hidden;",
            button { style: "padding:4px 12px;border:none;background:#f5f5f5;cursor:pointer;", "−" }
            input { type: "text", value: "0", style: "padding:8px;width:60px;border:none;text-align:center;font-size:14px;" }
            button { style: "padding:4px 12px;border:none;background:#f5f5f5;cursor:pointer;", "+" }
        }
    }
}
```

## 尺寸规格

支持三种尺寸：小、中（默认）、大。

```hikari
rsx! {
    div { style: "display:flex;gap:12px;padding:1rem;align-items:center;",
        input { type: "text", value: "1", style: "padding:4px 8px;width:50px;border:1px solid #ccc;border-radius:4px;font-size:12px;text-align:center;" }
        input { type: "text", value: "10", style: "padding:8px 12px;width:60px;border:1px solid #ccc;border-radius:6px;font-size:14px;text-align:center;" }
        input { type: "text", value: "100", style: "padding:12px 16px;width:80px;border:1px solid #ccc;border-radius:8px;font-size:16px;text-align:center;" }
    }
}
```

## 禁用状态

```hikari
rsx! {
    div { style: "padding:1rem;",
        div { style: "display:inline-flex;border:1px solid #d9d9d9;border-radius:6px;overflow:hidden;opacity:0.5;",
            button { disabled: true, style: "padding:4px 12px;border:none;background:#f5f5f5;", "−" }
            input { type: "text", value: "0", disabled: true, style: "padding:8px;width:60px;border:none;text-align:center;" }
            button { disabled: true, style: "padding:4px 12px;border:none;background:#f5f5f5;", "+" }
        }
    }
}
```

## 步进器与范围限制

可以设置最小值、最大值和步长。

```hikari
rsx! {
    div { style: "padding:1rem;",
        div { style: "display:inline-flex;border:1px solid #d9d9d9;border-radius:6px;",
            button { style: "padding:8px 16px;border:none;background:#3a6ea5;color:#fff;cursor:pointer;", "−" }
            span { style: "padding:8px 24px;font-size:16px;font-weight:600;", "5" }
            button { style: "padding:8px 16px;border:none;background:#3a6ea5;color:#fff;cursor:pointer;", "+" }
        }
    }
}
```

## API

| 属性 | 说明 | 类型 | 默认值 |
|------|------|------|--------|
| value | 当前值 | i64 | 0 |
| on_change | 值变化回调 | EventHandler<i64> | - |
| min | 最小值 | Option<i64> | None |
| max | 最大值 | Option<i64> | None |
| step | 步长 | i64 | 1 |
| disabled | 是否禁用 | bool | false |
| size | 尺寸大小 | NumberInputSize | Medium |
| class | 自定义类名 | String | "" |
| style | 自定义样式 | String | "" |

### NumberInputSize

- `Small` - 小尺寸 (24px)
- `Medium` - 中尺寸 (32px，默认)
- `Large` - 大尺寸 (40px)

## Vue 前后缀（prefix / suffix）

Vue 组件（`HNumberInput`）把前后缀文本渲染在输入框**内部**——位于输入值与步进按钮列之间，由内部 flex 行在输入框中轴上垂直居中。两种设定方式，同名插槽优先：

```tsx
// 字符串 prop（最简）
<HNumberInput modelValue={v} onUpdate:modelValue={setV} suffix={t("unit.seconds")} />

// 插槽（富内容）
<HNumberInput modelValue={v} onUpdate:modelValue={setV}>
  {{ suffix: () => <span>秒</span> }}
</HNumberInput>
```

空字符串或未传时渲染无前后缀。另有 `label` prop，在输入框上方渲染字段标题。

⚠️ 不要把单位文本作为兄弟元素放在组件旁边：组件根节点是「label 在上 + 输入框在下」的块级堆叠，兄弟元素相对根节点做 flex 居中会对到错误的轴线中点，悬浮在输入框中轴上方。确需外部伴随文本时，应将根节点与伴随文本包进同一个 flex 行，并以输入框高度（而非根节点）为对齐基准。
