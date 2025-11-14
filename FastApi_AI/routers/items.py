# routers/items.py
from fastapi import APIRouter, Depends, HTTPException, Response, Query, UploadFile, File
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import List
from datetime import datetime, timezone
import os
import uuid
import json

from database import get_db
from models import Item, Segment, Path, Category
from sqlalchemy import update
from schemas import ItemCreate, ItemRead
from file_storage import save_file, delete_file_by_slug

router = APIRouter(prefix="/api/items", tags=["items"])


def _slug_from_url(url: str | None) -> str | None:
    if not url:
        return None
    return url.rsplit("/", 1)[-1]


def _point_in_polygon(x: float, y: float, points: list[dict]) -> bool:
    coords = [(float(p.get("x", 0.0)), float(p.get("y", 0.0))) for p in points if isinstance(p, dict)]
    n = len(coords)
    if n < 3:
        return False
    inside = False
    j = n - 1
    for i in range(n):
        xi, yi = coords[i]
        xj, yj = coords[j]
        intersects = ((yi > y) != (yj > y)) and (
            x < (xj - xi) * (y - yi) / (yj - yi + 1e-12) + xi
        )
        if intersects:
            inside = not inside
        j = i
    return inside


async def _auto_category_id(db: AsyncSession, mart_id: int | None, x: float, y: float) -> int | None:
    if mart_id is None:
        return None
    result = await db.execute(select(Category).where(Category.mart_id == mart_id))
    for cat in result.scalars():
        try:
            poly = json.loads(cat.polygon_json or "[]")
        except Exception:
            continue
        if isinstance(poly, list) and _point_in_polygon(float(x), float(y), poly):
            return cat.id
    return None

@router.get("", response_model=List[ItemRead])
async def list_items(mart_id: int | None = Query(default=None), db: AsyncSession = Depends(get_db)):
    stmt = select(Item)
    if mart_id is not None:
        stmt = stmt.where(Item.mart_id == mart_id)
    result = await db.execute(stmt)
    rows = result.scalars().all()
    # expire sales that have passed
    changed = False
    now = datetime.now(timezone.utc)
    for row in rows:
        try:
            if row.sale_end_at is not None:
                # SQLite stores naive timestamps; handle both
                end = row.sale_end_at
                if isinstance(end, str):
                    try:
                        end = datetime.fromisoformat(end)
                    except Exception:
                        end = None
                if end is not None and (end.tzinfo is None or end.tzinfo.utcoffset(end) is None):
                    # make naive times UTC for comparison
                    end = end.replace(tzinfo=timezone.utc)
                if end is not None and now > end and row.sale_percent is not None:
                    row.sale_percent = None
                    changed = True
        except Exception:
            pass
    if changed:
        try:
            await db.commit()
        except Exception:
            pass
    return rows

@router.post("", response_model=ItemRead)
async def create_item(item: ItemCreate, db: AsyncSession = Depends(get_db)):
    if item.type == 'slam_start':
        raise HTTPException(status_code=400, detail="Use /api/slam to create SLAM start")
    if item.mart_id is None:
        raise HTTPException(status_code=400, detail="mart_id is required")
    # Require non-null price and image
    if item.price is None:
        raise HTTPException(status_code=400, detail="price is required (non-null)")
    if item.image_url is None or (isinstance(item.image_url, str) and item.image_url.strip() == ""):
        raise HTTPException(status_code=400, detail="image_url is required (upload image or provide path)")
    category_id = item.category_id
    if category_id is None:
        auto_cat = await _auto_category_id(db, item.mart_id, float(item.x), float(item.y))
        if auto_cat is not None:
            category_id = auto_cat
    new_item = Item(
        mart_id=item.mart_id,
        name=item.name,
        type=item.type,
        x=item.x,
        y=item.y,
        z=item.z,
        image_url=item.image_url,
        note=item.note,
        category_id=category_id,
        price=item.price,
        sale_percent=item.sale_percent,
        sale_end_at=item.sale_end_at,
        description=item.description,
        heading_deg=item.heading_deg
    )
    db.add(new_item)
    await db.commit()
    await db.refresh(new_item)
    return new_item

@router.put("/{item_id}", response_model=ItemRead)
async def update_item(item_id: int, item: ItemCreate, db: AsyncSession = Depends(get_db)):
    obj = await db.get(Item, item_id)
    if not obj:
        raise HTTPException(status_code=404, detail="Item not found")
    if item.type == 'slam_start' and obj.type != 'slam_start':
        raise HTTPException(status_code=400, detail="Use /api/slam to update SLAM start")
    if item.mart_id is None:
        raise HTTPException(status_code=400, detail="mart_id is required")
    # Require non-null price and image
    if item.price is None:
        raise HTTPException(status_code=400, detail="price is required (non-null)")
    if item.image_url is None or (isinstance(item.image_url, str) and item.image_url.strip() == ""):
        raise HTTPException(status_code=400, detail="image_url is required (upload image or provide path)")
    obj.mart_id = item.mart_id
    obj.name = item.name
    obj.type = item.type
    obj.x = item.x
    obj.y = item.y
    obj.z = item.z
    obj.image_url = item.image_url
    obj.note = item.note
    category_id = item.category_id
    if category_id is None:
        auto_cat = await _auto_category_id(db, item.mart_id, float(item.x), float(item.y))
        if auto_cat is not None:
            category_id = auto_cat
    obj.category_id = category_id
    obj.price = item.price
    obj.sale_percent = item.sale_percent
    obj.sale_end_at = item.sale_end_at
    obj.description = item.description
    obj.heading_deg = item.heading_deg
    await db.commit()
    await db.refresh(obj)
    return obj


@router.post("/upload-image")
async def upload_item_image(file: UploadFile = File(...), db: AsyncSession = Depends(get_db)):
    contents = await file.read()
    if not contents:
        raise HTTPException(status_code=400, detail="File is empty")
    _, ext = os.path.splitext(file.filename or "")
    ext = (ext or ".bin").lower()
    fname = f"item_{uuid.uuid4().hex}{ext}"
    await save_file(
        db,
        slug=fname,
        contents=contents,
        content_type=file.content_type,
        scope="item_upload",
        original_name=file.filename,
    )
    await db.commit()
    public_url = f"/uploads/{fname}"
    return {"image_url": public_url}


@router.post("/{item_id}/image", response_model=ItemRead)
async def set_item_image(item_id: int, file: UploadFile = File(...), db: AsyncSession = Depends(get_db)):
    obj = await db.get(Item, item_id)
    if not obj:
        raise HTTPException(status_code=404, detail="Item not found")
    contents = await file.read()
    if not contents:
        raise HTTPException(status_code=400, detail="File is empty")
    _, ext = os.path.splitext(file.filename or "")
    ext = (ext or ".bin").lower()
    fname = f"item_{item_id}_{uuid.uuid4().hex}{ext}"
    await save_file(
        db,
        slug=fname,
        contents=contents,
        content_type=file.content_type,
        scope="item_image",
        original_name=file.filename,
    )
    await delete_file_by_slug(db, _slug_from_url(obj.image_url))
    obj.image_url = f"/uploads/{fname}"
    await db.commit()
    await db.refresh(obj)
    return obj

@router.delete("/{item_id}", status_code=204)
async def delete_item(item_id: int, db: AsyncSession = Depends(get_db)):
    obj = await db.get(Item, item_id)
    if not obj:
        raise HTTPException(status_code=404, detail="Item not found")
    await delete_file_by_slug(db, _slug_from_url(obj.image_url))
    # Clean references in segments and paths (defensive, in case FK doesn't SET NULL)
    await db.execute(update(Segment).where(Segment.from_item_id == item_id).values(from_item_id=None))
    await db.execute(update(Segment).where(Segment.to_item_id == item_id).values(to_item_id=None))
    await db.execute(update(Path).where(Path.from_item_id == item_id).values(from_item_id=None))
    await db.execute(update(Path).where(Path.to_item_id == item_id).values(to_item_id=None))
    await db.delete(obj)
    await db.commit()
    return Response(status_code=204)
