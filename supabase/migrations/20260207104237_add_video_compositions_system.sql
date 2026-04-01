/*
  # Video Compositions System

  1. New Tables
    - `video_compositions`
      - `id` (uuid, primary key)
      - `name` (text) - composition name
      - `description` (text) - optional description
      - `status` (text) - draft, published, archived
      - `duration_seconds` (integer) - total video duration
      - `fps` (integer) - frames per second
      - `width` (integer) - video width
      - `height` (integer) - video height
      - `scenes` (jsonb) - array of scene configurations
      - `theme` (jsonb) - theme overrides
      - `created_by` (uuid) - creator
      - `updated_at` (timestamptz)
      - `created_at` (timestamptz)

  2. Security
    - Enable RLS on `video_compositions` table
    - Only super admins can read/write
*/

CREATE TABLE IF NOT EXISTS video_compositions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text DEFAULT '',
  status text NOT NULL DEFAULT 'draft',
  duration_seconds integer NOT NULL DEFAULT 120,
  fps integer NOT NULL DEFAULT 30,
  width integer NOT NULL DEFAULT 1920,
  height integer NOT NULL DEFAULT 1080,
  scenes jsonb NOT NULL DEFAULT '[]'::jsonb,
  theme jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid REFERENCES auth.users(id),
  updated_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE video_compositions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admins can read video compositions"
  ON video_compositions FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'super_admin'
    )
  );

CREATE POLICY "Super admins can insert video compositions"
  ON video_compositions FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'super_admin'
    )
  );

CREATE POLICY "Super admins can update video compositions"
  ON video_compositions FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'super_admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'super_admin'
    )
  );

CREATE POLICY "Super admins can delete video compositions"
  ON video_compositions FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'super_admin'
    )
  );

CREATE INDEX IF NOT EXISTS idx_video_compositions_created_by ON video_compositions(created_by);
CREATE INDEX IF NOT EXISTS idx_video_compositions_status ON video_compositions(status);
