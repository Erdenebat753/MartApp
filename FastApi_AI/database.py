# database.py (SQLite хувилбар)

from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import sessionmaker, declarative_base

# MySQL биш, SQLite ашиглаж байна
# Энэ нь одоо таны төслийн хавтсанд store_nav.db гэж файл үүсгэнэ
DATABASE_URL = "sqlite+aiosqlite:///./store_nav.db"

engine = create_async_engine(
    DATABASE_URL,
    echo=True,           # debug log харагдана
    future=True
)

async_session_factory = sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autoflush=False,
    autocommit=False,
)

Base = declarative_base()

async def get_db():
    async with async_session_factory() as session:
        yield session
