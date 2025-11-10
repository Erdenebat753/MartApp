# main.py
import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text
from config import settings
from database import engine, Base
from routers import items, paths, route, segments
from routers import slam
from routers import chatbot
from routers import marts
from routers import lists
from routers import categories
from routers import auth
from fastapi.staticfiles import StaticFiles
import os

app = FastAPI(
    title="Store Indoor Navigation API",
    version="0.1.0"
)

# CORS for frontend (AdminDashboard)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS or ["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Router-уудаа холбож байна
app.include_router(items.router)
app.include_router(paths.router)
app.include_router(route.router)
app.include_router(segments.router)
app.include_router(slam.router)
app.include_router(chatbot.router)
app.include_router(marts.router)
app.include_router(lists.router)
app.include_router(categories.router)
app.include_router(auth.router)

# Эхний удаа dev орчинд table-уудыг автоматаар үүсгэхэд ашиглаж болно
# (Prod дээр alembic migration руу шилжинэ)
@app.on_event("startup")
async def on_startup():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        # Ensure SQLite enforces foreign keys
        try:
            await conn.execute(text("PRAGMA foreign_keys=ON"))
        except Exception:
            pass
    # Train intent classifier once on startup (if data present)
    try:
        from routers.chatbot import init_intent_model
        init_intent_model()
    except Exception:
        pass
    # lightweight SQLite migration: ensure 'z' and 'heading_deg' columns exist on items
    try:
        async with engine.begin() as conn2:
            res = await conn2.execute(text("PRAGMA table_info('items')"))
            cols = [row[1] for row in res]
            if 'z' not in cols:
                await conn2.execute(text("ALTER TABLE items ADD COLUMN z REAL"))
            if 'heading_deg' not in cols:
                await conn2.execute(text("ALTER TABLE items ADD COLUMN heading_deg REAL"))
            if 'mart_id' not in cols:
                await conn2.execute(text("ALTER TABLE items ADD COLUMN mart_id INTEGER"))
                # ensure at least one mart exists
                mres = await conn2.execute(text("SELECT id FROM marts LIMIT 1"))
                row = mres.fetchone()
                if row is None:
                    await conn2.execute(text("INSERT INTO marts (name) VALUES ('Default Mart')"))
                    mres2 = await conn2.execute(text("SELECT id FROM marts ORDER BY id DESC LIMIT 1"))
                    row = mres2.fetchone()
                default_mart_id = int(row[0]) if row else 1
                # set mart_id for existing items
                await conn2.execute(text("UPDATE items SET mart_id = :mid WHERE mart_id IS NULL"), { 'mid': default_mart_id })
            if 'sale_end_at' not in cols:
                await conn2.execute(text("ALTER TABLE items ADD COLUMN sale_end_at TIMESTAMP"))
            if 'category_id' not in cols:
                await conn2.execute(text("ALTER TABLE items ADD COLUMN category_id INTEGER"))
    except Exception:
        pass
    # one-time migrate existing items.type='slam_start' into slam_start table
    try:
        from sqlalchemy import select, delete
        from models import Item, SlamStart
        async with engine.begin() as conn3:
            # fetch slam items
            result = await conn3.execute(select(Item).where(Item.type == 'slam_start'))
            rows = result.scalars().all()
            for it in rows:
                await conn3.execute(
                    text("INSERT INTO slam_start (x,y,z,heading_deg) VALUES (:x,:y,:z,:h)"),
                    { 'x': float(it.x), 'y': float(it.y), 'z': float(it.z) if it.z is not None else None, 'h': float(it.heading_deg) if it.heading_deg is not None else None }
                )
            if rows:
                await conn3.execute(delete(Item).where(Item.type == 'slam_start'))
    except Exception:
        pass
    # Ensure uploads directory exists for static serving
    try:
        base_dir = os.path.dirname(os.path.abspath(__file__))
        upload_dir = os.path.join(base_dir, "uploads")
        os.makedirs(upload_dir, exist_ok=True)
    except Exception:
        pass

# Mount static for uploads
base_dir = os.path.dirname(os.path.abspath(__file__))
upload_dir = os.path.join(base_dir, "uploads")
try:
    os.makedirs(upload_dir, exist_ok=True)
except Exception:
    pass
app.mount("/uploads", StaticFiles(directory=upload_dir), name="uploads")

if __name__ == "__main__":
    uvicorn.run("main:app", reload=True)
