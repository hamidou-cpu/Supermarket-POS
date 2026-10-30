/*
  # Fix foreign keys: alerts and audit_logs user_id -> public.users

  1. Problem
    - alerts.user_id references auth.users(id) but the app uses custom auth (public.users)
    - audit_logs.user_id references auth.users(id) but the app uses custom auth (public.users)
    - This means JOINs like `select('*, users(full_name, email)')` fail because
      the FK points to auth.users, not public.users

  2. Changes
    - Drop existing FK constraints on alerts.user_id and audit_logs.user_id
    - Add new FK constraints pointing to public.users(id)
    - This allows Supabase's automatic join resolution to work with public.users

  3. Security
    - No RLS changes needed
*/

-- Fix alerts.user_id FK
ALTER TABLE alerts DROP CONSTRAINT IF EXISTS alerts_user_id_fkey;
ALTER TABLE alerts ADD CONSTRAINT alerts_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL;

-- Fix audit_logs.user_id FK
ALTER TABLE audit_logs DROP CONSTRAINT IF EXISTS audit_logs_user_id_fkey;
ALTER TABLE audit_logs ADD CONSTRAINT audit_logs_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL;
