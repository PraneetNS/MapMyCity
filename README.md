# MapMyCity (CrowdSense)

Crowd-sourced road quality reporting platform. Citizens capture potholes and road issues via a mobile app; submissions are moderated, clustered, and visualized on a map for admins and the public.

## Project structure

| Directory | Description |
|-----------|-------------|
| `crowdsense-app/` | Expo (React Native) mobile app for capturing and viewing submissions |
| `crowdsense-admin/` | Next.js admin dashboard for reviewing and managing reports |
| `backend/` | Node.js/Express API (legacy tier-0 backend) |
| `backend-fastapi/` | FastAPI backend with image moderation and Cloudinary integration |
| `database/` | PostgreSQL/PostGIS migration scripts |
| `supabase/` | Supabase Edge Functions |

## Getting started

### Database

Run migrations in order from `database/migrations/` against your PostgreSQL (Supabase) instance.

### Mobile app

```bash
cd crowdsense-app
cp .env.example .env   # add Supabase URL and anon key
npm install
npm start
```

### Admin dashboard

```bash
cd crowdsense-admin
npm install
npm run dev
```

### FastAPI backend

```bash
cd backend-fastapi
cp .env.example .env
pip install -r requirements.txt
uvicorn main:app --reload
```

## License

See individual package directories for license details.
