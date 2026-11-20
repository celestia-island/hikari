# Centro de notificaciones: la gramática del descarte

Descartar una notificación nunca debe significar perderla. Cada
superficie que desaparece — la pila de toasts de esquina, las puertas
de confirmación bloqueantes, la banda de emergencia a pantalla
completa, las fichas persistentes de un anfitrión — registra lo que
mostró en el diario del centro de notificaciones, y una campana vuelve
a invocar la lista donde el anfitrión la monte.

## Qué se registra por defecto

Por decisión del usuario (2026-11-15), solo los tonos que merecen una
segunda mirada:

- toasts error y warning; puertas bloqueantes resueltas; todos los
  episodios de alerta de emergencia (active, snoozed y cleared — las
  condiciones resueltas siguen consultables); fichas persistentes
  que un anfitrión registra explícitamente.
- los toasts success / info / loading entran por push con
  `journal: true` — registrar cada «Guardado.» de 3 segundos solo
  hundiría la lista en ruido.

## Retención y reejecución

El diario dura lo que la sesión: el sessionStorage sobrevive a las
recargas y muere con la sesión del navegador, sobre un anillo de 100
entradas (la más antigua cae por última actualización). Un registro es
solo un REGISTRO — el botón de acción de un toast es una closure del
llamador y nunca se reejecuta desde la lista. El único caso reversible
es una alerta de emergencia en snooze: su entrada lleva el camino real
de unsnooze («Mostrar de nuevo» devuelve la banda).

## La regla de lectura

Abrir el panel ES el recibo de lectura. El punto propio de la campana
(la marca integrada del botón de icono, no una insignia envolvente)
responde a «¿me perdí algo?», no a «¿hay algo en pantalla ahora?».

## Colocación

La colocación pertenece al consumidor — hikari posee la gramática de
almacenamiento y los componentes. Colocación de referencia para las
caras admin/consola: un botón de icono de campana en el clúster de
acciones superior derecho, **a la izquierda del engranaje de
ajustes** (el HeaderEndCluster del webui de chest) — los shells de
escritorio con controles de ventana extra quedan intactos en el extremo
derecho. Nunca es un botón del cuerpo de página, y nunca se registra
mediante un slot de acción con alcance de página (el chrome de página se
desmonta con la página; la campana es global).

El disparador es un `HkIconButton` en la escalera de tamaños del
chrome; la superficie es un `HkPopover` con `sheetOnMobile` — flotante
anclada en pantallas anchas, hoja inferior en teléfonos, con cruce del
punto de ruptura seguro en vivo.

## Movimiento

La entrada y la salida de filas las coreografía `HkListTransition` —la
primitiva de listas de la biblioteca, la misma que ya usan las migas de
los modales, el campo de etiquetas, la superficie de contraseña, el
selector de afijos, el waterfall y el árbol JSON— en su variante `pop`
(un fundido que se posa desde un leve escalado) con desplazamientos
FLIP: las filas que quedan se deslizan al espacio que libera la
descartada. Dos propiedades vienen de la primitiva y de la plataforma,
no de la campana: **reporta** cada lote de entrada/salida al contexto de
animación en tiempo de ejecución (`runtime/animationBus.ts`, para que
los pares JS sepan que hay una transición en curso), y sus propias
reglas de reducción de movimiento, junto con el interruptor global de
animaciones CSS (`html[data-css-animations="0"]`), pliegan el
movimiento.

Tres consecuencias comprobables:

- Abrir el panel no reproduce la entrada de la lista (`appear` sigue
  desactivado): solo se animan las filas que de verdad llegan o se van.
- El contenedor de la lista sobrevive al cambio a estado vacío: un diario
  sin filas mantiene la lista montada, porque desmontar un grupo de
  transiciones cancela sus fantasmas salientes en pleno vuelo.
- El paso a vacío ocurre en dos tiempos: mientras la última fila (o
  «Borrar todo») se desvanece, la lista conserva su última altura —una
  fila saliente se posiciona DENTRO del contenedor de desplazamiento, así
  que una lista colapsada recortaría su propio fantasma— y el texto
  «Aún no hay notificaciones» solo aparece al terminar la ventana de
  salida.

## Implementación de referencia

`runtime/notificationCenter.ts` (el diario y sus ganchos fuente) +
`components/HkNotificationBell.tsx` (campana + panel en una sola
composición). Las fuentes escriben mediante `recordNotification` /
`setNotificationState`; los anfitriones montan `<HkNotificationBell />`
y deciden dónde vive.

Los ids que registra el anfitrión comparten un espacio de cadenas plano con los espejos integrados: los prefijos `toast:` / `blocking:` / `emergency:` están reservados por ellos — un anfitrión que registre fichas persistentes o elementos propios elige su propio prefijo (p. ej. `myapp:`) para que un id personalizado nunca pueda secuestrar un episodio integrado.

## La excepción de emergencia

Las filas de emergencia son la única excepción: mientras el episodio está VIVO (activo o snoozed), la fila no lleva control de descarte — su entrada del diario contiene la única guía de restauración de la alerta, y un re-raise sondeado resucitaría una fila borrada. El gesto del usuario se aplica a registros (toasts, puertas de confirmación, emergencias resueltas que siguen consultables), nunca a un episodio vivo.
