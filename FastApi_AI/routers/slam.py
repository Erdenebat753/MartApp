# routers/slam.py
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import Optional

from database import get_db
from models import SlamStart, Item
from schemas import SlamStartCreate, SlamStartRead

router = APIRouter(prefix="/api/slam", tags=["slam"])

@router.get("", response_model=Optional[SlamStartRead])
async def get_slam_start(db: AsyncSession = Depends(get_db)):
    res = await db.execute(select(SlamStart).order_by(SlamStart.id.desc()))
    row = res.scalars().first()
    if not row:
        return None
    return SlamStartRead(id=row.id, x=float(row.x), y=float(row.y), z=float(row.z) if row.z is not None else None, heading_deg=float(row.heading_deg) if getattr(row, 'heading_deg', None) is not None else None)

@router.post("", response_model=SlamStartRead)
async def create_slam_start(payload: SlamStartCreate, db: AsyncSession = Depends(get_db)):
    # Create a new item with type='slam_start' and minimal fields
    row = SlamStart(
        x=payload.x,
        y=payload.y,
        z=payload.z,
        heading_deg=payload.heading_deg,
    )
    db.add(row)
    await db.commit()
    await db.refresh(row)
    return SlamStartRead(id=row.id, x=float(row.x), y=float(row.y), z=float(row.z) if row.z is not None else None, heading_deg=float(row.heading_deg) if getattr(row, 'heading_deg', None) is not None else None)

@router.put("/{slam_id}", response_model=SlamStartRead)
async def update_slam_start(slam_id: int, payload: SlamStartCreate, db: AsyncSession = Depends(get_db)):
    row = await db.get(SlamStart, slam_id)
    if not row:
        raise HTTPException(status_code=404, detail="SLAM start not found")
    row.x = payload.x
    row.y = payload.y
    row.z = payload.z
    row.heading_deg = payload.heading_deg
    await db.commit()
    await db.refresh(row)
    return SlamStartRead(id=row.id, x=float(row.x), y=float(row.y), z=float(row.z) if row.z is not None else None, heading_deg=float(row.heading_deg) if getattr(row, 'heading_deg', None) is not None else None)
