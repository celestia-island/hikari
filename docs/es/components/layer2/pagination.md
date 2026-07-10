# Pagination

Componente Pagination para paginación de datos.

## Uso Básico

```hikari
rsx! {
    div { style: "padding:1rem;display:flex;gap:4px;align-items:center;font-size:14px;",
        button { style: "padding:4px 10px;border:1px solid #ccc;border-radius:4px;cursor:pointer;", "‹" }
        span { style: "padding:4px 10px;background:#3a6ea5;color:#fff;border-radius:4px;", "1" }
        button { style: "padding:4px 10px;border:1px solid #ccc;border-radius:4px;cursor:pointer;", "2" }
        button { style: "padding:4px 10px;border:1px solid #ccc;border-radius:4px;cursor:pointer;", "›" }
    }
}
```

## API

| Propiedad | Descripción | Tipo | Por Defecto |
|-----------|-------------|------|-------------|
| total | Cantidad total | usize | 0 |
| page_size | Elementos por página | usize | 10 |
| current | Página actual | usize | 1 |
