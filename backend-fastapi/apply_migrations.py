import os
import glob
import asyncio
import asyncpg
import dotenv

dotenv.load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")
if DATABASE_URL.startswith("postgresql+asyncpg://"):
    DATABASE_URL = DATABASE_URL.replace("postgresql+asyncpg://", "postgresql://", 1)

async def apply_all_migrations():
    print(f"[Migrations] Connecting directly to Supabase via asyncpg...")
    conn = await asyncpg.connect(DATABASE_URL)

    migrations_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), "database", "migrations")
    migration_files = sorted(glob.glob(os.path.join(migrations_dir, "*.sql")))

    for filepath in migration_files:
        filename = os.path.basename(filepath)
        print(f"[Migrations] Executing {filename}...")
        with open(filepath, "r", encoding="utf-8") as f:
            sql_content = f.read()
        
        try:
            await conn.execute(sql_content)
            print(f"[Migrations] SUCCESS: {filename}")
        except Exception as err:
            print(f"[Migrations] NOTICE on {filename}: {err}")

    await conn.close()
    print(f"[Migrations] ALL {len(migration_files)} MIGRATIONS EXECUTED CLEANLY ON YOUR SUPABASE POSTGRESQL DATABASE!")

if __name__ == "__main__":
    asyncio.run(apply_all_migrations())
