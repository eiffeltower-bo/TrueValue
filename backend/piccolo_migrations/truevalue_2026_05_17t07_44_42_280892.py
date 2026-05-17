from piccolo.apps.migrations.auto.migration_manager import MigrationManager
from piccolo.columns.base import OnDelete
from piccolo.columns.base import OnUpdate
from piccolo.columns.column_types import Array
from piccolo.columns.column_types import ForeignKey
from piccolo.columns.column_types import Integer
from piccolo.columns.column_types import Numeric
from piccolo.columns.column_types import Serial
from piccolo.columns.column_types import SmallInt
from piccolo.columns.column_types import Text
from piccolo.columns.column_types import Timestamptz
from piccolo.columns.column_types import Varchar
from piccolo.columns.defaults.timestamptz import TimestamptzNow
from piccolo.columns.indexes import IndexMethod
from piccolo.table import Table
import decimal


class User(Table, tablename="users", schema=None):
    id = Serial(
        null=False,
        primary_key=True,
        unique=False,
        index=False,
        index_method=IndexMethod.btree,
        choices=None,
        db_column_name="id",
        secret=False,
    )


ID = "2026-05-17T07:44:42:280892"
VERSION = "1.34.0"
DESCRIPTION = ""


async def forwards():
    manager = MigrationManager(
        migration_id=ID, app_name="truevalue", description=DESCRIPTION
    )

    manager.add_table(
        class_name="Lead", tablename="leads", schema=None, columns=None
    )

    manager.add_column(
        table_class_name="Lead",
        tablename="leads",
        column_name="full_name",
        db_column_name="full_name",
        column_class_name="Varchar",
        column_class=Varchar,
        params={
            "length": 255,
            "default": "",
            "null": False,
            "primary_key": False,
            "unique": False,
            "index": False,
            "index_method": IndexMethod.btree,
            "choices": None,
            "db_column_name": None,
            "secret": False,
        },
        schema=None,
    )

    manager.add_column(
        table_class_name="Lead",
        tablename="leads",
        column_name="phone",
        db_column_name="phone",
        column_class_name="Varchar",
        column_class=Varchar,
        params={
            "length": 32,
            "default": "",
            "null": True,
            "primary_key": False,
            "unique": False,
            "index": False,
            "index_method": IndexMethod.btree,
            "choices": None,
            "db_column_name": None,
            "secret": False,
        },
        schema=None,
    )

    manager.add_column(
        table_class_name="Lead",
        tablename="leads",
        column_name="email",
        db_column_name="email",
        column_class_name="Varchar",
        column_class=Varchar,
        params={
            "length": 255,
            "default": "",
            "null": True,
            "primary_key": False,
            "unique": False,
            "index": False,
            "index_method": IndexMethod.btree,
            "choices": None,
            "db_column_name": None,
            "secret": False,
        },
        schema=None,
    )

    manager.add_column(
        table_class_name="Lead",
        tablename="leads",
        column_name="source",
        db_column_name="source",
        column_class_name="Varchar",
        column_class=Varchar,
        params={
            "length": 32,
            "default": "walk_in",
            "null": False,
            "primary_key": False,
            "unique": False,
            "index": False,
            "index_method": IndexMethod.btree,
            "choices": None,
            "db_column_name": None,
            "secret": False,
        },
        schema=None,
    )

    manager.add_column(
        table_class_name="Lead",
        tablename="leads",
        column_name="agent",
        db_column_name="agent",
        column_class_name="ForeignKey",
        column_class=ForeignKey,
        params={
            "references": User,
            "on_delete": OnDelete.set_null,
            "on_update": OnUpdate.cascade,
            "target_column": None,
            "null": True,
            "primary_key": False,
            "unique": False,
            "index": False,
            "index_method": IndexMethod.btree,
            "choices": None,
            "db_column_name": None,
            "secret": False,
        },
        schema=None,
    )

    manager.add_column(
        table_class_name="Lead",
        tablename="leads",
        column_name="status",
        db_column_name="status",
        column_class_name="Varchar",
        column_class=Varchar,
        params={
            "length": 24,
            "default": "new",
            "null": False,
            "primary_key": False,
            "unique": False,
            "index": False,
            "index_method": IndexMethod.btree,
            "choices": None,
            "db_column_name": None,
            "secret": False,
        },
        schema=None,
    )

    manager.add_column(
        table_class_name="Lead",
        tablename="leads",
        column_name="intent",
        db_column_name="intent",
        column_class_name="Varchar",
        column_class=Varchar,
        params={
            "length": 16,
            "default": "venta",
            "null": False,
            "primary_key": False,
            "unique": False,
            "index": False,
            "index_method": IndexMethod.btree,
            "choices": None,
            "db_column_name": None,
            "secret": False,
        },
        schema=None,
    )

    manager.add_column(
        table_class_name="Lead",
        tablename="leads",
        column_name="budget_min_usd",
        db_column_name="budget_min_usd",
        column_class_name="Numeric",
        column_class=Numeric,
        params={
            "default": decimal.Decimal("0"),
            "digits": (12, 2),
            "null": True,
            "primary_key": False,
            "unique": False,
            "index": False,
            "index_method": IndexMethod.btree,
            "choices": None,
            "db_column_name": None,
            "secret": False,
        },
        schema=None,
    )

    manager.add_column(
        table_class_name="Lead",
        tablename="leads",
        column_name="budget_max_usd",
        db_column_name="budget_max_usd",
        column_class_name="Numeric",
        column_class=Numeric,
        params={
            "default": decimal.Decimal("0"),
            "digits": (12, 2),
            "null": True,
            "primary_key": False,
            "unique": False,
            "index": False,
            "index_method": IndexMethod.btree,
            "choices": None,
            "db_column_name": None,
            "secret": False,
        },
        schema=None,
    )

    manager.add_column(
        table_class_name="Lead",
        tablename="leads",
        column_name="zonas",
        db_column_name="zonas",
        column_class_name="Array",
        column_class=Array,
        params={
            "default": list,
            "base_column": Varchar(
                length=64,
                default="",
                null=False,
                primary_key=False,
                unique=False,
                index=False,
                index_method=IndexMethod.btree,
                choices=None,
                db_column_name=None,
                secret=False,
            ),
            "null": False,
            "primary_key": False,
            "unique": False,
            "index": False,
            "index_method": IndexMethod.btree,
            "choices": None,
            "db_column_name": None,
            "secret": False,
        },
        schema=None,
    )

    manager.add_column(
        table_class_name="Lead",
        tablename="leads",
        column_name="bedrooms_min",
        db_column_name="bedrooms_min",
        column_class_name="SmallInt",
        column_class=SmallInt,
        params={
            "default": 0,
            "null": True,
            "primary_key": False,
            "unique": False,
            "index": False,
            "index_method": IndexMethod.btree,
            "choices": None,
            "db_column_name": None,
            "secret": False,
        },
        schema=None,
    )

    manager.add_column(
        table_class_name="Lead",
        tablename="leads",
        column_name="area_min_m2",
        db_column_name="area_min_m2",
        column_class_name="Integer",
        column_class=Integer,
        params={
            "default": 0,
            "null": True,
            "primary_key": False,
            "unique": False,
            "index": False,
            "index_method": IndexMethod.btree,
            "choices": None,
            "db_column_name": None,
            "secret": False,
        },
        schema=None,
    )

    manager.add_column(
        table_class_name="Lead",
        tablename="leads",
        column_name="must_haves",
        db_column_name="must_haves",
        column_class_name="Array",
        column_class=Array,
        params={
            "default": list,
            "base_column": Varchar(
                length=48,
                default="",
                null=False,
                primary_key=False,
                unique=False,
                index=False,
                index_method=IndexMethod.btree,
                choices=None,
                db_column_name=None,
                secret=False,
            ),
            "null": False,
            "primary_key": False,
            "unique": False,
            "index": False,
            "index_method": IndexMethod.btree,
            "choices": None,
            "db_column_name": None,
            "secret": False,
        },
        schema=None,
    )

    manager.add_column(
        table_class_name="Lead",
        tablename="leads",
        column_name="notes",
        db_column_name="notes",
        column_class_name="Text",
        column_class=Text,
        params={
            "default": "",
            "null": False,
            "primary_key": False,
            "unique": False,
            "index": False,
            "index_method": IndexMethod.btree,
            "choices": None,
            "db_column_name": None,
            "secret": False,
        },
        schema=None,
    )

    manager.add_column(
        table_class_name="Lead",
        tablename="leads",
        column_name="created_at",
        db_column_name="created_at",
        column_class_name="Timestamptz",
        column_class=Timestamptz,
        params={
            "default": TimestamptzNow(),
            "null": False,
            "primary_key": False,
            "unique": False,
            "index": False,
            "index_method": IndexMethod.btree,
            "choices": None,
            "db_column_name": None,
            "secret": False,
        },
        schema=None,
    )

    return manager
