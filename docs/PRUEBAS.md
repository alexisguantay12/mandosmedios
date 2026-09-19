# Pruebas y criterios de aceptación

El resultado de la ejecución de esta entrega se registra en `VERIFICACION.md`. Este documento permite repetir las pruebas.

## Backend aislado

```powershell
cd backend
python manage.py test temas --settings=config.test_settings --verbosity=2
```

La base de pruebas SQLite se crea en memoria y se destruye al terminar. Cubre:

- acceso autenticado y códigos de error;
- autoría del servidor y evento inicial;
- resolución, reapertura y rechazo de versiones antiguas;
- cambios de campos y áreas, eventos individuales, no-op sin eventos ficticios;
- comentario separado del historial, validación y autor;
- Mis temas por creador;
- cinco resueltos y listado completo;
- búsqueda/filtros y parámetros inválidos;
- tipos dinámicos/inactivos;
- prohibición de borrado/escritura de auditoría;
- login/logout con CSRF real y cambio de contraseña;
- importación: todas las celdas, fechas, comentarios, dry-run, deduplicación, conflictos, errores parciales, rollback de maestros, headers inválidos, fórmulas e inspección de todas las hojas.

Para verificar específicamente PostgreSQL y el entorno del hospital, ejecutar `python manage.py test temas` con la configuración PostgreSQL de laboratorio. SQLite no demuestra la semántica de bloqueos concurrentes de PostgreSQL.

## Navegador real (Playwright)

Las pruebas ejecutan la aplicación completa con una base **aislada** de datos ficticios. No se deben ejecutar sobre producción.

Terminal 1, backend:

```powershell
cd backend
$env:E2E_PASSWORD = Read-Host "Contraseña temporal de las cuentas de prueba"
python manage.py migrate --settings=config.e2e_settings
python manage.py preparar_e2e --settings=config.e2e_settings
python manage.py runserver 127.0.0.1:8000 --settings=config.e2e_settings --noreload
```

El fixture sólo acepta `config.e2e_settings`, una base SQLite separada `backend/e2e.sqlite3`, y exige que no contenga temas. En una repetición detener el servidor de pruebas y eliminar **únicamente** ese archivo generado o usar `flush --settings=config.e2e_settings`; jamás usar `flush` contra la base normal para esto.

Terminal 2, frontend:

```powershell
cd frontend
$env:NEXT_PUBLIC_API_URL = "http://127.0.0.1:8000/api"
npm ci
npm run build
npm run start
```

Terminal 3, frontend:

```powershell
cd frontend
$env:E2E_PASSWORD = Read-Host "La misma contraseña temporal"
npx playwright install chromium
npm run test:e2e
```

No definir `E2E_CHROMIUM_OPTIONS` en Windows normalmente. Esta opción del runner permite un ejecutable Chromium alternativo en entornos de CI; su valor, si se usa, es la ruta de un JSON con `executablePath` y `args`.

Los recorridos comprueban alta, edición, comentario, actividad, Mis temas, drag & drop real de mouse, límite de resueltos, detalle de página móvil, cambio de estado móvil, contraseña, logout/login y overflow horizontal a múltiples anchos. Se generan capturas en `frontend/test-results` y reporte HTML en `frontend/playwright-report`. El fixture contiene nombres ilustrativos y datos sintéticos; no son registros del hospital.

## Build reproducible

```powershell
cd frontend
npm ci
npm run build
```

El build valida compilación y generación de rutas. No demuestra por sí mismo conectividad con la API ni funcionamiento en un teléfono físico.

## Aceptación en el hospital

Sobre un entorno de laboratorio con PostgreSQL, TLS y proxy configurados:

1. Crear dos cuentas normales y verificar acceso desde dos equipos.
2. Abrir el mismo tema en ambos, guardar un cambio y confirmar que la segunda edición recibe conflicto sin sobrescribir.
3. Mover tema a Resuelto y reabrir, revisando fechas/eventos.
4. Crear tipos/áreas/responsables desde Admin y comprobar su aparición.
5. Verificar una sesión vencida y la redirección a login.
6. Revisar Safari/iOS y Android reales, teclado virtual, foco y lectura con zoom.
7. Ejecutar inspección completa y dry-run del XLSX real; reconciliar cantidades y valores con la planilla.
8. Probar respaldo/restauración antes del corte de migración.

No incluye pruebas de carga, auditoría externa de seguridad ni despliegue de alta disponibilidad. La protección de aplicación se complementa con el servidor, red, base y políticas del hospital.
