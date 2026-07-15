# Empty

Empty component for displaying empty data state.

## Basic Usage

```hikari
rsx! {
    div { style: "padding:2rem;text-align:center;color:#999;",
        p { style: "font-size:14px;margin:0;", "No data available" }
    }
}
```

## API

| Property | Description | Type | Default |
|----------|-------------|------|---------|
| description | Description text | Option\<String\> | None |
