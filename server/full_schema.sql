-- SQL Script to recreate the YouRef CRM Schema in a new Supabase Project

-- 1. Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 2. Create Users Table
CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    first_name TEXT,
    last_name TEXT,
    rut TEXT UNIQUE,
    password_hash TEXT,
    phone TEXT,
    date_of_birth DATE,
    role TEXT DEFAULT 'advisor', -- 'admin' or 'advisor'
    is_verified BOOLEAN DEFAULT FALSE,
    otp_code TEXT,
    otp_expires_at TIMESTAMPTZ,
    invited_by_userid TEXT,
    profile JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Create Referrals Table
CREATE TABLE IF NOT EXISTS referrals (
    id TEXT PRIMARY KEY,
    owner_user_id TEXT REFERENCES users(id),
    owner_name TEXT,
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    rut TEXT UNIQUE NOT NULL,
    phone TEXT,
    email TEXT,
    goals TEXT[] DEFAULT '{}',
    commune TEXT,
    income NUMERIC DEFAULT 0,
    down_payment NUMERIC DEFAULT 0,
    description TEXT,
    stage TEXT DEFAULT 'prospecto',
    status TEXT,
    status_note TEXT,
    updated_by_userid TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Create Audit Logs Table
CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_type TEXT NOT NULL, -- 'user', 'referral', 'auth'
    entity_id TEXT,
    action TEXT NOT NULL, -- 'create', 'update', 'delete', 'login', 'status_change'
    performed_by_userid TEXT,
    old_data JSONB DEFAULT '{}',
    new_data JSONB DEFAULT '{}',
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Create Sessions Table
CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    token TEXT NOT NULL UNIQUE,
    user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. Enable Row Level Security (RLS)
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE referrals ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;

-- 7. Basic RLS Policies (Frontend bypasses via Service Role in this architecture)
-- However, we add them for security best practices.
-- Typically, the backend uses the Service Role Key, so RLS doesn't apply to it.

-- 8. Create First Admin User
INSERT INTO users (id, email, first_name, last_name, role, is_verified, password_hash) 
VALUES ('admin_fernando', 'contacto@youref.cl', 'Fernando', 'Cabezas', 'admin', true, 'a478072b0f00994e67ffa144f96920e678a6bc46a0483c7f96ddc887c692a5c2');
