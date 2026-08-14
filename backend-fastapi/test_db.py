import asyncio
import asyncpg
import os
import dotenv

dotenv.load_dotenv()

async def test_connect(url: str):
    masked_url = url.split("@")[-1] if "@" in url else url
    print(f"Testing connection to: ...@{masked_url}")
    try:
        conn = await asyncpg.connect(url)
        print("SUCCESSFULLY CONNECTED!")
        res = await conn.fetchval("SELECT 1;")
        print("Query test result:", res)
        await conn.close()
    except Exception as e:
        print("Connection failed:", e)

async def main():
    db_url = os.getenv("DATABASE_URL", "postgresql://postgres:password@localhost:5432/postgres")
    if db_url.startswith("postgresql+asyncpg://"):
        db_url = db_url.replace("postgresql+asyncpg://", "postgresql://", 1)

    read_replica_url = os.getenv("READ_REPLICA_URL", db_url)
    if read_replica_url.startswith("postgresql+asyncpg://"):
        read_replica_url = read_replica_url.replace("postgresql+asyncpg://", "postgresql://", 1)

    urls = [db_url, read_replica_url]
    for u in urls:
        await test_connect(u)

if __name__ == "__main__":
    asyncio.run(main())
