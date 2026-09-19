# SQLite permite ejecutar tests unitarios aislados sin PostgreSQL.
# La configuración normal siempre utiliza PostgreSQL.
import os

os.environ.setdefault("SECRET_KEY", "test-only-" + "x" * 60)
os.environ.setdefault("DEBUG", "true")
from .settings import *  # noqa: F403, E402

DATABASES = {"default": {"ENGINE": "django.db.backends.sqlite3", "NAME": ":memory:"}}
PASSWORD_HASHERS = ["django.contrib.auth.hashers.MD5PasswordHasher"]
SECURE_SSL_REDIRECT = False
SESSION_COOKIE_SECURE = False
CSRF_COOKIE_SECURE = False
