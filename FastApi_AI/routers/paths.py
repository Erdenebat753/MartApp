# routers/paths.py
from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import List

from database import get_db
from models import Path
from schemas import PathCreate, PathRead

router = APIRouter(prefix="/api/paths", tags=["paths"])

@router.get("", response_model=List[PathRead])
async def list_paths(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Path))
    rows = result.scalars().all()
    return rows

@router.post("", response_model=PathRead)
async def create_path(path: PathCreate, db: AsyncSession = Depends(get_db)):
    new_path = Path(
        from_item_id=path.from_item_id,
        to_item_id=path.to_item_id,
        distance=path.distance
    )
    db.add(new_path)
    await db.commit()
    await db.refresh(new_path)
    return new_path


@router.delete("/{path_id}", status_code=204)
async def delete_path(path_id: int, db: AsyncSession = Depends(get_db)):
    obj = await db.get(Path, path_id)
    if not obj:
        raise HTTPException(status_code=404, detail="Path not found")
    await db.delete(obj)
    await db.commit()
    return Response(status_code=204)
