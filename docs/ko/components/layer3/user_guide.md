# UserGuide

UserGuide 컴포넌트는 기능 소개를 위한 사용자 가이드 컴포넌트입니다.

## 기본 사용법

```hikari
rsx! {
    div { style: "padding:1rem;",
        div { style: "display:flex;align-items:center;gap:12px;margin-bottom:16px;",
            div { style: "width:32px;height:32px;border-radius:50%;background:#3a6ea5;color:#fff;display:flex;align-items:center;justify-content:center;font-weight:600;", "1" }
            div { style: "font-size:14px;", "Welcome! Click here to start." }
        }
        div { style: "display:flex;align-items:center;gap:12px;",
            div { style: "width:32px;height:32px;border-radius:50%;border:2px solid #ccc;color:#999;display:flex;align-items:center;justify-content:center;", "2" }
            div { style: "font-size:14px;color:#999;", "Configure your settings." }
        }
    }
}
```

## API

| 속성 | 설명 | 타입 | 기본값 |
|------|------|------|--------|
| steps | 가이드 단계들 | Vec\<GuideStep\> | - |
| active | 현재 단계 | usize | 0 |
