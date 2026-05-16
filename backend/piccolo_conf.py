from __future__ import annotations

import os
from urllib.parse import urlparse

from piccolo.conf.apps import AppRegistry
from piccolo.engine.postgres import PostgresEngine

_url = urlparse(
    os.environ.get("DATABASE_URL", "postgresql://truevalue:truevalue@localhost:5432/truevalue")
)

DB = PostgresEngine(
    config={
        "database": (_url.path or "/truevalue").lstrip("/"),
        "user": _url.username or "truevalue",
        "password": _url.password or "truevalue",
        "host": _url.hostname or "localhost",
        "port": _url.port or 5432,
    }
)

APP_REGISTRY = AppRegistry(
    apps=[
        "app.piccolo_app",
        # session_auth provides the ``sessions`` table that piccolo_admin uses for login.
        # piccolo_admin itself has no tables of its own, so we don't register it here —
        # we just call ``create_admin(...)`` at runtime in ``app.main``.
        "piccolo_api.session_auth.piccolo_app",
    ]
)
