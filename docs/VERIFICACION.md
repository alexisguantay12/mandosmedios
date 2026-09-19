# Informe de verificación · 18/09/2026

## Resultado ejecutado

| Comprobación | Resultado |
| --- | --- |
| Django system check | Sin incidencias. |
| Migraciones incluidas y aplicadas en base aislada | Correctas. |
| `makemigrations --check --dry-run` | Sin cambios pendientes. |
| Suite backend API/importador | **27 pruebas aprobadas**. |
| Build de Next.js 16.3.5 | Correcto; rutas generadas sin errores. |
| Suite Playwright con Chromium 153 | **8 pruebas aprobadas**, ejecución final: 38 segundos. |
| Revisión estática Python con Ruff | Sin incidencias. |
| Código formateado | Python con Ruff; JSX/JS/CSS con Prettier. |

## Recorridos de navegador verificados

1. Login, alta en modal, edición de impacto, comentario, cambio de estado, actividad y Mis temas por creador.
2. Arrastrar una tarjeta con mouse, confirmar persistencia en otra columna, cinco resueltos en tablero y acceso al listado completo.
3. Celular táctil 390×844: detalle en página, cambio de estado sin drag, alta y formulario.
4. PC 1920×1080: tablero, formulario y detalle, sin overflow horizontal.
5. Notebook 1366×768: tablero, formulario y detalle, sin overflow horizontal.
6. Tablet 820×1180: tablero, formulario y detalle, sin overflow horizontal.
7. Pantalla pequeña 320×740: tablero, formulario y detalle, sin overflow horizontal.
8. Cambio de contraseña, logout, nuevo login y restauración de la clave temporal del fixture.

Las pruebas consumieron la API real y el build de producción de Next.js. No se simularon respuestas del backend. Las cuentas y temas fueron exclusivamente ficticios. Se revisaron capturas de tablero, formularios y detalle; se incluyen algunas en `docs/capturas`.

Durante la validación se corrigieron una recarga inicial que podía interrumpir el drag, el atributo de accesibilidad de tarjetas móviles y la conservación de una edición al cambiar el tamaño de ventana. Los errores de selección del runner de pruebas también fueron corregidos antes de la ejecución final aprobada.

## Límites concretos

- **No se recibió el Excel histórico real.** No se analizó ni migró su contenido. Importador, inspección y dry-run se probaron sobre XLSX sintéticos; el mapeo real queda pendiente del archivo.
- **No se ejecutó PostgreSQL en este entorno.** La instalación del servicio no fue posible por restricciones del contenedor. Las 27 pruebas y las migraciones se ejecutaron con SQLite aislado. La configuración normal del proyecto sí utiliza PostgreSQL y psycopg; validar conexión, migración y concurrencia real de PostgreSQL en laboratorio antes de producción.
- La base E2E se ejecutó en un archivo temporal local y con el servidor de pruebas sin threading para aislar restricciones del filesystem del entorno. Esto no constituye una prueba de carga ni de concurrencia PostgreSQL.
- No se ejecutó en Windows ni en dispositivos físicos; las instrucciones Windows están documentadas. No se verificaron Firefox/Safari, proxy HTTPS, certificados, políticas del hospital ni rendimiento bajo carga.
- El navegador alternativo de CI ejecutó Chromium headless con CORS habilitado; la autenticación y las cookies no se sustituyeron por mocks. Las pruebas unitarias incluyeron explícitamente CSRF.

El ZIP excluye bases de prueba, entornos virtuales, node_modules, builds, secretos, logs de sesiones y archivos de trazas que puedan contener claves temporales. Incluye fuente, migraciones, lockfile, requisitos, pruebas y documentación. No se despliega ningún servicio automáticamente al descargarlo.
