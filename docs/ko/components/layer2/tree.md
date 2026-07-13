# Tree

Tree 컴포넌트는 계층적 데이터를 표시합니다.

## 기본 사용법

```hikari
rsx! {
    div { style: "padding:1rem;font-size:14px;",
        div { style: "padding:4px 0;cursor:pointer;font-weight:500;", "▼ src" }
        div { style: "padding:4px 0 4px 20px;", "main.rs" }
        div { style: "padding:4px 0 4px 20px;", "lib.rs" }
        div { style: "padding:4px 0;cursor:pointer;", "▶ tests" }
    }
}
```

## API

| 속성 | 설명 | 타입 | 기본값 |
|------|------|------|--------|
| data | 트리 데이터 | Vec\<TreeNode\> | - |
| selected | 선택된 노드 | Option\<String\> | None |
