# Ubicación del dock: pin o ride

Un dock es chrome que pertenece a una región — una barra bajo un tablero, un paginador en una
esquina. Dentro de una región con scroll el dock se monta en una ranura de `HkScrollContainer`
(`dockBottom` / `dockTop`), y el contenedor ofrece dos formas de colocar un dock inferior
(`dockMode`).

## `pin` — predeterminado

El dock es un hermano flex **sin scroll** del viewport: permanece en el borde del contenedor,
nunca se desplaza, y el viewport se encoge en su altura.

Adecuado para chrome que es dueño del marco de la región — una barra de progreso sobre un log,
una barra de herramientas alineada con los bordes del panel.

El aire entre el final del contenido y el dock es el que deja la ventana: con contenido corto
queda una banda muerta de altura de ventana sobrante entre ambos.

## `ride`

El dock entra en el flujo del viewport, después del contenido, detrás de un espaciador de
exactamente la altura **medida** del dock, y se pega al borde inferior visible
(`position: sticky; bottom: 0`):

- contenido corto — el dock sigue el final del contenido en su posición de flujo, el aire sobre
  él mide exactamente una altura de dock, y la altura de ventana sobrante cae **debajo** del dock;
- contenido largo — el dock se queda en el borde inferior visible (nunca se desplaza fuera), y
  al llegar al final del scroll se abre el mismo aire de una altura de dock.

Adecuado para chrome que pertenece al CONTENIDO — la barra inferior de un lienzo de crucero, de
pie bajo su última fila. El contenedor mide el dock y publica `--hk-scroll-dock-bottom`: el host
ya no escribe recetas de espaciador ni valores mágicos, y el aire sigue cada recomposición del
dock (una fila que cambia, un cambio de breakpoint).

## Ride no es una reserva a nivel de marco

Ride **no** es la receta retirada que reservaba `altura del dock + respiración` en el viewport con
un `::after` para un dock flotante sobre el área de scroll desde fuera del flujo. Esa banda
aparecía como aire muerto *antes* del final del scroll, y el dock nunca seguía el contenido. El
cuerpo del dock en ride es el hijo dentro del flujo: no se pre-reserva nada para algo pintado en
otro lugar, y es la caja sticky la que hace que el aire siga al contenido y no a la ventana.

## Cómo elegir

| Host | Ubicación |
|---|---|
| Región con scroll, el chrome pertenece al contenido | `dockMode="ride"` |
| Región con scroll, el chrome es dueño del marco | `dockMode="pin"` |
| Superposición de lienzo / página, ninguna región con scroll lo posee | `HkDockBar` |

`ride` solo existe en la cola vertical: los contenedores `axis="horizontal"` mantienen `pin`,
porque su cola es el eje transversal.
