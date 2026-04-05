import os
import secrets
import sys
from pathlib import Path
from urllib.parse import parse_qs, unquote, urlparse
from dotenv import load_dotenv

# ✅ ONLY ONE ENV LOADER (fix)
BASE_DIR = Path(__file__).resolve().parent.parent
load_dotenv(BASE_DIR / ".env", override=True)

print(">>> DATABASE_URL =", repr(os.getenv("DATABASE_URL")))

RUNNING_TESTS = len(sys.argv) > 1 and sys.argv[1] == "test"
RUNNING_DEVELOPMENT_SERVER = len(sys.argv) > 1 and sys.argv[1] == "runserver"


def env_bool(name, default=False):
    value = os.getenv(name)
    if value is None:
        return default
    return value.strip().lower() in {"1", "true", "yes", "on"}


def env_int(name, default=0):
    value = os.getenv(name)
    if value is None:
        return default
    try:
        return int(value.strip())
    except:
        return default


def env_list(name, default=""):
    value = os.getenv(name, default)
    return [item.strip() for item in value.split(",") if item.strip()]


# ========================
# 🔐 CORE SETTINGS
# ========================

DEBUG = env_bool("DJANGO_DEBUG", RUNNING_DEVELOPMENT_SERVER or RUNNING_TESTS)

SECRET_KEY = os.getenv("DJANGO_SECRET_KEY", "").strip()
if not SECRET_KEY:
    if DEBUG:
        SECRET_KEY = secrets.token_urlsafe(50)
    else:
        raise RuntimeError("DJANGO_SECRET_KEY must be configured.")


ALLOWED_HOSTS = env_list("DJANGO_ALLOWED_HOSTS", "127.0.0.1,localhost")

CSRF_TRUSTED_ORIGINS = env_list(
    "DJANGO_CSRF_TRUSTED_ORIGINS",
    "http://localhost:5173,http://127.0.0.1:5173",
)

CORS_ALLOWED_ORIGINS = env_list(
    "DJANGO_CORS_ALLOWED_ORIGINS",
    "http://localhost:5173,http://127.0.0.1:5173",
)


# ========================
# 🤖 GEMINI
# ========================

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "").strip()
GEMINI_ENABLED = env_bool("GEMINI_ENABLED", bool(GEMINI_API_KEY))


# ========================
# 📦 APPS
# ========================

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


# ========================
# 🧠 DATABASE (FIXED)
# ========================

def build_database_settings():
    database_url = os.getenv("DATABASE_URL")

    if not database_url:
        raise RuntimeError("❌ DATABASE_URL missing in .env")

    parsed = urlparse(database_url)

    if parsed.scheme not in ["postgres", "postgresql"]:
        raise RuntimeError("❌ Only PostgreSQL DATABASE_URL allowed")

    name = parsed.path.lstrip("/")
    if not all([name, parsed.hostname, parsed.username, parsed.password]):
        raise RuntimeError("❌ Invalid DATABASE_URL format")

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


# ========================
# 🔐 AUTH
# ========================

AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"},
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator"},
]


# ========================
# 🌍 GLOBAL
# ========================

LANGUAGE_CODE = "en-us"
TIME_ZONE = "UTC"
USE_I18N = True
USE_TZ = True


# ========================
# 📁 STATIC
# ========================

STATIC_URL = "/static/"
STATIC_ROOT = BASE_DIR / "staticfiles"


# ========================
# 🔒 SECURITY
# ========================

SESSION_COOKIE_SECURE = not DEBUG
CSRF_COOKIE_SECURE = not DEBUG


# ========================
# ⚙️ DRF
# ========================

REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": [
        "rest_framework.authentication.TokenAuthentication",
    ],
    "DEFAULT_RENDERER_CLASSES": [
        "rest_framework.renderers.JSONRenderer",
    ],
}


DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"