# Table

構造化データを表示するためのテーブルコンポーネント。

## 基本的な使用方法

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

| プロパティ | 説明 | 型 | デフォルト |
|------------|------|-----|------------|
| columns | 列定義 | Vec\<Column\> | - |
| data | データソース | Vec\<T\> | - |

## 編集可能テーブル

`HkEditableTable` は **`HkTable` の上に組んだ**インライン編集シェルです。グリッド、ヘッダーのリズム、ホバー、セクションバンド、構造は `HkTable` に残り、シェルは編集可能セル、追加／削除の操作、行単位の検証だけを足します。完全に**制御**されたコンポーネントで、行オブジェクトと配列はホストが所有し、`add` / `remove(row, index)` の意図をホスト自身が適用します。シェルは行を一切変更しないため、Undo スタックやサーバー側の下書きが成り立ちます。

```hikari:tsx
<HkEditableTable
  columns={[
    { key: "tier", title: "プラン" },
    { key: "price", title: "単価", align: "right" },
  ]}
  rows={rows}
  rowKey="id"
  canAdd
  canRemove={() => rows.length > 1}
  validate={(row) => (row.price ? null : "単価は必須です")}
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
    "row-error": ({ index, error }) => <span>{index + 1} 行目: {error}</span>,
  }}
</HkEditableTable>
```

スロット契約：`cell-<key>` は列の表示（省略時は `HkTable` の `row[key]` テキスト）、`edit-<key>` はホスト自身のエディタ（有効時はこちらが優先。`disabled` のときは表示スロットに戻るため、スロットを書き換えずに読み取り専用になります）、`row-error` は不正な行のエラー行（省略時はローカライズされた「N 行目: メッセージ」）です。各セルスロットは `{ row, value, index, error, errorId, disabled }` を受け取ります。`errorId` をエディタの `aria-describedby` に結び付ければ、メッセージがフィールドと一緒に読み上げられます。エラー行はコンポーネント内（ページクロームではなく）に描画され、`rowKey` をキーに、控えめなライブリージョンで通知されます。

| プロパティ | 説明 | 型 | 既定値 |
|-----------|------|----|--------|
| columns | 列定義 | HkEditableColumn[] | — |
| rows | ホスト所有の行（変更しない） | Record\<string, unknown\>[] | [] |
| rowKey | 行識別フィールド | string | — |
| validate | 純粋な行単位バリデータ | (row, rows) => string \| null | — |
| canAdd / canRemove | 追加バンド／行ごとの削除操作を描画 | bool / (row) => bool | false / — |
| addLabel / emptyText / caption | ローカライズ文言の上書き | string | — |
| disabled | 読み取り専用（エディタは表示スロットへ戻る） | bool | false |
