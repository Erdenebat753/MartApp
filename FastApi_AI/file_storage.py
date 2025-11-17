from __future__ import annotations

import asyncio
from typing import Optional

import cloudinary
import cloudinary.uploader
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from config import settings
from models import StoredFile


def _configure_cloudinary() -> None:
    """Configure Cloudinary client once."""
    cfg_kwargs = {"secure": True}
    if settings.CLOUDINARY_URL:
        cfg_kwargs["cloudinary_url"] = settings.CLOUDINARY_URL
    if settings.CLOUDINARY_CLOUD_NAME:
        cfg_kwargs["cloud_name"] = settings.CLOUDINARY_CLOUD_NAME
    if settings.CLOUDINARY_API_KEY:
        cfg_kwargs["api_key"] = settings.CLOUDINARY_API_KEY
    if settings.CLOUDINARY_API_SECRET:
        cfg_kwargs["api_secret"] = settings.CLOUDINARY_API_SECRET
    cloudinary.config(**cfg_kwargs)
    cfg = cloudinary.config()
    if not cfg.api_key:
        raise RuntimeError("Cloudinary credentials are not set")


async def _upload_to_cloudinary(slug: str, contents: bytes, content_type: Optional[str], scope: Optional[str]) -> dict:
    """Upload file bytes to Cloudinary in a thread to avoid blocking the event loop."""
    _configure_cloudinary()
    upload_kwargs = {
        "public_id": slug,
        "overwrite": True,
        "resource_type": "image",
        "folder": settings.CLOUDINARY_FOLDER or None,
    }
    if content_type:
        upload_kwargs["format"] = (content_type.split("/")[-1] or "").lower()
    loop = asyncio.get_running_loop()
    return await loop.run_in_executor(
        None,
        lambda: cloudinary.uploader.upload(
            contents,
            **{k: v for k, v in upload_kwargs.items() if v},
            context={"scope": scope} if scope else None,
        ),
    )


async def _delete_from_cloudinary(public_id: Optional[str]) -> None:
    if not public_id:
        return
    try:
        _configure_cloudinary()
    except RuntimeError:
        return
    loop = asyncio.get_running_loop()
    await loop.run_in_executor(None, lambda: cloudinary.uploader.destroy(public_id, invalidate=True))


async def save_file(
    db: AsyncSession,
    slug: str,
    contents: bytes,
    content_type: Optional[str],
    scope: Optional[str] = None,
    original_name: Optional[str] = None,
) -> StoredFile:
    """Upload to Cloudinary and persist the metadata only."""
    result = await _upload_to_cloudinary(slug, contents, content_type, scope)
    record = StoredFile(
        slug=slug,
        scope=scope,
        original_name=original_name,
        content_type=content_type,
        size_bytes=len(contents or b""),
        url=result.get("secure_url") or result.get("url"),
        cloudinary_public_id=result.get("public_id"),
        data=None,
    )
    db.add(record)
    await db.flush()
    return record


async def delete_file_by_slug(db: AsyncSession, slug: Optional[str]) -> None:
    """Remove an existing stored file from Cloudinary and DB, ignoring missing slugs."""
    if not slug:
        return
    result = await db.execute(select(StoredFile).where(StoredFile.slug == slug))
    file = result.scalars().first()
    if not file:
        return
    await _delete_from_cloudinary(file.cloudinary_public_id)
    await db.delete(file)
