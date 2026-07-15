import os
import dotenv
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from sqlalchemy.orm import declarative_base

# Load environment variables from .env file
dotenv.load_dotenv()

# 1. Fetch connection string from environment
DATABASE_URL = os.getenv("DATABASE_URL", "").strip("'\"")

# 2. Convert database dialect scheme for SQLAlchemy asyncpg compatibility
if DATABASE_URL.startswith("postgresql://"):
    DATABASE_URL = DATABASE_URL.replace("postgresql://", "postgresql+asyncpg://", 1)
elif DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql+asyncpg://", 1)

# 3. Create Async Engine with PgBouncer & Cold-Start configurations
# - timeout = 30 waits up to 30 seconds for Neon to wake up from suspension
# - prepared_statement_cache_size = 0 & statement_cache_size = 0 disables statement caching
#   preventing database errors in transaction-mode PgBouncer pooling
connect_args = {
    "prepared_statement_cache_size": 0,
    "statement_cache_size": 0,
    "timeout": 30
}

engine = create_async_engine(
    DATABASE_URL,
    connect_args=connect_args,
    pool_size=5,
    max_overflow=10
)

# 4. Create Session Factory
async_session = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False
)

Base = declarative_base()

# 5. Dependency helper for FastAPI routes
async def get_db():
    async with async_session() as session:
        try:
            yield session
        finally:
            await session.close()
