#!/usr/bin/env bash
set -o errexit

pip install -r requirements.txt

python manage.py collectstatic --noinput --skip-checks

python manage.py migrate --noinput

python manage.py createsuperuser --noinput || true