# Comment

Comment 컴포넌트는 댓글 내용을 표시합니다.

## 기본 사용법

```hikari
rsx! {
    div { style: "padding:1rem;border:1px solid #e2e2ea;border-radius:8px;max-width:400px;",
        div { style: "display:flex;align-items:center;gap:8px;margin-bottom:8px;",
            div { style: "width:32px;height:32px;border-radius:50%;background:#3a6ea5;color:#fff;display:flex;align-items:center;justify-content:center;font-size:12px;", "A" }
            span { style: "font-weight:600;font-size:14px;", "Alice" }
            span { style: "color:#999;font-size:12px;margin-left:auto;", "2h ago" }
        }
        p { style: "margin:0;color:#333;font-size:14px;", "This is a great component!" }
    }
}
```

## API

| 속성 | 설명 | 타입 | 기본값 |
|------|------|------|--------|
| author | 작성자 이름 | String | - |
| avatar | 아바타 URL | Option\<String\> | None |
| content | 댓글 내용 | Element | - |
| datetime | 날짜/시간 | Option\<String\> | None |
