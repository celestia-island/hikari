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

## Implementación de referencia

`runtime/notificationCenter.ts` (el diario y sus ganchos fuente) +
`components/HkNotificationBell.tsx` (campana + panel en una sola
composición). Las fuentes escriben mediante `recordNotification` /
`setNotificationState`; los anfitriones montan `<HkNotificationBell />`
y deciden dónde vive.
