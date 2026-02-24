# Search

Search 컴포넌트는 검색 입력을 위한 컴포넌트입니다.

## 기본 사용법

```_hikari_component
pages/components/layer1/search#basic
```

## 음성 입력

음성 입력 기능을 지원합니다. 마이크 아이콘을 클릭하여 녹음을 시작하세요.

```_hikari_component
pages/components/layer1/search#voice
```

## API

| 속성 | 설명 | 타입 | 기본값 |
|------|------|------|--------|
| placeholder | 플레이스홀더 텍스트 | String | "검색..." |
| on_search | 검색 콜백 | Option\<EventHandler\<String\>\> | None |
| voice_input | 음성 입력 활성화 | bool | false |
