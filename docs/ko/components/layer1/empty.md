# Empty

Empty 컴포넌트는 데이터가 없는 상태를 표시합니다.

## 기본 사용법

```hikari
rsx! {
    div { style: "padding:2rem;text-align:center;color:#999;",
        p { style: "font-size:14px;margin:0;", "No data available" }
    }
}
```

## API

| 속성 | 설명 | 타입 | 기본값 |
|------|------|------|--------|
| description | 설명 텍스트 | Option\<String\> | None |
