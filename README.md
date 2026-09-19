# Temas institucionales · Hospital Privado Santa Clara de Asís

Aplicación de seguimiento para Mandos Medios. Backend Django/DRF y PostgreSQL; frontend Next.js App Router con JavaScript, JSX y CSS. El proyecto se instala localmente; no depende de un servicio de alojamiento propietario.

**Antes de importar el histórico:** no se recibió el Excel real en esta entrega. El importador está implementado y probado con archivos sintéticos. El JSON de ejemplo NO representa un mapeo aprobado de las columnas del hospital. Se debe inspeccionar y mapear el archivo real antes de importarlo. Ver [documentación del importador](docs/IMPORTADOR.md).

## Funciones incluidas

- Login, logout, usuario actual y cambio de contraseña. Sesiones Django en cookie HttpOnly, CSRF y CORS con orígenes explícitos.
- Tablero Kanban, búsqueda, filtros por área de origen, área involucrada, responsable y prioridad.
- PC con mouse: detalle modal y arrastrar tarjetas para cambiar el estado. Celular/tablet: página de detalle completa y cambio de estado mediante botón; sin sensor táctil de drag & drop.
- Alta y edición de temas; descripción e impacto como textos separados; prioridad Alta/Media/Baja.
- Área de origen obligatoria, varias áreas involucradas opcionales y responsable opcional independiente de las áreas.
- Tipos y estados son maestros administrables. Datos iniciales: Problema, Tema Informativo; Nuevo, En curso, Resuelto.
- Comentarios cronológicos, separados del historial automático. Eventos con actor, fecha, campo, valor anterior y nuevo.
- Detección de cambios concurrentes mediante versión y bloqueo transaccional de la fila. Respuesta 409 al intentar sobrescribir una versión desactualizada.
- Cinco resueltos recientes en el tablero y listado paginado para consultar todos. Las columnas abiertas muestran 30 tarjetas y acceso al listado completo.
- «Mis temas» filtra por el usuario creador, no por el responsable.
- Django Admin para usuarios y maestros. Temas, comentarios y actividad son de consulta en Admin para proteger la trazabilidad.
- Importador XLSX con inspección, mapeo externo, conservación de todas las celdas, rechazo de ambigüedades, deduplicación y simulación.

La V1 no tiene adjuntos, fecha objetivo, checklist ni interfaz de reuniones. No tiene eliminación de temas ni edición/borrado de comentarios: se preserva el historial.

## Verificación de esta entrega

**27 pruebas backend y 8 pruebas de navegador aprobadas; build Next.js correcto.** Ver [informe completo y límites](docs/VERIFICACION.md). PostgreSQL debe validarse en el servidor de laboratorio; el Excel real sigue pendiente.

## 1. Requisitos

- Windows 10/11 o Windows Server; PowerShell.
- Python **3.12** de 64 bits, instalado con la opción de agregar Python al PATH.
- Node.js **24 LTS** de 64 bits con npm.
- PostgreSQL **16 o superior**, servicio activo. Instalar servidor y pgAdmin; Stack Builder no es necesario.
- Navegador actualizado: Edge, Chrome, Firefox o Safari. Las pruebas automatizadas de esta entrega se ejecutan en Chromium; ver el informe de pruebas.
- Acceso a Internet durante la instalación de dependencias Python/npm.

Comprobar:

```powershell
py -3.12 --version
node --version
npm --version
```

Descomprimir en una carpeta local, por ejemplo `C:\Sistemas\hpsca-temas\proyecto`. Evitar ejecutar la base o el entorno virtual desde carpetas sincronizadas mientras estén en uso.

## 2. PostgreSQL: instalación y base de datos

Instalar PostgreSQL desde [el sitio oficial](https://www.postgresql.org/download/windows/). Elegir puerto 5432 y definir la contraseña del administrador `postgres`. Abrir pgAdmin, conectarse al servidor y usar Query Tool sobre la base `postgres`.

Ejecutar **por separado**, fuera de una transacción explícita:

```sql
CREATE ROLE hpsca_app LOGIN;
```

Definir una contraseña única para `hpsca_app` desde las propiedades del rol en pgAdmin → Definition → Password. No utilizar una contraseña del ejemplo ni una compartida con otra aplicación.

Después:

```sql
CREATE DATABASE hpsca_temas OWNER hpsca_app ENCODING 'UTF8';
```

El usuario de la aplicación es propietario de su base, no superusuario del servidor. PostgreSQL debe quedar accesible sólo desde el servidor de aplicación o la red autorizada.

## 3. Backend

Abrir PowerShell:

```powershell
cd C:\Sistemas\hpsca-temas\proyecto\backend
py -3.12 -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
Copy-Item .env.example .env
```

Si una política corporativa impide activar scripts, no hace falta cambiarla: usar directamente `.\.venv\Scripts\python.exe` en lugar de `python` en todos los comandos, incluido `-m pip`.

Generar la clave de Django:

```powershell
python -c "from django.core.management.utils import get_random_secret_key; print(get_random_secret_key())"
```

Abrir `backend\.env` con un editor y completar `SECRET_KEY` con la salida, entre comillas dobles. Completar también `DB_PASSWORD`. No copiar el secreto a un documento compartido ni subir `.env` al repositorio.

### Variables del backend

| Variable | Uso y ejemplo local |
| --- | --- |
| `DEBUG` | `True` sólo desarrollo; `False` en producción. |
| `SECRET_KEY` | Cadena aleatoria de al menos 50 caracteres. Obligatoria; sin valor predeterminado de producción. |
| `ALLOWED_HOSTS` | Hosts separados por comas, sin esquema ni puerto: `localhost,127.0.0.1`. |
| `DB_NAME` | `hpsca_temas`. |
| `DB_USER` | `hpsca_app`. |
| `DB_PASSWORD` | Contraseña del rol; usar comillas si contiene espacios o caracteres especiales. |
| `DB_HOST` | `127.0.0.1` o servidor PostgreSQL autorizado. |
| `DB_PORT` | `5432`. |
| `DB_SSLMODE` | `prefer` en conexión local; para conexión remota configurar TLS y `verify-full` con certificados apropiados. |
| `CORS_ALLOWED_ORIGINS` | Orígenes completos del frontend: `http://localhost:3000`. Sin barra final. |
| `CSRF_TRUSTED_ORIGINS` | Orígenes completos autorizados para POST/PATCH: `http://localhost:3000`. |
| `SESSION_COOKIE_SECURE` | `False` para HTTP local; `True` para HTTPS en producción. |
| `CSRF_COOKIE_SECURE` | Mismo criterio que el anterior. |
| `SECURE_SSL_REDIRECT` | `False` local; `True` en producción con proxy HTTPS bien configurado. |
| `SECURE_HSTS_SECONDS` | `0` local; configurar, por ejemplo, `31536000` tras verificar HTTPS. |
| `TRUST_PROXY_HTTPS` | `False` directo; `True` sólo si un proxy confiable reemplaza `X-Forwarded-Proto`. |

Las listas aceptan múltiples valores separados por comas. No configurar `*` para hosts/orígenes. La zona horaria de la aplicación es `America/Argentina/Salta`.

### Migraciones, usuario e inicialización

```powershell
python manage.py check
python manage.py migrate
python manage.py createsuperuser
python manage.py cargar_iniciales
python manage.py runserver 127.0.0.1:8000
```

`cargar_iniciales` es idempotente y no sobrescribe maestros existentes. Las migraciones ya están incluidas; no hace falta ejecutar `makemigrations` al instalar.

Acceder a [Django Admin](http://localhost:8000/admin/) con el superusuario. Cargar:

1. Áreas y sus colores `#RRGGBB`.
2. Responsables. La vinculación a un usuario es opcional; no existe dependencia con un área.
3. Usuarios Django para Mandos Medios; completar nombre y apellido. No necesitan `staff` ni superusuario para usar la aplicación.

`is_staff` permite entrar a Admin según los permisos asignados allí. No otorgar superusuario a todos. La V1 permite a cualquier usuario autenticado ver y actualizar todos los temas: es una decisión explícita del alcance, no un control de acceso por sector.

## 4. Frontend

Dejar el backend en ejecución y abrir **otra** ventana de PowerShell:

```powershell
cd C:\Sistemas\hpsca-temas\proyecto\frontend
Copy-Item .env.example .env.local
npm install
npm run dev
```

Para reproducir exactamente las versiones de esta entrega también se puede usar `npm ci`, que respeta `package-lock.json`.

Contenido de `frontend\.env.local`:

```dotenv
NEXT_PUBLIC_API_URL=http://localhost:8000/api
```

Es la URL que usará el **navegador**, no una dirección interna inaccesible desde los equipos clientes. No lleva `/` al final. Es pública por diseño: no contiene credenciales. Después de cambiarla reiniciar `npm run dev`; en producción volver a ejecutar el build.

Abrir [la aplicación](http://localhost:3000). Ingresar con el usuario Django creado.

**Usar el mismo nombre de host:** si se abre el frontend con `localhost`, la API también debe usar `localhost`. No mezclar `localhost` y `127.0.0.1`, porque las cookies pertenecen a hosts distintos.

## 5. Probar desde un celular de la red local

Obtener la IP LAN del equipo de desarrollo; ejemplo ficticio `192.168.10.50`.

- Backend: añadir esa IP a `ALLOWED_HOSTS`.
- Backend: añadir `http://192.168.10.50:3000` a `CORS_ALLOWED_ORIGINS` y `CSRF_TRUSTED_ORIGINS`.
- Frontend: cambiar la API a `http://192.168.10.50:8000/api`.
- Reiniciar ambos procesos. Django debe escuchar con `python manage.py runserver 0.0.0.0:8000`.
- Permitir puertos 3000 y 8000 sólo en la red privada de pruebas, y abrir `http://192.168.10.50:3000` desde el celular.

Este procedimiento HTTP es únicamente para pruebas en red controlada. El despliegue institucional debe usar HTTPS.

## 6. Uso cotidiano

- **Tablero:** buscar por texto o `#ID`, filtrar y abrir tarjetas.
- **PC con mouse:** arrastrar desde la tarjeta hacia el estado destino; el cambio se confirma en el servidor. Si falla, la tarjeta conserva su ubicación anterior y aparece el error.
- **Celular/tablet:** elegir una pestaña de estado, tocar una tarjeta y usar «Cambiar estado» → seleccionar → «Confirmar estado».
- **Nuevo tema:** el responsable y las áreas adicionales pueden quedar vacíos; el origen es obligatorio.
- **Editar tema:** guardar todos los cambios juntos. Si otra persona actualizó el registro se devuelve 409; cancelar la edición, recargar y volver a aplicar el cambio sobre la versión actual.
- **Comentarios:** el texto es libre. Si se escribe información aportada por otra persona, indicarlo en el texto; el autor registrado siempre es quien lo carga.
- **Actividad:** muestra eventos automáticos, con valores anteriores y nuevos.
- **Resueltos:** «Ver todos los temas resueltos» abre el historial paginado. Los históricos sin fecha de resolución quedan al final; no se inventa la fecha.
- **Mis temas:** lista lo creado por la cuenta actual, aunque otra persona sea responsable.
- **Perfil:** desde el usuario de la barra lateral; permite cambiar la propia contraseña. En celular se accede tocando el avatar.
- **Logout:** usar «Cerrar sesión». No se guardan tokens de acceso en localStorage.

## 7. Importación histórica

Exportar Google Sheets como Microsoft Excel `.xlsx`. No convertir sólo una selección de filas. Mantener una copia intacta del original.

Desde `backend`:

```powershell
python manage.py importar_temas "C:\Migracion\historico.xlsx" --inspect --report "C:\Migracion\inspeccion.json"
```

El comando recorre todas las hojas, filas y columnas. La inspección incluye vacíos, tipos de celdas, ejemplos y todas las filas en el reporte JSON. Puede contener información institucional: proteger el archivo igual que el Excel.

Copiar y adaptar `docs\mapeo_ejemplo.json` después de revisar el contenido real. Usar una cuenta Django dedicada a la importación; no se adivina qué usuario corresponde a un nombre histórico.

```powershell
python manage.py importar_temas "C:\Migracion\historico.xlsx" --mapping "..\docs\mapeo_aprobado.json" --usuario importador --fuente mandos-medios-historico --dry-run --report "C:\Migracion\simulacion.json"
```

Luego, con respaldo y resultados revisados:

```powershell
python manage.py importar_temas "C:\Migracion\historico.xlsx" --mapping "..\docs\mapeo_aprobado.json" --usuario importador --fuente mandos-medios-historico --report "C:\Migracion\resultado.json"
```

`--sheet "Nombre de hoja"` limita a una hoja. `--header-row 3` permite encabezados en otra fila. No cambiar `--fuente` entre reejecuciones de una misma migración. Toda la estrategia, límites y mapeo se explican en [IMPORTADOR.md](docs/IMPORTADOR.md).

## 8. Estructura y mantenimiento

| Ruta | Responsabilidad |
| --- | --- |
| `backend/config/settings.py` | PostgreSQL, cookies, CSRF, CORS, seguridad y entorno. |
| `backend/temas/models.py` | Modelos institucionales y restricciones. |
| `backend/temas/services.py` | Escrituras atómicas, versiones y auditoría; punto central de reglas. |
| `backend/temas/serializers.py` | Contratos y validación de entrada/salida de la API. |
| `backend/temas/views.py` | Endpoints, filtros, paginación y autenticación. |
| `backend/temas/admin.py` | Administración y consulta del historial. |
| `backend/temas/management/commands/` | Datos iniciales, importador y fixture E2E aislado. |
| `backend/temas/migrations/` | Esquema versionado para instalar PostgreSQL. |
| `backend/temas/tests/` | Pruebas automáticas de API e importación. |
| `frontend/app/` | Rutas Next.js y CSS global. |
| `frontend/components/` | Shell, tablero/listado, detalle, formulario, sesión y controles compartidos. |
| `frontend/services/api.js` | Conexión, cookie de sesión, token CSRF y errores. |
| `frontend/public/` | Recursos estáticos. |
| `frontend/tests/` | Recorridos reales de navegador con Playwright. |
| `docs/` | API, modelo, importación y verificación. |

Las páginas React son `.jsx`; servicios/configuración `.js`. No se usa TypeScript. El nombre del paso «Running TypeScript» del build es propio de Next.js y no implica código TypeScript en el proyecto.

### Cambiar estilos

Editar primero las variables `:root` de `frontend/app/globals.css`: colores, radios, sombras, ancho del menú, espacios y fuente. El archivo tiene bloques de navegación, tablero, formularios, detalle, acceso y responsive. La única variable de estilo por elemento es el color del área obtenido del maestro. No se cargan Google Fonts ni recursos de terceros en tiempo de ejecución.

### Agregar tipos y estados

Admin → Tipos de tema → Agregar. Aparecen automáticamente en los formularios, sin cambiar código ni migrar.

Admin → Estados permite nuevos estados con orden y semántica inicial/resuelto. Hay como máximo un estado inicial, que debe permanecer activo. El sistema requiere uno para crear temas. Un estado utilizado no permite cambiar su código ni si representa una resolución; esto evita alterar silenciosamente el significado del histórico. Preferir desactivar maestros en lugar de borrarlos.

## 9. Pruebas y build

Pruebas aisladas sin PostgreSQL:

```powershell
cd backend
python manage.py test temas --settings=config.test_settings
```

Pruebas contra PostgreSQL de laboratorio, con un rol que pueda crear una base **de pruebas**, nunca apuntando deliberadamente a una base con datos reales:

```powershell
python manage.py test temas
```

Django crea una base `test_hpsca_temas` y requiere permiso `CREATEDB` para ese rol de laboratorio. No es un permiso necesario para la cuenta de producción.

Build:

```powershell
cd ..\frontend
npm ci
npm run build
npm run start
```

Para E2E ver [PRUEBAS.md](docs/PRUEBAS.md). Los módulos `config.test_settings` y `config.e2e_settings` usan claves y algoritmos débiles deliberadamente exclusivos de pruebas; **no iniciar producción con esas configuraciones**.

## 10. Producción

1. PostgreSQL con respaldo programado, pruebas de restauración y credenciales propias.
2. `.env` real fuera del control de versiones. `DEBUG=False`, hosts/orígenes exactos, cookies seguras, redirección HTTPS. Ejecutar `python manage.py check --deploy` y resolver sus observaciones para el entorno.
3. Frontend: `npm ci`, `npm run build`, `npm run start`. La URL pública de API queda incorporada en el build. No usar `next dev` en producción.
4. Backend Windows: `waitress-serve --listen=127.0.0.1:8000 config.wsgi:application`. Configurar el proceso como servicio con inicio automático y cuenta de servicio limitada. No usar `runserver`.
5. Ejecutar `python manage.py collectstatic --noinput`. El proxy debe servir `/static/` desde `backend/staticfiles`, necesario para Django Admin.
6. Proxy inverso HTTPS institucional: una URL, por ejemplo `https://temas.hospital.example`. Dirigir `/api/` y `/admin/` a Django, `/static/` a estáticos y el resto a Next. Es preferible un mismo origen para simplificar cookies. También se admite frontend/API en subdominios del mismo sitio con CORS y CSRF exactos.
7. Si el proxy termina TLS, configurar transmisión confiable de `X-Forwarded-Proto` y `TRUST_PROXY_HTTPS=True`; no confiar en encabezados enviados directamente por el cliente. Waitress debe autorizar explícitamente el proxy y el encabezado. Verificar la configuración en el servidor, ya que no se suministra una configuración específica de IIS/Nginx para una topología desconocida.
8. No publicar 3000/8000/5432 a Internet. Limitar acceso directo a procesos backend y base.
9. Ajustar monitoreo, logs y límites de intentos de login en el proxy. El throttle de DRF incluido usa caché local y es complementario; múltiples procesos necesitan una política central de limitación de intentos.
10. Ejecutar pruebas de aceptación con las cuentas y equipos reales antes de reemplazar el Excel.

No hay infraestructura desplegada ni validación del servidor del hospital en esta entrega. El informe distingue pruebas ejecutadas y verificaciones pendientes. La licencia y actualización de dependencias siguen bajo el mantenimiento del área de Sistemas; se incluyen versiones exactas instaladas y lockfile.

## Referencias técnicas

- [Django: despliegue](https://docs.djangoproject.com/en/5.2/howto/deployment/checklist/).
- [Django: sesiones](https://docs.djangoproject.com/en/5.2/topics/http/sessions/).
- [Django: aviso de seguridad de julio de 2026](https://www.djangoproject.com/weblog/2026/jul/07/security-releases/).
- [Next.js: programa de actualizaciones de seguridad](https://nextjs.org/blog/next-security-release-program).
- [PostgreSQL: documentación](https://www.postgresql.org/docs/).
