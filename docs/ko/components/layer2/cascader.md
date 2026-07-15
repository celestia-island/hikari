# Cascader

Cascader는 다단계 데이터 선택에 사용됩니다.

## 기본 사용법

```hikari
rsx! {
    div { style: "padding:1rem;",
        select { style: "padding:6px 12px;border:1px solid #ccc;border-radius:4px;font-size:14px;",
            option { "Province / City / District" }
        }
    }
}
```

## API

| 속성 | 설명 | 타입 | 기본값 |
|------|------|------|--------|
| options | 옵션 데이터 | Vec\<CascaderOption\> | - |
| value | 현재 값 | Option\<String\> | None |
| on_change | 변경 콜백 | EventHandler\<String\> | - |
