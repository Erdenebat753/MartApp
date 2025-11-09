from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import List
import json

from database import get_db
from models import ItemList
from schemas import ItemListCreate, ItemListRead

router = APIRouter(prefix="/api/lists", tags=["lists"])


def _to_read(row: ItemList) -> ItemListRead:
    try:
        item_ids = json.loads(row.item_ids_json or "[]")
        if not isinstance(item_ids, list):
            item_ids = []
        item_ids = [int(x) for x in item_ids]
    except Exception:
        item_ids = []
    return ItemListRead(id=row.id, name=row.name, item_ids=item_ids)


@router.get("", response_model=List[ItemListRead])
async def list_lists(db: AsyncSession = Depends(get_db)):
    res = await db.execute(select(ItemList))
    rows = res.scalars().all()
    return [_to_read(r) for r in rows]


@router.get("/{list_id}", response_model=ItemListRead)
async def get_list(list_id: int, db: AsyncSession = Depends(get_db)):
    row = await db.get(ItemList, list_id)
    if not row:
        raise HTTPException(status_code=404, detail="List not found")
    return _to_read(row)


@router.post("", response_model=ItemListRead)
async def create_list(payload: ItemListCreate, db: AsyncSession = Depends(get_db)):
    try:
        ids = [int(x) for x in (payload.item_ids or [])]
    except Exception:
        ids = []
    row = ItemList(
        name=payload.name,
        item_ids_json=json.dumps(ids),
    )
    db.add(row)
    await db.commit()
    await db.refresh(row)
    return _to_read(row)


@router.put("/{list_id}", response_model=ItemListRead)
async def update_list(list_id: int, payload: ItemListCreate, db: AsyncSession = Depends(get_db)):
    row = await db.get(ItemList, list_id)
    if not row:
        raise HTTPException(status_code=404, detail="List not found")
    try:
        ids = [int(x) for x in (payload.item_ids or [])]
    except Exception:
        ids = []
    row.name = payload.name
    row.item_ids_json = json.dumps(ids)
    await db.commit()
    await db.refresh(row)
    return _to_read(row)


@router.delete("/{list_id}", status_code=204)
async def delete_list(list_id: int, db: AsyncSession = Depends(get_db)):
    row = await db.get(ItemList, list_id)
    if not row:
        raise HTTPException(status_code=404, detail="List not found")
    await db.delete(row)
    await db.commit()
    return Response(status_code=204)

