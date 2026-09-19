# API REST

Base local `/api/`. JSON. Todos los recursos institucionales requieren una sesión Django válida. CORS no reemplaza autenticación. No se exponen contraseñas, emails, datos de migración completos ni información administrativa de los usuarios desde la API de temas.

## Endpoints

| Método | Ruta | Función |
| --- | --- | --- |
| GET | `/auth/csrf/` | Obtiene token CSRF y cookie; permite acceso anónimo. |
| POST | `/auth/login/` | `username`, `password`; retorna usuario y token CSRF rotado. Requiere CSRF incluso siendo anónimo. |
| POST | `/auth/logout/` | Invalida la sesión, responde 204. |
| GET | `/auth/yo/` | Usuario actual: id, username, nombre, is_staff. |
| POST | `/auth/password/` | `actual`, `nueva`, `confirmar`; validadores Django; mantiene la sesión actual. |
| GET | `/temas/` | Listado paginado. |
| POST | `/temas/` | Crear tema; creador y estado inicial se obtienen del servidor. |
| GET | `/temas/{id}/` | Detalle completo de los campos del tema. |
| PATCH | `/temas/{id}/` | Editar campos; exige `version`. |
| POST | `/temas/{id}/cambiar-estado/` | `estado` (ID) y `version`. |
| GET, POST | `/temas/{id}/comentarios/` | Listar cronológicamente o agregar `texto`. |
| GET | `/temas/{id}/actividad/` | Eventos automáticos cronológicos. |
| GET | `/temas/tablero/` | Columnas con estado, cantidad total y tarjetas iniciales. |
| GET | `/temas/mis-temas/` | Listado creado por la cuenta autenticada. |
| GET | `/areas/` | Áreas y color. Incluye inactivas para interpretar registros previos. |
| GET | `/tipos/` | Tipos de tema. |
| GET | `/estados/` | Estados, orden y semántica. |
| GET | `/responsables/` | Responsables sin relaciones obligatorias con áreas. |

No se admiten DELETE de temas ni cambios de comentarios/actividad. Maestros se modifican en Django Admin.

## Crear

Ejemplo estructural: reemplazar IDs por los devueltos por los maestros.

```json
{
  "titulo": "Demoras en internación",
  "tipo": 1,
  "descripcion": "Descripción del problema detectado.",
  "impacto": "Demoras en el circuito operativo.",
  "prioridad": "alta",
  "area_origen": 1,
  "areas_involucradas": [1, 2],
  "responsable": null
}
```

`titulo` hasta 200 caracteres; `descripcion` obligatoria hasta 30000; `impacto` opcional hasta 15000; comentarios hasta 10000. La prioridad acepta `alta`, `media`, `baja`. Los IDs de registros inactivos no se pueden asignar a nuevos temas; al editar se permite mantener los previamente asignados.

La salida retorna relaciones como objetos, por ejemplo `estado: {id, nombre, codigo, es_resuelto, ...}`. La entrada usa IDs. No enviar estructuras de salida directamente como cuerpo de edición.

## Filtros y paginación

`buscar`, `origen`, `area`, `responsable`, `prioridad`, `estado`, `mios=1`, `resueltos=1`, `page`.

Ejemplo: `/temas/?area=2&prioridad=alta&page=1`.

Las páginas incluyen `count`, `next`, `previous`, `results` y tienen 30 registros. Mis temas y resueltos aceptan los mismos filtros. El tablero recibe los filtros y retorna un array de columnas: `estado`, `cantidad`, `temas`. Muestra 5 por estado resuelto y 30 por estado abierto; el total no se trunca. Los resueltos se ordenan por fecha de resolución descendente, nulos al final; los demás por última actualización e ID descendentes.

## Sesión y errores

Enviar `credentials: include` en fetch. Antes de cualquier escritura obtener `/auth/csrf/` y usar `X-CSRFToken`. Login rota el token y devuelve el nuevo.

| Estado HTTP | Interpretación |
| --- | --- |
| 200 / 201 / 204 | Consulta o modificación / alta / logout. |
| 400 | Validación, credenciales incorrectas o valores inválidos. |
| 401 | No autenticado o sesión vencida; volver a login. |
| 403 | CSRF o permisos insuficientes. No reintentar la escritura sin revisar la causa. |
| 404 | Tema inexistente. |
| 405 | Operación no disponible. |
| 409 | Conflicto de versión: recargar y reconciliar los cambios. |
| 429 | Límite de intentos; esperar el tiempo indicado. |

Las escrituras son atómicas: estado y evento se guardan juntos. El frontend no presenta un cambio de columna como guardado hasta recibir éxito. Las contraseñas usan el hash de Django; el usuario importador tampoco requiere contraseña en texto plano dentro del comando.
