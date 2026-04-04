#!/usr/bin/env bash
set -o errexit

python manage.py migrate --noinput

if [ "${RUN_SEED_DATA:-0}" = "1" ]; then
  python manage.py seed_data
fi

if [ "${RUN_SEED_DEMO_ACCESS:-0}" = "1" ]; then
  python manage.py seed_demo_access
fi

gunicorn healthcare_system.wsgi:application
