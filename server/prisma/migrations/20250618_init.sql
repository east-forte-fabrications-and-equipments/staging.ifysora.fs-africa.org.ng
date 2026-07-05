-- Initial schema with all tables
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email TEXT UNIQUE NOT NULL,
    phone TEXT UNIQUE,
    password_hash TEXT,
    display_name TEXT NOT NULL,
    profile_picture TEXT,
    fysora_user_id TEXT UNIQUE,
    ecosystem_user_id TEXT UNIQUE,
    role TEXT NOT NULL DEFAULT 'CUSTOMER',
    subscription_id TEXT,
    plan_id TEXT,
    subscription_status TEXT DEFAULT 'EXPIRED',
    verification_level INTEGER DEFAULT 0,
    is_verified BOOLEAN DEFAULT false,
    verification_data JSONB,
    permissions JSONB,
    last_login_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    deleted_at TIMESTAMP,
    cloud_providers JSONB,
    backup_settings JSONB
);

-- Add indexes
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_ecosystem_id ON users(ecosystem_user_id);
CREATE INDEX idx_users_role ON users(role);

-- ... rest of tables from schema
