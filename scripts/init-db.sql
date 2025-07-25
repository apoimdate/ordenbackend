-- Create audit database if not exists
SELECT 'CREATE DATABASE ordendirecta_audit'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'ordendirecta_audit')\gexec

-- Connect to main database
\c ordendirecta;

-- Create schemas
CREATE SCHEMA IF NOT EXISTS public;
CREATE SCHEMA IF NOT EXISTS audit;

-- Enable extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "pg_trgm"; -- For text search

-- Grant permissions
GRANT ALL ON SCHEMA public TO postgres;
GRANT ALL ON SCHEMA audit TO postgres;

-- Create audit user with limited permissions (optional)
-- CREATE USER audit_user WITH PASSWORD 'audit_password';
-- GRANT USAGE ON SCHEMA audit TO audit_user;
-- GRANT SELECT, INSERT ON ALL TABLES IN SCHEMA audit TO audit_user;

-- Create performance indexes on commonly queried fields
-- These will be created after tables are created by Prisma migrations

-- Function to automatically update updatedAt timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW."updatedAt" = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Function for soft delete cascade (optional)
CREATE OR REPLACE FUNCTION soft_delete_cascade()
RETURNS TRIGGER AS $$
BEGIN
    -- This would handle cascading soft deletes
    -- Implementation depends on your specific needs
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create initial admin user (password: admin123)
-- This will be inserted after migrations run
-- INSERT INTO users (id, email, username, password, role, "isEmailVerified", "isActive")
-- VALUES (
--     gen_random_uuid(),
--     'admin@ordendirecta.com',
--     'admin',
--     '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewYpfQjBmJqp2FsO',
--     'SUPER_ADMIN',
--     true,
--     true
-- );