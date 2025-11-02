# routers/segments.py
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import List
import math, json

from database import get_db
from models import Segment, Path, Item
from schemas import SegmentCreate, SegmentFreeCreate, SegmentRead

router = APIRouter(prefix="/api/segments", tags=["segments"])

@router.get("", response_model=List[SegmentRead])
async def list_segments(db: AsyncSession = Depends(get_db)):
    """
    Бүх segment жагсаалтыг polyline-г JSON-оос хөрвүүлж буцаана.
    """
    result = await db.execute(select(Segment))
    rows = result.scalars().all()
    out: List[SegmentRead] = []
    for r in rows:
        try:
            pl = json.loads(r.polyline_json)
        except Exception:
            pl = []
        out.append({
            "id": r.id,
            "from_item_id": r.from_item_id,
            "to_item_id": r.to_item_id,
            "polyline": pl
        })
    return out


@router.post("", response_model=SegmentRead)
async def create_segment(seg: SegmentCreate, db: AsyncSession = Depends(get_db)):
    """
    Админ зурсан polyline-г DB-д хадгалах.
    Polyline-ийн нийт уртыг тооцоод paths хүснэгтэд автоматаар холбоос үүсгэнэ.
    """
    # 1. Polyline-г JSON болгож хадгалах
    polyline_json_str = json.dumps([{"x": p.x, "y": p.y} for p in seg.polyline])

    # 2. Polyline-ийн нийт уртыг тооцоолох
    total_dist = 0.0
    for i in range(len(seg.polyline) - 1):
        dx = seg.polyline[i + 1].x - seg.polyline[i].x
        dy = seg.polyline[i + 1].y - seg.polyline[i].y
        total_dist += math.sqrt(dx * dx + dy * dy)

    # 3. Items шалгах
    from_item = await db.get(Item, seg.from_item_id)
    to_item = await db.get(Item, seg.to_item_id)
    if not from_item or not to_item:
        raise HTTPException(status_code=404, detail="From/To item not found")

    # 4. Segment-г үүсгэх
    new_seg = Segment(
        from_item_id=seg.from_item_id,
        to_item_id=seg.to_item_id,
        polyline_json=polyline_json_str,
        walkable=1
    )
    db.add(new_seg)
    await db.flush()  # new_seg.id авахын тулд

    # 5. Path-г автоматаар үүсгэх
    new_path = Path(
        from_item_id=seg.from_item_id,
        to_item_id=seg.to_item_id,
        distance=total_dist
    )
    db.add(new_path)

    await db.commit()
    await db.refresh(new_seg)

    # 6. Буцаахдаа polyline-г JSON string биш list хэлбэртэй болгоно
    return {
        "id": new_seg.id,
        "from_item_id": new_seg.from_item_id,
        "to_item_id": new_seg.to_item_id,
        "polyline": seg.polyline
    }


@router.post("/free", response_model=SegmentRead)
async def create_free_segment(seg: SegmentFreeCreate, db: AsyncSession = Depends(get_db)):
    """
    Чөлөөт зурсан polyline-г хадгална. from/to item шаардахгүй.
    """
    if not seg.polyline or len(seg.polyline) < 2:
        raise HTTPException(status_code=400, detail="Polyline must have at least 2 points")

    polyline_json_str = json.dumps([{"x": p.x, "y": p.y} for p in seg.polyline])

    new_seg = Segment(
        from_item_id=None,
        to_item_id=None,
        polyline_json=polyline_json_str,
        walkable=1
    )
    db.add(new_seg)

    # distance-г одоогоор paths хүснэгтэд оруулахгүй (free-draw mode)
    await db.commit()
    await db.refresh(new_seg)

    return {
        "id": new_seg.id,
        "from_item_id": new_seg.from_item_id,
        "to_item_id": new_seg.to_item_id,
        "polyline": seg.polyline
    }
