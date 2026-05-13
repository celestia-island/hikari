# Cascader

Cascader is used for multi-level data selection.

## Basic Usage

```_hikari_component
pages/components/layer2/cascader#basic
```

## API

| Property | Description | Type | Default |
|----------|-------------|------|---------|
| options | Option data | Vec\<CascaderOption\> | - |
| value | Current value | Option\<String\> | None |
| on_change | Change callback | EventHandler\<String\> | - |
