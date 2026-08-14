import os
import dotenv
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from sqlalchemy.orm import declarative_base

dotenv.load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite+aiosqlite:///:memory:").strip("'\"")

if DATABASE_URL.startswith("postgresql://"):
    DATABASE_URL = DATABASE_URL.replace("postgresql://", "postgresql+asyncpg://", 1)
elif DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql+asyncpg://", 1)

if "postgresql" in DATABASE_URL:
    engine = create_async_engine(
        DATABASE_URL,
        connect_args={"prepared_statement_cache_size": 0, "statement_cache_size": 0, "timeout": 30},
        pool_size=5,
        max_overflow=10
    )
else:
    engine = create_async_engine(DATABASE_URL)

async_session = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False
)

Base = declarative_base()

async def get_db():
    async with async_session() as session:
        try:
            yield session
        finally:
            await session.close()
