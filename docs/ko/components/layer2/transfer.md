# Transfer

Transfer 컴포넌트는 이중 컬럼 데이터 선택을 위한 컴포넌트입니다.

## 기본 사용법

```hikari
rsx! {
    div { style: "padding:1rem;display:flex;gap:8px;align-items:center;",
        div { style: "width:120px;border:1px solid #e2e2ea;border-radius:4px;padding:8px;font-size:14px;",
            div { style: "padding:4px 0;cursor:pointer;", "☐ Item 1" }
            div { style: "padding:4px 0;cursor:pointer;color:#999;", "☑ Item 2" }
        }
        div { style: "display:flex;flex-direction:column;gap:4px;",
            button { style: "padding:4px 8px;border:1px solid #ccc;border-radius:4px;cursor:pointer;", "→" }
            button { style: "padding:4px 8px;border:1px solid #ccc;border-radius:4px;cursor:pointer;", "←" }
        }
        div { style: "width:120px;border:1px solid #e2e2ea;border-radius:4px;padding:8px;font-size:14px;",
            div { style: "padding:4px 0;", "Item 2" }
        }
    }
}
```

## API

| 속성 | 설명 | 타입 | 기본값 |
|------|------|------|--------|
| source | 소스 데이터 | Vec\<TransferItem\> | - |
| target | 타겟 데이터 | Vec\<String\> | - |
