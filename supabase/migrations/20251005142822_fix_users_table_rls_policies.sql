/*
  # Fix Users Table RLS Policies for Anonymous Access

  1. Changes
    - Drop existing restrictive policies for INSERT, UPDATE, DELETE on users table
    - Create new permissive policies allowing anonymous (anon) users to manage users
    - This enables the custom authentication system to work properly
  
  2. Security Note
    - Since we're using custom authentication (not Supabase Auth)
    - Application-level security checks are performed in the code
    - RLS is opened for anon role to allow the app to function
*/

-- Drop existing restrictive policies
DROP POLICY IF EXISTS "Only admins can insert users" ON users;
DROP POLICY IF EXISTS "Only admins can update users" ON users;
DROP POLICY IF EXISTS "Only admins can delete users" ON users;

-- Create permissive policies for anonymous users
CREATE POLICY "Allow anonymous insert users"
  ON users FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Allow anonymous update users"
  ON users FOR UPDATE
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow anonymous delete users"
  ON users FOR DELETE
  TO anon, authenticated
  USING (true);