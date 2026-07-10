# Number Input 숫자 입력

Number Input 컴포넌트는 스테퍼 기능을 지원하는 숫자 입력용입니다.

## 기본 사용법

```hikari
rsx! {
    div { style: "padding:1rem;",
        div { style: "display:inline-flex;border:1px solid #d9d9d9;border-radius:6px;overflow:hidden;",
            button { style: "padding:4px 12px;border:none;background:#f5f5f5;cursor:pointer;", "−" }
            input { type: "text", value: "0", style: "padding:8px;width:60px;border:none;text-align:center;font-size:14px;" }
            button { style: "padding:4px 12px;border:none;background:#f5f5f5;cursor:pointer;", "+" }
        }
    }
}
```

## 크기

3가지 크기 지원: 작음, 중간(기본값), 큼.

```hikari
rsx! {
    div { style: "display:flex;gap:12px;padding:1rem;align-items:center;",
        input { type: "text", value: "1", style: "padding:4px 8px;width:50px;border:1px solid #ccc;border-radius:4px;font-size:12px;text-align:center;" }
        input { type: "text", value: "10", style: "padding:8px 12px;width:60px;border:1px solid #ccc;border-radius:6px;font-size:14px;text-align:center;" }
        input { type: "text", value: "100", style: "padding:12px 16px;width:80px;border:1px solid #ccc;border-radius:8px;font-size:16px;text-align:center;" }
    }
}
```

## 비활성화 상태

```hikari
rsx! {
    div { style: "padding:1rem;",
        div { style: "display:inline-flex;border:1px solid #d9d9d9;border-radius:6px;overflow:hidden;opacity:0.5;",
            button { disabled: true, style: "padding:4px 12px;border:none;background:#f5f5f5;", "−" }
            input { type: "text", value: "0", disabled: true, style: "padding:8px;width:60px;border:none;text-align:center;" }
            button { disabled: true, style: "padding:4px 12px;border:none;background:#f5f5f5;", "+" }
        }
    }
}
```

## 스테퍼와 범위 제한

최소값, 최대값, 스텝 크기를 설정할 수 있습니다.

```hikari
rsx! {
    div { style: "padding:1rem;",
        div { style: "display:inline-flex;border:1px solid #d9d9d9;border-radius:6px;",
            button { style: "padding:8px 16px;border:none;background:#3a6ea5;color:#fff;cursor:pointer;", "−" }
            span { style: "padding:8px 24px;font-size:16px;font-weight:600;", "5" }
            button { style: "padding:8px 16px;border:none;background:#3a6ea5;color:#fff;cursor:pointer;", "+" }
        }
    }
}
```

## API

| 속성 | 설명 | 타입 | 기본값 |
|------|------|------|--------|
| value | 현재 값 | i64 | 0 |
| on_change | 값 변경 콜백 | EventHandler<i64> | - |
| min | 최소값 | Option<i64> | None |
| max | 최대값 | Option<i64> | None |
| step | 스텝 크기 | i64 | 1 |
| disabled | 비활성화 여부 | bool | false |
| size | 크기 | NumberInputSize | Medium |
| class | 사용자 정의 클래스 | String | "" |
| style | 사용자 정의 스타일 | String | "" |

### NumberInputSize

- `Small` - 작은 크기 (24px)
- `Medium` - 중간 크기 (32px, 기본값)
- `Large` - 큰 크기 (40px)
