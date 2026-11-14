# 通知中心：关闭语法

关闭一条通知绝不等于丢失它。每一个会消失的面——角落 toast 栈、阻断式确认门、
全屏紧急警告带、宿主的驻留 chip——都要把它展示过的内容记入通知中心账本，
然后由一枚铃铛在宿主挂载的任意位置把这份列表重新呼出。

## 默认收纳什么

按用户裁决（2026-11-15），默认只收值得回看的：

- error / warning toast；已答复的阻断门；全部紧急警告 episode
  （active、snoozed、cleared——已恢复的条件保留可回看）；宿主显式记账的驻留 chip。
- success / info / loading toast 逐条 opt-in（push 时 `journal: true`）——
  把每条 3 秒的「已保存」都记进列表只会把有用信息淹没在噪音里。

## 留存与重放

账本是会话级留存：sessionStorage 跨刷新存活、随浏览器会话消失，
外加 100 条环形缓冲（按最后更新时间丢最旧）。记录只是**记录**——
toast 的动作按钮是调用方闭包，永远不会从列表里重放。唯一可逆的例外是
被 snooze 的紧急警告：条目自带真实的解除隐藏通路（「重新显示」让警告带回归）。

## 已读规则

打开面板本身就是已读回执。铃铛自己的下标点（图标按钮内建 dot，不是外包一层角标）
回答的是「我是不是错过了什么」，不是「现在屏幕上有没有东西」。

## 摆放

摆放归宿主决定——hikari 只拥有存储语法与组件。管理/控制台面的参考摆放：
右上角动作区、**设置齿轮左侧**的铃铛图标按钮（chest webui 的
HeaderEndCluster），带额外窗口控制钮的桌面壳不受影响（它们在齿轮右侧）。
它绝不是页面正文按钮，也绝不走页面作用域的动作槽注册（页面 chrome 随页卸载，
铃铛是全局件）。

触发钮是尺寸阶梯上的 `HkIconButton`；面板是 `sheetOnMobile` 的
`HkPopover`——宽屏为锚定弹层，手机为底部 sheet，跨断点实时切换安全。

## 参考实现

`runtime/notificationCenter.ts`（账本与各源挂账钩子）+
`components/HkNotificationBell.tsx`（铃铛 + 面板一体组合）。
数据源经 `recordNotification` / `setNotificationState` 写入；
宿主挂 `<HkNotificationBell />` 并决定它住在哪。
