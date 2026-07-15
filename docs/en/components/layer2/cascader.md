# Cascader

Cascader is used for multi-level data selection.

## Basic Usage

```hikari
rsx! {
    div { style: "padding:1rem;",
        select { style: "padding:6px 12px;border:1px solid #ccc;border-radius:4px;font-size:14px;",
            option { "Province / City / District" }
        }
    }
}
```

## API

| Property | Description | Type | Default |
|----------|-------------|------|---------|
| options | Option data | Vec\<CascaderOption\> | - |
| value | Current value | Option\<String\> | None |
| on_change | Change callback | EventHandler\<String\> | - |
