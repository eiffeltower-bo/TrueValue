"""Create or upsert an admin user (admin=True, superuser=True, active=True).

Run from the ``backend/`` directory::

    uv run python -m scripts.create_superuser                       # interactive
    uv run python -m scripts.create_superuser alice s3cr3t          # positional
    uv run python -m scripts.create_superuser alice s3cr3t a@b.com  # with email
    SUPERUSER_USERNAME=alice SUPERUSER_PASSWORD=s3cr3t \\
        SUPERUSER_EMAIL=alice@truevalue.local \\
        uv run python -m scripts.create_superuser                   # env vars

If the user already exists, their password is reset and ``admin`` /
``superuser`` / ``active`` are forced True.
"""

from __future__ import annotations

import asyncio
import os
import sys
from getpass import getpass

from app.tables.users import User


def _resolve_credentials() -> tuple[str, str, str]:
    username = os.environ.get("SUPERUSER_USERNAME") or (sys.argv[1] if len(sys.argv) > 1 else "")
    password = os.environ.get("SUPERUSER_PASSWORD") or (sys.argv[2] if len(sys.argv) > 2 else "")
    email = os.environ.get("SUPERUSER_EMAIL") or (sys.argv[3] if len(sys.argv) > 3 else "")
    if not username:
        username = input("username: ").strip()
    if not password:
        password = getpass("password: ")
    if not email:
        email = input(f"email [{username}@truevalue.local]: ").strip()
        if not email:
            email = f"{username}@truevalue.local"
    if not username or not password:
        sys.exit("username and password are required")
    return username, password, email


async def main() -> None:
    username, password, email = _resolve_credentials()
    existing = await User.objects().where(User.username == username).first().run()
    if existing is not None:
        existing.password = password  # auto-hashed by BaseUser.__setattr__
        existing.email = email
        existing.active = True
        existing.admin = True
        existing.superuser = True
        await existing.save().run()
        print(f"updated '{username}' as admin (id={existing.id})")
    else:
        user = await User.create_user(
            username=username,
            password=password,
            email=email,
            active=True,
            admin=True,
            superuser=True,
        )
        print(f"created admin '{username}' (id={user.id})")


if __name__ == "__main__":
    asyncio.run(main())
