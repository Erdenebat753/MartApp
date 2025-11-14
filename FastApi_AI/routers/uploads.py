import mimetypes
import os

from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from database import get_db
from models import StoredFile

router = APIRouter(tags=["uploads"])

_FASTAPI_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
_LEGACY_UPLOADS = os.path.join(_FASTAPI_DIR, "uploads")


@router.get("/uploads/{slug}")
async def serve_upload(slug: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(StoredFile).where(StoredFile.slug == slug))
    file = result.scalars().first()
    if not file:
        # legacy fallback: serve from disk if still present
        legacy_path = os.path.join(_LEGACY_UPLOADS, slug)
        if os.path.exists(legacy_path):
            with open(legacy_path, "rb") as fh:
                data = fh.read()
            media_type = mimetypes.guess_type(legacy_path)[0] or "application/octet-stream"
            headers = {"Cache-Control": "public, max-age=3600"}
            return Response(content=data, media_type=media_type, headers=headers)
        raise HTTPException(status_code=404, detail="File not found")
    media_type = file.content_type or "application/octet-stream"
    headers = {"Cache-Control": "public, max-age=31536000"}
    return Response(content=file.data, media_type=media_type, headers=headers)
