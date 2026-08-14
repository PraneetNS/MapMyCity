import os
import dotenv
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession

dotenv.load_dotenv()

READ_REPLICA_URL = os.getenv("READ_REPLICA_URL", os.getenv("DATABASE_URL", "sqlite+aiosqlite:///:memory:")).strip("'\"")

if READ_REPLICA_URL.startswith("postgresql://"):
    READ_REPLICA_URL = READ_REPLICA_URL.replace("postgresql://", "postgresql+asyncpg://", 1)
elif READ_REPLICA_URL.startswith("postgres://"):
    READ_REPLICA_URL = READ_REPLICA_URL.replace("postgres://", "postgresql+asyncpg://", 1)

if "postgresql" in READ_REPLICA_URL:
    read_engine = create_async_engine(
        READ_REPLICA_URL,
        connect_args={"prepared_statement_cache_size": 0, "statement_cache_size": 0, "timeout": 30},
        pool_size=10,
        max_overflow=20
    )
else:
    read_engine = create_async_engine(READ_REPLICA_URL)

async_read_session = async_sessionmaker(
    bind=read_engine,
    class_=AsyncSession,
    expire_on_commit=False
)

async def get_read_db():
    async with async_read_session() as session:
        try:
            yield session
        finally:
            await session.close()
