# Table

구조화된 데이터를 표시하기 위한 테이블 컴포넌트입니다.

## 기본 사용법

```hikari
rsx! {
    div { style: "padding:1rem;",
        table { style: "border-collapse:collapse;width:100%;font-size:14px;",
            thead { tr { th { style: "border:1px solid #e2e2ea;padding:8px;background:#f7f7fa;text-align:left;", "Name" }
                         th { style: "border:1px solid #e2e2ea;padding:8px;background:#f7f7fa;text-align:left;", "Status" } } }
            tbody { tr { td { style: "border:1px solid #e2e2ea;padding:8px;", "Task A" }
                         td { style: "border:1px solid #e2e2ea;padding:8px;color:#22c55e;", "Done" } } }
        }
    }
}
```

## API

| 속성 | 설명 | 타입 | 기본값 |
|------|------|------|--------|
| columns | 열 정의 | Vec\<Column\> | - |
| data | 데이터 소스 | Vec\<T\> | - |

## 편집 가능 테이블

`HkEditableTable` 은 **`HkTable` 위에 조립한** 인라인 편집 셸입니다. 그리드, 헤더 리듬, 호버, 섹션 밴드, 구조는 `HkTable` 에 남고 셸은 편집 가능한 셀, 추가/삭제 어포던스, 행 단위 검증만 더합니다. 완전히 **제어**되는 컴포넌트로, 행 객체와 배열은 호스트가 소유하며 `add` / `remove(row, index)` 의도를 호스트가 직접 적용합니다. 셸은 행을 절대 변경하지 않으므로 실행 취소 스택이나 서버 초안이 가능합니다.

```hikari:tsx
<HkEditableTable
  columns={[
    { key: "tier", title: "요금제" },
    { key: "price", title: "단가", align: "right" },
  ]}
  rows={rows}
  rowKey="id"
  canAdd
  canRemove={() => rows.length > 1}
  validate={(row) => (row.price ? null : "단가는 필수입니다")}
  onAdd={() => rows.push(draftRow())}
  onRemove={(row) => rows.splice(rows.indexOf(row), 1)}
>
  {{
    "cell-tier": ({ row }) => <span>{row.tier}</span>,
    "edit-price": ({ row, error, errorId }) => (
      <HkMoneyInput
        currency={usd}
        error={error ?? undefined}
        aria-describedby={errorId ?? undefined}
        modelValue={row.price}
        onUpdate:modelValue={(next: string) => (row.price = next)}
      />
    ),
    "row-error": ({ index, error }) => <span>{index + 1}행: {error}</span>,
  }}
</HkEditableTable>
```

슬롯 계약: `cell-<key>` 는 열의 표시(생략 시 `HkTable` 의 `row[key]` 텍스트), `edit-<key>` 는 호스트 소유 편집기(활성 상태에서는 이것이 우선하며, `disabled` 이면 표시 슬롯으로 돌아가므로 슬롯을 다시 쓰지 않고도 읽기 전용이 됩니다), `row-error` 는 잘못된 행의 오류 줄(생략 시 현지화된 "N행: 메시지")을 렌더링합니다. 모든 셀 슬롯은 `{ row, value, index, error, errorId, disabled }` 를 받습니다. `errorId` 를 편집기의 `aria-describedby` 에 연결하면 메시지가 필드와 함께 읽힙니다. 오류 줄은 컴포넌트 내부(페이지 크롬이 아님)에 그려지고 `rowKey` 로 키가 지정되며, 정중한 라이브 리전으로 알립니다.

| 속성 | 설명 | 타입 | 기본값 |
|------|------|------|--------|
| columns | 열 정의 | HkEditableColumn[] | — |
| rows | 호스트 소유 행(변경하지 않음) | Record\<string, unknown\>[] | [] |
| rowKey | 행 식별 필드 | string | — |
| validate | 순수 행 단위 검증기 | (row, rows) => string \| null | — |
| canAdd / canRemove | 추가 밴드 / 행별 삭제 어포던스 렌더링 | bool / (row) => bool | false / — |
| addLabel / emptyText / caption | 현지화 문구 재정의 | string | — |
| disabled | 읽기 전용 모드(편집기는 표시 슬롯으로 대체) | bool | false |
