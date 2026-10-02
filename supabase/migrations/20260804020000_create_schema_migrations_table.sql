-- Migration: Initialize supabase_migrations schema and tracking table
-- Fixes PostgreSQL Error 42P01: relation "supabase_migrations.schema_migrations" does not exist

CREATE SCHEMA IF NOT EXISTS supabase_migrations;

CREATE TABLE IF NOT EXISTS supabase_migrations.schema_migrations (
    version TEXT PRIMARY KEY,
    statements TEXT[],
    name TEXT,
    inserted_at TIMESTAMPTZ DEFAULT now()
);

INSERT INTO supabase_migrations.schema_migrations (version, name)
VALUES 
    ('20260804000000', 'init_eskom_schema'),
    ('20260804010000', 'raw_data_ingestion_layer')
ON CONFLICT (version) DO NOTHING;
