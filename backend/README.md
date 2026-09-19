# Backend

La guía completa está en [README principal](../README.md), con pasos Windows, PostgreSQL y `.env`.

## Inicio local

```powershell
py -3.12 -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
Copy-Item .env.example .env
```

Completar el secreto aleatorio y los parámetros PostgreSQL antes de continuar:

```powershell
python manage.py check
python manage.py migrate
python manage.py createsuperuser
python manage.py cargar_iniciales
python manage.py runserver 127.0.0.1:8000
```

Admin: `http://localhost:8000/admin/`. API: `http://localhost:8000/api/`.

- [Contrato de API](../docs/API.md).
- [Modelo y trazabilidad](../docs/MODELO.md).
- [Importador](../docs/IMPORTADOR.md).
- [Pruebas](../docs/PRUEBAS.md).

Las escrituras de temas pasan por `temas/services.py`. No actualizar temas por `QuerySet.update`, Admin editable o scripts externos sin pasar por el servicio: se perdería el registro de actividad. El único uso de `update` fuera del servicio ajusta las fechas conocidas durante la importación y conserva su procedencia.

`test_settings` y `e2e_settings` son configuraciones aisladas de pruebas. La configuración normal utiliza PostgreSQL sin fallback silencioso a SQLite.
