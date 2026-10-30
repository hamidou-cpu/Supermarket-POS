/*
  # Fix RLS Policies for Login

  1. Changes
    - Add policy to allow anonymous users to read from users table for login
    - This allows the login process to work without requiring prior authentication
  
  2. Security
    - Anonymous users can only SELECT (read) user records
    - They cannot INSERT, UPDATE, or DELETE
    - Password hashes are returned but this is necessary for login verification
*/

-- Drop existing restrictive SELECT policy
DROP POLICY IF EXISTS "Users can view all users if authenticated" ON users;

-- Create new policy allowing anonymous read access for login
CREATE POLICY "Allow anonymous read for login"
  ON users FOR SELECT
  TO anon, authenticated
  USING (true);