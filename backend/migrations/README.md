# Measure X Database Migrations

This directory contains versioned SQL migrations for **Supabase PostgreSQL**.

## Applying Migrations

### Method 1: Automatic on Backend Startup
When the FastAPI backend starts (`uvicorn main:app`), `DatabaseManager.run_migrations()` automatically checks and ensures all tables, indexes, and columns exist non-destructively.

### Method 2: Supabase SQL Editor
Open the [Supabase Dashboard](https://supabase.com/dashboard) -> Select Project -> SQL Editor:
Copy and run `backend/schema.sql`.

### Method 3: Supabase CLI / psql
```bash
psql "$DATABASE_URL" -f backend/schema.sql
```
