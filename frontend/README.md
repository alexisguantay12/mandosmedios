# Frontend

Next.js App Router, React, JavaScript/JSX y CSS. No utiliza TypeScript ni un servicio de autenticación externo.

```powershell
Copy-Item .env.example .env.local
npm ci
npm run dev
```

API predeterminada: `http://localhost:8000/api`. El backend debe estar ejecutándose con el mismo hostname usado por el navegador. Abrir `http://localhost:3000`.

Para compilar:

```powershell
npm run build
npm run start
```

La sesión vive en una cookie HttpOnly de Django. El cliente obtiene un token CSRF desde la API y lo envía en escrituras. Los secretos del backend nunca se pasan a `NEXT_PUBLIC_*`.

- Variables visuales: `app/globals.css`, bloque `:root`.
- Páginas: `app/(institutional)`, protegidas visualmente por `Shell`; la autorización real siempre está en la API Django.
- Tablero/listados: `components/TopicWorkspace.jsx`.
- Formulario: `components/TopicForm.jsx`.
- Detalle: `components/TopicDetail.jsx`.
- PC con puntero fino y ancho >=1024: modal y sensor de mouse para arrastrar.
- Pantalla pequeña o táctil: página completa y cambio de estado por formulario; no hay sensor táctil de drag.
- Formatear: `npm run format`.
- E2E: `npm run test:e2e`, previa configuración indicada en [PRUEBAS.md](../docs/PRUEBAS.md).

Ver [README principal](../README.md) para instalación desde cero y producción.
