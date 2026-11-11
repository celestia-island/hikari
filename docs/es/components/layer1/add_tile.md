# Add Tile

HkAddTile es el tile punteado estándar para invitar a una acción: el
estado vacío de una lista, la fila «añadir uno más» al final de una
lista y la zona de elegir archivo / soltar archivos. Una anatomía, tres
formas canónicas.

## Uso Básico

```hikari:tsx
<HkAddTile onClick={openAdd}>Aún no hay fuentes — añade una para empezar</HkAddTile>
```

El runtime Vue llega primero; el espejo Rust seguirá cuando un host
Rust consuma el tile.

## Formas

- por defecto — bloque vertical centrado (icono sobre la etiqueta): el
  estado vacío de una lista o panel.
- `compact` — fila fina alineada a la izquierda («＋ añadir uno más»)
  que va al FINAL de una lista de filas en lugar de un botón suelto.
- `droppable` — cualquiera de las formas acepta además arrastres de
  archivos. El estado de arrastre reutiliza el lenguaje de los
  overlays de arrastre existentes (punteado primario sobre un fondo
  primario tenue). Un soltar emite `drop-files` solo si trae al menos
  un archivo — texto y URL se ignoran, así el host puede confiar en la
  carga.

## API

| Property | Description | Type | Default |
|----------|-------------|------|---------|
| disabled | Desactiva el clic y rechaza arrastres | boolean | false |
| droppable | Acepta arrastres de archivos (solo drops no vacíos) | boolean | false |
| compact | Forma de fila fina al final de lista | boolean | false |
| icon | Componente de icono (estilo lucide) | Component | Plus |

| Slot | Description |
|------|-------------|
| default | Texto de la etiqueta |
| icon | Sustituye el glifo por defecto |

| Event | Description |
|-------|-------------|
| click | Tile activado (MouseEvent nativo) |
| drop-files | Soltar con ≥1 archivo — `(files: File[], event: DragEvent)` |
