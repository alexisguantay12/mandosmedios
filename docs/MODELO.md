# Modelo y decisiones

## Entidades

| Modelo | Propósito |
| --- | --- |
| Área | Nombre, color y condición activa; origen y participación en temas. |
| Responsable | Persona responsable sin restricción por área. Cuenta Django opcional. |
| TipoTema | Maestro dinámico de clasificación. |
| Estado | Nombre, código estable, orden, inicial/resuelto, activo. |
| Tema | Título, descripción, impacto, prioridad, relaciones, autor, fechas, versión y origen de migración. |
| Comentario | Texto humano, usuario que lo carga, fecha, indicador histórico y reunión opcional. |
| ActividadTema | Evento automático, campo, anterior/nuevo en JSON, actor, fecha y reunión opcional. |
| Reunión | Ancla mínima con título, fecha y moderador. Sin API, pantallas o administración en V1. |

### Autoría

El usuario autenticado se determina en el servidor. No se acepta que el frontend asigne el creador, el actor de actividad ni el autor de un comentario. Los usuarios referenciados se protegen de borrado con `PROTECT`; se recomienda desactivar cuentas para preservar la historia.

El responsable puede no tener usuario. Se utiliza un maestro independiente para permitir personas responsables que no inician sesión. Nombre único sin distinguir mayúsculas/minúsculas; si hay homónimos, usar un identificador visible acordado (por ejemplo nombre y segundo apellido), no fusionar personas automáticamente.

### Cambios y concurrencia

`services.py` es la frontera de escritura. Creación, modificación y comentario se ejecutan en una transacción. Edición y estado bloquean la fila y comparan `version`; la primera escritura incrementa el contador. Una solicitud basada en una versión anterior recibe 409, sin escritura ni evento parcial. Agregar un comentario también incrementa la versión porque cambia la fecha de actualización.

Se registra un evento por campo modificado y uno por cada área agregada o quitada. El evento de creación incluye una instantánea de los campos iniciales. Relaciones se guardan como ID y nombre en el evento para poder interpretar cambios aunque se renombre un maestro posteriormente. Los comentarios no generan eventos duplicados: pertenecen a una colección independiente con su propio autor y fecha.

Cambiar a resuelto asigna `fecha_resolucion`. Reabrir la limpia, pero el evento anterior permanece. Guardar el mismo estado o los mismos campos no genera una modificación ficticia.

Los operadores autenticados tienen acceso institucional compartido. Los permisos de Django Admin son independientes. No hay autorización por sector en esta V1.

### Datos históricos

El autor del tema importado es la cuenta que ejecutó la importación. Remitente histórico y todas las celdas originales se conservan en `datos_migracion`; no se afirma que un nombre de planilla corresponde a una cuenta actual. La fecha original se utiliza cuando es interpretable. Sin fecha de resolución confirmada, un tema resuelto queda con resolución nula; no se inventa.

No hay borrado normal de registros auditados. Un administrador de la base podría modificar datos directamente: la trazabilidad de aplicación no es un registro criptográfico ni reemplaza controles de acceso, respaldo y auditoría del servidor de base de datos.

## Reuniones: extensión prevista

Ya existen relaciones opcionales desde comentarios y actividad a `Reunion`, pero no se publican escrituras de reuniones. De esa forma no se simulan asistentes ni se agregan pantallas a V1.

La siguiente versión puede incorporar:

1. Servicio de creación que asigne `moderador=request.user` e inicialice asistentes desde un conjunto de usuarios definido por el hospital.
2. `Asistencia(reunion, usuario, presente, motivo_ausencia)` con unicidad reunión/usuario. Presente por defecto. Al desmarcar, motivo obligatorio: LAR, Necesidad de servicio o Sin justificación. Al volver a marcar, limpiar el motivo y conservar el evento de cambio.
3. Tabla de temas tratados por reunión; no todos los temas deben considerarse tratados por el solo hecho de existir.
4. Pasar una reunión validada a los servicios de comentarios/actividad; no aceptar cualquier ID sin comprobar la reunión y su contexto.
5. Generar minuta desde asistentes, temas tratados, comentarios y eventos vinculados, preservando fechas y valores originales. Los cambios anteriores o posteriores a la reunión quedan fuera salvo inclusión explícita.

La lista de usuarios convocados y las reglas para cerrar/editar minutas deberán definirse en esa versión. No condicionan el uso de temas en V1.
