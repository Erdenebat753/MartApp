# routers/items.py
from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import List

from database import get_db
from models import Item, Segment, Path
from sqlalchemy import update
from schemas import ItemCreate, ItemRead

router = APIRouter(prefix="/api/items", tags=["items"])

@router.get("", response_model=List[ItemRead])
async def list_items(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Item))
    rows = result.scalars().all()
    return rows

@router.post("", response_model=ItemRead)
async def create_item(item: ItemCreate, db: AsyncSession = Depends(get_db)):
    new_item = Item(
        name=item.name,
        type=item.type,
        x=item.x,
        y=item.y,
        z=item.z,
        image_url=item.image_url,
        note=item.note,
        price=item.price,
        sale_percent=item.sale_percent,
        description=item.description
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
    obj.name = item.name
    obj.type = item.type
    obj.x = item.x
    obj.y = item.y
    obj.z = item.z
    obj.image_url = item.image_url
    obj.note = item.note
    obj.price = item.price
    obj.sale_percent = item.sale_percent
    obj.description = item.description
    await db.commit()
    await db.refresh(obj)
    return obj

@router.delete("/{item_id}", status_code=204)
async def delete_item(item_id: int, db: AsyncSession = Depends(get_db)):
    obj = await db.get(Item, item_id)
    if not obj:
        raise HTTPException(status_code=404, detail="Item not found")
    # Clean references in segments and paths (defensive, in case FK doesn't SET NULL)
    await db.execute(update(Segment).where(Segment.from_item_id == item_id).values(from_item_id=None))
    await db.execute(update(Segment).where(Segment.to_item_id == item_id).values(to_item_id=None))
    await db.execute(update(Path).where(Path.from_item_id == item_id).values(from_item_id=None))
    await db.execute(update(Path).where(Path.to_item_id == item_id).values(to_item_id=None))
    await db.delete(obj)
    await db.commit()
    return Response(status_code=204)
