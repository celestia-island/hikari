# Pagination

Pagination 컴포넌트는 데이터 페이징을 위한 컴포넌트입니다.

## 기본 사용법

```hikari
rsx! {
    div { style: "padding:1rem;display:flex;gap:4px;align-items:center;font-size:14px;",
        button { style: "padding:4px 10px;border:1px solid #ccc;border-radius:4px;cursor:pointer;", "‹" }
        span { style: "padding:4px 10px;background:#3a6ea5;color:#fff;border-radius:4px;", "1" }
        button { style: "padding:4px 10px;border:1px solid #ccc;border-radius:4px;cursor:pointer;", "2" }
        button { style: "padding:4px 10px;border:1px solid #ccc;border-radius:4px;cursor:pointer;", "›" }
    }
}
```

## API

| 속성 | 설명 | 타입 | 기본값 |
|------|------|------|--------|
| total | 전체 개수 | usize | 0 |
| page_size | 페이지당 항목 수 | usize | 10 |
| current | 현재 페이지 | usize | 1 |
