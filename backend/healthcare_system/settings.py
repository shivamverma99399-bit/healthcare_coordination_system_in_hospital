import os
import sys
from pathlib import Path
from urllib.parse import parse_qs, unquote, urlparse

from dotenv import load_dotenv


BASE_DIR = Path(__file__).resolve().parent.parent
load_dotenv(BASE_DIR / ".env", override=True)


RUNNING_TESTS = len(sys.argv) > 1 and sys.argv[1] == "test"
RUNNING_DEVELOPMENT_SERVER = len(sys.argv) > 1 and sys.argv[1] == "runserver"


def env_value(*names, default=None):
    for name in names:
        value = os.getenv(name)
        if value is not None and str(value).strip() != "":
            return value
    return default


def env_bool(*names, default=False):
    value = env_value(*names)
    if value is None:
        return default
    return str(value).strip().lower() in {"1", "true", "yes", "on"}


def env_int(*names, default=0):
    value = env_value(*names)
    if value is None:
        return default
    try:
        return int(str(value).strip())
    except (TypeError, ValueError):
        return default


def env_list(*names, default=""):
    value = env_value(*names, default=default)
    return [item.strip() for item in str(value).split(",") if item.strip()]


DEBUG = env_bool("DEBUG", "DJANGO_DEBUG", default=False)


SECRET_KEY = str(env_value("DJANGO_SECRET_KEY", "SECRET_KEY", default="")).strip()
if not SECRET_KEY:
    raise RuntimeError("DJANGO_SECRET_KEY must be set")


ALLOWED_HOSTS = env_list("ALLOWED_HOSTS", "DJANGO_ALLOWED_HOSTS", default="*")


CSRF_TRUSTED_ORIGINS = env_list(
    "CSRF_TRUSTED_ORIGINS",
    "DJANGO_CSRF_TRUSTED_ORIGINS",
    default="https://*.onrender.com",
)


CORS_ALLOWED_ORIGINS = env_list(
    "CORS_ALLOWED_ORIGINS",
    "DJANGO_CORS_ALLOWED_ORIGINS",
    default="",
)


GEMINI_API_KEY = str(env_value("GEMINI_API_KEY", default="")).strip()
GEMINI_ENABLED = env_bool("GEMINI_ENABLED", default=bool(GEMINI_API_KEY))


INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    "rest_framework",
    "rest_framework.authtoken",
    "core.apps.CoreConfig",
]


MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "whitenoise.middleware.WhiteNoiseMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "core.middleware.SimpleCORSMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]


ROOT_URLCONF = "healthcare_system.urls"


TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]


WSGI_APPLICATION = "healthcare_system.wsgi.application"


def build_database_settings():
    database_url = os.getenv("DATABASE_URL")

    if not database_url:
        raise RuntimeError("DATABASE_URL missing in environment")

    parsed = urlparse(database_url)

    if parsed.scheme not in ["postgres", "postgresql"]:
        raise RuntimeError("Only PostgreSQL DATABASE_URL is allowed")

    name = parsed.path.lstrip("/")
    if not all([name, parsed.hostname, parsed.username, parsed.password]):
        raise RuntimeError("Invalid DATABASE_URL format")

    query = parse_qs(parsed.query)
    sslmode = query.get("sslmode", ["require"])[0]

    return {
        "ENGINE": "django.db.backends.postgresql",
        "NAME": name,
        "USER": unquote(parsed.username),
        "PASSWORD": unquote(parsed.password),
        "HOST": parsed.hostname,
        "PORT": str(parsed.port or "5432"),
        "CONN_MAX_AGE": 600,
        "OPTIONS": {
            "sslmode": sslmode,
        },
    }


DATABASES = {
    "default": build_database_settings()
}


AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"},
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator"},
]


LANGUAGE_CODE = "en-us"
TIME_ZONE = "UTC"
USE_I18N = True
USE_TZ = True


STATIC_URL = "/static/"
STATIC_ROOT = BASE_DIR / "staticfiles"


SESSION_COOKIE_SECURE = not DEBUG
CSRF_COOKIE_SECURE = not DEBUG
SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")


REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": [
        "rest_framework.authentication.TokenAuthentication",
    ],
    "DEFAULT_RENDERER_CLASSES": [
        "rest_framework.renderers.JSONRenderer",
    ],
}


DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"
