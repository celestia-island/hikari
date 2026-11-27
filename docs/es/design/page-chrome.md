# Cromo de página: la gramática de la barra de acciones

Las páginas de administración y consola comparten UN contrato de cabecera: la
página posee el grupo de acciones de la esquina superior derecha mediante
slots de propósito declarado, y es en ese grupo — no en el cuerpo de la
página — donde viven sus affordances principales.

## Los slots canónicos

Cada registro declara un PROPÓSITO; el grupo renderiza los slots canónicos por
rango, sin importar el orden en que las vistas se registran:

```text
[crear][filtrar][buscar][refrescar][ventana]
```

Los registros cuyo propósito no es uno de los slots canónicos son
personalizados: se renderizan DESPUÉS de la zona canónica, compactados de
derecha a izquierda en orden de registro inverso — la zona canónica nunca se
mueve.

## La regla de creación

La acción de creación principal de una página — la que crea una nueva entidad
de primer nivel (un proveedor, un canal, un grupo, una regla de acceso, un
tema en la línea compartida) — es un **botón de icono más en el grupo de la
esquina superior derecha, a la izquierda de la actualización**. Nunca es un botón
independiente dentro del cuerpo de la página.

La etiqueta visible que habría llevado el botón del cuerpo se convierte en el
nombre accesible y el tooltip del botón; la página sigue siendo dueña de su
propio diálogo de creación.

**Las adiciones en contexto están exentas.** Un más que añade una fila a una
sublista dentro de un editor, diálogo, asistente o tarjeta («añadir una fila
de modelo», «añadir un miembro», «añadir un montaje») forma parte de la
gramática local, no de la acción de creación de la página — se queda donde
está.

## Geometría

El grupo es una sola fila de cromo: cada botón de icono sigue la misma escala
de tamaños (`useChromeActionSize`), con glifos de 16 px. Un botón de tamaño
fijo entre vecinos de tamaño de escala se lee como otra familia — monta el
grupo con los helpers compartidos, nunca tamaños clavados a mano.

## Implementación de referencia

hikari suministra el cromo: la fila de acciones de `HkAdminHeader`,
`HkIconButton` y `useChromeActionSize`. Los anfitriones se registran mediante
el par de composables `provideActionBar` / `useActionBar`, que renderiza los
slots de arriba; es la implementación de referencia de esta gramática.

## Replegado móvil

Un grupo de botones anclado en el slot central del encabezado o del pie
se replega en ventanas de anchura telefónica (<768, `useBreakpoint().isMobile`
— el umbral de la familia sheet): la tira se convierte en un disparador
tipo selector que nombra el elemento ACTIVO, y sus opciones abren como
hoja inferior (`HkSelectPanel` con `sheetOnMobile`). Un único contrato
de valor gobierna ambas formas — los enlaces profundos `?tab=` sobreviven
al punto de ruptura. `HkAdaptiveTabs` es la implementación por defecto;
los conmutadores de listas de proyectos dinámicas con filas propias (el selector de
plataforma) son el caso especial exento, no el modelo a copiar.

## Hojas de selector y búsqueda fijada

Una superficie desplegable (`HkSelectPanel`, bajo `HkSelect` / `HkMenu` / los
selectores con pastilla) tiene dos bandas de contenido, y a qué banda
pertenece cada cosa no se negocia:

- **`default` se desplaza.** Filas, tarjetas, catálogos — todo lo que puede
  superar la superficie.
- **`pinnedHeader` no se desplaza.** El cromo que debe seguir al alcance
  mientras la lista se desplaza: primero, el campo de filtrado en vivo. Se
  pinta fuera de la zona de desplazamiento en ambas formas — una banda bajo
  la fila de título de la hoja en el teléfono, la cabeza de la columna del
  popout en escritorio (cuyo cuerpo aloja entonces la única barra de
  desplazamiento). Un campo de búsqueda dentro del contenido desplazable se
  va con el primer gesto; es un defecto, no una elección de estilo
  (2026-11-27).

Las hojas de teléfono de la familia selector/menú se ajustan a su contenido
hasta el **80 % de la vista**; el contenido más largo se desplaza dentro. Un
tope ajustado para el popout de escritorio (`maxHeight`, p. ej.
`min(18rem, 45dvh)`) nunca llega a la hoja. La hoja también corta la
encadenación del desplazamiento: un gesto en el tirador, la fila de título o
la banda fijada nunca arrastra la página de atrás.

## Movimiento de listas

Siempre que cambien los elementos de una lista — añadidos, quitados,
reordenados — el desplazamiento pasa por `HkListTransition` de hikari (un
`TransitionGroup` con clave cuyo FLIP se informa al bus de animación del
runtime), nunca un tween hecho a mano. Un solo valor por defecto para toda
superficie con forma de lista (filas, tarjetas, cascadas): la pista de
movimiento dura 0,3 s, la entrada y la salida 0,15 s cada una y empiezan a la
vez que el movimiento. El anfitrión personaliza con las props `duration` /
`enterDuration` / `leaveDuration` (tiempos CSS; un `duration` solo deriva
las dos mitades). `surface` es la única excepción (las filas que son
ventanas conservan los tiempos de entrada/salida de la familia ventana).

Dos reglas permanentes para el anfitrión: una lista que vive directamente dentro de un viewport de desplazamiento mantiene `move` apagado (el fantasma saliente se fija al ancestro posicionado más cercano, y un scrollport no es la caja visual de la lista); y una fila de lista nunca lleva `transition: all` — las pistas del primitivo se hacen cargo del `transition` de la fila durante la duración de una sola coreografía, y una pista `all` perdería su cara de hover en esa ventana.

Un selector múltiple (`HkAffixPicker` en modo `multi`, `layout="rows"`) no
construye nada delante de la búsqueda para su selección: las filas marcadas
llevan la marca de verificación inicial y flotan arriba en orden de catálogo
tras un separador; un toque alterna la fila y ésta se desliza hacia o desde
su hueco. `layout="tags"` es la forma de editor de valores (un valor escrito
por entrada) y conserva la lista de pastillas sobre la búsqueda.

## Texto de las esquinas del pie

El texto en cualquiera de las seis esquinas de cabecera/pie (izquierda/centro/
derecha ×2) va a través de `HkCornerText` de hikari: una instancia = una vía de
texto para una esquina.

- `align` elige la esquina: `start` (esquinas izquierdas) / `center` (vía
  central) / `end` (esquinas derechas); las líneas envueltas se pegan al mismo
  borde — una vía de esquina derecha sigue alineada a la derecha tras el salto.
- Las entradas son átomos `nowrap`: la vía salta de línea ENTRE entradas,
  nunca dentro de una (un número de registro no debe cortarse a mitad).
- Por defecto, tinta cromo atenuada (`text-2xs` + opacidad 0.6); `muted: false`
  restaura la tinta completa.
- Varias líneas en una esquina (línea de identidad sobre la línea de
  registros): apilar instancias verticalmente — la banda de estado fija de
  3rem contiene dos líneas text-2xs.
- Una entrada de `items` es `{ key, text, href? }`: `key` es la identidad estable
  que usa el renderizador de lista, `text` es el texto visible (un número de
  registro, un nombre de sistema, …) y `href` es opcional — si se omite, la
  entrada se dibuja como un `<span>` simple; si se da, como un enlace.
- La entrada con `href` siempre abre en una pestaña nueva: `target="_blank"` más
  `rel="noopener noreferrer"` (el mismo contrato que el número de registro — un
  sitio ajeno nunca debe tener un asa sobre la ventana de la página de acceso).
  Eso es el comportamiento del componente: el anfitrión no debe envolver las
  entradas en su propio `<a>`.
- Las entradas-enlace (registros) usan `items` + `as="nav"` + `ariaLabel`; el
  contenido libre (chip de estado) va por el slot por defecto, tras `items`.

Los anfitriones no deben escribir a mano vías apretadas con
`flex-wrap: nowrap` ni dejar que el texto pinte fuera de una banda de altura
fija. Implementación de referencia: `HkCornerText`.
