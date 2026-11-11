# 추가 타일

HkAddTile는「점선으로 동작을 유도하는」표준 컴포넌트입니다: 리스트의 빈
상태, 리스트 끝의 "하나 더 추가" 행, 파일 선택 / 드롭 영역. 하나의 해부학에
세 가지 정식 폼.

## 기본 사용법

```hikari:tsx
<HkAddTile onClick={openAdd}>소스가 없습니다. 하나 추가하여 시작</HkAddTile>
```

Vue 런타임이 먼저 구현되며, Rust 미러는 Rust 호스트의 수요가 생기면
따라갑니다.

## 폼

- 기본: 중앙 정렬 세로 블록(아이콘이 라벨 위) — 리스트 / 패널의 빈 상태.
- `compact`: 얇은 가로 행("＋ 추가") — 행 리스트의 끝에 붙어, 리스트 아래에
  떠 있는 단독 버튼을 대체합니다.
- `droppable`: 어떤 폼이든 파일 드래그를 추가로 받습니다. 드래그 상태는 기존
  드래그 오버레이와 같은 시각 언어(주색 점선 + 옅은 주색 바닥). 파일이 1개
  이상 있을 때만 `drop-files`를 발생시킵니다 — 텍스트 / URL 드롭은 무시되므로
  호스트는 페이로드를 신뢰할 수 있습니다.

## API

| Property | Description | Type | Default |
|----------|-------------|------|---------|
| disabled | 클릭을 비활성화하고 드래그도 거부 | boolean | false |
| droppable | 파일 드래그 수용 (비어 있지 않은 drop만) | boolean | false |
| compact | 리스트 끝 얇은 행 폼 | boolean | false |
| icon | 아이콘 컴포넌트(lucide 스타일) | Component | Plus |

| Slot | Description |
|------|-------------|
| default | 라벨 텍스트 |
| icon | 기본 글리프 대체 |

| Event | Description |
|-------|-------------|
| click | 타일 활성화(네이티브 MouseEvent) |
| drop-files | 파일 1개 이상 포함 드롭 — `(files: File[], event: DragEvent)` |
