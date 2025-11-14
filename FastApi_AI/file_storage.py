from __future__ import annotations

from typing import Optional

from sqlalchemy import delete
from sqlalchemy.ext.asyncio import AsyncSession

from models import StoredFile


async def save_file(
    db: AsyncSession,
    slug: str,
    contents: bytes,
    content_type: Optional[str],
    scope: Optional[str] = None,
    original_name: Optional[str] = None,
) -> StoredFile:
    """Persist file bytes inside the stored_files table."""
    record = StoredFile(
        slug=slug,
        scope=scope,
        original_name=original_name,
        content_type=content_type,
        size_bytes=len(contents or b""),
        data=contents,
    )
    db.add(record)
    await db.flush()
    return record


async def delete_file_by_slug(db: AsyncSession, slug: Optional[str]) -> None:
    """Remove an existing stored file, ignoring missing slugs."""
    if not slug:
        return
    await db.execute(delete(StoredFile).where(StoredFile.slug == slug))
