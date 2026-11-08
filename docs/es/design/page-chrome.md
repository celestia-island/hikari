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
un contexto de barra de acciones que renderiza los slots de arriba; el
`useActionBar` / `usePageCreateAction` del webui de chest es la implementación
de referencia de esta gramática.
