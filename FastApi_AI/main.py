# main.py
import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text
from config import settings
from database import engine, Base
from routers import items, paths, route, segments
from routers import chatbot

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
app.include_router(chatbot.router)

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
        # lightweight SQLite migration: ensure 'z' column exists on items
        try:
            res = await conn.execute(text("PRAGMA table_info('items')"))
            cols = [row[1] for row in res]
            if 'z' not in cols:
                await conn.execute(text("ALTER TABLE items ADD COLUMN z REAL"))
        except Exception:
            pass

if __name__ == "__main__":
    uvicorn.run("main:app", reload=True)
