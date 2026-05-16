from __future__ import annotations

from fastapi import APIRouter, HTTPException, status

from app.schemas.users import UserCreate, UserRead, UserUpdate
from app.tables.users import User

router = APIRouter(prefix="/users", tags=["users"])


def _derive_role(user: User) -> str:
    return "admin" if (user.admin or user.superuser) else "agent"


def _to_read(user: User) -> UserRead:
    return UserRead(
        id=user.id,
        username=user.username,
        email=user.email,
        first_name=user.first_name or None,
        last_name=user.last_name or None,
        active=user.active,
        admin=user.admin,
        superuser=user.superuser,
        role=_derive_role(user),
        last_login=user.last_login,
        created_at=user.created_at,
    )


@router.post("", response_model=UserRead, status_code=status.HTTP_201_CREATED)
async def create_user(payload: UserCreate) -> UserRead:
    if await User.exists().where(User.username == payload.username):
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="username already taken")
    if await User.exists().where(User.email == payload.email):
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="email already in use")
    is_admin = payload.role == "admin"
    user = await User.create_user(
        username=payload.username,
        password=payload.password,
        email=payload.email,
        first_name=payload.first_name or "",
        last_name=payload.last_name or "",
        active=payload.active,
        admin=is_admin,
        superuser=is_admin,
    )
    return _to_read(user)


@router.get("", response_model=list[UserRead])
async def list_users() -> list[UserRead]:
    users = await User.objects().run()
    return [_to_read(u) for u in users]


@router.get("/{user_id}", response_model=UserRead)
async def get_user(user_id: int) -> UserRead:
    user = await User.objects().where(User.id == user_id).first().run()
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="user not found")
    return _to_read(user)


@router.patch("/{user_id}", response_model=UserRead)
async def update_user(user_id: int, payload: UserUpdate) -> UserRead:
    user = await User.objects().where(User.id == user_id).first().run()
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="user not found")
    if payload.username is not None and payload.username != user.username:
        if await User.exists().where(User.username == payload.username):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT, detail="username already taken"
            )
        user.username = payload.username
    if payload.email is not None and payload.email != user.email:
        if await User.exists().where(User.email == payload.email):
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="email already in use")
        user.email = payload.email
    if payload.password is not None:
        user.password = payload.password
    if payload.first_name is not None:
        user.first_name = payload.first_name
    if payload.last_name is not None:
        user.last_name = payload.last_name
    if payload.role is not None:
        is_admin = payload.role == "admin"
        user.admin = is_admin
        user.superuser = is_admin
    if payload.active is not None:
        user.active = payload.active
    await user.save().run()
    return _to_read(user)


@router.delete("/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_user(user_id: int) -> None:
    if not await User.exists().where(User.id == user_id):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="user not found")
    await User.delete().where(User.id == user_id).run()
