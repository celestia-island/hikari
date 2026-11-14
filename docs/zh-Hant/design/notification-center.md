# 通知中心：關閉語法

關閉一條通知絕不等於丟失它。每一個會消失的面——角落 toast 堆疊、阻斷式確認門、
全螢幕緊急警告帶、宿主的駐留 chip——都要把它展示過的內容記入通知中心帳本，
然後由一枚鈴鐺在宿主掛載的任意位置把這份列表重新呼出。

## 預設收納什麼

按用戶裁決（2026-11-15），預設只收值得回看的：

- error / warning toast；已答覆的阻斷門；全部緊急警告 episode
  （active、snoozed、cleared——已恢復的條件保留可回看）；宿主顯式記帳的駐留 chip。
- success / info / loading toast 逐條 opt-in（push 時 `journal: true`）——
  把每條 3 秒的「已儲存」都記進列表只會把有用資訊淹沒在噪音裡。

## 留存與重放

帳本是會話級留存：sessionStorage 跨重新整理存活、隨瀏覽器工作階段消失，
外加 100 條環形緩衝（按最後更新時間丟最舊）。記錄只是**記錄**——
toast 的動作按鈕是呼叫方閉包，永遠不會從列表裡重放。唯一可逆的例外是
被 snooze 的緊急警告：條目自帶真實的解除隱藏通路（「重新顯示」讓警告帶回歸）。

## 已讀規則

打開面板本身就是已讀回執。鈴鐺自己的下標點（圖示按鈕內建 dot，不是外包一層角標）
回答的是「我是不是錯過了什麼」，不是「現在螢幕上有沒有東西」。

## 擺放

擺放归宿主決定——hikari 只擁有儲存語法與元件。管理/控制台面的參考擺放：
右上角動作區、**設定齒輪左側**的鈴鐺圖示按鈕（chest webui 的
HeaderEndCluster），帶額外視窗控制鈕的桌面殼不受影響（它們在齒輪右側）。
它絕不是頁面正文按鈕，也絕不走頁面作用域的動作槽註冊（頁面 chrome 隨頁卸載，
鈴鐺是全域件）。

觸發鈕是尺寸階梯上的 `HkIconButton`；面板是 `sheetOnMobile` 的
`HkPopover`——寬螢幕為錨定彈層，手機為底部 sheet，跨斷點即時切換安全。

## 參考實作

`runtime/notificationCenter.ts`（帳本與各源記帳掛鉤）+
`components/HkNotificationBell.tsx`（鈴鐺 + 面板一體組合）。
資料源經 `recordNotification` / `setNotificationState` 寫入；
宿主掛 `<HkNotificationBell />` 並決定它住在哪。
