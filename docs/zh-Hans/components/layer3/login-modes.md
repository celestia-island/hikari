# 登录模式

Hikari 提供同一套登录流程（`HkLoginFlow`），并在它周围提供三样东西，让每个 Celestia 前端都能从服务端的登录策略文档挂载相同的登录界面：发现适配器、跳转屏幕，以及可以成为真实链接的频道行。

```mermaid
flowchart LR
  D[登录策略文档] --> A[hkLoginPlanFromDiscovery]
  A -->|local / federated| F[HkLoginFlow]
  A -->|relay| S[HkAuthHandoff status=redirecting]
  S --> R[中央登录]
  R -->|回调| C[HkAuthHandoff status=completing]
  C -->|成功| O[HkAuthHandoff status=success]
  C -->|失败| X[HkAuthHandoff status=failed / expired]
```

## 三种模式

| 模式 | 密码表单 | 提供方行 | 宿主挂载的内容 |
| --- | --- | --- | --- |
| `local` | 一个凭据频道 | `oauth` 以外的所有入口类型（目前为 `passkey`、`custom`） | 单频道的 `HkLoginFlow`，没有分段组 |
| `federated`，`password: true` | 一个凭据频道 | 表单下方是全部方法（`oauth`、`passkey`、`custom`） | 单频道的 `HkLoginFlow` |
| `federated`，`password: false` | 无 | 每个方法各自成为一个 `sso` 频道 | 每个方法一个频道的 `HkLoginFlow` |
| `relay` | 无 | 无 | **不挂载 `HkLoginFlow`**——由 `HkAuthHandoff` 跳转到中央登录 |

## 发现适配器

`loginDiscovery.ts` 是一组纯函数：没有响应式、不请求接口、不拼接 URL。类型与线上文档逐字段对应（`version`、`mode`、`password`、`methods[]`、`relay`）。

```tsx
import {
  hkLoginPlanFromDiscovery, hkRelayEntryHref,
  HkAuthHandoff, HkLoginFlow,
} from "@celestia-island/hikari/vue";

const plan = hkLoginPlanFromDiscovery(policy, {
  credentialsKey: "cloud",          // 默认 "cloud"
  credentialsLabel: "Celestia",     // 可选的分段标签
  divider: "其他方式登录",           // 可选；不传则不渲染
});
const channel = ref(plan.defaultChannel ?? "");
```

| 导出 | 结果 |
| --- | --- |
| `hkLoginPlanFromDiscovery(doc, copy?)` | `{ mode, channels, defaultChannel }`；relay 模式下 `channels` 为 `[]`、`defaultChannel` 为 `null` |
| `hkRelayEntryHref(doc, returnTo?)` | 非 relay 模式返回 `null`；否则返回入口 URL，仅当返回地址是同源路径时才追加 |
| `hkIsSameOriginPath(raw)` | `/x` 为 `true`；`//host`、`/`、相对或绝对 URL 为 `false` |

未知方法类型以及 `id` 为空的方法会被忽略——适配器绝不会因为看不懂文档而抛错。

## 跳转屏幕

`HkAuthHandoff` 是"不是表单"的登录屏幕：relay 启动页、回调交换，以及终态。它构建在 `HkAuthScreen` 之上，并沿用认证卡片的语法（logo、标题、描述）。

```tsx
<HkAuthHandoff
  status={state}                 // "redirecting" | "completing" | "success" | "failed" | "expired"
  logoSrc="/logo.svg"
  href={entryHref ?? undefined}  // redirecting：跳转目标
  delayMs={600}
  onRedirect={(href) => allow(href)}  // 返回 false 可取消
  onRetry={() => restart()}
  onBack={() => router.push("/login")}
/>
```

| 属性 | 默认值 | 效果 |
| --- | --- | --- |
| `status` | 必填 | `redirecting` / `completing`：加载指示器与礼貌的实时区域；`failed` / `expired`：`role="alert"` |
| `title` / `description` | `undefined` | 覆盖 `hikari::authHandoff.*` 中的状态文案；默认没有描述 |
| `logoSrc` | `undefined` | 不显示 logo |
| `href` | `undefined` | 传入时组件在 `delayMs` 后跳转；不传时由宿主在 `redirect` 时跳转 |
| `delayMs` | `0` | 启动页展示多久后再跳转 |
| `actions` | `failed` / `expired` 为 `["back"]`，其余为 `[]` | 内置按钮；`actions` 插槽会替换它们 |

事件：`redirect(href)`、`retry()`、`back()`。插槽：`header`、`footer`（转发给 `HkAuthScreen`）、`actions`。

## 链接行

`HkAuthChannelListEntry`——以及转发它的 `HkLoginSsoChannel`——可以带 `href`。此时该行渲染为真实的 `<a href>`：中键、Ctrl 点击可用，爬虫也能看到目标。`select(key)`（或 `sso-click`）仍会先触发，且绝不会阻止导航。禁用的链接没有 `href`，与禁用按钮一样被跳过，并带有 `aria-disabled="true"`。不传 `href` 时该行仍是 `<button type="button">`，与之前一致。

## 宿主职责

- 在服务端校验登录策略文档；hikari 信任传入的内容。
- relay 模式下不要挂载 `HkLoginFlow`——挂载 `HkAuthHandoff`。
- 只传同源路径作为返回地址；可使用 `hkIsSameOriginPath` 或你自己的白名单。
- 行的 `href` 同样必须是同源路径（文档在服务端校验）；hikari 不做检查。
