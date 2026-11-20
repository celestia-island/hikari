# 删除确认窗（Delete Gate Window）

即开即用的删除确认窗。任何删除相关界面以 `open` + `title` 挂载即可；默认插槽渲染消息区；唯一的确认控件是一条蛇形走道（随机直角转角的完整轨迹）——**走完即确认，刻意没有第二次对话框**。

## 消息插槽的家规

**插槽文案必须携带被删除对象的全部关键事实，每一项都用 [`HkDeleteFact`](#hkdeletefact) 强调标签标记**——让不可逆操作清楚地指名目标，而不是对着一个匿名对象挥手：

- 对象名称；存在多语言别称时，当前语言下的别称也要给出；
- 所有者；
- 规模/计数（挂了多少资源）；
- 所有挂载资源的名称。

审阅插槽的人只看事实就应能回答「我到底在删什么」。

## 用法

```hikari:tsx
<HkDeleteGateWindow
  v-model:open="open"
  title="删除工作区"
  label="此工作区"
  grab-hint="按住摇杆沿路径拖到最右端"
  tracking-hint="继续——到达终点即删除"
  :turns="[5, 7]"
  @confirm="performDelete"
>
  <div class="hk-delete-gate-message">
    <HkDeleteFact label="名称" value="ml-lab" />
    <HkDeleteFact label="所有者" value="demiurge" />
    <HkDeleteFact label="来源" value="7 个仓库" />
  </div>
</HkDeleteGateWindow>
```

## Props

| 属性 | 类型 | 说明 |
|---|---|---|
| `open` | boolean | 可见性，`v-model:open` |
| `title` | string | 窗口标题 |
| `label` | string | 正在删除什么（门的 `aria-label`） |
| `grab-hint` | string | 抓取前提示（本地化） |
| `tracking-hint` | string | 拖动中提示（本地化） |
| `turns` | `[min, max]` | 转角数量范围；默认 `[3, 5]`；**越敏感的删除弯越多**（`[5, 7]` 走更多转角）；偶数向下取整（至多语义） |
| `seed` | number | 钉住随机轨迹（测试 / 设计核对） |
| `disabled` | boolean | 冻结门（如删除请求进行中） |

## 事件

| 事件 | 载荷 | 触发时机 |
|---|---|---|
| `confirm` | — | 完整走道并在终点松手（父层执行真正的删除） |
| `cancel` | progress 0..1 | 未到终点松手（弹簧回退） |
| `update:open` | boolean | 用户关闭或确认后关闭 |

## HkDeleteFact

单个强调关键事实：边框徽章，弱色标签配强色值。每条事实一个；绝不渲染裸值。

## 无障碍

- 摇杆即滑块手柄：方向键走走廊，`Enter` 在终点确认，`Escape` 取消——键盘与指针同权；
- `aria-live` 按 20% 档播报进度；
- reduced motion 下弹簧改为瞬时归位。
