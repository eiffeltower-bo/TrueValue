from __future__ import annotations

import pathlib

from piccolo.conf.apps import AppConfig

from app.tables.properties import Property
from app.tables.sales import Sale
from app.tables.users import User

CURRENT_DIRECTORY = pathlib.Path(__file__).resolve().parent

APP_CONFIG = AppConfig(
    app_name="truevalue",
    migrations_folder_path=str(CURRENT_DIRECTORY.parent / "piccolo_migrations"),
    table_classes=[User, Property, Sale],
)
