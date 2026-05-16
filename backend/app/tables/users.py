from __future__ import annotations

from piccolo.apps.user.tables import BaseUser
from piccolo.columns import Timestamptz
from piccolo.columns.defaults.timestamptz import TimestamptzNow


class User(BaseUser, tablename="users"):
    """TrueValue user. Inherits from Piccolo's BaseUser:

    - ``username`` (unique), ``password`` (auto-hashed pbkdf2_sha256), ``email`` (unique)
    - ``first_name``, ``last_name``
    - ``active`` — can log in
    - ``admin`` — can access the Piccolo admin UI
    - ``superuser`` — can manage other users in the admin UI
    - ``last_login``

    We add ``created_at`` for sortable creation order. The CRM ``role`` ("agent"
    vs "admin") is derived from the ``admin`` / ``superuser`` flags in the API
    layer — we do not store it as a separate column.
    """

    created_at = Timestamptz(default=TimestamptzNow())
