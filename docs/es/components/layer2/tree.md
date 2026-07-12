# Tree

Componente Tree para mostrar datos jerárquicos.

## Uso Básico

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

| Propiedad | Descripción | Tipo | Por Defecto |
|-----------|-------------|------|-------------|
| data | Datos del árbol | Vec\<TreeNode\> | - |
| selected | Nodo seleccionado | Option\<String\> | None |
