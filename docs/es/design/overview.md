# Arquitectura de paquetes: hikari-components

El sistema de componentes de Hikari vive en un único paquete, `hikari-components`: los
componentes de renderizado escritos con `rsx!`, junto con sus hooks reactivos, sus clases
de paleta tipadas y su CSS `StyledComponent`.

> **Retirado: `hikari-extra-components`.** El paquete incluía, además de los componentes de
> renderizado, unos *modelos de datos* independientes del framework (`TimelineState`,
> `ZoomControlsState`, `GuideStep`, el modelo de grafo de nodos, …), de modo que un mismo
> concepto tenía dos tipos con el mismo nombre: `TimelinePosition` valía `Left` por defecto
> en uno y `Alternate` en el otro. Ningún miembro del workspace dependía de él y el modelo
> de grafo solo lo citaban sus propias pruebas, así que se eliminó. Los componentes que
> duplicaba siguen aquí: `display::{Timeline, DragLayer, UserGuide, ZoomControls}`,
> `production::{VideoPlayer, RichTextEditor, CodeHighlight}`.
