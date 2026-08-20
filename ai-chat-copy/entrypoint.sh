#!/bin/sh
set -e

python manage.py migrate --noinput
python manage.py bootstrap_app

if [ "$#" -gt 0 ]; then
  exec "$@"
fi

exec daphne -b 0.0.0.0 -p 8000 config.asgi:application
