#!/usr/bin/env bash
set -o errexit

python manage.py migrate --noinput

if [ "${RUN_SEED_DATA:-0}" = "1" ]; then
  python manage.py seed_data
fi

gunicorn healthcare_system.wsgi:application --bind 0.0.0.0:${PORT:-8000} --workers 3 --timeout 120
