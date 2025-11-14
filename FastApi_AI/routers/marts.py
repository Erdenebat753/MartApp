from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Response
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import List
import os
import uuid

from database import get_db
from models import Mart
from schemas import MartCreate, MartRead
from file_storage import save_file, delete_file_by_slug

router = APIRouter(prefix="/api/marts", tags=["marts"])


def _slug_from_url(url: str | None) -> str | None:
    if not url:
        return None
    return url.rsplit("/", 1)[-1]


@router.get("", response_model=List[MartRead])
async def list_marts(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Mart))
    rows = result.scalars().all()
    return rows

@router.get("/{mart_id}", response_model=MartRead)
async def get_mart(mart_id: int, db: AsyncSession = Depends(get_db)):
    obj = await db.get(Mart, mart_id)
    if not obj:
        raise HTTPException(status_code=404, detail="Mart not found")
    return obj


@router.post("", response_model=MartRead)
async def create_mart(data: MartCreate, db: AsyncSession = Depends(get_db)):
    obj = Mart(
        name=data.name,
        coord_x=data.coord_x,
        coord_y=data.coord_y,
        map_width_px=data.map_width_px,
        map_height_px=data.map_height_px,
        map_image_url=data.map_image_url,
    )
    db.add(obj)
    await db.commit()
    await db.refresh(obj)
    return obj


@router.put("/{mart_id}", response_model=MartRead)
async def update_mart(mart_id: int, data: MartCreate, db: AsyncSession = Depends(get_db)):
    obj = await db.get(Mart, mart_id)
    if not obj:
        raise HTTPException(status_code=404, detail="Mart not found")
    obj.name = data.name
    obj.coord_x = data.coord_x
    obj.coord_y = data.coord_y
    obj.map_width_px = data.map_width_px
    obj.map_height_px = data.map_height_px
    obj.map_image_url = data.map_image_url
    await db.commit()
    await db.refresh(obj)
    return obj


# Upload and attach a map image for a mart; returns updated mart
@router.post("/{mart_id}/map-image", response_model=MartRead)
async def upload_mart_map_image(mart_id: int, file: UploadFile = File(...), db: AsyncSession = Depends(get_db)):
    obj = await db.get(Mart, mart_id)
    if not obj:
        raise HTTPException(status_code=404, detail="Mart not found")

    # Generate unique filename preserving extension
    _, ext = os.path.splitext(file.filename or "")
    ext = (ext or ".bin").lower()
    fname = f"mart_{mart_id}_{uuid.uuid4().hex}{ext}"

    # Save file
    contents = await file.read()
    # Try to infer image dimensions (PNG/JPEG) without external deps
    def _image_size(data: bytes):
        try:
            # PNG
            if len(data) >= 24 and data[:8] == b"\x89PNG\r\n\x1a\n":
                w = int.from_bytes(data[16:20], 'big')
                h = int.from_bytes(data[20:24], 'big')
                return w, h
            # JPEG
            if len(data) > 9 and data[0] == 0xFF and data[1] == 0xD8:
                i = 2
                while i < len(data) - 9:
                    # Find marker
                    while i < len(data) and data[i] == 0xFF:
                        i += 1
                    if i >= len(data):
                        break
                    marker = data[i]
                    i += 1
                    # Standalone markers without length
                    if marker in (0x01, 0xD0, 0xD1, 0xD2, 0xD3, 0xD4, 0xD5, 0xD6, 0xD7, 0xD8, 0xD9):
                        continue
                    if i + 1 >= len(data):
                        break
                    seg_len = (data[i] << 8) + data[i+1]
                    if seg_len < 2 or i + seg_len > len(data):
                        break
                    # SOF0..SOF3, SOF5..SOF7, SOF9..SOF11, SOF13..SOF15
                    if marker in (0xC0, 0xC1, 0xC2, 0xC3, 0xC5, 0xC6, 0xC7, 0xC9, 0xCA, 0xCB, 0xCD, 0xCE, 0xCF):
                        if seg_len >= 7:
                            precision = data[i+2]
                            h = (data[i+3] << 8) + data[i+4]
                            w = (data[i+5] << 8) + data[i+6]
                            return w, h
                    i += seg_len
        except Exception:
            pass
        return None, None
    if not contents:
        raise HTTPException(status_code=400, detail="File is empty")
    img_w, img_h = _image_size(contents)
    await save_file(
        db,
        slug=fname,
        contents=contents,
        content_type=file.content_type,
        scope="mart_map",
        original_name=file.filename,
    )

    # Public URL path
    public_url = f"/uploads/{fname}"
    await delete_file_by_slug(db, _slug_from_url(obj.map_image_url))
    obj.map_image_url = public_url
    if img_w and img_h:
        obj.map_width_px = int(img_w)
        obj.map_height_px = int(img_h)
    await db.commit()
    await db.refresh(obj)
    return obj


@router.delete("/{mart_id}", status_code=204)
async def delete_mart(mart_id: int, db: AsyncSession = Depends(get_db)):
    obj = await db.get(Mart, mart_id)
    if not obj:
        raise HTTPException(status_code=404, detail="Mart not found")
    await delete_file_by_slug(db, _slug_from_url(obj.map_image_url))
    await db.delete(obj)
    await db.commit()
    return Response(status_code=204)
