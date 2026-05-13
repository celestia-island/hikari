# Tag

Tag 컴포넌트는 레이블이나 표시를 표시하는 데 사용됩니다.

## 기본 사용법

```_hikari_component
pages/components/layer1/tag#basic
```

## 닫기 가능한 태그

```_hikari_component
pages/components/layer1/tag#closable
```

## API

| 속성 | 설명 | 타입 | 기본값 |
|------|------|------|--------|
| children | 태그 내용 | Element | - |
| closable | 닫기 가능 여부 | bool | false |
| on_close | 닫기 콜백 | Option\<EventHandler\> | None |
