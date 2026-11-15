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
exactamente la **ocupación medida del dock**, y se pega al borde inferior visible
(`position: sticky; bottom: 0`):

- contenido corto — el dock sigue el final del contenido en su posición de flujo, el aire sobre
  él es esa ocupación medida, y la altura de ventana sobrante cae **debajo** del dock;
- contenido largo — el dock se queda en el borde inferior visible (nunca se desplaza fuera en el
  eje vertical; en un tablero de dos ejes también queda anclado al borde inicial en línea en vez de
  irse con el contenido), y al llegar al final del scroll se abre el mismo aire.

«La ocupación» es la caja que el contenedor mide y publica en `--hk-scroll-dock-bottom`: el hueco
del propio dock, no necesariamente su superficie visible — el espacio que el host pone DENTRO de
esa banda (un inset del dock, el padding final de una fila) se suma, así que el aire coincide con
el dock dentro del padding propio del host. Los hosts leen ese valor publicado en vez de escribir
una receta de espaciador o un valor mágico, y el aire sigue cada recomposición del dock (una fila
que cambia, un cambio de breakpoint).

Un host ride también debe dejar que su contenido termine POR ENCIMA del borde inferior del
viewport: una caja de contenido que se estira hasta la altura del viewport
(`min-height: 100%`) deja el espaciador y el dock del flujo por debajo de la línea de flotación,
así que el dock solo puede pegarse al borde y el aire vuelve a ser la altura de ventana sobrante.
`HkKanban` libera su propia caja de lanes en un tablero ride; un host propio hace lo mismo.

`autoFollow` no se admite junto con un dock ride por la misma razón: ancla abajo una caja de
contenido de altura de pantalla, así que la cola ride cae bajo la línea de flotación. El contenedor
avisa una vez por instancia de contenedor en las compilaciones de desarrollo cuando ambos están
activos.

Mientras está pegado, el envoltorio ride y su espaciador son `pointer-events: none`; la parte del
contenido de la ranura que deba capturar eventos (los controles del propio dock) debe declarar por
sí misma `pointer-events: auto`.

## Ride no es una reserva a nivel de marco

Ride **no** es la receta retirada que reservaba `altura del dock + respiración` en el viewport
con un `::after` para un dock flotante sobre el área de scroll desde fuera del flujo — y tampoco
es «reservar un segundo dock de espacio en blanco». Esa banda aparecía como aire muerto *antes*
del final del scroll, y el dock nunca seguía el contenido. El cuerpo del dock en ride es el hijo
dentro del flujo: no se pre-reserva nada para algo pintado en otro lugar, y es la caja sticky la
que hace que el aire siga al contenido y no a la ventana.

## El espacio de borde

Un dock mantiene una **distancia mínima** en dos lados a la vez, y ambas vienen de una única
familia de tokens, nunca del padding de una página:

- el **inset de reposo** — a qué distancia queda la superficie del dock del borde del viewport al
  que se pega, más el `env(safe-area-inset-*)` de ese borde (un dispositivo con muesca conserva el
  hueco por encima del área segura del sistema, mientras que un escritorio lo resuelve a 0);
- la **banda de contenido** — un padding transparente en la cara del dock que mira al contenido,
  para que el contenido nunca se acerque a la superficie menos que ese mismo hueco.

El valor predeterminado es 16px en cada borde (`--hk-dock-gap`, declarado una sola vez por la capa
foundation). Un dock que necesite más espacio pasa `gap` (una longitud CSS) a `HkDockBar` /
`DockBar`; un host también puede sobrescribir un solo borde con
`--hk-dock-gap-<top|right|bottom|left>` en cualquier ancestro, o todos los bordes a la vez con el
antiguo `--hk-dock-inset`. Los nombres por borde se resuelven donde se leen, así que una
sobrescritura de `--hk-dock-gap` por debajo sigue llegando a todos los bordes.

La banda pertenece al dock, nunca a la vista que lo aloja, y por eso no hace falta padding en la
vista: en una ranura `pin` el dock es un hermano flex del viewport con scroll, así que el viewport
cede la banda por maquetación y un contenido estirado a `min-height: 100%` no puede ocultarla; en un
dock flotante, la caja que el host mide (su propio `getBoundingClientRect`, padding incluido) ya la
contiene.

**La ocupación publicada = banda + superficie + inset**, sea cual sea el modo de colocación. Un
consumidor que reserva la cola del dock lee el valor publicado y NO debe volver a sumar la altura
del dock (ni un inset de dock): ambas distancias ya están dentro. Volver a apilarlas es justo la
banda muerta que este contrato elimina.

## Cómo elegir

| Host | Ubicación |
|---|---|
| Región con scroll, el chrome pertenece al contenido | `dockMode="ride"` |
| Región con scroll, el chrome es dueño del marco | `dockMode="pin"` |
| Superposición de lienzo / página, ninguna región con scroll lo posee | `HkDockBar` |

`ride` solo existe en la cola vertical: los contenedores `axis="horizontal"` mantienen `pin`,
porque su cola es el eje transversal.
