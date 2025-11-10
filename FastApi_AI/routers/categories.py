from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
import json

from database import get_db
from models import Category
from schemas import CategoryCreate, CategoryRead
from typing import List

router = APIRouter(prefix="/api/categories", tags=["categories"])


def ensure_closed_polygon(points: list[dict]) -> list[dict]:
    if not points:
        return points
    first = points[0]
    last = points[-1]
    if first.get("x") != last.get("x") or first.get("y") != last.get("y"):
        return points + [{"x": first.get("x"), "y": first.get("y") }]
    return points


@router.get("", response_model=List[CategoryRead])
async def list_categories(mart_id: int | None = Query(default=None), db: AsyncSession = Depends(get_db)):
    stmt = select(Category)
    if mart_id is not None:
        stmt = stmt.where(Category.mart_id == mart_id)
    res = await db.execute(stmt)
    rows = res.scalars().all()
    # decode polygon JSON
    out = []
    for c in rows:
        try:
            poly = json.loads(c.polygon_json)
        except Exception:
            poly = []
        out.append(CategoryRead(id=c.id, mart_id=c.mart_id, name=c.name, polygon=poly, color=c.color))
    return out


@router.post("", response_model=CategoryRead)
async def create_category(cat: CategoryCreate, db: AsyncSession = Depends(get_db)):
    points = [ {"x": float(p.x), "y": float(p.y)} for p in cat.polygon ]
    points = ensure_closed_polygon(points)
    c = Category(mart_id=cat.mart_id, name=cat.name, polygon_json=json.dumps(points), color=cat.color)
    db.add(c)
    await db.commit()
    await db.refresh(c)
    return CategoryRead(id=c.id, mart_id=c.mart_id, name=c.name, polygon=points, color=c.color)


@router.put("/{cat_id}", response_model=CategoryRead)
async def update_category(cat_id: int, cat: CategoryCreate, db: AsyncSession = Depends(get_db)):
    obj = await db.get(Category, cat_id)
    if not obj:
        raise HTTPException(status_code=404, detail="Category not found")
    points = [ {"x": float(p.x), "y": float(p.y)} for p in cat.polygon ]
    points = ensure_closed_polygon(points)
    obj.mart_id = cat.mart_id
    obj.name = cat.name
    obj.polygon_json = json.dumps(points)
    obj.color = cat.color
    await db.commit()
    await db.refresh(obj)
    return CategoryRead(id=obj.id, mart_id=obj.mart_id, name=obj.name, polygon=points, color=obj.color)


@router.delete("/{cat_id}", status_code=204)
async def delete_category(cat_id: int, db: AsyncSession = Depends(get_db)):
    obj = await db.get(Category, cat_id)
    if not obj:
        raise HTTPException(status_code=404, detail="Category not found")
    await db.delete(obj)
    await db.commit()
    return None

