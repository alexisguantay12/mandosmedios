"""Sólo para pruebas de navegador con datos ficticios, nunca producción."""

import os
from pathlib import Path

from . import test_settings
from .test_settings import *  # noqa: F403

DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.sqlite3",
        "NAME": Path(os.environ.get("E2E_DB_PATH", str(test_settings.BASE_DIR / "e2e.sqlite3"))),
    }
}
ALLOWED_HOSTS = ["localhost", "127.0.0.1", "testserver"]
CORS_ALLOWED_ORIGINS = ["http://127.0.0.1:3000", "http://localhost:3000"]
CSRF_TRUSTED_ORIGINS = CORS_ALLOWED_ORIGINS
