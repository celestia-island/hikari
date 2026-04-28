# Cascader

Cascader는 다단계 데이터 선택에 사용됩니다.

## 기본 사용법

```_hikari_component
pages/components/layer2/cascader#basic
```

## API

| 속성 | 설명 | 타입 | 기본값 |
|------|------|------|--------|
| options | 옵션 데이터 | Vec\<CascaderOption\> | - |
| value | 현재 값 | Option\<String\> | None |
| on_change | 변경 콜백 | EventHandler\<String\> | - |
